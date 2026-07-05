import { useCallback, useRef, useState } from "react";
import type * as React from "react";
import type { ParsedTextDocument, ReaderPreferences } from "../types";
import type { ReaderMode } from "../types";
import { recordPageTurn } from "../stats/speedTracker";
import { resolveTurnDistance } from "./pageTurnDistance";

export function usePageTurn(
  scrollerRef: React.RefObject<HTMLDivElement | null>,
  preferences: ReaderPreferences,
  effectiveReaderMode: ReaderMode,
  scheduleScrollSettle: (delay: number) => void,
  suspendProgress: (until: number) => void,
  chapters: ParsedTextDocument["chapters"],
  activeChapterIndex: number
) {
  const [curlDir, setCurlDir] = useState<1 | -1 | null>(null);
  const lastPageTurnRef = useRef<number>(performance.now());

  const nudgePage = useCallback(
    (direction: 1 | -1) => {
      const scroller = scrollerRef.current;

      if (!scroller) {
        return;
      }

      const now = performance.now();
      const elapsed = now - lastPageTurnRef.current;
      lastPageTurnRef.current = now;
      const chapterCharCount = chapters[activeChapterIndex]?.plainText?.length ?? 0;
      recordPageTurn(chapterCharCount, elapsed);

      const isReduced = preferences.motion === "reduced" || preferences.reduceMotion;
      const pageTurnStyle = preferences.pageTurnStyle ?? "slide";
      const pageDistance = resolveTurnDistance({
        axis: effectiveReaderMode === "paged" ? "x" : "y",
        viewportWidth: scroller.clientWidth,
        viewportHeight: scroller.clientHeight,
        preference: preferences.pageTurnDistance
      });

      if (effectiveReaderMode === "paged" && !isReduced && pageTurnStyle === "curl") {
        setCurlDir(direction);
        const target = scroller.scrollLeft + direction * pageDistance;
        window.setTimeout(() => {
          scroller.scrollLeft = target;
        }, 180);
        suspendProgress(performance.now() + 650);
        scheduleScrollSettle(650);
        return;
      }

      if (effectiveReaderMode === "paged" && !isReduced && pageTurnStyle === "fade") {
        scroller.classList.add("page-turn-fade-out");
        const target = scroller.scrollLeft + direction * pageDistance;
        window.setTimeout(() => {
          scroller.scrollLeft = target;
          scroller.classList.remove("page-turn-fade-out");
          scroller.classList.add("page-turn-fade-in");
          window.setTimeout(() => scroller.classList.remove("page-turn-fade-in"), 200);
        }, 130);
        suspendProgress(performance.now() + 400);
        scheduleScrollSettle(400);
        return;
      }

      const behavior: ScrollBehavior =
        isReduced || pageTurnStyle === "none" ? "auto" : "smooth";
      suspendProgress(performance.now() + (behavior === "smooth" ? 480 : 120));

      if (effectiveReaderMode === "paged") {
        scroller.scrollBy({ left: direction * pageDistance, behavior });
      } else {
        scroller.scrollBy({ top: direction * pageDistance, behavior });
      }

      scheduleScrollSettle(behavior === "smooth" ? 420 : 0);
    },
    [
      activeChapterIndex,
      chapters,
      effectiveReaderMode,
      preferences.motion,
      preferences.pageTurnDistance,
      preferences.pageTurnStyle,
      preferences.reduceMotion,
      scheduleScrollSettle,
      scrollerRef,
      suspendProgress
    ]
  );

  return { curlDir, setCurlDir, nudgePage };
}
