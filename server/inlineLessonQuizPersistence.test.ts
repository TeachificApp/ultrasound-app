import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildInlineQuizAttemptValues, isMissingInlineQuizAccountFieldsColumn } from "./lib/inlineQuizAttemptPersistence";
import { INLINE_LESSON_QUIZ_SCHEMA_CONTRACT } from "./lib/ensureInlineLessonQuizSchema";

const source = readFileSync(resolve(import.meta.dirname, "routers/lmsRouter.ts"), "utf8");
const submitProcedure = source.slice(
  source.indexOf("submitInlineLessonQuiz: protectedProcedure"),
  source.indexOf("/** Restore the authenticated learner's most recent saved answers"),
);

describe("inline lesson-quiz persistence", () => {
  it("uses the database timestamp default and persists each submission against its exact block", () => {
    expect(submitProcedure).toContain('quizBlockId: z.string().min(1).max(128)');
    expect(submitProcedure).toContain('String(block.id) === input.quizBlockId');
    expect(submitProcedure).toContain('quizBlockId: input.quizBlockId');
    expect(submitProcedure).not.toContain('submittedAt: new Date()');
  });

  it("omits an unused optional account-field snapshot so legacy inline-attempt tables can save required CME surveys", () => {
    const base = {
      userId: 101,
      courseId: 202,
      lessonId: 303,
      quizBlockId: "survey-block",
      score: 0,
      passed: true,
    };
    expect(buildInlineQuizAttemptValues({ ...base, accountFieldValues: null })).toEqual(base);
    expect(buildInlineQuizAttemptValues({ ...base, accountFieldValues: '{"email":"learner@example.test"}' })).toEqual({
      ...base,
      accountFieldValues: '{"email":"learner@example.test"}',
    });
    expect(isMissingInlineQuizAccountFieldsColumn({ message: "Unknown column 'account_field_values' in 'field list'" })).toBe(true);
    expect(isMissingInlineQuizAccountFieldsColumn({ message: "Duplicate entry" })).toBe(false);
    expect(submitProcedure).toContain('isMissingInlineQuizAccountFieldsColumn(error)');
    expect(submitProcedure).toContain('message: "Your survey response could not be saved. Please try again."');
  });

  it("assures the shared attempt and response tables before any real learner submission across all courses", () => {
    expect(INLINE_LESSON_QUIZ_SCHEMA_CONTRACT).toEqual({
      attemptsTable: "lms_inline_quiz_attempts",
      responsesTable: "lms_inline_quiz_responses",
      optionalAttemptColumn: "account_field_values",
    });
    expect(submitProcedure).toContain("await ensureInlineLessonQuizSchema(db)");
    expect(submitProcedure).toContain("if (!input.isAdminPreview)");
  });

  it("applies only the additive inline-quiz compatibility steps when an older attempt table lacks the optional snapshot column", async () => {
    vi.resetModules();
    const { ensureInlineLessonQuizSchema } = await import("./lib/ensureInlineLessonQuizSchema");
    const statements: unknown[] = [];
    const legacyAttemptDb = {
      execute: async (statement: unknown) => {
        statements.push(statement);
        // The third call lists columns after both CREATE TABLE IF NOT EXISTS statements.
        return statements.length === 3 ? [[{ COLUMN_NAME: "id" }], []] : [[], []];
      },
    };
    await ensureInlineLessonQuizSchema(legacyAttemptDb as never);
    expect(statements).toHaveLength(4);
  });

  it("exposes only the authenticated learner's latest block-scoped answers for restoration", () => {
    const restoreProcedure = source.slice(source.indexOf("getInlineLessonQuizAttempt: protectedProcedure"), source.indexOf("/** Submit quiz answers */"));
    expect(restoreProcedure).toContain('eq(lmsInlineQuizAttempts.userId, ctx.user.id)');
    expect(restoreProcedure).toContain('if (!enrollment) throw new TRPCError({ code: "FORBIDDEN" });');
    expect(restoreProcedure).toContain('eq(lmsInlineQuizAttempts.quizBlockId, input.quizBlockId)');
    expect(restoreProcedure).toContain('questionKey: lmsInlineQuizResponses.questionKey');
    expect(restoreProcedure).toContain('answerValue: lmsInlineQuizResponses.answerValue');
  });
});
