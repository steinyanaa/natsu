import { describe, expect, it } from "vitest";
import {
  hashBuffer,
  isLikelyHtml,
  bufferLooksLikeFormat,
  sizeLabelFromText
} from "./library";

describe("hashBuffer", () => {
  it("is deterministic for identical input", () => {
    expect(hashBuffer(Buffer.from("hello"))).toBe(hashBuffer(Buffer.from("hello")));
  });

  it("differs for different input", () => {
    expect(hashBuffer(Buffer.from("a"))).not.toBe(hashBuffer(Buffer.from("b")));
  });
});

describe("isLikelyHtml", () => {
  it("returns true for buffers starting with <!doctype html>", () => {
    expect(isLikelyHtml(Buffer.from("<!doctype html><html><body></body></html>"))).toBe(true);
  });

  it("returns true for content-type text/html", () => {
    expect(isLikelyHtml(Buffer.from("anything"), "text/html; charset=utf-8")).toBe(true);
  });

  it("returns false for EPUB magic bytes", () => {
    const epub = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(isLikelyHtml(epub)).toBe(false);
  });
});

describe("bufferLooksLikeFormat", () => {
  it("matches EPUB by PK magic bytes", () => {
    const epub = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
    expect(bufferLooksLikeFormat(epub, "epub")).toBe(true);
  });

  it("matches PDF by %PDF prefix", () => {
    const pdf = Buffer.from("%PDF-1.4\n");
    expect(bufferLooksLikeFormat(pdf, "pdf")).toBe(true);
  });

  it("rejects HTML masquerading as epub", () => {
    const html = Buffer.from("<!doctype html>");
    expect(bufferLooksLikeFormat(html, "epub", "text/html")).toBe(false);
  });
});

describe("sizeLabelFromText", () => {
  it("returns the input cleaned up", () => {
    expect(sizeLabelFromText("  2.5 MB  ")).toBe("2.5 MB");
  });

  it("returns undefined for empty input", () => {
    expect(sizeLabelFromText("")).toBeUndefined();
    expect(sizeLabelFromText(undefined)).toBeUndefined();
  });
});
