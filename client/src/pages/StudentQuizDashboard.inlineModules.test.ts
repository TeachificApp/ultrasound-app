import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "StudentQuizDashboard.tsx"), "utf8");

describe("My Quiz Results embedded module visibility", () => {
  it("combines private lesson quiz and flashcard attempts with the matching result tabs", () => {
    expect(source).toContain("trpc.lmsLearner.getMyInlineModuleAttempts.useQuery");
    expect(source).toContain("const allNativeHistory");
    expect(source).toContain("const allFlashcardHistory");
    expect(source).toContain('quizType === "flashcards" ? "Flashcards"');
  });

  it("opens an embedded result only in its own course lesson rather than a standalone-quiz result route", () => {
    expect(source).toContain("isLessonModule && courseSlug && lessonId");
    expect(source).toContain("/courses/${courseSlug}/player?lesson=${lessonId}");
  });
});
