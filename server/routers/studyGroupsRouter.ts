import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getUserById, getUserByEmail, getUserRoles } from "../db";
import { getStripeClient } from "../lib/stripeClient";
import { sendEmail } from "../_core/email";
import { formatMysqlQueryError } from "../lib/mysqlQueryError";
import {
  digitalProducts,
  digitalPurchases,
  lmsCourses,
  lmsEnrollments,
  studyGroupActivity,
  studyGroupContentAccess,
  studyGroupContentAssignments,
  studyGroupDocuments,
  studyGroupMembers,
  studyGroupMessages,
  studyGroupModules,
  studyGroups,
  studyGroupTasks,
  studyGroupWorkspaceBlocks,
  users,
} from "../../drizzle/schema";

export const STUDY_GROUP_FREE_SEAT_LIMIT = 5;
export const STUDY_GROUP_ORGANIZATION_MONTHLY_CENTS = 9900;
export const STUDY_GROUP_CONTENT_DISCOUNT_PERCENT = 10;
const GROUP_WORKSPACE_BLOCK_KEY = "group_workspace_top";

const meetingProviderSchema = z.enum(["zoom", "teams", "other"]);
const meetingInputSchema = z.object({
  meetingProvider: meetingProviderSchema.nullable().optional(),
  meetingUrl: z.string().url().max(2048).nullable().optional(),
});

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function getSafeStudyGroupOrigin(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const localPreview = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".manus.computer");
  const approvedProductionHost = [
    "learn.allaboutultrasound.com",
    "app.allaboutultrasound.com",
    "app.iheartecho.com",
    "app.iheartecho.net",
  ].includes(hostname);
  if (!approvedProductionHost && !localPreview) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Study Group links must use an approved Learn platform address." });
  }
  if (!localPreview && url.protocol !== "https:") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Study Group links must use HTTPS." });
  }
  return url.origin;
}

function toCents(value: string | number | null | undefined) {
  const dollars = typeof value === "number" ? value : Number(value ?? 0);
  return Math.max(0, Math.round(dollars * 100));
}

function displayName(user: { displayName?: string | null; name?: string | null; email?: string | null }) {
  return user.displayName || user.name || user.email || "Study group member";
}

function createInviteToken() {
  return `${randomUUID().replaceAll("-", "")}${Date.now().toString(36)}`;
}

function validateMeeting(input: z.infer<typeof meetingInputSchema>) {
  if (!input.meetingUrl && !input.meetingProvider) return;
  if (!input.meetingUrl || !input.meetingProvider) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Select a meeting provider and enter its secure meeting link." });
  }
  let url: URL;
  try { url = new URL(input.meetingUrl); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid HTTPS meeting link." }); }
  if (url.protocol !== "https:") throw new TRPCError({ code: "BAD_REQUEST", message: "Meeting links must use HTTPS." });
  const host = url.hostname.toLowerCase();
  if (input.meetingProvider === "zoom" && !(host === "zoom.us" || host.endsWith(".zoom.us"))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Use a Zoom meeting link for Zoom meetings." });
  }
  if (input.meetingProvider === "teams" && !["teams.microsoft.com", "teams.live.com"].some(domain => host === domain || host.endsWith(`.${domain}`))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Use a Microsoft Teams meeting link for Teams meetings." });
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Study Groups are temporarily unavailable." });
  return db;
}

async function isPlatformAdmin(userId: number, legacyRole?: string | null) {
  if (legacyRole === "admin") return true;
  const roles = await getUserRoles(userId);
  return roles.some(role => ["platform_admin", "platform_owner"].includes(role));
}

async function requirePlatformAdmin(userId: number, legacyRole?: string | null) {
  if (!await isPlatformAdmin(userId, legacyRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform Admin access is required." });
  }
}

async function getActorEmail(userId: number) {
  const user = await getUserById(userId);
  const email = user?.email ? normalizedEmail(user.email) : null;
  if (!email) throw new TRPCError({ code: "BAD_REQUEST", message: "Add an email address to the account before creating or joining a study group." });
  return { email, user };
}

async function getGroupOrThrow(db: Awaited<ReturnType<typeof getDb>>, groupId: number) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [group] = await db.select().from(studyGroups).where(eq(studyGroups.id, groupId)).limit(1);
  if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Study group not found." });
  return group;
}

async function getMembership(db: Awaited<ReturnType<typeof getDb>>, groupId: number, userId: number) {
  if (!db) return null;
  const [membership] = await db.select().from(studyGroupMembers)
    .where(and(eq(studyGroupMembers.groupId, groupId), eq(studyGroupMembers.userId, userId), eq(studyGroupMembers.inviteStatus, "active")))
    .limit(1);
  return membership ?? null;
}

function membershipCanManage(role: "owner" | "org_admin" | "member") {
  return role === "owner" || role === "org_admin";
}

async function requireGroupAccess(
  db: Awaited<ReturnType<typeof getDb>>,
  groupId: number,
  userId: number,
  legacyRole?: string | null,
  options: { manage?: boolean } = {},
) {
  const group = await getGroupOrThrow(db, groupId);
  const platformAdmin = await isPlatformAdmin(userId, legacyRole);
  const membership = await getMembership(db, groupId, userId);
  if (!platformAdmin && !membership) throw new TRPCError({ code: "FORBIDDEN", message: "This study group is private." });
  if (options.manage && !platformAdmin && (!membership || !membershipCanManage(membership.role))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A group administrator role is required." });
  }
  return { group, membership, platformAdmin, canManage: platformAdmin || Boolean(membership && membershipCanManage(membership.role)) };
}

function hasActiveOrganization(group: typeof studyGroups.$inferSelect) {
  return group.tier === "organization" && group.status === "active";
}

async function activeSeatCount(db: Awaited<ReturnType<typeof getDb>>, groupId: number) {
  if (!db) return 0;
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(studyGroupMembers)
    .where(and(eq(studyGroupMembers.groupId, groupId), inArray(studyGroupMembers.inviteStatus, ["active", "pending"])));
  return Number(row?.count ?? 0);
}

async function recordActivity(
  db: Awaited<ReturnType<typeof getDb>>,
  groupId: number,
  actorUserId: number | null,
  action: string,
  summary: string,
  entityType?: string,
  entityId?: number,
) {
  if (!db) return;
  await db.insert(studyGroupActivity).values({ groupId, actorUserId, action, summary, entityType, entityId });
}

async function resolveGroupContent(
  db: Awaited<ReturnType<typeof getDb>>,
  input: { contentType: "course" | "quiz" | "download"; contentId: number },
) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  if (input.contentType === "download") {
    const [product] = await db.select().from(digitalProducts).where(and(
      eq(digitalProducts.id, input.contentId),
      eq(digitalProducts.status, "published"),
      eq(digitalProducts.bundleOnly, false),
    )).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "That downloadable content is not available for group access." });
    return { id: product.id, title: product.title, listPriceCents: toCents(product.price), productType: "download" as const, isFree: product.isFree };
  }
  const [course] = await db.select().from(lmsCourses).where(and(
    eq(lmsCourses.id, input.contentId),
    eq(lmsCourses.status, "public"),
    eq(lmsCourses.bundleOnly, false),
    eq(lmsCourses.type, input.contentType === "quiz" ? "quiz" : "course"),
  )).limit(1);
  if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "That course or quiz is not available for group access." });
  return { id: course.id, title: course.title, listPriceCents: toCents(course.price), productType: input.contentType, isFree: course.isFree };
}

