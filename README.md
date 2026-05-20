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

**v1.1.0** adds library management, reading goals, a command palette, and more:

- **Collections / 收藏夹** — create named shelves and filter books instantly from the side rail.
- **Batch delete / 批量删除** — `Ctrl+Click` to multi-select books, then delete them all at once.
- **Reading goal & streak / 阅读目标** — daily target with a circular progress ring and consecutive-day streak counter.
- **Command palette / 命令面板** — press `Ctrl+K` to fuzzy-search and open any book without leaving the reader.
- **Chapter position / 章节进度** — the reader toolbar now shows `current / total` chapter count.

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
- TTS read-aloud bar with speed and voice selection.
- Page-turn animations: slide, fade, or none; respects system reduced-motion.
- Reader color presets (default, paper, quiet, gray, night), brightness overlay, page margins, justified text.
- **Command palette** (`Ctrl+K`) — fuzzy-search and open any book without leaving the reader.
- **Chapter position indicator** — `current / total` chapter count in the toolbar.

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

### Build and package / 构建与打包

```bash
# Type check only
npm run typecheck

# Build renderer and Electron main process
npm run build

# Build + package Windows portable executable
npm run dist
```

Packaged output is written to `release/`.

### Project structure / 项目结构

```text
natsu/
├─ electron/               # Main process and preload bridge
├─ src/
│  ├─ reader/              # Reader shell and format panes
│  ├─ readers/             # EPUB/MOBI/TXT/comic parsers
│  ├─ settings/            # Settings drawer
│  ├─ components/          # Shared UI components
│  ├─ styles.css           # Global styles
│  └─ types.ts             # Shared TypeScript types
├─ build/                  # App icons
├─ docs/                   # Guides and design notes
├─ public/                 # Static assets
└─ package.json
```

---

## License / 许可

This project is licensed under the [MIT License](LICENSE).
