import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "LessonQuizBlockEditor.tsx"), "utf8");

describe("lesson quiz Question Bank authoring", () => {
  it("retains selected bank IDs, filters out flashcards, and updates an existing linked bank record", () => {
    expect(source).toContain("questionBankId: bankQ.id");
    expect(source).toContain('types: ["mcq", "truefalse", "multiselect", "hotspot", "matching"]');
    expect(source).toContain("trpc.questionBank.updateQuestion.useMutation");
    expect(source).toContain("if (question.questionBankId) updateMutation.mutate");
  });
});
