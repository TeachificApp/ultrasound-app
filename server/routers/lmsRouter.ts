/**
 * lmsRouter.ts
 * All About Ultrasound™ LMS — Education Library
 *
 * Sub-routers:
 *   lmsPublic   — public course catalog, landing pages, instructor profiles
 *   lmsLearner  — enrollment, progress, quiz submission (protected)
 *   lmsAdmin    — full course/quiz/section/lesson CRUD, enrollment mgmt (admin only)
 *   lmsGroup    — group manager seat assignment (group_manager role)
 *   lmsAffiliate — affiliate tracking
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, isNull, sql, asc, isNotNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { generateCertificatePdf } from "../lib/certificateGenerator";
import { sendCertificateEmail } from "../lib/certificateEmail";
import { buildOrderBumpCheckoutLine } from "../lib/orderBumpCheckout";
import {
  lmsCourses,
  lmsSections,
  lmsLessons,
  lmsQuizzes,
  lmsQuizQuestions,
  lmsEnrollments,
  lmsLessonProgress,
  lmsGroups,
  lmsGroupSeats,
  lmsInstructors,
  lmsCourseInstructors,
  lmsAffiliates,
  lmsAffiliateConversions,
  lmsLandingPages,
  lmsPageTemplates,
  lmsOrders,
  lmsCertificates,
  lmsLessonNotes,
  lmsLessonBookmarks,
  lmsCollections,
  lmsCollectionCourses,
  users,
  mediaAssets,
  mediaVersions,
} from "../../drizzle/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  if (ctx.user.role !== "admin") {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!u || u.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function uniqueSlug(db: Awaited<ReturnType<typeof getDb>>, base: string): Promise<string> {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  let slug = base;
  let attempt = 0;
  while (true) {
    const [existing] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, slug)).limit(1);
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

async function recalcProgress(db: Awaited<ReturnType<typeof getDb>>, enrollmentId: number) {
  if (!db) return;
  const [enrollRow] = await db.select().from(lmsEnrollments).where(eq(lmsEnrollments.id, enrollmentId)).limit(1);
  if (!enrollRow) return;
  const courseId = enrollRow.courseId;

  // Count total lessons in course
  const sections = await db.select({ id: lmsSections.id }).from(lmsSections).where(eq(lmsSections.courseId, courseId));
  if (!sections.length) return;
  const sectionIds = sections.map(s => s.id);
  const totalRows = await db.select({ count: sql<number>`count(*)` }).from(lmsLessons).where(
    sectionIds.length === 1
      ? eq(lmsLessons.sectionId, sectionIds[0])
      : sql`${lmsLessons.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`
  );
  const total = Number(totalRows[0]?.count ?? 0);
  if (total === 0) return;

  // Count completed lessons
  const completedRows = await db.select({ count: sql<number>`count(*)` }).from(lmsLessonProgress).where(
    and(eq(lmsLessonProgress.enrollmentId, enrollmentId), isNotNull(lmsLessonProgress.completedAt))
  );
  const completed = Number(completedRows[0]?.count ?? 0);
  const pct = Math.round((completed / total) * 100);
  const wasCompleted = !!enrollRow.completedAt;

  await db.update(lmsEnrollments).set({
    progressPct: pct,
    completedAt: pct >= 100 ? new Date() : null,
  }).where(eq(lmsEnrollments.id, enrollmentId));

  // Issue certificate if newly completed and course has hasCertificate enabled
  if (pct >= 100 && !wasCompleted) {
    void issueCertificateIfEnabled(db, enrollmentId, enrollRow.userId, courseId).catch(e =>
      console.error("[certificate] Failed to issue certificate:", e)
    );
  }
}

async function issueCertificateIfEnabled(
  db: Awaited<ReturnType<typeof getDb>>,
  enrollmentId: number,
  userId: number,
  courseId: number
) {
  if (!db) return;
  // Check course has certificate enabled
  const [course] = await db.select({ hasCertificate: lmsCourses.hasCertificate, title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
  if (!course?.hasCertificate) return;

  // Check if certificate already issued
  const [existing] = await db.select({ id: lmsCertificates.id }).from(lmsCertificates)
    .where(and(eq(lmsCertificates.userId, userId), eq(lmsCertificates.courseId, courseId))).limit(1);
  if (existing) return;

  // Get user info
  const [user] = await db.select({ name: users.name, email: users.email, displayName: users.displayName, credentials: users.credentials }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.email) return;

  const learnerName = user.displayName || user.name || "Learner";
  const issuedAt = new Date();

  // Generate PDF
  const pdfBuffer = await generateCertificatePdf({
    learnerName,
    courseTitle: course.title,
    issuedAt,
    credentials: user.credentials,
  });

  // Upload PDF to S3
  const suffix = randomBytes(6).toString("hex");
  const fileKey = `certificates/cert-${userId}-${courseId}-${suffix}.pdf`;
  const { url: certificateUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

  // Save certificate record
  await db.insert(lmsCertificates).values({
    userId,
    courseId,
    enrollmentId,
    certificateUrl,
    issuedAt,
  });

  // Send email
  await sendCertificateEmail({
    to: { name: learnerName, email: user.email },
    courseTitle: course.title,
    certificateUrl,
    pdfBuffer,
    issuedAt,
  });

  console.log(`[certificate] Issued certificate for user ${userId}, course ${courseId}`);
}

// ─── Public Router ────────────────────────────────────────────────────────────

export const lmsPublicRouter = router({
  /** List all publicly visible courses */
  listCourses: publicProcedure
    .input(z.object({
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      type: z.enum(["course", "quiz", "download"]).optional(),
      isFree: z.boolean().optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [eq(lmsCourses.status, "public")];
      if (input.brand) conditions.push(eq(lmsCourses.brand, input.brand));
      if (input.type) conditions.push(eq(lmsCourses.type, input.type));
      if (input.isFree !== undefined) conditions.push(eq(lmsCourses.isFree, input.isFree));

      const offset = (input.page - 1) * input.pageSize;
      const courses = await db.select().from(lmsCourses).where(and(...conditions)).orderBy(desc(lmsCourses.createdAt)).limit(input.pageSize).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lmsCourses).where(and(...conditions));

      // Attach primary instructor for each course
      const enriched = await Promise.all(courses.map(async (c) => {
        const [ci] = await db.select({ instructorId: lmsCourseInstructors.instructorId }).from(lmsCourseInstructors)
          .where(and(eq(lmsCourseInstructors.courseId, c.id), eq(lmsCourseInstructors.isPrimary, true))).limit(1);
        let instructor = null;
        if (ci) {
          const [ins] = await db.select().from(lmsInstructors).where(eq(lmsInstructors.id, ci.instructorId)).limit(1);
          instructor = ins ?? null;
        }
        return { ...c, instructor };
      }));

      return { courses: enriched, total: Number(count), page: input.page, pageSize: input.pageSize };
    }),

  /** List featured courses for LMS home page */
  listFeatured: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const courses = await db.select().from(lmsCourses)
      .where(and(eq(lmsCourses.status, "public"), eq(lmsCourses.isFeatured, true)))
      .orderBy(desc(lmsCourses.updatedAt))
      .limit(8);
    // Attach primary instructor
    const enriched = await Promise.all(courses.map(async (c) => {
      const [ci] = await db.select({ instructorId: lmsCourseInstructors.instructorId }).from(lmsCourseInstructors)
        .where(and(eq(lmsCourseInstructors.courseId, c.id), eq(lmsCourseInstructors.isPrimary, true))).limit(1);
      let instructor = null;
      if (ci) {
        const [ins] = await db.select().from(lmsInstructors).where(eq(lmsInstructors.id, ci.instructorId)).limit(1);
        instructor = ins ?? null;
      }
      return { ...c, instructor };
    }));
    return enriched;
  }),

  /** Get a single course by slug (public or preview) */
  getCourse: publicProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.slug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // draft, archived, and private are not publicly accessible; hidden is accessible by direct URL
      // Allow preview for admin users
      const isAdmin = ctx.user?.role === "admin";
      if (!input.preview || !isAdmin) {
        if (course.status === "draft" || course.status === "archived" || course.status === "private") throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Sections + preview lessons
      const sections = await db.select().from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position));
      const sectionsWithLessons = await Promise.all(sections.map(async (s) => {
        const lessons = await db.select({
          id: lmsLessons.id, title: lmsLessons.title, type: lmsLessons.type,
          position: lmsLessons.position, isPreview: lmsLessons.isPreview, durationMinutes: lmsLessons.durationMinutes,
        }).from(lmsLessons).where(eq(lmsLessons.sectionId, s.id)).orderBy(asc(lmsLessons.position));
        return { ...s, lessons };
      }));

      // Instructors
      const cis = await db.select().from(lmsCourseInstructors).where(eq(lmsCourseInstructors.courseId, course.id));
      const instructors = await Promise.all(cis.map(async (ci) => {
        const [ins] = await db.select().from(lmsInstructors).where(eq(lmsInstructors.id, ci.instructorId)).limit(1);
        return ins ? { ...ins, revenueSharePct: ci.revenueSharePct, isPrimary: ci.isPrimary } : null;
      }));

      // Landing page
      const [landingPage] = await db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, course.id)).limit(1);

      return { ...course, sections: sectionsWithLessons, instructors: instructors.filter(Boolean), landingPage: landingPage ?? null };
    }),

  /** Get instructor public profile */
  getInstructor: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [instructor] = await db.select().from(lmsInstructors).where(and(eq(lmsInstructors.id, input.id), eq(lmsInstructors.isActive, true))).limit(1);
      if (!instructor) throw new TRPCError({ code: "NOT_FOUND" });
      // Courses taught
      const cis = await db.select({ courseId: lmsCourseInstructors.courseId }).from(lmsCourseInstructors).where(eq(lmsCourseInstructors.instructorId, input.id));
      const courseIds = cis.map(c => c.courseId);
      const courses = courseIds.length > 0
        ? await db.select({ id: lmsCourses.id, slug: lmsCourses.slug, title: lmsCourses.title, coverImageUrl: lmsCourses.coverImageUrl, status: lmsCourses.status })
            .from(lmsCourses).where(and(eq(lmsCourses.status, "public"), sql`${lmsCourses.id} IN (${sql.join(courseIds.map(id => sql`${id}`), sql`, `)})`))
        : [];
      return { ...instructor, courses };
    }),

  /** List all active instructors */
  listInstructors: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(lmsInstructors).where(eq(lmsInstructors.isActive, true)).orderBy(asc(lmsInstructors.name));
  }),

  /** List all published collections (with course count) */
  listCollections: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const collections = await db.select().from(lmsCollections)
      .where(eq(lmsCollections.isPublished, true))
      .orderBy(asc(lmsCollections.position));
    return Promise.all(collections.map(async (col) => {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(lmsCollectionCourses).where(eq(lmsCollectionCourses.collectionId, col.id));
      return { ...col, courseCount: Number(count) };
    }));
  }),

  /** Get a single collection with its courses */
  getCollection: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [col] = await db.select().from(lmsCollections)
        .where(and(eq(lmsCollections.id, input.id), eq(lmsCollections.isPublished, true))).limit(1);
      if (!col) throw new TRPCError({ code: "NOT_FOUND" });
      const cc = await db.select().from(lmsCollectionCourses)
        .where(eq(lmsCollectionCourses.collectionId, col.id)).orderBy(asc(lmsCollectionCourses.position));
      const courses = await Promise.all(cc.map(async ({ courseId }) => {
        const [c] = await db.select().from(lmsCourses)
          .where(and(eq(lmsCourses.id, courseId), eq(lmsCourses.status, "public"))).limit(1);
        return c ?? null;
      }));
      return { ...col, courses: courses.filter(Boolean) };
    }),
});

