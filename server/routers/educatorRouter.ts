/**
 * educatorRouter.ts — EducatorAssist Platform tRPC Router
 *
 * Roles:
 *   education_manager  — platform-level oversight (assigned by platform_admin)
 *   education_admin    — org owner/educator (builds content, manages students)
 *   education_student  — learner enrolled in an org
 *
 * Visibility gate:
 *   All routes check the `educatorPlatformVisible` feature flag.
 *   When false, only platform_admin and education_manager can access.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  educatorOrgs,
  educatorOrgMembers,
  educatorCourses,
  educatorModules,
  educatorAssignments,
  educatorStudentProgress,
  educatorCompetencies,
  educatorStudentCompetencies,
  educatorQuizzes,
  educatorQuizQuestions,
  educatorQuizAttempts,
  educatorPresentations,
  educatorAnnouncements,
  platformFeatureFlags,
  userRoles,
  users,
} from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getEducatorPlatformVisible(): Promise<boolean> {
  const db = (await getDb())!;
  const flag = await db
    .select()
    .from(platformFeatureFlags)
    .where(eq(platformFeatureFlags.name, "educatorPlatformVisible"))
    .limit(1);
  if (!flag[0]) return false;
  try {
    return JSON.parse(flag[0].value) === true;
  } catch {
    return flag[0].value === "true";
  }
}

/** Returns the user's app roles from userRoles table */
async function getUserAppRoles(userId: number): Promise<string[]> {
  const db = (await getDb())!;
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((r: { role: string }) => r.role);
}

