import { describe, expect, it } from "vitest";
import { shouldPersistReadingSession } from "./readingSessionPersistence";

describe("shouldPersistReadingSession", () => {
  it("skips very short accidental opens", () => {
    expect(shouldPersistReadingSession(29_999)).toBe(false);
  });

  it("persists sessions once the reader has been open for at least 30 seconds", () => {
    expect(shouldPersistReadingSession(30_000)).toBe(true);
    expect(shouldPersistReadingSession(90_000)).toBe(true);
  });
});
