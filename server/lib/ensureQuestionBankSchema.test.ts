import { describe, expect, it, vi } from "vitest";
import { ensureQuestionBankSchema } from "./ensureQuestionBankSchema";

describe("ensureQuestionBankSchema", () => {
  it("adds missing question_bank columns idempotently", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([
          { COLUMN_NAME: "id" },
          { COLUMN_NAME: "question" },
          { COLUMN_NAME: "explanation" },
        ])
        .mockImplementation(execute),
    };

    const result = await ensureQuestionBankSchema(db as any);

    expect(result.applied).toContain("source_lesson_id");
    expect(result.applied).toContain("builder_question_payload");
    expect(execute).toHaveBeenCalled();
  });

  it("skips alters when all columns already exist", async () => {
    const execute = vi.fn();
    const db = {
      execute: vi.fn().mockResolvedValueOnce(
        [
          "source_lesson_id",
          "source_block_id",
          "source_question_index",
          "correct_feedback",
          "incorrect_feedback",
          "builder_question_payload",
        ].map((name) => ({ COLUMN_NAME: name })),
      ),
    };

    const result = await ensureQuestionBankSchema(db as any);

    expect(result.applied).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
});
