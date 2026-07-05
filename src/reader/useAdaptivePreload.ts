import { useCallback, useEffect, useRef, useState } from "react";
import type { ReaderPreloadIntensity } from "../types";
import {
  adaptivePreloadProfilesEqual,
  nextScrollVelocitySample,
  resolveAdaptivePreloadProfile,
  type AdaptivePreloadProfile,
  type ScrollVelocitySample
} from "./adaptivePreload";

export interface AdaptivePreloadState {
  profile: AdaptivePreloadProfile;
  sampleScrollPosition: (position: number, at?: number) => void;
  resetScrollVelocity: () => void;
}

export function useAdaptivePreload(intensity?: ReaderPreloadIntensity): AdaptivePreloadState {
  const [profile, setProfile] = useState(() =>
    resolveAdaptivePreloadProfile({ velocityPxPerSec: 0, intensity })
  );
  const sampleRef = useRef<ScrollVelocitySample | undefined>(undefined);

  useEffect(() => {
    setProfile((current) => {
      const next = resolveAdaptivePreloadProfile({ velocityPxPerSec: 0, intensity });
      return adaptivePreloadProfilesEqual(current, next) ? current : next;
    });
  }, [intensity]);

  const sampleScrollPosition = useCallback((position: number, at = performance.now()) => {
    const next = nextScrollVelocitySample(sampleRef.current, { position, at });
    sampleRef.current = next.sample;
    setProfile((current) => {
      const nextProfile = resolveAdaptivePreloadProfile({
        velocityPxPerSec: next.velocityPxPerSec,
        intensity
      });
      return adaptivePreloadProfilesEqual(current, nextProfile) ? current : nextProfile;
    });
  }, [intensity]);

  const resetScrollVelocity = useCallback(() => {
    sampleRef.current = undefined;
    setProfile((current) => {
      const next = resolveAdaptivePreloadProfile({ velocityPxPerSec: 0, intensity });
      return adaptivePreloadProfilesEqual(current, next) ? current : next;
    });
  }, [intensity]);

  return { profile, sampleScrollPosition, resetScrollVelocity };
}
