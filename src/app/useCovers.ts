import { useCallback, useEffect, useRef, useState } from "react";
import { coverEligibleFormat, coverUrl, generateCover } from "../readers/coverGenerators";
import type { BookRecord } from "../types";

const MAX_CONCURRENT = 3;

export function useCovers(books: BookRecord[]) {
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map());
  const [fetchingCoverIds, setFetchingCoverIds] = useState<Set<string>>(new Set());
  const coverRef = useRef(new Map<string, string>());
  const loadingRef = useRef(new Set<string>());
  const failedRef = useRef(new Set<string>());
  const queueRef = useRef<BookRecord[]>([]);
  const activeRef = useRef(0);
  const disposedRef = useRef(false);

  const commit = useCallback((id: string, url: string) => {
    if (disposedRef.current) return;
    coverRef.current.set(id, url);
    setCoverUrls(new Map(coverRef.current));
  }, []);

  const runOne = useCallback(
    async (book: BookRecord, force = false) => {
      loadingRef.current.add(book.id);
      try {
        if (!force) {
          const cached = await window.readerApi.hasCover(book.id);
          if (disposedRef.current) return;
          if (cached) { commit(book.id, coverUrl(book.id, book.hash)); return; }
        }
        const file = await fetch(book.fileUrl).then((r) => r.blob());
        if (disposedRef.current) return;
        const coverBlob = await generateCover(book.format, file);
        if (disposedRef.current) return;
        if (!coverBlob) {
          if (book.format === "epub") {
            const ok = await window.readerApi.fetchCoverForBook(book.id);
            if (ok && !disposedRef.current) { commit(book.id, coverUrl(book.id, String(Date.now()))); return; }
          }
          failedRef.current.add(book.id);
          return;
        }
        const bytes = new Uint8Array(await coverBlob.arrayBuffer());
        const version = force ? String(Date.now()) : book.hash;
        try {
          await window.readerApi.saveCover(book.id, bytes);
          if (!disposedRef.current) commit(book.id, coverUrl(book.id, version));
        } catch {
          if (!disposedRef.current) commit(book.id, URL.createObjectURL(coverBlob));
        }
      } catch {
        if (book.format === "epub") {
          try {
            const ok = await window.readerApi.fetchCoverForBook(book.id);
            if (ok && !disposedRef.current) { commit(book.id, coverUrl(book.id, String(Date.now()))); return; }
          } catch { /* ignore */ }
        }
        failedRef.current.add(book.id);
      } finally {
        loadingRef.current.delete(book.id);
      }
    },
    [commit]
  );

  const pump = useCallback(() => {
    while (activeRef.current < MAX_CONCURRENT && queueRef.current.length) {
      const book = queueRef.current.shift();
      if (!book) break;
      activeRef.current += 1;
      void runOne(book).finally(() => { activeRef.current -= 1; pump(); });
    }
  }, [runOne]);

  const requestCover = useCallback((book: BookRecord) => {
    if (!coverEligibleFormat(book.format)) return;
    if (coverRef.current.has(book.id) || loadingRef.current.has(book.id) || failedRef.current.has(book.id)) return;
    queueRef.current.push(book);
    pump();
  }, [pump]);

  const refetchCover = useCallback(async (book: BookRecord) => {
    setFetchingCoverIds((prev) => new Set([...prev, book.id]));
    failedRef.current.delete(book.id);
    coverRef.current.delete(book.id);
    try { await runOne(book, true); }
    finally {
      setFetchingCoverIds((prev) => { const next = new Set(prev); next.delete(book.id); return next; });
    }
  }, [runOne]);

  useEffect(() => {
    for (const [bookId, url] of coverRef.current) {
      if (!books.some((book) => book.id === bookId)) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        coverRef.current.delete(bookId);
        failedRef.current.delete(bookId);
      }
    }
    setCoverUrls(new Map(coverRef.current));
  }, [books]);

  useEffect(() => {
    // Reset on (re)mount — StrictMode (dev) runs mount → cleanup → mount, and
    // without resetting here `disposedRef` would stay true after the simulated
    // unmount, making every `commit` a no-op so covers never appear.
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      coverRef.current.forEach((url) => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); });
      coverRef.current.clear();
    };
  }, []);

  return { coverUrls, fetchingCoverIds, refetchCover, requestCover };
}
