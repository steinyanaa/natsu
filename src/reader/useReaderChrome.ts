import { useCallback, useEffect, useRef, useState } from "react";
import { resolveReaderChromeDelay } from "./pageTurnDistance";

/**
 * Auto-hiding reader chrome (top/bottom controls) and cursor.
 *
 * `revealChrome` shows the controls and schedules them to fade after 2.4s of
 * inactivity; `hideChrome` hides them immediately. While the side panel is open
 * the chrome is pinned visible. The cursor hides 1.6s after the chrome does.
 */
export function useReaderChrome(readerPanelOpen: boolean, hideDelayMs?: number) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [cursorHidden, setCursorHidden] = useState(false);
  const chromeTimer = useRef<number | undefined>(undefined);
  const cursorTimer = useRef<number | undefined>(undefined);
  const chromeDelay = resolveReaderChromeDelay(hideDelayMs);

  const revealChrome = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(chromeTimer.current);

    if (!readerPanelOpen) {
      chromeTimer.current = window.setTimeout(() => setControlsVisible(false), chromeDelay);
    }
  }, [chromeDelay, readerPanelOpen]);

  const hideChrome = useCallback(() => {
    if (readerPanelOpen) {
      return;
    }

    window.clearTimeout(chromeTimer.current);
    setControlsVisible(false);
  }, [readerPanelOpen]);

  useEffect(() => {
    revealChrome();

    return () => window.clearTimeout(chromeTimer.current);
  }, [revealChrome]);

  useEffect(() => {
    window.clearTimeout(cursorTimer.current);
    if (controlsVisible) {
      setCursorHidden(false);
    } else {
      cursorTimer.current = window.setTimeout(() => {
        setCursorHidden(true);
      }, 1600);
    }

    return () => window.clearTimeout(cursorTimer.current);
  }, [controlsVisible]);

  return { controlsVisible, cursorHidden, revealChrome, hideChrome };
}
