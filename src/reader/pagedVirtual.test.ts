import { describe, expect, it } from "vitest";
import { anchorSpread, cumulativeOffsets, findSpreadRange } from "./pagedVirtual";

describe("cumulativeOffsets", () => {
  it("builds prefix sums with a leading zero", () => {
    expect(cumulativeOffsets([100, 200, 50])).toEqual([0, 100, 300, 350]);
  });
  it("handles an empty list", () => {
    expect(cumulativeOffsets([])).toEqual([0]);
  });
});

describe("findSpreadRange", () => {
  const offsets = cumulativeOffsets([100, 100, 100, 100, 100]); // [0,100,200,300,400,500]

  it("returns the spreads intersecting the viewport", () => {
    // viewport 150..250 covers spread 1 (100-200) and spread 2 (200-300)
    expect(findSpreadRange(offsets, 150, 250, 0)).toEqual([1, 2]);
  });

  it("includes overscan spreads on each side", () => {
    expect(findSpreadRange(offsets, 250, 250, 1)).toEqual([1, 3]);
  });

  it("clamps to the available spreads", () => {
    expect(findSpreadRange(offsets, -50, 50, 2)).toEqual([0, 2]);
    expect(findSpreadRange(offsets, 480, 9999, 2)).toEqual([2, 4]);
  });

  it("handles variable heights", () => {
    const variable = cumulativeOffsets([50, 400, 50, 300]); // [0,50,450,500,800]
    // viewport 60..120 sits entirely inside the tall spread 1
    expect(findSpreadRange(variable, 60, 120, 0)).toEqual([1, 1]);
  });

  it("returns empty range for no spreads", () => {
    expect(findSpreadRange([0], 0, 100, 0)).toEqual([0, -1]);
  });
});

describe("anchorSpread", () => {
  const offsets = cumulativeOffsets([100, 100, 100, 100]);

  it("finds the spread containing the scroll position", () => {
    expect(anchorSpread(offsets, 0)).toBe(0);
    expect(anchorSpread(offsets, 150)).toBe(1);
    expect(anchorSpread(offsets, 299)).toBe(2);
  });

  it("clamps past the end to the last spread", () => {
    expect(anchorSpread(offsets, 9999)).toBe(3);
  });

  it("clamps negatives to the first spread", () => {
    expect(anchorSpread(offsets, -10)).toBe(0);
  });
});