// ─── Learner Router ───────────────────────────────────────────────────────────

export const lmsLearnerRouter = router({
  /** Get all enrollments for the current user */
  getMyCourses: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const enrollments = await db.select().from(lmsEnrollments).where(eq(lmsEnrollments.userId, ctx.user.id)).orderBy(desc(lmsEnrollments.enrolledAt));
    const enriched = await Promise.all(enrollments.map(async (e) => {
      const [course] = await db.select({ id: lmsCourses.id, slug: lmsCourses.slug, title: lmsCourses.title, coverImageUrl: lmsCourses.coverImageUrl, type: lmsCourses.type }).from(lmsCourses).where(eq(lmsCourses.id, e.courseId)).limit(1);
      return { ...e, course: course ?? null };
    }));
    return enriched;
  }),

  /** Get full course content for enrolled user (or preview lessons) */
  getCoursePlayer: protectedProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.slug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Admin preview mode: bypass enrollment requirement
      const isAdminPreview = input.preview && ctx.user.role === "admin";

      // Check enrollment
      const [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);

      const sections = await db.select().from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position));
      const sectionsWithLessons = await Promise.all(sections.map(async (s) => {
        const lessons = await db.select().from(lmsLessons).where(eq(lmsLessons.sectionId, s.id)).orderBy(asc(lmsLessons.position));
        return { ...s, lessons };
      }));
      // Top-level lessons (no section)
      const topLevelLessons = await db.select().from(lmsLessons)
        .where(and(eq(lmsLessons.courseId, course.id), isNull(lmsLessons.sectionId)))
        .orderBy(asc(lmsLessons.position));

      // Progress
      let progress: typeof lmsLessonProgress.$inferSelect[] = [];
      if (enrollment) {
        progress = await db.select().from(lmsLessonProgress).where(eq(lmsLessonProgress.enrollmentId, enrollment.id));
      }

      // For admin preview, provide a synthetic enrollment so the player renders
      const effectiveEnrollment = enrollment ?? (isAdminPreview ? { id: -1, userId: ctx.user.id, courseId: course.id, enrolledAt: new Date(), progressPct: 0, completedAt: null, lastAccessedAt: new Date(), certificateIssuedAt: null } as any : null);

      // Track IP access for paid content monitoring (non-blocking)
      if (enrollment && !course.isFree && ctx.user.role !== "admin") {
        const { logIpAccess } = await import("../jobs/sharingMonitor");
        const fwd = ctx.req?.headers?.["x-forwarded-for"];
        const ip = typeof fwd === "string" ? fwd.split(",")[0].trim() : ctx.req?.socket?.remoteAddress || "unknown";
        logIpAccess({ userId: ctx.user.id, ipAddress: ip, userAgent: ctx.req?.headers?.["user-agent"] || undefined, contentType: "course", contentId: course.id }).catch(() => {});
      }

      return { course, enrollment: effectiveEnrollment, sections: sectionsWithLessons, topLevelLessons, progress, isAdminPreview: !!isAdminPreview };
    }),

  /** Get a single lesson (must be enrolled or lesson is preview) */
  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lesson] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      // Resolve courseId: from lesson directly, or via section
      let resolvedCourseId: number | null = lesson.courseId ?? null;
      if (!resolvedCourseId && lesson.sectionId) {
        const [section] = await db.select().from(lmsSections).where(eq(lmsSections.id, lesson.sectionId)).limit(1);
        if (section) resolvedCourseId = section.courseId;
      }
      if (!resolvedCourseId) throw new TRPCError({ code: "NOT_FOUND" });

      if (!lesson.isPreview && ctx.user.role !== "admin") {
        const [enrollment] = await db.select().from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, resolvedCourseId))).limit(1);
        if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment required" });
      }

      // Quiz data if quiz lesson
      let quiz = null;
      if (lesson.type === "quiz") {
        const [q] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, lesson.id)).limit(1);
        if (q) {
          const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, q.id)).orderBy(asc(lmsQuizQuestions.position));
          quiz = { ...q, questions };
        }
      }

      return { ...lesson, quiz };
    }),

  /** Mark a lesson complete */
  markLessonComplete: protectedProcedure
    .input(z.object({ lessonId: z.number(), courseSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN" });

      const [existing] = await db.select().from(lmsLessonProgress)
        .where(and(eq(lmsLessonProgress.enrollmentId, enrollment.id), eq(lmsLessonProgress.lessonId, input.lessonId))).limit(1);
      if (existing) {
        if (!existing.completedAt) {
          await db.update(lmsLessonProgress).set({ completedAt: new Date() }).where(eq(lmsLessonProgress.id, existing.id));
        }
      } else {
        await db.insert(lmsLessonProgress).values({ enrollmentId: enrollment.id, lessonId: input.lessonId, completedAt: new Date() });
      }
      await recalcProgress(db, enrollment.id);
      return { success: true };
    }),

  /** Submit quiz answers */
  submitQuiz: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      courseSlug: z.string(),
      answers: z.record(z.string(), z.string()), // questionId -> answer
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN" });

      const [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, input.lessonId)).limit(1);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id));

      let correct = 0;
      const results = questions.map(q => {
        const given = input.answers[String(q.id)] ?? "";
        const isCorrect = given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
        if (isCorrect) correct++;
        return { questionId: q.id, correct: isCorrect, correctAnswer: quiz.showCorrectAnswers ? q.correctAnswer : undefined, explanation: quiz.showCorrectAnswers ? q.explanation : undefined };
      });
      const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
      const passed = score >= quiz.passingScore;

      // Upsert progress
      const [existing] = await db.select().from(lmsLessonProgress)
        .where(and(eq(lmsLessonProgress.enrollmentId, enrollment.id), eq(lmsLessonProgress.lessonId, input.lessonId))).limit(1);
      if (existing) {
        await db.update(lmsLessonProgress).set({
          quizScore: score, quizPassed: passed,
          completedAt: passed ? new Date() : existing.completedAt,
          attempts: (existing.attempts ?? 0) + 1,
        }).where(eq(lmsLessonProgress.id, existing.id));
      } else {
        await db.insert(lmsLessonProgress).values({
          enrollmentId: enrollment.id, lessonId: input.lessonId,
          quizScore: score, quizPassed: passed,
          completedAt: passed ? new Date() : null, attempts: 1,
        });
      }
      if (passed) await recalcProgress(db, enrollment.id);
      return { score, passed, passingScore: quiz.passingScore, results };
    }),

  /** Enroll in a free course */
  enrollFree: protectedProcedure
    .input(z.object({ courseSlug: z.string(), affiliateCode: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (!course.isFree) throw new TRPCError({ code: "BAD_REQUEST", message: "This course requires payment" });
      if (course.status !== "public") throw new TRPCError({ code: "FORBIDDEN" });

      const [existing] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
      if (existing) return { enrollmentId: existing.id, alreadyEnrolled: true };

      const [result] = await db.insert(lmsEnrollments).values({
        userId: ctx.user.id, courseId: course.id,
        affiliateCode: input.affiliateCode ?? null,
      }).$returningId();
      return { enrollmentId: result.id, alreadyEnrolled: false };
    }),

  /** Create Stripe checkout session for paid course */
  createCheckout: protectedProcedure
    .input(z.object({
      courseSlug: z.string(),
      affiliateCode: z.string().optional(),
      seats: z.number().int().min(1).default(1),
      origin: z.string(),
      orderBumpId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const pricingType = course.pricingType ?? (course.isFree ? "free" : "one_time");
      if (pricingType === "free") throw new TRPCError({ code: "BAD_REQUEST", message: "Use enrollFree for free courses" });

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" });

      const orderBumpCheckout = await buildOrderBumpCheckoutLine(db, {
        orderBumpId: input.orderBumpId,
        triggerType: "course",
        triggerProductId: course.id,
        currency: course.currency,
      });
      const shippingOptions = orderBumpCheckout?.requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA"] as any } }
        : {};

      // Create order record
      const orderAmount = (pricingType === "payment_plan"
        ? (course.downPayment ?? 0)
        : course.price * input.seats) + (orderBumpCheckout?.amount ?? 0);
      const [orderResult] = await db.insert(lmsOrders).values({
        userId: ctx.user.id, courseId: course.id,
        amount: orderAmount,
        affiliateId: null, seats: input.seats, status: "pending",
      }).$returningId();

      const commonMeta = {
        user_id: ctx.user.id.toString(),
        course_id: course.id.toString(),
        order_id: orderResult.id.toString(),
        affiliate_code: input.affiliateCode ?? "",
        seats: input.seats.toString(),
        pricing_type: pricingType,
        trigger_order_type: "course",
        ...orderBumpCheckout?.metadata,
      };
      const successUrl = `${input.origin}/learn/${course.slug}/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${input.origin}/learn/${course.slug}`;

      let session: any;

      if (pricingType === "one_time") {
        session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          allow_promotion_codes: true,
          line_items: [{
            price_data: {
              currency: course.currency,
              product_data: { name: course.title, description: course.subtitle ?? undefined },
              unit_amount: course.price,
            },
            quantity: input.seats,
          }, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: commonMeta,
          ...shippingOptions,
        });

      } else if (pricingType === "subscription") {
        // Create or reuse a Stripe Price for this course subscription
        let stripePriceId = course.stripePriceId;
        if (!stripePriceId) {
          const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
          const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
          const interval = course.subscriptionInterval ?? "monthly";
          const stripeProduct = await stripe.products.create({
            name: course.title,
            description: course.subtitle ?? undefined,
            metadata: { course_id: course.id.toString() },
          });
          const stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: course.price,
            currency: course.currency,
            recurring: { interval: intervalMap[interval], interval_count: intervalCountMap[interval] },
          });
          stripePriceId = stripePrice.id;
          await db.update(lmsCourses).set({ stripePriceId }).where(eq(lmsCourses.id, course.id));
        }
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          allow_promotion_codes: true,
          line_items: [{ price: stripePriceId, quantity: 1 }, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: commonMeta,
          ...shippingOptions,
        });

      } else if (pricingType === "payment_plan") {
        // Charge down payment now; installments handled via subscription
        const downPayment = course.downPayment ?? 0;
        const installmentAmount = course.installmentAmount ?? 0;
        const installmentCount = course.installmentCount ?? 0;
        const intervalDays = course.installmentIntervalDays ?? 30;
        const lineItems: any[] = [];
        if (downPayment > 0) {
          lineItems.push({
            price_data: {
              currency: course.currency,
              product_data: { name: `${course.title} — Down Payment` },
              unit_amount: downPayment,
            },
            quantity: 1,
          });
        }
        if (installmentAmount > 0 && installmentCount > 0) {
          // Add installments as additional line items (Stripe doesn't natively support deferred installments
          // in a single checkout; we model them as a subscription with a fixed billing cycle count)
          let stripePriceId = course.stripePriceId;
          if (!stripePriceId) {
            const stripeProduct = await stripe.products.create({
              name: `${course.title} — Installment`,
              metadata: { course_id: course.id.toString() },
            });
            const intervalMonths = Math.round(intervalDays / 30) || 1;
            const stripePrice = await stripe.prices.create({
              product: stripeProduct.id,
              unit_amount: installmentAmount,
              currency: course.currency,
              recurring: { interval: "month", interval_count: intervalMonths },
            });
            stripePriceId = stripePrice.id;
            await db.update(lmsCourses).set({ stripePriceId }).where(eq(lmsCourses.id, course.id));
          }
          lineItems.push({ price: stripePriceId, quantity: 1 });
        }
        // Use payment mode for down-payment-only, subscription mode when installments exist
        const hasInstallments = installmentAmount > 0 && installmentCount > 0;
        session = await stripe.checkout.sessions.create({
          mode: hasInstallments ? "subscription" : "payment",
          customer_email: ctx.user.email ?? undefined,
          allow_promotion_codes: true,
          line_items: [...lineItems, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: { ...commonMeta, installment_count: installmentCount.toString() },
          ...shippingOptions,
        });
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown pricing type" });
      }

      await db.update(lmsOrders).set({ stripeSessionId: session.id }).where(eq(lmsOrders.id, orderResult.id));
      return { checkoutUrl: session.url };
    }),

  /** Accept group seat invite */
  acceptGroupInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [seat] = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.inviteToken, input.token)).limit(1);
      if (!seat) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite token" });
      if (seat.acceptedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already accepted" });

      const [group] = await db.select().from(lmsGroups).where(eq(lmsGroups.id, seat.groupId)).limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify email matches
      const userEmail = ctx.user.email?.toLowerCase();
      if (userEmail !== seat.email.toLowerCase()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invite was sent to a different email address" });
      }

      // Check not already enrolled
      const [existing] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, group.courseId))).limit(1);
      if (existing) {
        await db.update(lmsGroupSeats).set({ acceptedAt: new Date(), enrollmentId: existing.id }).where(eq(lmsGroupSeats.id, seat.id));
        return { enrollmentId: existing.id };
      }

      const [result] = await db.insert(lmsEnrollments).values({
        userId: ctx.user.id, courseId: group.courseId, groupId: group.id,
      }).$returningId();
      await db.update(lmsGroupSeats).set({ acceptedAt: new Date(), enrollmentId: result.id }).where(eq(lmsGroupSeats.id, seat.id));
      return { enrollmentId: result.id };
    }),

  // ── Certificates ──────────────────────────────────────────────────────────

  /** Get all certificates for the current user */
  getMyCertificates: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const certs = await db.select({
      id: lmsCertificates.id,
      courseId: lmsCertificates.courseId,
      certificateUrl: lmsCertificates.certificateUrl,
      issuedAt: lmsCertificates.issuedAt,
      courseTitle: lmsCourses.title,
      courseCoverImageUrl: lmsCourses.coverImageUrl,
    })
      .from(lmsCertificates)
      .innerJoin(lmsCourses, eq(lmsCertificates.courseId, lmsCourses.id))
      .where(eq(lmsCertificates.userId, ctx.user.id))
      .orderBy(desc(lmsCertificates.issuedAt));
    return certs;
  }),

  /** Get certificate for a specific course (if issued) */
  getCourseCertificate: protectedProcedure
    .input(z.object({ courseSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) return null;
      const [cert] = await db.select().from(lmsCertificates)
        .where(and(eq(lmsCertificates.userId, ctx.user.id), eq(lmsCertificates.courseId, course.id))).limit(1);
      return cert ?? null;
    }),

  // ── Lesson Notes ──────────────────────────────────────────────────────────

  /** Get all notes for a course (grouped by lesson) */
  getCourseNotes: protectedProcedure
    .input(z.object({ courseSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const notes = await db.select({
        id: lmsLessonNotes.id,
        lessonId: lmsLessonNotes.lessonId,
        note: lmsLessonNotes.note,
        createdAt: lmsLessonNotes.createdAt,
        updatedAt: lmsLessonNotes.updatedAt,
        lessonTitle: lmsLessons.title,
      })
        .from(lmsLessonNotes)
        .innerJoin(lmsLessons, eq(lmsLessonNotes.lessonId, lmsLessons.id))
        .where(and(eq(lmsLessonNotes.userId, ctx.user.id), eq(lmsLessonNotes.courseId, course.id)))
        .orderBy(desc(lmsLessonNotes.updatedAt));
      return notes;
    }),

  /** Save (create or update) a note for a lesson */
  saveNote: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      courseSlug: z.string(),
      note: z.string().max(10000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const [existing] = await db.select({ id: lmsLessonNotes.id }).from(lmsLessonNotes)
        .where(and(eq(lmsLessonNotes.userId, ctx.user.id), eq(lmsLessonNotes.lessonId, input.lessonId))).limit(1);
      if (existing) {
        await db.update(lmsLessonNotes).set({ note: input.note }).where(eq(lmsLessonNotes.id, existing.id));
        return { id: existing.id };
      }
      const [result] = await db.insert(lmsLessonNotes).values({
        userId: ctx.user.id,
        lessonId: input.lessonId,
        courseId: course.id,
        note: input.note,
      }).$returningId();
      return { id: result.id };
    }),

  /** Delete a note */
  deleteNote: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [note] = await db.select({ userId: lmsLessonNotes.userId }).from(lmsLessonNotes).where(eq(lmsLessonNotes.id, input.noteId)).limit(1);
      if (!note || note.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(lmsLessonNotes).where(eq(lmsLessonNotes.id, input.noteId));
      return { success: true };
    }),

  // ── Bookmarks ─────────────────────────────────────────────────────────────

  /** Get all bookmarks for a course */
  getCourseBookmarks: protectedProcedure
    .input(z.object({ courseSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const bookmarks = await db.select({
        id: lmsLessonBookmarks.id,
        lessonId: lmsLessonBookmarks.lessonId,
        createdAt: lmsLessonBookmarks.createdAt,
        lessonTitle: lmsLessons.title,
        lessonType: lmsLessons.type,
      })
        .from(lmsLessonBookmarks)
        .innerJoin(lmsLessons, eq(lmsLessonBookmarks.lessonId, lmsLessons.id))
        .where(and(eq(lmsLessonBookmarks.userId, ctx.user.id), eq(lmsLessonBookmarks.courseId, course.id)))
        .orderBy(desc(lmsLessonBookmarks.createdAt));
      return bookmarks;
    }),

  /** Toggle bookmark for a lesson */
  toggleBookmark: protectedProcedure
    .input(z.object({ lessonId: z.number(), courseSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const [existing] = await db.select({ id: lmsLessonBookmarks.id }).from(lmsLessonBookmarks)
        .where(and(eq(lmsLessonBookmarks.userId, ctx.user.id), eq(lmsLessonBookmarks.lessonId, input.lessonId))).limit(1);
      if (existing) {
        await db.delete(lmsLessonBookmarks).where(eq(lmsLessonBookmarks.id, existing.id));
        return { bookmarked: false };
      }
      await db.insert(lmsLessonBookmarks).values({
        userId: ctx.user.id,
        lessonId: input.lessonId,
        courseId: course.id,
      });
      return { bookmarked: true };
    }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────

export const lmsAdminRouter = router({
  // ── Courses ──
  listCourses: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "public", "hidden", "private", "archived", "all"]).default("all"),
      type: z.enum(["course", "quiz", "download", "all"]).default("all"),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (input.status !== "all") conditions.push(eq(lmsCourses.status, input.status as "draft" | "public" | "hidden" | "private"));
      if (input.type !== "all") conditions.push(eq(lmsCourses.type, input.type as "course" | "quiz" | "download"));
      const offset = (input.page - 1) * input.pageSize;
      const courses = await db.select().from(lmsCourses).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(lmsCourses.updatedAt)).limit(input.pageSize).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lmsCourses).where(conditions.length ? and(...conditions) : undefined);
      return { courses, total: Number(count) };
    }),

  createCourse: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      subtitle: z.string().max(500).optional(),
      type: z.enum(["course", "quiz", "download"]).default("course"),
      brand: z.enum(["aaus", "iheartecho"]).default("aaus"),
      pricingType: z.enum(["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).default("one_time"),
      price: z.number().int().min(0).default(0),
      isFree: z.boolean().default(false),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
      accessDurationDays: z.number().int().min(1).nullable().optional(),
      downPayment: z.number().int().min(0).optional(),
      installmentCount: z.number().int().min(0).optional(),
      installmentAmount: z.number().int().min(0).optional(),
      installmentIntervalDays: z.number().int().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const base = generateSlug(input.title);
      const slug = await uniqueSlug(db, base);
      const isFree = input.pricingType === "free" || input.isFree;
      const [result] = await db.insert(lmsCourses).values({
        slug, title: input.title, subtitle: input.subtitle ?? null,
        type: input.type, brand: input.brand, price: input.price,
        isFree, pricingType: input.pricingType,
        subscriptionInterval: input.subscriptionInterval ?? null,
        trialDays: input.trialDays ?? null,
        accessDurationDays: input.accessDurationDays ?? null,
        downPayment: input.downPayment ?? null,
        installmentCount: input.installmentCount ?? null,
        installmentAmount: input.installmentAmount ?? null,
        installmentIntervalDays: input.installmentIntervalDays ?? null,
        createdByUserId: ctx.user.id,
      }).$returningId();
      // Auto-create landing page stub
      await db.insert(lmsLandingPages).values({ courseId: result.id, heroTitle: input.title, ctaText: "Enroll Now" });
      return { id: result.id, slug };
    }),

  updateCourse: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      subtitle: z.string().max(500).optional(),
      description: z.string().optional(),
      coverImageUrl: z.string().optional(),
      status: z.enum(["draft", "public", "hidden", "private", "archived"]).optional(),
      type: z.enum(["course", "quiz", "download"]).optional(),
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      price: z.number().int().min(0).optional(),
      isFree: z.boolean().optional(),
      pricingType: z.enum(["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).nullable().optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
      accessDurationDays: z.number().int().min(1).nullable().optional(),
      downPayment: z.number().int().min(0).nullable().optional(),
      installmentCount: z.number().int().min(0).nullable().optional(),
      installmentAmount: z.number().int().min(0).nullable().optional(),
      installmentIntervalDays: z.number().int().min(1).nullable().optional(),
      hasCertificate: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
      isDrip: z.boolean().optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, pricingType, ...updates } = input;
      // Sync isFree with pricingType
      const extra: Record<string, any> = {};
      if (pricingType !== undefined) {
        extra.pricingType = pricingType;
        extra.isFree = pricingType === "free";
      }
      const filtered = { ...Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)), ...extra };
      if (Object.keys(filtered).length > 0) {
        await db.update(lmsCourses).set(filtered).where(eq(lmsCourses.id, id));
      }
      return { success: true };
    }),

  deleteCourse: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCourses).where(eq(lmsCourses.id, input.id));
      return { success: true };
    }),

  uploadCourseCoverImage: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      dataUri: z.string().min(1).max(10_000_000), // ~7.5 MB image
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch the course title for the media asset name
      const [course] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      const base64Data = input.dataUri.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1];
      const suffix = randomBytes(4).toString("hex");
      const slug = `lms-cover-${input.courseId}-${suffix}`;
      const fileName = `cover-${suffix}.${ext}`;
      const fileKey = `media-repo/${slug}/${fileName}`;

      // Upload to S3
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Create Media Repository asset record
      const [assetResult] = await db.insert(mediaAssets).values({
        slug,
        title: `${course.title} — Cover Image`,
        description: `Course card cover image for "${course.title}"`,
        mediaType: "image",
        mimeType: input.mimeType,
        access: "public",
        tags: "lms,cover,course",
        folder: "Course Covers",
        thumbnailUrl: url,
        createdByUserId: ctx.user.id,
      });
      const assetId = (assetResult as any).insertId as number;

      // Create version record
      await db.insert(mediaVersions).values({
        assetId,
        versionNumber: 1,
        s3Key: fileKey,
        s3Url: url,
        fileName,
        fileSize: buffer.byteLength,
        mimeType: input.mimeType,
        notes: "Auto-uploaded from LMS course settings",
        uploadedByUserId: ctx.user.id,
      });

      // Update the course coverImageUrl
      await db.update(lmsCourses).set({ coverImageUrl: url }).where(eq(lmsCourses.id, input.courseId));
      return { url, assetId };
    }),

  uploadLandingPageHeroImage: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      dataUri: z.string().min(1).max(10_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [course] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      const base64Data = input.dataUri.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1];
      const suffix = randomBytes(4).toString("hex");
      const slug = `lms-hero-${input.courseId}-${suffix}`;
      const fileName = `hero-${suffix}.${ext}`;
      const fileKey = `media-repo/${slug}/${fileName}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Create Media Repository asset record
      const [assetResult] = await db.insert(mediaAssets).values({
        slug,
        title: `${course.title} — Hero Banner`,
        description: `Landing page hero banner for "${course.title}"`,
        mediaType: "image",
        mimeType: input.mimeType,
        access: "public",
        tags: "lms,hero,landing-page",
        folder: "Course Covers",
        thumbnailUrl: url,
        createdByUserId: ctx.user.id,
      });
      const assetId = (assetResult as any).insertId as number;

      await db.insert(mediaVersions).values({
        assetId,
        versionNumber: 1,
        s3Key: fileKey,
        s3Url: url,
        fileName,
        fileSize: buffer.byteLength,
        mimeType: input.mimeType,
        notes: "Auto-uploaded from LMS landing page editor",
        uploadedByUserId: ctx.user.id,
      });

      // Upsert the landing page heroImageUrl
      const [existing] = await db.select({ id: lmsLandingPages.id }).from(lmsLandingPages).where(eq(lmsLandingPages.courseId, input.courseId)).limit(1);
      if (existing) {
        await db.update(lmsLandingPages).set({ heroImageUrl: url }).where(eq(lmsLandingPages.courseId, input.courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId: input.courseId, heroImageUrl: url, isCustom: true });
      }
      return { url, assetId };
    }),

  getCourse: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.id)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const sections = await db.select().from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position));
      const sectionsWithLessons = await Promise.all(sections.map(async (s) => {
        const lessons = await db.select().from(lmsLessons).where(eq(lmsLessons.sectionId, s.id)).orderBy(asc(lmsLessons.position));
        return { ...s, lessons };
      }));
      // Top-level lessons (not inside any section)
      const topLevelLessons = await db.select().from(lmsLessons)
        .where(and(eq(lmsLessons.courseId, course.id), isNull(lmsLessons.sectionId)))
        .orderBy(asc(lmsLessons.position));
      const [landingPage] = await db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, course.id)).limit(1);
      const cis = await db.select().from(lmsCourseInstructors).where(eq(lmsCourseInstructors.courseId, course.id));
      return { ...course, sections: sectionsWithLessons, topLevelLessons, landingPage: landingPage ?? null, courseInstructors: cis };
    }),

  // ── Sections ──
  createSection: protectedProcedure
    .input(z.object({ courseId: z.number(), title: z.string().min(1), position: z.number().int().default(0) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsSections).values(input).$returningId();
      return { id: result.id };
    }),

  updateSection: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1).optional(), position: z.number().int().optional(), isPreview: z.boolean().optional(), dripDays: z.number().int().min(0).optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      await db.update(lmsSections).set(updates).where(eq(lmsSections.id, id));
      return { success: true };
    }),

  deleteSection: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsLessons).where(eq(lmsLessons.sectionId, input.id));
      await db.delete(lmsSections).where(eq(lmsSections.id, input.id));
      return { success: true };
    }),

  reorderSections: protectedProcedure
    .input(z.object({ sections: z.array(z.object({ id: z.number(), position: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.sections.map(s => db.update(lmsSections).set({ position: s.position }).where(eq(lmsSections.id, s.id))));
      return { success: true };
    }),

  // ── Lessons ──
  createLesson: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      sectionId: z.number().optional(), // optional — top-level lessons have no section
      title: z.string().min(1),
      type: z.enum(["video", "text", "quiz", "download", "embed", "video_text"]).default("text"),
      position: z.number().int().default(0),
      content: z.string().optional(),
      videoContent: z.string().optional(),
      embedUrl: z.string().max(500).optional(),
      mediaAssetId: z.number().optional(),
      isPreview: z.boolean().default(false),
      dripDays: z.number().int().default(0),
      durationMinutes: z.number().int().optional(),
      requireVideoCompletion: z.boolean().default(false),
      requireManualComplete: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsLessons).values({
        courseId: input.courseId,
        sectionId: input.sectionId ?? null,
        title: input.title,
        type: input.type,
        position: input.position,
        content: input.content ?? null,
        videoContent: input.videoContent ?? null,
        embedUrl: input.embedUrl ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        isPreview: input.isPreview,
        dripDays: input.dripDays,
        durationMinutes: input.durationMinutes ?? null,
        requireVideoCompletion: input.requireVideoCompletion ? 1 : 0,
        requireManualComplete: input.requireManualComplete ? 1 : 0,
      }).$returningId();
      // Auto-create quiz if type is quiz
      if (input.type === "quiz") {
        await db.insert(lmsQuizzes).values({ lessonId: result.id, title: input.title });
      }
      return { id: result.id };
    }),

  updateLesson: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      type: z.enum(["video", "text", "quiz", "download", "embed", "video_text"]).optional(),
      content: z.string().nullable().optional(),
      videoContent: z.string().nullable().optional(),
      embedUrl: z.string().max(500).nullable().optional(),
      mediaAssetId: z.number().nullable().optional(),
      position: z.number().int().optional(),
      isPreview: z.boolean().optional(),
      dripDays: z.number().int().optional(),
      durationMinutes: z.number().int().nullable().optional(),
      requireVideoCompletion: z.boolean().optional(),
      requireManualComplete: z.boolean().optional(),
      contentBlocks: z.string().nullable().optional(), // JSON array of Block objects
      learningObjectives: z.string().nullable().optional(), // JSON array of strings
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, requireVideoCompletion, requireManualComplete, ...rest } = input;
      const updates: Record<string, unknown> = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );
      if (requireVideoCompletion !== undefined) updates.requireVideoCompletion = requireVideoCompletion ? 1 : 0;
      if (requireManualComplete !== undefined) updates.requireManualComplete = requireManualComplete ? 1 : 0;
      if (Object.keys(updates).length > 0) await db.update(lmsLessons).set(updates).where(eq(lmsLessons.id, id));
      return { success: true };
    }),

  deleteLesson: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsLessonProgress).where(eq(lmsLessonProgress.lessonId, input.id));
      await db.delete(lmsLessons).where(eq(lmsLessons.id, input.id));
      return { success: true };
    }),

  reorderLessons: protectedProcedure
    .input(z.object({ lessons: z.array(z.object({ id: z.number(), position: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.lessons.map(l => db.update(lmsLessons).set({ position: l.position }).where(eq(lmsLessons.id, l.id))));
      return { success: true };
    }),

  // ── Lesson Effects ──
  updateLessonEffect: protectedProcedure
    .input(z.object({
      id: z.number(),
      effectEnabled: z.boolean(),
      effectTrigger: z.enum(["lesson_start", "lesson_complete"]),
      effectBannerText: z.string().max(500).optional(),
      effectBannerBgColor: z.string().max(20).optional(),
      effectBannerTextColor: z.string().max(20).optional(),
      effectSound: z.string().max(50).optional(),
      effectSoundUrl: z.string().max(500).optional(),
      effectConfetti: z.boolean(),
      effectConfettiColors: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsLessons).set({
        effectEnabled: input.effectEnabled,
        effectTrigger: input.effectTrigger,
        effectBannerText: input.effectBannerText ?? null,
        effectBannerBgColor: input.effectBannerBgColor ?? null,
        effectBannerTextColor: input.effectBannerTextColor ?? null,
        effectSound: input.effectSound ?? null,
        effectSoundUrl: input.effectSoundUrl ?? null,
        effectConfetti: input.effectConfetti,
        effectConfettiColors: input.effectConfettiColors ?? null,
      }).where(eq(lmsLessons.id, input.id));
      return { success: true };
    }),

  // ── Quizzes ──
  getQuiz: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, input.lessonId)).limit(1);
      if (!quiz) return null;
      const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id)).orderBy(asc(lmsQuizQuestions.position));
      return { ...quiz, questions };
    }),

  updateQuiz: protectedProcedure
    .input(z.object({ lessonId: z.number(), passingScore: z.number().int().min(0).max(100).optional(), allowRetakes: z.boolean().optional(), showCorrectAnswers: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { lessonId, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) await db.update(lmsQuizzes).set(filtered).where(eq(lmsQuizzes.lessonId, lessonId));
      return { success: true };
    }),

  addQuestion: protectedProcedure
    .input(z.object({
      quizId: z.number(), question: z.string().min(1),
      type: z.enum(["mcq", "truefalse"]).default("mcq"),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string().min(1),
      explanation: z.string().optional(),
      position: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsQuizQuestions).values({
        ...input, options: input.options ? JSON.stringify(input.options) : null, explanation: input.explanation ?? null,
      }).$returningId();
      return { id: result.id };
    }),

  updateQuestion: protectedProcedure
    .input(z.object({
      id: z.number(), question: z.string().min(1).optional(),
      type: z.enum(["mcq", "truefalse"]).optional(),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string().optional(), explanation: z.string().optional(), position: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, options, ...rest } = input;
      const updates: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      if (options !== undefined) updates.options = JSON.stringify(options);
      if (Object.keys(updates).length > 0) await db.update(lmsQuizQuestions).set(updates).where(eq(lmsQuizQuestions.id, id));
      return { success: true };
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsQuizQuestions).where(eq(lmsQuizQuestions.id, input.id));
      return { success: true };
    }),

  aiGenerateQuizQuestions: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      topic: z.string().min(1).max(500),
      count: z.number().int().min(1).max(50).default(10),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
      questionType: z.enum(["mcq", "truefalse", "mixed"]).default("mcq"),
      courseId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Optionally inject course content as context
      let courseContext = "";
      if (input.courseId) {
        try {
          const [course] = await db
            .select({ title: lmsCourses.title, description: lmsCourses.description })
            .from(lmsCourses)
            .where(eq(lmsCourses.id, input.courseId))
            .limit(1);
          if (course) {
            const sections = await db
              .select({ title: lmsSections.title })
              .from(lmsSections)
              .where(eq(lmsSections.courseId, input.courseId))
              .orderBy(asc(lmsSections.position));
            const lessons = await db
              .select({ title: lmsLessons.title, description: lmsLessons.description })
              .from(lmsLessons)
              .where(eq(lmsLessons.courseId, input.courseId))
              .orderBy(asc(lmsLessons.position));
            courseContext = `\n\nCourse context for question generation:\nCourse: "${course.title}"\nDescription: ${course.description ?? "N/A"}\nModules: ${sections.map(s => s.title).join(", ") || "N/A"}\nLessons: ${lessons.map(l => l.title).join(", ") || "N/A"}\n\nUse this course content to make questions directly relevant to what students are learning.`;
          }
        } catch {
          // Ignore context fetch errors — proceed without course context
        }
      }

      const typeInstruction =
        input.questionType === "mcq"
          ? "All questions must be multiple-choice with exactly 4 options."
          : input.questionType === "truefalse"
          ? 'All questions must be true/false. Options must be exactly ["True", "False"].'
          : 'Mix of multiple-choice (4 options each) and true/false questions (["True", "False"] options).';

      const systemPrompt = `You are a medical education expert specializing in ultrasound and sonography. Generate high-quality quiz questions for healthcare professionals and students. Always use United States English spelling. Return ONLY valid JSON — no markdown, no code fences, no extra text.`;

      const userPrompt = `Generate exactly ${input.count} quiz questions about: "${input.topic}".
