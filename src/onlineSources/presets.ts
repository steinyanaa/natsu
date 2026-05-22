import type { BookSourcePreset } from "../types";

export const BOOK_SOURCE_PRESETS: BookSourcePreset[] = [
  {
    id: "wenku8",
    name: "轻小说文库",
    description: "日系轻小说中文翻译",
    kind: "html",
    value: JSON.stringify({
      adapter: "html",
      searchUrl: "https://www.wenku8.net/modules/article/search.php?searchtype=all&searchkey={q}",
      itemSelector: "td.ccss a",
      titleSelector: "a",
      downloadSelector: "a[href*='.txt'], a[href*='.epub']",
      downloadAttr: "href",
      format: "txt",
      sourceName: "轻小说文库"
    }),
    requiresUserUrl: false
  },
  {
    id: "standard-ebooks",
    name: "Standard Ebooks",
    description: "高质量公版书 · 英文",
    kind: "rss",
    value: "https://standardebooks.org/rss/new-releases",
    requiresUserUrl: false
  },
  {
    id: "zlibrary",
    name: "zlibrary",
    description: "需要填入你当前可用的镜像地址",
    kind: "url",
    value: "",
    requiresUserUrl: true
  }
];
