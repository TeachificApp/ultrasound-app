import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cohortScheduleSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/CohortSchedule.tsx"),
  "utf8",
);

describe("My Cohort course modules navigation", () => {
  it("provides a Course Modules link within the contextual cohort tab menu", () => {
    expect(cohortScheduleSource).toContain('href={`/courses/${course.slug}/player`}');
    expect(cohortScheduleSource).toContain("Course Modules");
    expect(cohortScheduleSource).toContain("<TabsList");
  });
});
