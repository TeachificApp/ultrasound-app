/**
 * lmsRouter.ts
 * All About Ultrasound™ LMS — Router Aggregator
 *
 * The lmsAdminRouter procedures are split across focused sub-routers:
 *   lmsCourseBuilderRouter    — course/section/lesson CRUD (~970 lines)
 *   lmsQuizLandingRouter      — quiz builder + landing pages (~620 lines)
 *   lmsEnrollmentAdminRouter  — enrollments, groups, analytics, orders (~1,690 lines)
 *   lmsCohortAdminRouter      — cohort sessions, assignments, recordings (~515 lines)
 */

/**
 * lmsRouter.ts
 * All About Ultrasound™ LMS — LMS Management
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
import { and, desc, eq, isNull, sql, asc, isNotNull, max, inArray, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb, getOrCreateAccessToken } from "../db";
import { invokeLLM } from "../_core/llm";
import { generateCertificatePdf } from "../lib/certificateGenerator";
import { sendCertificateEmail } from "../lib/certificateEmail";
import { sendEnrollmentEmail } from "../lib/enrollmentEmail";
import { buildOrderBumpCheckoutLine } from "../lib/orderBumpCheckout";
import { extractJson, parseLandingBlocks } from "../lib/extractJson";
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
  lmsPricingOptions,
  platformSettings,
  digitalProducts,
  lmsThinkificImports,
  lmsArchive,
  sonoQuizzes,
  physicalProducts,
  lmsCertificateTemplates,
  orderBumps,
  freePreviewEnrollments,
  lmsSectionTemplates,
  lessonTemplates,
  lmsCohortSessions,
  lmsCohortAssignments,
  lmsCohortRecordings,
  lmsCohortSubmissions,
  mediaUploadFolders,
  mediaUploadResponses,
  funnelLeads,
  lmsCohortGroups,
  lmsCohortGroupEnrollments,
  lmsCohortStaff,
  lmsCohortMessages,
  instructorCoursePermissions,
  instructorPublishRequests,
  userRoles,
  userActivityLogs,
} from "../../drizzle/schema";
import { getEnrollmentsForCourse, getThinkificCourse } from "../thinkific";
import { sendEmail, buildFreePreviewConfirmationEmail, emailWrapper } from "../_core/email";
import { notifyOwner } from "../_core/notification";

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { assertAdmin, generateSlug, uniqueSlug, recalcProgress, issueCertificateIfEnabled } from "./lmsHelpers";
import { lmsCourseBuilderRouter } from "./lmsCourseBuilderRouter";
import { lmsQuizLandingRouter } from "./lmsQuizLandingRouter";
import { lmsEnrollmentAdminRouter } from "./lmsEnrollmentAdminRouter";
import { lmsCohortAdminRouter } from "./lmsCohortAdminRouter";

// ─── Admin Router (merged from sub-routers) ───────────────────────────────────
export const lmsAdminRouter = router({
  ...lmsCourseBuilderRouter._def.procedures,
  ...lmsQuizLandingRouter._def.procedures,
  ...lmsEnrollmentAdminRouter._def.procedures,
  ...lmsCohortAdminRouter._def.procedures,
});

// ─── Public Router ────────────────────────────────────────────────────────────

export const lmsPublicRouter = router({
  /** List all publicly visible courses */
  listCourses: publicProcedure
    .input(z.object({
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      type: z.enum(["course", "quiz", "download", "cohort"]).optional(),
      isFree: z.boolean().optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // If type is explicitly "quiz", merge lmsCourses quizzes + sonoQuizzes
      if (input.type === "quiz") {
        const lmsConditions = [eq(lmsCourses.status, "public"), eq(lmsCourses.showInLibrary, true), eq(lmsCourses.type, "quiz")];
        if (input.brand) lmsConditions.push(eq(lmsCourses.brand, input.brand));
        const offset = (input.page - 1) * input.pageSize;
        const [lmsQuizRows, sqRows] = await Promise.all([
          db.select().from(lmsCourses).where(and(...lmsConditions)).orderBy(desc(lmsCourses.createdAt)),
          db.select().from(sonoQuizzes).where(eq(sonoQuizzes.status, "published")).orderBy(desc(sonoQuizzes.createdAt)),
        ]);
        const lmsMapped = lmsQuizRows.map(c => ({ ...c, instructor: null, _source: "lms_course" as const }));
        const sqMapped = sqRows.map(q => ({
          id: q.id,
          slug: `quiz-${q.id}`,
          title: q.title,
          subtitle: q.description ?? null,
          description: q.description ?? null,
          coverImageUrl: q.coverImageUrl ?? null,
          status: "public" as const,
          type: "quiz" as const,
          brand: "aaus" as const,
          price: 0,
          isFree: true,
          isFeatured: false,
          showInLibrary: true,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
          instructor: null,
          _source: "sono_quiz" as const,
        }));
        const combined = [...lmsMapped, ...sqMapped].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const paginated = combined.slice(offset, offset + input.pageSize);
        return { courses: paginated, total: combined.length, page: input.page, pageSize: input.pageSize };
      }

      // If type is explicitly "download", pull from digitalProducts table and return in same shape
      if (input.type === "download") {
        const dpConditions = [eq(digitalProducts.status, "published"), eq(digitalProducts.showInLibrary, true)];
        if (input.isFree !== undefined) dpConditions.push(eq(digitalProducts.isFree, input.isFree));
        const offset = (input.page - 1) * input.pageSize;
        const [dpRows, dpCount] = await Promise.all([
          db.select().from(digitalProducts).where(and(...dpConditions)).orderBy(desc(digitalProducts.createdAt)).limit(input.pageSize).offset(offset),
          db.select({ count: sql<number>`count(*)` }).from(digitalProducts).where(and(...dpConditions)),
        ]);
        // Map digitalProducts to same shape as lmsCourses for the frontend
        const mapped = dpRows.map(p => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          subtitle: p.subtitle ?? null,
          description: p.description ?? null,
          coverImageUrl: p.thumbnailUrl ?? null,
          status: "public" as const,
          type: "download" as const,
          brand: "aaus" as const,
          price: p.price,
          isFree: p.isFree,
          isFeatured: false,
          showInLibrary: p.showInLibrary,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          instructor: null,
          _source: "digital_product" as const,
        }));
        return { courses: mapped, total: Number(dpCount[0]?.count ?? 0), page: input.page, pageSize: input.pageSize };
      }

      const conditions = [eq(lmsCourses.status, "public"), eq(lmsCourses.showInLibrary, true)];
      if (input.brand) conditions.push(eq(lmsCourses.brand, input.brand));
      if (input.type) conditions.push(eq(lmsCourses.type, input.type));
      if (input.isFree !== undefined) conditions.push(eq(lmsCourses.isFree, input.isFree));

      const offset = (input.page - 1) * input.pageSize;
      // Sort: explicit library order first (asc), then fall back to newest first
      const courses = await db.select().from(lmsCourses).where(and(...conditions)).orderBy(asc(lmsCourses.libraryOrder), desc(lmsCourses.createdAt)).limit(input.pageSize).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lmsCourses).where(and(...conditions));

      // Batch-fetch primary instructors for all courses in 2 queries (avoids N+1)
      const courseIds = courses.map(c => c.id);
      let enriched: any[] = courses.map(c => ({ ...c, instructor: null, _source: "lms_course" as const }));
      if (courseIds.length > 0) {
        const ciRows = await db.select().from(lmsCourseInstructors)
          .where(and(
            sql`${lmsCourseInstructors.courseId} IN (${sql.join(courseIds.map(id => sql`${id}`), sql`, `)})`,
            eq(lmsCourseInstructors.isPrimary, true)
          ));
        const instructorIds = Array.from(new Set(ciRows.map(ci => ci.instructorId)));
        if (instructorIds.length > 0) {
          const insRows = await db.select().from(lmsInstructors)
            .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);
          const insMap = new Map(insRows.map(i => [i.id, i]));
          const ciMap = new Map(ciRows.map(ci => [ci.courseId, ci]));
          enriched = courses.map(c => {
            const ci = ciMap.get(c.id);
            return { ...c, instructor: ci ? (insMap.get(ci.instructorId) ?? null) : null, _source: "lms_course" as const };
          });
        }
      }

      // When no type filter (All Types), also include digitalProducts and sonoQuizzes
      if (!input.type) {
        const dpConditions = [eq(digitalProducts.status, "published"), eq(digitalProducts.showInLibrary, true)];
        if (input.isFree !== undefined) dpConditions.push(eq(digitalProducts.isFree, input.isFree));
        const dpRows = await db.select().from(digitalProducts).where(and(...dpConditions)).orderBy(desc(digitalProducts.createdAt));
        const dpMapped = dpRows.map(p => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          subtitle: p.subtitle ?? null,
          description: p.description ?? null,
          coverImageUrl: p.thumbnailUrl ?? null,
          status: "public" as const,
          type: "download" as const,
          brand: "aaus" as const,
          price: p.price,
          isFree: p.isFree,
          isFeatured: false,
          showInLibrary: p.showInLibrary,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          instructor: null,
          _source: "digital_product" as const,
        }));
        // Also include published sonoQuizzes
        const sqRows = await db.select().from(sonoQuizzes).where(eq(sonoQuizzes.status, "published")).orderBy(desc(sonoQuizzes.createdAt));
        const sqMapped = sqRows.map(q => ({
          id: q.id,
          slug: `quiz-${q.id}`,
          title: q.title,
          subtitle: q.description ?? null,
          description: q.description ?? null,
          coverImageUrl: q.coverImageUrl ?? null,
          status: "public" as const,
          type: "quiz" as const,
          brand: "aaus" as const,
          price: 0,
          isFree: true,
          isFeatured: false,
          showInLibrary: true,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
          instructor: null,
          _source: "sono_quiz" as const,
        }));
        // Merge all, sort by createdAt desc, then paginate
        const combined = [...enriched, ...dpMapped, ...sqMapped].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const totalCombined = Number(count) + dpRows.length + sqRows.length;
        const paginated = combined.slice(offset, offset + input.pageSize);
        return { courses: paginated, total: totalCombined, page: input.page, pageSize: input.pageSize };
      }

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
    // Batch-fetch primary instructors (avoids N+1)
    const courseIds = courses.map(c => c.id);
    let enriched: any[] = courses.map(c => ({ ...c, instructor: null }));
    if (courseIds.length > 0) {
      const ciRows = await db.select().from(lmsCourseInstructors)
        .where(and(
          sql`${lmsCourseInstructors.courseId} IN (${sql.join(courseIds.map(id => sql`${id}`), sql`, `)})`,
          eq(lmsCourseInstructors.isPrimary, true)
        ));
      const instructorIds = Array.from(new Set(ciRows.map(ci => ci.instructorId)));
      if (instructorIds.length > 0) {
        const insRows = await db.select().from(lmsInstructors)
          .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);

        const insMap = new Map(insRows.map(i => [i.id, i]));
        const ciMap = new Map(ciRows.map(ci => [ci.courseId, ci]));
        enriched = courses.map(c => {
          const ci = ciMap.get(c.id);
          return { ...c, instructor: ci ? (insMap.get(ci.instructorId) ?? null) : null };
        });
      }
    }
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
      // Admins can always see any course regardless of status or preview flag
      const isAdmin = ctx.user?.role === "admin";
      if (!isAdmin) {
        if (course.status === "draft" || course.status === "archived" || course.status === "private") throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Sections + preview lessons
      // Batch all sub-queries in parallel to avoid sequential round-trips
      const [sections, allLessonsRaw, cis, landingPageRow, pricingOptions, cohortSessions] = await Promise.all([
        db.select().from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position)),
        db.select({
          id: lmsLessons.id, title: lmsLessons.title, type: lmsLessons.type,
          position: lmsLessons.position, isPreview: lmsLessons.isPreview, previewMode: lmsLessons.previewMode,
          durationMinutes: lmsLessons.durationMinutes, sectionId: lmsLessons.sectionId,
          lessonStatus: lmsLessons.lessonStatus,
        }).from(lmsLessons)
          .innerJoin(lmsSections, eq(lmsLessons.sectionId, lmsSections.id))
          .where(and(eq(lmsSections.courseId, course.id), eq(lmsLessons.lessonStatus, "published")))
          .orderBy(asc(lmsLessons.position)),
        db.select().from(lmsCourseInstructors).where(eq(lmsCourseInstructors.courseId, course.id)),
        db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, course.id)).limit(1),
        db.select().from(lmsPricingOptions)
          .where(and(eq(lmsPricingOptions.courseId, course.id), eq(lmsPricingOptions.isActive, true)))
          .orderBy(asc(lmsPricingOptions.sortOrder)),
        // Cohort sessions — only published, ordered by date (for cohort_sessions_auto landing block)
        db.select({
          id: lmsCohortSessions.id,
          title: lmsCohortSessions.title,
          description: lmsCohortSessions.description,
          sessionDate: lmsCohortSessions.sessionDate,
          durationMinutes: lmsCohortSessions.durationMinutes,
          timezone: lmsCohortSessions.timezone,
          meetingUrl: lmsCohortSessions.meetingUrl,
          status: lmsCohortSessions.status,
        }).from(lmsCohortSessions)
          .where(and(eq(lmsCohortSessions.courseId, course.id), eq(lmsCohortSessions.status, "published")))
          .orderBy(asc(lmsCohortSessions.sessionDate)),
      ]);

      // Group lessons by sectionId
      const lessonsBySectionId = new Map<number, typeof allLessonsRaw>();
      for (const lesson of allLessonsRaw) {
        const sid = lesson.sectionId ?? 0;
        const arr = lessonsBySectionId.get(sid) ?? [];
        arr.push(lesson);
        lessonsBySectionId.set(sid, arr);
      }
      // Filter out sections that have no published lessons
      const sectionsWithLessons = sections
        .map(s => ({ ...s, lessons: lessonsBySectionId.get(s.id) ?? [] }))
        .filter(s => s.lessons.length > 0);

      // Instructors — batch fetch
      let instructors: any[] = [];
      if (cis.length > 0) {
        const instructorIds = cis.map(ci => ci.instructorId);
        const insRows = await db.select().from(lmsInstructors)
          .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);
        const insMap = new Map(insRows.map(i => [i.id, i]));
        instructors = cis.map(ci => {
          const ins = insMap.get(ci.instructorId);
          return ins ? { ...ins, revenueSharePct: ci.revenueSharePct, isPrimary: ci.isPrimary } : null;
        }).filter(Boolean);
      }

      const landingPage = landingPageRow[0] ?? null;

      return { ...course, sections: sectionsWithLessons, instructors: instructors.filter(Boolean), landingPage, pricingOptions, cohortSessions };
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
        return c ? { ...c, _source: "lms_course" as const } : null;
      }));
      return { ...col, courses: courses.filter(Boolean) };
    }),

  /** Fetch course title + sections + lessons by course ID — used by curriculum_auto block on funnel pages */
  getCurriculumById: publicProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [course] = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, status: lmsCourses.status })
        .from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) return null;
      const sections = await db.select().from(lmsSections)
        .where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position));
      const sectionsWithLessons = await Promise.all(sections.map(async (s) => {
        const lessons = await db.select({
          id: lmsLessons.id, title: lmsLessons.title, type: lmsLessons.type,
          position: lmsLessons.position, isPreview: lmsLessons.isPreview,
          previewMode: lmsLessons.previewMode, durationMinutes: lmsLessons.durationMinutes,
        }).from(lmsLessons).where(eq(lmsLessons.sectionId, s.id)).orderBy(asc(lmsLessons.position));
        return { ...s, lessons };
      }));
      return { id: course.id, title: course.title, slug: course.slug, sections: sectionsWithLessons };
    }),

  /** Resolve a course/download ID to its slug (used for opt-out link redirect) */
  getSlugById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [c] = await db.select({ slug: lmsCourses.slug }).from(lmsCourses)
        .where(eq(lmsCourses.id, input.id)).limit(1);
      return c?.slug ?? null;
    }),

  /**
   * Guest free-preview enrollment — no login required.
   * Captures name + email, creates a free_preview_enrollments row, returns an access token.
   */
  registerFreePreview: publicProcedure
    .input(z.object({
      courseId: z.number(),
      email: z.string().email(),
      firstName: z.string().min(1).max(100),
      lastName: z.string().max(100).optional(),
      source: z.string().max(128).optional(),
      utmSource: z.string().max(128).optional(),
      utmMedium: z.string().max(128).optional(),
      utmCampaign: z.string().max(128).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check if already registered for this course+email
      const [existing] = await db
        .select({ id: freePreviewEnrollments.id, accessToken: freePreviewEnrollments.accessToken, accessExpiresAt: freePreviewEnrollments.accessExpiresAt })
        .from(freePreviewEnrollments)
        .where(and(eq(freePreviewEnrollments.courseId, input.courseId), eq(freePreviewEnrollments.email, input.email.toLowerCase())))
        .limit(1);
      if (existing) {
        // Already registered — return existing token (refresh expiry)
        const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.update(freePreviewEnrollments)
          .set({ accessExpiresAt: newExpiry, updatedAt: new Date() })
          .where(eq(freePreviewEnrollments.id, existing.id));
        return { accessToken: existing.accessToken, isNew: false };
      }
      const accessToken = randomBytes(32).toString("hex");
      const accessExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.insert(freePreviewEnrollments).values({
        courseId: input.courseId,
        email: input.email.toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        source: input.source ?? "course_landing",
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        accessToken,
        accessExpiresAt,
      });
      // Fetch course title for confirmation email
      const [course] = await db
        .select({ title: lmsCourses.title, slug: lmsCourses.slug })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (course) {
        try {
          const previewUrl = `https://app.allaboutultrasound.com/courses/${course.slug}?preview_token=${accessToken}`;
          const emailData = buildFreePreviewConfirmationEmail({
            firstName: input.firstName,
            courseTitle: course.title,
            previewUrl,
            accessExpiresAt,
          });
          await sendEmail({
            to: { name: input.firstName + (input.lastName ? ` ${input.lastName}` : ""), email: input.email.toLowerCase() },
            subject: emailData.subject,
            htmlBody: emailData.htmlBody,
            previewText: emailData.previewText,
          });
        } catch (emailErr) {
          // Non-fatal — log but don't fail the registration
          console.error("[FreePreview] Failed to send confirmation email:", emailErr);
        }
      }
      return { accessToken, isNew: true };
    }),

  /** Check if an access token is valid for a given course (used by player to gate preview lessons). */
  checkFreePreviewToken: publicProcedure
    .input(z.object({ courseId: z.number(), accessToken: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { valid: false };
      const [row] = await db
        .select({ id: freePreviewEnrollments.id, accessExpiresAt: freePreviewEnrollments.accessExpiresAt })
        .from(freePreviewEnrollments)
        .where(and(
          eq(freePreviewEnrollments.courseId, input.courseId),
          eq(freePreviewEnrollments.accessToken, input.accessToken),
        ))
        .limit(1);
      if (!row) return { valid: false };
      if (row.accessExpiresAt < new Date()) return { valid: false, expired: true };
      return { valid: true };
    }),
});

