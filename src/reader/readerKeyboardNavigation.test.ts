import { describe, expect, it } from "vitest";
import { readerKeyboardScrollDirection } from "./readerKeyboardNavigation";

describe("readerKeyboardScrollDirection", () => {
  it("keeps vertical keys independent from reading direction", () => {
    expect(readerKeyboardScrollDirection("ArrowDown", "rtl")).toBe(1);
    expect(readerKeyboardScrollDirection("ArrowUp", "rtl")).toBe(-1);
  });

  it("uses visual left-to-right arrow semantics in ltr mode", () => {
    expect(readerKeyboardScrollDirection("ArrowRight", "ltr")).toBe(1);
    expect(readerKeyboardScrollDirection("ArrowLeft", "ltr")).toBe(-1);
  });

  it("mirrors horizontal arrow navigation in rtl mode", () => {
    expect(readerKeyboardScrollDirection("ArrowRight", "rtl")).toBe(-1);
    expect(readerKeyboardScrollDirection("ArrowLeft", "rtl")).toBe(1);
  });

  it("ignores non-navigation keys", () => {
    expect(readerKeyboardScrollDirection("Enter", "ltr")).toBeUndefined();
  });
});
