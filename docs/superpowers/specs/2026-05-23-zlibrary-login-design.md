# Z-Library 登录与管理面板设计

**日期:** 2026-05-23  
**版本:** v1.0  
**目标版本:** v1.4.0

---

## 概览

为 Z-Library 书源新增账户登录功能和专属管理面板，让已登录用户享受更高的每日下载限额（Premium 无限制，免费账户 10 次/天 vs 游客 5 次/天）。

---

## 决策摘要

| 问题 | 决策 |
|------|------|
| 面板入口 | 书源列表中 zlibrary 卡片右侧新增"管理"按钮，点击后在同一卡片下方 **inline 展开**管理面板（非浮动弹层） |
| 登录方式 | 打开可见 BrowserWindow 加载 z-library 真实登录页，登录成功后自动关闭 |
| Session 隔离 | 专属命名持久化 partition：`persist:natsu-zlib` |
| 账户信息 | 显示登录邮箱 + 今日余量进度条（需请求账户页解析） |

---

## 架构

### Session 隔离

所有 Z-Library 网络请求（PoW 挑战、搜索、下载、登录、账户查询）全部使用 `session.fromPartition("persist:natsu-zlib")`。Electron 将该 partition 的 cookies 持久化到磁盘，重启 app 后保持登录状态。

**受影响的现有函数：**
- `fetchRenderedHtml(url, config)` — 新增可选参数 `sess?: Electron.Session`，当 source 是 zlibrary 时传入 zlibrary session
- `browserDownloadToBuffer(url, format, headers)` — 同上，新增可选 `sess` 参数，默认仍为 `session.defaultSession`

**判断是否为 zlibrary source：**  
新增辅助函数 `isZlibSource(source: OnlineSource): boolean`，条件为：`source.kind === "html"` 且解析后的 JSON config 中 `searchUrl` 包含 `"z-library"` 或 `"zlibrary"`（与现有 `normalizeOnlineSources` migration 检测逻辑一致）。在 `resolveCustomSourceConfig` 返回 `HtmlSourceConfig` 时同时返回 `isZlib` 标志，传递给 `fetchRenderedHtml` / `browserDownloadToBuffer`。

---

### IPC 处理器（electron/main.ts）

新增以下 IPC handler：

#### `zlib:status` → `ZLibStatus`
返回当前登录状态，无副作用。从 zlibrary partition 读取 cookies 判断是否已登录。

```ts
interface ZLibStatus {
  loggedIn: boolean;
  email?: string;           // 从 cookie 或上次缓存的账户页中读取
  remaining?: number;       // 今日剩余下载次数，undefined 表示未查询
  dailyLimit?: number;      // 上限（免费=10，Premium=999+）
}
```

#### `zlib:login` → `ZLibStatus`
1. 创建可见 `BrowserWindow`（800×600，居中）
2. 使用 `persist:natsu-zlib` partition
3. 加载 `${baseUrl}/login` 并附 User-Agent
4. 监听 `did-navigate`：若 URL 不再含 `/login`（跳转到主页/书库），视为登录成功
5. 超时 5 分钟或用户手动关闭窗口则取消
6. 成功后调用 `zlib:fetch-account` 获取邮箱和余量
7. 返回 `ZLibStatus`

#### `zlib:logout` → `void`
调用 `session.fromPartition("persist:natsu-zlib").clearStorageData()`，清除所有 cookies 和缓存。

#### `zlib:fetch-account` → `ZLibStatus`
1. 创建隐藏 BrowserWindow，使用 zlibrary partition
2. 加载 `${baseUrl}/my-books/`（用户书库页）
3. 等待页面加载完成
4. 执行 JS 提取：
   - 邮箱：`document.querySelector('.user-email, [data-email]')?.textContent`（fallback：多个候选选择器）
   - 余量：页面中"今日下载"或"daily downloads"相关文本，用正则解析 `(\d+)\s*/\s*(\d+)`
5. 缓存结果到 `store`（key: `zlib.accountCache`），TTL 30 分钟
6. 关闭窗口，返回 `ZLibStatus`

**失败处理：** 若页面无法解析（z-library 改版），返回 `{ loggedIn: true }` 而非抛出错误，UI 显示"登录中，余量不可用"。

---

### 前端组件

#### `src/onlineSources/ZLibraryManager.tsx`

新建独立组件，props：

