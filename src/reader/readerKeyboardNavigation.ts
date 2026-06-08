import type { ReadingDirection } from "../types";

export function readerKeyboardScrollDirection(
  key: string,
  readingDirection: ReadingDirection
): 1 | -1 | undefined {
  if (key === "ArrowDown") {
    return 1;
  }

  if (key === "ArrowUp") {
    return -1;
  }

  if (key === "ArrowRight") {
    return readingDirection === "rtl" ? -1 : 1;
  }

  if (key === "ArrowLeft") {
    return readingDirection === "rtl" ? 1 : -1;
  }

  return undefined;
}
