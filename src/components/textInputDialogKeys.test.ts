import { describe, expect, it } from "vitest";
import { shouldSubmitTextInputDialog } from "./textInputDialogKeys";

describe("shouldSubmitTextInputDialog", () => {
  it("submits single-line dialogs on Enter", () => {
    expect(shouldSubmitTextInputDialog({ key: "Enter", multiline: false })).toBe(true);
  });

  it("keeps plain Enter for newlines in multiline dialogs", () => {
    expect(shouldSubmitTextInputDialog({ key: "Enter", multiline: true })).toBe(false);
  });

  it("submits multiline dialogs with Ctrl+Enter or Meta+Enter", () => {
    expect(shouldSubmitTextInputDialog({ key: "Enter", multiline: true, ctrlKey: true })).toBe(true);
    expect(shouldSubmitTextInputDialog({ key: "Enter", multiline: true, metaKey: true })).toBe(true);
  });
});
