import { describe, expect, it } from "vitest";
import { readerToastA11y } from "./readerToastA11y";

describe("readerToastA11y", () => {
  it("announces passive toast messages politely", () => {
    expect(readerToastA11y()).toEqual({
      role: "status",
      ariaLive: "polite",
      ariaAtomic: true,
      actionAriaLabel: undefined
    });
  });

  it("describes the optional toast action button", () => {
    expect(readerToastA11y("撤销").actionAriaLabel).toBe("执行通知操作：撤销");
  });
});
