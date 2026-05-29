import { FolderPlus } from "lucide-react";
import type { createTranslator } from "../i18n";

export function EmptyShelf({
  t,
  onImport,
  recent
}: {
  t: ReturnType<typeof createTranslator>;
  onImport: () => void;
  recent?: boolean;
}) {
  return (
    <section className="empty-shelf">
      <div className="summer-orbit" aria-hidden="true">
        <span />
        <i />
      </div>
      <h2>{recent ? t("recent") : t("emptyTitle")}</h2>
      <p>{recent ? t("noRecent") : t("emptyBody")}</p>
      {!recent ? (
        <button className="primary-button pressable stretch-button" onClick={onImport}>
          <FolderPlus size={18} />
          <span>{t("import")}</span>
        </button>
      ) : null}
    </section>
  );
}
