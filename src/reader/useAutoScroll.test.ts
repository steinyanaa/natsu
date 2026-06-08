import { describe, expect, it } from "vitest";
import { advanceScroll, applyAutoScrollStep, resolveAutoScrollAxis } from "./useAutoScroll";

describe("advanceScroll", () => {
  it("advances whole pixels for a large enough frame", () => {
    expect(advanceScroll(0, 60, 0.5)).toEqual({ whole: 30, remainder: 0 });
  });
  it("accumulates sub-pixel motion across frames", () => {
    const first = advanceScroll(0, 10, 0.05);
    expect(first.whole).toBe(0);
    expect(first.remainder).toBeCloseTo(0.5, 5);
    const second = advanceScroll(first.remainder, 10, 0.05);
    expect(second.whole).toBe(1);
    expect(second.remainder).toBeCloseTo(0, 5);
  });
  it("keeps the fractional remainder", () => {
    const result = advanceScroll(0.9, 30, 0.05);
    expect(result.whole).toBe(2);
    expect(result.remainder).toBeCloseTo(0.4, 5);
  });
});

describe("resolveAutoScrollAxis", () => {
  it("uses horizontal scrolling for paged text readers", () => {
    const scroller = {
      classList: {
        contains: (name: string) => name === "text-reader" || name === "paged"
      }
    } as unknown as HTMLElement;

    expect(resolveAutoScrollAxis(scroller)).toBe("x");
  });

  it("uses vertical scrolling for ordinary scrollers", () => {
    const scroller = {
      classList: {
        contains: () => false
      }
    } as unknown as HTMLElement;

    expect(resolveAutoScrollAxis(scroller)).toBe("y");
  });
});

describe("applyAutoScrollStep", () => {
  it("advances scrollLeft in horizontal mode", () => {
    const scroller = { scrollLeft: 10, scrollTop: 20 };

    expect(applyAutoScrollStep(scroller, 6, "x")).toBe(true);
    expect(scroller.scrollLeft).toBe(16);
    expect(scroller.scrollTop).toBe(20);
  });

  it("advances scrollTop in vertical mode", () => {
    const scroller = { scrollLeft: 10, scrollTop: 20 };

    expect(applyAutoScrollStep(scroller, 6, "y")).toBe(true);
    expect(scroller.scrollLeft).toBe(10);
    expect(scroller.scrollTop).toBe(26);
  });

  it("reports no movement when the browser clamps at the edge", () => {
    const scroller = {
      get scrollLeft() { return 10; },
      set scrollLeft(_value: number) { /* edge clamp */ },
      scrollTop: 0
    };

    expect(applyAutoScrollStep(scroller, 6, "x")).toBe(false);
  });
});
