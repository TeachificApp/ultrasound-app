/**
 * lmsEnrollmentAdminRouter.ts
 * All About Ultrasound™ LMS — Enrollments, Groups, Analytics, Orders (admin)
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
import { addToAllContacts } from "../lib/emailListHelper";
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
  lmsGroupCourses,
  affiliateCourseSettings,
  affiliateLinks,
  affiliateClicks,
  payoutRequests,
  instructorPayoutConfig,
  affiliateCourseAccess,
  userRoles,
} from "../../drizzle/schema";
import { getEnrollmentsForCourse, getThinkificCourse } from "../thinkific";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { assertAdmin, generateSlug, uniqueSlug, recalcProgress, issueCertificateIfEnabled } from "./lmsHelpers";

export const lmsEnrollmentAdminRouter = router({
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
            addToAllContacts(enrollment.user_email.toLowerCase(), displayName, { userId, source: "enrollment" }).catch(() => {});
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

  // ── New Teams System (multi-course, multi-seat) ──────────────────────────────

  /** List all teams with their courses and seat counts */
  listTeams: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const groups = await db.select().from(lmsGroups).orderBy(desc(lmsGroups.createdAt));
    const enriched = await Promise.all(groups.map(async (g) => {
      // Get courses for this team
      const groupCourses = await db
        .select({
          id: lmsGroupCourses.id,
          courseId: lmsGroupCourses.courseId,
          seats: lmsGroupCourses.seats,
          courseTitle: lmsCourses.title,
          courseSlug: lmsCourses.slug,
        })
        .from(lmsGroupCourses)
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsGroupCourses.courseId))
        .where(eq(lmsGroupCourses.groupId, g.id));
      // Get seat records enriched with userId via enrollment join
      const seats = await db
        .select({
          id: lmsGroupSeats.id,
          groupId: lmsGroupSeats.groupId,
          email: lmsGroupSeats.email,
          memberName: lmsGroupSeats.memberName,
          status: lmsGroupSeats.status,
          assignedAt: lmsGroupSeats.assignedAt,
          enrollmentId: lmsGroupSeats.enrollmentId,
          acceptedAt: lmsGroupSeats.acceptedAt,
          userId: lmsEnrollments.userId,
        })
        .from(lmsGroupSeats)
        .leftJoin(lmsEnrollments, eq(lmsEnrollments.id, lmsGroupSeats.enrollmentId))
        .where(eq(lmsGroupSeats.groupId, g.id));
      const activeSeats = seats.filter(s => s.status === "active").length;
      const pendingSeats = seats.filter(s => s.status === "pending").length;
      // Legacy single course
      const legacyCourse = g.courseId
        ? await db.select({ title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, g.courseId)).limit(1).then(r => r[0] ?? null)
        : null;
      // Team admin user
      const teamAdmin = g.teamAdminId
        ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, g.teamAdminId)).limit(1).then(r => r[0] ?? null)
        : null;
      return {
        ...g,
        courses: groupCourses,
        legacyCourse,
        teamAdmin,
        totalSeats: seats.length,
        activeSeats,
        pendingSeats,
        seatList: seats,
      };
    }));
    return enriched;
  }),

  /** Create a new team (no course required) */
  createTeam: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      orgName: z.string().optional(),
      adminEmail: z.string().email().optional(),
      adminPhone: z.string().optional(),
      website: z.string().optional(),
      notes: z.string().optional(),
      teamAdminId: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsGroups).values({
        name: input.name,
        orgName: input.orgName ?? null,
        adminEmail: input.adminEmail ?? null,
        adminPhone: input.adminPhone ?? null,
        website: input.website ?? null,
        notes: input.notes ?? null,
        teamAdminId: input.teamAdminId ?? null,
        seats: 0, // legacy field — seats tracked per course in lmsGroupCourses
        courseId: null,
      }).$returningId();
      return { id: result.id };
    }),

  /** Update team info */
  updateTeam: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().min(1).max(255).optional(),
      orgName: z.string().optional().nullable(),
      adminEmail: z.string().email().optional().nullable(),
      adminPhone: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      teamAdminId: z.number().int().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) await db.update(lmsGroups).set(filtered).where(eq(lmsGroups.id, id));
      return { success: true };
    }),

  /** Add a course allocation to a team */
  addCourseToTeam: protectedProcedure
    .input(z.object({
      groupId: z.number().int(),
      courseId: z.number().int(),
      seats: z.number().int().min(1).default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check not already added
      const [existing] = await db.select().from(lmsGroupCourses)
        .where(and(eq(lmsGroupCourses.groupId, input.groupId), eq(lmsGroupCourses.courseId, input.courseId)))
        .limit(1);
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Course already added to this team" });
      const [result] = await db.insert(lmsGroupCourses).values({
        groupId: input.groupId,
        courseId: input.courseId,
        seats: input.seats,
      }).$returningId();
      return { id: result.id };
    }),

  /** Remove a course allocation from a team */
  removeCourseFromTeam: protectedProcedure
    .input(z.object({ groupCourseId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsGroupCourses).where(eq(lmsGroupCourses.id, input.groupCourseId));
      return { success: true };
    }),

  /** Update seat count for a course allocation */
  updateCourseSeatCount: protectedProcedure
    .input(z.object({ groupCourseId: z.number().int(), seats: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsGroupCourses).set({ seats: input.seats }).where(eq(lmsGroupCourses.id, input.groupCourseId));
      return { success: true };
    }),

  /** Delete a team (removes group + all seats) */
  deleteTeam: protectedProcedure
    .input(z.object({ groupId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.groupId));
      await db.delete(lmsGroupCourses).where(eq(lmsGroupCourses.groupId, input.groupId));
      await db.delete(lmsGroups).where(eq(lmsGroups.id, input.groupId));
      return { success: true };
    }),

  // ── Move existing enrolled student into a group seat ──
  assignExistingStudentToGroup: protectedProcedure
    .input(z.object({
      groupId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify group exists and has capacity
      const [group] = await db.select().from(lmsGroups).where(eq(lmsGroups.id, input.groupId)).limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.groupId));
      const activeSeats = seats.filter(s => s.status !== "revoked");
      if (activeSeats.length >= group.seats) throw new TRPCError({ code: "BAD_REQUEST", message: "No seats remaining in this group" });
      // Get user info
      const [user] = await db.select({ id: users.id, email: users.email, name: users.name, displayName: users.displayName })
        .from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user || !user.email) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      // Check not already in this group
      const alreadyInGroup = seats.find(s => s.email.toLowerCase() === (user.email ?? "").toLowerCase() && s.status !== "revoked");
      if (alreadyInGroup) throw new TRPCError({ code: "BAD_REQUEST", message: "User is already in this group" });
      // Find their existing enrollment for this course
      const [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, group.courseId)))
        .limit(1);
      // Create an active seat record (no invite needed — user is already enrolled)
      const now = new Date();
      const [result] = await db.insert(lmsGroupSeats).values({
        groupId: input.groupId,
        email: user.email,
        memberName: user.displayName || user.name || null,
        status: "active",
        assignedAt: now,
        acceptedAt: now,
        enrollmentId: enrollment?.id ?? null,
        inviteToken: null,
      }).$returningId();
      return { id: result.id, alreadyEnrolled: !!enrollment };
    }),

  // ── Search enrolled students for a course (for moving into group) ──
  searchEnrolledStudents: protectedProcedure
    .input(z.object({ courseId: z.number(), query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const q = `%${input.query}%`;
      const rows = await db
        .select({
          userId: lmsEnrollments.userId,
          enrollmentId: lmsEnrollments.id,
          name: users.name,
          displayName: users.displayName,
          email: users.email,
          enrolledAt: lmsEnrollments.enrolledAt,
        })
        .from(lmsEnrollments)
        .innerJoin(users, eq(users.id, lmsEnrollments.userId))
        .where(and(
          eq(lmsEnrollments.courseId, input.courseId),
          sql`(${users.name} LIKE ${q} OR ${users.displayName} LIKE ${q} OR ${users.email} LIKE ${q})`
        ))
        .limit(20);
      return rows;
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
      const [asset] = await db.select({ mediaType: mediaAssets.mediaType, mimeType: mediaAssets.mimeType, slug: mediaAssets.slug })
        .from(mediaAssets).where(eq(mediaAssets.id, input.mediaAssetId)).limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Media asset not found" });

      // Map media type to lesson type
      // scorm and html are interactive content that must be viewed in an iframe embed, NOT downloaded
      let lessonType: "video" | "text" | "quiz" | "download" | "embed" | "video_text" = "text";
      let embedUrl: string | null = null;
      if (asset.mediaType === "video") lessonType = "video";
      else if (["scorm", "html"].includes(asset.mediaType ?? "")) {
        lessonType = "embed";
        // Build the embed URL using the media serve route — the player will render this in an iframe
        embedUrl = `/api/media/${asset.slug}/embed`;
      }
      else if (["document", "zip"].includes(asset.mediaType ?? "")) lessonType = "download";
      else if (asset.mediaType === "audio") lessonType = "video"; // treat audio as video player

      const [result] = await db.insert(lmsLessons).values({
        courseId: input.courseId,
        sectionId: input.sectionId ?? null,
        title: input.title,
        type: lessonType,
        position: input.position,
        content: null,
        embedUrl,
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

  // ─── Upload Collection Hero Image ─────────────────────────────────────────

  uploadCollectionImage: protectedProcedure
    .input(z.object({
      collectionId: z.number(),
      dataUri: z.string().min(1).max(10_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [col] = await db.select({ title: lmsCollections.title }).from(lmsCollections).where(eq(lmsCollections.id, input.collectionId)).limit(1);
      if (!col) throw new TRPCError({ code: "NOT_FOUND" });

      const b64Marker = ";base64,";
      const b64Idx = input.dataUri.indexOf(b64Marker);
      const base64Data = b64Idx >= 0 ? input.dataUri.slice(b64Idx + b64Marker.length) : input.dataUri;
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1];
      const suffix = randomBytes(4).toString("hex");
      const fileKey = `lms-collection-hero/${input.collectionId}-${suffix}.${ext}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      await db.update(lmsCollections).set({ coverImageUrl: url }).where(eq(lmsCollections.id, input.collectionId));
      return { url };
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
        addToAllContacts(input.email, input.name, { userId, source: "enrollment" }).catch(() => {});
      }
      // Enroll the user
      const [existingEnrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, input.courseId))).limit(1);
      if (existingEnrollment) return { enrollmentId: existingEnrollment.id, alreadyEnrolled: true, isNewUser, userId };
      const [result] = await db.insert(lmsEnrollments).values({ userId, courseId: input.courseId }).$returningId();
      // Fire enrollment email asynchronously (non-blocking)
      void (async () => {
        try {
          const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
          const platformEnabled = settings?.enrollmentEmailEnabled !== false;
          if (!platformEnabled) return;
          const [course] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug, sendEnrollmentEmail: lmsCourses.sendEnrollmentEmail }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
          if (!course?.sendEnrollmentEmail) return;
          // Look up userId for the new user to get/create their access token
          const [newUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email.trim().toLowerCase())).limit(1);
          const accessToken2 = newUser ? await getOrCreateAccessToken(newUser.id) : null;
          await sendEnrollmentEmail({
            to: { name: input.name, email: input.email },
            courseTitle: course.title,
            courseSlug: course.slug,
            customSubject: settings?.enrollmentEmailSubject,
            customIntro: settings?.enrollmentEmailIntro,
            accessToken: accessToken2,
          });
        } catch (e) {
          console.error("[enrollment-email] Failed to send:", e);
        }
      })();
      return { enrollmentId: result.id, alreadyEnrolled: false, isNewUser, userId };
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

  // ── Pending Orders Management ────────────────────────────────────────────────
  listPendingOrders: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
      search: z.string().optional(),
      status: z.enum(["all", "pending", "paid", "cancelled"]).default("pending"),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: any[] = [];
      if (input.status !== "all") conditions.push(eq(lmsOrders.status, input.status as any));
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const ordersRaw = await db.select().from(lmsOrders)
        .where(whereClause)
        .orderBy(desc(lmsOrders.createdAt))
        .limit(input.pageSize * 3) // fetch extra for in-memory search
        .offset(offset);
      const enriched = await Promise.all(ordersRaw.map(async (o) => {
        const [u] = await db.select({ displayName: users.displayName, email: users.email, name: users.name })
          .from(users).where(eq(users.id, o.userId)).limit(1);
        const [c] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug })
          .from(lmsCourses).where(eq(lmsCourses.id, o.courseId)).limit(1);
        const [enrollment] = await db.select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, o.userId), eq(lmsEnrollments.courseId, o.courseId)))
          .limit(1);
        return { ...o, user: u ?? null, course: c ?? null, hasEnrollment: !!enrollment };
      }));
      const filtered = input.search
        ? enriched.filter(o => {
            const q = input.search!.toLowerCase();
            return (
              o.user?.email?.toLowerCase().includes(q) ||
              o.user?.displayName?.toLowerCase().includes(q) ||
              o.user?.name?.toLowerCase().includes(q) ||
              o.course?.title?.toLowerCase().includes(q) ||
              o.stripeSessionId?.toLowerCase().includes(q)
            );
          })
        : enriched;
      const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(lmsOrders).where(whereClause);
      return { orders: filtered.slice(0, input.pageSize), total: Number(total), page: input.page, pageSize: input.pageSize };
    }),

  deleteOrder: protectedProcedure
    .input(z.object({ orderId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [order] = await db.select().from(lmsOrders).where(eq(lmsOrders.id, input.orderId)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      await db.delete(lmsOrders).where(eq(lmsOrders.id, input.orderId));
      return { deleted: true, orderId: input.orderId };
    }),

  bulkDeleteOrders: protectedProcedure
    .input(z.object({ orderIds: z.array(z.number().int()).min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsOrders).where(inArray(lmsOrders.id, input.orderIds));
      return { deleted: input.orderIds.length };
    }),

  // ── Enrollment CSV Export ────────────────────────────────────────────────────
  exportEnrollmentsCSV: protectedProcedure
    .input(z.object({
      courseId: z.number().int().optional(),
      includePending: z.boolean().default(false),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Active enrollments
      const enrollConds: any[] = [];
      if (input.courseId) enrollConds.push(eq(lmsEnrollments.courseId, input.courseId));
      if (input.dateFrom) enrollConds.push(sql`${lmsEnrollments.enrolledAt} >= ${new Date(input.dateFrom)}`);
      if (input.dateTo) enrollConds.push(sql`${lmsEnrollments.enrolledAt} <= ${new Date(input.dateTo)}`);

      const enrollmentRows = await db
        .select({
          rowType: sql<string>`'enrolled'`,
          userId: lmsEnrollments.userId,
          courseId: lmsEnrollments.courseId,
          rowDate: lmsEnrollments.enrolledAt,
          orderId: lmsEnrollments.orderId,
          progressPct: lmsEnrollments.progressPct,
          email: users.email,
          displayName: users.displayName,
          name: users.name,
          courseTitle: lmsCourses.title,
          courseSlug: lmsCourses.slug,
          orderAmount: lmsOrders.amount,
          orderStatus: lmsOrders.status,
          stripeSessionId: lmsOrders.stripeSessionId,
        })
        .from(lmsEnrollments)
        .leftJoin(users, eq(lmsEnrollments.userId, users.id))
        .leftJoin(lmsCourses, eq(lmsEnrollments.courseId, lmsCourses.id))
        .leftJoin(lmsOrders, eq(lmsEnrollments.orderId, lmsOrders.id))
        .where(enrollConds.length > 0 ? and(...enrollConds) : undefined)
        .orderBy(desc(lmsEnrollments.enrolledAt));

      // Pending orders (if requested)
      type ExportRow = typeof enrollmentRows[0];
      let pendingRows: ExportRow[] = [];
      if (input.includePending) {
        const pendConds: any[] = [eq(lmsOrders.status, "pending")];
        if (input.courseId) pendConds.push(eq(lmsOrders.courseId, input.courseId));
        if (input.dateFrom) pendConds.push(sql`${lmsOrders.createdAt} >= ${new Date(input.dateFrom)}`);
        if (input.dateTo) pendConds.push(sql`${lmsOrders.createdAt} <= ${new Date(input.dateTo)}`);
        const pending = await db
          .select({
            rowType: sql<string>`'pending_order'`,
            userId: lmsOrders.userId,
            courseId: lmsOrders.courseId,
            rowDate: lmsOrders.createdAt,
            orderId: lmsOrders.id,
            progressPct: sql<number>`0`,
            email: users.email,
            displayName: users.displayName,
            name: users.name,
            courseTitle: lmsCourses.title,
            courseSlug: lmsCourses.slug,
            orderAmount: lmsOrders.amount,
            orderStatus: lmsOrders.status,
            stripeSessionId: lmsOrders.stripeSessionId,
          })
          .from(lmsOrders)
          .leftJoin(users, eq(lmsOrders.userId, users.id))
          .leftJoin(lmsCourses, eq(lmsOrders.courseId, lmsCourses.id))
          .where(and(...pendConds))
          .orderBy(desc(lmsOrders.createdAt));
        pendingRows = pending as ExportRow[];
      }

      const allRows = [...enrollmentRows, ...pendingRows];
      const esc = (v: string | null | undefined | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const headers = ["Type", "Email", "Name", "Course", "Course Slug", "Date", "Progress %", "Order Amount ($)", "Order Status", "Stripe Session ID"];
      const csvLines = [
        headers.join(","),
        ...allRows.map(r => [
          esc(r.rowType),
          esc(r.email),
          esc(r.displayName ?? r.name),
          esc(r.courseTitle),
          esc(r.courseSlug),
          r.rowDate ? new Date(r.rowDate).toISOString() : "",
          r.progressPct ?? 0,
          r.orderAmount != null ? (Number(r.orderAmount) / 100).toFixed(2) : "",
          esc(r.orderStatus),
          esc(r.stripeSessionId),
        ].join(",")),
      ];

      const emails = [...new Set(allRows.map(r => r.email).filter(Boolean))] as string[];
      return { csv: csvLines.join("\n"), count: allRows.length, emails };
    }),

  // ─── Affiliate Course Settings ────────────────────────────────────────────────────

  /** Get affiliate settings for a course */
  getAffiliateCourseSettings: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const row = await db.select().from(affiliateCourseSettings)
        .where(eq(affiliateCourseSettings.courseId, input.courseId))
        .then(r => r[0] ?? null);
      return row ?? { courseId: input.courseId, affiliateEnabled: false, commissionPctOverride: null };
    }),

  /** Set affiliate enabled/commission for a course */
  setAffiliateCourseSettings: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      affiliateEnabled: z.boolean(),
      commissionPctOverride: z.number().int().min(0).max(100).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select({ id: affiliateCourseSettings.id })
        .from(affiliateCourseSettings)
        .where(eq(affiliateCourseSettings.courseId, input.courseId))
        .then(r => r[0]);
      if (existing) {
        await db.update(affiliateCourseSettings)
          .set({ affiliateEnabled: input.affiliateEnabled, commissionPctOverride: input.commissionPctOverride ?? null })
          .where(eq(affiliateCourseSettings.id, existing.id));
      } else {
        await db.insert(affiliateCourseSettings).values({
          courseId: input.courseId,
          affiliateEnabled: input.affiliateEnabled,
          commissionPctOverride: input.commissionPctOverride ?? null,
        });
      }
      return { ok: true };
    }),

  // ─── Affiliate Links ────────────────────────────────────────────────────────────────────

  /** Create a unique affiliate tracking link for a course or site-wide */
  createAffiliateLink: protectedProcedure
    .input(z.object({
      affiliateId: z.number(),
      courseId: z.number().optional(),
      destinationUrl: z.string().url(),
      slug: z.string().min(3).max(128).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only").optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Generate slug if not provided
      const slug = input.slug ?? `${randomBytes(4).toString("hex")}`;
      // Check slug uniqueness
      const existing = await db.select({ id: affiliateLinks.id }).from(affiliateLinks)
        .where(eq(affiliateLinks.slug, slug)).then(r => r[0]);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Slug already in use. Choose a different one." });
      const [result] = await db.insert(affiliateLinks).values({
        affiliateId: input.affiliateId,
        courseId: input.courseId ?? null,
        slug,
        destinationUrl: input.destinationUrl,
      }).$returningId();
      return { id: result.id, slug, trackingUrl: `${input.destinationUrl}?ref=${slug}` };
    }),

  /** List affiliate links for an affiliate */
  listAffiliateLinks: protectedProcedure
    .input(z.object({ affiliateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const links = await db.select({
        id: affiliateLinks.id,
        slug: affiliateLinks.slug,
        destinationUrl: affiliateLinks.destinationUrl,
        courseId: affiliateLinks.courseId,
        clicks: affiliateLinks.clicks,
        conversions: affiliateLinks.conversions,
        isActive: affiliateLinks.isActive,
        createdAt: affiliateLinks.createdAt,
        courseTitle: lmsCourses.title,
      })
        .from(affiliateLinks)
        .leftJoin(lmsCourses, eq(lmsCourses.id, affiliateLinks.courseId))
        .where(eq(affiliateLinks.affiliateId, input.affiliateId))
        .orderBy(desc(affiliateLinks.createdAt));
      return links.map(l => ({ ...l, trackingUrl: `${l.destinationUrl}?ref=${l.slug}` }));
    }),

  /** Toggle affiliate link active/inactive */
  toggleAffiliateLink: protectedProcedure
    .input(z.object({ linkId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(affiliateLinks).set({ isActive: input.isActive }).where(eq(affiliateLinks.id, input.linkId));
      return { ok: true };
    }),

  // ─── Payout Requests (Admin) ───────────────────────────────────────────────────────────

  /** Admin: list all payout requests */
  listPayoutRequests: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "paid", "rejected", "all"]).optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = input.status && input.status !== "all"
        ? [eq(payoutRequests.status, input.status as any)]
        : [];
      const rows = await db.select({
        id: payoutRequests.id,
        requestorType: payoutRequests.requestorType,
        affiliateId: payoutRequests.affiliateId,
        instructorUserId: payoutRequests.instructorUserId,
        amountCents: payoutRequests.amountCents,
        currency: payoutRequests.currency,
        paymentMethod: payoutRequests.paymentMethod,
        paymentDetails: payoutRequests.paymentDetails,
        status: payoutRequests.status,
        adminNote: payoutRequests.adminNote,
        requestedAt: payoutRequests.requestedAt,
        reviewedAt: payoutRequests.reviewedAt,
        paidAt: payoutRequests.paidAt,
        affiliateName: lmsAffiliates.name,
        affiliateEmail: lmsAffiliates.email,
        instructorName: users.name,
        instructorEmail: users.email,
      })
        .from(payoutRequests)
        .leftJoin(lmsAffiliates, eq(lmsAffiliates.id, payoutRequests.affiliateId))
        .leftJoin(users, eq(users.id, payoutRequests.instructorUserId))
        .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
        .orderBy(desc(payoutRequests.requestedAt));
      return rows;
    }),

  /** Admin: approve, mark paid, or reject a payout request */
  reviewPayoutRequest: protectedProcedure
    .input(z.object({
      id: z.number(),
      decision: z.enum(["approved", "paid", "rejected"]),
      adminNote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const req = await db.select().from(payoutRequests).where(eq(payoutRequests.id, input.id)).then(r => r[0]);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      const now = new Date();
      await db.update(payoutRequests).set({
        status: input.decision,
        adminNote: input.adminNote ?? null,
        reviewedByAdminId: ctx.user.id,
        reviewedAt: now,
        paidAt: input.decision === "paid" ? now : req.paidAt,
      }).where(eq(payoutRequests.id, input.id));
      // If marking paid, update affiliate totalPaid
      if (input.decision === "paid" && req.requestorType === "affiliate" && req.affiliateId) {
        const [aff] = await db.select().from(lmsAffiliates).where(eq(lmsAffiliates.id, req.affiliateId)).limit(1);
        if (aff) {
          await db.update(lmsAffiliates)
            .set({ totalPaid: aff.totalPaid + req.amountCents })
            .where(eq(lmsAffiliates.id, req.affiliateId));
        }
      }
      return { ok: true };
    }),

  // ─── Instructor Revenue Share Config (Admin) ─────────────────────────────────────────────

  /** Admin: list instructors with their revenue share % and payout config */
  listInstructorRevenueShares: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select({
        userId: users.id,
        name: users.name,
        email: users.email,
        preferredMethod: instructorPayoutConfig.preferredMethod,
        paymentDetails: instructorPayoutConfig.paymentDetails,
      })
        .from(userRoles)
        .innerJoin(users, eq(users.id, userRoles.userId))
        .leftJoin(instructorPayoutConfig, eq(instructorPayoutConfig.instructorUserId, userRoles.userId))
        .where(eq(userRoles.role, "instructor"));
      // Get revenue share % per course for each instructor
      const enriched = await Promise.all(rows.map(async (r) => {
        const courseShares = await db.select({
          courseId: lmsCourseInstructors.courseId,
          revenueSharePct: lmsCourseInstructors.revenueSharePct,
          courseTitle: lmsCourses.title,
        })
          .from(lmsCourseInstructors)
          .leftJoin(lmsCourses, eq(lmsCourses.id, lmsCourseInstructors.courseId))
          .where(eq(lmsCourseInstructors.instructorId, r.userId));
        return { ...r, courseShares };
      }));
      return enriched;
    }),

  /** Admin: update revenue share % for an instructor on a course */
  setInstructorRevenueShare: protectedProcedure
    .input(z.object({
      instructorId: z.number(),
      courseId: z.number(),
      revenueSharePct: z.number().int().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsCourseInstructors)
        .set({ revenueSharePct: input.revenueSharePct })
        .where(and(
          eq(lmsCourseInstructors.instructorId, input.instructorId),
          eq(lmsCourseInstructors.courseId, input.courseId),
        ));
      return { ok: true };
    }),

  // ─── Self-service: Affiliate Dashboard Procedures ─────────────────────────────────────────

  /** Affiliate: get own affiliate record (linked by userId) */
  getMyAffiliateProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const aff = await db.select().from(lmsAffiliates)
        .where(eq(lmsAffiliates.userId, ctx.user.id))
        .then(r => r[0] ?? null);
      return aff;
    }),

  /** Affiliate: get own links */
  getMyAffiliateLinks: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const aff = await db.select({ id: lmsAffiliates.id }).from(lmsAffiliates)
        .where(eq(lmsAffiliates.userId, ctx.user.id)).then(r => r[0]);
      if (!aff) return [];
      const links = await db.select({
        id: affiliateLinks.id,
        slug: affiliateLinks.slug,
        destinationUrl: affiliateLinks.destinationUrl,
        courseId: affiliateLinks.courseId,
        clicks: affiliateLinks.clicks,
        conversions: affiliateLinks.conversions,
        isActive: affiliateLinks.isActive,
        createdAt: affiliateLinks.createdAt,
        courseTitle: lmsCourses.title,
      })
        .from(affiliateLinks)
        .leftJoin(lmsCourses, eq(lmsCourses.id, affiliateLinks.courseId))
        .where(and(eq(affiliateLinks.affiliateId, aff.id), eq(affiliateLinks.isActive, true)))
        .orderBy(desc(affiliateLinks.createdAt));
      return links.map(l => ({ ...l, trackingUrl: `${l.destinationUrl}?ref=${l.slug}` }));
    }),

  /** Affiliate: get own conversions */
  getMyAffiliateConversions: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const aff = await db.select({ id: lmsAffiliates.id }).from(lmsAffiliates)
        .where(eq(lmsAffiliates.userId, ctx.user.id)).then(r => r[0]);
      if (!aff) return [];
      const conversions = await db.select({
        id: lmsAffiliateConversions.id,
        saleAmount: lmsAffiliateConversions.saleAmount,
        commissionAmount: lmsAffiliateConversions.commissionAmount,
        paidAt: lmsAffiliateConversions.paidAt,
        createdAt: lmsAffiliateConversions.createdAt,
        courseTitle: lmsCourses.title,
      })
        .from(lmsAffiliateConversions)
        .leftJoin(lmsOrders, eq(lmsOrders.id, lmsAffiliateConversions.orderId))
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsOrders.courseId))
        .where(eq(lmsAffiliateConversions.affiliateId, aff.id))
        .orderBy(desc(lmsAffiliateConversions.createdAt));
      return conversions;
    }),

  /** Affiliate/Instructor: submit a payout request */
  requestPayout: protectedProcedure
    .input(z.object({
      requestorType: z.enum(["affiliate", "instructor"]),
      amountCents: z.number().int().min(100),
      paymentMethod: z.enum(["stripe", "paypal", "ach"]),
      paymentDetails: z.object({
        paypal_email: z.string().email().optional(),
        ach_routing: z.string().optional(),
        ach_account: z.string().optional(),
        stripe_account_id: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let affiliateId: number | null = null;
      if (input.requestorType === "affiliate") {
        const aff = await db.select({ id: lmsAffiliates.id }).from(lmsAffiliates)
          .where(eq(lmsAffiliates.userId, ctx.user.id)).then(r => r[0]);
        if (!aff) throw new TRPCError({ code: "FORBIDDEN", message: "No affiliate account found for your user." });
        affiliateId = aff.id;
      }
      await db.insert(payoutRequests).values({
        requestorType: input.requestorType,
        affiliateId,
        instructorUserId: input.requestorType === "instructor" ? ctx.user.id : null,
        amountCents: input.amountCents,
        paymentMethod: input.paymentMethod,
        paymentDetails: JSON.stringify(input.paymentDetails),
      });
      return { ok: true };
    }),

  /** Affiliate/Instructor: get own payout requests */
  getMyPayoutRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const aff = await db.select({ id: lmsAffiliates.id }).from(lmsAffiliates)
        .where(eq(lmsAffiliates.userId, ctx.user.id)).then(r => r[0]);
      const conditions = aff
        ? [or(eq(payoutRequests.affiliateId, aff.id), eq(payoutRequests.instructorUserId, ctx.user.id))]
        : [eq(payoutRequests.instructorUserId, ctx.user.id)];
      return db.select().from(payoutRequests)
        .where(and(...conditions))
        .orderBy(desc(payoutRequests.requestedAt));
    }),

  /** Instructor: save payout config (preferred method + payment details) */
  saveInstructorPayoutConfig: protectedProcedure
    .input(z.object({
      preferredMethod: z.enum(["stripe", "paypal", "ach"]),
      paymentDetails: z.object({
        paypal_email: z.string().email().optional(),
        ach_routing: z.string().optional(),
        ach_account: z.string().optional(),
        stripe_account_id: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select({ id: instructorPayoutConfig.id })
        .from(instructorPayoutConfig)
        .where(eq(instructorPayoutConfig.instructorUserId, ctx.user.id))
        .then(r => r[0]);
      if (existing) {
        await db.update(instructorPayoutConfig)
          .set({ preferredMethod: input.preferredMethod, paymentDetails: JSON.stringify(input.paymentDetails) })
          .where(eq(instructorPayoutConfig.id, existing.id));
      } else {
        await db.insert(instructorPayoutConfig).values({
          instructorUserId: ctx.user.id,
          preferredMethod: input.preferredMethod,
          paymentDetails: JSON.stringify(input.paymentDetails),
        });
      }
      return { ok: true };
    }),

  /** Instructor: get own payout config */
  getMyInstructorPayoutConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(instructorPayoutConfig)
        .where(eq(instructorPayoutConfig.instructorUserId, ctx.user.id))
        .then(r => r[0] ?? null);
    }),

  // ─── Affiliate Course Access Management ─────────────────────────────────────

  /** Admin: list all course access grants for an affiliate */
  listAffiliateCourseAccess: protectedProcedure
    .input(z.object({ affiliateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(affiliateCourseAccess)
        .where(and(eq(affiliateCourseAccess.affiliateId, input.affiliateId), isNull(affiliateCourseAccess.revokedAt)))
        .orderBy(desc(affiliateCourseAccess.grantedAt));
      // Enrich with course title
      const enriched = await Promise.all(rows.map(async (r) => {
        const [course] = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug })
          .from(lmsCourses).where(eq(lmsCourses.id, r.courseId)).limit(1);
        return { ...r, course: course ?? null };
      }));
      return enriched;
    }),

  /** Admin: grant an affiliate access to a specific affiliate-enabled course */
  grantAffiliateCourseAccess: protectedProcedure
    .input(z.object({
      affiliateId: z.number(),
      courseId: z.number(),
      commissionPctOverride: z.number().int().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check course has affiliate enabled
      const [settings] = await db.select().from(affiliateCourseSettings)
        .where(eq(affiliateCourseSettings.courseId, input.courseId)).limit(1);
      if (!settings?.affiliateEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Affiliate program is not enabled for this course. Enable it in course settings first." });
      }
      // Upsert: if revoked row exists, re-activate it
      const [existing] = await db.select().from(affiliateCourseAccess)
        .where(and(eq(affiliateCourseAccess.affiliateId, input.affiliateId), eq(affiliateCourseAccess.courseId, input.courseId)))
        .limit(1);
      if (existing) {
        await db.update(affiliateCourseAccess)
          .set({ revokedAt: null, grantedByAdminId: ctx.user.id, commissionPctOverride: input.commissionPctOverride ?? null, grantedAt: new Date() })
          .where(eq(affiliateCourseAccess.id, existing.id));
        return { id: existing.id };
      }
      const [result] = await db.insert(affiliateCourseAccess).values({
        affiliateId: input.affiliateId,
        courseId: input.courseId,
        commissionPctOverride: input.commissionPctOverride ?? null,
        grantedByAdminId: ctx.user.id,
      }).$returningId();
      return { id: result.id };
    }),

  /** Admin: revoke an affiliate's access to a course */
  revokeAffiliateCourseAccess: protectedProcedure
    .input(z.object({ affiliateId: z.number(), courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(affiliateCourseAccess)
        .set({ revokedAt: new Date() })
        .where(and(eq(affiliateCourseAccess.affiliateId, input.affiliateId), eq(affiliateCourseAccess.courseId, input.courseId)));
      // Also deactivate any active links for this affiliate+course
      await db.update(affiliateLinks)
        .set({ isActive: false })
        .where(and(eq(affiliateLinks.affiliateId, input.affiliateId), eq(affiliateLinks.courseId, input.courseId)));
      return { ok: true };
    }),

  /** Admin: remove an affiliate entirely (deactivate + revoke all course access) */
  removeAffiliate: protectedProcedure
    .input(z.object({ affiliateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Deactivate all their links
      await db.update(affiliateLinks).set({ isActive: false }).where(eq(affiliateLinks.affiliateId, input.affiliateId));
      // Revoke all course access
      await db.update(affiliateCourseAccess).set({ revokedAt: new Date() }).where(eq(affiliateCourseAccess.affiliateId, input.affiliateId));
      // Mark affiliate as inactive
      await db.update(lmsAffiliates).set({ isActive: false }).where(eq(lmsAffiliates.id, input.affiliateId));
      return { ok: true };
    }),

  /** Admin: list all affiliate-enabled courses (for granting access) */
  listAffiliateEnabledCourses: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const settings = await db.select({ courseId: affiliateCourseSettings.courseId, commissionPctOverride: affiliateCourseSettings.commissionPctOverride })
        .from(affiliateCourseSettings).where(eq(affiliateCourseSettings.affiliateEnabled, true));
      if (!settings.length) return [];
      const courseIds = settings.map(s => s.courseId);
      const courses = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug })
        .from(lmsCourses).where(inArray(lmsCourses.id, courseIds));
      return courses.map(c => ({
        ...c,
        commissionPctOverride: settings.find(s => s.courseId === c.id)?.commissionPctOverride ?? null,
      }));
    }),

  /** Affiliate self-service: get all affiliate-enabled courses I have access to with my links */
  getMyAffiliateCourses: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Find affiliate record for this user
      const [aff] = await db.select().from(lmsAffiliates).where(eq(lmsAffiliates.userId, ctx.user.id)).limit(1);
      if (!aff) return [];
      // Get all active course access grants
      const access = await db.select().from(affiliateCourseAccess)
        .where(and(eq(affiliateCourseAccess.affiliateId, aff.id), isNull(affiliateCourseAccess.revokedAt)));
      if (!access.length) return [];
      const courseIds = access.map(a => a.courseId);
      const courses = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, coverImageUrl: lmsCourses.coverImageUrl })
        .from(lmsCourses).where(inArray(lmsCourses.id, courseIds));
      // Get affiliate settings (commission %)
      const courseSettings = await db.select().from(affiliateCourseSettings)
        .where(inArray(affiliateCourseSettings.courseId, courseIds));
      // Get existing links for this affiliate
      const links = await db.select().from(affiliateLinks)
        .where(and(eq(affiliateLinks.affiliateId, aff.id), inArray(affiliateLinks.courseId, courseIds), eq(affiliateLinks.isActive, true)));
      return courses.map(c => {
        const accessRow = access.find(a => a.courseId === c.id);
        const settings = courseSettings.find(s => s.courseId === c.id);
        const commissionPct = accessRow?.commissionPctOverride ?? settings?.commissionPctOverride ?? aff.commissionPct;
        const link = links.find(l => l.courseId === c.id) ?? null;
        return { ...c, commissionPct, link, affiliateId: aff.id };
      });
    }),

  /** Affiliate self-service: generate a unique tracking link for a course */
  generateAffiliateLink: protectedProcedure
    .input(z.object({ courseId: z.number(), destinationUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [aff] = await db.select().from(lmsAffiliates).where(eq(lmsAffiliates.userId, ctx.user.id)).limit(1);
      if (!aff) throw new TRPCError({ code: "FORBIDDEN", message: "No affiliate account found." });
      // Check access
      const [access] = await db.select().from(affiliateCourseAccess)
        .where(and(eq(affiliateCourseAccess.affiliateId, aff.id), eq(affiliateCourseAccess.courseId, input.courseId), isNull(affiliateCourseAccess.revokedAt)))
        .limit(1);
      if (!access) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to promote this course." });
      // Check if link already exists
      const [existing] = await db.select().from(affiliateLinks)
        .where(and(eq(affiliateLinks.affiliateId, aff.id), eq(affiliateLinks.courseId, input.courseId), eq(affiliateLinks.isActive, true)))
        .limit(1);
      if (existing) return existing;
      // Generate unique slug: affiliateCode-courseId
      const baseSlug = `${aff.code}-c${input.courseId}`;
      let slug = baseSlug;
      let attempt = 0;
      while (true) {
        const [taken] = await db.select({ id: affiliateLinks.id }).from(affiliateLinks).where(eq(affiliateLinks.slug, slug)).limit(1);
        if (!taken) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }
      const [result] = await db.insert(affiliateLinks).values({
        affiliateId: aff.id,
        courseId: input.courseId,
        slug,
        destinationUrl: input.destinationUrl,
      }).$returningId();
      const [link] = await db.select().from(affiliateLinks).where(eq(affiliateLinks.id, result.id)).limit(1);
      return link;
    }),

  /** Public: track a click on an affiliate link */
  trackAffiliateClick: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      const [link] = await db.select().from(affiliateLinks).where(and(eq(affiliateLinks.slug, input.slug), eq(affiliateLinks.isActive, true))).limit(1);
      if (!link) return { ok: false, destinationUrl: null };
      // Increment click counter
      await db.update(affiliateLinks).set({ clicks: link.clicks + 1 }).where(eq(affiliateLinks.id, link.id));
      // Log click event
      const req = (ctx as any).req;
      await db.insert(affiliateClicks).values({
        linkId: link.id,
        affiliateId: link.affiliateId,
        ip: req?.ip ?? null,
        userAgent: req?.headers?.['user-agent']?.substring(0, 512) ?? null,
        referrer: req?.headers?.referer?.substring(0, 512) ?? null,
      });
      // Return the affiliate code so the frontend can store it for checkout attribution (30-day window)
      const [aff] = await db.select({ code: lmsAffiliates.code }).from(lmsAffiliates).where(eq(lmsAffiliates.id, link.affiliateId)).limit(1);
      return { ok: true, destinationUrl: link.destinationUrl, affiliateCode: aff?.code ?? null };
    }),
});

