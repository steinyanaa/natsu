/**
 * Pure windowing logic for the comic reader's lazy page pipeline.
 *
 * The reader never holds the whole archive in memory: it extracts only the
 * pages near the viewport and releases (revokes) the ones that drift far away.
 * This function decides, for a given scroll position, which page indices should
 * be extracted next and which should be released — keeping the heavy
 * decode/blob work proportional to the viewport rather than the book length.
 */
export interface ComicWindowParams {
  /** Page-index groups per spread (1 page for single/webtoon, up to 2 for double). */
  spreads: number[][];
  /** Index of the spread currently under the viewport anchor. */
  currentSpread: number;
  /** First spread inside the render window. */
  visibleStart: number;
  /** Last spread inside the render window. */
  visibleEnd: number;
  /** How many spreads ahead/behind the current spread to prefetch. */
  preloadWindow: number;
  /** Keep extracted pages within this page-distance of the current page. */
  retainPages: number;
  /** Page indices currently extracted (have a live blob URL). */
  extracted: Iterable<number>;
}

export interface ComicWindowPlan {
  /** Page indices to extract, ordered by priority (visible first, then nearest). */
  extract: number[];
  /** Page indices to release/revoke. */
  release: number[];
}

export function planComicWindow(params: ComicWindowParams): ComicWindowPlan {
  const { spreads, currentSpread, visibleStart, visibleEnd, preloadWindow, retainPages } = params;
  const spreadCount = spreads.length;
  if (spreadCount === 0) {
    return { extract: [], release: [] };
  }

  const clampSpread = (index: number) => Math.max(0, Math.min(spreadCount - 1, index));
  const currentPage = spreads[clampSpread(currentSpread)]?.[0] ?? 0;

  // "Wanted" = pages in the visible render window plus the prefetch ring.
  // Priority order: visible pages first, then expanding ring around the current
  // spread, so the page the user is about to see is decoded soonest.
  const wanted = new Set<number>();
  const ordered: number[] = [];
  const want = (index: number) => {
    if (index < 0 || index >= spreadCount) return;
    for (const page of spreads[index] ?? []) {
      if (!wanted.has(page)) {
        wanted.add(page);
        ordered.push(page);
      }
    }
  };

  const vStart = clampSpread(visibleStart);
  const vEnd = clampSpread(visibleEnd);
  for (let s = vStart; s <= vEnd; s += 1) want(s);

  const center = clampSpread(currentSpread);
  for (let distance = 1; distance <= preloadWindow; distance += 1) {
    want(center + distance);
    want(center - distance);
  }

  const extractedSet = new Set<number>(params.extracted);

  const extract = ordered.filter((page) => !extractedSet.has(page));

  const release: number[] = [];
  for (const page of extractedSet) {
    if (wanted.has(page)) continue;
    if (Math.abs(page - currentPage) > retainPages) {
      release.push(page);
    }
  }
  release.sort((a, b) => a - b);

  return { extract, release };
}
