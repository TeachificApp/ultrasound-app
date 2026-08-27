import { describe, expect, it } from "vitest";
import { formatCmeCreditLabel, formatCmeCreditPhrase } from "../shared/cmeCreditLabel";
import { isEnrollmentCompleted } from "./lib/enrollmentAccess";

describe("cmeCreditLabel", () => {
  it("formats singular and plural credit labels", () => {
    expect(formatCmeCreditLabel("1")).toBe("1 CME Credit");
    expect(formatCmeCreditLabel("2")).toBe("2 CME Credits");
    expect(formatCmeCreditPhrase("2")).toBe("2 CME credits");
  });

  it("returns null for empty or invalid values", () => {
    expect(formatCmeCreditLabel(null)).toBeNull();
    expect(formatCmeCreditLabel("")).toBeNull();
    expect(formatCmeCreditLabel("0")).toBeNull();
  });
});

describe("enrollmentAccess completion", () => {
  it("treats 100% progress as completed for review access", () => {
    expect(isEnrollmentCompleted({ completedAt: null, progressPct: 100 })).toBe(true);
    expect(isEnrollmentCompleted({ completedAt: null, progressPct: 99 })).toBe(false);
    expect(isEnrollmentCompleted({ completedAt: new Date(), progressPct: 50 })).toBe(true);
  });
});