Difficulty: ${input.difficulty}.
${typeInstruction}${courseContext}

Return a JSON array of objects with this exact shape:
[
  {
    "question": "string — the question text",
    "type": "mcq" | "truefalse",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "string — must exactly match one of the options",
    "explanation": "string — brief explanation of why the answer is correct (1-2 sentences)"
  }
]

Rules:
- Questions must be clinically accurate and relevant to ultrasound/sonography practice
- Each question must be distinct and test a different concept
- correctAnswer must exactly match one of the options (case-sensitive)
- For truefalse, options must be exactly ["True", "False"]
- For mcq, provide exactly 4 options
- Explanations should cite relevant anatomy, physics, or clinical guidelines where appropriate`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "quiz_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      type: { type: "string", enum: ["mcq", "truefalse"] },
                      options: { type: "array", items: { type: "string" } },
                      correctAnswer: { type: "string" },
                      explanation: { type: "string" },
                    },
                    required: ["question", "type", "options", "correctAnswer", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      });

      let questions: Array<{ question: string; type: string; options: string[]; correctAnswer: string; explanation: string }>;
      try {
        const raw = response.choices[0].message.content as string;
        const parsed = JSON.parse(raw);
        questions = Array.isArray(parsed) ? parsed : parsed.questions;
        if (!Array.isArray(questions)) throw new Error("Not an array");
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned invalid JSON. Please try again." });
      }

      return { questions };
    }),

  bulkInsertQuizQuestions: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      questions: z.array(z.object({
        question: z.string().min(1),
        type: z.enum(["mcq", "truefalse"]),
        options: z.array(z.string()),
        correctAnswer: z.string().min(1),
        explanation: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get current max position
      const existing = await db.select({ pos: lmsQuizQuestions.position })
        .from(lmsQuizQuestions)
        .where(eq(lmsQuizQuestions.quizId, input.quizId))
        .orderBy(desc(lmsQuizQuestions.position))
        .limit(1);
      let nextPos = existing.length > 0 ? (existing[0].pos ?? 0) + 1 : 0;

      for (const q of input.questions) {
        await db.insert(lmsQuizQuestions).values({
          quizId: input.quizId,
          question: q.question,
          type: q.type as "mcq" | "truefalse",
          options: JSON.stringify(q.options),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation ?? null,
          position: nextPos++,
        });
      }

      return { inserted: input.questions.length };
    }),

  // ── Landing Pages ──
  updateLandingPage: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      heroTitle: z.string().optional(), heroSubtitle: z.string().optional(),
      heroImageUrl: z.string().optional(), bodyContent: z.string().optional(),
      ctaText: z.string().optional(), whatYouLearn: z.string().optional(),
      requirements: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { courseId, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      const [existing] = await db.select({ id: lmsLandingPages.id }).from(lmsLandingPages).where(eq(lmsLandingPages.courseId, courseId)).limit(1);
      if (existing) {
        await db.update(lmsLandingPages).set({ ...filtered, isCustom: true }).where(eq(lmsLandingPages.courseId, courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId, ...filtered, isCustom: true });
      }
      return { success: true };
    }),

  // ── Landing Page Blocks (page builder) ──
  getLandingPageBlocks: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lp] = await db.select({
        blocks: lmsLandingPages.blocks,
        heroTitle: lmsLandingPages.heroTitle,
        heroSubtitle: lmsLandingPages.heroSubtitle,
        heroImageUrl: lmsLandingPages.heroImageUrl,
        ctaText: lmsLandingPages.ctaText,
      }).from(lmsLandingPages).where(eq(lmsLandingPages.courseId, input.courseId)).limit(1);
      const [course] = await db.select({
        title: lmsCourses.title,
        slug: lmsCourses.slug,
        coverImageUrl: lmsCourses.coverImageUrl,
        subtitle: lmsCourses.subtitle,
        price: lmsCourses.price,
      }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      return {
        blocks: lp?.blocks ? JSON.parse(lp.blocks) : null,
        heroTitle: lp?.heroTitle ?? course?.title ?? "",
        heroSubtitle: lp?.heroSubtitle ?? course?.subtitle ?? "",
        heroImageUrl: lp?.heroImageUrl ?? course?.coverImageUrl ?? "",
        ctaText: lp?.ctaText ?? "Enroll Now",
        courseTitle: course?.title ?? "",
        courseSlug: course?.slug ?? "",
        coursePrice: course?.price ?? 0,
      };
    }),
  saveLandingPageBlocks: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      blocks: z.array(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const blocksJson = JSON.stringify(input.blocks);
      const [existing] = await db.select({ id: lmsLandingPages.id })
        .from(lmsLandingPages).where(eq(lmsLandingPages.courseId, input.courseId)).limit(1);
      if (existing) {
        await db.update(lmsLandingPages)
          .set({ blocks: blocksJson, isCustom: true })
          .where(eq(lmsLandingPages.courseId, input.courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId: input.courseId, blocks: blocksJson, isCustom: true });
      }
      return { success: true };
    }),
  // ── Page Templates ──
  listPageTemplates: protectedProcedure
    .input(z.object({ templateType: z.enum(["page", "block"]).optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(lmsPageTemplates)
        .where(input.templateType ? eq(lmsPageTemplates.templateType, input.templateType) : undefined)
        .orderBy(lmsPageTemplates.updatedAt);
      return rows.map(r => ({
        ...r,
        blocks: typeof r.blocks === "string" ? JSON.parse(r.blocks) : r.blocks,
      }));
    }),

  savePageTemplate: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      templateType: z.enum(["page", "block"]).default("page"),
      blockType: z.string().optional(),
      blocks: z.array(z.any()),
      thumbnailUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();
      const blocksJson = JSON.stringify(input.blocks);
      if (input.id) {
        await db.update(lmsPageTemplates)
          .set({ name: input.name, description: input.description ?? null, templateType: input.templateType, blockType: input.blockType ?? null, blocks: blocksJson, thumbnailUrl: input.thumbnailUrl ?? null, updatedAt: now })
          .where(eq(lmsPageTemplates.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(lmsPageTemplates).values({
          name: input.name,
          description: input.description ?? null,
          templateType: input.templateType,
          blockType: input.blockType ?? null,
          blocks: blocksJson,
          thumbnailUrl: input.thumbnailUrl ?? null,
          createdBy: ctx.user.id,
          createdAt: now,
          updatedAt: now,
        });
        return { id: (result as any).insertId };
      }
    }),

  deletePageTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsPageTemplates).where(eq(lmsPageTemplates.id, input.id));
      return { success: true };
    }),

  // ── Enrollments ──
  listEnrollments: protectedProcedure
    .input(z.object({ courseId: z.number().optional(), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = input.courseId ? [eq(lmsEnrollments.courseId, input.courseId)] : [];
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db.select().from(lmsEnrollments).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(lmsEnrollments.enrolledAt)).limit(input.pageSize).offset(offset);
      const enriched = await Promise.all(rows.map(async (e) => {
        const [u] = await db.select({ id: users.id, displayName: users.displayName, email: users.email }).from(users).where(eq(users.id, e.userId)).limit(1);
        const [c] = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, e.courseId)).limit(1);
        return { ...e, user: u ?? null, course: c ?? null };
      }));
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lmsEnrollments).where(conditions.length ? and(...conditions) : undefined);
      return { enrollments: enriched, total: Number(count) };
    }),

  addEnrollment: protectedProcedure
    .input(z.object({ userId: z.number(), courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select().from(lmsEnrollments).where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, input.courseId))).limit(1);
      if (existing) return { enrollmentId: existing.id, alreadyEnrolled: true };
      const [result] = await db.insert(lmsEnrollments).values({ userId: input.userId, courseId: input.courseId }).$returningId();
      return { enrollmentId: result.id, alreadyEnrolled: false };
    }),

  removeEnrollment: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsEnrollments).where(eq(lmsEnrollments.id, input.id));
      return { success: true };
    }),

  // ── Groups ──
  listGroups: protectedProcedure
    .input(z.object({ courseId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const groups = await db.select().from(lmsGroups).where(input.courseId ? eq(lmsGroups.courseId, input.courseId) : undefined).orderBy(desc(lmsGroups.createdAt));
      const enriched = await Promise.all(groups.map(async (g) => {
        const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, g.id));
        const usedSeats = seats.filter(s => s.acceptedAt).length;
        const [c] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, g.courseId)).limit(1);
        return { ...g, seats: g.seats, usedSeats, course: c ?? null, seatList: seats };
      }));
      return enriched;
    }),

  createGroup: protectedProcedure
    .input(z.object({ courseId: z.number(), name: z.string().min(1), seats: z.number().int().min(1), managerId: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsGroups).values({ ...input, managerId: input.managerId ?? null, notes: input.notes ?? null }).$returningId();
      return { id: result.id };
    }),

  updateGroup: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), seats: z.number().int().min(1).optional(), managerId: z.number().nullable().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) await db.update(lmsGroups).set(filtered).where(eq(lmsGroups.id, id));
      return { success: true };
    }),

  assignSeat: protectedProcedure
    .input(z.object({ groupId: z.number(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [group] = await db.select().from(lmsGroups).where(eq(lmsGroups.id, input.groupId)).limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.groupId));
      if (seats.length >= group.seats) throw new TRPCError({ code: "BAD_REQUEST", message: "No seats remaining" });
      const existing = seats.find(s => s.email.toLowerCase() === input.email.toLowerCase());
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Email already assigned" });
      const token = randomBytes(32).toString("hex");
      const [result] = await db.insert(lmsGroupSeats).values({ groupId: input.groupId, email: input.email, inviteToken: token }).$returningId();
      return { id: result.id, token };
    }),

  revokeSeat: protectedProcedure
    .input(z.object({ seatId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsGroupSeats).where(eq(lmsGroupSeats.id, input.seatId));
      return { success: true };
    }),

  // ── Instructors ──
  listInstructors: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(lmsInstructors).orderBy(asc(lmsInstructors.name));
  }),

  createInstructor: protectedProcedure
    .input(z.object({ name: z.string().min(1), title: z.string().optional(), bio: z.string().optional(), avatarUrl: z.string().optional(), website: z.string().optional(), userId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsInstructors).values({
        name: input.name, title: input.title ?? null, bio: input.bio ?? null,
        avatarUrl: input.avatarUrl ?? null, website: input.website ?? null, userId: input.userId ?? null,
      }).$returningId();
      return { id: result.id };
    }),

  updateInstructor: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), title: z.string().optional(), bio: z.string().optional(), avatarUrl: z.string().optional(), website: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) await db.update(lmsInstructors).set(filtered).where(eq(lmsInstructors.id, id));
      return { success: true };
    }),

  setCourseInstructors: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      instructors: z.array(z.object({ instructorId: z.number(), revenueSharePct: z.number().int().min(0).max(100), isPrimary: z.boolean() })),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCourseInstructors).where(eq(lmsCourseInstructors.courseId, input.courseId));
      if (input.instructors.length > 0) {
        await db.insert(lmsCourseInstructors).values(input.instructors.map(i => ({ courseId: input.courseId, ...i })));
      }
      return { success: true };
    }),

  // ── Affiliates ──
  listAffiliates: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(lmsAffiliates).orderBy(desc(lmsAffiliates.createdAt));
  }),

  createAffiliate: protectedProcedure
    .input(z.object({ name: z.string().min(1), email: z.string().email().optional(), commissionPct: z.number().int().min(0).max(100).default(10), userId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const code = randomBytes(4).toString("hex").toUpperCase();
      const [result] = await db.insert(lmsAffiliates).values({
        name: input.name, email: input.email ?? null, commissionPct: input.commissionPct,
        code, userId: input.userId ?? null,
      }).$returningId();
      return { id: result.id, code };
    }),

  updateAffiliate: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), commissionPct: z.number().int().min(0).max(100).optional(), isActive: z.boolean().optional(), markPaid: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, markPaid, ...updates } = input;
      if (markPaid) {
        const [aff] = await db.select().from(lmsAffiliates).where(eq(lmsAffiliates.id, id)).limit(1);
        if (aff) {
          await db.update(lmsAffiliates).set({ totalPaid: aff.totalPaid + aff.totalEarned }).where(eq(lmsAffiliates.id, id));
          await db.update(lmsAffiliateConversions).set({ paidAt: new Date() }).where(and(eq(lmsAffiliateConversions.affiliateId, id), isNull(lmsAffiliateConversions.paidAt)));
        }
      }
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) await db.update(lmsAffiliates).set(filtered).where(eq(lmsAffiliates.id, id));
      return { success: true };
    }),

  // ── Analytics ──
  getAnalytics: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [{ totalCourses }] = await db.select({ totalCourses: sql<number>`count(*)` }).from(lmsCourses);
    const [{ totalEnrollments }] = await db.select({ totalEnrollments: sql<number>`count(*)` }).from(lmsEnrollments);
    const [{ totalRevenue }] = await db.select({ totalRevenue: sql<number>`coalesce(sum(amount), 0)` }).from(lmsOrders).where(eq(lmsOrders.status, "paid"));
    const [{ completions }] = await db.select({ completions: sql<number>`count(*)` }).from(lmsEnrollments).where(isNotNull(lmsEnrollments.completedAt));
    const topCourses = await db.select({
      courseId: lmsEnrollments.courseId,
      enrollments: sql<number>`count(*)`,
    }).from(lmsEnrollments).groupBy(lmsEnrollments.courseId).orderBy(desc(sql`count(*)`)).limit(5);
    const topCoursesEnriched = await Promise.all(topCourses.map(async (t) => {
      const [c] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, t.courseId)).limit(1);
      return { ...t, course: c ?? null };
    }));
    return { totalCourses: Number(totalCourses), totalEnrollments: Number(totalEnrollments), totalRevenue: Number(totalRevenue), completions: Number(completions), topCourses: topCoursesEnriched };
  }),

  getOrders: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const orders = await db.select().from(lmsOrders).orderBy(desc(lmsOrders.createdAt)).limit(input.pageSize).offset(offset);
      const enriched = await Promise.all(orders.map(async (o) => {
        const [u] = await db.select({ displayName: users.displayName, email: users.email }).from(users).where(eq(users.id, o.userId)).limit(1);
        const [c] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, o.courseId)).limit(1);
        return { ...o, user: u ?? null, course: c ?? null };
      }));
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lmsOrders);
      return { orders: enriched, total: Number(count) };
    }),

  // ── AI Generate ──
  aiGenerateCourse: protectedProcedure
    .input(z.object({
      topics: z.string().min(3).max(10000),
      productType: z.enum(["course", "quiz"]).default("course"),
      targetAudience: z.string().max(500).optional(),
      difficultyLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      estimatedDurationMinutes: z.number().int().min(5).max(600).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);

      const systemPrompt = `You are an expert medical education curriculum designer specializing in ultrasound and echocardiography for All About Ultrasound™ and iHeartEcho™.
