import type { BookFormat } from "../types";

export type CoverPath = "epub" | "pdf" | "comic";

export function coverEligibleFormat(format: BookFormat): CoverPath | null {
  switch (format) {
    case "epub": return "epub";
    case "pdf": return "pdf";
    case "cbz":
    case "zip":
    case "cbr":
    case "rar": return "comic";
    default: return null;
  }
}

export function coverUrl(id: string, version?: string): string {
  return `manga-reader://cover/${encodeURIComponent(id)}?v=${version || id}`;
}
