/**
 * Offset model for paged virtual scrollers (comic / PDF).
 *
 * Instead of assuming every spread is the same height (which makes the
 * scrollbar jump as real pages load and forces O(n) `getBoundingClientRect`
 * reads to find the visible range), we track each spread's height and derive
 * cumulative offsets. Visible range and scroll anchor then come from a binary
 * search over those offsets — O(log n) and exact.
 */

/** Prefix sums of spread heights; length is `heights.length + 1`, leading 0. */
export function cumulativeOffsets(heights: number[]): number[] {
  const offsets = new Array<number>(heights.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < heights.length; i += 1) {
    offsets[i + 1] = offsets[i] + Math.max(0, heights[i] ?? 0);
  }
  return offsets;
}

/** Largest index `s` with `offsets[s] <= value`, clamped to `[0, n-1]`. */
function lowerSpread(offsets: number[], value: number): number {
  const n = offsets.length - 1;
  if (n <= 0) return 0;
  let lo = 0;
  let hi = n - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= value) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/**
 * Inclusive `[start, end]` spread range intersecting `[top, bottom]`, grown by
 * `overscan` spreads on each side and clamped. Returns `[0, -1]` (empty) when
 * there are no spreads.
 */
export function findSpreadRange(
  offsets: number[],
  top: number,
  bottom: number,
  overscan: number
): [number, number] {
  const n = offsets.length - 1;
  if (n <= 0) return [0, -1];

  // First spread whose end (offsets[s+1]) is past `top`.
  let start = 0;
  while (start < n - 1 && offsets[start + 1] <= top) start += 1;

  // Last spread whose start (offsets[s]) is before `bottom`.
  let end = lowerSpread(offsets, bottom);
  if (offsets[end] >= bottom && end > 0) end -= 1;

  start = Math.max(0, start - overscan);
  end = Math.min(n - 1, end + overscan);
  if (end < start) end = start;
  return [start, end];
}

/** Index of the spread containing `scrollTop`, clamped to `[0, n-1]`. */
export function anchorSpread(offsets: number[], scrollTop: number): number {
  return lowerSpread(offsets, scrollTop);
}
