import { describe, expect, it } from "vitest";
import { cohortCourseContentWhere, cohortGroupScopeFilter } from "./lib/cohortGroupQuery";
import { lmsCohortRecordings } from "../drizzle/schema";

describe("cohortGroupContentFilter", () => {
  it("returns undefined scope when no cohort group is selected", () => {
    expect(cohortGroupScopeFilter(lmsCohortRecordings.cohortGroupId, undefined)).toBeUndefined();
  });

  it("returns a filter when a cohort group is selected", () => {
    expect(cohortGroupScopeFilter(lmsCohortRecordings.cohortGroupId, 150001)).toBeTruthy();
  });

  it("builds scoped and unscoped course filters", () => {
    expect(
      cohortCourseContentWhere(
        lmsCohortRecordings.courseId,
        lmsCohortRecordings.cohortGroupId,
        690002,
        150001,
      ),
    ).toBeTruthy();
    expect(
      cohortCourseContentWhere(
        lmsCohortRecordings.courseId,
        lmsCohortRecordings.cohortGroupId,
        690002,
      ),
    ).toBeTruthy();
  });

  it("admin list queries use shared cohort content filter", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("cohortCourseContentWhere");
    expect(source).not.toContain("eq(lmsCohortRecordings.cohortGroupId, input.cohortGroupId)");
  });
});
