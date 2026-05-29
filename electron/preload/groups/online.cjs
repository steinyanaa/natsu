const { ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("../../ipc/channels.cjs");
const { isHttpUrl } = require("../guards.cjs");

module.exports = {
  searchOnlineBooks: (query) => ipcRenderer.invoke(IPC_CHANNELS.librarySearchOnlineBooks, query),
  testOnlineSource: (query, source) => ipcRenderer.invoke(IPC_CHANNELS.libraryTestOnlineSource, query, source),
  importOnlineBook: (book) => ipcRenderer.invoke(IPC_CHANNELS.libraryImportOnlineBook, book),
  openExternalAndAutoImport: (book) => ipcRenderer.invoke(IPC_CHANNELS.libraryOpenExternalAndAutoImport, book),
  openExternal: (url) =>
    isHttpUrl(url) ? ipcRenderer.invoke(IPC_CHANNELS.systemOpenExternal, url) : Promise.resolve(false)
};
