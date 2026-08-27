import { describe, it, expect } from "vitest";

/** Mirrors bulkAddTags dedup logic in questionBankRouter. */
function buildTagInserts(
  questionIds: number[],
  tagIds: number[],
  existing: Array<{ questionId: number; tagId: number }>,
) {
  const existingSet = new Set(existing.map(r => `${r.questionId}:${r.tagId}`));
  return questionIds.flatMap(questionId =>
    tagIds
      .filter(tagId => !existingSet.has(`${questionId}:${tagId}`))
      .map(tagId => ({ questionId, tagId })),
  );
}

describe("question bank bulk tag inserts", () => {
  it("skips mappings that already exist", () => {
    const inserts = buildTagInserts(
      [1, 2],
      [10, 11],
      [
        { questionId: 1, tagId: 10 },
        { questionId: 2, tagId: 11 },
      ],
    );
    expect(inserts).toEqual([
      { questionId: 1, tagId: 11 },
      { questionId: 2, tagId: 10 },
    ]);
  });

  it("creates all combinations when none exist", () => {
    const inserts = buildTagInserts([5], [7, 8], []);
    expect(inserts).toEqual([
      { questionId: 5, tagId: 7 },
      { questionId: 5, tagId: 8 },
    ]);
  });
});
