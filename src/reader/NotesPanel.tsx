import type * as React from "react";
import { Trash2 } from "lucide-react";
import type { Highlight } from "../types";

const COLOR_LABEL: Record<Highlight["color"], string> = {
  yellow: "#FFEB3B",
  green: "#A5D6A7",
  blue: "#90CAF9",
  pink: "#F48FB1",
};

export function NotesPanel({
  highlights,
  onRemove,
}: {
  highlights: Highlight[];
  onRemove: (ids: string[]) => void;
}) {
  if (!highlights.length) {
    return <p style={{ padding: "24px", color: "var(--reader-muted)", fontSize: 14 }}>暂无高亮或批注</p>;
  }
  return (
    <div className="notes-panel">
      {highlights.map((h) => (
        <div key={h.id} className="notes-item">
          <div
            className="notes-item-bar"
            style={{ background: COLOR_LABEL[h.color] }}
          />
          <div className="notes-item-body">
            <p className="notes-item-text">"{h.selectedText}"</p>
            {h.note && <p className="notes-item-note">{h.note}</p>}
          </div>
          <button
            className="icon-button pressable notes-item-remove"
            onClick={() => onRemove([h.id])}
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
