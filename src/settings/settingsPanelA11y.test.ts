import { describe, expect, it } from "vitest";
import { settingsPanelDialogAttributes, shouldCloseSettingsPanelOnKey } from "./settingsPanelA11y";

describe("settingsPanelDialogAttributes", () => {
  it("exposes modal dialog semantics while open", () => {
    expect(settingsPanelDialogAttributes(true, "title-id")).toEqual({
      role: "dialog",
      "aria-modal": true,
      "aria-hidden": false,
      "aria-labelledby": "title-id"
    });
  });

  it("hides dialog semantics from assistive tech while closed", () => {
    expect(settingsPanelDialogAttributes(false, "title-id")).toEqual({
      role: "dialog",
      "aria-modal": false,
      "aria-hidden": true,
      "aria-labelledby": "title-id"
    });
  });
});

describe("shouldCloseSettingsPanelOnKey", () => {
  it("closes only on Escape while the panel is open", () => {
    expect(shouldCloseSettingsPanelOnKey("Escape", true)).toBe(true);
    expect(shouldCloseSettingsPanelOnKey("Enter", true)).toBe(false);
    expect(shouldCloseSettingsPanelOnKey("Escape", false)).toBe(false);
  });
});
