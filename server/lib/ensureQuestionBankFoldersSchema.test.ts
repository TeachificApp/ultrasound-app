import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureQuestionBankFoldersSchema } from "./ensureQuestionBankFoldersSchema";

describe("ensureQuestionBankFoldersSchema", () => {
  const execute = vi.fn();
  const db = { execute } as any;

  beforeEach(() => {
    execute.mockReset();
  });

  it("skips when sort_order already exists", async () => {
    execute.mockResolvedValueOnce([[{ COLUMN_NAME: "sort_order" }, { COLUMN_NAME: "quiz_logo_url" }], []]);
    const result = await ensureQuestionBankFoldersSchema(db);
    expect(result).toEqual({ applied: false, hadSortOrder: true, hadQuizLogoUrl: true });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("adds sort_order when missing", async () => {
    execute
      .mockResolvedValueOnce([[{ COLUMN_NAME: "name" }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[], []]);
    const result = await ensureQuestionBankFoldersSchema(db);
    expect(result.applied).toBe(true);
    expect(result.hadQuizLogoUrl).toBe(false);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("returns unavailable when db is null", async () => {
    const result = await ensureQuestionBankFoldersSchema(null);
    expect(result.error).toBe("Database unavailable");
  });
});