async function grantGroupContentSeat(
  db: Awaited<ReturnType<typeof getDb>>,
  access: typeof studyGroupContentAccess.$inferSelect,
  userId: number,
  assignedByUserId: number,
) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [existingAssignment] = await db.select().from(studyGroupContentAssignments)
    .where(and(eq(studyGroupContentAssignments.contentAccessId, access.id), eq(studyGroupContentAssignments.userId, userId)))
    .limit(1);
  if (existingAssignment && !existingAssignment.revokedAt) return existingAssignment;

  let sourceEntitlementId: number | null = null;
  if (access.contentType === "download") {
    const [existingPurchase] = await db.select().from(digitalPurchases)
      .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, access.contentId), eq(digitalPurchases.status, "open")))
      .limit(1);
    if (existingPurchase) {
      sourceEntitlementId = existingPurchase.id;
    } else {
      const inserted = await db.insert(digitalPurchases).values({
        userId,
        productId: access.contentId,
        amount: 0,
        status: "open",
        // Dedicated provenance prevents a later seat revocation from touching a
        // separate direct or membership-derived download purchase.
        stripeCheckoutSessionId: `study_group_access_${access.id}`,
        maxDownloadsPerFile: null,
      }).$returningId();
      sourceEntitlementId = inserted[0]?.id ?? null;
    }
  } else {
    const [existingEnrollment] = await db.select().from(lmsEnrollments)
      .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, access.contentId)))
      .limit(1);
    if (existingEnrollment) {
      sourceEntitlementId = existingEnrollment.id;
    } else {
      const inserted = await db.insert(lmsEnrollments).values({
        userId,
        courseId: access.contentId,
        groupId: access.groupId,
        source: "study_group",
        enrollmentType: "full",
      }).$returningId();
      sourceEntitlementId = inserted[0]?.id ?? null;
    }
  }

  if (existingAssignment) {
    await db.update(studyGroupContentAssignments).set({ revokedAt: null, assignedByUserId, sourceEntitlementId })
      .where(eq(studyGroupContentAssignments.id, existingAssignment.id));
    return { ...existingAssignment, revokedAt: null, sourceEntitlementId };
  }
  const inserted = await db.insert(studyGroupContentAssignments).values({
    contentAccessId: access.id,
    userId,
    assignedByUserId,
    sourceEntitlementId,
  }).$returningId();
  return { id: inserted[0]?.id ?? 0, sourceEntitlementId };
}

