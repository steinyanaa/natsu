import { useEffect, useState } from "react";
import type * as React from "react";

export function useDictionary(
  scrollerRef: React.RefObject<HTMLDivElement | null>,
  _highlights: unknown[],
  _dictionaryEnabled: boolean
) {
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; chapterId: string } | undefined>();
  const [selectionText, setSelectionText] = useState("");
  const [dictWord, setDictWord] = useState<{ word: string; x: number; y: number } | undefined>();

  // Listen for selection changes (rAF-throttled to avoid high-frequency re-renders)
  useEffect(() => {
    let rafId: number | undefined;
    const handleSelectionChange = () => {
      if (rafId !== undefined) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = undefined;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSelectionMenu(undefined);
          setSelectionText("");
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
        setSelectionText(sel.toString());
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

  // scrollerRef is accepted as a parameter for future use (e.g. scoped selection detection)
  void scrollerRef;

  return { selectionMenu, setSelectionMenu, selectionText, setSelectionText, dictWord, setDictWord };
}
