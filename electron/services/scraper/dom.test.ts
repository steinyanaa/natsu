import { describe, expect, it } from "vitest";
import { parse } from "node-html-parser";
import {
  selectedElement,
  selectedText,
  selectedAttr,
  hrefFrom,
  resolveUrl,
  valueByPath,
  stringField,
  attrCandidates,
  normalizeSubjects,
  resultArrayFromCustomPayload,
  importabilityReason
} from "./dom";

describe("selectedElement / selectedText / selectedAttr", () => {
  const root = parse(
    `<div><a class="title" href="/book/1" data-id="42">Hello</a></div>`
  );

  it("returns the root element for empty selector", () => {
    expect(selectedElement(root)).toBe(root);
    expect(selectedText(root)).toBe("Hello");
  });

  it("returns text for a valid selector", () => {
    expect(selectedText(root, ".title")).toBe("Hello");
  });

  it("returns attr value, falling back through candidates", () => {
    expect(selectedAttr(root, ".title", "data-id", ["data-id", "href"])).toBe("42");
    expect(selectedAttr(root, ".title", undefined, ["data-id", "href"])).toBe("42");
  });
});

describe("hrefFrom", () => {
  const root = parse(`<a class="x" href="/b/1"></a>`);
  it("reads href by default", () => {
    expect(hrefFrom(root, ".x")).toBe("/b/1");
  });
});

describe("resolveUrl", () => {
  it("returns absolute URL given relative path and base", () => {
    expect(resolveUrl("https://a.test/x/", "../y")).toBe("https://a.test/y");
  });

  it("returns undefined for empty value", () => {
    expect(resolveUrl("https://a.test/", "")).toBeUndefined();
    expect(resolveUrl("https://a.test/", undefined)).toBeUndefined();
  });
});

describe("valueByPath", () => {
  const obj = { a: { b: [{ c: "found" }] } };
  it("reads nested keys via dot path", () => {
    expect(valueByPath(obj, "a.b.0.c")).toBe("found");
  });

  it("returns undefined for missing path", () => {
    expect(valueByPath(obj, "a.x.y")).toBeUndefined();
  });

  it("returns undefined for empty path", () => {
    expect(valueByPath(obj, "")).toBeUndefined();
  });
});

describe("stringField", () => {
  it("returns the first matching key", () => {
    expect(stringField({ title: "T", name: "N" }, ["name", "title"])).toBe("N");
  });

  it("returns undefined when no key matches", () => {
    expect(stringField({ x: 1 }, ["title"])).toBeUndefined();
  });
});

describe("attrCandidates", () => {
  it("returns user attrs when provided", () => {
    expect(attrCandidates("data-x", ["href"])).toEqual(["data-x"]);
  });

  it("returns fallbacks alone when user attr missing", () => {
    expect(attrCandidates(undefined, ["href", "data-id"])).toEqual(["href", "data-id"]);
  });
});

describe("normalizeSubjects", () => {
  it("returns an array of strings for array input", () => {
    expect(normalizeSubjects(["sci-fi", "novel"])).toEqual(["sci-fi", "novel"]);
  });

  it("splits a comma-separated string", () => {
    const result = normalizeSubjects("sci-fi, novel");
    expect(result).toContain("sci-fi");
    expect(result).toContain("novel");
  });

  it("returns empty for falsy input", () => {
    expect(normalizeSubjects(undefined)).toEqual([]);
  });
});

describe("resultArrayFromCustomPayload", () => {
  it("returns the array when input is an array", () => {
    expect(resultArrayFromCustomPayload([1, 2])).toEqual([1, 2]);
  });

  it("returns common result keys", () => {
    expect(resultArrayFromCustomPayload({ results: [1] })).toEqual([1]);
    expect(resultArrayFromCustomPayload({ data: [2] })).toEqual([2]);
    expect(resultArrayFromCustomPayload({ items: [3] })).toEqual([3]);
  });
});

describe("importabilityReason", () => {
  it("returns undefined when format is supported and URL present", () => {
    expect(importabilityReason("https://x.test/a.epub", "epub")).toBeUndefined();
  });

  it("returns a reason when URL is missing", () => {
    expect(importabilityReason(undefined, "epub")).toBeDefined();
  });
});
