import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const lmsRouter = readFileSync(resolve(process.cwd(), "server/routers/lmsRouter.ts"), "utf8");
const analyticsRouter = readFileSync(resolve(process.cwd(), "server/routers/analyticsRouter.ts"), "utf8");
const protectedDownloads = readFileSync(resolve(process.cwd(), "server/routes/learnerProtectedDownloads.ts"), "utf8");
const coursePlayer = readFileSync(resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"), "utf8");
const cohortResourceCard = readFileSync(resolve(process.cwd(), "client/src/components/cohort/CohortResourceCard.tsx"), "utf8");

describe("learner activity tracking", () => {
  it("records named module and lesson access plus first completion", () => {
    expect(lmsRouter).toContain('eventType: "lesson_access"');
    expect(lmsRouter).toContain("Accessed module:");
    expect(lmsRouter).toContain("eventType: 'lesson_complete'");
    expect(lmsRouter).toContain("Completed module lesson:");
  });

  it("tracks lesson-attached downloads and cohort resource clicks through authorised endpoints", () => {
    expect(lmsRouter).toContain("recordLessonFileDownload: protectedProcedure");
    expect(lmsRouter).toContain("recordCohortResourceAccess: protectedProcedure");
    expect(coursePlayer).toContain("recordLessonFileDownload.mutate");
    expect(cohortResourceCard).toContain("recordResourceAccess.mutate");
  });

  it("records free and paid file deliveries after storage retrieval", () => {
    expect(protectedDownloads).toContain("if (!inline) {");
    expect(protectedDownloads).toContain("purchaseId: purchase?.id ?? null");
    expect(protectedDownloads).toContain("productTitle: purchase?.productTitle ?? product.title");
  });

  it("stores title-rich course and cohort video milestones", () => {
    expect(analyticsRouter).toContain("video:");
    expect(analyticsRouter).toContain('eventType === "play"');
    expect(lmsRouter).toContain("Accessed cohort recording:");
    expect(lmsRouter).toContain("cohort recording:");
    expect(lmsRouter).toContain('input.eventType === "complete" ? "Completed" : "Started"');
    expect(coursePlayer).toContain('trackVideo("play"');
    expect(coursePlayer).toContain('trackVideo("complete"');
  });
});
