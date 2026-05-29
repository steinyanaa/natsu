import { Search } from "lucide-react";
import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { createTranslator } from "../i18n";
import { percentLabel } from "../reader/utils";
import type { BookRecord } from "../types";

export function CommandPalette({
  books,
  t,
  onSelect,
  onClose
}: {
  books: BookRecord[];
  t: ReturnType<typeof createTranslator>;
  onSelect: (book: BookRecord) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const norm = q.trim().toLowerCase();
    if (!norm) return books.slice(0, 8);
    return books
      .filter((b) => `${b.title} ${b.author ?? ""}`.toLowerCase().includes(norm))
      .slice(0, 8);
  }, [books, q]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { if (results[cursor]) onSelect(results[cursor]); }
    else if (e.key === "Escape") { onClose(); }
  };

  return (
    <div className="dialog-backdrop command-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-search-row">
          <Search size={18} />
          <input
            ref={inputRef}
            className="command-input"
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={handleKey}
            placeholder={t("commandPalette")}
          />
          <kbd className="command-esc-hint">ESC</kbd>
        </div>
        <ul className="command-list" role="listbox">
          {results.map((book, i) => (
            <li
              key={book.id}
              className={`command-item${i === cursor ? " active" : ""}`}
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => onSelect(book)}
            >
              <span className="format-chip small">{book.format.toUpperCase()}</span>
              <span className="command-title">{book.title}</span>
              {book.author && <span className="command-author">{book.author}</span>}
              <span className="command-progress">{percentLabel(book.progress)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
