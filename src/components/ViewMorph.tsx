import { Grid3X3, List } from "lucide-react";
import { createTranslator } from "../i18n";

export function ViewMorph({
  value,
  t,
  onChange
}: {
  value: "grid" | "list";
  t: ReturnType<typeof createTranslator>;
  onChange: (value: "grid" | "list") => void;
}) {
  return (
    <div className={`view-morph ${value}`}>
      <span className="view-morph-indicator" aria-hidden="true" />
      <span className={`morph-lines ${value}`} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <button
        aria-label={t("grid")}
        aria-pressed={value === "grid"}
        className={value === "grid" ? "active" : ""}
        onClick={() => onChange("grid")}
        title={t("grid")}
        type="button"
      >
        <Grid3X3 size={18} />
      </button>
      <button
        aria-label={t("list")}
        aria-pressed={value === "list"}
        className={value === "list" ? "active" : ""}
        onClick={() => onChange("list")}
        title={t("list")}
        type="button"
      >
        <List size={18} />
      </button>
    </div>
  );
}
