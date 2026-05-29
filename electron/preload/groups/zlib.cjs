const { ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("../../ipc/channels.cjs");

module.exports = {
  zlibStatus: () => ipcRenderer.invoke(IPC_CHANNELS.zlibStatus),
  zlibLogin: () => ipcRenderer.invoke(IPC_CHANNELS.zlibLogin),
  zlibLogout: () => ipcRenderer.invoke(IPC_CHANNELS.zlibLogout),
  zlibFetchAccount: () => ipcRenderer.invoke(IPC_CHANNELS.zlibFetchAccount)
};