// ─── Learner Router ───────────────────────────────────────────────────────────

// ─── Learner Router ───────────────────────────────────────────────────────────

export const lmsLearnerRouter = router({
  /** Get all enrollments for the current user */
  getMyCourses: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const enrollments = await db.select().from(lmsEnrollments).where(eq(lmsEnrollments.userId, ctx.user.id)).orderBy(desc(lmsEnrollments.enrolledAt));
    if (enrollments.length === 0) return [];
    const courseIds = [...new Set(enrollments.map(e => e.courseId))];
    const coursesRaw = await db.select({ id: lmsCourses.id, slug: lmsCourses.slug, title: lmsCourses.title, coverImageUrl: lmsCourses.coverImageUrl, type: lmsCourses.type })
      .from(lmsCourses)
      .where(sql`${lmsCourses.id} IN (${sql.join(courseIds.map(id => sql`${id}`), sql`, `)})`);
    const courseMap = new Map(coursesRaw.map(c => [c.id, c]));
    return enrollments.map(e => ({ ...e, course: courseMap.get(e.courseId) ?? null }));
  }),

  /** Get full course content for enrolled user (or preview lessons) */
  getCoursePlayer: protectedProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.slug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Check enrollment first — must happen before isAdminPreview check
      const [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);

      // Admin preview mode: only active when admin is NOT enrolled AND explicitly requested preview.
      // If the admin IS enrolled, treat them as a regular enrolled user so progress is tracked.
      const isAdminPreview = input.preview && ctx.user.role === "admin" && !enrollment;

      // Fetch sections + ALL lessons for this course in 2 parallel queries (avoids N+1)
      // Select only lightweight columns for the sidebar — heavy content (contentBlocks, content, videoContent)
      // is fetched on-demand by getLesson when the student opens a specific lesson.
      const [sections, allCourseLessons] = await Promise.all([
        db.select().from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position)),
        db.select({
          id: lmsLessons.id,
          courseId: lmsLessons.courseId,
          sectionId: lmsLessons.sectionId,
          title: lmsLessons.title,
          type: lmsLessons.type,
          position: lmsLessons.position,
          isPreview: lmsLessons.isPreview,
          previewMode: lmsLessons.previewMode,
          dripDays: lmsLessons.dripDays,
          durationMinutes: lmsLessons.durationMinutes,
          requireVideoCompletion: lmsLessons.requireVideoCompletion,
          requireManualComplete: lmsLessons.requireManualComplete,
          prerequisiteLessonId: lmsLessons.prerequisiteLessonId,
          isPrerequisite: lmsLessons.isPrerequisite,
          showInstructor: lmsLessons.showInstructor,
          effectEnabled: lmsLessons.effectEnabled,
          effectTrigger: lmsLessons.effectTrigger,
          effectBannerText: lmsLessons.effectBannerText,
          effectBannerBgColor: lmsLessons.effectBannerBgColor,
          effectBannerTextColor: lmsLessons.effectBannerTextColor,
          effectSound: lmsLessons.effectSound,
          effectSoundUrl: lmsLessons.effectSoundUrl,
          effectConfetti: lmsLessons.effectConfetti,
          effectConfettiColors: lmsLessons.effectConfettiColors,
          effectConfettiMode: lmsLessons.effectConfettiMode,
          effectBannerDuration: lmsLessons.effectBannerDuration,
          lessonStatus: lmsLessons.lessonStatus,
          createdAt: lmsLessons.createdAt,
          updatedAt: lmsLessons.updatedAt,
        }).from(lmsLessons).where(
          // Admins (in preview mode) see all lessons; enrolled learners only see published lessons
          isAdminPreview
            ? eq(lmsLessons.courseId, course.id)
            : and(eq(lmsLessons.courseId, course.id), eq(lmsLessons.lessonStatus, "published"))
        ).orderBy(asc(lmsLessons.position)),
      ]);
      // Group lessons by sectionId in JS — no extra round-trips
      const lessonsBySectionId = new Map<number, typeof allCourseLessons>();
      const topLevelLessons: typeof allCourseLessons = [];
      for (const lesson of allCourseLessons) {
        if (lesson.sectionId) {
          if (!lessonsBySectionId.has(lesson.sectionId)) lessonsBySectionId.set(lesson.sectionId, []);
          lessonsBySectionId.get(lesson.sectionId)!.push(lesson);
        } else {
          topLevelLessons.push(lesson);
        }
      }
      const sectionsWithLessons = sections.map(s => ({ ...s, lessons: lessonsBySectionId.get(s.id) ?? [] }));

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

      // Fetch course instructors (for right-panel instructor card)
      const courseInstructorLinks = await db.select().from(lmsCourseInstructors)
        .where(eq(lmsCourseInstructors.courseId, course.id));
      const instructorIds = courseInstructorLinks.map(l => l.instructorId);
      let instructors: typeof lmsInstructors.$inferSelect[] = [];
      if (instructorIds.length > 0) {
        instructors = await db.select().from(lmsInstructors)
          .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);
      }

      return { course, enrollment: effectiveEnrollment, sections: sectionsWithLessons, topLevelLessons, progress, isAdminPreview: !!isAdminPreview && !enrollment, instructors };
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
      const isAdmin = ctx.user.role === "admin";
      // Block draft lessons from non-admin learners
      if (!isAdmin && lesson.lessonStatus === "draft") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      }
      const pm = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
      if (pm !== "preview" && !isAdmin) {
        // Check enrollment
        const [enrollment] = await db.select().from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, resolvedCourseId))).limit(1);
        if (pm === "preview_hide_after_purchase" && enrollment && enrollment.enrollmentType !== "free_preview") {
          // Purchased (full access) — hide this lesson (it was a pre-purchase teaser)
          throw new TRPCError({ code: "FORBIDDEN", message: "This preview lesson is no longer available after purchase" });
        }
        if (pm === "none" && !enrollment) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment required" });
        }
        // Free preview enrollees can only access preview lessons
        if (pm === "none" && enrollment?.enrollmentType === "free_preview") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Full course enrollment required to access this lesson" });
        }
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
      let wasAlreadyComplete = false;
      if (existing) {
        wasAlreadyComplete = !!existing.completedAt;
        if (!existing.completedAt) {
          await db.update(lmsLessonProgress).set({ completedAt: new Date() }).where(eq(lmsLessonProgress.id, existing.id));
        }
      } else {
        await db.insert(lmsLessonProgress).values({ enrollmentId: enrollment.id, lessonId: input.lessonId, completedAt: new Date() });
      }
      await recalcProgress(db, enrollment.id);
      // Log lesson completion to unified activity log (fire-and-forget)
      if (!wasAlreadyComplete) {
        const [lesson] = await db.select({ title: lmsLessons.title }).from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
        db.insert(userActivityLogs).values({
          userId: ctx.user.id,
          eventType: 'lesson_complete',
          description: `Completed lesson: ${lesson?.title ?? `Lesson #${input.lessonId}`} in ${course.title}`,
          courseId: course.id,
          lessonId: input.lessonId,
          contentTitle: lesson?.title ?? null,
          metadata: { courseSlug: input.courseSlug, courseTitle: course.title },
        }).catch(() => {});
      }
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
      // Log free enrollment to unified activity log (fire-and-forget)
      db.insert(userActivityLogs).values({
        userId: ctx.user.id,
        eventType: 'course_enroll',
        description: `Enrolled in free course: ${course.title}`,
        courseId: course.id,
        contentTitle: course.title,
        metadata: { courseSlug: input.courseSlug, enrollmentType: 'free', affiliateCode: input.affiliateCode ?? null },
      }).catch(() => {});
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
      // Optional: ID of a secondary pricing option (from lms_pricing_options)
      // When provided, the checkout uses that option's price/type instead of the course primary price
      pricingOptionId: z.number().optional(),
      promoCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Block checkout if enrollment close date has passed
      if (course.enrollmentCloseDate && new Date(course.enrollmentCloseDate) < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enrollment is closed for this cohort" });
      }

      // DEBUG: log incoming pricingOptionId
      console.log(`[createCheckout] courseSlug=${input.courseSlug} pricingOptionId=${input.pricingOptionId} (type=${typeof input.pricingOptionId})`);
      // Resolve pricing: secondary option overrides primary course pricing
      let pricingType: string = course.pricingType ?? (course.isFree ? "free" : "one_time");
      let effectivePrice = course.price;
      let effectiveDownPayment = course.downPayment ?? 0;
      let effectiveInstallmentAmount = course.installmentAmount ?? 0;
      let effectiveInstallmentCount = course.installmentCount ?? 0;
      let effectiveInstallmentIntervalDays = course.installmentIntervalDays ?? 30;
      let effectiveStripePriceId = course.stripePriceId;
      let effectiveSubscriptionInterval = course.subscriptionInterval ?? "monthly";
      let pricingOptionLabel: string | null = null;

      if (input.pricingOptionId) {
        const [opt] = await db.select().from(lmsPricingOptions)
          .where(and(eq(lmsPricingOptions.id, input.pricingOptionId), eq(lmsPricingOptions.courseId, course.id), eq(lmsPricingOptions.isActive, true)))
          .limit(1);
        if (!opt) throw new TRPCError({ code: "NOT_FOUND", message: "Pricing option not found" });
        pricingType = opt.pricingType;
        effectivePrice = opt.price;
        effectiveDownPayment = opt.downPayment ?? 0;
        effectiveInstallmentAmount = opt.installmentAmount ?? 0;
        effectiveInstallmentCount = opt.installmentCount ?? 0;
        effectiveInstallmentIntervalDays = opt.installmentIntervalDays ?? 30;
        effectiveStripePriceId = opt.stripePriceId ?? null;
        effectiveSubscriptionInterval = opt.subscriptionInterval ?? "monthly";
        pricingOptionLabel = opt.label;
      }

      if (pricingType === "free") throw new TRPCError({ code: "BAD_REQUEST", message: "Use enrollFree for free courses" });

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      const orderBumpCheckout = await buildOrderBumpCheckoutLine(db, {
        orderBumpId: input.orderBumpId,
        triggerType: "course",
        triggerProductId: course.id,
        currency: course.currency,
      });
      const shippingOptions = orderBumpCheckout?.requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA"] as any } }
        : {};

      // Create order record (use effective pricing — may come from secondary option)
      const orderAmount = (pricingType === "payment_plan"
        ? effectiveDownPayment
        : effectivePrice * input.seats) + (orderBumpCheckout?.amount ?? 0);
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
      const successUrl = `${input.origin}/courses/${course.slug}/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${input.origin}/courses/${course.slug}`;

      let session: any;

      // Resolve promo code to a Stripe promotion code ID if provided
      let discounts: Array<{ promotion_code: string }> | undefined;
      if (input.promoCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (promoCodes.data[0]) discounts = [{ promotion_code: promoCodes.data[0].id }];
        } catch { /* ignore — checkout still works without promo */ }
      }
      const promoOpts = discounts ? { discounts } : { allow_promotion_codes: true };

      const productName = pricingOptionLabel ? `${course.title} — ${pricingOptionLabel}` : course.title;

      if (pricingType === "one_time") {
        // If the option has a pre-created Stripe Price ID, use it directly
        const lineItem = effectiveStripePriceId
          ? { price: effectiveStripePriceId, quantity: input.seats }
          : {
              price_data: {
                currency: course.currency,
                product_data: { name: productName, description: course.subtitle ?? undefined },
                unit_amount: Math.round(Number(effectivePrice) * 100),
              },
              quantity: input.seats,
            };
        session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          ...promoOpts,
          line_items: [lineItem, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: { ...commonMeta, pricing_option_id: input.pricingOptionId?.toString() ?? "" },
          ...shippingOptions,
        });

      } else if (pricingType === "subscription") {
        // Create or reuse a Stripe Price for this subscription option
        let stripePriceId = effectiveStripePriceId;
        if (!stripePriceId) {
          const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
          const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
          const interval = effectiveSubscriptionInterval;
          const stripeProduct = await stripe.products.create({
            name: productName,
            description: course.subtitle ?? undefined,
            metadata: { course_id: course.id.toString() },
          });
          const stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: Math.round(Number(effectivePrice) * 100),
            currency: course.currency,
            recurring: { interval: intervalMap[interval], interval_count: intervalCountMap[interval] },
          });
          stripePriceId = stripePrice.id;
          // Cache on the option row (or course if primary)
          if (input.pricingOptionId) {
            await db.update(lmsPricingOptions).set({ stripePriceId }).where(eq(lmsPricingOptions.id, input.pricingOptionId));
          } else {
            await db.update(lmsCourses).set({ stripePriceId }).where(eq(lmsCourses.id, course.id));
          }
        }
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          ...promoOpts,
          line_items: [{ price: stripePriceId, quantity: 1 }, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: { ...commonMeta, pricing_option_id: input.pricingOptionId?.toString() ?? "" },
          ...shippingOptions,
        });

      } else if (pricingType === "payment_plan") {
        // Charge down payment now; installments handled via subscription
        const downPayment = effectiveDownPayment;
        const installmentAmount = effectiveInstallmentAmount;
        const installmentCount = effectiveInstallmentCount;
        const intervalDays = effectiveInstallmentIntervalDays;
        const lineItems: any[] = [];
        if (downPayment > 0) {
          lineItems.push({
            price_data: {
              currency: course.currency,
              product_data: { name: `${productName} — Down Payment` },
              unit_amount: Math.round(Number(downPayment) * 100),
            },
            quantity: 1,
          });
        }
        if (installmentAmount > 0 && installmentCount > 0) {
          let stripePriceId = effectiveStripePriceId;
          if (!stripePriceId) {
            const stripeProduct = await stripe.products.create({
              name: `${productName} — Installment`,
              metadata: { course_id: course.id.toString() },
            });
            const intervalMonths = Math.round(intervalDays / 30) || 1;
            const stripePrice = await stripe.prices.create({
              product: stripeProduct.id,
              unit_amount: Math.round(Number(installmentAmount) * 100),
              currency: course.currency,
              recurring: { interval: "month", interval_count: intervalMonths },
            });
            stripePriceId = stripePrice.id;
            if (input.pricingOptionId) {
              await db.update(lmsPricingOptions).set({ stripePriceId }).where(eq(lmsPricingOptions.id, input.pricingOptionId));
            } else {
              await db.update(lmsCourses).set({ stripePriceId }).where(eq(lmsCourses.id, course.id));
            }
          }
          lineItems.push({ price: stripePriceId, quantity: 1 });
        }
        const hasInstallments = installmentAmount > 0 && installmentCount > 0;
        session = await stripe.checkout.sessions.create({
          mode: hasInstallments ? "subscription" : "payment",
          customer_email: ctx.user.email ?? undefined,
          ...promoOpts,
          line_items: [...lineItems, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: { ...commonMeta, installment_count: installmentCount.toString(), pricing_option_id: input.pricingOptionId?.toString() ?? "" },
          ...shippingOptions,
        });
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown pricing type" });
      }

      if (!session) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
      await db.update(lmsOrders).set({ stripeSessionId: session.id }).where(eq(lmsOrders.id, orderResult.id));
      return { checkoutUrl: session.url };
    }),

  /**
   * Guest checkout — creates/finds account, signs in via session cookie, saves lead, returns Stripe checkout URL.
   * Used when an unauthenticated user clicks a CTA on a course landing page.
   */
  guestCheckoutRegister: publicProcedure
    .input(z.object({
      courseSlug: z.string(),
      name: z.string().min(1).max(200),
      email: z.string().email(),
      pricingOptionId: z.number().optional(),
      orderBumpId: z.number().optional(),
      promoCode: z.string().optional(),
      origin: z.string(),
      referrer: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 1. Create or find user account
      const { getOrCreateUserByEmail } = await import('../db');
      const { user } = await getOrCreateUserByEmail({
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
      });

      // 2. Set session cookie — auto sign-in
      const { sdk } = await import('../_core/sdk');
      const { COOKIE_NAME, ONE_YEAR_MS } = await import('@shared/const');
      const { getSessionCookieOptions } = await import('../_core/cookies');
      const openId = `email:${input.email.trim().toLowerCase()}`;
      // Persist openId on user row if not set
      await db.update(users).set({ openId }).where(and(eq(users.id, user.id), isNull(users.openId)));
      const sessionToken = await sdk.createSessionToken(openId, { name: input.name, expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // 3. Save as lead in funnel_leads
      try {
        await db.insert(funnelLeads).values({
          funnelId: 0,
          funnelPageId: 0,
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          userId: user.id,
          source: "course_checkout",
          sourcePage: `/courses/${input.courseSlug}`,
          referrer: input.referrer ?? null,
          ipAddress: (ctx.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? null,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        });
      } catch { /* non-fatal — lead capture failure should not block checkout */ }

      // 4. Create Stripe checkout session (same logic as createCheckout but with user.id)
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.enrollmentCloseDate && new Date(course.enrollmentCloseDate) < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enrollment is closed for this cohort" });
      }

      let pricingType: string = course.pricingType ?? (course.isFree ? "free" : "one_time");
      let effectivePrice = course.price;
      let effectiveDownPayment = course.downPayment ?? 0;
      let effectiveInstallmentAmount = course.installmentAmount ?? 0;
      let effectiveInstallmentCount = course.installmentCount ?? 0;
      let effectiveInstallmentIntervalDays = course.installmentIntervalDays ?? 30;
      let effectiveStripePriceId = course.stripePriceId;
      let effectiveSubscriptionInterval = course.subscriptionInterval ?? "monthly";
      let pricingOptionLabel: string | null = null;

      if (input.pricingOptionId) {
        const [opt] = await db.select().from(lmsPricingOptions)
          .where(and(eq(lmsPricingOptions.id, input.pricingOptionId), eq(lmsPricingOptions.courseId, course.id), eq(lmsPricingOptions.isActive, true)))
          .limit(1);
        if (!opt) throw new TRPCError({ code: "NOT_FOUND", message: "Pricing option not found" });
        pricingType = opt.pricingType;
        effectivePrice = opt.price;
        effectiveDownPayment = opt.downPayment ?? 0;
        effectiveInstallmentAmount = opt.installmentAmount ?? 0;
        effectiveInstallmentCount = opt.installmentCount ?? 0;
        effectiveInstallmentIntervalDays = opt.installmentIntervalDays ?? 30;
        effectiveStripePriceId = opt.stripePriceId ?? null;
        effectiveSubscriptionInterval = opt.subscriptionInterval ?? "monthly";
        pricingOptionLabel = opt.label;
      }

      if (pricingType === "free") {
        // Free course — just enroll directly
        const existing = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        if (!existing[0]) {
          await db.insert(lmsEnrollments).values({ userId: user.id, courseId: course.id, status: "active", progressPct: 0 });
          try { await sendEnrollmentEmail({ userId: user.id, courseId: course.id }); } catch {}
        }
        return { checkoutUrl: null, enrolled: true };
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      const orderBumpCheckout = await buildOrderBumpCheckoutLine(db, {
        orderBumpId: input.orderBumpId,
        triggerType: "course",
        triggerProductId: course.id,
        currency: course.currency,
      });
      const shippingOptions = orderBumpCheckout?.requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA"] as any } }
        : {};

      const orderAmount = (pricingType === "payment_plan"
        ? effectiveDownPayment
        : effectivePrice * 1) + (orderBumpCheckout?.amount ?? 0);
      const [orderResult] = await db.insert(lmsOrders).values({
        userId: user.id, courseId: course.id,
        amount: orderAmount, affiliateId: null, seats: 1, status: "pending",
      }).$returningId();

      const commonMeta = {
        user_id: user.id.toString(),
        course_id: course.id.toString(),
        order_id: orderResult.id.toString(),
        affiliate_code: "",
        seats: "1",
        pricing_type: pricingType,
        trigger_order_type: "course",
        ...orderBumpCheckout?.metadata,
      };

      const successUrl = `${input.origin}/courses/${course.slug}/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${input.origin}/courses/${course.slug}`;

      let discounts: Array<{ promotion_code: string }> | undefined;
      if (input.promoCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (promoCodes.data[0]) discounts = [{ promotion_code: promoCodes.data[0].id }];
        } catch { /* ignore */ }
      }
      const promoOpts = discounts ? { discounts } : { allow_promotion_codes: true };
      const productName = pricingOptionLabel ? `${course.title} — ${pricingOptionLabel}` : course.title;

      let session: any;
      if (pricingType === "one_time") {
        const lineItem = effectiveStripePriceId
          ? { price: effectiveStripePriceId, quantity: 1 }
          : { price_data: { currency: course.currency, product_data: { name: productName, description: course.subtitle ?? undefined }, unit_amount: Math.round(Number(effectivePrice) * 100) }, quantity: 1 };
        session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: input.email,
          ...promoOpts,
          line_items: [lineItem, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: user.id.toString(),
          metadata: { ...commonMeta, pricing_option_id: input.pricingOptionId?.toString() ?? "" },
          ...shippingOptions,
        });
      } else if (pricingType === "subscription") {
        let stripePriceId = effectiveStripePriceId;
        if (!stripePriceId) {
          const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
          const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
          const stripeProduct = await stripe.products.create({ name: productName, description: course.subtitle ?? undefined, metadata: { course_id: course.id.toString() } });
          const stripePrice = await stripe.prices.create({ product: stripeProduct.id, unit_amount: Math.round(Number(effectivePrice) * 100), currency: course.currency, recurring: { interval: intervalMap[effectiveSubscriptionInterval], interval_count: intervalCountMap[effectiveSubscriptionInterval] } });
          stripePriceId = stripePrice.id;
          if (input.pricingOptionId) await db.update(lmsPricingOptions).set({ stripePriceId }).where(eq(lmsPricingOptions.id, input.pricingOptionId));
          else await db.update(lmsCourses).set({ stripePriceId }).where(eq(lmsCourses.id, course.id));
        }
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: input.email,
          ...promoOpts,
          line_items: [{ price: stripePriceId, quantity: 1 }, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: user.id.toString(),
          metadata: { ...commonMeta, pricing_option_id: input.pricingOptionId?.toString() ?? "" },
          ...shippingOptions,
        });
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported pricing type for guest checkout" });
      }

      if (!session) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
      await db.update(lmsOrders).set({ stripeSessionId: session.id }).where(eq(lmsOrders.id, orderResult.id));
      return { checkoutUrl: session.url, enrolled: false };
    }),

  /** Upgrade-prompt checkout — supports course / download / physical product with optional promo code */
  upgradePromptCheckout: protectedProcedure
    .input(z.object({
      productType: z.enum(["course", "download", "product"]),
      productSlug: z.string().optional(),
      productId: z.number().optional(),
      promoCode: z.string().optional(),
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
      const origin = input.origin || ctx.req.headers.origin || `https://${ctx.req.headers.host}`;

      // Resolve promo code → Stripe promotion_code ID
      let discounts: Array<{ promotion_code: string }> | undefined;
      if (input.promoCode) {
        try {
          const codes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (codes.data[0]) discounts = [{ promotion_code: codes.data[0].id }];
        } catch { /* ignore */ }
      }

      if (input.productType === "course") {
        const slug = input.productSlug;
        if (!slug) throw new TRPCError({ code: "BAD_REQUEST", message: "productSlug required for course" });
        const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, slug)).limit(1);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        const [existing] = await db.select().from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        if (existing) return { checkoutUrl: null, alreadyEnrolled: true };
        if (course.isFree || !course.price) {
          await db.insert(lmsEnrollments).values({ userId: ctx.user.id, courseId: course.id });
          return { checkoutUrl: null, alreadyEnrolled: false, free: true };
        }
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id.toString(),
          ...(discounts ? { discounts } : { allow_promotion_codes: true }),
          line_items: [{ price_data: { currency: course.currency ?? "usd", product_data: { name: course.title, images: course.coverImageUrl ? [course.coverImageUrl] : undefined }, unit_amount: Math.round(Number(course.price) * 100) }, quantity: 1 }],
          metadata: { type: "lms_course", course_id: course.id.toString(), user_id: ctx.user.id.toString(), customer_email: ctx.user.email ?? "", source: "upgrade_prompt" },
          success_url: `${origin}/courses/${course.slug}?success=1`,
          cancel_url: `${origin}/courses/${course.slug}`,
        });
        return { checkoutUrl: session.url, alreadyEnrolled: false };
      }

      if (input.productType === "download") {
        const id = input.productId;
        const slug = input.productSlug;
        if (!id && !slug) throw new TRPCError({ code: "BAD_REQUEST", message: "productId or productSlug required" });
        const [product] = await db.select().from(digitalProducts)
          .where(id ? eq(digitalProducts.id, id) : eq(digitalProducts.slug, slug!)).limit(1);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        if (product.isFree || !product.price) {
          const { digitalPurchases } = await import("../../drizzle/schema");
          await db.insert(digitalPurchases).values({ userId: ctx.user.id, productId: product.id });
          return { checkoutUrl: null, alreadyEnrolled: false, free: true };
        }
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id.toString(),
          ...(discounts ? { discounts } : { allow_promotion_codes: true }),
          line_items: [{ price_data: { currency: product.currency, product_data: { name: product.title, images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined }, unit_amount: Math.round(Number(product.price) * 100) }, quantity: 1 }],
          metadata: { type: "digital_download", product_id: product.id.toString(), user_id: ctx.user.id.toString(), customer_email: ctx.user.email ?? "", source: "upgrade_prompt" },
          success_url: `${origin}/downloads/${product.slug}/files?success=1`,
          cancel_url: `${origin}/downloads/${product.slug}`,
        });
        return { checkoutUrl: session.url, alreadyEnrolled: false };
      }

      if (input.productType === "product") {
        const id = input.productId;
        const slug = input.productSlug;
        if (!id && !slug) throw new TRPCError({ code: "BAD_REQUEST", message: "productId or productSlug required" });
        const [product] = await db.select().from(physicalProducts)
          .where(id ? eq(physicalProducts.id, id) : eq(physicalProducts.slug, slug!)).limit(1);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        if (product.isFree || !product.price) return { checkoutUrl: null, alreadyEnrolled: false, free: true };
        const allowedCountries = product.shippingCountries ? (JSON.parse(product.shippingCountries) as string[]) : ["US", "CA", "GB", "AU", "NZ"];
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id.toString(),
          ...(discounts ? { discounts } : { allow_promotion_codes: true }),
          shipping_address_collection: { allowed_countries: allowedCountries as any },
          line_items: [{ price_data: { currency: product.currency, product_data: { name: product.title, images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined }, unit_amount: Math.round(Number(product.price) * 100) }, quantity: 1 }],
          metadata: { type: "physical_product", product_id: product.id.toString(), user_id: ctx.user.id.toString(), customer_email: ctx.user.email ?? "", source: "upgrade_prompt" },
          success_url: `${origin}/product/${product.slug}?success=1`,
          cancel_url: `${origin}/product/${product.slug}`,
        });
        return { checkoutUrl: session.url, alreadyEnrolled: false };
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown productType" });
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

  /** Get course overview page data (enrolled or admin) */
  getCourseOverview: protectedProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.slug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Check enrollment first — must happen before isAdminPreview check
      const [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);

      // Admin preview mode: only active when admin is NOT enrolled AND explicitly requested preview.
      // If the admin IS enrolled, treat them as a regular enrolled user so progress is tracked.
      const isAdminPreview = input.preview && ctx.user.role === "admin" && !enrollment;
      if (!enrollment && !isAdminPreview) throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment required" });

      // Fetch sections + lessons
      const [sections, allLessons] = await Promise.all([
        db.select().from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position)),
        db.select().from(lmsLessons).where(
          // Admins in preview mode see all lessons; enrolled learners only see published lessons
          isAdminPreview
            ? eq(lmsLessons.courseId, course.id)
            : and(eq(lmsLessons.courseId, course.id), eq(lmsLessons.lessonStatus, "published"))
        ).orderBy(asc(lmsLessons.position)),
      ]);
      const lessonsBySectionId = new Map<number, typeof allLessons>();
      const topLevelLessons: typeof allLessons = [];
      for (const lesson of allLessons) {
        if (lesson.sectionId) {
          if (!lessonsBySectionId.has(lesson.sectionId)) lessonsBySectionId.set(lesson.sectionId, []);
          lessonsBySectionId.get(lesson.sectionId)!.push(lesson);
        } else {
          topLevelLessons.push(lesson);
        }
      }
      const sectionsWithLessons = sections.map(s => ({ ...s, lessons: lessonsBySectionId.get(s.id) ?? [] }));

      // Progress
      let progress: typeof lmsLessonProgress.$inferSelect[] = [];
      const effectiveEnrollment = enrollment ?? (isAdminPreview ? { id: -1, userId: ctx.user.id, courseId: course.id, enrolledAt: new Date(), progressPct: 0, completedAt: null, lastAccessedAt: new Date(), certificateIssuedAt: null } as any : null);
      if (effectiveEnrollment && effectiveEnrollment.id !== -1) {
        progress = await db.select().from(lmsLessonProgress).where(eq(lmsLessonProgress.enrollmentId, effectiveEnrollment.id));
      }

      // Instructors
      const courseInstructorLinks = await db.select().from(lmsCourseInstructors)
        .where(eq(lmsCourseInstructors.courseId, course.id));
      const instructorIds = courseInstructorLinks.map(l => l.instructorId);
      let instructors: typeof lmsInstructors.$inferSelect[] = [];
      if (instructorIds.length > 0) {
        instructors = await db.select().from(lmsInstructors)
          .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);
      }

      return { course, enrollment: effectiveEnrollment, sections: sectionsWithLessons, topLevelLessons, progress, instructors, isAdminPreview: !!isAdminPreview && !enrollment };
    }),

  /** Get cohort schedule (sessions + assignments) for an enrolled student */
  getCohortSchedule: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify the user is enrolled (or is admin)
      const isAdmin = ctx.user.role === "admin";
      if (!isAdmin) {
        const [enrollment] = await db.select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, input.courseId)))
          .limit(1);
        if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "You are not enrolled in this cohort" });
      }
      const [course] = await db.select({
        id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug,
        description: lmsCourses.description, thumbnailUrl: lmsCourses.thumbnailUrl,
        enrollmentCloseDate: lmsCourses.enrollmentCloseDate,
        multiCohortMode: lmsCourses.multiCohortMode,
      }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Get the user's cohort group assignment first (needed for filtering)
      const [myGroupEnrollment] = await db
        .select({ cohortGroupId: lmsCohortGroupEnrollments.cohortGroupId })
        .from(lmsCohortGroupEnrollments)
        .where(and(eq(lmsCohortGroupEnrollments.userId, ctx.user.id), eq(lmsCohortGroupEnrollments.courseId, input.courseId)))
        .limit(1);
      let myGroup = null;
      if (myGroupEnrollment) {
        const [g] = await db.select().from(lmsCohortGroups).where(eq(lmsCohortGroups.id, myGroupEnrollment.cohortGroupId)).limit(1);
        myGroup = g ?? null;
      }
      // When multi-cohort mode is on, filter content by the student's group
      const groupId = course.multiCohortMode && myGroup ? myGroup.id : null;
      const [sessions, assignments, recordings, mySubmissions] = await Promise.all([
        db.select().from(lmsCohortSessions)
          .where(groupId
            ? and(eq(lmsCohortSessions.courseId, input.courseId), eq(lmsCohortSessions.cohortGroupId, groupId))
            : eq(lmsCohortSessions.courseId, input.courseId))
          .orderBy(asc(lmsCohortSessions.sessionDate)),
        db.select().from(lmsCohortAssignments)
          .where(groupId
            ? and(eq(lmsCohortAssignments.courseId, input.courseId), eq(lmsCohortAssignments.status, "published"), eq(lmsCohortAssignments.cohortGroupId, groupId))
            : and(eq(lmsCohortAssignments.courseId, input.courseId), eq(lmsCohortAssignments.status, "published")))
          .orderBy(asc(lmsCohortAssignments.position), asc(lmsCohortAssignments.dueDate)),
        db.select().from(lmsCohortRecordings)
          .where(groupId
            ? and(eq(lmsCohortRecordings.courseId, input.courseId), eq(lmsCohortRecordings.status, "published"), eq(lmsCohortRecordings.cohortGroupId, groupId))
            : and(eq(lmsCohortRecordings.courseId, input.courseId), eq(lmsCohortRecordings.status, "published")))
          .orderBy(asc(lmsCohortRecordings.position), asc(lmsCohortRecordings.createdAt)),
        db.select().from(lmsCohortSubmissions)
          .where(eq(lmsCohortSubmissions.userId, ctx.user.id)),
      ]);
      return { course, sessions, assignments, recordings, mySubmissions, myGroup };
    }),

  /** Get the learner's assigned cohort group for a course */
  getMyCohortGroup: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const [groupEnrollment] = await db
        .select({ cohortGroupId: lmsCohortGroupEnrollments.cohortGroupId })
        .from(lmsCohortGroupEnrollments)
        .where(and(eq(lmsCohortGroupEnrollments.userId, ctx.user.id), eq(lmsCohortGroupEnrollments.courseId, input.courseId)))
        .limit(1);
      if (!groupEnrollment) return null;
      const [group] = await db.select().from(lmsCohortGroups).where(eq(lmsCohortGroups.id, groupEnrollment.cohortGroupId)).limit(1);
      return group ?? null;
    }),

  submitCohortAssignment: protectedProcedure
    .input(z.object({
      assignmentId: z.number(),
      submissionType: z.enum(["text", "file", "url", "none"]),
      textContent: z.string().optional(),
      fileUrl: z.string().optional(),
      fileKey: z.string().optional(),
      urlContent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify assignment exists and is published
      const [assignment] = await db.select().from(lmsCohortAssignments)
        .where(and(eq(lmsCohortAssignments.id, input.assignmentId), eq(lmsCohortAssignments.status, "published")))
        .limit(1);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      // Verify user is enrolled
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, assignment.courseId)))
        .limit(1);
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled in this cohort" });
      // Upsert submission
      const existing = await db.select({ id: lmsCohortSubmissions.id })
        .from(lmsCohortSubmissions)
        .where(and(eq(lmsCohortSubmissions.assignmentId, input.assignmentId), eq(lmsCohortSubmissions.userId, ctx.user.id)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(lmsCohortSubmissions).set({
          submissionType: input.submissionType,
          textContent: input.textContent ?? null,
          fileUrl: input.fileUrl ?? null,
          fileKey: input.fileKey ?? null,
          urlContent: input.urlContent ?? null,
          status: "pending",
        }).where(eq(lmsCohortSubmissions.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      }
      const [result] = await db.insert(lmsCohortSubmissions).values({
        assignmentId: input.assignmentId,
        userId: ctx.user.id,
        submissionType: input.submissionType,
        textContent: input.textContent ?? null,
        fileUrl: input.fileUrl ?? null,
        fileKey: input.fileKey ?? null,
        urlContent: input.urlContent ?? null,
        status: "pending",
      }).$returningId();
      return { id: result.id, updated: false };
    }),

  /** Upload a file for an assignment submission (student-facing) */
  uploadSubmissionFile: protectedProcedure
    .input(z.object({
      dataUri: z.string().min(1).max(52_428_800), // 50 MB base64 limit
      mimeType: z.string().min(1),
      fileName: z.string().min(1).max(255),
      assignmentId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify assignment exists and user is enrolled
      const [assignment] = await db.select({ courseId: lmsCohortAssignments.courseId })
        .from(lmsCohortAssignments).where(eq(lmsCohortAssignments.id, input.assignmentId)).limit(1);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, assignment.courseId)))
        .limit(1);
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled in this cohort" });
      // Decode and upload
      const b64Marker = ";base64,";
      const b64Idx = input.dataUri.indexOf(b64Marker);
      const base64Data = b64Idx >= 0 ? input.dataUri.slice(b64Idx + b64Marker.length) : input.dataUri;
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.byteLength > 40 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File must be under 40 MB" });
      }
      const suffix = Math.random().toString(36).slice(2, 10);
      const sanitizedName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `cohort-submissions/${ctx.user.id}/${input.assignmentId}/${suffix}-${sanitizedName}`;
            const { url } = await storagePut(fileKey, buffer, input.mimeType);
      return { url, fileKey };
    }),

  getAssignmentDetail: protectedProcedure
    .input(z.object({ assignmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [assignment] = await db.select().from(lmsCohortAssignments)
        .where(eq(lmsCohortAssignments.id, input.assignmentId)).limit(1);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
      // Verify enrollment
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, assignment.courseId)))
        .limit(1);
      if (!enrollment && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled in this cohort" });
      if (assignment.status !== "published" && ctx.user.role !== "admin") throw new TRPCError({ code: "NOT_FOUND" });
      const [mySubmission] = await db.select().from(lmsCohortSubmissions)
        .where(and(eq(lmsCohortSubmissions.assignmentId, input.assignmentId), eq(lmsCohortSubmissions.userId, ctx.user.id)))
        .limit(1);
      return { assignment, mySubmission: mySubmission ?? null };
    }),

  // ── Student Cohort Discussions ────────────────────────────────────────────────

  /** Get discussion messages for the student's cohort group */
  getCohortDiscussions: protectedProcedure
    .input(z.object({ courseId: z.number(), limit: z.number().default(100), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Find the student's cohort group for this course
      const [groupEnrollment] = await db.select({ cohortGroupId: lmsCohortGroupEnrollments.cohortGroupId })
        .from(lmsCohortGroupEnrollments)
        .where(and(
          eq(lmsCohortGroupEnrollments.userId, ctx.user.id),
          eq(lmsCohortGroupEnrollments.courseId, input.courseId),
        ))
        .limit(1);
      if (!groupEnrollment) return { messages: [], cohortGroupId: null };
      const { lmsCohortMessages } = await import("../../drizzle/schema");
      const messages = await db.select({
        id: lmsCohortMessages.id,
        cohortGroupId: lmsCohortMessages.cohortGroupId,
        userId: lmsCohortMessages.userId,
        body: lmsCohortMessages.body,
        mediaUrls: lmsCohortMessages.mediaUrls,
        isAdminPost: lmsCohortMessages.isAdminPost,
        isPinned: lmsCohortMessages.isPinned,
        createdAt: lmsCohortMessages.createdAt,
        userName: users.name,
        userDisplayName: users.displayName,
        userAvatar: users.avatarUrl,
      })
        .from(lmsCohortMessages)
        .innerJoin(users, eq(users.id, lmsCohortMessages.userId))
        .where(and(
          eq(lmsCohortMessages.cohortGroupId, groupEnrollment.cohortGroupId),
          eq(lmsCohortMessages.courseId, input.courseId),
          isNull(lmsCohortMessages.deletedAt),
        ))
        .orderBy(desc(lmsCohortMessages.isPinned), desc(lmsCohortMessages.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return { messages, cohortGroupId: groupEnrollment.cohortGroupId, currentUserId: ctx.user.id };
    }),

  /** Post a message in the student's cohort group discussion */
  postStudentCohortMessage: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      body: z.string().optional(),
      mediaUrls: z.array(z.object({ url: z.string(), mimeType: z.string(), fileName: z.string() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [groupEnrollment] = await db.select({ cohortGroupId: lmsCohortGroupEnrollments.cohortGroupId })
        .from(lmsCohortGroupEnrollments)
        .where(and(
          eq(lmsCohortGroupEnrollments.userId, ctx.user.id),
          eq(lmsCohortGroupEnrollments.courseId, input.courseId),
        ))
        .limit(1);
      if (!groupEnrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Not in a cohort group for this course" });
      const [result] = await db.insert(lmsCohortMessages).values({
        cohortGroupId: groupEnrollment.cohortGroupId,
        courseId: input.courseId,
        userId: ctx.user.id,
        body: input.body ?? null,
        mediaUrls: input.mediaUrls ?? null,
        isAdminPost: false,
        isPinned: false,
      }).$returningId();
      // ── Fire-and-forget notifications ──
      (async () => {
        try {
          // Get course + group name for notification context
          const [course] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug })
            .from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
          const [group] = await db.select({ name: lmsCohortGroups.name })
            .from(lmsCohortGroups).where(eq(lmsCohortGroups.id, groupEnrollment.cohortGroupId)).limit(1);
          const [poster] = await db.select({ name: users.name, displayName: users.displayName, email: users.email })
            .from(users).where(eq(users.id, ctx.user.id)).limit(1);
          const posterName = poster?.displayName || poster?.name || "A student";
          const courseName = course?.title ?? "your cohort course";
          const groupName = group?.name ?? "";
          const snippet = input.body ? (input.body.length > 200 ? input.body.slice(0, 200) + "…" : input.body) : "[media attachment]";
          const discussionUrl = `https://learn.allaboutultrasound.com/courses/${course?.slug ?? input.courseId}?tab=cohort&cohortTab=discussions`;
          // Collect admins + cohort staff (exclude the poster)
          const adminUsers = await db.select({ id: users.id, email: users.email, name: users.name, displayName: users.displayName, notificationPrefs: users.notificationPrefs })
            .from(users).where(eq(users.role, "admin"));
          const staffUsers = await db.select({ id: users.id, email: users.email, name: users.name, displayName: users.displayName, notificationPrefs: users.notificationPrefs })
            .from(users)
            .innerJoin(lmsCohortStaff, eq(lmsCohortStaff.userId, users.id))
            .where(and(
              eq(lmsCohortStaff.cohortGroupId, groupEnrollment.cohortGroupId),
              eq(lmsCohortStaff.courseId, input.courseId),
            ));
          // Merge and deduplicate by user id
          const allRecipients = [...adminUsers, ...staffUsers].filter((u, idx, arr) =>
            u.id !== ctx.user.id && arr.findIndex(x => x.id === u.id) === idx
          );
          // Filter by notification preference (default = enabled)
          const recipients = allRecipients.filter(u => {
            try {
              const prefs = u.notificationPrefs ? JSON.parse(u.notificationPrefs) : {};
              return prefs.cohortDiscussions !== false;
            } catch { return true; }
          });
          // Build email HTML
          const emailHtml = emailWrapper(`
            <h2 style="margin:0 0 8px;font-size:20px;color:#0e4a50;font-family:Georgia,serif;">New Cohort Discussion Post</h2>
            <p style="margin:0 0 16px;font-size:14px;color:#64748b;">${courseName}${groupName ? ` — ${groupName}` : ""}</p>
            <div style="background:#f0fbfc;border-left:4px solid #0d9488;border-radius:4px;padding:12px 16px;margin:0 0 20px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0e4a50;">${posterName}</p>
              <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${snippet}</p>
            </div>
            <a href="${discussionUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">View Discussion →</a>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">You can manage your notification preferences in your account settings.</p>
          `, "aaus");
          // Send emails
          for (const r of recipients) {
            if (r.email) {
              await sendEmail({
                to: r.email,
                subject: `New discussion post in ${courseName}`,
                html: emailHtml,
              }).catch(() => {});
            }
          }
          // Platform notification to owner
          await notifyOwner({
            title: `New cohort discussion: ${courseName}`,
            content: `${posterName} posted in ${groupName || courseName}: "${snippet}"`,
          }).catch(() => {});
        } catch (e) {
          console.warn("[CohortDiscussion] Notification error:", e);
        }
      })();
      return { id: result.id };
    }),

  /** Delete own cohort message */
  deleteStudentCohortMessage: protectedProcedure
    .input(z.object({ id: z.number(), courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { lmsCohortMessages } = await import("../../drizzle/schema");
      const [msg] = await db.select({ userId: lmsCohortMessages.userId })
        .from(lmsCohortMessages)
        .where(eq(lmsCohortMessages.id, input.id))
        .limit(1);
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      if (msg.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
            await db.update(lmsCohortMessages).set({ deletedAt: new Date() }).where(eq(lmsCohortMessages.id, input.id));
      return { success: true };
    }),

  /** Get cohort discussion notification preference for current user */
  getCohortNotifPref: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [u] = await db.select({ notificationPrefs: users.notificationPrefs })
      .from(users).where(eq(users.id, ctx.user.id)).limit(1);
    try {
      const prefs = u?.notificationPrefs ? JSON.parse(u.notificationPrefs) : {};
      return { cohortDiscussions: prefs.cohortDiscussions !== false };
    } catch { return { cohortDiscussions: true }; }
  }),

  /** Toggle cohort discussion notification preference for current user */
  setCohortNotifPref: protectedProcedure
    .input(z.object({ cohortDiscussions: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [u] = await db.select({ notificationPrefs: users.notificationPrefs })
        .from(users).where(eq(users.id, ctx.user.id)).limit(1);
      let prefs: Record<string, unknown> = {};
      try { prefs = u?.notificationPrefs ? JSON.parse(u.notificationPrefs) : {}; } catch {}
      prefs.cohortDiscussions = input.cohortDiscussions;
      await db.update(users).set({ notificationPrefs: JSON.stringify(prefs) }).where(eq(users.id, ctx.user.id));
      return { success: true, cohortDiscussions: input.cohortDiscussions };
    }),
});
// ─── Group Manager Router ─────────────────────────────────────────────────

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

  // ─── Pricing Options CRUD ───────────────────────────────────────────────────

  /** List all pricing options for a course (admin) */
  listPricingOptions: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(lmsPricingOptions)
        .where(eq(lmsPricingOptions.courseId, input.courseId))
        .orderBy(asc(lmsPricingOptions.sortOrder));
    }),

  /** Create a new pricing option */
  createPricingOption: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      label: z.string().min(1).max(255),
      sublabel: z.string().max(500).optional(),
      pricingType: z.enum(["one_time", "subscription", "payment_plan", "free"]),
      price: z.number().min(0),
      stripePriceId: z.string().optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).optional(),
      downPayment: z.number().min(0).optional(),
      installmentCount: z.number().int().min(0).optional(),
      installmentAmount: z.number().min(0).optional(),
      installmentIntervalDays: z.number().int().min(1).optional(),
      ctaLabel: z.string().max(100).optional(),
      ctaUrl: z.string().url().max(2048).optional(),
      sortOrder: z.number().int().min(0).default(0),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsPricingOptions).values({
        courseId: input.courseId,
        label: input.label,
        sublabel: input.sublabel ?? null,
        pricingType: input.pricingType,
        price: input.price,
        stripePriceId: input.stripePriceId ?? null,
        subscriptionInterval: input.subscriptionInterval ?? null,
        downPayment: input.downPayment ?? 0,
        installmentCount: input.installmentCount ?? 0,
        installmentAmount: input.installmentAmount ?? 0,
        installmentIntervalDays: input.installmentIntervalDays ?? 30,
        ctaLabel: input.ctaLabel ?? null,
        ctaUrl: input.ctaUrl ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      }).$returningId();
      return { id: result.id };
    }),

  /** Update an existing pricing option */
  updatePricingOption: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      label: z.string().min(1).max(255).optional(),
      sublabel: z.string().max(500).nullable().optional(),
      pricingType: z.enum(["one_time", "subscription", "payment_plan", "free"]).optional(),
      price: z.number().min(0).optional(),
      stripePriceId: z.string().nullable().optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).nullable().optional(),
      downPayment: z.number().min(0).optional(),
      installmentCount: z.number().int().min(0).optional(),
      installmentAmount: z.number().min(0).optional(),
      installmentIntervalDays: z.number().int().min(1).optional(),
      ctaLabel: z.string().max(100).nullable().optional(),
      ctaUrl: z.string().url().max(2048).nullable().optional(),
      sortOrder: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) { if (v !== undefined) updates[k] = v; }
      if (Object.keys(updates).length > 0) {
        await db.update(lmsPricingOptions).set(updates).where(eq(lmsPricingOptions.id, id));
      }
      return { success: true };
    }),

  /** Delete a pricing option */
  deletePricingOption: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsPricingOptions).where(eq(lmsPricingOptions.id, input.id));
      return { success: true };
    }),

  /** Reorder pricing options */
  reorderPricingOptions: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number().int().positive()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.orderedIds.map((id, idx) =>
        db.update(lmsPricingOptions).set({ sortOrder: idx }).where(eq(lmsPricingOptions.id, id))
      ));
      return { success: true };
    }),

  // ─── Platform Settings ────────────────────────────────────────────────────

  /** Get platform settings (admin) */
  getPlatformSettings: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    const raw = settings ?? { id: 1, enrollmentEmailEnabled: true, enrollmentEmailSubject: null, enrollmentEmailIntro: null, customDomains: null };
    return {
      ...raw,
      customDomainsList: raw.customDomains ? (JSON.parse(raw.customDomains) as string[]) : [],
    };
  }),

  /** Update platform settings (admin) */
  updatePlatformSettings: protectedProcedure
    .input(z.object({
      enrollmentEmailEnabled: z.boolean().optional(),
      enrollmentEmailSubject: z.string().max(255).nullable().optional(),
      enrollmentEmailIntro: z.string().nullable().optional(),
      funnelPublishDomain: z.string().max(255).nullable().optional(),
      downloadPublishDomain: z.string().max(255).nullable().optional(),
      productPublishDomain: z.string().max(255).nullable().optional(),
      coursePublishDomain: z.string().max(255).nullable().optional(),
      formPublishDomain: z.string().max(255).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(input)) { if (v !== undefined) updates[k] = v; }
      if (Object.keys(updates).length > 0) {
        await db.update(platformSettings).set(updates).where(eq(platformSettings.id, 1));
      }
      return { success: true };
    }),

  /** Update course sendEnrollmentEmail toggle */
  updateCourseEnrollmentEmail: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      sendEnrollmentEmail: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsCourses).set({ sendEnrollmentEmail: input.sendEnrollmentEmail }).where(eq(lmsCourses.id, input.courseId));
      return { success: true };
    }),

  /** Update course settings (slug, SEO, visibility, enrollment, certificate) */
  updateCourseSettings: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
      metaTitle: z.string().max(255).optional(),
      metaDescription: z.string().max(500).optional(),
      status: z.enum(["draft", "public", "hidden", "private", "archived"]).optional(),
      hasCertificate: z.boolean().optional(),
      certificateTemplateId: z.number().int().positive().nullable().optional(),
      isFeatured: z.boolean().optional(),
      isDrip: z.boolean().optional(),
      accessDurationDays: z.number().int().positive().nullable().optional(),
      publishDomain: z.string().max(255).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check slug uniqueness (excluding current course)
      const [existing] = await db.select({ id: lmsCourses.id }).from(lmsCourses)
        .where(and(eq(lmsCourses.slug, input.slug), sql`${lmsCourses.id} != ${input.courseId}`)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A course with this slug already exists" });
      const { courseId, ...fields } = input;
      await db.update(lmsCourses).set(fields).where(eq(lmsCourses.id, courseId));
      return { success: true };
    }),
  // ── Certificate Templates ──────────────────────────────────────────────────
  listCertificateTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(lmsCertificateTemplates).orderBy(desc(lmsCertificateTemplates.createdAt));
    }),
  createCertificateTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional().nullable(),
      backgroundImageUrl: z.string().optional().nullable(),
      logoUrl: z.string().optional().nullable(),
      primaryColor: z.string().default("#189aa1"),
      accentColor: z.string().default("#c9a84c"),
      textColor: z.string().default("#0e1e2e"),
      fontFamily: z.string().default("Helvetica"),
      signatureName: z.string().optional().nullable(),
      signatureTitle: z.string().optional().nullable(),
      signatureImageUrl: z.string().optional().nullable(),
      footerText: z.string().optional().nullable(),
      organizationName: z.string().default("All About Ultrasound"),
      layout: z.enum(["classic", "modern", "minimal"]).default("classic"),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.isDefault) {
        await db.update(lmsCertificateTemplates).set({ isDefault: false });
      }
      const [result] = await db.insert(lmsCertificateTemplates).values({ ...input, isActive: true });
      return { id: (result as any).insertId };
    }),
  updateCertificateTemplate: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional().nullable(),
      backgroundImageUrl: z.string().optional().nullable(),
      logoUrl: z.string().optional().nullable(),
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      textColor: z.string().optional(),
      fontFamily: z.string().optional(),
      signatureName: z.string().optional().nullable(),
      signatureTitle: z.string().optional().nullable(),
      signatureImageUrl: z.string().optional().nullable(),
      footerText: z.string().optional().nullable(),
      organizationName: z.string().optional(),
      layout: z.enum(["classic", "modern", "minimal"]).optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      if (fields.isDefault) {
        await db.update(lmsCertificateTemplates).set({ isDefault: false });
      }
      await db.update(lmsCertificateTemplates).set(fields as any).where(eq(lmsCertificateTemplates.id, id));
      return { success: true };
    }),
  deleteCertificateTemplate: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsCourses).set({ certificateTemplateId: null }).where(eq(lmsCourses.certificateTemplateId, input.id));
      await db.delete(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.id, input.id));
      return { success: true };
    }),
  listIssuedCertificates: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive().optional(),
      userId: z.number().int().positive().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(30),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (input.courseId) conditions.push(eq(lmsCertificates.courseId, input.courseId));
      if (input.userId) conditions.push(eq(lmsCertificates.userId, input.userId));
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select({
          id: lmsCertificates.id,
          userId: lmsCertificates.userId,
          courseId: lmsCertificates.courseId,
          certificateUrl: lmsCertificates.certificateUrl,
          issuedAt: lmsCertificates.issuedAt,
          templateId: lmsCertificates.templateId,
          userName: users.name,
          userEmail: users.email,
          courseTitle: lmsCourses.title,
          courseType: lmsCourses.type,
        })
        .from(lmsCertificates)
        .leftJoin(users, eq(lmsCertificates.userId, users.id))
        .leftJoin(lmsCourses, eq(lmsCertificates.courseId, lmsCourses.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(lmsCertificates.issuedAt))
        .limit(input.pageSize)
        .offset(offset);
      return rows;
    }),
  /** AI: Generate quiz questions from lesson content */
  generateQuizFromLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number().int().positive().optional(),
      courseId: z.number().int().positive().optional(),
      lessonIds: z.array(z.number().int().positive()).optional(),
      count: z.number().int().min(1).max(50).default(5),
      questionStyle: z.enum(["understanding", "thinking", "compliance", "thought_provoking", "reflection", "custom"]).default("understanding"),
      customPrompt: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Determine which lessons to pull content from
      let targetLessonIds: number[] = [];
      if (input.lessonIds && input.lessonIds.length > 0) {
        targetLessonIds = input.lessonIds;
      } else if (input.courseId) {
        // All published lessons in the course
        const courseLessons = await db.select({ id: lmsLessons.id })
          .from(lmsLessons)
          .where(and(eq(lmsLessons.courseId, input.courseId), eq(lmsLessons.lessonStatus, "published")))
          .orderBy(asc(lmsLessons.position));
        targetLessonIds = courseLessons.map(l => l.id);
      } else if (input.lessonId) {
        targetLessonIds = [input.lessonId];
      }
      if (targetLessonIds.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No lessons specified." });

      // Fetch all target lessons
      const targetLessons = await db.select({
        id: lmsLessons.id,
        title: lmsLessons.title,
        content: lmsLessons.content,
        contentBlocks: lmsLessons.contentBlocks,
      }).from(lmsLessons).where(inArray(lmsLessons.id, targetLessonIds));

      // Extract text from all lessons
      const extractText = (lesson: typeof targetLessons[0]) => {
        let text = lesson.title ?? "";
        if (lesson.content) text += "\n" + lesson.content;
        if (lesson.contentBlocks) {
          try {
            const blocks = typeof lesson.contentBlocks === "string" ? JSON.parse(lesson.contentBlocks as string) : lesson.contentBlocks;
            if (Array.isArray(blocks)) {
              for (const block of blocks) {
                const d = block.data ?? {};
                if (d.text) text += "\n" + d.text;
                if (d.content) text += "\n" + d.content;
                if (d.title) text += "\n" + d.title;
                if (d.body) text += "\n" + d.body;
                if (d.caption) text += "\n" + d.caption;
              }
            }
          } catch { /* ignore */ }
        }
        return text;
      };

      let lessonText = targetLessons.map(l => `=== ${l.title} ===\n${extractText(l)}`).join("\n\n");
      if (lessonText.trim().length < 20) throw new TRPCError({ code: "BAD_REQUEST", message: "Lessons have insufficient text content to generate questions." });
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a medical ultrasound educator. Generate multiple-choice quiz questions based on the provided lesson content. Each question must have exactly 4 options (A, B, C, D) with one correct answer. Return only valid JSON.\n\nQuestion style guidance:\n${{
  understanding: "Focus on ensuring the learner understands core concepts, definitions, and factual recall from the lesson.",
  thinking: "Write questions that require the learner to apply knowledge, reason through scenarios, or connect concepts — not just recall facts.",
  compliance: "Focus on protocol adherence, safety requirements, regulatory standards, and correct procedural steps.",
  thought_provoking: "Write challenging, nuanced questions that push the learner to think critically, consider edge cases, or evaluate competing options.",
  reflection: "Write introspective questions that prompt the learner to connect lesson content to their own clinical practice, prior experiences, or professional development. Questions should encourage self-assessment, personal insight, and real-world application rather than pure recall.",
  custom: input.customPrompt ? `Custom style instruction: ${input.customPrompt}` : "Generate well-balanced questions covering the key points of the lesson.",
}[input.questionStyle]}` },
          { role: "user", content: `Generate ${input.count} multiple-choice quiz questions based on this lesson content:\n\n${lessonText.slice(0, 6000)}` },
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
                      question: { type: "string", description: "The question text" },
                      options: { type: "array", items: { type: "string" }, description: "Exactly 4 answer options" },
                      correctAnswer: { type: "integer", description: "Index (0-3) of the correct option" },
                      explanation: { type: "string", description: "Brief explanation of the correct answer" },
                    },
                    required: ["question", "options", "correctAnswer", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        } as any,
      });
      const raw = response.choices?.[0]?.message?.content ?? "{}";
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return { questions: (parsed.questions ?? []).slice(0, input.count) };
    }),

  /** AI: Generate flashcards from lesson content */
  generateFlashcardsFromLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number().int().positive(),
      count: z.number().int().min(1).max(30).default(10),
      cardStyle: z.enum(["understanding", "thinking", "compliance", "thought_provoking", "reflection", "custom"]).default("understanding"),
      customPrompt: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lesson] = await db.select({
        id: lmsLessons.id,
        title: lmsLessons.title,
        content: lmsLessons.content,
        contentBlocks: lmsLessons.contentBlocks,
      }).from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      let lessonText = lesson.title ?? "";
      if (lesson.content) lessonText += "\n" + lesson.content;
      if (lesson.contentBlocks) {
        try {
          const blocks = typeof lesson.contentBlocks === "string" ? JSON.parse(lesson.contentBlocks as string) : lesson.contentBlocks;
          if (Array.isArray(blocks)) {
            for (const block of blocks) {
              const d = block.data ?? {};
              if (d.text) lessonText += "\n" + d.text;
              if (d.content) lessonText += "\n" + d.content;
              if (d.title) lessonText += "\n" + d.title;
              if (d.body) lessonText += "\n" + d.body;
              if (d.caption) lessonText += "\n" + d.caption;
            }
          }
        } catch { /* ignore parse errors */ }
      }
      if (lessonText.trim().length < 20) throw new TRPCError({ code: "BAD_REQUEST", message: "Lesson has insufficient text content to generate flashcards." });
      const flashcardStylePrompts: Record<string, string> = {
        understanding: "Create straightforward recall flashcards: front = term or definition question, back = clear concise answer. Focus on key concepts, anatomy, measurements, and definitions.",
        thinking: "Create application-based flashcards that require the learner to reason or apply knowledge: front = scenario or 'why/how' question, back = reasoned explanation.",
        compliance: "Create protocol- and safety-focused flashcards: front = procedure, checklist item, or safety question, back = correct protocol step or rationale.",
        thought_provoking: "Create critical-thinking flashcards with nuanced or differential-based fronts: front = complex clinical scenario or 'what would you do' question, back = nuanced answer with key differentiators.",
        reflection: "Create introspective flashcards that prompt the learner to connect lesson content to their own clinical practice or professional development: front = reflective prompt (e.g. 'How has your scanning approach changed after learning…?'), back = suggested reflection points or self-assessment criteria.",
        custom: input.customPrompt ?? "Create helpful flashcards based on the lesson content.",
      };
      const styleInstruction = flashcardStylePrompts[input.cardStyle] ?? flashcardStylePrompts.understanding;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a medical ultrasound educator. Create flashcards (question/answer pairs) based on the provided lesson content. ${styleInstruction} Each card should have a concise front and a clear back. Optionally include a hint. Return only valid JSON.` },
          { role: "user", content: `Generate ${input.count} flashcards based on this lesson content:\n\n${lessonText.slice(0, 6000)}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "flashcards",
            strict: true,
            schema: {
              type: "object",
              properties: {
                cards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      front: { type: "string", description: "Term or question on the front of the card" },
                      back: { type: "string", description: "Definition or answer on the back of the card" },
                      hint: { type: "string", description: "Optional hint to help recall the answer" },
                    },
                    required: ["front", "back", "hint"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["cards"],
              additionalProperties: false,
            },
          },
        } as any,
      });
      const raw = response.choices?.[0]?.message?.content ?? "{}";
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return { cards: (parsed.cards ?? []).slice(0, input.count) };
    }),

  // ─── Instructor Course Permissions ─────────────────────────────────────────

  /** List courses this instructor is assigned to with their publish permission */
  getInstructorCourses: protectedProcedure
    .input(z.object({ instructorUserId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          permId: instructorCoursePermissions.id,
          courseId: instructorCoursePermissions.courseId,
          canSelfPublish: instructorCoursePermissions.canSelfPublish,
          courseTitle: lmsCourses.title,
          courseStatus: lmsCourses.status,
        })
        .from(instructorCoursePermissions)
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorCoursePermissions.courseId))
        .where(eq(instructorCoursePermissions.instructorId, input.instructorUserId));
      return rows;
    }),

  /** Assign an instructor to a course (or update their publish permission) */
  setInstructorCoursePermission: protectedProcedure
    .input(z.object({
      instructorUserId: z.number(),
      courseId: z.number(),
      canSelfPublish: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = getDb();
      const existing = await db
        .select({ id: instructorCoursePermissions.id })
        .from(instructorCoursePermissions)
        .where(and(
          eq(instructorCoursePermissions.instructorId, input.instructorUserId),
          eq(instructorCoursePermissions.courseId, input.courseId),
        ))
        .then(r => r[0]);
      if (existing) {
        await db.update(instructorCoursePermissions)
          .set({ canSelfPublish: input.canSelfPublish, grantedByAdminId: ctx.user.id })
          .where(eq(instructorCoursePermissions.id, existing.id));
      } else {
        await db.insert(instructorCoursePermissions).values({
          instructorId: input.instructorUserId,
          courseId: input.courseId,
          canSelfPublish: input.canSelfPublish,
          grantedByAdminId: ctx.user.id,
        });
      }
      return { ok: true };
    }),

  /** Remove an instructor from a course */
  removeInstructorFromCourse: protectedProcedure
    .input(z.object({ instructorUserId: z.number(), courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = getDb();
      await db.delete(instructorCoursePermissions)
        .where(and(
          eq(instructorCoursePermissions.instructorId, input.instructorUserId),
          eq(instructorCoursePermissions.courseId, input.courseId),
        ));
      return { ok: true };
    }),

  /** Instructor submits a publish request for a course */
  requestCoursePublish: protectedProcedure
    .input(z.object({ courseId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      // Check instructor has permission record for this course
      const perm = await db.select().from(instructorCoursePermissions)
        .where(and(
          eq(instructorCoursePermissions.instructorId, ctx.user.id),
          eq(instructorCoursePermissions.courseId, input.courseId),
        ))
        .then(r => r[0]);
      if (!perm) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned as instructor for this course." });
      if (perm.canSelfPublish) throw new TRPCError({ code: "BAD_REQUEST", message: "You can publish this course directly." });
      // Check no pending request already exists
      const existing = await db.select().from(instructorPublishRequests)
        .where(and(
          eq(instructorPublishRequests.courseId, input.courseId),
          eq(instructorPublishRequests.instructorId, ctx.user.id),
          eq(instructorPublishRequests.status, "pending"),
        ))
        .then(r => r[0]);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A publish request is already pending for this course." });
      await db.insert(instructorPublishRequests).values({
        courseId: input.courseId,
        instructorId: ctx.user.id,
        note: input.note ?? null,
      });
      return { ok: true };
    }),

  /** Admin lists pending publish requests */
  listPublishRequests: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = getDb();
      const conditions = input.status ? [eq(instructorPublishRequests.status, input.status)] : [];
      const rows = await db
        .select({
          id: instructorPublishRequests.id,
          courseId: instructorPublishRequests.courseId,
          instructorId: instructorPublishRequests.instructorId,
          status: instructorPublishRequests.status,
          note: instructorPublishRequests.note,
          reviewNote: instructorPublishRequests.reviewNote,
          requestedAt: instructorPublishRequests.requestedAt,
          reviewedAt: instructorPublishRequests.reviewedAt,
          courseTitle: lmsCourses.title,
          instructorName: users.name,
          instructorEmail: users.email,
        })
        .from(instructorPublishRequests)
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorPublishRequests.courseId))
        .leftJoin(users, eq(users.id, instructorPublishRequests.instructorId))
        .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
        .orderBy(desc(instructorPublishRequests.requestedAt));
      return rows;
    }),

  /** Admin approves or rejects a publish request */
  reviewPublishRequest: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      decision: z.enum(["approved", "rejected"]),
      reviewNote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = getDb();
      const req = await db.select().from(instructorPublishRequests)
        .where(eq(instructorPublishRequests.id, input.requestId))
        .then(r => r[0]);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Publish request not found." });
      await db.update(instructorPublishRequests)
        .set({
          status: input.decision,
          reviewNote: input.reviewNote ?? null,
          reviewedByAdminId: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(instructorPublishRequests.id, input.requestId));
      // If approved, publish the course
      if (input.decision === "approved") {
        await db.update(lmsCourses)
          .set({ status: "public" })
          .where(eq(lmsCourses.id, req.courseId));
      }
      return { ok: true };
    }),

  /** Instructor: get own assigned courses with revenue share and publish status */
  getMyInstructorCourses: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      // Get all courses where this user is assigned as instructor
      const perms = await db.select({
        permId: instructorCoursePermissions.id,
        courseId: instructorCoursePermissions.courseId,
        canSelfPublish: instructorCoursePermissions.canSelfPublish,
        courseTitle: lmsCourses.title,
        courseStatus: lmsCourses.status,
        courseSlug: lmsCourses.slug,
        courseThumbnail: lmsCourses.thumbnailUrl,
      })
        .from(instructorCoursePermissions)
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorCoursePermissions.courseId))
        .where(eq(instructorCoursePermissions.instructorId, ctx.user.id));
      // Get revenue share for each course
      const enriched = await Promise.all(perms.map(async (p) => {
        const [share] = await db.select({ revenueSharePct: lmsCourseInstructors.revenueSharePct })
          .from(lmsCourseInstructors)
          .where(and(eq(lmsCourseInstructors.courseId, p.courseId!), eq(lmsCourseInstructors.instructorId, ctx.user.id)))
          .limit(1);
        // Get latest publish request status
        const [latestReq] = await db.select({
          id: instructorPublishRequests.id,
          status: instructorPublishRequests.status,
          note: instructorPublishRequests.note,
          reviewNote: instructorPublishRequests.reviewNote,
          requestedAt: instructorPublishRequests.requestedAt,
          reviewedAt: instructorPublishRequests.reviewedAt,
        })
          .from(instructorPublishRequests)
          .where(and(
            eq(instructorPublishRequests.courseId, p.courseId!),
            eq(instructorPublishRequests.instructorId, ctx.user.id),
          ))
          .orderBy(desc(instructorPublishRequests.requestedAt))
          .limit(1);
        return {
          ...p,
          revenueSharePct: share?.revenueSharePct ?? 0,
          latestPublishRequest: latestReq ?? null,
        };
      }));
      return enriched;
    }),

  /** Instructor: get own publish request history */
  getMyPublishRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      return db.select({
        id: instructorPublishRequests.id,
        courseId: instructorPublishRequests.courseId,
        status: instructorPublishRequests.status,
        note: instructorPublishRequests.note,
        reviewNote: instructorPublishRequests.reviewNote,
        requestedAt: instructorPublishRequests.requestedAt,
        reviewedAt: instructorPublishRequests.reviewedAt,
        courseTitle: lmsCourses.title,
      })
        .from(instructorPublishRequests)
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorPublishRequests.courseId))
        .where(eq(instructorPublishRequests.instructorId, ctx.user.id))
        .orderBy(desc(instructorPublishRequests.requestedAt));
    }),
});
