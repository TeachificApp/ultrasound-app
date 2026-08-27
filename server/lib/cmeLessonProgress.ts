import { and, eq } from "drizzle-orm";
import { lmsEnrollments, lmsLessonProgress } from "../../drizzle/schema";
import { getDb } from "../db";
import { recalcProgress } from "../routers/lmsHelpers";

/** Mark a curriculum lesson complete for a learner and recalculate course progress. */
export async function markLessonCompleteForUser(opts: {
  userId: number;
  courseId: number;
  lessonId: number;
}): Promise<{ marked: boolean; enrollmentId?: number }> {
  const db = await getDb();
  if (!db) return { marked: false };

  const [enrollment] = await db
    .select({ id: lmsEnrollments.id })
    .from(lmsEnrollments)
    .where(and(eq(lmsEnrollments.userId, opts.userId), eq(lmsEnrollments.courseId, opts.courseId)))
    .limit(1);
  if (!enrollment) return { marked: false };

  const [existing] = await db
    .select({ id: lmsLessonProgress.id, completedAt: lmsLessonProgress.completedAt })
    .from(lmsLessonProgress)
    .where(and(eq(lmsLessonProgress.enrollmentId, enrollment.id), eq(lmsLessonProgress.lessonId, opts.lessonId)))
    .limit(1);

  if (existing?.completedAt) {
    return { marked: false, enrollmentId: enrollment.id };
  }

  if (existing) {
    await db.update(lmsLessonProgress).set({ completedAt: new Date() }).where(eq(lmsLessonProgress.id, existing.id));
  } else {
    await db.insert(lmsLessonProgress).values({
      enrollmentId: enrollment.id,
      lessonId: opts.lessonId,
      completedAt: new Date(),
    });
  }

  await recalcProgress(db, enrollment.id);
  return { marked: true, enrollmentId: enrollment.id };
}
