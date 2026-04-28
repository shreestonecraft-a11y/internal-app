import { useRef, useCallback, useState, useEffect } from 'react';

/**
 * Press-and-hold counter.
 * - On press: starts ticking, calls `onTickPreview(count)` each tick (optional, for UI).
 * - On release: calls `onCommit(total)` once with the final tick count.
 * - First tick fires immediately. After `initialDelay` ms it accelerates.
 *
 * Use this for +/- buttons that should commit one network call after the user stops holding.
 */
export function useHoldToRepeat(
  onCommit: (count: number) => void,
  onTickPreview?: (count: number) => void,
  opts?: { initialDelay?: number; interval?: number }
) {
  const initialDelay = opts?.initialDelay ?? 360;
  const interval = opts?.interval ?? 80;
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const [isHolding, setIsHolding] = useState(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (intervalRef.current !== null) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    if (countRef.current > 0) {
      onCommit(countRef.current);
    }
    countRef.current = 0;
    setIsHolding(false);
  }, [clearTimers, onCommit]);

  const start = useCallback(() => {
    clearTimers();
    countRef.current = 1;
    onTickPreview?.(1);
    setIsHolding(true);
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        countRef.current += 1;
        onTickPreview?.(countRef.current);
      }, interval);
    }, initialDelay);
  }, [clearTimers, onTickPreview, initialDelay, interval]);

  // Cleanup on unmount
  useEffect(() => clearTimers, [clearTimers]);

  return {
    isHolding,
    handlers: {
      onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); start(); },
      onMouseUp: stop,
      onMouseLeave: stop,
      onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); start(); },
      onTouchEnd: stop,
      onTouchCancel: stop,
    },
  };
}