You create structured, clinically accurate, and pedagogically sound course content.
Always use United States English spelling.
Return ONLY valid JSON — no markdown, no code fences, no extra text.`;

      const isQuiz = input.productType === "quiz";

      const userPrompt = isQuiz
        ? `Create a standalone quiz on the following ultrasound/echocardiography topics:
"${input.topics}"
${input.targetAudience ? `Target audience: ${input.targetAudience}` : ""}
${input.difficultyLevel ? `Difficulty: ${input.difficultyLevel}` : ""}

Return a JSON object with this exact structure:
{
  "title": "Quiz title (concise, clinical)",
  "subtitle": "One-line subtitle",
  "questions": [
    {
      "question": "Question text",
      "type": "mcq",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Brief clinical explanation of the correct answer"
    }
  ],
  "landingPage": {
    "heroTitle": "Engaging hero headline",
    "heroSubtitle": "One sentence description",
    "ctaText": "Start Quiz",
    "whatYouLearn": "<ul><li>Key topic 1</li><li>Key topic 2</li><li>Key topic 3</li></ul>",
    "bodyContent": "<p>2-3 paragraph HTML description of the quiz</p>",
    "requirements": "<p>Who this quiz is for and any prerequisites</p>"
  }
}
Generate 10-20 high-quality MCQ questions. Each question must have exactly 4 options.`
        : `Create a comprehensive course on the following ultrasound/echocardiography topics:
