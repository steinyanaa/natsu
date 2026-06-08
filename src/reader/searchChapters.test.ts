import { describe, expect, it } from "vitest";
import { searchChapters } from "./searchChapters";

describe("searchChapters", () => {
  const chapters = [
    { id: "c1", title: "第一章", plainText: "Hello 夏天，hello reader。Hello again." },
    { id: "c2", title: "", plainText: "Ｆｏｏ and foo and FOO." }
  ];

  it("finds normalized case-insensitive matches with snippets", () => {
    const [result] = searchChapters(chapters, "HELLO", { contextChars: 6 });

    expect(result).toMatchObject({
      chapterId: "c1",
      chapterTitle: "第一章",
      chapterIndex: 0,
      matchOffset: 0,
      matchLength: 5
    });
    expect(result.snippet).toContain("Hello");
  });

  it("normalizes full-width text and falls back to numbered chapter titles", () => {
    const [result] = searchChapters(chapters, "foo", { contextChars: 4 });

    expect(result.chapterId).toBe("c2");
    expect(result.chapterTitle).toBe("第 2 章");
  });

  it("caps matches per chapter and returns nothing for blank queries", () => {
    expect(searchChapters(chapters, "hello", { maxPerChapter: 2 })).toHaveLength(2);
    expect(searchChapters(chapters, "   ")).toEqual([]);
  });
});
