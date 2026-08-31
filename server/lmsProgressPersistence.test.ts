import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers/lmsRouter.ts"), "utf8");
const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");

describe("LMS lesson progress persistence", () => {
  it("uses one authoritative progress row per enrollment and lesson", () => {
    expect(schemaSource).toContain('uniqueIndex("lms_lesson_progress_enrollment_lesson_unique")');
    expect(schemaSource).toContain(".on(table.enrollmentId, table.lessonId)");
  });

  it("makes lesson opening, direct completion, and quiz completion race-safe", () => {
    const progressProcedureSource = routerSource.slice(
      routerSource.indexOf("recordLessonOpened: protectedProcedure"),
      routerSource.indexOf("/** Submit quiz answers */"),
    );
    expect(progressProcedureSource.match(/\.onDuplicateKeyUpdate\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(progressProcedureSource).toContain("COALESCE(");
    expect(progressProcedureSource).toContain("attempts: sql`${lmsLessonProgress.attempts} + 1`");
  });
});
