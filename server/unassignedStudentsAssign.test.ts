import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workshopRouter = readFileSync(
  new URL("./routers/workshopRouter.ts", import.meta.url),
  "utf8",
);
const cohortRouter = readFileSync(
  new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url),
  "utf8",
);
const workshopsAdmin = readFileSync(
  new URL("../client/src/pages/admin/WorkshopsAdmin.tsx", import.meta.url),
  "utf8",
);
const lmsAdmin = readFileSync(
  new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url),
  "utf8",
);
const panel = readFileSync(
  new URL("../client/src/components/cohort/UnassignedStudentsAssignPanel.tsx", import.meta.url),
  "utf8",
);

describe("Unassigned students — cohort group management", () => {
  it("exposes listUnassignedCohortStudents and assign endpoints", () => {
    expect(cohortRouter).toContain("listUnassignedCohortStudents:");
    expect(cohortRouter).toContain("assignStudentToCohortGroup:");
    expect(cohortRouter).toContain("bulkAssignStudentsToCohortGroup:");
  });

  it("shows unassigned students in per-group manage panel", () => {
    expect(lmsAdmin).toContain("UnassignedStudentsAssignPanel");
    expect(lmsAdmin).toContain("listUnassignedCohortStudents.useQuery");
    expect(lmsAdmin).toContain("Add unassigned students to this group");
    expect(lmsAdmin).toContain("lockGroupSelection={!!groupEnrollGroupId}");
  });
});

describe("Unassigned students — workshop instance management", () => {
  it("exposes instance student listing and assignment endpoints", () => {
    expect(workshopRouter).toContain("listWorkshopInstanceStudents:");
    expect(workshopRouter).toContain("listUnassignedWorkshopStudents:");
    expect(workshopRouter).toContain("assignStudentToWorkshopInstance:");
    expect(workshopRouter).toContain("row.instanceId == null || !validIds.has(row.instanceId)");
  });

  it("wires manage-students UI with unassigned panel", () => {
    expect(workshopsAdmin).toContain("WorkshopInstanceStudentsPanel");
    expect(workshopsAdmin).toContain("UnassignedStudentsAssignPanel");
    expect(workshopsAdmin).toContain("listUnassignedWorkshopStudents.useQuery");
    expect(workshopsAdmin).toContain("Manage Students");
    expect(workshopsAdmin).toContain("selectedInstanceIdForStudents");
  });
});

describe("UnassignedStudentsAssignPanel", () => {
  it("supports single and bulk assign actions", () => {
    expect(panel).toContain("Unassigned students");
    expect(panel).toContain("onBulkAssign");
    expect(panel).toContain("Add ${bulkSelected.length} selected");
    expect(panel).toContain("isLoading");
  });
});
