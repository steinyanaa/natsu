import { parse, type HTMLElement } from "node-html-parser";
import { formatFromUrl, supportedExtensions, titleFromUrl } from "../bookFormats.js";
import { sizeLabelFromText } from "../library.js";
import { isZlibUrl, zlibSession } from "../zlib/session.js";
import { customSourceSearchUrl } from "./custom.js";
import {
  hrefFrom,
  htmlDownloadHeaders,
  importabilityReason,
  resolveUrl,
  selectedAttr,
  selectedText
} from "./dom.js";
import { loadHtml } from "./fetch.js";
import type { BookFormat, HtmlSourceConfig, OnlineBookResult, OnlineSourceTestItem, OnlineSourceTestReport } from "../../ipc/types.js";

function directDownloadResult(
  element: HTMLElement,
  href: string,
  baseUrl: string,
  config: HtmlSourceConfig,
  index: number
): OnlineBookResult | undefined {
  const downloadUrl = resolveUrl(baseUrl, href);

  if (!downloadUrl) {
    return undefined;
  }

  let format = formatFromUrl(downloadUrl, config.format);

  if (!format && config.formatAttr) {
    const formatValue = element.getAttribute(config.formatAttr)?.trim().toLowerCase();
    if (formatValue && supportedExtensions().includes(formatValue as BookFormat)) {
      format = formatValue as BookFormat;
    }
  }

  if (!format) {
    return undefined;
  }

  const title = selectedText(element, config.titleSelector) || selectedText(element) || titleFromUrl(downloadUrl);
  const coverUrl = resolveUrl(baseUrl, selectedAttr(element, config.coverSelector, config.coverAttr, ["data-src", "src"]));
  const sizeLabel = sizeLabelFromText(selectedText(element));

  return {
    id: `html-${index}-${downloadUrl}`,
    source: config.sourceName || "HTML Source",
    title,
    author: selectedText(element, config.authorSelector),
    subjects: [],
    coverUrl,
    downloadUrl,
    format,
    sizeLabel,
    requestHeaders: htmlDownloadHeaders(config, baseUrl)
  };
}

async function resultFromDetailPage(
  element: HTMLElement,
  detailUrl: string,
  baseUrl: string,
  config: HtmlSourceConfig,
  index: number
): Promise<OnlineBookResult | undefined> {
  const detailHtml = await loadHtml(detailUrl, config);
  if (!detailHtml) {
    return undefined;
  }

  const detailRoot = parse(detailHtml);
  const downloadHref = hrefFrom(detailRoot, config.downloadSelector || "a[href]", config.downloadAttr);
  const downloadUrl = resolveUrl(detailUrl, downloadHref);

  if (!downloadUrl) {
    return undefined;
  }

  const format = formatFromUrl(downloadUrl, config.format);

  if (!format) {
    return undefined;
  }

  const title =
    selectedText(element, config.titleSelector) ||
    selectedText(detailRoot, config.titleSelector) ||
    selectedText(detailRoot, "title") ||
    titleFromUrl(downloadUrl);
  const coverUrl =
    resolveUrl(baseUrl, selectedAttr(element, config.coverSelector, config.coverAttr, ["data-src", "src"])) ||
    resolveUrl(detailUrl, selectedAttr(detailRoot, config.coverSelector, config.coverAttr, ["data-src", "src"]));
  const sizeLabel = sizeLabelFromText(selectedText(element)) || sizeLabelFromText(selectedText(detailRoot));

  return {
    id: `html-detail-${index}-${downloadUrl}`,
    source: config.sourceName || "HTML Source",
    title,
    author: selectedText(element, config.authorSelector) || selectedText(detailRoot, config.authorSelector),
    subjects: [],
    coverUrl,
    downloadUrl,
    format,
    sizeLabel,
    requestHeaders: htmlDownloadHeaders(config, detailUrl)
  };
}

