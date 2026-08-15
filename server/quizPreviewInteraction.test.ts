// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/RichTextEditor", () => ({
  RichTextDisplay: ({ html }: { html: string }) => createElement("div", { dangerouslySetInnerHTML: { __html: html } }),
}));

import { useQuizStore } from "../client/src/quiz-creator/store/quizStore";
import { QuizPreview } from "../client/src/quiz-creator/components/QuizPreview";

const previewQuiz = {
  meta: {
    id: "preview-quiz",
    title: "Instant Feedback Preview",
    description: "",
    author: "",
    authorEmail: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    licenseKey: null,
    teachificOrgId: null,
    tags: [],
    passingScore: 70,
    timeLimit: null,
    shuffleQuestions: false,
    shuffleAnswers: false,
    showFeedback: "immediate" as const,
    allowRetry: true,
    maxAttempts: 3,
  },
  questions: [{
    id: "question-1",
    type: "mcq" as const,
    order: 1,
    points: 1,
    required: true,
    feedbackMode: "answer" as const,
    stem: "Which answer is correct?",
    explanation: "The correct option is supported by the source material.",
    feedbackImage: { url: "https://example.com/feedback.png", alt: "Feedback visual" },
    feedbackVideo: { url: "https://example.com/feedback.mp4", type: "file" },
    data: {
      multiSelect: false,
      choices: [
        { id: "correct", text: "Correct option", correct: true, feedbackHtml: "<p>That is correct.</p><img src=\"https://example.com/answer-correct.png\" alt=\"Correct answer feedback image\" />" },
        { id: "incorrect", text: "Incorrect option", correct: false, feedbackHtml: "<p>This option is not correct.</p><video src=\"https://example.com/answer-incorrect.mp4\" controls></video>" },
      ],
    },
  }],
};

describe("Quiz Preview immediate feedback", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderPreview = async (quiz = previewQuiz) => {
    useQuizStore.getState().loadQuiz(quiz as any);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(createElement(QuizPreview, { onClose: vi.fn() })));
  };

  afterEach(async () => {
    await act(async () => root?.unmount());
    host?.remove();
    vi.clearAllMocks();
  });

  it("automatically displays incorrect selected-answer feedback and an incorrect state", async () => {
    await renderPreview();
    const wrong = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Incorrect option"));
    await act(async () => wrong?.click());

    expect(document.querySelector('[data-testid="quiz-preview-feedback"]')?.textContent).toContain("Incorrect");
    expect(wrong?.getAttribute("data-feedback-state")).toBe("incorrect");
    expect(wrong?.className).toContain("border-red-500");
    expect(document.body.textContent).toContain("This option is not correct.");
    expect(document.body.textContent).toContain("The correct option is supported by the source material.");
    expect(document.querySelector('img[alt="Feedback visual"]')?.getAttribute("src")).toBe("https://example.com/feedback.png");
    expect(document.querySelector('video[src="https://example.com/feedback.mp4"]')).not.toBeNull();
    expect(document.querySelector('video[src="https://example.com/answer-incorrect.mp4"]')).not.toBeNull();
  });

  it("automatically displays correct selected-answer feedback and a correct state", async () => {
    await renderPreview();
    const correct = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Correct option"));
    await act(async () => correct?.click());

    expect(document.querySelector('[data-testid="quiz-preview-feedback"]')?.textContent).toContain("Correct");
    expect(correct?.getAttribute("data-feedback-state")).toBe("correct");
    expect(correct?.className).toContain("border-emerald-500");
    expect(document.body.textContent).toContain("That is correct.");
    expect(document.querySelector('img[alt="Correct answer feedback image"]')?.getAttribute("src")).toBe("https://example.com/answer-correct.png");
  });

  it("shows the shared wrong-answer rationale instead of choice feedback in question-based mode", async () => {
    const questionBasedQuiz = {
      ...previewQuiz,
      questions: [{
        ...previewQuiz.questions[0],
        feedbackMode: "question" as const,
        feedback: { correct: "<p>Shared correct rationale.</p>", incorrect: "<p>Shared wrong-answer rationale.</p>" },
        data: {
          multiSelect: false,
          choices: [
            { id: "correct", text: "Correct option", correct: true, feedbackHtml: "<p>Choice-specific correct rationale.</p>" },
            { id: "incorrect", text: "Incorrect option", correct: false, feedbackHtml: "<p>Choice-specific wrong rationale.</p>" },
          ],
        },
      }],
    };
    await renderPreview(questionBasedQuiz);
    const wrong = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Incorrect option"));
    await act(async () => wrong?.click());

    expect(document.querySelector('[data-testid="quiz-preview-feedback"]')?.textContent).toContain("Shared wrong-answer rationale.");
    expect(document.body.textContent).not.toContain("Choice-specific wrong rationale.");
  });
});
