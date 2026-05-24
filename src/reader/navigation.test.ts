import { describe, expect, it } from "vitest";
import { resolveExistingTargetId, targetIdFromHashHref } from "./navigation";

describe("reader navigation helpers", () => {
  it("extracts target IDs from hash hrefs only", () => {
    expect(targetIdFromHashHref("#chapter-1__note-2")).toBe("chapter-1__note-2");
    expect(targetIdFromHashHref("https://example.test/#chapter-1")).toBeUndefined();
    expect(targetIdFromHashHref("#")).toBeUndefined();
  });

  it("falls back from a missing anchor to its chapter container", () => {
    expect(resolveExistingTargetId("chapter-1__missing", new Set(["chapter-1"]))).toBe("chapter-1");
  });
});
