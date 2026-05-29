import type * as React from "react";
import { useState } from "react";
import type { createTranslator } from "../i18n";
import type { BookRecord } from "../types";

export function EditMetaDialog({
  book,
  t,
  onSave,
  onCancel
}: {
  book: BookRecord;
  t: ReturnType<typeof createTranslator>;
  onSave: (patch: { title?: string; author?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title: title.trim() || book.title, author: author.trim() });
  };

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <form className="dialog-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>{t("editMetadata")}</h3>
        <label className="meta-field">
          <span>{t("titleLabel")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="meta-field">
          <span>{t("authorLabel")}</span>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="soft-button pressable" onClick={onCancel}>{t("cancel")}</button>
          <button type="submit" className="primary-button pressable">{t("saveChanges")}</button>
        </div>
      </form>
    </div>
  );
}
