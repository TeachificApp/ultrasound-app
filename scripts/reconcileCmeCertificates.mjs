#!/usr/bin/env node
/**
 * Recover missing CME certificates for enrollments that are already complete on-platform.
 *
 * Usage:
 *   DATABASE_URL=... JWT_SECRET=... pnpm exec tsx scripts/reconcileCmeCertificates.mjs
 *   pnpm exec tsx scripts/reconcileCmeCertificates.mjs --apply
 */
import { parseArgs } from "node:util";
import { and, eq, isNotNull, sql } from "drizzle-orm";

const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
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
const { lmsCourses, lmsEnrollments, lmsCertificates, lmsLessonProgress } = await import("../drizzle/schema.ts");
const { recalcProgress, issueCertificateIfEnabled } = await import("../server/routers/lmsHelpers.ts");

const db = await getDb();
if (!db) throw new Error("DB unavailable");

const dryRun = !values.apply;

const completionCandidates = await db.select({
  enrollmentId: lmsEnrollments.id,
  userId: lmsEnrollments.userId,
  courseId: lmsEnrollments.courseId,
  progressPct: lmsEnrollments.progressPct,
  completedAt: lmsEnrollments.completedAt,
  hasCertificate: lmsCourses.hasCertificate,
}).from(lmsEnrollments)
  .innerJoin(lmsCourses, eq(lmsCourses.id, lmsEnrollments.courseId))
  .where(and(
    eq(lmsCourses.hasCertificate, true),
    sql`${lmsEnrollments.progressPct} > 0`,
    isNotNull(lmsEnrollments.completedAt),
  ));

let promoted = 0;
let recovered = 0;

for (const row of completionCandidates) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` })
    .from(lmsLessonProgress)
    .where(eq(lmsLessonProgress.enrollmentId, row.enrollmentId));
  if (Number(count) === 0) continue;

  if (!dryRun) {
    await recalcProgress(db, row.enrollmentId);
  }

  const [enrollment] = await db.select({
    completedAt: lmsEnrollments.completedAt,
    enrollmentType: lmsEnrollments.enrollmentType,
  }).from(lmsEnrollments).where(eq(lmsEnrollments.id, row.enrollmentId)).limit(1);

  if (!enrollment?.completedAt) continue;
  promoted += 1;

  const [existingCert] = await db.select({ id: lmsCertificates.id })
    .from(lmsCertificates)
    .where(and(eq(lmsCertificates.userId, row.userId), eq(lmsCertificates.courseId, row.courseId)))
    .limit(1);

  if (existingCert) continue;

  if (!dryRun) {
    await issueCertificateIfEnabled(
      db,
      row.enrollmentId,
      row.userId,
      row.courseId,
      enrollment.enrollmentType,
      { completedCmeRecovery: true },
    );
  }
  recovered += 1;
}

console.log(JSON.stringify({ dryRun, completionCandidates: completionCandidates.length, promoted, recovered }, null, 2));
if (dryRun) {
  console.error("\nDry run only. Re-run with --apply to issue recovery certificates.");
}
