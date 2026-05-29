import { argbFromHex, hexFromArgb, themeFromSourceColor } from "@material/material-color-utilities";
import type { ReaderPreferences, ThemeCustomColors } from "./types";
import { themeOptions } from "./themes";

const fallbackSeed = "#35a7d8";

function safeHex(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : fallback;
}

function colorMix(color: string, alpha: number): string {
  return `rgb(from ${color} r g b / ${alpha})`;
}

function modeIsDark(preferences: ReaderPreferences, systemPrefersDark: boolean): boolean {
  if (preferences.themeMode === "dark") {
    return true;
  }

  if (preferences.themeMode === "light") {
    return false;
  }

  return systemPrefersDark;
}

function seedForPreferences(preferences: ReaderPreferences): string {
  if (preferences.themeSource === "seed") {
    return safeHex(preferences.themeSeedColor, fallbackSeed);
  }

  if (preferences.themeSource === "custom") {
    return safeHex(preferences.customColors.primary, fallbackSeed);
  }

  return themeOptions.find((theme) => theme.id === preferences.theme)?.seed ?? fallbackSeed;
}

function customColorsForPreferences(preferences: ReaderPreferences): ThemeCustomColors {
  return {
    primary: safeHex(preferences.customColors.primary, fallbackSeed),
    secondary: safeHex(preferences.customColors.secondary, "#ffc4d6"),
    tertiary: safeHex(preferences.customColors.tertiary, "#ffe27a"),
    surface: safeHex(preferences.customColors.surface, "#f7fcff")
  };
}

export function resolveSeed(preferences: ReaderPreferences, seedOverride?: string): string {
  const trimmed = seedOverride?.trim() ?? "";
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }
  return seedForPreferences(preferences);
}

export function applyReaderTheme(
  root: HTMLElement,
  preferences: ReaderPreferences,
  systemPrefersDark: boolean,
  seedOverride?: string
) {
  const isDark = modeIsDark(preferences, systemPrefersDark);
  const trimmedOverride = seedOverride?.trim() ?? "";
  const usingOverride = /^#[0-9a-f]{6}$/i.test(trimmedOverride);
  const theme = themeFromSourceColor(argbFromHex(resolveSeed(preferences, seedOverride)));
  const scheme = isDark ? theme.schemes.dark : theme.schemes.light;
  const custom = customColorsForPreferences(preferences);
  const primary = preferences.themeSource === "custom" && !usingOverride ? custom.primary : hexFromArgb(scheme.primary);
  const secondary = preferences.themeSource === "custom" && !usingOverride ? custom.secondary : hexFromArgb(scheme.secondary);
  const tertiary = preferences.themeSource === "custom" && !usingOverride ? custom.tertiary : hexFromArgb(scheme.tertiary);
  const surface = preferences.themeSource === "custom" && !usingOverride ? custom.surface : hexFromArgb(scheme.surface);
  const background = preferences.themeSource === "custom" && !usingOverride ? custom.surface : hexFromArgb(scheme.background);
  const onSurface = hexFromArgb(scheme.onSurface);
  const onPrimary = hexFromArgb(scheme.onPrimary);
  const surfaceContainer = hexFromArgb(isDark ? theme.palettes.neutral.tone(12) : theme.palettes.neutral.tone(94));
  const outlineVariant = hexFromArgb(scheme.outlineVariant);

  root.dataset.theme = preferences.theme;
  root.dataset.themeMode = isDark ? "dark" : "light";
  root.style.setProperty("color-scheme", isDark ? "dark" : "light");
  root.style.setProperty("--md-sys-color-primary", primary);
  root.style.setProperty("--md-sys-color-on-primary", onPrimary);
  root.style.setProperty("--md-sys-color-secondary", secondary);
  root.style.setProperty("--md-sys-color-tertiary", tertiary);
  root.style.setProperty("--md-sys-color-surface", surface);
  root.style.setProperty("--md-sys-color-surface-container", surfaceContainer);
  root.style.setProperty("--md-sys-color-outline-variant", outlineVariant);
  root.style.setProperty("--reader-bg", background);
  root.style.setProperty("--reader-ink", onSurface);
  root.style.setProperty("--reader-muted", hexFromArgb(scheme.onSurfaceVariant));
  root.style.setProperty("--reader-accent", primary);
  root.style.setProperty("--reader-warm", tertiary);
  root.style.setProperty("--reader-paper", surface);
  root.style.setProperty("--cover-shade", isDark ? "rgb(4 7 11 / 82%)" : "rgb(15 39 48 / 78%)");
  root.style.setProperty(
    "--glass-bg",
    isDark ? colorMix(surface, 0.72) : colorMix(surface, 0.66)
  );
  root.style.setProperty(
    "--glass-line",
    isDark ? colorMix(outlineVariant, 0.72) : colorMix(outlineVariant, 0.86)
  );
  root.style.setProperty(
    "--glass-highlight",
    isDark
      ? "linear-gradient(135deg, rgb(255 255 255 / 12%), transparent 48%)"
      : "linear-gradient(135deg, rgb(255 255 255 / 45%), transparent 48%)"
  );
}
