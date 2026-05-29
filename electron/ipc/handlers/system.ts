import { ipcMain, dialog } from "electron";
import fs from "node:fs/promises";
import { IPC_CHANNELS } from "../channels.js";
import { getMainWindow, openHttpExternal } from "../../window/createWindow.js";

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.systemOpenExternal, async (_event, url: string) => {
    return openHttpExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.systemSaveFile, async (_event, content: string, suggestedName: string) => {
    if (typeof content !== "string" || typeof suggestedName !== "string") return false;
    const { canceled, filePath } = await dialog.showSaveDialog(getMainWindow()!, {
      defaultPath: suggestedName,
      filters: suggestedName.endsWith(".tsv")
        ? [{ name: "TSV", extensions: ["tsv"] }]
        : [{ name: "Markdown", extensions: ["md"] }]
    });
    if (canceled || !filePath) return false;
    try {
      await fs.writeFile(filePath, content, "utf-8");
      return true;
    } catch {
      return false;
    }
  });
}
