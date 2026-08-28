import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("standalone quiz active-attempt question count", () => {
  it("applies questionsPerAttempt to visual-builder selections before returning player questions", () => {
    const router = read("server/routers/standaloneQuizRouter.ts");
    expect(router).toContain("getConfiguredAttemptQuestionCount(quiz, builderConfig, Number(count))");
    expect(router).toContain("if (quiz.questionsPerAttempt && drawn.length > quiz.questionsPerAttempt)");
    expect(router).toContain("drawn = shuffle(drawn).slice(0, quiz.questionsPerAttempt)");
    expect(router).toContain("totalQuestions: drawn.length");
  });

  it("renders player progress from the returned attempt question array rather than the full linked bank", () => {
    const player = read("client/src/pages/StandaloneQuizPlayer.tsx");
    expect(player).toContain("Question {currentIdx + 1} of {questions.length}");
    expect(player).toContain("{currentIdx + 1} / {questions.length}");
    expect(player).not.toContain("questionCount}");
  });
});
