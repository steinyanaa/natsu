import type { LanguageCode } from "./types";

export type TranslationKey =
  | "appName"
  | "library"
  | "recent"
  | "settings"
  | "import"
  | "search"
  | "all"
  | "novels"
  | "comics"
  | "pdf"
  | "grid"
  | "list"
  | "emptyTitle"
  | "emptyBody"
  | "continueReading"
  | "open"
  | "remove"
  | "back"
  | "bookmark"
  | "bookmarked"
  | "addBookmark"
  | "rename"
  | "deleteSelected"
  | "selectAll"
  | "clearSelection"
  | "bookmarkAdded"
  | "contents"
  | "appearance"
  | "theme"
  | "themeMode"
  | "themeSource"
  | "presetTheme"
  | "seedColor"
  | "customColors"
  | "primaryColor"
  | "secondaryColor"
  | "tertiaryColor"
  | "surfaceColor"
  | "language"
  | "motion"
  | "readerMode"
  | "fontSize"
  | "lineHeight"
  | "columnWidth"
  | "fontFamily"
  | "customFont"
  | "fontPreview"
  | "imageScale"
  | "fitScreen"
  | "autoAlign"
  | "ramune"
  | "seaside"
  | "natsumatsuri"
  | "google-night"
  | "sourcePreset"
  | "sourceSeed"
  | "sourceCustom"
  | "modeSystem"
  | "modeLight"
  | "modeDark"
  | "fontSerifCn"
  | "fontSans"
  | "fontKai"
  | "fontJpSerif"
  | "fontSerifEn"
  | "fontCustom"
  | "zh"
  | "ja"
  | "en"
  | "fullMotion"
  | "gentleMotion"
  | "reducedMotion"
  | "scroll"
  | "paged"
  | "loading"
  | "loadError"
  | "unsupported"
  | "previous"
  | "next"
  | "zoomIn"
  | "zoomOut"
  | "page"
  | "progress"
  | "bookmarks"
  | "noBookmarks"
  | "noRecent"
  | "notes"
  | "closeNote"
  | "clearNotes"
  | "confirmRemove"
  | "cancel"
  | "editMetadata"
  | "saveChanges"
  | "titleLabel"
  | "authorLabel"
  | "dropToImport"
  | "sortBy"
  | "sortRecent"
  | "sortTitle"
  | "sortAuthor"
  | "sortProgress"
  | "sortSize"
  | "stats"
  | "thisWeek"
  | "totalMinutes"
  | "activeDays"
  | "noStats"
  | "exportData"
  | "importData"
  | "dataManagement";

const zh: Record<TranslationKey, string> = {
  appName: "Natsu",
  library: "书架",
  recent: "最近",
  settings: "设置",
  import: "导入",
  search: "搜索书名、格式",
  all: "全部",
  novels: "小说",
  comics: "漫画",
  pdf: "PDF",
  grid: "网格",
  list: "列表",
  emptyTitle: "把书放进这个夏天",
  emptyBody: "支持 EPUB、TXT、MOBI、PDF、CBZ 和 CBR。本地导入，本地阅读。",
  continueReading: "继续阅读",
  open: "打开",
  remove: "移除",
  back: "返回",
  bookmark: "书签",
  bookmarked: "已加书签",
  addBookmark: "添加书签",
  rename: "重命名",
  deleteSelected: "删除所选",
  selectAll: "全选",
  clearSelection: "取消选择",
  bookmarkAdded: "已添加书签",
  contents: "目录",
  appearance: "外观",
  theme: "主题",
  themeMode: "主题模式",
  themeSource: "配色来源",
  presetTheme: "预设主题",
  seedColor: "Seed Color",
  customColors: "自定义颜色",
  primaryColor: "Primary",
  secondaryColor: "Secondary",
  tertiaryColor: "Tertiary",
  surfaceColor: "Surface",
  language: "语言",
  motion: "动效",
  readerMode: "阅读模式",
  fontSize: "字号",
  lineHeight: "行距",
  columnWidth: "栏宽",
  fontFamily: "字体",
  customFont: "自定义字体栈",
  fontPreview: "字体预览：夏日、青春、物语、Reading",
  imageScale: "插图大小",
  fitScreen: "自适应屏幕",
  autoAlign: "自动对齐",
  ramune: "波子汽水",
  seaside: "海边薄荷",
  natsumatsuri: "夏祭夜",
  "google-night": "Google 暗夜",
  sourcePreset: "预设",
  sourceSeed: "Seed",
  sourceCustom: "自定义",
  modeSystem: "跟随系统",
  modeLight: "亮色",
  modeDark: "暗色",
  fontSerifCn: "文学宋体",
  fontSans: "系统黑体",
  fontKai: "楷体",
  fontJpSerif: "日文明朝",
  fontSerifEn: "英文衬线",
  fontCustom: "自定义",
  zh: "中文",
  ja: "日本語",
  en: "English",
  fullMotion: "完整",
  gentleMotion: "柔和",
  reducedMotion: "减少",
  scroll: "连续",
  paged: "分页",
  loading: "加载中",
  loadError: "文件加载失败",
  unsupported: "这个文件暂时无法解析，可能已加密或格式损坏。",
  previous: "上一页",
  next: "下一页",
  zoomIn: "放大",
  zoomOut: "缩小",
  page: "页",
  progress: "进度",
  bookmarks: "书签",
  noBookmarks: "还没有书签",
  noRecent: "还没有最近阅读",
  notes: "注释",
  closeNote: "关闭注释",
  clearNotes: "清空",
  confirmRemove: "确认移除",
  cancel: "取消",
  editMetadata: "编辑书籍信息",
  saveChanges: "保存",
  titleLabel: "书名",
  authorLabel: "作者",
  dropToImport: "松开以导入",
  sortBy: "排序",
  sortRecent: "最近",
  sortTitle: "书名",
  sortAuthor: "作者",
  sortProgress: "进度",
  sortSize: "大小",
  stats: "统计",
  thisWeek: "本周",
  totalMinutes: "总分钟",
  activeDays: "活跃天数",
  noStats: "还没有阅读记录",
  exportData: "导出数据",
  importData: "导入数据",
  dataManagement: "数据管理"
};

