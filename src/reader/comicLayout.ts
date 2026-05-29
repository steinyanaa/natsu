import type { ComicLayout } from "../types";

/**
 * Groups page indices into spreads for the comic reader.
 *
 * - Non-`double` layouts (single / webtoon / height-fit) render one page per
 *   spread.
 * - `double` layout pairs pages two-up. When `coverSolo` is set the first page
 *   stands alone (a typical cover), and the remaining pages pair from index 1;
 *   a trailing odd page is shown solo.
 */
export function computeSpreads(
  pageCount: number,
  layout: ComicLayout,
  coverSolo: boolean
): number[][] {
  if (pageCount <= 0) return [];
  if (layout !== "double") {
    return Array.from({ length: pageCount }, (_, i) => [i]);
  }

  const result: number[][] = [];
  let i = 0;
  if (coverSolo) {
    result.push([0]);
    i = 1;
  }
  while (i < pageCount) {
    if (i + 1 < pageCount) {
      result.push([i, i + 1]);
      i += 2;
    } else {
      result.push([i]);
      i += 1;
    }
  }
  return result;
}
