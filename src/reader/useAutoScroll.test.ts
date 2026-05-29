import { describe, expect, it } from "vitest";
import { advanceScroll } from "./useAutoScroll";

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
