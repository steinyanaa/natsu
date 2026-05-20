<div align="center">

<img src="build/icon.png" width="96" alt="Natsu Logo" />

# Natsu · 夏

**A Material 3 desktop reader for manga, light novels, and e-books**
**基于 Material 3 的桌面漫画与轻小说阅读器**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white)](https://github.com/steinyanaa/natsu/releases)

[**⬇ 下载 / Download**](#-download--下载) · [**✨ 功能 / Features**](#-features--功能) · [**🛠 开发 / Development**](#-development--开发)

</div>

---

## ✨ Features · 功能特性

### 📚 Format Support · 格式支持

| Format | Description |
|--------|-------------|
| **EPUB** | Full reflow & fixed layout / 完整回流与固定布局 |
| **MOBI / AZW3** | Kindle format / Kindle 格式 |
| **TXT** | Plain text novels / 纯文本小说 |
| **PDF** | Virtual page rendering / 虚拟页面渲染 |
| **CBZ / CBR / ZIP / RAR** | Manga archives / 漫画压缩包 |

---

### 🎨 Apple Books–style Reading Experience · Apple 图书风格阅读体验

Natsu v1.0 is crafted to bring the refined feel of Apple Books to the desktop — with a Material 3 design language.

Natsu v1.0 致力于将 Apple 图书的精致阅读体验带到桌面端，融合 Material 3 设计语言。

#### 翻页与沉浸 · Page Turning & Immersion
- **Tap-zone navigation** — left 25% / right 25% to flip pages, centre to toggle UI; no overlay that blocks text selection  
  **点击区域翻页** — 左 25%/右 25% 翻页，中间切换工具栏；不遮挡文字选择
- **Keyboard shortcuts** — `← →` or `↑ ↓` to flip pages; `Ctrl/Cmd+F` for search; `Esc` to dismiss panels  
  **键盘快捷键** — `← →` / `↑ ↓` 翻页；`Ctrl/Cmd+F` 搜索；`Esc` 关闭面板
- **Cursor auto-hide** — hides 1.6 s after the UI chrome fades; reappears on any movement  
  **光标自动隐藏** — UI 消失 1.6 秒后隐藏光标，移动鼠标立即恢复
- **Chapter fade-in animation** — 250 ms opacity + slide-up on each new chapter  
  **章节淡入动画** — 新章节出现时 250 ms 淡入 + 上移
- **"X minutes left in chapter"** — estimated from chapter character count  
  **本章剩余时间** — 基于章节字数估算
- **Frosted-glass toolbar** — `blur(28px) saturate(180%)`, hairline border  
  **毛玻璃工具栏** — `blur(28px) saturate(180%)`，细边框

#### 主题与排版 · Themes & Typography
- **4 Apple-inspired reading presets** — Paper (纸黄), Quiet (米白), Gray (夜灰), Night (极夜)  
  **4 档 Apple 风格阅读纸色** — 可在设置中一键切换
- **Brightness overlay** — 40%–100% independent of theme colour temperature  
  **亮度遮罩** — 40%–100%，不影响主题色温
- **Page margin control** — Narrow / Normal / Wide  
  **页边距三档** — 紧凑 / 标准 / 宽松
- **Justify + auto-hyphenation** — `text-align: justify` with `hyphens: auto`  
  **两端对齐 + 自动断词**
- **Material 3 theme engine** — seed colour → full tonal palette; 4 presets + custom  
  **Material 3 主题引擎** — 种子色生成完整色调；4 个预设 + 自定义

#### 选词与标注 · Selection & Annotation
- **Floating selection menu** — Copy · Highlight (4 colours) · Note  
  **选词悬浮菜单** — 复制 · 4 色高亮 · 批注
- **Persistent highlights** — stored in book record, restored on reopen  
  **持久化高亮** — 存储在书籍记录中，重新打开后自动还原
- **Notes panel** — dedicated sidebar tab listing all highlights & annotations  
  **笔记面板** — 侧边栏独立标签页，列出所有高亮与批注

#### 搜索与朗读 · Search & Read Aloud
- **Full-book search** — cross-chapter, 180 ms debounce, keyboard navigation  
  **全书搜索** — 跨章节，180 ms 防抖，键盘导航
- **TTS read-aloud bar** — play/pause, speed (0.75×–2×), voice selection, sentence progress  
  **TTS 朗读条** — 播放/暂停、语速、语音、句子进度
- **Session timer** — "已读 X 分" displayed in the toolbar  
  **阅读时长** — 工具栏显示本次阅读时间

#### 书库与导航 · Library & Navigation
- **Bookmarks** — create, rename, delete, jump  
  **书签** — 创建、重命名、删除、跳转
- **Table of contents** — collapsible tree, jump to any chapter  
  **目录** — 折叠树状，跳转任意章节
- **Reading progress** — percent + chapter tracking, auto-restored on reopen  
  **阅读进度** — 百分比 + 章节追踪，下次打开自动恢复
- **Online book sources** — configurable JSON/HTML adapters  
  **在线书源** — 可配置 JSON/HTML 适配器

#### 性能 · Performance
- **Virtual rendering** — only visible pages rendered for PDF & manga  
  **虚拟渲染** — PDF 和漫画仅渲染可见页
- **Image preload cache** — LRU eviction (cap: `preloadWindow × 2`)  
  **图片预加载缓存** — LRU 驱逐策略
- **Reduce Motion** — all new animations respect the system accessibility setting  
  **减少动态效果** — 所有新动画响应系统无障碍设置

---

## ⬇ Download · 下载

Go to [**Releases**](https://github.com/steinyanaa/natsu/releases) and download the latest `Natsu-x.x.x.exe` portable executable — no installation required.

前往 [**Releases**](https://github.com/steinyanaa/natsu/releases) 下载最新的 `Natsu-x.x.x.exe` 便携版可执行文件，无需安装，双击即用。

> **Requirements · 系统要求** — Windows 10 / 11 (x64)

---

## 🛠 Development · 开发

### Prerequisites · 前提条件

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |

### Quick Start · 快速开始

```bash
# Clone the repository / 克隆仓库
git clone https://github.com/steinyanaa/natsu.git
cd natsu

# Install dependencies / 安装依赖
npm install

# Start dev server / 启动开发服务器
npm run dev
```

### Build & Package · 构建与打包

```bash
# Type check only / 仅类型检查
npm run typecheck

# Build (no package) / 构建（不打包）
npm run build

# Build + package Windows portable .exe / 构建并打包 Windows 便携版
npm run dist
```

Output is placed in `release/` directory.  
输出文件在 `release/` 目录。

### Project Structure · 项目结构

```
natsu/
├── electron/               # Main process & preload / 主进程与预加载
│   ├── main.ts             # IPC handlers, book store, preferences
│   └── preload.cjs         # Context bridge / 上下文桥
├── src/
│   ├── reader/             # Reader view components / 阅读视图组件
│   │   ├── ReaderScreen.tsx    # Reader shell, toolbar, shortcuts
│   │   ├── ReaderStage.tsx     # Format router / 格式路由
│   │   ├── TextPane.tsx        # EPUB / MOBI / TXT renderer
│   │   ├── PdfPane.tsx         # PDF renderer
│   │   ├── ComicPane.tsx       # Manga renderer
│   │   ├── SelectionMenu.tsx   # Highlight bubble / 高亮气泡
│   │   ├── NotesPanel.tsx      # Highlights & notes list
│   │   ├── SearchPanel.tsx     # Full-book search / 全书搜索
│   │   ├── TTSBar.tsx          # Read-aloud bar / 朗读条
│   │   ├── BookmarkManager.tsx # Bookmark list
│   │   ├── TocTree.tsx         # Table of contents
│   │   ├── highlightUtils.ts   # DOM highlight helpers
│   │   └── tts.ts              # SpeechSynthesis wrapper
│   ├── readers/            # Format parsers / 格式解析器
│   │   ├── epub.ts
│   │   ├── mobi.ts
│   │   ├── text.ts
│   │   └── comic.ts
│   ├── settings/
│   │   └── SettingsPanel.tsx   # Settings drawer / 设置面板
│   ├── components/         # Shared UI components / 共用组件
│   ├── styles.css          # Global styles (Material 3 + reader)
│   ├── themes.ts           # Theme presets
│   ├── themeEngine.ts      # Material 3 colour engine
│   └── types.ts            # Shared TypeScript types
├── build/                  # App icons / 应用图标
├── public/                 # Static assets
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Tech Stack · 技术栈

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 41 |
| UI Framework | React 19 |
| Language | TypeScript 6 |
| Bundler | Vite 8 |
| Design System | Material 3 (via `@material/material-color-utilities`) |
| Icons | Lucide React |
| PDF | pdf.js |
| MOBI | `@lingo-reader/mobi-parser` |
| ZIP/CBZ | `@zip.js/zip.js` |
| RAR/CBR | `node-unrar-js` |
| Persistence | `electron-store` |
| Packager | electron-builder |

---

## 📖 Usage Guide · 使用说明

### 导入书籍 · Importing Books

1. Click **Import** (or drag & drop files onto the library)  
   点击 **导入** 按钮（或将文件拖入书库界面）
2. Select one or multiple files (EPUB / MOBI / AZW3 / TXT / PDF / CBZ / CBR / ZIP / RAR)  
   选择一个或多个文件
3. The book appears in the library grid  
   书籍出现在书库网格中

### 阅读界面 · Reader Interface

| Area | Action · 操作 |
|------|--------------|
| Left 25% of screen · 屏幕左侧 25% | Previous page · 上一页 |
| Right 25% of screen · 屏幕右侧 25% | Next page · 下一页 |
| Centre · 中间 | Toggle toolbar · 切换工具栏 |
| `← →` / `↑ ↓` | Flip pages · 翻页 |
| `Ctrl/Cmd+F` | Full-book search · 全书搜索 |
| `Esc` | Close panels · 关闭面板 |
| 🔖 Toolbar button · 工具栏书签按钮 | Add bookmark · 添加书签 |
| ≡ Toolbar button · 工具栏目录按钮 | Open TOC / bookmarks / notes · 打开目录/书签/笔记 |
| ⚙ Toolbar button · 工具栏设置按钮 | Open settings · 打开设置 |
| 🔊 Toolbar button · 工具栏朗读按钮 | Start read-aloud · 开始朗读 |

### 高亮与批注 · Highlights & Notes

1. Select any text in the reader  
   在阅读器中选择任意文本
2. A floating bubble appears — choose a colour to highlight, or tap the note icon to annotate  
   浮窗出现 — 选择颜色高亮，或点击批注图标添加笔记
3. View all highlights in the **Notes** tab of the left panel  
   在左侧面板的 **笔记** 标签页查看所有高亮与批注

### 主题与外观 · Theme & Appearance

Open settings (⚙) to adjust:  
打开设置 (⚙) 调整：

- **阅读纸色** — Default / Paper (纸黄) / Quiet (米白) / Gray (夜灰) / Night (极夜)
- **亮度** — 40%–100% brightness overlay
- **主题** — 4 Material presets + seed colour + fully custom
- **字体** — 宋体 / 黑体 / 楷体 / 日文衬线 / 英文衬线 / 自定义
- **字号** — 14–28 px
- **行距** — 1.35–2.2
- **页边距** — Narrow / Normal / Wide
- **排版** — 两端对齐 / 自动断词
- **阅读模式** — Scroll (滚动) / Paged (翻页)
- **动效** — Full / Gentle / Reduced

---

## 📄 License · 许可证

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

本项目基于 **MIT 许可证** 开源，详见 [LICENSE](LICENSE)。

---

<div align="center">
Made with ☀️ and React
</div>
