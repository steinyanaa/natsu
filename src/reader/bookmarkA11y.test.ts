import { describe, expect, it } from "vitest";
import { bookmarkSelectionLabel, selectedBookmarksSummary } from "./bookmarkA11y";

describe("bookmark a11y helpers", () => {
  it("describes selecting and clearing an individual bookmark", () => {
    expect(bookmarkSelectionLabel("第一章", false)).toBe("选择书签：第一章");
    expect(bookmarkSelectionLabel("第一章", true)).toBe("取消选择书签：第一章");
  });

  it("summarizes the selected bookmark count", () => {
    expect(selectedBookmarksSummary(0)).toBe("");
    expect(selectedBookmarksSummary(3)).toBe("已选择 3 项");
  });
});
