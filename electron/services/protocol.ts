import { net } from "electron";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { contentTypeFor, coverPathFor } from "./covers.js";
import { getStore } from "./store.js";

/**
 * Parse an HTTP `Range` request header against a known resource size.
 *
 * Returns:
 *  - `{ start, end }` inclusive byte offsets for a satisfiable range,
 *  - `null` when there is no range / the full content should be served,
 *  - `"unsatisfiable"` when the range is syntactically valid but cannot be met
 *    (e.g. start is beyond the end of the resource).
 *
 * Only a single `bytes=` range is supported (pdf.js never issues multipart
 * range requests). `end` is always clamped to `size - 1`.
 */
export function parseRangeHeader(
  header: string | null,
  size: number
): { start: number; end: number } | null | "unsatisfiable" {
  if (!header) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;

  // Neither bound present: "bytes=-" is garbage.
  if (rawStart === "" && rawEnd === "") {
    return null;
  }

  // Empty / zero-length resource cannot satisfy any concrete range.
  if (size <= 0) {
    return "unsatisfiable";
  }

  // Suffix range: "bytes=-500" → last 500 bytes.
  if (rawStart === "") {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (suffixLength <= 0) {
      return "unsatisfiable";
    }
    const start = Math.max(0, size - suffixLength);
    return { start, end: size - 1 };
  }

  const start = Number.parseInt(rawStart, 10);
  if (start >= size) {
    return "unsatisfiable";
  }

  // Open-ended range: "bytes=100-" → from start to EOF.
  if (rawEnd === "") {
    return { start, end: size - 1 };
  }

  let end = Number.parseInt(rawEnd, 10);
  if (end < start) {
    return "unsatisfiable";
  }
  // Clamp past EOF.
  end = Math.min(end, size - 1);
  return { start, end };
}

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
    const stat = await fs.stat(book.filePath);
    const size = stat.size;
    const contentType = contentTypeFor(book.format);

    const range = parseRangeHeader(request.headers.get("range"), size);

    if (range === "unsatisfiable") {
      return new Response("Requested range not satisfiable", {
        status: 416,
        headers: {
          "content-range": `bytes */${size}`,
          "accept-ranges": "bytes",
          "cache-control": "no-store"
        }
      });
    }

    if (range) {
      const { start, end } = range;
      const stream = createReadStream(book.filePath, { start, end });
      const body = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
      return new Response(body, {
        status: 206,
        headers: {
          "content-type": contentType,
          "content-range": `bytes ${start}-${end}/${size}`,
          "accept-ranges": "bytes",
          "content-length": String(end - start + 1),
          "cache-control": "no-store"
        }
      });
    }

    const stream = createReadStream(book.filePath);
    const body = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "accept-ranges": "bytes",
        "content-length": String(size),
        "cache-control": "no-store"
      }
    });
  } catch {
    return new Response("Book file missing", { status: 404 });
  }
}
