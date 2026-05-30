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
  lmsCohortGroups,
  lmsCohortGroupEnrollments,
  lmsCohortMessages,
  lmsCohortStaff,
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
        const parentDay = parentDate.getDay(); // 0=Sun
        const weekStart = new Date(parentDate);
        weekStart.setDate(weekStart.getDate() - parentDay);
        weekStart.setHours(0, 0, 0, 0);
        const parentTime = {
          h: parentDate.getHours(),
          m: parentDate.getMinutes(),
          s: parentDate.getSeconds(),
        };
        const sortedDays = [...allowedDays].sort((a, b) => a - b);
        // Extend end date by 1 day to be inclusive (end date is typically set to midnight UTC
        // but sessions are at a specific time, so we need to include the end date's day)
        const inclusiveEndDate = endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : null;
        let weekOffset = 0;
        let done = false;
        while (!done && occurrenceNum < maxCount) {
          for (const dayOfWeek of sortedDays) {
            const candidate = new Date(weekStart);
            candidate.setDate(candidate.getDate() + weekOffset * weekIntervalDays + dayOfWeek);
            candidate.setHours(parentTime.h, parentTime.m, parentTime.s, 0);
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
        .where(eq(lmsCohortGroupEnrollments.courseId, input.courseId))
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
        .where(eq(lmsCohortGroupEnrollments.cohortGroupId, input.cohortGroupId))
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
        .where(and(eq(lmsEnrollments.courseId, input.courseId), eq(lmsEnrollments.status, "active")));
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
      const progress = await db
        .select({
          lessonId: lmsLessonProgress.lessonId,
          completed: lmsLessonProgress.completed,
          completedAt: lmsLessonProgress.completedAt,
          watchedSeconds: lmsLessonProgress.watchedSeconds,
          lessonTitle: lmsLessons.title,
          sectionTitle: lmsSections.title,
        })
        .from(lmsLessonProgress)
        .innerJoin(lmsLessons, eq(lmsLessons.id, lmsLessonProgress.lessonId))
        .innerJoin(lmsSections, eq(lmsSections.id, lmsLessons.sectionId))
        .where(and(
          eq(lmsLessonProgress.userId, input.userId),
          eq(lmsLessonProgress.courseId, input.courseId),
        ))
        .orderBy(asc(lmsSections.position), asc(lmsLessons.position));
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
      body: z.string().max(5000).optional(),
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
        isPinned: lmsCohortMessages.isPinned,
        createdAt: lmsCohortMessages.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
        .from(lmsCohortMessages)
        .innerJoin(users, eq(users.id, lmsCohortMessages.userId))
        .where(and(...conditions))
        .orderBy(desc(lmsCohortMessages.isPinned), desc(lmsCohortMessages.createdAt))
        .limit(input.limit);
      return messages;
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

  /** Post a message as admin (from Discussions tab) */
  postAdminCohortMessage: protectedProcedure
    .input(z.object({
      cohortGroupId: z.number(),
      courseId: z.number(),
      body: z.string().optional(),
      mediaUrls: z.array(z.object({ url: z.string(), mimeType: z.string(), fileName: z.string() })).optional(),
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
});
