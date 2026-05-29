import {
  BookOpen,
  FolderOpen,
  ImageIcon,
  Loader2,
  Pencil,
  Tag,
  Trash2
} from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import type { createTranslator } from "../i18n";
import type { BookRecord, Collection, ReaderProgress } from "../types";
import type { ShelfView } from "./useBookShelf";

function formatBytes(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function percentLabel(progress?: ReaderProgress): string {
  if (!progress) {
    return "0%";
  }
  return `${Math.max(0, Math.min(100, Math.round(progress.percent * 100)))}%`;
}

function BookCover({ book, coverUrl }: { book: BookRecord; coverUrl?: string }) {
  const hue = book.coverSeed % 360;

  return (
    <div
      className={`book-cover ${coverUrl ? "has-art" : "synthetic-cover"}`}
      style={
        {
          "--cover-hue": hue,
          "--cover-accent": `hsl(${(hue + 72) % 360} 88% 74%)`
        } as React.CSSProperties
      }
    >
      {coverUrl ? (
        <img className="cover-art" src={coverUrl} alt="" />
      ) : (
        <>
          <span>{book.format.toUpperCase()}</span>
          <strong>{book.title.slice(0, 16)}</strong>
          <i aria-hidden="true" />
        </>
      )}
    </div>
  );
}

export function BookShelf({
  books,
  view,
  coverUrls,
  t,
  selectedIds,
  collections,
  onOpen,
  onRemove,
  onEdit,
  onSelect,
  onToggleCollection,
  onRefetchCover,
  fetchingCoverIds,
  onCoverNeeded
}: {
  books: BookRecord[];
  view: ShelfView;
  coverUrls: Map<string, string>;
  t: ReturnType<typeof createTranslator>;
  selectedIds: Set<string>;
  collections: Collection[];
  onOpen: (book: BookRecord, rect?: DOMRect) => void;
  onRemove: (book: BookRecord) => void;
  onEdit: (book: BookRecord) => void;
  onSelect: (id: string, ctrl: boolean) => void;
  onToggleCollection: (collectionId: string, bookId: string, add: boolean) => void;
  onRefetchCover: (book: BookRecord) => Promise<void>;
  fetchingCoverIds: Set<string>;
  onCoverNeeded: (book: BookRecord) => void;
}) {
  const [tagMenuBook, setTagMenuBook] = useState<BookRecord | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const onCoverNeededRef = useRef(onCoverNeeded);
  onCoverNeededRef.current = onCoverNeeded;
  const bookByEl = useRef(new WeakMap<Element, BookRecord>());

  // Create the observer on demand from the tile `ref` callback. Ref attachment
  // runs in the commit phase, and StrictMode (dev) mounts → unmounts → remounts,
  // disconnecting and nulling the observer in between. Lazily (re)creating it
  // here guarantees a live observer exists whenever a tile attaches, in both
  // dev StrictMode and production.
  const ensureObserver = (): IntersectionObserver | null => {
    if (!observerRef.current && typeof IntersectionObserver !== "undefined") {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const book = bookByEl.current.get(entry.target);
            if (book) onCoverNeededRef.current(book);
          }
        },
        { rootMargin: "300px 0px" }
      );
    }
    return observerRef.current;
  };

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return (
    <section className={`book-shelf ${view}`}>
      {books.map((book, index) => {
        const isSelected = selectedIds.has(book.id);
        return (
          <article
            key={book.id}
            className={`book-tile${isSelected ? " selected" : ""}`}
            style={{ "--stagger": index } as React.CSSProperties}
            onClick={(e) => { if (e.ctrlKey || e.metaKey) { onSelect(book.id, true); e.preventDefault(); } }}
          >
            <button
              ref={(el) => {
                if (!el) return;
                const observer = ensureObserver();
                if (!observer) return;
                bookByEl.current.set(el, book);
                observer.observe(el);
                return () => observer.unobserve(el);
              }}
              className="cover-button"
              onClick={(e) => {
                if (!(e.ctrlKey || e.metaKey)) {
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  onOpen(book, rect);
                }
              }}
              title={book.title}
            >
              <BookCover book={book} coverUrl={coverUrls.get(book.id)} />
              {isSelected && <div className="tile-selected-badge" aria-label="已选中" />}
            </button>
            <div className="book-info">
              <div>
                <h2>{book.title}</h2>
                <p>
                  <span className="format-chip">{book.format.toUpperCase()}</span>
                  <span>{formatBytes(book.size)}</span>
                  <span>{percentLabel(book.progress)}</span>
                </p>
              </div>
              <div className="book-actions">
                <button className="soft-button pressable compact-action" onClick={() => onOpen(book)}>
                  <BookOpen size={16} />
                  <span>{book.progress ? t("continueReading") : t("open")}</span>
                </button>
                <button className="icon-button pressable" title={t("editMetadata")} onClick={() => onEdit(book)}>
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button pressable"
                  title="重新抓取封面"
                  disabled={fetchingCoverIds.has(book.id)}
                  onClick={() => onRefetchCover(book)}
                >
                  {fetchingCoverIds.has(book.id)
                    ? <Loader2 size={17} className="spin" />
                    : <ImageIcon size={17} />}
                </button>
                {collections.length > 0 && (
                  <div className="tag-menu-anchor">
                    <button
                      className="icon-button pressable"
                      title={t("addToCollection")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTagMenuBook(tagMenuBook?.id === book.id ? null : book);
                      }}
                    >
                      <Tag size={17} />
                    </button>
                    {tagMenuBook?.id === book.id && (
                      <div className="tag-dropdown" onClick={(e) => e.stopPropagation()}>
                        {collections.map((col) => {
                          const inCol = col.bookIds.includes(book.id);
                          return (
                            <button
                              key={col.id}
                              className={`tag-dropdown-item${inCol ? " active" : ""}`}
                              onClick={() => {
                                onToggleCollection(col.id, book.id, !inCol);
                                setTagMenuBook(null);
                              }}
                            >
                              <FolderOpen size={14} />
                              <span>{col.name}</span>
                              {inCol && <span className="tag-check">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <button className="icon-button pressable" title={t("remove")} onClick={() => onRemove(book)}>
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
