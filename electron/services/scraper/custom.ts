import { net } from "electron";
import { formatFromUrl, supportedExtensions } from "../bookFormats.js";
import { sizeLabelFromText } from "../library.js";
import { resultArrayFromCustomPayload, stringField } from "./dom.js";
import type { BookFormat, HtmlSourceConfig, JsonSourceConfig, JsonSourceMappings, OnlineBookResult } from "../../ipc/types.js";

export function customSourceSearchUrl(sourceUrl: string, query: string): string | undefined {
  const trimmed = sourceUrl.trim();

  if (!trimmed) {
    return undefined;
  }

  const resolved = trimmed.includes("{query}") ? trimmed.replaceAll("{query}", encodeURIComponent(query)) : trimmed;
  const url = new URL(resolved);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return undefined;
  }

  if (!trimmed.includes("{query}")) {
    url.searchParams.set("q", query);
  }

  return url.toString();
}

export function resolveCustomSourceConfig(sourceValue: string): string | JsonSourceConfig | HtmlSourceConfig | undefined {
  const trimmed = sourceValue.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!trimmed.startsWith("{")) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.adapter === "json" && typeof parsed.searchUrl === "string" && parsed.searchUrl.trim()) {
      return {
        adapter: "json",
        searchUrl: parsed.searchUrl.trim(),
        resultPath: typeof parsed.resultPath === "string" ? parsed.resultPath.trim() : undefined,
        sourceName: typeof parsed.sourceName === "string" ? parsed.sourceName.trim() : undefined,
        headers:
          parsed.headers && typeof parsed.headers === "object"
            ? Object.fromEntries(
                Object.entries(parsed.headers).filter(
                  (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
                )
              )
            : undefined,
        mappings: parsed.mappings && typeof parsed.mappings === "object" ? (parsed.mappings as JsonSourceMappings) : undefined
      };
    }

    if (parsed.adapter === "html" && typeof parsed.searchUrl === "string" && parsed.searchUrl.trim()) {
      const maxDetailPages =
        typeof parsed.maxDetailPages === "number"
          ? parsed.maxDetailPages
          : typeof parsed.maxPages === "number"
            ? parsed.maxPages
            : undefined;
      const delay =
        typeof parsed.delay === "number"
          ? Math.max(0, Math.min(parsed.delay, 5000))
          : typeof parsed.waitMs === "number"
            ? Math.max(0, Math.min(parsed.waitMs, 5000))
            : undefined;
      const timeout =
        typeof parsed.timeout === "number"
          ? Math.max(1000, Math.min(parsed.timeout, 30000))
          : typeof parsed.timeoutMs === "number"
            ? Math.max(1000, Math.min(parsed.timeoutMs, 30000))
            : undefined;
      return {
        adapter: "html",
        searchUrl: parsed.searchUrl.trim(),
        baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl.trim() : undefined,
        sourceName: typeof parsed.sourceName === "string" ? parsed.sourceName.trim() : undefined,
        headers:
          parsed.headers && typeof parsed.headers === "object"
            ? Object.fromEntries(
                Object.entries(parsed.headers).filter(
                  (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
                )
              )
            : undefined,
        itemSelector: typeof parsed.itemSelector === "string" ? parsed.itemSelector.trim() : undefined,
        titleSelector: typeof parsed.titleSelector === "string" ? parsed.titleSelector.trim() : undefined,
        authorSelector: typeof parsed.authorSelector === "string" ? parsed.authorSelector.trim() : undefined,
        coverSelector: typeof parsed.coverSelector === "string" ? parsed.coverSelector.trim() : undefined,
        coverAttr: typeof parsed.coverAttr === "string" ? parsed.coverAttr.trim() : undefined,
        downloadSelector: typeof parsed.downloadSelector === "string" ? parsed.downloadSelector.trim() : undefined,
        downloadAttr: typeof parsed.downloadAttr === "string" ? parsed.downloadAttr.trim() : undefined,
        downloadHeaders:
          parsed.downloadHeaders && typeof parsed.downloadHeaders === "object"
            ? Object.fromEntries(
                Object.entries(parsed.downloadHeaders).filter(
                  (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
                )
              )
            : undefined,
        detailLinkSelector: typeof parsed.detailLinkSelector === "string" ? parsed.detailLinkSelector.trim() : undefined,
        detailLinkAttr: typeof parsed.detailLinkAttr === "string" ? parsed.detailLinkAttr.trim() : undefined,
        format:
          typeof parsed.format === "string" && supportedExtensions().includes(parsed.format as BookFormat)
            ? (parsed.format as BookFormat)
            : undefined,
        formatAttr: typeof parsed.formatAttr === "string" ? parsed.formatAttr.trim() : undefined,
        maxDetailPages,
        delay,
        renderJs: parsed.renderJs === true || parsed.js === true || parsed.javascript === true,
        waitForSelector: typeof parsed.waitForSelector === "string" ? parsed.waitForSelector.trim() : undefined,
        autoScroll: parsed.autoScroll === true || parsed.scroll === true || parsed.scrollToBottom === true,
        timeout
      };
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export async function searchCustomBooks(query: string, sourceUrl: string, sourceName = "Custom Source"): Promise<OnlineBookResult[]> {
  const url = customSourceSearchUrl(sourceUrl, query);

  if (!url) {
    return [];
  }

  const response = await net.fetch(url);

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return resultArrayFromCustomPayload(payload)
    .map((raw, index): OnlineBookResult | undefined => {
      if (!raw || typeof raw !== "object") {
        return undefined;
      }

      const item = raw as Record<string, unknown>;
      const downloadUrl = stringField(item, ["downloadUrl", "download_url", "url", "href", "file"]);
      const title = stringField(item, ["title", "name"]);
      const sizeLabel = stringField(item, ["sizeLabel", "size_label", "size", "fileSize", "file_size"]);

      if (!downloadUrl || !title) {
        return undefined;
      }

      const format = formatFromUrl(downloadUrl, stringField(item, ["format"]) as BookFormat | undefined);

      if (!format) {
        return undefined;
      }

      return {
        id: stringField(item, ["id"]) ?? `custom-${index}-${title}`,
        source: stringField(item, ["source"]) ?? sourceName,
        title,
        author: stringField(item, ["author", "creator"]),
        language: stringField(item, ["language", "lang"]),
        subjects: Array.isArray(item.subjects) ? item.subjects.filter((value) => typeof value === "string").slice(0, 4) : [],
        coverUrl: stringField(item, ["coverUrl", "cover_url", "cover"]),
        downloadUrl,
        format,
        sizeLabel: sizeLabel || sizeLabelFromText(JSON.stringify(item))
      };
    })
    .filter((item): item is OnlineBookResult => Boolean(item))
    .slice(0, 40);
}
