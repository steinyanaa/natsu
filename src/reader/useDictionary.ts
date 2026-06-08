import { useEffect, useState } from "react";
import type * as React from "react";
import { clampSelectionMenuPosition, readerContainsSelectionNode } from "./selectionMenuState";

export function useDictionary(
  scrollerRef: React.RefObject<HTMLDivElement | null>,
  _highlights: unknown[],
  dictionaryEnabled: boolean
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
        if (!readerContainsSelectionNode(scrollerRef.current, range.commonAncestorContainer)) {
          setSelectionMenu(undefined);
          setSelectionText("");
          return;
        }

        const chapterEl = range.commonAncestorContainer instanceof HTMLElement
          ? range.commonAncestorContainer.closest<HTMLElement>(".text-chapter")
          : range.commonAncestorContainer.parentElement?.closest<HTMLElement>(".text-chapter");
        if (!chapterEl) {
          setSelectionMenu(undefined);
          setSelectionText("");
          return;
        }
        const rect = range.getBoundingClientRect();
        const position = clampSelectionMenuPosition(rect, { width: window.innerWidth });
        setSelectionText(sel.toString().trim());
        setSelectionMenu({
          x: position.x,
          y: position.y,
          chapterId: chapterEl.id,
        });
      });
    };
    window.document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      window.document.removeEventListener("selectionchange", handleSelectionChange);
      if (rafId !== undefined) window.cancelAnimationFrame(rafId);
    };
  }, [scrollerRef]);

  useEffect(() => {
    if (!dictionaryEnabled) {
      setDictWord(undefined);
    }
  }, [dictionaryEnabled]);

  return { selectionMenu, setSelectionMenu, selectionText, setSelectionText, dictWord, setDictWord };
}
