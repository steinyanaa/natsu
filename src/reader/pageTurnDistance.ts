import type { ReaderPageTurnDistance } from "../types";

export type PageTurnAxis = "x" | "y";
export type PageTurnContext = "text" | "manga-snap";

export function resolveTurnDistance(_params: {
  axis: PageTurnAxis;
  viewportWidth: number;
  viewportHeight: number;
  preference?: ReaderPageTurnDistance;
  context?: PageTurnContext;
}): number {
  const viewport = Math.max(0, _params.axis === "x" ? _params.viewportWidth : _params.viewportHeight);
  const preference = _params.preference ?? "normal";
  const ratio = (() => {
    if (_params.context === "manga-snap") {
      if (preference === "compact") return 0.88;
      if (preference === "full") return 0.98;
      return 0.94;
    }
    if (_params.axis === "x") {
      if (preference === "compact") return 0.78;
      if (preference === "full") return 0.94;
      return 0.86;
    }
    if (preference === "compact") return 0.72;
    if (preference === "full") return 0.92;
    return 0.82;
  })();

  return Math.max(320, Math.round(viewport * ratio));
}

export function resolveReaderChromeDelay(_delayMs: number | undefined): number {
  if (typeof _delayMs !== "number" || !Number.isFinite(_delayMs)) {
    return 2400;
  }
  return Math.max(1200, Math.min(6000, Math.round(_delayMs)));
}
