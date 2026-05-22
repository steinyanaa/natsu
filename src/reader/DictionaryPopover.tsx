import type * as React from "react";
import { useEffect, useState } from "react";
import type { DictionaryEntry } from "./dictionary";
import { lookupWord } from "./dictionary";
import { ExternalLink } from "lucide-react";

interface DictionaryPopoverProps {
  word: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function DictionaryPopover({ word, x, y, onClose }: DictionaryPopoverProps) {
  const [entries, setEntries] = useState<DictionaryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setEntries(null);
    lookupWord(word).then((results) => {
      setEntries(results);
      setLoading(false);
    });
  }, [word]);

  const openOnline = () => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(word)}+meaning`;
    void window.readerApi?.openExternal(url);
    onClose();
  };

  return (
    <div
      className="dict-popover"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="dict-popover-word">{word}</div>
      {loading && <div className="dict-popover-loading">查询中…</div>}
      {!loading && entries && entries.length > 0 && (
        <div className="dict-popover-entries">
          {entries.map((entry, i) => (
            <div key={i} className="dict-entry">
              <span className="dict-pinyin">{entry.pinyin}</span>
              <span className="dict-defs">{entry.definitions.join("; ")}</span>
            </div>
          ))}
        </div>
      )}
      {!loading && (!entries || entries.length === 0) && (
        <div className="dict-popover-empty">未找到本地释义</div>
      )}
      <button className="dict-online-btn" onClick={openOnline}>
        <ExternalLink size={12} />
        在线查询
      </button>
    </div>
  );
}
