import type { ReaderPreloadIntensity } from "../types";

export interface AdaptivePreloadProfile {
  renderWindow: number;
  preloadWindow: number;
  retainPages: number;
  maxExtractPerTick: number;
  pdfRenderWindow: number;
  pdfConcurrency: number;
}

export interface ScrollVelocitySample {
  position: number;
  at: number;
}

export function resolveAdaptivePreloadProfile(_params: {
  velocityPxPerSec: number;
  intensity?: ReaderPreloadIntensity;
}): AdaptivePreloadProfile {
  const velocity = Number.isFinite(_params.velocityPxPerSec)
    ? Math.abs(_params.velocityPxPerSec)
    : 0;
  const fast = velocity >= 1800;
  const intensity = _params.intensity ?? "balanced";

  if (intensity === "low") {
    return fast
      ? {
          renderWindow: 4,
          preloadWindow: 6,
          retainPages: 22,
          maxExtractPerTick: 8,
          pdfRenderWindow: 4,
          pdfConcurrency: 2
        }
      : {
          renderWindow: 3,
          preloadWindow: 4,
          retainPages: 18,
          maxExtractPerTick: 6,
          pdfRenderWindow: 3,
          pdfConcurrency: 2
        };
  }

  if (intensity === "high") {
    return fast
      ? {
          renderWindow: 8,
          preloadWindow: 14,
          retainPages: 48,
          maxExtractPerTick: 16,
          pdfRenderWindow: 8,
          pdfConcurrency: 3
        }
      : {
          renderWindow: 5,
          preloadWindow: 9,
          retainPages: 32,
          maxExtractPerTick: 10,
          pdfRenderWindow: 5,
          pdfConcurrency: 2
        };
  }

  return fast
    ? {
        renderWindow: 6,
        preloadWindow: 10,
        retainPages: 36,
        maxExtractPerTick: 12,
        pdfRenderWindow: 6,
        pdfConcurrency: 2
      }
    : {
        renderWindow: 4,
        preloadWindow: 6,
        retainPages: 24,
        maxExtractPerTick: 8,
        pdfRenderWindow: 4,
        pdfConcurrency: 2
      };
}

export function measureScrollVelocity(params: {
  previousPosition: number;
  nextPosition: number;
  elapsedMs: number;
}): number {
  if (!Number.isFinite(params.elapsedMs) || params.elapsedMs <= 0) {
    return 0;
  }
  return (Math.abs(params.nextPosition - params.previousPosition) / params.elapsedMs) * 1000;
}

export function nextScrollVelocitySample(
  previous: ScrollVelocitySample | undefined,
  current: ScrollVelocitySample
): { sample: ScrollVelocitySample; velocityPxPerSec: number } {
  if (!previous) {
    return { sample: current, velocityPxPerSec: 0 };
  }

  return {
    sample: current,
    velocityPxPerSec: measureScrollVelocity({
      previousPosition: previous.position,
      nextPosition: current.position,
      elapsedMs: current.at - previous.at
    })
  };
}

export function adaptivePreloadProfilesEqual(
  a: AdaptivePreloadProfile,
  b: AdaptivePreloadProfile
): boolean {
  return (
    a.renderWindow === b.renderWindow &&
    a.preloadWindow === b.preloadWindow &&
    a.retainPages === b.retainPages &&
    a.maxExtractPerTick === b.maxExtractPerTick &&
    a.pdfRenderWindow === b.pdfRenderWindow &&
    a.pdfConcurrency === b.pdfConcurrency
  );
}
