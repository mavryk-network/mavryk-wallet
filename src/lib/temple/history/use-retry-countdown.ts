import { useEffect, useState } from 'react';

/**
 * Whole seconds left until `retryAvailableAt` (epoch ms), rounded up; 0 when no cooldown is active.
 */
export function useRetryCountdown(retryAvailableAt: number | null) {
  const getSecondsLeft = () =>
    retryAvailableAt === null ? 0 : Math.max(0, Math.ceil((retryAvailableAt - Date.now()) / 1000));
  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);

  // Ticks the visible countdown once per second while a cooldown is active.
  // The interval is cleared when the cooldown ends, changes or the consumer unmounts.
  useEffect(() => {
    setSecondsLeft(getSecondsLeft());
    if (retryAvailableAt === null) return;

    const intervalId = setInterval(() => {
      const nextSecondsLeft = getSecondsLeft();
      setSecondsLeft(nextSecondsLeft);
      if (nextSecondsLeft === 0) clearInterval(intervalId);
    }, 1000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryAvailableAt]);

  return secondsLeft;
}
