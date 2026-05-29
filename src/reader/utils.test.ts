import { describe, expect, it } from "vitest";
import { nowProgress, percentLabel, readerFontStack } from "./utils";
import type { ReaderPreferences, ReaderProgress } from "../types";

function prefs(patch: Partial<ReaderPreferences>): ReaderPreferences {
  return patch as ReaderPreferences;
}

describe("readerFontStack", () => {
  it("returns the preset stack for a known font family", () => {
    expect(readerFontStack(prefs({ fontFamily: "sans", customFontStack: "" }))).toContain("Segoe UI");
  });

  it("prepends a custom stack and falls back to the serif-cn stack", () => {
    const stack = readerFontStack(prefs({ fontFamily: "custom", customFontStack: "MyFont" }));
    expect(stack.startsWith("MyFont, ")).toBe(true);
    expect(stack).toContain("Noto Serif SC");
  });

  it("ignores a blank custom stack and falls back to serif-cn", () => {
    const stack = readerFontStack(prefs({ fontFamily: "custom", customFontStack: "   " }));
    expect(stack).toContain("Noto Serif SC");
    expect(stack.startsWith(",")).toBe(false);
  });
});

describe("nowProgress", () => {
  it("stamps an ISO updatedAt and preserves percent", () => {
    const result = nowProgress({ percent: 42 } as Parameters<typeof nowProgress>[0]);
    expect(result.percent).toBe(42);
    expect(() => new Date(result.updatedAt).toISOString()).not.toThrow();
    expect(result.updatedAt).toBe(new Date(result.updatedAt).toISOString());
  });

  it("coerces a non-finite percent to 0", () => {
    const result = nowProgress({ percent: Number.NaN } as Parameters<typeof nowProgress>[0]);
    expect(result.percent).toBe(0);
  });
});

describe("percentLabel", () => {
  const progress = (percent: number): ReaderProgress => ({ percent } as ReaderProgress);

  it("returns 0% when progress is missing", () => {
    expect(percentLabel(undefined)).toBe("0%");
  });

  it("rounds a fractional percent", () => {
    expect(percentLabel(progress(0.734))).toBe("73%");
  });

  it("clamps out-of-range values to 0–100", () => {
    expect(percentLabel(progress(-0.5))).toBe("0%");
    expect(percentLabel(progress(1.5))).toBe("100%");
  });
});
