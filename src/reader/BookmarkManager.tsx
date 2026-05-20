import { Pencil, X } from "lucide-react";
import { createTranslator } from "../i18n";
import type { BookRecord, Bookmark as BookmarkRecord } from "../types";

function percentLabel(progress?: BookmarkRecord["progress"]): string {
  if (!progress) {
    return "0%";
  }

  return `${Math.max(0, Math.min(100, Math.round(progress.percent * 100)))}%`;
}

export function BookmarkManager({
  book,
  selected,
  t,
  onSelectChange,
  onJump,
  onRename,
  onRemove
}: {
  book: BookRecord;
  selected: Set<string>;
  t: ReturnType<typeof createTranslator>;
  onSelectChange: (selected: Set<string>) => void;
  onJump: (bookmark: BookmarkRecord) => void;
  onRename: (bookmark: BookmarkRecord) => void;
  onRemove: (bookmarkIds: string[]) => void;
}) {
  const allSelected = Boolean(book.bookmarks.length) && selected.size === book.bookmarks.length;
  const toggleBookmark = (bookmarkId: string) => {
    const next = new Set(selected);
    if (next.has(bookmarkId)) {
      next.delete(bookmarkId);
    } else {
      next.add(bookmarkId);
    }
    onSelectChange(next);
  };

  return (
    <div className="bookmark-manager">
      <div className="bookmark-actions-bar">
        <button
          className="soft-button pressable compact-action"
          onClick={() => onSelectChange(allSelected ? new Set() : new Set(book.bookmarks.map((item) => item.id)))}
        >
          {allSelected ? t("clearSelection") : t("selectAll")}
        </button>
        <button
          className="soft-button pressable compact-action"
          disabled={!selected.size}
          onClick={() => onRemove([...selected])}
        >
          {t("deleteSelected")}
        </button>
      </div>
      {book.bookmarks.length ? (
        book.bookmarks.map((bookmark) => (
          <article key={bookmark.id} className="bookmark-row">
            <label className="bookmark-check">
              <input
                type="checkbox"
                checked={selected.has(bookmark.id)}
                onChange={() => toggleBookmark(bookmark.id)}
              />
              <span />
            </label>
            <button className="bookmark-main" onClick={() => onJump(bookmark)}>
              <strong>{bookmark.label}</strong>
              <span>
                {percentLabel(bookmark.progress)} 路 {new Date(bookmark.createdAt).toLocaleString()}
              </span>
            </button>
            <button className="icon-button pressable mini-icon" title={t("rename")} onClick={() => onRename(bookmark)}>
              <Pencil size={14} />
            </button>
            <button className="icon-button pressable mini-icon" title={t("remove")} onClick={() => onRemove([bookmark.id])}>
              <X size={15} />
            </button>
          </article>
        ))
      ) : (
        <p>{t("noBookmarks")}</p>
      )}
    </div>
  );
}
