const { ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("../../ipc/channels.cjs");

module.exports = {
  importBooks: () => ipcRenderer.invoke(IPC_CHANNELS.libraryImportBooks),
  listBooks: () => ipcRenderer.invoke(IPC_CHANNELS.libraryListBooks),
  openBook: (id) => ipcRenderer.invoke(IPC_CHANNELS.libraryOpenBook, id),
  saveProgress: (id, progress) =>
    ipcRenderer.invoke(IPC_CHANNELS.librarySaveProgress, id, progress),
  saveBookmark: (id, bookmark) =>
    ipcRenderer.invoke(IPC_CHANNELS.librarySaveBookmark, id, bookmark),
  updateBookmark: (bookId, bookmarkId, patch) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryUpdateBookmark, bookId, bookmarkId, patch),
  removeBookmarks: (bookId, bookmarkIds) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryRemoveBookmarks, bookId, bookmarkIds),
  saveHighlight: (bookId, highlight) =>
    ipcRenderer.invoke(IPC_CHANNELS.librarySaveHighlight, bookId, highlight),
  updateHighlight: (bookId, highlightId, patch) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryUpdateHighlight, bookId, highlightId, patch),
  removeHighlights: (bookId, highlightIds) =>
    ipcRenderer.invoke(IPC_CHANNELS.libraryRemoveHighlights, bookId, highlightIds),
  removeBook: (id) => ipcRenderer.invoke(IPC_CHANNELS.libraryRemoveBook, id),
  removeBooks: (ids) => ipcRenderer.invoke(IPC_CHANNELS.libraryRemoveBooks, ids),
  importByPaths: (paths) => ipcRenderer.invoke(IPC_CHANNELS.libraryImportByPaths, paths),
  updateBookMeta: (id, patch) => ipcRenderer.invoke(IPC_CHANNELS.libraryUpdateBookMeta, id, patch),
  saveReadingSession: (bookId, session) => ipcRenderer.invoke(IPC_CHANNELS.librarySaveReadingSession, bookId, session),
  exportData: () => ipcRenderer.invoke(IPC_CHANNELS.libraryExportData),
  importData: () => ipcRenderer.invoke(IPC_CHANNELS.libraryImportData),
  listCollections: () => ipcRenderer.invoke(IPC_CHANNELS.libraryListCollections),
  saveCollection: (collection) => ipcRenderer.invoke(IPC_CHANNELS.librarySaveCollection, collection),
  removeCollection: (id) => ipcRenderer.invoke(IPC_CHANNELS.libraryRemoveCollection, id),
  addBookToCollection: (collectionId, bookId) => ipcRenderer.invoke(IPC_CHANNELS.libraryAddBookToCollection, collectionId, bookId),
  removeBookFromCollection: (collectionId, bookId) => ipcRenderer.invoke(IPC_CHANNELS.libraryRemoveBookFromCollection, collectionId, bookId),
  updateBookTags: (bookId, tags) => ipcRenderer.invoke(IPC_CHANNELS.libraryUpdateBookTags, bookId, tags),
  getGoalStats: () => ipcRenderer.invoke(IPC_CHANNELS.libraryGetGoalStats),
  getSessionsByDate: () => ipcRenderer.invoke(IPC_CHANNELS.libraryGetSessionsByDate)
};