```ts
interface ZLibraryManagerProps {
  sourceId: string;             // OnlineSource.id，用于更新 mirror URL
  baseUrl: string;              // 从 source.value JSON 解析的 baseUrl 字段
  onMirrorChange: (sourceId: string, newUrl: string) => void;
}
```

`SettingsPanel` 在渲染 zlibrary source 卡片时，从 `JSON.parse(source.value).baseUrl` 提取 `baseUrl` 传入。保存新镜像地址时，通过 `onMirrorChange` 回调更新 `source.value` JSON 中的 `baseUrl` 和 `searchUrl` 字段（`searchUrl` = `${newBaseUrl}/s/{query}`）。

状态机（`status: 'idle' | 'loading' | 'logging-in' | 'fetching'`）：

- **idle（未登录）：** 显示"游客 · 每日 5 次" + 登录按钮 + 镜像地址输入
- **idle（已登录）：** 显示邮箱 + 余量进度条 + 刷新按钮 + 退出登录 + 镜像地址
- **loading：** 骨架占位（查询账户状态中）
- **logging-in：** 按钮 disabled + spinner（等待登录窗口）
- **fetching：** 余量行显示 spinner（刷新中）

组件挂载时自动调用 `zlib:status` IPC，有缓存直接展示，无缓存则触发 `zlib:fetch-account`。

#### `src/settings/SettingsPanel.tsx` 改动

在渲染 online source 列表时，对 `kind === "html"` 且 value JSON 中含 `z-library` 域名的 source，在卡片的 `online-source-card-actions` 区域额外渲染"管理"按钮，点击后 toggle 展示 `<ZLibraryManager>` 组件（state: `managingZlibSourceId: string | null`）。

---

### 样式（src/styles.css）

新增以下 CSS 类，沿用现有 `color-mix(in oklab, …)` 玻璃风格：

```css
.zlib-manager-card          /* 管理面板容器，accent 渐变背景 */
.zlib-status-row            /* 状态点 + 邮箱行 */
.zlib-quota-row             /* 进度条容器 */
.zlib-quota-bar-track       /* 灰色底轨 */
.zlib-quota-bar-fill        /* accent 色填充 */
.zlib-divider               /* 分隔线 */
.zlib-mirror-row            /* 镜像地址行 */
```

所有颜色完全走 CSS 变量，自动适配 5 个内置主题（light / ramune / seaside / natsumatsuri / google-night）。

---

## 数据流

```
用户点"管理"
  → SettingsPanel toggle managingZlibSourceId
  → <ZLibraryManager> 挂载
  → IPC zlib:status (读 cookies，无网络请求)
    ├── 未登录 → 显示登录按钮
    └── 已登录 + 有缓存 → 直接展示邮箱/余量
             + 无缓存 → 触发 zlib:fetch-account

用户点"登录账户"
  → IPC zlib:login
  → 主进程打开可见 BrowserWindow (persist:natsu-zlib)
  → 用户在窗口内填表单、提交
  → did-navigate 离开 /login → 判定成功
  → 主进程 fetch-account → 返回 ZLibStatus
  → 前端更新面板

搜索 / 下载
  → fetchRenderedHtml / browserDownloadToBuffer
  → 检测 source 为 zlibrary → 注入 persist:natsu-zlib session
  → 复用已登录 cookies，无需重新 PoW，登录 cookies 同步生效
```

---

## 不在本次范围内

- Z-Library Premium 订阅购买
- 多账户切换
- 自动重试（余量用完时提示但不自动重登）
- 在搜索结果界面显示余量

---

## 文件变更清单

| 文件 | 变更类型 |
|------|---------|
| `electron/main.ts` | 新增 4 个 IPC handler；`fetchRenderedHtml`、`browserDownloadToBuffer` 加可选 `sess` 参数；新增 `zlibSession()` 辅助函数 |
| `electron/preload.cjs` | 暴露 `zlibStatus`、`zlibLogin`、`zlibLogout`、`zlibFetchAccount` 到 contextBridge |
| `src/types.ts` | 新增 `ZLibStatus` 接口 |
| `src/onlineSources/ZLibraryManager.tsx` | 新建 |
| `src/settings/SettingsPanel.tsx` | 渲染 zlibrary 管理按钮 + toggle 逻辑 |
| `src/styles.css` | 新增 `zlib-*` CSS 类 |
