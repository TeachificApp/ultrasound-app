import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeedbackPopup } from "../client/src/components/quiz/BuilderQuizPlayer";
import { QuestionCard } from "../client/src/pages/StandaloneQuizResults";
import { StandaloneQuestionMedia } from "../client/src/components/quiz/StandaloneQuestionMedia";

const source = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("all-quiz media workflow", () => {
  it("provides persistent question and feedback image/video controls in shared and Visual Builder authoring", () => {
    const bankEditor = source("client/src/components/QuestionBankMediaEditorDialog.tsx");
    const visualEditor = source("client/src/quiz-creator/components/QuestionEditor.tsx");
    expect(bankEditor).toContain('"/api/upload-question-media"');
    expect(bankEditor).toContain('field="questionImageUrl"');
    expect(bankEditor).toContain('field="questionVideoUrl"');
    expect(bankEditor).toContain('field="feedbackImageUrl"');
    expect(bankEditor).toContain('field="feedbackVideoUrl"');
    expect(visualEditor).toContain("uploadStemImage");
    expect(visualEditor).toContain("uploadFeedbackImage");
    expect(visualEditor).toContain("feedbackVideo");
    expect(visualEditor).toContain("reuseMediaUrl");
    expect(visualEditor).toContain("Use image URL");
    expect(visualEditor).toContain("Use video URL");
  });

  it("preserves question and feedback media in lesson authoring and standalone learner rendering", () => {
    const lessonEditor = source("client/src/components/LessonQuizBlockEditor.tsx");
    const standalonePlayer = source("client/src/pages/StandaloneQuizPlayer.tsx");
    const standaloneResults = source("client/src/pages/StandaloneQuizResults.tsx");
    const builderPlayer = source("client/src/components/quiz/BuilderQuizPlayer.tsx");
    expect(lessonEditor).toContain("questionImageUrl");
    expect(lessonEditor).toContain("feedbackImageUrl");
    expect(lessonEditor).toContain("feedbackVideoUrl");
    expect(lessonEditor).toContain("reuseMediaUrl");
    expect(lessonEditor).toContain("Use URL");
    expect(lessonEditor).toContain('reuseMediaUrl("question video"');
    expect(lessonEditor).toContain('reuseMediaUrl("feedback video"');
    expect(standalonePlayer).toContain("q.questionVideoUrl");
    expect(standalonePlayer).toContain("q.feedbackVideoUrl");
    expect(standaloneResults).toContain("q.questionVideoUrl");
    expect(standaloneResults).toContain("q.feedbackVideoUrl");
    expect(builderPlayer).toContain("export function FeedbackPopup");
    expect(builderPlayer).toContain("{imageUrl && <img");
    expect(builderPlayer).toContain("{videoUrl && <video");
  });

  it("renders feedback image and video in the shared learner feedback surface", () => {
    const markup = renderToStaticMarkup(React.createElement(FeedbackPopup, {
      type: "correct",
      message: "Correct answer feedback",
      imageUrl: "https://media.example/feedback.png",
      videoUrl: "https://media.example/feedback.mp4",
      onAdvance: () => undefined,
      advanceLabel: "Next",
    }));
    expect(markup).toContain('src="https://media.example/feedback.png"');
    expect(markup).toContain('src="https://media.example/feedback.mp4"');
    expect(markup).toContain(">Next<");
    expect(markup).not.toContain(">OK<");
  });

  it("renders question and feedback image/video on standalone quiz result review", () => {
    const markup = renderToStaticMarkup(React.createElement(QuestionCard, {
      idx: 0,
      a: {
        id: 1,
        isCorrect: false,
        givenAnswer: "0",
        question: {
          question: "Identify this anatomy.",
          options: '[{"text":"Aorta"},{"text":"IVC"}]',
          correctAnswer: "1",
          questionImageUrl: "https://media.example/question.png",
          questionVideoUrl: "https://media.example/question.mp4",
          feedbackImageUrl: "https://media.example/feedback.png",
          feedbackVideoUrl: "https://media.example/feedback.mp4",
          explanation: "The vessel is the IVC.",
        },
      },
    }));
    expect(markup).toContain('src="https://media.example/question.png"');
    expect(markup).toContain('src="https://media.example/question.mp4"');
    expect(markup).toContain('src="https://media.example/feedback.png"');
    expect(markup).toContain('src="https://media.example/feedback.mp4"');
  });

  it("renders question and revealed-feedback media on the standalone quiz player surface", () => {
    const markup = renderToStaticMarkup(React.createElement(StandaloneQuestionMedia, {
      questionImageUrl: "https://media.example/question.png",
      questionVideoUrl: "https://media.example/question.mp4",
      feedbackImageUrl: "https://media.example/feedback.png",
      feedbackVideoUrl: "https://media.example/feedback.mp4",
      showFeedback: true,
    }));
    expect(markup).toContain('src="https://media.example/question.png"');
    expect(markup).toContain('src="https://media.example/question.mp4"');
    expect(markup).toContain('src="https://media.example/feedback.png"');
    expect(markup).toContain('src="https://media.example/feedback.mp4"');
  });
});
