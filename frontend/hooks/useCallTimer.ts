import { useState, useEffect, useRef } from 'react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * useCallTimer — increments every second.
 * The interval is cleared automatically when the component unmounts
 * (via the useEffect cleanup return).
 */
export function useCallTimer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const m = pad(Math.floor(seconds / 60));
  const s = pad(seconds % 60);
  return `${m}:${s}`;
}
