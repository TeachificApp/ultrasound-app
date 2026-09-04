import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "LessonFlashcardBlockEditor.tsx"), "utf8");

describe("lesson flashcard Question Bank authoring", () => {
  it("offers a Question Bank picker, preserves canonical IDs, and explains save synchronization", () => {
    expect(source).toContain('TabsTrigger value="bank"');
    expect(source).toContain("FlashcardBankPicker");
    expect(source).toContain("questionBankId: bankCard.id");
    expect(source).toContain("when you save the lesson");
  });
});
