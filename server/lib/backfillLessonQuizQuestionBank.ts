import { eq, inArray, or, sql } from "drizzle-orm";
import { lmsLessons, lmsQuizQuestions, lmsQuizzes, users } from "../../drizzle/schema";
import type { getDb } from "../db";
import { syncLessonQuizToQuestionBank } from "./lessonQuizQuestionBankSync";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type LessonQuizQuestionBankBackfillResult = {
  dryRun: boolean;
  lessonsScanned: number;
  lessonsWithQuizContent: number;
  questionsCreated: number;
  questionsUpdated: number;
  errors: number;
  errorSamples: string[];
};

async function resolveBackfillAdminId(db: Db): Promise<number> {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  return admin?.id ?? 1;
}

/** Lesson IDs with page-builder lesson_quiz blocks or legacy lms_quiz_questions. */
export async function findLessonIdsWithQuizContent(db: Db): Promise<number[]> {
  const blockLessons = await db
    .select({ id: lmsLessons.id })
    .from(lmsLessons)
    .where(or(
      sql`${lmsLessons.contentBlocks} LIKE ${'%"type":"lesson_quiz"%'}`,
      sql`${lmsLessons.contentBlocks} LIKE ${'%"type": "lesson_quiz"%'}`,
    ));

  const legacyLessons = await db
    .selectDistinct({ lessonId: lmsQuizzes.lessonId })
    .from(lmsQuizzes)
    .innerJoin(lmsQuizQuestions, eq(lmsQuizQuestions.quizId, lmsQuizzes.id));

  const ids = new Set<number>();
  for (const row of blockLessons) ids.add(row.id);
  for (const row of legacyLessons) {
    if (row.lessonId != null) ids.add(row.lessonId);
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * One-time / idempotent backfill: sync all existing lesson quiz questions into
 * Question Bank → Lesson Quiz → {course name}.
 */
export async function backfillLessonQuizQuestionBank(
  db: Db,
  opts?: {
    dryRun?: boolean;
    lessonIds?: number[];
    adminId?: number;
    maxErrors?: number;
  },
): Promise<LessonQuizQuestionBankBackfillResult> {
  const dryRun = opts?.dryRun ?? false;
  const maxErrors = opts?.maxErrors ?? 25;

  const allLessonIds = opts?.lessonIds?.length
    ? [...new Set(opts.lessonIds)].sort((a, b) => a - b)
    : await findLessonIdsWithQuizContent(db);

  const result: LessonQuizQuestionBankBackfillResult = {
    dryRun,
    lessonsScanned: allLessonIds.length,
    lessonsWithQuizContent: allLessonIds.length,
    questionsCreated: 0,
    questionsUpdated: 0,
    errors: 0,
    errorSamples: [],
  };

  if (dryRun || allLessonIds.length === 0) {
    return result;
  }

  const adminId = opts?.adminId ?? await resolveBackfillAdminId(db);

  for (const lessonId of allLessonIds) {
    try {
      const sync = await syncLessonQuizToQuestionBank(db, lessonId, adminId);
      result.questionsCreated += sync.created;
      result.questionsUpdated += sync.updated;
    } catch (err) {
      result.errors += 1;
      if (result.errorSamples.length < maxErrors) {
        const message = err instanceof Error ? err.message : String(err);
        result.errorSamples.push(`lesson ${lessonId}: ${message}`);
      }
    }
  }

  if (result.questionsCreated > 0 || result.questionsUpdated > 0 || result.errors > 0) {
    console.log(
      `[backfillLessonQuizQuestionBank] lessons=${result.lessonsScanned} created=${result.questionsCreated} updated=${result.questionsUpdated} errors=${result.errors}`,
    );
  }

  return result;
}
