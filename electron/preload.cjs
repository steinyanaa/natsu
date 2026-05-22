const { contextBridge, ipcRenderer } = require("electron");

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
  importBooks: () => ipcRenderer.invoke("library:importBooks"),
  searchOnlineBooks: (query) => ipcRenderer.invoke("library:searchOnlineBooks", query),
  testOnlineSource: (query, source) => ipcRenderer.invoke("library:testOnlineSource", query, source),
  importOnlineBook: (book) => ipcRenderer.invoke("library:importOnlineBook", book),
  openExternalAndAutoImport: (book) => ipcRenderer.invoke("library:openExternalAndAutoImport", book),
  openExternal: (url) =>
    isHttpUrl(url) ? ipcRenderer.invoke("system:openExternal", url) : Promise.resolve(false),
  listBooks: () => ipcRenderer.invoke("library:listBooks"),
  openBook: (id) => ipcRenderer.invoke("library:openBook", id),
  saveProgress: (id, progress) =>
    ipcRenderer.invoke("library:saveProgress", id, progress),
  saveBookmark: (id, bookmark) =>
    ipcRenderer.invoke("library:saveBookmark", id, bookmark),
  updateBookmark: (bookId, bookmarkId, patch) =>
    ipcRenderer.invoke("library:updateBookmark", bookId, bookmarkId, patch),
  removeBookmarks: (bookId, bookmarkIds) =>
    ipcRenderer.invoke("library:removeBookmarks", bookId, bookmarkIds),
  saveHighlight: (bookId, highlight) =>
    ipcRenderer.invoke("library:saveHighlight", bookId, highlight),
  updateHighlight: (bookId, highlightId, patch) =>
    ipcRenderer.invoke("library:updateHighlight", bookId, highlightId, patch),
  removeHighlights: (bookId, highlightIds) =>
    ipcRenderer.invoke("library:removeHighlights", bookId, highlightIds),
  removeBook: (id) => ipcRenderer.invoke("library:removeBook", id),
  removeBooks: (ids) => ipcRenderer.invoke("library:removeBooks", ids),
  importByPaths: (paths) => ipcRenderer.invoke("library:importByPaths", paths),
  updateBookMeta: (id, patch) => ipcRenderer.invoke("library:updateBookMeta", id, patch),
  saveReadingSession: (bookId, session) => ipcRenderer.invoke("library:saveReadingSession", bookId, session),
  exportData: () => ipcRenderer.invoke("library:exportData"),
  importData: () => ipcRenderer.invoke("library:importData"),
  listCollections: () => ipcRenderer.invoke("library:listCollections"),
  saveCollection: (collection) => ipcRenderer.invoke("library:saveCollection", collection),
  removeCollection: (id) => ipcRenderer.invoke("library:removeCollection", id),
  addBookToCollection: (collectionId, bookId) => ipcRenderer.invoke("library:addBookToCollection", collectionId, bookId),
  removeBookFromCollection: (collectionId, bookId) => ipcRenderer.invoke("library:removeBookFromCollection", collectionId, bookId),
  updateBookTags: (bookId, tags) => ipcRenderer.invoke("library:updateBookTags", bookId, tags),
  getGoalStats: () => ipcRenderer.invoke("library:getGoalStats"),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  savePreferences: (preferences) =>
    ipcRenderer.invoke("preferences:save", preferences),
  hasCover: (bookId) => ipcRenderer.invoke("cover:has", bookId),
  saveCover: (bookId, bytes) => ipcRenderer.invoke("cover:save", bookId, bytes),
  saveFile: (content, suggestedName) => ipcRenderer.invoke("system:saveFile", content, suggestedName),
  fetchCoverForBook: (bookId) => ipcRenderer.invoke("cover:fetchForBook", bookId),
  getSessionsByDate: () => ipcRenderer.invoke("library:getSessionsByDate"),
});
