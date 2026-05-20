import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronRight,
  Download,
  FolderPlus,
  Globe2,
  Grid3X3,
  Library,
  List,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  ExternalLink,
  Settings,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import type * as React from "react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTranslator } from "./i18n";
import { extractEpubCover } from "./readers/epub";
import { readerFontStack } from "./reader/utils";
import { preloadReaderPaneForFormat } from "./reader/preloadPanes";
import { SegmentedControl } from "./components/SegmentedControl";
import { ViewMorph } from "./components/ViewMorph";
import { LoadingStrip } from "./reader/ReaderState";
import { applyReaderTheme } from "./themeEngine";
import type { BookFormat, BookRecord, OnlineBookResult, OnlineSource, ReaderPreferences, ReaderProgress } from "./types";

const fallbackPreferences: ReaderPreferences = {
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
  language: "zh-CN",
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
  comicFit: "width",
  comicLayout: "single",
  readingDirection: "ltr",
  comicCoverSolo: true,
  mangaSnapToPage: true,
  immersive: false,
  preferencesVersion: 5,
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

type ShelfFilter = "all" | "novels" | "comics" | "pdf";
type ShelfView = "grid" | "list";

const novelFormats: BookFormat[] = ["epub", "txt", "mobi", "azw3"];
const comicFormats: BookFormat[] = ["cbz", "zip", "cbr", "rar"];
const ReaderScreen = lazy(() =>
  import("./reader/ReaderScreen").then((module) => ({ default: module.ReaderScreen }))
);
const loadSettingsPanel = () => import("./settings/SettingsPanel");
const SettingsPanel = lazy(() =>
  loadSettingsPanel().then((module) => ({ default: module.SettingsPanel }))
);

function normalizePreferences(preferences?: Partial<ReaderPreferences>): ReaderPreferences {
  const defaults = fallbackPreferences;

  return {
    ...defaults,
    ...preferences,
    onlineSources: Array.isArray(preferences?.onlineSources) && preferences.onlineSources.length
      ? preferences.onlineSources
      : defaults.onlineSources,
    customColors: {
      ...defaults.customColors,
      ...preferences?.customColors
    }
  };
}


function isNovel(format: BookFormat): boolean {
  return novelFormats.includes(format);
}

function isComic(format: BookFormat): boolean {
  return comicFormats.includes(format);
}

function formatBytes(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function percentLabel(progress?: ReaderProgress): string {
  if (!progress) {
    return "0%";
  }

  return `${Math.max(0, Math.min(100, Math.round(progress.percent * 100)))}%`;
}


function bookActivityTime(book: BookRecord): number {
  return new Date(book.lastOpenedAt ?? book.progress?.updatedAt ?? book.importedAt).getTime();
}

function enabledOnlineSources(preferences: ReaderPreferences): OnlineSource[] {
  return preferences.onlineSources.filter((source) => source.enabled);
}



function useApplyPreferences(preferences: ReaderPreferences) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      applyReaderTheme(document.documentElement, preferences, media.matches);
      document.documentElement.dataset.lang = preferences.language;
      document.documentElement.dataset.motion = preferences.motion;
      document.documentElement.lang = preferences.language;
      document.documentElement.classList.toggle("reduce-motion", preferences.reduceMotion);
    };

    apply();
    media.addEventListener("change", apply);

    return () => media.removeEventListener("change", apply);
  }, [preferences]);
}

