# Changelog

## [Unreleased]

### Added

- **PDF / 漫画首页封面** — PDF 与 CBZ/ZIP/CBR/RAR 现在自动以首页缩略图作为书架封面。
- **封面懒加载** — 封面改为按书架可见区域点播加载（IntersectionObserver），去掉旧的 200 本 EPUB 上限；大书库滚动更流畅。
- **自动滚动阅读** — reader 支持匀速连续自动滚动：工具栏按钮 / 空格切换，`,` `.` 调速，手动滚轮暂停，到底自动停；速度可在 设置 → 自动滚动 调整。

## [1.4.1] - 2026-05-29

> 纯架构重构版本：主进程与前端按领域全面拆分，单元测试从 8 增至 116，**用户可见行为零变更**。

### Changed

- **主进程架构拆分**：`electron/main.ts` 从 2903 行精简到 43 行（仅保留应用生命周期接线），按领域拆分为独立模块：
  - `electron/paths.ts` — 路径解析（rootDir / 图标 / library / cover 目录）
  - `electron/ipc/types.ts` — 跨领域 IPC 类型集中定义
  - `electron/ipc/register.ts` + `electron/ipc/handlers/*` — 40 个 IPC handler 按 library / online / preferences / covers / system / zlib 六个领域分文件
  - `electron/services/store.ts` — electron-store 单例，改用 `initStore()` / `getStore()` 守护式访问
  - `electron/services/library.ts` — 导入 / 哈希 / 进度去抖
  - `electron/services/covers.ts` + `electron/services/protocol.ts` — 封面与 `manga-reader://` 协议
  - `electron/services/scraper/*` — gutenberg / json / html / rss / custom 适配器 + dom / fetch / index 调度器
  - `electron/services/online-import.ts` — 在线下载与自动导入
  - `electron/services/zlib/*` — Z-Library session 与账户
  - `electron/window/createWindow.ts` — 窗口创建与生命周期
- **preload 拆分**：`electron/preload.cjs` 拆为 `electron/preload/groups/*`（library / online / preferences / covers / zlib / system）+ `index.cjs` 合并入口，`window.readerApi` 保持完全相同的扁平 40 键结构，渲染进程零改动。
- **前端 hook 拆分**：`src/App.tsx` 从 1075 行精简到 704 行，按领域抽出两个自定义 hook（与既有 `useLibrary` / `useReaderNavigation` / `useBookShelf` 同构）：
  - `src/app/useEpubCovers.ts` — EPUB 封面的磁盘缓存 / 提取 / Google Books 回退加载（限并发）与 blob 释放。
  - `src/app/useOnlineSearch.ts` — 在线搜索面板状态与三条导入路径（直链下载 / 浏览器回退 / 搜索）。
- **前端内联组件拆分**：`App.tsx` 中的 `EmptyShelf` / `EditMetaDialog`（移至 `src/bookshelf/`）、`ConfirmDialog` / `CommandPalette`（移至 `src/components/`）拆为独立文件，`percentLabel` 随 `CommandPalette` 内聚迁移。
- `src/reader/chapterHeight.ts` — 从 `TextPane.tsx` 抽出纯函数 `estimateChapterHeight`（虚拟滚动的章节高度估算）。
- `src/readers/epubPaths.ts` — 从 `epub.ts`（933 → 875 行）抽出纯路径 / href / MIME 工具组（`resolvePath` / `splitHref` / `chapterDomId` / `mimeFromPath` 等）。
- `src/onlineSources/OnlineSourceManager.tsx` — 从 `SettingsPanel.tsx`（981 → 656 行）抽出在线书源管理 UI（书源卡片 / 测试 / 草稿添加 / 书源包导入 + `OnlineSourceTestView`）。
- `src/reader/useReaderChrome.ts` — 从 `ReaderScreen.tsx`（736 → 694 行）抽出顶/底控件与光标的自动隐藏逻辑（`controlsVisible` / `cursorHidden` / `revealChrome` / `hideChrome` + 两个计时 effect）。
- `percentLabel` 去重：合并 `ReaderScreen` 与 `CommandPalette` 的两份拷贝到 `reader/utils.ts`，统一导出。
- `src/reader/comicLayout.ts` — 从 `ComicPane.tsx`（422 → 405 行）抽出纯函数 `computeSpreads`（漫画单页/双页跨页分组，含 coverSolo 与奇偶尾页处理）。
- 行为零变更；纯架构重构。

