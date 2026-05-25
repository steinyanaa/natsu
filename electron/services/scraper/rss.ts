import { net } from "electron";
import { parse } from "node-html-parser";
import { withTimeout } from "./fetch.js";
import type { BookFormat, OnlineBookResult } from "../../ipc/types.js";

export async function searchRssFeed(query: string, feedUrl: string, sourceName: string): Promise<OnlineBookResult[]> {
  const resolvedUrl = feedUrl.replace(/\{q\}/g, encodeURIComponent(query));
  try {
    const response = await withTimeout(net.fetch(resolvedUrl, {
      headers: { "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml" }
    }), 15000, null);
    if (!response || !response.ok) return [];
    const xml = await response.text();
    const doc = parse(xml);
    const lowerQuery = query.toLowerCase();

    const items = doc.querySelectorAll("item, entry");
    const results: OnlineBookResult[] = [];

    for (const item of items) {
      const title = item.querySelector("title")?.text?.trim() ?? "";
      const author = item.querySelector("author name, dc\\:creator, author")?.text?.trim() ?? "";
      const link = item.querySelector("enclosure")?.getAttribute("url")
        ?? item.querySelector("link[rel='enclosure']")?.getAttribute("href")
        ?? item.querySelector("link")?.getAttribute("href")
        ?? item.querySelector("link")?.text?.trim()
        ?? "";

      if (!feedUrl.includes("{q}")) {
        const haystack = `${title} ${author}`.toLowerCase();
        if (!haystack.includes(lowerQuery)) continue;
      }

      if (!link) continue;

      const enclosureType = item.querySelector("enclosure")?.getAttribute("type") ?? "";
      const format: BookFormat | undefined =
        link.endsWith(".epub") || enclosureType.includes("epub") ? "epub"
        : link.endsWith(".pdf") || enclosureType.includes("pdf") ? "pdf"
        : link.endsWith(".txt") || enclosureType.includes("text/plain") ? "txt"
        : undefined;

      if (!format) continue;

      const coverUrl = item.querySelector("image url, media\\:thumbnail, itunes\\:image")?.text?.trim()
        ?? item.querySelector("media\\:thumbnail")?.getAttribute("url")
        ?? undefined;

      results.push({
        id: `rss-${Buffer.from(link).toString("base64").slice(0, 16)}`,
        source: sourceName,
        title: title || "Untitled",
        author: author || undefined,
        language: undefined,
        subjects: [],
        coverUrl: coverUrl || undefined,
        downloadUrl: link,
        format,
        sizeLabel: undefined
      });
    }
    return results.slice(0, 40);
  } catch {
    return [];
  }
}
