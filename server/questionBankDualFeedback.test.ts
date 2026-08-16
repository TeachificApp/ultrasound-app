import { describe, expect, it } from "vitest";
import { buildAiQuestionBankInsertValues } from "./lib/aiQuestionBankPersistence";
import { standaloneQuestionToBuilderQuestion } from "./routers/quizMakerRouter";

describe("Question Bank dual feedback", () => {
  it("persists both shared feedback forms and every answer-specific rationale for future AI questions", () => {
    const values = buildAiQuestionBankInsertValues({
      question: "Which answer is correct?", type: "mcq", options: ["A", "B"], correctAnswer: "B", correctAnswers: [],
      explanation: "B is correct.", correctFeedback: "Correct: B is correct.", incorrectFeedback: "Incorrect: the correct concept is B.", optionFeedback: ["A is incorrect.", "B is correct."], matchingPairs: [],
    }, null, 4);
    expect(values).toMatchObject({ correctFeedback: "Correct: B is correct.", incorrectFeedback: "Incorrect: the correct concept is B." });
    expect(JSON.parse(values.options!)).toEqual([{ text: "A", feedback: "A is incorrect." }, { text: "B", feedback: "B is correct." }]);
  });

  it("carries Question Bank shared and answer-specific feedback into a quiz question after Add-to-Quiz", () => {
    const builderQuestion = standaloneQuestionToBuilderQuestion({
      sqq: { sortOrder: 0, points: 1, shuffleAnswerOptions: false, lockAnswerOrder: false } as any,
      qb: { id: 90, question: "Question", type: "mcq", options: JSON.stringify([{ text: "A", feedback: "A rationale" }, { text: "B", feedback: "B rationale" }]), correctAnswer: "B", correctAnswers: null, matchingPairs: null, hotspotMarkers: null, explanation: "Explanation", correctFeedback: "Shared correct", incorrectFeedback: "Shared incorrect", questionImageUrl: null, questionVideoUrl: null, feedbackImageUrl: null, feedbackVideoUrl: null } as any,
    });
    expect(builderQuestion).toMatchObject({ feedback: { correct: "Shared correct", incorrect: "Shared incorrect" }, data: { choices: [{ text: "A", feedback: "A rationale" }, { text: "B", feedback: "B rationale", correct: true }] } });
  });
});
