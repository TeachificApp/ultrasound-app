import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { assertAdmin } from "./lmsHelpers";
import {
  cmeActivityForms,
  lmsCertificates,
  lmsCourses,
  lmsEnrollments,
  lmsInlineQuizAttempts,
  lmsInlineQuizResponses,
  lmsLessonProgress,
  lmsLessons,
  lmsQuizAttempts,
  users,
} from "../../drizzle/schema";
import { buildCmeActivityCsv, type CmeActivityReportForCsv } from "../lib/cmeManagementCsv";

function fullName(user: { name: string | null; firstName: string | null; lastName: string | null }): string {
  return user.name?.trim() || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unnamed learner";
}

type CmeActivityReportOptions = { page?: number; pageSize?: number; includeAll?: boolean };

async function getCmeActivityReport(courseId: number, options: CmeActivityReportOptions = {}): Promise<CmeActivityReportForCsv & { summary: { enrollmentCount: number; completionCount: number; certificateCount: number }; page: number; pageSize: number }> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.includeAll ? 50_000 : Math.min(100, Math.max(1, options.pageSize ?? 50));
  const offset = options.includeAll ? 0 : (page - 1) * pageSize;

  const [activity] = await db.select({
    courseId: cmeActivityForms.courseId,
    activityTitle: cmeActivityForms.activityTitle,
    creditHours: cmeActivityForms.cmeCreditsRequested,
    courseTitle: lmsCourses.title,
  }).from(cmeActivityForms)
    .innerJoin(lmsCourses, eq(lmsCourses.id, cmeActivityForms.courseId))
    .where(eq(cmeActivityForms.courseId, courseId)).limit(1);
  if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "CME activity not found" });

  const [enrollmentSummary, certificateSummary] = await Promise.all([
    db.select({ count: count() }).from(lmsEnrollments)
      .where(and(eq(lmsEnrollments.courseId, courseId), eq(lmsEnrollments.enrollmentType, "full"))),
    db.select({ count: count() }).from(lmsCertificates).where(eq(lmsCertificates.courseId, courseId)),
  ]);
  const completedEnrollmentSummary = await db.select({ count: count() }).from(lmsEnrollments)
    .where(and(eq(lmsEnrollments.courseId, courseId), eq(lmsEnrollments.enrollmentType, "full"), isNotNull(lmsEnrollments.completedAt)));

  const enrollments = await db.select({
    enrollmentId: lmsEnrollments.id,
    userId: lmsEnrollments.userId,
    enrolledAt: lmsEnrollments.enrolledAt,
    completedAt: lmsEnrollments.completedAt,
    progressPct: lmsEnrollments.progressPct,
    userName: users.name,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
  }).from(lmsEnrollments)
    .innerJoin(users, eq(users.id, lmsEnrollments.userId))
    .where(and(eq(lmsEnrollments.courseId, courseId), eq(lmsEnrollments.enrollmentType, "full")))
    .orderBy(asc(users.lastName), asc(users.firstName), asc(users.email))
    .limit(pageSize)
    .offset(offset);

  const enrollmentIds = enrollments.map(enrollment => enrollment.enrollmentId);
  const userIds = enrollments.map(enrollment => enrollment.userId);
  const [certificates, lessonProgress, standardAttempts, inlineAttempts] = await Promise.all([
    userIds.length ? db.select({ userId: lmsCertificates.userId, issuedAt: lmsCertificates.issuedAt })
      .from(lmsCertificates).where(and(eq(lmsCertificates.courseId, courseId), inArray(lmsCertificates.userId, userIds))) : Promise.resolve([]),
    enrollmentIds.length ? db.select({ enrollmentId: lmsLessonProgress.enrollmentId, completedAt: lmsLessonProgress.completedAt })
      .from(lmsLessonProgress).where(inArray(lmsLessonProgress.enrollmentId, enrollmentIds)) : Promise.resolve([]),
    userIds.length ? db.select({
      userId: lmsQuizAttempts.userId, lessonId: lmsQuizAttempts.lessonId, lessonTitle: lmsLessons.title,
      score: lmsQuizAttempts.score, passed: lmsQuizAttempts.passed, submittedAt: lmsQuizAttempts.createdAt,
    }).from(lmsQuizAttempts).leftJoin(lmsLessons, eq(lmsLessons.id, lmsQuizAttempts.lessonId))
      .where(and(eq(lmsQuizAttempts.courseId, courseId), inArray(lmsQuizAttempts.userId, userIds))) : Promise.resolve([]),
    userIds.length ? db.select({
      id: lmsInlineQuizAttempts.id, userId: lmsInlineQuizAttempts.userId, lessonId: lmsInlineQuizAttempts.lessonId,
      lessonTitle: lmsLessons.title, score: lmsInlineQuizAttempts.score, passed: lmsInlineQuizAttempts.passed,
      submittedAt: lmsInlineQuizAttempts.submittedAt,
    }).from(lmsInlineQuizAttempts).leftJoin(lmsLessons, eq(lmsLessons.id, lmsInlineQuizAttempts.lessonId))
      .where(and(eq(lmsInlineQuizAttempts.courseId, courseId), inArray(lmsInlineQuizAttempts.userId, userIds))) : Promise.resolve([]),
  ]);
  const inlineIds = inlineAttempts.map(attempt => attempt.id);
  const responses = inlineIds.length ? await db.select({
    attemptId: lmsInlineQuizResponses.attemptId,
    questionText: lmsInlineQuizResponses.questionText,
    questionType: lmsInlineQuizResponses.questionType,
    answerValue: lmsInlineQuizResponses.answerValue,
  }).from(lmsInlineQuizResponses).where(inArray(lmsInlineQuizResponses.attemptId, inlineIds)) : [];

  const certificateByUser = new Map<number, Date>();
  certificates.forEach(certificate => {
    const existing = certificateByUser.get(certificate.userId);
    if (!existing || certificate.issuedAt < existing) certificateByUser.set(certificate.userId, certificate.issuedAt);
  });
  const completionByEnrollment = new Map<number, Date>();
  lessonProgress.forEach(progress => {
    if (!progress.completedAt) return;
    const existing = completionByEnrollment.get(progress.enrollmentId);
    if (!existing || progress.completedAt > existing) completionByEnrollment.set(progress.enrollmentId, progress.completedAt);
  });
  const responsesByAttempt = new Map<number, typeof responses>();
  responses.forEach(response => {
    const entries = responsesByAttempt.get(response.attemptId) ?? [];
    entries.push(response);
    responsesByAttempt.set(response.attemptId, entries);
  });
  const standardByUser = new Map<number, typeof standardAttempts>();
  standardAttempts.forEach(attempt => {
    const entries = standardByUser.get(attempt.userId) ?? [];
    entries.push(attempt);
    standardByUser.set(attempt.userId, entries);
  });
  const inlineByUser = new Map<number, typeof inlineAttempts>();
  inlineAttempts.forEach(attempt => {
    const entries = inlineByUser.get(attempt.userId) ?? [];
    entries.push(attempt);
    inlineByUser.set(attempt.userId, entries);
  });

  return {
    activityTitle: activity.activityTitle?.trim() || activity.courseTitle,
    courseId: activity.courseId,
    creditHours: activity.creditHours,
    summary: {
      enrollmentCount: enrollmentSummary[0]?.count ?? 0,
      completionCount: completedEnrollmentSummary[0]?.count ?? 0,
      certificateCount: certificateSummary[0]?.count ?? 0,
    },
    page,
    pageSize,
    learners: enrollments.map(enrollment => ({
      learnerName: fullName({ name: enrollment.userName, firstName: enrollment.firstName, lastName: enrollment.lastName }),
      learnerEmail: enrollment.email ?? "",
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt ?? completionByEnrollment.get(enrollment.enrollmentId) ?? null,
      progressPct: enrollment.progressPct,
      certificateIssuedAt: certificateByUser.get(enrollment.userId) ?? null,
      quizAttempts: [
        ...(standardByUser.get(enrollment.userId) ?? []).map(attempt => ({
          kind: "standard" as const, lessonTitle: attempt.lessonTitle ?? `Lesson ${attempt.lessonId}`,
          score: attempt.score, passed: attempt.passed, submittedAt: attempt.submittedAt, responses: [],
        })),
        ...(inlineByUser.get(enrollment.userId) ?? []).map(attempt => ({
          kind: "inline" as const, lessonTitle: attempt.lessonTitle ?? `Lesson ${attempt.lessonId}`,
          score: attempt.score, passed: attempt.passed, submittedAt: attempt.submittedAt,
          responses: responsesByAttempt.get(attempt.id) ?? [],
        })),
      ],
    })),
  };
}

