import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./downloadStorageObject", () => ({
  downloadStorageObject: vi.fn(),
}));

import { getDb } from "../db";
import { downloadStorageObject } from "./downloadStorageObject";
import { loadLatestMediaVersionBuffer } from "./loadMediaVersionBuffer";

describe("loadLatestMediaVersionBuffer", () => {
  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue({ select: mockSelect } as any);
  });

  it("downloads via s3Key and s3Url from the latest media version", async () => {
    const zip = Buffer.from("PK\x03\x04fake-zip");
    mockLimit.mockResolvedValue([
      {
        s3Key: "media-repo/acs/advanced-cardiac.zip",
        s3Url: "https://app.allaboutultrasound.com/media/advanced-cardiac-sonographer",
      },
    ]);
    vi.mocked(downloadStorageObject).mockResolvedValue(zip);

    const result = await loadLatestMediaVersionBuffer(42);

    expect(downloadStorageObject).toHaveBeenCalledWith(
      "media-repo/acs/advanced-cardiac.zip",
      "https://app.allaboutultrasound.com/media/advanced-cardiac-sonographer",
    );
    expect(result).toBe(zip);
  });

  it("throws NOT_FOUND when no version exists", async () => {
    mockLimit.mockResolvedValue([]);

    await expect(loadLatestMediaVersionBuffer(99)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("wraps download errors as BAD_REQUEST", async () => {
    mockLimit.mockResolvedValue([
      { s3Key: "media-repo/test.zip", s3Url: "https://cdn.example/test.zip" },
    ]);
    vi.mocked(downloadStorageObject).mockRejectedValue(new Error("Download failed: HTTP 403"));

    await expect(loadLatestMediaVersionBuffer(1)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Download failed: HTTP 403",
    });
  });

  it("throws INTERNAL_SERVER_ERROR when DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(loadLatestMediaVersionBuffer(1)).rejects.toBeInstanceOf(TRPCError);
    await expect(loadLatestMediaVersionBuffer(1)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
