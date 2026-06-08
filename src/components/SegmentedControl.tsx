import type * as React from "react";
import { segmentedControlLabel, segmentedOptionA11y } from "./segmentedControlA11y";

export function SegmentedControl({
  value,
  options,
  ariaLabel,
  onChange
}: {
  value: string;
  options: [string, string][];
  ariaLabel?: string;
  onChange: (value: string) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex(([optionValue]) => optionValue === value)
  );

  return (
    <div
      className="segmented-control"
      role="radiogroup"
      aria-label={segmentedControlLabel(ariaLabel)}
      style={
        {
          "--segments": options.length,
          "--active-index": index
        } as React.CSSProperties
      }
    >
      <span className="segmented-indicator" />
      {options.map(([optionValue, label], optionIndex) => {
        const optionA11y = segmentedOptionA11y(optionValue, value, optionIndex, index);
        return (
          <button
            key={optionValue}
            className={optionValue === value ? "selected" : ""}
            type="button"
            role="radio"
            aria-checked={optionA11y.ariaChecked}
            tabIndex={optionA11y.tabIndex}
            onClick={() => onChange(optionValue)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

