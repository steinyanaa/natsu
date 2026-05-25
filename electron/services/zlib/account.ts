import { BrowserWindow, type Session } from "electron";
import { withTimeout } from "../scraper/fetch.js";
import { getStore } from "../store.js";
import type { ZLibStatus, ZlibCache } from "../../ipc/types.js";

export async function fetchZlibAccount(sess: Session): Promise<ZLibStatus> {
  const CACHE_TTL = 30 * 60 * 1000;
  const cached = getStore().get("zlibCache");
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return { loggedIn: true, email: cached.email, remaining: cached.remaining, dailyLimit: cached.dailyLimit };
  }

  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      contextIsolation: true,
      javascript: true,
      nodeIntegration: false,
      sandbox: true,
      session: sess
    }
  });

  try {
    await withTimeout(
      win.loadURL("https://z-library.sk/profile", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }).then(() => true).catch(() => false),
      20000,
      false
    );

    // Check that profile page actually loaded (not redirected to /login)
    const currentUrl = win.webContents.getURL();
    try {
      if (new URL(currentUrl).pathname.includes("login")) {
        return { loggedIn: false };
      }
    } catch {
      // invalid URL, proceed with scraping
    }

    const result = await withTimeout(
      win.webContents.executeJavaScript(`
        (function() {
          const emailSelectors = [
            '.user-email', '[data-email]', '.profile-email',
            '.account-email', '.user-info .email'
          ];
          let email = '';
          for (const sel of emailSelectors) {
            const el = document.querySelector(sel);
            if (el) { email = (el.textContent || el.getAttribute('data-email') || '').trim(); break; }
          }
          if (!email) {
            const all = document.querySelectorAll('*');
            for (const el of all) {
              const text = (el.childNodes[0]?.textContent || '').trim();
              if (/^[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}$/i.test(text)) { email = text; break; }
            }
          }
          const bodyText = document.body.innerText || '';
          const quotaMatch = bodyText.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
          const remaining = quotaMatch ? parseInt(quotaMatch[1], 10) : undefined;
          const dailyLimit = quotaMatch ? parseInt(quotaMatch[2], 10) : undefined;
          return { email: email || undefined, remaining, dailyLimit };
        })()
      `, true).catch(() => ({ email: undefined, remaining: undefined, dailyLimit: undefined })),
      10000,
      { email: undefined, remaining: undefined, dailyLimit: undefined }
    ) as { email?: string; remaining?: number; dailyLimit?: number };

    // Only cache if we got at least some data
    if (result.email !== undefined || result.remaining !== undefined) {
      const cache: ZlibCache = {
        email: result.email,
        remaining: result.remaining,
        dailyLimit: result.dailyLimit,
        cachedAt: Date.now()
      };
      getStore().set("zlibCache", cache);
    }

    return { loggedIn: true, ...result };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
