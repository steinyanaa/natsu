import { BlobReader, BlobWriter, TextWriter, ZipReader, type Entry } from "@zip.js/zip.js";
import type { ParsedTextDocument, TextChapter, TocItem } from "../types";
import {
  anchorDomId,
  chapterDomId,
  isExternalLink,
  isExternalResource,
  mimeFromPath,
  normalizePath,
  resolvePath,
  resourceExtensionPattern,
  splitHref
} from "./epubPaths";

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

interface SpineItem {
  idref: string;
  linear: boolean;
  properties: string;
}

interface ChapterSanitizeResult {
  title: string;
  html: string;
  text: string;
  frameHtml?: string;
  layout: "reflow" | "fixed" | "vertical";
  viewport?: {
    width: number;
    height: number;
  };
  embeddedFonts: string[];
}

function extractFontFamilyNames(css: string): string[] {
  const names: string[] = [];
  const blocks = css.match(/@font-face\s*\{[^}]*\}/gi) ?? [];
  for (const block of blocks) {
    const match = block.match(/font-family\s*:\s*(['"]?)([^;'"}\s]+(?:\s+[^;'"}\s]+)*)\1/i);
    if (match?.[2]) {
      const name = match[2].trim();
      if (name && !names.includes(name)) {
        names.push(name);
      }
    }
  }
  return names;
}

function textOf(element: Element | null | undefined): string {
  return element?.textContent?.trim() ?? "";
}

function byLocalName(root: Document | Element, localName: string): Element[] {
  return [...root.getElementsByTagName("*")].filter((element) => element.localName === localName);
}

async function entryText(entries: Map<string, Entry>, filename: string): Promise<string> {
  const entry = entries.get(normalizePath(filename));

  if (!entry || entry.directory || !("getData" in entry)) {
    throw new Error(`Missing EPUB entry: ${filename}`);
  }

  return (entry as { getData: (writer: TextWriter) => Promise<string> }).getData(new TextWriter());
}

async function entryBlob(
  entries: Map<string, Entry>,
  filename: string,
  mimeType: string
): Promise<Blob | undefined> {
  const entry = entries.get(normalizePath(filename));

  if (!entry || entry.directory || !("getData" in entry)) {
    return undefined;
  }

  return (entry as { getData: (writer: BlobWriter) => Promise<Blob> }).getData(new BlobWriter(mimeType));
}

function rewriteSrcset(srcset: string, basePath: string, resources: Map<string, string>): string {
  return srcset
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      const [href, ...descriptor] = trimmed.split(/\s+/);

      if (!href || isExternalResource(href)) {
        return trimmed;
      }

      const mapped = resources.get(resolvePath(basePath, href));
      return mapped ? [mapped, ...descriptor].join(" ") : trimmed;
    })
    .join(", ");
}

export function stripCssImports(css: string): string {
  return css.replace(/@import\s+(?:url\([^)]*\)|["'][^"']+["']|[^;]+)(?:\s+[^;]+)?;/gi, "");
}

export function sanitizeReaderHtmlSource(html: string): string {
  return html
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attributes: string, css: string) =>
      `<style${attributes}>${stripCssImports(css)}</style>`
    )
    .replace(/<meta\b(?=[^>]*http-equiv\s*=\s*["']?refresh\b)[^>]*>/gi, "")
    .replace(/<\/?form\b[^>]*>/gi, "")
    .replace(/<(script|iframe|object|embed|button|textarea|select)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|iframe|object|embed|button|textarea|select|input)\b[^>]*\/?>/gi, "");
}

export function rewriteReaderCssUrls(style: string, basePath: string, resources: Map<string, string>): string {
  return stripCssImports(style).replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote: string, href: string) => {
    if (!href || isExternalResource(href)) {
      return 'url("")';
    }

    const mapped = resources.get(resolvePath(basePath, href));
    return mapped ? `url("${mapped}")` : 'url("")';
  });
}

export function resolveReaderMediaUrl(
  href: string | null | undefined,
  basePath: string,
  resources: Map<string, string>
): string | undefined {
  if (!href || isExternalResource(href)) {
    return undefined;
  }

  return resources.get(resolvePath(basePath, href));
}

