const { ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("../../ipc/channels.cjs");

module.exports = {
  getPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.preferencesGet),
  savePreferences: (preferences) =>
    ipcRenderer.invoke(IPC_CHANNELS.preferencesSave, preferences)
};
