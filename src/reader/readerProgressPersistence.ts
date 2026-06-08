import type { ReaderProgress } from "../types";

export const PROGRESS_PERCENT_EPSILON = 0.0015;

export function shouldUpdateProgressState(
  current: ReaderProgress,
  next: ReaderProgress,
  epsilon = PROGRESS_PERCENT_EPSILON
): boolean {
  return (
    Math.abs(current.percent - next.percent) >= epsilon ||
    current.current !== next.current ||
    current.total !== next.total
  );
}

export function shouldPersistProgress(
  lastSavedPercent: number,
  pending: ReaderProgress,
  epsilon = PROGRESS_PERCENT_EPSILON
): boolean {
  return Math.abs(lastSavedPercent - pending.percent) >= epsilon;
}
