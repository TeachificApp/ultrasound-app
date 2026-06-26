import { useCallback, useEffect, useRef, useState } from "react";

/** Cooldown after first checkout click to prevent impatient double-clicks. */
export const CHECKOUT_CLICK_GUARD_MS = 5000;

/**
 * Returns a guarded click runner and whether checkout actions should be disabled.
 * Works alongside mutation `isPending` — combine both for button disabled state.
 */
export function useCheckoutClickGuard(cooldownMs = CHECKOUT_CLICK_GUARD_MS) {
  const guardedUntilRef = useRef(0);
  const [isGuarded, setIsGuarded] = useState(false);

  useEffect(() => {
    if (!isGuarded) return;
    const remaining = guardedUntilRef.current - Date.now();
    if (remaining <= 0) {
      setIsGuarded(false);
      return;
    }
    const timer = setTimeout(() => setIsGuarded(false), remaining);
    return () => clearTimeout(timer);
  }, [isGuarded]);

  const runGuarded = useCallback(
    (fn: () => void) => {
      if (Date.now() < guardedUntilRef.current) return;
      guardedUntilRef.current = Date.now() + cooldownMs;
      setIsGuarded(true);
      fn();
    },
    [cooldownMs],
  );

  return { runGuarded, isGuarded };
}
