import { describe, expect, it } from "vitest";
import { shouldPreserveScormExtractionState } from "./mirrorSync";

describe("Railway SCORM state preservation", () => {
  it("preserves live extraction and completion states through a database mirror", () => {
    expect(shouldPreserveScormExtractionState("pending")).toBe(true);
    expect(shouldPreserveScormExtractionState("processing")).toBe(true);
    expect(shouldPreserveScormExtractionState("done")).toBe(true);
    expect(shouldPreserveScormExtractionState("failed")).toBe(true);
  });

  it("does not restore legacy skipped states over a fresh managed queue", () => {
    expect(shouldPreserveScormExtractionState("skipped")).toBe(false);
    expect(shouldPreserveScormExtractionState(null)).toBe(false);
  });
});
