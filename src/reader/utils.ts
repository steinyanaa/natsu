import type { ReaderFontFamily, ReaderPreferences, ReaderProgress } from "../types";

const fontStacks: Record<ReaderFontFamily, string> = {
  "serif-cn": '"Noto Serif SC", "Source Han Serif SC", "SimSun", "Songti SC", Georgia, serif',
  sans: '"Segoe UI", "Microsoft YaHei UI", "Noto Sans SC", "Hiragino Sans", Arial, sans-serif',
  kai: '"KaiTi", "STKaiti", "Kaiti SC", "DFKai-SB", "Noto Serif SC", serif',
  "jp-serif":
    '"Yu Mincho", "Yu Mincho Demibold", "MS PMincho", "MS Mincho", "BIZ UDPMincho", "Hiragino Mincho ProN", "SimSun", serif',
  "serif-en": 'Georgia, "Times New Roman", "Noto Serif SC", serif',
  custom: ""
};

export function readerFontStack(preferences: ReaderPreferences): string {
  if (preferences.fontFamily === "custom" && preferences.customFontStack.trim()) {
    return `${preferences.customFontStack}, ${fontStacks["serif-cn"]}`;
  }

  return fontStacks[preferences.fontFamily] || fontStacks["serif-cn"];
}

export function editableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function nowProgress(progress: Omit<ReaderProgress, "updatedAt">): ReaderProgress {
  return {
    ...progress,
    percent: Number.isFinite(progress.percent) ? progress.percent : 0,
    updatedAt: new Date().toISOString()
  };
}
