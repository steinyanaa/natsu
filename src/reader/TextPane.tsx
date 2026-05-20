import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTranslator } from "../i18n";
import { parseEpubDocument } from "../readers/epub";
import { parseMobiDocument } from "../readers/mobi";
import { parseTxtDocument } from "../readers/text";
import type { BookRecord, Highlight, ParsedTextDocument, ReaderPreferences, ReaderProgress, TocItem } from "../types";
import { resolveExistingTargetId, targetIdFromHashHref } from "./navigation";
import { ErrorState, LoadingState } from "./ReaderState";
import { SelectionMenu } from "./SelectionMenu";
import { applyHighlightToDOM, selectionToHighlightData } from "./highlightUtils";
import type { AnchorJumpRequest, JumpRequest } from "./types";
import { editableEventTarget, nowProgress, readerFontStack } from "./utils";

interface TextScrollAnchor {
  chapterId?: string;
  chapterOffset?: number;
  percent: number;
}

interface NoteOverlay {
  targetId: string;
  html?: string;
  left: number;
  top: number;
}

interface PinnedNote {
  targetId: string;
  label: string;
  html?: string;
  refId?: string;
}

function imageUrlsFromSrcset(srcset: string): string[] {
  return srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function imageUrlsFromHtml(html: string): string[] {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const urls = new Set<string>();

  parsed.querySelectorAll("img[src], image[href], image[xlink\\:href], video[poster], source[src]").forEach((node) => {
    ["src", "href", "xlink:href", "poster"].forEach((attribute) => {
      const value = node.getAttribute(attribute);
      if (value) {
        urls.add(value);
      }
    });
  });

  parsed.querySelectorAll("img[srcset], source[srcset]").forEach((node) => {
    const srcset = node.getAttribute("srcset");
    if (srcset) {
      imageUrlsFromSrcset(srcset).forEach((url) => urls.add(url));
    }
  });

  html.replace(/url\((['"]?)(.*?)\1\)/gi, (_match, _quote: string, url: string) => {
    if (url) {
      urls.add(url);
    }
    return "";
  });

  return [...urls].filter((url) => /^(?:blob:|data:image\/|https?:)/i.test(url));
}

function openExternalUrl(href: string): void {
  const externalHref = href.startsWith("//")
    ? `${window.location.protocol === "http:" ? "http:" : "https:"}${href}`
    : href;

  if (/^https?:/i.test(externalHref)) {
    void window.readerApi.openExternal(externalHref);
  }
}

function extractNoteHtml(el: HTMLElement | null | undefined): string | undefined {
  if (!el) {
    return undefined;
  }

  const inlineTags = new Set(["A", "SPAN", "SUP", "SUB", "B", "I", "EM", "STRONG", "SMALL"]);
  let node: HTMLElement = el;

  if (inlineTags.has(node.tagName) || (node.textContent ?? "").trim().length < 4) {
    const block = node.closest<HTMLElement>("p, li, dd, aside, section, blockquote, td, div");
    if (block && block !== node) {
      node = block;
    }
  }

  return node.innerHTML;
}

function estimateChapterHeight({
  chapter,
  preferences,
  viewportHeight
}: {
  chapter: ParsedTextDocument["chapters"][number];
  preferences: ReaderPreferences;
  viewportHeight: number;
}): number {
  if (chapter.layout === "fixed" && chapter.viewport) {
    const ratio = chapter.viewport.height / Math.max(1, chapter.viewport.width);
    const widthBoundHeight = Math.min(preferences.columnWidth, chapter.viewport.width) * ratio;
    return Math.max(360, Math.min(Math.max(420, viewportHeight - 160), widthBoundHeight || chapter.viewport.height));
  }

  const strippedTextLength = chapter.html.replace(/<[^>]+>/g, "").trim().length;
  const plainLength = Math.max(chapter.plainText.length, strippedTextLength);
  const charsPerLine = Math.max(12, Math.floor(preferences.columnWidth / Math.max(12, preferences.fontSize)));
  const lineCount = Math.ceil(plainLength / charsPerLine);
  const textHeight = lineCount * preferences.fontSize * preferences.lineHeight;
  const imageCount = (chapter.html.match(/<(?:img|svg|picture|image)\b/gi) ?? []).length;
  const imageHeight = imageCount * Math.min(viewportHeight * 0.68, preferences.columnWidth * 0.72);
  const blockCount = (chapter.html.match(/<(?:p|div|section|h[1-6]|li|blockquote)\b/gi) ?? []).length;
  const blockSpacing = blockCount * Math.max(4, preferences.fontSize * 0.38);

  return Math.max(viewportHeight * 0.62, Math.min(12000, textHeight + imageHeight + blockSpacing + 180));
}

export function TextPane({
  book,
  preferences,
  t,
  parser,
  jumpRequest,
  anchorJumpRequest,
  onProgress,
  onToc,
  onChapterInfo,
  onChapters,
  highlights,
  onHighlightSave,
  onHighlightRemove,
}: {
  book: BookRecord;
  preferences: ReaderPreferences;
  t: ReturnType<typeof createTranslator>;
  parser: "txt" | "mobi" | "epub";
  jumpRequest?: JumpRequest;
  anchorJumpRequest?: AnchorJumpRequest;
  onProgress: (progress: ReaderProgress) => void;
  onToc: (toc: TocItem[]) => void;
  onChapterInfo?: (charCount: number, chapterPercent: number) => void;
  onChapters?: (chapters: ParsedTextDocument["chapters"]) => void;
  highlights?: Highlight[];
  onHighlightSave?: (highlight: Highlight) => void;
  onHighlightRemove?: (highlightIds: string[]) => void;
}) {
  const [document, setDocument] = useState<ParsedTextDocument | undefined>();
  const [error, setError] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const restoredRef = useRef(false);
  const suspendedProgressUntilRef = useRef(0);
  const progressRafRef = useRef<number | undefined>(undefined);
  const stableScrollAnchorRef = useRef<TextScrollAnchor | undefined>(undefined);
  const resizeScrollAnchorRef = useRef<TextScrollAnchor | undefined>(undefined);
  const pendingAnchorRetryRef = useRef<{ targetId: string; attempts: number } | undefined>(undefined);
  const anchorNavigationTokenRef = useRef(0);
  const scrollSettleTimerRef = useRef<number | undefined>(undefined);
  const scrollActionTokenRef = useRef(0);
  const preloadedImageUrlsRef = useRef<Set<string>>(new Set());
  const preloadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const hoverNoteTimerRef = useRef<number | undefined>(undefined);
  const animatedChaptersRef = useRef<Set<string>>(new Set());
  const isEpub = parser === "epub";
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [chapterHeights, setChapterHeights] = useState<Record<string, number>>({});
  const [noteOverlay, setNoteOverlay] = useState<NoteOverlay | undefined>();
  const [noteTargetChapterIndex, setNoteTargetChapterIndex] = useState<number | undefined>();
  const [pinnedNotes, setPinnedNotes] = useState<PinnedNote[]>([]);
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; chapterId: string } | undefined>();
  const fixedFrameClickHandlerRef = useRef<
    ((nativeEvent: MouseEvent, frame: HTMLIFrameElement, frameDocument: Document) => void) | undefined
  >(undefined);
  const chapterIndexById = useMemo(() => {
    const map = new Map<string, number>();
    document?.chapters.forEach((chapter, index) => map.set(chapter.id, index));
    return map;
  }, [document]);

  const chapters = document?.chapters ?? [];

  const isMangaEpub = useMemo(() => {
    if (!isEpub || !chapters.length) return false;
    const fixedCount = chapters.filter((c) => c.layout === "fixed" || c.layout === "vertical").length;
    return fixedCount / chapters.length >= 0.7;
  }, [isEpub, chapters]);

  const mangaLayout = isMangaEpub ? (preferences.comicLayout ?? "single") : "single";
  const mangaRtl = isMangaEpub && preferences.readingDirection === "rtl";
  const mangaCoverSolo = isMangaEpub && (preferences.comicCoverSolo ?? true);
  const effectiveReaderMode = isMangaEpub ? "scroll" : preferences.readerMode;

  const chapterSpreads = useMemo<number[][]>(() => {
    if (mangaLayout !== "double") {
      return chapters.map((_, i) => [i]);
    }
    const result: number[][] = [];
    let i = 0;
    if (mangaCoverSolo) {
      result.push([0]);
      i = 1;
    }
    while (i < chapters.length) {
      const ch = chapters[i];
      const next = chapters[i + 1];
      if (ch?.layout === "fixed" && next?.layout === "fixed") {
        result.push([i, i + 1]);
        i += 2;
      } else {
        result.push([i]);
        i += 1;
      }
    }
    return result;
  }, [mangaLayout, mangaCoverSolo, chapters]);

  const chapterCharOffsets = useMemo(() => {
    let offset = 0;
    return chapters.map((ch) => {
      const start = offset;
      offset += ch.plainText?.length ?? 0;
      return start;
    });
  }, [chapters]);

  const totalChars = useMemo(
    () => chapters.reduce((sum, ch) => sum + (ch.plainText?.length ?? 0), 0),
    [chapters]
  );
  const lazyRadius = isEpub ? 2 : Number.POSITIVE_INFINITY;

  const pinnedNoteChapterIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const note of pinnedNotes) {
      if (note.html) {
        continue;
      }
      const chapterId = note.targetId.includes("__")
        ? note.targetId.slice(0, note.targetId.indexOf("__"))
        : note.targetId;
      const index = chapterIndexById.get(chapterId);
      if (index !== undefined) {
        indices.add(index);
      }
    }
    return indices;
  }, [chapterIndexById, pinnedNotes]);

  const noteOverlayPositionFromRect = useCallback((rect: Pick<DOMRect, "bottom" | "left" | "top">) => {
    const width = Math.min(420, Math.max(260, window.innerWidth - 32));
    const left = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - width - 16));
    const estimatedHeight = 220;
    const below = rect.bottom + 10;
    const top = below + estimatedHeight <= window.innerHeight - 16 ? below : Math.max(16, rect.top - estimatedHeight - 10);
    return { left, top };
  }, []);

  const noteOverlayPosition = useCallback(
    (anchor: HTMLElement) => noteOverlayPositionFromRect(anchor.getBoundingClientRect()),
    [noteOverlayPositionFromRect]
  );

  const findMountedNoteTarget = useCallback((targetId: string): HTMLElement | null => {
    const scroller = scrollerRef.current;
    const documentTarget = scroller?.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`);

    if (documentTarget) {
      return documentTarget;
    }

    for (const frame of scroller?.querySelectorAll<HTMLIFrameElement>("iframe.epub-fixed-frame") ?? []) {
      const frameTarget = frame.contentDocument?.getElementById(targetId);

      if (frameTarget) {
        return frameTarget;
      }
    }

    return null;
  }, []);

  const readScrollAnchor = useCallback((): TextScrollAnchor | undefined => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return undefined;
    }

    const max =
      effectiveReaderMode === "paged"
        ? scroller.scrollWidth - scroller.clientWidth
        : scroller.scrollHeight - scroller.clientHeight;
    const current = effectiveReaderMode === "paged" ? scroller.scrollLeft : scroller.scrollTop;
    const chapterElements = [...scroller.querySelectorAll<HTMLElement>(".text-chapter")];
    const scrollerRect = scroller.getBoundingClientRect();
    const currentChapter = chapterElements
      .map((chapter) => {
        const rect = chapter.getBoundingClientRect();
        const offset =
          effectiveReaderMode === "paged"
            ? Math.abs(rect.left - scrollerRect.left)
            : Math.abs(rect.top - scrollerRect.top);
        return { chapter, offset };
      })
      .sort((a, b) => a.offset - b.offset)[0]?.chapter;

    const chapterOffset = currentChapter
      ? effectiveReaderMode === "paged"
        ? Math.max(0, current - currentChapter.offsetLeft)
        : Math.max(0, current - currentChapter.offsetTop)
      : undefined;

    return {
      chapterId: currentChapter?.id,
      chapterOffset,
      percent: max <= 0 ? 0 : current / max
    };
  }, [effectiveReaderMode]);

  const restoreScrollAnchor = useCallback(
    (anchor?: TextScrollAnchor) => {
      const scroller = scrollerRef.current;
      if (!scroller || !anchor) {
        return false;
      }

      const targetChapter = anchor.chapterId
        ? scroller.querySelector<HTMLElement>(`#${CSS.escape(anchor.chapterId)}`)
        : null;

      if (targetChapter) {
        const nextChapterIndex = chapterIndexById.get(anchor.chapterId ?? "");
        if (nextChapterIndex !== undefined) {
          setActiveChapterIndex(nextChapterIndex);
        }

        if (effectiveReaderMode === "paged") {
          scroller.scrollLeft = targetChapter.offsetLeft + (anchor.chapterOffset ?? 0);
        } else {
          scroller.scrollTop = targetChapter.offsetTop + (anchor.chapterOffset ?? 0);
        }
        return true;
      }

      if (effectiveReaderMode === "paged") {
        scroller.scrollLeft = anchor.percent * (scroller.scrollWidth - scroller.clientWidth);
      } else {
        scroller.scrollTop = anchor.percent * (scroller.scrollHeight - scroller.clientHeight);
      }
      return true;
    },
    [chapterIndexById, effectiveReaderMode]
  );

  useEffect(() => {
    let cancelled = false;
    let ownedUrls: string[] = [];

    async function load() {
      setDocument(undefined);
      setError("");
      restoredRef.current = false;

      try {
        const buffer = await fetch(book.fileUrl).then((response) => response.arrayBuffer());
        const parsed =
          parser === "txt"
            ? parseTxtDocument(buffer, book.title)
            : parser === "mobi"
              ? await parseMobiDocument(buffer, book.title)
              : await parseEpubDocument(new Blob([buffer]), book.title);
        ownedUrls = parsed.objectUrls ?? [];

        if (cancelled) {
          ownedUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }

        setDocument(parsed);
        onToc(parsed.toc);
        onChapters?.(parsed.chapters);
        setActiveChapterIndex(0);
        setChapterHeights({});
        setNoteOverlay(undefined);
        setNoteTargetChapterIndex(undefined);
        setPinnedNotes([]);
        stableScrollAnchorRef.current = undefined;
        resizeScrollAnchorRef.current = undefined;
        pendingAnchorRetryRef.current = undefined;
        anchorNavigationTokenRef.current += 1;
        scrollActionTokenRef.current += 1;
        if (scrollSettleTimerRef.current !== undefined) {
          window.clearTimeout(scrollSettleTimerRef.current);
          scrollSettleTimerRef.current = undefined;
        }
        preloadedImageUrlsRef.current.clear();
        for (const image of preloadedImagesRef.current.values()) {
          image.src = "";
        }
        preloadedImagesRef.current.clear();
        animatedChaptersRef.current.clear();
      } catch {
        if (!cancelled) {
          setError(t("unsupported"));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      ownedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [book.fileUrl, book.title, onToc, onChapters, parser, t]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!document || !scroller || restoredRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      const savedProgress = book.progress;
      const savedAnchor: TextScrollAnchor = {
        chapterId: savedProgress?.chapterId,
        chapterOffset: savedProgress?.chapterOffset,
        percent: savedProgress?.percent ?? 0
      };
      const savedChapter = savedProgress?.chapterId
        ? scroller.querySelector<HTMLElement>(`#${CSS.escape(savedProgress.chapterId)}`)
        : null;

      restoreScrollAnchor(savedChapter ? savedAnchor : { percent: savedAnchor.percent });
      restoredRef.current = true;
    });
  }, [
    book.progress?.chapterId,
    book.progress?.chapterOffset,
    book.progress?.percent,
    document,
    restoreScrollAnchor
  ]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!document || !scroller || !jumpRequest) {
      return;
    }

    const navigationToken = ++anchorNavigationTokenRef.current;
    const frame = requestAnimationFrame(() => {
      if (navigationToken !== anchorNavigationTokenRef.current) {
        return;
      }

      if (effectiveReaderMode === "paged") {
        scroller.scrollLeft = jumpRequest.progress.percent * (scroller.scrollWidth - scroller.clientWidth);
      } else {
        scroller.scrollTop = jumpRequest.progress.percent * (scroller.scrollHeight - scroller.clientHeight);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [document, jumpRequest, effectiveReaderMode]);

  const updateProgress = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    if (performance.now() < suspendedProgressUntilRef.current) {
      return;
    }

    const max =
      effectiveReaderMode === "paged"
        ? scroller.scrollWidth - scroller.clientWidth
        : scroller.scrollHeight - scroller.clientHeight;
    const current = effectiveReaderMode === "paged" ? scroller.scrollLeft : scroller.scrollTop;
    const anchor = readScrollAnchor();
    stableScrollAnchorRef.current = anchor;
    const currentChapterId = anchor?.chapterId;
    const nextChapterIndex = currentChapterId ? chapterIndexById.get(currentChapterId) : undefined;
    if (nextChapterIndex !== undefined) {
      setActiveChapterIndex((currentIndex) =>
        Math.abs(currentIndex - nextChapterIndex) >= 1 ? nextChapterIndex : currentIndex
      );
    }

    const progressPercent = anchor?.percent ?? (max <= 0 ? 0 : current / max);
    onProgress(
      nowProgress({
        kind: isEpub ? "epub" : "text",
        current,
        total: max,
        percent: progressPercent,
        chapterId: currentChapterId,
        chapterOffset: anchor?.chapterOffset
      })
    );

    if (onChapterInfo && chapterCharOffsets.length > 0 && totalChars > 0) {
      const chapterCharCount = chapters[activeChapterIndex]?.plainText?.length ?? 0;
      const charsBeforeChapter = chapterCharOffsets[activeChapterIndex] ?? 0;
      const chapterStartPercent = charsBeforeChapter / totalChars;
      const chapterEndPercent = (charsBeforeChapter + chapterCharCount) / totalChars;
      const chapterSpan = chapterEndPercent - chapterStartPercent;
      const chapterInternalPercent = chapterSpan > 0
        ? Math.max(0, Math.min(1, (progressPercent - chapterStartPercent) / chapterSpan))
        : 0;
      onChapterInfo(chapterCharCount, chapterInternalPercent);
    }
  }, [activeChapterIndex, chapterCharOffsets, chapters, chapterIndexById, isEpub, onChapterInfo, onProgress, effectiveReaderMode, readScrollAnchor, totalChars]);

  useEffect(() => {
    if (!document || !isEpub) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const nextHeights: Record<string, number> = {};
      scrollerRef.current?.querySelectorAll<HTMLElement>(".text-chapter[data-rendered='true']").forEach((chapter) => {
        if (chapter.id) {
          nextHeights[chapter.id] = Math.max(480, Math.ceil(chapter.getBoundingClientRect().height));
        }
      });

      if (Object.keys(nextHeights).length) {
        setChapterHeights((current) => ({ ...current, ...nextHeights }));
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeChapterIndex, document, isEpub, preferences.columnWidth, preferences.fontSize, preferences.imageScale, preferences.lineHeight]);

  useEffect(() => {
    if (!document || !isEpub) {
      return;
    }

    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scroller.querySelectorAll<HTMLElement>(".text-chapter[data-rendered='true']").forEach((chapter) => {
        const id = chapter.id;
        if (!id || animatedChaptersRef.current.has(id)) {
          return;
        }

        animatedChaptersRef.current.add(id);
        chapter.classList.add("text-chapter-entering");
        window.setTimeout(() => {
          chapter.classList.remove("text-chapter-entering");
        }, 260);
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeChapterIndex, document, isEpub]);

  useEffect(() => {
    if (!noteOverlay || noteOverlay.html) {
      return;
    }

    const target = findMountedNoteTarget(noteOverlay.targetId);

    if (!target) {
      return;
    }

    setNoteOverlay((current) =>
      current?.targetId === noteOverlay.targetId ? { ...current, html: extractNoteHtml(target) } : current
    );
  }, [activeChapterIndex, findMountedNoteTarget, noteOverlay, noteTargetChapterIndex]);

  useEffect(() => {
    if (!document || !pinnedNotes.some((note) => !note.html)) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setPinnedNotes((current) => {
        let changed = false;
        const next = current.map((note) => {
          if (note.html) {
            return note;
          }
          const html = extractNoteHtml(findMountedNoteTarget(note.targetId));
          if (html) {
            changed = true;
            return { ...note, html };
          }
          return note;
        });
        return changed ? next : current;
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeChapterIndex, document, findMountedNoteTarget, pinnedNotes]);

  useEffect(() => {
    if (!noteOverlay) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNoteOverlay(undefined);
        setNoteTargetChapterIndex(undefined);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [noteOverlay]);

  // 选词菜单：监听 selectionchange（rAF 节流避免高频重渲染）
  useEffect(() => {
    let rafId: number | undefined;
    const handleSelectionChange = () => {
      if (rafId !== undefined) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = undefined;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSelectionMenu(undefined);
          return;
        }
        const range = sel.getRangeAt(0);
        const chapterEl = range.commonAncestorContainer instanceof HTMLElement
          ? range.commonAncestorContainer.closest<HTMLElement>(".text-chapter")
          : range.commonAncestorContainer.parentElement?.closest<HTMLElement>(".text-chapter");
        if (!chapterEl) {
          setSelectionMenu(undefined);
          return;
        }
        const rect = range.getBoundingClientRect();
        setSelectionMenu({
          x: Math.max(8, Math.min(rect.left + rect.width / 2 - 80, window.innerWidth - 200)),
          y: Math.max(8, rect.top - 56),
          chapterId: chapterEl.id,
        });
      });
    };
    window.document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      window.document.removeEventListener("selectionchange", handleSelectionChange);
      if (rafId !== undefined) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (!noteOverlay) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".epub-note-overlay, [data-epub-note-ref='true']")) {
        return;
      }

      setNoteOverlay(undefined);
      setNoteTargetChapterIndex(undefined);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [noteOverlay]);

  useEffect(() => {
    if (!document || !isEpub) {
      return;
    }

    const preloadRadius = lazyRadius + 2;
    const start = Math.max(0, activeChapterIndex - preloadRadius);
    const end = Math.min(document.chapters.length - 1, activeChapterIndex + preloadRadius);
    const urls = new Set(
      document.chapters
      .slice(start, end + 1)
        .flatMap((chapter) => imageUrlsFromHtml(`${chapter.html}${chapter.frameHtml ?? ""}`))
    );

    for (const url of urls) {
      if (preloadedImageUrlsRef.current.has(url)) {
        continue;
      }

      preloadedImageUrlsRef.current.add(url);
      const image = new Image();
      image.decoding = "async";
      image.loading = "eager";
      image.src = url;
      preloadedImagesRef.current.set(url, image);
    }

    for (const url of [...preloadedImageUrlsRef.current]) {
      if (!urls.has(url)) {
        const image = preloadedImagesRef.current.get(url);
        if (image) {
          image.src = "";
        }
        preloadedImagesRef.current.delete(url);
        preloadedImageUrlsRef.current.delete(url);
      }
    }
  }, [activeChapterIndex, document, isEpub, lazyRadius]);

  // 将已存高亮应用到渲染后的 DOM
  useEffect(() => {
    if (!highlights?.length || !scrollerRef.current) return;
    const scroller = scrollerRef.current;
    for (const highlight of highlights) {
      const chapterEl = scroller.querySelector<HTMLElement>(`#${CSS.escape(highlight.chapterId)}`);
      if (!chapterEl) continue;
      if (chapterEl.querySelector(`[data-highlight-id="${highlight.id}"]`)) continue;
      applyHighlightToDOM(chapterEl, highlight);
    }
  }, [highlights, activeChapterIndex]);

  const scheduleProgressUpdate = useCallback(() => {
    if (progressRafRef.current !== undefined) {
      return;
    }

    progressRafRef.current = window.requestAnimationFrame(() => {
      progressRafRef.current = undefined;
      updateProgress();
    });
  }, [updateProgress]);

  useEffect(() => {
    return () => {
      if (progressRafRef.current !== undefined) {
        window.cancelAnimationFrame(progressRafRef.current);
      }

      anchorNavigationTokenRef.current += 1;
      scrollActionTokenRef.current += 1;
      if (scrollSettleTimerRef.current !== undefined) {
        window.clearTimeout(scrollSettleTimerRef.current);
      }
      clearTimeout(hoverNoteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!document) {
      return;
    }

    let resizeTimer = 0;
    let restoreFrame = 0;
    let settleTimer = 0;

    const handleResize = () => {
      resizeScrollAnchorRef.current =
        resizeScrollAnchorRef.current ?? stableScrollAnchorRef.current ?? readScrollAnchor() ?? {
          chapterId: book.progress?.chapterId,
          chapterOffset: book.progress?.chapterOffset,
          percent: book.progress?.percent ?? 0
        };
      suspendedProgressUntilRef.current = performance.now() + 360;
      window.clearTimeout(resizeTimer);
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(restoreFrame);
      resizeTimer = window.setTimeout(() => {
        restoreFrame = window.requestAnimationFrame(() => {
          restoreScrollAnchor(resizeScrollAnchorRef.current);
          settleTimer = window.setTimeout(() => {
            resizeScrollAnchorRef.current = undefined;
            suspendedProgressUntilRef.current = 0;
            updateProgress();
          }, 40);
        });
      }, 180);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(restoreFrame);
    };
  }, [
    book.progress?.chapterId,
    book.progress?.chapterOffset,
    book.progress?.percent,
    document,
    readScrollAnchor,
    restoreScrollAnchor,
    updateProgress
  ]);

  const scheduleScrollSettle = useCallback(
    (delay: number) => {
      const actionToken = ++scrollActionTokenRef.current;

      if (scrollSettleTimerRef.current !== undefined) {
        window.clearTimeout(scrollSettleTimerRef.current);
      }

      scrollSettleTimerRef.current = window.setTimeout(() => {
        if (actionToken !== scrollActionTokenRef.current) {
          return;
        }

        scrollSettleTimerRef.current = undefined;
        suspendedProgressUntilRef.current = 0;
        updateProgress();
      }, delay);
    },
    [updateProgress]
  );

  const scrollToTarget = useCallback(
    (targetId: string, navigationToken = ++anchorNavigationTokenRef.current) => {
      const scroller = scrollerRef.current;
      if (!scroller || !targetId || navigationToken !== anchorNavigationTokenRef.current) {
        return false;
      }

      const retryAfterMount = (chapterIndex?: number) => {
        const currentRetry = pendingAnchorRetryRef.current;
        const attempts = currentRetry?.targetId === targetId ? currentRetry.attempts : 0;

        if (attempts >= 3) {
          pendingAnchorRetryRef.current = undefined;
          return false;
        }

        pendingAnchorRetryRef.current = { targetId, attempts: attempts + 1 };

        if (chapterIndex !== undefined) {
          setActiveChapterIndex(chapterIndex);
        }

        window.requestAnimationFrame(() => {
          if (navigationToken !== anchorNavigationTokenRef.current) {
            return;
          }

          window.requestAnimationFrame(() => {
            if (navigationToken !== anchorNavigationTokenRef.current) {
              return;
            }

            scrollToTarget(targetId, navigationToken);
          });
        });

        return true;
      };

      const existingIds = new Set(
        [...scroller.querySelectorAll<HTMLElement>("[id]")].map((node) => node.id).filter(Boolean)
      );
      const resolvedTargetId = resolveExistingTargetId(targetId, existingIds);
      const target = resolvedTargetId
        ? scroller.querySelector<HTMLElement>(`#${CSS.escape(resolvedTargetId)}`)
        : null;

      if (!target || !scroller.contains(target)) {
        const chapterId = targetId.includes("__") ? targetId.slice(0, targetId.indexOf("__")) : targetId;
        const chapterIndex = chapterIndexById.get(chapterId);
        if (chapterIndex !== undefined) {
          return retryAfterMount(chapterIndex);
        }
        return false;
      }

      const targetChapter = target.closest<HTMLElement>(".text-chapter");
      if (isEpub && targetChapter && targetChapter.dataset.rendered !== "true") {
        const chapterIndex = targetChapter.id ? chapterIndexById.get(targetChapter.id) : undefined;
        if (retryAfterMount(chapterIndex)) {
          return true;
        }
      }

      pendingAnchorRetryRef.current = undefined;

      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      suspendedProgressUntilRef.current = performance.now() + 180;

      if (effectiveReaderMode === "paged") {
        const nextLeft = scroller.scrollLeft + (targetRect.left - scrollerRect.left) - 28;
        scroller.scrollTo({
          left: Math.max(0, nextLeft),
          behavior: preferences.motion === "reduced" || preferences.reduceMotion ? "auto" : "smooth"
        });
      } else {
        const nextTop = scroller.scrollTop + (targetRect.top - scrollerRect.top) - 28;
        scroller.scrollTo({
          top: Math.max(0, nextTop),
          behavior: preferences.motion === "reduced" || preferences.reduceMotion ? "auto" : "smooth"
        });
      }

      scheduleScrollSettle(preferences.motion === "reduced" || preferences.reduceMotion ? 0 : 380);

      return true;
    },
    [
      chapterIndexById,
      isEpub,
      preferences.motion,
      effectiveReaderMode,
      preferences.reduceMotion,
      scheduleScrollSettle
    ]
  );

  const nudgePage = useCallback(
    (direction: 1 | -1) => {
      const scroller = scrollerRef.current;

      if (!scroller) {
        return;
      }

      const isReduced = preferences.motion === "reduced" || preferences.reduceMotion;
      const pageTurnStyle = preferences.pageTurnStyle ?? "slide";

      if (effectiveReaderMode === "paged" && !isReduced && pageTurnStyle === "fade") {
        // fade：短暂淡出，滚动后淡入
        scroller.classList.add("page-turn-fade-out");
        const target = scroller.scrollLeft + direction * Math.max(320, scroller.clientWidth * 0.86);
        setTimeout(() => {
          scroller.scrollLeft = target;
          scroller.classList.remove("page-turn-fade-out");
          scroller.classList.add("page-turn-fade-in");
          setTimeout(() => scroller.classList.remove("page-turn-fade-in"), 200);
        }, 130);
        suspendedProgressUntilRef.current = performance.now() + 400;
        scheduleScrollSettle(400);
        return;
      }

      const behavior: ScrollBehavior =
        isReduced || pageTurnStyle === "none" ? "auto" : "smooth";
      suspendedProgressUntilRef.current = performance.now() + (behavior === "smooth" ? 480 : 120);

      if (effectiveReaderMode === "paged") {
        scroller.scrollBy({ left: direction * Math.max(320, scroller.clientWidth * 0.86), behavior });
      } else {
        scroller.scrollBy({ top: direction * Math.max(320, scroller.clientHeight * 0.82), behavior });
      }

      scheduleScrollSettle(behavior === "smooth" ? 420 : 0);
    },
    [preferences.motion, preferences.pageTurnStyle, effectiveReaderMode, preferences.reduceMotion, scheduleScrollSettle]
  );

  useEffect(() => {
    if (!document || !anchorJumpRequest) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToTarget(anchorJumpRequest.targetId);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [anchorJumpRequest, document, scrollToTarget]);

  useEffect(() => {
    if (!document) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (editableEventTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (["PageDown", "ArrowRight", " "].includes(event.key)) {
        event.preventDefault();
        nudgePage(1);
      }

      if (["PageUp", "ArrowLeft"].includes(event.key)) {
        event.preventDefault();
        nudgePage(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [document, nudgePage]);

  const pinNote = useCallback(
    (targetId: string, rawLabel: string, refId?: string) => {
      if (!targetId) {
        return;
      }
      setPinnedNotes((current) => {
        if (current.some((note) => note.targetId === targetId)) {
          return current;
        }
        const label = rawLabel.replace(/[[\]()（）【】\s]/g, "").trim() || t("notes");
        return [...current, { targetId, label, html: extractNoteHtml(findMountedNoteTarget(targetId)), refId }];
      });
    },
    [findMountedNoteTarget, t]
  );

  const removeNote = useCallback((targetId: string) => {
    setPinnedNotes((current) => current.filter((note) => note.targetId !== targetId));
  }, []);

  const handleHighlight = useCallback((color: Highlight["color"]) => {
    const sel = window.getSelection();
    if (!sel || !selectionMenu) return;
    const data = selectionToHighlightData(sel, selectionMenu.chapterId);
    if (!data) return;
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      ...data,
      color,
      createdAt: new Date().toISOString(),
    };
    onHighlightSave?.(highlight);
    sel.removeAllRanges();
    setSelectionMenu(undefined);
  }, [selectionMenu, onHighlightSave]);

  const handleCopy = useCallback(() => {
    const sel = window.getSelection();
    if (sel) void navigator.clipboard.writeText(sel.toString());
    setSelectionMenu(undefined);
  }, []);

  const handleNoteRequest = useCallback(() => {
    const note = window.prompt("批注");
    if (note === null) return;
    const sel = window.getSelection();
    if (!sel || !selectionMenu) return;
    const data = selectionToHighlightData(sel, selectionMenu.chapterId);
    if (!data) return;
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      ...data,
      color: "yellow",
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    onHighlightSave?.(highlight);
    sel.removeAllRanges();
    setSelectionMenu(undefined);
  }, [selectionMenu, onHighlightSave]);

  const handleDocumentClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const targetNode = event.target;

      if (!(targetNode instanceof HTMLElement)) {
        return;
      }

      const anchor = targetNode.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const href = anchor.getAttribute("href")?.trim();

      if (!href) {
        return;
      }

      const targetId = targetIdFromHashHref(href);

      if (isEpub && anchor.dataset.epubNoteRef === "true") {
        const noteTargetId = anchor.dataset.epubNoteTargetId || targetId;

        if (noteTargetId) {
          event.preventDefault();
          clearTimeout(hoverNoteTimerRef.current);
          setNoteOverlay(undefined);
          setNoteTargetChapterIndex(undefined);
          let refId = anchor.id;
          if (!refId) {
            refId = `natsu-ref-${noteTargetId}`;
            anchor.id = refId;
          }
          pinNote(noteTargetId, anchor.textContent ?? "", refId);
          return;
        }
      }

      if (targetId) {
        setNoteOverlay(undefined);
        setNoteTargetChapterIndex(undefined);
        event.preventDefault();
        scrollToTarget(targetId);
        return;
      }

      if (/^(?:https?:|\/\/)/i.test(href)) {
        event.preventDefault();
        openExternalUrl(href);
        return;
      }

      event.preventDefault();
    },
    [chapterIndexById, findMountedNoteTarget, isEpub, noteOverlayPosition, pinNote, scrollToTarget]
  );

  const handleNoteMouseOver = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const anchor = target.closest("[data-epub-note-ref='true']");
      if (!(anchor instanceof HTMLElement)) return;

      clearTimeout(hoverNoteTimerRef.current);
      const noteTargetId = anchor.dataset.epubNoteTargetId;
      if (!noteTargetId) return;

      hoverNoteTimerRef.current = window.setTimeout(() => {
        const targetChapterId = noteTargetId.includes("__")
          ? noteTargetId.slice(0, noteTargetId.indexOf("__"))
          : noteTargetId;
        const targetChapterIndex = chapterIndexById.get(targetChapterId);
        const noteTarget = findMountedNoteTarget(noteTargetId);
        setNoteOverlay({
          targetId: noteTargetId,
          html: extractNoteHtml(noteTarget),
          ...noteOverlayPosition(anchor),
        });
        setNoteTargetChapterIndex(noteTarget ? undefined : targetChapterIndex);
      }, 120);
    },
    [chapterIndexById, findMountedNoteTarget, noteOverlayPosition]
  );

  const handleNoteMouseOut = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest("[data-epub-note-ref='true']")) return;

      clearTimeout(hoverNoteTimerRef.current);
      setNoteOverlay(undefined);
      setNoteTargetChapterIndex(undefined);
    },
    []
  );

  fixedFrameClickHandlerRef.current = (nativeEvent, frame, frameDocument) => {
    const targetNode = nativeEvent.target;

    if (!targetNode || typeof (targetNode as Element).closest !== "function") {
      return;
    }

    const anchor = (targetNode as Element).closest("a[href]") as HTMLAnchorElement | null;

    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute("href")?.trim();

    if (!href) {
      return;
    }

    nativeEvent.preventDefault();

    if (isEpub && anchor.dataset.epubNoteRef === "true") {
      const targetId = anchor.dataset.epubNoteTargetId || targetIdFromHashHref(href);

      if (targetId) {
        let refId = anchor.id;
        if (!refId) {
          refId = `natsu-ref-${targetId}`;
          anchor.id = refId;
        }
        pinNote(targetId, anchor.textContent ?? "", refId);
        return;
      }
    }

    if (href.startsWith("#")) {
      const targetId = href.slice(1);
      const sameFrameTarget = frameDocument.getElementById(targetId);

      if (sameFrameTarget) {
        sameFrameTarget.scrollIntoView({ block: "start", inline: "nearest" });
        return;
      }

      scrollToTarget(targetId);
      return;
    }

    if (/^(?:https?:|\/\/)/i.test(href)) {
      openExternalUrl(href);
    }
  };

  const handleFixedFrameLoad = useCallback(
    (event: React.SyntheticEvent<HTMLIFrameElement>) => {
      const frame = event.currentTarget;
      const frameDocument = frame.contentDocument;
      const frameWindow = frame.contentWindow;

      if (!frameDocument || !frameWindow || frameDocument.documentElement.dataset.natsuLinkBridge === "true") {
        return;
      }

      frameDocument.documentElement.dataset.natsuLinkBridge = "true";
      frameDocument.addEventListener(
        "click",
        (nativeEvent) => fixedFrameClickHandlerRef.current?.(nativeEvent, frame, frameDocument),
        { passive: false }
      );

      setNoteOverlay((current) => {
        if (!current || current.html) {
          return current;
        }

        const target = findMountedNoteTarget(current.targetId);
        return target ? { ...current, html: extractNoteHtml(target) } : current;
      });

      setPinnedNotes((current) => {
        if (!current.some((note) => !note.html)) {
          return current;
        }
        let changed = false;
        const next = current.map((note) => {
          if (note.html) {
            return note;
          }
          const html = extractNoteHtml(findMountedNoteTarget(note.targetId));
          if (html) {
            changed = true;
            return { ...note, html };
          }
          return note;
        });
        return changed ? next : current;
      });
    },
    [findMountedNoteTarget]
  );

  if (error) {
    return <ErrorState title={error} />;
  }

  if (!document) {
    return <LoadingState label={t("loading")} />;
  }

  const activeChapter = document.chapters[activeChapterIndex];
  const embeddedFonts = isEpub ? (activeChapter?.embeddedFonts ?? []) : [];
  const fontFamily =
    embeddedFonts.length && preferences.fontFamily !== "custom"
      ? `${embeddedFonts.map((f) => `"${f}"`).join(", ")}, ${readerFontStack(preferences)}`
      : readerFontStack(preferences);


  return (
    <div
      ref={scrollerRef}
      className={`text-reader ${effectiveReaderMode} ${isEpub ? "epub-text-reader" : ""} ${preferences.autoAlign ? "auto-align" : "justify-align"} ${preferences.imageMode === "fit-screen" ? "fit-screen-images" : "manual-images"} ${pinnedNotes.length ? "notes-open" : ""} ${preferences.justify ? "justify" : ""} ${preferences.justify && preferences.hyphenate ? "hyphenate" : ""}${isMangaEpub ? ` manga-epub manga-layout-${mangaLayout}` : ""}${isMangaEpub && !preferences.mangaSnapToPage ? " manga-no-snap" : ""}${mangaRtl ? " manga-rtl" : ""}`}
      onScroll={scheduleProgressUpdate}
      style={
        {
          "--reader-font-size": `${preferences.fontSize}px`,
          "--reader-line-height": preferences.lineHeight,
          "--reader-column-width": `${preferences.columnWidth}px`,
          "--reader-font-family": fontFamily,
          "--reader-image-width": preferences.imageScale
        } as React.CSSProperties
      }
    >
      <article
        className="text-document"
        onClickCapture={handleDocumentClick}
        onMouseOver={isEpub ? handleNoteMouseOver : undefined}
        onMouseOut={isEpub ? handleNoteMouseOut : undefined}
      >
        {!isEpub ? <h1>{document.title}</h1> : null}
        {!isEpub && document.author ? <p className="reader-author">{document.author}</p> : null}
        {chapterSpreads.map((spreadIndices) => {
          const spreadShouldRender =
            !isEpub ||
            spreadIndices.some(
              (index) =>
                Math.abs(index - activeChapterIndex) <= lazyRadius ||
                index === noteTargetChapterIndex ||
                pinnedNoteChapterIndices.has(index)
            );
          const renderChapter = (index: number) => {
            const chapter = document.chapters[index];
            const shouldRenderChapter =
              spreadShouldRender ||
              Math.abs(index - activeChapterIndex) <= lazyRadius ||
              index === noteTargetChapterIndex ||
              pinnedNoteChapterIndices.has(index);
            const placeholderHeight =
              chapterHeights[chapter.id] ??
              estimateChapterHeight({
                chapter,
                preferences,
                viewportHeight: scrollerRef.current?.clientHeight || window.innerHeight || 900
              });

            return (
              <section
                key={chapter.id}
                id={chapter.id}
                data-rendered={shouldRenderChapter ? "true" : "false"}
                className={`text-chapter ${isEpub && !shouldRenderChapter ? "lazy-chapter-placeholder" : ""} ${isEpub && chapter.layout === "fixed" ? "epub-fixed-chapter" : ""} ${isEpub && chapter.layout === "vertical" ? "epub-vertical-chapter" : ""}`}
                style={
                  isEpub && chapter.viewport
                    ? ({
                        "--epub-page-width": chapter.viewport.width,
                        "--epub-page-height": chapter.viewport.height,
                        "--lazy-chapter-height": `${placeholderHeight}px`
                      } as React.CSSProperties)
                    : isEpub
                      ? ({ "--lazy-chapter-height": `${placeholderHeight}px` } as React.CSSProperties)
                      : undefined
                }
              >
                {!shouldRenderChapter ? (
                  <div className="chapter-lazy-shell" aria-label={chapter.title} />
                ) : (
                  <>
                    {!isEpub && document.chapters.length > 1 ? <h2>{chapter.title}</h2> : null}
                    {isEpub && chapter.frameHtml ? (
                      <iframe
                        className="epub-fixed-frame"
                        title={chapter.title}
                        srcDoc={chapter.frameHtml}
                        sandbox="allow-same-origin"
                        onLoad={handleFixedFrameLoad}
                      />
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: chapter.html }} />
                    )}
                  </>
                )}
              </section>
            );
          };

          if (spreadIndices.length === 2) {
            const [a, b] = spreadIndices;
            return (
              <div key={`spread-${a}`} className={`epub-spread${mangaRtl ? " rtl" : ""}`}>
                {renderChapter(a)}
                {renderChapter(b)}
              </div>
            );
          }
          return renderChapter(spreadIndices[0]);
        })}
      </article>
      {noteOverlay ? (
        <aside
          aria-label="Footnote"
          className="epub-note-overlay"
          onClickCapture={handleDocumentClick}
          onMouseEnter={() => clearTimeout(hoverNoteTimerRef.current)}
          onMouseLeave={() => {
            hoverNoteTimerRef.current = window.setTimeout(() => {
              setNoteOverlay(undefined);
              setNoteTargetChapterIndex(undefined);
            }, 300);
          }}
          style={{ left: noteOverlay.left, position: "fixed", top: noteOverlay.top, zIndex: 5 }}
        >
          <button
            aria-label="Close footnote"
            className="epub-note-overlay-close"
            onClick={() => {
              setNoteOverlay(undefined);
              setNoteTargetChapterIndex(undefined);
            }}
            type="button"
          >
            ×
          </button>
          {noteOverlay.html ? (
            <div className="epub-note-overlay-content" dangerouslySetInnerHTML={{ __html: noteOverlay.html }} />
          ) : (
            <div className="epub-note-overlay-loading">…</div>
          )}
        </aside>
      ) : null}
      {selectionMenu && (
        <SelectionMenu
          x={selectionMenu.x}
          y={selectionMenu.y}
          onHighlight={handleHighlight}
          onCopy={handleCopy}
          onNote={handleNoteRequest}
        />
      )}
      {pinnedNotes.length ? (
        <aside className="epub-note-list" aria-label={t("notes")}>
          <header className="epub-note-list-head">
            <span>
              {t("notes")} · {pinnedNotes.length}
            </span>
            <button type="button" className="epub-note-list-clear" onClick={() => setPinnedNotes([])}>
              {t("clearNotes")}
            </button>
          </header>
          <div className="epub-note-list-body" onClickCapture={handleDocumentClick}>
            {pinnedNotes.map((note) => (
              <article key={note.targetId} className="epub-note-card">
                <button
                  type="button"
                  className="epub-note-card-close"
                  aria-label={t("closeNote")}
                  onClick={() => removeNote(note.targetId)}
                >
                  ×
                </button>
                <button
                  type="button"
                  className={`epub-note-card-label${note.refId ? " epub-note-card-label--link" : ""}`}
                  onClick={note.refId ? () => scrollToTarget(note.refId!) : undefined}
                >
                  {note.label}
                </button>
                <div
                  className="epub-note-card-content"
                  dangerouslySetInnerHTML={{ __html: note.html ?? "…" }}
                />
              </article>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
