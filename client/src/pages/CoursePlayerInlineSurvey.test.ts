import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("InlineLessonQuiz CME survey controls", () => {
  const source = readFileSync(resolve(import.meta.dirname, "CoursePlayer.tsx"), "utf8");

  it("records survey responses and renders survey choices without graded feedback", () => {
    expect(source).toContain('qType === "survey_choice"');
    expect(source).toContain('responses,');
    expect(source).toContain('"likert", "star_rating", "open_text", "survey_choice"');
    expect(source).toContain('✓ Recorded');
  });

  it("suppresses answer-key feedback for every question type in explicit non-scoring survey mode", () => {
    expect(source).toContain('const isNonScoringSurvey = data.isSurvey === true || requiresSurveyCompletion;');
    expect(source).toContain('!isNonScoringSurvey && submitted && origIdx === q.correctAnswer');
    expect(source).toContain('!isNonScoringSurvey && submitted && (q.correctAnswers ?? []).includes(origIdx)');
    expect(source).toContain('submitted && !isNonScoringSurvey && (q.hotspotMarkers ?? [])');
  });

  it("requires a response for template questions marked required", () => {
    expect(source).toContain('q.required === true');
    expect(source).toContain('A response is required');
  });

  it("keeps an inline survey ready to retry after a transient completion error", () => {
    expect(source).toContain('onError: (error) => toast.error(`Quiz progress could not be saved: ${error.message}`)');
    expect(source).toContain('disabled={!allAnswered || recordInlineQuiz.isPending}');
    expect(source).not.toContain('const calculatedScore = isNonScoringSurvey ? 0 : computeScore();\n    setSubmitted(true);');
    expect(source).toContain('onSuccess: (record) => {\n      setSubmitted(true);');
  });

  it("restores saved answers by quiz block and retains in-progress answers across learner navigation", () => {
    expect(source).toContain('getInlineLessonQuizAttempt.useQuery');
    expect(source).toContain('inline-lesson-quiz-answers:${courseSlug}:${lessonId}:${quizBlockId}');
    expect(source).toContain('quizBlockId={String(block.id)}');
    expect(source).toContain('if (!isAdminPreview && isSavedAttemptLoading) return;');
    expect(source).toContain('sessionStorage.setItem(answerDraftKey');
  });
});
