import { initKf8File, initMobiFile } from "@lingo-reader/mobi-parser";
import type { ParsedTextDocument, TocItem } from "../types";

const ALLOWED_TAGS = new Set([
  "p", "div", "span", "br", "hr", "a", "img", "em", "strong", "b", "i", "u", "s",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td", "caption", "col", "colgroup",
  "figure", "figcaption", "ruby", "rt", "rp", "sup", "sub",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a:   new Set(["href", "title"]),
  img: new Set(["src", "alt", "width", "height"]),
  "*": new Set(["class", "id", "style", "lang", "dir"]),
};

function sanitizeNode(node: Element): void {
  for (const child of [...node.childNodes]) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      node.removeChild(el);
      continue;
    }
    for (const attr of [...el.attributes]) {
      const tagAllowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
      const globalAllowed = ALLOWED_ATTRS["*"] ?? new Set<string>();
      if (!tagAllowed.has(attr.name) && !globalAllowed.has(attr.name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((attr.name === "href" || attr.name === "src") &&
          /^\s*(javascript|data):/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
    sanitizeNode(el);
  }
}

function cleanHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

function flattenToc(items: Array<{ label: string; href: string; children?: unknown[] }>): TocItem[] {
  return items.map((item, index) => ({
    id: item.href || `mobi-${index + 1}`,
    label: item.label || `Chapter ${index + 1}`,
    href: item.href,
    children: Array.isArray(item.children)
      ? flattenToc(item.children as Array<{ label: string; href: string; children?: unknown[] }>)
      : undefined
  }));
}

export async function parseMobiDocument(
  bytes: ArrayBuffer,
  fallbackTitle: string
): Promise<ParsedTextDocument> {
  const data = new Uint8Array(bytes);
  let parser: Awaited<ReturnType<typeof initKf8File>> | Awaited<ReturnType<typeof initMobiFile>>;

  try {
    parser = await initKf8File(data);
  } catch {
    parser = await initMobiFile(data);
  }

  const metadata = parser.getMetadata();
  const title = metadata.title || fallbackTitle;
  const spine = parser.getSpine();
  const chapters = spine.map((item, index) => {
    const chapter = parser.loadChapter(item.id);
    const html = chapter?.html ? cleanHtml(chapter.html) : "<p></p>";

    return {
      id: item.id || `mobi-${index + 1}`,
      title: `Chapter ${index + 1}`,
      html,
      plainText: html.replace(/<[^>]+>/g, " ")
    };
  });

  const toc = flattenToc(parser.getToc() as Array<{ label: string; href: string; children?: unknown[] }>);

  parser.destroy();

  return {
    kind: "text",
    title,
    author: Array.isArray(metadata.author) ? metadata.author.join(", ") : undefined,
    chapters: chapters.length
      ? chapters
      : [
          {
            id: "mobi-empty",
            title,
            html: "<p></p>",
            plainText: ""
          }
        ],
    toc: toc.length ? toc : chapters.map((chapter) => ({ id: chapter.id, label: chapter.title }))
  };
}