const ja: Record<TranslationKey, string> = {
  appName: "Natsu",
  library: "本棚",
  recent: "最近",
  settings: "設定",
  import: "読み込む",
  search: "タイトル・形式を検索",
  all: "すべて",
  novels: "小説",
  comics: "漫画",
  pdf: "PDF",
  grid: "グリッド",
  list: "リスト",
  emptyTitle: "夏の本棚をつくる",
  emptyBody: "EPUB、TXT、MOBI、PDF、CBZ、CBR に対応。ローカルで読めます。",
  continueReading: "続きを読む",
  open: "開く",
  remove: "削除",
  back: "戻る",
  bookmark: "しおり",
  bookmarked: "しおり済み",
  addBookmark: "しおりを追加",
  rename: "名前変更",
  deleteSelected: "選択を削除",
  selectAll: "すべて選択",
  clearSelection: "選択解除",
  bookmarkAdded: "しおりを追加しました",
  contents: "目次",
  appearance: "外観",
  theme: "テーマ",
  themeMode: "テーマモード",
  themeSource: "配色ソース",
  presetTheme: "プリセット",
  seedColor: "Seed Color",
  customColors: "カスタムカラー",
  primaryColor: "Primary",
  secondaryColor: "Secondary",
  tertiaryColor: "Tertiary",
  surfaceColor: "Surface",
  language: "言語",
  motion: "動き",
  readerMode: "読書モード",
  fontSize: "文字サイズ",
  lineHeight: "行間",
  columnWidth: "本文幅",
  fontFamily: "フォント",
  customFont: "カスタムフォント",
  fontPreview: "プレビュー：夏日、青春、物語、Reading",
  imageScale: "挿絵サイズ",
  fitScreen: "画面に合わせる",
  autoAlign: "自動整列",
  ramune: "ラムネ",
  seaside: "海辺ミント",
  natsumatsuri: "夏祭りの夜",
  "google-night": "Google ナイト",
  sourcePreset: "プリセット",
  sourceSeed: "Seed",
  sourceCustom: "カスタム",
  modeSystem: "システム",
  modeLight: "ライト",
  modeDark: "ダーク",
  fontSerifCn: "中文セリフ",
  fontSans: "システムゴシック",
  fontKai: "楷書",
  fontJpSerif: "明朝",
  fontSerifEn: "欧文セリフ",
  fontCustom: "カスタム",
  zh: "中文",
  ja: "日本語",
  en: "English",
  fullMotion: "楽しい",
  gentleMotion: "やさしい",
  reducedMotion: "少なめ",
  scroll: "スクロール",
  paged: "ページ",
  loading: "読み込み中",
  loadError: "ファイルを読み込めません",
  unsupported: "暗号化または破損のため、この形式を解析できません。",
  previous: "前へ",
  next: "次へ",
  zoomIn: "拡大",
  zoomOut: "縮小",
  page: "ページ",
  progress: "進捗",
  bookmarks: "しおり",
  noBookmarks: "しおりはまだありません",
  noRecent: "最近読んだ本はまだありません",
  notes: "注釈",
  closeNote: "注釈を閉じる",
  clearNotes: "クリア",
  confirmRemove: "削除確認",
  cancel: "キャンセル",
  editMetadata: "書籍情報を編集",
  saveChanges: "保存",
  titleLabel: "タイトル",
  authorLabel: "著者",
  dropToImport: "ドロップして読み込む",
  sortBy: "並び替え",
  sortRecent: "最近",
  sortTitle: "タイトル",
  sortAuthor: "著者",
  sortProgress: "進捗",
  sortSize: "サイズ",
  stats: "統計",
  thisWeek: "今週",
  totalMinutes: "合計分",
  activeDays: "活動日数",
  noStats: "読書記録はまだありません",
  exportData: "データをエクスポート",
  importData: "データをインポート",
  dataManagement: "データ管理"
};

