import { describe, expect, it } from "vitest";
import { pickFocusedBlock } from "./focusBlock";

describe("pickFocusedBlock", () => {
  it("returns undefined when there are no focus candidates", () => {
    expect(pickFocusedBlock([], { top: 0, height: 800 })).toBeUndefined();
  });

  it("chooses the visible block closest to the viewport center", () => {
    const focused = pickFocusedBlock(
      [
        { id: "first", top: 80, bottom: 180 },
        { id: "center", top: 360, bottom: 460 },
        { id: "last", top: 680, bottom: 760 }
      ],
      { top: 0, height: 800 }
    );

    expect(focused).toBe("center");
  });

  it("does not choose a block when focus is disabled for fixed or manga layouts", () => {
    const blocks = [{ id: "p1", top: 100, bottom: 220 }];

    expect(pickFocusedBlock(blocks, { top: 0, height: 600 }, { enabled: false })).toBeUndefined();
  });

  it("ignores ineligible fixed-layout candidates", () => {
    expect(
      pickFocusedBlock([{ id: "fixed", top: 120, bottom: 220, eligible: false }], { top: 0, height: 500 })
    ).toBeUndefined();
  });
});
