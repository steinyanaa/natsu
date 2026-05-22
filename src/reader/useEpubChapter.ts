import { useEffect, useState } from "react";
import { parseEpubDocument } from "../readers/epub";
import { parseMobiDocument } from "../readers/mobi";
import { parseTxtDocument } from "../readers/text";
import type { BookRecord, ParsedTextDocument } from "../types";
import type { createTranslator } from "../i18n";

export function useEpubChapter(
  book: BookRecord,
  parser: "txt" | "mobi" | "epub",
  t: ReturnType<typeof createTranslator>,
  onLoaded: (parsed: ParsedTextDocument) => void,
  onError: (msg: string) => void
) {
  const [document, setDocument] = useState<ParsedTextDocument | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let ownedUrls: string[] = [];

    async function load() {
      setDocument(undefined);
      setError("");

      try {
        const buffer = await fetch(book.fileUrl).then((response) => response.arrayBuffer());
        const parsed =
          parser === "txt"
            ? parseTxtDocument(buffer, book.title)
            : parser === "mobi"
              ? await parseMobiDocument(buffer, book.title)
              : await parseEpubDocument(new Blob([buffer]), book.title);
        ownedUrls = parsed.objectUrls ?? [];

        if (cancelled) {
          ownedUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }

        setDocument(parsed);
        onLoaded(parsed);
      } catch {
        if (!cancelled) {
          setError(t("unsupported"));
          onError(t("unsupported"));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      ownedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // onLoaded/onError intentionally excluded — callers wrap them in useCallback with stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.fileUrl, book.title, parser, t]);

  return { document, error };
}
