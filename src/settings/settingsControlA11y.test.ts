import { describe, expect, it } from "vitest";
import { toggleSettingAriaLabel } from "./settingsControlA11y";

describe("settings control a11y helpers", () => {
  it("announces enabled and disabled toggle state with its label", () => {
    expect(toggleSettingAriaLabel("阅读焦点", true)).toBe("阅读焦点：已开启");
    expect(toggleSettingAriaLabel("阅读焦点", false)).toBe("阅读焦点：已关闭");
  });

  it("uses a fallback label when toggle text is empty", () => {
    expect(toggleSettingAriaLabel("  ", false)).toBe("开关：已关闭");
  });
});
