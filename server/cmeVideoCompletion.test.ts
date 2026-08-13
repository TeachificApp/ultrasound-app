import { describe, expect, it } from "vitest";
import { hasReachedCmeVideoCompletionThreshold } from "../shared/cmeLessonCompletion";

describe("CME video completion threshold", () => {
  it("unlocks CME lesson completion at 90% watched", () => {
    expect(hasReachedCmeVideoCompletionThreshold(89.9, 100)).toBe(false);
    expect(hasReachedCmeVideoCompletionThreshold(90, 100)).toBe(true);
    expect(hasReachedCmeVideoCompletionThreshold(100, 100)).toBe(true);
  });

  it("does not unlock for missing or invalid duration metadata", () => {
    expect(hasReachedCmeVideoCompletionThreshold(90, 0)).toBe(false);
    expect(hasReachedCmeVideoCompletionThreshold(90, Number.NaN)).toBe(false);
  });
});
