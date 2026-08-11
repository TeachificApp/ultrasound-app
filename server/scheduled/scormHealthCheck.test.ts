import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("../db", () => ({ getDb: getDbMock }));

import { healStuckScormVersions } from "./scormHealthCheck";

describe("healStuckScormVersions", () => {
  beforeEach(() => getDbMock.mockReset());

  it("requeues an interrupted processing package and never changes it to skipped", async () => {
    const whereUpdate = vi.fn().mockResolvedValue(undefined);
    const setUpdate = vi.fn(() => ({ where: whereUpdate }));
    const db = {
      select: vi.fn(() => ({
        from: () => ({
          where: async () => [{ id: 42, scormExtractionStatus: "processing", s3Url: "https://cdn.example.com/review.zip" }],
        }),
      })),
      update: vi.fn(() => ({ set: setUpdate })),
    };
    getDbMock.mockResolvedValue(db);

    await expect(healStuckScormVersions()).resolves.toEqual({ healed: 1 });
    expect(setUpdate).toHaveBeenCalledWith(expect.objectContaining({
      scormExtractionStatus: "pending",
      scormExtractionStartedAt: null,
    }));
  });
});
