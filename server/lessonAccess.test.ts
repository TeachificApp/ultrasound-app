import { describe, expect, it } from "vitest";
import { getCourseLessonAccessDecision } from "./lib/lessonAccess";

describe("protected course lesson access", () => {
  it("allows a fully enrolled CME learner to open a protected instructional lesson", () => {
    expect(getCourseLessonAccessDecision({
      previewMode: "none",
      hasActiveEnrollment: true,
      enrollmentType: "full",
    })).toEqual({ allowed: true, reason: null });
  });

  it("continues to restrict expired/no-access and free-preview learners from protected content", () => {
    expect(getCourseLessonAccessDecision({ previewMode: "none", hasActiveEnrollment: false })).toMatchObject({ allowed: false, reason: "enrollment_required" });
    expect(getCourseLessonAccessDecision({ previewMode: "none", hasActiveEnrollment: true, enrollmentType: "free_preview" })).toMatchObject({ allowed: false, reason: "full_enrollment_required" });
  });

  it("hides only configured CME lessons for a learner whose CME credit is restricted", () => {
    expect(getCourseLessonAccessDecision({
      previewMode: "none", hasActiveEnrollment: true, enrollmentType: "full",
      cmeCreditRestricted: true, hideForCmeRestricted: true,
    })).toEqual({ allowed: false, reason: "cme_restricted_lesson" });
    expect(getCourseLessonAccessDecision({
      previewMode: "none", hasActiveEnrollment: true, enrollmentType: "full",
      cmeCreditRestricted: true, hideForCmeRestricted: false,
    })).toEqual({ allowed: true, reason: null });
  });
});
