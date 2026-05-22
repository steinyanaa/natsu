import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronRight,
  Download,
  Flame,
  FolderOpen,
  FolderPlus,
  Globe2,
  Grid3X3,
  ImageIcon,
  Library,
  List,
  Loader2,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  ExternalLink,
  Settings,
  SlidersHorizontal,
  Tag,
  Target,
  Trash2,
  X
} from "lucide-react";
import type * as React from "react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTranslator } from "./i18n";
import { extractEpubCover } from "./readers/epub";
import { readerFontStack } from "./reader/utils";
import { preloadReaderPaneForFormat } from "./reader/preloadPanes";
import { OpenBookTransition } from "./reader/OpenBookTransition";
import { SegmentedControl } from "./components/SegmentedControl";
import { ViewMorph } from "./components/ViewMorph";
import { LoadingStrip } from "./reader/ReaderState";
import { applyReaderTheme } from "./themeEngine";
import type { BookFormat, BookRecord, Collection, DailyReadingStat, GoalStats, OnlineBookResult, OnlineSource, ReaderPreferences, ReaderProgress } from "./types";
import { HeatmapCalendar } from "./stats/HeatmapCalendar";
import { ReadingCurve } from "./stats/ReadingCurve";
import { getSessionAvgCpm } from "./stats/speedTracker";

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
  dropCap: true,
  comicFit: "width",
  comicLayout: "single",
  readingDirection: "ltr",
  comicCoverSolo: true,
  mangaSnapToPage: true,
  immersive: false,
  preferencesVersion: 5,
  dailyGoalMinutes: 30,
  dictionaryEnabled: true,
  wellness: {
    pomodoroEnabled: true,
    pomodoroMinutes: 25,
    eveningModeEnabled: true,
    eveningModeStart: "20:00",
    eveningModeEnd: "06:00",
    showDailySummary: true,
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

type ShelfFilter = "all" | "novels" | "comics" | "pdf";
type ShelfView = "grid" | "list";
type ShelfSort = "recent" | "title" | "author" | "progress" | "size";
type AppSection = "library" | "recent" | "stats";

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

function useEveningMode(preferences: ReaderPreferences) {
  useEffect(() => {
    const check = () => {
      if (!preferences.wellness?.eveningModeEnabled) {
        document.documentElement.removeAttribute("data-evening");
        return;
      }
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const start = preferences.wellness.eveningModeStart ?? "20:00";
      const end   = preferences.wellness.eveningModeEnd   ?? "06:00";
      // Crosses midnight if start > end
      const isEvening = start > end
        ? (hhmm >= start || hhmm < end)
        : (hhmm >= start && hhmm < end);
      document.documentElement.dataset.evening = isEvening ? "true" : "false";
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [preferences.wellness]);
}

export function App() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [preferences, setPreferences] = useState<ReaderPreferences>(fallbackPreferences);
  const [activeBook, setActiveBook] = useState<BookRecord | undefined>();
  const [openingCoverRect, setOpeningCoverRect] = useState<DOMRect | undefined>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ShelfFilter>("all");
  const [view, setView] = useState<ShelfView>("grid");
  const [section, setSection] = useState<AppSection>("library");
  const [sort, setSort] = useState<ShelfSort>("recent");
  const [confirmBook, setConfirmBook] = useState<BookRecord | undefined>();
  const [editBook, setEditBook] = useState<BookRecord | undefined>();
  const [dragActive, setDragActive] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColMode, setNewColMode] = useState(false);
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
  const [fetchingCoverIds, setFetchingCoverIds] = useState<Set<string>>(new Set());
  const epubCoverRef = useRef(new Map<string, string>());
  const loadingCoversRef = useRef(new Set<string>());

  useApplyPreferences(preferences);
  useEveningMode(preferences);

  const t = useMemo(() => createTranslator(preferences.language), [preferences.language]);

  const refreshBooks = useCallback(async () => {
    const records = await window.readerApi.listBooks();
    setBooks(records);
  }, []);

  const refetchCover = useCallback(async (book: BookRecord) => {
    setFetchingCoverIds((prev) => new Set([...prev, book.id]));
    try {
      // Delete cached cover so it re-loads after fetch
      epubCoverRef.current.delete(book.id);
      const ok = await window.readerApi.fetchCoverForBook(book.id);
      if (ok) {
        const url = `manga-reader://cover/${encodeURIComponent(book.id)}?v=${Date.now()}`;
        epubCoverRef.current.set(book.id, url);
        setEpubCovers(new Map(epubCoverRef.current));
      }
    } finally {
      setFetchingCoverIds((prev) => {
        const next = new Set(prev);
        next.delete(book.id);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const [savedPreferences, records, cols] = await Promise.all([
        window.readerApi.getPreferences(),
        window.readerApi.listBooks(),
        window.readerApi.listCollections()
      ]);

      if (!mounted) {
        return;
      }

      setPreferences(normalizePreferences(savedPreferences));
      setBooks(records);
      setCollections(cols);
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
        // EPUB had no embedded art — try fetching from Google Books silently
        try {
          const ok = await window.readerApi.fetchCoverForBook(book.id);
          if (ok) {
            const url = `manga-reader://cover/${encodeURIComponent(book.id)}?v=${Date.now()}`;
            epubCoverRef.current.set(book.id, url);
            setEpubCovers(new Map(epubCoverRef.current));
          }
        } catch { /* silence */ }
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

  const openBook = useCallback(async (book: BookRecord, coverRect?: DOMRect) => {
    preloadReaderPaneForFormat(book.format);
    if (coverRect && !preferences.reduceMotion && preferences.motion !== "reduced") {
      setOpeningCoverRect(coverRect);
    }
    const opened = await window.readerApi.openBook(book.id);
    if (opened) {
      setActiveBook(opened);
      setBooks((current) => current.map((item) => (item.id === opened.id ? opened : item)));
    }
  }, [preferences.reduceMotion, preferences.motion]);

  // 弹确认框
  const removeBook = useCallback((book: BookRecord) => {
    setConfirmBook(book);
  }, []);

  // 确认后实际删除
  const confirmRemoveBook = useCallback(
    async (book: BookRecord) => {
      setConfirmBook(undefined);
      const nextBooks = await window.readerApi.removeBook(book.id);
      setBooks(nextBooks);
      if (activeBook?.id === book.id) {
        setActiveBook(undefined);
      }
    },
    [activeBook]
  );

  // 拖放导入
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const paths: string[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      const p = (file as File & { path?: string }).path;
      if (p) paths.push(p);
    }
    if (!paths.length) return;
    setImporting(true);
    try {
      const imported = await window.readerApi.importByPaths(paths);
      if (imported.length) {
        setBooks((current) => {
          const existingIds = new Set(current.map((b) => b.id));
          return [...imported.filter((b) => !existingIds.has(b.id)), ...current];
        });
      }
    } finally {
      setImporting(false);
    }
  }, []);

  // 元数据编辑保存
  const saveBookMeta = useCallback(async (id: string, patch: { title?: string; author?: string }) => {
    setEditBook(undefined);
    const updated = await window.readerApi.updateBookMeta(id, patch);
    if (updated) {
      setBooks((current) => current.map((b) => (b.id === updated.id ? updated : b)));
      if (activeBook?.id === updated.id) setActiveBook(updated);
    }
  }, [activeBook]);

  // 收藏夹操作
  const createCollection = useCallback(async (name: string) => {
    const col: Collection = { id: `col-${Date.now()}`, name: name.trim(), bookIds: [], createdAt: new Date().toISOString() };
    const updated = await window.readerApi.saveCollection(col);
    setCollections(updated);
  }, []);

  const deleteCollection = useCallback(async (id: string) => {
    const updated = await window.readerApi.removeCollection(id);
    setCollections(updated);
    if (activeCollectionId === id) setActiveCollectionId(null);
  }, [activeCollectionId]);

  const toggleBookInCollection = useCallback(async (collectionId: string, bookId: string, add: boolean) => {
    const updated = add
      ? await window.readerApi.addBookToCollection(collectionId, bookId)
      : await window.readerApi.removeBookFromCollection(collectionId, bookId);
    setCollections(updated);
  }, []);

  // 批量删除
  const batchRemoveBooks = useCallback(async () => {
    const ids = [...selectedIds];
    const nextBooks = await window.readerApi.removeBooks(ids);
    setBooks(nextBooks);
    setSelectedIds(new Set());
    setBatchConfirm(false);
  }, [selectedIds]);

  // 命令面板快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
        setNewColMode(false);
        setBatchConfirm(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const colBookIds = activeCollectionId
      ? (collections.find((c) => c.id === activeCollectionId)?.bookIds ?? [])
      : null;

    const filtered = books.filter((book) => {
      const matchesQuery =
        !normalizedQuery ||
        `${book.title} ${book.author ?? ""} ${book.format}`.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "novels" && isNovel(book.format)) ||
        (filter === "comics" && isComic(book.format)) ||
        (filter === "pdf" && book.format === "pdf");
      const matchesCollection = !colBookIds || colBookIds.includes(book.id);

      return matchesQuery && matchesFilter && matchesCollection;
    });

    if (section === "recent") {
      return filtered
        .filter((book) => book.lastOpenedAt || book.progress)
        .sort((a, b) => bookActivityTime(b) - bookActivityTime(a));
    }

    const comparators: Record<ShelfSort, (a: BookRecord, b: BookRecord) => number> = {
      recent: (a, b) => bookActivityTime(b) - bookActivityTime(a),
      title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      author: (a, b) => (a.author ?? "").localeCompare(b.author ?? "", undefined, { sensitivity: "base" }),
      progress: (a, b) => (b.progress?.percent ?? 0) - (a.progress?.percent ?? 0),
      size: (a, b) => b.size - a.size
    };

    return [...filtered].sort(comparators[sort]);
  }, [books, filter, query, section, sort, activeCollectionId, collections]);

  if (activeBook) {
    return (
      <>
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
        {openingCoverRect && (
          <OpenBookTransition
            rect={openingCoverRect}
            onDone={() => setOpeningCoverRect(undefined)}
          />
        )}
      </>
    );
  }

  return (
    <main
      className="app-shell"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
          className={`rail-item ${section === "library" && !activeCollectionId ? "active" : ""}`}
          title={t("library")}
          onClick={() => { setSection("library"); setActiveCollectionId(null); }}
        >
          <Library size={21} />
          <span>{t("library")}</span>
        </button>
        <button
          className={`rail-item ${section === "recent" ? "active" : ""}`}
          title={t("recent")}
          onClick={() => { setSection("recent"); setActiveCollectionId(null); }}
        >
          <BookOpen size={21} />
          <span>{t("recent")}</span>
        </button>
        <button
          className={`rail-item ${section === "stats" ? "active" : ""}`}
          title={t("stats")}
          onClick={() => { setSection("stats"); setActiveCollectionId(null); }}
        >
          <BarChart3 size={21} />
          <span>{t("stats")}</span>
        </button>
        {collections.length > 0 && <div className="rail-rule" aria-hidden="true" />}
        {collections.map((col) => (
          <button
            key={col.id}
            className={`rail-item rail-item-collection ${activeCollectionId === col.id ? "active" : ""}`}
            title={col.name}
            onClick={() => { setActiveCollectionId(col.id); setSection("library"); }}
          >
            <FolderOpen size={21} />
            <span>{col.name}</span>
          </button>
        ))}
        <button
          className="rail-item rail-item-add-col"
          title={t("newCollection")}
          onClick={() => setNewColMode(true)}
        >
          <Plus size={18} />
          <span>{t("newCollection")}</span>
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
            {section !== "stats" && section !== "recent" && (
              <select
                className="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as ShelfSort)}
                title={t("sortBy")}
              >
                <option value="recent">{t("sortRecent")}</option>
                <option value="title">{t("sortTitle")}</option>
                <option value="author">{t("sortAuthor")}</option>
                <option value="progress">{t("sortProgress")}</option>
                <option value="size">{t("sortSize")}</option>
              </select>
            )}
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

        {section === "stats" ? (
          <StatsView books={books} t={t} preferences={preferences} />
        ) : filteredBooks.length ? (
          <BookShelf
            books={filteredBooks}
            view={view}
            coverUrls={epubCovers}
            t={t}
            selectedIds={selectedIds}
            collections={collections}
            onOpen={openBook}
            onRemove={removeBook}
            onEdit={setEditBook}
            onSelect={(id, ctrl) => {
              if (ctrl) {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                });
              }
            }}
            onToggleCollection={toggleBookInCollection}
            onRefetchCover={refetchCover}
            fetchingCoverIds={fetchingCoverIds}
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

      {/* 删除确认弹窗 */}
      {confirmBook ? (
        <ConfirmDialog
          title={t("confirmRemove")}
          body={`《${confirmBook.title}》的书签、高亮和进度将一并删除，此操作不可撤销。`}
          confirmLabel={t("remove")}
          cancelLabel={t("cancel")}
          danger
          onConfirm={() => void confirmRemoveBook(confirmBook)}
          onCancel={() => setConfirmBook(undefined)}
        />
      ) : null}

      {/* 元数据编辑弹窗 */}
      {editBook ? (
        <EditMetaDialog
          book={editBook}
          t={t}
          onSave={(patch) => void saveBookMeta(editBook.id, patch)}
          onCancel={() => setEditBook(undefined)}
        />
      ) : null}

      {/* 拖放 overlay */}
      {dragActive ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-inner">
            <FolderPlus size={40} />
            <span>{t("dropToImport")}</span>
          </div>
        </div>
      ) : null}

      {/* 新建收藏夹对话框 */}
      {newColMode ? (
        <div className="dialog-backdrop" onClick={() => setNewColMode(false)}>
          <form
            className="dialog-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (newColName.trim()) {
                void createCollection(newColName);
                setNewColName("");
                setNewColMode(false);
              }
            }}
          >
            <h3>{t("newCollection")}</h3>
            <label className="meta-field">
              <span>{t("collectionName")}</span>
              <input
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                autoFocus
                placeholder={t("collectionName")}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="soft-button pressable" onClick={() => { setNewColMode(false); setNewColName(""); }}>{t("cancel")}</button>
              <button type="submit" className="primary-button pressable">{t("saveChanges")}</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* 批量操作浮动栏 */}
      {selectedIds.size > 0 ? (
        <div className="batch-bar">
          <span className="batch-count">{selectedIds.size} 本已选</span>
          <button className="soft-button pressable" onClick={() => setSelectedIds(new Set())}>{t("cancel")}</button>
          <button className="primary-button pressable danger" onClick={() => setBatchConfirm(true)}>
            <Trash2 size={16} />
            <span>{t("batchDelete")}</span>
          </button>
        </div>
      ) : null}

      {/* 批量删除确认 */}
      {batchConfirm ? (
        <ConfirmDialog
          title={t("batchDelete")}
          body={`将删除 ${selectedIds.size} 本书及其所有书签、高亮和进度，此操作不可撤销。`}
          confirmLabel={t("remove")}
          cancelLabel={t("cancel")}
          danger
          onConfirm={batchRemoveBooks}
          onCancel={() => setBatchConfirm(false)}
        />
      ) : null}

      {/* 命令面板 */}
      {commandOpen ? (
        <CommandPalette
          books={books}
          t={t}
          onSelect={(book) => { setCommandOpen(false); void openBook(book); }}
          onClose={() => setCommandOpen(false)}
        />
      ) : null}
    </main>
  );
}

