export interface FocusBlockCandidate {
  id: string;
  top: number;
  bottom: number;
  eligible?: boolean;
}

export interface FocusViewport {
  top: number;
  height: number;
}

export function pickFocusedBlock(
  candidates: FocusBlockCandidate[],
  viewport: FocusViewport,
  options: { enabled?: boolean } = {}
): string | undefined {
  if (options.enabled === false || !candidates.length) {
    return undefined;
  }

  const viewportTop = viewport.top;
  const viewportBottom = viewport.top + viewport.height;
  const viewportCenter = viewport.top + viewport.height / 2;

  let best: { id: string; distance: number } | undefined;

  for (const candidate of candidates) {
    if (candidate.eligible === false) {
      continue;
    }

    if (candidate.bottom <= viewportTop || candidate.top >= viewportBottom) {
      continue;
    }

    const candidateCenter = candidate.top + (candidate.bottom - candidate.top) / 2;
    const distance = Math.abs(candidateCenter - viewportCenter);
    if (!best || distance < best.distance) {
      best = { id: candidate.id, distance };
    }
  }

  return best?.id;
}
