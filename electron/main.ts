import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell } from "electron";
import Store from "electron-store";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { parse, type HTMLElement } from "node-html-parser";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type BookFormat =
  | "epub"
  | "txt"
  | "mobi"
  | "azw3"
  | "pdf"
  | "cbz"
  | "zip"
  | "cbr"
  | "rar";

interface ReaderProgress {
  kind: "text" | "page" | "epub";
  current: number;
  total?: number;
  percent: number;
  label?: string;
  cfi?: string;
  updatedAt: string;
}

interface Bookmark {
  id: string;
  label: string;
  progress: ReaderProgress;
  createdAt: string;
  note?: string;
}

interface Highlight {
  id: string;
  chapterId: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  color: "yellow" | "green" | "blue" | "pink";
  note?: string;
  createdAt: string;
}

interface ThemeCustomColors {
  primary: string;
  secondary: string;
  tertiary: string;
  surface: string;
}

interface ReaderPreferences {
  theme: "ramune" | "seaside" | "natsumatsuri" | "google-night";
  themeMode: "system" | "light" | "dark";
  themeSource: "preset" | "seed" | "custom";
  themeSeedColor: string;
  customColors: ThemeCustomColors;
  language: "zh-CN" | "ja-JP" | "en-US";
  motion: "full" | "gentle" | "reduced";
  readerMode: "scroll" | "paged";
  fontSize: number;
  lineHeight: number;
  columnWidth: number;
  fontFamily: "serif-cn" | "sans" | "kai" | "jp-serif" | "serif-en" | "custom";
  customFontStack: string;
  imageScale: number;
  imageMode: "manual" | "fit-screen";
  autoAlign: boolean;
  reduceMotion: boolean;
  pageTurnStyle: "slide" | "fade" | "none";
  spread: "auto" | "single" | "double";
  tapToTurn: boolean;
  onlineSources: OnlineSource[];
  readerColorPreset: "default" | "paper" | "quiet" | "gray" | "night";
  brightness: number;
  pageMargin: "narrow" | "normal" | "wide";
  justify: boolean;
  hyphenate: boolean;
  preferencesVersion: number;
}

interface OnlineBookResult {
  id: string;
  source: string;
  title: string;
  author?: string;
  language?: string;
  subjects: string[];
  coverUrl?: string;
  downloadUrl: string;
  format?: BookFormat;
  sizeLabel?: string;
  requestHeaders?: Record<string, string>;
  downloads?: number;
}

interface OnlineSource {
  id: string;
  name: string;
  enabled: boolean;
  kind: "gutenberg" | "url" | "json" | "html";
  value: string;
}

interface OnlineSourceTestItem {
  index: number;
  title?: string;
  author?: string;
  coverUrl?: string;
  detailUrl?: string;
  downloadUrl?: string;
  format?: BookFormat;
  sizeLabel?: string;
  ok: boolean;
  reason?: string;
}

interface OnlineSourceTestReport {
  ok: boolean;
  sourceName: string;
  kind: OnlineSource["kind"];
  searchUrl?: string;
  fetched: boolean;
  renderedJs?: boolean;
  itemCount: number;
  items: OnlineSourceTestItem[];
  message?: string;
}

interface JsonSourceMappings {
  id?: string;
  title?: string;
  author?: string;
  language?: string;
  subjects?: string;
  coverUrl?: string;
  downloadUrl?: string;
  format?: string;
  sizeLabel?: string;
  size?: string;
  source?: string;
}

interface JsonSourceConfig {
  adapter: "json";
  searchUrl: string;
  resultPath?: string;
  sourceName?: string;
  headers?: Record<string, string>;
  mappings?: JsonSourceMappings;
}

