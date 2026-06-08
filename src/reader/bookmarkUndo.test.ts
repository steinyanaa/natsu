import { describe, expect, it } from "vitest";
import type { Bookmark } from "../types";
import { captureRemovedBookmarks } from "./bookmarkUndo";

const bookmark = (id: string): Bookmark => ({
  id,
  label: id,
  createdAt: `2026-01-0${id}`,
  progress: { kind: "text", current: 0, total: 100, percent: 0, updatedAt: "2026-01-01T00:00:00.000Z" }
});

describe("captureRemovedBookmarks", () => {
  it("captures removed bookmarks in existing list order", () => {
    const bookmarks = [bookmark("a"), bookmark("b"), bookmark("c")];

    expect(captureRemovedBookmarks(bookmarks, ["c", "a"])).toEqual([bookmarks[0], bookmarks[2]]);
  });

  it("ignores unknown ids and duplicate removal ids", () => {
    const bookmarks = [bookmark("a"), bookmark("b")];

    expect(captureRemovedBookmarks(bookmarks, ["b", "missing", "b"])).toEqual([bookmarks[1]]);
  });
});
