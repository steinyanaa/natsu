import { describe, expect, it } from "vitest";
import { isPdfRenderCancellation, nextPdfPageRenderState, type PdfPageRenderState } from "./pdfRenderState";

describe("isPdfRenderCancellation", () => {
  it("treats abort and pdf.js rendering cancellation errors as normal cancellation", () => {
    expect(isPdfRenderCancellation(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isPdfRenderCancellation({ name: "RenderingCancelledException", message: "cancelled" })).toBe(true);
    expect(isPdfRenderCancellation(new Error("Render task was cancelled"))).toBe(true);
  });

  it("does not treat real render failures as cancellation", () => {
    expect(isPdfRenderCancellation(new Error("Missing page operator list"))).toBe(false);
    expect(isPdfRenderCancellation({ name: "UnknownErrorException", message: "bad pdf" })).toBe(false);
  });
});

describe("nextPdfPageRenderState", () => {
  it("keeps cancellation hidden from the page error UI", () => {
    const current: PdfPageRenderState = { status: "rendering" };

    expect(nextPdfPageRenderState(current, new DOMException("aborted", "AbortError"))).toEqual(current);
  });

  it("turns real failures into a page-scoped error", () => {
    expect(nextPdfPageRenderState({ status: "rendering" }, new Error("bad page"))).toEqual({
      status: "error",
      message: "bad page"
    });
  });
});
