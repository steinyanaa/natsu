import { describe, expect, it } from "vitest";

import type { ReadingSession } from "../ipc/types";
import { mergeSessions, SESSION_CAP } from "./sessions";

function session(start: string, end: string, charsRead = 0): ReadingSession {
  return { bookId: "b", start, end, charsRead };
}

describe("mergeSessions", () => {
  it("concatenates two disjoint lists in order (existing first)", () => {
    const existing = [session("2026-01-01T00:00:00Z", "2026-01-01T00:10:00Z")];
    const incoming = [session("2026-01-02T00:00:00Z", "2026-01-02T00:10:00Z")];
    const out = mergeSessions(existing, incoming);
    expect(out).toHaveLength(2);
    expect(out[0].start).toBe("2026-01-01T00:00:00Z");
    expect(out[1].start).toBe("2026-01-02T00:00:00Z");
  });

  it("dedups entries sharing the same start+end", () => {
    const dup = session("2026-01-01T00:00:00Z", "2026-01-01T00:10:00Z", 5);
    const out = mergeSessions([dup], [{ ...dup, charsRead: 99 }]);
    expect(out).toHaveLength(1);
    // first-seen wins
    expect(out[0].charsRead).toBe(5);
  });

  it("keeps sessions missing a timestamp (cannot be reliably deduped)", () => {
    const a = { bookId: "b", start: "", end: "", charsRead: 1 } as ReadingSession;
    const b = { bookId: "b", start: "", end: "", charsRead: 2 } as ReadingSession;
    const out = mergeSessions([a], [b]);
    expect(out).toHaveLength(2);
  });

  it("caps the merged list to the most recent SESSION_CAP entries", () => {
    const existing = Array.from({ length: SESSION_CAP }, (_, i) =>
      session(`2026-01-01T00:${String(i).padStart(2, "0")}:00Z`, `2026-01-01T00:${String(i).padStart(2, "0")}:30Z`)
    );
    const incoming = [session("2030-12-31T23:59:00Z", "2030-12-31T23:59:30Z", 42)];
    const out = mergeSessions(existing, incoming);
    expect(out).toHaveLength(SESSION_CAP);
    // newest (incoming) survives at the tail; the oldest existing entry is dropped
    expect(out[out.length - 1].charsRead).toBe(42);
    expect(out.some((s) => s.start === "2026-01-01T00:00:00Z")).toBe(false);
  });

  it("respects a custom cap", () => {
    const existing = [session("a", "b"), session("c", "d")];
    const incoming = [session("e", "f")];
    const out = mergeSessions(existing, incoming, 2);
    expect(out).toHaveLength(2);
    expect(out[out.length - 1].start).toBe("e");
  });

  it("is effectively idempotent: merging the same list again is a no-op", () => {
    const list = [
      session("2026-01-01T00:00:00Z", "2026-01-01T00:10:00Z"),
      session("2026-01-02T00:00:00Z", "2026-01-02T00:10:00Z")
    ];
    const once = mergeSessions([], list);
    const twice = mergeSessions(once, list);
    expect(twice).toEqual(once);
  });
});
