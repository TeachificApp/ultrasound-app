/** CME video lessons satisfy their completion prerequisite at 90% watched. */
export function hasReachedCmeVideoCompletionThreshold(currentTime: number, duration: number) {
  return Number.isFinite(currentTime)
    && Number.isFinite(duration)
    && duration > 0
    && currentTime / duration >= 0.9;
}