function BookShelf({
  books,
  view,
  coverUrls,
  t,
  selectedIds,
  collections,
  onOpen,
  onRemove,
  onEdit,
  onSelect,
  onToggleCollection,
  onRefetchCover,
  fetchingCoverIds
}: {
  books: BookRecord[];
  view: ShelfView;
  coverUrls: Map<string, string>;
  t: ReturnType<typeof createTranslator>;
  selectedIds: Set<string>;
  collections: Collection[];
  onOpen: (book: BookRecord, rect?: DOMRect) => void;
  onRemove: (book: BookRecord) => void;
  onEdit: (book: BookRecord) => void;
  onSelect: (id: string, ctrl: boolean) => void;
  onToggleCollection: (collectionId: string, bookId: string, add: boolean) => void;
  onRefetchCover: (book: BookRecord) => Promise<void>;
  fetchingCoverIds: Set<string>;
}) {
  const [tagMenuBook, setTagMenuBook] = useState<BookRecord | null>(null);

  return (
    <section className={`book-shelf ${view}`}>
      {books.map((book, index) => {
        const isSelected = selectedIds.has(book.id);
        return (
          <article
            key={book.id}
            className={`book-tile${isSelected ? " selected" : ""}`}
            style={{ "--stagger": index } as React.CSSProperties}
            onClick={(e) => { if (e.ctrlKey || e.metaKey) { onSelect(book.id, true); e.preventDefault(); } }}
          >
            <button className="cover-button" onClick={(e) => { if (!(e.ctrlKey || e.metaKey)) { const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); onOpen(book, rect); } }} title={book.title}>
              <BookCover book={book} coverUrl={coverUrls.get(book.id)} />
              {isSelected && <div className="tile-selected-badge" aria-label="已选中" />}
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
                <button className="icon-button pressable" title={t("editMetadata")} onClick={() => onEdit(book)}>
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button pressable"
                  title="重新抓取封面"
                  disabled={fetchingCoverIds.has(book.id)}
                  onClick={() => onRefetchCover(book)}
                >
                  {fetchingCoverIds.has(book.id)
                    ? <Loader2 size={17} className="spin" />
                    : <ImageIcon size={17} />}
                </button>
                {collections.length > 0 && (
                  <div className="tag-menu-anchor">
                    <button
                      className="icon-button pressable"
                      title={t("addToCollection")}
                      onClick={(e) => { e.stopPropagation(); setTagMenuBook(tagMenuBook?.id === book.id ? null : book); }}
                    >
                      <Tag size={17} />
                    </button>
                    {tagMenuBook?.id === book.id && (
                      <div className="tag-dropdown" onClick={(e) => e.stopPropagation()}>
                        {collections.map((col) => {
                          const inCol = col.bookIds.includes(book.id);
                          return (
                            <button
                              key={col.id}
                              className={`tag-dropdown-item${inCol ? " active" : ""}`}
                              onClick={() => { onToggleCollection(col.id, book.id, !inCol); setTagMenuBook(null); }}
                            >
                              <FolderOpen size={14} />
                              <span>{col.name}</span>
                              {inCol && <span className="tag-check">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <button className="icon-button pressable" title={t("remove")} onClick={() => onRemove(book)}>
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
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

// ─── 确认删除弹窗 ────────────────────────────────────────────────────────────
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="dialog-actions">
          <button className="soft-button pressable" onClick={onCancel}>{cancelLabel}</button>
          <button className={`primary-button pressable${danger ? " danger" : ""}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── 元数据编辑弹窗 ──────────────────────────────────────────────────────────
function EditMetaDialog({
  book,
  t,
  onSave,
  onCancel
}: {
  book: BookRecord;
  t: ReturnType<typeof createTranslator>;
  onSave: (patch: { title?: string; author?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title: title.trim() || book.title, author: author.trim() });
  };

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <form className="dialog-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>{t("editMetadata")}</h3>
        <label className="meta-field">
          <span>{t("titleLabel")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="meta-field">
          <span>{t("authorLabel")}</span>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="soft-button pressable" onClick={onCancel}>{t("cancel")}</button>
          <button type="submit" className="primary-button pressable">{t("saveChanges")}</button>
        </div>
      </form>
    </div>
  );
}

// ─── 阅读统计视图 ────────────────────────────────────────────────────────────
function StatsView({
  books,
  t,
  preferences
}: {
  books: BookRecord[];
  t: ReturnType<typeof createTranslator>;
  preferences: ReaderPreferences;
}) {
  const [goalStats, setGoalStats] = useState<GoalStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyReadingStat[]>([]);
  const [sessionCpm, setSessionCpm] = useState(0);

  useEffect(() => {
    let mounted = true;
    void window.readerApi.getGoalStats().then((v) => { if (mounted) setGoalStats(v); });
    void window.readerApi.getSessionsByDate().then((v) => { if (mounted) setDailyStats(v); });
    return () => { mounted = false; };
  }, [books]);

  useEffect(() => {
    setSessionCpm(getSessionAvgCpm());
    const id = setInterval(() => setSessionCpm(getSessionAvgCpm()), 5000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let weekMinutes = 0;
    const activeDays = new Set<string>();
    const bookMap = new Map<string, { title: string; minutes: number }>();

    for (const book of books) {
      for (const session of book.readingSessions ?? []) {
        const start = new Date(session.start).getTime();
        if (start >= weekAgo) {
          const mins = (new Date(session.end).getTime() - start) / 60000;
          weekMinutes += mins;
          activeDays.add(session.start.slice(0, 10));
          const entry = bookMap.get(book.id) ?? { title: book.title, minutes: 0 };
          entry.minutes += mins;
          bookMap.set(book.id, entry);
        }
      }
    }

    const topBooks = [...bookMap.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 6);
    const maxMinutes = topBooks[0]?.minutes ?? 1;

    return { weekMinutes: Math.round(weekMinutes), activeDays: activeDays.size, topBooks, maxMinutes };
  }, [books]);

  const dailyGoal = preferences.dailyGoalMinutes ?? 30;
  const todayMins = goalStats?.todayMinutes ?? 0;
  const goalPercent = Math.min(1, todayMins / Math.max(1, dailyGoal));
  const streak = goalStats?.streak ?? 0;
  const goalReached = goalStats?.goalReachedToday ?? false;

  return (
    <section className="stats-view">
      {/* 今日目标 */}
      <div className="goal-panel">
        <div className="goal-ring-wrap">
          <svg className="goal-ring" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="23" className="goal-ring-bg" />
            <circle
              cx="28" cy="28" r="23"
              className={`goal-ring-fill${goalReached ? " reached" : ""}`}
              style={{ strokeDashoffset: `${(1 - goalPercent) * 144.51}` }}
            />
          </svg>
          <span className="goal-ring-label">{todayMins}m</span>
        </div>
        <div className="goal-text">
          <span className="goal-title">{goalReached ? t("goalReached") : t("todayProgress")}</span>
          <span className="goal-sub">{todayMins} / {dailyGoal} {t("minutesPerDay")}</span>
          {streak > 0 && (
            <span className="goal-streak">
              <Flame size={14} />
              {streak} {t("streakDays")} {t("streak")}
            </span>
          )}
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-value">{stats.weekMinutes}</span>
          <span className="stat-label">{t("totalMinutes")}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.activeDays}</span>
          <span className="stat-label">{t("activeDays")}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{streak}</span>
          <span className="stat-label">{t("streak")}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{sessionCpm > 0 ? sessionCpm : "—"}</span>
          <span className="stat-label">{t("weeklySpeed")}</span>
        </div>
      </div>
      {stats.topBooks.length > 0 ? (
        <div className="stats-chart">
          <p className="stats-section-label">{t("thisWeek")}</p>
          {stats.topBooks.map((b) => (
            <div key={b.title} className="stats-bar-row">
              <span className="stats-bar-title" title={b.title}>{b.title}</span>
              <div className="stats-bar-track">
                <div
                  className="stats-bar-fill"
                  style={{ width: `${Math.round((b.minutes / stats.maxMinutes) * 100)}%` }}
                />
              </div>
              <span className="stats-bar-value">{Math.round(b.minutes)}m</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="stats-empty">{t("noStats")}</p>
      )}
      <div className="stats-heatmap">
        <p className="stats-section-label">{t("heatmapTitle")}</p>
        <div style={{ overflowX: "auto" }}>
          <HeatmapCalendar data={dailyStats} />
        </div>
      </div>
      <div className="stats-curve">
        <p className="stats-section-label">{t("readingTrend")}</p>
        <ReadingCurve data={dailyStats} />
      </div>
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

// ─── 命令面板 ────────────────────────────────────────────────────────────────
function CommandPalette({
  books,
  t,
  onSelect,
  onClose
}: {
  books: BookRecord[];
  t: ReturnType<typeof createTranslator>;
  onSelect: (book: BookRecord) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const norm = q.trim().toLowerCase();
    if (!norm) return books.slice(0, 8);
    return books
      .filter((b) => `${b.title} ${b.author ?? ""}`.toLowerCase().includes(norm))
      .slice(0, 8);
  }, [books, q]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { if (results[cursor]) onSelect(results[cursor]); }
    else if (e.key === "Escape") { onClose(); }
  };

  return (
    <div className="dialog-backdrop command-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-search-row">
          <Search size={18} />
          <input
            ref={inputRef}
            className="command-input"
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={handleKey}
            placeholder={t("commandPalette")}
          />
          <kbd className="command-esc-hint">ESC</kbd>
        </div>
        <ul className="command-list" role="listbox">
          {results.map((book, i) => (
            <li
              key={book.id}
              className={`command-item${i === cursor ? " active" : ""}`}
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => onSelect(book)}
            >
              <span className="format-chip small">{book.format.toUpperCase()}</span>
              <span className="command-title">{book.title}</span>
              {book.author && <span className="command-author">{book.author}</span>}
              <span className="command-progress">{percentLabel(book.progress)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
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
