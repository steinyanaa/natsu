import { getStore, normalizePreferences } from "../store.js";
import { importabilityReason } from "./dom.js";
import { withTimeout } from "./fetch.js";
import { customSourceSearchUrl, resolveCustomSourceConfig, searchCustomBooks } from "./custom.js";
import { searchGutenbergBooks } from "./gutenberg.js";
import { searchHtmlAdapterBooks, testHtmlAdapterBooks } from "./html.js";
import { searchJsonAdapterBooks, testJsonAdapterBooks } from "./json.js";
import { searchRssFeed } from "./rss.js";
import type { OnlineBookResult, OnlineSource, OnlineSourceTestReport } from "../../ipc/types.js";

export async function searchSource(query: string, source: OnlineSource): Promise<OnlineBookResult[]> {
  if (!source.enabled) {
    return [];
  }

  if (source.kind === "gutenberg") {
    return searchGutenbergBooks(query);
  }

  if (!source.value.trim()) {
    return [];
  }

  if (source.kind === "json") {
    const config = resolveCustomSourceConfig(source.value);
    if (config && typeof config === "object" && config.adapter === "json") {
      return searchJsonAdapterBooks(query, {
        ...config,
        sourceName: config.sourceName || source.name
      });
    }
    return [];
  }

  if (source.kind === "html") {
    const config = resolveCustomSourceConfig(source.value);
    if (config && typeof config === "object" && config.adapter === "html") {
      return searchHtmlAdapterBooks(query, {
        ...config,
        sourceName: config.sourceName || source.name
      });
    }

    if (typeof config === "string" && config.trim()) {
      return searchHtmlAdapterBooks(query, {
        adapter: "html",
        sourceName: source.name,
        searchUrl: config
      });
    }

    return [];
  }

  if (source.kind === "rss") {
    return searchRssFeed(query, source.value, source.name);
  }

  return searchCustomBooks(query, source.value, source.name);
}

export async function testOnlineSource(query: string, source: OnlineSource): Promise<OnlineSourceTestReport> {
  const normalizedQuery = query.trim() || "test";

  try {
    if (source.kind === "gutenberg") {
      const results = await searchGutenbergBooks(normalizedQuery);
      return {
        ok: results.length > 0,
        sourceName: "Project Gutenberg",
        kind: "gutenberg",
        fetched: true,
        itemCount: results.length,
        items: results.slice(0, 12).map((book, index) => ({
          index,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          downloadUrl: book.downloadUrl,
          format: book.format,
          sizeLabel: book.sizeLabel,
          ok: Boolean(book.downloadUrl && book.format),
          reason: importabilityReason(book.downloadUrl, book.format)
        })),
        message: results.length ? `可导入 ${results.length} 条结果` : "没有结果"
      };
    }

    if (!source.value.trim()) {
      return {
        ok: false,
        sourceName: source.name,
        kind: source.kind,
        fetched: false,
        itemCount: 0,
        items: [],
        message: "书源配置为空"
      };
    }

    const config = resolveCustomSourceConfig(source.value);

    if (source.kind === "html") {
      if (config && typeof config === "object" && config.adapter === "html") {
        return testHtmlAdapterBooks(normalizedQuery, { ...config, sourceName: config.sourceName || source.name });
      }

      if (typeof config === "string" && config.trim()) {
        return testHtmlAdapterBooks(normalizedQuery, {
          adapter: "html",
          sourceName: source.name,
          searchUrl: config
        });
      }
    }

    if (source.kind === "json") {
      if (config && typeof config === "object" && config.adapter === "json") {
        return testJsonAdapterBooks(normalizedQuery, { ...config, sourceName: config.sourceName || source.name });
      }
    }

    if (source.kind === "url") {
      const results = await searchCustomBooks(normalizedQuery, source.value, source.name);
      return {
        ok: results.length > 0,
        sourceName: source.name,
        kind: "url",
        searchUrl: customSourceSearchUrl(source.value, normalizedQuery),
        fetched: true,
        itemCount: results.length,
        items: results.slice(0, 12).map((book, index) => ({
          index,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          downloadUrl: book.downloadUrl,
          format: book.format,
          sizeLabel: book.sizeLabel,
          ok: Boolean(book.downloadUrl && book.format),
          reason: importabilityReason(book.downloadUrl, book.format)
        })),
        message: results.length ? `可导入 ${results.length} 条结果` : "没有结果"
      };
    }

    return {
      ok: false,
      sourceName: source.name,
      kind: source.kind,
      fetched: false,
      itemCount: 0,
      items: [],
      message: "配置不是当前类型可识别的适配器"
    };
  } catch (error) {
    return {
      ok: false,
      sourceName: source.name,
      kind: source.kind,
      fetched: false,
      itemCount: 0,
      items: [],
      message: error instanceof Error ? error.message : "测试失败"
    };
  }
}

export async function searchOnlineBooks(query: string): Promise<OnlineBookResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const preferences = normalizePreferences(getStore().get("preferences"));
  const enabledSources = preferences.onlineSources.filter((source) => source.enabled);
  const results = await Promise.allSettled(
    enabledSources.map((source) =>
      withTimeout(searchSource(normalizedQuery, source), 45000, [] as OnlineBookResult[])
    )
  );
  const merged: OnlineBookResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status !== "fulfilled") {
      continue;
    }

    for (const item of result.value) {
      const key = `${item.source}|${item.downloadUrl}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(item);
    }
  }

  return merged.slice(0, 80);
}