const en: Record<TranslationKey, string> = {
  appName: "Natsu",
  library: "Library",
  recent: "Recent",
  settings: "Settings",
  import: "Import",
  search: "Search title or format",
  all: "All",
  novels: "Novels",
  comics: "Comics",
  pdf: "PDF",
  grid: "Grid",
  list: "List",
  emptyTitle: "Bring books into summer",
  emptyBody: "Read EPUB, TXT, MOBI, PDF, CBZ and CBR locally.",
  continueReading: "Continue",
  open: "Open",
  remove: "Remove",
  back: "Back",
  bookmark: "Bookmark",
  bookmarked: "Bookmarked",
  addBookmark: "Add bookmark",
  rename: "Rename",
  deleteSelected: "Delete selected",
  selectAll: "Select all",
  clearSelection: "Clear selection",
  bookmarkAdded: "Bookmark added",
  contents: "Contents",
  appearance: "Appearance",
  theme: "Theme",
  themeMode: "Theme mode",
  themeSource: "Color source",
  presetTheme: "Preset theme",
  seedColor: "Seed Color",
  customColors: "Custom colors",
  primaryColor: "Primary",
  secondaryColor: "Secondary",
  tertiaryColor: "Tertiary",
  surfaceColor: "Surface",
  language: "Language",
  motion: "Motion",
  readerMode: "Reading mode",
  fontSize: "Font size",
  lineHeight: "Line height",
  columnWidth: "Text width",
  fontFamily: "Font",
  customFont: "Custom font stack",
  fontPreview: "Preview: 夏日, 青春, 物語, Reading",
  imageScale: "Image size",
  fitScreen: "Fit screen",
  autoAlign: "Auto align",
  ramune: "Ramune Blue",
  seaside: "Seaside Mint",
  natsumatsuri: "Natsumatsuri",
  "google-night": "Google Night",
  sourcePreset: "Preset",
  sourceSeed: "Seed",
  sourceCustom: "Custom",
  modeSystem: "System",
  modeLight: "Light",
  modeDark: "Dark",
  fontSerifCn: "Literary serif",
  fontSans: "System sans",
  fontKai: "Kai style",
  fontJpSerif: "JP Mincho",
  fontSerifEn: "English serif",
  fontCustom: "Custom",
  zh: "中文",
  ja: "日本語",
  en: "English",
  fullMotion: "Full",
  gentleMotion: "Gentle",
  reducedMotion: "Reduced",
  scroll: "Scroll",
  paged: "Paged",
  loading: "Loading",
  loadError: "Could not load file",
  unsupported: "This file cannot be parsed. It may be encrypted or damaged.",
  previous: "Previous",
  next: "Next",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  page: "Page",
  progress: "Progress",
  bookmarks: "Bookmarks",
  noBookmarks: "No bookmarks yet",
  noRecent: "No recent books yet",
  notes: "Notes",
  closeNote: "Close note",
  clearNotes: "Clear",
  confirmRemove: "Confirm removal",
  cancel: "Cancel",
  editMetadata: "Edit book info",
  saveChanges: "Save",
  titleLabel: "Title",
  authorLabel: "Author",
  dropToImport: "Drop to import",
  sortBy: "Sort",
  sortRecent: "Recent",
  sortTitle: "Title",
  sortAuthor: "Author",
  sortProgress: "Progress",
  sortSize: "Size",
  stats: "Stats",
  thisWeek: "This week",
  totalMinutes: "Total min",
  activeDays: "Active days",
  noStats: "No reading sessions yet",
  exportData: "Export data",
  importData: "Import data",
  dataManagement: "Data management"
};

const dictionaries = {
  "zh-CN": zh,
  "ja-JP": ja,
  "en-US": en
};

export function createTranslator(language: LanguageCode) {
  const dictionary = dictionaries[language] ?? dictionaries["zh-CN"];
  return (key: TranslationKey) => dictionary[key] ?? key;
}