function rewriteResourceAttribute(element: Element, attributeName: string, basePath: string, resources: Map<string, string>) {
  const mapped = resolveReaderMediaUrl(element.getAttribute(attributeName), basePath, resources);

  if (mapped) {
    element.setAttribute(attributeName, mapped);
  } else {
    element.removeAttribute(attributeName);
  }
}

function splitSelectorList(selectors: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let quote = "";

  for (const char of selectors) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth = Math.max(0, depth - 1);

    if (char === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function scopeSingleSelector(selector: string, scopeSelector: string): string {
  const trimmed = selector.trim();

  if (!trimmed) {
    return trimmed;
  }

  let rest = trimmed;
  let scopeSuffix = "";
  let consumedDocumentElement = false;

  while (true) {
    const match = rest.match(/^(?:html|body|:root)((?:[#.][\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?)*)\s*/i);

    if (!match) {
      break;
    }

    consumedDocumentElement = true;
    scopeSuffix += match[1] ?? "";
    rest = rest.slice(match[0].length).trimStart();
  }

  if (consumedDocumentElement) {
    return rest ? `${scopeSelector}${scopeSuffix} ${rest}` : `${scopeSelector}${scopeSuffix}`;
  }

  return `${scopeSelector} ${trimmed}`;
}

function scopeCss(css: string, scopeSelector: string): string {
  const normalizedCss = css.replace(/\.(\/\*[\s\S]*?\*\/)/g, "$1").replace(/\/\*[\s\S]*?\*\//g, "");

  return normalizedCss.replace(/(^|})\s*([^@{}][^{]+)\{/g, (match, prefix: string, selectors: string) => {
    const scoped = splitSelectorList(selectors)
      .map((selector) => scopeSingleSelector(selector, scopeSelector))
      .join(", ");

    return `${prefix} ${scoped} {`;
  });
}

function removeUnsupportedReaderNodes(document: Document) {
  document.querySelectorAll("meta[http-equiv]").forEach((node) => {
    if ((node.getAttribute("http-equiv") ?? "").toLowerCase() === "refresh") {
      node.remove();
    }
  });

  document.querySelectorAll("form").forEach((node) => {
    const fragment = document.createDocumentFragment();
    while (node.firstChild) {
      fragment.appendChild(node.firstChild);
    }
    node.replaceWith(fragment);
  });

  document.querySelectorAll("script, iframe, object, embed, input, button, textarea, select").forEach((node) => node.remove());
}

function cleanDocument(document: Document, chapterPath: string, resources: Map<string, string>) {
  removeUnsupportedReaderNodes(document);
  document.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith("on")) {
        node.removeAttribute(attribute.name);
      }
    });

    const style = node.getAttribute("style");
    if (style) {
      node.setAttribute("style", rewriteReaderCssUrls(style, chapterPath, resources));
    }
  });

  document.querySelectorAll("img[src], video[poster], audio[src], video[src], source[src]").forEach((node) => {
    rewriteResourceAttribute(node, "src", chapterPath, resources);
    rewriteResourceAttribute(node, "poster", chapterPath, resources);
  });

  document.querySelectorAll("image").forEach((node) => {
    rewriteResourceAttribute(node, "href", chapterPath, resources);
    rewriteResourceAttribute(node, "xlink:href", chapterPath, resources);
  });

  document.querySelectorAll("source[srcset], img[srcset]").forEach((node) => {
    const srcset = node.getAttribute("srcset");
    if (srcset) {
      node.setAttribute("srcset", rewriteSrcset(srcset, chapterPath, resources));
    }
  });
}

function rewriteInternalAnchors(document: Document, chapterPath: string) {
  const hasToken = (value: string | null, tokens: Set<string>) =>
    (value ?? "")
      .toLowerCase()
      .split(/\s+/)
      .some((token) => tokens.has(token));
  const noteReferenceTypes = new Set(["noteref"]);
  const noteTargetTypes = new Set(["footnote", "endnote"]);
  const noteReferenceRoles = new Set(["doc-noteref"]);
  const noteTargetRoles = new Set(["doc-footnote", "doc-endnote"]);
  const noteReferenceClasses = new Set([
    "noteref", "footnote-ref", "footnoteref", "note-ref", "notelink",
    "fn", "fnref", "fn-ref", "endnote-ref", "endnoteref",
    "sdfootnote", "duokan-footnote"
  ]);
  const noteTargetClasses = new Set(["footnote", "endnote", "fn", "fntext", "footnote-item", "endnote-item"]);
  const noteMarkerPattern = /^[\s[(（【]*[*†‡§¶※]?\d{0,4}[*†‡§¶※]?[\s\])）】]*$/;
  const looksLikeNoteMarker = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 8) {
      return false;
    }
    return noteMarkerPattern.test(trimmed) && /[\d*†‡§¶※]/.test(trimmed);
  };

  document.querySelectorAll("*").forEach((node) => {
    const isSemanticNoteTarget =
      hasToken(node.getAttribute("epub:type"), noteTargetTypes) ||
      hasToken(node.getAttribute("role"), noteTargetRoles) ||
      hasToken(node.getAttribute("class"), noteTargetClasses);

    if (isSemanticNoteTarget) {
      node.setAttribute("data-epub-note-target", "true");
    }
  });

  document.querySelectorAll("[id]").forEach((node) => {
    const currentId = node.getAttribute("id");
    if (currentId) {
      node.setAttribute("id", anchorDomId(chapterPath, currentId));
    }
  });

  document.querySelectorAll("a[name]").forEach((node) => {
    const currentName = node.getAttribute("name");
    if (currentName) {
      node.setAttribute("id", anchorDomId(chapterPath, currentName));
    }
  });

  document.querySelectorAll("a[href]").forEach((node) => {
    const href = node.getAttribute("href")?.trim();

    if (!href) {
      return;
    }

    if (/^(?:javascript:|data:)/i.test(href)) {
      node.removeAttribute("href");
      return;
    }

    if (isExternalLink(href)) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noreferrer noopener");
      return;
    }

    const { path, fragment } = splitHref(href);
    const targetPath = path ? resolvePath(chapterPath, href) : chapterPath;
    const targetId = fragment ? anchorDomId(targetPath, fragment) : chapterDomId(targetPath);
    node.setAttribute("href", `#${targetId}`);

    const isSemanticNoteReference =
      hasToken(node.getAttribute("epub:type"), noteReferenceTypes) ||
      hasToken(node.getAttribute("role"), noteReferenceRoles) ||
      hasToken(node.getAttribute("class"), noteReferenceClasses);

    const isSupNoteReference = fragment !== null && node.closest("sup") !== null;

    const isHeuristicNoteReference =
      Boolean(fragment) &&
      node.closest("nav") === null &&
      looksLikeNoteMarker(node.textContent ?? "");

    if ((isSemanticNoteReference || isSupNoteReference || isHeuristicNoteReference) && fragment) {
      node.setAttribute("data-epub-note-ref", "true");
      node.setAttribute("data-epub-note-target-id", targetId);
      document.getElementById(targetId)?.setAttribute("data-epub-note-target", "true");
    }
  });

  document.querySelectorAll("[data-epub-note-target='true'][id]").forEach((node) => {
    const noteId = node.getAttribute("id");
    if (noteId) {
      node.setAttribute("data-epub-note-id", noteId);
    }
  });
}

