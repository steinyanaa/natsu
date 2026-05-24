const { contextBridge, ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("./ipc/channels.cjs");

const isHttpUrl = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

contextBridge.exposeInMainWorld("readerApi", {
  importBooks: () => ipcRenderer.invoke(IPC_CHANNELS.libraryImportBooks),
  searchOnlineBooks: (query) => ipcRenderer.invoke(IPC_CHANNELS.librarySearchOnlineBooks, query),
  testOnlineSource: (query, source) => ipcRenderer.invoke(IPC_CHANNELS.libraryTestOnlineSource, query, source),
  importOnlineBook: (book) => ipcRenderer.invoke(IPC_CHANNELS.libraryImportOnlineBook, book),
  openExternalAndAutoImport: (book) => ipcRenderer.invoke(IPC_CHANNELS.libraryOpenExternalAndAutoImport, book),
  openExternal: (url) =>
    isHttpUrl(url) ? ipcRenderer.invoke(IPC_CHANNELS.systemOpenExternal, url) : Promise.resolve(false),
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
  getPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.preferencesGet),
  savePreferences: (preferences) =>
    ipcRenderer.invoke(IPC_CHANNELS.preferencesSave, preferences),
  hasCover: (bookId) => ipcRenderer.invoke(IPC_CHANNELS.coverHas, bookId),
  saveCover: (bookId, bytes) => ipcRenderer.invoke(IPC_CHANNELS.coverSave, bookId, bytes),
  saveFile: (content, suggestedName) => ipcRenderer.invoke(IPC_CHANNELS.systemSaveFile, content, suggestedName),
  fetchCoverForBook: (bookId) => ipcRenderer.invoke(IPC_CHANNELS.coverFetchForBook, bookId),
  getSessionsByDate: () => ipcRenderer.invoke(IPC_CHANNELS.libraryGetSessionsByDate),
  zlibStatus: () => ipcRenderer.invoke(IPC_CHANNELS.zlibStatus),
  zlibLogin: () => ipcRenderer.invoke(IPC_CHANNELS.zlibLogin),
  zlibLogout: () => ipcRenderer.invoke(IPC_CHANNELS.zlibLogout),
  zlibFetchAccount: () => ipcRenderer.invoke(IPC_CHANNELS.zlibFetchAccount),
});
