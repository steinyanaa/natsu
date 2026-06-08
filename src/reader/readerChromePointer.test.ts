import { describe, expect, it } from "vitest";
import { shouldRevealChromeFromPointer } from "./readerChromePointer";

describe("shouldRevealChromeFromPointer", () => {
  it("reveals only inside the top activation zone", () => {
    expect(shouldRevealChromeFromPointer(80, 0, 240)).toBe(true);
    expect(shouldRevealChromeFromPointer(140, 0, 240)).toBe(false);
  });

  it("throttles repeated pointer moves", () => {
    expect(shouldRevealChromeFromPointer(80, 1000, 1100)).toBe(false);
    expect(shouldRevealChromeFromPointer(80, 1000, 1210)).toBe(true);
  });
});
