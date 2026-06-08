<div align="center">

<img src="build/icon.png" width="96" alt="Natsu Logo" />

# Natsu 夏

**A Material 3 desktop reader for manga, light novels, and e-books**  
**基于 Material 3 的桌面漫画、轻小说与电子书阅读器**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white)](https://github.com/steinyanaa/natsu/releases)

[Download / 下载](#download--下载) · [Features / 功能](#features--功能) · [Usage / 使用指南](#usage-guide--使用指南) · [Development / 开发](#development--开发)

</div>

---

## Latest release / 最新版本

**v1.6.1** is a reader stability, accessibility, and architecture polish release:

- **阅读稳定性包** — React 错误边界、EPUB 清洗降级、PDF 单页渲染失败占位，减少坏书/坏页导致的白屏。
- **阅读焦点性能优化** — 阅读焦点候选段落缓存到 hook 中，滚动时只做中心点计算，降低长文滚动 DOM 扫描。
- **无原生 prompt 体验** — 批注和书签重命名统一使用内置纸感输入弹窗，支持多行批注快捷提交。
- **键盘与读屏体验** — 搜索、书签、设置开关、分段控件、toast、工具栏焦点均补充可访问语义。
- **自动滚动与 RTL 修复** — 分页文本支持横向自动滚动，用户输入会停止自动滚动，RTL 模式下左右键翻页自动镜像。
- **架构整理** — 搜索、进度落盘、章节 ETA、阅读 chrome、导出文件名等逻辑抽为可单元测试 helper。

Earlier, **v1.6.0** introduced the quiet paper reading preset and optional reading focus mode.

See [CHANGELOG.md](CHANGELOG.md) for the full history.

## Download / 下载

Go to [Releases](https://github.com/steinyanaa/natsu/releases) and download the latest `Natsu-x.x.x.exe` portable executable. No installation is required — double-click and read.

前往 [Releases](https://github.com/steinyanaa/natsu/releases) 下载最新的 `Natsu-x.x.x.exe` 便携版可执行文件，无需安装，双击即用。

> Requirements / 系统要求：Windows 10 / 11 (x64)

---

## Features / 功能

### Format support / 格式支持

| Format | Description |
| --- | --- |
| EPUB | Reflow text and fixed-layout manga pages / 回流文本与固定版式漫画 |
| MOBI / AZW3 | Kindle-style e-books / Kindle 电子书格式 |
| TXT | Plain text novels / 纯文本小说 |
| PDF | Virtual page rendering / 虚拟页渲染 |
| CBZ / CBR / ZIP / RAR | Manga archives / 漫画压缩包 |

### Library management / 书架管理

- **Drag-and-drop import** — drop files onto the library window to import them instantly.
- **Collections** — create named collections from the side rail; click to filter the shelf to that collection; tag books into multiple collections.
- **Batch operations** — `Ctrl+Click` to multi-select tiles; floating bar for bulk delete.
- **Shelf sort** — sort by recent activity, title, author, reading progress, or file size.
- **Metadata editing** — edit the title and author of any imported book via the pencil icon.
- **Delete confirmation** — a dialog prevents accidental deletion of bookmarks and progress.
- **Data backup** — export all bookmarks, highlights, and reading sessions as JSON; import back on any machine.

### Reading experience / 阅读体验

- Apple Books-style reader shell with frosted-glass toolbar.
- Tap-zone navigation: left/right sides turn pages, center toggles controls.
- Keyboard shortcuts for page turning, search, brightness, immersive mode, and help (`?`).
- Full-book search, bookmarks, persistent highlights, annotations, and notes panel.
- Accessible full-book search dialog with stable keyboard navigation and live result count.
- **Reading focus / 阅读焦点** — optional center-paragraph focus mode for long-form text and EPUB reading.
- Reader recovery panel, safer EPUB/PDF fallbacks, and undoable bookmark deletion.
- TTS read-aloud bar with speed and voice selection.
- **Page-turn animations** — slide, fade, **卷曲 (page curl)**, or none; respects system reduced-motion.
- **Anthropic Sans font option** — Inter Variable placeholder (OFL licensed), selectable in Settings → 字体.
- **Apple Books-style 3D cover hover** — perspective + rotateY animation on the shelf; respects reduced-motion.
- **Open-book FLIP transition** — GPU-composited clip-path expand animation when opening a book.
- **Drop-cap chapter openings** — 3-line first-letter drop cap with centred, decorated chapter title for EPUB.
- **Chapter scrubber** — interactive progress bar at the bottom of the reader; chapter-dot markers, hover titles, drag-to-seek, keyboard accessible (arrow keys ±1 chapter, Home/End).
- Reader color presets (default, paper, quiet, gray, night), brightness overlay, page margins, justified text.
- **Command palette** (`Ctrl+K`) — fuzzy-search and open any book without leaving the reader.
- **Chapter position indicator** — `current / total` chapter count in the toolbar.

### Built-in dictionary / 内置词典

- Select any text in the reader and tap the 🔍 button to look up the word.
- Offline-first: 200-entry CC-CEDICT Chinese dictionary bundled at `public/dictionaries/`; falls back to an online search for unknown words.
- CC-BY-SA 3.0 attribution included.

### Reading wellness / 阅读节律

- **Pomodoro reminder** — notifies you to take a break after your configured interval (default 25 min).
- **Evening warm overlay** — a faint warm tint reduces blue-light exposure after 20:00; configurable in Settings.
- **Daily summary card** — closing the reader after ≥ 5 minutes shows reading time, book progress, and streak.
- All features toggleable in **Settings → 阅读节律**.

### Reading stats & goals / 阅读统计 & 目标

- **Weekly stats** — bar chart of reading time per book for the past 7 days.
- **Daily goal** — set a target minutes-per-day; a circular progress ring tracks today's progress.
- **Streak counter** — consecutive days meeting the goal, shown with a 🔥 badge.

### Manga and EPUB manga / 漫画与 EPUB 漫画

- Single-page, double-page, and webtoon layouts.
- Reading direction switch for left-to-right and right-to-left manga.
- Double-page cover solo option for correct spread pairing.
- Fixed double-page EPUB manga: paired pages share equal height, rendering together in one spread.
- Optional snap-to-page behavior for keyboard page turning.
- Webtoon mode removes chapter gaps and image baseline whitespace.

---

## Usage guide / 使用指南

### Import books / 导入书籍

1. Click **Import** in the toolbar, or **drag files** onto the library window.
2. Select EPUB / MOBI / AZW3 / TXT / PDF / CBZ / CBR / ZIP / RAR files.
3. Open the book from the library grid.

### Organize with collections / 收藏夹管理

1. Click the **+** icon at the bottom of the side rail to create a collection.
2. On any book tile, click the **Tag** icon to add it to one or more collections.
3. Click a collection name in the side rail to filter the shelf to that collection.

### Batch delete / 批量删除

1. Hold `Ctrl` and click book tiles to select them (highlighted border + check badge).
2. A floating bar appears — click **Delete selected** and confirm.

### Reading goal / 阅读目标

1. Open **Settings** and find **每日阅读目标**.
2. Set your target minutes per day.
3. Switch to the **Stats** tab to see today's progress ring and streak.

### Command palette / 命令面板

- Press `Ctrl+K` from anywhere in the app.
- Type to fuzzy-search books; use `↑↓` to navigate, `Enter` to open, `Esc` to close.

### Reader controls / 阅读界面操作

| Action | Shortcut / Area |
| --- | --- |
| Previous / next page | Arrow keys, PageUp/PageDown, or left/right tap zones |
| Search | `Ctrl + F` |
| Quick book switch | `Ctrl + K` |
| Close panels | `Esc` |
| Toggle shortcut help | `?` |
| Immersive mode | `I` |
| Brightness down/up | `[` / `]` |
| Open settings | Toolbar settings button |

### Z-Library 账户登录 / Z-Library login

1. 在 Settings → Online Sources 中，找到 zlibrary 书源卡片，点击**"管理"**按钮展开管理面板。
2. 点击**"🔑 登录账户"**，将弹出 Z-Library 真实登录窗口。
3. 在窗口内正常填写邮箱和密码并提交，登录成功后窗口自动关闭。
4. 管理面板将显示你的邮箱和今日下载余量（免费账户 10 次/天；Premium 无限制）。
5. 登录状态在重启 App 后保持，无需重复登录。
6. 如需切换镜像地址，在管理面板底部的输入框修改后点击**"保存"**即可。

> 游客每日可下载 5 次，登录免费账户可提升至 10 次。

### EPUB manga settings / EPUB 漫画设置

Open **Settings → 漫画布局**:

- **单页 / Single**: one page per snap point.
- **双页 / Double**: spread view; cover can stay solo so later pages pair correctly.
- **条漫 / Webtoon**: full-width continuous image flow.
- **按键翻页后自动对齐到下一页**: turn this off if keyboard page turning feels jittery.

---

## Development / 开发

### Prerequisites / 前提条件

| Tool | Version |
| --- | --- |
| Node.js | >= 20 |
| npm | >= 10 |

### Quick start / 快速开始

```bash
git clone https://github.com/steinyanaa/natsu.git
cd natsu
npm install
npm run dev
```

### Scripts / 常用命令

| Command | What it does / 作用 |
| --- | --- |
| `npm run dev` | Vite dev server + Electron with hot reload / 开发模式（热重载） |
| `npm run typecheck` | Type-check both renderer and Electron tsconfigs / 双 tsconfig 类型检查 |
| `npm run test:unit` | Run the Vitest unit suite / 运行 Vitest 单元测试 |
| `npm run build` | Build renderer + Electron main process / 构建渲染层与主进程 |
| `npm run dist` | Build **and** package the Windows portable `.exe` / 构建并打包便携版 |

Packaged output is written to `release/`. 打包产物输出到 `release/`。

### Testing / 测试

Unit tests run on [Vitest](https://vitest.dev/) and cover the pure logic on both sides of the process boundary — back-end services (store, library, scraper DOM/custom adapters) and an IPC-registration contract test, plus front-end parsers and reader helpers (EPUB path resolution, comic spread grouping, chapter-height estimation, text decoding, reading-speed sampling).

单元测试基于 Vitest，覆盖进程两侧的纯逻辑：后端服务（store / library / 爬虫 DOM 与自定义适配器）与 IPC 注册契约测试，以及前端解析器与阅读器工具函数（EPUB 路径解析、漫画跨页分组、章节高度估算、文本解码、阅读速度采样）。

```bash
npm run test:unit
```

### Project structure / 项目结构

The codebase is split by domain on both sides of the Electron boundary. 主进程与渲染层均按领域拆分。

```text
natsu/
├─ electron/                  # Main process (split by domain)
│  ├─ main.ts                 # App lifecycle wiring only
│  ├─ ipc/                    # IPC channel definitions + per-domain handlers
│  │  └─ handlers/            #   library / online / preferences / covers / system / zlib
│  ├─ preload/                # contextBridge groups → flat window.readerApi
│  ├─ services/               # store / library / covers / protocol / online-import
│  │  ├─ scraper/             #   gutenberg / json / html / rss / custom adapters + dispatcher
│  │  └─ zlib/                #   Z-Library session + account
│  └─ window/                 # BrowserWindow creation + lifecycle
├─ src/                       # Renderer (React 19)
│  ├─ app/                    # Top-level hooks (useLibrary, useEpubCovers, useOnlineSearch, …)
│  ├─ bookshelf/              # Shelf grid, filters, dialogs
│  ├─ reader/                 # Reader shell, format panes, reader hooks + pure helpers
│  ├─ readers/                # EPUB / MOBI / TXT / comic parsers
│  ├─ onlineSources/          # Online source manager, presets, Z-Library panel
│  ├─ settings/               # Settings drawer + controls
│  ├─ stats/ · wellness/      # Reading stats, goals, and wellness widgets
│  ├─ components/             # Shared UI (dialogs, command palette, controls)
│  └─ types.ts                # Shared TypeScript types
├─ build/                     # App icons
├─ public/                    # Static assets (dictionaries, fonts)
└─ package.json
```

Modules follow a *split-by-domain, test-the-pure-logic* convention: stateful React components delegate to focused hooks, and side-effect-free helpers (path/MIME resolution, layout math, text decoding) live in their own files with matching `*.test.ts`.

模块遵循「按领域拆分、纯逻辑可测」的约定：有状态的 React 组件委托给聚焦的 hook，无副作用的工具函数（路径/MIME 解析、布局计算、文本解码）独立成文件并配套 `*.test.ts`。

---

## License / 许可

This project is licensed under the [MIT License](LICENSE).
