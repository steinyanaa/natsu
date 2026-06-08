import { useCallback, useEffect, useRef, useState } from "react";

export type AutoScrollAxis = "x" | "y";

export interface AutoScrollTarget {
  scrollLeft: number;
  scrollTop: number;
}

export function advanceScroll(
  acc: number,
  speedPxPerSec: number,
  dtSeconds: number
): { whole: number; remainder: number } {
  const total = acc + speedPxPerSec * dtSeconds;
  const whole = Math.floor(total);
  return { whole, remainder: total - whole };
}

export function resolveAutoScrollAxis(scroller: Pick<HTMLElement, "classList">): AutoScrollAxis {
  return scroller.classList.contains("text-reader") && scroller.classList.contains("paged") ? "x" : "y";
}

export function applyAutoScrollStep(
  scroller: AutoScrollTarget,
  whole: number,
  axis: AutoScrollAxis
): boolean {
  if (whole < 1) {
    return true;
  }

  if (axis === "x") {
    const before = scroller.scrollLeft;
    scroller.scrollLeft = before + whole;
    return scroller.scrollLeft !== before;
  }

  const before = scroller.scrollTop;
  scroller.scrollTop = before + whole;
  return scroller.scrollTop !== before;
}

export function isAutoScrollInterruptEvent(type: string): boolean {
  return type === "wheel" || type === "keydown" || type === "pointerdown" || type === "touchstart";
}

export function useAutoScroll(
  getScroller: () => HTMLElement | undefined,
  speedPxPerSec: number
) {
  const [running, setRunning] = useState(false);
  const speedRef = useRef(speedPxPerSec);
  speedRef.current = speedPxPerSec;

  const toggle = useCallback(() => setRunning((value) => !value), []);
  const stop = useCallback(() => setRunning(false), []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = 0;
    let acc = 0;
    const step = (timestamp: number) => {
      const scroller = getScroller();
      if (!scroller) { last = timestamp; raf = requestAnimationFrame(step); return; }
      if (!last) last = timestamp;
      const dt = (timestamp - last) / 1000;
      last = timestamp;
      const { whole, remainder } = advanceScroll(acc, speedRef.current, dt);
      acc = remainder;
      if (whole >= 1) {
        if (!applyAutoScrollStep(scroller, whole, resolveAutoScrollAxis(scroller))) {
          setRunning(false);
          return;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const stopOnUserInput = (event: Event) => {
      if (isAutoScrollInterruptEvent(event.type)) {
        setRunning(false);
      }
    };
    window.addEventListener("wheel", stopOnUserInput, { passive: true });
    window.addEventListener("keydown", stopOnUserInput);
    window.addEventListener("pointerdown", stopOnUserInput, { passive: true });
    window.addEventListener("touchstart", stopOnUserInput, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stopOnUserInput);
      window.removeEventListener("keydown", stopOnUserInput);
      window.removeEventListener("pointerdown", stopOnUserInput);
      window.removeEventListener("touchstart", stopOnUserInput);
    };
  }, [running, getScroller]);

  return { running, toggle, stop };
}
