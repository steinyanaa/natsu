import { useCallback, useEffect, useRef, useState } from "react";
import type { WellnessPreferences } from "../types";

export interface ReadingSessionState {
  pomodoroAlert: boolean;         // true when it's time to remind
  sessionMinutes: number;
  dismissPomodoroAlert: () => void;
}

export function useReadingSession(wellness: WellnessPreferences | undefined): ReadingSessionState {
  const startRef = useRef(Date.now());
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [pomodoroAlert, setPomodoroAlert] = useState(false);
  const alertFiredRef = useRef(false);

  const pomodoroEnabled = wellness?.pomodoroEnabled ?? true;
  const pomodoroMinutes = wellness?.pomodoroMinutes ?? 25;

  useEffect(() => {
    startRef.current = Date.now();
    alertFiredRef.current = false;
    setPomodoroAlert(false);
    setSessionMinutes(0);
  }, []); // reset on mount (new reading session)

  useEffect(() => {
    const id = setInterval(() => {
      const mins = Math.floor((Date.now() - startRef.current) / 60_000);
      setSessionMinutes(mins);
      if (pomodoroEnabled && !alertFiredRef.current && mins >= pomodoroMinutes) {
        alertFiredRef.current = true;
        setPomodoroAlert(true);
      }
    }, 30_000); // check every 30 seconds
    return () => clearInterval(id);
  }, [pomodoroEnabled, pomodoroMinutes]);

  const dismissPomodoroAlert = useCallback(() => {
    setPomodoroAlert(false);
  }, []);

  return { pomodoroAlert, sessionMinutes, dismissPomodoroAlert };
}
