import { useMemo, useState } from "react";
import type { BookFormat, BookRecord, Collection } from "../types";

export type ShelfFilter = "all" | "novels" | "comics" | "pdf";
export type ShelfView = "grid" | "list";
export type ShelfSort = "recent" | "title" | "author" | "progress" | "size";
export type AppSection = "library" | "recent" | "stats";

const novelFormats: BookFormat[] = ["epub", "txt", "mobi", "azw3"];
const comicFormats: BookFormat[] = ["cbz", "zip", "cbr", "rar"];

function isNovel(format: BookFormat): boolean {
  return novelFormats.includes(format);
}

function isComic(format: BookFormat): boolean {
  return comicFormats.includes(format);
}

function bookActivityTime(book: BookRecord): number {
  return new Date(book.lastOpenedAt ?? book.progress?.updatedAt ?? book.importedAt).getTime();
}

export function useBookShelf(books: BookRecord[], collections: Collection[]) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ShelfFilter>("all");
  const [view, setView] = useState<ShelfView>("grid");
  const [section, setSection] = useState<AppSection>("library");
  const [sort, setSort] = useState<ShelfSort>("recent");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const colBookIds = activeCollectionId
      ? (collections.find((c) => c.id === activeCollectionId)?.bookIds ?? [])
      : null;

    const filtered = books.filter((book) => {
      const matchesQuery =
        !normalizedQuery ||
        `${book.title} ${book.author ?? ""} ${book.format}`.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "novels" && isNovel(book.format)) ||
        (filter === "comics" && isComic(book.format)) ||
        (filter === "pdf" && book.format === "pdf");
      const matchesCollection = !colBookIds || colBookIds.includes(book.id);

      return matchesQuery && matchesFilter && matchesCollection;
    });

    if (section === "recent") {
      return filtered
        .filter((book) => book.lastOpenedAt || book.progress)
        .sort((a, b) => bookActivityTime(b) - bookActivityTime(a));
    }

    const comparators: Record<ShelfSort, (a: BookRecord, b: BookRecord) => number> = {
      recent: (a, b) => bookActivityTime(b) - bookActivityTime(a),
      title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      author: (a, b) => (a.author ?? "").localeCompare(b.author ?? "", undefined, { sensitivity: "base" }),
      progress: (a, b) => (b.progress?.percent ?? 0) - (a.progress?.percent ?? 0),
      size: (a, b) => b.size - a.size
    };

    return [...filtered].sort(comparators[sort]);
  }, [books, filter, query, section, sort, activeCollectionId, collections]);

  return {
    query, setQuery,
    filter, setFilter,
    view, setView,
    section, setSection,
    sort, setSort,
    activeCollectionId, setActiveCollectionId,
    filteredBooks
  };
}
