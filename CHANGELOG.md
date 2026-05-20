# Changelog

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
