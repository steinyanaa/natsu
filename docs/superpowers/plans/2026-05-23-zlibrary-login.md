# Z-Library Login & Management Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Z-Library account login system with a dedicated management panel that persists sessions across restarts and gives logged-in users more daily downloads.

**Architecture:** Named Electron partition `persist:natsu-zlib` holds all Z-Library cookies (search PoW + login); IPC handlers expose login/logout/status/fetch-account; a new `ZLibraryManager` React component renders inline below the source card in Settings.

**Tech Stack:** Electron (`session.fromPartition`, `BrowserWindow`, `ipcMain`), React + TypeScript, electron-store, CSS custom properties (MD3 tokens)

---

## File Map

| File | Change |
|------|--------|
| `src/types.ts` | Add `ZLibStatus` interface; add 4 methods to `ReaderApi` |
| `electron/main.ts` | Add `zlibSession()`, `isZlibUrl()`, `StoreShape.zlibCache`; add 4 IPC handlers; thread `sess` into `fetchRenderedHtml`, `loadHtml`, `searchHtmlAdapterBooks`, `browserDownloadToBuffer`, `importOnlineBook` |
| `electron/preload.cjs` | Expose 4 new `zlib:*` IPC methods via `contextBridge` |
| `src/styles.css` | Add `zlib-*` CSS classes |
| `src/onlineSources/ZLibraryManager.tsx` | New component — management panel UI |
| `src/settings/SettingsPanel.tsx` | Add "管理" button + `managingZlibSourceId` state + `<ZLibraryManager>` render |
| `package.json` | Bump to `1.4.0` |
| `CHANGELOG.md` | Add v1.4.0 entry |

---

## Task 1: Add `ZLibStatus` to `src/types.ts` and `ReaderApi`

**Files:**
- Modify: `src/types.ts` (after existing interfaces, before `ReaderApi`)

- [ ] **Step 1: Add `ZLibStatus` interface and extend `ReaderApi`**

In `src/types.ts`, add after the `OnlineSource` interface (around line 120):

```typescript
export interface ZLibStatus {
  loggedIn: boolean;
  email?: string;
  remaining?: number;
  dailyLimit?: number;
}
```

Then in the `ReaderApi` interface (after `getSessionsByDate` at line 289), add:

```typescript
  zlibStatus(): Promise<ZLibStatus>;
  zlibLogin(): Promise<ZLibStatus>;
  zlibLogout(): Promise<void>;
  zlibFetchAccount(): Promise<ZLibStatus>;
```

- [ ] **Step 2: Run TypeScript check to confirm no errors**

```
npx tsc --noEmit
```

Expected: no errors (new methods are not yet wired, but the interface is valid)

- [ ] **Step 3: Commit**

```
git add src/types.ts
git commit -m "feat(zlib): add ZLibStatus interface and ReaderApi stubs"
```

---

## Task 2: Add foundation to `electron/main.ts`

**Files:**
- Modify: `electron/main.ts` (StoreShape, helper functions, IPC handler stubs)

- [ ] **Step 1: Extend `StoreShape` with `zlibCache`**

Find the `StoreShape` interface around line 226:

```typescript
interface StoreShape {
  books: BookRecord[];
  preferences: ReaderPreferences;
  collections: Collection[];
}
```

Replace with:

```typescript
interface ZlibCache {
  email?: string;
  remaining?: number;
  dailyLimit?: number;
  cachedAt: number;
}

interface StoreShape {
  books: BookRecord[];
  preferences: ReaderPreferences;
  collections: Collection[];
  zlibCache?: ZlibCache;
}
```

- [ ] **Step 2: Add `zlibSession()` and `isZlibUrl()` helper functions**

Add these two functions after the `withTimeout` function (around line 1445):

```typescript
function zlibSession(): Electron.Session {
  return session.fromPartition("persist:natsu-zlib");
}

function isZlibUrl(url: string): boolean {
  return url.includes("z-library") || url.includes("zlibrary");
}
```

- [ ] **Step 3: Add `zlib:status` and `zlib:logout` IPC handlers**

At the end of `registerIpc()`, before the closing `}`, add:

