import { useEffect, useRef, useState, type RefObject } from "react";
import { shouldSubmitTextInputDialog } from "./textInputDialogKeys";

export function TextInputDialog({
  title,
  body,
  initialValue = "",
  placeholder,
  confirmLabel,
  cancelLabel,
  multiline,
  onConfirm,
  onCancel
}: {
  title: string;
  body?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  multiline?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const submit = () => onConfirm(value);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <form
        className="dialog-card text-input-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h3>{title}</h3>
        {body ? <p>{body}</p> : null}
        {multiline ? (
          <textarea
            ref={inputRef as RefObject<HTMLTextAreaElement>}
            className="dialog-text-input multiline"
            value={value}
            placeholder={placeholder}
            rows={5}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (shouldSubmitTextInputDialog({
                key: event.key,
                multiline: true,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey
              })) {
                event.preventDefault();
                submit();
              }
            }}
          />
        ) : (
          <input
            ref={inputRef as RefObject<HTMLInputElement>}
            className="dialog-text-input"
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        )}
        <div className="dialog-actions">
          <button className="soft-button pressable" type="button" onClick={onCancel}>{cancelLabel}</button>
          <button className="primary-button pressable" type="submit">{confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}
