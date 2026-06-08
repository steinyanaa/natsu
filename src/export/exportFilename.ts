export type NotesExportFormat = "markdown" | "anki";

export function safeExportBaseName(title: string): string {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_").trim().replace(/^[.\s]+|[.\s]+$/g, "");
  return safeTitle || "natsu-notes";
}

export function readerNotesExportFileName(title: string, format: NotesExportFormat): string {
  const safeTitle = safeExportBaseName(title);
  return format === "markdown" ? `${safeTitle}-notes.md` : `${safeTitle}-anki.tsv`;
}
