import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { supportedExtensions } from "./services/bookFormats.js";
import { IPC_CHANNELS } from "./ipc/channels.js";
import { rootDir, appIconPath, ensureCoverDir, coverPathFor } from "./paths.js";
import { handleBookProtocol } from "./services/protocol.js";
import {
  flushProgressUpdates,
  importOneBook,
  queueProgressUpdate
} from "./services/library.js";
import {
  importOnlineBook,
  openExternalAndAutoImport
} from "./services/online-import.js";
import { withTimeout } from "./services/scraper/fetch.js";
import { searchOnlineBooks, searchSource, testOnlineSource } from "./services/scraper/index.js";
import {
  initStore,
  getStore,
  defaultPreferences,
  migratePreferences,
  normalizePreferences,
  bookToClient,
  updateBook
} from "./services/store.js";
import type {
  ReaderProgress,
  Bookmark,
  Highlight,
  ThemeCustomColors,
  ReaderPreferences,
  OnlineBookResult,
  OnlineSource,
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

function zlibSession(): Electron.Session {
  return session.fromPartition("persist:natsu-zlib");
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
