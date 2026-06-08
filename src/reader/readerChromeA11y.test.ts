import { describe, expect, it } from "vitest";
import { shouldRevealChromeOnFocus } from "./readerChromeA11y";

describe("reader chrome a11y helpers", () => {
  it("reveals hidden chrome when keyboard focus reaches the toolbar", () => {
    expect(shouldRevealChromeOnFocus(false, false)).toBe(true);
  });

  it("does not reschedule chrome when controls are already visible or pinned", () => {
    expect(shouldRevealChromeOnFocus(true, false)).toBe(false);
    expect(shouldRevealChromeOnFocus(false, true)).toBe(false);
  });
});
