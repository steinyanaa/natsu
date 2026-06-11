import { describe, expect, it } from "vitest";
import { planComicWindow } from "./comicLoadWindow";

const singleSpreads = (n: number) => Array.from({ length: n }, (_, i) => [i]);

describe("planComicWindow", () => {
  it("extracts the visible pages first, nothing yet extracted", () => {
    const plan = planComicWindow({
      spreads: singleSpreads(20),
      currentSpread: 0,
      visibleStart: 0,
      visibleEnd: 2,
      preloadWindow: 0,
      retainPages: 10,
      extracted: []
    });
    expect(plan.extract).toEqual([0, 1, 2]);
    expect(plan.release).toEqual([]);
  });

  it("does not re-extract pages already in hand", () => {
    const plan = planComicWindow({
      spreads: singleSpreads(20),
      currentSpread: 0,
      visibleStart: 0,
      visibleEnd: 2,
      preloadWindow: 0,
      retainPages: 10,
      extracted: [0, 1]
    });
    expect(plan.extract).toEqual([2]);
  });

  it("prefetches ahead and behind the current spread", () => {
    const plan = planComicWindow({
      spreads: singleSpreads(20),
      currentSpread: 5,
      visibleStart: 5,
      visibleEnd: 5,
      preloadWindow: 2,
      retainPages: 10,
      extracted: []
    });
    // visible 5, then ±1, ±2 around it
    expect(plan.extract).toEqual(expect.arrayContaining([3, 4, 5, 6, 7]));
    expect(plan.extract).not.toContain(2);
    expect(plan.extract).not.toContain(8);
  });

  it("releases pages beyond the retain distance that are not wanted", () => {
    const plan = planComicWindow({
      spreads: singleSpreads(40),
      currentSpread: 20,
      visibleStart: 20,
      visibleEnd: 20,
      preloadWindow: 1,
      retainPages: 3,
      extracted: [0, 1, 19, 20, 21, 39]
    });
    // current page 20; retain within 3 → keep 19,20,21; release far ones
    expect(plan.release).toEqual(expect.arrayContaining([0, 1, 39]));
    expect(plan.release).not.toContain(19);
    expect(plan.release).not.toContain(20);
    expect(plan.release).not.toContain(21);
  });

  it("never releases a page that is currently wanted even if far in page-distance", () => {
    // double layout: a wanted spread can contain a page numerically far from current
    const plan = planComicWindow({
      spreads: [[0], [1, 2], [3, 4]],
      currentSpread: 0,
      visibleStart: 0,
      visibleEnd: 2,
      preloadWindow: 0,
      retainPages: 0,
      extracted: [0, 1, 2, 3, 4]
    });
    expect(plan.release).toEqual([]);
  });

  it("clamps windows to the available spreads", () => {
    const plan = planComicWindow({
      spreads: singleSpreads(3),
      currentSpread: 2,
      visibleStart: 1,
      visibleEnd: 5,
      preloadWindow: 4,
      retainPages: 10,
      extracted: []
    });
    expect(plan.extract).toEqual(expect.arrayContaining([0, 1, 2]));
    expect(plan.extract.every((i) => i >= 0 && i < 3)).toBe(true);
  });
});
