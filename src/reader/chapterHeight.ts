import type { ParsedTextDocument, ReaderPreferences } from "../types";

/**
 * Estimates a chapter's rendered pixel height without laying it out, so the
 * virtual scroller can size off-screen chapters. Fixed-layout chapters are sized
 * from their declared viewport; flowing text is approximated from character
 * count, image/block markup, and the reader's font/column settings.
 */
export function estimateChapterHeight({
  chapter,
  preferences,
  viewportHeight
}: {
  chapter: ParsedTextDocument["chapters"][number];
  preferences: ReaderPreferences;
  viewportHeight: number;
}): number {
  if (chapter.layout === "fixed" && chapter.viewport) {
    const ratio = chapter.viewport.height / Math.max(1, chapter.viewport.width);
    const widthBoundHeight = Math.min(preferences.columnWidth, chapter.viewport.width) * ratio;
    return Math.max(360, Math.min(Math.max(420, viewportHeight - 160), widthBoundHeight || chapter.viewport.height));
  }

  const strippedTextLength = chapter.html.replace(/<[^>]+>/g, "").trim().length;
  const plainLength = Math.max(chapter.plainText.length, strippedTextLength);
  const charsPerLine = Math.max(12, Math.floor(preferences.columnWidth / Math.max(12, preferences.fontSize)));
  const lineCount = Math.ceil(plainLength / charsPerLine);
  const textHeight = lineCount * preferences.fontSize * preferences.lineHeight;
  const imageCount = (chapter.html.match(/<(?:img|svg|picture|image)\b/gi) ?? []).length;
  const imageHeight = imageCount * Math.min(viewportHeight * 0.68, preferences.columnWidth * 0.72);
  const blockCount = (chapter.html.match(/<(?:p|div|section|h[1-6]|li|blockquote)\b/gi) ?? []).length;
  const blockSpacing = blockCount * Math.max(4, preferences.fontSize * 0.38);

  return Math.max(viewportHeight * 0.62, Math.min(12000, textHeight + imageHeight + blockSpacing + 180));
}
