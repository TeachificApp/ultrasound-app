import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("cohort drip feature contracts", () => {
  it("filters learner schedule items by linked lesson and item release days", async () => {
    const source = await read("./routers/lmsRouter.ts");
    expect(source).toContain("const [sessions, rawAssignments, rawRecordings");
    expect(source).toContain(
      "cohortLessonReleaseDay(lessonDripDays.get(assignment.lessonId ?? -1), assignment.dripDays)"
    );
    expect(source).toContain(
      "isCohortItemReleased({ enrolledAt: enrollmentDate, dripDays: recording.dripDays"
    );
    expect(source).toContain(
      "myGroup?.recordingsEnabled === false ? [] : rawRecordings"
    );
  });

  it("guards assignment detail, submission, and recording playback routes", async () => {
    const source = await read("./routers/lmsRouter.ts");
    expect(source).toContain("submitCohortAssignment:");
    expect(source).toContain("getAssignmentDetail:");
    expect(source).toContain("getCohortRecording:");
    expect(
      source.match(/isCohortItemReleased\(/g)?.length ?? 0
    ).toBeGreaterThanOrEqual(6);
    expect(source).toContain("Recordings are disabled for this cohort.");
  });

  it("exposes admin controls and hides the learner Replays tab", async () => {
    const admin = await read("../client/src/pages/admin/LMSAdmin.tsx");
    const learner = await read("../client/src/pages/CohortSchedule.tsx");
    expect(admin).toContain("Linked lesson (optional)");
    expect(admin).toContain("Release basis");
    expect(admin).toContain("After enrollment");
    expect(admin).toContain("After publish");
    expect(admin).toContain("After cohort start date");
    expect(admin).toContain("Show Recordings tab to learners");
    expect(learner).toContain("myGroup?.recordingsEnabled !== false");
  });

  it("preserves the new release controls when duplicating a cohort group", async () => {
    const source = await read("./routers/lmsCohortAdminRouter.ts");
    expect(source).toContain("recordingsEnabled: source.recordingsEnabled");
    expect(source).toContain("lessonId: assignment.lessonId");
    expect(source).toContain("dripDays: assignment.dripDays");
    expect(source).toContain("dripDays: recording.dripDays");
  });
});
