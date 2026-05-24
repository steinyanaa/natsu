import { describe, expect, it } from "vitest";
import { imageUrlsFromHtml, imageUrlsFromSrcset } from "./htmlMedia";

describe("html media helpers", () => {
  it("extracts URL candidates from srcset strings", () => {
    expect(imageUrlsFromSrcset("cover-small.jpg 1x, cover-large.jpg 2x")).toEqual([
      "cover-small.jpg",
      "cover-large.jpg"
    ]);
  });

  it("extracts supported image and poster URLs from HTML", () => {
    expect(
      imageUrlsFromHtml(`
        <img src="blob:natsu-cover">
        <img srcset="https://example.test/a.jpg 1x, data:image/png;base64,abc 2x">
        <video poster="https://example.test/poster.jpg"></video>
        <img src="file:///not-allowed.jpg">
      `)
    ).toEqual([
      "blob:natsu-cover",
      "https://example.test/poster.jpg",
      "https://example.test/a.jpg",
      "data:image/png;base64"
    ]);
  });
});