export const cmeManagementRouter = router({
  listCmeManagementActivities: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const activities = await db.select({
      courseId: cmeActivityForms.courseId,
      activityTitle: cmeActivityForms.activityTitle,
      cmeStatus: cmeActivityForms.cmeStatus,
      creditHours: cmeActivityForms.cmeCreditsRequested,
      courseTitle: lmsCourses.title,
      courseStatus: lmsCourses.status,
    }).from(cmeActivityForms).innerJoin(lmsCourses, eq(lmsCourses.id, cmeActivityForms.courseId)).orderBy(asc(lmsCourses.title));
    const courseIds = activities.map(activity => activity.courseId);
    const [enrollments, certificates] = await Promise.all([
      courseIds.length ? db.select({ courseId: lmsEnrollments.courseId, completedAt: lmsEnrollments.completedAt })
        .from(lmsEnrollments).where(and(inArray(lmsEnrollments.courseId, courseIds), eq(lmsEnrollments.enrollmentType, "full"))) : Promise.resolve([]),
      courseIds.length ? db.select({ courseId: lmsCertificates.courseId, issuedAt: lmsCertificates.issuedAt })
        .from(lmsCertificates).where(inArray(lmsCertificates.courseId, courseIds)) : Promise.resolve([]),
    ]);
    return activities.map(activity => {
      const activityEnrollments = enrollments.filter(enrollment => enrollment.courseId === activity.courseId);
      const activityCertificates = certificates.filter(certificate => certificate.courseId === activity.courseId);
      return {
        ...activity,
        activityTitle: activity.activityTitle?.trim() || activity.courseTitle,
        enrollmentCount: activityEnrollments.length,
        completionCount: activityEnrollments.filter(enrollment => enrollment.completedAt).length,
        certificateCount: activityCertificates.length,
      };
    });
  }),

  getCmeManagementActivityReport: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive(), page: z.number().int().positive().default(1), pageSize: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      return getCmeActivityReport(input.courseId, input);
    }),

  exportCmeManagementActivityCsv: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const report = await getCmeActivityReport(input.courseId, { includeAll: true });
      const safeTitle = report.activityTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cme-activity";
      return {
        filename: `${safeTitle}-cme-report.csv`,
        csv: buildCmeActivityCsv(report),
      };
    }),
});