### Added

- **后端单元测试**：为 `services/store`、`services/library`、`services/scraper/dom`、`services/scraper/custom` 新增 vitest 测试；新增 `ipc/register` 契约测试（断言 `IPC_CHANNELS` 每个 channel 恰好注册一个 handler）。
- **前端单元测试**：新增 `readers/text`（BOM 探测 / gb18030 回退 / 章节切分 / HTML 转义）、`stats/speedTracker`（滚动采样与 CPM 计算）、`reader/utils`（字体栈 / 进度时间戳）、`reader/chapterHeight`（高度估算边界）、`readers/epubPaths`（路径解析 / DOM id / 外链判定 / MIME 映射）五组测试，并为 `reader/utils` 补充 `percentLabel`（取整 / 钳制 / 空值）、`reader/comicLayout`（跨页分组的 coverSolo 与奇偶边界）用例。测试总数从 8 增至 116。

### Fixed

- `.gitignore` 新增 `test-*.cjs` 与 `.superpowers/`，避免一次性源验证脚本与内部目录误入库。

---

## [1.4.0] - 2026-05-23

### Added
- **Z-Library 账户管理面板**：Settings > Online Sources 中，zlibrary 书源卡片新增"管理"按钮，点击展开专属管理面板。
- **登录功能**：打开真实 Z-Library 登录页（可见 BrowserWindow），登录成功后自动关闭并同步账户信息。
- **今日余量显示**：已登录用户在管理面板中可查看邮箱地址和今日下载余量进度条（免费账户 10 次/天；Premium 无限制）。
- **镜像地址管理**：可在管理面板内直接修改并保存 Z-Library 镜像地址，无需手动编辑 JSON 配置。
- **Session 持久化**：所有 Z-Library 请求（搜索 PoW、下载、登录）统一走 `persist:natsu-zlib` 命名分区，重启 App 后保持登录状态。

---

## v1.3.3 - 2026-05-23

### Bug fixes

- **zlibrary 下载修复** — v1.3.2 的导入依然失败，原因是：
  1. `net.fetch` 被 z-library 的 TLS 指纹检测封锁后会无限等待 → 现在加了 15 秒超时，失败后自动回退浏览器下载。
  2. 浏览器回退下载使用的是独立 partition，没有搜索时设置的 PoW cookie（`c_token`），需要重新过 PoW 挑战 → 现在改为使用 `session.defaultSession`，直接复用搜索时已获得的 cookie，无需重新挑战。
- **旧书源自动迁移** — v1.3.1/v1.3.2 添加的 zlibrary 书源使用了错误选择器，之前需要手动删除再重新添加。现在启动时自动检测并升级旧配置，无需任何手动操作。

### 注意事项

Z-Library 对游客有 **每日 5 次** 下载限制（IP 维度）。超限后 `/dl/` 页面会显示"每日限额已用完"，此时导入会失败。解决方法：注册账号后登录 z-library，下载次数可提升至每日 10 次（Premium 无限制）。

---

## v1.3.2 - 2026-05-23

### Bug fixes

- **zlibrary 书源真正修好了** — 1.3.1 改了 `kind` 但选择器对不上 zlibrary 的实际 DOM。新版基于真实页面验证：
  - 启用 `renderJs: true`，让 Electron BrowserWindow 跑完 z-library 的 JS 防爬挑战（执行 PoW 设置 cookie 后刷新）。
  - 选择器对准 `<z-bookcard>` 自定义元素：标题 / 作者从 `[slot="title"]` / `[slot="author"]` 取，下载地址从元素自身的 `download` 属性取。
  - 新增 `formatAttr` 配置项：当下载 URL 没有扩展名时（z-library 的 `/dl/xxx` 即如此），从元素属性（这里是 `extension="epub"`）读取格式。
