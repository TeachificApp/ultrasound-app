import { useEffect, useState } from "react";

/** Keep submit buttons disabled until the server's retry window has elapsed. */
export function useAuthEmailRetry() {
  const [retryAt, setRetryAt] = useState(0);
  const [retryAfterMs, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, retryAt - Date.now()));
    update();
    if (retryAt <= Date.now()) return;
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const setRetryAfterMs = (ms: number) => {
    const remaining = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    setRemaining(remaining);
    setRetryAt(Date.now() + remaining);
  };

  return { retryAfterMs, setRetryAfterMs };
}
