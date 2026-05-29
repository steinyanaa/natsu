import { describe, expect, it } from "vitest";
import { decodeText, parseTxtDocument } from "./text";

function utf8(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

describe("decodeText", () => {
  it("decodes plain UTF-8", () => {
    expect(decodeText(utf8("hello 世界"))).toBe("hello 世界");
  });

  it("strips a UTF-8 BOM", () => {
    expect(decodeText(bytes(0xef, 0xbb, 0xbf, 0x68, 0x69))).toBe("hi");
  });

  it("decodes UTF-16LE with BOM", () => {
    // "Hi" in UTF-16LE: 0x48 0x00 0x69 0x00, prefixed with FF FE BOM
    expect(decodeText(bytes(0xff, 0xfe, 0x48, 0x00, 0x69, 0x00))).toBe("Hi");
  });

  it("decodes UTF-16BE with BOM", () => {
    // "Hi" in UTF-16BE: 0x00 0x48 0x00 0x69, prefixed with FE FF BOM
    expect(decodeText(bytes(0xfe, 0xff, 0x00, 0x48, 0x00, 0x69))).toBe("Hi");
  });

  it("falls back to gb18030 for non-UTF-8 Chinese bytes", () => {
    // "你好" encoded in GB18030: C4 E3 BA C3 — invalid as UTF-8
    expect(decodeText(bytes(0xc4, 0xe3, 0xba, 0xc3))).toBe("你好");
  });
});

describe("parseTxtDocument", () => {
  it("returns a single empty chapter for blank input", () => {
    const doc = parseTxtDocument(utf8("   \n\n  "), "Empty");
    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0].html).toBe("<p></p>");
    expect(doc.chapters[0].plainText).toBe("");
    expect(doc.toc).toEqual([{ id: "chapter-1", label: "Empty" }]);
  });

  it("wraps unstructured text in a single chapter", () => {
    const doc = parseTxtDocument(utf8("Just a story\n\nwith two paragraphs."), "Story");
    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0].title).toBe("Story");
    expect(doc.chapters[0].html).toBe("<p>Just a story</p><p>with two paragraphs.</p>");
  });

  it("splits on chapter headings when there are at least two", () => {
    const raw = "第一章 开始\n正文一\n\n第二章 结束\n正文二";
    const doc = parseTxtDocument(utf8(raw), "Book");
    expect(doc.chapters).toHaveLength(2);
    expect(doc.chapters[0].title).toBe("第一章 开始");
    expect(doc.chapters[1].title).toBe("第二章 结束");
    expect(doc.chapters[1].plainText).toBe("正文二");
    expect(doc.toc.map((item) => item.label)).toEqual(["第一章 开始", "第二章 结束"]);
  });

  it("does not split when only one heading is present", () => {
    const doc = parseTxtDocument(utf8("第一章 仅此一章\n正文"), "Solo");
    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0].title).toBe("Solo");
  });

  it("escapes HTML and converts single newlines to <br />", () => {
    const doc = parseTxtDocument(utf8("line<one>\nline&two"), "Esc");
    expect(doc.chapters[0].html).toBe("<p>line&lt;one&gt;<br />line&amp;two</p>");
  });

  it("recognizes English chapter headings", () => {
    const raw = "Chapter 1\nfirst\n\nChapter 2\nsecond";
    const doc = parseTxtDocument(utf8(raw), "EN");
    expect(doc.chapters).toHaveLength(2);
    expect(doc.chapters[0].title).toBe("Chapter 1");
  });
});
