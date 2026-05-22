import type * as React from "react";
import { X } from "lucide-react";
import type { BookRecord, GoalStats } from "../types";

interface DailySummaryCardProps {
  book: BookRecord;
  sessionMinutes: number;
  goalStats?: GoalStats | null;
  onClose: () => void;
}

export function DailySummaryCard({ book, sessionMinutes, goalStats, onClose }: DailySummaryCardProps) {
  const percent = Math.round((book.progress?.percent ?? 0) * 100);
  const streak = goalStats?.streak ?? 0;
  const todayMins = goalStats?.todayMinutes ?? sessionMinutes;

  return (
    <div className="daily-summary-backdrop" onClick={onClose}>
      <div className="daily-summary-card" onClick={(e) => e.stopPropagation()}>
        <button className="daily-summary-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
        <div className="daily-summary-title">📖 今日阅读</div>
        <div className="daily-summary-stats">
          <div className="daily-stat">
            <span className="daily-stat-value">{todayMins}</span>
            <span className="daily-stat-label">分钟</span>
          </div>
          <div className="daily-stat">
            <span className="daily-stat-value">{percent}%</span>
            <span className="daily-stat-label">本书进度</span>
          </div>
          {streak > 0 && (
            <div className="daily-stat">
              <span className="daily-stat-value">{streak}</span>
              <span className="daily-stat-label">天连续</span>
            </div>
          )}
        </div>
        <div className="daily-summary-book">{book.title}</div>
      </div>
    </div>
  );
}
