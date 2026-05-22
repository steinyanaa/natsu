import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReaderProgress, TextChapter, TocItem } from "../types";

interface ReaderScrubberProps {
  progress: ReaderProgress;
  chapters: TextChapter[];
  toc: TocItem[];
  onSeekChapter: (chapterId: string) => void;
  reduceMotion: boolean;
}

function flattenToc(items: TocItem[]): TocItem[] {
  const result: TocItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children?.length) {
      result.push(...flattenToc(item.children));
    }
  }
  return result;
}

function getChapterLabel(chapter: TextChapter, flatToc: TocItem[]): string {
  const tocItem = flatToc.find((t) => t.id === chapter.id);
  return tocItem?.label || chapter.title || chapter.id;
}

function percentToChapterIndex(percent: number, count: number): number {
  if (count <= 0) return 0;
  const idx = Math.round(percent * (count - 1));
  return Math.max(0, Math.min(count - 1, idx));
}

function chapterIndexToPercent(index: number, count: number): number {
  if (count <= 1) return 0;
  return index / (count - 1);
}

export function ReaderScrubber({
  progress,
  chapters,
  toc,
  onSeekChapter,
  reduceMotion
}: ReaderScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState(0);
  const [hoverDotIndex, setHoverDotIndex] = useState<number | undefined>();
  const [tooltip, setTooltip] = useState<{ label: string; x: number } | undefined>();
  const dragStartPercentRef = useRef(0);
  const isDraggingRef = useRef(false);

  const flatToc = flattenToc(toc);

  // Current progress percent (0-1)
  const currentPercent = Math.max(0, Math.min(1, progress.percent));

  // Displayed percent: during drag, show drag position; otherwise real progress
  const displayPercent = dragging ? dragPercent : currentPercent;

  const getTrackPercent = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, raw));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const pct = getTrackPercent(e.clientX);
      isDraggingRef.current = true;
      dragStartPercentRef.current = currentPercent;
      setDragging(true);
      setDragPercent(pct);

      const chIdx = percentToChapterIndex(pct, chapters.length);
      const label = getChapterLabel(chapters[chIdx], flatToc);
      const track = trackRef.current;
      if (track) {
        const rect = track.getBoundingClientRect();
        const xPos = (e.clientX - rect.left) / rect.width;
        setTooltip({ label: `${label} · ${Math.round(pct * 100)}%`, x: xPos });
      }
    },
    [chapters, currentPercent, flatToc, getTrackPercent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const pct = getTrackPercent(e.clientX);
      setDragPercent(pct);

      const chIdx = percentToChapterIndex(pct, chapters.length);
      const label = getChapterLabel(chapters[chIdx], flatToc);
      const track = trackRef.current;
      if (track) {
        const rect = track.getBoundingClientRect();
        const xPos = (e.clientX - rect.left) / rect.width;
        setTooltip({ label: `${label} · ${Math.round(pct * 100)}%`, x: xPos });
      }
    },
    [chapters, flatToc, getTrackPercent]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setDragging(false);
      setTooltip(undefined);

      const pct = getTrackPercent(e.clientX);
      const chIdx = percentToChapterIndex(pct, chapters.length);
      if (chapters[chIdx]) {
        onSeekChapter(chapters[chIdx].id);
      }
    },
    [chapters, getTrackPercent, onSeekChapter]
  );

  // ESC cancels drag
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDraggingRef.current) {
        isDraggingRef.current = false;
        setDragging(false);
        setTooltip(undefined);
        setDragPercent(dragStartPercentRef.current);
      }
    };
    window.addEventListener("keyup", handleKeyUp);
    return () => window.removeEventListener("keyup", handleKeyUp);
  }, []);

  // Keyboard navigation when the track is focused
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentChIdx = chapters.findIndex((ch) => ch.id === progress.chapterId);
      const baseIdx = currentChIdx >= 0 ? currentChIdx : percentToChapterIndex(currentPercent, chapters.length);

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(chapters.length - 1, baseIdx + 1);
        if (chapters[next]) onSeekChapter(chapters[next].id);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(0, baseIdx - 1);
        if (chapters[prev]) onSeekChapter(chapters[prev].id);
      } else if (e.key === "Home") {
        e.preventDefault();
        if (chapters[0]) onSeekChapter(chapters[0].id);
      } else if (e.key === "End") {
        e.preventDefault();
        if (chapters[chapters.length - 1]) onSeekChapter(chapters[chapters.length - 1].id);
      }
    },
    [chapters, currentPercent, onSeekChapter, progress.chapterId]
  );

  // Do not render for single-chapter books or page-based readers
  if (chapters.length <= 1 || progress.kind === "page") {
    return null;
  }

  const fillPercent = displayPercent * 100;

  return (
    <div className="reader-scrubber">
      <div
        ref={trackRef}
        className="reader-scrubber-track"
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(currentPercent * 100)}
        aria-label="Chapter progress"
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          isDraggingRef.current = false;
          setDragging(false);
          setTooltip(undefined);
        }}
      >
        {/* Filled portion */}
        <div
          className="reader-scrubber-fill"
          style={{
            width: `${fillPercent}%`,
            transition: dragging || reduceMotion ? "none" : undefined
          }}
        />

        {/* Chapter dots */}
        {chapters.map((chapter, i) => {
          const dotPercent = chapterIndexToPercent(i, chapters.length) * 100;
          const isNear =
            hoverDotIndex === undefined
              ? false
              : Math.abs(hoverDotIndex - i) <= 0;
          return (
            <div
              key={chapter.id}
              className={`reader-scrubber-chapter-dot${isNear ? " near-dot" : ""}`}
              style={{ left: `${dotPercent}%` }}
              title={getChapterLabel(chapter, flatToc)}
              onPointerEnter={() => setHoverDotIndex(i)}
              onPointerLeave={() => setHoverDotIndex(undefined)}
              onClick={(e) => {
                e.stopPropagation();
                onSeekChapter(chapter.id);
              }}
            />
          );
        })}

        {/* Drag handle */}
        <div
          className={`reader-scrubber-handle${dragging ? " dragging" : ""}`}
          style={{
            left: `${fillPercent}%`,
            transition: dragging || reduceMotion ? "none" : undefined
          }}
        />

        {/* Tooltip — shown during drag or dot hover */}
        {tooltip && (
          <div
            className="reader-scrubber-tooltip"
            style={{ left: `${tooltip.x * 100}%` }}
          >
            {tooltip.label}
          </div>
        )}
        {hoverDotIndex !== undefined && !dragging && chapters[hoverDotIndex] && (
          <div
            className="reader-scrubber-tooltip"
            style={{
              left: `${chapterIndexToPercent(hoverDotIndex, chapters.length) * 100}%`
            }}
          >
            {getChapterLabel(chapters[hoverDotIndex], flatToc)}
          </div>
        )}
      </div>
    </div>
  );
}
