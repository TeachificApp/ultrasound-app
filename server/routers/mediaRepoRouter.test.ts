import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../_core/email", () => ({ sendEmail: vi.fn() }));

import { mediaRepoRouter } from "./mediaRepoRouter";

function makeDb(statusRows: Array<{ status: string; count: number }>) {
  let selectCall = 0;
  return {
    select: vi.fn(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return {
          from: () => ({ where: () => ({ limit: async () => [{ role: "admin", openId: "admin-open-id" }] }) }),
        };
      }
      if (selectCall === 2) {
        return {
          from: () => ({ groupBy: () => ({ as: () => ({ assetId: "assetId", versionNumber: "versionNumber" }) }) }),
        };
      }
      return {
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({ groupBy: async () => statusRows }),
            }),
          }),
        }),
      };
    }),
  };
}

describe("mediaRepo.getScormBackfillSummary", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("returns live queued, extracting, ready, and failed counts from latest package versions", async () => {
    getDbMock.mockResolvedValue(
      makeDb([
        { status: "pending", count: 7 },
        { status: "processing", count: 1 },
        { status: "done", count: 12 },
        { status: "failed", count: 2 },
      ]),
    );

    const caller = mediaRepoRouter.createCaller({ user: { id: 1, role: "admin" } } as any);
    await expect(caller.getScormBackfillSummary()).resolves.toEqual({
      counts: { pending: 7, processing: 1, done: 12, failed: 2, skipped: 0 },
      total: 22,
    });
  });
});
