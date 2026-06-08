export const DEFAULT_CHARS_PER_MINUTE = 300;

export function formatChapterEta(
  charCount: number,
  chapterPercent: number,
  charsPerMinute = DEFAULT_CHARS_PER_MINUTE
): string {
  if (charCount <= 0 || charsPerMinute <= 0) {
    return "";
  }

  const safePercent = Math.min(1, Math.max(0, chapterPercent));
  const remaining = charCount * (1 - safePercent);
  if (remaining <= 0) {
    return "";
  }

  const remainingMinutes = remaining / charsPerMinute;
  const minutes = Math.ceil(remainingMinutes);

  return remainingMinutes < 1 ? "< 1 分钟" : `本章剩余 ${minutes} 分钟`;
}
