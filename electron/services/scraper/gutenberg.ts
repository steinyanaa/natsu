import { net } from "electron";
import { formatFromUrl } from "../bookFormats.js";
import type { BookFormat, OnlineBookResult } from "../../ipc/types.js";

export function firstDownloadUrl(formats: Record<string, unknown>): { url: string; format: BookFormat } | undefined {
  const priorities: Array<[string, BookFormat]> = [
    ["application/epub+zip", "epub"],
    ["application/x-mobipocket-ebook", "mobi"],
    ["text/plain", "txt"],
    ["application/pdf", "pdf"]
  ];

  for (const [mime, format] of priorities) {
    const value = formats[mime];
    if (typeof value === "string") {
      return { url: value, format };
    }
  }

  for (const [key, value] of Object.entries(formats)) {
    if (typeof value !== "string") {
      continue;
    }

    const format = formatFromUrl(value);
    if (format) {
      return { url: value, format };
    }

    if (key.startsWith("text/plain")) {
      return { url: value, format: "txt" };
    }
  }

  return undefined;
}

export async function searchGutenbergBooks(query: string): Promise<OnlineBookResult[]> {
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
  const response = await net.fetch(url);

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    results?: Array<{
      id?: number;
      title?: string;
      authors?: Array<{ name?: string }>;
      languages?: string[];
      subjects?: string[];
      formats?: Record<string, unknown>;
      download_count?: number;
    }>;
  };

  return (data.results ?? [])
    .map((item): OnlineBookResult | undefined => {
      const download = firstDownloadUrl(item.formats ?? {});
      if (!item.id || !item.title || !download) {
        return undefined;
      }

      return {
        id: `gutenberg-${item.id}`,
        source: "Project Gutenberg",
        title: item.title,
        author: item.authors?.map((author) => author.name).filter(Boolean).join(", "),
        language: item.languages?.join(", "),
        subjects: (item.subjects ?? []).slice(0, 4),
        coverUrl:
          typeof item.formats?.["image/jpeg"] === "string" ? (item.formats["image/jpeg"] as string) : undefined,
        downloadUrl: download.url,
        format: download.format,
        downloads: item.download_count
      };
    })
    .filter((item): item is OnlineBookResult => Boolean(item))
    .slice(0, 20);
}
