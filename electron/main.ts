import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell } from "electron";
import fs from "node:fs/promises";
import { parse, type HTMLElement } from "node-html-parser";
import os from "node:os";
import path from "node:path";
import {
  formatFromUrl,
  sanitizeFileName,
  supportedExtensions,
  titleFromUrl
} from "./services/bookFormats.js";
import { IPC_CHANNELS } from "./ipc/channels.js";
import { rootDir, appIconPath, ensureLibraryDir, ensureCoverDir, coverPathFor } from "./paths.js";
import { handleBookProtocol } from "./services/protocol.js";
import {
  bufferLooksLikeFormat,
  flushProgressUpdates,
  hashBuffer,
  importOneBook,
  queueProgressUpdate,
  sizeLabelFromText
} from "./services/library.js";
import {
  attrCandidates,
  hrefFrom,
  htmlDownloadHeaders,
  importabilityReason,
  normalizeSubjects,
  resolveUrl,
  resultArrayFromCustomPayload,
  selectedAttr,
  selectedElement,
  selectedText,
  stringField,
  valueByPath
} from "./services/scraper/dom.js";
import { fetchJson, loadHtml, withTimeout } from "./services/scraper/fetch.js";
import {
  initStore,
  getStore,
  defaultPreferences,
  migratePreferences,
  normalizePreferences,
  seedFromHash,
  bookToClient,
  updateBook
} from "./services/store.js";
import type {
  BookFormat,
  ReaderProgress,
  Bookmark,
  Highlight,
  ThemeCustomColors,
  ReaderPreferences,
  OnlineBookResult,
  OnlineSource,
  OnlineSourceTestItem,
  OnlineSourceTestReport,
  JsonSourceMappings,
  JsonSourceConfig,
  HtmlSourceConfig,
  ZLibStatus,
  ReadingSession,
  BookRecord,
  ClientBookRecord,
  Collection,
  ZlibCache
} from "./ipc/types.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "manga-reader",
    privileges: {
      standard: true,
      secure: true,
      corsEnabled: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

let mainWindow: BrowserWindow | undefined;

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

function isSameOrigin(url: string, originUrl?: string): boolean {
  if (!originUrl) {
    return false;
  }

  try {
    return new URL(url).origin === new URL(originUrl).origin;
  } catch {
    return false;
  }
}

async function openHttpExternal(url: unknown): Promise<boolean> {
  const parsed = httpUrl(url);
  if (!parsed) {
    return false;
  }

  await shell.openExternal(parsed.toString());
  return true;
}

async function openExternalAndAutoImport(book: OnlineBookResult): Promise<ClientBookRecord | undefined> {
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

async function importOnlineBook(book: OnlineBookResult): Promise<ClientBookRecord | undefined> {
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

  const sess = isZlibUrl(downloadUrl) ? zlibSession() : undefined;
  const browserBuffer = await browserDownloadToBuffer(downloadUrl, format, headers, 60000, sess);
  if (browserBuffer) {
    return importOnlineBuffer(book, downloadUrl, format, browserBuffer);
  }

  throw new Error(`${fetchFailure}；浏览器下载回退也没有拿到有效 ${format.toUpperCase()} 文件。`);
}

function firstDownloadUrl(formats: Record<string, unknown>): { url: string; format: BookFormat } | undefined {
  const priorities: Array<[string, BookFormat]> = [
    ["application/epub+zip", "epub"],
    ["application/x-mobipocket-ebook", "mobi"],
    ["text/plain", "txt"],
    ["application/pdf", "pdf"]
  ];

  for (const [mime, format] of priorities) {
    const value = formats[mime];
    if (typeof value === "string") {
      return { url: value, format };
    }
  }

  for (const [key, value] of Object.entries(formats)) {
    if (typeof value !== "string") {
      continue;
    }

    const format = formatFromUrl(value);
    if (format) {
      return { url: value, format };
    }

    if (key.startsWith("text/plain")) {
      return { url: value, format: "txt" };
    }
  }

  return undefined;
}

async function searchGutenbergBooks(query: string): Promise<OnlineBookResult[]> {
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
  const response = await net.fetch(url);

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    results?: Array<{
      id?: number;
      title?: string;
      authors?: Array<{ name?: string }>;
      languages?: string[];
      subjects?: string[];
      formats?: Record<string, unknown>;
      download_count?: number;
    }>;
  };

  return (data.results ?? [])
    .map((item): OnlineBookResult | undefined => {
      const download = firstDownloadUrl(item.formats ?? {});
      if (!item.id || !item.title || !download) {
        return undefined;
      }

      return {
        id: `gutenberg-${item.id}`,
        source: "Project Gutenberg",
        title: item.title,
        author: item.authors?.map((author) => author.name).filter(Boolean).join(", "),
        language: item.languages?.join(", "),
        subjects: (item.subjects ?? []).slice(0, 4),
        coverUrl:
          typeof item.formats?.["image/jpeg"] === "string" ? (item.formats["image/jpeg"] as string) : undefined,
        downloadUrl: download.url,
        format: download.format,
        downloads: item.download_count
      };
    })
    .filter((item): item is OnlineBookResult => Boolean(item))
    .slice(0, 20);
}

function customSourceSearchUrl(sourceUrl: string, query: string): string | undefined {
  const trimmed = sourceUrl.trim();

  if (!trimmed) {
    return undefined;
  }

  const resolved = trimmed.includes("{query}") ? trimmed.replaceAll("{query}", encodeURIComponent(query)) : trimmed;
  const url = new URL(resolved);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return undefined;
  }

  if (!trimmed.includes("{query}")) {
    url.searchParams.set("q", query);
  }

  return url.toString();
}

