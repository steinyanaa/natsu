import * as pdfjs from "pdfjs-dist";
import type { BookFormat } from "../types";
import { extractEpubCover } from "./epub";
import { openRarComic, openZipComic } from "./comic";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

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

const PDF_COVER_WIDTH = 400;

async function generateEpubCover(file: Blob): Promise<Blob | undefined> {
  const url = await extractEpubCover(file);
  if (!url) return undefined;
  try {
    return await fetch(url).then((r) => r.blob());
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function generatePdfCover(data: ArrayBuffer): Promise<Blob | undefined> {
  const pdf = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = PDF_COVER_WIDTH / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    return await new Promise<Blob | undefined>((resolve) =>
      canvas.toBlob((blob) => resolve(blob ?? undefined), "image/webp", 0.85)
    );
  } finally {
    await pdf.destroy();
  }
}

async function generateComicCover(format: BookFormat, file: Blob): Promise<Blob | undefined> {
  const source =
    format === "cbr" || format === "rar"
      ? await openRarComic(await file.arrayBuffer())
      : await openZipComic(file);
  try {
    if (!source.pages.length) return undefined;
    const url = await source.extractPage(0);
    if (!url) return undefined;
    return await fetch(url).then((r) => r.blob());
  } finally {
    source.dispose();
  }
}

export async function generateCover(format: BookFormat, file: Blob): Promise<Blob | undefined> {
  const path = coverEligibleFormat(format);
  if (path === "epub") return generateEpubCover(file);
  if (path === "pdf") return generatePdfCover(await file.arrayBuffer());
  if (path === "comic") return generateComicCover(format, file);
  return undefined;
}
