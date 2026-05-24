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

export interface ReaderProgress {
  kind: "text" | "page" | "epub";
  current: number;
  total?: number;
  percent: number;
  label?: string;
  cfi?: string;
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

export interface ThemeCustomColors {
  primary: string;
  secondary: string;
  tertiary: string;
  surface: string;
}

export interface ReaderPreferences {
  theme: "ramune" | "seaside" | "natsumatsuri" | "google-night";
  themeMode: "system" | "light" | "dark";
  themeSource: "preset" | "seed" | "custom";
  themeSeedColor: string;
  customColors: ThemeCustomColors;
  language: "zh-CN" | "ja-JP" | "en-US";
  motion: "full" | "gentle" | "reduced";
  readerMode: "scroll" | "paged";
  fontSize: number;
  lineHeight: number;
  columnWidth: number;
  fontFamily: "serif-cn" | "sans" | "kai" | "jp-serif" | "serif-en" | "custom";
  customFontStack: string;
  imageScale: number;
  imageMode: "manual" | "fit-screen";
  autoAlign: boolean;
  reduceMotion: boolean;
  pageTurnStyle: "slide" | "fade" | "none";
  spread: "auto" | "single" | "double";
  tapToTurn: boolean;
  onlineSources: OnlineSource[];
  readerColorPreset: "default" | "paper" | "quiet" | "gray" | "night";
  brightness: number;
  pageMargin: "narrow" | "normal" | "wide";
  justify: boolean;
  hyphenate: boolean;
  preferencesVersion: number;
  dailyGoalMinutes?: number;
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

export interface OnlineSource {
  id: string;
  name: string;
  enabled: boolean;
  kind: "gutenberg" | "url" | "json" | "html" | "rss";
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
  kind: OnlineSource["kind"];
  searchUrl?: string;
  fetched: boolean;
  renderedJs?: boolean;
  itemCount: number;
  items: OnlineSourceTestItem[];
  message?: string;
}

export interface JsonSourceMappings {
  id?: string;
  title?: string;
  author?: string;
  language?: string;
  subjects?: string;
  coverUrl?: string;
  downloadUrl?: string;
  format?: string;
  sizeLabel?: string;
  size?: string;
  source?: string;
}

export interface JsonSourceConfig {
  adapter: "json";
  searchUrl: string;
  resultPath?: string;
  sourceName?: string;
  headers?: Record<string, string>;
  mappings?: JsonSourceMappings;
}

export interface HtmlSourceConfig {
  adapter: "html";
  searchUrl: string;
  baseUrl?: string;
  sourceName?: string;
  headers?: Record<string, string>;
  itemSelector?: string;
  titleSelector?: string;
  authorSelector?: string;
  coverSelector?: string;
  coverAttr?: string;
  downloadSelector?: string;
  downloadAttr?: string;
  downloadHeaders?: Record<string, string>;
  detailLinkSelector?: string;
  detailLinkAttr?: string;
  format?: BookFormat;
  // When the download URL has no extension (e.g. z-library /dl/abc), read
  // the file format from this attribute on the item element instead.
  formatAttr?: string;
  maxDetailPages?: number;
  delay?: number;
  renderJs?: boolean;
  waitForSelector?: string;
  autoScroll?: boolean;
  timeout?: number;
}

export interface ZLibStatus {
  loggedIn: boolean;
  email?: string;
  remaining?: number;
  dailyLimit?: number;
}

export interface ReadingSession {
  bookId: string;
  start: string;
  end: string;
  charsRead: number;
}

export interface BookRecord {
  id: string;
  hash: string;
  title: string;
  author?: string;
  format: BookFormat;
  fileName: string;
  filePath: string;
  size: number;
  importedAt: string;
  lastOpenedAt?: string;
  progress?: ReaderProgress;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  preferences?: Partial<ReaderPreferences>;
  coverSeed: number;
  readingSessions?: ReadingSession[];
}

export interface ClientBookRecord extends Omit<BookRecord, "filePath"> {
  fileUrl: string;
}

export interface Collection {
  id: string;
  name: string;
  bookIds: string[];
  color?: string;
  createdAt: string;
}

export interface ZlibCache {
  email?: string;
  remaining?: number;
  dailyLimit?: number;
  cachedAt: number;
}

export interface StoreShape {
  books: BookRecord[];
  preferences: ReaderPreferences;
  collections: Collection[];
  zlibCache?: ZlibCache;
}
