import { createTranslator } from "../i18n";
import { Suspense, lazy } from "react";
import type { BookRecord, Highlight, ParsedTextDocument, ReaderPreferences, ReaderProgress, TocItem } from "../types";
import { ErrorState, LoadingState } from "./ReaderState";
import { TextPane } from "./TextPane";
import type { AnchorJumpRequest, JumpRequest } from "./types";
import { loadComicPane, loadPdfPane } from "./preloadPanes";

const comicFormats = ["cbz", "zip", "cbr", "rar"] as const;
const PdfPane = lazy(() => loadPdfPane().then((module) => ({ default: module.PdfPane })));
const ComicPane = lazy(() => loadComicPane().then((module) => ({ default: module.ComicPane })));

function isComic(format: BookRecord["format"]): boolean {
  return comicFormats.includes(format as (typeof comicFormats)[number]);
}

export function ReaderStage({
  book,
  preferences,
  t,
  jumpRequest,
  anchorJumpRequest,
  onProgress,
  onToc,
  onChapterInfo,
  onChapters,
  highlights,
  onHighlightSave,
  onHighlightRemove,
}: {
  book: BookRecord;
  preferences: ReaderPreferences;
  t: ReturnType<typeof createTranslator>;
  jumpRequest?: JumpRequest;
  anchorJumpRequest?: AnchorJumpRequest;
  onProgress: (progress: ReaderProgress) => void;
  onToc: (toc: TocItem[]) => void;
  onChapterInfo?: (charCount: number, chapterPercent: number) => void;
  onChapters?: (chapters: ParsedTextDocument["chapters"]) => void;
  highlights?: Highlight[];
  onHighlightSave?: (highlight: Highlight) => void;
  onHighlightRemove?: (highlightIds: string[]) => void;
}) {
  if (book.format === "txt") {
    return (
      <TextPane
        book={book}
        preferences={preferences}
        t={t}
        parser="txt"
        jumpRequest={jumpRequest}
        anchorJumpRequest={anchorJumpRequest}
        onProgress={onProgress}
        onToc={onToc}
        onChapterInfo={onChapterInfo}
        onChapters={onChapters}
        highlights={highlights}
        onHighlightSave={onHighlightSave}
        onHighlightRemove={onHighlightRemove}
      />
    );
  }

  if (book.format === "mobi" || book.format === "azw3") {
    return (
      <TextPane
        book={book}
        preferences={preferences}
        t={t}
        parser="mobi"
        jumpRequest={jumpRequest}
        anchorJumpRequest={anchorJumpRequest}
        onProgress={onProgress}
        onToc={onToc}
        onChapterInfo={onChapterInfo}
        onChapters={onChapters}
        highlights={highlights}
        onHighlightSave={onHighlightSave}
        onHighlightRemove={onHighlightRemove}
      />
    );
  }

  if (book.format === "epub") {
    return (
      <TextPane
        book={book}
        preferences={preferences}
        t={t}
        parser="epub"
        jumpRequest={jumpRequest}
        anchorJumpRequest={anchorJumpRequest}
        onProgress={onProgress}
        onToc={onToc}
        onChapterInfo={onChapterInfo}
        onChapters={onChapters}
        highlights={highlights}
        onHighlightSave={onHighlightSave}
        onHighlightRemove={onHighlightRemove}
      />
    );
  }

  if (book.format === "pdf") {
    return (
      <Suspense fallback={<LoadingState label={t("loading")} />}>
        <PdfPane book={book} t={t} jumpRequest={jumpRequest} onProgress={onProgress} />
      </Suspense>
    );
  }

  if (isComic(book.format)) {
    return (
      <Suspense fallback={<LoadingState label={t("loading")} />}>
        <ComicPane book={book} t={t} jumpRequest={jumpRequest} onProgress={onProgress} />
      </Suspense>
    );
  }

  return <ErrorState title={t("unsupported")} />;
}
