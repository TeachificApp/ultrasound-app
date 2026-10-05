import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateInlineLessonQuizScore, lessonHasRequiredInlineQuiz, shouldRestoreMissingCourseCertificate } from "../shared/inlineLessonQuizCompletion";

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

  it("identifies only inline assessments that own lesson completion", () => {
    expect(lessonHasRequiredInlineQuiz([{ type: "lesson_quiz", data: {} }])).toBe(true);
    expect(lessonHasRequiredInlineQuiz([{ type: "lesson_quiz", data: { requirePassToComplete: false } }])).toBe(false);
    expect(lessonHasRequiredInlineQuiz([{ type: "lesson_quiz", data: { isSurvey: true } }])).toBe(false);
    expect(lessonHasRequiredInlineQuiz([{ type: "lesson_quiz", data: { requireSurveyCompletion: true } }])).toBe(true);
    expect(lessonHasRequiredInlineQuiz('[{"type":"lesson_quiz","data":{"requirePassToComplete":true}}]')).toBe(true);
  });

  it("keeps required inline quiz completion enforced in the player and server", () => {
    const routerSource = readFileSync(resolve(import.meta.dirname, "routers", "lmsRouter.ts"), "utf8");
    const playerSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/CoursePlayer.tsx"), "utf8");
    expect(routerSource).toContain("lessonHasRequiredInlineQuiz(lesson.contentBlocks) && !existing?.quizPassed");
    expect(routerSource).toContain("Pass the required lesson quiz before marking this lesson complete.");
    expect(routerSource).toContain("if (passed) await recalcProgress(db, enrollment.id);");
    expect(playerSource).toContain("!hasRequiredInlineLessonQuiz");
    expect(playerSource).toContain("Pass the required lesson quiz to complete this lesson.");
  });

  it("restores a missing certificate for any completed certificate-enabled enrollment", () => {
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: true,
      enrollmentCompletedAt: new Date(),
      hasCertificateRecord: false,
    })).toBe(true);
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: true,
      enrollmentProgressPct: 100,
      enrollmentCompletedAt: null,
      hasCertificateRecord: false,
    })).toBe(true);
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: true,
      enrollmentCompletedAt: null,
      enrollmentProgressPct: 92,
      hasCertificateRecord: false,
    })).toBe(false);
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: true,
      enrollmentCompletedAt: new Date(),
      hasCertificateRecord: true,
    })).toBe(false);
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: false,
      enrollmentCompletedAt: new Date(),
      hasCertificateRecord: false,
    })).toBe(false);
  });
});
