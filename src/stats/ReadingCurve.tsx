import type * as React from "react";
import type { DailyReadingStat } from "../types";

interface Props {
  data: DailyReadingStat[];
}

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 120;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;
const PAD_TOP = 10;
const PAD_BOTTOM = 20; // room for x-axis labels

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReadingCurve({ data }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build lookup
  const lookup = new Map<string, number>();
  for (const stat of data) {
    lookup.set(stat.date, stat.minutes);
  }

  // Last 30 days: index 0 = 29 days ago, index 29 = today
  const days: { date: string; minutes: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = toDateStr(d);
    days.push({ date: dateStr, minutes: lookup.get(dateStr) ?? 0 });
  }

  const rawMax = Math.max(...days.map((d) => d.minutes));
  const maxVal = Math.max(rawMax, 30); // minimum scale of 30

  const chartWidth = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartHeight = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const n = days.length; // 30

  function xFor(i: number): number {
    return PAD_LEFT + (i / (n - 1)) * chartWidth;
  }

  function yFor(minutes: number): number {
    return PAD_TOP + chartHeight - (minutes / maxVal) * chartHeight;
  }

  // Build polyline points
  const points = days.map((d, i) => `${xFor(i)},${yFor(d.minutes)}`).join(" ");

  // Build filled polygon: same points + close to baseline
  const baselineY = PAD_TOP + chartHeight;
  const firstX = xFor(0);
  const lastX = xFor(n - 1);
  const polygonPoints =
    `${firstX},${baselineY} ` +
    days.map((d, i) => `${xFor(i)},${yFor(d.minutes)}`).join(" ") +
    ` ${lastX},${baselineY}`;

  // X-axis labels every 5 days: indices 0, 5, 10, 15, 20, 25
  const labelIndices = [0, 5, 10, 15, 20, 25, 29];

  return (
    <svg
      width="100%"
      height={VIEW_HEIGHT}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
      aria-label="Reading trend last 30 days"
    >
      {/* Filled area */}
      <polygon
        points={polygonPoints}
        fill="var(--md-sys-color-primary, #1565c0)"
        opacity={0.12}
      />

      {/* Line */}
      <polyline
        points={points}
        stroke="var(--md-sys-color-primary, #1565c0)"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* X-axis labels */}
      {labelIndices.map((i) => {
        const x = xFor(i);
        const label = days[i].date.slice(5); // MM-DD
        return (
          <text
            key={i}
            x={x}
            y={VIEW_HEIGHT - 4}
            fontSize="9"
            textAnchor="middle"
            fill="var(--md-sys-color-on-surface-variant, #666)"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
