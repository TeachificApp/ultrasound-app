import { describe, expect, it } from "vitest";
import { evaluateInlineLessonQuizScore, shouldRestoreMissingCourseCertificate } from "../shared/inlineLessonQuizCompletion";

describe("built-in lesson quiz completion for CME", () => {
  it("marks a passing module quiz as complete at its configured threshold", () => {
    expect(evaluateInlineLessonQuizScore(80, 80)).toEqual({ score: 80, passingScore: 80, passed: true });
  });

  it("keeps a failing module quiz incomplete until the configured threshold is met", () => {
    expect(evaluateInlineLessonQuizScore(79, 80)).toEqual({ score: 79, passingScore: 80, passed: false });
  });

  it("normalizes malformed client score boundaries before writing lesson progress", () => {
    expect(evaluateInlineLessonQuizScore(150.6, 70)).toEqual({ score: 100, passingScore: 70, passed: true });
    expect(evaluateInlineLessonQuizScore(-20, 70)).toEqual({ score: 0, passingScore: 70, passed: false });
  });

  it("restores a missing certificate only for a completed certificate-enabled CME enrollment", () => {
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: true,
      courseHasCmeCredit: true,
      enrollmentCompletedAt: new Date(),
      hasCertificateRecord: false,
    })).toBe(true);
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: true,
      courseHasCmeCredit: true,
      enrollmentCompletedAt: null,
      hasCertificateRecord: false,
    })).toBe(false);
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: true,
      courseHasCmeCredit: true,
      enrollmentCompletedAt: new Date(),
      hasCertificateRecord: true,
    })).toBe(false);
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: true,
      courseHasCmeCredit: false,
      enrollmentCompletedAt: new Date(),
      hasCertificateRecord: false,
    })).toBe(false);
  });
});
