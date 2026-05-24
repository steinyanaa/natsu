import { describe, expect, it, vi } from "vitest";

// systemLanguage() calls app.getLocale(); mock electron's app for the node-env test.
vi.mock("electron", () => ({
  app: {
    getLocale: () => "en-US"
  }
}));

import type { BookRecord, ReaderPreferences } from "../ipc/types";
import {
  defaultPreferences,
  migratePreferences,
  normalizeOnlineSources,
  defaultOnlineSource,
  bookToClient
} from "./store";

describe("defaultPreferences", () => {
  it("returns a preference object with required keys", () => {
    const prefs = defaultPreferences();
    expect(prefs.theme).toBeDefined();
    expect(prefs.fontFamily).toBeDefined();
    expect(prefs.onlineSources.length).toBeGreaterThan(0);
  });

  it("derives language from the system locale", () => {
    expect(defaultPreferences().language).toBe("en-US");
  });
});

describe("migratePreferences", () => {
  it("returns the input mostly untouched when no legacy fields present", () => {
    const input: Partial<ReaderPreferences> = { fontSize: 18, preferencesVersion: 3 };
    const out = migratePreferences(input);
    expect(out.fontSize).toBe(18);
  });

  it("preserves user preference values across migration", () => {
    const input: Partial<ReaderPreferences> = { fontSize: 22, preferencesVersion: 3 };
    const out = migratePreferences(input);
    expect(out.fontSize).toBe(22);
  });
});

describe("normalizeOnlineSources", () => {
  it("returns the default gutenberg source when input is empty", () => {
    const out = normalizeOnlineSources(undefined);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].kind).toBe("gutenberg");
    expect(out[0].kind).toBe(defaultOnlineSource().kind);
  });

  it("treats a legacy string URL (second arg) as a fallback source", () => {
    const out = normalizeOnlineSources(undefined, "https://example.test/api");
    expect(out.some((s) => s.value === "https://example.test/api")).toBe(true);
  });

  it("filters non-gutenberg entries with empty value", () => {
    const out = normalizeOnlineSources([
      { id: "a", name: "no value", kind: "url", value: "" },
      { id: "b", name: "with value", kind: "url", value: "https://ok.test" }
    ]);
    expect(out.some((s) => s.value === "https://ok.test")).toBe(true);
    expect(out.some((s) => s.kind === "url" && s.value === "")).toBe(false);
  });
});

describe("bookToClient", () => {
  it("strips filePath and adds a manga-reader fileUrl", () => {
    const book: BookRecord = {
      id: "abc",
      hash: "h",
      title: "T",
      format: "epub",
      fileName: "t.epub",
      filePath: "/secret/path/t.epub",
      size: 100,
      importedAt: "2026-05-24T00:00:00.000Z",
      bookmarks: [],
      highlights: [],
      coverSeed: 1
    };
    const client = bookToClient(book);
    expect((client as unknown as { filePath?: string }).filePath).toBeUndefined();
    expect(client.fileUrl).toBe("manga-reader://book/abc");
  });

  it("defaults highlights to empty array", () => {
    const book = {
      id: "x",
      hash: "h",
      title: "T",
      format: "epub" as const,
      fileName: "t.epub",
      filePath: "/p",
      size: 1,
      importedAt: "2026-05-24",
      bookmarks: [],
      highlights: undefined as unknown as [],
      coverSeed: 1
    };
    const client = bookToClient(book as unknown as BookRecord);
    expect(client.highlights).toEqual([]);
  });
});
