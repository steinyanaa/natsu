import { app, BrowserWindow, protocol } from "electron";
import { createWindow } from "./window/createWindow.js";
import { handleBookProtocol } from "./services/protocol.js";
import { flushProgressUpdates } from "./services/library.js";
import { initStore } from "./services/store.js";
import { registerIpc } from "./ipc/register.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "manga-reader",
    privileges: {
      standard: true,
      secure: true,
      corsEnabled: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

app.whenReady().then(async () => {
  initStore();

  protocol.handle("manga-reader", handleBookProtocol);
  registerIpc();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("before-quit", () => {
  flushProgressUpdates();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
