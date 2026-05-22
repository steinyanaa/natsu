import { Flame } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { createTranslator } from "../i18n";
import { HeatmapCalendar } from "./HeatmapCalendar";
import { ReadingCurve } from "./ReadingCurve";
import { getSessionAvgCpm } from "./speedTracker";
import type { BookRecord, DailyReadingStat, GoalStats, ReaderPreferences } from "../types";

export function StatsView({
  books,
  t,
  preferences
}: {
  books: BookRecord[];
  t: ReturnType<typeof createTranslator>;
  preferences: ReaderPreferences;
}) {
  const [goalStats, setGoalStats] = useState<GoalStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyReadingStat[]>([]);
  const [sessionCpm, setSessionCpm] = useState(0);

  useEffect(() => {
    let mounted = true;
    void window.readerApi.getGoalStats().then((v) => { if (mounted) setGoalStats(v); });
    void window.readerApi.getSessionsByDate().then((v) => { if (mounted) setDailyStats(v); });
    return () => { mounted = false; };
  }, [books]);

  useEffect(() => {
    setSessionCpm(getSessionAvgCpm());
    const id = setInterval(() => setSessionCpm(getSessionAvgCpm()), 5000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let weekMinutes = 0;
    const activeDays = new Set<string>();
    const bookMap = new Map<string, { title: string; minutes: number }>();

    for (const book of books) {
      for (const session of book.readingSessions ?? []) {
        const start = new Date(session.start).getTime();
        if (start >= weekAgo) {
          const mins = (new Date(session.end).getTime() - start) / 60000;
          weekMinutes += mins;
          activeDays.add(session.start.slice(0, 10));
          const entry = bookMap.get(book.id) ?? { title: book.title, minutes: 0 };
          entry.minutes += mins;
          bookMap.set(book.id, entry);
        }
      }
    }

    const topBooks = [...bookMap.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 6);
    const maxMinutes = topBooks[0]?.minutes ?? 1;

    return { weekMinutes: Math.round(weekMinutes), activeDays: activeDays.size, topBooks, maxMinutes };
  }, [books]);

  const dailyGoal = preferences.dailyGoalMinutes ?? 30;
  const todayMins = goalStats?.todayMinutes ?? 0;
  const goalPercent = Math.min(1, todayMins / Math.max(1, dailyGoal));
  const streak = goalStats?.streak ?? 0;
  const goalReached = goalStats?.goalReachedToday ?? false;

  return (
    <section className="stats-view">
      {/* 今日目标 */}
      <div className="goal-panel">
        <div className="goal-ring-wrap">
          <svg className="goal-ring" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="23" className="goal-ring-bg" />
            <circle
              cx="28" cy="28" r="23"
              className={`goal-ring-fill${goalReached ? " reached" : ""}`}
              style={{ strokeDashoffset: `${(1 - goalPercent) * 144.51}` }}
            />
          </svg>
          <span className="goal-ring-label">{todayMins}m</span>
        </div>
        <div className="goal-text">
          <span className="goal-title">{goalReached ? t("goalReached") : t("todayProgress")}</span>
          <span className="goal-sub">{todayMins} / {dailyGoal} {t("minutesPerDay")}</span>
          {streak > 0 && (
            <span className="goal-streak">
              <Flame size={14} />
              {streak} {t("streakDays")} {t("streak")}
            </span>
          )}
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-value">{stats.weekMinutes}</span>
          <span className="stat-label">{t("totalMinutes")}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.activeDays}</span>
          <span className="stat-label">{t("activeDays")}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{streak}</span>
          <span className="stat-label">{t("streak")}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{sessionCpm > 0 ? sessionCpm : "—"}</span>
          <span className="stat-label">{t("weeklySpeed")}</span>
        </div>
      </div>
      {stats.topBooks.length > 0 ? (
        <div className="stats-chart">
          <p className="stats-section-label">{t("thisWeek")}</p>
          {stats.topBooks.map((b) => (
            <div key={b.title} className="stats-bar-row">
              <span className="stats-bar-title" title={b.title}>{b.title}</span>
              <div className="stats-bar-track">
                <div
                  className="stats-bar-fill"
                  style={{ width: `${Math.round((b.minutes / stats.maxMinutes) * 100)}%` }}
                />
              </div>
              <span className="stats-bar-value">{Math.round(b.minutes)}m</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="stats-empty">{t("noStats")}</p>
      )}
      <div className="stats-heatmap">
        <p className="stats-section-label">{t("heatmapTitle")}</p>
        <div style={{ overflowX: "auto" }}>
          <HeatmapCalendar data={dailyStats} />
        </div>
      </div>
      <div className="stats-curve">
        <p className="stats-section-label">{t("readingTrend")}</p>
        <ReadingCurve data={dailyStats} />
      </div>
    </section>
  );
}
