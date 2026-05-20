import type * as React from "react";
import type { TocItem } from "../types";

export function TocTree({
  items,
  onJump,
  depth = 0
}: {
  items: TocItem[];
  onJump: (targetId: string) => void;
  depth?: number;
}) {
  return (
    <div className="toc-tree" style={{ "--toc-depth": depth } as React.CSSProperties}>
      {items.map((item) => (
        <div key={`${item.id}-${item.label}`} className="toc-node">
          <a
            href={`#${item.id}`}
            onClick={(event) => {
              event.preventDefault();
              onJump(item.id);
            }}
          >
            {item.label}
          </a>
          {item.children?.length ? <TocTree items={item.children} onJump={onJump} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  );
}
