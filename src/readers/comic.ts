import { BlobReader, BlobWriter, ZipReader, type FileEntry } from "@zip.js/zip.js";
import { createExtractorFromData } from "node-unrar-js/esm";
import unrarWasmUrl from "node-unrar-js/esm/js/unrar.wasm?url";

export interface ComicPage {
  name: string;
  /** blob URL, empty string until extracted */
  url: string;
}

export interface ComicSource {
  pages: ComicPage[];
  /** Extract a single page and update its url in-place; returns the blob URL */
  extractPage(index: number): Promise<string>;
  /** Revoke a single page's blob URL so it can be re-extracted later */
  releasePage(index: number): void;
  /** Release all resources */
  dispose(): void;
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

// ─── ZIP ─────────────────────────────────────────────────────────────────────

export async function openZipComic(blob: Blob): Promise<ComicSource> {
  const reader = new ZipReader(new BlobReader(blob));
  const allEntries = await reader.getEntries();

  const imageEntries: FileEntry[] = (allEntries as FileEntry[])
    .filter((e) => !e.directory && imagePattern.test(e.filename) && typeof e.getData === "function")
    .sort((a, b) => naturalCompare(a.filename, b.filename));

  const pages: ComicPage[] = imageEntries.map((e) => ({ name: e.filename, url: "" }));
  const extracting = new Map<number, Promise<string>>();

  const extractPage = (index: number): Promise<string> => {
    const existing = extracting.get(index);
    if (existing) return existing;
    const entry = imageEntries[index];
    if (!entry) return Promise.resolve("");

    const promise = entry
      .getData(new BlobWriter(mimeFromName(entry.filename)))
      .then((pageBlob: Blob) => {
        const url = URL.createObjectURL(pageBlob);
        pages[index].url = url;
        return url;
      });
    extracting.set(index, promise);
    return promise;
  };

  const releasePage = (index: number) => {
    const page = pages[index];
    if (page?.url) {
      URL.revokeObjectURL(page.url);
      page.url = "";
    }
    extracting.delete(index);
  };

  const dispose = () => {
    void reader.close();
    for (const page of pages) {
      if (page.url) URL.revokeObjectURL(page.url);
    }
    pages.forEach((p) => { p.url = ""; });
    extracting.clear();
  };

  return { pages, extractPage, releasePage, dispose };
}

// ─── RAR ─────────────────────────────────────────────────────────────────────

let _wasmPromise: Promise<ArrayBuffer> | null = null;

async function getUnrarWasm(): Promise<ArrayBuffer> {
  if (!_wasmPromise) {
    _wasmPromise = fetch(unrarWasmUrl).then((res) => res.arrayBuffer());
  }
  return (await _wasmPromise).slice(0);
}

export async function openRarComic(buffer: ArrayBuffer): Promise<ComicSource> {
  const wasmBinary = await getUnrarWasm();
  const extractor = await createExtractorFromData({ data: buffer, wasmBinary });

  const fileHeaders = [...extractor.getFileList().fileHeaders]
    .filter((h) => !h.flags.directory && imagePattern.test(h.name))
    .sort((a, b) => naturalCompare(a.name, b.name));

  const pages: ComicPage[] = fileHeaders.map((h) => ({ name: h.name, url: "" }));
  const extracting = new Map<number, Promise<string>>();

  const extractPage = (index: number): Promise<string> => {
    const existing = extracting.get(index);
    if (existing) return existing;
    const header = fileHeaders[index];
    if (!header) return Promise.resolve("");

    const promise = new Promise<string>((resolve) => {
      // RAR extractor is synchronous; run it here (already off critical path)
      const result = extractor.extract({ files: [header.name] });
      for (const file of result.files) {
        if (file.extraction && imagePattern.test(file.fileHeader.name)) {
          const bytes = new Uint8Array(file.extraction);
          const blob = new Blob(
            [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)],
            { type: mimeFromName(file.fileHeader.name) }
          );
          const url = URL.createObjectURL(blob);
          pages[index].url = url;
          resolve(url);
          return;
        }
      }
      resolve("");
    });
    extracting.set(index, promise);
    return promise;
  };

  const releasePage = (index: number) => {
    const page = pages[index];
    if (page?.url) {
      URL.revokeObjectURL(page.url);
      page.url = "";
    }
    extracting.delete(index);
  };

  const dispose = () => {
    for (const page of pages) {
      if (page.url) URL.revokeObjectURL(page.url);
    }
    pages.forEach((p) => { p.url = ""; });
    extracting.clear();
  };

  return { pages, extractPage, releasePage, dispose };
}
