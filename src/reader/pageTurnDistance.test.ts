import { describe, expect, it } from "vitest";
import { resolveReaderChromeDelay, resolveTurnDistance } from "./pageTurnDistance";

describe("resolveTurnDistance", () => {
  it("keeps normal text page turns close to the current behavior", () => {
    expect(resolveTurnDistance({ axis: "x", viewportWidth: 1000, viewportHeight: 800 })).toBe(860);
    expect(resolveTurnDistance({ axis: "y", viewportWidth: 1000, viewportHeight: 800 })).toBe(656);
  });

  it("supports compact and full distance preferences", () => {
    expect(resolveTurnDistance({ axis: "y", viewportWidth: 1000, viewportHeight: 800, preference: "compact" })).toBe(576);
    expect(resolveTurnDistance({ axis: "y", viewportWidth: 1000, viewportHeight: 800, preference: "full" })).toBe(736);
  });

  it("uses full-screen turns for snapped manga layouts", () => {
    expect(
      resolveTurnDistance({
        axis: "y",
        viewportWidth: 900,
        viewportHeight: 1200,
        preference: "normal",
        context: "manga-snap"
      })
    ).toBe(1128);
  });

  it("sanitizes reader chrome delay while preserving the old default", () => {
    expect(resolveReaderChromeDelay(undefined)).toBe(2400);
    expect(resolveReaderChromeDelay(500)).toBe(1200);
    expect(resolveReaderChromeDelay(9000)).toBe(6000);
    expect(resolveReaderChromeDelay(3200)).toBe(3200);
  });
});
