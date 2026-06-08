export type PdfPageRenderState =
  | { status: "idle" | "rendering" | "ready" }
  | { status: "error"; message: string };

export function isPdfRenderCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { name?: unknown; message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";

  return (
    name === "AbortError" ||
    name === "RenderingCancelledException" ||
    /render task was cancelled|rendering cancelled|aborted/i.test(message)
  );
}

export function nextPdfPageRenderState(
  current: PdfPageRenderState,
  error: unknown
): PdfPageRenderState {
  if (isPdfRenderCancellation(error)) {
    return current;
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "PDF page render failed"
  };
}
