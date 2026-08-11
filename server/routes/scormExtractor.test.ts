import { describe, expect, it } from "vitest";
import {
  canStartQueuedScormExtraction,
  nextScormStatusAfterInterruption,
} from "./scormExtractor";

describe("SCORM extraction queue policy", () => {
  it("requeues interrupted extraction work instead of marking it skipped", () => {
    expect(nextScormStatusAfterInterruption()).toBe("pending");
  });

  it("starts a queued package only when no other extraction is active", () => {
    expect(canStartQueuedScormExtraction(0)).toBe(true);
    expect(canStartQueuedScormExtraction(1)).toBe(false);
  });
});