"${input.topics}"
${input.targetAudience ? `Target audience: ${input.targetAudience}` : ""}
${input.difficultyLevel ? `Difficulty: ${input.difficultyLevel}` : ""}
${input.estimatedDurationMinutes ? `Estimated duration: ${input.estimatedDurationMinutes} minutes` : ""}

Return a JSON object with this exact structure:
{
  "title": "Course title (concise, clinical)",
  "subtitle": "One-line subtitle",
  "sections": [
    {
      "title": "Section title",
      "lessons": [
        {
          "title": "Lesson title",
          "type": "text",
          "durationMinutes": 10,
          "content": "<p>Detailed lesson content in HTML. Include clinical context, key concepts, and practical tips. Minimum 150 words per lesson.</p>"
        }
      ]
    }
  ],
  "landingPage": {
    "heroTitle": "Engaging hero headline",
    "heroSubtitle": "One sentence description",
    "ctaText": "Enroll Now",
    "whatYouLearn": "<ul><li>Learning outcome 1</li><li>Learning outcome 2</li><li>Learning outcome 3</li><li>Learning outcome 4</li><li>Learning outcome 5</li></ul>",
    "bodyContent": "<p>2-3 paragraph HTML description of the course</p>",
    "requirements": "<p>Prerequisites and who this course is designed for</p>"
  }
}
Generate 3-6 sections with 2-5 lessons each. Lesson types can be: text, video (for placeholder), quiz.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const raw = String(response?.choices?.[0]?.message?.content ?? "{}");
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned invalid JSON. Please try again." });
      }

      return { generated: parsed, productType: input.productType };
    }),

  aiCommitCourse: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      productType: z.enum(["course", "quiz"]),
      generated: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { courseId, generated, productType } = input;

      // Upsert landing page
      if (generated.landingPage) {
        const lp = generated.landingPage;
        const [existing] = await db.select({ id: lmsLandingPages.id }).from(lmsLandingPages).where(eq(lmsLandingPages.courseId, courseId)).limit(1);
        const lpData = {
          heroTitle: lp.heroTitle ?? null,
          heroSubtitle: lp.heroSubtitle ?? null,
          ctaText: lp.ctaText ?? "Enroll Now",
          whatYouLearn: lp.whatYouLearn ?? null,
          bodyContent: lp.bodyContent ?? null,
          requirements: lp.requirements ?? null,
          isCustom: true,
        };
        if (existing) {
          await db.update(lmsLandingPages).set(lpData).where(eq(lmsLandingPages.courseId, courseId));
        } else {
          await db.insert(lmsLandingPages).values({ courseId, ...lpData });
        }
        // Also update course title/subtitle if provided
        if (generated.title) {
          await db.update(lmsCourses).set({ title: generated.title, subtitle: generated.subtitle ?? null }).where(eq(lmsCourses.id, courseId));
        }
      }

      if (productType === "course" && Array.isArray(generated.sections)) {
        // Insert sections and lessons
        for (let si = 0; si < generated.sections.length; si++) {
          const sec = generated.sections[si];
          const [secResult] = await db.insert(lmsSections).values({ courseId, title: sec.title, position: si }).$returningId();
          const sectionId = secResult.id;
          if (Array.isArray(sec.lessons)) {
            for (let li = 0; li < sec.lessons.length; li++) {
              const les = sec.lessons[li];
              const lesType = ["video", "text", "quiz", "download"].includes(les.type) ? les.type : "text";
              const [lesResult] = await db.insert(lmsLessons).values({
                courseId,
                sectionId,
                title: les.title,
                type: lesType as "video" | "text" | "quiz" | "download" | "embed" | "video_text",
                position: li,
                content: les.content ?? null,
                durationMinutes: les.durationMinutes ?? null,
                mediaAssetId: null,
              }).$returningId();
              if (lesType === "quiz") {
                await db.insert(lmsQuizzes).values({ lessonId: lesResult.id, title: les.title });
              }
            }
          }
        }
      } else if (productType === "quiz" && Array.isArray(generated.questions)) {
        // For standalone quiz: create a single section + quiz lesson + questions
        const [secResult] = await db.insert(lmsSections).values({ courseId, title: "Quiz Questions", position: 0 }).$returningId();
        const [lesResult] = await db.insert(lmsLessons).values({
          courseId,
          sectionId: secResult.id,
          title: generated.title ?? "Quiz",
          type: "quiz", position: 0, content: null, mediaAssetId: null,
        }).$returningId();
        const [quizResult] = await db.insert(lmsQuizzes).values({ lessonId: lesResult.id, title: generated.title ?? "Quiz" }).$returningId();
        for (let qi = 0; qi < generated.questions.length; qi++) {
          const q = generated.questions[qi];
          await db.insert(lmsQuizQuestions).values({
            quizId: quizResult.id,
            question: q.question,
            type: q.type === "truefalse" ? "truefalse" : "mcq",
            options: Array.isArray(q.options) ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? null,
            position: qi,
          });
        }
      }

      return { success: true };
    }),

  // ── Import from Media Library ──
  importMediaAssetAsLesson: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      sectionId: z.number().optional(), // optional — top-level lesson if omitted
      mediaAssetId: z.number(),
      title: z.string().min(1).max(255),
      position: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch the asset to determine lesson type
      const [asset] = await db.select({ mediaType: mediaAssets.mediaType, mimeType: mediaAssets.mimeType })
        .from(mediaAssets).where(eq(mediaAssets.id, input.mediaAssetId)).limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Media asset not found" });

      // Map media type to lesson type
      let lessonType: "video" | "text" | "quiz" | "download" | "embed" | "video_text" = "text";
      if (asset.mediaType === "video") lessonType = "video";
      else if (["document", "zip", "scorm", "html"].includes(asset.mediaType ?? "")) lessonType = "download";
      else if (asset.mediaType === "audio") lessonType = "video"; // treat audio as video player

      const [result] = await db.insert(lmsLessons).values({
        courseId: input.courseId,
        sectionId: input.sectionId ?? null,
        title: input.title,
        type: lessonType,
        position: input.position,
        content: null,
        mediaAssetId: input.mediaAssetId,
        durationMinutes: null,
      }).$returningId();

      return { id: result.id, lessonType };
    }),

  // ─── Collections Admin ────────────────────────────────────────────────────

  /** List all collections (admin — includes unpublished) */
  listCollections: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const collections = await db.select().from(lmsCollections).orderBy(asc(lmsCollections.position));
    return Promise.all(collections.map(async (col) => {
      const cc = await db.select({ courseId: lmsCollectionCourses.courseId })
        .from(lmsCollectionCourses).where(eq(lmsCollectionCourses.collectionId, col.id));
      return { ...col, courseCount: cc.length, courseIds: cc.map(c => c.courseId) };
    }));
  }),

  /** Create a collection */
  createCollection: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      label: z.string().max(100).optional(),
      color: z.string().max(20).optional(),
      coverImageUrl: z.string().optional(),
      isPublished: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [{ maxPos }] = await db.select({ maxPos: sql<number>`COALESCE(MAX(position), -1)` }).from(lmsCollections);
      const [result] = await db.insert(lmsCollections).values({
        title: input.title,
        description: input.description ?? null,
        label: input.label ?? null,
        color: input.color ?? "#189aa1",
        coverImageUrl: input.coverImageUrl ?? null,
        position: Number(maxPos) + 1,
        isPublished: input.isPublished,
      }).$returningId();
      return { id: result.id };
    }),

  /** Update a collection */
  updateCollection: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      label: z.string().max(100).optional(),
      color: z.string().max(20).optional(),
      coverImageUrl: z.string().optional(),
      isPublished: z.boolean().optional(),
      position: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      const updates: Record<string, unknown> = {};
      if (rest.title !== undefined) updates.title = rest.title;
      if (rest.description !== undefined) updates.description = rest.description;
      if (rest.label !== undefined) updates.label = rest.label;
      if (rest.color !== undefined) updates.color = rest.color;
      if (rest.coverImageUrl !== undefined) updates.coverImageUrl = rest.coverImageUrl;
      if (rest.isPublished !== undefined) updates.isPublished = rest.isPublished;
      if (rest.position !== undefined) updates.position = rest.position;
      await db.update(lmsCollections).set(updates).where(eq(lmsCollections.id, id));
      return { success: true };
    }),

  /** Delete a collection */
  deleteCollection: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCollectionCourses).where(eq(lmsCollectionCourses.collectionId, input.id));
      await db.delete(lmsCollections).where(eq(lmsCollections.id, input.id));
      return { success: true };
    }),

  /** Set courses in a collection (replaces existing) */
  setCollectionCourses: protectedProcedure
    .input(z.object({
      collectionId: z.number(),
      courseIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCollectionCourses).where(eq(lmsCollectionCourses.collectionId, input.collectionId));
      if (input.courseIds.length > 0) {
        await db.insert(lmsCollectionCourses).values(
          input.courseIds.map((courseId, i) => ({ collectionId: input.collectionId, courseId, position: i }))
        );
      }
      return { success: true };
    }),

  // ─── Duplicate Course ─────────────────────────────────────────────────────

  duplicateCourse: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch the source course
      const [src] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.id)).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      // Create new course with "[Copy]" suffix, draft status
      const newTitle = `${src.title} [Copy]`;
      const base = generateSlug(newTitle);
      const newSlug = await uniqueSlug(db, base);
      const [newCourse] = await db.insert(lmsCourses).values({
        slug: newSlug,
        title: newTitle,
        subtitle: src.subtitle,
        description: src.description,
        coverImageUrl: src.coverImageUrl,
        status: "draft",
        type: src.type,
        brand: src.brand,
        price: src.price,
        isFree: src.isFree,
        pricingType: src.pricingType,
        subscriptionInterval: src.subscriptionInterval,
        trialDays: src.trialDays,
        accessDurationDays: src.accessDurationDays,
        downPayment: src.downPayment,
        installmentCount: src.installmentCount,
        installmentAmount: src.installmentAmount,
        installmentIntervalDays: src.installmentIntervalDays,
        hasCertificate: src.hasCertificate,
        isDrip: src.isDrip,
        metaTitle: src.metaTitle,
        metaDescription: src.metaDescription,
        createdByUserId: ctx.user.id,
      }).$returningId();
      const newCourseId = newCourse.id;

      // Copy landing page
      const [lp] = await db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, input.id)).limit(1);
      if (lp) {
        const { id: _lpId, courseId: _lpCid, ...lpRest } = lp;
        await db.insert(lmsLandingPages).values({ ...lpRest, courseId: newCourseId });
      } else {
        await db.insert(lmsLandingPages).values({ courseId: newCourseId, heroTitle: newTitle, ctaText: "Enroll Now" });
      }

      // Copy sections and lessons
      const sections = await db.select().from(lmsSections).where(eq(lmsSections.courseId, input.id)).orderBy(asc(lmsSections.position));
      const sectionIdMap: Record<number, number> = {};
      for (const sec of sections) {
        const { id: _sid, courseId: _scid, ...secRest } = sec;
        const [newSec] = await db.insert(lmsSections).values({ ...secRest, courseId: newCourseId }).$returningId();
        sectionIdMap[sec.id] = newSec.id;
      }

      const lessons = await db.select().from(lmsLessons).where(eq(lmsLessons.courseId, input.id)).orderBy(asc(lmsLessons.position));
      const lessonIdMap: Record<number, number> = {};
      for (const les of lessons) {
        const { id: _lid, courseId: _lcid, ...lesRest } = les;
        const newSectionId = les.sectionId ? (sectionIdMap[les.sectionId] ?? null) : null;
        const [newLes] = await db.insert(lmsLessons).values({ ...lesRest, courseId: newCourseId, sectionId: newSectionId }).$returningId();
        lessonIdMap[les.id] = newLes.id;

        // Copy quiz questions for this lesson
        const [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, les.id)).limit(1);
        if (quiz) {
          const { id: _qid, lessonId: _qlid, ...quizRest } = quiz;
          const [newQuiz] = await db.insert(lmsQuizzes).values({ ...quizRest, lessonId: newLes.id }).$returningId();
          const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id)).orderBy(asc(lmsQuizQuestions.position));
          for (const q of questions) {
            const { id: _qqid, quizId: _qqzid, ...qRest } = q;
            await db.insert(lmsQuizQuestions).values({ ...qRest, quizId: newQuiz.id });
          }
        }
      }

      return { id: newCourseId, slug: newSlug, title: newTitle };
    }),
});

