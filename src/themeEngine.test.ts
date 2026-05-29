import { describe, expect, it, vi } from "vitest";

// Mock the material-color-utilities package which has a broken internal import in test env
vi.mock("@material/material-color-utilities", () => ({
  argbFromHex: (hex: string) => parseInt(hex.replace("#", ""), 16),
  hexFromArgb: (argb: number) => "#" + argb.toString(16).padStart(6, "0"),
  themeFromSourceColor: () => ({
    schemes: { light: { primary: 0, secondary: 0, tertiary: 0, surface: 0, background: 0, onSurface: 0, onPrimary: 0, outlineVariant: 0, onSurfaceVariant: 0 }, dark: { primary: 0, secondary: 0, tertiary: 0, surface: 0, background: 0, onSurface: 0, onPrimary: 0, outlineVariant: 0, onSurfaceVariant: 0 } },
    palettes: { neutral: { tone: () => 0 } },
  }),
  sourceColorFromImage: async () => 0,
}));

import { resolveSeed } from "./themeEngine";
import type { ReaderPreferences } from "./types";

function prefs(patch: Partial<ReaderPreferences>): ReaderPreferences {
  return patch as ReaderPreferences;
}

describe("resolveSeed", () => {
  it("uses a valid hex override over preferences", () => {
    expect(resolveSeed(prefs({ themeSource: "seed", themeSeedColor: "#123456" }), "#ff0000")).toBe("#ff0000");
  });
  it("ignores an invalid override and falls back to preferences", () => {
    expect(resolveSeed(prefs({ themeSource: "seed", themeSeedColor: "#123456" }), "not-a-hex")).toBe("#123456");
  });
  it("uses the seed color in seed mode when no override", () => {
    expect(resolveSeed(prefs({ themeSource: "seed", themeSeedColor: "#abcdef" }))).toBe("#abcdef");
  });
  it("uses the custom primary in custom mode when no override", () => {
    expect(resolveSeed(prefs({ themeSource: "custom", customColors: { primary: "#0a0b0c", secondary: "#fff", tertiary: "#fff", surface: "#fff" } }))).toBe("#0a0b0c");
  });
});
