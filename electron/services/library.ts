import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureLibraryDir } from "../paths.js";
import type { BookFormat, BookRecord, ClientBookRecord, ReaderProgress } from "../ipc/types.js";
import { formatFromPath, titleFromFile } from "./bookFormats.js";
import { bookToClient, getStore, seedFromHash } from "./store.js";

// P0-4: debounce progress writes to avoid full-library JSON rewrite on every page turn
export const pendingProgressUpdates = new Map<string, ReaderProgress>();
let progressFlushTimer: ReturnType<typeof setTimeout> | null = null;

export function flushProgressUpdates(): void {
  if (progressFlushTimer !== null) {
    clearTimeout(progressFlushTimer);
    progressFlushTimer = null;
  }
  if (pendingProgressUpdates.size === 0) return;
  const books = getStore().get("books", []);
  const updates = new Map(pendingProgressUpdates);
  pendingProgressUpdates.clear();
  const updated = books.map((book) =>
    updates.has(book.id) ? { ...book, progress: updates.get(book.id)! } : book
  );
  getStore().set("books", updated);
}

export function queueProgressUpdate(id: string, progress: ReaderProgress): void {
  pendingProgressUpdates.set(id, progress);
  if (progressFlushTimer !== null) clearTimeout(progressFlushTimer);
  progressFlushTimer = setTimeout(flushProgressUpdates, 5000);
}

export function sizeLabelFromText(text?: string): string | undefined {
  if (!text) {
    return undefined;
  }

  const match = text.replace(/\s+/g, " ").match(/(\d+(?:[.,]\d+)?)\s*(B|KB|KIB|MB|MIB|GB|GIB)\b/i);
  if (!match) {
    return undefined;
  }

  const value = match[1].replace(",", ".");
  const unit = match[2].toUpperCase().replace("IB", "B");
  return `${value} ${unit}`;
}

export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export async function importOneBook(filePath: string): Promise<ClientBookRecord | undefined> {
  const format = formatFromPath(filePath);

  if (!format) {
    return undefined;
  }

  const stats = await fs.stat(filePath);
  const hash = await hashFile(filePath);
  const books = getStore().get("books", []);
  const duplicate = books.find((book) => book.hash === hash);

  if (duplicate) {
    return bookToClient(duplicate);
  }

  const libraryDir = await ensureLibraryDir();
  const id = hash.slice(0, 20);
  const storedFileName = `${id}.${format}`;
  const storedPath = path.join(libraryDir, storedFileName);

  await fs.copyFile(filePath, storedPath);

  const now = new Date().toISOString();
  const book: BookRecord = {
    id,
    hash,
    title: titleFromFile(filePath),
    format,
    fileName: path.basename(filePath),
    filePath: storedPath,
    size: stats.size,
    importedAt: now,
    bookmarks: [],
    highlights: [],
    coverSeed: seedFromHash(hash)
  };

  getStore().set("books", [book, ...books]);

  return bookToClient(book);
}

export function isLikelyHtml(buffer: Buffer, contentType?: string | null): boolean {
  if (contentType?.toLowerCase().includes("text/html")) {
    return true;
  }

  const prefix = buffer.subarray(0, Math.min(buffer.byteLength, 512)).toString("utf8").trimStart().toLowerCase();
  return prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.includes("<title>");
}

export function bufferLooksLikeFormat(buffer: Buffer, format: BookFormat, contentType?: string | null): boolean {
  if (!buffer.byteLength || isLikelyHtml(buffer, contentType)) {
    return false;
  }

  if (format === "epub" || format === "zip" || format === "cbz") {
    return buffer.subarray(0, 2).toString("ascii") === "PK";
  }

  if (format === "pdf") {
    return buffer.subarray(0, 4).toString("ascii") === "%PDF";
  }

  if (format === "rar" || format === "cbr") {
    return buffer.subarray(0, 4).toString("ascii") === "Rar!";
  }

  if (format === "txt") {
    return !buffer.subarray(0, Math.min(buffer.byteLength, 256)).includes(0);
  }

  return true;
}

export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