function resolveCustomSourceConfig(sourceValue: string): string | JsonSourceConfig | HtmlSourceConfig | undefined {
  const trimmed = sourceValue.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!trimmed.startsWith("{")) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.adapter === "json" && typeof parsed.searchUrl === "string" && parsed.searchUrl.trim()) {
      return {
        adapter: "json",
        searchUrl: parsed.searchUrl.trim(),
        resultPath: typeof parsed.resultPath === "string" ? parsed.resultPath.trim() : undefined,
        sourceName: typeof parsed.sourceName === "string" ? parsed.sourceName.trim() : undefined,
        headers:
          parsed.headers && typeof parsed.headers === "object"
            ? Object.fromEntries(
                Object.entries(parsed.headers).filter(
                  (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
                )
              )
            : undefined,
        mappings: parsed.mappings && typeof parsed.mappings === "object" ? (parsed.mappings as JsonSourceMappings) : undefined
      };
    }

    if (parsed.adapter === "html" && typeof parsed.searchUrl === "string" && parsed.searchUrl.trim()) {
      const maxDetailPages =
        typeof parsed.maxDetailPages === "number"
          ? parsed.maxDetailPages
          : typeof parsed.maxPages === "number"
            ? parsed.maxPages
            : undefined;
      const delay =
        typeof parsed.delay === "number"
          ? Math.max(0, Math.min(parsed.delay, 5000))
          : typeof parsed.waitMs === "number"
            ? Math.max(0, Math.min(parsed.waitMs, 5000))
            : undefined;
      const timeout =
        typeof parsed.timeout === "number"
          ? Math.max(1000, Math.min(parsed.timeout, 30000))
          : typeof parsed.timeoutMs === "number"
            ? Math.max(1000, Math.min(parsed.timeoutMs, 30000))
            : undefined;
      return {
        adapter: "html",
        searchUrl: parsed.searchUrl.trim(),
        baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl.trim() : undefined,
        sourceName: typeof parsed.sourceName === "string" ? parsed.sourceName.trim() : undefined,
        headers:
          parsed.headers && typeof parsed.headers === "object"
            ? Object.fromEntries(
                Object.entries(parsed.headers).filter(
                  (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
                )
              )
            : undefined,
        itemSelector: typeof parsed.itemSelector === "string" ? parsed.itemSelector.trim() : undefined,
        titleSelector: typeof parsed.titleSelector === "string" ? parsed.titleSelector.trim() : undefined,
        authorSelector: typeof parsed.authorSelector === "string" ? parsed.authorSelector.trim() : undefined,
        coverSelector: typeof parsed.coverSelector === "string" ? parsed.coverSelector.trim() : undefined,
        coverAttr: typeof parsed.coverAttr === "string" ? parsed.coverAttr.trim() : undefined,
        downloadSelector: typeof parsed.downloadSelector === "string" ? parsed.downloadSelector.trim() : undefined,
        downloadAttr: typeof parsed.downloadAttr === "string" ? parsed.downloadAttr.trim() : undefined,
        downloadHeaders:
          parsed.downloadHeaders && typeof parsed.downloadHeaders === "object"
            ? Object.fromEntries(
                Object.entries(parsed.downloadHeaders).filter(
                  (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
                )
              )
            : undefined,
        detailLinkSelector: typeof parsed.detailLinkSelector === "string" ? parsed.detailLinkSelector.trim() : undefined,
        detailLinkAttr: typeof parsed.detailLinkAttr === "string" ? parsed.detailLinkAttr.trim() : undefined,
        format:
          typeof parsed.format === "string" && supportedExtensions().includes(parsed.format as BookFormat)
            ? (parsed.format as BookFormat)
            : undefined,
        formatAttr: typeof parsed.formatAttr === "string" ? parsed.formatAttr.trim() : undefined,
        maxDetailPages,
        delay,
        renderJs: parsed.renderJs === true || parsed.js === true || parsed.javascript === true,
        waitForSelector: typeof parsed.waitForSelector === "string" ? parsed.waitForSelector.trim() : undefined,
        autoScroll: parsed.autoScroll === true || parsed.scroll === true || parsed.scrollToBottom === true,
        timeout
      };
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function mapJsonResult(item: unknown, config: JsonSourceConfig, index: number): OnlineBookResult | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const mappings = config.mappings ?? {};
  const object = item as Record<string, unknown>;
  const id = valueByPath(object, mappings.id);
  const title = valueByPath(object, mappings.title);
  const author = valueByPath(object, mappings.author);
  const language = valueByPath(object, mappings.language);
  const subjects = valueByPath(object, mappings.subjects);
  const coverUrl = valueByPath(object, mappings.coverUrl);
  const downloadUrl = valueByPath(object, mappings.downloadUrl);
  const formatValue = valueByPath(object, mappings.format);
  const sizeValue = valueByPath(object, mappings.sizeLabel ?? mappings.size);
  const source = valueByPath(object, mappings.source);

  if (typeof title !== "string" || typeof downloadUrl !== "string") {
    return undefined;
  }

  const format = formatFromUrl(downloadUrl, typeof formatValue === "string" ? (formatValue as BookFormat) : undefined);

  if (!format) {
    return undefined;
  }

  return {
    id: typeof id === "string" && id.trim() ? id : `json-${index}-${title}`,
    source: typeof source === "string" && source.trim() ? source : config.sourceName || "Custom source",
    title: title.trim(),
    author: typeof author === "string" && author.trim() ? author.trim() : undefined,
    language: typeof language === "string" && language.trim() ? language.trim() : undefined,
    subjects: normalizeSubjects(subjects),
    coverUrl: typeof coverUrl === "string" && coverUrl.trim() ? coverUrl.trim() : undefined,
    downloadUrl: downloadUrl.trim(),
    format,
    sizeLabel: typeof sizeValue === "string" && sizeValue.trim() ? sizeValue.trim() : sizeLabelFromText(JSON.stringify(object))
  };
}

async function searchJsonAdapterBooks(query: string, config: JsonSourceConfig): Promise<OnlineBookResult[]> {
  const url = customSourceSearchUrl(config.searchUrl, query);

  if (!url) {
    return [];
  }

  const payload = await fetchJson(url, config.headers);
  const root = config.resultPath ? valueByPath(payload, config.resultPath) : payload;
  return resultArrayFromCustomPayload(root)
    .map((item, index) => mapJsonResult(item, config, index))
    .filter((item): item is OnlineBookResult => Boolean(item))
    .slice(0, 40);
}

function zlibSession(): Electron.Session {
  return session.fromPartition("persist:natsu-zlib");
}

function isZlibUrl(url: string): boolean {
  return url.includes("z-library") || url.includes("zlibrary");
}

function directDownloadResult(
  element: HTMLElement,
  href: string,
  baseUrl: string,
  config: HtmlSourceConfig,
  index: number
): OnlineBookResult | undefined {
  const downloadUrl = resolveUrl(baseUrl, href);

  if (!downloadUrl) {
    return undefined;
  }

  let format = formatFromUrl(downloadUrl, config.format);

  if (!format && config.formatAttr) {
    const formatValue = element.getAttribute(config.formatAttr)?.trim().toLowerCase();
    if (formatValue && supportedExtensions().includes(formatValue as BookFormat)) {
      format = formatValue as BookFormat;
    }
  }

  if (!format) {
    return undefined;
  }

  const title = selectedText(element, config.titleSelector) || selectedText(element) || titleFromUrl(downloadUrl);
  const coverUrl = resolveUrl(baseUrl, selectedAttr(element, config.coverSelector, config.coverAttr, ["data-src", "src"]));
  const sizeLabel = sizeLabelFromText(selectedText(element));

  return {
    id: `html-${index}-${downloadUrl}`,
    source: config.sourceName || "HTML Source",
    title,
    author: selectedText(element, config.authorSelector),
    subjects: [],
    coverUrl,
    downloadUrl,
    format,
    sizeLabel,
    requestHeaders: htmlDownloadHeaders(config, baseUrl)
  };
}

async function resultFromDetailPage(
  element: HTMLElement,
  detailUrl: string,
  baseUrl: string,
  config: HtmlSourceConfig,
  index: number
): Promise<OnlineBookResult | undefined> {
  const detailHtml = await loadHtml(detailUrl, config);
  if (!detailHtml) {
    return undefined;
  }

  const detailRoot = parse(detailHtml);
  const downloadHref = hrefFrom(detailRoot, config.downloadSelector || "a[href]", config.downloadAttr);
  const downloadUrl = resolveUrl(detailUrl, downloadHref);

  if (!downloadUrl) {
    return undefined;
  }

  const format = formatFromUrl(downloadUrl, config.format);

  if (!format) {
    return undefined;
  }

  const title =
    selectedText(element, config.titleSelector) ||
    selectedText(detailRoot, config.titleSelector) ||
    selectedText(detailRoot, "title") ||
    titleFromUrl(downloadUrl);
  const coverUrl =
    resolveUrl(baseUrl, selectedAttr(element, config.coverSelector, config.coverAttr, ["data-src", "src"])) ||
    resolveUrl(detailUrl, selectedAttr(detailRoot, config.coverSelector, config.coverAttr, ["data-src", "src"]));
  const sizeLabel = sizeLabelFromText(selectedText(element)) || sizeLabelFromText(selectedText(detailRoot));

  return {
    id: `html-detail-${index}-${downloadUrl}`,
    source: config.sourceName || "HTML Source",
    title,
    author: selectedText(element, config.authorSelector) || selectedText(detailRoot, config.authorSelector),
    subjects: [],
    coverUrl,
    downloadUrl,
    format,
    sizeLabel,
    requestHeaders: htmlDownloadHeaders(config, detailUrl)
  };
}

async function searchHtmlAdapterBooks(query: string, config: HtmlSourceConfig): Promise<OnlineBookResult[]> {
  const url = customSourceSearchUrl(config.searchUrl, query);

  if (!url) {
    return [];
  }

  const sess = isZlibUrl(url) ? zlibSession() : undefined;
  const html = await loadHtml(url, config, sess);
  if (!html) {
    return [];
  }

  const root = parse(html);
  const baseUrl = config.baseUrl || url;
  const containers = config.itemSelector ? root.querySelectorAll(config.itemSelector) : root.querySelectorAll("a[href]");
  const results: OnlineBookResult[] = [];
  let followedDetails = 0;
  const maxDetailPages = Math.max(0, Math.min(config.maxDetailPages ?? 8, 20));

  for (const [index, element] of containers.entries()) {
    const downloadHref = hrefFrom(element, config.downloadSelector, config.downloadAttr);
    const direct = downloadHref ? directDownloadResult(element, downloadHref, baseUrl, config, index) : undefined;

    if (direct) {
      results.push(direct);
      continue;
    }

    const detailHref = hrefFrom(
      element,
      config.detailLinkSelector || (config.itemSelector ? "a[href]" : undefined),
      config.detailLinkAttr
    );
    const detailUrl = resolveUrl(baseUrl, detailHref);

    if (!detailUrl || followedDetails >= maxDetailPages) {
      continue;
    }

    followedDetails += 1;
    const detailResult = await resultFromDetailPage(element, detailUrl, baseUrl, config, index);
    if (detailResult) {
      results.push(detailResult);
    }
  }

  return results.slice(0, 40);
}

async function testHtmlAdapterBooks(query: string, config: HtmlSourceConfig): Promise<OnlineSourceTestReport> {
  const url = customSourceSearchUrl(config.searchUrl, query);

  if (!url) {
    return {
      ok: false,
      sourceName: config.sourceName || "HTML Source",
      kind: "html",
      fetched: false,
      renderedJs: Boolean(config.renderJs),
      itemCount: 0,
      items: [],
      message: "searchUrl 无效，请确认包含 {query} 或可追加 ?q="
    };
  }

  const html = await loadHtml(url, config);
  if (!html) {
    return {
      ok: false,
      sourceName: config.sourceName || "HTML Source",
      kind: "html",
      searchUrl: url,
      fetched: false,
      renderedJs: Boolean(config.renderJs),
      itemCount: 0,
      items: [],
      message: "页面获取失败，可能是网络、响应状态、验证页面或渲染超时"
    };
  }

  const root = parse(html);
  const baseUrl = config.baseUrl || url;
  const containers = config.itemSelector ? root.querySelectorAll(config.itemSelector) : root.querySelectorAll("a[href]");
  const maxDetailPages = Math.max(0, Math.min(config.maxDetailPages ?? 8, 20));
  const sampleContainers = containers.slice(0, 12);
  let followedDetails = 0;
  const items: OnlineSourceTestItem[] = [];

  for (const [index, element] of sampleContainers.entries()) {
    const title = selectedText(element, config.titleSelector) || selectedText(element);
    const author = selectedText(element, config.authorSelector);
    const coverUrl = resolveUrl(baseUrl, selectedAttr(element, config.coverSelector, config.coverAttr, ["data-src", "src"]));
    const sizeLabel = sizeLabelFromText(selectedText(element));
    const directHref = hrefFrom(element, config.downloadSelector, config.downloadAttr);
    let downloadUrl = resolveUrl(baseUrl, directHref);
    let detailUrl: string | undefined;

    if (!downloadUrl && followedDetails < maxDetailPages) {
      const detailHref = hrefFrom(
        element,
        config.detailLinkSelector || (config.itemSelector ? "a[href]" : undefined),
        config.detailLinkAttr
      );
      detailUrl = resolveUrl(baseUrl, detailHref);

      if (detailUrl) {
        followedDetails += 1;
        const detailHtml = await loadHtml(detailUrl, config);
        if (detailHtml) {
          const detailRoot = parse(detailHtml);
          downloadUrl = resolveUrl(detailUrl, hrefFrom(detailRoot, config.downloadSelector || "a[href]", config.downloadAttr));
        }
      }
    } else {
      const detailHref = hrefFrom(
        element,
        config.detailLinkSelector || (config.itemSelector ? "a[href]" : undefined),
        config.detailLinkAttr
      );
      detailUrl = resolveUrl(baseUrl, detailHref);
    }

    const format = downloadUrl ? formatFromUrl(downloadUrl, config.format) : undefined;
    const reason = importabilityReason(downloadUrl, format);
    items.push({
      index,
      title,
      author,
      coverUrl,
      detailUrl,
      downloadUrl,
      format,
      sizeLabel,
      ok: !reason,
      reason
    });
  }

  const okCount = items.filter((item) => item.ok).length;
  return {
    ok: okCount > 0,
    sourceName: config.sourceName || "HTML Source",
    kind: "html",
    searchUrl: url,
    fetched: true,
    renderedJs: Boolean(config.renderJs),
    itemCount: containers.length,
    items,
    message:
      containers.length === 0
        ? "页面已获取，但 itemSelector 没匹配到结果"
        : okCount > 0
          ? `可导入 ${okCount} / ${items.length} 条样本`
          : "匹配到了结果，但样本里没有可直接导入的下载链接"
  };
}

async function testJsonAdapterBooks(query: string, config: JsonSourceConfig): Promise<OnlineSourceTestReport> {
  const url = customSourceSearchUrl(config.searchUrl, query);
  if (!url) {
    return {
      ok: false,
      sourceName: config.sourceName || "JSON Source",
      kind: "json",
      fetched: false,
      itemCount: 0,
      items: [],
      message: "searchUrl 无效"
    };
  }

  const payload = await fetchJson(url, config.headers);
  const root = config.resultPath ? valueByPath(payload, config.resultPath) : payload;
  const rawItems = resultArrayFromCustomPayload(root).slice(0, 12);
  const items = rawItems.map((item, index): OnlineSourceTestItem => {
    const mapped = mapJsonResult(item, config, index);
    return {
      index,
      title: mapped?.title,
      author: mapped?.author,
      coverUrl: mapped?.coverUrl,
      downloadUrl: mapped?.downloadUrl,
      format: mapped?.format,
      sizeLabel: mapped?.sizeLabel,
      ok: Boolean(mapped),
      reason: mapped ? undefined : "JSON 映射后缺少 title/downloadUrl，或无法判断格式"
    };
  });

  const okCount = items.filter((item) => item.ok).length;
  return {
    ok: okCount > 0,
    sourceName: config.sourceName || "JSON Source",
    kind: "json",
    searchUrl: url,
    fetched: true,
    itemCount: resultArrayFromCustomPayload(root).length,
    items,
    message: okCount > 0 ? `可导入 ${okCount} / ${items.length} 条样本` : "没有解析到可导入结果"
  };
}

async function searchCustomBooks(query: string, sourceUrl: string, sourceName = "Custom Source"): Promise<OnlineBookResult[]> {
  const url = customSourceSearchUrl(sourceUrl, query);

  if (!url) {
    return [];
  }

  const response = await net.fetch(url);

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return resultArrayFromCustomPayload(payload)
    .map((raw, index): OnlineBookResult | undefined => {
      if (!raw || typeof raw !== "object") {
        return undefined;
      }

      const item = raw as Record<string, unknown>;
      const downloadUrl = stringField(item, ["downloadUrl", "download_url", "url", "href", "file"]);
      const title = stringField(item, ["title", "name"]);
      const sizeLabel = stringField(item, ["sizeLabel", "size_label", "size", "fileSize", "file_size"]);

      if (!downloadUrl || !title) {
        return undefined;
      }

      const format = formatFromUrl(downloadUrl, stringField(item, ["format"]) as BookFormat | undefined);

      if (!format) {
        return undefined;
      }

      return {
        id: stringField(item, ["id"]) ?? `custom-${index}-${title}`,
        source: stringField(item, ["source"]) ?? sourceName,
        title,
        author: stringField(item, ["author", "creator"]),
        language: stringField(item, ["language", "lang"]),
        subjects: Array.isArray(item.subjects) ? item.subjects.filter((value) => typeof value === "string").slice(0, 4) : [],
        coverUrl: stringField(item, ["coverUrl", "cover_url", "cover"]),
        downloadUrl,
        format,
        sizeLabel: sizeLabel || sizeLabelFromText(JSON.stringify(item))
      };
    })
    .filter((item): item is OnlineBookResult => Boolean(item))
    .slice(0, 40);
}

async function searchRssFeed(query: string, feedUrl: string, sourceName: string): Promise<OnlineBookResult[]> {
  const resolvedUrl = feedUrl.replace(/\{q\}/g, encodeURIComponent(query));
  try {
    const response = await withTimeout(net.fetch(resolvedUrl, {
      headers: { "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml" }
    }), 15000, null);
    if (!response || !response.ok) return [];
    const xml = await response.text();
    const doc = parse(xml);
    const lowerQuery = query.toLowerCase();

    const items = doc.querySelectorAll("item, entry");
    const results: OnlineBookResult[] = [];

    for (const item of items) {
      const title = item.querySelector("title")?.text?.trim() ?? "";
      const author = item.querySelector("author name, dc\\:creator, author")?.text?.trim() ?? "";
      const link = item.querySelector("enclosure")?.getAttribute("url")
        ?? item.querySelector("link[rel='enclosure']")?.getAttribute("href")
        ?? item.querySelector("link")?.getAttribute("href")
        ?? item.querySelector("link")?.text?.trim()
        ?? "";

      if (!feedUrl.includes("{q}")) {
        const haystack = `${title} ${author}`.toLowerCase();
        if (!haystack.includes(lowerQuery)) continue;
      }

      if (!link) continue;

      const enclosureType = item.querySelector("enclosure")?.getAttribute("type") ?? "";
      const format: BookFormat | undefined =
        link.endsWith(".epub") || enclosureType.includes("epub") ? "epub"
        : link.endsWith(".pdf") || enclosureType.includes("pdf") ? "pdf"
        : link.endsWith(".txt") || enclosureType.includes("text/plain") ? "txt"
        : undefined;

      if (!format) continue;

      const coverUrl = item.querySelector("image url, media\\:thumbnail, itunes\\:image")?.text?.trim()
        ?? item.querySelector("media\\:thumbnail")?.getAttribute("url")
        ?? undefined;

      results.push({
        id: `rss-${Buffer.from(link).toString("base64").slice(0, 16)}`,
        source: sourceName,
        title: title || "Untitled",
        author: author || undefined,
        language: undefined,
        subjects: [],
        coverUrl: coverUrl || undefined,
        downloadUrl: link,
        format,
        sizeLabel: undefined
      });
    }
    return results.slice(0, 40);
  } catch {
    return [];
  }
}

async function searchSource(query: string, source: OnlineSource): Promise<OnlineBookResult[]> {
  if (!source.enabled) {
    return [];
  }

  if (source.kind === "gutenberg") {
    return searchGutenbergBooks(query);
  }

  if (!source.value.trim()) {
    return [];
  }

  if (source.kind === "json") {
    const config = resolveCustomSourceConfig(source.value);
    if (config && typeof config === "object" && config.adapter === "json") {
      return searchJsonAdapterBooks(query, {
        ...config,
        sourceName: config.sourceName || source.name
      });
    }
    return [];
  }

  if (source.kind === "html") {
    const config = resolveCustomSourceConfig(source.value);
    if (config && typeof config === "object" && config.adapter === "html") {
      return searchHtmlAdapterBooks(query, {
        ...config,
        sourceName: config.sourceName || source.name
      });
    }

    if (typeof config === "string" && config.trim()) {
      return searchHtmlAdapterBooks(query, {
        adapter: "html",
        sourceName: source.name,
        searchUrl: config
      });
    }

    return [];
  }

  if (source.kind === "rss") {
    return searchRssFeed(query, source.value, source.name);
  }

  return searchCustomBooks(query, source.value, source.name);
}

async function testOnlineSource(query: string, source: OnlineSource): Promise<OnlineSourceTestReport> {
  const normalizedQuery = query.trim() || "test";

  try {
    if (source.kind === "gutenberg") {
      const results = await searchGutenbergBooks(normalizedQuery);
      return {
        ok: results.length > 0,
        sourceName: "Project Gutenberg",
        kind: "gutenberg",
        fetched: true,
        itemCount: results.length,
        items: results.slice(0, 12).map((book, index) => ({
          index,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          downloadUrl: book.downloadUrl,
          format: book.format,
          sizeLabel: book.sizeLabel,
          ok: Boolean(book.downloadUrl && book.format),
          reason: importabilityReason(book.downloadUrl, book.format)
        })),
        message: results.length ? `可导入 ${results.length} 条结果` : "没有结果"
      };
    }

    if (!source.value.trim()) {
      return {
        ok: false,
        sourceName: source.name,
        kind: source.kind,
        fetched: false,
        itemCount: 0,
        items: [],
        message: "书源配置为空"
      };
    }

    const config = resolveCustomSourceConfig(source.value);

    if (source.kind === "html") {
      if (config && typeof config === "object" && config.adapter === "html") {
        return testHtmlAdapterBooks(normalizedQuery, { ...config, sourceName: config.sourceName || source.name });
      }

      if (typeof config === "string" && config.trim()) {
        return testHtmlAdapterBooks(normalizedQuery, {
          adapter: "html",
          sourceName: source.name,
          searchUrl: config
        });
      }
    }

    if (source.kind === "json") {
      if (config && typeof config === "object" && config.adapter === "json") {
        return testJsonAdapterBooks(normalizedQuery, { ...config, sourceName: config.sourceName || source.name });
      }
    }

    if (source.kind === "url") {
      const results = await searchCustomBooks(normalizedQuery, source.value, source.name);
      return {
        ok: results.length > 0,
        sourceName: source.name,
        kind: "url",
        searchUrl: customSourceSearchUrl(source.value, normalizedQuery),
        fetched: true,
        itemCount: results.length,
        items: results.slice(0, 12).map((book, index) => ({
          index,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          downloadUrl: book.downloadUrl,
          format: book.format,
          sizeLabel: book.sizeLabel,
          ok: Boolean(book.downloadUrl && book.format),
          reason: importabilityReason(book.downloadUrl, book.format)
        })),
        message: results.length ? `可导入 ${results.length} 条结果` : "没有结果"
      };
    }

    return {
      ok: false,
      sourceName: source.name,
      kind: source.kind,
      fetched: false,
      itemCount: 0,
      items: [],
      message: "配置不是当前类型可识别的适配器"
    };
  } catch (error) {
    return {
      ok: false,
      sourceName: source.name,
      kind: source.kind,
      fetched: false,
      itemCount: 0,
      items: [],
      message: error instanceof Error ? error.message : "测试失败"
    };
  }
}

async function searchOnlineBooks(query: string): Promise<OnlineBookResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const preferences = normalizePreferences(getStore().get("preferences"));
  const enabledSources = preferences.onlineSources.filter((source) => source.enabled);
  const results = await Promise.allSettled(
    enabledSources.map((source) =>
      withTimeout(searchSource(normalizedQuery, source), 45000, [] as OnlineBookResult[])
    )
  );
  const merged: OnlineBookResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status !== "fulfilled") {
      continue;
    }

    for (const item of result.value) {
      const key = `${item.source}|${item.downloadUrl}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(item);
    }
  }

  return merged.slice(0, 80);
}

async function createWindow(): Promise<void> {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "Natsu",
    icon: appIconPath(),
    backgroundColor: "#f7fcff",
    titleBarStyle: "hiddenInset",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(rootDir, "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.setMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openHttpExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isSameOrigin(url, devServerUrl)) {
      return;
    }

    event.preventDefault();

    if (httpUrl(url)) {
      void openHttpExternal(url);
    }
  });

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(rootDir, "dist", "index.html"));
  }
}

async function fetchZlibAccount(sess: Electron.Session): Promise<ZLibStatus> {
  const CACHE_TTL = 30 * 60 * 1000;
  const cached = getStore().get("zlibCache");
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return { loggedIn: true, email: cached.email, remaining: cached.remaining, dailyLimit: cached.dailyLimit };
  }

  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      contextIsolation: true,
      javascript: true,
      nodeIntegration: false,
      sandbox: true,
      session: sess
    }
  });

  try {
    await withTimeout(
      win.loadURL("https://z-library.sk/profile", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }).then(() => true).catch(() => false),
      20000,
      false
    );

    // Check that profile page actually loaded (not redirected to /login)
    const currentUrl = win.webContents.getURL();
    try {
      if (new URL(currentUrl).pathname.includes("login")) {
        return { loggedIn: false };
      }
    } catch {
      // invalid URL, proceed with scraping
    }

    const result = await withTimeout(
      win.webContents.executeJavaScript(`
        (function() {
          const emailSelectors = [
            '.user-email', '[data-email]', '.profile-email',
            '.account-email', '.user-info .email'
          ];
          let email = '';
          for (const sel of emailSelectors) {
            const el = document.querySelector(sel);
            if (el) { email = (el.textContent || el.getAttribute('data-email') || '').trim(); break; }
          }
          if (!email) {
            const all = document.querySelectorAll('*');
            for (const el of all) {
              const text = (el.childNodes[0]?.textContent || '').trim();
              if (/^[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}$/i.test(text)) { email = text; break; }
            }
          }
          const bodyText = document.body.innerText || '';
          const quotaMatch = bodyText.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
          const remaining = quotaMatch ? parseInt(quotaMatch[1], 10) : undefined;
          const dailyLimit = quotaMatch ? parseInt(quotaMatch[2], 10) : undefined;
          return { email: email || undefined, remaining, dailyLimit };
        })()
      `, true).catch(() => ({ email: undefined, remaining: undefined, dailyLimit: undefined })),
      10000,
      { email: undefined, remaining: undefined, dailyLimit: undefined }
    ) as { email?: string; remaining?: number; dailyLimit?: number };

    // Only cache if we got at least some data
    if (result.email !== undefined || result.remaining !== undefined) {
      const cache: ZlibCache = {
        email: result.email,
        remaining: result.remaining,
        dailyLimit: result.dailyLimit,
        cachedAt: Date.now()
      };
      getStore().set("zlibCache", cache);
    }

    return { loggedIn: true, ...result };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.libraryListBooks, () => {
    return getStore().get("books", []).map(bookToClient);
  });

  ipcMain.handle(IPC_CHANNELS.libraryImportBooks, async () => {
    const result = await dialog.showOpenDialog({
      title: "Import books",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Books and comics",
          extensions: supportedExtensions()
        }
      ]
    });

    if (result.canceled) {
      return [];
    }

    const imported: ClientBookRecord[] = [];

    for (const filePath of result.filePaths) {
      const book = await importOneBook(filePath);
      if (book) {
        imported.push(book);
      }
    }

    return imported;
  });

  ipcMain.handle(IPC_CHANNELS.librarySearchOnlineBooks, async (_event, query: string) => {
    return searchOnlineBooks(query);
  });

  ipcMain.handle(IPC_CHANNELS.libraryTestOnlineSource, async (_event, query: string, source: OnlineSource) => {
    return testOnlineSource(query, source);
  });

  ipcMain.handle(IPC_CHANNELS.libraryImportOnlineBook, async (_event, book: OnlineBookResult) => {
    return importOnlineBook(book);
  });

  ipcMain.handle(IPC_CHANNELS.libraryOpenExternalAndAutoImport, async (_event, book: OnlineBookResult) => {
    return openExternalAndAutoImport(book);
  });

  ipcMain.handle(IPC_CHANNELS.systemOpenExternal, async (_event, url: string) => {
    return openHttpExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.systemSaveFile, async (_event, content: string, suggestedName: string) => {
    if (typeof content !== "string" || typeof suggestedName !== "string") return false;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: suggestedName,
      filters: suggestedName.endsWith(".tsv")
        ? [{ name: "TSV", extensions: ["tsv"] }]
        : [{ name: "Markdown", extensions: ["md"] }]
    });
    if (canceled || !filePath) return false;
    try {
      await fs.writeFile(filePath, content, "utf-8");
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.libraryOpenBook, (_event, id: string) => {
    const book = updateBook(id, (current) => ({
      ...current,
      lastOpenedAt: new Date().toISOString()
    }));

    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle(IPC_CHANNELS.librarySaveProgress, (_event, id: string, progress: ReaderProgress) => {
    // Buffer the update and debounce the actual disk write (5 s)
    queueProgressUpdate(id, progress);

    // Return optimistic client record from current in-memory store
    const books = getStore().get("books", []);
    const book = books.find((b) => b.id === id);
    if (!book) return undefined;
    return bookToClient({ ...book, progress });
  });

  ipcMain.handle(IPC_CHANNELS.librarySaveBookmark, (_event, id: string, bookmark: Bookmark) => {
    const book = updateBook(id, (current) => ({
      ...current,
      bookmarks: [bookmark, ...current.bookmarks].slice(0, 200)
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle(
    IPC_CHANNELS.libraryUpdateBookmark,
    (
      _event,
      bookId: string,
      bookmarkId: string,
      patch: Partial<Pick<Bookmark, "label" | "note" | "progress">>
    ) => {
      const book = updateBook(bookId, (current) => ({
        ...current,
        bookmarks: current.bookmarks.map((bookmark) =>
          bookmark.id === bookmarkId
            ? {
                ...bookmark,
                ...patch,
                label: patch.label?.trim() || bookmark.label
              }
            : bookmark
        )
      }));
      return book ? bookToClient(book) : undefined;
    }
  );

  ipcMain.handle(IPC_CHANNELS.libraryRemoveBookmarks, (_event, bookId: string, bookmarkIds: string[]) => {
    const removeSet = new Set(bookmarkIds);
    const book = updateBook(bookId, (current) => ({
      ...current,
      bookmarks: current.bookmarks.filter((bookmark) => !removeSet.has(bookmark.id))
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle(IPC_CHANNELS.librarySaveHighlight, (_event, bookId: string, highlight: Highlight) => {
    const book = updateBook(bookId, (current) => ({
      ...current,
      highlights: [...(current.highlights ?? []), highlight]
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle(IPC_CHANNELS.libraryUpdateHighlight, (_event, bookId: string, highlightId: string, patch: Partial<Pick<Highlight, "color" | "note">>) => {
    const book = updateBook(bookId, (current) => ({
      ...current,
      highlights: (current.highlights ?? []).map((h) =>
        h.id === highlightId ? { ...h, ...patch } : h
      )
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle(IPC_CHANNELS.libraryRemoveHighlights, (_event, bookId: string, highlightIds: string[]) => {
    const set = new Set(highlightIds);
    const book = updateBook(bookId, (current) => ({
      ...current,
      highlights: (current.highlights ?? []).filter((h) => !set.has(h.id))
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle(IPC_CHANNELS.libraryRemoveBook, async (_event, id: string) => {
    const books = getStore().get("books", []);
    const book = books.find((item) => item.id === id);

    if (book) {
      await fs.rm(book.filePath, { force: true });
      await fs.rm(coverPathFor(book.id), { force: true });
    }

    getStore().set(
      "books",
      books.filter((item) => item.id !== id)
    );

    return getStore().get("books", []).map(bookToClient);
  });

  ipcMain.handle(IPC_CHANNELS.coverHas, async (_event, bookId: string) => {
    if (typeof bookId !== "string" || !bookId) return false;
    try {
      await fs.access(coverPathFor(bookId));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.coverSave, async (_event, bookId: string, bytes: Uint8Array | ArrayBuffer) => {
    if (typeof bookId !== "string" || !bookId) return false;
    await ensureCoverDir();
    const buf =
      bytes instanceof ArrayBuffer ? Buffer.from(new Uint8Array(bytes)) : Buffer.from(bytes);
    await fs.writeFile(coverPathFor(bookId), buf);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.coverFetchForBook, async (_event, bookId: string) => {
    if (typeof bookId !== "string" || !bookId) return false;
    const books = getStore().get("books", []);
    const book = books.find((b) => b.id === bookId);
    if (!book) return false;

    // Already has a cover on disk — skip
    try { await fs.access(coverPathFor(bookId)); return true; } catch { /* proceed */ }

    let imageUrl: string | undefined;

    // Strategy: Google Books by title+author
    try {
      const q = encodeURIComponent(`intitle:${book.title}${book.author ? `+inauthor:${book.author}` : ""}`);
      const resp = await withTimeout(net.fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`), 8000, null);
      if (resp?.ok) {
        const data = await resp.json() as { items?: Array<{ volumeInfo?: { imageLinks?: { thumbnail?: string } } }> };
        const thumb = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
        if (thumb) {
          imageUrl = thumb.replace("http://", "https://").replace("&zoom=1", "&zoom=3");
        }
      }
    } catch { /* ignore */ }

    if (!imageUrl) return false;

    try {
      const imgResp = await withTimeout(net.fetch(imageUrl), 8000, null);
      if (!imgResp?.ok) return false;
      const buf = Buffer.from(await imgResp.arrayBuffer());
      if (buf.length < 2000) return false;
      await ensureCoverDir();
      await fs.writeFile(coverPathFor(bookId), buf);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.preferencesGet, () => {
    const userPrefs = getStore().get("preferences");
    const merged = { ...defaultPreferences(), ...userPrefs };
    const preferences = normalizePreferences(migratePreferences(merged));
    getStore().set("preferences", preferences);
    return preferences;
  });

  ipcMain.handle(IPC_CHANNELS.preferencesSave, (_event, preferences: Partial<ReaderPreferences>) => {
    const userPrefs = getStore().get("preferences");
    const merged = { ...defaultPreferences(), ...userPrefs, ...preferences };
    const nextPreferences = normalizePreferences(migratePreferences(merged));
    getStore().set("preferences", nextPreferences);
    return nextPreferences;
  });

  // 批量删除
  ipcMain.handle(IPC_CHANNELS.libraryRemoveBooks, async (_event, ids: string[]) => {
    const idSet = new Set<string>(ids);
    const books = getStore().get("books", []);
    for (const book of books) {
      if (idSet.has(book.id)) {
        await fs.rm(book.filePath, { force: true });
        await fs.rm(coverPathFor(book.id), { force: true });
      }
    }
    getStore().set("books", books.filter((b) => !idSet.has(b.id)));
    return getStore().get("books", []).map(bookToClient);
  });

  // 拖放导入（路径列表直接导入）
  ipcMain.handle(IPC_CHANNELS.libraryImportByPaths, async (_event, paths: string[]) => {
    const imported: ClientBookRecord[] = [];
    for (const filePath of paths) {
      const book = await importOneBook(filePath);
      if (book) imported.push(book);
    }
    return imported;
  });

  // 编辑书籍元数据（标题/作者）
  ipcMain.handle(IPC_CHANNELS.libraryUpdateBookMeta, (_event, id: string, patch: { title?: string; author?: string }) => {
    const book = updateBook(id, (current) => ({
      ...current,
      ...(patch.title?.trim() ? { title: patch.title.trim() } : {}),
      ...(patch.author !== undefined ? { author: patch.author.trim() || undefined } : {})
    }));
    return book ? bookToClient(book) : undefined;
  });

  // 保存阅读 session
  ipcMain.handle(IPC_CHANNELS.librarySaveReadingSession, (_event, bookId: string, session: ReadingSession) => {
    const book = updateBook(bookId, (current) => ({
      ...current,
      readingSessions: [...(current.readingSessions ?? []), session].slice(-500)
    }));
    return book ? bookToClient(book) : undefined;
  });

  // 导出数据到 JSON 文件
  ipcMain.handle(IPC_CHANNELS.libraryExportData, async () => {
    const result = await dialog.showSaveDialog({
      title: "导出 Natsu 数据",
      defaultPath: `natsu-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return false;
    const books = getStore().get("books", []).map((b) => {
      const { filePath: _fp, ...rest } = b;
      return rest;
    });
    const preferences = getStore().get("preferences");
    await fs.writeFile(result.filePath, JSON.stringify({ version: 1, books, preferences }, null, 2), "utf-8");
    return true;
  });

  // ── 收藏夹 ──────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.libraryListCollections, () => {
    return getStore().get("collections", []);
  });

  ipcMain.handle(IPC_CHANNELS.librarySaveCollection, (_event, collection: Collection) => {
    const current = getStore().get("collections", []);
    const exists = current.find((c) => c.id === collection.id);
    const next = exists
      ? current.map((c) => (c.id === collection.id ? collection : c))
      : [...current, collection];
    getStore().set("collections", next);
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.libraryRemoveCollection, (_event, id: string) => {
    const next = getStore().get("collections", []).filter((c) => c.id !== id);
    getStore().set("collections", next);
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.libraryAddBookToCollection, (_event, collectionId: string, bookId: string) => {
    const collections = getStore().get("collections", []);
    const next = collections.map((c) =>
      c.id === collectionId
        ? { ...c, bookIds: c.bookIds.includes(bookId) ? c.bookIds : [...c.bookIds, bookId] }
        : c
    );
    getStore().set("collections", next);
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.libraryRemoveBookFromCollection, (_event, collectionId: string, bookId: string) => {
    const collections = getStore().get("collections", []);
    const next = collections.map((c) =>
      c.id === collectionId ? { ...c, bookIds: c.bookIds.filter((id) => id !== bookId) } : c
    );
    getStore().set("collections", next);
    return next;
  });

  // 书籍标签
  ipcMain.handle(IPC_CHANNELS.libraryUpdateBookTags, (_event, bookId: string, tags: string[]) => {
    const book = updateBook(bookId, (current) => ({ ...current, tags }));
    return book ? bookToClient(book) : undefined;
  });

  // 阅读目标统计（今日分钟、连续天数）
  ipcMain.handle(IPC_CHANNELS.libraryGetGoalStats, () => {
    const preferences = getStore().get("preferences");
    const dailyGoalMinutes = preferences.dailyGoalMinutes ?? 30;
    const books = getStore().get("books", []);
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();

    let todayMinutes = 0;
    const dayMinutes = new Map<string, number>();

    for (const book of books) {
      for (const session of book.readingSessions ?? []) {
        const dayKey = session.start.slice(0, 10);
        const mins = (new Date(session.end).getTime() - new Date(session.start).getTime()) / 60000;
        dayMinutes.set(dayKey, (dayMinutes.get(dayKey) ?? 0) + mins);
        if (dayKey === today) todayMinutes += mins;
      }
    }

    // 连续打卡：从今天往前数连续达标天数
    let streak = 0;
    let checkDay = new Date(now);
    for (let i = 0; i < 365; i++) {
      const key = checkDay.toISOString().slice(0, 10);
      const mins = dayMinutes.get(key) ?? 0;
      if (mins >= dailyGoalMinutes) {
        streak++;
        checkDay.setDate(checkDay.getDate() - 1);
      } else if (i === 0) {
        // 今天还没达标，从昨天开始算
        checkDay.setDate(checkDay.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      todayMinutes: Math.round(todayMinutes),
      dailyGoalMinutes,
      streak,
      goalReachedToday: todayMinutes >= dailyGoalMinutes
    };
  });

  ipcMain.handle(IPC_CHANNELS.libraryGetSessionsByDate, () => {
    const books = getStore().get("books", []);
    const dayMap = new Map<string, number>();
    for (const book of books) {
      for (const session of book.readingSessions ?? []) {
        const day = session.start.slice(0, 10);
        const mins = (new Date(session.end).getTime() - new Date(session.start).getTime()) / 60000;
        if (isNaN(mins) || mins < 0) continue;
        dayMap.set(day, (dayMap.get(day) ?? 0) + mins);
      }
    }
    return [...dayMap.entries()]
      .map(([date, minutes]) => ({ date, minutes: Math.round(minutes) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });

  // 从 JSON 文件导入数据（按 hash 合并）
  ipcMain.handle(IPC_CHANNELS.libraryImportData, async () => {
    const result = await dialog.showOpenDialog({
      title: "导入 Natsu 数据",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (result.canceled || !result.filePaths[0]) return false;
    let parsed: { version?: number; books?: Partial<BookRecord>[]; preferences?: Partial<ReaderPreferences> };
    try {
      const raw = await fs.readFile(result.filePaths[0], "utf-8");
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return false;
    }
    if (!parsed || !Array.isArray(parsed.books)) return false;
    const existing = getStore().get("books", []);
    const existingByHash = new Map(existing.map((b) => [b.hash, b]));
    for (const imported of parsed.books) {
      if (!imported.hash || !imported.id) continue;
      const match = existingByHash.get(imported.hash);
      if (match) {
        // 合并书签、高亮、阅读 sessions
        const merged: BookRecord = {
          ...match,
          bookmarks: imported.bookmarks ?? match.bookmarks,
          highlights: imported.highlights ?? match.highlights,
          readingSessions: [
            ...(match.readingSessions ?? []),
            ...(imported.readingSessions ?? [])
          ].slice(-500),
          progress: imported.progress ?? match.progress
        };
        existingByHash.set(match.hash, merged);
      }
    }
    getStore().set("books", [...existingByHash.values()]);
    if (parsed.preferences) {
      const userPrefs = getStore().get("preferences");
      getStore().set("preferences", normalizePreferences(migratePreferences({ ...defaultPreferences(), ...userPrefs, ...parsed.preferences })));
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.zlibStatus, async (): Promise<ZLibStatus> => {
    const sess = zlibSession();
    const cookies = await sess.cookies.get({ domain: ".z-library.sk" });
    const loggedIn = cookies.some((c) => c.name === "remix_userkey" || c.name === "remix_userid");
    if (!loggedIn) {
      return { loggedIn: false };
    }
    const cached = getStore().get("zlibCache");
    const CACHE_TTL = 30 * 60 * 1000;
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return { loggedIn: true, email: cached.email, remaining: cached.remaining, dailyLimit: cached.dailyLimit };
    }
    return { loggedIn: true };
  });

  ipcMain.handle(IPC_CHANNELS.zlibLogout, async (): Promise<void> => {
    await zlibSession().clearStorageData();
    getStore().delete("zlibCache" as never);
  });

  ipcMain.handle(IPC_CHANNELS.zlibLogin, async (): Promise<ZLibStatus> => {
    const sess = zlibSession();
    const baseUrl = "https://z-library.sk";

    return new Promise<ZLibStatus>((resolve) => {
      const loginWin = new BrowserWindow({
        show: true,
        width: 800,
        height: 620,
        center: true,
        title: "Z-Library 登录",
        webPreferences: {
          contextIsolation: true,
          javascript: true,
          nodeIntegration: false,
          sandbox: true,
          session: sess
        }
      });

      let settled = false;
      const finish = async (success: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        loginWin.webContents.off("did-navigate", onNavigate);
        if (!loginWin.isDestroyed()) {
          loginWin.off("closed", onClosed);
          loginWin.destroy();
        }
        if (success) {
          const status = await fetchZlibAccount(sess).catch(() => ({ loggedIn: true } as ZLibStatus));
          resolve(status);
        } else {
          resolve({ loggedIn: false });
        }
      };

      const onNavigate = (_event: Electron.Event, url: string) => {
        try {
          const urlObj = new URL(url);
          if (!urlObj.pathname.includes("login")) {
            void finish(true);
          }
        } catch {
          // ignore invalid URLs during navigation
        }
      };

      const onClosed = () => void finish(false);

      const timer = setTimeout(() => void finish(false), 5 * 60 * 1000);

      loginWin.webContents.on("did-navigate", onNavigate);
      loginWin.on("closed", onClosed);
      loginWin
        .loadURL(`${baseUrl}/login`, {
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        .catch(() => void finish(false));
    });
  });

  ipcMain.handle(IPC_CHANNELS.zlibFetchAccount, async (): Promise<ZLibStatus> => {
    const sess = zlibSession();
    const cookies = await sess.cookies.get({ domain: ".z-library.sk" });
    const loggedIn = cookies.some((c) => c.name === "remix_userkey" || c.name === "remix_userid");
    if (!loggedIn) {
      return { loggedIn: false };
    }
    // Force fresh fetch by clearing cache before calling
    getStore().delete("zlibCache" as never);
    return fetchZlibAccount(sess).catch(() => ({ loggedIn: true } as ZLibStatus));
  });
}

app.whenReady().then(async () => {
  initStore();

  protocol.handle("manga-reader", handleBookProtocol);
  registerIpc();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("before-quit", () => {
  flushProgressUpdates();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
