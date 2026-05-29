import { ipcMain, BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../channels.js";
import { getStore } from "../../services/store.js";
import { fetchZlibAccount } from "../../services/zlib/account.js";
import { zlibSession } from "../../services/zlib/session.js";
import type { ZLibStatus } from "../types.js";

export function registerZlibHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.zlibStatus, async (): Promise<ZLibStatus> => {
    const sess = zlibSession();
    const cookies = await sess.cookies.get({ domain: ".z-library.sk" });
    const loggedIn = cookies.some((c) => c.name === "remix_userkey" || c.name === "remix_userid");
    if (!loggedIn) {
      return { loggedIn: false };
    }
    const cached = getStore().get("zlibCache");
    const CACHE_TTL = 30 * 60 * 1000;
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return { loggedIn: true, email: cached.email, remaining: cached.remaining, dailyLimit: cached.dailyLimit };
    }
    return { loggedIn: true };
  });

  ipcMain.handle(IPC_CHANNELS.zlibLogout, async (): Promise<void> => {
    await zlibSession().clearStorageData();
    getStore().delete("zlibCache" as never);
  });

  ipcMain.handle(IPC_CHANNELS.zlibLogin, async (): Promise<ZLibStatus> => {
    const sess = zlibSession();
    const baseUrl = "https://z-library.sk";

    return new Promise<ZLibStatus>((resolve) => {
      const loginWin = new BrowserWindow({
        show: true,
        width: 800,
        height: 620,
        center: true,
        title: "Z-Library 登录",
        webPreferences: {
          contextIsolation: true,
          javascript: true,
          nodeIntegration: false,
          sandbox: true,
          session: sess
        }
      });

      let settled = false;
      const finish = async (success: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        loginWin.webContents.off("did-navigate", onNavigate);
        if (!loginWin.isDestroyed()) {
          loginWin.off("closed", onClosed);
          loginWin.destroy();
        }
        if (success) {
          const status = await fetchZlibAccount(sess).catch(() => ({ loggedIn: true } as ZLibStatus));
          resolve(status);
        } else {
          resolve({ loggedIn: false });
        }
      };

      const onNavigate = (_event: Electron.Event, url: string) => {
        try {
          const urlObj = new URL(url);
          if (!urlObj.pathname.includes("login")) {
            void finish(true);
          }
        } catch {
          // ignore invalid URLs during navigation
        }
      };

      const onClosed = () => void finish(false);

      const timer = setTimeout(() => void finish(false), 5 * 60 * 1000);

      loginWin.webContents.on("did-navigate", onNavigate);
      loginWin.on("closed", onClosed);
      loginWin
        .loadURL(`${baseUrl}/login`, {
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        .catch(() => void finish(false));
    });
  });

  ipcMain.handle(IPC_CHANNELS.zlibFetchAccount, async (): Promise<ZLibStatus> => {
    const sess = zlibSession();
    const cookies = await sess.cookies.get({ domain: ".z-library.sk" });
    const loggedIn = cookies.some((c) => c.name === "remix_userkey" || c.name === "remix_userid");
    if (!loggedIn) {
      return { loggedIn: false };
    }
    // Force fresh fetch by clearing cache before calling
    getStore().delete("zlibCache" as never);
    return fetchZlibAccount(sess).catch(() => ({ loggedIn: true } as ZLibStatus));
  });
}
