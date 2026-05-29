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
} from "../../drizzle/schema";
import { getEnrollmentsForCourse, getThinkificCourse } from "../thinkific";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { assertAdmin, generateSlug, uniqueSlug, recalcProgress, issueCertificateIfEnabled } from "./lmsHelpers";

export const lmsCohortAdminRouter = router({
  // ── Cohort Sessions ──
  listCohortSessions: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const sessions = await db.select().from(lmsCohortSessions)
        .where(eq(lmsCohortSessions.courseId, input.courseId))
        .orderBy(asc(lmsCohortSessions.sessionDate));
      return sessions;
    }),

  createCohortSession: protectedProcedure
    .input(z.object({
      courseId: z.number(),
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
      recurrenceEndDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsCohortSessions).values({
        courseId: input.courseId,
        title: input.title,
        description: input.description ?? null,
        sessionDate: new Date(input.sessionDate),
        durationMinutes: input.durationMinutes,
        meetingUrl: input.meetingUrl ?? null,
        recordingUrl: input.recordingUrl ?? null,
        status: input.status,
        timezone: input.timezone ?? "America/New_York",
        recurrenceRule: input.recurrenceRule ?? null,
        recurrenceEndDate: input.recurrenceEndDate ? new Date(input.recurrenceEndDate) : null,
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
      recurrenceEndDate: z.string().nullable().optional(),
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
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const assignments = await db.select().from(lmsCohortAssignments)
        .where(eq(lmsCohortAssignments.courseId, input.courseId))
        .orderBy(asc(lmsCohortAssignments.position), asc(lmsCohortAssignments.createdAt));
      return assignments;
    }),

  createCohortAssignment: protectedProcedure
    .input(z.object({
      courseId: z.number(),
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
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(lmsCohortRecordings)
        .where(eq(lmsCohortRecordings.courseId, input.courseId))
        .orderBy(asc(lmsCohortRecordings.position), asc(lmsCohortRecordings.createdAt));
    }),

  createCohortRecording: protectedProcedure
    .input(z.object({
      courseId: z.number(),
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
      if (!parent.recurrenceEndDate) throw new TRPCError({ code: "BAD_REQUEST", message: "Recurrence end date is required" });

      // Delete existing child instances first (re-expand)
      await db.delete(lmsCohortSessions)
        .where(eq(lmsCohortSessions.parentSessionId, input.parentSessionId));

      const intervalDays = parent.recurrenceRule === "weekly" ? 7
        : parent.recurrenceRule === "biweekly" ? 14
        : 30; // monthly approximation

      const instances: typeof lmsCohortSessions.$inferInsert[] = [];
      let current = new Date(parent.sessionDate);
      const endDate = new Date(parent.recurrenceEndDate);
      let weekNum = 1;

      while (true) {
        // Advance by interval
        if (parent.recurrenceRule === "monthly") {
          current = new Date(current);
          current.setMonth(current.getMonth() + 1);
        } else {
          current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        }
        if (current > endDate) break;
        weekNum++;
        instances.push({
          courseId: parent.courseId,
          title: `${parent.title} (Week ${weekNum})`,
          description: parent.description,
          sessionDate: new Date(current),
          durationMinutes: parent.durationMinutes,
          meetingUrl: parent.meetingUrl,
          recordingUrl: null,
          status: parent.status,
          timezone: parent.timezone ?? "America/New_York",
          recurrenceRule: null,
          recurrenceInterval: null,
          recurrenceEndDate: null,
          parentSessionId: parent.id,
        });
      }

      if (instances.length === 0) return { created: 0 };
      await db.insert(lmsCohortSessions).values(instances);
      return { created: instances.length };
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
});
