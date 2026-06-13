import { ipcMain, dialog } from "electron";
import fs from "node:fs/promises";
import { IPC_CHANNELS } from "../channels.js";
import { coverPathFor } from "../../paths.js";
import { supportedExtensions } from "../../services/bookFormats.js";
import {
  getStore,
  bookToClient,
  updateBook,
  defaultPreferences,
  migratePreferences,
  normalizePreferences
} from "../../services/store.js";
import {
  importOneBook,
  queueProgressUpdate
} from "../../services/library.js";
import {
  appendSession,
  getAllSessions,
  getSessions,
  mergeSessions,
  setSessions
} from "../../services/sessions.js";
import { recordOrphan } from "../../services/orphans.js";
import type {
  BookRecord,
  Bookmark,
  Highlight,
  ReaderProgress,
  ReaderPreferences,
  ReadingSession,
  Collection,
  ClientBookRecord
} from "../types.js";

export function registerLibraryHandlers(): void {
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
      try {
        await fs.rm(book.filePath);
      } catch {
        // File may be locked (e.g. still open in a reader). Record it so a
        // later startup sweep can retry deletion instead of leaving an orphan.
        await recordOrphan(book.filePath);
      }
      // Cover deletion failing is non-fatal — ignore.
      await fs.rm(coverPathFor(book.id), { force: true }).catch(() => {});
    }

    getStore().set(
      "books",
      books.filter((item) => item.id !== id)
    );

    return getStore().get("books", []).map(bookToClient);
  });

  // 批量删除
  ipcMain.handle(IPC_CHANNELS.libraryRemoveBooks, async (_event, ids: string[]) => {
    const idSet = new Set<string>(ids);
    const books = getStore().get("books", []);
    for (const book of books) {
      if (idSet.has(book.id)) {
        try {
          await fs.rm(book.filePath);
        } catch {
          await recordOrphan(book.filePath);
        }
        // Cover deletion failing is non-fatal — ignore.
        await fs.rm(coverPathFor(book.id), { force: true }).catch(() => {});
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

  // 保存阅读 session —— 写入独立的 sessions store，不再重写整个 books[]
  ipcMain.handle(IPC_CHANNELS.librarySaveReadingSession, (_event, bookId: string, session: ReadingSession) => {
    appendSession(bookId, session);
    const book = getStore().get("books", []).find((b) => b.id === bookId);
    // bookToClient merges sessions back from the sessions store, so the client
    // record still carries the just-appended session.
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
      // Sessions live in the dedicated store now; re-attach them on export so
      // the backup file keeps its existing { books: [{ readingSessions }] }
      // shape and stays importable by older/this version alike.
      return { ...rest, readingSessions: getSessions(b.id) };
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
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();

    let todayMinutes = 0;
    const dayMinutes = new Map<string, number>();

    for (const sessions of getAllSessions().values()) {
      for (const session of sessions) {
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
    const dayMap = new Map<string, number>();
    for (const sessions of getAllSessions().values()) {
      for (const session of sessions) {
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
        // 合并书签、高亮、进度（books[] 不再持有 readingSessions）
        const merged: BookRecord = {
          ...match,
          bookmarks: imported.bookmarks ?? match.bookmarks,
          highlights: imported.highlights ?? match.highlights,
          progress: imported.progress ?? match.progress
        };
        existingByHash.set(match.hash, merged);

        // 阅读 sessions 路由到独立的 sessions store（合并 + 去重 + 截断）。
        if (imported.readingSessions && imported.readingSessions.length) {
          const next = mergeSessions(getSessions(match.id), imported.readingSessions);
          setSessions(match.id, next);
        }
      }
    }
    getStore().set("books", [...existingByHash.values()]);
    if (parsed.preferences) {
      const userPrefs = getStore().get("preferences");
      getStore().set("preferences", normalizePreferences(migratePreferences({ ...defaultPreferences(), ...userPrefs, ...parsed.preferences })));
    }
    return true;
  });
}
