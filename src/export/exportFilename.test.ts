import { describe, expect, it } from "vitest";
import { readerNotesExportFileName } from "./exportFilename";

describe("readerNotesExportFileName", () => {
  it("removes Windows-illegal filename characters", () => {
    expect(readerNotesExportFileName('A/B:C*D?"E<>F|G', "markdown")).toBe("A_B_C_D__E__F_G-notes.md");
  });

  it("uses a stable fallback for empty titles", () => {
    expect(readerNotesExportFileName("   ", "anki")).toBe("natsu-notes-anki.tsv");
  });
});
