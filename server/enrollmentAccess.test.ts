import { describe, it, expect } from "vitest";
import { isEnrollmentAccessActive } from "./lib/enrollmentAccess";

describe("enrollmentAccess", () => {
  it("treats enrollment without expiry as active", () => {
    expect(isEnrollmentAccessActive({ enrollmentType: "full", accessExpiresAt: null })).toBe(true);
  });

  it("treats future expiry as active", () => {
    const future = new Date(Date.now() + 86400000);
    expect(isEnrollmentAccessActive({ enrollmentType: "full", accessExpiresAt: future })).toBe(true);
  });

  it("treats past expiry as inactive", () => {
    const past = new Date(Date.now() - 86400000);
    expect(isEnrollmentAccessActive({ enrollmentType: "full", accessExpiresAt: past })).toBe(false);
  });
});
