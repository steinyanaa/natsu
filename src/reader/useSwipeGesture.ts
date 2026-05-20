import { useEffect, type RefObject } from "react";
import { editableEventTarget } from "./utils";

interface SwipeOptions {
  enabled?: boolean;
  threshold?: number;
  velocityThreshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function useSwipeGesture<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: SwipeOptions
) {
  const {
    enabled = true,
    threshold = 60,
    velocityThreshold = 0.3,
    onSwipeLeft,
    onSwipeRight
  } = options;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let active = false;
    let pointerId = -1;
    let wheelAccumX = 0;
    let wheelLastTime = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (editableEventTarget(event.target)) return;
      active = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startTime = performance.now();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!active || event.pointerId !== pointerId) return;
      active = false;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const dt = Math.max(1, performance.now() - startTime);
      const speed = Math.abs(dx) / dt;
      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.8) return;
      if (speed < velocityThreshold && Math.abs(dx) < threshold * 2) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    };

    const onPointerCancel = () => {
      active = false;
    };

    const onWheel = (event: WheelEvent) => {
      if (editableEventTarget(event.target)) return;
      // Only react to predominantly horizontal wheel (trackpad horizontal scroll).
      if (Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.2) {
        wheelAccumX = 0;
        return;
      }
      const now = performance.now();
      if (now - wheelLastTime > 300) wheelAccumX = 0;
      wheelLastTime = now;
      wheelAccumX += event.deltaX;
      if (wheelAccumX > 90) {
        wheelAccumX = 0;
        onSwipeLeft?.();
      } else if (wheelAccumX < -90) {
        wheelAccumX = 0;
        onSwipeRight?.();
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);
    el.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("wheel", onWheel);
    };
  }, [ref, enabled, threshold, velocityThreshold, onSwipeLeft, onSwipeRight]);
}