async function revokeGroupContentSeat(db: Awaited<ReturnType<typeof getDb>>, assignment: typeof studyGroupContentAssignments.$inferSelect, access: typeof studyGroupContentAccess.$inferSelect) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db.update(studyGroupContentAssignments).set({ revokedAt: new Date() }).where(eq(studyGroupContentAssignments.id, assignment.id));
  if (!assignment.sourceEntitlementId) return;
  if (access.contentType === "download") {
    await db.update(digitalPurchases).set({ status: "revoked" }).where(and(
      eq(digitalPurchases.id, assignment.sourceEntitlementId),
      eq(digitalPurchases.stripeCheckoutSessionId, `study_group_access_${access.id}`),
    ));
  } else {
    await db.delete(lmsEnrollments).where(and(
      eq(lmsEnrollments.id, assignment.sourceEntitlementId),
      eq(lmsEnrollments.source, "study_group"),
      eq(lmsEnrollments.groupId, access.groupId),
    ));
  }
}

const groupIdSchema = z.object({ groupId: z.number().int().positive() });

export const studyGroupsRouter = router({
  pricing: protectedProcedure.query(() => ({
    freeSeatLimit: STUDY_GROUP_FREE_SEAT_LIMIT,
    organizationMonthlyCents: STUDY_GROUP_ORGANIZATION_MONTHLY_CENTS,
    contentDiscountPercent: STUDY_GROUP_CONTENT_DISCOUNT_PERCENT,
    meetingProviders: ["Zoom", "Microsoft Teams"],
  })),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const memberships = await db.select().from(studyGroupMembers)
      .where(and(eq(studyGroupMembers.userId, ctx.user.id), eq(studyGroupMembers.inviteStatus, "active")));
    const ids = memberships.map(row => row.groupId);
    const platformAdmin = await isPlatformAdmin(ctx.user.id, ctx.user.role);
    const groups = platformAdmin
      ? await db.select().from(studyGroups).where(eq(studyGroups.status, "active")).orderBy(desc(studyGroups.updatedAt))
      : ids.length ? await db.select().from(studyGroups).where(inArray(studyGroups.id, ids)).orderBy(desc(studyGroups.updatedAt)) : [];
    const membershipByGroup = new Map(memberships.map(row => [row.groupId, row]));
    return groups.map(group => ({ ...group, membership: membershipByGroup.get(group.id) ?? null, isOrganizationActive: hasActiveOrganization(group) }));
  }),

  create: protectedProcedure.input(z.object({
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(5000).optional(),
    organizationName: z.string().trim().max(200).optional(),
    ...meetingInputSchema.shape,
  })).mutation(async ({ ctx, input }) => {
    validateMeeting(input);
    const db = await requireDb();
    const actor = await getActorEmail(ctx.user.id);
    let groupId: number;
    try {
      const insertResult = await db.insert(studyGroups).values({
        createdByUserId: ctx.user.id,
        name: input.name,
        description: input.description || null,
        organizationName: input.organizationName || null,
        meetingProvider: input.meetingProvider ?? null,
        meetingUrl: input.meetingUrl ?? null,
        seatLimit: STUDY_GROUP_FREE_SEAT_LIMIT,
      });
      groupId = Number((insertResult as unknown as { insertId: number }).insertId);
      if (!Number.isInteger(groupId) || groupId <= 0) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create study group." });
      }
      await db.insert(studyGroupMembers).values({
        groupId,
        userId: ctx.user.id,
        email: actor.email,
        role: "owner",
        inviteStatus: "active",
        invitedByUserId: ctx.user.id,
        joinedAt: new Date(),
      });
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      console.error("[studyGroups.create]", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: formatMysqlQueryError(err, "Could not create study group"),
      });
    }
    await recordActivity(db, groupId, ctx.user.id, "group_created", `${displayName(actor.user ?? {})} created the group.`);
    return { groupId };
  }),

  getWorkspace: protectedProcedure.input(groupIdSchema).query(async ({ ctx, input }) => {
    const db = await requireDb();
    const access = await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role);
    const [members, documents, tasks, messages, modules, activities, contentAccesses, workspaceBlockRows] = await Promise.all([
      db.select({ membership: studyGroupMembers, name: users.name, displayName: users.displayName })
        .from(studyGroupMembers).leftJoin(users, eq(users.id, studyGroupMembers.userId))
        .where(eq(studyGroupMembers.groupId, input.groupId)).orderBy(asc(studyGroupMembers.createdAt)),
      db.select().from(studyGroupDocuments).where(eq(studyGroupDocuments.groupId, input.groupId)).orderBy(desc(studyGroupDocuments.createdAt)),
      db.select().from(studyGroupTasks).where(eq(studyGroupTasks.groupId, input.groupId)).orderBy(asc(studyGroupTasks.status), asc(studyGroupTasks.dueAt)),
      db.select({ message: studyGroupMessages, name: users.name, displayName: users.displayName })
        .from(studyGroupMessages).leftJoin(users, eq(users.id, studyGroupMessages.userId))
        .where(eq(studyGroupMessages.groupId, input.groupId)).orderBy(asc(studyGroupMessages.createdAt)).limit(200),
      hasActiveOrganization(access.group) || access.platformAdmin
        ? db.select().from(studyGroupModules).where(eq(studyGroupModules.groupId, input.groupId)).orderBy(asc(studyGroupModules.sortOrder))
        : Promise.resolve([]),
      access.canManage || access.platformAdmin
        ? db.select().from(studyGroupActivity).where(eq(studyGroupActivity.groupId, input.groupId)).orderBy(desc(studyGroupActivity.createdAt)).limit(100)
        : Promise.resolve([]),
      access.canManage || access.platformAdmin
        ? db.select().from(studyGroupContentAccess).where(eq(studyGroupContentAccess.groupId, input.groupId)).orderBy(desc(studyGroupContentAccess.createdAt))
        : Promise.resolve([]),
      db.select().from(studyGroupWorkspaceBlocks).where(eq(studyGroupWorkspaceBlocks.blockKey, GROUP_WORKSPACE_BLOCK_KEY)).limit(1),
    ]);
    const contentAccessIds = contentAccesses.map(item => item.id);
    const assignments = contentAccessIds.length
      ? await db.select().from(studyGroupContentAssignments).where(inArray(studyGroupContentAssignments.contentAccessId, contentAccessIds))
      : [];
    return {
      group: { ...access.group, isOrganizationActive: hasActiveOrganization(access.group) },
      permissions: { canManage: access.canManage, isPlatformAdmin: access.platformAdmin, memberRole: access.membership?.role ?? null },
      // Learners collaborate in discussion, but the membership roster and seat counts
      // remain visible only to group managers and effective Platform Admins.
      members: access.canManage ? members.map(row => ({ ...row.membership, displayName: row.displayName || row.name || row.membership.email })) : [],
      documents: documents.map(({ storageKey: _storageKey, fileUrl: _fileUrl, ...document }) => document),
      tasks,
      messages: messages.map(row => ({ ...row.message, authorName: row.displayName || row.name || "Group member" })),
      modules,
      activities,
      contentAccesses: contentAccesses.map(item => ({ ...item, assignments: assignments.filter(assignment => assignment.contentAccessId === item.id) })),
      workspaceBlocks: workspaceBlockRows[0]?.blocksJson ?? "[]",
    };
  }),

  update: protectedProcedure.input(groupIdSchema.extend({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    organizationName: z.string().trim().max(200).nullable().optional(),
    ...meetingInputSchema.shape,
  })).mutation(async ({ ctx, input }) => {
    validateMeeting(input);
    const db = await requireDb();
    const access = await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description || null;
    if (input.organizationName !== undefined) updates.organizationName = input.organizationName || null;
    if (input.meetingProvider !== undefined) updates.meetingProvider = input.meetingProvider;
    if (input.meetingUrl !== undefined) updates.meetingUrl = input.meetingUrl;
    if (Object.keys(updates).length) await db.update(studyGroups).set(updates).where(eq(studyGroups.id, input.groupId));
    await recordActivity(db, input.groupId, ctx.user.id, "group_updated", "Group settings were updated.");
    return { ok: true, isOrganizationActive: hasActiveOrganization(access.group) };
  }),

  inviteByEmail: protectedProcedure.input(groupIdSchema.extend({
    email: z.string().email().max(320),
    role: z.enum(["member", "org_admin"]).default("member"),
    origin: z.string().url().max(1024),
  })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const access = await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    if (input.role === "org_admin" && !hasActiveOrganization(access.group)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Organization admin seats require an active Study Groups Organization plan." });
    }
    const email = normalizedEmail(input.email);
    const [existing] = await db.select().from(studyGroupMembers)
      .where(and(eq(studyGroupMembers.groupId, input.groupId), eq(studyGroupMembers.email, email))).limit(1);
    if (!existing && !hasActiveOrganization(access.group) && await activeSeatCount(db, input.groupId) >= STUDY_GROUP_FREE_SEAT_LIMIT) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Free study groups support up to ${STUDY_GROUP_FREE_SEAT_LIMIT} participants. Upgrade to Organization for unlimited seats.` });
    }
    const invitedUser = await getUserByEmail(email);
    if (!invitedUser) {
      throw new TRPCError({ code: "NOT_FOUND", message: "That email does not belong to a platform learner. Ask the learner to create a free account first." });
    }
    const token = createInviteToken();
    if (existing) {
      if (existing.inviteStatus === "active") throw new TRPCError({ code: "CONFLICT", message: "That learner already belongs to this study group." });
      await db.update(studyGroupMembers).set({ userId: invitedUser.id, role: input.role, inviteStatus: "pending", inviteToken: token, invitedByUserId: ctx.user.id, revokedAt: null })
        .where(eq(studyGroupMembers.id, existing.id));
    } else {
      await db.insert(studyGroupMembers).values({ groupId: input.groupId, userId: invitedUser.id, email, role: input.role, inviteStatus: "pending", inviteToken: token, invitedByUserId: ctx.user.id });
    }
    const safeOrigin = getSafeStudyGroupOrigin(input.origin);
    const inviteUrl = `${safeOrigin}/study-groups/invite?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: email,
      subject: `You've been invited to the ${access.group.name} Study Group`,
      html: `<p>You have been invited to join <strong>${access.group.name}</strong> on Learn.</p><p><a href="${inviteUrl}">Open your private study group invitation</a></p><p>Sign in with this invited email address to accept. The group uses private email invitations and does not reveal the member directory outside the group.</p>`,
    });
    await recordActivity(db, input.groupId, ctx.user.id, "member_invited", `An invitation was sent to ${email}.`, "member");
    return { ok: true };
  }),

  acceptInvite: protectedProcedure.input(z.object({ token: z.string().min(20).max(180) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const actor = await getActorEmail(ctx.user.id);
    const [invite] = await db.select().from(studyGroupMembers)
      .where(and(eq(studyGroupMembers.inviteToken, input.token), eq(studyGroupMembers.inviteStatus, "pending"))).limit(1);
    if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "This invitation is no longer available." });
    if (normalizedEmail(invite.email) !== actor.email) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Sign in with the invited email address to accept this group invitation." });
    }
    await db.update(studyGroupMembers).set({ userId: ctx.user.id, inviteStatus: "active", joinedAt: new Date(), inviteToken: null })
      .where(eq(studyGroupMembers.id, invite.id));
    await recordActivity(db, invite.groupId, ctx.user.id, "member_joined", `${displayName(actor.user ?? {})} joined the group.`, "member", invite.id);
    return { groupId: invite.groupId };
  }),

  revokeMember: protectedProcedure.input(groupIdSchema.extend({ memberId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    const [member] = await db.select().from(studyGroupMembers).where(and(eq(studyGroupMembers.id, input.memberId), eq(studyGroupMembers.groupId, input.groupId))).limit(1);
    if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
    if (member.role === "owner") throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer or archive the group instead of removing its owner." });
    await db.update(studyGroupMembers).set({ inviteStatus: "revoked", revokedAt: new Date(), inviteToken: null }).where(eq(studyGroupMembers.id, member.id));
    await recordActivity(db, input.groupId, ctx.user.id, "member_revoked", `Access was removed for ${member.email}.`, "member", member.id);
    return { ok: true };
  }),

  createTask: protectedProcedure.input(groupIdSchema.extend({ title: z.string().trim().min(1).max(300), description: z.string().max(5000).optional(), assignedToUserId: z.number().int().positive().nullable().optional(), dueAt: z.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role);
    if (input.assignedToUserId) {
      const membership = await getMembership(db, input.groupId, input.assignedToUserId);
      if (!membership) throw new TRPCError({ code: "BAD_REQUEST", message: "Tasks can be assigned only to active group members." });
    }
    const inserted = await db.insert(studyGroupTasks).values({ groupId: input.groupId, title: input.title, description: input.description || null, assignedToUserId: input.assignedToUserId ?? null, dueAt: input.dueAt ?? null, createdByUserId: ctx.user.id }).$returningId();
    const id = inserted[0]?.id ?? 0;
    await recordActivity(db, input.groupId, ctx.user.id, "task_created", `Added task: ${input.title}`, "task", id);
    return { id };
  }),

  updateTask: protectedProcedure.input(groupIdSchema.extend({ taskId: z.number().int().positive(), title: z.string().trim().min(1).max(300).optional(), description: z.string().max(5000).nullable().optional(), status: z.enum(["todo", "in_progress", "done"]).optional(), assignedToUserId: z.number().int().positive().nullable().optional(), dueAt: z.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role);
    const [task] = await db.select().from(studyGroupTasks).where(and(eq(studyGroupTasks.id, input.taskId), eq(studyGroupTasks.groupId, input.groupId))).limit(1);
    if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description || null;
    if (input.status !== undefined) { updates.status = input.status; updates.completedAt = input.status === "done" ? new Date() : null; }
    if (input.assignedToUserId !== undefined) updates.assignedToUserId = input.assignedToUserId;
    if (input.dueAt !== undefined) updates.dueAt = input.dueAt;
    await db.update(studyGroupTasks).set(updates).where(eq(studyGroupTasks.id, task.id));
    await recordActivity(db, input.groupId, ctx.user.id, "task_updated", `Updated task: ${task.title}`, "task", task.id);
    return { ok: true };
  }),

  postMessage: protectedProcedure.input(groupIdSchema.extend({ body: z.string().trim().min(1).max(8000) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role);
    const inserted = await db.insert(studyGroupMessages).values({ groupId: input.groupId, userId: ctx.user.id, body: input.body }).$returningId();
    const id = inserted[0]?.id ?? 0;
    await recordActivity(db, input.groupId, ctx.user.id, "message_posted", "Posted a discussion message.", "message", id);
    return { id };
  }),

  removeDocument: protectedProcedure.input(groupIdSchema.extend({ documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    const [document] = await db.select().from(studyGroupDocuments)
      .where(and(eq(studyGroupDocuments.id, input.documentId), eq(studyGroupDocuments.groupId, input.groupId))).limit(1);
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
    // The object is retained in private storage for existing audit consistency; the private
    // workspace record is removed so no group member can discover or download it.
    await db.delete(studyGroupDocuments).where(eq(studyGroupDocuments.id, document.id));
    await recordActivity(db, input.groupId, ctx.user.id, "document_removed", `Removed document: ${document.title}`, "document", document.id);
    return { ok: true };
  }),

  createModule: protectedProcedure.input(groupIdSchema.extend({ title: z.string().trim().min(1).max(300), content: z.string().max(100_000).optional(), sortOrder: z.number().int().min(0).default(0) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const access = await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    if (!hasActiveOrganization(access.group) && !access.platformAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Organization access is required to create group learning modules." });
    const inserted = await db.insert(studyGroupModules).values({ groupId: input.groupId, title: input.title, content: input.content || null, sortOrder: input.sortOrder, createdByUserId: ctx.user.id }).$returningId();
    const id = inserted[0]?.id ?? 0;
    await recordActivity(db, input.groupId, ctx.user.id, "module_created", `Added group module: ${input.title}`, "module", id);
    return { id };
  }),

  listContentCatalog: protectedProcedure.input(groupIdSchema).query(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    const [courses, downloads] = await Promise.all([
      db.select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type, price: lmsCourses.price, isFree: lmsCourses.isFree, thumbnailUrl: lmsCourses.thumbnailUrl })
        .from(lmsCourses).where(and(eq(lmsCourses.status, "public"), eq(lmsCourses.showInLibrary, true), eq(lmsCourses.bundleOnly, false), inArray(lmsCourses.type, ["course", "quiz"]))),
      db.select({ id: digitalProducts.id, title: digitalProducts.title, price: digitalProducts.price, isFree: digitalProducts.isFree, thumbnailUrl: digitalProducts.thumbnailUrl })
        .from(digitalProducts).where(and(eq(digitalProducts.status, "published"), eq(digitalProducts.showInLibrary, true), eq(digitalProducts.bundleOnly, false))),
    ]);
    return [
      ...courses.map(item => ({ ...item, contentType: item.type === "quiz" ? "quiz" as const : "course" as const, listPriceCents: toCents(item.price), discountedPriceCents: Math.round(toCents(item.price) * 0.9) })),
      ...downloads.map(item => ({ ...item, contentType: "download" as const, listPriceCents: toCents(item.price), discountedPriceCents: Math.round(toCents(item.price) * 0.9) })),
    ];
  }),

  createContentCheckout: protectedProcedure.input(groupIdSchema.extend({ contentType: z.enum(["course", "quiz", "download"]), contentId: z.number().int().positive(), seatCount: z.number().int().min(1).max(500), origin: z.string().url().max(1024) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const access = await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    const activeMembers = await activeSeatCount(db, input.groupId);
    if (input.seatCount > activeMembers) throw new TRPCError({ code: "BAD_REQUEST", message: "Buy no more group-content seats than active or invited group participants." });
    const content = await resolveGroupContent(db, input);
    const listPriceCents = content.listPriceCents * input.seatCount;
    const discountedPriceCents = Math.round(listPriceCents * (1 - STUDY_GROUP_CONTENT_DISCOUNT_PERCENT / 100));
    if (content.isFree || discountedPriceCents === 0) {
      const inserted = await db.insert(studyGroupContentAccess).values({ groupId: input.groupId, contentType: input.contentType, contentId: input.contentId, contentTitle: content.title, seatLimit: input.seatCount, listPriceCents, discountedPriceCents, status: "active", purchasedByUserId: ctx.user.id }).$returningId();
      await recordActivity(db, input.groupId, ctx.user.id, "content_added", `Added free group access to ${content.title}.`, "content_access", inserted[0]?.id);
      return { free: true, contentAccessId: inserted[0]?.id ?? 0 };
    }
    const stripe = getStripeClient();
    const origin = getSafeStudyGroupOrigin(input.origin);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: (await getActorEmail(ctx.user.id)).email,
      client_reference_id: String(ctx.user.id),
      line_items: [{
        quantity: input.seatCount,
        price_data: { currency: "usd", unit_amount: Math.round(content.listPriceCents * 0.9), product_data: { name: `${content.title} — Study Group access (10% group discount)` } },
      }],
      metadata: {
        checkout_type: "study_group_content",
        user_id: String(ctx.user.id),
        study_group_id: String(input.groupId),
        content_type: input.contentType,
        content_id: String(input.contentId),
        content_title: content.title.slice(0, 400),
        seat_count: String(input.seatCount),
        list_price_cents: String(listPriceCents),
        discounted_price_cents: String(discountedPriceCents),
      },
      success_url: `${origin}/study-groups/${input.groupId}?purchase=success`,
      cancel_url: `${origin}/study-groups/${input.groupId}?purchase=canceled`,
      allow_promotion_codes: true,
    });
    if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to start secure checkout." });
    return { free: false, checkoutUrl: session.url, discountedPriceCents, listPriceCents };
  }),

  assignContentSeat: protectedProcedure.input(groupIdSchema.extend({ contentAccessId: z.number().int().positive(), userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    const [contentAccess] = await db.select().from(studyGroupContentAccess).where(and(eq(studyGroupContentAccess.id, input.contentAccessId), eq(studyGroupContentAccess.groupId, input.groupId), eq(studyGroupContentAccess.status, "active"))).limit(1);
    if (!contentAccess) throw new TRPCError({ code: "NOT_FOUND", message: "Active group content access not found." });
    const membership = await getMembership(db, input.groupId, input.userId);
    if (!membership) throw new TRPCError({ code: "BAD_REQUEST", message: "Content can be assigned only to an active group member." });
    const activeAssignments = await db.select({ count: sql<number>`COUNT(*)` }).from(studyGroupContentAssignments).where(and(eq(studyGroupContentAssignments.contentAccessId, contentAccess.id), isNull(studyGroupContentAssignments.revokedAt)));
    const [existing] = await db.select().from(studyGroupContentAssignments).where(and(eq(studyGroupContentAssignments.contentAccessId, contentAccess.id), eq(studyGroupContentAssignments.userId, input.userId), isNull(studyGroupContentAssignments.revokedAt))).limit(1);
    if (!existing && Number(activeAssignments[0]?.count ?? 0) >= contentAccess.seatLimit) throw new TRPCError({ code: "BAD_REQUEST", message: "All purchased content seats are already assigned." });
    const assignment = await grantGroupContentSeat(db, contentAccess, input.userId, ctx.user.id);
    await recordActivity(db, input.groupId, ctx.user.id, "content_seat_assigned", `Assigned ${contentAccess.contentTitle} to a group member.`, "content_assignment", assignment.id);
    return { ok: true };
  }),

  revokeContentSeat: protectedProcedure.input(groupIdSchema.extend({ contentAccessId: z.number().int().positive(), userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    const [contentAccess] = await db.select().from(studyGroupContentAccess).where(and(eq(studyGroupContentAccess.id, input.contentAccessId), eq(studyGroupContentAccess.groupId, input.groupId))).limit(1);
    const [assignment] = await db.select().from(studyGroupContentAssignments).where(and(eq(studyGroupContentAssignments.contentAccessId, input.contentAccessId), eq(studyGroupContentAssignments.userId, input.userId), isNull(studyGroupContentAssignments.revokedAt))).limit(1);
    if (!contentAccess || !assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Active group content assignment not found." });
    await revokeGroupContentSeat(db, assignment, contentAccess);
    await recordActivity(db, input.groupId, ctx.user.id, "content_seat_revoked", `Removed group access to ${contentAccess.contentTitle}.`, "content_assignment", assignment.id);
    return { ok: true };
  }),

  createOrganizationCheckout: protectedProcedure.input(groupIdSchema.extend({ origin: z.string().url().max(1024) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const access = await requireGroupAccess(db, input.groupId, ctx.user.id, ctx.user.role, { manage: true });
    if (hasActiveOrganization(access.group)) throw new TRPCError({ code: "CONFLICT", message: "This group already has active Organization access." });
    const stripe = getStripeClient();
    const actor = await getActorEmail(ctx.user.id);
    const origin = getSafeStudyGroupOrigin(input.origin);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: actor.email,
      client_reference_id: String(ctx.user.id),
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: STUDY_GROUP_ORGANIZATION_MONTHLY_CENTS, recurring: { interval: "month" }, product_data: { name: "Study Groups Organization" } } }],
      metadata: { checkout_type: "study_group_organization", user_id: String(ctx.user.id), study_group_id: String(input.groupId) },
      subscription_data: { metadata: { checkout_type: "study_group_organization", study_group_id: String(input.groupId) } },
      success_url: `${origin}/study-groups/${input.groupId}?organization=success`,
      cancel_url: `${origin}/study-groups/${input.groupId}?organization=canceled`,
      allow_promotion_codes: true,
    });
    if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to start secure checkout." });
    return { checkoutUrl: session.url };
  }),

  getWorkspaceBlocks: protectedProcedure.query(async () => {
    const db = await requireDb();
    const [row] = await db.select().from(studyGroupWorkspaceBlocks).where(eq(studyGroupWorkspaceBlocks.blockKey, GROUP_WORKSPACE_BLOCK_KEY)).limit(1);
    return { blocksJson: row?.blocksJson ?? "[]" };
  }),

  saveWorkspaceBlocks: protectedProcedure.input(z.object({ blocksJson: z.string().max(500_000) })).mutation(async ({ ctx, input }) => {
    JSON.parse(input.blocksJson);
    const db = await requireDb();
    await requirePlatformAdmin(ctx.user.id, ctx.user.role);
    const [existing] = await db.select().from(studyGroupWorkspaceBlocks).where(eq(studyGroupWorkspaceBlocks.blockKey, GROUP_WORKSPACE_BLOCK_KEY)).limit(1);
    if (existing) await db.update(studyGroupWorkspaceBlocks).set({ blocksJson: input.blocksJson, updatedByUserId: ctx.user.id }).where(eq(studyGroupWorkspaceBlocks.id, existing.id));
    else await db.insert(studyGroupWorkspaceBlocks).values({ blockKey: GROUP_WORKSPACE_BLOCK_KEY, blocksJson: input.blocksJson, updatedByUserId: ctx.user.id });
    return { ok: true };
  }),

  adminListGroups: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    await requirePlatformAdmin(ctx.user.id, ctx.user.role);
    const groups = await db.select().from(studyGroups).orderBy(desc(studyGroups.updatedAt));
    const groupIds = groups.map(group => group.id);
    const [members, documents, activity] = groupIds.length ? await Promise.all([
      db.select().from(studyGroupMembers).where(inArray(studyGroupMembers.groupId, groupIds)),
      db.select().from(studyGroupDocuments).where(inArray(studyGroupDocuments.groupId, groupIds)),
      db.select().from(studyGroupActivity).where(inArray(studyGroupActivity.groupId, groupIds)).orderBy(desc(studyGroupActivity.createdAt)).limit(500),
    ]) : [[], [], []] as const;
    return groups.map(group => ({
      ...group,
      activeMembers: members.filter(member => member.groupId === group.id && member.inviteStatus === "active").length,
      documents: documents.filter(document => document.groupId === group.id),
      recentActivity: activity.filter(item => item.groupId === group.id).slice(0, 10),
    }));
  }),
});