/** Returns the org membership for a user in a specific org */
async function getOrgMembership(userId: number, orgId: number) {
  const db = (await getDb())!;
  const rows = await db
    .select()
    .from(educatorOrgMembers)
    .where(
      and(
        eq(educatorOrgMembers.userId, userId),
        eq(educatorOrgMembers.orgId, orgId),
        eq(educatorOrgMembers.status, "active")
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Checks if user is education_admin of the org (or platform_admin/education_manager) */
async function requireOrgAdmin(userId: number, orgId: number, appRoles: string[]) {
  if (appRoles.includes("platform_admin") || appRoles.includes("education_manager")) return;
  const membership = await getOrgMembership(userId, orgId);
  if (!membership || membership.orgRole !== "education_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Education Admin access required for this org." });
  }
}

/** Checks if user is a member (any role) of the org */
async function requireOrgMember(userId: number, orgId: number, appRoles: string[]) {
  if (appRoles.includes("platform_admin") || appRoles.includes("education_manager")) return;
  const membership = await getOrgMembership(userId, orgId);
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this organization." });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const educatorRouter = router({

  // ── Feature Flag ────────────────────────────────────────────────────────────

  /** Check if the EducatorAssist platform is publicly visible */
  getPlatformVisible: publicProcedure.query(async () => {
    const db = (await getDb())!;
    return { visible: await getEducatorPlatformVisible() };
  }),

  /** Toggle EducatorAssist platform visibility (platform_admin only) */
  setPlatformVisible: protectedProcedure
    .input(z.object({ visible: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      if (!appRoles.includes("platform_admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform Admin access required." });
      }
      await db
        .insert(platformFeatureFlags)
        .values({
          name: "educatorPlatformVisible",
          value: JSON.stringify(input.visible),
          description: "Controls public visibility of EducatorAssist platform",
          updatedByUserId: ctx.user.id,
        })
        .onDuplicateKeyUpdate({
          set: {
            value: JSON.stringify(input.visible),
            updatedByUserId: ctx.user.id,
          },
        });
      return { success: true, visible: input.visible };
    }),

  // ── Org Management ───────────────────────────────────────────────────────────

  /** Create a new educator org (education_admin or platform_admin) */
  createOrg: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(300),
        slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
        tier: z.enum(["individual", "school", "hospital", "enterprise"]),
        institutionType: z.enum(["individual", "school_university", "hospital_echo_lab", "health_system", "other"]).optional(),
        description: z.string().optional(),
        website: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      const isAdmin = appRoles.includes("platform_admin") || appRoles.includes("education_manager");
      const isEducator = appRoles.includes("education_admin");
      if (!isAdmin && !isEducator) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Education Admin role required to create an organization." });
      }

      // Tier seat limits
      const tierLimits: Record<string, { maxEducators: number | null; maxStudents: number | null }> = {
        individual: { maxEducators: 1, maxStudents: 50 },
        school: { maxEducators: 3, maxStudents: 250 },
        hospital: { maxEducators: 5, maxStudents: 500 },
        enterprise: { maxEducators: null, maxStudents: null },
      };
      const limits = tierLimits[input.tier];

      const [result] = await db.insert(educatorOrgs).values({
        name: input.name,
        slug: input.slug,
        tier: input.tier,
        institutionType: input.institutionType,
        description: input.description,
        website: input.website,
        contactEmail: input.contactEmail,
        contactName: input.contactName,
        maxEducators: limits.maxEducators,
        maxStudents: limits.maxStudents,
        ownerUserId: ctx.user.id,
      });

      const orgId = (result as any).insertId as number;

      // Auto-enroll the creator as education_admin
      await db.insert(educatorOrgMembers).values({
        orgId,
        userId: ctx.user.id,
        orgRole: "education_admin",
        status: "active",
        addedByUserId: ctx.user.id,
        joinedAt: new Date(),
        inviteAcceptedAt: new Date(),
      });

      // Notify platform owner
      await notifyOwner({
        title: "New EducatorAssist Org Created",
        content: `${input.name} (${input.tier} tier) created by user ${ctx.user.id}`,
      });

      return { success: true, orgId };
    }),

  /** Get the current user's educator org(s) */
  getMyOrgs: protectedProcedure.query(async ({ ctx }) => {
    const db = (await getDb())!;
    const memberships = await db
      .select({ orgId: educatorOrgMembers.orgId, orgRole: educatorOrgMembers.orgRole })
      .from(educatorOrgMembers)
      .where(
        and(
          eq(educatorOrgMembers.userId, ctx.user.id),
          eq(educatorOrgMembers.status, "active")
        )
      );

    if (memberships.length === 0) return [];

    const orgIds = memberships.map((m: { orgId: number; orgRole: string }) => m.orgId);
    const orgs = await db
      .select()
      .from(educatorOrgs)
      .where(inArray(educatorOrgs.id, orgIds));

    return orgs.map((org: typeof orgs[number]) => ({
      ...org,
      myRole: memberships.find((m: { orgId: number; orgRole: string }) => m.orgId === org.id)?.orgRole ?? "education_student",
    }));
  }),

  /** Get a specific org by ID */
  getOrg: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      const org = await db
        .select()
        .from(educatorOrgs)
        .where(eq(educatorOrgs.id, input.orgId))
        .limit(1);
      if (!org[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return org[0];
    }),

  /** Update org settings (education_admin or platform_admin) */
  updateOrg: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        name: z.string().min(2).max(300).optional(),
        description: z.string().optional(),
        website: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactName: z.string().optional(),
        logoUrl: z.string().optional(),
        bannerUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const { orgId, ...updates } = input;
      await db.update(educatorOrgs).set(updates).where(eq(educatorOrgs.id, orgId));
      return { success: true };
    }),

  // ── Member Management ────────────────────────────────────────────────────────

  /** List all members of an org */
  getOrgMembers: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);

      const members = await db
        .select({
          id: educatorOrgMembers.id,
          userId: educatorOrgMembers.userId,
          orgRole: educatorOrgMembers.orgRole,
          status: educatorOrgMembers.status,
          joinedAt: educatorOrgMembers.joinedAt,
          inviteEmail: educatorOrgMembers.inviteEmail,
          userName: users.name,
          userEmail: users.email,
          userDisplayName: users.displayName,
          userAvatarUrl: users.avatarUrl,
        })
        .from(educatorOrgMembers)
        .leftJoin(users, eq(educatorOrgMembers.userId, users.id))
        .where(eq(educatorOrgMembers.orgId, input.orgId))
        .orderBy(educatorOrgMembers.orgRole, educatorOrgMembers.joinedAt);

      return members;
    }),

  /** Invite a student to an org by email */
  inviteStudent: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        email: z.string().email(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);

      // Check seat limits
      const org = await db.select().from(educatorOrgs).where(eq(educatorOrgs.id, input.orgId)).limit(1);
      if (!org[0]) throw new TRPCError({ code: "NOT_FOUND" });

      if (org[0].maxStudents !== null) {
        const studentCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(educatorOrgMembers)
          .where(
            and(
              eq(educatorOrgMembers.orgId, input.orgId),
              eq(educatorOrgMembers.orgRole, "education_student"),
              eq(educatorOrgMembers.status, "active")
            )
          );
        if ((studentCount[0]?.count ?? 0) >= org[0].maxStudents) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Student seat limit (${org[0].maxStudents}) reached. Upgrade your plan to add more students.`,
          });
        }
      }

      // Check if user already exists
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      const userId = existingUser[0]?.id ?? 0;
      const inviteToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(educatorOrgMembers).values({
        orgId: input.orgId,
        userId: userId,
        orgRole: "education_student",
        status: "pending",
        inviteToken,
        inviteEmail: input.email,
        inviteExpiry,
        addedByUserId: ctx.user.id,
      });

      return { success: true, inviteToken };
    }),

  /** Remove a member from an org */
  removeMember: protectedProcedure
    .input(z.object({ orgId: z.number(), memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      await db
        .update(educatorOrgMembers)
        .set({ status: "inactive" })
        .where(
          and(
            eq(educatorOrgMembers.id, input.memberId),
            eq(educatorOrgMembers.orgId, input.orgId)
          )
        );
      return { success: true };
    }),

  // ── Courses ──────────────────────────────────────────────────────────────────

  /** List all courses in an org */
  getCourses: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      return db
        .select()
        .from(educatorCourses)
        .where(eq(educatorCourses.orgId, input.orgId))
        .orderBy(educatorCourses.sortOrder, educatorCourses.createdAt);
    }),

  /** Create a course */
  createCourse: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        title: z.string().min(1).max(300),
        description: z.string().optional(),
        category: z.enum(["Adult Echo", "Pediatric Echo", "Fetal Echo", "ACS", "POCUS", "General"]).optional(),
        estimatedMinutes: z.number().optional(),
        coverImageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const [result] = await db.insert(educatorCourses).values({
        ...input,
        createdByUserId: ctx.user.id,
      });
      return { success: true, courseId: (result as any).insertId as number };
    }),

  /** Update a course */
  updateCourse: protectedProcedure
    .input(
      z.object({
        courseId: z.number(),
        orgId: z.number(),
        title: z.string().min(1).max(300).optional(),
        description: z.string().optional(),
        category: z.enum(["Adult Echo", "Pediatric Echo", "Fetal Echo", "ACS", "POCUS", "General"]).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        estimatedMinutes: z.number().optional(),
        coverImageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const { courseId, orgId, ...updates } = input;
      await db
        .update(educatorCourses)
        .set(updates)
        .where(and(eq(educatorCourses.id, courseId), eq(educatorCourses.orgId, orgId)));
      return { success: true };
    }),

  /** Delete a course */
  deleteCourse: protectedProcedure
    .input(z.object({ courseId: z.number(), orgId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      await db
        .update(educatorCourses)
        .set({ status: "archived" })
        .where(and(eq(educatorCourses.id, input.courseId), eq(educatorCourses.orgId, input.orgId)));
      return { success: true };
    }),

  // ── Modules ──────────────────────────────────────────────────────────────────

  /** List modules for a course */
  getModules: protectedProcedure
    .input(z.object({ courseId: z.number(), orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      return db
        .select()
        .from(educatorModules)
        .where(
          and(
            eq(educatorModules.courseId, input.courseId),
            eq(educatorModules.orgId, input.orgId)
          )
        )
        .orderBy(educatorModules.sortOrder);
    }),

  /** Create a module */
  createModule: protectedProcedure
    .input(
      z.object({
        courseId: z.number(),
        orgId: z.number(),
        title: z.string().min(1).max(300),
        moduleType: z.enum(["lesson", "case_study", "challenge", "quiz", "flashcard_deck", "presentation", "protocol_library"]),
        description: z.string().optional(),
        content: z.string().optional(),
        linkedContentIds: z.string().optional(),
        presentationData: z.string().optional(),
        estimatedMinutes: z.number().optional(),
        isRequired: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const [result] = await db.insert(educatorModules).values(input);
      return { success: true, moduleId: (result as any).insertId as number };
    }),

  /** Update a module */
  updateModule: protectedProcedure
    .input(
      z.object({
        moduleId: z.number(),
        orgId: z.number(),
        title: z.string().min(1).max(300).optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        linkedContentIds: z.string().optional(),
        presentationData: z.string().optional(),
        estimatedMinutes: z.number().optional(),
        isRequired: z.boolean().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const { moduleId, orgId, ...updates } = input;
      await db
        .update(educatorModules)
        .set(updates)
        .where(and(eq(educatorModules.id, moduleId), eq(educatorModules.orgId, orgId)));
      return { success: true };
    }),

  // ── Assignments ──────────────────────────────────────────────────────────────

  /** List assignments for an org */
  getAssignments: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      return db
        .select()
        .from(educatorAssignments)
        .where(eq(educatorAssignments.orgId, input.orgId))
        .orderBy(desc(educatorAssignments.createdAt));
    }),

  /** Create an assignment */
  createAssignment: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        title: z.string().min(1).max(300),
        description: z.string().optional(),
        courseId: z.number().optional(),
        moduleId: z.number().optional(),
        targetType: z.enum(["individual", "group", "org_wide"]),
        targetUserIds: z.string().optional(),
        dueAt: z.date().optional(),
        passingScore: z.number().min(0).max(100).optional(),
        maxAttempts: z.number().min(1).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const [result] = await db.insert(educatorAssignments).values({
        ...input,
        assignedByUserId: ctx.user.id,
        maxAttempts: input.maxAttempts ?? 3,
      });
      return { success: true, assignmentId: (result as any).insertId as number };
    }),

  /** Update assignment status */
  updateAssignment: protectedProcedure
    .input(
      z.object({
        assignmentId: z.number(),
        orgId: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        dueAt: z.date().optional(),
        status: z.enum(["draft", "active", "completed", "archived"]).optional(),
        passingScore: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const { assignmentId, orgId, ...updates } = input;
      await db
        .update(educatorAssignments)
        .set(updates)
        .where(and(eq(educatorAssignments.id, assignmentId), eq(educatorAssignments.orgId, orgId)));
      return { success: true };
    }),

  // ── Student Progress ─────────────────────────────────────────────────────────

  /** Get progress for a student in an org */
  getStudentProgress: protectedProcedure
    .input(z.object({ orgId: z.number(), userId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      const targetUserId = input.userId ?? ctx.user.id;

      // Students can only see their own progress
      if (targetUserId !== ctx.user.id) {
        await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      } else {
        await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      }

      return db
        .select()
        .from(educatorStudentProgress)
        .where(
          and(
            eq(educatorStudentProgress.orgId, input.orgId),
            eq(educatorStudentProgress.userId, targetUserId)
          )
        )
        .orderBy(desc(educatorStudentProgress.updatedAt));
    }),

  /** Update student progress (educator or student self-reporting) */
  updateProgress: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        courseId: z.number().optional(),
        moduleId: z.number().optional(),
        assignmentId: z.number().optional(),
        status: z.enum(["not_started", "in_progress", "completed", "failed"]),
        score: z.number().min(0).max(100).optional(),
        timeSpentSeconds: z.number().optional(),
        resultData: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);

      // Check if a progress record already exists
      const existing = await db
        .select()
        .from(educatorStudentProgress)
        .where(
          and(
            eq(educatorStudentProgress.orgId, input.orgId),
            eq(educatorStudentProgress.userId, ctx.user.id),
            input.moduleId ? eq(educatorStudentProgress.moduleId, input.moduleId) : sql`1=1`,
            input.assignmentId ? eq(educatorStudentProgress.assignmentId, input.assignmentId) : sql`1=1`
          )
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(educatorStudentProgress)
          .set({
            status: input.status,
            score: input.score,
            timeSpentSeconds: input.timeSpentSeconds,
            resultData: input.resultData,
            completedAt: input.status === "completed" ? new Date() : undefined,
          })
          .where(eq(educatorStudentProgress.id, existing[0].id));
      } else {
        await db.insert(educatorStudentProgress).values({
          orgId: input.orgId,
          userId: ctx.user.id,
          courseId: input.courseId,
          moduleId: input.moduleId,
          assignmentId: input.assignmentId,
          status: input.status,
          score: input.score,
          timeSpentSeconds: input.timeSpentSeconds ?? 0,
          resultData: input.resultData,
          completedAt: input.status === "completed" ? new Date() : undefined,
        });
      }

      return { success: true };
    }),

  // ── Competencies ─────────────────────────────────────────────────────────────

  /** List competencies for an org */
  getCompetencies: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      return db
        .select()
        .from(educatorCompetencies)
        .where(eq(educatorCompetencies.orgId, input.orgId))
        .orderBy(educatorCompetencies.sortOrder);
    }),

  /** Create a competency */
  createCompetency: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        title: z.string().min(1).max(300),
        description: z.string().optional(),
        category: z.enum(["Adult Echo", "Pediatric Echo", "Fetal Echo", "ACS", "POCUS", "General"]).optional(),
        maxLevel: z.number().min(1).max(10).optional(),
        isRequired: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const [result] = await db.insert(educatorCompetencies).values({
        ...input,
        createdByUserId: ctx.user.id,
        maxLevel: input.maxLevel ?? 5,
      });
      return { success: true, competencyId: (result as any).insertId as number };
    }),

  /** Get a student's competency records */
  getStudentCompetencies: protectedProcedure
    .input(z.object({ orgId: z.number(), userId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      const targetUserId = input.userId ?? ctx.user.id;
      if (targetUserId !== ctx.user.id) {
        await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      } else {
        await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      }

      const records = await db
        .select({
          id: educatorStudentCompetencies.id,
          competencyId: educatorStudentCompetencies.competencyId,
          achievedLevel: educatorStudentCompetencies.achievedLevel,
          notes: educatorStudentCompetencies.notes,
          assessedAt: educatorStudentCompetencies.assessedAt,
          competencyTitle: educatorCompetencies.title,
          competencyCategory: educatorCompetencies.category,
          maxLevel: educatorCompetencies.maxLevel,
          isRequired: educatorCompetencies.isRequired,
        })
        .from(educatorStudentCompetencies)
        .leftJoin(educatorCompetencies, eq(educatorStudentCompetencies.competencyId, educatorCompetencies.id))
        .where(
          and(
            eq(educatorStudentCompetencies.orgId, input.orgId),
            eq(educatorStudentCompetencies.userId, targetUserId)
          )
        );

      return records;
    }),

  /** Update a student's competency level (educator only) */
  updateStudentCompetency: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        userId: z.number(),
        competencyId: z.number(),
        achievedLevel: z.number().min(0).max(10),
        notes: z.string().optional(),
        evidenceData: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);

      const existing = await db
        .select()
        .from(educatorStudentCompetencies)
        .where(
          and(
            eq(educatorStudentCompetencies.orgId, input.orgId),
            eq(educatorStudentCompetencies.userId, input.userId),
            eq(educatorStudentCompetencies.competencyId, input.competencyId)
          )
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(educatorStudentCompetencies)
          .set({
            achievedLevel: input.achievedLevel,
            notes: input.notes,
            evidenceData: input.evidenceData,
            assessedByUserId: ctx.user.id,
            assessedAt: new Date(),
          })
          .where(eq(educatorStudentCompetencies.id, existing[0].id));
      } else {
        await db.insert(educatorStudentCompetencies).values({
          orgId: input.orgId,
          userId: input.userId,
          competencyId: input.competencyId,
          achievedLevel: input.achievedLevel,
          notes: input.notes,
          evidenceData: input.evidenceData,
          assessedByUserId: ctx.user.id,
          assessedAt: new Date(),
        });
      }

      return { success: true };
    }),

  // ── Quizzes ──────────────────────────────────────────────────────────────────

  /** List quizzes for an org */
  getQuizzes: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      return db
        .select()
        .from(educatorQuizzes)
        .where(eq(educatorQuizzes.orgId, input.orgId))
        .orderBy(desc(educatorQuizzes.createdAt));
    }),

  /** Create a quiz */
  createQuiz: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        title: z.string().min(1).max(300),
        description: z.string().optional(),
        timeLimitMinutes: z.number().optional(),
        passingScore: z.number().min(0).max(100).optional(),
        shuffleQuestions: z.boolean().optional(),
        showAnswers: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const [result] = await db.insert(educatorQuizzes).values({
        ...input,
        createdByUserId: ctx.user.id,
        passingScore: input.passingScore ?? 70,
        shuffleQuestions: input.shuffleQuestions ?? false,
        showAnswers: input.showAnswers ?? true,
      });
      return { success: true, quizId: (result as any).insertId as number };
    }),

  /** Add a question to a quiz */
  addQuizQuestion: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        orgId: z.number(),
        question: z.string().min(1),
        options: z.array(z.string()).min(2).max(6),
        correctAnswer: z.number().min(0).max(5),
        explanation: z.string().optional(),
        mediaUrl: z.string().optional(),
        mediaType: z.enum(["image", "video", "gif"]).optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        points: z.number().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const [result] = await db.insert(educatorQuizQuestions).values({
        ...input,
        options: JSON.stringify(input.options),
        points: input.points ?? 1,
      });
      return { success: true, questionId: (result as any).insertId as number };
    }),

  /** Get quiz questions */
  getQuizQuestions: protectedProcedure
    .input(z.object({ quizId: z.number(), orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      const questions = await db
        .select()
        .from(educatorQuizQuestions)
        .where(eq(educatorQuizQuestions.quizId, input.quizId))
        .orderBy(educatorQuizQuestions.sortOrder);
      return questions.map((q) => ({
        ...q,
        options: (() => { try { return JSON.parse(q.options); } catch { return []; } })(),
      }));
    }),

  /** Submit a quiz attempt */
  submitQuizAttempt: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        orgId: z.number(),
        assignmentId: z.number().optional(),
        answers: z.array(
          z.object({
            questionId: z.number(),
            selectedAnswer: z.number(),
          })
        ),
        timeSpentSeconds: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);

      // Get quiz and questions
      const quiz = await db.select().from(educatorQuizzes).where(eq(educatorQuizzes.id, input.quizId)).limit(1);
      if (!quiz[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const questions = await db
        .select()
        .from(educatorQuizQuestions)
        .where(eq(educatorQuizQuestions.quizId, input.quizId));

      // Calculate score
      let correctCount = 0;
      const scoredAnswers = input.answers.map((a) => {
        const q = questions.find((qq: typeof questions[number]) => qq.id === a.questionId);
        const isCorrect = q ? q.correctAnswer === a.selectedAnswer : false;
        if (isCorrect) correctCount++;
        return { ...a, isCorrect };
      });

      const totalPoints = questions.reduce((sum: number, q: typeof questions[number]) => sum + q.points, 0);
      const earnedPoints = scoredAnswers.reduce((sum: number, a: typeof scoredAnswers[number]) => {
        const q = questions.find((qq: typeof questions[number]) => qq.id === a.questionId);
        return sum + (a.isCorrect && q ? q.points : 0);
      }, 0);
      const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const passed = score >= quiz[0].passingScore;

      // Get attempt number
      const prevAttempts = await db
        .select({ count: sql<number>`count(*)` })
        .from(educatorQuizAttempts)
        .where(
          and(
            eq(educatorQuizAttempts.quizId, input.quizId),
            eq(educatorQuizAttempts.userId, ctx.user.id)
          )
        );
      const attemptNumber = (prevAttempts[0]?.count ?? 0) + 1;

      const [result] = await db.insert(educatorQuizAttempts).values({
        quizId: input.quizId,
        orgId: input.orgId,
        userId: ctx.user.id,
        assignmentId: input.assignmentId,
        attemptNumber,
        answers: JSON.stringify(scoredAnswers),
        score,
        passed,
        completedAt: new Date(),
        timeSpentSeconds: input.timeSpentSeconds,
      });

      return {
        success: true,
        attemptId: (result as any).insertId as number,
        score,
        passed,
        correctCount,
        totalQuestions: questions.length,
        showAnswers: quiz[0].showAnswers,
        scoredAnswers: quiz[0].showAnswers ? scoredAnswers : undefined,
      };
    }),

  // ── Presentations ────────────────────────────────────────────────────────────

  /** List presentations for an org */
  getPresentations: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      return db
        .select()
        .from(educatorPresentations)
        .where(eq(educatorPresentations.orgId, input.orgId))
        .orderBy(desc(educatorPresentations.createdAt));
    }),

  /** Create or update a presentation */
  upsertPresentation: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        orgId: z.number(),
        title: z.string().min(1).max(300),
        description: z.string().optional(),
        slidesData: z.string().optional(),
        coverImageUrl: z.string().optional(),
        category: z.enum(["Adult Echo", "Pediatric Echo", "Fetal Echo", "ACS", "POCUS", "General"]).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      if (input.id) {
        const { id, ...updates } = input;
        await db
          .update(educatorPresentations)
          .set(updates)
          .where(and(eq(educatorPresentations.id, id), eq(educatorPresentations.orgId, input.orgId)));
        return { success: true, presentationId: id };
      } else {
        const [result] = await db.insert(educatorPresentations).values({
          ...input,
          createdByUserId: ctx.user.id,
        });
        return { success: true, presentationId: (result as any).insertId as number };
      }
    }),

  // ── Announcements ────────────────────────────────────────────────────────────

  /** Get announcements for an org */
  getAnnouncements: protectedProcedure
    .input(z.object({ orgId: z.number(), courseId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgMember(ctx.user.id, input.orgId, appRoles);
      return db
        .select()
        .from(educatorAnnouncements)
        .where(
          and(
            eq(educatorAnnouncements.orgId, input.orgId),
            input.courseId ? eq(educatorAnnouncements.courseId, input.courseId) : sql`1=1`
          )
        )
        .orderBy(desc(educatorAnnouncements.isPinned), desc(educatorAnnouncements.createdAt));
    }),

  /** Create an announcement */
  createAnnouncement: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        courseId: z.number().optional(),
        title: z.string().min(1).max(300),
        content: z.string().min(1),
        isPinned: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);
      const [result] = await db.insert(educatorAnnouncements).values({
        ...input,
        createdByUserId: ctx.user.id,
        isPinned: input.isPinned ?? false,
      });
      return { success: true, announcementId: (result as any).insertId as number };
    }),

  // ── Analytics ────────────────────────────────────────────────────────────────

  /** Get org-level analytics summary */
  getOrgAnalytics: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      await requireOrgAdmin(ctx.user.id, input.orgId, appRoles);

      const [studentCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(educatorOrgMembers)
        .where(
          and(
            eq(educatorOrgMembers.orgId, input.orgId),
            eq(educatorOrgMembers.orgRole, "education_student"),
            eq(educatorOrgMembers.status, "active")
          )
        );

      const [courseCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(educatorCourses)
        .where(
          and(
            eq(educatorCourses.orgId, input.orgId),
            eq(educatorCourses.status, "published")
          )
        );

      const [completedCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(educatorStudentProgress)
        .where(
          and(
            eq(educatorStudentProgress.orgId, input.orgId),
            eq(educatorStudentProgress.status, "completed")
          )
        );

      const [avgScoreResult] = await db
        .select({ avg: sql<number>`AVG(score)` })
        .from(educatorStudentProgress)
        .where(
          and(
            eq(educatorStudentProgress.orgId, input.orgId),
            eq(educatorStudentProgress.status, "completed")
          )
        );

      const [quizAttempts] = await db
        .select({ count: sql<number>`count(*)`, passed: sql<number>`SUM(passed)` })
        .from(educatorQuizAttempts)
        .where(eq(educatorQuizAttempts.orgId, input.orgId));

      return {
        studentCount: studentCount?.count ?? 0,
        courseCount: courseCount?.count ?? 0,
        completedModules: completedCount?.count ?? 0,
        avgScore: Math.round(avgScoreResult?.avg ?? 0),
        quizAttempts: quizAttempts?.count ?? 0,
        quizPassRate:
          (quizAttempts?.count ?? 0) > 0
            ? Math.round(((quizAttempts?.passed ?? 0) / (quizAttempts?.count ?? 1)) * 100)
            : 0,
      };
    }),

  /** Get all orgs (education_manager or platform_admin only) */
  adminGetAllOrgs: protectedProcedure.query(async ({ ctx }) => {
    const db = (await getDb())!;
    const appRoles = await getUserAppRoles(ctx.user.id);
    if (!appRoles.includes("platform_admin") && !appRoles.includes("education_manager")) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db
      .select()
      .from(educatorOrgs)
      .orderBy(desc(educatorOrgs.createdAt));
  }),

  /** Assign education_manager role to a user (platform_admin only) */
  adminAssignEducationManager: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      if (!appRoles.includes("platform_admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform Admin access required." });
      }
      // Check if already assigned
      const existing = await db
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.userId, input.userId), eq(userRoles.role, "education_manager")))
        .limit(1);
      if (!existing[0]) {
        await db.insert(userRoles).values({
          userId: input.userId,
          role: "education_manager",
          assignedByUserId: ctx.user.id,
        });
      }
      return { success: true };
    }),

  /** Assign education_admin role to a user (platform_admin or education_manager only) */
  adminAssignEducationAdmin: protectedProcedure
    .input(z.object({ userId: z.number(), orgId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const appRoles = await getUserAppRoles(ctx.user.id);
      if (!appRoles.includes("platform_admin") && !appRoles.includes("education_manager")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const existing = await db
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.userId, input.userId), eq(userRoles.role, "education_admin")))
        .limit(1);
      if (!existing[0]) {
        await db.insert(userRoles).values({
          userId: input.userId,
          role: "education_admin",
          assignedByUserId: ctx.user.id,
        });
      }
      return { success: true };
    }),
});