interface HtmlSourceConfig {
  adapter: "html";
  searchUrl: string;
  baseUrl?: string;
  sourceName?: string;
  headers?: Record<string, string>;
  itemSelector?: string;
  titleSelector?: string;
  authorSelector?: string;
  coverSelector?: string;
  coverAttr?: string;
  downloadSelector?: string;
  downloadAttr?: string;
  downloadHeaders?: Record<string, string>;
  detailLinkSelector?: string;
  detailLinkAttr?: string;
  format?: BookFormat;
  maxDetailPages?: number;
  delay?: number;
  renderJs?: boolean;
  waitForSelector?: string;
  autoScroll?: boolean;
  timeout?: number;
}

interface BookRecord {
  id: string;
  hash: string;
  title: string;
  author?: string;
  format: BookFormat;
  fileName: string;
  filePath: string;
  size: number;
  importedAt: string;
  lastOpenedAt?: string;
  progress?: ReaderProgress;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  preferences?: Partial<ReaderPreferences>;
  coverSeed: number;
}

interface ClientBookRecord extends Omit<BookRecord, "filePath"> {
  fileUrl: string;
}

interface StoreShape {
  books: BookRecord[];
  preferences: ReaderPreferences;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const appIconPath = (): string =>
  app.isPackaged ? path.join(process.resourcesPath, "icon.ico") : path.join(rootDir, "build", "icon.ico");

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
let store: Store<StoreShape>;

// P0-4: debounce progress writes to avoid full-library JSON rewrite on every page turn
const pendingProgressUpdates = new Map<string, ReaderProgress>();
let progressFlushTimer: ReturnType<typeof setTimeout> | null = null;

function flushProgressUpdates(): void {
  if (progressFlushTimer !== null) {
    clearTimeout(progressFlushTimer);
    progressFlushTimer = null;
  }
  if (pendingProgressUpdates.size === 0) return;
  const books = store.get("books", []);
  const updates = new Map(pendingProgressUpdates);
  pendingProgressUpdates.clear();
  const updated = books.map((book) =>
    updates.has(book.id) ? { ...book, progress: updates.get(book.id)! } : book
  );
  store.set("books", updated);
}

function systemLanguage(): ReaderPreferences["language"] {
  const locale = app.getLocale().toLowerCase();

  if (locale.startsWith("ja")) {
    return "ja-JP";
  }

  if (locale.startsWith("en")) {
    return "en-US";
  }

  return "zh-CN";
}

function defaultPreferences(): ReaderPreferences {
  return {
    theme: "ramune",
    themeMode: "system",
    themeSource: "preset",
    themeSeedColor: "#35a7d8",
    customColors: {
      primary: "#35a7d8",
      secondary: "#ffc4d6",
      tertiary: "#ffe27a",
      surface: "#f7fcff"
    },
    language: systemLanguage(),
    motion: "full",
    readerMode: "scroll",
    fontSize: 18,
    lineHeight: 1.82,
    columnWidth: 760,
    fontFamily: "serif-cn",
    customFontStack: "",
    imageScale: 82,
    imageMode: "manual",
    autoAlign: true,
    reduceMotion: false,
    pageTurnStyle: "slide",
    spread: "auto",
    tapToTurn: true,
    readerColorPreset: "default",
    brightness: 1,
    pageMargin: "normal",
    justify: false,
    hyphenate: false,
    preferencesVersion: 3,
    onlineSources: [
      {
        id: "gutenberg",
        name: "Project Gutenberg",
        enabled: true,
        kind: "gutenberg",
        value: ""
      }
    ]
  };
}

function defaultOnlineSource(): OnlineSource {
  return {
    id: "gutenberg",
    name: "Project Gutenberg",
    enabled: true,
    kind: "gutenberg",
    value: ""
  };
}

function normalizeOnlineSources(value: unknown, legacyValue?: unknown): OnlineSource[] {
  const sources: OnlineSource[] = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const item = entry as Partial<OnlineSource>;
      const kind =
        item.kind === "gutenberg" || item.kind === "json" || item.kind === "html" ? item.kind : "url";
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `source-${sources.length + 1}`;
      const name =
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : kind === "gutenberg"
            ? "Project Gutenberg"
            : `Custom Source ${sources.length + 1}`;
      const enabled = item.enabled !== false;
      const rawValue = typeof item.value === "string" ? item.value : "";

      if (kind !== "gutenberg" && !rawValue.trim()) {
        continue;
      }

      sources.push({
        id,
        name,
        enabled,
        kind,
        value: kind === "gutenberg" ? "" : rawValue
      });
    }
  }

  const hasGutenberg = sources.some((item) => item.kind === "gutenberg");
  if (!hasGutenberg) {
    sources.unshift(defaultOnlineSource());
  }

  if (!sources.some((item) => item.kind !== "gutenberg") && typeof legacyValue === "string" && legacyValue.trim()) {
    sources.push({
      id: "legacy-custom",
      name: "Custom Source",
      enabled: true,
      kind: legacyValue.trim().startsWith("{") ? "json" : "url",
      value: legacyValue.trim()
    });
  }

  return sources;
}

