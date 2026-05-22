import type * as React from "react";
import { BookOpen, Copy, MessageSquarePlus } from "lucide-react";

const HIGHLIGHT_COLORS = [
  { id: "yellow" as const, bg: "#FFEB3B", label: "黄色" },
  { id: "green"  as const, bg: "#A5D6A7", label: "绿色" },
  { id: "blue"   as const, bg: "#90CAF9", label: "蓝色" },
  { id: "pink"   as const, bg: "#F48FB1", label: "粉色" },
];

export function SelectionMenu({
  x,
  y,
  onHighlight,
  onCopy,
  onNote,
  onLookup,
  selectedText,
}: {
  x: number;
  y: number;
  onHighlight: (color: "yellow" | "green" | "blue" | "pink") => void;
  onCopy: () => void;
  onNote: () => void;
  onLookup?: (word: string) => void;
  selectedText?: string;
}) {
  return (
    <div
      className="selection-menu"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.preventDefault()}
    >
      <button className="selection-menu-btn" onClick={onCopy} title="复制">
        <Copy size={14} />
      </button>
      <div className="selection-menu-divider" />
      <div className="selection-menu-colors">
        {HIGHLIGHT_COLORS.map(({ id, bg, label }) => (
          <button
            key={id}
            className="selection-color-dot"
            style={{ background: bg }}
            title={`高亮：${label}`}
            onClick={() => onHighlight(id)}
          />
        ))}
      </div>
      <div className="selection-menu-divider" />
      <button className="selection-menu-btn" onClick={onNote} title="批注">
        <MessageSquarePlus size={14} />
      </button>
      {onLookup && selectedText && (
        <>
          <div className="selection-menu-divider" />
          <button className="selection-menu-btn" onClick={() => onLookup(selectedText)} title="查词">
            <BookOpen size={14} />
          </button>
        </>
      )}
    </div>
  );
}