// ─── Group Manager Router ─────────────────────────────────────────────────────

export const lmsGroupRouter = router({
  /** Get groups managed by the current user */
  getMyGroups: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const groups = await db.select().from(lmsGroups).where(eq(lmsGroups.managerId, ctx.user.id));
    return Promise.all(groups.map(async (g) => {
      const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, g.id));
      const [c] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, g.courseId)).limit(1);
      return { ...g, usedSeats: seats.filter(s => s.acceptedAt).length, course: c ?? null, seatList: seats };
    }));
  }),

  /** Group manager assigns a seat by email */
  assignSeat: protectedProcedure
    .input(z.object({ groupId: z.number(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [group] = await db.select().from(lmsGroups).where(and(eq(lmsGroups.id, input.groupId), eq(lmsGroups.managerId, ctx.user.id))).limit(1);
      if (!group) throw new TRPCError({ code: "FORBIDDEN", message: "Not your group" });
      const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.groupId));
      if (seats.length >= group.seats) throw new TRPCError({ code: "BAD_REQUEST", message: "No seats remaining" });
      const existing = seats.find(s => s.email.toLowerCase() === input.email.toLowerCase());
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Email already assigned" });
      const token = randomBytes(32).toString("hex");
      const [result] = await db.insert(lmsGroupSeats).values({ groupId: input.groupId, email: input.email, inviteToken: token }).$returningId();
      return { id: result.id, token };
    }),

  revokeSeat: protectedProcedure
    .input(z.object({ seatId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [seat] = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.id, input.seatId)).limit(1);
      if (!seat) throw new TRPCError({ code: "NOT_FOUND" });
      const [group] = await db.select().from(lmsGroups).where(and(eq(lmsGroups.id, seat.groupId), eq(lmsGroups.managerId, ctx.user.id))).limit(1);
      if (!group) throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(lmsGroupSeats).where(eq(lmsGroupSeats.id, input.seatId));
      return { success: true };
    }),
});
