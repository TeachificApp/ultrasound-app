import { describe, expect, it } from "vitest";
import { prepareInlineQuizResponses } from "./lib/inlineLessonQuizResponses";

describe("prepareInlineQuizResponses", () => {
  const questions = [
    { id: "quality", question: "How would you rate the activity?", type: "star_rating" },
    { id: "recommend", question: "Would you recommend this activity?", type: "survey_choice" },
    { id: "feedback", question: "What did you like most?", type: "open_text" },
  ];

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
});
