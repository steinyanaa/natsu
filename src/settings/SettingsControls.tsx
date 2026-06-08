import { toggleSettingAriaLabel } from "./settingsControlA11y";

export function ChoiceList({
  value,
  options,
  onChange
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="choice-list">
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          className={optionValue === value ? "active" : ""}
          type="button"
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ToggleSetting({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="toggle-setting">
      <span>{label}</span>
      <button
        className={`toggle-switch ${checked ? "checked" : ""}`}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={toggleSettingAriaLabel(label, checked)}
        title={toggleSettingAriaLabel(label, checked)}
        onClick={() => onChange(!checked)}
      >
        <i className="toggle-thumb" />
      </button>
    </div>
  );
}

export function TextSetting({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  if (placeholder === "https://example.com/search?q={query}") {
    return null;
  }

  return (
    <label className="text-setting">
      <span>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function CodeTextSetting({
  label,
  value,
  placeholder,
  help,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  help?: string;
  onChange: (value: string) => void;
}) {
  if (label === "Online source adapter") {
    return null;
  }

  return (
    <label className="text-setting code-text-setting">
      <span>{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={10}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <pre className="source-config-help">{help}</pre> : null}
    </label>
  );
}

export function ColorSetting({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-setting">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function RangeSetting({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled = false,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`range-setting ${disabled ? "disabled" : ""}`}>
      <span>
        {label}
        <strong>
          {value}
          {unit}
        </strong>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

