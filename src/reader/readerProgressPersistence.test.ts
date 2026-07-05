import { describe, expect, it } from "vitest";
import { shouldPersistProgress, shouldUpdateProgressState } from "./readerProgressPersistence";
import type { ReaderProgress } from "../types";

const progress = (percent: number, current = 1, total = 10): ReaderProgress => ({
  kind: "text",
  current,
  total,
  percent,
  updatedAt: "2026-06-08T00:00:00.000Z"
});

describe("reader progress persistence", () => {
  it("skips tiny percent-only changes to avoid noisy renders", () => {
    expect(shouldUpdateProgressState(progress(0.5), progress(0.501))).toBe(false);
  });

  it("updates when page/chapter position changes even within the percent threshold", () => {
    expect(shouldUpdateProgressState(progress(0.5, 1), progress(0.501, 2))).toBe(true);
  });

  it("updates when the stable anchor changes even if percent is unchanged", () => {
    const currentPage: ReaderProgress = {
      ...progress(0.5, 100, 1000),
      kind: "page",
      pageIndex: 4,
      pageOffset: 12
    };
    expect(shouldUpdateProgressState(currentPage, { ...currentPage, pageIndex: 5 })).toBe(true);

    const currentChapter: ReaderProgress = {
      ...progress(0.5, 100, 1000),
      kind: "epub",
      chapterId: "a",
      chapterOffset: 20
    };
    expect(shouldUpdateProgressState(currentChapter, { ...currentChapter, chapterId: "b" })).toBe(true);
  });

  it("persists only meaningful percent movement", () => {
    expect(shouldPersistProgress(0.5, progress(0.501))).toBe(false);
    expect(shouldPersistProgress(0.5, progress(0.503))).toBe(true);
  });
});