```typescript
  ipcMain.handle("zlib:status", async (): Promise<ZLibStatus> => {
    const sess = zlibSession();
    const cookies = await sess.cookies.get({ domain: ".z-library.sk" });
    const loggedIn = cookies.some((c) => c.name === "remix_userkey" || c.name === "remix_userid");
    if (!loggedIn) {
      return { loggedIn: false };
    }
    const cached = store.get("zlibCache");
    const CACHE_TTL = 30 * 60 * 1000;
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return { loggedIn: true, email: cached.email, remaining: cached.remaining, dailyLimit: cached.dailyLimit };
    }
    return { loggedIn: true };
  });

  ipcMain.handle("zlib:logout", async (): Promise<void> => {
    await zlibSession().clearStorageData();
    store.delete("zlibCache");
  });
```

- [ ] **Step 4: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: errors about `ZLibStatus` not found in main.ts — that's fine since it's declared in `src/types.ts` (renderer-side). In next step we add a local type. Actually `ZLibStatus` needs to be defined in main.ts too (or imported). Add a local interface at the top of `electron/main.ts` (after the imports):

```typescript
interface ZLibStatus {
  loggedIn: boolean;
  email?: string;
  remaining?: number;
  dailyLimit?: number;
}
```

Run again:

```
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```
git add electron/main.ts
git commit -m "feat(zlib): add zlibSession helper, StoreShape.zlibCache, status/logout IPC"
```

---

## Task 3: Thread `persist:natsu-zlib` session through search and download

**Files:**
- Modify: `electron/main.ts` (`fetchRenderedHtml`, `loadHtml`, `searchHtmlAdapterBooks`, `browserDownloadToBuffer`, `importOnlineBook`)

The goal: when the source is zlibrary, use `zlibSession()` so that PoW cookies and login cookies are shared across search and download steps.

- [ ] **Step 1: Update `fetchRenderedHtml` to accept optional session**

Find `async function fetchRenderedHtml(url: string, config: HtmlSourceConfig): Promise<string>` (line ~1447).

Change signature and add `partition` option:

```typescript
async function fetchRenderedHtml(
  url: string,
  config: HtmlSourceConfig,
  sess?: Electron.Session
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
  // rest of function unchanged
```

- [ ] **Step 2: Update `loadHtml` to pass session through**

Find `async function loadHtml(url: string, config: HtmlSourceConfig): Promise<string>` (line ~1555).

Change to:

```typescript
async function loadHtml(url: string, config: HtmlSourceConfig, sess?: Electron.Session): Promise<string> {
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
```

- [ ] **Step 3: Update `searchHtmlAdapterBooks` to detect zlibrary and pass session**

Find `async function searchHtmlAdapterBooks(query: string, config: HtmlSourceConfig)` (line ~1664).

Change to:

```typescript
async function searchHtmlAdapterBooks(query: string, config: HtmlSourceConfig): Promise<OnlineBookResult[]> {
  const url = customSourceSearchUrl(config.searchUrl, query);

  if (!url) {
    return [];
  }

  const sess = isZlibUrl(url) ? zlibSession() : undefined;
  const html = await loadHtml(url, config, sess);
  // rest of function unchanged
```

- [ ] **Step 4: Update `browserDownloadToBuffer` to accept optional session**

Find `async function browserDownloadToBuffer(url: string, format: BookFormat, headers: Headers, timeoutMs = 60000)` (line ~791).

Change signature and use the passed session (falling back to current defaultSession behavior):

```typescript
async function browserDownloadToBuffer(
  url: string,
  format: BookFormat,
  headers: Headers,
  timeoutMs = 60000,
  sess?: Electron.Session
): Promise<Buffer | undefined> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "natsu-download-"));
  const tempPath = path.join(tempDir, `download.${format}`);
  const downloadSession = sess ?? session.defaultSession;
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      javascript: true,
      nodeIntegration: false,
      sandbox: true,
      ...(sess ? { session: sess } : {})
    }
  });
  // rest of function unchanged (downloadSession already used throughout)
```

- [ ] **Step 5: Update `importOnlineBook` to pass zlibSession to browser download**

Find `async function importOnlineBook(book: OnlineBookResult)` (line ~866).

Near the bottom of the function where `browserDownloadToBuffer` is called:

```typescript
  const sess = isZlibUrl(downloadUrl) ? zlibSession() : undefined;
  const browserBuffer = await browserDownloadToBuffer(downloadUrl, format, headers, 60000, sess);
