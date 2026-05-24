import path from "node:path";

export type BookFormat =
  | "epub"
  | "txt"
  | "mobi"
  | "azw3"
  | "pdf"
  | "cbz"
  | "zip"
  | "cbr"
  | "rar";

export function supportedExtensions(): BookFormat[] {
  return ["epub", "txt", "mobi", "azw3", "pdf", "cbz", "zip", "cbr", "rar"];
}

export function formatFromPath(filePath: string): BookFormat | undefined {
  const extension = path.extname(filePath).slice(1).toLowerCase();

  if (supportedExtensions().includes(extension as BookFormat)) {
    return extension as BookFormat;
  }

  return undefined;
}

export function formatFromUrl(url: string, explicitFormat?: BookFormat): BookFormat | undefined {
  if (explicitFormat && supportedExtensions().includes(explicitFormat)) {
    return explicitFormat;
  }

  try {
    const parsed = new URL(url);
    return formatFromPath(parsed.pathname);
  } catch {
    return undefined;
  }
}

export function titleFromFile(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/[_-]+/g, " ");
}

export function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return titleFromFile(decodeURIComponent(parsed.pathname.split("/").pop() || "book"));
  } catch {
    return "Online book";
  }
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 96);
}
