/** Run after first paint / idle so boot-time work does not compete with initial render. */
export function deferUntilIdle(callback: () => void, timeoutMs = 2500): () => void {
  let cancelled = false;
  const run = () => {
    if (!cancelled) callback();
  };

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: timeoutMs });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(id);
    };
  }

  const id = window.setTimeout(run, Math.min(timeoutMs, 1500));
  return () => {
    cancelled = true;
    window.clearTimeout(id);
  };
}
