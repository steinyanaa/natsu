import { net } from "electron";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { contentTypeFor, coverPathFor } from "./covers.js";
import { getStore } from "./store.js";

export async function handleBookProtocol(request: GlobalRequest): Promise<Response> {
  const url = new URL(request.url);

  if (url.hostname === "cover") {
    const id = decodeURIComponent(url.pathname.slice(1));
    const filePath = coverPathFor(id);
    try {
      await fs.access(filePath);
      const response = await net.fetch(pathToFileURL(filePath).toString());
      const headers = new Headers(response.headers);
      headers.set("content-type", "image/jpeg");
      headers.set("cache-control", "private, max-age=31536000, immutable");
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return new Response("Cover not found", { status: 404 });
    }
  }

  if (url.hostname !== "book") {
    return new Response("Unknown resource", { status: 404 });
  }

  const id = decodeURIComponent(url.pathname.slice(1));
  const book = getStore().get("books", []).find((item) => item.id === id);

  if (!book) {
    return new Response("Book not found", { status: 404 });
  }

  try {
    await fs.access(book.filePath);
    const response = await net.fetch(pathToFileURL(book.filePath).toString());
    const headers = new Headers(response.headers);
    headers.set("content-type", contentTypeFor(book.format));
    headers.set("cache-control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return new Response("Book file missing", { status: 404 });
  }
}