export async function searchHtmlAdapterBooks(query: string, config: HtmlSourceConfig): Promise<OnlineBookResult[]> {
  const url = customSourceSearchUrl(config.searchUrl, query);

  if (!url) {
    return [];
  }

  const sess = isZlibUrl(url) ? zlibSession() : undefined;
  const html = await loadHtml(url, config, sess);
  if (!html) {
    return [];
  }

  const root = parse(html);
  const baseUrl = config.baseUrl || url;
  const containers = config.itemSelector ? root.querySelectorAll(config.itemSelector) : root.querySelectorAll("a[href]");
  const results: OnlineBookResult[] = [];
  let followedDetails = 0;
  const maxDetailPages = Math.max(0, Math.min(config.maxDetailPages ?? 8, 20));

  for (const [index, element] of containers.entries()) {
    const downloadHref = hrefFrom(element, config.downloadSelector, config.downloadAttr);
    const direct = downloadHref ? directDownloadResult(element, downloadHref, baseUrl, config, index) : undefined;

    if (direct) {
      results.push(direct);
      continue;
    }

    const detailHref = hrefFrom(
      element,
      config.detailLinkSelector || (config.itemSelector ? "a[href]" : undefined),
      config.detailLinkAttr
    );
    const detailUrl = resolveUrl(baseUrl, detailHref);

    if (!detailUrl || followedDetails >= maxDetailPages) {
      continue;
    }

    followedDetails += 1;
    const detailResult = await resultFromDetailPage(element, detailUrl, baseUrl, config, index);
    if (detailResult) {
      results.push(detailResult);
    }
  }

  return results.slice(0, 40);
}

export async function testHtmlAdapterBooks(query: string, config: HtmlSourceConfig): Promise<OnlineSourceTestReport> {
  const url = customSourceSearchUrl(config.searchUrl, query);

  if (!url) {
    return {
      ok: false,
      sourceName: config.sourceName || "HTML Source",
      kind: "html",
      fetched: false,
      renderedJs: Boolean(config.renderJs),
      itemCount: 0,
      items: [],
      message: "searchUrl 无效，请确认包含 {query} 或可追加 ?q="
    };
  }

  const html = await loadHtml(url, config);
  if (!html) {
    return {
      ok: false,
      sourceName: config.sourceName || "HTML Source",
      kind: "html",
      searchUrl: url,
      fetched: false,
      renderedJs: Boolean(config.renderJs),
      itemCount: 0,
      items: [],
      message: "页面获取失败，可能是网络、响应状态、验证页面或渲染超时"
    };
  }

  const root = parse(html);
  const baseUrl = config.baseUrl || url;
  const containers = config.itemSelector ? root.querySelectorAll(config.itemSelector) : root.querySelectorAll("a[href]");
  const maxDetailPages = Math.max(0, Math.min(config.maxDetailPages ?? 8, 20));
  const sampleContainers = containers.slice(0, 12);
  let followedDetails = 0;
  const items: OnlineSourceTestItem[] = [];

  for (const [index, element] of sampleContainers.entries()) {
    const title = selectedText(element, config.titleSelector) || selectedText(element);
    const author = selectedText(element, config.authorSelector);
    const coverUrl = resolveUrl(baseUrl, selectedAttr(element, config.coverSelector, config.coverAttr, ["data-src", "src"]));
    const sizeLabel = sizeLabelFromText(selectedText(element));
    const directHref = hrefFrom(element, config.downloadSelector, config.downloadAttr);
    let downloadUrl = resolveUrl(baseUrl, directHref);
    let detailUrl: string | undefined;

    if (!downloadUrl && followedDetails < maxDetailPages) {
      const detailHref = hrefFrom(
        element,
        config.detailLinkSelector || (config.itemSelector ? "a[href]" : undefined),
        config.detailLinkAttr
      );
      detailUrl = resolveUrl(baseUrl, detailHref);

      if (detailUrl) {
        followedDetails += 1;
        const detailHtml = await loadHtml(detailUrl, config);
        if (detailHtml) {
          const detailRoot = parse(detailHtml);
          downloadUrl = resolveUrl(detailUrl, hrefFrom(detailRoot, config.downloadSelector || "a[href]", config.downloadAttr));
        }
      }
    } else {
      const detailHref = hrefFrom(
        element,
        config.detailLinkSelector || (config.itemSelector ? "a[href]" : undefined),
        config.detailLinkAttr
      );
      detailUrl = resolveUrl(baseUrl, detailHref);
    }

    const format = downloadUrl ? formatFromUrl(downloadUrl, config.format) : undefined;
    const reason = importabilityReason(downloadUrl, format);
    items.push({
      index,
      title,
      author,
      coverUrl,
      detailUrl,
      downloadUrl,
      format,
      sizeLabel,
      ok: !reason,
      reason
    });
  }

  const okCount = items.filter((item) => item.ok).length;
  return {
    ok: okCount > 0,
    sourceName: config.sourceName || "HTML Source",
    kind: "html",
    searchUrl: url,
    fetched: true,
    renderedJs: Boolean(config.renderJs),
    itemCount: containers.length,
    items,
    message:
      containers.length === 0
        ? "页面已获取，但 itemSelector 没匹配到结果"
        : okCount > 0
          ? `可导入 ${okCount} / ${items.length} 条样本`
          : "匹配到了结果，但样本里没有可直接导入的下载链接"
  };
}
