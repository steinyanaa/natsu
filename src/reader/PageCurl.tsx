import { useEffect } from "react";
import type * as React from "react";

interface PageCurlProps {
  direction: 1 | -1;   // 1 = forward (right edge curls), -1 = backward (left edge curls)
  onDone: () => void;
}

export function PageCurl({ direction, onDone }: PageCurlProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 600);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className={`page-curl-overlay ${direction > 0 ? "curl-forward" : "curl-backward"}`}
      aria-hidden="true"
    />
  );
}
