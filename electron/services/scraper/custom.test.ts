import { describe, expect, it } from "vitest";
import { customSourceSearchUrl, resolveCustomSourceConfig } from "./custom";

describe("customSourceSearchUrl", () => {
  it("substitutes {query} placeholder", () => {
    expect(customSourceSearchUrl("https://x.test/search?q={query}", "rust")).toBe(
      "https://x.test/search?q=rust"
    );
  });

  it("encodes query for URL safety", () => {
    expect(customSourceSearchUrl("https://x.test/?q={query}", "hello world")).toBe(
      "https://x.test/?q=hello%20world"
    );
  });

  it("appends ?q=<query> when source has no {query} placeholder", () => {
    // Real behavior: non-template URLs get a `q` search param appended.
    expect(customSourceSearchUrl("https://x.test/no-template", "x")).toBe(
      "https://x.test/no-template?q=x"
    );
  });
});

describe("resolveCustomSourceConfig", () => {
  it("returns the raw URL when input is a plain http URL", () => {
    expect(resolveCustomSourceConfig("https://x.test/api")).toBe("https://x.test/api");
  });

  it("parses inline JSON config", () => {
    // Real impl keys on `searchUrl`, not `url`.
    const config = JSON.stringify({ adapter: "json", searchUrl: "https://x.test/api", mappings: { title: "name" } });
    const out = resolveCustomSourceConfig(config);
    expect(typeof out).toBe("object");
    if (typeof out !== "string" && out) {
      expect((out as { adapter: string }).adapter).toBe("json");
    }
  });
});
