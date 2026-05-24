import { describe, expect, it } from "vitest";
import { parseSourcePack } from "./sourcePack";

describe("parseSourcePack", () => {
  it("parses a single source object into an enabled online source", () => {
    expect(
      parseSourcePack(
        JSON.stringify({
          name: "Example JSON",
          kind: "json",
          value: "https://example.test/search?q={query}"
        }),
        () => "stable-id"
      )
    ).toEqual([
      {
        id: "stable-id",
        name: "Example JSON",
        enabled: true,
        kind: "json",
        value: "https://example.test/search?q={query}"
      }
    ]);
  });

  it("parses a source pack wrapper and filters invalid entries", () => {
    expect(
      parseSourcePack(
        JSON.stringify({
          sources: [
            { id: "valid", name: "Valid HTML", kind: "html", value: "{\"adapter\":\"html\"}", enabled: false },
            { name: "Invalid", kind: "ftp", value: "https://example.test" },
            { kind: "json", value: "https://example.test" }
          ]
        }),
        () => "unused"
      )
    ).toEqual([
      {
        id: "valid",
        name: "Valid HTML",
        enabled: false,
        kind: "html",
        value: "{\"adapter\":\"html\"}"
      }
    ]);
  });
});
