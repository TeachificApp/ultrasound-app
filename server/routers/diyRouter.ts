/**
 * DIY Accreditation Router
 *
 * Handles all DIY Accreditation membership operations:
 *  - Organization creation and management
 *  - Subscription tier management (Starter/Professional/Advanced/Partner)
 *  - Seat allotment enforcement (Lab Admin + DIY Member seats per tier)
 *  - SuperAdmin role (1 per org, occupies 1 Lab Admin seat)
 *  - Member invite, accept, revoke
 *  - Concierge add-on tracking + owner notification
 *  - Thinkific free membership enrollment on registration
 *  - Access gating helpers for frontend
 *
 * Seat allotment rules per tier:
 *   starter       — 5 total: 1 Lab Admin (incl. SuperAdmin) + 4 DIY Members
 *   professional  — 15 total: 2 Lab Admins + 13 DIY Members
 *   advanced      — 50 total: 5 Lab Admins + 45 DIY Members
 *   partner       — unlimited: up to 10 Lab Admins + unlimited DIY Members
 *
 * Permission matrix:
 *   super_admin  — all permissions + org settings + billing
 *   lab_admin    — manage workflows, upload policies, assign tasks, manage staff, view analytics/policy builder/case studies/readiness
 *   diy_member   — participate in case review, submit docs, complete workflow tasks (NO analytics, policy builder, case studies, readiness)
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, count, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  diyOrganizations,
  diySubscriptions,
  diyOrgMembers,
  diyConciergePurchases,
  users,
  userRoles,
} from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

// ─── Plan configuration ───────────────────────────────────────────────────────

export const DIY_PLANS = {
  starter: {
    name: "Accreditation Starter",
    price: "$397/mo",
    totalSeats: 5,
    labAdminSeats: 1,
    memberSeats: 4,
    isUnlimitedMembers: false,
    checkoutUrl: "https://member.allaboutultrasound.com/enroll/3706401?price_id=4655411",
    thinkificProductId: 3706401,
    bestFor: "Small labs, new echo labs, or single-location clinics beginning the accreditation process.",
  },
  professional: {
    name: "Accreditation Professional",
    price: "$997/mo",
    totalSeats: 15,
    labAdminSeats: 2,
    memberSeats: 13,
    isUnlimitedMembers: false,
    checkoutUrl: "https://member.allaboutultrasound.com/enroll/3706397?price_id=4655406",
    thinkificProductId: 3706397,
    bestFor: "Growing labs implementing structured QA/QI and peer review programs.",
  },
  advanced: {
    name: "Accreditation Advanced",
    price: "$1,697/mo",
    totalSeats: 50,
    labAdminSeats: 5,
    memberSeats: 45,
    isUnlimitedMembers: false,
    checkoutUrl: "https://member.allaboutultrasound.com/enroll/3706392?price_id=4655402",
    thinkificProductId: 3706392,
    bestFor: "Large labs, multi-site organizations, hospital departments, and IDTF groups.",
  },
  partner: {
    name: "Accreditation Partner",
    price: "$2,497/mo",
    totalSeats: 9999, // unlimited
    labAdminSeats: 10,
    memberSeats: 9999, // unlimited
    isUnlimitedMembers: true,
    checkoutUrl: "https://member.allaboutultrasound.com/enroll/3706344?price_id=4655349",
    thinkificProductId: 3706344,
    bestFor: "Labs that want ongoing expert guidance while using the platform.",
  },
} as const;

export const CONCIERGE_CHECKOUT_URL = "https://buy.stripe.com/7sYcN475Lcs94Nm3hH9R604";
export const THINKIFIC_FREE_MEMBERSHIP_URL = "https://member.allaboutultrasound.com/bundles/free-membership";

// ─── Permission helpers ───────────────────────────────────────────────────────

function buildPermissions(diyRole: "super_admin" | "lab_admin" | "diy_member") {
  if (diyRole === "super_admin" || diyRole === "lab_admin") {
    return {
      canManageWorkflows: true,
      canUploadPolicies: true,
      canAssignTasks: true,
      canManageStaff: true,
      canViewAnalytics: true,
      canViewPolicyBuilder: true,
      canViewCaseStudies: true,
      canViewReadiness: true,
    };
  }
  // diy_member: can participate in tasks but NOT analytics/policy builder/case studies/readiness
  return {
    canManageWorkflows: false,
    canUploadPolicies: false,
    canAssignTasks: false,
    canManageStaff: false,
    canViewAnalytics: false,
    canViewPolicyBuilder: false,
    canViewCaseStudies: false,
    canViewReadiness: false,
  };
}

// ─── Seat enforcement ─────────────────────────────────────────────────────────

async function checkSeatAvailability(
  db: Awaited<ReturnType<typeof getDb>>,
  subscriptionId: number,
  newRole: "lab_admin" | "diy_member"
): Promise<{ allowed: boolean; reason?: string }> {
  if (!db) return { allowed: false, reason: "Database unavailable" };

  const [sub] = await db
    .select()
    .from(diySubscriptions)
    .where(eq(diySubscriptions.id, subscriptionId))
    .limit(1);

  if (!sub || sub.status !== "active") {
    return { allowed: false, reason: "Subscription is not active" };
  }

  // Count current active members by role
  const [adminCount] = await db
    .select({ count: count() })
    .from(diyOrgMembers)
    .where(
      and(
        eq(diyOrgMembers.subscriptionId, subscriptionId),
        eq(diyOrgMembers.isActive, true),
        sql`${diyOrgMembers.diyRole} IN ('super_admin', 'lab_admin')`
      )
    );

  const [memberCount] = await db
    .select({ count: count() })
    .from(diyOrgMembers)
    .where(
      and(
        eq(diyOrgMembers.subscriptionId, subscriptionId),
        eq(diyOrgMembers.isActive, true),
        eq(diyOrgMembers.diyRole, "diy_member")
      )
    );

  const currentAdmins = adminCount?.count ?? 0;
  const currentMembers = memberCount?.count ?? 0;

  if (newRole === "lab_admin") {
    if (currentAdmins >= sub.labAdminSeats) {
      return {
        allowed: false,
        reason: `Lab Admin seat limit reached (${sub.labAdminSeats} seats for ${sub.plan} plan). Upgrade your plan to add more Lab Admins.`,
      };
    }
  } else {
    if (!sub.isUnlimitedMembers && currentMembers >= sub.memberSeats) {
      return {
        allowed: false,
        reason: `DIY Member seat limit reached (${sub.memberSeats} seats for ${sub.plan} plan). Upgrade your plan to add more members.`,
      };
    }
  }

  return { allowed: true };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const diyRouter = router({
  // ── Plan config (public — used by upgrade/sales pages) ──────────────────────
  getPlans: protectedProcedure.query(() => {
    return Object.entries(DIY_PLANS).map(([key, plan]) => ({
      id: key,
      ...plan,
    }));
  }),

  // ── Get current user's DIY context ──────────────────────────────────────────
  getMyContext: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Find org membership for this user
    const [membership] = await db
      .select()
      .from(diyOrgMembers)
      .where(
        and(
          eq(diyOrgMembers.userId, ctx.user.id),
          eq(diyOrgMembers.isActive, true),
          eq(diyOrgMembers.inviteStatus, "accepted")
        )
      )
      .limit(1);

    if (!membership) return null;

    const [org] = await db
      .select()
      .from(diyOrganizations)
      .where(eq(diyOrganizations.id, membership.orgId))
      .limit(1);

    const [sub] = await db
      .select()
      .from(diySubscriptions)
      .where(eq(diySubscriptions.id, membership.subscriptionId))
      .limit(1);

    return { membership, org, subscription: sub };
  }),

  // ── Create organization (called after successful Thinkific checkout) ─────────
  createOrg: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(300),
        address: z.string().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        accreditationTypes: z.array(z.enum(["adult_echo", "pediatric_fetal_echo"])).optional(),
        plan: z.enum(["starter", "professional", "advanced", "partner"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if user already owns an org
      const [existing] = await db
        .select()
        .from(diyOrganizations)
        .where(eq(diyOrganizations.ownerUserId, ctx.user.id))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an organization. Contact support to create additional organizations.",
        });
      }

      const planConfig = DIY_PLANS[input.plan];

      // Create org
      const [orgResult] = await db.insert(diyOrganizations).values({
        ownerUserId: ctx.user.id,
        name: input.name,
        address: input.address ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        accreditationTypes: input.accreditationTypes
          ? JSON.stringify(input.accreditationTypes)
          : null,
      });

      const orgId = (orgResult as any).insertId as number;

      // Create subscription
      const [subResult] = await db.insert(diySubscriptions).values({
        orgId,
        plan: input.plan,
        status: "active",
        totalSeats: planConfig.totalSeats,
        labAdminSeats: planConfig.labAdminSeats,
        memberSeats: planConfig.memberSeats,
        isUnlimitedMembers: planConfig.isUnlimitedMembers,
        thinkificProductId: planConfig.thinkificProductId,
      });

      const subscriptionId = (subResult as any).insertId as number;

      // Add owner as SuperAdmin (occupies 1 Lab Admin seat)
      await db.insert(diyOrgMembers).values({
        orgId,
        subscriptionId,
        userId: ctx.user.id,
        inviteEmail: ctx.user.email ?? "",
        displayName: ctx.user.name ?? ctx.user.displayName ?? null,
        diyRole: "super_admin",
        ...buildPermissions("super_admin"),
        inviteStatus: "accepted",
        joinedAt: new Date(),
        isActive: true,
      });

      // Grant diy_admin role in userRoles
      await db.insert(userRoles).values({
        userId: ctx.user.id,
        role: "diy_admin",
        grantedByLabId: orgId,
        assignedByUserId: ctx.user.id,
      });

      // Notify owner
      await notifyOwner({
        title: `New DIY Accreditation Org Created: ${input.name}`,
        content: `Plan: ${planConfig.name} (${planConfig.price})\nOrg: ${input.name}\nOwner: ${ctx.user.email ?? ctx.user.name}\nUser ID: ${ctx.user.id}`,
      });

      return { orgId, subscriptionId };
    }),

  // ── Get org details (SuperAdmin/Lab Admin only) ──────────────────────────────
  getOrgDetails: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [membership] = await db
      .select()
      .from(diyOrgMembers)
      .where(
        and(
          eq(diyOrgMembers.userId, ctx.user.id),
          eq(diyOrgMembers.isActive, true),
          eq(diyOrgMembers.inviteStatus, "accepted"),
          sql`${diyOrgMembers.diyRole} IN ('super_admin', 'lab_admin')`
        )
      )
      .limit(1);

    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Lab Admin access required" });
    }

    const [org] = await db
      .select()
      .from(diyOrganizations)
      .where(eq(diyOrganizations.id, membership.orgId))
      .limit(1);

    const [sub] = await db
      .select()
      .from(diySubscriptions)
      .where(eq(diySubscriptions.id, membership.subscriptionId))
      .limit(1);

    // Get all members
    const members = await db
      .select()
      .from(diyOrgMembers)
      .where(eq(diyOrgMembers.orgId, membership.orgId));

    // Seat usage
    const activeAdmins = members.filter(
      (m) => m.isActive && (m.diyRole === "super_admin" || m.diyRole === "lab_admin")
    ).length;
    const activeMembers = members.filter(
      (m) => m.isActive && m.diyRole === "diy_member"
    ).length;

    return {
      org,
      subscription: sub,
      members,
      seatUsage: {
        labAdminUsed: activeAdmins,
        labAdminTotal: sub?.labAdminSeats ?? 0,
        memberUsed: activeMembers,
        memberTotal: sub?.memberSeats ?? 0,
        isUnlimitedMembers: sub?.isUnlimitedMembers ?? false,
      },
      myRole: membership.diyRole,
    };
  }),

  // ── Invite member ────────────────────────────────────────────────────────────
  inviteMember: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        displayName: z.string().optional(),
        diyRole: z.enum(["lab_admin", "diy_member"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify inviter is SuperAdmin or Lab Admin
      const [inviterMembership] = await db
        .select()
        .from(diyOrgMembers)
        .where(
          and(
            eq(diyOrgMembers.userId, ctx.user.id),
            eq(diyOrgMembers.isActive, true),
            eq(diyOrgMembers.inviteStatus, "accepted"),
            sql`${diyOrgMembers.diyRole} IN ('super_admin', 'lab_admin')`
          )
        )
        .limit(1);

      if (!inviterMembership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Lab Admin access required to invite members" });
      }

      // Only SuperAdmin can invite Lab Admins
      if (input.diyRole === "lab_admin" && inviterMembership.diyRole !== "super_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the SuperAdmin can invite Lab Admins",
        });
      }

      // Check seat availability
      const seatCheck = await checkSeatAvailability(
        db,
        inviterMembership.subscriptionId,
        input.diyRole
      );

      if (!seatCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: seatCheck.reason });
      }

      // Check if already a member
      const [existing] = await db
        .select()
        .from(diyOrgMembers)
        .where(
          and(
            eq(diyOrgMembers.orgId, inviterMembership.orgId),
            eq(diyOrgMembers.inviteEmail, input.email)
          )
        )
        .limit(1);

      if (existing && existing.isActive) {
        throw new TRPCError({ code: "CONFLICT", message: "This email is already a member of your organization" });
      }

      const inviteToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

      await db.insert(diyOrgMembers).values({
        orgId: inviterMembership.orgId,
        subscriptionId: inviterMembership.subscriptionId,
        inviteEmail: input.email,
        displayName: input.displayName ?? null,
        diyRole: input.diyRole,
        ...buildPermissions(input.diyRole),
        inviteStatus: "pending",
        inviteToken,
        invitedByUserId: ctx.user.id,
        isActive: true,
      });

      return { success: true, inviteToken };
    }),

  // ── Accept invite (called when invited user registers/logs in) ───────────────
  acceptInvite: protectedProcedure
    .input(z.object({ inviteToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invite] = await db
        .select()
        .from(diyOrgMembers)
        .where(eq(diyOrgMembers.inviteToken, input.inviteToken))
        .limit(1);

      if (!invite || invite.inviteStatus !== "pending") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired invite token" });
      }

      // Verify email matches
      if (invite.inviteEmail.toLowerCase() !== (ctx.user.email ?? "").toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite was sent to a different email address",
        });
      }

      await db
        .update(diyOrgMembers)
        .set({
          userId: ctx.user.id,
          inviteStatus: "accepted",
          joinedAt: new Date(),
          inviteToken: null,
        })
        .where(eq(diyOrgMembers.id, invite.id));

      // Grant appropriate userRole
      const roleToGrant = invite.diyRole === "diy_member" ? "diy_user" : "diy_admin";
      await db.insert(userRoles).values({
        userId: ctx.user.id,
        role: roleToGrant,
        grantedByLabId: invite.orgId,
        assignedByUserId: invite.invitedByUserId ?? ctx.user.id,
      });

      return { success: true, diyRole: invite.diyRole };
    }),

  // ── Revoke member ────────────────────────────────────────────────────────────
  revokeMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify revoker is SuperAdmin
      const [revokerMembership] = await db
        .select()
        .from(diyOrgMembers)
        .where(
          and(
            eq(diyOrgMembers.userId, ctx.user.id),
            eq(diyOrgMembers.isActive, true),
            eq(diyOrgMembers.inviteStatus, "accepted"),
            eq(diyOrgMembers.diyRole, "super_admin")
          )
        )
        .limit(1);

      if (!revokerMembership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "SuperAdmin access required to revoke members" });
      }

      const [target] = await db
        .select()
        .from(diyOrgMembers)
        .where(
          and(
            eq(diyOrgMembers.id, input.memberId),
            eq(diyOrgMembers.orgId, revokerMembership.orgId)
          )
        )
        .limit(1);

      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.diyRole === "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot revoke the SuperAdmin" });
      }

      await db
        .update(diyOrgMembers)
        .set({ isActive: false, inviteStatus: "revoked" })
        .where(eq(diyOrgMembers.id, input.memberId));

      // Remove userRole if user has accepted
      if (target.userId) {
        const roleToRemove = target.diyRole === "diy_member" ? "diy_user" : "diy_admin";
        await db
          .delete(userRoles)
          .where(
            and(
              eq(userRoles.userId, target.userId),
              eq(userRoles.role, roleToRemove),
              eq(userRoles.grantedByLabId, revokerMembership.orgId)
            )
          );
      }

      return { success: true };
    }),

  // ── Record Concierge purchase + notify owner ─────────────────────────────────
  recordConciergePurchase: protectedProcedure
    .input(
      z.object({
        stripeSessionId: z.string().optional(),
        stripePaymentIntentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Find user's active subscription
      const [membership] = await db
        .select()
        .from(diyOrgMembers)
        .where(
          and(
            eq(diyOrgMembers.userId, ctx.user.id),
            eq(diyOrgMembers.isActive, true),
            eq(diyOrgMembers.inviteStatus, "accepted")
          )
        )
        .limit(1);

      if (!membership) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Accreditation Concierge is only available as an add-on to an active DIY Accreditation subscription.",
        });
      }

      const [sub] = await db
        .select()
        .from(diySubscriptions)
        .where(eq(diySubscriptions.id, membership.subscriptionId))
        .limit(1);

      if (!sub || sub.status !== "active") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "An active DIY Accreditation subscription is required to purchase Concierge.",
        });
      }

      // Record purchase
      await db.insert(diyConciergePurchases).values({
        orgId: membership.orgId,
        subscriptionId: membership.subscriptionId,
        purchaserUserId: ctx.user.id,
        purchaserEmail: ctx.user.email ?? null,
        stripeSessionId: input.stripeSessionId ?? null,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        amountCents: 499700,
        status: "complete",
        notificationSentAt: new Date(),
      });

      // Update subscription hasConcierge flag
      await db
        .update(diySubscriptions)
        .set({ hasConcierge: true, conciergeGrantedAt: new Date() })
        .where(eq(diySubscriptions.id, membership.subscriptionId));

      // Notify owner
      const [org] = await db
        .select()
        .from(diyOrganizations)
        .where(eq(diyOrganizations.id, membership.orgId))
        .limit(1);

      await notifyOwner({
        title: "🎉 Accreditation Concierge Purchase Processed",
        content: `A new Accreditation Concierge add-on ($4,997) has been purchased.\n\nOrg: ${org?.name ?? "Unknown"}\nPurchaser: ${ctx.user.email ?? ctx.user.name}\nUser ID: ${ctx.user.id}\nStripe Session: ${input.stripeSessionId ?? "N/A"}\nStripe Payment Intent: ${input.stripePaymentIntentId ?? "N/A"}`,
      });

      return { success: true };
    }),

  // ── Check if Concierge is available (has active subscription) ───────────────
  canPurchaseConcierge: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { allowed: false };

    const [membership] = await db
      .select()
      .from(diyOrgMembers)
      .where(
        and(
          eq(diyOrgMembers.userId, ctx.user.id),
          eq(diyOrgMembers.isActive, true),
          eq(diyOrgMembers.inviteStatus, "accepted")
        )
      )
      .limit(1);

    if (!membership) return { allowed: false };

    const [sub] = await db
      .select()
      .from(diySubscriptions)
      .where(eq(diySubscriptions.id, membership.subscriptionId))
      .limit(1);

    return {
      allowed: sub?.status === "active",
      hasConcierge: sub?.hasConcierge ?? false,
      plan: sub?.plan ?? null,
    };
  }),

  // ── Admin: list all orgs (platform_admin only) ───────────────────────────────
  adminListOrgs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const orgs = await db.select().from(diyOrganizations);
    const subs = await db.select().from(diySubscriptions);
    const members = await db.select().from(diyOrgMembers);

    return orgs.map((org) => {
      const sub = subs.find((s) => s.orgId === org.id);
      const orgMembers = members.filter((m) => m.orgId === org.id && m.isActive);
      return { org, subscription: sub, memberCount: orgMembers.length };
    });
  }),

  // ── Admin: grant/update subscription (platform_admin only) ──────────────────
  adminUpdateSubscription: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        plan: z.enum(["starter", "professional", "advanced", "partner", "consulting_client"]),
        status: z.enum(["active", "trialing", "past_due", "canceled", "paused"]),
        hasConcierge: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // consulting_client is a special plan with custom seat config (unlimited, managed by consultant)
      const planConfig = input.plan === "consulting_client"
        ? { totalSeats: 9999, labAdminSeats: 10, memberSeats: 9999, isUnlimitedMembers: true }
        : DIY_PLANS[input.plan];

      await db
        .update(diySubscriptions)
        .set({
          plan: input.plan,
          status: input.status,
          totalSeats: planConfig.totalSeats,
          labAdminSeats: planConfig.labAdminSeats,
          memberSeats: planConfig.memberSeats,
          isUnlimitedMembers: planConfig.isUnlimitedMembers,
          ...(input.hasConcierge !== undefined
            ? {
                hasConcierge: input.hasConcierge,
                conciergeGrantedAt: input.hasConcierge ? new Date() : null,
              }
            : {}),
        })
        .where(eq(diySubscriptions.orgId, input.orgId));

      return { success: true };
    }),
});
