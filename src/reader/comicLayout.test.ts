import { describe, expect, it } from "vitest";
import { computeSpreads } from "./comicLayout";

describe("computeSpreads", () => {
  it("returns no spreads for an empty book", () => {
    expect(computeSpreads(0, "single", true)).toEqual([]);
    expect(computeSpreads(0, "double", true)).toEqual([]);
  });

  it("renders one page per spread for single layout", () => {
    expect(computeSpreads(3, "single", true)).toEqual([[0], [1], [2]]);
  });

  it("renders one page per spread for webtoon layout (coverSolo ignored)", () => {
    expect(computeSpreads(3, "webtoon", false)).toEqual([[0], [1], [2]]);
  });

  it("pairs pages two-up with a solo cover", () => {
    expect(computeSpreads(5, "double", true)).toEqual([[0], [1, 2], [3, 4]]);
  });

  it("shows a trailing odd page solo with a solo cover", () => {
    expect(computeSpreads(4, "double", true)).toEqual([[0], [1, 2], [3]]);
  });

  it("pairs from the first page when coverSolo is off", () => {
    expect(computeSpreads(4, "double", false)).toEqual([[0, 1], [2, 3]]);
  });

  it("shows a trailing odd page solo when coverSolo is off", () => {
    expect(computeSpreads(5, "double", false)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it("handles a single-page double-layout book", () => {
    expect(computeSpreads(1, "double", true)).toEqual([[0]]);
    expect(computeSpreads(1, "double", false)).toEqual([[0]]);
  });
});
