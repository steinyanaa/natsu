import { describe, expect, it } from "vitest";
import { formatChapterEta } from "./chapterEta";

describe("formatChapterEta", () => {
  it("returns empty text when there is no readable chapter length", () => {
    expect(formatChapterEta(0, 0.5)).toBe("");
    expect(formatChapterEta(-1, 0.5)).toBe("");
  });

  it("shows sub-minute remaining time gently", () => {
    expect(formatChapterEta(100, 0.9, 300)).toBe("< 1 分钟");
  });

  it("returns empty text when the chapter is already complete", () => {
    expect(formatChapterEta(100, 1, 300)).toBe("");
  });

  it("rounds remaining minutes up", () => {
    expect(formatChapterEta(1200, 0.25, 300)).toBe("本章剩余 3 分钟");
  });
});
