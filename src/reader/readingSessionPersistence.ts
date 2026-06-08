export const MIN_READING_SESSION_MS = 30_000;

export function shouldPersistReadingSession(
  elapsedMs: number,
  minDurationMs = MIN_READING_SESSION_MS
): boolean {
  return elapsedMs >= minDurationMs;
}
