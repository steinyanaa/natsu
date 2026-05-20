import type * as React from "react";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="reader-state">
      <LoadingStrip label={label} />
    </div>
  );
}

export function ErrorState({ title }: { title: string }) {
  return (
    <div className="reader-state">
      <div className="error-bubble">{title}</div>
    </div>
  );
}

export function LoadingStrip({ label }: { label: string }) {
  return (
    <div className="loading-stagger" aria-label={label}>
      {Array.from(label).map((char, index) => (
        <span key={`${char}-${index}`} style={{ "--i": index } as React.CSSProperties}>
          {char}
        </span>
      ))}
    </div>
  );
}
