export function readerContainsSelectionNode(scroller: HTMLElement | null, node: Node | null): boolean {
  return Boolean(scroller && node && (node === scroller || scroller.contains(node)));
}

export function shouldShowDictionaryAction(dictionaryEnabled: boolean, selectedText?: string): boolean {
  return dictionaryEnabled && Boolean(selectedText?.trim());
}

export function clampSelectionMenuPosition(
  rect: Pick<DOMRect, "left" | "top" | "width">,
  viewport: { width: number },
  menuWidth = 200,
  menuOffset = 56
): { x: number; y: number } {
  return {
    x: Math.max(8, Math.min(rect.left + rect.width / 2 - menuWidth / 2, viewport.width - menuWidth - 8)),
    y: Math.max(8, rect.top - menuOffset)
  };
}