function migratePreferences(prefs: Partial<ReaderPreferences>): Partial<ReaderPreferences> {
  const version = prefs.preferencesVersion ?? 1;
  const migrated = { ...prefs };

  // v1 → v2: 补 tapToTurn, pageTurnStyle, spread
  if (version < 2) {
    if (migrated.tapToTurn === undefined) migrated.tapToTurn = true;
    if (migrated.pageTurnStyle === undefined) migrated.pageTurnStyle = "slide";
    if (migrated.spread === undefined) migrated.spread = "auto";
  }

  // v2 → v3: 补 readerColorPreset, brightness, pageMargin, justify, hyphenate
  if (version < 3) {
    if (migrated.readerColorPreset === undefined) migrated.readerColorPreset = "default";
    if (migrated.brightness === undefined) migrated.brightness = 1;
    if (migrated.pageMargin === undefined) migrated.pageMargin = "normal";
    if (migrated.justify === undefined) migrated.justify = false;
    if (migrated.hyphenate === undefined) migrated.hyphenate = false;
  }

  migrated.preferencesVersion = 3;
  return migrated;
}

function normalizePreferences(preferences?: Partial<ReaderPreferences> & { onlineSourceUrl?: string }): ReaderPreferences {
  const defaults = defaultPreferences();

  return {
    ...defaults,
    ...preferences,
    onlineSources: normalizeOnlineSources(preferences?.onlineSources, preferences?.onlineSourceUrl),
    customColors: {
      ...defaults.customColors,
      ...preferences?.customColors
    }
  };
}

function supportedExtensions(): BookFormat[] {
  return ["epub", "txt", "mobi", "azw3", "pdf", "cbz", "zip", "cbr", "rar"];
}

function formatFromPath(filePath: string): BookFormat | undefined {
  const extension = path.extname(filePath).slice(1).toLowerCase();

  if (supportedExtensions().includes(extension as BookFormat)) {
    return extension as BookFormat;
  }

  return undefined;
}

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

function titleFromFile(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/[_-]+/g, " ");
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return titleFromFile(decodeURIComponent(parsed.pathname.split("/").pop() || "book"));
  } catch {
    return "Online book";
  }
}

function sizeLabelFromText(text?: string): string | undefined {
  if (!text) {
    return undefined;
  }

  const match = text.replace(/\s+/g, " ").match(/(\d+(?:[.,]\d+)?)\s*(B|KB|KIB|MB|MIB|GB|GIB)\b/i);
  if (!match) {
    return undefined;
  }

  const value = match[1].replace(",", ".");
  const unit = match[2].toUpperCase().replace("IB", "B");
  return `${value} ${unit}`;
}

function seedFromHash(hash: string): number {
  return Number.parseInt(hash.slice(0, 8), 16) || 1;
}

function bookToClient(book: BookRecord): ClientBookRecord {
  const { filePath: _filePath, ...publicBook } = book;

  return {
    ...publicBook,
    highlights: publicBook.highlights ?? [],
    fileUrl: `manga-reader://book/${encodeURIComponent(book.id)}`
  };
}

