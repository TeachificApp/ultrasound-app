import { describe, expect, it } from "vitest";
import { standaloneQuestionToBuilderQuestion } from "./routers/quizMakerRouter";

describe("standalone Question Bank hydration for Visual Builder", () => {
  it("preserves question content, media, points, and per-question shuffle settings", () => {
    const result = standaloneQuestionToBuilderQuestion({
      sqq: { questionBankId: 42, sortOrder: 3, points: 2, shuffleAnswerOptions: true, lockAnswerOrder: true } as any,
      qb: {
        id: 42,
        type: "mcq",
        question: "Which vessel is assessed?",
        options: JSON.stringify([
          { text: "Aorta", feedback: "The aorta is not the vessel shown." },
          { text: "Pulmonary artery", feedback: "Correct: the image shows the pulmonary artery." },
        ]),
        correctAnswer: "Pulmonary artery",
        correctAnswers: null,
        explanation: "The image shows the pulmonary artery.",
        questionImageUrl: "https://cdn.example/question.png",
        questionVideoUrl: "https://cdn.example/question.mp4",
        feedbackImageUrl: "https://cdn.example/feedback.png",
        feedbackVideoUrl: "https://cdn.example/feedback.mp4",
        hotspotMarkers: null,
        matchingPairs: null,
      } as any,
    });

    expect(result).toMatchObject({
      id: "bank-42",
      order: 4,
      points: 2,
      stem: "Which vessel is assessed?",
      shuffleAnswerOptions: true,
      lockAnswerOrder: true,
      image: { url: "https://cdn.example/question.png" },
      video: { url: "https://cdn.example/question.mp4" },
      feedbackImage: { url: "https://cdn.example/feedback.png" },
      feedbackVideo: { url: "https://cdn.example/feedback.mp4" },
    });
    expect((result as any).data.choices).toEqual([
      { id: "0", text: "Aorta", imageUrl: undefined, videoUrl: undefined, feedback: "The aorta is not the vessel shown.", correct: false },
      { id: "1", text: "Pulmonary artery", imageUrl: undefined, videoUrl: undefined, feedback: "Correct: the image shows the pulmonary artery.", correct: true },
    ]);
  });
});
