import { Download, ExternalLink, Search, X } from "lucide-react";
import { useState } from "react";
import type { OnlineBookResult, OnlineSource } from "../types";

export function OnlineResultCover({ book }: { book: OnlineBookResult }) {
  const [failed, setFailed] = useState(false);
  const label = book.format?.toUpperCase() ?? "BOOK";
  const titleGlyph = (book.title || label).trim().slice(0, 1).toUpperCase();

  if (book.coverUrl && !failed) {
    return (
      <div className="online-cover-shell">
        <img className="online-cover-art" src={book.coverUrl} alt="" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div className="online-cover-shell online-cover-fallback" aria-label="No cover">
      <i aria-hidden="true" />
      <strong>{titleGlyph}</strong>
      <span>{label}</span>
    </div>
  );
}

export function OnlineSearchPanel({
  query,
  results,
  loading,
  error,
  sourceUrl,
  importingId,
  onQueryChange,
  onSearch,
  onImport,
  onOpenExternal,
  onClose
}: {
  query: string;
  results: OnlineBookResult[];
  loading: boolean;
  error: string;
  sourceUrl: string;
  importingId: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onImport: (book: OnlineBookResult) => void;
  onBrowserImport: (book: OnlineBookResult) => void;
  onOpenExternal: (url: string) => void;
  onClose: () => void;
}) {
  const sourceName = sourceUrl.trim() ? "自定义书源" : "Project Gutenberg";

  return (
    <section className="online-panel">
      <div className="online-panel-header">
        <div>
          <p className="eyebrow">Online Source</p>
          <h2>{sourceName}</h2>
        </div>
        <button className="icon-button pressable" onClick={onClose} aria-label="关闭在线搜索">
          <X size={18} />
        </button>
      </div>
      <div className="online-search-row">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }}
            placeholder="在线搜索书名或作者"
          />
        </div>
        <button className="primary-button pressable stretch-button" disabled={loading || !query.trim()} onClick={onSearch}>
          <Search size={17} />
          <span>{loading ? "搜索中" : "搜索"}</span>
        </button>
      </div>
      {error ? <p className="online-error">{error}</p> : null}
      <div className="online-results">
        {results.map((book) => (
          <article key={`${book.source}-${book.id}`} className="online-result">
            {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <div className="online-cover-fallback">{book.format?.toUpperCase() ?? "BOOK"}</div>}
            <div>
              <h3>{book.title}</h3>
              <p>{[book.author, book.language, book.format?.toUpperCase()].filter(Boolean).join(" · ")}</p>
              {book.subjects.length ? <span>{book.subjects.slice(0, 2).join(" / ")}</span> : null}
            </div>
            <button className="soft-button pressable compact-action" disabled={Boolean(importingId)} onClick={() => onImport(book)}>
              <Download size={15} />
              <span>{importingId === book.id ? "导入中" : "导入"}</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OnlineSearchPanelV2({
  query, results, loading, error, sourceUrl, importingId,
  onQueryChange, onSearch, onImport, onBrowserImport, onOpenExternal, onClose
}: {
  query: string;
  results: OnlineBookResult[];
  loading: boolean;
  error: string;
  sourceUrl: string;
  importingId: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onImport: (book: OnlineBookResult) => void;
  onBrowserImport?: (book: OnlineBookResult) => void;
  onOpenExternal?: (url: string) => void;
  onClose: () => void;
}) {
  const sourceName = sourceUrl.trim() ? "Custom Source" : "Project Gutenberg";

  return (
    <section className="online-panel">
      <div className="online-panel-header">
        <div>
          <p className="eyebrow">Online Source</p>
          <h2>{sourceName}</h2>
        </div>
        <button className="icon-button pressable" onClick={onClose} aria-label="Close online search">
          <X size={18} />
        </button>
      </div>
      <div className="online-search-row">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }}
            placeholder="Search title or author"
          />
        </div>
        <button className="primary-button pressable stretch-button" disabled={loading || !query.trim()} onClick={onSearch}>
          <Search size={17} />
          <span>{loading ? "Searching" : "Search"}</span>
        </button>
      </div>
      {error ? <p className="online-error">{error}</p> : null}
      <div className="online-results">
        {results.map((book) => (
          <article key={`${book.source}-${book.id}`} className="online-result">
            {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <div className="online-cover-fallback">{book.format?.toUpperCase() ?? "BOOK"}</div>}
            <div>
              <h3>{book.title}</h3>
              <p>{[book.author, book.language, book.format?.toUpperCase()].filter(Boolean).join(" · ")}</p>
              {book.subjects.length ? <span>{book.subjects.slice(0, 2).join(" / ")}</span> : null}
            </div>
            <div className="online-result-actions">
              <button
                className="soft-button pressable compact-action" type="button"
                onClick={() => (onOpenExternal ?? window.readerApi.openExternal)(book.downloadUrl)}
                title="用系统浏览器打开下载链接"
              >
                <ExternalLink size={15} />
                <span>Browser</span>
              </button>
              <button className="soft-button pressable compact-action" disabled={Boolean(importingId)} onClick={() => onImport(book)}>
                <Download size={15} />
                <span>{importingId === book.id ? "Importing" : "Import"}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OnlineSearchPanelManaged({
  query, results, loading, error, sources, importingId,
  onQueryChange, onSearch, onImport, onBrowserImport, onOpenExternal, onClose
}: {
  query: string;
  results: OnlineBookResult[];
  loading: boolean;
  error: string;
  sources: OnlineSource[];
  importingId: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onImport: (book: OnlineBookResult) => void;
  onBrowserImport: (book: OnlineBookResult) => void;
  onOpenExternal: (url: string) => void;
  onClose: () => void;
}) {
  const activeSources = sources.filter((s) => s.enabled);
  const sourceName =
    activeSources.length === 0 ? "No source enabled"
    : activeSources.length === 1 ? activeSources[0].name
    : `${activeSources.length} sources enabled`;

  return (
    <section className="online-panel">
      <div className="online-panel-header">
        <div>
          <p className="eyebrow">Online Sources</p>
          <h2>{sourceName}</h2>
        </div>
        <button className="icon-button pressable" onClick={onClose} aria-label="Close online search">
          <X size={18} />
        </button>
      </div>
      <div className="online-search-row">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }}
            placeholder="Search title or author"
          />
        </div>
        <button className="primary-button pressable stretch-button" disabled={loading || !query.trim()} onClick={onSearch}>
          <Search size={17} />
          <span>{loading ? "Searching" : "Search"}</span>
        </button>
      </div>
      {activeSources.length ? <p className="online-source-summary">{activeSources.map((s) => s.name).join(" · ")}</p> : null}
      {error ? <p className="online-error">{error}</p> : null}
      <div className="online-results">
        {results.map((book) => (
          <article key={`${book.source}-${book.id}`} className="online-result">
            <OnlineResultCover book={book} />
            <div className="online-result-main">
              <h3>{book.title}</h3>
              <p>{[book.author, book.language].filter(Boolean).join(" · ")}</p>
              <div className="online-meta-row">
                {book.format ? <span className="online-meta-chip">{book.format.toUpperCase()}</span> : null}
                {book.sizeLabel ? <span className="online-meta-chip size-chip">{book.sizeLabel}</span> : null}
                <span className="online-meta-chip source-chip">{book.source}</span>
                {book.subjects.slice(0, 1).map((subject) => (
                  <span key={subject} className="online-meta-chip muted-chip">{subject}</span>
                ))}
              </div>
            </div>
            <div className="online-result-actions">
              <button
                className="soft-button pressable compact-action" type="button"
                disabled={Boolean(importingId)}
                onClick={() => onBrowserImport(book)}
                title="用系统浏览器下载，完成后自动导入"
              >
                <ExternalLink size={15} />
                <span>{importingId === `browser-${book.id}` ? "Waiting" : "Browser+"}</span>
              </button>
              <button className="soft-button pressable compact-action" disabled={Boolean(importingId)} onClick={() => onImport(book)}>
                <Download size={15} />
                <span>{importingId === book.id ? "Importing" : "Import"}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
