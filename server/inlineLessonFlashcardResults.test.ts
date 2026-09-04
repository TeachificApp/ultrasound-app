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

  it("requires enrollment and every valid card outcome before storing a private flashcard result", () => {
    expect(source).toContain("submitInlineLessonFlashcards: protectedProcedure");
    expect(source).toContain("if (!enrollment && !(input.isAdminPreview && ctx.user.role === \"admin\"))");
    expect(source).toContain("if (outcomesByIndex.size !== cards.length)");
    expect(source).toContain('answerValue: outcomesByIndex.get(index) ? "got_it" : "missed"');
  });
});
