import { describe, expect, it } from "vitest";
import { SCORM_MIN_R2_OBJECT_COUNT } from "./scormR2Probe";

describe("scormR2Probe", () => {
  it("requires minimum object count for playable extraction", () => {
    expect(SCORM_MIN_R2_OBJECT_COUNT).toBeGreaterThan(1);
  });
});
