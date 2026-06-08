import { BookOpen, Copy, MessageSquarePlus } from "lucide-react";
import { shouldShowDictionaryAction } from "./selectionMenuState";

const HIGHLIGHT_COLORS = [
  { id: "yellow" as const, bg: "#FFEB3B", label: "????" },
  { id: "green" as const, bg: "#A5D6A7", label: "????" },
  { id: "blue" as const, bg: "#90CAF9", label: "????" },
  { id: "pink" as const, bg: "#F48FB1", label: "????" },
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
  const canLookup = Boolean(onLookup) && shouldShowDictionaryAction(true, selectedText);

  return (
    <div
      className="selection-menu"
      role="toolbar"
      aria-label="??????"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.preventDefault()}
    >
      <button className="selection-menu-btn" onClick={onCopy} title="??" aria-label="??????">
        <Copy size={16} />
      </button>
      <div className="selection-menu-divider" />
      <div className="selection-menu-colors" role="group" aria-label="????">
        {HIGHLIGHT_COLORS.map(({ id, bg, label }) => (
          <button
            key={id}
            className="selection-color-dot"
            style={{ background: bg }}
            title={label}
            aria-label={label}
            onClick={() => onHighlight(id)}
          />
        ))}
      </div>
      <div className="selection-menu-divider" />
      <button className="selection-menu-btn" onClick={onNote} title="??" aria-label="????">
        <MessageSquarePlus size={16} />
      </button>
      {canLookup ? (
        <>
          <div className="selection-menu-divider" />
          <button
            className="selection-menu-btn"
            onClick={() => onLookup?.(selectedText!.trim())}
            title="??"
            aria-label="??????"
          >
            <BookOpen size={16} />
          </button>
        </>
      ) : null}
    </div>
  );
}
