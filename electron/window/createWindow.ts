import { BrowserWindow, shell } from "electron";
import path from "node:path";
import { rootDir, appIconPath } from "../paths.js";

let mainWindow: BrowserWindow | undefined;

export function getMainWindow(): BrowserWindow | undefined {
  return mainWindow;
}

export function httpUrl(value: unknown): URL | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function isSameOrigin(url: string, originUrl?: string): boolean {
  if (!originUrl) {
    return false;
  }

  try {
    return new URL(url).origin === new URL(originUrl).origin;
  } catch {
    return false;
  }
}

export async function openHttpExternal(url: unknown): Promise<boolean> {
  const parsed = httpUrl(url);
  if (!parsed) {
    return false;
  }

  await shell.openExternal(parsed.toString());
  return true;
}

export async function createWindow(): Promise<void> {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "Natsu",
    icon: appIconPath(),
    backgroundColor: "#f7fcff",
    titleBarStyle: "hiddenInset",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(rootDir, "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.setMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openHttpExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isSameOrigin(url, devServerUrl)) {
      return;
    }

    event.preventDefault();

    if (httpUrl(url)) {
      void openHttpExternal(url);
    }
  });

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(rootDir, "dist", "index.html"));
  }
}
