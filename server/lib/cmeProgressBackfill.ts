import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  lmsCourses,
  lmsEnrollments,
  lmsLessonProgress,
  lmsLessons,
  lmsSections,
  sdmsCmeCompletions,
  sdmsCmeConfigs,
} from "../../drizzle/schema";
import {
  lessonsToBackfillComplete,
  resolveFinalAssessmentLessonIds,
  sdmsPassStatuses,
  type BackfillLesson,
} from "../../shared/cmeProgressBackfill";
import { getDb } from "../db";
import { activeEnrollmentCondition } from "./enrollmentAccess";
import { markLessonCompleteForUser } from "./cmeLessonProgress";
import { issueCertificateIfEnabled, recalcProgress } from "../routers/lmsHelpers";

export type CmeBackfillEnrollmentResult = {
  enrollmentId: number;
  userId: number;
  courseId: number;
  courseTitle: string;
  lessonsMarked: number;
  cmeLessonMarked: boolean;
  progressPctBefore: number;
  progressPctAfter: number;
  certificateIssued: boolean;
  skippedReason?: string;
};

export type CmeBackfillSummary = {
  dryRun: boolean;
  coursesScanned: number;
  enrollmentsScanned: number;
  enrollmentsUpdated: number;
  lessonsMarked: number;
  cmeLessonsMarked: number;
  certificatesIssued: number;
  results: CmeBackfillEnrollmentResult[];
};

async function loadCourseLessons(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, courseId: number): Promise<BackfillLesson[]> {
  const sectionRows = await db.select({ id: lmsSections.id }).from(lmsSections).where(eq(lmsSections.courseId, courseId));
  const sectionIds = sectionRows.map((row) => row.id);

  const whereClause = sectionIds.length > 0
    ? or(eq(lmsLessons.courseId, courseId), inArray(lmsLessons.sectionId, sectionIds))
    : eq(lmsLessons.courseId, courseId);

  return db.select({
    id: lmsLessons.id,
    type: lmsLessons.type,
    contentBlocks: lmsLessons.contentBlocks,
    lessonStatus: lmsLessons.lessonStatus,
    countTowardCompletion: lmsLessons.countTowardCompletion,
    position: lmsLessons.position,
  }).from(lmsLessons).where(whereClause).orderBy(lmsLessons.position);
}

