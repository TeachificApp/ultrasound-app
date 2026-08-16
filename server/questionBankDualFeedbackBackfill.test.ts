import { describe, expect, it, vi } from "vitest";
import { buildExistingQuestionFeedbackUpdate, resolveDualFeedbackForExistingQuestion } from "./lib/questionBankDualFeedbackBackfill";

const row = {
  id: 7,
  explanation: "",
  options: JSON.stringify([{ text: "A" }, { text: "B" }]),
};

describe("Question Bank dual-feedback backfill", () => {
  it("retries an incomplete batch response and builds a persisted update for an existing question", async () => {
    const retry = vi.fn(async () => ({
      id: 7,
      correctFeedback: "B is correct because it meets the criterion.",
      incorrectFeedback: "Review the criterion; B is the correct answer.",
      optionFeedback: ["A does not meet the criterion.", "B meets the criterion."],
    }));
    const resolved = await resolveDualFeedbackForExistingQuestion(row, {
      id: 7,
      correctFeedback: "Partial",
      incorrectFeedback: "Partial",
      optionFeedback: ["Only one option"],
    }, retry);
    const update = buildExistingQuestionFeedbackUpdate(row, resolved);
    expect(retry).toHaveBeenCalledOnce();
    expect(update).toMatchObject({
      correctFeedback: "B is correct because it meets the criterion.",
      incorrectFeedback: "Review the criterion; B is the correct answer.",
      explanation: "B is correct because it meets the criterion.",
    });
    expect(JSON.parse(update.options)).toEqual([
      { text: "A", feedback: "A does not meet the criterion." },
      { text: "B", feedback: "B meets the criterion." },
    ]);
  });

  it("rejects an incomplete retry so an existing Question Bank row is not overwritten", async () => {
    await expect(resolveDualFeedbackForExistingQuestion(row, undefined, async () => ({
      id: 7,
      correctFeedback: "Only correct feedback",
      incorrectFeedback: "",
      optionFeedback: [],
    }))).rejects.toThrow("Incomplete dual feedback returned for Question Bank item 7");
  });
});