function frameHtmlForChapter(
  html: string,
  chapterPath: string,
  resources: Map<string, string>,
  stylesheets: Map<string, string>
): string {
  const parsed = new DOMParser().parseFromString(sanitizeReaderHtmlSource(html), "text/html");
  cleanDocument(parsed, chapterPath, resources);
  rewriteInternalAnchors(parsed, chapterPath);

  parsed.querySelectorAll("link[rel]").forEach((node) => {
    const rel = node.getAttribute("rel") ?? "";
    const href = node.getAttribute("href");

    if (!/\bstylesheet\b/i.test(rel) || !href || isExternalResource(href)) {
      node.remove();
      return;
    }

    const stylesheetPath = resolvePath(chapterPath, href);
    const stylesheet = stylesheets.get(stylesheetPath);
    const style = parsed.createElement("style");
    style.textContent = stylesheet ? rewriteReaderCssUrls(stylesheet, stylesheetPath, resources) : "";
    node.replaceWith(style);
  });

  parsed.querySelectorAll("style").forEach((node) => {
    node.textContent = rewriteReaderCssUrls(node.textContent ?? "", chapterPath, resources);
  });

  const head = parsed.head || parsed.documentElement.insertBefore(parsed.createElement("head"), parsed.body);
  const baseStyle = parsed.createElement("style");
  baseStyle.textContent = `
    html, body { width: 100%; height: 100%; }
    body { overflow: hidden; box-sizing: border-box; }
    img, svg, video { max-width: 100%; }
  `;
  head.prepend(baseStyle);

  return `<!doctype html>${parsed.documentElement.outerHTML}`;
}

