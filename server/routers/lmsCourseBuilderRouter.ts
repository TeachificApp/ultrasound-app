/**
 * lmsCourseBuilderRouter.ts
 * All About Ultrasound™ LMS — Course/Section/Lesson CRUD (admin)
 * Auto-extracted from lmsRouter.ts to reduce file size and fix TypeScript OOM.
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
  lmsLessonInstructors,
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
  lmsCheckoutTemplates,
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
  webinars,
  bundles,
  communities,
  funnels,
  funnelPages,
  curriculumEmbedVisibility,
  workshops,
  workshopInstances,
  workshopPricingOptions,
  workshopResources,
  workshopEnrollments,
  digitalBundles,
} from "../../drizzle/schema";
import { getEnrollmentsForCourse, getThinkificCourse } from "../thinkific";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { assertAdmin, generateSlug, uniqueSlug, recalcProgress, issueCertificateIfEnabled } from "./lmsHelpers";

export const lmsCourseBuilderRouter = router({
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
      type: z.enum(["course", "quiz", "download", "cohort", "all"]).default("all"),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(500).default(20),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (input.status !== "all") conditions.push(eq(lmsCourses.status, input.status as "draft" | "public" | "hidden" | "private"));
      if (input.type !== "all") conditions.push(eq(lmsCourses.type, input.type as "course" | "quiz" | "download" | "cohort"));
      const offset = (input.page - 1) * input.pageSize;
      const courses = await db.select().from(lmsCourses).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(lmsCourses.updatedAt)).limit(input.pageSize).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lmsCourses).where(conditions.length ? and(...conditions) : undefined);
      return { courses, total: Number(count) };
    }),

  createCourse: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      subtitle: z.string().max(500).optional(),
      type: z.enum(["course", "quiz", "download", "cohort", "workshop"]).default("course"),
      brand: z.enum(["aaus", "iheartecho"]).default("aaus"),
      pricingType: z.enum(["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).default("one_time"),
      price: z.number().min(0).default(0),
      isFree: z.boolean().default(false),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
      accessDurationDays: z.number().int().min(1).nullable().optional(),
      downPayment: z.number().min(0).optional(),
      installmentCount: z.number().int().min(0).optional(),
      installmentAmount: z.number().min(0).optional(),
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
      type: z.enum(["course", "quiz", "download", "cohort", "workshop"]).optional(),
      enrollmentCloseDate: z.string().nullable().optional(), // ISO date string or null
      // Course-level waitlist settings
      waitlistEnabled: z.boolean().optional(),
      waitlistHeading: z.string().nullable().optional(),
      waitlistBody: z.string().nullable().optional(),
      waitlistCtaLabel: z.string().nullable().optional(),
      waitlistCtaUrl: z.string().nullable().optional(),
      waitlistRedirectUrl: z.string().nullable().optional(),
      waitlistSuccessMessage: z.string().nullable().optional(),
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      price: z.number().min(0).optional(),
      isFree: z.boolean().optional(),
      pricingType: z.enum(["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).nullable().optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
      accessDurationDays: z.number().int().min(1).nullable().optional(),
      downPayment: z.number().min(0).nullable().optional(),
      installmentCount: z.number().int().min(0).nullable().optional(),
      installmentAmount: z.number().min(0).nullable().optional(),
      installmentIntervalDays: z.number().int().min(1).nullable().optional(),
      hasCertificate: z.boolean().optional(),
      certificateTemplateId: z.number().int().positive().nullable().optional(),
      creditHours: z.string().max(20).nullable().optional(),
      certificateTitleOverride: z.string().max(512).nullable().optional(),
      isFeatured: z.boolean().optional(),
      isDrip: z.boolean().optional(),
      showInstructor: z.boolean().optional(),
      hideProgress: z.boolean().optional(),
      courseOverviewBlocks: z.string().nullable().optional(), // JSON array of Block objects
      courseOverviewTopBlocks: z.string().nullable().optional(), // JSON array — above progress bar
      courseOverviewBottomBlocks: z.string().nullable().optional(), // JSON array — below curriculum
      playerSidebarBlocks: z.string().nullable().optional(), // JSON array — course player right sidebar below instructor section
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
      // Multi-cohort mode: when true, sessions/assignments/recordings are scoped per cohort group
      multiCohortMode: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, pricingType, defaultMarkComplete: dmc, enrollmentCloseDate, ...updates } = input;
      // Handle enrollmentCloseDate: convert ISO string to Date or null
      if (enrollmentCloseDate !== undefined) {
        (updates as any).enrollmentCloseDate = enrollmentCloseDate ? new Date(enrollmentCloseDate) : null;
      }
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

      // Auto-reissue certificates when cert-related fields change
      const certFieldsChanged = ['certificateTitleOverride', 'creditHours', 'certificateTemplateId'].some(f => filtered[f] !== undefined);
      if (certFieldsChanged) {
        // Find all enrollments for this course that have issued certificates
        const enrollmentsWithCerts = await db
          .select({ id: lmsEnrollments.id, userId: lmsEnrollments.userId, enrollmentType: lmsEnrollments.enrollmentType })
          .from(lmsEnrollments)
          .innerJoin(lmsCertificates, and(eq(lmsCertificates.userId, lmsEnrollments.userId), eq(lmsCertificates.courseId, id)))
          .where(eq(lmsEnrollments.courseId, id));
        // Re-issue each certificate with forceReissue=true (fire-and-forget, don't block the response)
        void Promise.allSettled(enrollmentsWithCerts.map(e =>
          issueCertificateIfEnabled(db, e.id, e.userId, id, e.enrollmentType, true)
        ));
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

  /** Unified Library Order — fetch all content types and bulk-update their libraryOrder */
  listAllLibraryItems: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [courses, downloads, bundles_list, workshops_list] = await Promise.all([
      db.select({
        id: lmsCourses.id,
        title: lmsCourses.title,
        type: lmsCourses.type,
        status: lmsCourses.status,
        brand: lmsCourses.brand,
        thumbnailUrl: lmsCourses.thumbnailUrl,
        libraryOrder: lmsCourses.libraryOrder,
        showInLibrary: lmsCourses.showInLibrary,
        createdAt: lmsCourses.createdAt,
      }).from(lmsCourses),
      db.select({
        id: digitalProducts.id,
        title: digitalProducts.title,
        status: digitalProducts.status,
        brand: digitalProducts.brand,
        thumbnailUrl: digitalProducts.thumbnailUrl,
        libraryOrder: digitalProducts.libraryOrder,
        showInLibrary: digitalProducts.showInLibrary,
        createdAt: digitalProducts.createdAt,
      }).from(digitalProducts),
      db.select({
        id: digitalBundles.id,
        title: digitalBundles.title,
        status: digitalBundles.status,
        brand: digitalBundles.brand,
        thumbnailUrl: digitalBundles.thumbnailUrl,
        libraryOrder: digitalBundles.libraryOrder,
        showInLibrary: digitalBundles.showInLibrary,
        createdAt: digitalBundles.createdAt,
      }).from(digitalBundles),
      db.select({
        id: workshops.id,
        title: workshops.title,
        status: workshops.status,
        brand: workshops.brand,
        thumbnailUrl: workshops.thumbnailUrl,
        libraryOrder: workshops.libraryOrder,
        showInLibrary: workshops.showInLibrary,
        createdAt: workshops.createdAt,
      }).from(workshops),
    ]);
    const mapped = [
      ...courses.map(c => ({ ...c, contentType: c.type as string })),
      ...downloads.map(d => ({ ...d, contentType: "download" as string, type: "download" as string })),
      ...bundles_list.map(b => ({ ...b, contentType: "bundle" as string, type: "bundle" as string })),
      ...workshops_list.map(w => ({ ...w, contentType: "workshop" as string, type: "workshop" as string })),
    ];
    mapped.sort((a, b) => {
      const ao = (a.libraryOrder === 0 || !a.libraryOrder) ? 99999 : a.libraryOrder;
      const bo = (b.libraryOrder === 0 || !b.libraryOrder) ? 99999 : b.libraryOrder;
      if (ao !== bo) return ao - bo;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return mapped;
  }),

  /** Bulk-update libraryOrder for mixed content types */
  reorderLibrary: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        id: z.number(),
        contentType: z.enum(["course", "quiz", "download", "cohort", "bundle", "workshop"]),
        libraryOrder: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.items.map(item => {
        if (item.contentType === "download") {
          return db.update(digitalProducts).set({ libraryOrder: item.libraryOrder }).where(eq(digitalProducts.id, item.id));
        } else if (item.contentType === "bundle") {
          return db.update(digitalBundles).set({ libraryOrder: item.libraryOrder }).where(eq(digitalBundles.id, item.id));
        } else if (item.contentType === "workshop") {
          return db.update(workshops).set({ libraryOrder: item.libraryOrder }).where(eq(workshops.id, item.id));
        } else {
          return db.update(lmsCourses).set({ libraryOrder: item.libraryOrder }).where(eq(lmsCourses.id, item.id));
        }
      }));
      return { success: true, updated: input.items.length };
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
          lessonStatus: lmsLessons.lessonStatus,
          commentsEnabled: lmsLessons.commentsEnabled,
          showVideoControls: lmsLessons.showVideoControls,
          countTowardCompletion: lmsLessons.countTowardCompletion,
          meetingLink: lmsLessons.meetingLink,
          liveStartAt: lmsLessons.liveStartAt,
          liveEndAt: lmsLessons.liveEndAt,
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

  /** List all courses with their sections AND lessons (for copy-lesson picker) */
  listCoursesWithLessons: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const courses = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, type: lmsCourses.type })
        .from(lmsCourses).orderBy(asc(lmsCourses.title));
      const sections = await db.select({ id: lmsSections.id, courseId: lmsSections.courseId, title: lmsSections.title, position: lmsSections.position })
        .from(lmsSections).orderBy(asc(lmsSections.courseId), asc(lmsSections.position));
      const lessons = await db.select({ id: lmsLessons.id, courseId: lmsLessons.courseId, sectionId: lmsLessons.sectionId, title: lmsLessons.title, type: lmsLessons.type, position: lmsLessons.position })
        .from(lmsLessons).orderBy(asc(lmsLessons.courseId), asc(lmsLessons.position));
      const sectionsByCourse = new Map<number, (typeof sections[0] & { lessons: typeof lessons })[]>();
      for (const s of sections) {
        if (!sectionsByCourse.has(s.courseId)) sectionsByCourse.set(s.courseId, []);
        sectionsByCourse.get(s.courseId)!.push({ ...s, lessons: [] });
      }
      // Attach lessons to sections
      const topLevelByCourse = new Map<number, typeof lessons>();
      for (const l of lessons) {
        if (l.sectionId) {
          const courseSections = sectionsByCourse.get(l.courseId) ?? [];
          const sec = courseSections.find(s => s.id === l.sectionId);
          if (sec) sec.lessons.push(l);
        } else {
          if (!topLevelByCourse.has(l.courseId)) topLevelByCourse.set(l.courseId, []);
          topLevelByCourse.get(l.courseId)!.push(l);
        }
      }
      return courses.map(c => ({
        ...c,
        sections: sectionsByCourse.get(c.id) ?? [],
        topLevelLessons: topLevelByCourse.get(c.id) ?? [],
      }));
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
      countTowardCompletion: z.boolean().optional(),
      meetingLink: z.string().max(1024).nullable().optional(),
      liveStartAt: z.number().int().nullable().optional(),
      liveEndAt: z.number().int().nullable().optional(),
      lessonStatus: z.enum(["published", "draft"]).optional(),
      showVideoControls: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, requireVideoCompletion, requireManualComplete, isPrerequisite, commentsEnabled, countTowardCompletion, ...rest } = input;
      const updates: Record<string, unknown> = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );
      if (requireVideoCompletion !== undefined) updates.requireVideoCompletion = requireVideoCompletion ? 1 : 0;
      // null = inherit from course default, true = show (1), false = hide (0)
      if (requireManualComplete !== undefined) updates.requireManualComplete = requireManualComplete === null ? null : (requireManualComplete ? 1 : 0);
      if (isPrerequisite !== undefined) updates.isPrerequisite = isPrerequisite;
      if (commentsEnabled !== undefined) updates.commentsEnabled = commentsEnabled ? 1 : 0;
      if (countTowardCompletion !== undefined) updates.countTowardCompletion = countTowardCompletion ? 1 : 0;
      // Convert null dripDays to 0 (no drip)
      if (updates.dripDays === null) updates.dripDays = 0;
      // Keep isPreview in sync with previewMode for backward compat
      if (updates.previewMode !== undefined) {
        updates.isPreview = updates.previewMode !== "none";
      } else if (updates.isPreview !== undefined) {
        updates.previewMode = updates.isPreview ? "preview" : "none";
      }
      if (Object.keys(updates).length > 0) await db.update(lmsLessons).set(updates as any).where(eq(lmsLessons.id, id));

      // When countTowardCompletion changes, recalculate progress for all enrollments in this course
      // so existing completions are immediately reflected in the correct percentage.
      if (countTowardCompletion !== undefined) {
        const [lessonRow] = await db.select({ courseId: lmsLessons.courseId }).from(lmsLessons).where(eq(lmsLessons.id, id)).limit(1);
        if (lessonRow) {
          const enrollments = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
            .where(eq(lmsEnrollments.courseId, lessonRow.courseId));
          // Fire-and-forget — don't block the response
          void Promise.all(enrollments.map(e => recalcProgress(db, e.id))).catch(err =>
            console.error('[updateLesson] recalcProgress after countTowardCompletion change failed:', err)
          );
        }
      }

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

  /** Get lesson-level instructor overrides */
  getLessonInstructors: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const links = await db.select().from(lmsLessonInstructors)
        .where(eq(lmsLessonInstructors.lessonId, input.lessonId))
        .orderBy(asc(lmsLessonInstructors.position));
      if (!links.length) return [];
      const ids = links.map(l => l.instructorId);
      const instructors = await db.select().from(lmsInstructors)
        .where(sql`${lmsInstructors.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
      const instMap = new Map(instructors.map(i => [i.id, i]));
      return links.map(l => ({ ...l, instructor: instMap.get(l.instructorId) ?? null }));
    }),

  /** Set lesson-level instructor overrides (replaces all existing for this lesson) */
  setLessonInstructors: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      instructorIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsLessonInstructors).where(eq(lmsLessonInstructors.lessonId, input.lessonId));
      if (input.instructorIds.length > 0) {
        await db.insert(lmsLessonInstructors).values(
          input.instructorIds.map((instructorId, position) => ({ lessonId: input.lessonId, instructorId, position }))
        );
      }
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

  // ── After Purchase Settings ────────────────────────────────────────────────
  getAfterPurchase: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db
        .select({
          id: lmsCourses.id,
          title: lmsCourses.title,
          customThankYouEnabled: lmsCourses.customThankYouEnabled,
          customThankYouBlocks: lmsCourses.customThankYouBlocks,
          postPurchaseRedirectUrl: lmsCourses.postPurchaseRedirectUrl,
          welcomeEmailEnabled: lmsCourses.welcomeEmailEnabled,
          welcomeEmailSubject: lmsCourses.welcomeEmailSubject,
          welcomeEmailBody: lmsCourses.welcomeEmailBody,
          upsellEnabled: lmsCourses.upsellEnabled,
          upsellCourseId: lmsCourses.upsellCourseId,
          upsellProductType: lmsCourses.upsellProductType,
          upsellProductId: lmsCourses.upsellProductId,
          upsellHeadline: lmsCourses.upsellHeadline,
          upsellDescription: lmsCourses.upsellDescription,
          hidePricingOptions: lmsCourses.hidePricingOptions,
          completionRedirectUrl: lmsCourses.completionRedirectUrl,
          completionEmailEnabled: lmsCourses.completionEmailEnabled,
          completionEmailSubject: lmsCourses.completionEmailSubject,
          completionEmailBody: lmsCourses.completionEmailBody,
        })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return course;
    }),

  updateAfterPurchase: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      customThankYouEnabled: z.boolean().optional(),
      customThankYouBlocks: z.string().nullable().optional(),
      postPurchaseRedirectUrl: z.string().max(1024).nullable().optional(),
      welcomeEmailEnabled: z.boolean().optional(),
      welcomeEmailSubject: z.string().max(500).nullable().optional(),
      welcomeEmailBody: z.string().nullable().optional(),
      upsellEnabled: z.boolean().optional(),
      upsellCourseId: z.number().nullable().optional(),
      upsellProductType: z.enum(["course", "quiz", "webinar", "download", "membership"]).nullable().optional(),
      upsellProductId: z.number().nullable().optional(),
      upsellHeadline: z.string().max(500).nullable().optional(),
      upsellDescription: z.string().nullable().optional(),
      hidePricingOptions: z.boolean().optional(),
      completionRedirectUrl: z.string().max(1024).nullable().optional(),
      completionEmailEnabled: z.boolean().optional(),
      completionEmailSubject: z.string().max(500).nullable().optional(),
      completionEmailBody: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { courseId, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) {
        await db.update(lmsCourses).set(filtered).where(eq(lmsCourses.id, courseId));
      }
      return { success: true };
    }),

  /** Get the checkout page config for a course (admin) */
  getCheckoutPageConfig: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db
        .select({ checkoutPageConfig: lmsCourses.checkoutPageConfig })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return { config: course.checkoutPageConfig ?? null };
    }),

  /** Save the checkout page config for a course (admin) */
  saveCheckoutPageConfig: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      config: z.string(), // JSON string of CheckoutPageConfig
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Validate JSON
      try { JSON.parse(input.config); } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON config" });
      }
      await db.update(lmsCourses)
        .set({ checkoutPageConfig: input.config })
        .where(eq(lmsCourses.id, input.courseId));
      return { success: true };
    }),

  /** Get checkout page config for public rendering (no auth required) */
  getPublicCheckoutPageConfig: publicProcedure
    .input(z.object({ courseSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db
        .select({
          checkoutPageConfig: lmsCourses.checkoutPageConfig,
          totalLessons: sql<number>`(SELECT COUNT(*) FROM lms_lessons WHERE course_id = ${lmsCourses.id} AND is_deleted = 0)`,
          totalSections: sql<number>`(SELECT COUNT(*) FROM lms_sections WHERE course_id = ${lmsCourses.id})`,
          hasCertificate: lmsCourses.hasCertificate,
        })
        .from(lmsCourses)
        .where(eq(lmsCourses.slug, input.courseSlug))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        config: course.checkoutPageConfig ?? null,
        courseStats: {
          totalLessons: Number(course.totalLessons ?? 0),
          totalSections: Number(course.totalSections ?? 0),
          hasCertificate: course.hasCertificate,
        },
      };
    }),

  /** List all saved checkout page templates (admin) */
  listCheckoutTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const templates = await db
        .select({
          id: lmsCheckoutTemplates.id,
          name: lmsCheckoutTemplates.name,
          description: lmsCheckoutTemplates.description,
          config: lmsCheckoutTemplates.config,
          createdAt: lmsCheckoutTemplates.createdAt,
        })
        .from(lmsCheckoutTemplates)
        .orderBy(desc(lmsCheckoutTemplates.createdAt));
      return templates;
    }),

  /** Save current config as a named reusable template (admin) */
  saveCheckoutTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      config: z.string(), // JSON string of CheckoutPageConfig
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try { JSON.parse(input.config); } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON config" });
      }
      const [result] = await db.insert(lmsCheckoutTemplates).values({
        name: input.name,
        description: input.description ?? null,
        config: input.config,
        createdByUserId: ctx.user.id,
      });
      return { id: (result as any).insertId as number, success: true };
    }),

  /** Delete a saved checkout template (admin) */
  deleteCheckoutTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCheckoutTemplates).where(eq(lmsCheckoutTemplates.id, input.id));
      return { success: true };
    }),

  /**
   * Quick-nav: return all content types that have landing pages so the
   * LandingPageBuilder header can offer a jump-to dropdown.
   */
  listAllLandingPages: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [courses, webinarRows, downloadRows, bundleRows, productRows, communityRows, workshopRows, funnelRows, funnelPageRows] =
      await Promise.all([
        db.select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type })
          .from(lmsCourses)
          .where(sql`${lmsCourses.status} != 'archived'`)
          .orderBy(asc(lmsCourses.type), asc(lmsCourses.title)),
        db.select({ id: webinars.id, title: webinars.title })
          .from(webinars)
          .where(sql`${webinars.status} != 'ended'`)
          .orderBy(asc(webinars.title)),
        db.select({ id: digitalProducts.id, title: digitalProducts.title })
          .from(digitalProducts)
          .orderBy(asc(digitalProducts.title)),
        db.select({ id: bundles.id, title: bundles.title })
          .from(bundles)
          .orderBy(asc(bundles.title)),
        db.select({ id: physicalProducts.id, title: physicalProducts.title })
          .from(physicalProducts)
          .orderBy(asc(physicalProducts.title)),
        db.select({ id: communities.id, title: communities.title })
          .from(communities)
          .orderBy(asc(communities.title)),
        db.select({ id: workshops.id, title: workshops.title })
          .from(workshops)
          .where(sql`${workshops.status} != 'archived'`)
          .orderBy(asc(workshops.title)),
        db.select({ id: funnels.id, name: funnels.name })
          .from(funnels)
          .orderBy(asc(funnels.sortOrder), asc(funnels.name)),
        db.select({ id: funnelPages.id, funnelId: funnelPages.funnelId, title: funnelPages.title })
          .from(funnelPages)
          .orderBy(asc(funnelPages.sortOrder)),
      ]);

    // Attach pages to their funnel
    const pagesByFunnelId = new Map<number, Array<{ id: number; title: string }>>();
    for (const page of funnelPageRows) {
      if (!pagesByFunnelId.has(page.funnelId)) pagesByFunnelId.set(page.funnelId, []);
      pagesByFunnelId.get(page.funnelId)!.push({ id: page.id, title: page.title });
    }

    return {
      courses: courses.filter(c => c.type === "course"),
      quizzes: courses.filter(c => c.type === "quiz"),
      cohorts: courses.filter(c => c.type === "cohort"),
      downloads: downloadRows,
      webinars: webinarRows,
      bundles: bundleRows,
      products: productRows,
      communities: communityRows,
      workshops: workshopRows,
      funnels: funnelRows.map(f => ({ id: f.id, title: f.name, pages: pagesByFunnelId.get(f.id) ?? [] })),
    };
  }),

  // ── Curriculum Embed Visibility ──────────────────────────────────────────────
  /** Get all visibility overrides for a course (sections + lessons hidden from embed widget) */
  getCurriculumEmbedVisibility: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(curriculumEmbedVisibility)
        .where(eq(curriculumEmbedVisibility.courseId, input.courseId));
      // Return as a Set-like map: { section_123: true, lesson_456: true }
      const hiddenMap: Record<string, boolean> = {};
      for (const row of rows) {
        if (row.hidden) hiddenMap[`${row.itemType}_${row.itemId}`] = true;
      }
      return { hiddenMap, rows };
    }),

  /** Set visibility for a section or lesson in the embed widget */
  setCurriculumEmbedVisibility: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      items: z.array(z.object({
        itemType: z.enum(["section", "lesson"]),
        itemId: z.number(),
        hidden: z.boolean(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Upsert each item using INSERT ... ON DUPLICATE KEY UPDATE
      for (const item of input.items) {
        await db
          .insert(curriculumEmbedVisibility)
          .values({
            courseId: input.courseId,
            itemType: item.itemType,
            itemId: item.itemId,
            hidden: item.hidden,
          })
          .onDuplicateKeyUpdate({ set: { hidden: item.hidden } });
      }
      return { success: true, updated: input.items.length };
    }),

  /**
   * changeCourseType — cross-table migration when the admin changes a content
   * type that requires moving to a different table:
   *   lms_courses (course/quiz/cohort/download) <-> workshops table
   *
   * Within lms_courses (e.g. course→cohort, cohort→quiz) this just updates
   * the type field in place and returns { same: true }.
   *
   * When migrating to/from workshops it:
   *   1. Creates the destination row with all matching fields
   *   2. Copies sections & lessons (lms_courses→workshop) or just core fields
   *   3. Archives and deletes the source row
   *   4. Returns { newId, newType, redirectTo: "workshops" | "courses" }
   */
  changeCourseType: protectedProcedure
    .input(z.object({
      /** Source entity — either an lms_courses id or a workshops id */
      sourceId: z.number(),
      /** The table the source lives in */
      sourceTable: z.enum(["lms_courses", "workshops"]),
      /** The desired new type */
      newType: z.enum(["course", "quiz", "download", "cohort", "workshop"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { sourceId, sourceTable, newType } = input;

      // ── Case 1: within lms_courses (no cross-table migration needed) ──────────
      if (sourceTable === "lms_courses" && newType !== "workshop") {
        await db.update(lmsCourses).set({ type: newType as any }).where(eq(lmsCourses.id, sourceId));
        return { same: true, newId: sourceId, newType, redirectTo: "courses" as const };
      }

      // ── Case 2: lms_courses → workshops ──────────────────────────────────────
      if (sourceTable === "lms_courses" && newType === "workshop") {
        const [src] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, sourceId)).limit(1);
        if (!src) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

        // Ensure unique slug in workshops table
        const baseSlug = src.slug ?? generateSlug(src.title);
        let slug = baseSlug;
        let attempt = 0;
        while (true) {
          const [existing] = await db.select({ id: workshops.id }).from(workshops).where(eq(workshops.slug, slug)).limit(1);
          if (!existing) break;
          attempt++;
          slug = `${baseSlug}-${attempt}`;
        }

        // Create workshop row
        const [ins] = await db.insert(workshops).values({
          slug,
          title: src.title,
          subtitle: src.subtitle ?? undefined,
          description: src.description ?? undefined,
          coverImageUrl: src.coverImageUrl ?? undefined,
          thumbnailUrl: src.thumbnailUrl ?? undefined,
          status: (src.status === "public" || src.status === "hidden" || src.status === "archived" ? src.status : "draft") as any,
          brand: (src.brand ?? "aaus") as any,
          price: Math.round((src.price ?? 0) * 100), // lms_courses stores dollars, workshops stores cents
          isFree: src.isFree ?? false,
          currency: src.currency ?? "usd",
          pricingType: (src.pricingType === "free" || src.pricingType === "one_time" ? src.pricingType : "one_time") as any,
          metaTitle: src.metaTitle ?? undefined,
          metaDescription: src.metaDescription ?? undefined,
          showInLibrary: src.showInLibrary ?? true,
          libraryOrder: src.libraryOrder ?? 0,
          isFeatured: src.isFeatured ?? false,
          primaryColor: src.primaryColor ?? "#179ca3",
          accentColor: src.accentColor ?? "#0d9488",
          curriculumEnabled: true,
          hidePricingOptions: false,
          customThankYouEnabled: false,
          welcomeEmailEnabled: src.sendEnrollmentEmail ?? true,
          createdByUserId: ctx.user.id,
        }).$returningId();
        const newWorkshopId = ins.id;

        // Archive source course
        await db.insert(lmsArchive).values({
          itemType: "course",
          originalId: src.id,
          title: src.title,
          snapshot: JSON.stringify({ ...src, _migratedToWorkshop: newWorkshopId }),
          deletedByUserId: ctx.user.id,
          purgeAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        });

        // Delete source (cascade: sections, lessons, enrollments handled by FK or manual)
        await db.delete(lmsCourses).where(eq(lmsCourses.id, sourceId));

        return { same: false, newId: newWorkshopId, newType: "workshop" as const, redirectTo: "workshops" as const };
      }

      // ── Case 3: workshops → lms_courses ──────────────────────────────────────
      if (sourceTable === "workshops") {
        const [src] = await db.select().from(workshops).where(eq(workshops.id, sourceId)).limit(1);
        if (!src) throw new TRPCError({ code: "NOT_FOUND", message: "Workshop not found" });

        // Ensure unique slug in lms_courses
        const baseSlug = src.slug ?? generateSlug(src.title);
        const newSlug = await uniqueSlug(db, baseSlug);

        const [ins] = await db.insert(lmsCourses).values({
          slug: newSlug,
          title: src.title,
          subtitle: src.subtitle ?? undefined,
          description: src.description ?? undefined,
          coverImageUrl: src.coverImageUrl ?? undefined,
          thumbnailUrl: src.thumbnailUrl ?? src.coverImageUrl ?? undefined,
          status: (src.status === "public" || src.status === "hidden" || src.status === "archived" ? src.status : "draft") as any,
          type: newType as any,
          brand: (src.brand ?? "aaus") as any,
          price: Math.round((src.price ?? 0) / 100), // workshops stores cents, lms_courses stores dollars
          isFree: src.isFree ?? false,
          currency: src.currency ?? "usd",
          pricingType: (src.pricingType ?? "one_time") as any,
          metaTitle: src.metaTitle ?? undefined,
          metaDescription: src.metaDescription ?? undefined,
          showInLibrary: src.showInLibrary ?? true,
          libraryOrder: src.libraryOrder ?? 0,
          isFeatured: src.isFeatured ?? false,
          primaryColor: src.primaryColor ?? "#0d9488",
          accentColor: src.accentColor ?? "#0f766e",
          sendEnrollmentEmail: src.welcomeEmailEnabled ?? true,
          createdByUserId: ctx.user.id,
        }).$returningId();
        const newCourseId = ins.id;

        // Create a basic landing page
        await db.insert(lmsLandingPages).values({ courseId: newCourseId, heroTitle: src.title, ctaText: "Enroll Now" });

        // Archive workshop
        await db.insert(lmsArchive).values({
          itemType: "course",
          originalId: src.id,
          title: src.title,
          snapshot: JSON.stringify({ ...src, _migratedFromWorkshop: true, _newCourseId: newCourseId }),
          deletedByUserId: ctx.user.id,
          purgeAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        });

        // Delete workshop (cascade sub-tables)
        await db.delete(workshopEnrollments).where(eq(workshopEnrollments.workshopId, sourceId));
        await db.delete(workshopResources).where(eq(workshopResources.workshopId, sourceId));
        await db.delete(workshopInstances).where(eq(workshopInstances.workshopId, sourceId));
        await db.delete(workshopPricingOptions).where(eq(workshopPricingOptions.workshopId, sourceId));
        await db.delete(workshops).where(eq(workshops.id, sourceId));

        return { same: false, newId: newCourseId, newType, redirectTo: "courses" as const };
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid type change combination" });
    }),
});
