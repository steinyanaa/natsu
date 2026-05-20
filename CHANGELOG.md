# Changelog

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
