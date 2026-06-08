import { describe, expect, it } from "vitest";
import { activeSearchResultId, searchResultCountLabel, searchResultOptionId } from "./searchPanelA11y";

describe("search panel a11y helpers", () => {
  it("announces result counts only when there are results", () => {
    expect(searchResultCountLabel(0)).toBe("");
    expect(searchResultCountLabel(12)).toBe("12 个结果");
  });

  it("creates stable option ids for result rows", () => {
    expect(searchResultOptionId(2)).toBe("search-result-2");
    expect(searchResultOptionId(-1)).toBe("search-result-0");
  });

  it("points the input at the active result only when results exist", () => {
    expect(activeSearchResultId(0, 0)).toBeUndefined();
    expect(activeSearchResultId(5, 3)).toBe("search-result-3");
    expect(activeSearchResultId(5, 8)).toBe("search-result-4");
  });
});
