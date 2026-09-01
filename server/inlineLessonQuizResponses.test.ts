import { describe, expect, it } from "vitest";
import { prepareInlineQuizResponses } from "./lib/inlineLessonQuizResponses";
import { evaluateInlineLessonQuizCompletion } from "../shared/inlineLessonQuizFlow";

describe("prepareInlineQuizResponses", () => {
  const questions = [
    { id: "quality", question: "How would you rate the activity?", type: "star_rating" },
    { id: "recommend", question: "Would you recommend this activity?", type: "survey_choice" },
    { id: "feedback", question: "What did you like most?", type: "open_text" },
  ];

  it("records a non-scoring selectable survey response without an answer key or score threshold", () => {
    const completion = evaluateInlineLessonQuizCompletion({
      questions: [{ id: "role", type: "mcq" }],
      responses: [{ questionKey: "role", answerValue: "Sonographer" }],
      scorePassed: false,
      nonScoringSurvey: true,
    });

    expect(completion).toMatchObject({ nonScoringSurvey: true, requiresSurveyCompletion: false, passed: true });
  });

  it("accepts every professional-role response as a recorded non-scoring survey answer", () => {
    const roles = ["Physician", "Sonographer", "Nurse", "Student", "Other"];
    for (const role of roles) {
      expect(evaluateInlineLessonQuizCompletion({
        questions: [{ id: "role", type: "survey_choice" }],
        responses: [{ questionKey: "role", answerValue: role }],
        scorePassed: false,
        nonScoringSurvey: true,
        requiresSurveyCompletion: true,
      }).passed).toBe(true);
    }
  });

  it("keeps only one response per stored question and retains stored labels", () => {
    const result = prepareInlineQuizResponses(questions, [
      { questionKey: "quality", answerValue: 5 },
      { questionKey: "recommend", answerValue: "Yes" },
      { questionKey: "recommend", answerValue: "No" },
      { questionKey: "unknown", answerValue: "Do not export" },
    ]);

    expect(result).toEqual([
      { questionKey: "quality", questionText: "How would you rate the activity?", questionType: "star_rating", answerValue: "5" },
      { questionKey: "recommend", questionText: "Would you recommend this activity?", questionType: "survey_choice", answerValue: "Yes" },
    ]);
  });

  it("uses stable positional keys for legacy inline questions without IDs", () => {
    const result = prepareInlineQuizResponses(
      [{ question: "Legacy question", type: "open_text" }],
      [{ questionKey: "0", answerValue: "Learner response" }],
    );

    expect(result).toEqual([
      { questionKey: "0", questionText: "Legacy question", questionType: "open_text", answerValue: "Learner response" },
    ]);
  });

  it("does not retain an answer for a hidden dependent survey question", () => {
    const result = prepareInlineQuizResponses([
      { id: "recommend", question: "Would you recommend this activity?", type: "survey_choice" },
      { id: "why", question: "Why would you recommend it?", type: "open_text", showWhen: { parentQuestionKey: "recommend", expectedAnswer: "Yes" } },
    ], [
      { questionKey: "recommend", answerValue: "No" },
      { questionKey: "why", answerValue: "This should not be retained." },
    ]);

    expect(result).toEqual([
      { questionKey: "recommend", questionText: "Would you recommend this activity?", questionType: "survey_choice", answerValue: "No" },
    ]);
  });
});
