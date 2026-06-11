import { useEffect, useRef, useState } from "react";

/**
 * A small "12 / 240" pill that surfaces briefly whenever the page changes,
 * then fades out — the page-position feedback a scrubber percentage can't give
 * at a glance. Purely presentational: the parent feeds the current page.
 */
export function PageHud({
  current,
  total,
  holdMs = 1100
}: {
  /** 1-based current page. */
  current: number;
  /** Total page count. */
  total: number;
  holdMs?: number;
}) {
  const [visible, setVisible] = useState(false);
  const firstRef = useRef(true);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Don't flash on the very first mount — only on genuine page changes.
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    setVisible(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisible(false), holdMs);
    return () => window.clearTimeout(timerRef.current);
  }, [current, holdMs]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  if (total <= 0) return null;

  return (
    <div className={`page-hud${visible ? " visible" : ""}`} aria-hidden={!visible}>
      <span className="page-hud-current">{current}</span>
      <span className="page-hud-sep">/</span>
      <span className="page-hud-total">{total}</span>
    </div>
  );
}
