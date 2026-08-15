import { describe, expect, it } from "vitest";
import { evaluatePreviewAnswer, getPreviewAnswerFeedbackHtml, getPreviewFeedbackContent } from "../client/src/quiz-creator/components/QuizPreview";
import type { QuizQuestion } from "../client/src/quiz-creator/types/quiz";

const mcqQuestion: QuizQuestion = {
  id: "q1",
  type: "mcq",
  order: 1,
  points: 1,
  required: true,
  stem: "Which option is correct?",
  explanation: "The first option is correct.",
  explanationHtml: "<p>The first option is <strong>correct</strong>.</p>",
  feedbackImage: { url: "https://example.com/feedback.png", alt: "Feedback image" },
  feedbackVideo: { url: "https://example.com/feedback.mp4", type: "file" },
  data: {
    multiSelect: false,
    choices: [
      { id: "a", text: "Correct", correct: true, feedbackHtml: "<p>Correct answer explanation.</p>" },
      { id: "b", text: "Incorrect", correct: false, feedbackHtml: "<p>Incorrect answer explanation.</p>" },
    ],
  },
};

describe("Quiz Preview instant feedback", () => {
  it("scores correct, incorrect, and partial multiple-choice responses for immediate feedback", () => {
    expect(evaluatePreviewAnswer(mcqQuestion, ["a"])).toBe("correct");
    expect(evaluatePreviewAnswer(mcqQuestion, ["b"])).toBe("incorrect");

    const multiSelect = {
      ...mcqQuestion,
      data: { multiSelect: true, choices: [
        { id: "a", text: "First", correct: true },
        { id: "b", text: "Second", correct: true },
        { id: "c", text: "Other", correct: false },
      ] },
    } as QuizQuestion;
    expect(evaluatePreviewAnswer(multiSelect, ["a"])).toBe("partial");
  });

  it("returns selected-answer rich feedback for display after checking an answer", () => {
    expect(getPreviewAnswerFeedbackHtml(mcqQuestion, ["a"])).toContain("Correct answer explanation");
    expect(getPreviewAnswerFeedbackHtml(mcqQuestion, ["b"])).toContain("Incorrect answer explanation");
  });

  it("shows selected wrong-answer and correct-answer rationales in answer-based mode", () => {
    const question = {
      ...mcqQuestion,
      feedbackMode: "answer" as const,
      data: {
        multiSelect: false,
        choices: [
          { id: "a", text: "Correct", correct: true, feedbackHtml: "<p>Correct answer explanation.</p><img src=\"https://example.com/correct.png\" alt=\"Correct answer image\" />" },
          { id: "b", text: "Incorrect", correct: false, feedbackHtml: "<p>Incorrect answer explanation.</p><video src=\"https://example.com/incorrect.mp4\" controls></video>" },
        ],
      },
    } as QuizQuestion;
    const content = getPreviewFeedbackContent(question, ["b"], "incorrect");
    expect(content.feedbackMode).toBe("answer");
    expect(content.selectedAnswerHtml).toContain("Incorrect answer explanation");
    expect(content.selectedAnswerHtml).toContain("incorrect.mp4");
    expect(content.correctAnswerHtml).toContain("Correct answer explanation");
    expect(content.correctAnswerHtml).toContain("correct.png");
    expect(content.correctExplanationHtml).toContain("The first option is");
  });

  it("shows shared question feedback regardless of selected option in question-based mode", () => {
    const questionBased = {
      ...mcqQuestion,
      feedbackMode: "question" as const,
      feedback: { correct: "<p>Shared correct rationale.</p><img src=\"https://example.com/shared-correct.png\" alt=\"Shared correct image\" />", incorrect: "<p>Shared incorrect rationale.</p><video src=\"https://example.com/shared-incorrect.mp4\" controls></video>" },
    };
    const wrongContent = getPreviewFeedbackContent(questionBased, ["b"], "incorrect");
    const correctContent = getPreviewFeedbackContent(questionBased, ["a"], "correct");
    expect(wrongContent.questionFeedbackHtml).toContain("Shared incorrect rationale");
    expect(wrongContent.questionFeedbackHtml).toContain("shared-incorrect.mp4");
    expect(wrongContent.selectedAnswerHtml).toBe("");
    expect(correctContent.questionFeedbackHtml).toContain("Shared correct rationale");
    expect(correctContent.questionFeedbackHtml).toContain("shared-correct.png");
    expect(correctContent.selectedAnswerHtml).toBe("");
  });

  it("keeps question-level rich feedback media fields available to the preview player", () => {
    expect(mcqQuestion.explanationHtml).toContain("<strong>correct</strong>");
    expect(mcqQuestion.feedbackImage?.url).toBe("https://example.com/feedback.png");
    expect(mcqQuestion.feedbackVideo?.url).toBe("https://example.com/feedback.mp4");
  });
});
