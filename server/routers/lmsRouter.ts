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
import { getDb } from "../db";
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
  lmsOrders,
  users,
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
  const enrollment = await db.select({ courseId: lmsEnrollments.courseId }).from(lmsEnrollments).where(eq(lmsEnrollments.id, enrollmentId)).limit(1);
  if (!enrollment[0]) return;
  const courseId = enrollment[0].courseId;

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

  await db.update(lmsEnrollments).set({
    progressPct: pct,
    completedAt: pct >= 100 ? new Date() : null,
  }).where(eq(lmsEnrollments.id, enrollmentId));
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

  /** Get a single course by slug (public or preview) */
  getCourse: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.slug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.status === "draft") throw new TRPCError({ code: "NOT_FOUND" });

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
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.slug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Check enrollment
      const [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);

      const sections = await db.select().from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position));
      const sectionsWithLessons = await Promise.all(sections.map(async (s) => {
        const lessons = await db.select().from(lmsLessons).where(eq(lmsLessons.sectionId, s.id)).orderBy(asc(lmsLessons.position));
        return { ...s, lessons };
      }));

      // Progress
      let progress: typeof lmsLessonProgress.$inferSelect[] = [];
      if (enrollment) {
        progress = await db.select().from(lmsLessonProgress).where(eq(lmsLessonProgress.enrollmentId, enrollment.id));
      }

      return { course, enrollment: enrollment ?? null, sections: sectionsWithLessons, progress };
    }),

  /** Get a single lesson (must be enrolled or lesson is preview) */
  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lesson] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      // Get course via section
      const [section] = await db.select().from(lmsSections).where(eq(lmsSections.id, lesson.sectionId)).limit(1);
      if (!section) throw new TRPCError({ code: "NOT_FOUND" });

      if (!lesson.isPreview) {
        const [enrollment] = await db.select().from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, section.courseId))).limit(1);
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
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.isFree) throw new TRPCError({ code: "BAD_REQUEST", message: "Use enrollFree for free courses" });

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" });

      // Create order record
      const [orderResult] = await db.insert(lmsOrders).values({
        userId: ctx.user.id, courseId: course.id,
        amount: course.price * input.seats,
        affiliateId: null, seats: input.seats, status: "pending",
      }).$returningId();

      const session = await stripe.checkout.sessions.create({
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
        }],
        success_url: `${input.origin}/learn/${course.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/learn/${course.slug}`,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          course_id: course.id.toString(),
          order_id: orderResult.id.toString(),
          affiliate_code: input.affiliateCode ?? "",
          seats: input.seats.toString(),
        },
      });

      // Update order with session id
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
});

// ─── Admin Router ─────────────────────────────────────────────────────────────

export const lmsAdminRouter = router({
  // ── Courses ──
  listCourses: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "public", "hidden", "private", "all"]).default("all"),
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
      price: z.number().int().min(0).default(0),
      isFree: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const base = generateSlug(input.title);
      const slug = await uniqueSlug(db, base);
      const [result] = await db.insert(lmsCourses).values({
        slug, title: input.title, subtitle: input.subtitle ?? null,
        type: input.type, brand: input.brand, price: input.price,
        isFree: input.isFree, createdByUserId: ctx.user.id,
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
      status: z.enum(["draft", "public", "hidden", "private"]).optional(),
      type: z.enum(["course", "quiz", "download"]).optional(),
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      price: z.number().int().min(0).optional(),
      isFree: z.boolean().optional(),
      hasCertificate: z.boolean().optional(),
      isDrip: z.boolean().optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
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
      const [landingPage] = await db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, course.id)).limit(1);
      const cis = await db.select().from(lmsCourseInstructors).where(eq(lmsCourseInstructors.courseId, course.id));
      return { ...course, sections: sectionsWithLessons, landingPage: landingPage ?? null, courseInstructors: cis };
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
    .input(z.object({ id: z.number(), title: z.string().min(1).optional(), position: z.number().int().optional(), isPreview: z.boolean().optional() }))
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
      sectionId: z.number(), title: z.string().min(1),
      type: z.enum(["video", "text", "quiz", "download"]).default("text"),
      position: z.number().int().default(0),
      content: z.string().optional(),
      mediaAssetId: z.number().optional(),
      isPreview: z.boolean().default(false),
      dripDays: z.number().int().default(0),
      durationMinutes: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsLessons).values({
        ...input, content: input.content ?? null, mediaAssetId: input.mediaAssetId ?? null,
        durationMinutes: input.durationMinutes ?? null,
      }).$returningId();
      // Auto-create quiz if type is quiz
      if (input.type === "quiz") {
        await db.insert(lmsQuizzes).values({ lessonId: result.id, title: input.title });
      }
      return { id: result.id };
    }),

  updateLesson: protectedProcedure
    .input(z.object({
      id: z.number(), title: z.string().min(1).optional(),
      type: z.enum(["video", "text", "quiz", "download"]).optional(),
      content: z.string().optional(), mediaAssetId: z.number().nullable().optional(),
      position: z.number().int().optional(), isPreview: z.boolean().optional(),
      dripDays: z.number().int().optional(), durationMinutes: z.number().int().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) await db.update(lmsLessons).set(filtered).where(eq(lmsLessons.id, id));
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
