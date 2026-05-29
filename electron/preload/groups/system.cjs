const { ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("../../ipc/channels.cjs");

module.exports = {
  saveFile: (content, suggestedName) => ipcRenderer.invoke(IPC_CHANNELS.systemSaveFile, content, suggestedName)
};
