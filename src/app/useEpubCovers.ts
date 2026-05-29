import { useCallback, useEffect, useRef, useState } from "react";
import { extractEpubCover } from "../readers/epub";
import type { BookRecord } from "../types";

/**
 * Loads and caches EPUB cover art for the shelf. Covers are resolved from disk
 * cache, extracted from the EPUB itself, or fetched from Google Books — in that
 * order — with bounded concurrency. Blob URLs are revoked on cleanup.
 */
export function useEpubCovers(books: BookRecord[]) {
  const [epubCovers, setEpubCovers] = useState<Map<string, string>>(new Map());
  const [fetchingCoverIds, setFetchingCoverIds] = useState<Set<string>>(new Set());
  const epubCoverRef = useRef(new Map<string, string>());
  const loadingCoversRef = useRef(new Set<string>());

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

  return { epubCovers, fetchingCoverIds, refetchCover };
}
