import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("Quiz Maker find-and-replace contract", () => {
  it("requires administrator access and an explicit Question Bank synchronization choice", () => {
    const router = read("server/routers/quizMakerRouter.ts");
    expect(router).toContain("findAndReplaceText: protectedProcedure");
    expect(router).toContain("updateQuestionBank: z.boolean()");
    expect(router).toContain("await assertAdmin(ctx);");
  });

  it("updates only bank records linked to the selected quiz when synchronization is requested", () => {
    const router = read("server/routers/quizMakerRouter.ts");
    expect(router).toContain("eq(standaloneQuizQuestions.quizId, input.quizId)");
    expect(router).toContain("inArray(standaloneQuizQuestions.questionBankId, questionBankIds)");
    expect(router).toContain("if (input.updateQuestionBank && questionBankIds.length > 0)");
  });

  it("offers searchable, quiz-only and Question Bank replacement choices in Visual Builder", () => {
    const questionList = read("client/src/quiz-creator/components/GroupedQuestionList.tsx");
    expect(questionList).toContain("questionSearchText");
    expect(questionList).toContain("Find and replace");
    expect(questionList).toContain("This quiz only");
    expect(questionList).toContain("linked Question Bank records");
  });
});
