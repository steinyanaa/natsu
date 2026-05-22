import { useEffect } from "react";
import type * as React from "react";

interface OpenBookTransitionProps {
  rect: DOMRect;
  onDone: () => void;
}

export function OpenBookTransition({ rect, onDone }: OpenBookTransitionProps) {
  useEffect(() => {
    const id = setTimeout(onDone, 450);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      className="open-book-transition"
      aria-hidden="true"
      style={{
        "--start-left": `${rect.left}px`,
        "--start-top": `${rect.top}px`,
        "--start-width": `${rect.width}px`,
        "--start-height": `${rect.height}px`,
      } as React.CSSProperties}
    />
  );
}
