export type SearchPanelKeyAction =
  | { type: "close"; preventDefault: true }
  | { type: "jump"; nextIndex: number; preventDefault: true }
  | { type: "move"; nextIndex: number; preventDefault: true };

function clampSearchIndex(index: number, resultCount: number): number {
  if (resultCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(0, index), resultCount - 1);
}

export function resolveSearchPanelKey(
  key: string,
  resultCount: number,
  activeIndex: number
): SearchPanelKeyAction | undefined {
  if (key === "Escape") {
    return { type: "close", preventDefault: true };
  }

  if (key === "Enter") {
    return resultCount > 0
      ? { type: "jump", nextIndex: clampSearchIndex(activeIndex, resultCount), preventDefault: true }
      : undefined;
  }

  if (key === "ArrowDown") {
    return {
      type: "move",
      nextIndex: clampSearchIndex(activeIndex + 1, resultCount),
      preventDefault: true
    };
  }

  if (key === "ArrowUp") {
    return {
      type: "move",
      nextIndex: clampSearchIndex(activeIndex - 1, resultCount),
      preventDefault: true
    };
  }

  return undefined;
}
