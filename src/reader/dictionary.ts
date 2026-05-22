export interface DictionaryEntry {
  word: string;
  pinyin: string;
  definitions: string[];
}

type DictEntry = { pinyin: string; definitions: string[] };
type DictMap = Record<string, DictEntry[]>;

let dictCache: DictMap | null = null;
let loadPromise: Promise<DictMap | null> | null = null;

async function loadDict(): Promise<DictMap | null> {
  if (dictCache) return dictCache;
  if (loadPromise) return loadPromise;

  loadPromise = fetch("/dictionaries/cedict-mini.json")
    .then((res) => res.json() as Promise<DictMap>)
    .then((data) => {
      dictCache = data;
      return data;
    })
    .catch(() => {
      loadPromise = null;
      return null;
    });

  return loadPromise;
}

export async function lookupWord(query: string): Promise<DictionaryEntry[]> {
  const trimmed = query.trim().slice(0, 8); // limit lookup length
  if (!trimmed) return [];

  const dict = await loadDict();
  if (!dict) return [];

  const results: DictionaryEntry[] = [];

  // Exact match
  const exact = dict[trimmed];
  if (exact) {
    results.push(...exact.map((e) => ({ word: trimmed, pinyin: e.pinyin, definitions: e.definitions })));
  }

  // If no exact match or query is longer than 1 char, try substrings (longest first)
  if (results.length === 0 && trimmed.length > 1) {
    for (let len = Math.min(trimmed.length, 4); len >= 1; len--) {
      const sub = trimmed.slice(0, len);
      const found = dict[sub];
      if (found) {
        results.push(...found.map((e) => ({ word: sub, pinyin: e.pinyin, definitions: e.definitions })));
        break;
      }
    }
  }

  return results.slice(0, 5);
}
