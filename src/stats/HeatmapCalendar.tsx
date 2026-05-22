import { useMemo } from "react";
import type { DailyReadingStat } from "../types";

interface Props {
  data: DailyReadingStat[];
}

const CELL = 12;
const GAP = 2;
const STEP = CELL + GAP; // 14
const COLS = 52;
const ROWS = 7;
const LABEL_HEIGHT = 18;
const SVG_WIDTH = COLS * STEP;
const SVG_HEIGHT = ROWS * STEP + LABEL_HEIGHT;

function colorForMinutes(minutes: number): { fill: string; opacity: number } {
  if (minutes === 0) {
    return { fill: "var(--md-sys-color-surface-container, #e0e0e0)", opacity: 1 };
  } else if (minutes <= 15) {
    return { fill: "var(--md-sys-color-primary, #1565c0)", opacity: 0.25 };
  } else if (minutes <= 45) {
    return { fill: "var(--md-sys-color-primary, #1565c0)", opacity: 0.55 };
  } else {
    return { fill: "var(--md-sys-color-primary, #1565c0)", opacity: 0.90 };
  }
}

const MONTH_ABBR = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Cell = {
  col: number;
  row: number;
  date: string;
  minutes: number;
};

export function HeatmapCalendar({ data }: Props) {
  const { cells, monthLabels } = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const stat of data) {
      lookup.set(stat.date, stat.minutes);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const builtCells: Cell[] = [];
    const colMonth: (number | null)[] = new Array(COLS).fill(null);

    for (let dayIndex = 0; dayIndex < 364; dayIndex++) {
      const d = new Date(today);
      d.setDate(today.getDate() - dayIndex);

      const row = d.getDay(); // 0=Sun
      const col = COLS - 1 - Math.floor(dayIndex / 7);
      const dateStr = toDateStr(d);
      const minutes = lookup.get(dateStr) ?? 0;

      builtCells.push({ col, row, date: dateStr, minutes });

      if (colMonth[col] === null) {
        colMonth[col] = d.getMonth();
      }
    }

    const builtLabels: { col: number; label: string }[] = [];
    for (let c = 1; c < COLS; c++) {
      if (colMonth[c] !== null && colMonth[c - 1] !== null && colMonth[c] !== colMonth[c - 1]) {
        builtLabels.push({ col: c, label: MONTH_ABBR[colMonth[c] as number] });
      }
    }
    if (colMonth[0] !== null) {
      builtLabels.unshift({ col: 0, label: MONTH_ABBR[colMonth[0] as number] });
    }

    return { cells: builtCells, monthLabels: builtLabels };
  }, [data]);

  return (
    <svg
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      role="img"
      aria-label="Reading heatmap calendar"
      style={{ display: "block" }}
    >
      {/* Month labels */}
      {monthLabels.map(({ col, label }) => (
        <text
          key={`month-${col}`}
          x={col * STEP}
          y={LABEL_HEIGHT - 4}
          fontSize="9"
          fill="var(--md-sys-color-on-surface-variant, #666)"
        >
          {label}
        </text>
      ))}

      {/* Cells */}
      {cells.map(({ col, row, date, minutes }) => {
        const { fill, opacity } = colorForMinutes(minutes);
        const x = col * STEP;
        const y = LABEL_HEIGHT + row * STEP;
        return (
          <g key={date}>
            <rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx="2"
              fill={fill}
              opacity={opacity}
            >
              <title>{date} · 读了 {minutes} 分钟</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
