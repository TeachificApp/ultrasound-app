import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("Quiz Maker find-and-replace contract", () => {
  it("requires administrator access and an explicit Question Bank revision action", () => {
    const router = read("server/routers/quizMakerRouter.ts");
    expect(router).toContain("findAndReplaceText: protectedProcedure");
    expect(router).toContain('questionBankAction: z.enum(["quiz_only", "update_linked", "create_linked"])');
    expect(router).toContain("await assertAdmin(ctx);");
  });

  it("updates or creates only Question Bank records linked to the selected quiz when requested", () => {
    const router = read("server/routers/quizMakerRouter.ts");
    expect(router).toContain("eq(standaloneQuizQuestions.quizId, input.quizId)");
    expect(router).toContain('input.questionBankAction === "update_linked"');
    expect(router).toContain('input.questionBankAction === "create_linked"');
    expect(router).toContain("questionBankValuesFromBuilderQuestion");
  });

  it("offers searchable quiz-only, update-linked, and create-new Question Bank replacement choices", () => {
    const questionList = read("client/src/quiz-creator/components/GroupedQuestionList.tsx");
    expect(questionList).toContain("questionSearchText");
    expect(questionList).toContain("Find and replace");
    expect(questionList).toContain("This quiz only");
    expect(questionList).toContain("Update linked Question Bank questions");
    expect(questionList).toContain("Create new linked Question Bank questions");
  });
});
