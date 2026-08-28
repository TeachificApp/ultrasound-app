import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { builderQuestionToReviewQuestion } from "./routers/standaloneQuizRouter";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("standalone quiz result review", () => {
  it("hydrates a builder-originated attempt answer into reviewable learner content", () => {
    const question = builderQuestionToReviewQuestion({
      id: "bank-44",
      stem: "Which vein has reflux?",
      explanation: "Reflux is present.",
      image: { url: "https://image.example/question.png" },
      data: { choices: [{ text: "Great Saphenous Vein", correct: true }, { text: "Femoral vein", correct: false }] },
    });
    expect(question.question).toBe("Which vein has reflux?");
    expect(question.correctAnswer).toBe("0");
    expect(JSON.parse(question.options)).toEqual([{ text: "Great Saphenous Vein" }, { text: "Femoral vein" }]);
  });

  it("uses the persisted visual-builder review permission and only shows group headers when explicitly enabled", () => {
    const router = read("server/routers/standaloneQuizRouter.ts");
    const results = read("client/src/pages/StandaloneQuizResults.tsx");
    expect(router).toContain("canReviewAnswers");
    expect(router).toContain("builderConfig.meta.showGroupNames === true");
    expect(router).not.toContain(': "Uncategorized"');
    expect(results).toContain("const { attempt, quiz, canSeeResults, canReviewAnswers, showGroupNames, answers } = data;");
  });
});