- **架构改进** — `HtmlSourceConfig` 现在支持 `formatAttr` 字段，对所有需要从元素属性读格式的爬虫源都适用。

### 升级说明

下载 `Natsu-1.3.2.exe` 替换旧版即可。**已添加的 zlibrary 书源需要删除后通过预设按钮重新添加**（旧条目还是旧配置）。

---

## v1.3.1 - 2026-05-22

### Bug fixes

- **zlibrary preset source now works** — adding a mirror URL (e.g. `https://zh.z-library.sk/`) previously returned "No importable results" because the source was stored as `kind: "url"` and routed to a plain OPDS fetch. It now correctly builds a `kind: "html"` scraper config with `searchUrl: <mirror>/s/{query}` and appropriate CSS selectors, so searches actually query the mirror's search endpoint.
- **TypeScript TDZ fix** — moved `handleDocumentLoaded` / `useEpubChapter` declarations before their first use in `TextPane.tsx`, resolving a `TS2448` block-scoped-variable-used-before-declaration error.

---

## v1.3.0 - 2026-05-22

### New features

**Preset Chinese book sources / 预设中文书源**
- New "预设书源" chip row in Settings → Online Sources.
- One-click to add: 轻小说文库 (Wenku8), Standard Ebooks, or zlibrary mirror (user-supplied URL).
- Active presets show a ✓ indicator; can still be deleted from the source list normally.

**RSS / Atom feed sources / RSS 书源**
- Online source type now supports RSS · Atom feeds (e.g. sites that publish epub links via feed).
- New type selector in the source editor. Handles both RSS 2.0 (`<item>`) and Atom (`<entry>`).

**Annotation export / 高亮笔记导出**
- Export all highlights and notes for any book via the reader's 笔记 panel.
- Two formats: **Markdown** (for notes apps) and **Anki TSV** (for flashcard import).
- Filename characters are automatically sanitised; triggers the native OS save dialog.

**Cover auto-fetch / 封面自动抓取**
- Books that lack an embedded cover image now automatically attempt a Google Books lookup by title + author after import.
- Manual "重新抓取封面" button on every shelf tile (shows spinner while fetching).

**Reading statistics / 阅读统计强化**
- **Heatmap calendar**: GitHub-style 52-week grid in the Stats panel, colour-coded by daily minutes.
- **30-day trend curve**: SVG polyline showing the last 30 days of reading activity.
- **Reading speed**: live chars-per-minute stat card updated every 5 seconds while viewing Stats.

### Improvements

- **Architecture cleanup**: `App.tsx` reduced from 1806 → 1075 lines; `TextPane.tsx` reduced from ~1521 → ~1406 lines via extracted hooks (`useLibrary`, `useReaderNavigation`, `useBookShelf`, `usePageTurn`, `useDictionary`, `useEpubChapter`). Large sub-components moved to `src/bookshelf/`, `src/stats/`, and `src/online/`.
- `icon-button:disabled` now correctly shows `cursor: not-allowed`.
- `saveFile` IPC handler validates input types and handles OS dialog cancellation gracefully.

---

## v1.2.0 - 2026-05-22

### New features

**Anthropic Sans font / Anthropic Sans 字体**
- New reading font option: Anthropic Sans (placeholder: Inter Variable, OFL licensed).
- Selectable in Settings → 字体. Latin/punctuation characters use the humanist sans-serif design; CJK characters continue using system fallbacks.

**3D book cover / 3D 书封**
- Book covers on the shelf now animate to a subtle 3D perspective on hover (perspective + rotateY + ground shadow).
- Respects the "减少动效" setting — reduced-motion users get a simple lift+shadow instead.

**Drop-cap chapter opening / 首字下沉**
- EPUB chapters now display an Apple Books-style drop cap (3-line first letter) and a centred chapter title with hairline decorators.
- Toggle off in Settings → 首字下沉.

**Chapter scrubber / 章节 scrubber**
- A new interactive progress scrubber appears at the bottom of the reader window.
- Small dots mark each chapter; hover shows the chapter title; drag to scrub and jump.
- Keyboard accessible (arrow keys ±1 chapter, Home/End).

