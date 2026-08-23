#!/usr/bin/env node
/**
 * Backfill lesson completion for current CME/certificate enrollments so learners
 * can reach the final CME quiz. Marks all content lessons complete and leaves
 * the SDMS CME / final quiz lesson available to take.
 *
 * Usage:
 *   DATABASE_URL=... JWT_SECRET=... pnpm exec tsx scripts/backfill-cme-lesson-progress.mjs
 *   pnpm exec tsx scripts/backfill-cme-lesson-progress.mjs --apply
 *   pnpm exec tsx scripts/backfill-cme-lesson-progress.mjs --apply --course-slug pediatric-echo-cohort
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    "course-id": { type: "string" },
    "course-slug": { type: "string" },
  },
});

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is required");
  process.exit(1);
}

const { backfillCmeEnrollmentProgress } = await import("../server/lib/cmeProgressBackfill.ts");

const summary = await backfillCmeEnrollmentProgress({
  dryRun: !values.apply,
  courseId: values["course-id"] ? Number(values["course-id"]) : undefined,
  courseSlug: values["course-slug"],
});

console.log(JSON.stringify({
  mode: summary.dryRun ? "dry-run" : "apply",
  coursesScanned: summary.coursesScanned,
  enrollmentsScanned: summary.enrollmentsScanned,
  enrollmentsUpdated: summary.enrollmentsUpdated,
  lessonsMarked: summary.lessonsMarked,
  cmeLessonsMarked: summary.cmeLessonsMarked,
  certificatesIssued: summary.certificatesIssued,
  sample: summary.results.slice(0, 25),
}, null, 2));

if (summary.dryRun) {
  console.error("\nDry run only. Re-run with --apply to write changes.");
}
