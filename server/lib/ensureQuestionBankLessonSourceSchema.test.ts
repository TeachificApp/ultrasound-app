import { describe, expect, it, vi } from "vitest";
import { ensureQuestionBankLessonSourceSchema } from "./ensureQuestionBankLessonSourceSchema";

describe("ensureQuestionBankLessonSourceSchema", () => {
  it("returns early when db is unavailable", async () => {
    const result = await ensureQuestionBankLessonSourceSchema(null);
    expect(result.hadAllColumns).toBe(false);
    expect(result.error).toBe("Database unavailable");
  });

  it("adds missing source columns", async () => {
    const executed: string[] = [];
    const db = {
      execute: vi.fn(async (query: { queryChunks?: { value?: string[] }[] }) => {
        const sql = query.queryChunks?.map(c => c.value?.join("") ?? "").join("") ?? String(query);
        executed.push(sql);
        if (sql.includes("INFORMATION_SCHEMA")) {
          return [[{ COLUMN_NAME: "id" }]];
        }
        return [[]];
      }),
    };
    const result = await ensureQuestionBankLessonSourceSchema(db as any);
    expect(result.applied).toBe(true);
    expect(executed.some(s => s.includes("source_lesson_id"))).toBe(true);
  });

  it("skips when all columns already exist", async () => {
    const db = {
      execute: vi.fn(async (query: { queryChunks?: { value?: string[] }[] }) => {
        const sql = query.queryChunks?.map(c => c.value?.join("") ?? "").join("") ?? String(query);
        if (sql.includes("INFORMATION_SCHEMA")) {
          return [[
            { COLUMN_NAME: "source_lesson_id" },
            { COLUMN_NAME: "source_block_id" },
            { COLUMN_NAME: "source_question_index" },
          ]];
        }
        return [[]];
      }),
    };
    const result = await ensureQuestionBankLessonSourceSchema(db as any);
    expect(result.hadAllColumns).toBe(true);
    expect(result.applied).toBe(false);
  });
});