```

- [ ] **Step 6: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```
git add electron/main.ts
git commit -m "feat(zlib): thread persist:natsu-zlib session into search and download"
```

---

## Task 4: Add `zlib:login` IPC handler

**Files:**
- Modify: `electron/main.ts` (`registerIpc`)

- [ ] **Step 1: Add `zlib:login` handler**

In `registerIpc()`, after the `zlib:logout` handler, add:

```typescript
  ipcMain.handle("zlib:login", async (): Promise<ZLibStatus> => {
    const sess = zlibSession();
    const cookies = await sess.cookies.get({ domain: ".z-library.sk" });
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
        loginWin.off("closed", onClosed);
        loginWin.webContents.off("did-navigate", onNavigate);
        if (!loginWin.isDestroyed()) loginWin.destroy();
        if (success) {
          // fetch account info
          const status = await fetchZlibAccount(sess).catch(() => ({ loggedIn: true } as ZLibStatus));
          resolve(status);
        } else {
          resolve({ loggedIn: false });
        }
      };

      const onNavigate = (_event: Electron.Event, url: string) => {
        if (!url.includes("/login")) {
          void finish(true);
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
```

- [ ] **Step 2: Add `fetchZlibAccount` helper (used by both login and fetch-account handlers)**

Add this function above `registerIpc()`:

```typescript
async function fetchZlibAccount(sess: Electron.Session): Promise<ZLibStatus> {
  const CACHE_TTL = 30 * 60 * 1000;
  const cached = store.get("zlibCache");
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
          // fallback: find any element containing @ that looks like email
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

    const cache: ZlibCache = {
      email: result.email,
      remaining: result.remaining,
      dailyLimit: result.dailyLimit,
      cachedAt: Date.now()
    };
    store.set("zlibCache", cache);

    return { loggedIn: true, ...result };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
```

- [ ] **Step 3: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```
git add electron/main.ts
git commit -m "feat(zlib): add zlib:login IPC handler and fetchZlibAccount helper"
```

---

## Task 5: Add `zlib:fetch-account` IPC handler

**Files:**
- Modify: `electron/main.ts` (`registerIpc`)

- [ ] **Step 1: Add `zlib:fetch-account` handler**

In `registerIpc()`, after the `zlib:login` handler, add:

```typescript
  ipcMain.handle("zlib:fetch-account", async (): Promise<ZLibStatus> => {
    const sess = zlibSession();
    const cookies = await sess.cookies.get({ domain: ".z-library.sk" });
    const loggedIn = cookies.some((c) => c.name === "remix_userkey" || c.name === "remix_userid");
    if (!loggedIn) {
      return { loggedIn: false };
    }
    // force fresh fetch by clearing cache before calling
    store.delete("zlibCache");
    return fetchZlibAccount(sess).catch(() => ({ loggedIn: true } as ZLibStatus));
  });
```

- [ ] **Step 2: Update `zlib:status` to use `fetchZlibAccount` correctly**

The existing `zlib:status` reads cached data fine. No changes needed.

- [ ] **Step 3: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```
git add electron/main.ts
git commit -m "feat(zlib): add zlib:fetch-account IPC handler"
```

---

## Task 6: Expose IPC in preload + add CSS classes

**Files:**
- Modify: `electron/preload.cjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Add 4 zlib methods to `contextBridge` in `electron/preload.cjs`**

Find the last entry in the `contextBridge.exposeInMainWorld("readerApi", { ... })` block (the `getSessionsByDate` line):

```javascript
  getSessionsByDate: () => ipcRenderer.invoke("library:getSessionsByDate"),
```

Add after it (before the closing `}`):

```javascript
  zlibStatus: () => ipcRenderer.invoke("zlib:status"),
  zlibLogin: () => ipcRenderer.invoke("zlib:login"),
  zlibLogout: () => ipcRenderer.invoke("zlib:logout"),
  zlibFetchAccount: () => ipcRenderer.invoke("zlib:fetch-account"),
```

- [ ] **Step 2: Add `zlib-*` CSS classes to `src/styles.css`**

Add at the end of the file (or in the online-source section, consistent with existing `.online-source-card` styles):

```css
/* ── Z-Library management panel ── */
.zlib-manager-card {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid color-mix(in oklab, var(--md-sys-color-outline-variant) 72%, transparent);
  border-radius: 14px;
  background:
    linear-gradient(135deg, color-mix(in oklab, var(--reader-accent) 8%, transparent), transparent 55%),
    color-mix(in oklab, var(--md-sys-color-surface) 58%, transparent);
  margin-top: 6px;
}

.zlib-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zlib-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.zlib-status-dot.on {
  background: #4caf50;
}

.zlib-status-dot.off {
  background: color-mix(in oklab, var(--reader-muted) 60%, transparent);
}

.zlib-status-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--reader-ink);
}

.zlib-status-email {
  font-size: 12px;
  color: var(--reader-muted);
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zlib-quota-row {
  display: grid;
  gap: 5px;
}

.zlib-quota-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.zlib-quota-labels span:first-child {
  color: var(--reader-muted);
}

.zlib-quota-labels span:last-child {
  color: var(--reader-accent);
  font-weight: 800;
}

.zlib-quota-bar-track {
  height: 5px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--md-sys-color-outline-variant) 50%, transparent);
  overflow: hidden;
}

.zlib-quota-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--reader-accent);
  transition: width 0.3s;
}

.zlib-divider {
  height: 1px;
  background: color-mix(in oklab, var(--md-sys-color-outline-variant) 50%, transparent);
}

.zlib-mirror-row {
  display: grid;
  gap: 5px;
}

.zlib-mirror-label {
  font-size: 11px;
  color: var(--reader-muted);
}

.zlib-mirror-input-row {
  display: flex;
  gap: 6px;
}

.zlib-refresh-btn {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: transparent;
  cursor: pointer;
  color: var(--reader-muted);
  font-family: inherit;
}

.zlib-refresh-btn:hover {
  background: color-mix(in oklab, var(--md-sys-color-surface-container) 80%, transparent);
}

.zlib-login-hint {
  font-size: 11px;
  color: var(--reader-muted);
  text-align: center;
  margin: 0;
}
```

- [ ] **Step 3: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors (preload.cjs is not checked by TS but the ReaderApi interface now needs to match — the methods were added in Task 1)

- [ ] **Step 4: Commit**

```
git add electron/preload.cjs src/styles.css
git commit -m "feat(zlib): expose zlib IPC in preload, add zlib-* CSS classes"
```

---

## Task 7: Create `src/onlineSources/ZLibraryManager.tsx`

**Files:**
- Create: `src/onlineSources/ZLibraryManager.tsx`

- [ ] **Step 1: Check the directory exists**

```
ls src/onlineSources/
```

Expected: `PresetsRow.tsx` and other files visible.

- [ ] **Step 2: Create the component**

Create `src/onlineSources/ZLibraryManager.tsx`:

```typescript
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import type { ZLibStatus } from "../types";

interface ZLibraryManagerProps {
  sourceId: string;
  baseUrl: string;
  onMirrorChange: (sourceId: string, newUrl: string) => void;
}

type PanelStatus = "loading" | "idle" | "logging-in" | "fetching";

export function ZLibraryManager({ sourceId, baseUrl, onMirrorChange }: ZLibraryManagerProps) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [zlib, setZlib] = useState<ZLibStatus>({ loggedIn: false });
  const [mirrorInput, setMirrorInput] = useState(baseUrl);

  const updateZlib = (s: ZLibStatus) => {
    setZlib(s);
    setStatus("idle");
  };

  useEffect(() => {
    window.readerApi.zlibStatus().then((s) => {
      if (s.loggedIn && s.remaining === undefined) {
        setStatus("fetching");
        window.readerApi.zlibFetchAccount().then(updateZlib).catch(() => setStatus("idle"));
      } else {
        updateZlib(s);
      }
    }).catch(() => setStatus("idle"));
  }, []);

  const handleLogin = () => {
    setStatus("logging-in");
    window.readerApi.zlibLogin().then(updateZlib).catch(() => setStatus("idle"));
  };

  const handleLogout = () => {
    window.readerApi.zlibLogout().then(() => {
      setZlib({ loggedIn: false });
      setStatus("idle");
    }).catch(() => undefined);
  };

  const handleRefresh = () => {
    setStatus("fetching");
    window.readerApi.zlibFetchAccount().then(updateZlib).catch(() => setStatus("idle"));
  };

  const handleSaveMirror = () => {
    const url = mirrorInput.trim().replace(/\/$/, "");
    if (!url) return;
    onMirrorChange(sourceId, url);
  };

  const quotaPercent =
    zlib.remaining !== undefined && zlib.dailyLimit
      ? Math.round((zlib.remaining / zlib.dailyLimit) * 100)
      : 0;

  return (
    <div className="zlib-manager-card">
      {/* Account status row */}
      <div className="zlib-status-row">
        <span className={`zlib-status-dot ${zlib.loggedIn ? "on" : "off"}`} />
        <span className="zlib-status-label">
          {status === "loading" ? "查询中…" : zlib.loggedIn ? "已登录" : "未登录"}
        </span>
        {zlib.loggedIn && zlib.email ? (
          <span className="zlib-status-email" title={zlib.email}>{zlib.email}</span>
        ) : !zlib.loggedIn && status === "idle" ? (
          <span className="zlib-status-email">游客 · 每日 5 次</span>
        ) : null}
        {zlib.loggedIn && status === "idle" ? (
          <button className="zlib-refresh-btn" type="button" onClick={handleRefresh}>↻ 刷新</button>
        ) : null}
        {status === "fetching" ? (
          <span className="zlib-status-email">刷新中…</span>
        ) : null}
      </div>

      {/* Quota bar (logged-in only) */}
      {zlib.loggedIn && zlib.remaining !== undefined && zlib.dailyLimit ? (
        <div className="zlib-quota-row">
          <div className="zlib-quota-labels">
            <span>今日下载余量</span>
            <span>{zlib.remaining} / {zlib.dailyLimit} 次</span>
          </div>
          <div className="zlib-quota-bar-track">
            <div className="zlib-quota-bar-fill" style={{ width: `${quotaPercent}%` }} />
          </div>
        </div>
      ) : null}

      <div className="zlib-divider" />

      {/* Login / logout actions */}
      {zlib.loggedIn ? (
        <button
          className="soft-button pressable"
          type="button"
          style={{ color: "var(--reader-danger, #b3261e)", borderColor: "var(--reader-danger, #b3261e)" }}
          onClick={handleLogout}
        >
          退出登录
        </button>
      ) : (
        <>
          <button
            className="soft-button pressable"
            type="button"
            disabled={status === "logging-in" || status === "loading"}
            onClick={handleLogin}
          >
            {status === "logging-in" ? "等待登录窗口…" : "🔑 登录账户"}
          </button>
          <p className="zlib-login-hint">将打开登录窗口，完成后自动关闭</p>
        </>
      )}

      <div className="zlib-divider" />

      {/* Mirror URL */}
      <div className="zlib-mirror-row">
        <p className="zlib-mirror-label">镜像地址</p>
        <div className="zlib-mirror-input-row">
          <input
            className="text-setting-input"
            value={mirrorInput}
            onChange={(e) => setMirrorInput(e.target.value)}
            placeholder="https://zh.z-library.sk"
          />
          <button
            className="soft-button pressable compact-action"
            type="button"
            onClick={handleSaveMirror}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```
git add src/onlineSources/ZLibraryManager.tsx
git commit -m "feat(zlib): add ZLibraryManager component"
```

---

## Task 8: Integrate into `src/settings/SettingsPanel.tsx`

**Files:**
- Modify: `src/settings/SettingsPanel.tsx`

- [ ] **Step 1: Add import for `ZLibraryManager`**

At the top of `src/settings/SettingsPanel.tsx`, add to imports:

```typescript
import { ZLibraryManager } from "../onlineSources/ZLibraryManager";
```

- [ ] **Step 2: Add `isZlibSource` helper inside `OnlineSourceManager`**

Inside the `OnlineSourceManager` function body, before the `return`, add:

```typescript
  const isZlibSource = (source: OnlineSource): boolean => {
    if (source.kind !== "html") return false;
    try {
      const parsed = JSON.parse(source.value) as Record<string, unknown>;
      const searchUrl = typeof parsed.searchUrl === "string" ? parsed.searchUrl : "";
      return searchUrl.includes("z-library") || searchUrl.includes("zlibrary");
    } catch {
      return false;
    }
  };

  const zlibBaseUrl = (source: OnlineSource): string => {
    try {
      const parsed = JSON.parse(source.value) as Record<string, unknown>;
      return typeof parsed.baseUrl === "string" ? parsed.baseUrl : "https://z-library.sk";
    } catch {
      return "https://z-library.sk";
    }
  };
```

- [ ] **Step 3: Add `managingZlibSourceId` state**

Inside the `OnlineSourceManager` function, add the state (alongside existing state if any):

```typescript
  const [managingZlibSourceId, setManagingZlibSourceId] = useState<string | null>(null);
```

- [ ] **Step 4: Add "管理" button and `<ZLibraryManager>` to each source card**

Find the `sources.map((source) => (` render block (line ~750). In the `online-source-card-actions` div, after the existing `<span className="online-source-kind">` and before the test button, add the "管理" button for zlibrary sources:

```typescript
                {isZlibSource(source) ? (
                  <button
                    className="soft-button pressable compact-action"
                    type="button"
                    onClick={() => setManagingZlibSourceId(
                      managingZlibSourceId === source.id ? null : source.id
                    )}
                  >
                    管理
                  </button>
                ) : null}
```

Then after the closing `</article>` tag of each card (after the textarea input section but still inside `sources.map`), add the inline manager panel. The structure should look like:

```typescript
        {sources.map((source) => (
          <React.Fragment key={source.id}>
            <article className="online-source-card">
              {/* ... existing card content ... */}
            </article>
            {managingZlibSourceId === source.id && isZlibSource(source) ? (
              <ZLibraryManager
                sourceId={source.id}
                baseUrl={zlibBaseUrl(source)}
                onMirrorChange={(id, newUrl) => {
                  try {
                    const parsed = JSON.parse(
                      sources.find((s) => s.id === id)?.value ?? "{}"
                    ) as Record<string, unknown>;
                    parsed.baseUrl = newUrl;
                    parsed.searchUrl = `${newUrl}/s/{query}`;
                    onSourceChange(id, { value: JSON.stringify(parsed) });
                  } catch {
                    /* ignore */
                  }
                }}
              />
            ) : null}
          </React.Fragment>
        ))}
```

**Important:** The `key` prop must move from `<article>` to `<React.Fragment>`. Remove `key={source.id}` from `<article>` and put it on `<React.Fragment key={source.id}>`.

Also add `React` to the imports at the top if not already imported as a namespace:
```typescript
import * as React from "react";
```
(It's already imported as `import type * as React from "react"` — change `type` to value import for `React.Fragment`.)

- [ ] **Step 5: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Start dev server and test UI**

```
npm run dev
```

1. Open Settings → Online Sources
2. Add a zlibrary HTML source (use the preset or paste JSON config)
3. Click "管理" button — panel should expand below the card
4. Click "管理" again — panel should collapse
5. Click "登录账户" — BrowserWindow should open with z-library login page
6. After login, window should close and panel should show email + quota

- [ ] **Step 7: Commit**

```
git add src/settings/SettingsPanel.tsx
git commit -m "feat(zlib): integrate ZLibraryManager into SettingsPanel"
```

---

## Task 9: Version bump, CHANGELOG, typecheck, dist

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump version to 1.4.0 in `package.json`**

Find `"version": "1.3.3"` and change to `"version": "1.4.0"`.

- [ ] **Step 2: Add v1.4.0 entry to `CHANGELOG.md`**

Add at the top (after the `# Changelog` heading):

```markdown
## [1.4.0] - 2026-05-23

### Added
- **Z-Library 账户管理面板**：Settings > Online Sources 中，zlibrary 书源卡片新增"管理"按钮，点击展开专属管理面板。
- **登录功能**：打开真实 Z-Library 登录页（可见 BrowserWindow），登录成功后自动关闭并同步账户信息。
- **今日余量显示**：已登录用户在管理面板中可查看邮箱地址和今日下载余量进度条（免费账户 10 次/天；Premium 无限制）。
- **镜像地址管理**：可在管理面板内直接修改并保存 Z-Library 镜像地址，无需手动编辑 JSON 配置。
- **Session 持久化**：所有 Z-Library 请求（搜索 PoW、下载、登录）统一走 `persist:natsu-zlib` 命名分区，重启 App 后保持登录状态。
```

- [ ] **Step 3: Final TypeScript check and build**

```
npx tsc --noEmit
npm run build
```

Expected: build succeeds with no errors

- [ ] **Step 4: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore: bump to v1.4.0, update CHANGELOG"
```

---

## Self-Review

**Spec coverage:**
- ✅ `zlib:status` — Task 2
- ✅ `zlib:login` visible BrowserWindow — Task 4
- ✅ `zlib:logout` clear storage — Task 2
- ✅ `zlib:fetch-account` scrape email/quota — Task 5
- ✅ `persist:natsu-zlib` partition threaded through search + download — Task 3
- ✅ `ZLibraryManager` component with all states — Task 7
- ✅ "管理" button + inline expansion in SettingsPanel — Task 8
- ✅ CSS classes for all 5 themes (via CSS variables) — Task 6
- ✅ 30-min cache TTL — Tasks 4+5
- ✅ Failure fallback (return `{ loggedIn: true }` if scraping fails) — Task 4 (`fetchZlibAccount`)
- ✅ Mirror URL update via `onMirrorChange` — Task 7+8

**Type consistency:** `ZLibStatus` is defined in both `src/types.ts` (for renderer) and locally in `electron/main.ts` (for main process) — identical shape, no cross-boundary import needed.

**Placeholder scan:** No TBDs. All code is complete.
