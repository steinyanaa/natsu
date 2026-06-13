import type * as React from "react";
import { useCallback, useRef, useState } from "react";

/**
 * Page seek bar for comic/image readers (which have no chapter scrubber).
 * Drag to jump to any page; hovering or dragging shows a downscaled preview of
 * the page under the cursor, fetched lazily via `requestThumb`.
 */
export function ComicScrubber({
  pageCount,
  currentPage,
  rtl,
  onSeek,
  requestThumb
}: {
  /** Total pages. */
  pageCount: number;
  /** Current 0-based page. */
  currentPage: number;
  rtl: boolean;
  onSeek: (pageIndex: number) => void;
  requestThumb: (index: number) => string | undefined;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; page: number } | undefined>();
  const draggingRef = useRef(false);

  const pageFromClientX = useCallback(
    (clientX: number): { page: number; x: number } => {
      const track = trackRef.current;
      if (!track || pageCount <= 0) return { page: 0, x: 0 };
      const rect = track.getBoundingClientRect();
      let ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0, Math.min(1, ratio));
      const seekRatio = rtl ? 1 - ratio : ratio;
      const page = Math.max(0, Math.min(pageCount - 1, Math.round(seekRatio * (pageCount - 1))));
      return { page, x: ratio };
    },
    [pageCount, rtl]
  );

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const { page, x } = pageFromClientX(e.clientX);
      setHover({ x, page });
      if (draggingRef.current) onSeek(page);
    },
    [onSeek, pageFromClientX]
  );

  const handleDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      const { page, x } = pageFromClientX(e.clientX);
      setHover({ x, page });
      onSeek(page);
    },
    [onSeek, pageFromClientX]
  );

  const endDrag = useCallback(() => {
    draggingRef.current = false;
  }, []);

  if (pageCount <= 1) return null;

  const fillRatio = pageCount > 1 ? currentPage / (pageCount - 1) : 0;
  const fillPercent = (rtl ? 1 - fillRatio : fillRatio) * 100;
  const thumbUrl = hover ? requestThumb(hover.page) : undefined;

  return (
    <div className="comic-scrubber" aria-hidden>
      <div
        ref={trackRef}
        className="comic-scrubber-track"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => !draggingRef.current && setHover(undefined)}
      >
        <div className="comic-scrubber-fill" style={{ width: `${fillPercent}%` }} />
        <div className="comic-scrubber-handle" style={{ left: `${fillPercent}%` }} />
        {hover && (
          <div className="comic-scrubber-preview" style={{ left: `${hover.x * 100}%` }}>
            <div className="comic-scrubber-thumb">
              {thumbUrl ? <img src={thumbUrl} alt="" /> : <div className="comic-scrubber-thumb-pending" />}
            </div>
            <span className="comic-scrubber-pagenum">
              {hover.page + 1} / {pageCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
