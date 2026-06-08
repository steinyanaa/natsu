import { describe, expect, it } from "vitest";
import { segmentedControlLabel, segmentedOptionA11y } from "./segmentedControlA11y";

describe("segmented control a11y helpers", () => {
  it("marks the selected option as the checked radio and active tab stop", () => {
    expect(segmentedOptionA11y("paged", "paged", 1, 1)).toEqual({
      ariaChecked: true,
      tabIndex: 0
    });
  });

  it("keeps non-selected options out of the tab sequence", () => {
    expect(segmentedOptionA11y("scroll", "paged", 0, 1)).toEqual({
      ariaChecked: false,
      tabIndex: -1
    });
  });

  it("falls back to a stable group label", () => {
    expect(segmentedControlLabel()).toBe("选项");
    expect(segmentedControlLabel("阅读模式")).toBe("阅读模式");
  });
});
