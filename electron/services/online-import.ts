import { BrowserWindow, net, session, shell } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureLibraryDir } from "../paths.js";
import {
  formatFromUrl,
  sanitizeFileName,
  titleFromUrl
} from "./bookFormats.js";
import {
  bufferLooksLikeFormat,
  hashBuffer
} from "./library.js";
import { bookToClient, getStore, seedFromHash } from "./store.js";
import type {
  BookFormat,
  BookRecord,
  ClientBookRecord,
  OnlineBookResult
} from "../ipc/types.js";

function httpUrl(value: unknown): URL | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isZlibUrl(url: string): boolean {
  return url.includes("z-library") || url.includes("zlibrary");
}

export async function openExternalAndAutoImport(book: OnlineBookResult): Promise<ClientBookRecord | undefined> {
  const downloadUrl = book.downloadUrl?.trim();
  if (!downloadUrl) {
    throw new Error("下载链接为空。");
  }

  const parsed = httpUrl(downloadUrl);
  if (!parsed) {
    throw new Error("下载链接不是 HTTP/HTTPS 地址。");
  }

  await shell.openExternal(parsed.toString());
  throw new Error("已在浏览器中打开下载链接。为避免误导入其他文件，请下载完成后手动导入。");
}

async function cookieHeaderForUrl(url: string): Promise<string | undefined> {
  try {
    const cookies = await session.defaultSession.cookies.get({ url });
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    return cookieHeader || undefined;
  } catch {
    return undefined;
  }
}

async function onlineDownloadHeaders(book: OnlineBookResult, downloadUrl: string): Promise<Headers> {
  const headers = new Headers(book.requestHeaders ?? {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/epub+zip, application/pdf, application/octet-stream, */*");
  }

  if (!headers.has("User-Agent")) {
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
    );
  }

  if (!headers.has("Cookie")) {
    const cookie = await cookieHeaderForUrl(downloadUrl);
    if (cookie) {
      headers.set("Cookie", cookie);
    }
  }

  return headers;
}

function headersToLoadOptions(headers: Headers): { userAgent?: string; extraHeaders?: string } {
  let userAgent: string | undefined;
  const extra: string[] = [];

  headers.forEach((value, key) => {
    if (key.toLowerCase() === "user-agent") {
      userAgent = value;
    } else {
      extra.push(`${key}: ${value}`);
    }
  });

  return {
    userAgent,
    extraHeaders: extra.length ? extra.join("\n") : undefined
  };
}

async function importOnlineBuffer(
  book: OnlineBookResult,
  downloadUrl: string,
  format: BookFormat,
  buffer: Buffer
): Promise<ClientBookRecord | undefined> {
  const hash = hashBuffer(buffer);
  const books = getStore().get("books", []);
  const duplicate = books.find((item) => item.hash === hash);

  if (duplicate) {
    return bookToClient(duplicate);
  }

  const libraryDir = await ensureLibraryDir();
  const id = hash.slice(0, 20);
  const storedFileName = `${id}.${format}`;
  const storedPath = path.join(libraryDir, storedFileName);
  await fs.writeFile(storedPath, buffer);

  const now = new Date().toISOString();
  const title = book.title?.trim() || titleFromUrl(downloadUrl);
  const record: BookRecord = {
    id,
    hash,
    title,
    author: book.author?.trim() || undefined,
    format,
    fileName: `${sanitizeFileName(title) || id}.${format}`,
    filePath: storedPath,
    size: buffer.byteLength,
    importedAt: now,
    lastOpenedAt: now,
    bookmarks: [],
    highlights: [],
    coverSeed: seedFromHash(hash)
  };

  getStore().set("books", [record, ...books]);
  return bookToClient(record);
}

async function browserDownloadToBuffer(
  url: string,
  format: BookFormat,
  headers: Headers,
  timeoutMs = 60000,
  sess?: Electron.Session
): Promise<Buffer | undefined> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "natsu-download-"));
  const tempPath = path.join(tempDir, `download.${format}`);
  const downloadSession = sess ?? session.defaultSession;
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      javascript: true,
      nodeIntegration: false,
      sandbox: true,
      ...(sess ? { session: sess } : {})
    }
  });

  try {
    const { userAgent, extraHeaders } = headersToLoadOptions(headers);
    const downloadedPath = await new Promise<string | undefined>((resolve) => {
      let settled = false;
      const finish = (value?: string) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        downloadSession.off("will-download", onDownload);
        resolve(value);
      };
      const timer = setTimeout(() => finish(undefined), timeoutMs);
      const onDownload = (
        _event: Electron.Event,
        item: Electron.DownloadItem,
        webContents: Electron.WebContents
      ) => {
        if (webContents.id !== win.webContents.id) {
          return;
        }

        item.setSavePath(tempPath);
        item.once("done", (_doneEvent, state) => {
          finish(state === "completed" ? tempPath : undefined);
        });
      };

      downloadSession.on("will-download", onDownload);
      win
        .loadURL(url, {
          userAgent,
          extraHeaders
        })
        .catch(() => undefined);
    });

    if (!downloadedPath) {
      return undefined;
    }

    const buffer = await fs.readFile(downloadedPath);
    return bufferLooksLikeFormat(buffer, format, undefined) ? buffer : undefined;
  } finally {
    if (!win.isDestroyed()) {
      win.destroy();
    }
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function importOnlineBook(book: OnlineBookResult): Promise<ClientBookRecord | undefined> {
  const downloadUrl = book.downloadUrl?.trim();

  if (!downloadUrl) {
    throw new Error("下载链接为空。");
  }

  const parsedUrl = new URL(downloadUrl);

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("下载链接不是 HTTP/HTTPS 地址。");
  }

  const format = formatFromUrl(downloadUrl, book.format);

  if (!format) {
    throw new Error("无法判断文件格式，请在书源配置里指定 format。");
  }

  const headers = await onlineDownloadHeaders(book, downloadUrl);
  let fetchFailure = "";

  try {
    const ac = new AbortController();
    const fetchTimer = setTimeout(() => ac.abort(), 15000);
    try {
      const response = await net.fetch(downloadUrl, { headers, signal: ac.signal });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        const buffer = Buffer.from(await response.arrayBuffer());

        if (bufferLooksLikeFormat(buffer, format, contentType)) {
          return importOnlineBuffer(book, downloadUrl, format, buffer);
        }

        const size = `${Math.max(1, Math.round(buffer.byteLength / 1024))} KB`;
        fetchFailure = `普通下载拿到的不是有效 ${format.toUpperCase()}：${contentType || "未知类型"}（${size}）`;
      } else {
        fetchFailure = `普通下载失败：HTTP ${response.status}`;
      }
    } finally {
      clearTimeout(fetchTimer);
    }
  } catch (error) {
    fetchFailure = error instanceof Error ? error.message : "普通下载失败";
  }

  const sess = isZlibUrl(downloadUrl) ? session.fromPartition("persist:natsu-zlib") : undefined;
  const browserBuffer = await browserDownloadToBuffer(downloadUrl, format, headers, 60000, sess);
  if (browserBuffer) {
    return importOnlineBuffer(book, downloadUrl, format, browserBuffer);
  }

  throw new Error(`${fetchFailure}；浏览器下载回退也没有拿到有效 ${format.toUpperCase()} 文件。`);
}