export function App() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [preferences, setPreferences] = useState<ReaderPreferences>(fallbackPreferences);
  const [activeBook, setActiveBook] = useState<BookRecord | undefined>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ShelfFilter>("all");
  const [view, setView] = useState<ShelfView>("grid");
  const [section, setSection] = useState<"library" | "recent">("library");
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [onlineQuery, setOnlineQuery] = useState("");
  const [onlineResults, setOnlineResults] = useState<OnlineBookResult[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [onlineImportingId, setOnlineImportingId] = useState("");
  const [epubCovers, setEpubCovers] = useState<Map<string, string>>(new Map());
  const epubCoverRef = useRef(new Map<string, string>());
  const loadingCoversRef = useRef(new Set<string>());

  useApplyPreferences(preferences);

  const t = useMemo(() => createTranslator(preferences.language), [preferences.language]);

  const refreshBooks = useCallback(async () => {
    const records = await window.readerApi.listBooks();
    setBooks(records);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const [savedPreferences, records] = await Promise.all([
        window.readerApi.getPreferences(),
        window.readerApi.listBooks()
      ]);

      if (!mounted) {
        return;
      }

      setPreferences(normalizePreferences(savedPreferences));
      setBooks(records);
    }

    void boot();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const epubBooks = books.filter((book) => book.format === "epub").slice(0, 200);
    const MAX_CONCURRENT = 4;
    const queue: BookRecord[] = [];

    for (const book of epubBooks) {
      if (epubCoverRef.current.has(book.id) || loadingCoversRef.current.has(book.id)) {
        continue;
      }
      queue.push(book);
    }

    const runOne = async (book: BookRecord) => {
      loadingCoversRef.current.add(book.id);
      try {
        const cached = await window.readerApi.hasCover(book.id);
        if (cancelled) return;

        if (cached) {
          const url = `manga-reader://cover/${encodeURIComponent(book.id)}?v=${book.hash || book.id}`;
          epubCoverRef.current.set(book.id, url);
          setEpubCovers(new Map(epubCoverRef.current));
          return;
        }

        const buffer = await fetch(book.fileUrl).then((response) => response.arrayBuffer());
        if (cancelled) return;
        const blobUrl = await extractEpubCover(new Blob([buffer], { type: "application/epub+zip" }));
        if (cancelled || !blobUrl) {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          return;
        }

        try {
          const blob = await fetch(blobUrl).then((res) => res.blob());
          const bytes = new Uint8Array(await blob.arrayBuffer());
          await window.readerApi.saveCover(book.id, bytes);
        } catch {
          // Fall back to in-memory blob URL if disk write fails.
          epubCoverRef.current.set(book.id, blobUrl);
          setEpubCovers(new Map(epubCoverRef.current));
          return;
        } finally {
          URL.revokeObjectURL(blobUrl);
        }

        if (cancelled) return;
        const url = `manga-reader://cover/${encodeURIComponent(book.id)}?v=${book.hash || book.id}`;
        epubCoverRef.current.set(book.id, url);
        setEpubCovers(new Map(epubCoverRef.current));
      } catch {
        // Synthetic covers remain the fallback for EPUBs without readable art.
      } finally {
        loadingCoversRef.current.delete(book.id);
      }
    };

    const workers: Promise<void>[] = [];
    let cursor = 0;
    const next = async (): Promise<void> => {
      while (!cancelled && cursor < queue.length) {
        const book = queue[cursor++];
        await runOne(book);
      }
    };
    for (let i = 0; i < Math.min(MAX_CONCURRENT, queue.length); i += 1) {
      workers.push(next());
    }
    void Promise.all(workers);

    for (const [bookId, coverUrl] of epubCoverRef.current) {
      if (!books.some((book) => book.id === bookId)) {
        if (coverUrl.startsWith("blob:")) URL.revokeObjectURL(coverUrl);
        epubCoverRef.current.delete(bookId);
      }
    }

    setEpubCovers(new Map(epubCoverRef.current));

    return () => {
      cancelled = true;
    };
  }, [books]);

  useEffect(() => {
    return () => {
      epubCoverRef.current.forEach((coverUrl) => {
        if (coverUrl.startsWith("blob:")) URL.revokeObjectURL(coverUrl);
      });
      epubCoverRef.current.clear();
    };
  }, []);

  const savePreferences = useCallback(async (patch: Partial<ReaderPreferences>) => {
    setPreferences((current) => normalizePreferences({ ...current, ...patch }));
    const saved = await window.readerApi.savePreferences(patch);
    setPreferences(normalizePreferences(saved));
  }, []);

  const toggleSettings = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }

    setSettingsMounted(true);
    void loadSettingsPanel().then(() => {
      requestAnimationFrame(() => setSettingsOpen(true));
    });
  }, [settingsOpen]);

  const importBooks = useCallback(async () => {
    setImporting(true);

    try {
      await window.readerApi.importBooks();
      await refreshBooks();
    } finally {
      setImporting(false);
    }
  }, [refreshBooks]);

  const searchOnlineBooks = useCallback(async () => {
    const searchText = (onlineQuery || query).trim();
    const activeSources = enabledOnlineSources(preferences);

    if (!searchText) {
      return;
    }

    if (!activeSources.length) {
      setOnlineOpen(true);
      setOnlineResults([]);
      setOnlineError("Enable at least one online source in Settings.");
      return;
    }

    setOnlineOpen(true);
    setOnlineLoading(true);
    setOnlineError("");

    try {
      const results = await window.readerApi.searchOnlineBooks(searchText);
      setOnlineResults(results);
      if (!results.length) {
        setOnlineError("没有找到可导入的在线结果");
      }
    } catch {
      setOnlineResults([]);
      setOnlineError("在线书源暂时无法访问");
    } finally {
      setOnlineLoading(false);
    }
  }, [onlineQuery, query]);

  const importOnlineResult = useCallback(
    async (result: OnlineBookResult) => {
      setOnlineImportingId(result.id);
      setOnlineError("");

      try {
        const imported = await window.readerApi.importOnlineBook(result);
        if (imported) {
          setBooks((current) => [imported, ...current.filter((book) => book.id !== imported.id)]);
          setOnlineOpen(false);
        } else {
          setOnlineError("这个结果没有可导入的 EPUB/TXT/MOBI/PDF 直链");
        }
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : "导入失败，请确认书源返回的是可直接下载的文件链接");
      } finally {
        setOnlineImportingId("");
      }
    },
    []
  );

  const browserDownloadAndImport = useCallback(
    async (result: OnlineBookResult) => {
      setOnlineImportingId(`browser-${result.id}`);
      setOnlineError("已打开浏览器下载，等待下载完成后自动导入...");

      try {
        const imported = await window.readerApi.openExternalAndAutoImport(result);
        if (imported) {
          setBooks((current) => [imported, ...current.filter((book) => book.id !== imported.id)]);
          setOnlineOpen(false);
          setOnlineError("");
        }
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : "浏览器下载后自动导入失败，请手动导入下载文件。");
      } finally {
        setOnlineImportingId("");
      }
    },
    []
  );

  const runOnlineSearch = useCallback(async () => {
    const searchText = (onlineQuery || query).trim();
    const activeSources = enabledOnlineSources(preferences);

    if (!searchText) {
      return;
    }

    if (!activeSources.length) {
      setOnlineOpen(true);
      setOnlineResults([]);
      setOnlineError("Enable at least one online source in Settings.");
      return;
    }

    setOnlineOpen(true);
    setOnlineLoading(true);
    setOnlineError("");

    try {
      const results = await window.readerApi.searchOnlineBooks(searchText);
      setOnlineResults(results);
      if (!results.length) {
        setOnlineError("No importable results from enabled sources.");
      }
    } catch {
      setOnlineResults([]);
      setOnlineError("Online sources are temporarily unavailable.");
    } finally {
      setOnlineLoading(false);
    }
  }, [onlineQuery, preferences, query]);

  const openBook = useCallback(async (book: BookRecord) => {
    preloadReaderPaneForFormat(book.format);
    const opened = await window.readerApi.openBook(book.id);
    if (opened) {
      setActiveBook(opened);
      setBooks((current) => current.map((item) => (item.id === opened.id ? opened : item)));
    }
  }, []);

  const removeBook = useCallback(
    async (book: BookRecord) => {
      const nextBooks = await window.readerApi.removeBook(book.id);
      setBooks(nextBooks);
      if (activeBook?.id === book.id) {
        setActiveBook(undefined);
      }
    },
    [activeBook]
  );

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = books.filter((book) => {
      const matchesQuery =
        !normalizedQuery ||
        `${book.title} ${book.author ?? ""} ${book.format}`.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "novels" && isNovel(book.format)) ||
        (filter === "comics" && isComic(book.format)) ||
        (filter === "pdf" && book.format === "pdf");

      return matchesQuery && matchesFilter;
    });

    if (section === "recent") {
      return filtered
        .filter((book) => book.lastOpenedAt || book.progress)
        .sort((a, b) => bookActivityTime(b) - bookActivityTime(a));
    }

    return filtered.sort((a, b) => bookActivityTime(b) - bookActivityTime(a));
  }, [books, filter, query, section]);

  if (activeBook) {
    return (
      <Suspense fallback={<LoadingStrip label={t("loading")} />}>
        <ReaderScreen
          book={activeBook}
          preferences={preferences}
          t={t}
          onBack={() => {
            setActiveBook(undefined);
            void refreshBooks();
          }}
          onBookUpdated={(book) => {
            setActiveBook(book);
            setBooks((current) => current.map((item) => (item.id === book.id ? book : item)));
          }}
          onPreferencesChange={savePreferences}
        />
      </Suspense>
    );
  }

  return (
    <main className="app-shell">
      <svg className="gooey-filter" aria-hidden="true">
        <filter id="gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -9"
            result="gooey"
          />
          <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
        </filter>
      </svg>

      <aside className="side-rail" aria-label={t("library")}>
        <div className="brand-mark" aria-hidden="true">
          夏
        </div>
        <div className="rail-rule" aria-hidden="true" />
        <button
          className={`rail-item ${section === "library" ? "active" : ""}`}
          title={t("library")}
          onClick={() => setSection("library")}
        >
          <Library size={21} />
          <span>{t("library")}</span>
        </button>
        <button
          className={`rail-item ${section === "recent" ? "active" : ""}`}
          title={t("recent")}
          onClick={() => setSection("recent")}
        >
          <BookOpen size={21} />
          <span>{t("recent")}</span>
        </button>
        <div className="rail-spacer" aria-hidden="true" />
        <button
          className="rail-item rail-item-bottom"
          title={t("settings")}
          onPointerEnter={() => void loadSettingsPanel()}
          onFocus={() => void loadSettingsPanel()}
          onClick={toggleSettings}
        >
          <Settings size={21} />
          <span>{t("settings")}</span>
        </button>
      </aside>

      <section className="library-view">
        <header className="library-header">
          <div className="library-title">
            <p className="eyebrow library-brand">夏の読書</p>
            <span className="library-count">
              {filteredBooks.length} / {books.length}
            </span>
          </div>

          <div className="header-actions">
            <div className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("search")}
              />
            </div>
            <button className="primary-button pressable stretch-button" onClick={importBooks}>
              <FolderPlus size={18} />
              <span>{t("import")}</span>
            </button>
            <button
              className="soft-button pressable stretch-button"
              onClick={() => {
                setOnlineOpen((value) => !value);
                setOnlineQuery((value) => value || query);
              }}
            >
              <Globe2 size={18} />
              <span>在线</span>
            </button>
          </div>
        </header>

        <div className="shelf-toolbar">
          <div className="toolbar-left">
            <SegmentedControl
              value={filter}
              options={[
                ["all", t("all")],
                ["novels", t("novels")],
                ["comics", t("comics")],
                ["pdf", t("pdf")]
              ]}
              onChange={(next) => setFilter(next as ShelfFilter)}
            />
          </div>

          <div className="toolbar-right">
            <ViewMorph value={view} t={t} onChange={setView} />
          </div>
        </div>

        {importing ? <LoadingStrip label={t("loading")} /> : null}
        {onlineOpen ? (
          <OnlineSearchPanelManaged
            query={onlineQuery}
            results={onlineResults}
            loading={onlineLoading}
            error={onlineError}
            sources={preferences.onlineSources}
            importingId={onlineImportingId}
            onQueryChange={setOnlineQuery}
            onSearch={runOnlineSearch}
            onImport={importOnlineResult}
            onBrowserImport={browserDownloadAndImport}
            onOpenExternal={(url: string) => window.readerApi.openExternal(url)}
            onClose={() => setOnlineOpen(false)}
          />
        ) : null}

        {filteredBooks.length ? (
          <BookShelf
            books={filteredBooks}
            view={view}
            coverUrls={epubCovers}
            t={t}
            onOpen={openBook}
            onRemove={removeBook}
          />
        ) : (
          <EmptyShelf t={t} onImport={importBooks} recent={section === "recent"} />
        )}
      </section>

      {settingsMounted ? (
        <Suspense fallback={<LoadingStrip label={t("loading")} />}>
          <SettingsPanel
            open={settingsOpen}
            preferences={preferences}
            t={t}
            onClose={() => setSettingsOpen(false)}
            onChange={savePreferences}
          />
        </Suspense>
      ) : null}
    </main>
  );
}

