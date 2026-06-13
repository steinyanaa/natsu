import { describe, expect, it } from "vitest";
import { parseRangeHeader } from "./protocol.js";

describe("parseRangeHeader", () => {
  const size = 1000;

  it("returns null when there is no range header", () => {
    expect(parseRangeHeader(null, size)).toBeNull();
    expect(parseRangeHeader("", size)).toBeNull();
  });

  it("parses a full open-ended range bytes=0-", () => {
    expect(parseRangeHeader("bytes=0-", size)).toEqual({ start: 0, end: 999 });
  });

  it("parses an explicit inclusive range bytes=100-200", () => {
    expect(parseRangeHeader("bytes=100-200", size)).toEqual({ start: 100, end: 200 });
  });

  it("parses an open-ended range from an offset bytes=500-", () => {
    expect(parseRangeHeader("bytes=500-", size)).toEqual({ start: 500, end: 999 });
  });

  it("parses a suffix range bytes=-500 as the last N bytes", () => {
    expect(parseRangeHeader("bytes=-500", size)).toEqual({ start: 500, end: 999 });
  });

  it("clamps a suffix range larger than the resource to the whole resource", () => {
    expect(parseRangeHeader("bytes=-5000", size)).toEqual({ start: 0, end: 999 });
  });

  it("clamps an end past EOF to size-1", () => {
    expect(parseRangeHeader("bytes=900-99999", size)).toEqual({ start: 900, end: 999 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseRangeHeader("  bytes=0-10  ", size)).toEqual({ start: 0, end: 10 });
  });

  it("treats a start at or past EOF as unsatisfiable", () => {
    expect(parseRangeHeader("bytes=1000-", size)).toBe("unsatisfiable");
    expect(parseRangeHeader("bytes=1500-2000", size)).toBe("unsatisfiable");
  });

  it("treats an inverted range (end < start) as unsatisfiable", () => {
    expect(parseRangeHeader("bytes=500-100", size)).toBe("unsatisfiable");
  });

  it("treats a zero-length suffix as unsatisfiable", () => {
    expect(parseRangeHeader("bytes=-0", size)).toBe("unsatisfiable");
  });

  it("treats any range against an empty resource as unsatisfiable", () => {
    expect(parseRangeHeader("bytes=0-", 0)).toBe("unsatisfiable");
    expect(parseRangeHeader("bytes=0-100", 0)).toBe("unsatisfiable");
  });

  it("returns null for garbage headers", () => {
    expect(parseRangeHeader("bytes=", size)).toBeNull();
    expect(parseRangeHeader("bytes=-", size)).toBeNull();
    expect(parseRangeHeader("items=0-100", size)).toBeNull();
    expect(parseRangeHeader("bytes=abc-def", size)).toBeNull();
    expect(parseRangeHeader("bytes=0-100, 200-300", size)).toBeNull();
    expect(parseRangeHeader("totally not a range", size)).toBeNull();
  });
});
