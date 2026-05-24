import type { BookFormat } from "../ipc/types.js";

export { ensureCoverDir, coverPathFor } from "../paths.js";

export function contentTypeFor(format: BookFormat): string {
  if (format === "pdf") return "application/pdf";
  if (format === "epub") return "application/epub+zip";
  if (format === "txt") return "text/plain; charset=utf-8";
  if (format === "zip" || format === "cbz") return "application/zip";
  if (format === "rar" || format === "cbr") return "application/vnd.rar";
  return "application/octet-stream";
}