**Page curl animation / 翻页卷曲**
- New "卷曲" page-turn style for text/EPUB paged mode, simulating an Apple Books card-fold.
- Selectable in Settings alongside slide, fade, none. Respects reduced-motion.

**Open-book transition / 打开书转场**
- Clicking a book cover now plays a FLIP expand animation from the shelf position to full screen.
- GPU-composited (clip-path) so it's smooth even on integrated graphics. Respects reduced-motion.

**Built-in dictionary / 内置词典**
- Select any text in the reader → tap the new 🔍 button to look up the word.
- Offline-first: ships a 200-entry CC-CEDICT Chinese dictionary; falls back to an online search for unknown words.
- CC-BY-SA 3.0 attribution included.

**Reading wellness / 阅读节律**
- **Pomodoro reminder**: notifies you to take a break after your configured interval (default 25 min).
- **Evening warm overlay**: after 20:00 a faint warm tint reduces blue-light exposure. Configurable in Settings.
- **Daily summary card**: closing the reader after ≥ 5 minutes shows your reading time, book progress, and streak.
- All toggleable in Settings → 阅读节律.

### Improvements

- Page-turn style now has a dedicated settings control (slide / fade / 卷曲 / 无).
- Dictionary data: CC-CEDICT mini subset (200 entries) bundled at `public/dictionaries/`.

---

## v1.1.0 - 2026-05-20

### New features

**Collections / 收藏夹**
- Create named collections from the side rail; click to filter the shelf to that collection.
- Each book tile has a Tag button that opens a dropdown to add or remove the book from any collection.

**Batch operations / 批量操作**
- `Ctrl+Click` a book tile to enter multi-select mode; selected tiles show a highlighted border and check badge.
- A floating action bar appears at the bottom of the screen showing the selection count and a **Delete selected** button (with confirmation).

**Reading goal & streak / 阅读目标 & 连续打卡**
- Stats page now shows a circular progress ring for today's reading progress against the daily goal.
- Streak counter shows how many consecutive days the goal was met (🔥).
- Settings → **每日阅读目标** lets you set the target minutes per day (default 30).

**Command palette / 命令面板** (`Ctrl+K`)
- Press `Ctrl+K` anywhere in the library to open a fuzzy book search overlay.
- Use arrow keys to navigate, `Enter` to open, `Esc` to dismiss.

**Chapter position indicator / 章节进度**
- The reader toolbar now shows a **current / total** chapter counter (e.g. `3 / 24`) next to the percentage.

### Other improvements from v1.0.1 (included in this release)

- Delete confirmation dialog before removing a book.
- Drag-and-drop import: drop files onto the library window.
- Inline metadata editing (title and author) via the pencil icon.
- Shelf sort options: recent, title, author, progress, size.
- Page-turn animations: slide, fade, or none (respects reduced-motion setting).
- Reading stats panel with weekly chart.
- Data export / import (JSON backup of bookmarks, highlights, and sessions).

---

## v1.0.1 - 2026-05-20

### EPUB manga reading improvements

- Fixed double-page scanned EPUB manga layout so paired pages share one spread height and align cleanly.
- Made lazy rendering spread-aware: if either side of a spread is near the viewport, both sides render together.
- Added **按键翻页后自动对齐到下一页** (`mangaSnapToPage`) setting. When disabled, manga EPUB keyboard page turns use instant viewport jumps instead of smooth scroll plus snap rebound.
- Forced detected manga EPUBs to use scroll rendering internally, preventing paged text-column CSS from breaking fixed-layout manga pages.
- Tightened webtoon layout by removing forced chapter minimum height, chapter separators, and inline image baseline gaps.

### Validation

- `npm run typecheck`
- `npm run build`
- `npm run dist`

## v1.0.0 - 2026-05-20

Initial public Windows portable release of Natsu.

- Material 3 desktop reader shell.
- EPUB, MOBI/AZW3, TXT, PDF, CBZ/CBR/ZIP/RAR support.
- Library, bookmarks, notes, highlights, full-book search, TTS, themes, and reader preferences.
