import { describe, expect, it } from "vitest";
import { LMS_COURSES_REQUIRED_COLUMNS } from "./lib/ensureLmsCoursesSchema";

describe("ensureLmsCoursesSchema", () => {
  it("tracks bundle_only and show_in_library as required mirror-gap columns", () => {
    expect(LMS_COURSES_REQUIRED_COLUMNS).toContain("bundle_only");
    expect(LMS_COURSES_REQUIRED_COLUMNS).toContain("show_in_library");
    expect(LMS_COURSES_REQUIRED_COLUMNS.length).toBeGreaterThan(40);
  });

  it("is wired into server startup", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./_core/index.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("ensureLmsCoursesSchema");
    expect(source).toContain("/api/debug/lms-courses-schema");
  });

  it("ships a manual SQL fallback for Railway MySQL", async () => {
    const sql = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../drizzle/railway_lms_courses_schema_sync.sql", import.meta.url), "utf8"),
    );
    expect(sql).toContain("bundle_only");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
  });
});
