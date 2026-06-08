export const READER_CHROME_POINTER_ZONE_PX = 104;
export const READER_CHROME_REVEAL_THROTTLE_MS = 200;

export function shouldRevealChromeFromPointer(
  clientY: number,
  lastRevealAt: number,
  now: number,
  topZonePx = READER_CHROME_POINTER_ZONE_PX,
  throttleMs = READER_CHROME_REVEAL_THROTTLE_MS
): boolean {
  return clientY <= topZonePx && now - lastRevealAt >= throttleMs;
}
