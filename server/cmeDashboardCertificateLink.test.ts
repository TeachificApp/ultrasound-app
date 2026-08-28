import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("dashboard course certificate link", () => {
  it("returns certificateUrl on completed course cards and renders a Certificate action", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "server/routers/dashboardRouter.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/StudentDashboardPage.tsx"), "utf8");
    expect(dashboard).toContain("certificateUrl");
    expect(dashboard).toContain("coursesWithCerts");
    expect(page).toContain('label: "Certificate"');
    expect(page).toContain("external: true");
  });
});

describe("course overview enrollment access", () => {
  it("uses slug-joined resolveEnrollmentByCourseSlug aligned with dashboard My Content", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers/lmsRouter.ts"), "utf8");
    const access = readFileSync(resolve(process.cwd(), "server/lib/enrollmentAccess.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/CourseOverview.tsx"), "utf8");
    expect(access).toContain("resolveEnrollmentByCourseSlug");
    expect(router).toContain("resolveEnrollmentByCourseSlug");
    expect(router).toContain("inArray(lmsLessons.sectionId, sectionIds)");
    expect(page).toContain('error.data?.code === "FORBIDDEN"');
  });

  it("loads section-owned lessons in getCoursePlayer, not only course_id rows", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers/lmsRouter.ts"), "utf8");
    const playerStart = router.indexOf("getCoursePlayer:");
    expect(playerStart).toBeGreaterThan(-1);
    const nextProcedure = router.indexOf("\n  /** Get a single lesson", playerStart);
    const playerChunk = router.slice(playerStart, nextProcedure > playerStart ? nextProcedure : playerStart + 8000);
    expect(playerChunk).toContain("const lessonScope = sectionIds.length > 0");
    expect(playerChunk).toContain("inArray(lmsLessons.sectionId, sectionIds)");
    expect(playerChunk).toContain("and(lessonScope, eq(lmsLessons.lessonStatus");
  });
});
