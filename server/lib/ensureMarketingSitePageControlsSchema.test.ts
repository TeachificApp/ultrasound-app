import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureMarketingSitePageControlsSchema } from "./ensureMarketingSitePageControlsSchema";

describe("ensureMarketingSitePageControlsSchema", () => {
  const execute = vi.fn();
  const db = { execute } as any;

  beforeEach(() => execute.mockReset());

  it("does not alter a database that already has every public-site control", async () => {
    execute
      .mockResolvedValueOnce([[{ COLUMN_NAME: "parentId" }, { COLUMN_NAME: "hideInNavigation" }, { COLUMN_NAME: "visibility" }, { COLUMN_NAME: "sitePasswordHash" }, { COLUMN_NAME: "headerType" }, { COLUMN_NAME: "seoKeywords" }, { COLUMN_NAME: "headerCode" }, { COLUMN_NAME: "footerCode" }, { COLUMN_NAME: "hideFromSearch" }, { COLUMN_NAME: "blogSidebarMode" }, { COLUMN_NAME: "blogSidebarBlocks" }], []])
      .mockResolvedValueOnce([[{ INDEX_NAME: "marketing_site_pages_site_parent_order_idx" }], []]);

    await expect(ensureMarketingSitePageControlsSchema(db)).resolves.toEqual({ applied: [], missingBefore: [] });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("adds only missing controls and the page tree index", async () => {
    execute
      .mockResolvedValueOnce([[{ COLUMN_NAME: "id" }], []])
      .mockResolvedValue([[], []]);

    const result = await ensureMarketingSitePageControlsSchema(db);
    expect(result.missingBefore).toHaveLength(11);
    expect(result.applied).toContain("parentId");
    expect(result.applied).toContain("hideFromSearch");
    expect(result.applied).toContain("blogSidebarMode");
    expect(result.applied).toContain("blogSidebarBlocks");
    expect(result.applied).toContain("marketing_site_pages_site_parent_order_idx");
    expect(execute).toHaveBeenCalledTimes(14);
  });

  it("reports database unavailability without attempting a change", async () => {
    await expect(ensureMarketingSitePageControlsSchema(null)).resolves.toEqual({ applied: [], missingBefore: [], error: "Database unavailable" });
    expect(execute).not.toHaveBeenCalled();
  });
});
