import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
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
import { platformCalendarDayBoundaryToUtc } from "../../shared/platformTime";

function fullName(user: { name: string | null; firstName: string | null; lastName: string | null }): string {
  return user.name?.trim() || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unnamed learner";
}

type CmeActivityReportOptions = { page?: number; pageSize?: number; includeAll?: boolean };
type CmeSurveyResultsOptions = { startDate?: string; endDate?: string };

const cmeSurveyDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date in YYYY-MM-DD format");

function parseContentBlocks(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escapeCsvCell(value: unknown): string {
  const rawText = value == null ? "" : String(value);
  const text = /^[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCmeSurveyResultsCsv(rows: Array<Record<string, unknown>>): string {
  const headers = ["Submitted At", "Learner Name", "Learner Email", "Lesson", "Survey", "Question", "Question Type", "Response"];
  return [
    headers.join(","),
    ...rows.map(row => [
      row.submittedAt instanceof Date ? row.submittedAt.toISOString() : row.submittedAt,
      row.learnerName,
      row.learnerEmail,
      row.lessonTitle,
      row.surveyTitle,
      row.questionText,
      row.questionType,
      row.answerValue,
    ].map(escapeCsvCell).join(",")),
  ].join("\r\n");
}

async function getCmeSurveyResults(courseId: number, options: CmeSurveyResultsOptions = {}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  if (options.startDate && options.endDate && options.startDate > options.endDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The start date must be on or before the end date" });
  }
  const [activity] = await db.select({ id: cmeActivityForms.id, activityTitle: cmeActivityForms.activityTitle })
    .from(cmeActivityForms).where(eq(cmeActivityForms.courseId, courseId)).limit(1);
  if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "CME activity not found" });

  const dateFilters = [eq(lmsInlineQuizAttempts.courseId, courseId)];
  if (options.startDate) dateFilters.push(gte(lmsInlineQuizAttempts.submittedAt, platformCalendarDayBoundaryToUtc(options.startDate, "start")));
  if (options.endDate) dateFilters.push(lte(lmsInlineQuizAttempts.submittedAt, platformCalendarDayBoundaryToUtc(options.endDate, "end")));
  const attempts = await db.select({
    id: lmsInlineQuizAttempts.id,
    lessonId: lmsInlineQuizAttempts.lessonId,
    quizBlockId: lmsInlineQuizAttempts.quizBlockId,
    submittedAt: lmsInlineQuizAttempts.submittedAt,
    learnerName: users.name,
    firstName: users.firstName,
    lastName: users.lastName,
    learnerEmail: users.email,
    lessonTitle: lmsLessons.title,
    lessonBlocks: lmsLessons.contentBlocks,
  }).from(lmsInlineQuizAttempts)
    .innerJoin(users, eq(users.id, lmsInlineQuizAttempts.userId))
    .leftJoin(lmsLessons, eq(lmsLessons.id, lmsInlineQuizAttempts.lessonId))
    .where(and(...dateFilters))
    .orderBy(desc(lmsInlineQuizAttempts.submittedAt));

  const surveyAttempts = attempts.filter(attempt => parseContentBlocks(attempt.lessonBlocks).some((block: any) => (
    block?.type === "lesson_quiz"
    && String(block.id) === attempt.quizBlockId
    && (block?.data?.isSurvey === true || block?.data?.requireSurveyCompletion === true)
  )));
  const surveyAttemptIds = surveyAttempts.map(attempt => attempt.id);
  const responses = surveyAttemptIds.length ? await db.select({
    attemptId: lmsInlineQuizResponses.attemptId,
    questionText: lmsInlineQuizResponses.questionText,
    questionType: lmsInlineQuizResponses.questionType,
    answerValue: lmsInlineQuizResponses.answerValue,
  }).from(lmsInlineQuizResponses).where(inArray(lmsInlineQuizResponses.attemptId, surveyAttemptIds)) : [];
  const surveyTitleByAttemptId = new Map(surveyAttempts.map(attempt => {
    const block = parseContentBlocks(attempt.lessonBlocks).find((candidate: any) => candidate?.type === "lesson_quiz" && String(candidate.id) === attempt.quizBlockId);
    return [attempt.id, String(block?.data?.title ?? "CME Survey")];
  }));
  const attemptById = new Map(surveyAttempts.map(attempt => [attempt.id, attempt]));
  const rows = responses.map(response => {
    const attempt = attemptById.get(response.attemptId)!;
    return {
      attemptId: response.attemptId,
      submittedAt: attempt.submittedAt,
      learnerName: fullName({ name: attempt.learnerName, firstName: attempt.firstName, lastName: attempt.lastName }),
      learnerEmail: attempt.learnerEmail ?? "",
      lessonTitle: attempt.lessonTitle ?? `Lesson ${attempt.lessonId}`,
      surveyTitle: surveyTitleByAttemptId.get(response.attemptId) ?? "CME Survey",
      questionText: response.questionText,
      questionType: response.questionType,
      answerValue: response.answerValue ?? "",
    };
  });
  return { activityTitle: activity.activityTitle?.trim() || "CME Activity", rows };
}

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

  getCmeSurveyResults: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      startDate: cmeSurveyDateSchema.optional(),
      endDate: cmeSurveyDateSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      return getCmeSurveyResults(input.courseId, input);
    }),

  exportCmeSurveyResultsCsv: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      startDate: cmeSurveyDateSchema.optional(),
      endDate: cmeSurveyDateSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const report = await getCmeSurveyResults(input.courseId, input);
      const safeTitle = report.activityTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cme-activity";
      return {
        filename: `${safeTitle}-survey-results.csv`,
        csv: buildCmeSurveyResultsCsv(report.rows),
      };
    }),
});
