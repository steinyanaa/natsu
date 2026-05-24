import { BrowserWindow, net, type Session } from "electron";
import type { HtmlSourceConfig } from "../../ipc/types.js";

export async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const response = await net.fetch(url, {
    headers: headers ? new Headers(headers) : undefined
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export async function fetchHtml(url: string, headers?: Record<string, string>): Promise<string> {
  const response = await net.fetch(url, {
    headers: headers ? new Headers(headers) : undefined
  });

  if (!response.ok) {
    return "";
  }

  return response.text();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function fetchRenderedHtml(
  url: string,
  config: HtmlSourceConfig,
  sess?: Session
): Promise<string> {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      javascript: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      ...(sess ? { session: sess } : {})
    }
  });

  try {
    const headers = config.headers ?? {};
    const userAgent = headers["User-Agent"] || headers["user-agent"];
    const extraHeaders = Object.entries(headers)
      .filter(([key]) => key.toLowerCase() !== "user-agent")
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    const timeout = Math.max(1000, Math.min(config.timeout ?? 10000, 30000));

    const loaded = await withTimeout(
      win
        .loadURL(url, {
          userAgent,
          extraHeaders: extraHeaders || undefined
        })
        .then(() => true)
        .catch(() => false),
      timeout,
      false
    );

    if (!loaded && !win.webContents.getURL()) {
      return "";
    }

    if (config.waitForSelector) {
      const selector = JSON.stringify(config.waitForSelector);
      await withTimeout(
        win.webContents
          .executeJavaScript(
            `new Promise((resolve) => {
            const selector = ${selector};
            const deadline = Date.now() + ${timeout};
            const tick = () => {
              if (document.querySelector(selector)) return resolve(true);
              if (Date.now() > deadline) return resolve(false);
              setTimeout(tick, 120);
            };
            tick();
          })`,
            true
          )
          .then(() => true)
          .catch(() => false),
        timeout + 500,
        false
      );
    }

    if (config.autoScroll) {
      await withTimeout(
        win.webContents
          .executeJavaScript(
            `new Promise((resolve) => {
            let y = 0;
            const step = Math.max(260, Math.floor(window.innerHeight * 0.7));
            const timer = setInterval(() => {
              y += step;
              window.scrollTo(0, y);
              if (y >= Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight) {
                clearInterval(timer);
                setTimeout(resolve, 350);
              }
            }, 120);
            setTimeout(() => {
              clearInterval(timer);
              resolve();
            }, 5000);
          })`,
            true
          )
          .then(() => undefined)
          .catch(() => undefined),
        6500,
        undefined
      );
    }

    await sleep(Math.max(0, Math.min(config.delay ?? 800, 5000)));

    return await withTimeout(
      win.webContents.executeJavaScript("document.documentElement.outerHTML", true).catch(() => ""),
      3000,
      ""
    );
  } catch {
    return "";
  } finally {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
}

export async function loadHtml(url: string, config: HtmlSourceConfig, sess?: Session): Promise<string> {
  if (config.renderJs) {
    const rendered = await fetchRenderedHtml(url, config, sess);
    if (rendered) {
      return rendered;
    }
  }

  if (config.delay && config.delay > 0) {
    await sleep(Math.max(0, Math.min(config.delay, 5000)));
  }

  return fetchHtml(url, config.headers);
}
