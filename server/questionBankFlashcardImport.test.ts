import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LMS Flashcards Question Bank import contract", () => {
  it("adds editable flashcard fields and a dedicated standalone deck type without retiring quiz types", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain('"flashcard"]).default("mcq")');
    expect(schema).toContain('flashcardFront: longtext("flashcard_front")');
    expect(schema).toContain('flashcardBack: longtext("flashcard_back")');
    expect(schema).toContain('sourceQuickfireQuestionId: int("source_quickfire_question_id")');
    expect(schema).toContain('["quiz", "mock_exam", "flashcards"]');
  });

  it("keeps app flashcards read-only sources and imports copies idempotently under the Flashcards hierarchy", () => {
    const router = read("server/routers/questionBankRouter.ts");
    expect(router).toContain("importAppFlashcards: protectedProcedure");
    expect(router).toContain('name: "Flashcards"');
    expect(router).toContain("sourceQuickfireQuestionId: card.id");
    expect(router).toContain("existingSourceIds.has(card.id)");
    expect(router).not.toContain("db.update(quickfireQuestions)");
    expect(router).not.toContain("db.delete(quickfireQuestions)");
  });
});
