import { formatFromUrl } from "../bookFormats.js";
import { sizeLabelFromText } from "../library.js";
import { customSourceSearchUrl } from "./custom.js";
import { normalizeSubjects, resultArrayFromCustomPayload, valueByPath } from "./dom.js";
import { fetchJson } from "./fetch.js";
import type { BookFormat, JsonSourceConfig, OnlineBookResult, OnlineSourceTestItem, OnlineSourceTestReport } from "../../ipc/types.js";

function mapJsonResult(item: unknown, config: JsonSourceConfig, index: number): OnlineBookResult | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const mappings = config.mappings ?? {};
  const object = item as Record<string, unknown>;
  const id = valueByPath(object, mappings.id);
  const title = valueByPath(object, mappings.title);
  const author = valueByPath(object, mappings.author);
  const language = valueByPath(object, mappings.language);
  const subjects = valueByPath(object, mappings.subjects);
  const coverUrl = valueByPath(object, mappings.coverUrl);
  const downloadUrl = valueByPath(object, mappings.downloadUrl);
  const formatValue = valueByPath(object, mappings.format);
  const sizeValue = valueByPath(object, mappings.sizeLabel ?? mappings.size);
  const source = valueByPath(object, mappings.source);

  if (typeof title !== "string" || typeof downloadUrl !== "string") {
    return undefined;
  }

  const format = formatFromUrl(downloadUrl, typeof formatValue === "string" ? (formatValue as BookFormat) : undefined);

  if (!format) {
    return undefined;
  }

  return {
    id: typeof id === "string" && id.trim() ? id : `json-${index}-${title}`,
    source: typeof source === "string" && source.trim() ? source : config.sourceName || "Custom source",
    title: title.trim(),
    author: typeof author === "string" && author.trim() ? author.trim() : undefined,
    language: typeof language === "string" && language.trim() ? language.trim() : undefined,
    subjects: normalizeSubjects(subjects),
    coverUrl: typeof coverUrl === "string" && coverUrl.trim() ? coverUrl.trim() : undefined,
    downloadUrl: downloadUrl.trim(),
    format,
    sizeLabel: typeof sizeValue === "string" && sizeValue.trim() ? sizeValue.trim() : sizeLabelFromText(JSON.stringify(object))
  };
}

export async function searchJsonAdapterBooks(query: string, config: JsonSourceConfig): Promise<OnlineBookResult[]> {
  const url = customSourceSearchUrl(config.searchUrl, query);

  if (!url) {
    return [];
  }

  const payload = await fetchJson(url, config.headers);
  const root = config.resultPath ? valueByPath(payload, config.resultPath) : payload;
  return resultArrayFromCustomPayload(root)
    .map((item, index) => mapJsonResult(item, config, index))
    .filter((item): item is OnlineBookResult => Boolean(item))
    .slice(0, 40);
}

export async function testJsonAdapterBooks(query: string, config: JsonSourceConfig): Promise<OnlineSourceTestReport> {
  const url = customSourceSearchUrl(config.searchUrl, query);
  if (!url) {
    return {
      ok: false,
      sourceName: config.sourceName || "JSON Source",
      kind: "json",
      fetched: false,
      itemCount: 0,
      items: [],
      message: "searchUrl 无效"
    };
  }

  const payload = await fetchJson(url, config.headers);
  const root = config.resultPath ? valueByPath(payload, config.resultPath) : payload;
  const rawItems = resultArrayFromCustomPayload(root).slice(0, 12);
  const items = rawItems.map((item, index): OnlineSourceTestItem => {
    const mapped = mapJsonResult(item, config, index);
    return {
      index,
      title: mapped?.title,
      author: mapped?.author,
      coverUrl: mapped?.coverUrl,
      downloadUrl: mapped?.downloadUrl,
      format: mapped?.format,
      sizeLabel: mapped?.sizeLabel,
      ok: Boolean(mapped),
      reason: mapped ? undefined : "JSON 映射后缺少 title/downloadUrl，或无法判断格式"
    };
  });

  const okCount = items.filter((item) => item.ok).length;
  return {
    ok: okCount > 0,
    sourceName: config.sourceName || "JSON Source",
    kind: "json",
    searchUrl: url,
    fetched: true,
    itemCount: resultArrayFromCustomPayload(root).length,
    items,
    message: okCount > 0 ? `可导入 ${okCount} / ${items.length} 条样本` : "没有解析到可导入结果"
  };
}
