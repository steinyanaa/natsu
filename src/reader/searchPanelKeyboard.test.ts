import { describe, expect, it } from "vitest";
import { resolveSearchPanelKey } from "./searchPanelKeyboard";

describe("resolveSearchPanelKey", () => {
  it("keeps the active search result index clamped while moving", () => {
    expect(resolveSearchPanelKey("ArrowDown", 0, 0)).toEqual({
      type: "move",
      nextIndex: 0,
      preventDefault: true
    });
    expect(resolveSearchPanelKey("ArrowDown", 3, 2)).toMatchObject({ nextIndex: 2 });
    expect(resolveSearchPanelKey("ArrowUp", 3, 0)).toMatchObject({ nextIndex: 0 });
  });

  it("jumps only when enter has an active result", () => {
    expect(resolveSearchPanelKey("Enter", 2, 1)).toEqual({
      type: "jump",
      nextIndex: 1,
      preventDefault: true
    });
    expect(resolveSearchPanelKey("Enter", 0, 0)).toBeUndefined();
  });

  it("closes on escape and ignores ordinary typing", () => {
    expect(resolveSearchPanelKey("Escape", 0, 0)).toEqual({
      type: "close",
      preventDefault: true
    });
    expect(resolveSearchPanelKey("a", 2, 0)).toBeUndefined();
  });
});
