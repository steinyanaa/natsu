# Changelog

## [1.6.2] - 2026-06-09

### Fixed

- **翻页/滚动失效 + 加载变慢** — v1.6.1 新增的阅读器错误边界在滚动容器外多包了一层 `<div>`，使其顶替了 `.reader-workspace` 网格项；网格项默认 `min-height: auto` 会被内容撑到全高，导致 `.text-reader` 失去滚动溢出 → 无法翻页/滚动，且全高布局让渲染更重。错误边界改用带 key 的 `Fragment`，不再插入布局节点。
- **注释面板遮挡正文** — 固定在左栏的注释面板宽 340px，但 `data-page-margin="narrow"|"wide"` 的内边距规则优先级高于 `.text-reader.notes-open`，覆盖了正文的让位，导致窄/宽页边距下正文被面板盖住。新增更高优先级规则，注释打开时各页边距都保留足够左侧让位。

### Changed

- **大书加载提速** — `useEpubChapter` 改用 `AbortController`，被取代的加载在解析前中止；React StrictMode（开发模式）下不再把整本书并发 fetch + 解析两遍，大文件打开更快、内存占用减半。

### Validation

- `npm run build:ci`（typecheck + 209 unit tests + production build），并在真机用实际书库验证翻页、加载与注释让位。

## [1.6.1] - 2026-06-08

### Added

- **阅读恢复入口** — 阅读器外层新增错误边界，异常时提供重试当前书和返回书架入口，避免整页白屏。
- **书签删除撤销** — 删除书签后显示可撤销 toast，降低误删成本。
- **内置输入弹窗** — 批注和书签重命名改用统一 `TextInputDialog`，多行批注支持 Ctrl/Cmd+Enter 快捷提交。
- **优化报告** — 新增 `docs/OPTIMIZATION_REPORT_v1.6.1.md`，汇总 v1.6.1 的体验、稳定性与架构调整。

### Changed

- **阅读焦点性能** — `useReadingFocus` 缓存候选段落，滚动时避免全量 DOM 扫描。
- **搜索架构整理** — 全书搜索匹配算法抽为 `searchChapters(...)` 纯逻辑，并由 worker 复用同一实现。
- **ReaderScreen 瘦身** — 进度落盘、阅读 session 阈值、章节 ETA、chrome 指针唤出、导出文件名清洗拆为独立 helper。
- **可访问性统一** — 搜索面板、toast、书签选择、分段控件、设置开关、隐藏工具栏焦点等补充 ARIA/键盘语义。
- **CI 验证门禁** — `npm run build:ci` 串联 typecheck、unit tests 和 production build；`dist` 打包前自动执行门禁。

### Fixed

- **EPUB 降级** — 清理危险/交互节点、移除 CSS `@import`、隔离外部资源 URL、移除活动 SVG 内容。
- **PDF 页面稳定性** — 单页渲染失败显示占位，不影响后续页面；取消渲染不误报为错误。
- **自动滚动** — 分页文本支持横向滚动，用户输入自动停止，速度偏好夹取到安全范围。
- **RTL 键盘翻页** — RTL 阅读方向下左右方向键自动镜像。
- **搜索键盘导航** — 结果为空时方向键不会把 active index 推到 `-1`，Enter/Escape/上下键统一处理。

### Validation

- `npm run build:ci`
- `npm run dist`

## [1.6.0] - 2026-06-07

### Added

- **阅读焦点** — 小说 / EPUB 阅读器新增默认关闭的阅读焦点模式，可从工具栏或设置开启，自动高亮视口中心附近段落。
- **焦点选择 helper** — 新增可单元测试的中心段落选择逻辑，覆盖无候选、中心选择和不可聚焦候选跳过。

### Changed

- **静谧纸感 UI** — paper / quiet 阅读预设更柔和，正文纸张、低噪玻璃工具栏和焦点段落高亮更适合长时间阅读。
- **偏好迁移同步** — `readingFocus` 默认关闭写入 Electron 与 renderer 偏好默认值，不改变老用户既有阅读习惯。

### Validation

- `npm run test:unit`
- `npm run typecheck`
- `npm run build`

## [1.5.0] - 2026-05-29

### Added

- **PDF / 漫画首页封面** — PDF 与 CBZ/ZIP/CBR/RAR 现在自动以首页缩略图作为书架封面。
- **封面懒加载** — 封面改为按书架可见区域点播加载（IntersectionObserver），去掉旧的 200 本 EPUB 上限；大书库滚动更流畅。
- **按封面配色** — 阅读时 reader UI 自动用书封面主色生成 Material 配色，关书还原；可在 设置 → 按封面配色 关闭。
- **自动滚动阅读** — reader 支持匀速连续自动滚动：工具栏按钮 / 空格切换，`,` `.` 调速，手动滚轮暂停，到底自动停；速度可在 设置 → 自动滚动 调整。

### Fixed

- 封面在 React StrictMode（开发模式）下完全不显示的两个生命周期问题：`useCovers` 的 `disposedRef` 在重挂载后未重置导致 `commit` 空转；`BookShelf` 的 IntersectionObserver 在 ref 回调触发时尚未创建。

### Notes

- 三个新功能由三个并行子代理在独立 worktree 中开发，单元测试从 116 增至 129。

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
