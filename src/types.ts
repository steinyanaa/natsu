export type BookFormat =
  | "epub"
  | "txt"
  | "mobi"
  | "azw3"
  | "pdf"
  | "cbz"
  | "zip"
  | "cbr"
  | "rar";

export type ThemeName = "ramune" | "seaside" | "natsumatsuri" | "google-night";
export type ThemeMode = "system" | "light" | "dark";
export type ThemeSource = "preset" | "seed" | "custom";
export type LanguageCode = "zh-CN" | "ja-JP" | "en-US";
export type MotionMode = "full" | "gentle" | "reduced";
export type ReaderMode = "scroll" | "paged";
export type ReaderFontFamily = "serif-cn" | "anthropic-sans" | "sans" | "kai" | "jp-serif" | "serif-en" | "custom";
export type ReaderImageMode = "manual" | "fit-screen";
export type ComicFitMode = "width" | "height" | "page" | "original" | "manual";
export type ComicLayout = "single" | "double" | "webtoon";
export type ReadingDirection = "ltr" | "rtl";
export type OnlineSourceKind = "gutenberg" | "url" | "json" | "html";

export interface ThemeCustomColors {
  primary: string;
  secondary: string;
  tertiary: string;
  surface: string;
}

export interface ReaderProgress {
  kind: "text" | "page" | "epub";
  current: number;
  total?: number;
  percent: number;
  label?: string;
  cfi?: string;
  chapterId?: string;
  chapterOffset?: number;
  pageIndex?: number;
  pageOffset?: number;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  label: string;
  progress: ReaderProgress;
  createdAt: string;
  note?: string;
}

export interface Highlight {
  id: string;
  chapterId: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  color: "yellow" | "green" | "blue" | "pink";
  note?: string;
  createdAt: string;
}

export interface ReaderPreferences {
  theme: ThemeName;
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  themeSeedColor: string;
  customColors: ThemeCustomColors;
  language: LanguageCode;
  motion: MotionMode;
  readerMode: ReaderMode;
  fontSize: number;
  lineHeight: number;
  columnWidth: number;
  fontFamily: ReaderFontFamily;
  customFontStack: string;
  imageScale: number;
  imageMode: ReaderImageMode;
  autoAlign: boolean;
  reduceMotion: boolean;
  onlineSources: OnlineSource[];
  pageTurnStyle: "slide" | "fade" | "none";
  spread: "auto" | "single" | "double";
  tapToTurn: boolean;
  readerColorPreset: "default" | "paper" | "quiet" | "gray" | "night";
  brightness: number;
  pageMargin: "narrow" | "normal" | "wide";
  justify: boolean;
  hyphenate: boolean;
  dropCap: boolean;
  comicFit: ComicFitMode;
  comicLayout: ComicLayout;
  readingDirection: ReadingDirection;
  comicCoverSolo: boolean;
  mangaSnapToPage: boolean;
  immersive: boolean;
  preferencesVersion: number;
  dailyGoalMinutes: number;
}

export interface OnlineSource {
  id: string;
  name: string;
  enabled: boolean;
  kind: OnlineSourceKind;
  value: string;
}

export interface OnlineSourceTestItem {
  index: number;
  title?: string;
  author?: string;
  coverUrl?: string;
  detailUrl?: string;
  downloadUrl?: string;
  format?: BookFormat;
  sizeLabel?: string;
  ok: boolean;
  reason?: string;
}

export interface OnlineSourceTestReport {
  ok: boolean;
  sourceName: string;
  kind: OnlineSourceKind;
  searchUrl?: string;
  fetched: boolean;
  renderedJs?: boolean;
  itemCount: number;
  items: OnlineSourceTestItem[];
  message?: string;
}

export interface ReadingSession {
  bookId: string;
  start: string;
  end: string;
  charsRead: number;
}

export interface Collection {
  id: string;
  name: string;
  bookIds: string[];
  color?: string;
  createdAt: string;
}

export interface GoalStats {
  todayMinutes: number;
  dailyGoalMinutes: number;
  streak: number;
  goalReachedToday: boolean;
}

