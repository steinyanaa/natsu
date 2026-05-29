const { ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("../../ipc/channels.cjs");

module.exports = {
  hasCover: (bookId) => ipcRenderer.invoke(IPC_CHANNELS.coverHas, bookId),
  saveCover: (bookId, bytes) => ipcRenderer.invoke(IPC_CHANNELS.coverSave, bookId, bytes),
  fetchCoverForBook: (bookId) => ipcRenderer.invoke(IPC_CHANNELS.coverFetchForBook, bookId)
};
