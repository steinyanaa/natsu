import { ArrowLeft, Bookmark, BookmarkCheck, PanelLeft, SlidersHorizontal, Volume2 } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { SegmentedControl } from "../components/SegmentedControl";
import { createTranslator } from "../i18n";
import { BookmarkManager } from "./BookmarkManager";
import { KeymapHint } from "./KeymapHint";
import { NotesPanel } from "./NotesPanel";
import { ReaderScrubber } from "./ReaderScrubber";
import { ReaderStage } from "./ReaderStage";
import { SearchPanel } from "./SearchPanel";
import { TTSBar } from "./TTSBar";
import { TocTree } from "./TocTree";
import { useSwipeGesture } from "./useSwipeGesture";
import type { AnchorJumpRequest, JumpRequest } from "./types";
import { editableEventTarget, nowProgress } from "./utils";
import { LoadingState } from "./ReaderState";
import type { BookRecord, Bookmark as BookmarkRecord, Highlight, ParsedTextDocument, ReaderPreferences, ReaderProgress, TocItem } from "../types";

const CHARS_PER_MINUTE = 300;

type ReaderPanelTab = "contents" | "bookmarks" | "notes";
const loadSettingsPanel = () => import("../settings/SettingsPanel");
const SettingsPanel = lazy(() =>
  loadSettingsPanel().then((module) => ({ default: module.SettingsPanel }))
);

