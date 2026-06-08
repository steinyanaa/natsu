import type { Bookmark } from "../types";

export function captureRemovedBookmarks(bookmarks: Bookmark[], bookmarkIds: string[]): Bookmark[] {
  const ids = new Set(bookmarkIds);
  return bookmarks.filter((bookmark) => ids.has(bookmark.id));
}
