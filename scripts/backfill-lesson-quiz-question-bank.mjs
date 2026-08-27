#!/usr/bin/env node
/**
 * Backfill all existing lesson quiz questions into Question Bank folders:
 *   Lesson Quiz → {Course Name}
 *
 * Usage:
 *   DATABASE_URL=... JWT_SECRET=... pnpm exec tsx scripts/backfill-lesson-quiz-question-bank.mjs
 *   pnpm exec tsx scripts/backfill-lesson-quiz-question-bank.mjs --apply
 *   pnpm exec tsx scripts/backfill-lesson-quiz-question-bank.mjs --apply --lesson-id 42
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    "lesson-id": { type: "string" },
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

const { getDb } = await import("../server/db.ts");
const { backfillLessonQuizQuestionBank } = await import("../server/lib/backfillLessonQuizQuestionBank.ts");

const db = await getDb();
if (!db) {
  console.error("Database unavailable");
  process.exit(1);
}

const summary = await backfillLessonQuizQuestionBank(db, {
  dryRun: !values.apply,
  lessonIds: values["lesson-id"] ? [Number(values["lesson-id"])] : undefined,
});

console.log(JSON.stringify(summary, null, 2));

if (summary.dryRun) {
  console.log("\nDry run only. Re-run with --apply to sync questions into the Question Bank.");
  process.exit(0);
}

process.exit(summary.errors > 0 ? 1 : 0);
