import type { Highlight } from "../types";

const COLOR_MAP: Record<Highlight["color"], string> = {
  yellow: "rgba(255,235,59,0.45)",
  green:  "rgba(165,214,167,0.45)",
  blue:   "rgba(144,202,249,0.45)",
  pink:   "rgba(244,143,177,0.45)",
};

/** 在 container 里找到 highlight.selectedText 并用 <mark> 包裹 */
export function applyHighlightToDOM(container: HTMLElement, highlight: Highlight): boolean {
  const text = highlight.selectedText;
  if (!text || text.length < 2) return false;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  // 拼接全文，找到匹配位置
  const fullText = textNodes.map((n) => n.textContent ?? "").join("");
  // 优先用上下文匹配，其次直接匹配
  const searchStr = highlight.contextBefore
    ? `${highlight.contextBefore}${text}`
    : text;
  const matchIndex = fullText.indexOf(searchStr);
  const startInFull = matchIndex >= 0
    ? matchIndex + highlight.contextBefore.length
    : fullText.indexOf(text);

  if (startInFull < 0) return false;
  const endInFull = startInFull + text.length;

  // 在 textNodes 中定位 start/end
  let cumulative = 0;
  let startNode: Text | undefined;
  let startOffset = 0;
  let endNode: Text | undefined;
  let endOffset = 0;

  for (const textNode of textNodes) {
    const len = (textNode.textContent ?? "").length;
    if (!startNode && cumulative + len > startInFull) {
      startNode = textNode;
      startOffset = startInFull - cumulative;
    }
    if (!endNode && cumulative + len >= endInFull) {
      endNode = textNode;
      endOffset = endInFull - cumulative;
      break;
    }
    cumulative += len;
  }

  if (!startNode || !endNode) return false;

  try {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    const mark = document.createElement("mark");
    mark.className = `highlight-mark highlight-${highlight.color}`;
    mark.dataset.highlightId = highlight.id;
    mark.style.background = COLOR_MAP[highlight.color];
    mark.style.borderRadius = "3px";
    mark.style.cursor = "pointer";
    range.surroundContents(mark);
    return true;
  } catch {
    return false;
  }
}

/** 从选区提取高亮数据 */
export function selectionToHighlightData(
  selection: Selection,
  chapterId: string
): Omit<Highlight, "id" | "color" | "createdAt"> | undefined {
  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 1) return undefined;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const chapterEl = container instanceof HTMLElement
    ? container.closest(".text-chapter")
    : container.parentElement?.closest(".text-chapter");

  if (!chapterEl) return undefined;

  // 提取上下文
  const fullText = chapterEl.textContent ?? "";
  const selStart = getTextOffset(chapterEl as Element, range.startContainer, range.startOffset);
  const contextBefore = fullText.slice(Math.max(0, selStart - 50), selStart);
  const contextAfter = fullText.slice(selStart + selectedText.length, selStart + selectedText.length + 50);

  return {
    chapterId,
    selectedText,
    contextBefore,
    contextAfter,
  };
}

function getTextOffset(root: Element, targetNode: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node === targetNode) return offset + targetOffset;
    offset += (node.textContent ?? "").length;
  }
  return offset;
}
