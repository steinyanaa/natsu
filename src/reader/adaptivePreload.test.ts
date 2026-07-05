import { describe, expect, it } from "vitest";
import { adaptivePreloadProfilesEqual, nextScrollVelocitySample, resolveAdaptivePreloadProfile } from "./adaptivePreload";

describe("resolveAdaptivePreloadProfile", () => {
  it("uses balanced defaults for calm scrolling", () => {
    expect(resolveAdaptivePreloadProfile({ velocityPxPerSec: 120 })).toEqual({
      renderWindow: 4,
      preloadWindow: 6,
      retainPages: 24,
      maxExtractPerTick: 8,
      pdfRenderWindow: 4,
      pdfConcurrency: 2
    });
  });

  it("expands the window when scrolling or paging quickly", () => {
    expect(resolveAdaptivePreloadProfile({ velocityPxPerSec: 3600, intensity: "balanced" })).toMatchObject({
      renderWindow: 6,
      preloadWindow: 10,
      retainPages: 36,
      maxExtractPerTick: 12,
      pdfRenderWindow: 6
    });
  });

  it("honors low and high intensity preferences without unbounded growth", () => {
    expect(resolveAdaptivePreloadProfile({ velocityPxPerSec: 4200, intensity: "low" })).toMatchObject({
      preloadWindow: 6,
      retainPages: 22
    });
    expect(resolveAdaptivePreloadProfile({ velocityPxPerSec: 4200, intensity: "high" })).toMatchObject({
      preloadWindow: 14,
      retainPages: 48,
      maxExtractPerTick: 16
    });
  });

  it("treats invalid velocity as calm scrolling", () => {
    expect(resolveAdaptivePreloadProfile({ velocityPxPerSec: Number.NaN }).preloadWindow).toBe(6);
    expect(resolveAdaptivePreloadProfile({ velocityPxPerSec: Number.POSITIVE_INFINITY }).preloadWindow).toBe(6);
  });
});

describe("nextScrollVelocitySample", () => {
  it("returns zero velocity for the first sample and stores the current position", () => {
    expect(nextScrollVelocitySample(undefined, { position: 120, at: 1000 })).toEqual({
      sample: { position: 120, at: 1000 },
      velocityPxPerSec: 0
    });
  });

  it("computes absolute velocity from the previous sample", () => {
    expect(
      nextScrollVelocitySample(
        { position: 120, at: 1000 },
        { position: 420, at: 1250 }
      )
    ).toEqual({
      sample: { position: 420, at: 1250 },
      velocityPxPerSec: 1200
    });
  });
});

describe("adaptivePreloadProfilesEqual", () => {
  it("compares every scheduling field", () => {
    const profile = resolveAdaptivePreloadProfile({ velocityPxPerSec: 0 });
    expect(adaptivePreloadProfilesEqual(profile, { ...profile })).toBe(true);
    expect(adaptivePreloadProfilesEqual(profile, { ...profile, preloadWindow: profile.preloadWindow + 1 })).toBe(false);
    expect(adaptivePreloadProfilesEqual(profile, { ...profile, pdfConcurrency: profile.pdfConcurrency + 1 })).toBe(false);
  });
});
