/**
 * lmsCohortAdminRouter.ts
 * All About Ultrasound™ LMS — Cohort Sessions, Assignments, Recordings (admin)
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
import { enrichCohortResources } from "../lib/cohortResources";
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
  lmsCohortResources,
  lmsCohortSubmissions,
  mediaUploadFolders,
  mediaUploadResponses,
  lmsCohortGroups,
  lmsCohortGroupEnrollments,
  lmsCohortMessages,
  lmsCohortStaff,
  postingAliases,
  cohortWaitlistEntries,
} from "../../drizzle/schema";
import { getEnrollmentsForCourse, getThinkificCourse } from "../thinkific";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { assertAdmin, generateSlug, uniqueSlug, recalcProgress, issueCertificateIfEnabled } from "./lmsHelpers";

export const lmsCohortAdminRouter = router({
  // ── Cohort Sessions ──
  listCohortSessions: protectedProcedure
    .input(z.object({ courseId: z.number(), cohortGroupId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const whereClause = input.cohortGroupId
        ? and(eq(lmsCohortSessions.courseId, input.courseId), eq(lmsCohortSessions.cohortGroupId, input.cohortGroupId))
        : eq(lmsCohortSessions.courseId, input.courseId);
      const sessions = await db.select().from(lmsCohortSessions)
        .where(whereClause)
        .orderBy(asc(lmsCohortSessions.sessionDate));
      return sessions;
    }),

  createCohortSession: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      cohortGroupId: z.number().optional(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      sessionDate: z.string(), // ISO string
      durationMinutes: z.number().int().min(1).default(60),
      meetingUrl: z.string().optional(),
      recordingUrl: z.string().optional(),
      status: z.enum(["draft", "published", "cancelled"]).default("draft"),
      notifyStudents: z.boolean().default(false),
      timezone: z.string().optional(),
      recurrenceRule: z.enum(["weekly", "biweekly", "monthly"]).optional(),
      // Comma-separated days of week: "1,3,5" (0=Sun … 6=Sat)
      recurrenceDaysOfWeek: z.string().optional(),
      recurrenceEndDate: z.string().optional(),
      // Alternative to end date
      recurrenceOccurrenceCount: z.number().int().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsCohortSessions).values({
        courseId: input.courseId,
        cohortGroupId: input.cohortGroupId ?? null,
        title: input.title,
        description: input.description ?? null,
        sessionDate: new Date(input.sessionDate),
        durationMinutes: input.durationMinutes,
        meetingUrl: input.meetingUrl ?? null,
        recordingUrl: input.recordingUrl ?? null,
        status: input.status,
        timezone: input.timezone ?? "America/New_York",
        recurrenceRule: input.recurrenceRule ?? null,
        recurrenceDaysOfWeek: input.recurrenceDaysOfWeek ?? null,
        recurrenceEndDate: input.recurrenceEndDate ? new Date(input.recurrenceEndDate) : null,
        recurrenceOccurrenceCount: input.recurrenceOccurrenceCount ?? null,
      }).$returningId();

      // Notify enrolled students if requested
      if (input.notifyStudents && input.status === "published") {
        try {
          const [course] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
          const enrolledUsers = await db
            .select({ email: users.email, name: users.name })
            .from(lmsEnrollments)
            .innerJoin(users, eq(users.id, lmsEnrollments.userId))
            .where(eq(lmsEnrollments.courseId, input.courseId));
          const sessionDateStr = new Date(input.sessionDate).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "America/New_York" });
          for (const u of enrolledUsers) {
            if (!u.email) continue;
            await sendEmail({
              to: u.email,
              subject: `New Live Session: ${input.title} — ${course?.title ?? "Your Course"}`,
              html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
                <h2 style="color:#0e4a50;">New Live Session Added</h2>
                <p>Hi ${u.name ?? "there"},</p>
                <p>A new live session has been scheduled for <strong>${course?.title ?? "your cohort course"}</strong>:</p>
                <table style="border-collapse:collapse;width:100%;margin:16px 0;">
                  <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:600;border:1px solid #d1fae5;">Session</td><td style="padding:8px 12px;border:1px solid #d1fae5;">${input.title}</td></tr>
                  <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:600;border:1px solid #d1fae5;">Date &amp; Time</td><td style="padding:8px 12px;border:1px solid #d1fae5;">${sessionDateStr} ET</td></tr>
                  <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:600;border:1px solid #d1fae5;">Duration</td><td style="padding:8px 12px;border:1px solid #d1fae5;">${input.durationMinutes} minutes</td></tr>
                  ${input.meetingUrl ? `<tr><td style="padding:8px 12px;background:#f0fafa;font-weight:600;border:1px solid #d1fae5;">Join Link</td><td style="padding:8px 12px;border:1px solid #d1fae5;"><a href="${input.meetingUrl}" style="color:#0d9488;">Click to join</a></td></tr>` : ""}
                </table>
                ${input.description ? `<p style="color:#475569;">${input.description}</p>` : ""}
                <p><a href="https://members.allaboutultrasound.com/cohort/${input.courseId}" style="display:inline-block;padding:10px 20px;background:#0d9488;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">View Your Schedule</a></p>
                <p style="color:#94a3b8;font-size:12px;">All About Ultrasound™</p>
              </div>`,
            });
          }
        } catch (e) {
          console.error("[cohortSession] Failed to send student notifications:", e);
        }
      }

      return { id: result.id };
    }),

  updateCohortSession: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().nullable().optional(),
      sessionDate: z.string().optional(),
      durationMinutes: z.number().int().min(1).optional(),
      meetingUrl: z.string().nullable().optional(),
      recordingUrl: z.string().nullable().optional(),
      status: z.enum(["draft", "published", "cancelled"]).optional(),
      timezone: z.string().optional(),
      recurrenceRule: z.enum(["weekly", "biweekly", "monthly"]).nullable().optional(),
      recurrenceDaysOfWeek: z.string().nullable().optional(),
      recurrenceEndDate: z.string().nullable().optional(),
      recurrenceOccurrenceCount: z.number().int().min(1).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, sessionDate, recurrenceEndDate, ...rest } = input;
      const updates: Record<string, any> = { ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) };
      if (sessionDate) updates.sessionDate = new Date(sessionDate);
      if (recurrenceEndDate !== undefined) updates.recurrenceEndDate = recurrenceEndDate ? new Date(recurrenceEndDate) : null;
      if (Object.keys(updates).length > 0) {
        await db.update(lmsCohortSessions).set(updates).where(eq(lmsCohortSessions.id, id));
      }
      return { success: true };
    }),

  deleteCohortSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCohortSessions).where(eq(lmsCohortSessions.id, input.id));
      return { success: true };
    }),

  // ── Cohort Assignments ──
  listCohortAssignments: protectedProcedure
    .input(z.object({ courseId: z.number(), cohortGroupId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const whereClause = input.cohortGroupId
        ? and(eq(lmsCohortAssignments.courseId, input.courseId), eq(lmsCohortAssignments.cohortGroupId, input.cohortGroupId))
        : eq(lmsCohortAssignments.courseId, input.courseId);
      const assignments = await db.select().from(lmsCohortAssignments)
        .where(whereClause)
        .orderBy(asc(lmsCohortAssignments.position), asc(lmsCohortAssignments.createdAt));
      return assignments;
    }),

  // Returns assignments from ALL cohort courses for the copy-from picker
  listAssignmentsForCopy: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get all cohort courses with their assignments
      const cohortCourses = await db.select({ id: lmsCourses.id, title: lmsCourses.title })
        .from(lmsCourses)
        .where(eq(lmsCourses.type, 'cohort'))
        .orderBy(asc(lmsCourses.title));
      const allAssignments = await db.select().from(lmsCohortAssignments)
        .orderBy(asc(lmsCohortAssignments.courseId), asc(lmsCohortAssignments.position), asc(lmsCohortAssignments.createdAt));
      // Group by course
      return cohortCourses.map(course => ({
        courseId: course.id,
        courseTitle: course.title,
        assignments: allAssignments.filter(a => a.courseId === course.id),
      })).filter(c => c.assignments.length > 0);
    }),

  createCohortAssignment: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      cohortGroupId: z.number().optional(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      contentBlocks: z.array(z.any()).optional(),
      dueDate: z.string().nullable().optional(),
      maxPoints: z.number().int().min(0).default(100),
      submissionType: z.enum(["text", "file", "url", "none"]).default("none"),
      status: z.enum(["draft", "published"]).default("draft"),
      notifyStudents: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [{ maxPos }] = await db.select({ maxPos: sql<number>`COALESCE(MAX(position),0)` })
        .from(lmsCohortAssignments).where(eq(lmsCohortAssignments.courseId, input.courseId));
      const [result] = await db.insert(lmsCohortAssignments).values({
        courseId: input.courseId,
        cohortGroupId: input.cohortGroupId ?? null,
        title: input.title,
        description: input.description ?? null,
        contentBlocks: input.contentBlocks ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        maxPoints: input.maxPoints,
        submissionType: input.submissionType,
        status: input.status,
        position: Number(maxPos) + 1,
      }).$returningId();

      // Notify enrolled students if requested
      if (input.notifyStudents && input.status === "published") {
        try {
          const [course] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
          const enrolledUsers = await db
            .select({ email: users.email, name: users.name })
            .from(lmsEnrollments)
            .innerJoin(users, eq(users.id, lmsEnrollments.userId))
            .where(eq(lmsEnrollments.courseId, input.courseId));
          const dueDateStr = input.dueDate ? new Date(input.dueDate).toLocaleDateString("en-US", { dateStyle: "full", timeZone: "America/New_York" }) : "No due date";
          for (const u of enrolledUsers) {
            if (!u.email) continue;
            await sendEmail({
              to: u.email,
              subject: `New Assignment: ${input.title} — ${course?.title ?? "Your Course"}`,
              html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
                <h2 style="color:#0e4a50;">New Assignment Posted</h2>
                <p>Hi ${u.name ?? "there"},</p>
                <p>A new assignment has been posted for <strong>${course?.title ?? "your cohort course"}</strong>:</p>
                <table style="border-collapse:collapse;width:100%;margin:16px 0;">
                  <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:600;border:1px solid #d1fae5;">Assignment</td><td style="padding:8px 12px;border:1px solid #d1fae5;">${input.title}</td></tr>
                  <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:600;border:1px solid #d1fae5;">Due Date</td><td style="padding:8px 12px;border:1px solid #d1fae5;">${dueDateStr}</td></tr>
                  <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:600;border:1px solid #d1fae5;">Points</td><td style="padding:8px 12px;border:1px solid #d1fae5;">${input.maxPoints}</td></tr>
                  <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:600;border:1px solid #d1fae5;">Submission</td><td style="padding:8px 12px;border:1px solid #d1fae5;">${input.submissionType}</td></tr>
                </table>
                ${input.description ? `<p style="color:#475569;">${input.description}</p>` : ""}
                <p><a href="https://members.allaboutultrasound.com/cohort/${input.courseId}" style="display:inline-block;padding:10px 20px;background:#0d9488;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">View Assignments</a></p>
                <p style="color:#94a3b8;font-size:12px;">All About Ultrasound™</p>
              </div>`,
            });
          }
        } catch (e) {
          console.error("[cohortAssignment] Failed to send student notifications:", e);
        }
      }

      return { id: result.id };
    }),

  updateCohortAssignment: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().nullable().optional(),
      contentBlocks: z.array(z.any()).nullable().optional(),
      dueDate: z.string().nullable().optional(),
      maxPoints: z.number().int().min(0).optional(),
      submissionType: z.enum(["text", "file", "url", "none"]).optional(),
      status: z.enum(["draft", "published"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, dueDate, ...rest } = input;
      const updates: Record<string, any> = { ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) };
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (Object.keys(updates).length > 0) {
        await db.update(lmsCohortAssignments).set(updates).where(eq(lmsCohortAssignments.id, id));
      }
      return { success: true };
    }),

  deleteCohortAssignment: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCohortAssignments).where(eq(lmsCohortAssignments.id, input.id));
      return { success: true };
    }),

  // ── Cohort Recordings (Admin) ────────────────────────────────────────────────────
  listCohortRecordings: protectedProcedure
    .input(z.object({ courseId: z.number(), cohortGroupId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const whereClause = input.cohortGroupId
        ? and(eq(lmsCohortRecordings.courseId, input.courseId), eq(lmsCohortRecordings.cohortGroupId, input.cohortGroupId))
        : eq(lmsCohortRecordings.courseId, input.courseId);
      return db.select().from(lmsCohortRecordings)
        .where(whereClause)
        .orderBy(asc(lmsCohortRecordings.position), asc(lmsCohortRecordings.createdAt));
    }),

  createCohortRecording: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      cohortGroupId: z.number().optional(),
      sessionId: z.number().nullable().optional(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      durationSeconds: z.number().int().min(0).optional(),
      status: z.enum(["draft", "published"]).default("draft"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [{ maxPos }] = await db.select({ maxPos: sql<number>`COALESCE(MAX(position),0)` })
        .from(lmsCohortRecordings).where(eq(lmsCohortRecordings.courseId, input.courseId));
      const [result] = await db.insert(lmsCohortRecordings).values({
        courseId: input.courseId,
        cohortGroupId: input.cohortGroupId ?? null,
        sessionId: input.sessionId ?? null,
        title: input.title,
        description: input.description ?? null,
        videoUrl: input.videoUrl ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        durationSeconds: input.durationSeconds ?? null,
        status: input.status,
        position: Number(maxPos) + 1,
      }).$returningId();
      return { id: result.id };
    }),

  updateCohortRecording: protectedProcedure
    .input(z.object({
      id: z.number(),
      sessionId: z.number().nullable().optional(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().nullable().optional(),
      videoUrl: z.string().nullable().optional(),
      thumbnailUrl: z.string().nullable().optional(),
      durationSeconds: z.number().int().min(0).nullable().optional(),
      status: z.enum(["draft", "published"]).optional(),
      position: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      const updates = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      if (Object.keys(updates).length > 0) {
        await db.update(lmsCohortRecordings).set(updates).where(eq(lmsCohortRecordings.id, id));
      }
      return { success: true };
    }),

  deleteCohortRecording: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCohortRecordings).where(eq(lmsCohortRecordings.id, input.id));
      return { success: true };
    }),

  // ── Cohort Resources ───────────────────────────────────────────────────────────
  listCohortResources: protectedProcedure
    .input(z.object({ courseId: z.number(), cohortGroupId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const whereClause = input.cohortGroupId
        ? and(
            eq(lmsCohortResources.courseId, input.courseId),
            or(isNull(lmsCohortResources.cohortGroupId), eq(lmsCohortResources.cohortGroupId, input.cohortGroupId)),
          )
        : eq(lmsCohortResources.courseId, input.courseId);
      const rows = await db
        .select()
        .from(lmsCohortResources)
        .where(whereClause)
        .orderBy(asc(lmsCohortResources.position), asc(lmsCohortResources.createdAt));
      return enrichCohortResources(db, rows);
    }),

  listDownloadsForCohortResource: protectedProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({ id: digitalProducts.id, title: digitalProducts.title, slug: digitalProducts.slug })
        .from(digitalProducts)
        .where(eq(digitalProducts.status, "published"))
        .orderBy(asc(digitalProducts.title))
        .limit(100);
      if (!input?.search?.trim()) return rows;
      const q = input.search.trim().toLowerCase();
      return rows.filter((r) => r.title.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
    }),

  createCohortResource: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      scope: z.enum(["course", "cohort"]),
      cohortGroupId: z.number().optional(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      cardImageUrl: z.string().optional(),
      actionType: z.enum(["link", "download"]),
      linkUrl: z.string().optional(),
      downloadSource: z.enum(["upload", "media_repo", "download_product"]).optional(),
      fileUrl: z.string().optional(),
      fileKey: z.string().optional(),
      fileName: z.string().optional(),
      mediaAssetId: z.number().optional(),
      downloadProductId: z.number().optional(),
      status: z.enum(["draft", "published"]).default("draft"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.actionType === "link" && !input.linkUrl?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Link URL is required for link resources" });
      }
      if (input.actionType === "download") {
        if (!input.downloadSource) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Download source is required" });
        }
        if (input.downloadSource === "upload" && !input.fileUrl?.trim()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a file or provide a file URL" });
        }
        if (input.downloadSource === "media_repo" && !input.mediaAssetId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Select a media repository file" });
        }
        if (input.downloadSource === "download_product" && !input.downloadProductId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Select a download product" });
        }
      }
      if (input.scope === "cohort" && !input.cohortGroupId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cohort group is required for cohort-only resources" });
      }
      const [{ maxPos }] = await db
        .select({ maxPos: sql<number>`COALESCE(MAX(position),0)` })
        .from(lmsCohortResources)
        .where(eq(lmsCohortResources.courseId, input.courseId));
      const [result] = await db.insert(lmsCohortResources).values({
        courseId: input.courseId,
        cohortGroupId: input.scope === "cohort" ? (input.cohortGroupId ?? null) : null,
        title: input.title.trim(),
        description: input.description ?? null,
        cardImageUrl: input.cardImageUrl ?? null,
        actionType: input.actionType,
        linkUrl: input.actionType === "link" ? input.linkUrl!.trim() : null,
        downloadSource: input.actionType === "download" ? input.downloadSource! : null,
        fileUrl: input.downloadSource === "upload" ? (input.fileUrl ?? null) : null,
        fileKey: input.downloadSource === "upload" ? (input.fileKey ?? null) : null,
        fileName: input.downloadSource === "upload" ? (input.fileName ?? null) : null,
        mediaAssetId: input.downloadSource === "media_repo" ? (input.mediaAssetId ?? null) : null,
        downloadProductId: input.downloadSource === "download_product" ? (input.downloadProductId ?? null) : null,
        status: input.status,
        position: Number(maxPos) + 1,
      }).$returningId();
      return { id: result.id };
    }),

  updateCohortResource: protectedProcedure
    .input(z.object({
      id: z.number(),
      scope: z.enum(["course", "cohort"]).optional(),
      cohortGroupId: z.number().nullable().optional(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().nullable().optional(),
      cardImageUrl: z.string().nullable().optional(),
      actionType: z.enum(["link", "download"]).optional(),
      linkUrl: z.string().nullable().optional(),
      downloadSource: z.enum(["upload", "media_repo", "download_product"]).nullable().optional(),
      fileUrl: z.string().nullable().optional(),
      fileKey: z.string().nullable().optional(),
      fileName: z.string().nullable().optional(),
      mediaAssetId: z.number().nullable().optional(),
      downloadProductId: z.number().nullable().optional(),
      status: z.enum(["draft", "published"]).optional(),
      position: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, scope, cohortGroupId, ...rest } = input;
      const updates: Record<string, unknown> = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      );
      if (scope !== undefined) {
        updates.cohortGroupId = scope === "cohort" ? (cohortGroupId ?? null) : null;
      } else if (cohortGroupId !== undefined) {
        updates.cohortGroupId = cohortGroupId;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(lmsCohortResources).set(updates).where(eq(lmsCohortResources.id, id));
      }
      return { success: true };
    }),

  deleteCohortResource: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCohortResources).where(eq(lmsCohortResources.id, input.id));
      return { success: true };
    }),

  // ── Recurring Session Expansion ──────────────────────────────────────────────────
  /** Expand a recurring parent session into individual child session rows */
  expandRecurringSessions: protectedProcedure
    .input(z.object({ parentSessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [parent] = await db.select().from(lmsCohortSessions)
        .where(eq(lmsCohortSessions.id, input.parentSessionId)).limit(1);
      if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (!parent.recurrenceRule) throw new TRPCError({ code: "BAD_REQUEST", message: "Session has no recurrence rule" });
      if (!parent.recurrenceEndDate && !parent.recurrenceOccurrenceCount)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Recurrence end date or occurrence count is required" });

      // Delete existing child instances first (re-expand)
      await db.delete(lmsCohortSessions)
        .where(eq(lmsCohortSessions.parentSessionId, input.parentSessionId));

      // Parse allowed days of week (0=Sun … 6=Sat). Empty = use same day as parent.
      const allowedDays: number[] = parent.recurrenceDaysOfWeek
        ? parent.recurrenceDaysOfWeek.split(",").map(Number).filter(n => !isNaN(n))
        : [];

      const weekIntervalDays = parent.recurrenceRule === "biweekly" ? 14 : 7;

      const instances: typeof lmsCohortSessions.$inferInsert[] = [];
      const parentDate = new Date(parent.sessionDate);
      const endDate = parent.recurrenceEndDate ? new Date(parent.recurrenceEndDate) : null;
      const maxCount = parent.recurrenceOccurrenceCount ?? 999;
      let occurrenceNum = 1;

      if (parent.recurrenceRule === "monthly") {
        // Monthly: advance month-by-month from parent date
        let current = new Date(parentDate);
        while (occurrenceNum < maxCount) {
          current = new Date(current);
          current.setMonth(current.getMonth() + 1);
          if (endDate && current > endDate) break;
          occurrenceNum++;
          instances.push({
            courseId: parent.courseId,
            cohortGroupId: parent.cohortGroupId,
            title: `${parent.title} (${occurrenceNum})`,
            description: parent.description,
            sessionDate: new Date(current),
            durationMinutes: parent.durationMinutes,
            meetingUrl: parent.meetingUrl,
            recordingUrl: null,
            status: parent.status,
            timezone: parent.timezone ?? "America/New_York",
            recurrenceRule: null,
            recurrenceDaysOfWeek: null,
            recurrenceInterval: null,
            recurrenceEndDate: null,
            recurrenceOccurrenceCount: null,
            parentSessionId: parent.id,
          });
        }
      } else if (allowedDays.length >= 1) {
        // Weekly/biweekly with one or more days selected:
        // For each week cycle, emit one instance per selected day (sorted), preserving the
        // parent's time-of-day. Start from the Sunday of the parent's week.
        // IMPORTANT: Use timezone-aware day/time to avoid UTC offset bugs (e.g. 7:30 PM ET
        // is stored as next-day UTC, causing getDay() to return the wrong weekday).
        const tz = parent.timezone ?? "America/New_York";
        const tzParts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          weekday: "short",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: false,
        }).formatToParts(parentDate);
        const tzWeekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const tzWeekdayStr = tzParts.find(p => p.type === "weekday")?.value ?? "";
        const parentDay = tzWeekdayMap[tzWeekdayStr] ?? parentDate.getDay();
        // Get local time components in the session timezone
        const tzTimeParts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: false,
        }).formatToParts(parentDate);
        const getTimePart = (type: string) => parseInt(tzTimeParts.find(p => p.type === type)?.value ?? "0", 10);
        // hour12:false can return 24 for midnight — normalize to 0
        const tzH = getTimePart("hour") % 24;
        const tzM = getTimePart("minute");
        const tzS = getTimePart("second");
        // Build weekStart as the Sunday of the parent's local week, expressed as a
        // UTC-midnight date (we'll set local time via toLocaleString trick below).
        // Strategy: find the calendar date of Sunday in the parent's local week, then
        // build ISO date strings to avoid any UTC shift.
        const parentLocalDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(parentDate);
        // parentLocalDateStr is "YYYY-MM-DD" in the session timezone
        const [pyStr, pmStr, pdStr] = parentLocalDateStr.split("-");
        const py = parseInt(pyStr, 10), pm = parseInt(pmStr, 10) - 1, pd = parseInt(pdStr, 10);
        // weekStart = Sunday of this local week (UTC midnight of that calendar date)
        const weekStartUTCMidnight = new Date(Date.UTC(py, pm, pd - parentDay));
        const weekStart = weekStartUTCMidnight;
        // Helper: build a candidate Date for a given weekday offset from weekStart,
        // at the session's local time in the session timezone.
        function buildCandidate(daysFromWeekStart: number): Date {
          // Compute the target calendar date (UTC midnight)
          const targetUTCMidnight = new Date(weekStart.getTime() + daysFromWeekStart * 24 * 60 * 60 * 1000);
          const [tpyStr, tpmStr, tpdStr] = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(targetUTCMidnight).split("-");
          // Build the ISO string in the target timezone and parse it
          const isoStr = `${tpyStr}-${tpmStr}-${tpdStr}T${String(tzH).padStart(2,"0")}:${String(tzM).padStart(2,"0")}:${String(tzS).padStart(2,"0")}`;
          // Parse as local time in the target timezone using a trick:
          // We want the UTC instant that corresponds to isoStr in `tz`.
          // Use Date.parse with explicit offset via Intl or just use a UTC-offset approach.
          // Simplest reliable method: find the UTC offset for that date/time in the timezone.
          const approxUtc = new Date(isoStr + "Z"); // treat as UTC first
          // Get the offset by checking what local time that UTC instant gives in tz
          const checkStr = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
          }).format(approxUtc);
          // checkStr is like "2027-01-07, 00:30:00" — compare with isoStr to find offset
          const checkParts = checkStr.replace(", ", "T");
          const diffMs = approxUtc.getTime() - new Date(checkParts + "Z").getTime();
          return new Date(approxUtc.getTime() + diffMs);
        }
        const parentTime = { h: tzH, m: tzM, s: tzS }; // kept for reference, unused below
        const sortedDays = [...allowedDays].sort((a, b) => a - b);
        // Extend end date by 1 day to be inclusive (end date is typically set to midnight UTC
        // but sessions are at a specific time, so we need to include the end date's day)
        const inclusiveEndDate = endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : null;
        let weekOffset = 0;
        let done = false;
        while (!done && occurrenceNum < maxCount) {
          for (const dayOfWeek of sortedDays) {
            const daysFromWeekStart = weekOffset * weekIntervalDays + dayOfWeek;
            const candidate = buildCandidate(daysFromWeekStart);
            // Skip dates on or before the parent session date
            if (candidate <= parentDate) continue;
            if (inclusiveEndDate && candidate >= inclusiveEndDate) { done = true; break; }
            if (occurrenceNum >= maxCount) { done = true; break; }
            occurrenceNum++;
            instances.push({
              courseId: parent.courseId,
              cohortGroupId: parent.cohortGroupId,
              title: `${parent.title} (${occurrenceNum})`,
              description: parent.description,
              sessionDate: new Date(candidate),
              durationMinutes: parent.durationMinutes,
              meetingUrl: parent.meetingUrl,
              recordingUrl: null,
              status: parent.status,
              timezone: parent.timezone ?? "America/New_York",
              recurrenceRule: null,
              recurrenceDaysOfWeek: null,
              recurrenceInterval: null,
              recurrenceEndDate: null,
              recurrenceOccurrenceCount: null,
              parentSessionId: parent.id,
            });
          }
          weekOffset++;
          if (weekOffset > 520) break; // hard cap: 10 years of weekly
        }
      } else {
        // Weekly/biweekly with no day specified — same day as parent
        let current = new Date(parentDate);
        while (occurrenceNum < maxCount) {
          current = new Date(current.getTime() + weekIntervalDays * 24 * 60 * 60 * 1000);
          if (endDate && current > endDate) break;
          occurrenceNum++;
          instances.push({
            courseId: parent.courseId,
            cohortGroupId: parent.cohortGroupId,
            title: `${parent.title} (${occurrenceNum})`,
            description: parent.description,
            sessionDate: new Date(current),
            durationMinutes: parent.durationMinutes,
            meetingUrl: parent.meetingUrl,
            recordingUrl: null,
            status: parent.status,
            timezone: parent.timezone ?? "America/New_York",
            recurrenceRule: null,
            recurrenceDaysOfWeek: null,
            recurrenceInterval: null,
            recurrenceEndDate: null,
            recurrenceOccurrenceCount: null,
            parentSessionId: parent.id,
          });
        }
      }

      if (instances.length === 0) return { created: 0 };
      await db.insert(lmsCohortSessions).values(instances);
      return { created: instances.length };
    }),

  // ── Duplicate Session ─────────────────────────────────────────────────────────
  /** Duplicate a session (copy all fields, reset recording URL, set status to draft) */
  duplicateCohortSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [src] = await db.select().from(lmsCohortSessions)
        .where(eq(lmsCohortSessions.id, input.id)).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = src;
      const [result] = await db.insert(lmsCohortSessions).values({
        ...rest,
        title: `${rest.title} (Copy)`,
        recordingUrl: null,
        status: "draft",
        parentSessionId: null,
      }).$returningId();
      return { id: result.id };
    }),

  // ── ICS Calendar Export ───────────────────────────────────────────────────────
  /** Return all published sessions for a cohort as an ICS calendar string */
  getCohortSessionsIcs: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ title: lmsCourses.title })
        .from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      const sessions = await db.select().from(lmsCohortSessions)
        .where(and(eq(lmsCohortSessions.courseId, input.courseId), eq(lmsCohortSessions.status, "published")))
        .orderBy(asc(lmsCohortSessions.sessionDate));

      const formatIcsDate = (d: Date) =>
        d.toISOString().replace(/[-:]/g, "").replace(".000", "");

      const escIcs = (s: string) => s.replace(/[\\;,]/g, c => `\\${c}`).replace(/\n/g, "\\n");

      const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AllAboutUltrasound//CohortSchedule//EN",
        `X-WR-CALNAME:${escIcs(course?.title ?? "Cohort Schedule")}`,
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
      ];

      for (const s of sessions) {
        const start = new Date(s.sessionDate);
        const end = new Date(start.getTime() + (s.durationMinutes ?? 60) * 60 * 1000);
        lines.push(
          "BEGIN:VEVENT",
          `UID:cohort-session-${s.id}@allaboutultrasound.com`,
          `DTSTAMP:${formatIcsDate(new Date())}`,
          `DTSTART:${formatIcsDate(start)}`,
          `DTEND:${formatIcsDate(end)}`,
          `SUMMARY:${escIcs(s.title)}`,
          s.description ? `DESCRIPTION:${escIcs(s.description)}` : "",
          s.meetingUrl ? `URL:${s.meetingUrl}` : "",
          s.timezone ? `TZID:${s.timezone}` : "",
          "END:VEVENT",
        ).filter(Boolean);
      }

      lines.push("END:VCALENDAR");
      return { ics: lines.join("\r\n"), courseTitle: course?.title ?? "Cohort" };
    }),

  // ── Cohort Submissions (Admin view) ──────────────────────────────────────────────
  listCohortSubmissions: protectedProcedure
    .input(z.object({ assignmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const subs = await db
        .select({ sub: lmsCohortSubmissions, userName: users.name, userEmail: users.email })
        .from(lmsCohortSubmissions)
        .innerJoin(users, eq(users.id, lmsCohortSubmissions.userId))
        .where(eq(lmsCohortSubmissions.assignmentId, input.assignmentId));
      return subs.map(r => ({ ...r.sub, userName: r.userName, userEmail: r.userEmail }));
    }),

  gradeCohortSubmission: protectedProcedure
    .input(z.object({
      submissionId: z.number(),
      grade: z.number().min(0).nullable().optional(),
      feedback: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsCohortSubmissions).set({
        grade: input.grade != null ? String(input.grade) : null,
        feedback: input.feedback ?? null,
        status: "graded",
        gradedAt: Date.now(),
        gradedBy: ctx.user.id,
      }).where(eq(lmsCohortSubmissions.id, input.submissionId));
      return { success: true };
    }),

  /** Get a single assignment with its content blocks (admin or enrolled student) */
  getAssignmentDetail: protectedProcedure
    .input(z.object({ assignmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [assignment] = await db.select().from(lmsCohortAssignments)
        .where(eq(lmsCohortAssignments.id, input.assignmentId)).limit(1);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
      // Verify access: admin or enrolled
      if (ctx.user.role !== "admin") {
        const [enrollment] = await db.select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, assignment.courseId)))
          .limit(1);
        if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled in this cohort" });
        if (assignment.status !== "published") throw new TRPCError({ code: "NOT_FOUND" });
      }
      // Get the user's own submission if any
      const [mySubmission] = await db.select().from(lmsCohortSubmissions)
        .where(and(eq(lmsCohortSubmissions.assignmentId, input.assignmentId), eq(lmsCohortSubmissions.userId, ctx.user.id)))
        .limit(1);
      return { assignment, mySubmission: mySubmission ?? null };
    }),

  /** Upload a file for a media upload block (non-assignment context) */
  recordMediaUploadResponse: protectedProcedure
    .input(z.object({
      blockId: z.string().optional(),
      pageId: z.string().optional(),
      pageType: z.string().optional(),
      folderName: z.string().optional(),
      fileUrl: z.string(),
      fileKey: z.string(),
      fileName: z.string().optional(),
      mimeType: z.string().optional(),
      fileSize: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let folderId: number | null = null;
      if (input.folderName) {
        // Find or create folder
        const [existing] = await db.select({ id: mediaUploadFolders.id })
          .from(mediaUploadFolders).where(eq(mediaUploadFolders.name, input.folderName)).limit(1);
        if (existing) {
          folderId = existing.id;
        } else {
          const [res] = await db.insert(mediaUploadFolders).values({
            name: input.folderName,
            createdBy: ctx.user.id,
            createdAt: Date.now(),
          }).$returningId();
          folderId = res.id;
        }
      }
      const [res] = await db.insert(mediaUploadResponses).values({
        userId: ctx.user.id,
        blockId: input.blockId ?? null,
        pageId: input.pageId ?? null,
        pageType: input.pageType ?? null,
        folderId,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        fileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        fileSize: input.fileSize ?? null,
        createdAt: Date.now(),
      }).$returningId();
      return { id: res.id, folderId };
    }),

  /** Admin: list all media upload responses (optionally filtered by folder/page) */
  listMediaUploadResponses: protectedProcedure
    .input(z.object({
      folderId: z.number().optional(),
      pageId: z.string().optional(),
      pageType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [];
      if (input.folderId) conditions.push(eq(mediaUploadResponses.folderId, input.folderId));
      if (input.pageId) conditions.push(eq(mediaUploadResponses.pageId, input.pageId));
      if (input.pageType) conditions.push(eq(mediaUploadResponses.pageType, input.pageType));
      const rows = await db
        .select({ resp: mediaUploadResponses, userName: users.name, userEmail: users.email })
        .from(mediaUploadResponses)
        .innerJoin(users, eq(users.id, mediaUploadResponses.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return rows.map(r => ({ ...r.resp, userName: r.userName, userEmail: r.userEmail }));
    }),

  /** Admin: list all media upload folders */
  listMediaUploadFolders: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(mediaUploadFolders);
    }),

  // ── Cohort Groups ──────────────────────────────────────────────────────────

  /** List all cohort groups for a cohort course */
  listCohortGroups: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const groups = await db
        .select()
        .from(lmsCohortGroups)
        .where(eq(lmsCohortGroups.courseId, input.courseId))
        .orderBy(asc(lmsCohortGroups.sortOrder), asc(lmsCohortGroups.createdAt));
      const counts = await db
        .select({ cohortGroupId: lmsCohortGroupEnrollments.cohortGroupId, count: sql<number>`count(*)` })
        .from(lmsCohortGroupEnrollments)
        .innerJoin(users, eq(users.id, lmsCohortGroupEnrollments.userId))
        .where(and(
          eq(lmsCohortGroupEnrollments.courseId, input.courseId),
          sql`${users.name} NOT LIKE '[Merged into #%'`,  // exclude merged placeholder accounts from count
        ))
        .groupBy(lmsCohortGroupEnrollments.cohortGroupId);
      const countMap = Object.fromEntries(counts.map(c => [c.cohortGroupId, c.count]));
      return groups.map(g => ({ ...g, studentCount: countMap[g.id] ?? 0 }));
    }),

  /** Create a new cohort group */
  createCohortGroup: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      name: z.string().min(1).max(255),
      slug: z.string().min(1).max(255),
      description: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      enrollmentCloseDate: z.string().optional(),
      maxStudents: z.number().optional(),
      status: z.enum(["draft", "open", "active", "completed", "archived"]).default("draft"),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { courseId, name, slug, description, startDate, endDate, enrollmentCloseDate, maxStudents, status, sortOrder } = input;
      const [result] = await db.insert(lmsCohortGroups).values({
        courseId, name, slug, description,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        enrollmentCloseDate: enrollmentCloseDate ? new Date(enrollmentCloseDate) : undefined,
        maxStudents, status, sortOrder,
      }).$returningId();
      return { id: result.id };
    }),

  /** Update a cohort group */
  updateCohortGroup: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      slug: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      enrollmentCloseDate: z.string().nullable().optional(),
      maxStudents: z.number().nullable().optional(),
      status: z.enum(["draft", "open", "active", "completed", "archived"]).optional(),
      sortOrder: z.number().optional(),
      accessDurationDays: z.number().int().min(1).nullable().optional(),
      pageBlocks: z.string().optional(),
      isFeaturedOnLanding: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, startDate, endDate, enrollmentCloseDate, ...rest } = input;
      const updateData: any = { ...rest };
      if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
      if (enrollmentCloseDate !== undefined) updateData.enrollmentCloseDate = enrollmentCloseDate ? new Date(enrollmentCloseDate) : null;
      if (input.isFeaturedOnLanding) {
        const [group] = await db.select({ courseId: lmsCohortGroups.courseId }).from(lmsCohortGroups).where(eq(lmsCohortGroups.id, id));
        if (group) await db.update(lmsCohortGroups).set({ isFeaturedOnLanding: false }).where(eq(lmsCohortGroups.courseId, group.courseId));
      }
      await db.update(lmsCohortGroups).set(updateData).where(eq(lmsCohortGroups.id, id));
      return { success: true };
    }),

  /** Delete a cohort group */
  deleteCohortGroup: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCohortGroupEnrollments).where(eq(lmsCohortGroupEnrollments.cohortGroupId, input.id));
      await db.delete(lmsCohortGroups).where(eq(lmsCohortGroups.id, input.id));
      return { success: true };
    }),

  /** List students in a specific cohort group */
  listCohortGroupStudents: protectedProcedure
    .input(z.object({ cohortGroupId: z.number(), search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          id: lmsCohortGroupEnrollments.id,
          userId: lmsCohortGroupEnrollments.userId,
          enrollmentId: lmsCohortGroupEnrollments.enrollmentId,
          joinedAt: lmsCohortGroupEnrollments.joinedAt,
          userName: users.name,
          userEmail: users.email,
          userAvatar: users.avatarUrl,
        })
        .from(lmsCohortGroupEnrollments)
        .innerJoin(users, eq(users.id, lmsCohortGroupEnrollments.userId))
        .where(and(
          eq(lmsCohortGroupEnrollments.cohortGroupId, input.cohortGroupId),
          sql`${users.name} NOT LIKE '[Merged into #%'`,  // exclude merged placeholder accounts
        ))
        .orderBy(asc(users.name));
      if (input.search) {
        const q = input.search.toLowerCase();
        return rows.filter(r => r.userName?.toLowerCase().includes(q) || r.userEmail?.toLowerCase().includes(q));
      }
      return rows;
    }),

  /** List students enrolled in a cohort course but NOT yet assigned to any group */
  listUnassignedCohortStudents: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const enrolled = await db
        .select({ userId: lmsEnrollments.userId, userName: users.name, userEmail: users.email, userAvatar: users.avatarUrl, enrollmentId: lmsEnrollments.id })
        .from(lmsEnrollments)
        .innerJoin(users, eq(users.id, lmsEnrollments.userId))
        .where(and(
          eq(lmsEnrollments.courseId, input.courseId),
          eq(lmsEnrollments.status, "active"),
          sql`${users.name} NOT LIKE '[Merged into #%'`,  // exclude merged placeholder accounts
        ));
      const assigned = await db
        .select({ userId: lmsCohortGroupEnrollments.userId })
        .from(lmsCohortGroupEnrollments)
        .where(eq(lmsCohortGroupEnrollments.courseId, input.courseId));
      const assignedIds = new Set(assigned.map(a => a.userId));
      return enrolled.filter(e => !assignedIds.has(e.userId));
    }),

  /** Assign a student to a cohort group (moves from any existing group) */
  assignStudentToCohortGroup: protectedProcedure
    .input(z.object({ cohortGroupId: z.number(), userId: z.number(), courseId: z.number(), sendWelcomeEmail: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, input.courseId)))
        .limit(1);
      await db.delete(lmsCohortGroupEnrollments)
        .where(and(eq(lmsCohortGroupEnrollments.userId, input.userId), eq(lmsCohortGroupEnrollments.courseId, input.courseId)));
      await db.insert(lmsCohortGroupEnrollments).values({
        cohortGroupId: input.cohortGroupId,
        enrollmentId: enrollment?.id ?? 0,
        userId: input.userId,
        courseId: input.courseId,
      });
      // Auto-send welcome email when assigning to cohort group (fire-and-forget)
      if (input.sendWelcomeEmail !== false) {
        (async () => {
          try {
            const [settings] = await db.select({ enrollmentEmailEnabled: platformSettings.enrollmentEmailEnabled, enrollmentEmailSubject: platformSettings.enrollmentEmailSubject, enrollmentEmailIntro: platformSettings.enrollmentEmailIntro }).from(platformSettings).limit(1);
            const platformEnabled = settings?.enrollmentEmailEnabled !== false;
            if (!platformEnabled) return;
            const [course] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug, sendEnrollmentEmail: lmsCourses.sendEnrollmentEmail }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
            if (!course?.sendEnrollmentEmail) return;
            const [user] = await db.select({ name: users.name, displayName: users.displayName, email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
            if (!user?.email) return;
            const accessToken = await getOrCreateAccessToken(input.userId);
            await sendEnrollmentEmail({
              to: { name: user.displayName || user.name || "Student", email: user.email },
              courseTitle: course.title,
              courseSlug: course.slug,
              customSubject: settings?.enrollmentEmailSubject,
              customIntro: settings?.enrollmentEmailIntro,
              accessToken,
            });
          } catch (e) {
            console.error("[cohort-welcome-email] Failed to send:", e);
          }
        })();
      }
      return { success: true };
    }),

  /** Remove a student from their cohort group */
  removeStudentFromCohortGroup: protectedProcedure
    .input(z.object({ cohortGroupId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCohortGroupEnrollments)
        .where(and(eq(lmsCohortGroupEnrollments.cohortGroupId, input.cohortGroupId), eq(lmsCohortGroupEnrollments.userId, input.userId)));
      return { success: true };
    }),

  /** Transfer a student from one cohort group to another */
  transferStudentToCohortGroup: protectedProcedure
    .input(z.object({
      fromGroupId: z.number(),
      toGroupId: z.number(),
      userId: z.number(),
      courseId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, input.courseId)))
        .limit(1);
      await db.delete(lmsCohortGroupEnrollments)
        .where(and(
          eq(lmsCohortGroupEnrollments.userId, input.userId),
          eq(lmsCohortGroupEnrollments.courseId, input.courseId),
        ));
      await db.insert(lmsCohortGroupEnrollments).values({
        cohortGroupId: input.toGroupId,
        enrollmentId: enrollment?.id ?? 0,
        userId: input.userId,
        courseId: input.courseId,
      });
      return { success: true };
    }),

  /** Get student activity in a cohort group (assignments + lesson progress) */
  getCohortStudentActivity: protectedProcedure
    .input(z.object({ cohortGroupId: z.number(), userId: z.number(), courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const assignments = await db
        .select()
        .from(lmsCohortAssignments)
        .where(and(
          eq(lmsCohortAssignments.courseId, input.courseId),
          eq(lmsCohortAssignments.cohortGroupId, input.cohortGroupId),
        ))
        .orderBy(asc(lmsCohortAssignments.dueDate));
      const submissions = assignments.length > 0
        ? await db.select().from(lmsCohortSubmissions)
            .where(and(
              eq(lmsCohortSubmissions.userId, input.userId),
              inArray(lmsCohortSubmissions.assignmentId, assignments.map(a => a.id)),
            ))
        : [];
      const submissionMap = Object.fromEntries(submissions.map(s => [s.assignmentId, s]));
      // Find the user's enrollment for this course to get progress
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, input.courseId)))
        .limit(1);
      const progress = enrollment
        ? await db
            .select({
              lessonId: lmsLessonProgress.lessonId,
              completedAt: lmsLessonProgress.completedAt,
              lessonTitle: lmsLessons.title,
              sectionTitle: sql<string>`COALESCE(${lmsSections.title}, 'Ungrouped')`,
            })
            .from(lmsLessonProgress)
            .innerJoin(lmsLessons, eq(lmsLessons.id, lmsLessonProgress.lessonId))
            .leftJoin(lmsSections, eq(lmsSections.id, lmsLessons.sectionId))
            .where(eq(lmsLessonProgress.enrollmentId, enrollment.id))
            .orderBy(asc(lmsLessons.position))
        : [];
      return {
        assignments: assignments.map(a => ({ ...a, submission: submissionMap[a.id] ?? null })),
        lessonProgress: progress,
      };
    }),

  // ── Cohort Messages ─────────────────────────────────────────────────────

  listCohortMessages: protectedProcedure
    .input(z.object({ cohortGroupId: z.number(), courseId: z.number(), limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          id: lmsCohortMessages.id,
          cohortGroupId: lmsCohortMessages.cohortGroupId,
          courseId: lmsCohortMessages.courseId,
          userId: lmsCohortMessages.userId,
          body: lmsCohortMessages.body,
          mediaUrls: lmsCohortMessages.mediaUrls,
          isAdminPost: lmsCohortMessages.isAdminPost,
          createdAt: lmsCohortMessages.createdAt,
          updatedAt: lmsCohortMessages.updatedAt,
          userName: users.name,
          userDisplayName: users.displayName,
          userEmail: users.email,
          userAvatar: users.avatarUrl,
        })
        .from(lmsCohortMessages)
        .innerJoin(users, eq(users.id, lmsCohortMessages.userId))
        .where(and(
          eq(lmsCohortMessages.cohortGroupId, input.cohortGroupId),
          eq(lmsCohortMessages.courseId, input.courseId),
        ))
        .orderBy(desc(lmsCohortMessages.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return rows.reverse();
    }),

  postCohortMessage: protectedProcedure
    .input(z.object({
      cohortGroupId: z.number(),
      courseId: z.number(),
      body: z.string().max(500000).optional(),
      mediaUrls: z.array(z.object({
        url: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!input.body && (!input.mediaUrls || input.mediaUrls.length === 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message must have body or media" });
      }
      const [result] = await db.insert(lmsCohortMessages).values({
        cohortGroupId: input.cohortGroupId,
        courseId: input.courseId,
        userId: ctx.user.id,
        body: input.body ?? null,
        mediaUrls: input.mediaUrls ?? null,
        isAdminPost: ctx.user.role === "admin",
      }).$returningId();
      return { id: result.id };
    }),

  deleteCohortMessage: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCohortMessages).where(eq(lmsCohortMessages.id, input.id));
      return { success: true };
    }),

  // ── Cohort Staff Management ──────────────────────────────────────────────────

  /** List cohort staff for a group */
  getCohortStaff: protectedProcedure
    .input(z.object({ cohortGroupId: z.number(), courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const staff = await db.select({
        id: lmsCohortStaff.id,
        cohortGroupId: lmsCohortStaff.cohortGroupId,
        courseId: lmsCohortStaff.courseId,
        userId: lmsCohortStaff.userId,
        role: lmsCohortStaff.role,
        canManageDiscussions: lmsCohortStaff.canManageDiscussions,
        canAddSessions: lmsCohortStaff.canAddSessions,
        canAddAssignments: lmsCohortStaff.canAddAssignments,
        canAddRecordings: lmsCohortStaff.canAddRecordings,
        userName: users.name,
        userEmail: users.email,
      })
        .from(lmsCohortStaff)
        .innerJoin(users, eq(users.id, lmsCohortStaff.userId))
        .where(and(
          eq(lmsCohortStaff.cohortGroupId, input.cohortGroupId),
          eq(lmsCohortStaff.courseId, input.courseId),
        ));
      return staff;
    }),

  /** Add or update a cohort staff member */
  upsertCohortStaff: protectedProcedure
    .input(z.object({
      cohortGroupId: z.number(),
      courseId: z.number(),
      userId: z.number(),
      role: z.enum(["admin", "moderator"]).default("moderator"),
      canManageDiscussions: z.boolean().default(true),
      canAddSessions: z.boolean().default(false),
      canAddAssignments: z.boolean().default(false),
      canAddRecordings: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(lmsCohortStaff).values({
        cohortGroupId: input.cohortGroupId,
        courseId: input.courseId,
        userId: input.userId,
        role: input.role,
        canManageDiscussions: input.canManageDiscussions,
        canAddSessions: input.canAddSessions,
        canAddAssignments: input.canAddAssignments,
        canAddRecordings: input.canAddRecordings,
      }).onDuplicateKeyUpdate({
        set: {
          role: input.role,
          canManageDiscussions: input.canManageDiscussions,
          canAddSessions: input.canAddSessions,
          canAddAssignments: input.canAddAssignments,
          canAddRecordings: input.canAddRecordings,
        },
      });
      return { success: true };
    }),

  /** Remove a cohort staff member */
  removeCohortStaff: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsCohortStaff).where(eq(lmsCohortStaff.id, input.id));
      return { success: true };
    }),

  // ── Discussion Moderation ─────────────────────────────────────────────────────

  /** Get all discussions for a course (admin view — all groups) */
  getCourseDiscussions: protectedProcedure
    .input(z.object({ courseId: z.number(), cohortGroupId: z.number().optional(), limit: z.number().default(100) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [
        eq(lmsCohortMessages.courseId, input.courseId),
        isNull(lmsCohortMessages.deletedAt),
      ];
      if (input.cohortGroupId) conditions.push(eq(lmsCohortMessages.cohortGroupId, input.cohortGroupId));
      const messages = await db.select({
        id: lmsCohortMessages.id,
        cohortGroupId: lmsCohortMessages.cohortGroupId,
        courseId: lmsCohortMessages.courseId,
        userId: lmsCohortMessages.userId,
        body: lmsCohortMessages.body,
        mediaUrls: lmsCohortMessages.mediaUrls,
        isAdminPost: lmsCohortMessages.isAdminPost,
        aliasId: lmsCohortMessages.aliasId,
        isPinned: lmsCohortMessages.isPinned,
        createdAt: lmsCohortMessages.createdAt,
        userName: users.name,
        userEmail: users.email,
        userAvatarUrl: users.avatarUrl,
      })
        .from(lmsCohortMessages)
        .innerJoin(users, eq(users.id, lmsCohortMessages.userId))
        .where(and(...conditions))
        .orderBy(desc(lmsCohortMessages.isPinned), desc(lmsCohortMessages.createdAt))
        .limit(input.limit);
      // Enrich with alias data
      const aliasIds = [...new Set(messages.filter(m => m.aliasId).map(m => m.aliasId as number))];
      let aliasMap: Record<number, { name: string; avatarUrl: string | null; email: string | null }> = {};
      if (aliasIds.length) {
        const aliases = await db.select({ id: postingAliases.id, name: postingAliases.name, avatarUrl: postingAliases.avatarUrl, email: postingAliases.email })
          .from(postingAliases).where(inArray(postingAliases.id, aliasIds));
        aliasMap = Object.fromEntries(aliases.map((a: any) => [a.id, a]));
      }
      return messages.map(m => ({
        ...m,
        displayName: m.aliasId && aliasMap[m.aliasId] ? aliasMap[m.aliasId].name : m.userName,
        displayAvatarUrl: m.aliasId && aliasMap[m.aliasId] ? aliasMap[m.aliasId].avatarUrl : m.userAvatarUrl,
        isAlias: !!m.aliasId,
      }));
    }),

  /** Pin or unpin a cohort message */
  pinCohortMessage: protectedProcedure
    .input(z.object({ id: z.number(), isPinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsCohortMessages)
        .set({ isPinned: input.isPinned })
        .where(eq(lmsCohortMessages.id, input.id));
      return { success: true };
    }),

  /** Soft-delete a cohort message (moderation) */
  moderateDeleteCohortMessage: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsCohortMessages)
        .set({ deletedAt: new Date() })
        .where(eq(lmsCohortMessages.id, input.id));
      return { success: true };
    }),

  /** Post a message as admin (from Discussions tab), optionally as a posting alias */
  postAdminCohortMessage: protectedProcedure
    .input(z.object({
      cohortGroupId: z.number(),
      courseId: z.number(),
      body: z.string().optional(),
      mediaUrls: z.array(z.object({ url: z.string(), mimeType: z.string(), fileName: z.string() })).optional(),
      /** Post as a global posting alias (admin only) */
      aliasId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsCohortMessages).values({
        cohortGroupId: input.cohortGroupId,
        courseId: input.courseId,
        userId: ctx.user.id,
        body: input.body ?? null,
        mediaUrls: input.mediaUrls ?? null,
        isAdminPost: true,
        aliasId: input.aliasId ?? null,
        isPinned: false,
      }).$returningId();
      return { id: result.id };
    }),

  /** Bulk assign multiple students to a cohort group */
  bulkAssignStudentsToCohortGroup: protectedProcedure
    .input(z.object({ cohortGroupId: z.number(), courseId: z.number(), userIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let assigned = 0;
      for (const userId of input.userIds) {
        const [enrollment] = await db.select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, input.courseId)))
          .limit(1);
        await db.delete(lmsCohortGroupEnrollments)
          .where(and(eq(lmsCohortGroupEnrollments.userId, userId), eq(lmsCohortGroupEnrollments.courseId, input.courseId)));
        await db.insert(lmsCohortGroupEnrollments).values({
          cohortGroupId: input.cohortGroupId,
          enrollmentId: enrollment?.id ?? 0,
          userId,
          courseId: input.courseId,
        });
        assigned++;
      }
      return { assigned };
    }),

  // ── Cohort Waitlist ──
  getWaitlistSettings: protectedProcedure
    .input(z.object({ cohortGroupId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [group] = await db.select({
        waitlistEnabled: lmsCohortGroups.waitlistEnabled,
        waitlistHeading: lmsCohortGroups.waitlistHeading,
        waitlistBody: lmsCohortGroups.waitlistBody,
        waitlistCtaLabel: lmsCohortGroups.waitlistCtaLabel,
        waitlistCtaUrl: lmsCohortGroups.waitlistCtaUrl,
        waitlistRedirectUrl: lmsCohortGroups.waitlistRedirectUrl,
        waitlistSuccessMessage: lmsCohortGroups.waitlistSuccessMessage,
      }).from(lmsCohortGroups).where(eq(lmsCohortGroups.id, input.cohortGroupId)).limit(1);
      return group ?? null;
    }),

  saveWaitlistSettings: protectedProcedure
    .input(z.object({
      cohortGroupId: z.number(),
      waitlistEnabled: z.boolean(),
      waitlistHeading: z.string().optional(),
      waitlistBody: z.string().optional(),
      waitlistCtaLabel: z.string().optional(),
      waitlistCtaUrl: z.string().optional(),
      waitlistRedirectUrl: z.string().optional(),
      waitlistSuccessMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { cohortGroupId, ...fields } = input;
      await db.update(lmsCohortGroups).set({
        waitlistEnabled: fields.waitlistEnabled,
        waitlistHeading: fields.waitlistHeading ?? null,
        waitlistBody: fields.waitlistBody ?? null,
        waitlistCtaLabel: fields.waitlistCtaLabel ?? null,
        waitlistCtaUrl: fields.waitlistCtaUrl ?? null,
        waitlistRedirectUrl: fields.waitlistRedirectUrl ?? null,
        waitlistSuccessMessage: fields.waitlistSuccessMessage ?? null,
      }).where(eq(lmsCohortGroups.id, cohortGroupId));
      return { success: true };
    }),

  getWaitlistEntries: protectedProcedure
    .input(z.object({ cohortGroupId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const entries = await db.select().from(cohortWaitlistEntries)
        .where(eq(cohortWaitlistEntries.cohortGroupId, input.cohortGroupId))
        .orderBy(desc(cohortWaitlistEntries.createdAt));
      return entries;
    }),
  // ── Course-Level Waitlist Settings ─────────────────────────────────────
  getCourseWaitlistSettings: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({
        waitlistEnabled: lmsCourses.waitlistEnabled,
        waitlistHeading: lmsCourses.waitlistHeading,
        waitlistBody: lmsCourses.waitlistBody,
        waitlistCtaLabel: lmsCourses.waitlistCtaLabel,
        waitlistCtaUrl: lmsCourses.waitlistCtaUrl,
        waitlistRedirectUrl: lmsCourses.waitlistRedirectUrl,
        waitlistSuccessMessage: lmsCourses.waitlistSuccessMessage,
      }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      return course ?? null;
    }),

  saveCourseWaitlistSettings: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      waitlistEnabled: z.boolean(),
      waitlistHeading: z.string().optional(),
      waitlistBody: z.string().optional(),
      waitlistCtaLabel: z.string().optional(),
      waitlistCtaUrl: z.string().optional(),
      waitlistRedirectUrl: z.string().optional(),
      waitlistSuccessMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { courseId, ...fields } = input;
      await db.update(lmsCourses).set({
        waitlistEnabled: fields.waitlistEnabled,
        waitlistHeading: fields.waitlistHeading ?? null,
        waitlistBody: fields.waitlistBody ?? null,
        waitlistCtaLabel: fields.waitlistCtaLabel ?? null,
        waitlistCtaUrl: fields.waitlistCtaUrl ?? null,
        waitlistRedirectUrl: fields.waitlistRedirectUrl ?? null,
        waitlistSuccessMessage: fields.waitlistSuccessMessage ?? null,
      } as any).where(eq(lmsCourses.id, courseId));
      return { success: true };
    }),

  getCourseWaitlistEntries: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const entries = await db.select().from(cohortWaitlistEntries)
        .where(eq(cohortWaitlistEntries.courseId, input.courseId))
        .orderBy(desc(cohortWaitlistEntries.createdAt));
      return entries;
    }),

  exportCourseWaitlistCsv: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const entries = await db.select().from(cohortWaitlistEntries)
        .where(eq(cohortWaitlistEntries.courseId, input.courseId))
        .orderBy(desc(cohortWaitlistEntries.createdAt));
      const header = "Name,Email,Phone,Message,Date";
      const rows = entries.map(e => [
        `"${(e.name || "").replace(/"/g, '""')}"`,
        `"${(e.email || "").replace(/"/g, '""')}"`,
        `"${(e.phone || "").replace(/"/g, '""')}"`,
        `"${(e.message || "").replace(/"/g, '""')}"`,
        `"${new Date(e.createdAt).toISOString()}"`,
      ].join(","));
      return { csv: [header, ...rows].join("\n") };
    }),

  /** Grant waitlist access: paid (Stripe checkout link) or free (direct enrollment) */
  grantCourseWaitlistAccess: protectedProcedure
    .input(z.object({
      entryId: z.number(),
      courseId: z.number(),
      accessType: z.enum(["free", "paid"]),
      priceOverrideCents: z.number().int().min(0).optional(),
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [entry] = await db.select().from(cohortWaitlistEntries)
        .where(eq(cohortWaitlistEntries.id, input.entryId)).limit(1);
      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Waitlist entry not found" });
      const [course] = await db.select().from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      // Find or create user
      let userId: number;
      const [existingUser] = await db.select({ id: users.id })
        .from(users).where(eq(users.email, entry.email)).limit(1);
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const [newUser] = await db.insert(users).values({
          email: entry.email,
          name: entry.name,
          role: "user" as any,
        }).$returningId();
        userId = newUser.id;
      }

      if (input.accessType === "free") {
        const [existing] = await db.select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, input.courseId)))
          .limit(1);
        if (!existing) {
          await db.insert(lmsEnrollments).values({ userId, courseId: input.courseId, enrollmentType: "full" });
        }
        await sendEnrollmentEmail({ userId, courseId: input.courseId, db });
        return { success: true, type: "free", message: `Free access granted and enrollment email sent to ${entry.email}` };
      } else {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
        const priceInCents = input.priceOverrideCents !== undefined
          ? input.priceOverrideCents
          : (course.price ?? 0);
        if (priceInCents === 0) {
          const [existing] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
            .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, input.courseId))).limit(1);
          if (!existing) {
            await db.insert(lmsEnrollments).values({ userId, courseId: input.courseId, enrollmentType: "full" });
          }
          await sendEnrollmentEmail({ userId, courseId: input.courseId, db });
          return { success: true, type: "free", message: `Zero-price access granted and enrollment email sent to ${entry.email}` };
        }
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: entry.email,
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: course.title },
              unit_amount: priceInCents,
            },
            quantity: 1,
          }],
          success_url: `${input.origin}/courses/${course.slug}?enrolled=1`,
          cancel_url: `${input.origin}/courses/${course.slug}`,
          metadata: {
            courseId: String(input.courseId),
            courseSlug: course.slug,
            waitlistEntryId: String(input.entryId),
            grantedByAdminId: String(ctx.user.id),
          },
          client_reference_id: String(userId),
          allow_promotion_codes: true,
        });
        await sendEmail({
          to: { name: entry.name, email: entry.email },
          subject: `Your spot in ${course.title} — Complete your enrollment`,
          htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#189aa1">You've been granted access to ${course.title}</h2>
            <p>Hi ${entry.name},</p>
            <p>Great news! You've been selected from the waitlist for <strong>${course.title}</strong>.</p>
            <p>Please complete your enrollment by clicking the button below:</p>
            <p style="text-align:center;margin:30px 0">
              <a href="${session.url}" style="background:#189aa1;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Complete Enrollment — $${(priceInCents / 100).toFixed(2)}</a>
            </p>
            <p style="color:#666;font-size:13px">This link is unique to you. If you have any questions, please reply to this email.</p>
          </div>`,
        });
        return { success: true, type: "paid", checkoutUrl: session.url, message: `Checkout link sent to ${entry.email}` };
      }
    }),

  // ── Cohort Group Landing Page Builder ─────────────────────────────────
  getCohortGroupLandingBlocks: protectedProcedure
    .input(z.object({ cohortGroupId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [group] = await db
        .select({ id: lmsCohortGroups.id, courseId: lmsCohortGroups.courseId, name: lmsCohortGroups.name, landingBlocks: lmsCohortGroups.landingBlocks })
        .from(lmsCohortGroups)
        .where(eq(lmsCohortGroups.id, input.cohortGroupId))
        .limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      return group;
    }),
  saveCohortGroupLandingBlocks: protectedProcedure
    .input(z.object({ cohortGroupId: z.number(), blocks: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(lmsCohortGroups)
        .set({ landingBlocks: input.blocks })
        .where(eq(lmsCohortGroups.id, input.cohortGroupId));
      return { success: true };
    }),
});
