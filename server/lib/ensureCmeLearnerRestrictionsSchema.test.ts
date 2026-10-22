import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CME_LEARNER_RESTRICTION_COLUMNS,
  ensureCmeLearnerRestrictionsSchema,
} from "./ensureCmeLearnerRestrictionsSchema";

describe("ensureCmeLearnerRestrictionsSchema", () => {
  it("adds only the missing additive CME learner-access columns", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ COLUMN_NAME: "id" }], []])
      .mockResolvedValueOnce([[{ COLUMN_NAME: "id" }, { COLUMN_NAME: "hide_for_cme_restricted" }], []])
      .mockResolvedValue([[], []]);

    const result = await ensureCmeLearnerRestrictionsSchema({ execute } as never);

    expect(result).toEqual({
      applied: true,
      missingBefore: ["lms_enrollments.cme_credit_restricted"],
      missingAfter: [],
      errors: [],
    });
    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls[2]).toHaveLength(1);
  });

  it("does not alter a database that already has both columns", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ COLUMN_NAME: "cme_credit_restricted" }], []])
      .mockResolvedValueOnce([[{ COLUMN_NAME: "hide_for_cme_restricted" }], []]);

    await expect(ensureCmeLearnerRestrictionsSchema({ execute } as never)).resolves.toEqual({
      applied: false,
      missingBefore: [],
      missingAfter: [],
      errors: [],
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("uses the reviewed migration column names", () => {
    expect(CME_LEARNER_RESTRICTION_COLUMNS).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "lms_enrollments", name: "cme_credit_restricted" }),
      expect.objectContaining({ table: "lms_lessons", name: "hide_for_cme_restricted" }),
    ]));
  });

  it("runs before the server accepts learner requests", async () => {
    const source = await readFile(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(source).toContain("ensureCmeLearnerRestrictionsSchema");
    expect(source.lastIndexOf("ensureCmeLearnerRestrictionsSchema")).toBeLessThan(source.lastIndexOf("server.listen(port"));
  });
});
