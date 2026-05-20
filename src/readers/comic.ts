import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { createExtractorFromData } from "node-unrar-js/esm";
import unrarWasmUrl from "node-unrar-js/esm/js/unrar.wasm?url";

export interface ComicPage {
  name: string;
  url: string;
}

const imagePattern = /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i;

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "image/jpeg";
}

export async function readZipComic(blob: Blob): Promise<ComicPage[]> {
  const reader = new ZipReader(new BlobReader(blob));
  const entries = await reader.getEntries();
  const pages: ComicPage[] = [];

  for (const entry of entries.sort((a, b) => naturalCompare(a.filename, b.filename))) {
    if (entry.directory || !imagePattern.test(entry.filename) || !entry.getData) {
      continue;
    }

    const pageBlob = await entry.getData(new BlobWriter(mimeFromName(entry.filename)));
    pages.push({
      name: entry.filename,
      url: URL.createObjectURL(pageBlob)
    });
  }

  await reader.close();
  return pages;
}

let _wasmCache: ArrayBuffer | null = null;

async function getUnrarWasm(): Promise<ArrayBuffer> {
  if (!_wasmCache) {
    const res = await fetch(unrarWasmUrl);
    _wasmCache = await res.arrayBuffer();
  }
  return _wasmCache.slice(0);
}

export async function readRarComic(buffer: ArrayBuffer): Promise<ComicPage[]> {
  const wasmBinary = await getUnrarWasm();
  const extractor = await createExtractorFromData({ data: buffer, wasmBinary });
  const fileHeaders = [...extractor.getFileList().fileHeaders]
    .filter((header) => !header.flags.directory && imagePattern.test(header.name))
    .sort((a, b) => naturalCompare(a.name, b.name));

  const selected = new Set(fileHeaders.map((header) => header.name));
  const extracted = extractor.extract({
    files: (header) => selected.has(header.name)
  });

  const pages: ComicPage[] = [];

  for (const file of extracted.files) {
    if (!file.extraction || !imagePattern.test(file.fileHeader.name)) {
      continue;
    }

    const bytes = new Uint8Array(file.extraction);
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
      type: mimeFromName(file.fileHeader.name)
    });

    pages.push({
      name: file.fileHeader.name,
      url: URL.createObjectURL(blob)
    });
  }

  return pages.sort((a, b) => naturalCompare(a.name, b.name));
}
