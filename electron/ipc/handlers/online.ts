import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../channels.js";
import {
  importOnlineBook,
  openExternalAndAutoImport
} from "../../services/online-import.js";
import { searchOnlineBooks, testOnlineSource } from "../../services/scraper/index.js";
import type { OnlineBookResult, OnlineSource } from "../types.js";

export function registerOnlineHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.librarySearchOnlineBooks, async (_event, query: string) => {
    return searchOnlineBooks(query);
  });

  ipcMain.handle(IPC_CHANNELS.libraryTestOnlineSource, async (_event, query: string, source: OnlineSource) => {
    return testOnlineSource(query, source);
  });

  ipcMain.handle(IPC_CHANNELS.libraryImportOnlineBook, async (_event, book: OnlineBookResult) => {
    return importOnlineBook(book);
  });

  ipcMain.handle(IPC_CHANNELS.libraryOpenExternalAndAutoImport, async (_event, book: OnlineBookResult) => {
    return openExternalAndAutoImport(book);
  });
}