export interface BookRecord {
  id: string;
  hash: string;
  title: string;
  author?: string;
  format: BookFormat;
  fileName: string;
  fileUrl: string;
  size: number;
  importedAt: string;
  lastOpenedAt?: string;
  progress?: ReaderProgress;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  preferences?: Partial<ReaderPreferences>;
  coverSeed: number;
  readingSessions?: ReadingSession[];
  tags?: string[];
}

export interface TextChapter {
  id: string;
  title: string;
  html: string;
  plainText: string;
  frameHtml?: string;
  layout?: "reflow" | "fixed" | "vertical";
  viewport?: {
    width: number;
    height: number;
  };
  embeddedFonts?: string[];
}

export interface TocItem {
  id: string;
  label: string;
  href?: string;
  children?: TocItem[];
}

export interface ParsedTextDocument {
  kind: "text";
  title: string;
  author?: string;
  coverUrl?: string;
  objectUrls?: string[];
  chapters: TextChapter[];
  toc: TocItem[];
}

export interface OnlineBookResult {
  id: string;
  source: string;
  title: string;
  author?: string;
  language?: string;
  subjects: string[];
  coverUrl?: string;
  downloadUrl: string;
  format?: BookFormat;
  sizeLabel?: string;
  requestHeaders?: Record<string, string>;
  downloads?: number;
}

export interface ReaderApi {
  importBooks(): Promise<BookRecord[]>;
  searchOnlineBooks(query: string): Promise<OnlineBookResult[]>;
  testOnlineSource(query: string, source: OnlineSource): Promise<OnlineSourceTestReport>;
  importOnlineBook(book: OnlineBookResult): Promise<BookRecord | undefined>;
  openExternalAndAutoImport(book: OnlineBookResult): Promise<BookRecord | undefined>;
  openExternal(url: string): Promise<boolean>;
  listBooks(): Promise<BookRecord[]>;
  openBook(id: string): Promise<BookRecord | undefined>;
  saveProgress(id: string, progress: ReaderProgress): Promise<BookRecord | undefined>;
  saveBookmark(id: string, bookmark: Bookmark): Promise<BookRecord | undefined>;
  updateBookmark(
    bookId: string,
    bookmarkId: string,
    patch: Partial<Pick<Bookmark, "label" | "note" | "progress">>
  ): Promise<BookRecord | undefined>;
  removeBookmarks(bookId: string, bookmarkIds: string[]): Promise<BookRecord | undefined>;
  saveHighlight(bookId: string, highlight: Highlight): Promise<BookRecord | undefined>;
  updateHighlight(bookId: string, highlightId: string, patch: Partial<Pick<Highlight, "color" | "note">>): Promise<BookRecord | undefined>;
  removeHighlights(bookId: string, highlightIds: string[]): Promise<BookRecord | undefined>;
  removeBook(id: string): Promise<BookRecord[]>;
  removeBooks(ids: string[]): Promise<BookRecord[]>;
  importByPaths(paths: string[]): Promise<BookRecord[]>;
  updateBookMeta(id: string, patch: { title?: string; author?: string }): Promise<BookRecord | undefined>;
  saveReadingSession(bookId: string, session: ReadingSession): Promise<BookRecord | undefined>;
  exportData(): Promise<boolean>;
  importData(): Promise<boolean>;
  listCollections(): Promise<Collection[]>;
  saveCollection(collection: Collection): Promise<Collection[]>;
  removeCollection(id: string): Promise<Collection[]>;
  updateBookTags(bookId: string, tags: string[]): Promise<BookRecord | undefined>;
  addBookToCollection(collectionId: string, bookId: string): Promise<Collection[]>;
  removeBookFromCollection(collectionId: string, bookId: string): Promise<Collection[]>;
  getGoalStats(): Promise<GoalStats>;
  getPreferences(): Promise<ReaderPreferences>;
  savePreferences(preferences: Partial<ReaderPreferences>): Promise<ReaderPreferences>;
  hasCover(bookId: string): Promise<boolean>;
  saveCover(bookId: string, bytes: Uint8Array): Promise<boolean>;
}
