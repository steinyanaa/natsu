import { describe, expect, it } from "vitest";
import { estimateChapterHeight } from "./chapterHeight";
import type { ReaderPreferences, TextChapter } from "../types";

const basePrefs = {
  columnWidth: 760,
  fontSize: 18,
  lineHeight: 1.8
} as ReaderPreferences;

function chapter(patch: Partial<TextChapter>): TextChapter {
  return { id: "c1", title: "C1", html: "", plainText: "", ...patch };
}

describe("estimateChapterHeight", () => {
  it("sizes fixed-layout chapters from their viewport ratio", () => {
    const height = estimateChapterHeight({
      chapter: chapter({ layout: "fixed", viewport: { width: 760, height: 1140 } }),
      preferences: basePrefs,
      viewportHeight: 900
    });
    // ratio 1.5 * min(760,760)=1140, clamped to min(max(420, 900-160)=740, 1140) → 740
    expect(height).toBe(740);
  });

  it("never returns less than the 360px floor for fixed chapters", () => {
    const height = estimateChapterHeight({
      chapter: chapter({ layout: "fixed", viewport: { width: 1000, height: 100 } }),
      preferences: basePrefs,
      viewportHeight: 900
    });
    expect(height).toBeGreaterThanOrEqual(360);
  });

  it("grows with text length for reflow chapters", () => {
    const short = estimateChapterHeight({
      chapter: chapter({ plainText: "a".repeat(200) }),
      preferences: basePrefs,
      viewportHeight: 900
    });
    const long = estimateChapterHeight({
      chapter: chapter({ plainText: "a".repeat(20000) }),
      preferences: basePrefs,
      viewportHeight: 900
    });
    expect(long).toBeGreaterThan(short);
  });

  it("enforces the viewport-relative floor for tiny chapters", () => {
    const height = estimateChapterHeight({
      chapter: chapter({ plainText: "hi" }),
      preferences: basePrefs,
      viewportHeight: 1000
    });
    // floor is viewportHeight * 0.62 = 620
    expect(height).toBe(620);
  });

  it("caps extremely long chapters at 12000px", () => {
    const height = estimateChapterHeight({
      chapter: chapter({ plainText: "a".repeat(5_000_000) }),
      preferences: basePrefs,
      viewportHeight: 900
    });
    expect(height).toBe(12000);
  });

  it("counts HTML markup when plainText is empty", () => {
    const withImages = estimateChapterHeight({
      chapter: chapter({ html: "<p>x</p><img><img><img>" }),
      preferences: basePrefs,
      viewportHeight: 900
    });
    const plain = estimateChapterHeight({
      chapter: chapter({ html: "<p>x</p>" }),
      preferences: basePrefs,
      viewportHeight: 900
    });
    expect(withImages).toBeGreaterThan(plain);
  });
});
