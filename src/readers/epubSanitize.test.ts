import { describe, expect, it } from "vitest";
import {
  resolveReaderMediaUrl,
  sanitizeReaderHtmlSource,
  stripCssImports
} from "./epub";

describe("sanitizeReaderHtmlSource", () => {
  it("removes active and form controls while preserving surrounding readable text", () => {
    const html = `
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=https://example.com">
          <script>alert(1)</script>
        </head>
        <body>
          <p>before</p>
          <form><p>inside form</p><input value="x"><button>send</button></form>
          <embed src="movie.swf">
          <textarea>draft</textarea>
          <select><option>a</option></select>
          <p>after</p>
        </body>
      </html>
    `;

    const result = sanitizeReaderHtmlSource(html);

    expect(result).toContain("<p>before</p>");
    expect(result).toContain("<p>inside form</p>");
    expect(result).toContain("<p>after</p>");
    expect(result).not.toMatch(/<script|<meta[^>]+refresh|<input|<button|<embed|<textarea|<select/i);
  });

  it("removes css imports from inline style blocks", () => {
    const result = sanitizeReaderHtmlSource(`
      <style>
        @import url("https://example.com/remote.css");
        p { color: red; }
      </style>
      <p>body</p>
    `);

    expect(result).not.toContain("@import");
    expect(result).toContain("p { color: red; }");
  });
});

describe("stripCssImports", () => {
  it("drops quoted, url, and bare import statements", () => {
    const css = `
      @import "a.css";
      @import url('b.css') screen;
      @import c.css;
      body { margin: 0; }
    `;

    expect(stripCssImports(css)).toBe("\n      \n      \n      \n      body { margin: 0; }\n    ");
  });
});

describe("resolveReaderMediaUrl", () => {
  it("returns mapped internal media urls", () => {
    const resources = new Map([["OEBPS/images/cover.png", "blob:natsu-cover"]]);

    expect(resolveReaderMediaUrl("images/cover.png", "OEBPS/ch1.xhtml", resources)).toBe("blob:natsu-cover");
  });

  it("drops external, data, and missing internal media urls", () => {
    const resources = new Map<string, string>();

    expect(resolveReaderMediaUrl("https://example.com/a.png", "OEBPS/ch1.xhtml", resources)).toBeUndefined();
    expect(resolveReaderMediaUrl("data:image/png;base64,AAAA", "OEBPS/ch1.xhtml", resources)).toBeUndefined();
    expect(resolveReaderMediaUrl("images/missing.png", "OEBPS/ch1.xhtml", resources)).toBeUndefined();
  });
});
