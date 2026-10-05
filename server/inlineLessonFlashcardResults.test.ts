import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/routers/lmsRouter.ts"), "utf8");

describe("embedded lesson flashcard results", () => {
  it("returns only the authenticated learner's inline module attempts", () => {
    expect(source).toContain("getMyInlineModuleAttempts: protectedProcedure");
    expect(source).toContain("eq(lmsInlineQuizAttempts.userId, ctx.user.id)");
    expect(source).toContain("block.type !== \"lesson_quiz\" && block.type !== \"lesson_flashcard\"");
  });

  it("requires enrollment and every fixed or Question Bank-drawn card outcome before storing a private result", () => {
    expect(source).toContain("submitInlineLessonFlashcards: protectedProcedure");
    expect(source).toContain("if (!enrollment && !(input.isAdminPreview && ctx.user.role === \"admin\"))");
    expect(source).toContain("getInlineLessonFlashcardDeck: protectedProcedure");
    expect(source).toContain("normalizeLessonFlashcardGroupDraws");
    expect(source).toContain("if (expectedCardCount === 0 || outcomesByKey.size !== expectedCardCount)");
    expect(source).toContain('answerValue: outcomesByKey.get(sourceKey) ? "got_it" : "missed"');
  });
});
