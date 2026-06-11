import { app, BrowserWindow, protocol } from "electron";
import { createWindow } from "./window/createWindow.js";
import { handleBookProtocol } from "./services/protocol.js";
import { flushProgressUpdates } from "./services/library.js";
import { initStore } from "./services/store.js";
import { registerIpc } from "./ipc/register.js";
import { sweepOrphans } from "./services/orphans.js";
import { log } from "./services/logger.js";

process.on("uncaughtException", (error) => {
  log.error("uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  log.error("unhandledRejection", reason instanceof Error ? reason : String(reason));
});

app.on("render-process-gone", (_event, _webContents, details) => {
  log.error(
    "render-process-gone",
    `reason=${details.reason}`,
    `exitCode=${details.exitCode}`
  );
});

app.on("child-process-gone", (_event, details) => {
  log.error(
    "child-process-gone",
    `type=${details.type}`,
    `reason=${details.reason}`,
    `exitCode=${details.exitCode}`,
    details.name ? `name=${details.name}` : ""
  );
});

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

  // Retry deleting any previously locked book files. Best-effort, never throws.
  void sweepOrphans();

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
