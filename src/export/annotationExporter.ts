import type { BookRecord, Highlight } from "../types";

export function exportMarkdown(book: BookRecord): string {
  const highlights = book.highlights ?? [];
  const header = `# ${book.title} — 笔记导出\n`;

  if (highlights.length === 0) {
    return `${header}\n暂无高亮笔记。`;
  }

  // Group by chapterId, sorted by createdAt ascending
  const sorted = [...highlights].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const grouped = new Map<string, Highlight[]>();
  for (const h of sorted) {
    const list = grouped.get(h.chapterId) ?? [];
    list.push(h);
    grouped.set(h.chapterId, list);
  }

  const sections: string[] = [header];
  for (const [chapterId, items] of grouped) {
    sections.push(`\n## ${chapterId}\n`);
    for (let i = 0; i < items.length; i++) {
      const h = items[i];
      sections.push(`> ${h.selectedText}\n`);
      if (h.note) {
        sections.push(`\n*${h.note}*\n`);
      }
      if (i < items.length - 1) {
        sections.push("\n---\n");
      }
    }
  }

  return sections.join("");
}

export function exportAnkiTsv(book: BookRecord): string {
  const highlights = book.highlights ?? [];
  const rows: string[] = [];

  for (const h of highlights) {
    if (!h.selectedText) continue;
    const front = h.selectedText;
    const back = (h.note ?? "") + `\n——《${book.title}》`;
    rows.push(`${front}\t${back}`);
  }

  return rows.join("\n");
}
