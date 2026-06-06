import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichCohortResources } from "./lib/cohortResources";
import type { LmsCohortResource } from "../drizzle/schema";

function baseRow(overrides: Partial<LmsCohortResource> = {}): LmsCohortResource {
  return {
    id: 1,
    courseId: 10,
    cohortGroupId: null,
    title: "Test Resource",
    description: "Desc",
    cardImageUrl: null,
    actionType: "link",
    linkUrl: "https://example.com/guide",
    downloadSource: null,
    fileUrl: null,
    fileKey: null,
    fileName: null,
    mediaAssetId: null,
    downloadProductId: null,
    status: "published",
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("enrichCohortResources", () => {
  const mockDb = {
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves link action URL and course scope", async () => {
    const rows = [baseRow()];
    const result = await enrichCohortResources(mockDb as any, rows);
    expect(result[0].actionUrl).toBe("https://example.com/guide");
    expect(result[0].scope).toBe("course");
  });

  it("marks cohort scope when cohortGroupId is set", async () => {
    const rows = [baseRow({ cohortGroupId: 5 })];
    const result = await enrichCohortResources(mockDb as any, rows);
    expect(result[0].scope).toBe("cohort");
  });

  it("resolves upload download source from fileUrl", async () => {
    const rows = [
      baseRow({
        actionType: "download",
        linkUrl: null,
        downloadSource: "upload",
        fileUrl: "https://cdn.example.com/file.pdf",
        fileName: "guide.pdf",
      }),
    ];
    const result = await enrichCohortResources(mockDb as any, rows);
    expect(result[0].actionUrl).toBe("https://cdn.example.com/file.pdf");
    expect(result[0].downloadFileName).toBe("guide.pdf");
  });

  it("resolves download product slug path", async () => {
    const limit = vi.fn().mockResolvedValue([{ slug: "study-pack", title: "Study Pack" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    const rows = [
      baseRow({
        actionType: "download",
        linkUrl: null,
        downloadSource: "download_product",
        downloadProductId: 99,
      }),
    ];
    const result = await enrichCohortResources(mockDb as any, rows);
    expect(result[0].actionUrl).toBe("/downloads/study-pack");
    expect(result[0].downloadProductTitle).toBe("Study Pack");
  });
});