function epubBodyAttributes(parsed: Document, chapterPath: string, resources: Map<string, string>): string {
  const html = parsed.documentElement;
  const body = parsed.body;
  const classes = [html.getAttribute("class"), body.getAttribute("class")]
    .filter(Boolean)
    .join(" ")
    .trim();
  const id = body.getAttribute("id") || html.getAttribute("id");
  const lang = body.getAttribute("lang") || html.getAttribute("lang") || body.getAttribute("xml:lang") || html.getAttribute("xml:lang");
  const dir = body.getAttribute("dir") || html.getAttribute("dir");
  const style = [html.getAttribute("style"), body.getAttribute("style")]
    .filter(Boolean)
    .map((value) => rewriteReaderCssUrls(value as string, chapterPath, resources))
    .join("; ");
  const attributes = ["class=\"epub-chapter-body"];

  if (classes) {
    attributes[0] += ` ${escapeHtmlAttribute(classes)}`;
  }

  attributes[0] += "\"";

  if (id) {
    attributes.push(`data-epub-body-id="${escapeHtmlAttribute(id)}"`);
  }

  if (lang) {
    attributes.push(`lang="${escapeHtmlAttribute(lang)}"`);
  }

  if (dir) {
    attributes.push(`dir="${escapeHtmlAttribute(dir)}"`);
  }

  if (style) {
    attributes.push(`style="${escapeHtmlAttribute(style)}"`);
  }

  return attributes.join(" ");
}

function parseViewport(content: string | null | undefined): { width: number; height: number } | undefined {
  if (!content) {
    return undefined;
  }

  const width = Number(content.match(/(?:^|,|\s)width\s*=\s*([0-9.]+)/i)?.[1]);
  const height = Number(content.match(/(?:^|,|\s)height\s*=\s*([0-9.]+)/i)?.[1]);

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }

  return undefined;
}

function detectChapterLayout(
  parsed: Document,
  viewport: { width: number; height: number } | undefined,
  spineProperties: string
): "reflow" | "fixed" | "vertical" {
  const htmlClass = parsed.documentElement.getAttribute("class") ?? "";
  const bodyClass = parsed.body.getAttribute("class") ?? "";
  const classText = `${htmlClass} ${bodyClass}`;
  const bodyHtml = parsed.body.innerHTML;

  if (
    viewport ||
    /(?:^|\s)(?:cov|cov2|cov3|duokan-image-single|duokan-page-fullscreen|duokan-page-fitwindow)(?:\s|$)/i.test(classText) ||
    /(?:duokan-page-fullscreen|duokan-page-fitwindow|rendition:layout-pre-paginated)/i.test(spineProperties) ||
    /<svg[\s\S]+viewBox=/i.test(bodyHtml)
  ) {
    return "fixed";
  }

  if (
    /(?:^|\s)vrtl(?:\s|$)/i.test(classText) ||
    /(?:-epub-)?writing-mode\s*:\s*(?:vertical-rl|tb-rl)/i.test(`${parsed.documentElement.getAttribute("style") ?? ""};${parsed.body.getAttribute("style") ?? ""};${bodyHtml}`)
  ) {
    return "vertical";
  }

  return "reflow";
}

