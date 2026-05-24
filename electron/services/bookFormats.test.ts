import { describe, expect, it } from "vitest";
import { formatFromPath, formatFromUrl, sanitizeFileName, supportedExtensions } from "./bookFormats";

describe("book format helpers", () => {
  it("detects supported formats from local paths and URLs", () => {
    expect(supportedExtensions()).toContain("epub");
    expect(formatFromPath("C:/Books/Natsu.EPUB")).toBe("epub");
    expect(formatFromPath("C:/Books/archive.rar")).toBe("rar");
    expect(formatFromUrl("https://example.test/download/book.cbz?token=1")).toBe("cbz");
    expect(formatFromUrl("https://example.test/download/no-extension", "pdf")).toBe("pdf");
  });

  it("sanitizes user-facing file names without returning an empty name", () => {
    expect(sanitizeFileName("bad:/\\\\name?.epub")).toBe("bad name .epub");
    expect(sanitizeFileName("   ")).toBe("");
  });
});
