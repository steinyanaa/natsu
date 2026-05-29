import { useCallback, useEffect, useRef, useState } from "react";

export function advanceScroll(
  acc: number,
  speedPxPerSec: number,
  dtSeconds: number
): { whole: number; remainder: number } {
  const total = acc + speedPxPerSec * dtSeconds;
  const whole = Math.floor(total);
  return { whole, remainder: total - whole };
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
        const before = scroller.scrollTop;
        scroller.scrollTop = before + whole;
        if (scroller.scrollTop === before) { setRunning(false); return; }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const onWheel = () => setRunning(false);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
    };
  }, [running, getScroller]);

  return { running, toggle, stop };
}
