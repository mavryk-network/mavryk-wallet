import { useEffect, useState } from 'react';

/** Long enough to defeat click-through / double-click tricks, short enough not to slow a deliberate user. */
export const CONFIRM_ARM_DELAY_MS = 700;

const isWindowActive = () => document.visibilityState === 'visible' && document.hasFocus();

/**
 * Keeps an approval button disarmed until the confirmation window has been visible and focused for a short delay.
 * A page can open the prompt under the cursor, or steal focus mid-gesture, so a click that lands right after the
 * prompt appears (or regains focus) must not approve it.
 *
 * @returns whether the button may act on a click
 */
export function useConfirmArmDelay(delayMs = CONFIRM_ARM_DELAY_MS) {
  const [isArmed, setIsArmed] = useState(false);

  // Arms a timer once the window is visible and focused, and disarms on blur/hide so focus changes restart the delay.
  // Cleanup clears the pending timer and removes the window/document listeners.
  useEffect(() => {
    let timer: number | undefined;
    const disarm = () => {
      window.clearTimeout(timer);
      timer = undefined;
      setIsArmed(false);
    };
    const arm = () => {
      if (!isWindowActive()) return disarm();
      if (timer !== undefined) return;
      timer = window.setTimeout(() => setIsArmed(true), delayMs);
    };

    arm();
    window.addEventListener('focus', arm);
    window.addEventListener('blur', disarm);
    document.addEventListener('visibilitychange', arm);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', arm);
      window.removeEventListener('blur', disarm);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [delayMs]);

  return isArmed;
}