function percentLabel(progress?: ReaderProgress): string {
  if (!progress) return "0%";
  return `${Math.max(0, Math.min(100, Math.round(progress.percent * 100)))}%`;
}
export function ReaderScreen({
  book,
  preferences,
  t,
  onBack,
  onBookUpdated,
  onPreferencesChange
}: {
  book: BookRecord;
  preferences: ReaderPreferences;
  t: ReturnType<typeof createTranslator>;
  onBack: () => void;
  onBookUpdated: (book: BookRecord) => void;
  onPreferencesChange: (preferences: Partial<ReaderPreferences>) => void;
}) {
  const [progress, setProgress] = useState<ReaderProgress>(
    book.progress ??
      nowProgress({
        kind: book.format === "pdf" || ["cbz", "zip", "cbr", "rar"].includes(book.format) ? "page" : "text",
        current: 0,
        percent: 0
      })
  );
  const [tocOpen, setTocOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<ReaderPanelTab>("contents");
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const [jumpRequest, setJumpRequest] = useState<JumpRequest>();
  const [anchorJumpRequest, setAnchorJumpRequest] = useState<AnchorJumpRequest>();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [chapterEta, setChapterEta] = useState("");
  const [cursorHidden, setCursorHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chapters, setChapters] = useState<ParsedTextDocument["chapters"]>([]);
  const [ttsOpen, setTtsOpen] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [keymapOpen, setKeymapOpen] = useState(false);
  const shellRef = useRef<HTMLElement | null>(null);
  const sessionStartRef = useRef(Date.now());
  const saveTimer = useRef<number | undefined>(undefined);
  const chromeTimer = useRef<number | undefined>(undefined);
  const cursorTimer = useRef<number | undefined>(undefined);
  const latestProgressRef = useRef(progress);
  const lastSavedPercentRef = useRef(book.progress?.percent ?? progress.percent);
  const lastRevealRef = useRef<number>(0);
  const readerPanelOpen = tocOpen || settingsOpen;

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

  const saveProgress = useCallback(
    (nextProgress: ReaderProgress) => {
      latestProgressRef.current = nextProgress;
      setProgress((current) => {
        if (
          Math.abs(current.percent - nextProgress.percent) < 0.0015 &&
          current.current === nextProgress.current &&
          current.total === nextProgress.total
        ) {
          return current;
        }
        return nextProgress;
      });
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const pending = latestProgressRef.current;
        if (Math.abs(lastSavedPercentRef.current - pending.percent) < 0.0015) {
          return;
        }
        lastSavedPercentRef.current = pending.percent;
        await window.readerApi.saveProgress(book.id, pending);
      }, 520);
    },
    [book.id]
  );

  useEffect(() => {
    latestProgressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const start = new Date().toISOString();
    const bookId = book.id;
    return () => {
      window.clearTimeout(saveTimer.current);
      const pending = latestProgressRef.current;
      if (Math.abs(lastSavedPercentRef.current - pending.percent) >= 0.0015) {
        void window.readerApi.saveProgress(bookId, pending);
      }
      // 保存本次阅读 session（至少读了 30 秒）
      const end = new Date().toISOString();
      const elapsedMs = Date.now() - sessionStartRef.current;
      if (elapsedMs >= 30_000) {
        void window.readerApi.saveReadingSession(bookId, {
          bookId,
          start,
          end,
          charsRead: 0
        });
      }
    };
  }, [book.id]);
  const addBookmark = useCallback(async () => {
    const bookmark: BookmarkRecord = {
      id: crypto.randomUUID(),
      label: `${t("progress")} ${percentLabel(progress)}`,
      progress,
      createdAt: new Date().toISOString()
    };

    const updated = await window.readerApi.saveBookmark(book.id, bookmark);
    if (updated) {
      onBookUpdated(updated);
      setPanelTab("bookmarks");
      setTocOpen(true);
      setToast(t("bookmarkAdded"));
      window.setTimeout(() => setToast(""), 1600);
    }
  }, [book.id, onBookUpdated, progress, t]);

  const jumpToBookmark = useCallback((bookmark: BookmarkRecord) => {
    setJumpRequest({ progress: bookmark.progress, token: Date.now() });
    setProgress(bookmark.progress);
    setTocOpen(false);
  }, []);

  const jumpToToc = useCallback((targetId: string) => {
    setAnchorJumpRequest({ targetId, token: Date.now() });
    setTocOpen(false);
  }, []);

  const handleScrubberSeek = useCallback((chapterId: string) => {
    setAnchorJumpRequest({ targetId: chapterId, token: Date.now() });
  }, []);

  const renameBookmark = useCallback(
    async (bookmark: BookmarkRecord) => {
      const label = window.prompt(t("rename"), bookmark.label)?.trim();
      if (!label) {
        return;
      }

      const updated = await window.readerApi.updateBookmark(book.id, bookmark.id, { label });
      if (updated) {
        onBookUpdated(updated);
      }
    },
    [book.id, onBookUpdated, t]
  );

  const removeBookmarks = useCallback(
    async (bookmarkIds: string[]) => {
      if (!bookmarkIds.length) {
        return;
      }

      const updated = await window.readerApi.removeBookmarks(book.id, bookmarkIds);
      if (updated) {
        onBookUpdated(updated);
        setSelectedBookmarks(new Set());
      }
    },
    [book.id, onBookUpdated]
  );

  const saveHighlight = useCallback(async (highlight: Highlight) => {
    const updated = await window.readerApi.saveHighlight(book.id, highlight);
    if (updated) onBookUpdated(updated);
  }, [book.id, onBookUpdated]);

  const removeHighlights = useCallback(async (ids: string[]) => {
    const updated = await window.readerApi.removeHighlights(book.id, ids);
    if (updated) onBookUpdated(updated);
  }, [book.id, onBookUpdated]);

  const revealChrome = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(chromeTimer.current);

    if (!readerPanelOpen) {
      chromeTimer.current = window.setTimeout(() => setControlsVisible(false), 2400);
    }
  }, [readerPanelOpen]);

  const hideChrome = useCallback(() => {
    if (readerPanelOpen) {
      return;
    }

    window.clearTimeout(chromeTimer.current);
    setControlsVisible(false);
  }, [readerPanelOpen]);

  useEffect(() => {
    revealChrome();

    return () => window.clearTimeout(chromeTimer.current);
  }, [revealChrome]);

  useEffect(() => {
    window.clearTimeout(cursorTimer.current);
    if (controlsVisible) {
      setCursorHidden(false);
    } else {
      cursorTimer.current = window.setTimeout(() => {
        setCursorHidden(true);
      }, 1600);
    }

    return () => window.clearTimeout(cursorTimer.current);
  }, [controlsVisible]);

  // 阅读统计：每分钟 tick 更新已读时长
  useEffect(() => {
    const id = window.setInterval(() => {
      setSessionMinutes(Math.floor((Date.now() - sessionStartRef.current) / 60000));
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  const handleChapterInfo = useCallback((charCount: number, chapterPercent: number) => {
    if (charCount <= 0) {
      setChapterEta("");
      return;
    }

    const remaining = charCount * (1 - chapterPercent);
    const minutes = Math.ceil(remaining / CHARS_PER_MINUTE);

    if (minutes < 1) {
      setChapterEta("< 1 分钟");
    } else {
      setChapterEta(`本章剩余 ${minutes} 分钟`);
    }
  }, []);

  const findReaderScroller = useCallback((): HTMLElement | undefined => {
    return (
      document.querySelector<HTMLElement>(".text-reader") ??
      document.querySelector<HTMLElement>(".pdf-pages") ??
      document.querySelector<HTMLElement>(".comic-pages") ??
      undefined
    );
  }, []);

  const scrollReaderByKey = useCallback(
    (direction: 1 | -1, repeated: boolean) => {
      const scroller = findReaderScroller();
      if (!scroller) {
        return;
      }

      const isHorizontalPaged = scroller.classList.contains("text-reader") && scroller.classList.contains("paged");
      const isMangaSnapDisabled = scroller.classList.contains("manga-no-snap");
      const distance = isMangaSnapDisabled ? Math.max(320, scroller.clientHeight - 80) : repeated ? 58 : 108;
      const options: ScrollToOptions = {
        behavior:
          isMangaSnapDisabled || repeated || preferences.reduceMotion || preferences.motion === "reduced"
            ? "auto"
            : "smooth"
      };

      if (isHorizontalPaged) {
        options.left = direction * distance;
      } else {
        options.top = direction * distance;
      }

      scroller.scrollBy(options);

      if (direction > 0) {
        hideChrome();
      } else {
        revealChrome();
      }
    },
    [findReaderScroller, hideChrome, preferences.motion, preferences.reduceMotion, revealChrome]
  );

  const handleStageClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      // Ignore clicks inside toolbar, TOC panel, or settings panel
      if ((e.target as HTMLElement).closest(".reader-toolbar, .toc-panel, .settings-panel")) {
        return;
      }
      // If a panel is open, any click just reveals chrome (hides nothing)
      if (readerPanelOpen) {
        revealChrome();
        return;
      }
      // Ignore if user was drag-selecting text
      if ((window.getSelection()?.toString().length ?? 0) > 0) {
        return;
      }
      const x = e.clientX;
      const w = e.currentTarget.clientWidth;
      const zone = x / w;

      if ((preferences.tapToTurn ?? true) && zone < 0.25) {
        scrollReaderByKey(-1, false);
      } else if ((preferences.tapToTurn ?? true) && zone > 0.75) {
        scrollReaderByKey(1, false);
      } else {
        if (controlsVisible) {
          hideChrome();
        } else {
          revealChrome();
        }
      }
    },
    [controlsVisible, hideChrome, preferences.tapToTurn, readerPanelOpen, revealChrome, scrollReaderByKey]
  );

  useEffect(() => {
    let lastTarget: HTMLElement | undefined;
    let lastTop = 0;
    let lastLeft = 0;

    const handleReaderScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const isReaderScroller =
        target.classList.contains("text-reader") ||
        target.classList.contains("pdf-pages") ||
        target.classList.contains("comic-pages");

      if (!isReaderScroller) {
        return;
      }

      if (target !== lastTarget) {
        lastTarget = target;
        lastTop = target.scrollTop;
        lastLeft = target.scrollLeft;
        return;
      }

      const isHorizontalPaged = target.classList.contains("text-reader") && target.classList.contains("paged");
      const current = isHorizontalPaged ? target.scrollLeft : target.scrollTop;
      const previous = isHorizontalPaged ? lastLeft : lastTop;
      const delta = current - previous;

      lastTop = target.scrollTop;
      lastLeft = target.scrollLeft;

      if (delta > 10) {
        hideChrome();
      } else if (delta < -14) {
        revealChrome();
      }
    };

    window.addEventListener("scroll", handleReaderScroll, true);

    return () => window.removeEventListener("scroll", handleReaderScroll, true);
  }, [hideChrome, revealChrome]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (editableEventTarget(event.target)) {
      return;
    }

    // Ctrl/Cmd+F — 打开全书搜索
    if ((event.ctrlKey || event.metaKey) && event.key === "f") {
      event.preventDefault();
      setSearchOpen(true);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      scrollReaderByKey(1, event.repeat);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      scrollReaderByKey(-1, event.repeat);
      return;
    }

    if (event.key === "Escape") {
      setTocOpen(false);
      setSettingsOpen(false);
      setSearchOpen(false);
      setKeymapOpen(false);
    }

    if (event.key === "?" || (event.shiftKey && event.key === "/")) {
      event.preventDefault();
      setKeymapOpen((v) => !v);
      revealChrome();
      return;
    }

    if (event.key === "i" || event.key === "I") {
      event.preventDefault();
      onPreferencesChange({ immersive: !preferences.immersive });
      return;
    }

    if (event.key === "[") {
      event.preventDefault();
      onPreferencesChange({ brightness: Math.max(0.4, +(preferences.brightness - 0.05).toFixed(2)) });
      revealChrome();
      return;
    }

    if (event.key === "]") {
      event.preventDefault();
      onPreferencesChange({ brightness: Math.min(1, +(preferences.brightness + 0.05).toFixed(2)) });
      revealChrome();
      return;
    }

    revealChrome();
  }, [onPreferencesChange, preferences.brightness, preferences.immersive, revealChrome, scrollReaderByKey]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const swipeRtl = preferences.readingDirection === "rtl";
  useSwipeGesture(shellRef, {
    enabled: (preferences.tapToTurn ?? true) && !readerPanelOpen,
    onSwipeLeft: () => scrollReaderByKey(swipeRtl ? -1 : 1, false),
    onSwipeRight: () => scrollReaderByKey(swipeRtl ? 1 : -1, false)
  });

  return (
    <main
      ref={shellRef}
      className={`reader-shell ${controlsVisible || readerPanelOpen ? "controls-visible" : "controls-hidden"}${cursorHidden ? " cursor-hidden" : ""}${preferences.immersive ? " immersive" : ""}`}
      data-color-preset={preferences.readerColorPreset === "default" ? undefined : preferences.readerColorPreset}
      data-page-margin={preferences.pageMargin === "normal" ? undefined : preferences.pageMargin}
      onPointerMove={(event) => {
        if (event.clientY <= 104) {
          const now = Date.now();
          if (now - lastRevealRef.current >= 200) {
            lastRevealRef.current = now;
            revealChrome();
          }
        }
      }}
      onClick={handleStageClick}
    >
      {preferences.brightness < 0.99 && (
        <div
          className="reader-brightness-overlay"
          style={{ opacity: 1 - preferences.brightness }}
        />
      )}
      <header className="reader-toolbar">
        <button className="soft-button pressable" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>{t("back")}</span>
        </button>
        <button className="icon-button pressable" onClick={() => setTocOpen((value) => !value)} title={t("contents")}>
          <PanelLeft size={18} />
        </button>
        <div className="reader-title">
          <span className="format-chip">{book.format.toUpperCase()}</span>
          <strong>{book.title}</strong>
        </div>
        <div className="reader-progress" aria-label={t("progress")}>
          <i style={{ scale: `${Math.max(0.03, progress.percent)} 1` }} />
          <span>{percentLabel(progress)}</span>
        </div>
        {chapters.length > 1 && progress.chapterId ? (() => {
          const idx = chapters.findIndex((ch) => ch.id === progress.chapterId);
          return idx >= 0 ? (
            <span className="reader-chapter-pos" title={t("chapterOf")}>
              {idx + 1} / {chapters.length}
            </span>
          ) : null;
        })() : null}
        {chapterEta ? <span className="reader-chapter-eta">{chapterEta}</span> : null}
        {sessionMinutes >= 1 && (
          <span className="reader-session-time">已读 {sessionMinutes} 分</span>
        )}
        <button
          className="icon-button pressable"
          onClick={() => {
            const currentChapter = chapters.find((ch) => ch.id === progress.chapterId) ?? chapters[0];
            const text = currentChapter?.plainText ?? "";
            if (text.trim()) {
              setTtsText(text);
              setTtsOpen(true);
            }
          }}
          title="朗读本章"
        >
          <Volume2 size={18} />
        </button>
        <button className="icon-button pressable bookmark-pop" onClick={addBookmark} title={t("addBookmark")}>
          {book.bookmarks.length ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
        <button
          className="icon-button pressable"
          onClick={() => setKeymapOpen((v) => !v)}
          title="快捷键 (?)"
          aria-label="快捷键"
        >
          <span style={{ fontWeight: 900, fontSize: 14, lineHeight: 1 }}>?</span>
        </button>
        <button
          className="icon-button pressable"
          onPointerEnter={() => void loadSettingsPanel()}
          onFocus={() => void loadSettingsPanel()}
          onClick={toggleSettings}
          title={t("settings")}
        >
          <SlidersHorizontal size={18} />
        </button>
      </header>
      {keymapOpen && <KeymapHint onClose={() => setKeymapOpen(false)} />}

      <section className={`reader-workspace ${tocOpen ? "toc-open" : ""}${readerPanelOpen ? " reader-panel-open" : ""}`}>
        <aside className="toc-panel" aria-hidden={!tocOpen}>
          <SegmentedControl
            value={panelTab}
            options={[
              ["contents", t("contents")],
              ["bookmarks", t("bookmarks")],
              ["notes", "笔记"]
            ]}
            onChange={(value) => setPanelTab(value as ReaderPanelTab)}
          />
          {panelTab === "contents" ? (
            <div className="toc-section">
              <h2>{t("contents")}</h2>
              {toc.length ? (
                <TocTree items={toc.slice(0, 120)} onJump={jumpToToc} />
              ) : (
                <p>{t("noBookmarks")}</p>
              )}
            </div>
          ) : panelTab === "notes" ? (
            <div className="toc-section">
              <h2>笔记</h2>
              <NotesPanel
                highlights={book.highlights ?? []}
                onRemove={removeHighlights}
              />
            </div>
          ) : (
            <BookmarkManager
              book={book}
              selected={selectedBookmarks}
              t={t}
              onSelectChange={setSelectedBookmarks}
              onJump={jumpToBookmark}
              onRename={renameBookmark}
              onRemove={removeBookmarks}
            />
          )}
        </aside>

        <ReaderStage
          book={book}
          preferences={preferences}
          t={t}
          jumpRequest={jumpRequest}
          anchorJumpRequest={anchorJumpRequest}
          onProgress={saveProgress}
          onToc={setToc}
          onChapterInfo={handleChapterInfo}
          onChapters={setChapters}
          highlights={book.highlights}
          onHighlightSave={saveHighlight}
          onHighlightRemove={removeHighlights}
        />
      </section>

      {chapters.length > 1 && progress.kind !== "page" && (
        <ReaderScrubber
          progress={progress}
          chapters={chapters}
          toc={toc}
          onSeekChapter={handleScrubberSeek}
          reduceMotion={preferences.reduceMotion || preferences.motion === "reduced"}
        />
      )}

      {toast ? <div className="reader-toast">{toast}</div> : null}

      <SearchPanel
        chapters={chapters}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onJump={(chapterId) => {
          setAnchorJumpRequest({ targetId: chapterId, token: Date.now() });
        }}
      />

      {ttsOpen && (
        <TTSBar
          text={ttsText}
          onClose={() => setTtsOpen(false)}
        />
      )}

      {settingsMounted ? (
        <Suspense fallback={<LoadingState label={t("loading")} />}>
          <SettingsPanel
            open={settingsOpen}
            preferences={preferences}
            t={t}
            onClose={() => setSettingsOpen(false)}
            onChange={onPreferencesChange}
          />
        </Suspense>
      ) : null}
    </main>
  );
}

