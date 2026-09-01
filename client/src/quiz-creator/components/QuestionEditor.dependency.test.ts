import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./QuestionEditor.tsx", import.meta.url), "utf8");

describe("Visual Quiz Builder dependent-question authoring", () => {
  it("keeps the simple dependent-question controls available alongside advanced branching", () => {
    expect(source).toContain("Dependent Question");
    expect(source).toContain("Prior question");
    expect(source).toContain("Show when the answer is");
    expect(source).toContain("Hidden questions are skipped in learner navigation and scoring.");
  });

  it("limits the simple dependency source to a prior question and stores the exact selected answer", () => {
    expect(source).toContain("candidate.order < question.order");
    expect(source).toContain("parentQuestionId: selectedParent.id");
    expect(source).toContain("expectedAnswer");
  });
});
