import { useEffect, useRef, useState, useCallback } from "react";

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "touchmove",
  "scroll",
  "wheel",
];

/**
 * Detects user inactivity.
 *
 * Returns `isIdle` (true when the user has been inactive for `timeoutMs`) and
 * `resetIdle` so callers can manually wake the screen.
 *
 * @param timeoutMs - Inactivity timeout in milliseconds (default: 5 minutes)
 */
export function useInactivity(timeoutMs = 5 * 60 * 1000) {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdle = useCallback(() => {
    setIsIdle(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsIdle(true), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    // Start the timer immediately
    timerRef.current = setTimeout(() => setIsIdle(true), timeoutMs);

    ACTIVITY_EVENTS.forEach((evt) =>
      document.addEventListener(evt, resetIdle, { passive: true }),
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) =>
        document.removeEventListener(evt, resetIdle),
      );
    };
  }, [resetIdle, timeoutMs]);

  return { isIdle, resetIdle };
}