function sanitizeChapter(
  html: string,
  chapterPath: string,
  resources: Map<string, string>,
  stylesheets: Map<string, string>,
  spineProperties: string
): ChapterSanitizeResult {
  const safeHtml = sanitizeReaderHtmlSource(html);
  const parsed = new DOMParser().parseFromString(safeHtml, "text/html");
  const scopeSelector = `#${chapterDomId(chapterPath)} .epub-chapter-body`;
  const scopedStyles: string[] = [];
  const embeddedFonts: string[] = [];
  const viewport = parseViewport(parsed.querySelector("meta[name='viewport' i]")?.getAttribute("content"));
  const layout = detectChapterLayout(parsed, viewport, spineProperties);

  cleanDocument(parsed, chapterPath, resources);
  parsed.querySelectorAll("link[rel]").forEach((node) => {
    const rel = node.getAttribute("rel") ?? "";
    const href = node.getAttribute("href");

    if (!/\bstylesheet\b/i.test(rel) || !href || isExternalResource(href)) {
      node.remove();
      return;
    }

    const stylesheetPath = resolvePath(chapterPath, href);
    const stylesheet = stylesheets.get(stylesheetPath);

    if (stylesheet) {
      const rewritten = rewriteReaderCssUrls(stripCssImports(stylesheet), stylesheetPath, resources);
      scopedStyles.push(scopeCss(rewritten, scopeSelector));
      for (const name of extractFontFamilyNames(stylesheet)) {
        if (!embeddedFonts.includes(name)) embeddedFonts.push(name);
      }
    }

    node.remove();
  });
  parsed.querySelectorAll("style").forEach((node) => {
    const css = node.textContent ?? "";

    if (css.trim()) {
      scopedStyles.push(scopeCss(rewriteReaderCssUrls(css, chapterPath, resources), scopeSelector));
      for (const name of extractFontFamilyNames(css)) {
        if (!embeddedFonts.includes(name)) embeddedFonts.push(name);
      }
    }

    node.remove();
  });

  rewriteInternalAnchors(parsed, chapterPath);

  const title =
    textOf(parsed.querySelector("h1, h2, h3, title")) ||
    textOf(parsed.querySelector("[epub\\:type='titlepage']"));

  return {
    title,
    html: `${scopedStyles.map((style) => `<style>${style}</style>`).join("")}<div ${epubBodyAttributes(parsed, chapterPath, resources)}>${parsed.body.innerHTML || "<p></p>"}</div>`,
    text: parsed.body.textContent ?? "",
    frameHtml: layout === "fixed" ? frameHtmlForChapter(safeHtml, chapterPath, resources, stylesheets) : undefined,
    layout,
    viewport: viewport ?? (layout === "fixed" ? { width: 768, height: 1024 } : undefined),
    embeddedFonts
  };
}

function parseContainer(xml: string): string {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const rootfile = byLocalName(document, "rootfile")[0];
  const fullPath = rootfile?.getAttribute("full-path");

  if (!fullPath) {
    throw new Error("EPUB container does not include a rootfile.");
  }

  return normalizePath(fullPath);
}

function parseOpf(opf: string) {
  const document = new DOMParser().parseFromString(opf, "application/xml");
  const title = textOf(byLocalName(document, "title")[0]);
  const author = textOf(byLocalName(document, "creator")[0]);
  const coverId = byLocalName(document, "meta").find(
    (meta) => meta.getAttribute("name")?.toLowerCase() === "cover"
  )?.getAttribute("content") ?? "";
  const manifest = new Map<string, ManifestItem>();

  byLocalName(document, "item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");

    if (!id || !href) {
      return;
    }

    manifest.set(id, {
      id,
      href,
      mediaType: item.getAttribute("media-type") ?? "",
      properties: item.getAttribute("properties") ?? ""
    });
  });

  const spineElement = byLocalName(document, "spine")[0];
  const tocId = spineElement?.getAttribute("toc") ?? "";
  const spine: SpineItem[] = byLocalName(document, "itemref")
    .map((item) => ({
      idref: item.getAttribute("idref") ?? "",
      linear: item.getAttribute("linear") !== "no",
      properties: item.getAttribute("properties") ?? ""
    }))
    .filter((item) => item.idref);

  return {
    title,
    author,
    manifest,
    spine,
    tocId,
    coverId
  };
}

function parseNavDocument(html: string): TocItem[] {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const nav = [...parsed.querySelectorAll("nav")].find((node) => {
    const type = node.getAttribute("epub:type") ?? node.getAttribute("type") ?? "";
    return type.includes("toc");
  }) ?? parsed.querySelector("nav");

  if (!nav) {
    return [];
  }

  return [...nav.querySelectorAll("a")]
    .map((anchor, index) => ({
      id: anchor.getAttribute("href") ?? `toc-${index + 1}`,
      href: anchor.getAttribute("href") ?? undefined,
      label: anchor.textContent?.trim() || `Chapter ${index + 1}`
    }))
    .filter((item) => item.label);
}

