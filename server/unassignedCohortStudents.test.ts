import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { filterUnassignedCohortEnrollments } from "./lib/unassignedCohortStudents";

describe("filterUnassignedCohortEnrollments", () => {
  const enrolled = [
    { enrollmentId: 1, userId: 10, userName: "Terry" },
    { enrollmentId: 2, userId: 11, userName: "Shannon" },
    { enrollmentId: 3, userId: 12, userName: "Brandey" },
    { enrollmentId: 4, userId: 13, userName: "Stephanie" },
  ];

  it("returns enrollments with no cohort-group row for that enrollment id", () => {
    const result = filterUnassignedCohortEnrollments(enrolled, [1]);
    expect(result.map((r) => r.userName)).toEqual(["Shannon", "Brandey", "Stephanie"]);
  });

  it("does not treat userId-only cohort rows as assigned when enrollmentId differs", () => {
    // Orphan row: userId linked but enrollmentId=0 — Students tab still shows Unassigned.
    const result = filterUnassignedCohortEnrollments(enrolled, [0]);
    expect(result).toHaveLength(4);
  });

  it("ignores invalid enrollment ids in the assigned set", () => {
    const result = filterUnassignedCohortEnrollments(enrolled, [-1, 0]);
    expect(result).toHaveLength(4);
  });
});

describe("listUnassignedCohortStudents query alignment", () => {
  const cohortRouter = readFileSync(
    new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url),
    "utf8",
  );

  it("matches Students tab logic (enrollmentId join, no lms_enrollments.status filter)", () => {
    expect(cohortRouter).toContain("enrollmentId: lmsCohortGroupEnrollments.enrollmentId");
    expect(cohortRouter).toContain("innerJoin(lmsCohortGroups");
    expect(cohortRouter).not.toContain("eq(lmsEnrollments.status, \"active\")");
    expect(cohortRouter).toContain("filterUnassignedCohortEnrollments");
  });
});
