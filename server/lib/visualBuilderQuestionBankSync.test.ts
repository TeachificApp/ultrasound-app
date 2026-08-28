import { describe, expect, it } from "vitest";
import {
  builderQuestionFromQuestionBank,
  mergeCanonicalBuilderQuestion,
  questionBankIdFromBuilderId,
  questionBankValuesFromBuilderQuestion,
} from "./visualBuilderQuestionBankSync";

describe("Visual Builder Question Bank synchronization", () => {
  const builderQuestion = {
    id: "bank-42", type: "mcq", order: 3, points: 2, required: true, groupId: "vascular",
    stem: "Which finding supports reflux?", explanation: "Retrograde flow supports reflux.",
    feedback: { correct: "Correct rationale.", incorrect: "Review reflux criteria." },
    data: { multiple: false, choices: [{ id: "0", text: "Retrograde flow", correct: true }, { id: "1", text: "No flow", correct: false }] },
  };

  it("uses stable Question Bank identifiers for linked builder questions", () => {
    expect(questionBankIdFromBuilderId("bank-42")).toBe(42);
    expect(questionBankIdFromBuilderId("draft-42")).toBeNull();
  });

  it("maps editable clinical content and feedback into canonical Question Bank fields", () => {
    const values = questionBankValuesFromBuilderQuestion(builderQuestion);
    expect(values).toMatchObject({
      question: "Which finding supports reflux?",
      type: "mcq",
      correctAnswer: "0",
      correctFeedback: "Correct rationale.",
      incorrectFeedback: "Review reflux criteria.",
    });
    expect(JSON.parse(values.options ?? "[]")[0]).toMatchObject({ text: "Retrograde flow" });
  });

  it("hydrates canonical content while preserving quiz-only order and group presentation", () => {
    const canonical = builderQuestionFromQuestionBank({
      sqq: { sortOrder: 0, points: 1, shuffleAnswerOptions: false, lockAnswerOrder: false },
      qb: { id: 42, builderQuestionPayload: JSON.stringify({ ...builderQuestion, stem: "Canonical reflux question" }) },
    });
    const merged = mergeCanonicalBuilderQuestion(builderQuestion, canonical);
    expect(merged.stem).toBe("Canonical reflux question");
    expect(merged.id).toBe("bank-42");
    expect(merged.order).toBe(3);
    expect(merged.groupId).toBe("vascular");
  });

  it("preserves an explicit quiz-only override instead of silently replacing it from Question Bank", () => {
    const override = { ...builderQuestion, stem: "Quiz-only wording", questionBankOverride: true };
    const canonical = { ...builderQuestion, stem: "Question Bank wording" };
    expect(mergeCanonicalBuilderQuestion(override, canonical).stem).toBe("Quiz-only wording");
  });
});
