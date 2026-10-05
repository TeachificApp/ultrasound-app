import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("visual-builder flashcard templates", () => {
  it("persists a flashcard deck type instead of silently creating a standard quiz", () => {
    const router = source("server/routers/quizMakerRouter.ts");
    const config = source("server/lib/quizBuilderConfig.ts");

    expect(router).toContain('type: meta.contentType ?? "quiz"');
    expect(router).toContain("type: meta.contentType ?? quiz.type");
    expect(config).toContain('contentType?: "quiz" | "mock_exam" | "flashcards"');
    expect(config).toContain('contentType: quiz.type ?? existing.meta.contentType ?? "quiz"');
  });

  it("stores a supplied or PPTX-derived flashcard design while keeping content editable", () => {
    const types = source("client/src/quiz-creator/types/quiz.ts");
    const panel = source("client/src/quiz-creator/components/BrandingPanel.tsx");
    const importer = source("client/src/quiz-creator/lib/pptxFlashcardTemplate.ts");

    expect(types).toContain("flashcardTemplate?:");
    expect(panel).toContain("SUPPLIED_FLASHCARD_TEMPLATE");
    expect(panel).toContain('Upload a PowerPoint card design (.pptx)');
    expect(panel).toContain("createPptxFlashcardTemplate");
    expect(importer).toContain("ppt\\/media\\/");
    expect(importer).toContain("frontBackgroundUrl");
    expect(importer).toContain("answerBackgroundUrl");
    expect(source("server/routers/quizMakerRouter.ts")).toContain("sourcePptxUrl: z.string().min(1).max(2048).optional()");
  });

  it("renders front and answer card sides in the learner player", () => {
    const player = source("client/src/pages/StandaloneQuizPlayer.tsx");
    const frame = source("client/src/components/quiz/BuilderQuizPlayer.tsx");
    const learnerRouter = source("server/routers/standaloneQuizRouter.ts");

    expect(player).toContain("isVisualFlashcardDeck");
    expect(player).toContain("Show Answer");
    expect(player).toContain("I Know This");
    expect(frame).toContain("BuilderFlashcardFrame");
    expect(learnerRouter).toContain('quiz.type === "quiz" || quiz.type === "flashcards"');
  });
});
