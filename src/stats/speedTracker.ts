// Rolling 10-sample buffer of (chars, ms) pairs
// recordPageTurn: called when user advances a page
// getSessionAvgCpm: returns average chars/minute for this session

const MAX_SAMPLES = 10;
const samples: Array<{ chars: number; ms: number }> = [];

export function recordPageTurn(chapterCharCount: number, elapsedMs: number): void {
  if (elapsedMs < 3000 || elapsedMs > 600000) return; // ignore < 3s or > 10min (user idle)
  if (chapterCharCount < 10) return; // ignore trivial chapters
  if (samples.length >= MAX_SAMPLES) samples.shift();
  samples.push({ chars: chapterCharCount, ms: elapsedMs });
}

export function getSessionAvgCpm(): number {
  if (samples.length === 0) return 0;
  const totalChars = samples.reduce((s, x) => s + x.chars, 0);
  const totalMs = samples.reduce((s, x) => s + x.ms, 0);
  return totalMs > 0 ? Math.round((totalChars / totalMs) * 60000) : 0;
}

export function resetSession(): void {
  samples.length = 0;
}
