import Store from "electron-store";
import type { ReadingSession } from "../ipc/types.js";

export interface SessionStoreShape {
  sessions: Record<string, ReadingSession[]>;
}

export const SESSION_CAP = 500;

let sessionStoreInstance: Store<SessionStoreShape> | undefined;

export function initSessionStore(): Store<SessionStoreShape> {
  if (sessionStoreInstance) return sessionStoreInstance;
  sessionStoreInstance = new Store<SessionStoreShape>({
    name: "natsu-sessions",
    defaults: {
      sessions: {}
    }
  });
  return sessionStoreInstance;
}

export function getSessionStore(): Store<SessionStoreShape> {
  if (!sessionStoreInstance) {
    throw new Error("Session store not initialized. Call initSessionStore() in app.whenReady() first.");
  }
  return sessionStoreInstance;
}

/**
 * Pure helper: merge two session lists, de-duplicate, and cap to the most recent
 * SESSION_CAP entries. Dedup key is `start|end` when both are present; sessions
 * missing either timestamp are always kept (they cannot be reliably compared).
 * Order is preserved (existing first, then incoming), then the tail is capped so
 * the newest sessions win.
 */
export function mergeSessions(
  existing: ReadingSession[],
  incoming: ReadingSession[],
  cap = SESSION_CAP
): ReadingSession[] {
  const seen = new Set<string>();
  const out: ReadingSession[] = [];

  for (const session of [...existing, ...incoming]) {
    if (!session) continue;
    if (session.start && session.end) {
      const key = `${session.start}|${session.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(session);
  }

  return out.slice(-cap);
}

export function getSessions(bookId: string): ReadingSession[] {
  const all = getSessionStore().get("sessions", {});
  return all[bookId] ?? [];
}

export function getAllSessions(): Map<string, ReadingSession[]> {
  const all = getSessionStore().get("sessions", {});
  return new Map(Object.entries(all));
}

export function setSessions(bookId: string, list: ReadingSession[]): void {
  const all = getSessionStore().get("sessions", {});
  all[bookId] = list.slice(-SESSION_CAP);
  getSessionStore().set("sessions", all);
}

export function appendSession(bookId: string, session: ReadingSession): ReadingSession[] {
  const next = mergeSessions(getSessions(bookId), [session]);
  setSessions(bookId, next);
  return next;
}

export function deleteSessions(bookId: string): void {
  const all = getSessionStore().get("sessions", {});
  if (bookId in all) {
    delete all[bookId];
    getSessionStore().set("sessions", all);
  }
}
