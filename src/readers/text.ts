import type { ParsedTextDocument, TextChapter, TocItem } from "../types";

const chapterPattern =
  /^(?:第\s*[一二三四五六七八九十百千万零〇两\d]+\s*[章节卷回部篇].*|chapter\s+\d+.*|prologue|epilogue|序章|终章|終章).*/i;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function decodeWith(label: string, bytes: Uint8Array): string {
  return new TextDecoder(label, { fatal: false }).decode(bytes);
}

function replacementScore(text: string): number {
  if (!text.length) {
    return 1;
  }

  const replacements = [...text].filter((char) => char === "\uFFFD").length;
  return replacements / text.length;
}

export function decodeText(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes);

  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    return decodeWith("utf-8", data.slice(3));
  }

  if (data[0] === 0xff && data[1] === 0xfe) {
    return decodeWith("utf-16le", data.slice(2));
  }

  if (data[0] === 0xfe && data[1] === 0xff) {
    return decodeWith("utf-16be", data.slice(2));
  }

  const utf8 = decodeWith("utf-8", data);

  if (replacementScore(utf8) < 0.01) {
    return utf8;
  }

  try {
    return decodeWith("gb18030", data);
  } catch {
    return utf8;
  }
}

function paragraphHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return `<p>${escapeHtml(text)}</p>`;
  }

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export function parseTxtDocument(bytes: ArrayBuffer, title: string): ParsedTextDocument {
  const raw = decodeText(bytes)
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim();

  if (!raw) {
    return {
      kind: "text",
      title,
      chapters: [
        {
          id: "chapter-1",
          title,
          html: "<p></p>",
          plainText: ""
        }
      ],
      toc: [{ id: "chapter-1", label: title }]
    };
  }

  const lines = raw.split("\n");
  const chapterStarts: number[] = [];

  lines.forEach((line, index) => {
    if (chapterPattern.test(line.trim()) && line.trim().length <= 80) {
      chapterStarts.push(index);
    }
  });

  if (chapterStarts.length < 2) {
    const chapter: TextChapter = {
      id: "chapter-1",
      title,
      html: paragraphHtml(raw),
      plainText: raw
    };

    return {
      kind: "text",
      title,
      chapters: [chapter],
      toc: [{ id: chapter.id, label: title }]
    };
  }

  const chapters = chapterStarts.map((start, index): TextChapter => {
    const end = chapterStarts[index + 1] ?? lines.length;
    const titleLine = lines[start].trim();
    const body = lines.slice(start + 1, end).join("\n").trim();

    return {
      id: `chapter-${index + 1}`,
      title: titleLine,
      html: paragraphHtml(body),
      plainText: body
    };
  });

  const toc: TocItem[] = chapters.map((chapter) => ({
    id: chapter.id,
    label: chapter.title
  }));

  return {
    kind: "text",
    title,
    chapters,
    toc
  };
}
