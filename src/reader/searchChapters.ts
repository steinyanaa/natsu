export interface SearchableChapter {
  id: string;
  title?: string;
  plainText?: string;
}

export interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  snippet: string;
  matchOffset: number;
  matchLength: number;
}

export interface SearchChapterOptions {
  maxResults?: number;
  maxPerChapter?: number;
  contextChars?: number;
}

export function searchChapters(
  chapters: SearchableChapter[],
  query: string,
  options: SearchChapterOptions = {}
): SearchResult[] {
  const normalizedQuery = query.normalize("NFKC").trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const maxResults = options.maxResults ?? 60;
  const maxPerChapter = options.maxPerChapter ?? 3;
  const contextChars = options.contextChars ?? 60;
  const found: SearchResult[] = [];

  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
    const chapter = chapters[chapterIndex];
    const text = (chapter.plainText || "").normalize("NFKC");
    const searchText = text.toLowerCase();
    let pos = 0;
    let count = 0;

    while (count < maxPerChapter && found.length < maxResults) {
      const idx = searchText.indexOf(normalizedQuery, pos);
      if (idx < 0) {
        break;
      }

      const start = Math.max(0, idx - contextChars);
      const end = Math.min(text.length, idx + normalizedQuery.length + contextChars);
      found.push({
        chapterId: chapter.id,
        chapterTitle: chapter.title || `第 ${chapterIndex + 1} 章`,
        chapterIndex,
        snippet: text.slice(start, end),
        matchOffset: idx - start,
        matchLength: normalizedQuery.length
      });

      pos = idx + normalizedQuery.length;
      count++;
    }

    if (found.length >= maxResults) {
      break;
    }
  }

  return found;
}

export function createSearchWorkerCode(): string {
  return `
    const searchChapters = ${searchChapters.toString()};
    self.onmessage = function(e) {
      const { query, chapters, id } = e.data;
      self.postMessage({ id, results: searchChapters(chapters, query) });
    };
  `;
}
