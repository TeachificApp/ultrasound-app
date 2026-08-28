import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getConfiguredAttemptQuestionCount } from "./routers/standaloneQuizRouter";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("standalone quiz active-attempt question count", () => {
  const standardQuiz = {
    questionsPerAttempt: 50,
    categoryConfig: null,
  } as any;

  it("uses the configured cap and actual category pool availability rather than the full linked bank", () => {
    expect(getConfiguredAttemptQuestionCount(standardQuiz, null, [1, 1, 1, 2, 2, null])).toBe(6);
    expect(getConfiguredAttemptQuestionCount({ ...standardQuiz, categoryConfig: JSON.stringify([
      { folderId: 1, count: 2 },
      { folderId: 2, count: 1 },
      { folderId: null, count: 4 },
    ]) }, null, [1, 1, 1, 2, 2, null])).toBe(4);
    expect(getConfiguredAttemptQuestionCount({ ...standardQuiz, questionsPerAttempt: 3, categoryConfig: JSON.stringify([
      { folderId: 1, count: 3 },
      { folderId: 2, count: 2 },
    ]) }, null, [1, 1, 1, 2, 2, null])).toBe(3);
  });

  it("applies questionsPerAttempt to visual-builder selections before returning player questions", () => {
    const router = read("server/routers/standaloneQuizRouter.ts");
    expect(router).toContain("linkedQuestionFolders.map((question) => question.folderId)");
    expect(router).toContain("if (quiz.questionsPerAttempt && drawn.length > quiz.questionsPerAttempt)");
    expect(router).toContain("drawn = shuffle(drawn).slice(0, quiz.questionsPerAttempt)");
    expect(router).toContain("totalQuestions: drawn.length");
  });

  it("renders player progress from the returned attempt question array rather than the full linked bank", () => {
    const player = read("client/src/pages/StandaloneQuizPlayer.tsx");
    expect(player).toContain("Question {currentIdx + 1} of {questions.length}");
    expect(player).toContain("{currentIdx + 1} / {questions.length}");
    expect(player).toContain("questionCount={quizInfo.questionCount}");
  });
});