export async function backfillCmeEnrollmentProgress(opts: {
  dryRun?: boolean;
  courseId?: number;
  courseSlug?: string;
}): Promise<CmeBackfillSummary> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const dryRun = opts.dryRun !== false;
  const passStatuses = sdmsPassStatuses();
  const summary: CmeBackfillSummary = {
    dryRun,
    coursesScanned: 0,
    enrollmentsScanned: 0,
    enrollmentsUpdated: 0,
    lessonsMarked: 0,
    cmeLessonsMarked: 0,
    certificatesIssued: 0,
    results: [],
  };

  const certificateCourses = await db.select({
    id: lmsCourses.id,
    title: lmsCourses.title,
    slug: lmsCourses.slug,
    hasCertificate: lmsCourses.hasCertificate,
  }).from(lmsCourses).where(eq(lmsCourses.hasCertificate, true));

  const sdmsConfigs = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.enabled, true));
  const sdmsCourseIds = sdmsConfigs
    .filter((config) => config.activityType === "course" || config.activityType === "cohort" || config.activityType === "standalone_cme")
    .map((config) => config.activityId);

  const courseById = new Map(certificateCourses.map((course) => [course.id, course]));

  if (sdmsCourseIds.length > 0) {
    const sdmsOnlyCourses = await db.select({
      id: lmsCourses.id,
      title: lmsCourses.title,
      slug: lmsCourses.slug,
      hasCertificate: lmsCourses.hasCertificate,
    }).from(lmsCourses).where(inArray(lmsCourses.id, sdmsCourseIds));
    for (const course of sdmsOnlyCourses) {
      courseById.set(course.id, course);
    }
  }

  const targetCourses = [...courseById.values()].filter((course) => {
    if (opts.courseId && course.id !== opts.courseId) return false;
    if (opts.courseSlug && course.slug !== opts.courseSlug) return false;
    return true;
  });

  summary.coursesScanned = targetCourses.length;

  for (const course of targetCourses) {
    const config = sdmsConfigs.find((row) => row.activityId === course.id && row.enabled);
    const lessons = await loadCourseLessons(db, course.id);
    const finalAssessmentIds = resolveFinalAssessmentLessonIds(lessons, config?.cmeLessonId ?? null);
    const backfillLessons = lessonsToBackfillComplete(lessons, finalAssessmentIds);

    const enrollments = await db.select({
      id: lmsEnrollments.id,
      userId: lmsEnrollments.userId,
      courseId: lmsEnrollments.courseId,
      progressPct: lmsEnrollments.progressPct,
      completedAt: lmsEnrollments.completedAt,
      enrollmentType: lmsEnrollments.enrollmentType,
    }).from(lmsEnrollments).where(and(
      eq(lmsEnrollments.courseId, course.id),
      activeEnrollmentCondition(),
      sql`${lmsEnrollments.enrollmentType} != 'admin_preview'`,
    ));

    for (const enrollment of enrollments) {
      summary.enrollmentsScanned += 1;

      const existingProgress = await db.select({
        lessonId: lmsLessonProgress.lessonId,
        completedAt: lmsLessonProgress.completedAt,
      }).from(lmsLessonProgress).where(eq(lmsLessonProgress.enrollmentId, enrollment.id));

      const completedIds = new Set(
        existingProgress.filter((row) => row.completedAt).map((row) => row.lessonId),
      );

      const pendingLessonIds = backfillLessons
        .filter((lesson) => !completedIds.has(lesson.id))
        .map((lesson) => lesson.id);

      let cmeLessonMarked = false;
      let cmeLessonIdToMark: number | null = null;
      if (config?.cmeLessonId && finalAssessmentIds.has(config.cmeLessonId) && !completedIds.has(config.cmeLessonId)) {
        const [passedCompletion] = await db.select({ id: sdmsCmeCompletions.id })
          .from(sdmsCmeCompletions)
          .where(and(
            eq(sdmsCmeCompletions.userId, enrollment.userId),
            eq(sdmsCmeCompletions.configId, config.id),
            inArray(sdmsCmeCompletions.passStatus, passStatuses as any),
          ))
          .limit(1);
        if (passedCompletion) {
          cmeLessonIdToMark = config.cmeLessonId;
        }
      }

      if (pendingLessonIds.length === 0 && !cmeLessonIdToMark) {
        summary.results.push({
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          courseId: course.id,
          courseTitle: course.title,
          lessonsMarked: 0,
          cmeLessonMarked: false,
          progressPctBefore: enrollment.progressPct,
          progressPctAfter: enrollment.progressPct,
          certificateIssued: false,
          skippedReason: "already_up_to_date",
        });
        continue;
      }

      if (dryRun) {
        summary.enrollmentsUpdated += 1;
        summary.lessonsMarked += pendingLessonIds.length;
        if (cmeLessonIdToMark) summary.cmeLessonsMarked += 1;
        summary.results.push({
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          courseId: course.id,
          courseTitle: course.title,
          lessonsMarked: pendingLessonIds.length,
          cmeLessonMarked: Boolean(cmeLessonIdToMark),
          progressPctBefore: enrollment.progressPct,
          progressPctAfter: enrollment.progressPct,
          certificateIssued: false,
        });
        continue;
      }

      let lessonsMarked = 0;
      for (const lessonId of pendingLessonIds) {
        const result = await markLessonCompleteForUser({
          userId: enrollment.userId,
          courseId: course.id,
          lessonId,
        });
        if (result.marked) lessonsMarked += 1;
      }

      if (cmeLessonIdToMark) {
        const result = await markLessonCompleteForUser({
          userId: enrollment.userId,
          courseId: course.id,
          lessonId: cmeLessonIdToMark,
        });
        if (result.marked) {
          cmeLessonMarked = true;
          summary.cmeLessonsMarked += 1;
        }
      }

      await recalcProgress(db, enrollment.id);

      const [updatedEnrollment] = await db.select({
        progressPct: lmsEnrollments.progressPct,
        completedAt: lmsEnrollments.completedAt,
      }).from(lmsEnrollments).where(eq(lmsEnrollments.id, enrollment.id)).limit(1);

      let certificateIssued = false;
      if (updatedEnrollment?.completedAt) {
        await issueCertificateIfEnabled(
          db,
          enrollment.id,
          enrollment.userId,
          course.id,
          enrollment.enrollmentType,
          { completedCmeRecovery: true },
        );
        certificateIssued = true;
        summary.certificatesIssued += 1;
      }

      summary.enrollmentsUpdated += 1;
      summary.lessonsMarked += lessonsMarked;
      summary.results.push({
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        courseId: course.id,
        courseTitle: course.title,
        lessonsMarked,
        cmeLessonMarked,
        progressPctBefore: enrollment.progressPct,
        progressPctAfter: updatedEnrollment?.progressPct ?? enrollment.progressPct,
        certificateIssued,
      });
    }
  }

  return summary;
}
