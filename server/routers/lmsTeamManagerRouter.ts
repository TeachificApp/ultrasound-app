/**
 * lmsTeamManagerRouter.ts
 * All About Ultrasound™ LMS — Team Manager Procedures
 *
 * Managers are up to 5 users per team who can:
 *   - Assign / revoke / resend seats for their group
 *   - View team analytics (seat usage, completion, active members)
 *
 * Managers do NOT consume a seat by default.
 * hasSeat=true means they also occupy a paid seat and get course access.
 *
 * Auth rules:
 *   - addManager / removeManager: admin only
 *   - All other procedures: admin OR active manager of that group
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, sql, desc, ne } from "drizzle-orm";
import { randomBytes } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  lmsGroupManagers,
  lmsGroups,
  lmsGroupSeats,
  lmsGroupCourses,
  lmsEnrollments,
  lmsLessonProgress,
  lmsCourses,
  users,
  userActivityLogs,
} from "../../drizzle/schema";
import { sendEmail, emailWrapper } from "../_core/email";

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function assertManagerOrAdmin(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  groupId: number,
  isAdmin: boolean
): Promise<void> {
  if (isAdmin) return;
  const [mgr] = await db
    .select()
    .from(lmsGroupManagers)
    .where(
      and(
        eq(lmsGroupManagers.groupId, groupId),
        eq(lmsGroupManagers.userId, userId),
        eq(lmsGroupManagers.status, "active")
      )
    )
    .limit(1);
  // Also allow the legacy teamAdminId field
  if (!mgr) {
    const [grp] = await db
      .select()
      .from(lmsGroups)
      .where(and(eq(lmsGroups.id, groupId), eq(lmsGroups.teamAdminId, userId)))
      .limit(1);
    if (!grp) throw new TRPCError({ code: "FORBIDDEN", message: "Not a manager of this team" });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const lmsTeamManagerRouter = router({
  // ── Admin: add a manager to a team ─────────────────────────────────────────
  addManager: protectedProcedure
    .input(
      z.object({
        groupId: z.number().int().positive(),
        email: z.string().email(),
        hasSeat: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify group exists
      const [group] = await db
        .select()
        .from(lmsGroups)
        .where(eq(lmsGroups.id, input.groupId))
        .limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });

      // Max 5 active/pending managers
      const existing = await db
        .select()
        .from(lmsGroupManagers)
        .where(
          and(
            eq(lmsGroupManagers.groupId, input.groupId),
            ne(lmsGroupManagers.status, "revoked")
          )
        );
      if (existing.length >= 5)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Teams can have at most 5 managers",
        });

      // Duplicate check
      const dup = existing.find(
        (m) => m.email.toLowerCase() === input.email.toLowerCase()
      );
      if (dup)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This email is already a manager",
        });

      // Check if user exists in the system
      const [existingUser] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      const token = randomBytes(32).toString("hex");
      const now = new Date();

      const [result] = await db
        .insert(lmsGroupManagers)
        .values({
          groupId: input.groupId,
          userId: existingUser?.id ?? null,
          email: input.email,
          managerName: existingUser?.name ?? null,
          hasSeat: input.hasSeat,
          status: existingUser ? "active" : "pending",
          inviteToken: token,
          lastInviteSentAt: now,
          addedByUserId: ctx.user.id,
        })
        .$returningId();

      // Send invite email
      try {
        const appUrl = process.env.CANONICAL_ROOT_DOMAIN
          ? `https://${process.env.CANONICAL_ROOT_DOMAIN}`
          : "https://app.allaboutultrasound.com";
        await sendEmail({
          to: input.email,
          subject: `You've been added as a Team Manager — ${group.name}`,
          html: emailWrapper(`
            <h2 style="margin:0 0 12px">You're now a Team Manager</h2>
            <p>You've been added as a manager for the team <strong>${group.name}</strong> on All About Ultrasound™.</p>
            <p>As a team manager you can:</p>
            <ul>
              <li>Assign and revoke member seats</li>
              <li>Resend invite emails</li>
              <li>View team analytics and progress</li>
            </ul>
            <p>
              <a href="${appUrl}/my-team" style="display:inline-block;background:#189aa1;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;">
                Go to My Team
              </a>
            </p>
          `),
        });
      } catch (_) {
        // Non-fatal — manager is still added
      }

      return { id: result.id, status: existingUser ? "active" : "pending" };
    }),

  // ── Admin: remove a manager ─────────────────────────────────────────────────
  removeManager: protectedProcedure
    .input(z.object({ managerId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [mgr] = await db
        .select()
        .from(lmsGroupManagers)
        .where(eq(lmsGroupManagers.id, input.managerId))
        .limit(1);
      if (!mgr) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .update(lmsGroupManagers)
        .set({ status: "revoked" })
        .where(eq(lmsGroupManagers.id, input.managerId));
      return { success: true };
    }),

  // ── Admin: toggle hasSeat for a manager ────────────────────────────────────
  setManagerSeat: protectedProcedure
    .input(
      z.object({
        managerId: z.number().int().positive(),
        hasSeat: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(lmsGroupManagers)
        .set({ hasSeat: input.hasSeat })
        .where(eq(lmsGroupManagers.id, input.managerId));
      return { success: true };
    }),

  // ── List managers for a group (admin or manager) ───────────────────────────
  listManagers: protectedProcedure
    .input(z.object({ groupId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await assertManagerOrAdmin(db, ctx.user.id, input.groupId, ctx.user.role === "admin");
      return db
        .select()
        .from(lmsGroupManagers)
        .where(eq(lmsGroupManagers.groupId, input.groupId))
        .orderBy(desc(lmsGroupManagers.createdAt));
    }),

  // ── Get all groups this user manages ──────────────────────────────────────
  getMyManagedGroups: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Groups where user is an active manager
    const managerRows = await db
      .select({ groupId: lmsGroupManagers.groupId })
      .from(lmsGroupManagers)
      .where(
        and(
          eq(lmsGroupManagers.userId, ctx.user.id),
          eq(lmsGroupManagers.status, "active")
        )
      );

    // Also include groups where user is the legacy teamAdminId
    const legacyRows = await db
      .select({ id: lmsGroups.id })
      .from(lmsGroups)
      .where(eq(lmsGroups.teamAdminId, ctx.user.id));

    const groupIds = Array.from(
      new Set([
        ...managerRows.map((r) => r.groupId),
        ...legacyRows.map((r) => r.id),
      ])
    );

    if (groupIds.length === 0) return [];

    const groups = await db
      .select()
      .from(lmsGroups)
      .where(sql`${lmsGroups.id} IN (${sql.join(groupIds.map((id) => sql`${id}`), sql`, `)})`);

    return Promise.all(
      groups.map(async (g) => {
        const seats = await db
          .select()
          .from(lmsGroupSeats)
          .where(eq(lmsGroupSeats.groupId, g.id));
        const courses = await db
          .select({
            id: lmsGroupCourses.id,
            courseId: lmsGroupCourses.courseId,
            seats: lmsGroupCourses.seats,
            courseTitle: lmsCourses.title,
            courseSlug: lmsCourses.slug,
          })
          .from(lmsGroupCourses)
          .leftJoin(lmsCourses, eq(lmsGroupCourses.courseId, lmsCourses.id))
          .where(eq(lmsGroupCourses.groupId, g.id));
        const managers = await db
          .select()
          .from(lmsGroupManagers)
          .where(
            and(
              eq(lmsGroupManagers.groupId, g.id),
              ne(lmsGroupManagers.status, "revoked")
            )
          );
        return {
          ...g,
          seatList: seats,
          activeSeats: seats.filter((s) => s.status === "active").length,
          pendingSeats: seats.filter((s) => s.status === "pending").length,
          totalSeats: seats.length,
          courses,
          managers,
        };
      })
    );
  }),

  // ── Manager: assign a seat ─────────────────────────────────────────────────
  assignSeat: protectedProcedure
    .input(
      z.object({
        groupId: z.number().int().positive(),
        email: z.string().email(),
        memberName: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await assertManagerOrAdmin(db, ctx.user.id, input.groupId, ctx.user.role === "admin");

      const [group] = await db
        .select()
        .from(lmsGroups)
        .where(eq(lmsGroups.id, input.groupId))
        .limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });

      const seats = await db
        .select()
        .from(lmsGroupSeats)
        .where(eq(lmsGroupSeats.groupId, input.groupId));

      // Count total seats across all courses for this group
      const [{ totalSeats }] = await db
        .select({ totalSeats: sql<number>`COALESCE(SUM(${lmsGroupCourses.seats}), ${group.seats})` })
        .from(lmsGroupCourses)
        .where(eq(lmsGroupCourses.groupId, input.groupId));

      const activeSeats = seats.filter((s) => s.status !== "revoked").length;
      if (activeSeats >= (totalSeats || group.seats))
        throw new TRPCError({ code: "BAD_REQUEST", message: "No seats remaining" });

      const existing = seats.find(
        (s) => s.email.toLowerCase() === input.email.toLowerCase() && s.status !== "revoked"
      );
      if (existing)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email already has a seat" });

      const token = randomBytes(32).toString("hex");
      const [result] = await db
        .insert(lmsGroupSeats)
        .values({
          groupId: input.groupId,
          email: input.email,
          memberName: input.memberName ?? null,
          inviteToken: token,
          lastInviteSentAt: new Date(),
        })
        .$returningId();

      return { id: result.id, token };
    }),

  // ── Manager: revoke a seat ─────────────────────────────────────────────────
  revokeSeat: protectedProcedure
    .input(z.object({ seatId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [seat] = await db
        .select()
        .from(lmsGroupSeats)
        .where(eq(lmsGroupSeats.id, input.seatId))
        .limit(1);
      if (!seat) throw new TRPCError({ code: "NOT_FOUND" });
      await assertManagerOrAdmin(db, ctx.user.id, seat.groupId, ctx.user.role === "admin");
      await db
        .update(lmsGroupSeats)
        .set({ status: "revoked" })
        .where(eq(lmsGroupSeats.id, input.seatId));
      return { success: true };
    }),

  // ── Manager: resend invite ─────────────────────────────────────────────────
  resendInvite: protectedProcedure
    .input(z.object({ seatId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [seat] = await db
        .select()
        .from(lmsGroupSeats)
        .where(eq(lmsGroupSeats.id, input.seatId))
        .limit(1);
      if (!seat) throw new TRPCError({ code: "NOT_FOUND" });
      await assertManagerOrAdmin(db, ctx.user.id, seat.groupId, ctx.user.role === "admin");
      const newToken = randomBytes(32).toString("hex");
      await db
        .update(lmsGroupSeats)
        .set({ inviteToken: newToken, lastInviteSentAt: new Date() })
        .where(eq(lmsGroupSeats.id, input.seatId));
      return { success: true, token: newToken };
    }),

  // ── Manager: get group analytics ──────────────────────────────────────────
  getGroupAnalytics: protectedProcedure
    .input(z.object({ groupId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await assertManagerOrAdmin(db, ctx.user.id, input.groupId, ctx.user.role === "admin");

      const [group] = await db
        .select()
        .from(lmsGroups)
        .where(eq(lmsGroups.id, input.groupId))
        .limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });

      const seats = await db
        .select()
        .from(lmsGroupSeats)
        .where(eq(lmsGroupSeats.groupId, input.groupId));

      const courses = await db
        .select({
          id: lmsGroupCourses.id,
          courseId: lmsGroupCourses.courseId,
          seats: lmsGroupCourses.seats,
          courseTitle: lmsCourses.title,
          courseSlug: lmsCourses.slug,
        })
        .from(lmsGroupCourses)
        .leftJoin(lmsCourses, eq(lmsGroupCourses.courseId, lmsCourses.id))
        .where(eq(lmsGroupCourses.groupId, input.groupId));

      // For each accepted seat, look up enrollment progress
      const acceptedEmails = seats
        .filter((s) => s.status === "active" && s.acceptedAt)
        .map((s) => s.email.toLowerCase());

      // Fetch users by email to get their IDs
      let memberProgress: any[] = [];
      if (acceptedEmails.length > 0) {
        const memberUsers = await db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(sql`LOWER(${users.email}) IN (${sql.join(acceptedEmails.map((e) => sql`${e}`), sql`, `)})`);

        const userIds = memberUsers.map((u) => u.id);
        const courseIds = courses.map((c) => c.courseId).filter(Boolean) as number[];

        if (userIds.length > 0 && courseIds.length > 0) {
          const enrollments = await db
            .select()
            .from(lmsEnrollments)
            .where(
              and(
                sql`${lmsEnrollments.userId} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`,
                sql`${lmsEnrollments.courseId} IN (${sql.join(courseIds.map((id) => sql`${id}`), sql`, `)})`
              )
            );

          memberProgress = memberUsers.map((u) => {
            const userEnrollments = enrollments.filter((e) => e.userId === u.id);
            return {
              userId: u.id,
              email: u.email,
              name: u.name,
              enrollments: userEnrollments.map((e) => ({
                courseId: e.courseId,
                progress: e.progress ?? 0,
                completedAt: e.completedAt,
                enrolledAt: e.createdAt,
              })),
            };
          });
        }
      }

      const totalAllocatedSeats = courses.reduce((sum, c) => sum + (c.seats || 0), 0) || group.seats;

      // ── Real daily activity: count distinct active members who had lesson completions
      //    or enrollment updates in the last 30 days, grouped by calendar day.
      let dailyActivity: { date: string; activeUsers: number; lessonsCompleted: number }[] = [];
      if (acceptedEmails.length > 0) {
        const memberUsers2 = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`LOWER(${users.email}) IN (${sql.join(acceptedEmails.map((e) => sql`${e}`), sql`, `)})`);
        const memberUserIds = memberUsers2.map((u) => u.id);
        if (memberUserIds.length > 0) {
          // Lesson completions per day (last 30 days)
          const lessonRows = await db
            .select({
              day: sql<string>`DATE(${lmsLessonProgress.completedAt})`,
              userId: sql<number>`${lmsEnrollments.userId}`,
              cnt: sql<number>`COUNT(*)`,
            })
            .from(lmsLessonProgress)
            .innerJoin(lmsEnrollments, eq(lmsLessonProgress.enrollmentId, lmsEnrollments.id))
            .where(
              and(
                sql`${lmsEnrollments.userId} IN (${sql.join(memberUserIds.map((id) => sql`${id}`), sql`, `)})`,
                sql`${lmsLessonProgress.completedAt} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
                sql`${lmsLessonProgress.completedAt} IS NOT NULL`
              )
            )
            .groupBy(sql`DATE(${lmsLessonProgress.completedAt})`, lmsEnrollments.userId);

          // Also pull login/page_view events from userActivityLogs for the same members
          const activityRows = await db
            .select({
              day: sql<string>`DATE(${userActivityLogs.createdAt})`,
              userId: userActivityLogs.userId,
              cnt: sql<number>`COUNT(*)`,
            })
            .from(userActivityLogs)
            .where(
              and(
                sql`${userActivityLogs.userId} IN (${sql.join(memberUserIds.map((id) => sql`${id}`), sql`, `)})`,
                sql`${userActivityLogs.createdAt} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
                sql`${userActivityLogs.eventType} IN ('login','page_view','video_play','lesson_complete','course_complete')`
              )
            )
            .groupBy(sql`DATE(${userActivityLogs.createdAt})`, userActivityLogs.userId);

          // Build a map: day -> { activeUsers: Set<userId>, lessonsCompleted: number }
          const dayMap = new Map<string, { users: Set<number>; lessons: number }>();
          for (const r of lessonRows) {
            const d = r.day as string;
            if (!dayMap.has(d)) dayMap.set(d, { users: new Set(), lessons: 0 });
            dayMap.get(d)!.users.add(Number(r.userId));
            dayMap.get(d)!.lessons += Number(r.cnt);
          }
          for (const r of activityRows) {
            const d = r.day as string;
            if (!dayMap.has(d)) dayMap.set(d, { users: new Set(), lessons: 0 });
            dayMap.get(d)!.users.add(Number(r.userId));
          }

          // Produce last 30 days sorted ascending
          const today = new Date();
          for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const entry = dayMap.get(key);
            dailyActivity.push({
              date: key,
              activeUsers: entry ? entry.users.size : 0,
              lessonsCompleted: entry ? entry.lessons : 0,
            });
          }
        }
      }

      return {
        group: {
          id: group.id,
          name: group.name,
          orgName: group.orgName,
        },
        seats: {
          total: totalAllocatedSeats,
          active: seats.filter((s) => s.status === "active").length,
          pending: seats.filter((s) => s.status === "pending").length,
          revoked: seats.filter((s) => s.status === "revoked").length,
          available: Math.max(0, totalAllocatedSeats - seats.filter((s) => s.status !== "revoked").length),
        },
        courses,
        memberProgress,
        seatList: seats,
        dailyActivity,
      };
    }),

  exportActiveMembersCSV: protectedProcedure
    .input(z.object({ groupId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await assertManagerOrAdmin(db, ctx.user.id, input.groupId, ctx.user.role === "admin");

      const seats = await db.select().from(lmsGroupSeats).where(and(
        eq(lmsGroupSeats.groupId, input.groupId),
        eq(lmsGroupSeats.status, "active"),
      ));
      const emails = seats.filter((seat) => !!seat.acceptedAt).map((seat) => seat.email.toLowerCase());
      if (emails.length === 0) return { csv: "Name,Email,Credentials,Specialty,Location,Enrollment Date,Progress %,Completion Date", count: 0 };

      const members = await db.select({
        id: users.id, name: users.name, displayName: users.displayName, email: users.email,
        credentials: users.credentials, specialty: users.specialty, location: users.location,
      }).from(users).where(sql`LOWER(${users.email}) IN (${sql.join(emails.map((email) => sql`${email}`), sql`, `)})`);
      const memberIds = members.map((member) => member.id);
      const groupCourses = await db.select({ courseId: lmsGroupCourses.courseId }).from(lmsGroupCourses).where(eq(lmsGroupCourses.groupId, input.groupId));
      const courseIds = groupCourses.map((course) => course.courseId);
      const enrollments = memberIds.length && courseIds.length ? await db.select().from(lmsEnrollments).where(and(
        sql`${lmsEnrollments.userId} IN (${sql.join(memberIds.map((id) => sql`${id}`), sql`, `)})`,
        sql`${lmsEnrollments.courseId} IN (${sql.join(courseIds.map((id) => sql`${id}`), sql`, `)})`,
      )) : [];
      const escape = (value: unknown) => {
        const text = String(value ?? "");
        const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const header = ["Name", "Email", "Credentials", "Specialty", "Location", "Enrollment Date", "Progress %", "Completion Date"];
      const rows = members.map((member) => {
        const enrollment = enrollments.find((entry) => entry.userId === member.id);
        return [escape(member.displayName ?? member.name), escape(member.email), escape(member.credentials), escape(member.specialty), escape(member.location), enrollment?.enrolledAt ? new Date(enrollment.enrolledAt).toISOString() : "", enrollment?.progressPct ?? 0, enrollment?.completedAt ? new Date(enrollment.completedAt).toISOString() : ""].join(",");
      });
      return { csv: [header.join(","), ...rows].join("\n"), count: members.length };
    }),
});