function parseNcx(xml: string): TocItem[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");

  return byLocalName(document, "navPoint").map((point, index) => ({
    id: point.getAttribute("id") ?? `toc-${index + 1}`,
    href: byLocalName(point, "content")[0]?.getAttribute("src") ?? undefined,
    label: textOf(byLocalName(point, "text")[0]) || `Chapter ${index + 1}`
  }));
}

function resolveTocItems(basePath: string, toc: TocItem[], chapterIds: Set<string>): TocItem[] {
  return toc
    .map((item, index) => {
      if (!item.href) {
        return {
          ...item,
          id: item.id || `toc-${index + 1}`
        };
      }

      const { path, fragment } = splitHref(item.href);
      const targetPath = path || fragment ? resolvePath(basePath, item.href) : "";
      const targetId = targetPath
        ? fragment
          ? anchorDomId(targetPath, fragment)
          : chapterDomId(targetPath)
        : item.id;

      return {
        ...item,
        id: targetId || item.id || `toc-${index + 1}`
      };
    })
    .filter((item) => {
      if (!item.label) {
        return false;
      }

      const targetChapterId = item.id.includes("__") ? item.id.slice(0, item.id.indexOf("__")) : item.id;
      return chapterIds.has(targetChapterId);
    });
}

export async function parseEpubDocument(blob: Blob, fallbackTitle: string): Promise<ParsedTextDocument> {
  const reader = new ZipReader(new BlobReader(blob));
  const entries = new Map((await reader.getEntries()).map((entry) => [normalizePath(entry.filename), entry]));
  const objectUrls: string[] = [];

  try {
    const container = await entryText(entries, "META-INF/container.xml");
    const opfPath = parseContainer(container);
    const opf = await entryText(entries, opfPath);
    const metadata = parseOpf(opf);
    const resources = await createResourceMap(entries, opfPath, metadata.manifest, objectUrls);
    const stylesheets = await createStylesheetMap(entries, opfPath, metadata.manifest);
    const coverUrl = findCoverUrl(opfPath, metadata.manifest, metadata.coverId, resources);
    const tocItem =
      [...metadata.manifest.values()].find((item) => item.properties.includes("nav")) ??
      metadata.manifest.get(metadata.tocId) ??
      [...metadata.manifest.values()].find((item) => item.mediaType.includes("ncx"));

    let toc: TocItem[] = [];

    let tocBasePath = opfPath;

    if (tocItem) {
      const tocPath = resolvePath(opfPath, tocItem.href);
      const tocText = await entryText(entries, tocPath);
      tocBasePath = tocPath;
      toc = tocItem.mediaType.includes("ncx") ? parseNcx(tocText) : parseNavDocument(tocText);
    }

    const tocByPath = new Map(
      toc
        .filter((item) => item.href)
        .map((item) => [resolvePath(tocBasePath, item.href as string), item.label])
    );

    const chapters: TextChapter[] = [];

    const linearSpine = metadata.spine.filter((item) => item.linear);
    const spine = linearSpine.length ? linearSpine : metadata.spine;

    for (const spineItem of spine) {
      const manifestItem = metadata.manifest.get(spineItem.idref);
      if (!manifestItem || !/x?html|xml/.test(manifestItem.mediaType)) {
        continue;
      }

      const chapterPath = resolvePath(opfPath, manifestItem.href);
      const chapterText = await entryText(entries, chapterPath);
      const sanitized = sanitizeChapter(chapterText, chapterPath, resources, stylesheets, spineItem.properties);

      chapters.push({
        id: chapterDomId(chapterPath),
        title: tocByPath.get(chapterPath) || sanitized.title || `Chapter ${chapters.length + 1}`,
        html: sanitized.html,
        plainText: sanitized.text,
        frameHtml: sanitized.frameHtml,
        layout: sanitized.layout,
        viewport: sanitized.viewport,
        embeddedFonts: sanitized.embeddedFonts.length ? sanitized.embeddedFonts : undefined
      });
    }

    const chapterToc = chapters.map((chapter) => ({ id: chapter.id, label: chapter.title }));
    const resolvedToc = resolveTocItems(tocBasePath, toc, new Set(chapters.map((chapter) => chapter.id)));

    return {
      kind: "text",
      title: metadata.title || fallbackTitle,
      author: metadata.author,
      coverUrl,
      objectUrls,
      chapters: chapters.length
        ? chapters
        : [
            {
              id: "epub-empty",
              title: metadata.title || fallbackTitle,
              html: "<p></p>",
              plainText: ""
            }
          ],
      toc: resolvedToc.length ? resolvedToc : chapterToc
    };
  } catch (error) {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  } finally {
    await reader.close();
  }
}

