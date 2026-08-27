import { describe, it, expect } from "vitest";
import { isEnrollmentAccessActive, hasCourseEnrollmentAccess } from "./lib/enrollmentAccess";

describe("enrollmentAccess", () => {
  it("treats enrollment without expiry as active", () => {
    expect(isEnrollmentAccessActive({ enrollmentType: "full", accessExpiresAt: null })).toBe(true);
  });

  it("keeps a full CME course enrollment active while lesson completion and certificate eligibility are evaluated separately", () => {
    const cmeEnrollment = {
      enrollmentType: "full",
      accessExpiresAt: null,
    };
    expect(isEnrollmentAccessActive(cmeEnrollment)).toBe(true);
  });

  it("treats future expiry as active", () => {
    const future = new Date(Date.now() + 86400000);
    expect(isEnrollmentAccessActive({ enrollmentType: "full", accessExpiresAt: future })).toBe(true);
  });

  it("treats past expiry as inactive", () => {
    const past = new Date(Date.now() - 86400000);
    expect(isEnrollmentAccessActive({ enrollmentType: "full", accessExpiresAt: past })).toBe(false);
  });

  it("treats invalid expiry dates as active (legacy MySQL zero dates)", () => {
    expect(isEnrollmentAccessActive({ enrollmentType: "full", accessExpiresAt: new Date("0000-00-00") })).toBe(true);
  });

  it("matches dashboard visibility with hasCourseEnrollmentAccess", () => {
    expect(hasCourseEnrollmentAccess({
      enrollmentType: "full",
      accessExpiresAt: new Date(Date.now() - 86400000),
      completedAt: new Date(),
      progressPct: 100,
    })).toBe(true);
  });
});
