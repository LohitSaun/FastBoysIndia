import { useCallback, useEffect, useState } from 'react';

/**
 * A seconds countdown, e.g. "Resend code in 0:42".
 *
 * It stores the END TIME and compares against the clock, instead of subtracting 1 every
 * second. Phones pause timers when the app is in the background (say, while the user
 * checks their SMS app), so a plain "minus one per tick" counter would fall behind.
 */
export function useCountdown(durationSeconds: number) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + durationSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());

  const secondsLeft = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const finished = secondsLeft === 0;

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [finished]);

  const restart = useCallback(() => {
    const start = Date.now();
    setNow(start);
    setEndsAt(start + durationSeconds * 1000);
  }, [durationSeconds]);

  return { secondsLeft, restart };
}

/** 42 → "0:42", 60 → "1:00" */
export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