async function createResourceMap(
  entries: Map<string, Entry>,
  opfPath: string,
  manifest: Map<string, ManifestItem>,
  objectUrls: string[]
): Promise<Map<string, string>> {
  const resources = new Map<string, string>();
  const candidates = new Map<string, string>();

  manifest.forEach((item) => {
    if (item.mediaType.startsWith("image/") || item.mediaType.startsWith("font/") || resourceExtensionPattern.test(item.href)) {
      const resourcePath = resolvePath(opfPath, item.href);
      candidates.set(resourcePath, mimeFromPath(resourcePath, item.mediaType));
    }
  });

  entries.forEach((entry, filename) => {
    if (!entry.directory && resourceExtensionPattern.test(filename)) {
      candidates.set(filename, mimeFromPath(filename));
    }
  });

  for (const [resourcePath, mimeType] of candidates) {
    const blob = await entryBlob(entries, resourcePath, mimeType);

    if (!blob) {
      continue;
    }

    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    resources.set(resourcePath, url);
  }

  return resources;
}

async function createStylesheetMap(
  entries: Map<string, Entry>,
  opfPath: string,
  manifest: Map<string, ManifestItem>
): Promise<Map<string, string>> {
  const stylesheets = new Map<string, string>();
  const candidates = new Set<string>();

  manifest.forEach((item) => {
    if (item.mediaType.includes("css") || /\.css$/i.test(item.href)) {
      candidates.add(resolvePath(opfPath, item.href));
    }
  });

  entries.forEach((entry, filename) => {
    if (!entry.directory && /\.css$/i.test(filename)) {
      candidates.add(filename);
    }
  });

  for (const stylesheetPath of candidates) {
    try {
      stylesheets.set(stylesheetPath, await entryText(entries, stylesheetPath));
    } catch {
      // Broken stylesheet references are common in hand-made EPUBs; keep reading.
    }
  }

  return stylesheets;
}

function findCoverUrl(
  opfPath: string,
  manifest: Map<string, ManifestItem>,
  coverId: string,
  resources: Map<string, string>
): string | undefined {
  const coverItem =
    manifest.get(coverId) ??
    [...manifest.values()].find((item) => item.properties.includes("cover-image")) ??
    [...manifest.values()].find((item) => /cover|front/i.test(item.id) && item.mediaType.startsWith("image/")) ??
    [...manifest.values()].find((item) => /cover|front/i.test(item.href) && item.mediaType.startsWith("image/"));

  if (coverItem) {
    return resources.get(resolvePath(opfPath, coverItem.href));
  }

  return [...resources.values()][0];
}

export async function extractEpubCover(blob: Blob): Promise<string | undefined> {
  const reader = new ZipReader(new BlobReader(blob));
  const entries = new Map((await reader.getEntries()).map((entry) => [normalizePath(entry.filename), entry]));

  try {
    const container = await entryText(entries, "META-INF/container.xml");
    const opfPath = parseContainer(container);
    const opf = await entryText(entries, opfPath);
    const metadata = parseOpf(opf);
    const coverItem =
      metadata.manifest.get(metadata.coverId) ??
      [...metadata.manifest.values()].find((item) => item.properties.includes("cover-image")) ??
      [...metadata.manifest.values()].find((item) => /cover|front/i.test(item.id) && item.mediaType.startsWith("image/")) ??
      [...metadata.manifest.values()].find((item) => /cover|front/i.test(item.href) && item.mediaType.startsWith("image/"));

    if (!coverItem) {
      return undefined;
    }

    const coverPath = resolvePath(opfPath, coverItem.href);
    const coverBlob = await entryBlob(entries, coverPath, mimeFromPath(coverPath, coverItem.mediaType));

    return coverBlob ? URL.createObjectURL(coverBlob) : undefined;
  } finally {
    await reader.close();
  }
}
