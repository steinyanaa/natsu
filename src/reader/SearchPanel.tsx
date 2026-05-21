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

function createSearchWorker(): Worker {
  const code = `
    self.onmessage = function(e) {
      const { query, chapters, id } = e.data;
      const normalized = query.normalize("NFKC").toLowerCase();
      const found = [];
      for (let ci = 0; ci < chapters.length; ci++) {
        const chapter = chapters[ci];
        const text = (chapter.plainText || "").normalize("NFKC");
        let pos = 0;
        let count = 0;
        while (count < 3) {
          const idx = text.toLowerCase().indexOf(normalized, pos);
          if (idx < 0) break;
          const start = Math.max(0, idx - 60);
          const end = Math.min(text.length, idx + normalized.length + 60);
          found.push({
            chapterId: chapter.id,
            chapterTitle: chapter.title || ("第 " + (ci + 1) + " 章"),
            chapterIndex: ci,
            snippet: text.slice(start, end),
            matchOffset: idx - start,
            matchLength: normalized.length,
          });
          pos = idx + normalized.length;
          count++;
        }
        if (found.length >= 60) break;
      }
      self.postMessage({ id, results: found });
    };
  `;
  const blob = new Blob([code], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker;
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
  const workerRef = useRef<Worker | null>(null);
  const searchIdRef = useRef(0);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }

    // Create worker on first use
    if (!workerRef.current) {
      workerRef.current = createSearchWorker();
    }

    const id = ++searchIdRef.current;
    const worker = workerRef.current;

    // Prepare lightweight data to send (only id, title, plainText)
    const chaptersData = chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      plainText: ch.plainText ?? "",
    }));

    worker.onmessage = (e: MessageEvent<{ id: number; results: SearchResult[] }>) => {
      // Ignore stale results from previous searches
      if (e.data.id !== id) return;
      setResults(e.data.results);
      setActiveIndex(0);
    };

    worker.postMessage({ query: q, chapters: chaptersData, id });
  }, [chapters]);

  const search = useCallback((q: string) => {
    setQuery(q);
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => runSearch(q), 350);
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