function BookShelf({
  books,
  view,
  coverUrls,
  t,
  onOpen,
  onRemove
}: {
  books: BookRecord[];
  view: ShelfView;
  coverUrls: Map<string, string>;
  t: ReturnType<typeof createTranslator>;
  onOpen: (book: BookRecord) => void;
  onRemove: (book: BookRecord) => void;
}) {
  return (
    <section className={`book-shelf ${view}`}>
      {books.map((book, index) => (
        <article
          key={book.id}
          className="book-tile"
          style={{ "--stagger": index } as React.CSSProperties}
        >
          <button className="cover-button" onClick={() => onOpen(book)} title={book.title}>
            <BookCover book={book} coverUrl={coverUrls.get(book.id)} />
          </button>
          <div className="book-info">
            <div>
              <h2>{book.title}</h2>
              <p>
                <span className="format-chip">{book.format.toUpperCase()}</span>
                <span>{formatBytes(book.size)}</span>
                <span>{percentLabel(book.progress)}</span>
              </p>
            </div>
            <div className="book-actions">
              <button className="soft-button pressable compact-action" onClick={() => onOpen(book)}>
                <BookOpen size={16} />
                <span>{book.progress ? t("continueReading") : t("open")}</span>
              </button>
              <button className="icon-button pressable" title={t("remove")} onClick={() => onRemove(book)}>
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function BookCover({ book, coverUrl }: { book: BookRecord; coverUrl?: string }) {
  const hue = book.coverSeed % 360;

  return (
    <div
      className={`book-cover ${coverUrl ? "has-art" : "synthetic-cover"}`}
      style={
        {
          "--cover-hue": hue,
          "--cover-accent": `hsl(${(hue + 72) % 360} 88% 74%)`
        } as React.CSSProperties
      }
    >
      {coverUrl ? (
        <img className="cover-art" src={coverUrl} alt="" />
      ) : (
        <>
          <span>{book.format.toUpperCase()}</span>
          <strong>{book.title.slice(0, 16)}</strong>
          <i aria-hidden="true" />
        </>
      )}
    </div>
  );
}

function EmptyShelf({
  t,
  onImport,
  recent
}: {
  t: ReturnType<typeof createTranslator>;
  onImport: () => void;
  recent?: boolean;
}) {
  return (
    <section className="empty-shelf">
      <div className="summer-orbit" aria-hidden="true">
        <span />
        <i />
      </div>
      <h2>{recent ? t("recent") : t("emptyTitle")}</h2>
      <p>{recent ? t("noRecent") : t("emptyBody")}</p>
      {!recent ? (
        <button className="primary-button pressable stretch-button" onClick={onImport}>
          <FolderPlus size={18} />
          <span>{t("import")}</span>
        </button>
      ) : null}
    </section>
  );
}

function OnlineSearchPanel({
  query,
  results,
  loading,
  error,
  sourceUrl,
  importingId,
  onQueryChange,
  onSearch,
  onImport,
  onOpenExternal,
  onClose
}: {
  query: string;
  results: OnlineBookResult[];
  loading: boolean;
  error: string;
  sourceUrl: string;
  importingId: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onImport: (book: OnlineBookResult) => void;
  onBrowserImport: (book: OnlineBookResult) => void;
  onOpenExternal: (url: string) => void;
  onClose: () => void;
}) {
  const sourceName = sourceUrl.trim() ? "自定义书源" : "Project Gutenberg";

  return (
    <section className="online-panel">
      <div className="online-panel-header">
        <div>
          <p className="eyebrow">Online Source</p>
          <h2>{sourceName}</h2>
        </div>
        <button className="icon-button pressable" onClick={onClose} aria-label="关闭在线搜索">
          <X size={18} />
        </button>
      </div>
      <div className="online-search-row">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder="在线搜索书名或作者"
          />
        </div>
        <button className="primary-button pressable stretch-button" disabled={loading || !query.trim()} onClick={onSearch}>
          <Search size={17} />
          <span>{loading ? "搜索中" : "搜索"}</span>
        </button>
      </div>
      {error ? <p className="online-error">{error}</p> : null}
      <div className="online-results">
        {results.map((book) => (
          <article key={`${book.source}-${book.id}`} className="online-result">
            {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <div className="online-cover-fallback">{book.format?.toUpperCase() ?? "BOOK"}</div>}
            <div>
              <h3>{book.title}</h3>
              <p>{[book.author, book.language, book.format?.toUpperCase()].filter(Boolean).join(" · ")}</p>
              {book.subjects.length ? <span>{book.subjects.slice(0, 2).join(" / ")}</span> : null}
            </div>
            <button
              className="soft-button pressable compact-action"
              disabled={Boolean(importingId)}
              onClick={() => onImport(book)}
            >
              <Download size={15} />
              <span>{importingId === book.id ? "导入中" : "导入"}</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function OnlineSearchPanelV2({
  query,
  results,
  loading,
  error,
  sourceUrl,
  importingId,
  onQueryChange,
  onSearch,
  onImport,
  onBrowserImport,
  onOpenExternal,
  onClose
}: {
  query: string;
  results: OnlineBookResult[];
  loading: boolean;
  error: string;
  sourceUrl: string;
  importingId: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onImport: (book: OnlineBookResult) => void;
  onBrowserImport?: (book: OnlineBookResult) => void;
  onOpenExternal?: (url: string) => void;
  onClose: () => void;
}) {
  const sourceName = sourceUrl.trim() ? "Custom Source" : "Project Gutenberg";

  return (
    <section className="online-panel">
      <div className="online-panel-header">
        <div>
          <p className="eyebrow">Online Source</p>
          <h2>{sourceName}</h2>
        </div>
        <button className="icon-button pressable" onClick={onClose} aria-label="Close online search">
          <X size={18} />
        </button>
      </div>
      <div className="online-search-row">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder="Search title or author"
          />
        </div>
        <button className="primary-button pressable stretch-button" disabled={loading || !query.trim()} onClick={onSearch}>
          <Search size={17} />
          <span>{loading ? "Searching" : "Search"}</span>
        </button>
      </div>
      {error ? <p className="online-error">{error}</p> : null}
      <div className="online-results">
        {results.map((book) => (
          <article key={`${book.source}-${book.id}`} className="online-result">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt="" />
            ) : (
              <div className="online-cover-fallback">{book.format?.toUpperCase() ?? "BOOK"}</div>
            )}
            <div>
              <h3>{book.title}</h3>
              <p>{[book.author, book.language, book.format?.toUpperCase()].filter(Boolean).join(" · ")}</p>
              {book.subjects.length ? <span>{book.subjects.slice(0, 2).join(" / ")}</span> : null}
            </div>
            <div className="online-result-actions">
              <button
                className="soft-button pressable compact-action"
                type="button"
                onClick={() => (onOpenExternal ?? window.readerApi.openExternal)(book.downloadUrl)}
                title="用系统浏览器打开下载链接"
              >
                <ExternalLink size={15} />
                <span>Browser</span>
              </button>
              <button
                className="soft-button pressable compact-action"
                disabled={Boolean(importingId)}
                onClick={() => onImport(book)}
              >
                <Download size={15} />
                <span>{importingId === book.id ? "Importing" : "Import"}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function OnlineSearchPanelManaged({
  query,
  results,
  loading,
  error,
  sources,
  importingId,
  onQueryChange,
  onSearch,
  onImport,
  onBrowserImport,
  onOpenExternal,
  onClose
}: {
  query: string;
  results: OnlineBookResult[];
  loading: boolean;
  error: string;
  sources: OnlineSource[];
  importingId: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onImport: (book: OnlineBookResult) => void;
  onBrowserImport: (book: OnlineBookResult) => void;
  onOpenExternal: (url: string) => void;
  onClose: () => void;
}) {
  const activeSources = sources.filter((source) => source.enabled);
  const sourceName =
    activeSources.length === 0
      ? "No source enabled"
      : activeSources.length === 1
        ? activeSources[0].name
        : `${activeSources.length} sources enabled`;

  return (
    <section className="online-panel">
      <div className="online-panel-header">
        <div>
          <p className="eyebrow">Online Sources</p>
          <h2>{sourceName}</h2>
        </div>
        <button className="icon-button pressable" onClick={onClose} aria-label="Close online search">
          <X size={18} />
        </button>
      </div>
      <div className="online-search-row">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder="Search title or author"
          />
        </div>
        <button className="primary-button pressable stretch-button" disabled={loading || !query.trim()} onClick={onSearch}>
          <Search size={17} />
          <span>{loading ? "Searching" : "Search"}</span>
        </button>
      </div>
      {activeSources.length ? <p className="online-source-summary">{activeSources.map((source) => source.name).join(" · ")}</p> : null}
      {error ? <p className="online-error">{error}</p> : null}
      <div className="online-results">
        {results.map((book) => (
          <article key={`${book.source}-${book.id}`} className="online-result">
            <OnlineResultCover book={book} />
            <div className="online-result-main">
              <h3>{book.title}</h3>
              <p>{[book.author, book.language].filter(Boolean).join(" · ")}</p>
              <div className="online-meta-row">
                {book.format ? <span className="online-meta-chip">{book.format.toUpperCase()}</span> : null}
                {book.sizeLabel ? <span className="online-meta-chip size-chip">{book.sizeLabel}</span> : null}
                <span className="online-meta-chip source-chip">{book.source}</span>
                {book.subjects.slice(0, 1).map((subject) => (
                  <span key={subject} className="online-meta-chip muted-chip">{subject}</span>
                ))}
              </div>
            </div>
            <div className="online-result-actions">
              <button
                className="soft-button pressable compact-action"
                type="button"
                disabled={Boolean(importingId)}
                onClick={() => onBrowserImport(book)}
                title="用系统浏览器下载，完成后自动导入"
              >
                <ExternalLink size={15} />
                <span>{importingId === `browser-${book.id}` ? "Waiting" : "Browser+"}</span>
              </button>
              <button
                className="soft-button pressable compact-action"
                disabled={Boolean(importingId)}
                onClick={() => onImport(book)}
              >
                <Download size={15} />
                <span>{importingId === book.id ? "Importing" : "Import"}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function OnlineResultCover({ book }: { book: OnlineBookResult }) {
  const [failed, setFailed] = useState(false);
  const label = book.format?.toUpperCase() ?? "BOOK";
  const titleGlyph = (book.title || label).trim().slice(0, 1).toUpperCase();

  if (book.coverUrl && !failed) {
    return (
      <div className="online-cover-shell">
        <img className="online-cover-art" src={book.coverUrl} alt="" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div className="online-cover-shell online-cover-fallback" aria-label="No cover">
      <i aria-hidden="true" />
      <strong>{titleGlyph}</strong>
      <span>{label}</span>
    </div>
  );
}
