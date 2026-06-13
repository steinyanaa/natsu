import { app } from "electron";
import Store from "electron-store";
import type {
  ReaderPreferences,
  OnlineSource,
  BookRecord,
  ClientBookRecord,
  ReadingSession,
  StoreShape
} from "../ipc/types.js";
import {
  getSessions,
  mergeSessions,
  setSessions
} from "./sessions.js";

let storeInstance: Store<StoreShape> | undefined;

export function initStore(): Store<StoreShape> {
  if (storeInstance) return storeInstance;
  storeInstance = new Store<StoreShape>({
    name: "natsu",
    defaults: {
      books: [],
      preferences: defaultPreferences(),
      collections: []
    }
  });
  return storeInstance;
}

export function getStore(): Store<StoreShape> {
  if (!storeInstance) {
    throw new Error("Store not initialized. Call initStore() in app.whenReady() first.");
  }
  return storeInstance;
}

export function systemLanguage(): ReaderPreferences["language"] {
  const locale = app.getLocale().toLowerCase();

  if (locale.startsWith("ja")) {
    return "ja-JP";
  }

  if (locale.startsWith("en")) {
    return "en-US";
  }

  return "zh-CN";
}

export function defaultPreferences(): ReaderPreferences {
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
    dropCap: true,
    readingFocus: false,
    comicFit: "width",
    comicLayout: "single",
    readingDirection: "ltr",
    comicCoverSolo: true,
    mangaSnapToPage: true,
    immersive: false,
    preferencesVersion: 6,
    dailyGoalMinutes: 30,
    dictionaryEnabled: true,
    autoScrollSpeed: 40,
    coverTheme: true,
    wellness: {
      pomodoroEnabled: true,
      pomodoroMinutes: 25,
      eveningModeEnabled: true,
      eveningModeStart: "20:00",
      eveningModeEnd: "06:00",
      showDailySummary: true
    },
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

export function defaultOnlineSource(): OnlineSource {
  return {
    id: "gutenberg",
    name: "Project Gutenberg",
    enabled: true,
    kind: "gutenberg",
    value: ""
  };
}

export function normalizeOnlineSources(value: unknown, legacyValue?: unknown): OnlineSource[] {
  const sources: OnlineSource[] = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const item = entry as Partial<OnlineSource>;
      const kind =
        item.kind === "gutenberg" || item.kind === "json" || item.kind === "html" || item.kind === "rss"
          ? item.kind : "url";
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

      // Migrate stale zlibrary html configs: old versions used wrong selectors that
      // didn't match the real z-library DOM (z-bookcard custom elements).
      let migratedValue = rawValue;
      if (kind === "html" && rawValue.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(rawValue);
          const searchUrl = typeof parsed.searchUrl === "string" ? parsed.searchUrl : "";
          if (
            (searchUrl.includes("z-library") || searchUrl.includes("zlibrary")) &&
            parsed.titleSelector !== '[slot="title"]'
          ) {
            const baseUrl =
              typeof parsed.baseUrl === "string"
                ? parsed.baseUrl
                : searchUrl.replace(/\/s\/\{query\}.*/, "").trim();
            migratedValue = JSON.stringify({
              adapter: "html",
              searchUrl: `${baseUrl}/s/{query}`,
              baseUrl,
              renderJs: true,
              waitForSelector: "z-bookcard",
              timeout: 20000,
              delay: 500,
              itemSelector: "z-bookcard",
              titleSelector: '[slot="title"]',
              authorSelector: '[slot="author"]',
              downloadSelector: "z-bookcard",
              downloadAttr: "download",
              formatAttr: "extension",
              coverSelector: "img",
              coverAttr: "data-src,src",
              sourceName: name,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              }
            });
          }
        } catch {
          // keep rawValue on parse failure
        }
      }

      sources.push({
        id,
        name,
        enabled,
        kind,
        value: kind === "gutenberg" ? "" : migratedValue
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

export function migratePreferences(prefs: Partial<ReaderPreferences>): Partial<ReaderPreferences> {
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

  if (version < 6) {
    if (migrated.dropCap === undefined) migrated.dropCap = true;
    if (migrated.readingFocus === undefined) migrated.readingFocus = false;
    if (migrated.comicFit === undefined) migrated.comicFit = "width";
    if (migrated.comicLayout === undefined) migrated.comicLayout = "single";
    if (migrated.readingDirection === undefined) migrated.readingDirection = "ltr";
    if (migrated.comicCoverSolo === undefined) migrated.comicCoverSolo = true;
    if (migrated.mangaSnapToPage === undefined) migrated.mangaSnapToPage = true;
    if (migrated.immersive === undefined) migrated.immersive = false;
    if (migrated.dailyGoalMinutes === undefined) migrated.dailyGoalMinutes = 30;
    if (migrated.dictionaryEnabled === undefined) migrated.dictionaryEnabled = true;
    if (migrated.autoScrollSpeed === undefined) migrated.autoScrollSpeed = 40;
    if (migrated.coverTheme === undefined) migrated.coverTheme = true;
    migrated.wellness = {
      pomodoroEnabled: migrated.wellness?.pomodoroEnabled ?? true,
      pomodoroMinutes: migrated.wellness?.pomodoroMinutes ?? 25,
      eveningModeEnabled: migrated.wellness?.eveningModeEnabled ?? true,
      eveningModeStart: migrated.wellness?.eveningModeStart ?? "20:00",
      eveningModeEnd: migrated.wellness?.eveningModeEnd ?? "06:00",
      showDailySummary: migrated.wellness?.showDailySummary ?? true
    };
  }

  migrated.preferencesVersion = 6;
  return migrated;
}

export function normalizePreferences(preferences?: Partial<ReaderPreferences> & { onlineSourceUrl?: string }): ReaderPreferences {
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

export function seedFromHash(hash: string): number {
  return Number.parseInt(hash.slice(0, 8), 16) || 1;
}

export function bookToClient(book: BookRecord): ClientBookRecord {
  const { filePath: _filePath, ...publicBook } = book;

  // Sessions now live in their own store. Merge them back onto the client
  // record so the renderer contract (book.readingSessions) is unchanged. Guard
  // against the session store not being initialized (e.g. unit tests / early
  // startup) by falling back to whatever is still on the book record.
  let readingSessions: ReadingSession[] = publicBook.readingSessions ?? [];
  try {
    const stored = getSessions(book.id);
    if (stored.length) {
      readingSessions = mergeSessions(readingSessions, stored);
    }
  } catch {
    // Session store not ready — keep the in-record sessions as-is.
  }

  return {
    ...publicBook,
    highlights: publicBook.highlights ?? [],
    readingSessions,
    fileUrl: `manga-reader://book/${encodeURIComponent(book.id)}`
  };
}

export function updateBook(id: string, updater: (book: BookRecord) => BookRecord): BookRecord | undefined {
  const books = getStore().get("books", []);
  let changed: BookRecord | undefined;

  const nextBooks = books.map((book) => {
    if (book.id !== id) {
      return book;
    }

    changed = updater(book);
    return changed;
  });

  if (changed) {
    getStore().set("books", nextBooks);
  }

  return changed;
}

/**
 * One-time, idempotent migration: move any `readingSessions` still embedded in
 * `books[]` into the dedicated sessions store, then clear them on the book.
 *
 * Idempotent: a second run finds every `book.readingSessions` empty, makes no
 * changes, and persists nothing.
 *
 * Non-destructive: sessions are MERGED into the sessions store (dedup by
 * start+end, cap 500) before the book copy is cleared — data is copied, never
 * dropped. The merge means re-importing or re-running cannot duplicate entries.
 *
 * Requires both initStore() and initSessionStore() to have run first.
 * Returns the number of books migrated (0 means nothing to do).
 */
export function migrateSessionsOutOfBooks(): number {
  const books = getStore().get("books", []);
  let migratedCount = 0;
  let touched = false;

  const nextBooks = books.map((book) => {
    const sessions = book.readingSessions;
    if (!sessions || sessions.length === 0) {
      return book;
    }

    const merged = mergeSessions(getSessions(book.id), sessions);
    setSessions(book.id, merged);
    migratedCount += 1;
    touched = true;
    return { ...book, readingSessions: [] };
  });

  if (touched) {
    getStore().set("books", nextBooks);
  }

  return migratedCount;
}
