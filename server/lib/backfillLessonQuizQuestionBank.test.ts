import { describe, expect, it, vi } from "vitest";
import { users } from "../../drizzle/schema";

vi.mock("./lessonQuizQuestionBankSync", () => ({
  syncLessonQuizToQuestionBank: vi.fn().mockResolvedValue({ created: 2, updated: 1 }),
}));

import { backfillLessonQuizQuestionBank } from "./backfillLessonQuizQuestionBank";
import { syncLessonQuizToQuestionBank } from "./lessonQuizQuestionBankSync";

describe("backfillLessonQuizQuestionBank", () => {
  it("dry-run reports lesson count without syncing", async () => {
    const summary = await backfillLessonQuizQuestionBank(
      {
        select: () => ({
          from: (table: unknown) => ({
            where: () => (table === users ? [{ id: 7 }] : []),
          }),
        }),
      } as any,
      { dryRun: true, lessonIds: [22, 23] },
    );
    expect(summary.lessonsWithQuizContent).toBe(2);
    expect(summary.questionsCreated).toBe(0);
    expect(syncLessonQuizToQuestionBank).not.toHaveBeenCalled();
  });

  it("syncs each provided lesson when applying", async () => {
    vi.mocked(syncLessonQuizToQuestionBank).mockClear();
    const summary = await backfillLessonQuizQuestionBank(
      {
        select: () => ({
          from: (table: unknown) => ({
            where: () => (table === users ? [{ id: 7 }] : []),
          }),
        }),
      } as any,
      { dryRun: false, lessonIds: [22, 23], adminId: 7 },
    );
    expect(summary.lessonsScanned).toBe(2);
    expect(summary.questionsCreated).toBe(4);
    expect(summary.questionsUpdated).toBe(2);
    expect(syncLessonQuizToQuestionBank).toHaveBeenCalledTimes(2);
    expect(syncLessonQuizToQuestionBank).toHaveBeenCalledWith(expect.anything(), 22, 7);
  });
});
