import { describe, expect, it } from "vitest";
import {
  clampSelectionMenuPosition,
  readerContainsSelectionNode,
  shouldShowDictionaryAction
} from "./selectionMenuState";

describe("readerContainsSelectionNode", () => {
  it("accepts selections inside the reader scroller", () => {
    const node = {} as Node;
    const scroller = { contains: (candidate: Node) => candidate === node } as HTMLElement;

    expect(readerContainsSelectionNode(scroller, node)).toBe(true);
  });

  it("rejects selections outside or without a reader scroller", () => {
    const node = {} as Node;
    const scroller = { contains: () => false } as unknown as HTMLElement;

    expect(readerContainsSelectionNode(scroller, node)).toBe(false);
    expect(readerContainsSelectionNode(null, node)).toBe(false);
    expect(readerContainsSelectionNode(scroller, null)).toBe(false);
  });
});

describe("shouldShowDictionaryAction", () => {
  it("requires the dictionary preference and non-empty selected text", () => {
    expect(shouldShowDictionaryAction(true, " 夏目 ")).toBe(true);
    expect(shouldShowDictionaryAction(false, "夏目")).toBe(false);
    expect(shouldShowDictionaryAction(true, "   ")).toBe(false);
  });
});

describe("clampSelectionMenuPosition", () => {
  it("keeps the menu inside the viewport", () => {
    expect(clampSelectionMenuPosition({ left: -80, top: -20, width: 20 }, { width: 320 })).toEqual({
      x: 8,
      y: 8
    });
    expect(clampSelectionMenuPosition({ left: 290, top: 80, width: 40 }, { width: 320 })).toEqual({
      x: 112,
      y: 24
    });
  });
});
