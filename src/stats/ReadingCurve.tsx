import { useMemo } from "react";
import type { DailyReadingStat } from "../types";

interface Props {
  data: DailyReadingStat[];
}

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 120;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function xFor(i: number, n: number, chartWidth: number): number {
  return PAD_LEFT + (i / (n - 1)) * chartWidth;
}

function yFor(minutes: number, maxVal: number, chartHeight: number): number {
  return PAD_TOP + chartHeight - (minutes / maxVal) * chartHeight;
}

const LABEL_INDICES = [0, 5, 10, 15, 20, 25, 29];

export function ReadingCurve({ data }: Props) {
  const { points, polygonPoints, days, chartDims } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lookup = new Map<string, number>();
    for (const stat of data) {
      lookup.set(stat.date, stat.minutes);
    }

    const builtDays: { date: string; minutes: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = toDateStr(d);
      builtDays.push({ date: dateStr, minutes: lookup.get(dateStr) ?? 0 });
    }

    const rawMax = Math.max(...builtDays.map((d) => d.minutes));
    const maxVal = Math.max(rawMax, 30);
    const chartWidth = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
    const chartHeight = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM;
    const n = builtDays.length;

    const builtPoints = builtDays
      .map((d, i) => `${xFor(i, n, chartWidth)},${yFor(d.minutes, maxVal, chartHeight)}`)
      .join(" ");

    const baselineY = PAD_TOP + chartHeight;
    const firstX = xFor(0, n, chartWidth);
    const lastX = xFor(n - 1, n, chartWidth);
    const builtPolygon =
      `${firstX},${baselineY} ` +
      builtDays.map((d, i) => `${xFor(i, n, chartWidth)},${yFor(d.minutes, maxVal, chartHeight)}`).join(" ") +
      ` ${lastX},${baselineY}`;

    return {
      points: builtPoints,
      polygonPoints: builtPolygon,
      days: builtDays,
      chartDims: { chartWidth, chartHeight, n, maxVal },
    };
  }, [data]);

  return (
    <svg
      width="100%"
      height={VIEW_HEIGHT}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Reading trend last 30 days"
      style={{ display: "block" }}
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
      {LABEL_INDICES.map((i) => {
        const x = xFor(i, chartDims.n, chartDims.chartWidth);
        const label = days[i].date.slice(5);
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
