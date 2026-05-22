import { useEffect } from "react";

interface Props {
  bookTitle: string;
  onExport: (format: "markdown" | "anki") => void;
  onClose: () => void;
}

export function ExportSheet({ bookTitle: _bookTitle, onExport, onClose }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="导出笔记"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="bottom-sheet-title">导出笔记</h3>
        <div className="bottom-sheet-actions">
          <button
            className="soft-button pressable bottom-sheet-export-btn"
            onClick={() => onExport("markdown")}
          >
            Markdown (.md)
          </button>
          <button
            className="soft-button pressable bottom-sheet-export-btn"
            onClick={() => onExport("anki")}
          >
            Anki TSV (.tsv)
          </button>
        </div>
        <button className="soft-button pressable bottom-sheet-cancel" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  );
}
