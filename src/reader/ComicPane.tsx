import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTranslator } from "../i18n";
import { readRarComic, readZipComic, type ComicPage } from "../readers/comic";
import type { BookRecord, ComicFitMode, ReaderPreferences, ReaderProgress } from "../types";
import { ErrorState, LoadingState } from "./ReaderState";
import type { JumpRequest } from "./types";
import { nowProgress } from "./utils";

interface PageScrollAnchor {
  pageIndex?: number;
  pageOffset?: number;
  percent: number;
}

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
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [manualScale, setManualScale] = useState(1);
  const fit: ComicFitMode = preferences.comicFit ?? "width";
  const layout = preferences.comicLayout ?? "single";
  const rtl = preferences.readingDirection === "rtl";
  const coverSolo = preferences.comicCoverSolo ?? true;
  const scale = fit === "manual" ? manualScale : 1;
  const spreads = useMemo<number[][]>(() => {
    if (!pages.length) return [];
    if (layout !== "double") {
      return pages.map((_, i) => [i]);
    }
    const result: number[][] = [];
    let i = 0;
    if (coverSolo) {
      result.push([0]);
      i = 1;
    }
    while (i < pages.length) {
      if (i + 1 < pages.length) {
        result.push([i, i + 1]);
        i += 2;
      } else {
        result.push([i]);
        i += 1;
      }
    }
    return result;
  }, [pages, layout, coverSolo]);
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState({ top: 0, height: 900 });
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const progressRafRef = useRef<number | undefined>(undefined);
  const stableScrollAnchorRef = useRef<PageScrollAnchor | undefined>(undefined);
  const resizeScrollAnchorRef = useRef<PageScrollAnchor | undefined>(undefined);
  const preloadedImagesRef = useRef<Map<string, { image: HTMLImageElement; index: number }>>(new Map());
  const estimatedSpreadHeight =
    fit === "height"
      ? Math.max(360, viewport.height - 20)
      : layout === "webtoon"
      ? Math.round(viewport.height * 0.9 + 12)
      : layout === "double"
      ? Math.round(640 * scale + 28)
      : Math.round(1120 * scale + 28);
  const renderWindow = 4;
  const preloadWindow = 6;
  const preloadRetainWindow = 18;
  const visibleStart = Math.max(0, Math.floor(viewport.top / estimatedSpreadHeight) - renderWindow);
  const visibleEnd = Math.min(
    Math.max(0, spreads.length - 1),
    Math.ceil((viewport.top + viewport.height) / estimatedSpreadHeight) + renderWindow
  );

  const readScrollAnchor = useCallback((): PageScrollAnchor | undefined => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return undefined;
    }

    const max = scroller.scrollHeight - scroller.clientHeight;
    const current = scroller.scrollTop;
    const scrollerRect = scroller.getBoundingClientRect();
    const visiblePage = [...scroller.querySelectorAll<HTMLElement>(".comic-spread-slot")]
      .map((page, index) => ({
        page,
        index,
        distance: Math.abs(page.getBoundingClientRect().top - scrollerRect.top)
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    return {
      pageIndex: visiblePage?.index,
      pageOffset: visiblePage ? Math.max(0, current - visiblePage.page.offsetTop) : undefined,
      percent: max <= 0 ? 0 : current / max
    };
  }, []);

  const restoreScrollAnchor = useCallback((anchor?: PageScrollAnchor) => {
    const scroller = scrollerRef.current;
    if (!scroller || !anchor) {
      return false;
    }

    const page =
      anchor.pageIndex !== undefined
        ? scroller.querySelectorAll<HTMLElement>(".comic-spread-slot")[anchor.pageIndex]
        : undefined;
    scroller.scrollTop = page
      ? page.offsetTop + (anchor.pageOffset ?? 0)
      : anchor.percent * (scroller.scrollHeight - scroller.clientHeight);
    return true;
  }, []);

  const clearPreloadedImages = useCallback(() => {
    for (const { image } of preloadedImagesRef.current.values()) {
      image.src = "";
    }
    preloadedImagesRef.current.clear();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ownedPages: ComicPage[] = [];

    async function load() {
      setError("");
      setPages([]);
      stableScrollAnchorRef.current = undefined;
      resizeScrollAnchorRef.current = undefined;
      clearPreloadedImages();

      try {
        if (book.format === "zip" || book.format === "cbz") {
          const blob = await fetch(book.fileUrl).then((response) => response.blob());
          ownedPages = await readZipComic(blob);
        } else {
          const buffer = await fetch(book.fileUrl).then((response) => response.arrayBuffer());
          ownedPages = await readRarComic(buffer);
        }

        if (!cancelled) {
          setPages(ownedPages);
        }
      } catch {
        if (!cancelled) {
          setError(t("unsupported"));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      clearPreloadedImages();
      ownedPages.forEach((page) => URL.revokeObjectURL(page.url));
    };
  }, [book.fileUrl, book.format, clearPreloadedImages, t]);

  useEffect(() => {
    if (!pages.length) {
      clearPreloadedImages();
      return;
    }

    const currentSpread = Math.min(
      Math.max(0, spreads.length - 1),
      Math.max(0, Math.floor((viewport.top + viewport.height * 0.35) / estimatedSpreadHeight))
    );
    const currentIndex = spreads[currentSpread]?.[0] ?? 0;
    const preloadCandidates: number[] = [];
    const queued = new Set<number>();
    const queuePreload = (index: number) => {
      if (index < 0 || index >= pages.length || queued.has(index)) {
        return;
      }

      queued.add(index);
      preloadCandidates.push(index);
    };

    for (let s = visibleStart; s <= visibleEnd; s += 1) {
      for (const pi of spreads[s] ?? []) queuePreload(pi);
    }

    for (let distance = 1; distance <= preloadWindow; distance += 1) {
      const ahead = spreads[currentSpread + distance];
      const back = spreads[currentSpread - distance];
      if (ahead) for (const pi of ahead) queuePreload(pi);
      if (back) for (const pi of back) queuePreload(pi);
    }

    for (const index of preloadCandidates) {
      const page = pages[index];
      const existing = preloadedImagesRef.current.get(page.url);

      if (existing) {
        existing.index = index;
        continue;
      }

      const image = new Image();
      image.decoding = "async";
      image.src = page.url;
      preloadedImagesRef.current.set(page.url, { image, index });

      // LRU 驱逐：超过上限时移除距当前页最远的条目
      const maxCacheSize = preloadRetainWindow * 2;
      if (preloadedImagesRef.current.size > maxCacheSize) {
        let farthestKey = "";
        let farthestDist = -1;
        for (const [key, entry] of preloadedImagesRef.current) {
          const dist = Math.abs(entry.index - currentIndex);
          if (dist > farthestDist) {
            farthestDist = dist;
            farthestKey = key;
          }
        }
        if (farthestKey) {
          const evicted = preloadedImagesRef.current.get(farthestKey);
          if (evicted) evicted.image.src = "";
          preloadedImagesRef.current.delete(farthestKey);
        }
      }
    }

    for (const [url, preload] of preloadedImagesRef.current) {
      if (Math.abs(preload.index - currentIndex) > preloadRetainWindow) {
        preload.image.src = "";
        preloadedImagesRef.current.delete(url);
      }
    }
  }, [clearPreloadedImages, estimatedSpreadHeight, pages, spreads, viewport.height, viewport.top, visibleEnd, visibleStart]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!pages.length || !scroller || !jumpRequest) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      restoreScrollAnchor({
        pageIndex: jumpRequest.progress.pageIndex,
        pageOffset: jumpRequest.progress.pageOffset,
        percent: jumpRequest.progress.percent
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [jumpRequest, pages.length, restoreScrollAnchor]);

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

    updateViewport();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(restoreFrame);
    };
  }, [
    book.progress?.pageIndex,
    book.progress?.pageOffset,
    book.progress?.percent,
    pages.length,
    readScrollAnchor,
    restoreScrollAnchor,
    scale,
    updateProgress
  ]);

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

  if (!pages.length) {
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
        className={`comic-pages fit-${fit} layout-${layout}${rtl ? " dir-rtl" : ""}`}
      >
        {spreads.map((spread, sIndex) => {
          const visible = sIndex >= visibleStart && sIndex <= visibleEnd;
          const firstPage = spread[0];
          return (
            <figure
              key={`spread-${firstPage}`}
              className={`comic-spread-slot${spread.length > 1 ? " double" : ""}`}
              style={{ minHeight: visible ? undefined : estimatedSpreadHeight }}
            >
              {visible ? (
                spread.map((pi) => (
                  <img
                    key={pages[pi].url}
                    src={pages[pi].url}
                    alt={`${t("page")} ${pi + 1}`}
                    style={fit === "manual" ? { width: `${Math.round(scale * 100)}%` } : undefined}
                  />
                ))
              ) : (
                <div className="virtual-page-placeholder" aria-label={`${t("page")} ${firstPage + 1}`} />
              )}
            </figure>
          );
        })}
      </div>
    </div>
  );
}
