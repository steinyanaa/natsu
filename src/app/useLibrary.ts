import { useCallback, useState } from "react";
import type { BookRecord, Collection } from "../types";

export function useLibrary() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [importing, setImporting] = useState(false);

  const refreshBooks = useCallback(async () => {
    const records = await window.readerApi.listBooks();
    setBooks(records);
  }, []);

  const importBooks = useCallback(async () => {
    setImporting(true);
    try {
      await window.readerApi.importBooks();
      await refreshBooks();
    } finally {
      setImporting(false);
    }
  }, [refreshBooks]);

  const createCollection = useCallback(async (name: string) => {
    const col: Collection = {
      id: `col-${Date.now()}`,
      name: name.trim(),
      bookIds: [],
      createdAt: new Date().toISOString()
    };
    const updated = await window.readerApi.saveCollection(col);
    setCollections(updated);
  }, []);

  const deleteCollection = useCallback(
    async (id: string, activeCollectionId: string | null, setActiveCollectionId: (v: string | null) => void) => {
      const updated = await window.readerApi.removeCollection(id);
      setCollections(updated);
      if (activeCollectionId === id) setActiveCollectionId(null);
    },
    []
  );

  const toggleBookInCollection = useCallback(
    async (collectionId: string, bookId: string, add: boolean) => {
      const updated = add
        ? await window.readerApi.addBookToCollection(collectionId, bookId)
        : await window.readerApi.removeBookFromCollection(collectionId, bookId);
      setCollections(updated);
    },
    []
  );

  const batchRemoveBooks = useCallback(
    async (selectedIds: Set<string>, onDone: () => void) => {
      const ids = [...selectedIds];
      const nextBooks = await window.readerApi.removeBooks(ids);
      setBooks(nextBooks);
      onDone();
    },
    []
  );

  return {
    books,
    setBooks,
    collections,
    setCollections,
    importing,
    setImporting,
    refreshBooks,
    importBooks,
    createCollection,
    deleteCollection,
    toggleBookInCollection,
    batchRemoveBooks
  };
}
