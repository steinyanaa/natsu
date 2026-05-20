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

**v1.0.1** improves EPUB manga reading, especially scanned fixed-layout EPUBs:

- Double-page EPUB manga spreads are now equal-height and render both sides together.
- Added a setting to disable keyboard snap-to-page alignment for manga EPUBs.
- Manga EPUBs always render in scroll mode even when global reading mode is set to paged.
- Webtoon layout removes chapter gaps and image baseline whitespace.

See [CHANGELOG.md](CHANGELOG.md) and the [EPUB manga guide](docs/EPUB_MANGA_READING.md) for details.

## Download / 下载

Go to [Releases](https://github.com/steinyanaa/natsu/releases) and download the latest `Natsu-x.x.x.exe` portable executable. No installation is required.

前往 [Releases](https://github.com/steinyanaa/natsu/releases) 下载最新的 `Natsu-x.x.x.exe` 便携版可执行文件，无需安装，双击即用。

> Requirements / 系统要求：Windows 10 / 11 (x64)

---

## Features / 功能

### Format support / 格式支持

| Format | Description |
| --- | --- |
| EPUB | Reflow text and fixed-layout pages / 回流文本与固定版式 |
| MOBI / AZW3 | Kindle-style e-books / Kindle 电子书格式 |
| TXT | Plain text novels / 纯文本小说 |
| PDF | Virtual page rendering / 虚拟页渲染 |
| CBZ / CBR / ZIP / RAR | Manga archives / 漫画压缩包 |

### Reading experience / 阅读体验

- Apple Books-style reader shell with frosted-glass toolbar.
- Tap-zone navigation: left/right sides turn pages, center toggles controls.
- Keyboard shortcuts for page turning, search, brightness, immersive mode, and help.
- Full-book search, bookmarks, persistent highlights, annotations, and notes panel.
- TTS read-aloud bar with speed and voice selection.
- Reader color presets, brightness overlay, page margins, justified text, and reduced-motion support.

### Manga and EPUB manga / 漫画与 EPUB 漫画

- Single-page, double-page, and webtoon layouts.
- Reading direction switch for left-to-right and right-to-left manga.
- Double-page cover solo option for correct spread pairing.
- EPUB scanned manga detection inside `TextPane`.
- Optional snap-to-page behavior for keyboard page turning.
- Webtoon mode can place adjacent images tightly with no chapter separator.

---

## Usage guide / 使用指南

### Import books / 导入书籍

1. Click **Import**, or drag files onto the library.
2. Select EPUB / MOBI / AZW3 / TXT / PDF / CBZ / CBR / ZIP / RAR files.
3. Open the book from the library grid.

### Reader controls / 阅读界面操作

| Action | Shortcut / Area |
| --- | --- |
| Previous / next page | Arrow keys, PageUp/PageDown, or left/right tap zones |
| Search | `Ctrl/Cmd + F` |
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
- **按键翻页后自动对齐到下一页**: turn this off if keyboard page turning feels dizzy; the reader will jump by about one viewport without scroll-snap rebound.

Note: scanned manga EPUBs always use scroll rendering internally. If the global reader mode is set to **Paged**, ordinary text EPUBs still use paged mode, but manga EPUBs stay in scroll mode for stable layout.

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
