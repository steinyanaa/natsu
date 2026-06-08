import { useEffect, useRef, type RefObject } from "react";
import { pickFocusedBlock, type FocusBlockCandidate } from "./focusBlock";

const focusBlockSelector =
  ".text-chapter[data-rendered='true']:not(.epub-fixed-chapter):not(.epub-vertical-chapter) :is(p, li, blockquote)";

export function useReadingFocus({
  scrollerRef,
  enabled,
  activeChapterIndex,
  chaptersLength,
  readerMode
}: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  activeChapterIndex: number;
  chaptersLength: number;
  readerMode: string;
}) {
  const focusIdCounterRef = useRef(0);
  const focusedBlockIdRef = useRef<string | undefined>(undefined);
  const candidateNodesRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const clearFocusAttributes = () => {
      for (const node of scroller.querySelectorAll<HTMLElement>("[data-reading-focus-block]")) {
        node.removeAttribute("data-reading-focus-block");
        node.removeAttribute("data-reading-focus-current");
      }
      candidateNodesRef.current = [];
      focusedBlockIdRef.current = undefined;
    };

    if (!enabled) {
      clearFocusAttributes();
      return;
    }

    let raf = 0;

    const refreshCandidates = () => {
      candidateNodesRef.current = [...scroller.querySelectorAll<HTMLElement>(focusBlockSelector)];
    };

    const updateFocusedBlock = () => {
      raf = 0;
      const scrollerRect = scroller.getBoundingClientRect();
      const candidates: FocusBlockCandidate[] = [];

      for (const node of candidateNodesRef.current) {
        if (!node.isConnected) {
          continue;
        }

        const rect = node.getBoundingClientRect();
        const horizontallyVisible = rect.right > scrollerRect.left && rect.left < scrollerRect.right;
        const verticallyVisible = rect.bottom > scrollerRect.top && rect.top < scrollerRect.bottom;
        if (!horizontallyVisible || !verticallyVisible || rect.height < 12) {
          continue;
        }

        if (!node.dataset.readingFocusBlock) {
          focusIdCounterRef.current += 1;
          node.dataset.readingFocusBlock = `focus-${focusIdCounterRef.current}`;
        }

        candidates.push({
          id: node.dataset.readingFocusBlock,
          top: rect.top - scrollerRect.top,
          bottom: rect.bottom - scrollerRect.top
        });
      }

      const nextFocusedId = pickFocusedBlock(candidates, { top: 0, height: scrollerRect.height });
      if (nextFocusedId === focusedBlockIdRef.current) {
        return;
      }

      if (focusedBlockIdRef.current) {
        const current = scroller.querySelector<HTMLElement>(
          `[data-reading-focus-block="${CSS.escape(focusedBlockIdRef.current)}"]`
        );
        current?.removeAttribute("data-reading-focus-current");
      }

      focusedBlockIdRef.current = nextFocusedId;

      if (nextFocusedId) {
        const next = scroller.querySelector<HTMLElement>(
          `[data-reading-focus-block="${CSS.escape(nextFocusedId)}"]`
        );
        next?.setAttribute("data-reading-focus-current", "true");
      }
    };

    const scheduleFocusedBlockUpdate = () => {
      if (raf) {
        return;
      }
      raf = window.requestAnimationFrame(updateFocusedBlock);
    };

    const observer = new MutationObserver(() => {
      refreshCandidates();
      scheduleFocusedBlockUpdate();
    });

    refreshCandidates();
    scheduleFocusedBlockUpdate();
    observer.observe(scroller, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-rendered"]
    });
    scroller.addEventListener("scroll", scheduleFocusedBlockUpdate, { passive: true });
    window.addEventListener("resize", scheduleFocusedBlockUpdate);

    return () => {
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
      observer.disconnect();
      scroller.removeEventListener("scroll", scheduleFocusedBlockUpdate);
      window.removeEventListener("resize", scheduleFocusedBlockUpdate);
      clearFocusAttributes();
    };
  }, [activeChapterIndex, chaptersLength, enabled, readerMode, scrollerRef]);
}
