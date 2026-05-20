import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";
import type { ParsedTextDocument } from "../types";

interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  snippet: string;       // 前后60字符
  matchOffset: number;   // 在 snippet 中高亮词的位置
  matchLength: number;
}

export function SearchPanel({
  chapters,
  open,
  onClose,
  onJump,
}: {
  chapters: ParsedTextDocument["chapters"];
  open: boolean;
  onClose: () => void;
  onJump: (chapterId: string, searchText: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    const normalized = q.normalize("NFKC").toLowerCase();
    const found: SearchResult[] = [];
    for (const [index, chapter] of chapters.entries()) {
      const text = (chapter.plainText ?? "").normalize("NFKC");
      let pos = 0;
      let count = 0;
      while (count < 3) { // 每章最多3条
        const idx = text.toLowerCase().indexOf(normalized, pos);
        if (idx < 0) break;
        const start = Math.max(0, idx - 60);
        const end = Math.min(text.length, idx + normalized.length + 60);
        found.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title || `第 ${index + 1} 章`,
          chapterIndex: index,
          snippet: text.slice(start, end),
          matchOffset: idx - start,
          matchLength: normalized.length,
        });
        pos = idx + normalized.length;
        count++;
      }
      if (found.length >= 60) break; // 最多60条
    }
    setResults(found);
    setActiveIndex(0);
  }, [chapters]);

  const search = useCallback((q: string) => {
    setQuery(q);
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => runSearch(q), 180);
  }, [runSearch]);

  const jump = (result: SearchResult) => {
    onJump(result.chapterId, query);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="search-panel-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-panel-input-row">
          <Search size={16} className="search-icon" />
          <input
            ref={inputRef}
            className="search-panel-input"
            value={query}
            placeholder="在本书中搜索…"
            onChange={(e) => search(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results[activeIndex]) jump(results[activeIndex]);
              if (e.key === "ArrowDown") setActiveIndex((i) => Math.min(i + 1, results.length - 1));
              if (e.key === "ArrowUp") setActiveIndex((i) => Math.max(i - 1, 0));
            }}
          />
          <span className="search-count">{results.length > 0 ? `${results.length} 个结果` : ""}</span>
          <button className="icon-button pressable" onClick={onClose}><X size={16} /></button>
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map((result, i) => (
              <button
                key={`${result.chapterId}-${result.matchOffset}`}
                className={`search-result-item ${i === activeIndex ? "active" : ""}`}
                onClick={() => jump(result)}
              >
                <span className="search-result-chapter">{result.chapterTitle}</span>
                <span className="search-result-snippet">
                  {result.snippet.slice(0, result.matchOffset)}
                  <mark>{result.snippet.slice(result.matchOffset, result.matchOffset + result.matchLength)}</mark>
                  {result.snippet.slice(result.matchOffset + result.matchLength)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
