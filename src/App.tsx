import {
  BarChart3,
  BookOpen,
  FolderOpen,
  FolderPlus,
  Globe2,
  Library,
  Plus,
  Search,
  Settings,
  Trash2,
  X
} from "lucide-react";
import type * as React from "react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { createTranslator } from "./i18n";

import { OpenBookTransition } from "./reader/OpenBookTransition";
import { SegmentedControl } from "./components/SegmentedControl";
import { ViewMorph } from "./components/ViewMorph";
import { LoadingStrip } from "./reader/ReaderState";
import { applyReaderTheme } from "./themeEngine";
import type { BookRecord, Collection, ReaderPreferences } from "./types";
import { useLibrary } from "./app/useLibrary";
import { useReaderNavigation } from "./app/useReaderNavigation";
import { useCovers } from "./app/useCovers";
import { useOnlineSearch } from "./app/useOnlineSearch";
import { useBookShelf, type AppSection, type ShelfFilter, type ShelfSort, type ShelfView } from "./bookshelf/useBookShelf";
import { BookShelf } from "./bookshelf/BookShelf";
import { EmptyShelf } from "./bookshelf/EmptyShelf";
import { EditMetaDialog } from "./bookshelf/EditMetaDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { CommandPalette } from "./components/CommandPalette";
import { StatsView } from "./stats/StatsView";
import { OnlineSearchPanelManaged } from "./online/OnlineSearchPanel";

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
  const [preferences, setPreferences] = useState<ReaderPreferences>(fallbackPreferences);
  const [confirmBook, setConfirmBook] = useState<BookRecord | undefined>();
  const [editBook, setEditBook] = useState<BookRecord | undefined>();
  const [dragActive, setDragActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColMode, setNewColMode] = useState(false);
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    books, setBooks,
    collections, setCollections,
    importing, setImporting,
    refreshBooks, importBooks,
    createCollection,
    deleteCollection,
    toggleBookInCollection,
    batchRemoveBooks: batchRemoveBooksHook
  } = useLibrary();

  const { activeBook, setActiveBook, openingCoverRect, setOpeningCoverRect, openBook: openBookHook } =
    useReaderNavigation(preferences);

  const {
    query, setQuery,
    filter, setFilter,
    view, setView,
    section, setSection,
    sort, setSort,
    activeCollectionId, setActiveCollectionId,
    filteredBooks
  } = useBookShelf(books, collections);

  const { coverUrls, fetchingCoverIds, refetchCover, requestCover } = useCovers(books);

  const {
    onlineOpen, setOnlineOpen,
    onlineQuery, setOnlineQuery,
    onlineResults,
    onlineLoading,
    onlineError,
    onlineImportingId,
    importOnlineResult,
    browserDownloadAndImport,
    runOnlineSearch
  } = useOnlineSearch({ preferences, query, setBooks });

  useApplyPreferences(preferences);
  useEveningMode(preferences);

  const t = useMemo(() => createTranslator(preferences.language), [preferences.language]);

  // Boot: load preferences, books, collections
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
  }, [setBooks, setCollections]);

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

  const openBook = useCallback(async (book: BookRecord, coverRect?: DOMRect) => {
    await openBookHook(book, coverRect, (opened) => {
      setBooks((current) => current.map((item) => (item.id === opened.id ? opened : item)));
    });
  }, [openBookHook, setBooks]);

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
    [activeBook, setBooks, setActiveBook]
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
  }, [setImporting, setBooks]);

  // 元数据编辑保存
  const saveBookMeta = useCallback(async (id: string, patch: { title?: string; author?: string }) => {
    setEditBook(undefined);
    const updated = await window.readerApi.updateBookMeta(id, patch);
    if (updated) {
      setBooks((current) => current.map((b) => (b.id === updated.id ? updated : b)));
      if (activeBook?.id === updated.id) setActiveBook(updated);
    }
  }, [activeBook, setBooks, setActiveBook]);

  // 收藏夹删除（需要 activeCollectionId）
  const handleDeleteCollection = useCallback(async (id: string) => {
    await deleteCollection(id, activeCollectionId, setActiveCollectionId);
  }, [deleteCollection, activeCollectionId, setActiveCollectionId]);

  // 批量删除
  const batchRemoveBooks = useCallback(async () => {
    await batchRemoveBooksHook(selectedIds, () => {
      setSelectedIds(new Set());
      setBatchConfirm(false);
    });
  }, [batchRemoveBooksHook, selectedIds]);

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
            coverUrls={coverUrls}
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
            onCoverNeeded={requestCover}
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
