import { describe, expect, it } from "vitest";
import { LMS_COHORT_GROUPS_REQUIRED_COLUMNS } from "./lib/ensureLmsCohortGroupsSchema";

describe("ensureLmsCohortGroupsSchema", () => {
  it("tracks landing_blocks and waitlist columns as required mirror-gap columns", () => {
    expect(LMS_COHORT_GROUPS_REQUIRED_COLUMNS).toContain("landing_blocks");
    expect(LMS_COHORT_GROUPS_REQUIRED_COLUMNS).toContain("waitlist_enabled");
    expect(LMS_COHORT_GROUPS_REQUIRED_COLUMNS).toContain("presale_welcome_heading");
    expect(LMS_COHORT_GROUPS_REQUIRED_COLUMNS.length).toBe(16);
  });

  it("is wired into server startup and debug endpoints", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./_core/index.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("ensureLmsCohortGroupsSchema");
    expect(source).toContain("/api/debug/lms-cohort-groups-schema");
    expect(source).toContain("/api/debug/lms-cohort-groups-schema-sync");
  });

  it("ships a manual SQL fallback for Railway MySQL", async () => {
    const sql = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../drizzle/0044_cohort_groups_schema_sync.sql", import.meta.url), "utf8"),
    );
    expect(sql).toContain("landing_blocks");
    expect(sql).toContain("ADD COLUMN `landing_blocks`");
    expect(sql).not.toContain("IF NOT EXISTS");
  });

  it("adds missing columns via INFORMATION_SCHEMA checks", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./lib/ensureLmsCohortGroupsSchema.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("LMS_COHORT_GROUPS_COLUMN_DEFS");
    expect(source).toContain("existingColumns.has(column)");
    expect(source).toContain("extractExecuteRows");
  });

  it("admin listCohortGroups uses full-table select", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url), "utf8"),
    );
    expect(source).toMatch(/listCohortGroups:[\s\S]*?\.from\(lmsCohortGroups\)/);
  });
});
