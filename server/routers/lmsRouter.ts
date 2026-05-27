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
import { getDb } from "../db";
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
} from "../../drizzle/schema";
import { getEnrollmentsForCourse, getThinkificCourse } from "../thinkific";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";

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

  // Get all section IDs for this course
  const courseSections = await db.select({ id: lmsSections.id }).from(lmsSections).where(eq(lmsSections.courseId, courseId));
  const sectionIds = courseSections.map(s => s.id);

  // Count lessons that count toward progress — exclude free-preview lessons hidden after purchase
  // (previewMode = 'preview_hide_after_purchase' are not visible to enrolled students so must not count)
  let totalCount = 0;
  const excludeHiddenPreview = sql`${lmsLessons.previewMode} != 'preview_hide_after_purchase' OR ${lmsLessons.previewMode} IS NULL`;
  if (sectionIds.length > 0) {
    const [totalRows] = await db.select({ count: sql<number>`count(*)` }).from(lmsLessons).where(
      and(
        sql`(${lmsLessons.courseId} = ${courseId} OR ${lmsLessons.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)}))`,
        excludeHiddenPreview
      )
    );
    totalCount = Number(totalRows?.count ?? 0);
  } else {
    const [totalRows] = await db.select({ count: sql<number>`count(*)` }).from(lmsLessons).where(
      and(eq(lmsLessons.courseId, courseId), excludeHiddenPreview)
    );
    totalCount = Number(totalRows?.count ?? 0);
  }
  const total = totalCount;
  if (total === 0) return;

  // Count completed lessons — also exclude hidden preview lessons from the completed count
  // so that any stale progress records for those lessons don't inflate the percentage
  const countableIds = await db
    .select({ id: lmsLessons.id })
    .from(lmsLessons)
    .where(
      sectionIds.length > 0
        ? and(
            sql`(${lmsLessons.courseId} = ${courseId} OR ${lmsLessons.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)}))`,
            excludeHiddenPreview
          )
        : and(eq(lmsLessons.courseId, courseId), excludeHiddenPreview)
    );
  const countableIdSet = countableIds.map(r => r.id);
  const completedRows = countableIdSet.length > 0
    ? await db.select({ count: sql<number>`count(*)` }).from(lmsLessonProgress).where(
        and(
          eq(lmsLessonProgress.enrollmentId, enrollmentId),
          isNotNull(lmsLessonProgress.completedAt),
          inArray(lmsLessonProgress.lessonId, countableIdSet)
        )
      )
    : [{ count: 0 }];
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
  const [course] = await db.select({ hasCertificate: lmsCourses.hasCertificate, title: lmsCourses.title, certificateTemplateId: lmsCourses.certificateTemplateId }).from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
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

  // Fetch certificate template if assigned
  let template: any = null;
  if (course.certificateTemplateId) {
    const [tmpl] = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.id, course.certificateTemplateId)).limit(1);
    template = tmpl ?? null;
  }
  if (!template) {
    // Fall back to default template
    const [defaultTmpl] = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.isDefault, true)).limit(1);
    template = defaultTmpl ?? null;
  }

  // Generate PDF
  const pdfBuffer = await generateCertificatePdf({
    learnerName,
    courseTitle: course.title,
    issuedAt,
    credentials: user.credentials,
    template,
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
    templateId: template?.id ?? null,
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
      const [sections, allLessonsRaw, cis, landingPageRow, pricingOptions] = await Promise.all([
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

      return { ...course, sections: sectionsWithLessons, instructors: instructors.filter(Boolean), landingPage, pricingOptions };
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
                unit_amount: effectivePrice,
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
            unit_amount: effectivePrice,
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
              unit_amount: downPayment,
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
              unit_amount: installmentAmount,
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
          line_items: [{ price_data: { currency: course.currency ?? "usd", product_data: { name: course.title, images: course.coverImageUrl ? [course.coverImageUrl] : undefined }, unit_amount: course.price }, quantity: 1 }],
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
          line_items: [{ price_data: { currency: product.currency, product_data: { name: product.title, images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined }, unit_amount: product.price }, quantity: 1 }],
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
          line_items: [{ price_data: { currency: product.currency, product_data: { name: product.title, images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined }, unit_amount: product.price }, quantity: 1 }],
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
});

// ─── Admin Router ─────────────────────────────────────────────────────────────

export const lmsAdminRouter = router({
  // ── Lesson fetch for editor ──
  getLessonAdmin: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lesson] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });
      return lesson;
    }),
  // ── Courses ──
  listCourses: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "public", "hidden", "private", "archived", "all"]).default("all"),
      type: z.enum(["course", "quiz", "download", "all"]).default("all"),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(500).default(20),
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
      certificateTemplateId: z.number().int().positive().nullable().optional(),
      isFeatured: z.boolean().optional(),
      isDrip: z.boolean().optional(),
      showInstructor: z.boolean().optional(),
      hideProgress: z.boolean().optional(),
      courseOverviewBlocks: z.string().nullable().optional(), // JSON array of Block objects
      courseOverviewTopBlocks: z.string().nullable().optional(), // JSON array — above progress bar
      courseOverviewBottomBlocks: z.string().nullable().optional(), // JSON array — below curriculum
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      // Course color scheme
      primaryColor: z.string().max(20).optional(),
      accentColor: z.string().max(20).optional(),
      gradientFrom: z.string().max(20).optional(),
      gradientTo: z.string().max(20).optional(),
      gradientDirection: z.string().max(30).optional(),
      thumbnailUrl: z.string().nullable().optional(),
      showInLibrary: z.boolean().optional(),
      sendEnrollmentEmail: z.boolean().optional(),
      // Custom text labels — JSON string of { lesson, section, markComplete, nextLesson, prevLesson, submitQuiz, courseModules, completed }
      customLabels: z.string().nullable().optional(),
      // Course-level default for Mark Complete button: true = show (default), false = hide
      defaultMarkComplete: z.boolean().optional(),
      // Course player theme: 'light' or 'dark'
      playerTheme: z.enum(["light", "dark"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, pricingType, defaultMarkComplete: dmc, ...updates } = input;
      if (dmc !== undefined) (updates as any).defaultMarkComplete = dmc ? 1 : 0;
      // Sync isFree with pricingType
      const extra: Record<string, any> = {};
      if (pricingType !== undefined) {
        extra.pricingType = pricingType;
        extra.isFree = pricingType === "free";
      }
            const filtered = { ...Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)), ...extra };
      // Keep coverImageUrl and thumbnailUrl in sync
      if (filtered.coverImageUrl && !filtered.thumbnailUrl) filtered.thumbnailUrl = filtered.coverImageUrl;
      if (filtered.thumbnailUrl && !filtered.coverImageUrl) filtered.coverImageUrl = filtered.thumbnailUrl;
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
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.id)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.insert(lmsArchive).values({
        itemType: "course",
        originalId: course.id,
        title: course.title,
        snapshot: JSON.stringify(course),
        deletedByUserId: ctx.user.id,
        purgeAt,
      });
      await db.delete(lmsCourses).where(eq(lmsCourses.id, input.id));
      return { success: true };
    }),

  reorderCourses: protectedProcedure
    .input(z.object({ courses: z.array(z.object({ id: z.number(), libraryOrder: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.courses.map(c =>
        db.update(lmsCourses).set({ libraryOrder: c.libraryOrder }).where(eq(lmsCourses.id, c.id))
      ));
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

      const b64Marker = ";base64,";
      const b64Idx = input.dataUri.indexOf(b64Marker);
      const base64Data = b64Idx >= 0 ? input.dataUri.slice(b64Idx + b64Marker.length) : input.dataUri;
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

            // Update the course coverImageUrl and thumbnailUrl (keep both in sync)
      await db.update(lmsCourses).set({ coverImageUrl: url, thumbnailUrl: url }).where(eq(lmsCourses.id, input.courseId));
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

      const b64Marker2 = ";base64,";
      const b64Idx2 = input.dataUri.indexOf(b64Marker2);
      const base64Data = b64Idx2 >= 0 ? input.dataUri.slice(b64Idx2 + b64Marker2.length) : input.dataUri;
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
      // Batch fetch sections + all lessons in 2 parallel queries (avoids N+1)
      // Strip heavy content columns (contentBlocks, content, videoContent) from the list —
      // they are fetched on-demand by getLessonsWithBlocks when the editor opens a lesson.
      const [sections, allLessons, landingPage, cis] = await Promise.all([
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
          effectBannerDuration: lmsLessons.effectBannerDuration,
          effectSound: lmsLessons.effectSound,
          effectSoundUrl: lmsLessons.effectSoundUrl,
          effectConfetti: lmsLessons.effectConfetti,
          effectConfettiColors: lmsLessons.effectConfettiColors,
          effectConfettiMode: lmsLessons.effectConfettiMode,
          createdAt: lmsLessons.createdAt,
          updatedAt: lmsLessons.updatedAt,
        }).from(lmsLessons).where(eq(lmsLessons.courseId, course.id)).orderBy(asc(lmsLessons.position)),
        db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, course.id)).limit(1),
        db.select().from(lmsCourseInstructors).where(eq(lmsCourseInstructors.courseId, course.id)),
      ]);
      // Group lessons by sectionId in JS
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
      return { ...course, sections: sectionsWithLessons, topLevelLessons, landingPage: landingPage[0] ?? null, courseInstructors: cis };
    }),

  // ── Sections ──
  createSection: protectedProcedure
    .input(z.object({ courseId: z.number(), title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Auto-append at end
      const posResult = await db
        .select({ maxPos: max(lmsSections.position) })
        .from(lmsSections)
        .where(eq(lmsSections.courseId, input.courseId));
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      const [result] = await db.insert(lmsSections).values({ courseId: input.courseId, title: input.title, position: nextPosition }).$returningId();
      return { id: result.id };
    }),

  updateSection: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1).optional(), position: z.number().int().optional(), isPreview: z.boolean().optional(), dripDays: z.number().int().min(0).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      // Build a typed update object — dripDays is notNull() in the schema so null must be coerced to 0
      const sectionUpdate: {
        title?: string;
        position?: number;
        isPreview?: boolean;
        dripDays?: number;
      } = {};
      if (updates.title !== undefined) sectionUpdate.title = updates.title;
      if (updates.position !== undefined) sectionUpdate.position = updates.position;
      if (updates.isPreview !== undefined) sectionUpdate.isPreview = updates.isPreview;
      if (updates.dripDays !== undefined) sectionUpdate.dripDays = updates.dripDays ?? 0;
      await db.update(lmsSections).set(sectionUpdate).where(eq(lmsSections.id, id));
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

  // ── Section Templates ──

  /** Save a section (with all its lessons) as a reusable template */
  saveSectionTemplate: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [section] = await db.select().from(lmsSections).where(eq(lmsSections.id, input.sectionId)).limit(1);
      if (!section) throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
      const lessons = await db.select({
        title: lmsLessons.title,
        type: lmsLessons.type,
        content: lmsLessons.content,
        videoContent: lmsLessons.videoContent,
        embedUrl: lmsLessons.embedUrl,
        dripDays: lmsLessons.dripDays,
        durationMinutes: lmsLessons.durationMinutes,
        requireVideoCompletion: lmsLessons.requireVideoCompletion,
        requireManualComplete: lmsLessons.requireManualComplete,
        contentBlocks: lmsLessons.contentBlocks,
        learningObjectives: lmsLessons.learningObjectives,
        position: lmsLessons.position,
      }).from(lmsLessons)
        .where(eq(lmsLessons.sectionId, input.sectionId))
        .orderBy(asc(lmsLessons.position));
      const [result] = await db.insert(lmsSectionTemplates).values({
        name: input.name,
        description: input.description ?? null,
        sectionTitle: section.title,
        lessonsJson: JSON.stringify(lessons),
        lessonCount: lessons.length,
        createdByUserId: ctx.user.id,
      }).$returningId();
      return { id: result.id };
    }),

  /** List all saved section templates */
  listSectionTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const templates = await db.select({
        id: lmsSectionTemplates.id,
        name: lmsSectionTemplates.name,
        description: lmsSectionTemplates.description,
        sectionTitle: lmsSectionTemplates.sectionTitle,
        lessonCount: lmsSectionTemplates.lessonCount,
        createdAt: lmsSectionTemplates.createdAt,
      }).from(lmsSectionTemplates).orderBy(desc(lmsSectionTemplates.createdAt));
      return templates;
    }),

  /** Delete a section template */
  deleteSectionTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsSectionTemplates).where(eq(lmsSectionTemplates.id, input.id));
      return { success: true };
    }),

  /** Import a section template into a course (creates section + lessons) */
  importSectionTemplate: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      templateId: z.number(),
      sectionTitle: z.string().optional(), // override the template's default section title
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db.select().from(lmsSectionTemplates).where(eq(lmsSectionTemplates.id, input.templateId)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      // Get next section position
      const posResult = await db.select({ maxPos: max(lmsSections.position) }).from(lmsSections).where(eq(lmsSections.courseId, input.courseId));
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      const title = input.sectionTitle?.trim() || template.sectionTitle;
      const [sectionResult] = await db.insert(lmsSections).values({ courseId: input.courseId, title, position: nextPosition }).$returningId();
      const sectionId = sectionResult.id;
      // Insert lessons from template snapshot
      let lessons: any[] = [];
      try { lessons = JSON.parse(template.lessonsJson); } catch { lessons = []; }
      for (let i = 0; i < lessons.length; i++) {
        const l = lessons[i];
        await db.insert(lmsLessons).values({
          courseId: input.courseId,
          sectionId,
          title: l.title,
          type: l.type ?? "text",
          position: i,
          content: l.content ?? null,
          videoContent: l.videoContent ?? null,
          embedUrl: l.embedUrl ?? null,
          dripDays: l.dripDays ?? 0,
          durationMinutes: l.durationMinutes ?? null,
          requireVideoCompletion: l.requireVideoCompletion ?? 0,
          requireManualComplete: l.requireManualComplete ?? null,
          contentBlocks: l.contentBlocks ?? null,
          learningObjectives: l.learningObjectives ?? null,
        });
      }
      return { sectionId, title, lessonCount: lessons.length };
    }),

  // ── Lesson Templates ──
  /** Save a single lesson (with all its content blocks) as a reusable template */
  saveLessonTemplate: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      title: z.string().min(1).max(255),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lesson] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      const [result] = await db.insert(lessonTemplates).values({
        title: input.title,
        lessonType: lesson.type ?? "video",
        blocks: lesson.contentBlocks ?? "[]",
        coverImage: lesson.coverImageUrl ?? null,
        tags: input.tags ?? null,
        createdByAdminId: ctx.user.id,
      }).$returningId();
      return { id: result.id, success: true };
    }),
  listLessonTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) return [];
      return db.select().from(lessonTemplates).orderBy(desc(lessonTemplates.createdAt));
    }),
  deleteLessonTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lessonTemplates).where(eq(lessonTemplates.id, input.id));
      return { success: true };
    }),
  /** Apply a lesson template to an existing lesson (replaces its content blocks) */
  applyLessonTemplate: protectedProcedure
    .input(z.object({ lessonId: z.number(), templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db.select().from(lessonTemplates).where(eq(lessonTemplates.id, input.templateId)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      await db.update(lmsLessons).set({ contentBlocks: template.blocks }).where(eq(lmsLessons.id, input.lessonId));
      return { success: true };
    }),

  /** Copy a section from another course into this course */
  copySectionFromCourse: protectedProcedure
    .input(z.object({
      targetCourseId: z.number(),
      sourceSectionId: z.number(),
      sectionTitle: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [sourceSection] = await db.select().from(lmsSections).where(eq(lmsSections.id, input.sourceSectionId)).limit(1);
      if (!sourceSection) throw new TRPCError({ code: "NOT_FOUND", message: "Source section not found" });
      const sourceLessons = await db.select().from(lmsLessons)
        .where(eq(lmsLessons.sectionId, input.sourceSectionId))
        .orderBy(asc(lmsLessons.position));
      // Get next section position in target course
      const posResult = await db.select({ maxPos: max(lmsSections.position) }).from(lmsSections).where(eq(lmsSections.courseId, input.targetCourseId));
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      const title = input.sectionTitle?.trim() || sourceSection.title;
      const [sectionResult] = await db.insert(lmsSections).values({ courseId: input.targetCourseId, title, position: nextPosition }).$returningId();
      const sectionId = sectionResult.id;
      for (let i = 0; i < sourceLessons.length; i++) {
        const l = sourceLessons[i];
        await db.insert(lmsLessons).values({
          courseId: input.targetCourseId,
          sectionId,
          title: l.title,
          type: l.type,
          position: i,
          content: l.content ?? null,
          videoContent: l.videoContent ?? null,
          embedUrl: l.embedUrl ?? null,
          dripDays: l.dripDays ?? 0,
          durationMinutes: l.durationMinutes ?? null,
          requireVideoCompletion: l.requireVideoCompletion ?? 0,
          requireManualComplete: l.requireManualComplete ?? null,
          contentBlocks: l.contentBlocks ?? null,
          learningObjectives: l.learningObjectives ?? null,
        });
      }
      return { sectionId, title, lessonCount: sourceLessons.length };
    }),

  /** List all courses with their sections (for copy-from-course picker) */
  listCoursesWithSections: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const courses = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug })
        .from(lmsCourses).orderBy(asc(lmsCourses.title));
      const sections = await db.select({ id: lmsSections.id, courseId: lmsSections.courseId, title: lmsSections.title, position: lmsSections.position })
        .from(lmsSections).orderBy(asc(lmsSections.courseId), asc(lmsSections.position));
      const sectionsByCourse = new Map<number, typeof sections>();
      for (const s of sections) {
        if (!sectionsByCourse.has(s.courseId)) sectionsByCourse.set(s.courseId, []);
        sectionsByCourse.get(s.courseId)!.push(s);
      }
      return courses.map(c => ({ ...c, sections: sectionsByCourse.get(c.id) ?? [] }));
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
      // Auto-calculate position: append at end of section (or course top-level)
      const posResult = await db
        .select({ maxPos: max(lmsLessons.position) })
        .from(lmsLessons)
        .where(
          input.sectionId
            ? eq(lmsLessons.sectionId, input.sectionId)
            : and(eq(lmsLessons.courseId, input.courseId), isNull(lmsLessons.sectionId))
        );
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      // Build default Hero banner block pre-filled with the lesson title
      // hideButtons: true ensures the CTA button is always hidden on auto-generated lesson banners
      // Must use { id, type, data } wrapper format as expected by BlockPreview
      const defaultHeroBlock = JSON.stringify([{
        id: `hero-auto-${Date.now()}`,
        type: "hero",
        data: {
          headline: input.title,
          headline2: "",
          subheadline: "",
          hideButtons: true,
          buttons: [],
          bgType: "color",
          bgColor: "#149096",
          textColor: "#ffffff",
          align: "left",
          heroMinHeight: 150,
        },
      }]);
      const [result] = await db.insert(lmsLessons).values({
        courseId: input.courseId,
        sectionId: input.sectionId ?? null,
        title: input.title,
        type: input.type,
        position: nextPosition,
        content: input.content ?? null,
        videoContent: input.videoContent ?? null,
        embedUrl: input.embedUrl ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        isPreview: input.isPreview,
        dripDays: input.dripDays,
        durationMinutes: input.durationMinutes ?? null,
        requireVideoCompletion: input.requireVideoCompletion ? 1 : 0,
        requireManualComplete: input.requireManualComplete ? 1 : 0,
        contentBlocks: defaultHeroBlock,
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
      previewMode: z.enum(["none", "preview", "preview_hide_after_purchase"]).optional(),
      dripDays: z.number().int().nullable().optional(),
      durationMinutes: z.number().int().nullable().optional(),
      requireVideoCompletion: z.boolean().optional(),
      // null = inherit from course default, true = always show, false = always hide
      requireManualComplete: z.boolean().nullable().optional(),
      contentBlocks: z.string().nullable().optional(), // JSON array of Block objects
      learningObjectives: z.string().nullable().optional(), // JSON array of strings
      showInstructor: z.enum(["inherit", "show", "hide"]).optional(),
      prerequisiteLessonId: z.number().int().nullable().optional(),
      isPrerequisite: z.boolean().optional(),
      commentsEnabled: z.boolean().optional(),
      meetingLink: z.string().max(1024).nullable().optional(),
      liveStartAt: z.number().int().nullable().optional(),
      liveEndAt: z.number().int().nullable().optional(),
      lessonStatus: z.enum(["published", "draft"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, requireVideoCompletion, requireManualComplete, isPrerequisite, commentsEnabled, ...rest } = input;
      const updates: Record<string, unknown> = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );
      if (requireVideoCompletion !== undefined) updates.requireVideoCompletion = requireVideoCompletion ? 1 : 0;
      // null = inherit from course default, true = show (1), false = hide (0)
      if (requireManualComplete !== undefined) updates.requireManualComplete = requireManualComplete === null ? null : (requireManualComplete ? 1 : 0);
      if (isPrerequisite !== undefined) updates.isPrerequisite = isPrerequisite;
      if (commentsEnabled !== undefined) updates.commentsEnabled = commentsEnabled ? 1 : 0;
      // Convert null dripDays to 0 (no drip)
      if (updates.dripDays === null) updates.dripDays = 0;
      // Keep isPreview in sync with previewMode for backward compat
      if (updates.previewMode !== undefined) {
        updates.isPreview = updates.previewMode !== "none";
      } else if (updates.isPreview !== undefined) {
        updates.previewMode = updates.isPreview ? "preview" : "none";
      }
      if (Object.keys(updates).length > 0) await db.update(lmsLessons).set(updates as any).where(eq(lmsLessons.id, id));
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

  /** Bulk-set lessonStatus for all lessons in a course (used by publish-course dialog) */
  bulkSetLessonStatus: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      lessonStatus: z.enum(["published", "draft"]),
      /** When true, only update lessons that are currently 'draft' → 'published'. When false, set ALL lessons. */
      onlyDrafts: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const condition = input.onlyDrafts
        ? and(eq(lmsLessons.courseId, input.courseId), eq(lmsLessons.lessonStatus, "draft"))
        : eq(lmsLessons.courseId, input.courseId);
      await db.update(lmsLessons).set({ lessonStatus: input.lessonStatus }).where(condition);
      return { success: true };
    }),

  // ── Move / Copy ──
  moveLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      targetSectionId: z.number().nullable(), // null = top-level
      courseId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get next position in target section
      const posResult = await db
        .select({ maxPos: max(lmsLessons.position) })
        .from(lmsLessons)
        .where(
          input.targetSectionId
            ? eq(lmsLessons.sectionId, input.targetSectionId)
            : and(eq(lmsLessons.courseId, input.courseId), isNull(lmsLessons.sectionId))
        );
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      await db.update(lmsLessons)
        .set({ sectionId: input.targetSectionId, position: nextPosition })
        .where(eq(lmsLessons.id, input.lessonId));
      return { success: true };
    }),

  copyLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      targetCourseId: z.number(),
      targetSectionId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [src] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });
      const posResult = await db
        .select({ maxPos: max(lmsLessons.position) })
        .from(lmsLessons)
        .where(
          input.targetSectionId
            ? eq(lmsLessons.sectionId, input.targetSectionId)
            : and(eq(lmsLessons.courseId, input.targetCourseId), isNull(lmsLessons.sectionId))
        );
      const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
      const { id: _id, courseId: _c, sectionId: _s, position: _p, ...rest } = src;
      const [result] = await db.insert(lmsLessons).values({
        ...rest,
        courseId: input.targetCourseId,
        sectionId: input.targetSectionId,
        position: nextPosition,
      }).$returningId();
      // Copy quiz if present
      const [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, input.lessonId)).limit(1);
      if (quiz) {
        const { id: _qid, lessonId: _ql, ...quizRest } = quiz;
        const [newQuiz] = await db.insert(lmsQuizzes).values({ ...quizRest, lessonId: result.id }).$returningId();
        const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id));
        if (questions.length > 0) {
          await db.insert(lmsQuizQuestions).values(questions.map(q => { const { id: _qi, quizId: _qqi, ...qr } = q; return { ...qr, quizId: newQuiz.id }; }));
        }
      }
      return { id: result.id };
    }),

  copyModule: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      targetCourseId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [srcSection] = await db.select().from(lmsSections).where(eq(lmsSections.id, input.sectionId)).limit(1);
      if (!srcSection) throw new TRPCError({ code: "NOT_FOUND" });
      // Get next section position in target course
      const secPosResult = await db.select({ maxPos: max(lmsSections.position) }).from(lmsSections).where(eq(lmsSections.courseId, input.targetCourseId));
      const nextSecPos = (secPosResult[0]?.maxPos ?? -1) + 1;
      const [newSection] = await db.insert(lmsSections).values({
        courseId: input.targetCourseId,
        title: srcSection.title,
        position: nextSecPos,
        dripDays: srcSection.dripDays,
      }).$returningId();
      // Copy all lessons in the section
      const lessons = await db.select().from(lmsLessons).where(eq(lmsLessons.sectionId, input.sectionId)).orderBy(asc(lmsLessons.position));
      for (const lesson of lessons) {
        const { id: _id, courseId: _c, sectionId: _s, ...rest } = lesson;
        const [newLesson] = await db.insert(lmsLessons).values({
          ...rest,
          courseId: input.targetCourseId,
          sectionId: newSection.id,
        }).$returningId();
        // Copy quiz if present
        const [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, lesson.id)).limit(1);
        if (quiz) {
          const { id: _qid, lessonId: _ql, ...quizRest } = quiz;
          const [newQuiz] = await db.insert(lmsQuizzes).values({ ...quizRest, lessonId: newLesson.id }).$returningId();
          const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id));
          if (questions.length > 0) {
            await db.insert(lmsQuizQuestions).values(questions.map(q => { const { id: _qi, quizId: _qqi, ...qr } = q; return { ...qr, quizId: newQuiz.id }; }));
          }
        }
      }
      return { id: newSection.id };
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
      effectBannerDuration: z.number().int().min(1).max(60).optional(),
      effectSound: z.string().max(50).optional(),
      effectSoundUrl: z.string().max(500).optional(),
      effectConfetti: z.boolean(),
      effectConfettiColors: z.string().max(500).optional(),
      effectConfettiMode: z.enum(["fall", "cannon"]).optional(),
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
        effectBannerDuration: input.effectBannerDuration ?? 5,
        effectSound: input.effectSound ?? null,
        effectSoundUrl: input.effectSoundUrl ?? null,
        effectConfetti: input.effectConfetti,
        effectConfettiColors: input.effectConfettiColors ?? null,
        effectConfettiMode: input.effectConfettiMode ?? "fall",
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
      let [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, input.lessonId)).limit(1);
      // Auto-create a quiz record if none exists for this lesson
      if (!quiz) {
        const [lesson] = await db.select({ title: lmsLessons.title }).from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
        const [result] = await db.insert(lmsQuizzes).values({
          lessonId: input.lessonId,
          title: lesson?.title ?? "Quiz",
          passingScore: 70,
          allowRetakes: true,
          showCorrectAnswers: true,
        }).$returningId();
        [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.id, result.id)).limit(1);
      }
      if (!quiz) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create quiz" });
      const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id)).orderBy(asc(lmsQuizQuestions.position));
      return { ...quiz, questions };
    }),

  updateQuiz: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      passingScore: z.number().int().min(0).max(100).optional(),
      allowRetakes: z.boolean().optional(),
      showCorrectAnswers: z.boolean().optional(),
      requirePassingToProgress: z.boolean().optional(),
      randomizeQuestions: z.boolean().optional(),
      randomizeAnswers: z.boolean().optional(),
    }))
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
      lessonIds: z.array(z.number()).optional(), // specific lesson IDs to extract content from
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Build course/lesson context for AI
      let courseContext = "";
      try {
        if (input.lessonIds && input.lessonIds.length > 0) {
          // Extract content from specific selected lessons
          const selectedLessons = await db
            .select({ title: lmsLessons.title, content: lmsLessons.content, contentBlocks: lmsLessons.contentBlocks })
            .from(lmsLessons)
            .where(inArray(lmsLessons.id, input.lessonIds));
          const lessonTexts = selectedLessons.map(l => {
            let text = `Lesson: ${l.title}`;
            if (l.content) text += `\nContent: ${l.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500)}`;
            if (l.contentBlocks) {
              try {
                const blocks = JSON.parse(l.contentBlocks);
                const blockText = blocks
                  .filter((b: any) => b.type === "rich_text" || b.type === "text")
                  .map((b: any) => (b.data?.content ?? b.data?.text ?? "").replace(/<[^>]+>/g, " ").trim())
                  .join(" ");
                if (blockText) text += `\nBlock content: ${blockText.slice(0, 1500)}`;
              } catch { /* ignore */ }
            }
            return text;
          });
          courseContext = `\n\nLesson content to base questions on:\n${lessonTexts.join("\n---\n")}\n\nGenerate questions that test understanding of the specific content above.`;
        } else if (input.courseId) {
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
              .select({ title: lmsLessons.title })
              .from(lmsLessons)
              .where(eq(lmsLessons.courseId, input.courseId))
              .orderBy(asc(lmsLessons.position));
            courseContext = `\n\nCourse context for question generation:\nCourse: "${course.title}"\nDescription: ${course.description ?? "N/A"}\nModules: ${sections.map(s => s.title).join(", ") || "N/A"}\nLessons: ${lessons.map(l => l.title).join(", ") || "N/A"}\n\nUse this course content to make questions directly relevant to what students are learning.`;
          }
        }
      } catch {
        // Ignore context fetch errors — proceed without course context
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
        const parsed = extractJson(raw);
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
      const parsedBlocks = lp?.blocks ? (() => { try { return JSON.parse(lp.blocks); } catch(e) { console.error('[getLandingPageBlocks] JSON parse error:', e); return null; } })() : null;

      return {
        blocks: parsedBlocks,
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
      // Auto-enable group purchase on courses linked via group_purchase CTA action
      const courseIdsToEnableGroup = new Set<number>();
      const collectGroupCourseIds = (blocks: any[]) => {
        for (const block of blocks) {
          const checkBehavior = (behavior: string | undefined, productType: string | undefined, productId: number | undefined) => {
            if (behavior === "group_purchase" && productType === "course" && productId) {
              courseIdsToEnableGroup.add(productId);
            }
          };
          checkBehavior(block.heroBehavior, block.heroCheckoutProductType, block.heroCheckoutProductId);
          checkBehavior(block.ctaBehavior, block.checkoutProductType, block.checkoutProductId);
          checkBehavior(block.linkBehavior, block.linkCheckoutProductType, block.linkCheckoutProductId);
          if (Array.isArray(block.buttons)) {
            for (const btn of block.buttons) {
              checkBehavior(btn.behavior, btn.checkoutProductType, btn.checkoutProductId);
            }
          }
          if (Array.isArray(block.products)) {
            for (const p of block.products) {
              checkBehavior(p.ctaBehavior, p.checkoutProductType, p.checkoutProductId);
            }
          }
          // Recurse into column blocks
          if (Array.isArray(block.leftBlocks)) collectGroupCourseIds(block.leftBlocks);
          if (Array.isArray(block.rightBlocks)) collectGroupCourseIds(block.rightBlocks);
        }
      };
      collectGroupCourseIds(input.blocks);
      for (const cid of courseIdsToEnableGroup) {
        await db.update(lmsCourses).set({ allowGroupPurchase: true }).where(eq(lmsCourses.id, cid));
      }
      return { success: true };
    }),
  // ── AI Generate Landing Page ──
  aiGenerateLandingPage: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Gather course data
      const [course] = await db.select({
        id: lmsCourses.id,
        title: lmsCourses.title,
        subtitle: lmsCourses.subtitle,
        description: lmsCourses.description,
        type: lmsCourses.type,
        price: lmsCourses.price,
        coverImageUrl: lmsCourses.coverImageUrl,
        slug: lmsCourses.slug,
      }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      // Get sections and published lessons
      const sections = await db.select({ id: lmsSections.id, title: lmsSections.title })
        .from(lmsSections).where(eq(lmsSections.courseId, input.courseId)).orderBy(asc(lmsSections.position));
      const lessons = await db.select({ title: lmsLessons.title, type: lmsLessons.type, sectionId: lmsLessons.sectionId })
        .from(lmsLessons)
        .where(and(eq(lmsLessons.courseId, input.courseId), eq(lmsLessons.lessonStatus, "published")))
        .orderBy(asc(lmsLessons.position));

      // Get pricing
      const pricing = await db.select({ label: lmsPricingOptions.label, price: lmsPricingOptions.price, pricingType: lmsPricingOptions.pricingType, subscriptionInterval: lmsPricingOptions.subscriptionInterval })
        .from(lmsPricingOptions).where(and(eq(lmsPricingOptions.courseId, input.courseId), eq(lmsPricingOptions.isActive, true))).limit(5);

      const typeLabel = course.type === "download" ? "digital download" : course.type === "quiz" ? "quiz" : "course";
      const curriculumText = sections.length > 0
        ? sections.map(s => {
            const sLessons = lessons.filter(l => l.sectionId === s.id);
            return `Section: ${s.title}\n${sLessons.map(l => `  - ${l.title} (${l.type})`).join("\n")}`;
          }).join("\n")
        : lessons.map(l => `- ${l.title} (${l.type})`).join("\n");
      const pricingText = pricing.length > 0
        ? pricing.map(p => `${p.label ?? "Option"}: $${(p.price ?? 0) / 100}${p.subscriptionInterval ? "/" + p.subscriptionInterval : ""} (${p.pricingType ?? "one_time"})`).join(", ")
        : course.price ? `$${course.price / 100}` : "Free";

      const systemPrompt = `You are an expert landing page designer for online ${typeLabel}s. Generate a complete, compelling landing page block structure as JSON. The blocks should be professional, conversion-focused, and specific to the content provided. Return ONLY valid JSON, no markdown.`;
      const userPrompt = `Generate a landing page for this ${typeLabel}:

Title: ${course.title}
Subtitle: ${course.subtitle ?? ""}
Description: ${course.description ?? ""}
Pricing: ${pricingText}
Cover Image: ${course.coverImageUrl ?? ""}

Curriculum:
${curriculumText}

Generate a JSON array of 6-8 content blocks. Each block MUST have:
- id: unique string like "block_1", "block_2", etc.
- type: MUST be one of these exact strings: hero, text, curriculum_auto, pricing_options_auto, reviews, faq, cta_standalone
- data: object with the fields described below

Block data schemas:

1. hero block — data fields:
   headline: string (main title, use course title)
   subheadline: string (subtitle/hook)
   bgType: "gradient"
   gradientFrom: "#179ca3"
   gradientTo: "#0e4a50"
   textColor: "#ffffff"
   align: "center"
   inlineMediaUrl: "${course.coverImageUrl ?? ""}"
   inlineMediaType: "image"
   inlineMediaPlacement: "right"
   buttons: [{text: "Enroll Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled"}]

2. text block — data fields:
   html: string (HTML with h2, p, ul/li tags — write compelling content about what students will learn, benefits, who it's for)
   bgColor: "#ffffff"

3. curriculum_auto block — data fields:
   headline: "What You'll Learn"
   bgColor: "#f9fafb"

4. pricing_options_auto block — data fields:
   headline: "Enroll Today"
   bgColor: "#f0fafa"

5. reviews block — data fields:
   headline: "What Students Are Saying"
   bgColor: "#ffffff"
   reviews: array of 3 objects each with: name (string), text (string — realistic review), rating (number 4 or 5)

6. faq block — data fields:
   headline: "Frequently Asked Questions"
   bgColor: "#f9fafb"
   items: array of 5-6 objects each with: q (string — question), a (string — answer)

7. cta_standalone block — data fields:
   headline: string (urgent call to action)
   subtext: string (reassurance text)
   ctaText: "Enroll Now"
   ctaColor: "#179ca3"
   ctaTextColor: "#ffffff"
   bgColor: "#f0fafa"
   align: "center"

Create blocks in this order: hero, text (what you'll learn + benefits), curriculum_auto, text (about the instructor/course), pricing_options_auto, reviews, faq, cta_standalone.
Make ALL content specific and compelling based on the course title, description, and curriculum above. Do NOT use generic placeholder text.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      let blocks: any[];
      try {
        const raw = response.choices[0].message.content as string;
        blocks = parseLandingBlocks(raw);
      } catch (err: any) {
        console.error("[aiGenerateLandingPage] parse error:", err?.message, "raw:", (response.choices[0]?.message?.content as string)?.slice(0, 400));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI returned invalid JSON: ${err?.message ?? "unknown error"}. Please try again.` });
      }
      // Save the generated blocks
      const blocksJson = JSON.stringify(blocks);
      const [existing] = await db.select({ id: lmsLandingPages.id })
        .from(lmsLandingPages).where(eq(lmsLandingPages.courseId, input.courseId)).limit(1);
      if (existing) {
        await db.update(lmsLandingPages).set({ blocks: blocksJson, isCustom: true }).where(eq(lmsLandingPages.courseId, input.courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId: input.courseId, blocks: blocksJson, isCustom: true });
      }

      return { success: true, blockCount: blocks.length };
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
      // Fire enrollment email asynchronously (non-blocking)
      void (async () => {
        try {
          const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
          const platformEnabled = settings?.enrollmentEmailEnabled !== false;
          if (!platformEnabled) return;
          const [course] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug, sendEnrollmentEmail: lmsCourses.sendEnrollmentEmail }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
          if (!course?.sendEnrollmentEmail) return;
          const [user] = await db.select({ name: users.name, displayName: users.displayName, email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
          if (!user?.email) return;
          await sendEnrollmentEmail({
            to: { name: user.displayName || user.name || "Student", email: user.email },
            courseTitle: course.title,
            courseSlug: course.slug,
            customSubject: settings?.enrollmentEmailSubject,
            customIntro: settings?.enrollmentEmailIntro,
          });
        } catch (e) {
          console.error("[enrollment-email] Failed to send:", e);
        }
      })();
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

  // ── Thinkific Enrollment Sync ──
  /**
   * Returns the Thinkific import record linked to this LMS course (if any).
   * Used by the UI to determine whether to show the "Sync from Thinkific" button.
   */
  getThinkificSyncInfo: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [importRecord] = await db
        .select()
        .from(lmsThinkificImports)
        .where(eq(lmsThinkificImports.lmsCourseId, input.courseId))
        .orderBy(desc(lmsThinkificImports.createdAt))
        .limit(1);
      if (!importRecord) return null;
      return {
        thinkificCourseId: importRecord.thinkificCourseId,
        thinkificCourseName: importRecord.thinkificCourseName,
        lastSyncedAt: importRecord.updatedAt,
        enrollmentsPending: importRecord.enrollmentsPending,
        enrollmentsActivated: importRecord.enrollmentsActivated,
      };
    }),

  /**
   * Sync enrollments from Thinkific into lms_enrollments for a specific course.
   * - Looks up the Thinkific course ID via lms_thinkific_imports
   * - Fetches all enrollments from Thinkific API
   * - For each enrollment: finds or creates a stub user by email, inserts into lms_enrollments
   * - Also updates the course cover image if not already set
   * - NO welcome emails sent
   */
  syncThinkificEnrollments: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 1. Look up the Thinkific import record for this course
      const [importRecord] = await db
        .select()
        .from(lmsThinkificImports)
        .where(eq(lmsThinkificImports.lmsCourseId, input.courseId))
        .orderBy(desc(lmsThinkificImports.createdAt))
        .limit(1);
      if (!importRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No Thinkific import record found for this course." });
      }
      const thinkificCourseId = importRecord.thinkificCourseId;

      // 2. Always update the course cover image from Thinkific (overwrite any stale/missing value)
      try {
        const thinkificCourse = await getThinkificCourse(thinkificCourseId);
         const newImageUrl = thinkificCourse.course_card_image_url || thinkificCourse.banner_image_url;
        if (newImageUrl) {
          await db.update(lmsCourses).set({ coverImageUrl: newImageUrl, thumbnailUrl: newImageUrl }).where(eq(lmsCourses.id, input.courseId));
          console.log(`[syncThinkific] Updated cover image for course ${input.courseId}: ${newImageUrl}`);
        }
      } catch (e) {
        console.warn("[syncThinkific] Could not fetch course image:", e);
      }

      // 3. Fetch all enrollments from Thinkific
      const thinkificEnrollments = await getEnrollmentsForCourse(thinkificCourseId);

      // 4. Get existing enrollments for this course (to avoid duplicates)
      const existingEnrollments = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(eq(lmsEnrollments.courseId, input.courseId));
      const enrolledUserIds = new Set(existingEnrollments.map(e => e.userId));

      let synced = 0;
      let skipped = 0;

      // 5. Process in batches of 50
      const BATCH = 50;
      for (let i = 0; i < thinkificEnrollments.length; i += BATCH) {
        const batch = thinkificEnrollments.slice(i, i + BATCH);
        const emails = batch.map(e => e.user_email.toLowerCase());

        // Find existing users by email
        const existingUsers = await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(inArray(users.email, emails));
        const emailToUserId = new Map(
          existingUsers.map(u => [(u.email ?? "").toLowerCase(), u.id])
        );

        for (const enrollment of batch) {
          const email = enrollment.user_email.toLowerCase();
          let userId = emailToUserId.get(email);

          // Create a real account if not found — no email/notification sent
          if (!userId) {
            const displayName = enrollment.user_name || email.split("@")[0];
            const [newUser] = await db.insert(users).values({
              email: enrollment.user_email.toLowerCase(),
              name: displayName,
              displayName,
              isPending: false,
              loginMethod: "email",
              emailVerified: false,
            });
            userId = (newUser as any).insertId as number;
            emailToUserId.set(email, userId);
          }

          // Skip if already enrolled
          if (enrolledUserIds.has(userId)) {
            skipped++;
            continue;
          }

          // Insert enrollment — NO welcome email
          const progressPct = Math.round(parseFloat(enrollment.percentage_completed || "0") * 100);
          await db.insert(lmsEnrollments).values({
            userId,
            courseId: input.courseId,
            enrolledAt: enrollment.created_at ? new Date(enrollment.created_at) : new Date(),
            completedAt: enrollment.completed && enrollment.completed_at ? new Date(enrollment.completed_at) : null,
            progressPct,
          });
          enrolledUserIds.add(userId);
          synced++;
        }
      }

      // 6. Update import record with sync stats
      await db.update(lmsThinkificImports)
        .set({ enrollmentsActivated: synced, updatedAt: new Date() })
        .where(eq(lmsThinkificImports.id, importRecord.id));

      return {
        synced,
        skipped,
        total: thinkificEnrollments.length,
      };
    }),

  /** Bulk-sync cover images from Thinkific for all courses that have a Thinkific import record */
  syncAllCourseImages: protectedProcedure
    .mutation(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const imports = await db.select({ courseId: lmsThinkificImports.lmsCourseId, thinkificCourseId: lmsThinkificImports.thinkificCourseId }).from(lmsThinkificImports);
      let updated = 0;
      let failed = 0;
      for (const imp of imports) {
        try {
          const tc = await getThinkificCourse(imp.thinkificCourseId);
          const imageUrl = tc.course_card_image_url || tc.banner_image_url;
          if (imageUrl) {
            await db.update(lmsCourses).set({ coverImageUrl: imageUrl, thumbnailUrl: imageUrl }).where(eq(lmsCourses.id, imp.courseId));
            updated++;
          }
        } catch {
          failed++;
        }
      }
      return { updated, failed, total: imports.length };
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
      // New: configurable structure
      moduleCount: z.number().int().min(3).max(20).default(5),
      lessonsPerModule: z.number().int().min(3).max(10).default(4),
      starterContent: z.string().max(20000).optional(), // optional outline / existing content
      generateQuizzes: z.boolean().default(true), // generate 5-question quiz per lesson
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);

      const systemPrompt = `You are an expert medical education curriculum designer specializing in ultrasound and echocardiography for All About Ultrasound™ and iHeartEcho™.
You create structured, clinically accurate, and pedagogically sound course content.
Always use United States English spelling.
Return ONLY valid JSON — no markdown, no code fences, no extra text.
IMPORTANT: Each lesson content must be comprehensive — minimum 300 words of rich HTML with clinical context, key concepts, step-by-step techniques, and practical tips.
IMPORTANT: Each lesson must include exactly 5 MCQ quiz questions with 4 options each.
IMPORTANT: The landing page must have fully written, publication-ready content — not placeholders.`;

      const isQuiz = input.productType === "quiz";
      const { moduleCount, lessonsPerModule, starterContent, generateQuizzes } = input;

      const starterSection = starterContent
        ? `\n\nSTARTER CONTENT / OUTLINE PROVIDED BY AUTHOR (use this as the primary source of truth for topics, structure, and terminology):\n---\n${starterContent}\n---\n`
        : "";

      const userPrompt = isQuiz
        ? `Create a standalone quiz on the following ultrasound/echocardiography topics:
"${input.topics}"
${input.targetAudience ? `Target audience: ${input.targetAudience}` : ""}
${input.difficultyLevel ? `Difficulty: ${input.difficultyLevel}` : ""}${starterSection}

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
${input.estimatedDurationMinutes ? `Estimated duration: ${input.estimatedDurationMinutes} minutes` : ""}${starterSection}

Generate EXACTLY ${moduleCount} modules (sections) with EXACTLY ${lessonsPerModule} lessons each.

Return a JSON object with this exact structure:
{
  "title": "Course title (concise, clinical)",
  "subtitle": "One-line subtitle",
  "sections": [
    {
      "title": "Module title",
      "lessons": [
        {
          "title": "Lesson title",
          "type": "text",
          "durationMinutes": 15,
          "learningObjectives": ["Objective 1", "Objective 2", "Objective 3"],
          "content": "<h2>Introduction</h2><p>Detailed lesson content in HTML — minimum 300 words. Include clinical context, anatomy, scanning technique, key concepts, clinical pearls, and practical tips. Use <h2>, <h3>, <ul>, <ol>, <strong>, <em> tags for structure.</p>",
          "imageSearchQuery": "ultrasound [specific anatomy/technique] clinical image",
          ${generateQuizzes ? `"quiz": {
            "questions": [
              {
                "question": "Clinical question text?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correctAnswer": "Option A",
                "explanation": "Clinical explanation of why this is correct"
              }
            ]
          }` : '"quiz": null'}
        }
      ]
    }
  ],
  "landingPage": {
    "heroTitle": "Compelling course headline (not a placeholder)",
    "heroSubtitle": "One powerful sentence describing the transformation or outcome",
    "ctaText": "Enroll Now",
    "whatYouLearn": "<ul><li>Specific learning outcome 1</li><li>Specific learning outcome 2</li><li>Specific learning outcome 3</li><li>Specific learning outcome 4</li><li>Specific learning outcome 5</li><li>Specific learning outcome 6</li></ul>",
    "bodyContent": "<h2>About This Course</h2><p>3-4 paragraph fully written HTML description. First paragraph: what the course covers and why it matters clinically. Second paragraph: who will benefit most. Third paragraph: what makes this course unique. Fourth paragraph: what students will be able to do after completing it.</p>",
    "requirements": "<h3>Who This Course Is For</h3><ul><li>Specific audience type 1</li><li>Specific audience type 2</li></ul><h3>Prerequisites</h3><p>Any required background knowledge or equipment.</p>",
    "heroImageSearchQuery": "ultrasound ${input.topics.split(' ').slice(0,3).join(' ')} clinical professional"
  }
}

CRITICAL REQUIREMENTS:
- EXACTLY ${moduleCount} sections in the sections array
- EXACTLY ${lessonsPerModule} lessons in each section's lessons array
- Each lesson content must be minimum 300 words of rich HTML
- Each lesson quiz must have EXACTLY 5 questions with 4 options each
- All landing page fields must be fully written — NO placeholders like "[Topic]" or "[Description]"
- imageSearchQuery should be a specific, descriptive search query for a relevant medical/ultrasound image`;

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
        parsed = extractJson(raw);
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
              // Always use "text" type for AI-generated lessons (quiz is attached separately)
              const lesType = ["video", "download", "embed", "video_text"].includes(les.type) ? les.type : "text";
              const [lesResult] = await db.insert(lmsLessons).values({
                courseId,
                sectionId,
                title: les.title,
                type: lesType as "video" | "text" | "quiz" | "download" | "embed" | "video_text",
                position: li,
                content: les.content ?? null,
                durationMinutes: les.durationMinutes ?? null,
                learningObjectives: Array.isArray(les.learningObjectives) ? JSON.stringify(les.learningObjectives) : null,
                mediaAssetId: null,
              }).$returningId();

              // If the lesson has an embedded quiz, create a separate quiz lesson right after it
              if (les.quiz && Array.isArray(les.quiz.questions) && les.quiz.questions.length > 0) {
                const quizLessonTitle = `${les.title} — Quiz`;
                const [quizLesResult] = await db.insert(lmsLessons).values({
                  courseId,
                  sectionId,
                  title: quizLessonTitle,
                  type: "quiz",
                  position: li + 0.5, // will be re-ordered below
                  content: null,
                  durationMinutes: 5,
                  mediaAssetId: null,
                }).$returningId();
                const [quizResult] = await db.insert(lmsQuizzes).values({ lessonId: quizLesResult.id, title: quizLessonTitle }).$returningId();
                for (let qi = 0; qi < les.quiz.questions.length; qi++) {
                  const q = les.quiz.questions[qi];
                  await db.insert(lmsQuizQuestions).values({
                    quizId: quizResult.id,
                    question: q.question,
                    type: "mcq",
                    options: Array.isArray(q.options) ? JSON.stringify(q.options) : null,
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation ?? null,
                    position: qi,
                  });
                }
              }
            }
            // Fix positions after inserting (re-number sequentially)
            const allLessons = await db.select({ id: lmsLessons.id }).from(lmsLessons)
              .where(eq(lmsLessons.sectionId, sectionId))
              .orderBy(asc(lmsLessons.position));
            for (let idx = 0; idx < allLessons.length; idx++) {
              await db.update(lmsLessons).set({ position: idx }).where(eq(lmsLessons.id, allLessons[idx].id));
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

  /** Reorder collections by providing an ordered array of IDs */
  reorderCollections: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(
        input.orderedIds.map((id, i) =>
          db.update(lmsCollections).set({ position: i }).where(eq(lmsCollections.id, id))
        )
      );
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

  // ── Block Picker: fetch lessons with contentBlocks from a course ──
  getLessonsWithBlocks: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const lessons = await db.select({
        id: lmsLessons.id,
        title: lmsLessons.title,
        type: lmsLessons.type,
        contentBlocks: lmsLessons.contentBlocks,
        sectionId: lmsLessons.sectionId,
      }).from(lmsLessons)
        .where(and(
          eq(lmsLessons.courseId, input.courseId),
          sql`${lmsLessons.contentBlocks} IS NOT NULL`,
          sql`${lmsLessons.contentBlocks} != '[]'`,
          sql`${lmsLessons.contentBlocks} != 'null'`,
        ))
        .orderBy(asc(lmsLessons.position));
      return lessons;
    }),

  /** List all lessons for a course (lightweight — id + title + type only) */
  listCourseLessons: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Join sections so we order by section.position first, then lesson.position
      const rows = await db
        .select({
          id: lmsLessons.id,
          title: lmsLessons.title,
          type: lmsLessons.type,
          sectionId: lmsLessons.sectionId,
          lessonPosition: lmsLessons.position,
          sectionPosition: lmsSections.position,
        })
        .from(lmsLessons)
        .leftJoin(lmsSections, eq(lmsLessons.sectionId, lmsSections.id))
        .where(eq(lmsLessons.courseId, input.courseId))
        .orderBy(asc(lmsSections.position), asc(lmsLessons.position));
      return rows.map(r => ({ id: r.id, title: r.title, type: r.type, sectionId: r.sectionId }));
    }),

  /** Search users by name or email (for enroll dialog) */
  searchUsers: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const q = `%${input.query}%`;
      const results = await db.select({
        id: users.id,
        name: users.name,
        displayName: users.displayName,
        email: users.email,
      }).from(users)
        .where(sql`(${users.name} LIKE ${q} OR ${users.displayName} LIKE ${q} OR ${users.email} LIKE ${q})`)
        .limit(20);
      return results;
    }),

  /** Get all enrolled users for a course with their progress details */
  getCourseUsers: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const enrollments = await db.select().from(lmsEnrollments)
        .where(eq(lmsEnrollments.courseId, input.courseId))
        .orderBy(desc(lmsEnrollments.enrolledAt))
        .limit(input.pageSize).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lmsEnrollments).where(eq(lmsEnrollments.courseId, input.courseId));
      const enriched = await Promise.all(enrollments.map(async (e) => {
        const [u] = await db.select({ id: users.id, displayName: users.displayName, name: users.name, email: users.email, createdAt: users.createdAt }).from(users).where(eq(users.id, e.userId)).limit(1);
        // Count completed lessons
        const [{ completedCount }] = await db.select({ completedCount: sql<number>`count(*)` }).from(lmsLessonProgress)
          .where(and(eq(lmsLessonProgress.enrollmentId, e.id), isNotNull(lmsLessonProgress.completedAt)));
        // Last activity (use completedAt as proxy since lmsLessonProgress has no updatedAt)
        const [lastActivity] = await db.select({ completedAt: lmsLessonProgress.completedAt })
          .from(lmsLessonProgress).where(eq(lmsLessonProgress.enrollmentId, e.id))
          .orderBy(desc(lmsLessonProgress.completedAt)).limit(1);
        return {
          ...e,
          user: u ?? null,
          completedLessons: Number(completedCount),
          lastActivityAt: lastActivity?.completedAt ?? null,
        };
      }));
      // Filter by search after enrichment
      const filtered = input.search
        ? enriched.filter(e => {
            const q = input.search!.toLowerCase();
            return (e.user?.displayName ?? "").toLowerCase().includes(q) ||
              (e.user?.name ?? "").toLowerCase().includes(q) ||
              (e.user?.email ?? "").toLowerCase().includes(q);
          })
        : enriched;
      return { enrollments: filtered, total: Number(count) };
    }),

  /** Get analytics for a specific course */
  getCourseAnalytics: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Total enrollments
      const [{ totalEnrollments }] = await db.select({ totalEnrollments: sql<number>`count(*)` }).from(lmsEnrollments).where(eq(lmsEnrollments.courseId, input.courseId));
      // Completed enrollments
      const [{ completedEnrollments }] = await db.select({ completedEnrollments: sql<number>`count(*)` }).from(lmsEnrollments).where(and(eq(lmsEnrollments.courseId, input.courseId), isNotNull(lmsEnrollments.completedAt)));
      // Active (started but not completed)
      const [{ activeEnrollments }] = await db.select({ activeEnrollments: sql<number>`count(*)` }).from(lmsEnrollments).where(and(eq(lmsEnrollments.courseId, input.courseId), sql`${lmsEnrollments.progressPct} > 0`, isNull(lmsEnrollments.completedAt)));
      // Revenue from orders
      const orders = await db.select({ amount: lmsOrders.amount, createdAt: lmsOrders.createdAt, status: lmsOrders.status })
        .from(lmsOrders).where(and(eq(lmsOrders.courseId, input.courseId), eq(lmsOrders.status, "paid")));
      const totalRevenue = orders.reduce((sum, o) => sum + (o.amount ?? 0), 0);
      // Enrollments by month (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const monthlyEnrollments = await db.select({
        month: sql<string>`DATE_FORMAT(${lmsEnrollments.enrolledAt}, '%Y-%m')`,
        count: sql<number>`count(*)`,
      }).from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.courseId, input.courseId), sql`${lmsEnrollments.enrolledAt} >= ${twelveMonthsAgo.toISOString().slice(0, 10)}`));
      // Lesson completion rates
      const sections = await db.select({ id: lmsSections.id, title: lmsSections.title, position: lmsSections.position }).from(lmsSections).where(eq(lmsSections.courseId, input.courseId)).orderBy(asc(lmsSections.position));
      const lessonStats = await Promise.all(sections.map(async (s) => {
        const lessons = await db.select({ id: lmsLessons.id, title: lmsLessons.title, position: lmsLessons.position }).from(lmsLessons).where(eq(lmsLessons.sectionId, s.id)).orderBy(asc(lmsLessons.position));
        const lessonsWithStats = await Promise.all(lessons.map(async (l) => {
          const [{ completions }] = await db.select({ completions: sql<number>`count(*)` }).from(lmsLessonProgress)
            .where(and(eq(lmsLessonProgress.lessonId, l.id), isNotNull(lmsLessonProgress.completedAt)));
          const [{ views }] = await db.select({ views: sql<number>`count(*)` }).from(lmsLessonProgress)
            .where(eq(lmsLessonProgress.lessonId, l.id));
          return { ...l, completions: Number(completions), views: Number(views) };
        }));
        return { ...s, lessons: lessonsWithStats };
      }));
      // Average progress
      const [{ avgProgress }] = await db.select({ avgProgress: sql<number>`AVG(${lmsEnrollments.progressPct})` }).from(lmsEnrollments).where(eq(lmsEnrollments.courseId, input.courseId));
      return {
        totalEnrollments: Number(totalEnrollments),
        completedEnrollments: Number(completedEnrollments),
        activeEnrollments: Number(activeEnrollments),
        totalRevenue,
        orders: orders.slice(0, 50),
        monthlyEnrollments,
        lessonStats,
        avgProgress: Math.round(Number(avgProgress ?? 0)),
      };
    }),
  /** Create a new user account and immediately enroll them in a course */
  createAndEnrollUser: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      name: z.string().min(1).max(100),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check if user already exists with this email
      const [existing] = await db.select({ id: users.id }).from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${input.email})`).limit(1);
      let userId: number;
      let isNewUser = false;
      if (existing) {
        userId = existing.id;
        // Backfill openId for existing users created without one (Thinkific imports, bulk imports).
        // Without openId the magic-link session lookup fails and the user can never log in.
        const [existingFull] = await db.select({ openId: users.openId }).from(users)
          .where(eq(users.id, userId)).limit(1);
        if (!existingFull?.openId) {
          const generatedOpenId = `email:${input.email.toLowerCase().trim()}`;
          await db.update(users).set({ openId: generatedOpenId }).where(eq(users.id, userId));
        }
      } else {
        // New user: generate a stable email-based openId so magic link login works immediately
        const openId = `email:${input.email.toLowerCase().trim()}`;
        const [inserted] = await db.insert(users).values({
          openId,
          name: input.name,
          displayName: input.name,
          email: input.email,
          role: "user",
        }).$returningId();
        userId = inserted.id;
        isNewUser = true;
      }
      // Enroll the user
      const [existingEnrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, input.courseId))).limit(1);
      if (existingEnrollment) return { enrollmentId: existingEnrollment.id, alreadyEnrolled: true, isNewUser };
      const [result] = await db.insert(lmsEnrollments).values({ userId, courseId: input.courseId }).$returningId();
      // Fire enrollment email asynchronously (non-blocking)
      void (async () => {
        try {
          const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
          const platformEnabled = settings?.enrollmentEmailEnabled !== false;
          if (!platformEnabled) return;
          const [course] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug, sendEnrollmentEmail: lmsCourses.sendEnrollmentEmail }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
          if (!course?.sendEnrollmentEmail) return;
          await sendEnrollmentEmail({
            to: { name: input.name, email: input.email },
            courseTitle: course.title,
            courseSlug: course.slug,
            customSubject: settings?.enrollmentEmailSubject,
            customIntro: settings?.enrollmentEmailIntro,
          });
        } catch (e) {
          console.error("[enrollment-email] Failed to send:", e);
        }
      })();
      return { enrollmentId: result.id, alreadyEnrolled: false, isNewUser };
    }),
  /** Get custom domains list */
  getCustomDomains: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [settings] = await db.select({ customDomains: platformSettings.customDomains }).from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    return { domains: settings?.customDomains ? (JSON.parse(settings.customDomains) as string[]) : [] };
  }),
  /** Update custom domains list */
  updateCustomDomains: protectedProcedure
    .input(z.object({ domains: z.array(z.string().min(1).max(255)) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const json = JSON.stringify(input.domains);
      await db.insert(platformSettings).values({ id: 1, customDomains: json } as any).onDuplicateKeyUpdate({ set: { customDomains: json } });
      return { success: true };
    }),

  // ─── Sales: get all orders for a course with enriched user data ─────────────
  getSalesData: protectedProcedure
    .input(z.object({
      courseId: z.number().int(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const orders = await db.select().from(lmsOrders)
        .where(eq(lmsOrders.courseId, input.courseId))
        .orderBy(desc(lmsOrders.createdAt))
        .limit(input.pageSize).offset(offset);
      const enriched = await Promise.all(orders.map(async (o) => {
        const [u] = await db!.select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          createdAt: users.createdAt,
        }).from(users).where(eq(users.id, o.userId)).limit(1);
        const [enrollment] = await db!.select({
          id: lmsEnrollments.id,
          progressPct: lmsEnrollments.progressPct,
          completedAt: lmsEnrollments.completedAt,
          enrolledAt: lmsEnrollments.enrolledAt,
        }).from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, o.userId), eq(lmsEnrollments.courseId, input.courseId)))
          .limit(1);
        return { ...o, user: u ?? null, enrollment: enrollment ?? null };
      }));
      const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(lmsOrders)
        .where(eq(lmsOrders.courseId, input.courseId));
      const [{ revenue }] = await db.select({ revenue: sql<number>`coalesce(sum(amount), 0)` }).from(lmsOrders)
        .where(and(eq(lmsOrders.courseId, input.courseId), eq(lmsOrders.status, "paid")));
      return { orders: enriched, total: Number(total), totalRevenue: Number(revenue) };
    }),

  // ─── Sales: get checkout links for all pricing options ──────────────────────
  getCheckoutLinks: protectedProcedure
    .input(z.object({ courseId: z.number().int(), origin: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const pricingOptions = await db.select().from(lmsPricingOptions)
        .where(and(eq(lmsPricingOptions.courseId, input.courseId), eq(lmsPricingOptions.isActive, true)))
        .orderBy(asc(lmsPricingOptions.sortOrder));
      // Build checkout URL for each pricing option
      const buildCheckoutUrl = (optionId?: number) => {
        const base = `${input.origin}/courses/${course.slug}`;
        return optionId ? `${base}?pricingOptionId=${optionId}&checkout=1` : `${base}?checkout=1`;
      };
      const buildEmbedCode = (url: string) =>
        `<iframe src="${url}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`;
      // Primary pricing option (from course itself)
      const primaryUrl = buildCheckoutUrl();
      const links = [
        {
          id: 0,
          label: course.pricingType === "free" ? "Free Enrollment" : `Primary — ${course.pricingType ?? "one_time"}`,
          pricingType: course.pricingType ?? "one_time",
          price: course.price,
          checkoutUrl: primaryUrl,
          embedCode: buildEmbedCode(primaryUrl),
          isActive: true,
        },
        ...pricingOptions.map(opt => {
          const url = buildCheckoutUrl(opt.id);
          return {
            id: opt.id,
            label: opt.label,
            sublabel: opt.sublabel,
            pricingType: opt.pricingType,
            price: opt.price,
            checkoutUrl: url,
            embedCode: buildEmbedCode(url),
            isActive: opt.isActive,
          };
        }),
      ];
      return { course: { id: course.id, title: course.title, slug: course.slug }, links };
    }),

  // ─── Sales: refund an order via Stripe ──────────────────────────────────────
  refundOrder: protectedProcedure
    .input(z.object({ orderId: z.number().int(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [order] = await db.select().from(lmsOrders).where(eq(lmsOrders.id, input.orderId)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.status === "refunded") throw new TRPCError({ code: "BAD_REQUEST", message: "Order already refunded" });
      if (order.status !== "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Only paid orders can be refunded" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
      // Retrieve the payment intent or session to get the charge
      let chargeId: string | null = null;
      if (order.stripePaymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
        chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;
      } else if (order.stripeSessionId) {
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        if (session.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
          chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;
        }
      }
      if (!chargeId) throw new TRPCError({ code: "BAD_REQUEST", message: "No charge found for this order — refund manually in Stripe dashboard" });
      await stripe.refunds.create({
        charge: chargeId,
        reason: (input.reason as any) ?? "requested_by_customer",
      });
      await db.update(lmsOrders).set({ status: "refunded" }).where(eq(lmsOrders.id, input.orderId));
      return { success: true };
    }),

  // ─── Sales: cancel a subscription ───────────────────────────────────────────
  cancelSubscription: protectedProcedure
    .input(z.object({ orderId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [order] = await db.select().from(lmsOrders).where(eq(lmsOrders.id, input.orderId)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (!order.stripeSubscriptionId) {
        // Try to find subscription from session
        if (order.stripeSessionId) {
          const Stripe = (await import("stripe")).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
          const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
          if (session.subscription) {
            const subId = session.subscription as string;
            await stripe.subscriptions.cancel(subId);
            await db.update(lmsOrders).set({ stripeSubscriptionId: subId, status: "refunded" }).where(eq(lmsOrders.id, input.orderId));
            return { success: true, subscriptionId: subId };
          }
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: "No subscription found for this order" });
      }
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
      await stripe.subscriptions.cancel(order.stripeSubscriptionId);
      await db.update(lmsOrders).set({ status: "refunded" }).where(eq(lmsOrders.id, input.orderId));
      return { success: true, subscriptionId: order.stripeSubscriptionId };
    }),

  // ─── Sales: get student profile for a user ──────────────────────────────────
  getStudentProfile: protectedProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const enrollments = await db.select({
        id: lmsEnrollments.id,
        courseId: lmsEnrollments.courseId,
        enrolledAt: lmsEnrollments.enrolledAt,
        progressPct: lmsEnrollments.progressPct,
        completedAt: lmsEnrollments.completedAt,
      }).from(lmsEnrollments).where(eq(lmsEnrollments.userId, input.userId)).orderBy(desc(lmsEnrollments.enrolledAt));
      const enrichedEnrollments = await Promise.all(enrollments.map(async (e) => {
        const [course] = await db!.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, e.courseId)).limit(1);
        return { ...e, course: course ?? null };
      }));
      const orders = await db.select().from(lmsOrders).where(eq(lmsOrders.userId, input.userId)).orderBy(desc(lmsOrders.createdAt));
      const enrichedOrders = await Promise.all(orders.map(async (o) => {
        const [course] = await db!.select({ id: lmsCourses.id, title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, o.courseId)).limit(1);
        return { ...o, course: course ?? null };
      }));
      return {
        user: { id: user.id, displayName: user.displayName, email: user.email, createdAt: user.createdAt, role: user.role },
        enrollments: enrichedEnrollments,
        orders: enrichedOrders,
      };
    }),

  /** Get all courses with their landing page blocks for the block picker "Copy from Other Pages" tab */
  getCoursesWithLandingBlocks: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const courses = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type })
        .from(lmsCourses)
        .orderBy(asc(lmsCourses.title));
      const result = [];
      for (const course of courses) {
        const [lp] = await db
          .select({ id: lmsLandingPages.id, blocks: lmsLandingPages.blocks })
          .from(lmsLandingPages)
          .where(eq(lmsLandingPages.courseId, course.id))
          .limit(1);
        if (lp?.blocks && lp.blocks.length > 2) {
          result.push({ ...course, blocks: lp.blocks });
        }
      }
      return result;
    }),

  /** Get all digital download products with their landing page blocks for the block picker */
  getDownloadsWithLandingBlocks: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const products = await db
        .select({ id: digitalProducts.id, title: digitalProducts.title, landingBlocks: digitalProducts.landingBlocks })
        .from(digitalProducts)
        .orderBy(asc(digitalProducts.title));
      return products.filter(p => p.landingBlocks && p.landingBlocks.length > 2);
    }),

  /** Get all physical products with their landing page blocks for the block picker */
  getProductsWithLandingBlocks: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const products = await db
        .select({ id: physicalProducts.id, title: physicalProducts.title, landingBlocks: physicalProducts.landingBlocks })
        .from(physicalProducts)
        .orderBy(asc(physicalProducts.title));
      return products.filter(p => p.landingBlocks && p.landingBlocks.length > 2);
    }),

  /**
   * Get all lessons in a course that are marked as free preview (previewMode != 'none').
   * Also returns the course slug for building the shareable preview link.
   */
  getCourseFreePreviewLessons: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get course slug
      const [course] = await db
        .select({ slug: lmsCourses.slug, title: lmsCourses.title, pricingType: lmsCourses.pricingType, price: lmsCourses.price })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Get all preview lessons (previewMode = 'preview' or 'preview_hide_after_purchase')
      const lessons = await db
        .select({
          id: lmsLessons.id,
          title: lmsLessons.title,
          previewMode: lmsLessons.previewMode,
          isPreview: lmsLessons.isPreview,
          position: lmsLessons.position,
          lessonType: lmsLessons.type,
        })
        .from(lmsLessons)
        .where(
          and(
            eq(lmsLessons.courseId, input.courseId),
            or(
              eq(lmsLessons.previewMode, "preview"),
              eq(lmsLessons.previewMode, "preview_hide_after_purchase"),
              eq(lmsLessons.isPreview, true)
            )
          )
        )
        .orderBy(asc(lmsLessons.position));
      return {
        courseSlug: course.slug,
        courseTitle: course.title,
        pricingType: course.pricingType,
        price: course.price,
        lessons: lessons.map(l => ({
          id: l.id,
          title: l.title,
          previewMode: l.previewMode ?? (l.isPreview ? "preview" : "none"),
          lessonType: l.lessonType,
        })),
      };
    }),

  /**
   * Create a free preview enrollment for a user (enrollmentType = 'free_preview').
   * Called when a user registers via the free preview link.
   */
  createFreePreviewEnrollment: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check if already enrolled
      const [existing] = await db
        .select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, input.courseId)))
        .limit(1);
      if (existing) {
        // Already enrolled (full or preview) — return existing
        return { enrollmentId: existing.id, enrollmentType: existing.enrollmentType, created: false };
      }
      const [result] = await db.insert(lmsEnrollments).values({
        userId: ctx.user.id,
        courseId: input.courseId,
        enrollmentType: "free_preview",
        progressPct: 0,
      });
      return { enrollmentId: (result as any).insertId, enrollmentType: "free_preview", created: true };
    }),

  // ─── Archive / Trash ──────────────────────────────────────────────────────

  /** List all archived items (admin only). Optionally filter by itemType. */
  listArchive: protectedProcedure
    .input(z.object({
      itemType: z.enum(["course", "quiz", "download", "product", "bundle"]).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const offset = (page - 1) * limit;
      const conditions = input?.itemType ? [eq(lmsArchive.itemType, input.itemType)] : [];
      const items = await db.select().from(lmsArchive)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(lmsArchive.deletedAt))
        .limit(limit)
        .offset(offset);
      return { items };
    }),

  /** Permanently delete an archive record immediately (admin only). */
  purgeArchiveItem: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsArchive).where(eq(lmsArchive.id, input.id));
      return { success: true };
    }),

  /** Purge all archive items whose purgeAt has passed (admin only). */
  purgeExpiredArchive: protectedProcedure
    .mutation(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = new Date();
      const result = await db.delete(lmsArchive)
        .where(sql`${lmsArchive.purgeAt} <= ${now}`);
      return { purged: (result as any).rowsAffected ?? 0 };
    }),

  /** List free preview enrollments with filters for admin email campaigns */
  listFreePreviewEnrollments: protectedProcedure
    .input(z.object({
      courseId: z.number().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(50),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const p = input;
      const page = p.page ?? 1;
      const pageSize = p.pageSize ?? 50;
      const offset = (page - 1) * pageSize;

      const conditions: any[] = [];
      if (p.courseId) conditions.push(eq(freePreviewEnrollments.courseId, p.courseId));
      if (p.search) {
        const like = `%${p.search}%`;
        conditions.push(or(
          sql`${freePreviewEnrollments.email} LIKE ${like}`,
          sql`${freePreviewEnrollments.firstName} LIKE ${like}`,
          sql`${freePreviewEnrollments.lastName} LIKE ${like}`,
        ));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select({
        id: freePreviewEnrollments.id,
        courseId: freePreviewEnrollments.courseId,
        email: freePreviewEnrollments.email,
        firstName: freePreviewEnrollments.firstName,
        lastName: freePreviewEnrollments.lastName,
        source: freePreviewEnrollments.source,
        utmSource: freePreviewEnrollments.utmSource,
        utmMedium: freePreviewEnrollments.utmMedium,
        utmCampaign: freePreviewEnrollments.utmCampaign,
        accessExpiresAt: freePreviewEnrollments.accessExpiresAt,
        createdAt: freePreviewEnrollments.createdAt,
        courseTitle: lmsCourses.title,
      })
        .from(freePreviewEnrollments)
        .leftJoin(lmsCourses, eq(freePreviewEnrollments.courseId, lmsCourses.id))
        .where(where)
        .orderBy(desc(freePreviewEnrollments.createdAt))
        .limit(pageSize)
        .offset(offset);

      const [{ total }] = await db.select({ total: sql<number>`count(*)` })
        .from(freePreviewEnrollments)
        .where(where);

      return { items: rows, total, page, pageSize };
    }),

  /** Export free preview enrollments as CSV data (admin only) */
  exportFreePreviewEnrollmentsCsv: protectedProcedure
    .input(z.object({
      courseId: z.number().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const p = input ?? {};
      const conditions: any[] = [];
      if (p.courseId) conditions.push(eq(freePreviewEnrollments.courseId, p.courseId));
      if (p.search) {
        const like = `%${p.search}%`;
        conditions.push(or(
          sql`${freePreviewEnrollments.email} LIKE ${like}`,
          sql`${freePreviewEnrollments.firstName} LIKE ${like}`,
          sql`${freePreviewEnrollments.lastName} LIKE ${like}`,
        ));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select({
        id: freePreviewEnrollments.id,
        email: freePreviewEnrollments.email,
        firstName: freePreviewEnrollments.firstName,
        lastName: freePreviewEnrollments.lastName,
        source: freePreviewEnrollments.source,
        utmSource: freePreviewEnrollments.utmSource,
        utmMedium: freePreviewEnrollments.utmMedium,
        utmCampaign: freePreviewEnrollments.utmCampaign,
        accessExpiresAt: freePreviewEnrollments.accessExpiresAt,
        createdAt: freePreviewEnrollments.createdAt,
        courseTitle: lmsCourses.title,
      })
        .from(freePreviewEnrollments)
        .leftJoin(lmsCourses, eq(freePreviewEnrollments.courseId, lmsCourses.id))
        .where(where)
        .orderBy(desc(freePreviewEnrollments.createdAt));

      // Build CSV string server-side
      const headers = ["ID", "First Name", "Last Name", "Email", "Course", "Source", "UTM Source", "UTM Medium", "UTM Campaign", "Access Expires", "Enrolled At"];
      const escape = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
      const csvLines = [
        headers.join(","),
        ...rows.map(r => [
          r.id,
          escape(r.firstName),
          escape(r.lastName),
          escape(r.email),
          escape(r.courseTitle),
          escape(r.source),
          escape(r.utmSource),
          escape(r.utmMedium),
          escape(r.utmCampaign),
          r.accessExpiresAt ? new Date(r.accessExpiresAt).toISOString() : "",
          r.createdAt ? new Date(r.createdAt).toISOString() : "",
        ].join(",")),
      ];
      return { csv: csvLines.join("\n"), count: rows.length };
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
      price: z.number().int().min(0),
      stripePriceId: z.string().optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).optional(),
      downPayment: z.number().int().min(0).optional(),
      installmentCount: z.number().int().min(0).optional(),
      installmentAmount: z.number().int().min(0).optional(),
      installmentIntervalDays: z.number().int().min(1).optional(),
      ctaLabel: z.string().max(100).optional(),
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
      price: z.number().int().min(0).optional(),
      stripePriceId: z.string().nullable().optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).nullable().optional(),
      downPayment: z.number().int().min(0).optional(),
      installmentCount: z.number().int().min(0).optional(),
      installmentAmount: z.number().int().min(0).optional(),
      installmentIntervalDays: z.number().int().min(1).optional(),
      ctaLabel: z.string().max(100).nullable().optional(),
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
});
