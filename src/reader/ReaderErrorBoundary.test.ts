import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { ReaderErrorBoundary, readerBoundaryFallbackText } from "./ReaderErrorBoundary";

describe("readerBoundaryFallbackText", () => {
  it("builds stable recovery labels from the translator", () => {
    const t = (key: string) => `t:${key}`;

    expect(readerBoundaryFallbackText(t as never)).toEqual({
      title: "t:readerCrashed",
      retry: "t:retryReader",
      back: "t:returnToLibrary"
    });
  });
});

describe("ReaderErrorBoundary", () => {
  it("renders a recovery panel after an error", () => {
    const boundary = new ReaderErrorBoundary({
      children: null,
      resetKey: "book-1",
      t: ((key: string) => key) as never,
      onBack: vi.fn()
    });

    boundary.setState = ((state: ReaderErrorBoundary["state"]) => {
      boundary.state = state;
    }) as never;
    boundary.componentDidCatch(new Error("boom"));
    const rendered = boundary.render() as React.ReactElement<{ className?: string }>;

    expect(rendered.props.className).toBe("reader-error-panel");
  });

  it("resets captured errors when the current book changes", () => {
    const boundary = new ReaderErrorBoundary({
      children: null,
      resetKey: "book-1",
      t: ((key: string) => key) as never,
      onBack: vi.fn()
    });
    boundary.state = { error: new Error("boom"), resetCounter: 0 };
    boundary.setState = ((state: ReaderErrorBoundary["state"]) => {
      boundary.state = state;
    }) as never;

    boundary.componentDidUpdate({
      children: null,
      resetKey: "book-0",
      t: ((key: string) => key) as never,
      onBack: vi.fn()
    });

    expect(boundary.state.error).toBeUndefined();
  });
});
