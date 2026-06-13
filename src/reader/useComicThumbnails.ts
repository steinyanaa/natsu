import { useCallback, useEffect, useRef, useState } from "react";
import type { ComicSource } from "../readers/comic";
import { thumbDimensions } from "./comicThumbnail";

const THUMB_MAX_W = 160;
const THUMB_MAX_H = 220;
const THUMB_CACHE_CAP = 48;

/**
 * On-demand, downscaled page thumbnails for the comic scrubber.
 *
 * Thumbnails are decoded from the source's raw bytes (`getPageBlob`) and stored
 * as their own small JPEG object URLs — deliberately independent of the page
 * extract/release lifecycle, so revoking a full page never breaks a thumbnail.
 * The cache is capped and evicts whatever is farthest from the last request.
 */
export function useComicThumbnails(source: ComicSource | null): (index: number) => string | undefined {
  const cacheRef = useRef<Map<number, string>>(new Map());
  const pendingRef = useRef<Set<number>>(new Set());
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [, bump] = useState(0);

  // Drop every cached thumbnail when the book (source) changes or unmounts.
  useEffect(() => {
    const cache = cacheRef.current;
    const pending = pendingRef.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
      pending.clear();
    };
  }, [source]);

  return useCallback(
    (index: number): string | undefined => {
      const cached = cacheRef.current.get(index);
      if (cached) return cached;

      const src = source;
      if (!src || pendingRef.current.has(index)) return undefined;
      pendingRef.current.add(index);

      void (async () => {
        try {
          const blob = await src.getPageBlob(index);
          if (sourceRef.current !== src || !blob) {
            pendingRef.current.delete(index);
            return;
          }
          const bitmap = await createImageBitmap(blob);
          const { width, height } = thumbDimensions(bitmap.width, bitmap.height, THUMB_MAX_W, THUMB_MAX_H);
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
          const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.72 });

          if (sourceRef.current !== src) {
            pendingRef.current.delete(index);
            return;
          }

          const url = URL.createObjectURL(out);
          cacheRef.current.set(index, url);

          // Evict the entry farthest from the page just requested.
          if (cacheRef.current.size > THUMB_CACHE_CAP) {
            let farKey = -1;
            let farDist = -1;
            for (const key of cacheRef.current.keys()) {
              const d = Math.abs(key - index);
              if (d > farDist) {
                farDist = d;
                farKey = key;
              }
            }
            if (farKey >= 0 && farKey !== index) {
              const evicted = cacheRef.current.get(farKey);
              if (evicted) URL.revokeObjectURL(evicted);
              cacheRef.current.delete(farKey);
            }
          }

          pendingRef.current.delete(index);
          bump((n) => n + 1);
        } catch {
          pendingRef.current.delete(index);
        }
      })();

      return undefined;
    },
    [source]
  );
}
