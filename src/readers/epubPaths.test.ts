import { describe, expect, it } from "vitest";
import {
  anchorDomId,
  chapterDomId,
  decodeFragment,
  dirname,
  isExternalLink,
  isExternalResource,
  mimeFromPath,
  normalizePath,
  resolvePath,
  resourceExtensionPattern,
  splitHref
} from "./epubPaths";

describe("normalizePath", () => {
  it("strips leading slashes", () => {
    expect(normalizePath("/OEBPS/ch1.xhtml")).toBe("OEBPS/ch1.xhtml");
    expect(normalizePath("///a")).toBe("a");
    expect(normalizePath("OEBPS/ch1.xhtml")).toBe("OEBPS/ch1.xhtml");
  });
});

describe("dirname", () => {
  it("returns the directory portion with trailing slash", () => {
    expect(dirname("OEBPS/text/ch1.xhtml")).toBe("OEBPS/text/");
  });

  it("returns empty string when there is no directory", () => {
    expect(dirname("ch1.xhtml")).toBe("");
  });
});

describe("resolvePath", () => {
  it("resolves a relative href against the chapter directory", () => {
    expect(resolvePath("OEBPS/text/ch1.xhtml", "../images/cover.png")).toBe("OEBPS/images/cover.png");
  });

  it("resolves a sibling href", () => {
    expect(resolvePath("OEBPS/text/ch1.xhtml", "ch2.xhtml")).toBe("OEBPS/text/ch2.xhtml");
  });

  it("drops the fragment when resolving", () => {
    expect(resolvePath("OEBPS/text/ch1.xhtml", "ch2.xhtml#section")).toBe("OEBPS/text/ch2.xhtml");
  });

  it("returns the normalized base path for a bare fragment", () => {
    expect(resolvePath("OEBPS/text/ch1.xhtml", "#footnote")).toBe("OEBPS/text/ch1.xhtml");
  });

  it("decodes percent-encoded paths", () => {
    expect(resolvePath("OEBPS/ch1.xhtml", "a%20b.xhtml")).toBe("OEBPS/a b.xhtml");
  });
});

describe("decodeFragment", () => {
  it("decodes a percent-encoded fragment", () => {
    expect(decodeFragment("note%201")).toBe("note 1");
  });

  it("returns the raw value when decoding fails", () => {
    expect(decodeFragment("%")).toBe("%");
  });
});

describe("splitHref", () => {
  it("splits path and decoded fragment", () => {
    expect(splitHref("ch1.xhtml#note%201")).toEqual({ path: "ch1.xhtml", fragment: "note 1" });
  });

  it("returns undefined fragment when absent", () => {
    expect(splitHref("ch1.xhtml")).toEqual({ path: "ch1.xhtml", fragment: undefined });
  });
});

describe("chapterDomId / anchorDomId", () => {
  it("produces a stable, collision-safe chapter id", () => {
    expect(chapterDomId("OEBPS/ch1.xhtml")).toBe("epub-chapter-OEBPS_2Fch1.xhtml");
  });

  it("normalizes leading slashes before encoding", () => {
    expect(chapterDomId("/OEBPS/ch1.xhtml")).toBe(chapterDomId("OEBPS/ch1.xhtml"));
  });

  it("derives an anchor id from the chapter id", () => {
    expect(anchorDomId("OEBPS/ch1.xhtml", "sec1")).toBe("epub-chapter-OEBPS_2Fch1.xhtml__sec1");
  });
});

describe("isExternalResource", () => {
  it("flags absolute schemes and fragments", () => {
    expect(isExternalResource("https://example.com/x.png")).toBe(true);
    expect(isExternalResource("data:image/png;base64,AAAA")).toBe(true);
    expect(isExternalResource("#anchor")).toBe(true);
  });

  it("treats relative paths as internal", () => {
    expect(isExternalResource("images/cover.png")).toBe(false);
    expect(isExternalResource("../a.png")).toBe(false);
  });
});

describe("isExternalLink", () => {
  it("flags scheme and protocol-relative links", () => {
    expect(isExternalLink("https://example.com")).toBe(true);
    expect(isExternalLink("//example.com")).toBe(true);
  });

  it("does not flag a bare fragment as an external link", () => {
    expect(isExternalLink("#anchor")).toBe(false);
    expect(isExternalLink("ch2.xhtml")).toBe(false);
  });
});

describe("mimeFromPath", () => {
  it("maps known image and font extensions", () => {
    expect(mimeFromPath("a/b/cover.JPG")).toBe("image/jpeg");
    expect(mimeFromPath("x.svg")).toBe("image/svg+xml");
    expect(mimeFromPath("font.woff2")).toBe("font/woff2");
  });

  it("returns the fallback for unknown extensions", () => {
    expect(mimeFromPath("x.xyz")).toBe("application/octet-stream");
    expect(mimeFromPath("x.xyz", "text/plain")).toBe("text/plain");
  });
});

describe("resourceExtensionPattern", () => {
  it("matches embeddable resource extensions", () => {
    expect(resourceExtensionPattern.test("a.png")).toBe(true);
    expect(resourceExtensionPattern.test("a.woff2")).toBe(true);
    expect(resourceExtensionPattern.test("a.xhtml")).toBe(false);
  });
});
