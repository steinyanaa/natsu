import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createTranslator } from "../i18n";
import type { BookRecord, ComicFitMode, ReaderPreferences, ReaderProgress } from "../types";
import type { JumpRequest } from "./types";
import { nowProgress } from "./utils";
import { ErrorState, LoadingState } from "./ReaderState";
import { useRenderQueue, type RenderQueue } from "./useRenderQueue";
import { isPdfRenderCancellation, nextPdfPageRenderState, type PdfPageRenderState } from "./pdfRenderState";
import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PageScrollAnchor {
  pageIndex?: number;
  pageOffset?: number;
  percent: number;
}

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfRenderTask {
  promise: Promise<unknown>;
  cancel: () => void;
}

interface PdfPageProxy {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: PdfViewport }) => PdfRenderTask;
}

interface PdfDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy?: () => Promise<void> | void;
}

interface PdfLoadingTask {
  promise: Promise<PdfDocumentProxy>;
  destroy?: () => Promise<void> | void;
}

export function PdfPane({
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
  const [pdf, setPdf] = useState<PdfDocumentProxy>();
  const [pageCount, setPageCount] = useState(0);
  const [manualScale, setManualScale] = useState(1.05);
  const [autoScale, setAutoScale] = useState(1.05);
  const fit: ComicFitMode = preferences.comicFit ?? "width";
  const scale = fit === "manual" ? manualScale : autoScale;
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState({ top: 0, height: 900 });
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const progressRafRef = useRef<number | undefined>(undefined);
  const stableScrollAnchorRef = useRef<PageScrollAnchor | undefined>(undefined);
  const resizeScrollAnchorRef = useRef<PageScrollAnchor | undefined>(undefined);
  const estimatedPageHeight = Math.round(1080 * scale + 36);
  const renderWindow = 4;
  const renderQueue = useRenderQueue(2);
  const visibleStart = Math.max(0, Math.floor(viewport.top / estimatedPageHeight) - renderWindow);
  const visibleEnd = Math.min(
    pageCount - 1,
    Math.ceil((viewport.top + viewport.height) / estimatedPageHeight) + renderWindow
  );

  const readScrollAnchor = useCallback((): PageScrollAnchor | undefined => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return undefined;
    }

    const max = scroller.scrollHeight - scroller.clientHeight;
    const current = scroller.scrollTop;
    const scrollerRect = scroller.getBoundingClientRect();
    const visiblePage = [...scroller.querySelectorAll<HTMLElement>(".pdf-page")]
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
        ? scroller.querySelectorAll<HTMLElement>(".pdf-page")[anchor.pageIndex]
        : undefined;
    scroller.scrollTop = page
      ? page.offsetTop + (anchor.pageOffset ?? 0)
      : anchor.percent * (scroller.scrollHeight - scroller.clientHeight);
    return true;
  }, []);

  useEffect(() => {
    if (!pdf || fit === "manual" || fit === "original") {
      if (fit === "original") setAutoScale(1);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        if (cancelled) return;
        const scroller = scrollerRef.current;
        const containerW = scroller?.clientWidth ?? viewport.height; // viewport.height isn't right; fall back
        const containerH = scroller?.clientHeight ?? 900;
        const padW = 36;
        const padH = 28;
        const availableW = Math.max(120, containerW - padW);
        const availableH = Math.max(120, containerH - padH);
        let next = autoScale;
        if (fit === "width") next = availableW / vp.width;
        else if (fit === "height") next = availableH / vp.height;
        else if (fit === "page") next = Math.min(availableW / vp.width, availableH / vp.height);
        next = Math.max(0.3, Math.min(3, next));
        if (Math.abs(next - autoScale) > 0.01) setAutoScale(next);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, fit, viewport.height, viewport.top, autoScale]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PdfLoadingTask | undefined;
    let loadedPdf: PdfDocumentProxy | undefined;

    async function load() {
      setError("");
      setPdf(undefined);
      stableScrollAnchorRef.current = undefined;
      resizeScrollAnchorRef.current = undefined;

      try {
        const buffer = await fetch(book.fileUrl).then((response) => response.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data: buffer }) as unknown as PdfLoadingTask;
        loadedPdf = await loadingTask.promise;

        if (!cancelled) {
          setPdf(loadedPdf);
          setPageCount(loadedPdf.numPages);
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
      void loadingTask?.destroy?.();
      void loadedPdf?.destroy?.();
    };
  }, [book.fileUrl, t]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!pdf || !scroller || !jumpRequest) {
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
  }, [jumpRequest, pdf, restoreScrollAnchor]);

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
    pageCount,
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

  if (error) {
    return <ErrorState title={error} />;
  }

  if (!pdf) {
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
              onClick={() => setManualScale((value) => Math.max(0.55, value - 0.1))}
            >
              <Minus size={18} />
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              className="icon-button pressable"
              title={t("zoomIn")}
              onClick={() => setManualScale((value) => Math.min(2.2, value + 0.1))}
            >
              <Plus size={18} />
            </button>
          </>
        )}
      </div>
      <div ref={scrollerRef} className={`pdf-pages fit-${fit}`} onScroll={scheduleProgressUpdate}>
        {Array.from({ length: pageCount }, (_, index) =>
          index >= visibleStart && index <= visibleEnd ? (
            <PdfPage
              key={index + 1}
              pdf={pdf}
              pageNumber={index + 1}
              scale={scale}
              renderQueue={renderQueue}
              errorLabel={t("pdfPageRenderFailed")}
            />
          ) : (
            <figure
              key={index + 1}
              className="pdf-page virtual-page-placeholder"
              style={{ height: estimatedPageHeight }}
              aria-label={`${t("page")} ${index + 1}`}
            >
              <figcaption>{index + 1}</figcaption>
            </figure>
          )
        )}
      </div>
    </div>
  );
}

