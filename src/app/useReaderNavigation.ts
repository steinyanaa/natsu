import { useCallback, useState } from "react";
import { preloadReaderPaneForFormat } from "../reader/preloadPanes";
import type { BookRecord, ReaderPreferences } from "../types";

export function useReaderNavigation(preferences: ReaderPreferences) {
  const [activeBook, setActiveBook] = useState<BookRecord | undefined>();
  const [openingCoverRect, setOpeningCoverRect] = useState<DOMRect | undefined>();

  const openBook = useCallback(
    async (
      book: BookRecord,
      coverRect?: DOMRect,
      onBookOpened?: (opened: BookRecord) => void
    ): Promise<BookRecord | undefined> => {
      preloadReaderPaneForFormat(book.format);
      if (coverRect && !preferences.reduceMotion && preferences.motion !== "reduced") {
        setOpeningCoverRect(coverRect);
      }
      const opened = await window.readerApi.openBook(book.id);
      if (opened) {
        setActiveBook(opened);
        onBookOpened?.(opened);
      }
      return opened ?? undefined;
    },
    [preferences.reduceMotion, preferences.motion]
  );

  return {
    activeBook,
    setActiveBook,
    openingCoverRect,
    setOpeningCoverRect,
    openBook
  };
}
