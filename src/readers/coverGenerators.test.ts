import { describe, expect, it } from "vitest";
import { coverEligibleFormat, coverUrl } from "./coverGenerators";

describe("coverEligibleFormat", () => {
  it("maps epub to the epub path", () => { expect(coverEligibleFormat("epub")).toBe("epub"); });
  it("maps pdf to the pdf path", () => { expect(coverEligibleFormat("pdf")).toBe("pdf"); });
  it("maps every comic archive extension to the comic path", () => {
    expect(coverEligibleFormat("cbz")).toBe("comic");
    expect(coverEligibleFormat("zip")).toBe("comic");
    expect(coverEligibleFormat("cbr")).toBe("comic");
    expect(coverEligibleFormat("rar")).toBe("comic");
  });
  it("returns null for formats without a first-page cover", () => {
    expect(coverEligibleFormat("txt")).toBeNull();
    expect(coverEligibleFormat("mobi")).toBeNull();
    expect(coverEligibleFormat("azw3")).toBeNull();
  });
});

describe("coverUrl", () => {
  it("builds the protocol url with an encoded id and version", () => {
    expect(coverUrl("abc 1", "h7")).toBe("manga-reader://cover/abc%201?v=h7");
  });
  it("falls back to the id as the version when none is given", () => {
    expect(coverUrl("abc", "")).toBe("manga-reader://cover/abc?v=abc");
    expect(coverUrl("abc")).toBe("manga-reader://cover/abc?v=abc");
  });
});
