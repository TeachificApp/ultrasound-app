import { describe, expect, it } from "vitest";
import {
  evaluateInlineLessonQuizCompletion,
  getVisibleInlineLessonQuizQuestionIndexes,
  hasCompletedRequiredInlineSurvey,
  isSurveyOnlyInlineLessonQuiz,
} from "./inlineLessonQuizFlow";

const questions = [
  { id: "recommend", type: "survey_choice", question: "Would you recommend this activity?" },
  { id: "why", type: "open_text", question: "Why?", showWhen: { parentQuestionKey: "recommend", expectedAnswer: "Yes" } },
  { id: "rating", type: "star_rating", question: "Rate the activity" },
];

describe("inline lesson quiz survey flow", () => {
  it("shows a dependent follow-up only for the configured prior answer", () => {
    expect(getVisibleInlineLessonQuizQuestionIndexes(questions, { recommend: "No" })).toEqual([0, 2]);
    expect(getVisibleInlineLessonQuizQuestionIndexes(questions, { recommend: "Yes" })).toEqual([0, 1, 2]);
  });

  it("requires responses for visible survey questions but never a numeric passing score", () => {
    expect(isSurveyOnlyInlineLessonQuiz(questions)).toBe(true);
    expect(hasCompletedRequiredInlineSurvey(questions, [
      { questionKey: "recommend", answerValue: "No" },
      { questionKey: "rating", answerValue: 5 },
    ], true)).toBe(true);
    expect(hasCompletedRequiredInlineSurvey(questions, [
      { questionKey: "recommend", answerValue: "Yes" },
      { questionKey: "rating", answerValue: 5 },
    ], true)).toBe(false);
  });

  it("uses required survey submission instead of a numeric passing score while retaining scored quiz pass rules", () => {
    expect(evaluateInlineLessonQuizCompletion({
      questions,
      responses: [
        { questionKey: "recommend", answerValue: "No" },
        { questionKey: "rating", answerValue: 4 },
      ],
      scorePassed: false,
      requireSurveyCompletion: true,
    })).toMatchObject({ requiresSurveyCompletion: true, surveyCompleted: true, passed: true });

    expect(evaluateInlineLessonQuizCompletion({
      questions: [{ id: "legacy-choice", type: "mcq" }],
      responses: [{ questionKey: "legacy-choice", answerValue: "Yes" }],
      scorePassed: false,
      requireSurveyCompletion: true,
    })).toMatchObject({ requiresSurveyCompletion: true, surveyCompleted: true, passed: true });
  });
});
