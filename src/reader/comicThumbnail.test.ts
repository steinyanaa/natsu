import { describe, expect, it } from "vitest";
import { thumbDimensions } from "./comicThumbnail";

describe("thumbDimensions", () => {
  it("scales a tall page down to fit the box height", () => {
    // 800x1200 into 160x220 → height-bound: scale 220/1200
    expect(thumbDimensions(800, 1200, 160, 220)).toEqual({ width: 147, height: 220 });
  });

  it("scales a wide page down to fit the box width", () => {
    // 1600x900 into 160x220 → width-bound: scale 160/1600
    expect(thumbDimensions(1600, 900, 160, 220)).toEqual({ width: 160, height: 90 });
  });

  it("never upscales a small page", () => {
    expect(thumbDimensions(80, 120, 160, 220)).toEqual({ width: 80, height: 120 });
  });

  it("falls back to the box for degenerate sizes", () => {
    expect(thumbDimensions(0, 0, 160, 220)).toEqual({ width: 160, height: 220 });
  });
});
