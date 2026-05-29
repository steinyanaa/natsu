// Pure path / href / MIME helpers for the EPUB reader. No DOM access — these
// resolve hrefs relative to a chapter, derive stable DOM ids, classify links,
// and map file extensions to MIME types.

export const resourceExtensionPattern = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp|otf|ttf|woff2?)$/i;

export function normalizePath(value: string): string {
  return value.replace(/^\/+/, "");
}

export function dirname(value: string): string {
  const index = value.lastIndexOf("/");
  return index >= 0 ? value.slice(0, index + 1) : "";
}

export function resolvePath(basePath: string, href: string): string {
  const [cleanHref] = href.split("#");
  if (!cleanHref) {
    return normalizePath(basePath);
  }

  const url = new URL(cleanHref, `https://reader.local/${dirname(basePath)}`);
  return decodeURIComponent(normalizePath(url.pathname));
}

export function decodeFragment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function splitHref(href: string): { path: string; fragment?: string } {
  const [path, fragment] = href.split("#");
  return {
    path,
    fragment: fragment ? decodeFragment(fragment) : undefined
  };
}

export function chapterDomId(chapterPath: string): string {
  return `epub-chapter-${encodeURIComponent(normalizePath(chapterPath)).replace(/%/g, "_")}`;
}

export function anchorDomId(chapterPath: string, anchorId: string): string {
  return `${chapterDomId(chapterPath)}__${encodeURIComponent(anchorId).replace(/%/g, "_")}`;
}

export function isExternalResource(href: string): boolean {
  return /^(?:[a-z]+:|#)/i.test(href.trim());
}

export function isExternalLink(href: string): boolean {
  return /^(?:[a-z]+:|\/\/)/i.test(href.trim());
}

export function mimeFromPath(path: string, fallback = "application/octet-stream"): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".otf")) return "font/otf";
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".woff2")) return "font/woff2";
  return fallback;
}
