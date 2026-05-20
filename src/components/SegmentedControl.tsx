import type * as React from "react";

export function SegmentedControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex(([optionValue]) => optionValue === value)
  );

  return (
    <div
      className="segmented-control"
      style={
        {
          "--segments": options.length,
          "--active-index": index
        } as React.CSSProperties
      }
    >
      <span className="segmented-indicator" />
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          className={optionValue === value ? "selected" : ""}
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

