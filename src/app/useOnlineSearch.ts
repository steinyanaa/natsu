import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { BookRecord, OnlineBookResult, OnlineSource, ReaderPreferences } from "../types";

function enabledOnlineSources(preferences: ReaderPreferences): OnlineSource[] {
  return preferences.onlineSources.filter((source) => source.enabled);
}

interface UseOnlineSearchArgs {
  preferences: ReaderPreferences;
  /** Current shelf search text, used as the default online query. */
  query: string;
  setBooks: Dispatch<SetStateAction<BookRecord[]>>;
}

/**
 * Online book search + import. Owns the panel's open/query/results/loading/error
 * state and the three import paths (direct download, browser fallback, search).
 * Imported books are prepended to the shelf via `setBooks`.
 */
export function useOnlineSearch({ preferences, query, setBooks }: UseOnlineSearchArgs) {
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [onlineQuery, setOnlineQuery] = useState("");
  const [onlineResults, setOnlineResults] = useState<OnlineBookResult[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [onlineImportingId, setOnlineImportingId] = useState("");

  const importOnlineResult = useCallback(
    async (result: OnlineBookResult) => {
      setOnlineImportingId(result.id);
      setOnlineError("");

      try {
        const imported = await window.readerApi.importOnlineBook(result);
        if (imported) {
          setBooks((current) => [imported, ...current.filter((book) => book.id !== imported.id)]);
          setOnlineOpen(false);
        } else {
          setOnlineError("这个结果没有可导入的 EPUB/TXT/MOBI/PDF 直链");
        }
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : "导入失败，请确认书源返回的是可直接下载的文件链接");
      } finally {
        setOnlineImportingId("");
      }
    },
    [setBooks]
  );

  const browserDownloadAndImport = useCallback(
    async (result: OnlineBookResult) => {
      setOnlineImportingId(`browser-${result.id}`);
      setOnlineError("已打开浏览器下载，等待下载完成后自动导入...");

      try {
        const imported = await window.readerApi.openExternalAndAutoImport(result);
        if (imported) {
          setBooks((current) => [imported, ...current.filter((book) => book.id !== imported.id)]);
          setOnlineOpen(false);
          setOnlineError("");
        }
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : "浏览器下载后自动导入失败，请手动导入下载文件。");
      } finally {
        setOnlineImportingId("");
      }
    },
    [setBooks]
  );

  const runOnlineSearch = useCallback(async () => {
    const searchText = (onlineQuery || query).trim();
    const activeSources = enabledOnlineSources(preferences);

    if (!searchText) {
      return;
    }

    if (!activeSources.length) {
      setOnlineOpen(true);
      setOnlineResults([]);
      setOnlineError("Enable at least one online source in Settings.");
      return;
    }

    setOnlineOpen(true);
    setOnlineLoading(true);
    setOnlineError("");

    try {
      const results = await window.readerApi.searchOnlineBooks(searchText);
      setOnlineResults(results);
      if (!results.length) {
        setOnlineError("No importable results from enabled sources.");
      }
    } catch {
      setOnlineResults([]);
      setOnlineError("Online sources are temporarily unavailable.");
    } finally {
      setOnlineLoading(false);
    }
  }, [onlineQuery, preferences, query]);

  return {
    onlineOpen, setOnlineOpen,
    onlineQuery, setOnlineQuery,
    onlineResults,
    onlineLoading,
    onlineError,
    onlineImportingId,
    importOnlineResult,
    browserDownloadAndImport,
    runOnlineSearch
  };
}
