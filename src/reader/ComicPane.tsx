import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTranslator } from "../i18n";
import { openRarComic, openZipComic, type ComicSource } from "../readers/comic";
import type { BookRecord, ComicFitMode, ReaderPreferences, ReaderProgress } from "../types";
import { computeSpreads } from "./comicLayout";
import { planComicWindow } from "./comicLoadWindow";
import { anchorSpread, cumulativeOffsets, findSpreadRange } from "./pagedVirtual";
import { PageHud } from "./PageHud";
import { ErrorState, LoadingState } from "./ReaderState";
import type { JumpRequest } from "./types";
import { nowProgress } from "./utils";

interface PageScrollAnchor {
  pageIndex?: number;
  pageOffset?: number;
  percent: number;
}

const RENDER_WINDOW = 4;
const PRELOAD_WINDOW = 6;
const RETAIN_PAGES = 24;
const MAX_EXTRACT_PER_TICK = 8;

export function ComicPane({
  book,
  preferences,
  t,
  jumpRequest,
  onProgress
}: {
  book: BookRecord;
  preferences: ReaderPreferences;
  t: ReturnType<typeof createTranslator>;
  jumpRequest?: JumpRequest;
  onProgress: (progress: ReaderProgress) => void;
}) {
  const [pageCount, setPageCount] = useState(0);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [manualScale, setManualScale] = useState(1);
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState({ top: 0, height: 900 });
  // Bumped whenever a spread's measured height changes, to recompute offsets.
  const [measureTick, setMeasureTick] = useState(0);

  const fit: ComicFitMode = preferences.comicFit ?? "width";
  const layout = preferences.comicLayout ?? "single";
  const rtl = preferences.readingDirection === "rtl";
  const coverSolo = preferences.comicCoverSolo ?? true;
  const nightFilter = preferences.comicNightFilter ?? "off";
  const snap = (preferences.mangaSnapToPage ?? true) && layout !== "webtoon" && fit !== "manual";
  const scale = fit === "manual" ? manualScale : 1;

  // Landscape pages discovered as images decode — kept solo in double layout.
  const [widePages, setWidePages] = useState<ReadonlySet<number>>(() => new Set());
  const spreads = useMemo<number[][]>(
    () => computeSpreads(pageCount, layout, coverSolo, layout === "double" ? widePages : undefined),
    [pageCount, layout, coverSolo, widePages]
  );
  const spreadOfPage = useMemo<number[]>(() => {
    const map = new Array<number>(pageCount).fill(0);
    spreads.forEach((spread, s) => spread.forEach((p) => (map[p] = s)));
    return map;
  }, [spreads, pageCount]);

  const sourceRef = useRef<ComicSource | null>(null);
  const requestedRef = useRef<Set<number>>(new Set());
  const extractedRef = useRef<Set<number>>(new Set());
  const heightsRef = useRef<number[]>([]);
  const topPadRef = useRef<number>(layout === "webtoon" ? 0 : 82);
  const figureRefs = useRef<Map<number, HTMLElement>>(new Map());
  const measureRafRef = useRef<number | undefined>(undefined);
  const progressRafRef = useRef<number | undefined>(undefined);
  const stableScrollAnchorRef = useRef<PageScrollAnchor | undefined>(undefined);
  const resizeScrollAnchorRef = useRef<PageScrollAnchor | undefined>(undefined);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const gap = layout === "webtoon" ? 0 : 28;
  const estimateExtent = useMemo(() => {
    if (fit === "height") return Math.max(360, viewport.height - 20);
    if (layout === "webtoon") return Math.round(viewport.height * 0.9 + gap);
    if (layout === "double") return Math.round(640 * scale + gap);
    return Math.round(1120 * scale + gap);
  }, [fit, layout, scale, viewport.height, gap]);

  // Reset measured heights when the layout/scale model changes — old
  // measurements no longer describe the new spread geometry.
  useEffect(() => {
    heightsRef.current = [];
    setMeasureTick((tick) => tick + 1);
  }, [layout, fit, scale, coverSolo]);

  // Per-spread "slot extent" (height incl. trailing gap): measured when seen,
  // estimated otherwise. Offsets drive both the visible range and the anchor
  // without ever touching the DOM.
  const offsets = useMemo(() => {
    const extents = spreads.map((_, i) => heightsRef.current[i] ?? estimateExtent);
    return cumulativeOffsets(extents);
    // measureTick participates so freshly measured heights recompute offsets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreads, estimateExtent, measureTick]);

  const topPad = topPadRef.current;
  const [visibleStart, visibleEnd] = findSpreadRange(
    offsets,
    viewport.top - topPad,
    viewport.top + viewport.height - topPad,
    RENDER_WINDOW
  );
  const currentSpread = anchorSpread(offsets, viewport.top + viewport.height * 0.35 - topPad);

  const readScrollAnchor = useCallback((): PageScrollAnchor | undefined => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const max = scroller.scrollHeight - scroller.clientHeight;
    const current = scroller.scrollTop;
    const s = anchorSpread(offsets, current - topPadRef.current);
    return {
      pageIndex: spreads[s]?.[0],
      pageOffset: Math.max(0, current - topPadRef.current - offsets[s]),
      percent: max <= 0 ? 0 : current / max
    };
  }, [offsets, spreads]);

  const restoreScrollAnchor = useCallback(
    (anchor?: PageScrollAnchor) => {
      const scroller = scrollerRef.current;
      if (!scroller || !anchor) return false;
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (anchor.pageIndex !== undefined && spreadOfPage[anchor.pageIndex] !== undefined) {
        const s = spreadOfPage[anchor.pageIndex];
        scroller.scrollTop = topPadRef.current + offsets[s] + (anchor.pageOffset ?? 0);
      } else {
        scroller.scrollTop = anchor.percent * max;
      }
      return true;
    },
    [offsets, spreadOfPage]
  );

  const measureSpread = useCallback((spreadIndex: number) => {
    const el = figureRefs.current.get(spreadIndex);
    if (!el) return;
    if (spreadIndex === 0) topPadRef.current = el.offsetTop;
    const extent = el.offsetHeight + (layout === "webtoon" ? 0 : 28);
    const prev = heightsRef.current[spreadIndex];
    if (prev === undefined || Math.abs(prev - extent) > 1) {
      heightsRef.current[spreadIndex] = extent;
      if (measureRafRef.current === undefined) {
        measureRafRef.current = window.requestAnimationFrame(() => {
          measureRafRef.current = undefined;
          setMeasureTick((tick) => tick + 1);
        });
      }
    }
  }, [layout]);

  const handleImageLoad = useCallback(
    (pageIndex: number, spreadIndex: number, img: HTMLImageElement) => {
      // A clearly landscape page is a cross-page spread — flag it so double
      // layout pulls it into its own slot instead of splitting the artwork.
      if (img.naturalWidth > img.naturalHeight * 1.2) {
        setWidePages((prev) => {
          if (prev.has(pageIndex)) return prev;
          const next = new Set(prev);
          next.add(pageIndex);
          return next;
        });
      }
      measureSpread(spreadIndex);
    },
    [measureSpread]
  );

  // ── Lazy archive open ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const reset = () => {
      requestedRef.current.clear();
      extractedRef.current.clear();
      heightsRef.current = [];
      figureRefs.current.clear();
      stableScrollAnchorRef.current = undefined;
      resizeScrollAnchorRef.current = undefined;
    };

    async function load() {
      setError("");
      setPageCount(0);
      setPageUrls([]);
      setWidePages(new Set());
      reset();

      try {
        let source: ComicSource;
        if (book.format === "zip" || book.format === "cbz") {
          const blob = await fetch(book.fileUrl).then((response) => response.blob());
          if (cancelled) return;
          source = await openZipComic(blob);
        } else {
          const buffer = await fetch(book.fileUrl).then((response) => response.arrayBuffer());
          if (cancelled) return;
          source = await openRarComic(buffer);
        }

        if (cancelled) {
          source.dispose();
          return;
        }

        sourceRef.current = source;
        setPageCount(source.pages.length);
        setPageUrls(new Array(source.pages.length).fill(""));
      } catch {
        if (!cancelled) setError(t("unsupported"));
      }
    }

    void load();

    return () => {
      cancelled = true;
      sourceRef.current?.dispose();
      sourceRef.current = null;
      reset();
    };
  }, [book.fileUrl, book.format, t]);

  // ── Extract / release window ────────────────────────────────────────────────
  useEffect(() => {
    const source = sourceRef.current;
    if (!source || !pageCount) return;

    const plan = planComicWindow({
      spreads,
      currentSpread,
      visibleStart,
      visibleEnd,
      preloadWindow: PRELOAD_WINDOW,
      retainPages: RETAIN_PAGES,
      extracted: extractedRef.current
    });

    for (const index of plan.release) {
      source.releasePage(index);
      extractedRef.current.delete(index);
      requestedRef.current.delete(index);
      setPageUrls((prev) => {
        if (!prev[index]) return prev;
        const next = prev.slice();
        next[index] = "";
        return next;
      });
    }

    let fired = 0;
    for (const index of plan.extract) {
      if (requestedRef.current.has(index)) continue;
      if (fired >= MAX_EXTRACT_PER_TICK) break;
      fired += 1;
      requestedRef.current.add(index);
      void source
        .extractPage(index)
        .then((url) => {
          if (sourceRef.current !== source || !url) return;
          extractedRef.current.add(index);
          setPageUrls((prev) => {
            if (prev[index] === url) return prev;
            const next = prev.slice();
            next[index] = url;
            return next;
          });
        })
        .catch(() => {
          requestedRef.current.delete(index);
        });
    }
  }, [pageCount, spreads, currentSpread, visibleStart, visibleEnd]);

  // ── Restore on jump ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pageCount || !scrollerRef.current || !jumpRequest) return;
    const frame = requestAnimationFrame(() => {
      restoreScrollAnchor({
        pageIndex: jumpRequest.progress.pageIndex,
        pageOffset: jumpRequest.progress.pageOffset,
        percent: jumpRequest.progress.percent
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [jumpRequest, pageCount, restoreScrollAnchor]);

  const updateProgress = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setViewport({ top: scroller.scrollTop, height: scroller.clientHeight });
    const max = scroller.scrollHeight - scroller.clientHeight;
    const current = scroller.scrollTop;
    const anchor = readScrollAnchor();
    stableScrollAnchorRef.current = anchor;

    onProgress(
      nowProgress({
        kind: "page",
        current,
        total: max,
        percent: anchor?.percent ?? (max <= 0 ? 0 : current / max),
        pageIndex: anchor?.pageIndex,
        pageOffset: anchor?.pageOffset
      })
    );
  }, [onProgress, readScrollAnchor]);

  // ── Container resize (sidebar / settings / window) ──────────────────────────
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let resizeTimer = 0;
    let restoreFrame = 0;
    let settleTimer = 0;

    const updateViewport = () => setViewport({ top: scroller.scrollTop, height: scroller.clientHeight });
    const handleResize = () => {
      resizeScrollAnchorRef.current =
        resizeScrollAnchorRef.current ?? stableScrollAnchorRef.current ?? readScrollAnchor() ?? {
          pageIndex: book.progress?.pageIndex,
          pageOffset: book.progress?.pageOffset,
          percent: book.progress?.percent ?? 0
        };
      updateViewport();
      window.clearTimeout(resizeTimer);
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(restoreFrame);
      resizeTimer = window.setTimeout(() => {
        restoreFrame = window.requestAnimationFrame(() => {
          restoreScrollAnchor(resizeScrollAnchorRef.current);
          updateViewport();
          settleTimer = window.setTimeout(() => {
            resizeScrollAnchorRef.current = undefined;
            updateProgress();
          }, 40);
        });
      }, 180);
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(scroller);
    updateViewport();

    return () => {
      observer.disconnect();
      window.clearTimeout(resizeTimer);
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(restoreFrame);
    };
  }, [
    book.progress?.pageIndex,
    book.progress?.pageOffset,
    book.progress?.percent,
    readScrollAnchor,
    restoreScrollAnchor,
    updateProgress
  ]);

  const scheduleProgressUpdate = useCallback(() => {
    if (progressRafRef.current !== undefined) return;
    progressRafRef.current = window.requestAnimationFrame(() => {
      progressRafRef.current = undefined;
      updateProgress();
    });
  }, [updateProgress]);

  useEffect(() => {
    return () => {
      if (progressRafRef.current !== undefined) window.cancelAnimationFrame(progressRafRef.current);
      if (measureRafRef.current !== undefined) window.cancelAnimationFrame(measureRafRef.current);
    };
  }, []);

  // Passive scroll listener — avoids blocking browser scroll
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.addEventListener("scroll", scheduleProgressUpdate, { passive: true });
    return () => scroller.removeEventListener("scroll", scheduleProgressUpdate);
  }, [scheduleProgressUpdate]);

  if (error) {
    return <ErrorState title={error} />;
  }

  if (!pageCount) {
    return <LoadingState label={t("loading")} />;
  }

  return (
    <div className="paged-reader">
      <div className="media-controls">
        {fit === "manual" && (
          <>
            <button
              className="icon-button pressable"
              title={t("zoomOut")}
              onClick={() => setManualScale((value) => Math.max(0.45, value - 0.1))}
            >
              <Minus size={18} />
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              className="icon-button pressable"
              title={t("zoomIn")}
              onClick={() => setManualScale((value) => Math.min(1.8, value + 0.1))}
            >
              <Plus size={18} />
            </button>
          </>
        )}
      </div>
      <div
        ref={scrollerRef}
        className={`comic-pages fit-${fit} layout-${layout}${rtl ? " dir-rtl" : ""}${
          snap ? " comic-snap" : ""
        }${nightFilter !== "off" ? ` comic-night-${nightFilter}` : ""}`}
      >
        {spreads.map((spread, sIndex) => {
          const visible = sIndex >= visibleStart && sIndex <= visibleEnd;
          const firstPage = spread[0];
          const minHeight = heightsRef.current[sIndex] ?? estimateExtent;
          return (
            <figure
              key={`spread-${firstPage}`}
              ref={(el) => {
                if (el) figureRefs.current.set(sIndex, el);
                else figureRefs.current.delete(sIndex);
              }}
              className={`comic-spread-slot${spread.length > 1 ? " double" : ""}`}
              style={{ minHeight: visible ? undefined : minHeight }}
            >
              {visible ? (
                spread.map((pi) =>
                  pageUrls[pi] ? (
                    <img
                      key={pi}
                      src={pageUrls[pi]}
                      alt={`${t("page")} ${pi + 1}`}
                      onLoad={(e) => handleImageLoad(pi, sIndex, e.currentTarget)}
                      style={fit === "manual" ? { width: `${Math.round(scale * 100)}%` } : undefined}
                    />
                  ) : (
                    <div
                      key={pi}
                      className="comic-page-loading"
                      style={{ minHeight: estimateExtent }}
                      aria-label={`${t("page")} ${pi + 1}`}
                    />
                  )
                )
              ) : (
                <div className="virtual-page-placeholder" aria-label={`${t("page")} ${firstPage + 1}`} />
              )}
            </figure>
          );
        })}
      </div>
      <PageHud current={(spreads[currentSpread]?.[0] ?? 0) + 1} total={pageCount} />
    </div>
  );
}
