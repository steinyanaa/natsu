import { ipcMain, net } from "electron";
import fs from "node:fs/promises";
import { IPC_CHANNELS } from "../channels.js";
import { ensureCoverDir, coverPathFor } from "../../paths.js";
import { getStore } from "../../services/store.js";
import { withTimeout } from "../../services/scraper/fetch.js";

export function registerCoversHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.coverHas, async (_event, bookId: string) => {
    if (typeof bookId !== "string" || !bookId) return false;
    try {
      await fs.access(coverPathFor(bookId));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.coverSave, async (_event, bookId: string, bytes: Uint8Array | ArrayBuffer) => {
    if (typeof bookId !== "string" || !bookId) return false;
    await ensureCoverDir();
    const buf =
      bytes instanceof ArrayBuffer ? Buffer.from(new Uint8Array(bytes)) : Buffer.from(bytes);
    await fs.writeFile(coverPathFor(bookId), buf);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.coverFetchForBook, async (_event, bookId: string) => {
    if (typeof bookId !== "string" || !bookId) return false;
    const books = getStore().get("books", []);
    const book = books.find((b) => b.id === bookId);
    if (!book) return false;

    // Already has a cover on disk — skip
    try { await fs.access(coverPathFor(bookId)); return true; } catch { /* proceed */ }

    let imageUrl: string | undefined;

    // Strategy: Google Books by title+author
    try {
      const q = encodeURIComponent(`intitle:${book.title}${book.author ? `+inauthor:${book.author}` : ""}`);
      const resp = await withTimeout(net.fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`), 8000, null);
      if (resp?.ok) {
        const data = await resp.json() as { items?: Array<{ volumeInfo?: { imageLinks?: { thumbnail?: string } } }> };
        const thumb = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
        if (thumb) {
          imageUrl = thumb.replace("http://", "https://").replace("&zoom=1", "&zoom=3");
        }
      }
    } catch { /* ignore */ }

    if (!imageUrl) return false;

    try {
      const imgResp = await withTimeout(net.fetch(imageUrl), 8000, null);
      if (!imgResp?.ok) return false;
      const buf = Buffer.from(await imgResp.arrayBuffer());
      if (buf.length < 2000) return false;
      await ensureCoverDir();
      await fs.writeFile(coverPathFor(bookId), buf);
      return true;
    } catch {
      return false;
    }
  });
}
