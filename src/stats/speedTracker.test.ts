import { afterEach, describe, expect, it } from "vitest";
import { getSessionAvgCpm, recordPageTurn, resetSession } from "./speedTracker";

afterEach(() => {
  resetSession();
});

describe("speedTracker", () => {
  it("returns 0 with no samples", () => {
    expect(getSessionAvgCpm()).toBe(0);
  });

  it("computes chars-per-minute from a recorded turn", () => {
    // 1000 chars in 60s → 1000 cpm
    recordPageTurn(1000, 60000);
    expect(getSessionAvgCpm()).toBe(1000);
  });

  it("averages across multiple samples by totals", () => {
    recordPageTurn(500, 60000); // 500 cpm
    recordPageTurn(1500, 60000); // 1500 cpm
    // total 2000 chars / 120000 ms * 60000 = 1000
    expect(getSessionAvgCpm()).toBe(1000);
  });

  it("ignores turns faster than 3s (likely skimming)", () => {
    recordPageTurn(1000, 2999);
    expect(getSessionAvgCpm()).toBe(0);
  });

  it("ignores turns longer than 10min (likely idle)", () => {
    recordPageTurn(1000, 600001);
    expect(getSessionAvgCpm()).toBe(0);
  });

  it("ignores trivially short chapters", () => {
    recordPageTurn(9, 60000);
    expect(getSessionAvgCpm()).toBe(0);
  });

  it("keeps only the most recent 10 samples", () => {
    // 10 slow samples then one fast one; oldest should be evicted
    for (let i = 0; i < 10; i += 1) {
      recordPageTurn(600, 60000); // 600 cpm each
    }
    recordPageTurn(6000, 60000); // pushes out one 600-sample
    // remaining: nine 600-char + one 6000-char over 10 minutes
    // (9*600 + 6000) / 600000 * 60000 = 11400/10 = 1140
    expect(getSessionAvgCpm()).toBe(1140);
  });

  it("resets accumulated samples", () => {
    recordPageTurn(1000, 60000);
    resetSession();
    expect(getSessionAvgCpm()).toBe(0);
  });
});
