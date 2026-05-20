import type { BookFormat } from "../types";

const comicFormats: BookFormat[] = ["cbz", "zip", "cbr", "rar"];

export function loadPdfPane() {
  return import("./PdfPane");
}

export function loadComicPane() {
  return import("./ComicPane");
}

export function preloadReaderPaneForFormat(format: BookFormat): void {
  if (format === "pdf") {
    void loadPdfPane();
    return;
  }

  if (comicFormats.includes(format)) {
    void loadComicPane();
  }
}
