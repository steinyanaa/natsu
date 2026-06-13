import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory electron-store stand-in. Each `new Store({ name })` gets its own
// backing object seeded from defaults, so the books store and sessions store
// stay independent — exactly like the real two-file layout.
const backing = new Map<string, Record<string, unknown>>();

vi.mock("electron", () => ({
  app: { getLocale: () => "en-US" }
}));

vi.mock("electron-store", () => {
  class FakeStore {
    private name: string;
    private defaults: Record<string, unknown>;
    constructor(opts: { name: string; defaults: Record<string, unknown> }) {
      this.name = opts.name;
      this.defaults = opts.defaults;
      if (!backing.has(this.name)) {
        backing.set(this.name, structuredClone(opts.defaults));
      }
    }
    // Lazily (re)seed the backing entry so tests can `backing.clear()` between
    // runs even though the store singletons are constructed only once.
    private data(): Record<string, unknown> {
      let d = backing.get(this.name);
      if (!d) {
        // Deep clone so mutating stored values never pollutes the captured
        // defaults (electron-store hands back fresh structures too).
        d = structuredClone(this.defaults);
        backing.set(this.name, d);
      }
      return d;
    }
    get(key: string, fallback?: unknown) {
      const data = this.data();
      return key in data ? data[key] : fallback;
    }
    set(key: string, value: unknown) {
      this.data()[key] = value;
    }
  }
  return { default: FakeStore };
});

import type { BookRecord, ReadingSession } from "../ipc/types";
import { initStore, getStore, migrateSessionsOutOfBooks } from "./store";
import { initSessionStore, getSessions } from "./sessions";

function makeSession(start: string, end: string): ReadingSession {
  return { bookId: "b1", start, end, charsRead: 10 };
}

function makeBook(id: string, sessions: ReadingSession[]): BookRecord {
  return {
    id,
    hash: `hash-${id}`,
    title: `Book ${id}`,
    format: "epub",
    fileName: `${id}.epub`,
    filePath: `/books/${id}.epub`,
    size: 1,
    importedAt: "2026-01-01T00:00:00Z",
    bookmarks: [],
    highlights: [],
    coverSeed: 1,
    readingSessions: sessions
  };
}

describe("migrateSessionsOutOfBooks", () => {
  beforeEach(() => {
    backing.clear();
    initStore();
    initSessionStore();
  });

  it("moves embedded sessions into the sessions store and clears them on books", () => {
    const sessions = [makeSession("2026-01-01T00:00:00Z", "2026-01-01T00:10:00Z")];
    getStore().set("books", [makeBook("b1", sessions)]);

    const migrated = migrateSessionsOutOfBooks();

    expect(migrated).toBe(1);
    expect(getSessions("b1")).toEqual(sessions);
    const books = getStore().get("books", []) as BookRecord[];
    expect(books[0].readingSessions).toEqual([]);
  });

  it("is idempotent — a second run is a no-op", () => {
    const sessions = [makeSession("2026-01-01T00:00:00Z", "2026-01-01T00:10:00Z")];
    getStore().set("books", [makeBook("b1", sessions)]);

    expect(migrateSessionsOutOfBooks()).toBe(1);
    // Second run: nothing left to migrate, sessions store unchanged (no dupes).
    expect(migrateSessionsOutOfBooks()).toBe(0);
    expect(getSessions("b1")).toEqual(sessions);
  });

  it("does nothing when no book has sessions", () => {
    getStore().set("books", [makeBook("b1", [])]);
    expect(migrateSessionsOutOfBooks()).toBe(0);
    expect(getSessions("b1")).toEqual([]);
  });
});