/** Stripe webhook fulfillment for completed Study Group checkouts. */
export async function handleStudyGroupCheckoutCompleted(session: any) {
  const metadata = (session?.metadata ?? {}) as Record<string, string | undefined>;
  const checkoutType = metadata.checkout_type;
  const groupId = Number(metadata.study_group_id);
  const buyerId = Number(metadata.user_id);
  if (!groupId || !buyerId || !["study_group_organization", "study_group_content"].includes(checkoutType ?? "")) return false;
  const db = await getDb();
  if (!db) throw new Error("Study Groups database unavailable during checkout fulfillment.");
  const group = await getGroupOrThrow(db, groupId);
  if (checkoutType === "study_group_organization") {
    await db.update(studyGroups).set({
      tier: "organization",
      seatLimit: null,
      status: "active",
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
      stripeCheckoutSessionId: session.id ?? null,
    }).where(eq(studyGroups.id, group.id));
    await recordActivity(db, group.id, buyerId, "organization_activated", "Study Groups Organization access was activated.");
    return true;
  }
  const contentType = metadata.content_type as "course" | "quiz" | "download" | undefined;
  const contentId = Number(metadata.content_id);
  const seatLimit = Number(metadata.seat_count);
  if (!contentType || !contentId || !seatLimit) return false;
  const [existing] = await db.select().from(studyGroupContentAccess)
    .where(eq(studyGroupContentAccess.stripeCheckoutSessionId, session.id)).limit(1);
  if (existing) return true;
  const inserted = await db.insert(studyGroupContentAccess).values({
    groupId: group.id,
    contentType,
    contentId,
    contentTitle: (metadata.content_title || "Study group content").slice(0, 500),
    seatLimit,
    listPriceCents: Number(metadata.list_price_cents ?? 0),
    discountedPriceCents: Number(metadata.discounted_price_cents ?? 0),
    stripeCheckoutSessionId: session.id ?? null,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
    purchasedByUserId: buyerId,
  }).$returningId();
  await recordActivity(db, group.id, buyerId, "content_purchased", `Purchased ${seatLimit} discounted seats for ${metadata.content_title || "group content"}.`, "content_access", inserted[0]?.id);
  return true;
}

/** Stripe subscription lifecycle alignment for Study Groups Organization. */
export async function handleStudyGroupSubscriptionLifecycle(subscription: any) {
  const subscriptionId = typeof subscription?.id === "string" ? subscription.id : null;
  if (!subscriptionId) return false;
  const db = await getDb();
  if (!db) return false;
  const [group] = await db.select().from(studyGroups).where(eq(studyGroups.stripeSubscriptionId, subscriptionId)).limit(1);
  if (!group) return false;
  const stripeStatus = String(subscription.status ?? "");
  const active = stripeStatus === "active" || stripeStatus === "trialing";
  const currentPeriodEnd = subscription.current_period_end ? new Date(Number(subscription.current_period_end) * 1000) : null;
  await db.update(studyGroups).set({ status: active ? "active" : "canceled", currentPeriodEnd }).where(eq(studyGroups.id, group.id));
  await recordActivity(db, group.id, null, "organization_subscription_updated", active ? "Organization subscription is active." : "Organization subscription is no longer active.");
  return true;
}