async function ensureLibraryDir(): Promise<string> {
  const libraryDir = path.join(app.getPath("userData"), "library");
  await fs.mkdir(libraryDir, { recursive: true });
  return libraryDir;
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function importOneBook(filePath: string): Promise<ClientBookRecord | undefined> {
  const format = formatFromPath(filePath);

  if (!format) {
    return undefined;
  }

  const stats = await fs.stat(filePath);
  const hash = await hashFile(filePath);
  const books = store.get("books", []);
  const duplicate = books.find((book) => book.hash === hash);

  if (duplicate) {
    return bookToClient(duplicate);
  }

  const libraryDir = await ensureLibraryDir();
  const id = hash.slice(0, 20);
  const storedFileName = `${id}.${format}`;
  const storedPath = path.join(libraryDir, storedFileName);

  await fs.copyFile(filePath, storedPath);

  const now = new Date().toISOString();
  const book: BookRecord = {
    id,
    hash,
    title: titleFromFile(filePath),
    format,
    fileName: path.basename(filePath),
    filePath: storedPath,
    size: stats.size,
    importedAt: now,
    bookmarks: [],
    highlights: [],
    coverSeed: seedFromHash(hash)
  };

  store.set("books", [book, ...books]);

  return bookToClient(book);
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

function formatFromUrl(url: string, explicitFormat?: BookFormat): BookFormat | undefined {
  if (explicitFormat && supportedExtensions().includes(explicitFormat)) {
    return explicitFormat;
  }

  try {
    const parsed = new URL(url);
    return formatFromPath(parsed.pathname);
  } catch {
    return undefined;
  }
}

function isLikelyHtml(buffer: Buffer, contentType?: string | null): boolean {
  if (contentType?.toLowerCase().includes("text/html")) {
    return true;
  }

  const prefix = buffer.subarray(0, Math.min(buffer.byteLength, 512)).toString("utf8").trimStart().toLowerCase();
  return prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.includes("<title>");
}

function bufferLooksLikeFormat(buffer: Buffer, format: BookFormat, contentType?: string | null): boolean {
  if (!buffer.byteLength || isLikelyHtml(buffer, contentType)) {
    return false;
  }

  if (format === "epub" || format === "zip" || format === "cbz") {
    return buffer.subarray(0, 2).toString("ascii") === "PK";
  }

  if (format === "pdf") {
    return buffer.subarray(0, 4).toString("ascii") === "%PDF";
  }

  if (format === "rar" || format === "cbr") {
    return buffer.subarray(0, 4).toString("ascii") === "Rar!";
  }

  if (format === "txt") {
    return !buffer.subarray(0, Math.min(buffer.byteLength, 256)).includes(0);
  }

  return true;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 96);
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
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
  const books = store.get("books", []);
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

  store.set("books", [record, ...books]);
  return bookToClient(record);
}

async function browserDownloadToBuffer(
  url: string,
  format: BookFormat,
  headers: Headers,
  timeoutMs = 60000
): Promise<Buffer | undefined> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "natsu-download-"));
  const tempPath = path.join(tempDir, `download.${format}`);
  const downloadPartition = `natsu-download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const downloadSession = session.fromPartition(downloadPartition);
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 700,
    webPreferences: {
      partition: downloadPartition,
      contextIsolation: true,
      javascript: true,
      nodeIntegration: false,
      sandbox: true
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
    await downloadSession.clearStorageData().catch(() => undefined);
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
    const response = await net.fetch(downloadUrl, { headers });

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
  } catch (error) {
    fetchFailure = error instanceof Error ? error.message : "普通下载失败";
  }

  const browserBuffer = await browserDownloadToBuffer(downloadUrl, format, headers);
  if (browserBuffer) {
    return importOnlineBuffer(book, downloadUrl, format, browserBuffer);
  }

  throw new Error(`${fetchFailure}；浏览器下载回退也没有拿到有效 ${format.toUpperCase()} 文件。`);
}

function updateBook(id: string, updater: (book: BookRecord) => BookRecord): BookRecord | undefined {
  const books = store.get("books", []);
  let changed: BookRecord | undefined;

  const nextBooks = books.map((book) => {
    if (book.id !== id) {
      return book;
    }

    changed = updater(book);
    return changed;
  });

  if (changed) {
    store.set("books", nextBooks);
  }

  return changed;
}

function contentTypeFor(format: BookFormat): string {
  if (format === "pdf") return "application/pdf";
  if (format === "epub") return "application/epub+zip";
  if (format === "txt") return "text/plain; charset=utf-8";
  if (format === "zip" || format === "cbz") return "application/zip";
  if (format === "rar" || format === "cbr") return "application/vnd.rar";
  return "application/octet-stream";
}

async function handleBookProtocol(request: GlobalRequest): Promise<Response> {
  const url = new URL(request.url);

  if (url.hostname !== "book") {
    return new Response("Unknown resource", { status: 404 });
  }

  const id = decodeURIComponent(url.pathname.slice(1));
  const book = store.get("books", []).find((item) => item.id === id);

  if (!book) {
    return new Response("Book not found", { status: 404 });
  }

  try {
    await fs.access(book.filePath);
    const response = await net.fetch(pathToFileURL(book.filePath).toString());
    const headers = new Headers(response.headers);
    headers.set("content-type", contentTypeFor(book.format));
    headers.set("cache-control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return new Response("Book file missing", { status: 404 });
  }
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

function resultArrayFromCustomPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const object = payload as Record<string, unknown>;
  const candidates = [object.results, object.items, object.books, object.data];
  return candidates.find(Array.isArray) as unknown[] | undefined ?? [];
}

function stringField(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function valueByPath(input: unknown, pathValue?: string): unknown {
  if (!pathValue || !pathValue.trim()) {
    return undefined;
  }

  return pathValue.split(".").reduce<unknown>((current, segment) => {
    if (!segment) {
      return current;
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, input);
}

function normalizeSubjects(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 6);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[|,/]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  return [];
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

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const response = await net.fetch(url, {
    headers: headers ? new Headers(headers) : undefined
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
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

function resolveUrl(baseUrl: string, value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value.trim(), baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function selectedElement(root: HTMLElement, selector?: string): HTMLElement | undefined {
  if (!selector) {
    return root;
  }

  try {
    if (root.matches(selector)) {
      return root;
    }
  } catch {
    // Some selector lists may be unsupported by the parser. Fall back to querySelector.
  }

  return root.querySelector(selector) ?? undefined;
}

function selectedText(root: HTMLElement, selector?: string): string | undefined {
  const element = selectedElement(root, selector);
  const text = element?.textContent?.replace(/\s+/g, " ").trim();
  return text || undefined;
}

function attrCandidates(value: string | undefined, fallback: string[]): string[] {
  const explicit = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return explicit?.length ? explicit : fallback;
}

function selectedAttr(root: HTMLElement, selector: string | undefined, attr: string | undefined, fallback: string[]): string | undefined {
  const element = selectedElement(root, selector);
  if (!element) {
    return undefined;
  }

  for (const candidate of attrCandidates(attr, fallback)) {
    const value = element.getAttribute(candidate)?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function hrefFrom(root: HTMLElement, selector?: string, attr?: string): string | undefined {
  return selectedAttr(root, selector, attr, ["href", "src", "data-href", "data-url", "download"]);
}

function htmlDownloadHeaders(config: HtmlSourceConfig, referer: string): Record<string, string> | undefined {
  const headers = {
    ...(config.headers ?? {}),
    ...(config.downloadHeaders ?? {})
  };
  const hasReferer = Object.keys(headers).some((key) => key.toLowerCase() === "referer");

  if (!hasReferer) {
    headers.Referer = referer;
  }

  return Object.keys(headers).length ? headers : undefined;
}

async function fetchHtml(url: string, headers?: Record<string, string>): Promise<string> {
  const response = await net.fetch(url, {
    headers: headers ? new Headers(headers) : undefined
  });

  if (!response.ok) {
    return "";
  }

  return response.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function fetchRenderedHtml(url: string, config: HtmlSourceConfig): Promise<string> {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      javascript: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  try {
    const headers = config.headers ?? {};
    const userAgent = headers["User-Agent"] || headers["user-agent"];
    const extraHeaders = Object.entries(headers)
      .filter(([key]) => key.toLowerCase() !== "user-agent")
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    const timeout = Math.max(1000, Math.min(config.timeout ?? 10000, 30000));

    const loaded = await withTimeout(
      win
        .loadURL(url, {
          userAgent,
          extraHeaders: extraHeaders || undefined
        })
        .then(() => true)
        .catch(() => false),
      timeout,
      false
    );

    if (!loaded && !win.webContents.getURL()) {
      return "";
    }

    if (config.waitForSelector) {
      const selector = JSON.stringify(config.waitForSelector);
      await withTimeout(
        win.webContents
          .executeJavaScript(
            `new Promise((resolve) => {
            const selector = ${selector};
            const deadline = Date.now() + ${timeout};
            const tick = () => {
              if (document.querySelector(selector)) return resolve(true);
              if (Date.now() > deadline) return resolve(false);
              setTimeout(tick, 120);
            };
            tick();
          })`,
            true
          )
          .then(() => true)
          .catch(() => false),
        timeout + 500,
        false
      );
    }

    if (config.autoScroll) {
      await withTimeout(
        win.webContents
          .executeJavaScript(
            `new Promise((resolve) => {
            let y = 0;
            const step = Math.max(260, Math.floor(window.innerHeight * 0.7));
            const timer = setInterval(() => {
              y += step;
              window.scrollTo(0, y);
              if (y >= Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight) {
                clearInterval(timer);
                setTimeout(resolve, 350);
              }
            }, 120);
            setTimeout(() => {
              clearInterval(timer);
              resolve();
            }, 5000);
          })`,
            true
          )
          .then(() => undefined)
          .catch(() => undefined),
        6500,
        undefined
      );
    }

    await sleep(Math.max(0, Math.min(config.delay ?? 800, 5000)));

    return await withTimeout(
      win.webContents.executeJavaScript("document.documentElement.outerHTML", true).catch(() => ""),
      3000,
      ""
    );
  } catch {
    return "";
  } finally {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
}

async function loadHtml(url: string, config: HtmlSourceConfig): Promise<string> {
  if (config.renderJs) {
    const rendered = await fetchRenderedHtml(url, config);
    if (rendered) {
      return rendered;
    }
  }

  if (config.delay && config.delay > 0) {
    await sleep(Math.max(0, Math.min(config.delay, 5000)));
  }

  return fetchHtml(url, config.headers);
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

  const format = formatFromUrl(downloadUrl, config.format);

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

  const html = await loadHtml(url, config);
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

function importabilityReason(downloadUrl?: string, format?: BookFormat): string | undefined {
  if (!downloadUrl) {
    return "没有解析到下载链接";
  }

  if (!format) {
    return "下载链接无法判断格式；如果是无后缀链接，请在配置中指定 format，例如 epub";
  }

  return undefined;
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

  const preferences = normalizePreferences(store.get("preferences"));
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

function registerIpc(): void {
  ipcMain.handle("library:listBooks", () => {
    return store.get("books", []).map(bookToClient);
  });

  ipcMain.handle("library:importBooks", async () => {
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

  ipcMain.handle("library:searchOnlineBooks", async (_event, query: string) => {
    return searchOnlineBooks(query);
  });

  ipcMain.handle("library:testOnlineSource", async (_event, query: string, source: OnlineSource) => {
    return testOnlineSource(query, source);
  });

  ipcMain.handle("library:importOnlineBook", async (_event, book: OnlineBookResult) => {
    return importOnlineBook(book);
  });

  ipcMain.handle("library:openExternalAndAutoImport", async (_event, book: OnlineBookResult) => {
    return openExternalAndAutoImport(book);
  });

  ipcMain.handle("system:openExternal", async (_event, url: string) => {
    return openHttpExternal(url);
  });

  ipcMain.handle("library:openBook", (_event, id: string) => {
    const book = updateBook(id, (current) => ({
      ...current,
      lastOpenedAt: new Date().toISOString()
    }));

    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle("library:saveProgress", (_event, id: string, progress: ReaderProgress) => {
    // Buffer the update and debounce the actual disk write (5 s)
    pendingProgressUpdates.set(id, progress);
    if (progressFlushTimer !== null) clearTimeout(progressFlushTimer);
    progressFlushTimer = setTimeout(flushProgressUpdates, 5000);

    // Return optimistic client record from current in-memory store
    const books = store.get("books", []);
    const book = books.find((b) => b.id === id);
    if (!book) return undefined;
    return bookToClient({ ...book, progress });
  });

  ipcMain.handle("library:saveBookmark", (_event, id: string, bookmark: Bookmark) => {
    const book = updateBook(id, (current) => ({
      ...current,
      bookmarks: [bookmark, ...current.bookmarks].slice(0, 200)
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle(
    "library:updateBookmark",
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

  ipcMain.handle("library:removeBookmarks", (_event, bookId: string, bookmarkIds: string[]) => {
    const removeSet = new Set(bookmarkIds);
    const book = updateBook(bookId, (current) => ({
      ...current,
      bookmarks: current.bookmarks.filter((bookmark) => !removeSet.has(bookmark.id))
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle("library:saveHighlight", (_event, bookId: string, highlight: Highlight) => {
    const book = updateBook(bookId, (current) => ({
      ...current,
      highlights: [...(current.highlights ?? []), highlight]
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle("library:updateHighlight", (_event, bookId: string, highlightId: string, patch: Partial<Pick<Highlight, "color" | "note">>) => {
    const book = updateBook(bookId, (current) => ({
      ...current,
      highlights: (current.highlights ?? []).map((h) =>
        h.id === highlightId ? { ...h, ...patch } : h
      )
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle("library:removeHighlights", (_event, bookId: string, highlightIds: string[]) => {
    const set = new Set(highlightIds);
    const book = updateBook(bookId, (current) => ({
      ...current,
      highlights: (current.highlights ?? []).filter((h) => !set.has(h.id))
    }));
    return book ? bookToClient(book) : undefined;
  });

  ipcMain.handle("library:removeBook", async (_event, id: string) => {
    const books = store.get("books", []);
    const book = books.find((item) => item.id === id);

    if (book) {
      await fs.rm(book.filePath, { force: true });
    }

    store.set(
      "books",
      books.filter((item) => item.id !== id)
    );

    return store.get("books", []).map(bookToClient);
  });

  ipcMain.handle("preferences:get", () => {
    const userPrefs = store.get("preferences");
    const merged = { ...defaultPreferences(), ...userPrefs };
    const preferences = normalizePreferences(migratePreferences(merged));
    store.set("preferences", preferences);
    return preferences;
  });

  ipcMain.handle("preferences:save", (_event, preferences: Partial<ReaderPreferences>) => {
    const userPrefs = store.get("preferences");
    const merged = { ...defaultPreferences(), ...userPrefs, ...preferences };
    const nextPreferences = normalizePreferences(migratePreferences(merged));
    store.set("preferences", nextPreferences);
    return nextPreferences;
  });
}

app.whenReady().then(async () => {
  store = new Store<StoreShape>({
    name: "natsu",
    defaults: {
      books: [],
      preferences: defaultPreferences()
    }
  });

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