function PdfPage({
  pdf,
  pageNumber,
  scale,
  renderQueue,
  errorLabel
}: {
  pdf: PdfDocumentProxy;
  pageNumber: number;
  scale: number;
  renderQueue: RenderQueue;
  errorLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderVersionRef = useRef(0);
  const [renderState, setRenderState] = useState<PdfPageRenderState>({ status: "idle" });

  useEffect(() => {
    const version = renderVersionRef.current + 1;
    renderVersionRef.current = version;
    setRenderState({ status: "rendering" });
    let renderTask: PdfRenderTask | undefined;

    const queuedTask = renderQueue.enqueue(async (signal) => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (signal.aborted || renderVersionRef.current !== version || !canvasRef.current) return;

        const viewport = page.getViewport({ scale });
        const ratio = window.devicePixelRatio || 1;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context || signal.aborted || renderVersionRef.current !== version) return;

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        renderTask = page.render({ canvasContext: context, canvas, viewport });
        await renderTask.promise;

        if (signal.aborted || renderVersionRef.current !== version) {
          renderTask?.cancel();
          return;
        }

        setRenderState({ status: "ready" });
      } catch (error) {
        if (signal.aborted || renderVersionRef.current !== version || isPdfRenderCancellation(error)) {
          return;
        }

        setRenderState((current) => nextPdfPageRenderState(current, error));
      }
    });

    void queuedTask.promise.catch(() => undefined);

    return () => {
      renderVersionRef.current += 1;
      queuedTask.cancel();
      renderTask?.cancel();
    };
  }, [pageNumber, pdf, renderQueue, scale]);

  return (
    <figure className={`pdf-page${renderState.status === "error" ? " pdf-page-failed" : ""}`}>
      <canvas ref={canvasRef} />
      {renderState.status === "error" ? (
        <div className="pdf-page-error" role="note">
          <strong>{errorLabel}</strong>
          <span>{pageNumber}</span>
        </div>
      ) : null}
      <figcaption>{pageNumber}</figcaption>
    </figure>
  );
}
