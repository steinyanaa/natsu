import { app } from "electron";
import Store from "electron-store";
import type {
  ReaderPreferences,
  OnlineSource,
  BookRecord,
  ClientBookRecord,
  StoreShape
} from "../ipc/types.js";

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

  migrated.preferencesVersion = 3;
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

  return {
    ...publicBook,
    highlights: publicBook.highlights ?? [],
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
