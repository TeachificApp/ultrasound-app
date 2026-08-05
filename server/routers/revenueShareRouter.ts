/**
 * revenueShareRouter.ts
 * tRPC procedures for Stripe Connect revenue sharing:
 *  - Admin: manage partners, assignments, ledger, manual payouts
 *  - Partner: view own earnings portal
 */
import { z } from "zod";
import { eq, and, desc, isNull, or, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  revenueSharePartners,
  revenueShareAssignments,
  revenueShareLedger,
  lmsCourses,
  digitalProducts,
  digitalBundles,
  bundles,
  membershipPlans,
  workshops,
  partnerAllowlist,
} from "../../drizzle/schema";
import {
  createStripeConnectAccount,
  createOnboardingLink,
  createExpressDashboardLink,
  getStripeAccountStatus,
  retryLedgerEntry,
} from "../lib/revenueShareEngine";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function assertAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const revenueShareRouter = router({
  // ── Admin: List all partners ──────────────────────────────────────────────
  listPartners: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    const partners = await db
      .select()
      .from(revenueSharePartners)
      .orderBy(desc(revenueSharePartners.createdAt));
    return partners;
  }),

  // ── Admin: Create a new partner ───────────────────────────────────────────
  createPartner: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      payoutSchedule: z.enum(["immediate", "daily", "weekly", "monthly", "manual"]).default("immediate"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();

      // Create Stripe Express account
      let stripeAccountId: string | null = null;
      try {
        stripeAccountId = await createStripeConnectAccount({ email: input.email, name: input.name });
      } catch (err: any) {
        console.error("[RevenueShare] Failed to create Stripe account:", err?.message);
        // Continue — admin can retry onboarding later
      }

      const [result] = await db.insert(revenueSharePartners).values({
        name: input.name,
        email: input.email,
        stripeAccountId,
        onboardingStatus: stripeAccountId ? "onboarding" : "pending",
        payoutSchedule: input.payoutSchedule,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });

      const partnerId = (result as any).insertId as number;
      return { id: partnerId, stripeAccountId };
    }),

  // ── Admin: Update partner settings ───────────────────────────────────────
  updatePartner: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      payoutSchedule: z.enum(["immediate", "daily", "weekly", "monthly", "manual"]).optional(),
      notes: z.string().optional(),
      onboardingStatus: z.enum(["pending", "onboarding", "active", "restricted", "disabled"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      await db.update(revenueSharePartners)
        .set({ ...fields, updatedAt: Date.now() })
        .where(eq(revenueSharePartners.id, id));
      return { success: true };
    }),

  // ── Admin: Get onboarding link for a partner ──────────────────────────────
  getOnboardingLink: protectedProcedure
    .input(z.object({
      partnerId: z.number(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [partner] = await db
        .select()
        .from(revenueSharePartners)
        .where(eq(revenueSharePartners.id, input.partnerId))
        .limit(1);

      if (!partner) throw new TRPCError({ code: "NOT_FOUND" });

      let stripeAccountId = partner.stripeAccountId;

      // Create account if not yet created
      if (!stripeAccountId) {
        stripeAccountId = await createStripeConnectAccount({ email: partner.email, name: partner.name });
        await db.update(revenueSharePartners)
          .set({ stripeAccountId, onboardingStatus: "onboarding", updatedAt: Date.now() })
          .where(eq(revenueSharePartners.id, input.partnerId));
      }

      // Generate a secure token so the partner can access their Stripe setup
      // without needing to log into the site (token-based public redirect).
      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      await db.update(revenueSharePartners)
        .set({ onboardingToken: token, updatedAt: Date.now() })
        .where(eq(revenueSharePartners.id, input.partnerId));

      const rawDomain = process.env.CANONICAL_ROOT_DOMAIN ?? "learn.allaboutultrasound.com";
      const baseUrl = rawDomain.startsWith("http") ? rawDomain : `https://${rawDomain}`;
      const publicRedirectUrl = `${baseUrl}/stripe-onboarding/${token}`;

      // The return/refresh URLs go back to the public redirect page (re-generates a fresh Stripe link)
      const returnUrl = `${baseUrl}/partner-portal`;
      const refreshUrl = `${baseUrl}/stripe-onboarding/${token}`;
      const url = await createOnboardingLink(stripeAccountId, returnUrl, refreshUrl);
      // Return both the direct Stripe URL (for admin to copy) and the public token URL (to send to partner)
      return { url, publicUrl: publicRedirectUrl };
    }),

  // ── Admin: Refresh partner Stripe status ─────────────────────────────────
  refreshPartnerStatus: protectedProcedure
    .input(z.object({ partnerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [partner] = await db
        .select()
        .from(revenueSharePartners)
        .where(eq(revenueSharePartners.id, input.partnerId))
        .limit(1);

      if (!partner?.stripeAccountId) throw new TRPCError({ code: "NOT_FOUND", message: "No Stripe account" });

      const status = await getStripeAccountStatus(partner.stripeAccountId);
      const newStatus = status.payoutsEnabled && status.detailsSubmitted ? "active"
        : status.detailsSubmitted ? "restricted"
        : "onboarding";

      await db.update(revenueSharePartners)
        .set({ onboardingStatus: newStatus, updatedAt: Date.now() })
        .where(eq(revenueSharePartners.id, input.partnerId));

      return { ...status, onboardingStatus: newStatus };
    }),

  // ── Admin: List assignments (optionally filtered by course) ───────────────
  listAssignments: protectedProcedure
    .input(z.object({ courseId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          id: revenueShareAssignments.id,
          partnerId: revenueShareAssignments.partnerId,
          courseId: revenueShareAssignments.courseId,
          productType: revenueShareAssignments.productType,
          percentage: revenueShareAssignments.percentage,
          label: revenueShareAssignments.label,
          active: revenueShareAssignments.active,
          createdAt: revenueShareAssignments.createdAt,
          partnerName: revenueSharePartners.name,
          partnerEmail: revenueSharePartners.email,
          onboardingStatus: revenueSharePartners.onboardingStatus,
          courseTitle: lmsCourses.title,
        })
        .from(revenueShareAssignments)
        .leftJoin(revenueSharePartners, eq(revenueShareAssignments.partnerId, revenueSharePartners.id))
        .leftJoin(lmsCourses, eq(revenueShareAssignments.courseId, lmsCourses.id))
        .orderBy(desc(revenueShareAssignments.createdAt));

      if (input?.courseId) {
        return rows.filter(r => r.courseId === input.courseId || r.courseId === null);
      }
      return rows;
    }),

  // ── Admin: Create assignment ──────────────────────────────────────────────
  createAssignment: protectedProcedure
    .input(z.object({
      partnerId: z.number(),
      courseId: z.number().nullable().optional(),
      productType: z.string().default("lms_course"),
      percentage: z.number().min(0.01).max(100),
      label: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();
      const [result] = await db.insert(revenueShareAssignments).values({
        partnerId: input.partnerId,
        courseId: input.courseId ?? undefined,
        productType: input.productType,
        percentage: String(input.percentage),
        label: input.label ?? null,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      return { id: (result as any).insertId };
    }),

  // ── Admin: Update assignment ──────────────────────────────────────────────
  updateAssignment: protectedProcedure
    .input(z.object({
      id: z.number(),
      percentage: z.number().min(0.01).max(100).optional(),
      label: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, percentage, ...rest } = input;
      await db.update(revenueShareAssignments)
        .set({
          ...rest,
          ...(percentage !== undefined ? { percentage: String(percentage) } : {}),
          updatedAt: Date.now(),
        })
        .where(eq(revenueShareAssignments.id, id));
      return { success: true };
    }),

  // ── Admin: Delete assignment ──────────────────────────────────────────────
  deleteAssignment: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(revenueShareAssignments).where(eq(revenueShareAssignments.id, input.id));
      return { success: true };
    }),

  // ── Admin: Get full ledger ────────────────────────────────────────────────
  getLedger: protectedProcedure
    .input(z.object({
      partnerId: z.number().optional(),
      courseId: z.number().optional(),
      status: z.enum(["pending", "processing", "paid", "failed", "cancelled"]).optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { entries: [], total: 0 };

      const rows = await db
        .select({
          id: revenueShareLedger.id,
          partnerId: revenueShareLedger.partnerId,
          courseId: revenueShareLedger.courseId,
          courseTitle: revenueShareLedger.courseTitle,
          customerEmail: revenueShareLedger.customerEmail,
          grossAmount: revenueShareLedger.grossAmount,
          sharePercentage: revenueShareLedger.sharePercentage,
          shareAmount: revenueShareLedger.shareAmount,
          currency: revenueShareLedger.currency,
          stripeTransferId: revenueShareLedger.stripeTransferId,
          status: revenueShareLedger.status,
          errorMessage: revenueShareLedger.errorMessage,
          paidAt: revenueShareLedger.paidAt,
          createdAt: revenueShareLedger.createdAt,
          partnerName: revenueSharePartners.name,
          partnerEmail: revenueSharePartners.email,
        })
        .from(revenueShareLedger)
        .leftJoin(revenueSharePartners, eq(revenueShareLedger.partnerId, revenueSharePartners.id))
        .orderBy(desc(revenueShareLedger.createdAt))
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0);

      return { entries: rows, total: rows.length };
    }),

  // ── Admin: Retry a failed ledger entry ────────────────────────────────────
  retryLedgerEntry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      return retryLedgerEntry(input.id);
    }),

  // ── Admin: Process manual payout for pending ledger entries ────────────────
  processManualPayout: protectedProcedure
    .input(z.object({ partnerId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { processed: 0 };
      const conditions = [eq(revenueShareLedger.status, "pending")];
      if (input.partnerId) conditions.push(eq(revenueShareLedger.partnerId, input.partnerId));
      const pending = await db.select().from(revenueShareLedger).where(and(...conditions));
      let processed = 0;
      for (const entry of pending) {
        try {
          await retryLedgerEntry(entry.id);
          processed++;
        } catch (e) {
          console.error(`[RevenueShare] Failed to process ledger entry ${entry.id}:`, e);
        }
      }
      return { processed };
    }),

  // ── Admin: Retry failed transfer ─────────────────────────────────────────
  retryFailedTransfer: protectedProcedure
    .input(z.object({ ledgerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      return retryLedgerEntry(input.ledgerId);
    }),

  // ── Admin: Get summary stats ──────────────────────────────────────────────
  getSummaryStats: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) return { totalPaid: 0, totalPending: 0, totalFailed: 0, partnerCount: 0 };

    const ledger = await db.select().from(revenueShareLedger);
    const partners = await db.select({ id: revenueSharePartners.id }).from(revenueSharePartners);

    const totalPaid = ledger.filter(e => e.status === "paid").reduce((s, e) => s + e.shareAmount, 0);
    const totalPending = ledger.filter(e => e.status === "pending" || e.status === "processing").reduce((s, e) => s + e.shareAmount, 0);
    const totalFailed = ledger.filter(e => e.status === "failed").reduce((s, e) => s + e.shareAmount, 0);

    return {
      totalPaid,
      totalPending,
      totalFailed,
      partnerCount: partners.length,
    };
  }),

  // ── Partner Portal: Get my earnings ──────────────────────────────────────
  // Partners are identified by their user account email matching their partner record
  getMyEarnings: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    // Find partner record by email
    const [partner] = await db
      .select()
      .from(revenueSharePartners)
      .where(eq(revenueSharePartners.email, ctx.user.email ?? ""))
      .limit(1);

    if (!partner) return null;

    const ledger = await db
      .select()
      .from(revenueShareLedger)
      .where(eq(revenueShareLedger.partnerId, partner.id))
      .orderBy(desc(revenueShareLedger.createdAt));

    const totalEarned = ledger.filter(e => e.status === "paid").reduce((s, e) => s + e.shareAmount, 0);
    const totalPending = ledger.filter(e => e.status === "pending" || e.status === "processing").reduce((s, e) => s + e.shareAmount, 0);

    // Strip sensitive fields — partners see only their payout amount, course, date, and status.
    // Gross sale amount, percentage, student details, and payment IDs are never exposed.
    const safeLedger = ledger.map(e => ({
      id: e.id,
      courseTitle: e.courseTitle,
      payoutAmount: e.shareAmount,   // renamed to avoid implying it's a percentage of anything
      currency: e.currency,
      status: e.status,
      createdAt: e.createdAt,
      paidAt: e.paidAt,
    }));

    return {
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        onboardingStatus: partner.onboardingStatus,
        payoutSchedule: partner.payoutSchedule,
        stripeAccountId: partner.stripeAccountId ? "[connected]" : null,
      },
      ledger: safeLedger,
      totalEarned,
      totalPending,
    };
  }),

  // ── Partner Portal: Get Stripe Express dashboard link ─────────────────────
  getExpressDashboardLink: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [partner] = await db
      .select()
      .from(revenueSharePartners)
      .where(eq(revenueSharePartners.email, ctx.user.email ?? ""))
      .limit(1);

    if (!partner?.stripeAccountId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No Stripe account found for your profile" });
    }

    // Check if the connected account has completed Stripe KYC onboarding.
    // If not, createLoginLink will silently redirect to the setup flow —
    // instead, return an onboarding link so the user knows what to do.
    const status = await getStripeAccountStatus(partner.stripeAccountId);
    if (!status.detailsSubmitted) {
      // Generate a fresh onboarding link so they can complete KYC
      const origin = ctx.req.headers.origin as string ?? "https://app.allaboutultrasound.com";
      const onboardingUrl = await createOnboardingLink(
        partner.stripeAccountId,
        `${origin}/partner-portal?onboarding=complete`,
        `${origin}/partner-portal?onboarding=refresh`,
      );
      return { url: onboardingUrl, needsOnboarding: true };
    }

    const url = await createExpressDashboardLink(partner.stripeAccountId);
    return { url, needsOnboarding: false };
  }),

  // ── Admin: Get Express dashboard link for a specific partner ─────────────
  getPartnerExpressDashboardLink: protectedProcedure
    .input(z.object({ partnerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [partner] = await db
        .select()
        .from(revenueSharePartners)
        .where(eq(revenueSharePartners.id, input.partnerId))
        .limit(1);

      if (!partner?.stripeAccountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Partner has no Stripe account" });
      }

      const url = await createExpressDashboardLink(partner.stripeAccountId);
      return { url };
    }),

  // ── Admin: Search existing users (members, instructors, affiliates) ─────────
  searchExistingUsers: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      roleFilter: z.enum(["all", "instructor", "affiliate", "user", "premium_user"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) return [];
      const { users, userRoles } = await import("../../drizzle/schema");
      const { like, or: orOp } = await import("drizzle-orm");
      const matchingUsers = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(orOp(like(users.name, `%${input.query}%`), like(users.email, `%${input.query}%`)))
        .limit(20);
      if (matchingUsers.length === 0) return [];
      const userIds = matchingUsers.map(u => u.id);
      const roles = await db
        .select({ userId: userRoles.userId, role: userRoles.role })
        .from(userRoles)
        .where(inArray(userRoles.userId, userIds));
      const roleMap: Record<number, string[]> = {};
      for (const r of roles) {
        if (!roleMap[r.userId]) roleMap[r.userId] = [];
        roleMap[r.userId].push(r.role);
      }
      const existingPartners = await db
        .select({ email: revenueSharePartners.email })
        .from(revenueSharePartners);
      const partnerEmails = new Set(existingPartners.map(p => p.email));
      return matchingUsers
        .map(u => ({ ...u, roles: roleMap[u.id] ?? ["user"], alreadyPartner: partnerEmails.has(u.email ?? "") }))
        .filter(u => input.roleFilter === "all" || u.roles.includes(input.roleFilter));
    }),

  // ── Admin: Send onboarding email to partner ───────────────────────────────
  sendOnboardingEmail: protectedProcedure
    .input(z.object({ partnerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [partner] = await db
        .select()
        .from(revenueSharePartners)
        .where(eq(revenueSharePartners.id, input.partnerId))
        .limit(1);
      if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
      // Generate a secure random token so the partner can access their Stripe
      // onboarding link directly from email without needing to log into the site.
      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      await db.update(revenueSharePartners)
        .set({ onboardingToken: token })
        .where(eq(revenueSharePartners.id, input.partnerId));
      // The public redirect URL — no site login required
      const rawDomain = process.env.CANONICAL_ROOT_DOMAIN ?? "learn.allaboutultrasound.com";
      const baseUrl = rawDomain.startsWith("http") ? rawDomain : `https://${rawDomain}`;
      const publicRedirectUrl = `${baseUrl}/stripe-onboarding/${token}`;
      // Also pre-generate the Stripe onboarding link for the return/refresh URLs
      const onboardingUrl = await createOnboardingLink(
        partner.stripeAccountId!,
        `${baseUrl}/partner-portal`,
        `${baseUrl}/stripe-onboarding/${token}`,
      );
      // Send email via SendGrid
      const sgMail = await import("@sendgrid/mail");
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY!);
      await sgMail.default.send({
        to: partner.email,
        from: { email: process.env.SENDGRID_FROM_EMAIL ?? process.env.LMS_FROM_EMAIL ?? "noreply@allaboutultrasound.com", name: process.env.SENDGRID_FROM_NAME ?? process.env.LMS_FROM_NAME ?? "All About Ultrasound" },
        subject: "Set up your revenue share payout account",
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#189aa1;">Welcome to the Revenue Share Program</h2>
          <p>Hi ${partner.name},</p>
          <p>You have been added as a revenue share partner. To receive your payouts, please complete your Stripe account setup by clicking the button below.</p>
          <p style="margin:24px 0;">
            <a href="${publicRedirectUrl}" style="background:#189aa1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Set Up Payout Account</a>
          </p>
          <p style="color:#666;font-size:13px;">No account login is required — just click the button above to go directly to Stripe. If you have any questions, please contact <a href="mailto:admin@allaboutultrasound.com" style="color:#189aa1;">admin@allaboutultrasound.com</a>.</p>
        </div>`,
      });
      // Update partner status to onboarding
      await db.update(revenueSharePartners)
        .set({ onboardingStatus: "onboarding" })
        .where(eq(revenueSharePartners.id, input.partnerId));
      return { sent: true };
    }),

  // ── Admin: List all courses for assignment dropdown ───────────────────────
  listCoursesForAssignment: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: lmsCourses.id, title: lmsCourses.title })
      .from(lmsCourses)
      .orderBy(lmsCourses.title);
  }),

  // ── All product types for assignment ──────────────────────────────────────
  listProductsForAssignment: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    const [courses, dlProducts, dlBundles, lmsBundles, memberships, wshops] = await Promise.all([
      db.select({ id: lmsCourses.id, title: lmsCourses.title }).from(lmsCourses).orderBy(lmsCourses.title),
      db.select({ id: digitalProducts.id, title: digitalProducts.title }).from(digitalProducts).orderBy(digitalProducts.title),
      db.select({ id: digitalBundles.id, title: digitalBundles.title }).from(digitalBundles).orderBy(digitalBundles.title),
      db.select({ id: bundles.id, title: bundles.title }).from(bundles).orderBy(bundles.title),
      db.select({ id: membershipPlans.id, title: membershipPlans.title }).from(membershipPlans).orderBy(membershipPlans.title),
      db.select({ id: workshops.id, title: workshops.title }).from(workshops).orderBy(workshops.title),
    ]);
    return [
      ...courses.map(r => ({ ...r, productType: "course" as const })),
      ...lmsBundles.map(r => ({ ...r, productType: "bundle" as const })),
      ...dlProducts.map(r => ({ ...r, productType: "download" as const })),
      ...dlBundles.map(r => ({ ...r, productType: "download_bundle" as const })),
      ...memberships.map(r => ({ ...r, productType: "membership" as const })),
      ...wshops.map(r => ({ ...r, productType: "workshop" as const })),
    ];
  }),

  // ── Public: Check if email is on the partner allowlist ───────────────────
  checkPartnerAllowlist: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select({ id: partnerAllowlist.id, name: partnerAllowlist.name, usedAt: partnerAllowlist.usedAt })
        .from(partnerAllowlist)
        .where(eq(partnerAllowlist.email, input.email.toLowerCase().trim()))
        .limit(1);
      if (!row) return { allowed: false, alreadyRegistered: false };
      return { allowed: true, alreadyRegistered: !!row.usedAt, name: row.name };
    }),

  // ── Public: Self-register as a revenue partner (allowlist-gated) ─────────
  selfRegisterPartner: publicProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1).max(255),
      origin: z.string().url().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const normalizedEmail = input.email.toLowerCase().trim();
      // Check allowlist
      const [allowed] = await db
        .select()
        .from(partnerAllowlist)
        .where(eq(partnerAllowlist.email, normalizedEmail))
        .limit(1);
      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your email is not on the partner allowlist. Please contact admin@allaboutultrasound.com to enable your partner account.",
        });
      }
      // Check if partner already exists (may be resuming an incomplete onboarding)
      const [existing] = await db
        .select({ id: revenueSharePartners.id, stripeAccountId: revenueSharePartners.stripeAccountId, onboardingStatus: revenueSharePartners.onboardingStatus })
        .from(revenueSharePartners)
        .where(eq(revenueSharePartners.email, normalizedEmail))
        .limit(1);
      // Block only if fully active — allow retry if still onboarding/pending
      if (allowed.usedAt && existing?.onboardingStatus === "active") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Your partner account is already active. Log in to your Stripe Express dashboard to manage payouts, or contact admin@allaboutultrasound.com for assistance.",
        });
      }
      let partnerId: number;
      let onboardingUrl: string | null = null;
      if (existing) {
        partnerId = existing.id;
        // Generate a new onboarding link if not yet active
        if (existing.stripeAccountId) {
          try {
            const origin = input.origin || "https://learn.allaboutultrasound.com";
            onboardingUrl = await createOnboardingLink(existing.stripeAccountId, `${origin}/partner-signup?status=complete`, `${origin}/partner-signup?status=refresh`);
          } catch {}
        }
      } else {
        // Create Stripe Express account
        let stripeAccountId: string | null = null;
        try {
          stripeAccountId = await createStripeConnectAccount({ email: normalizedEmail, name: input.name });
        } catch (err: any) {
          console.error("[PartnerSignup] Stripe account creation failed:", err?.message);
        }
        const now = Date.now();
        const [result] = await db.insert(revenueSharePartners).values({
          name: input.name,
          email: normalizedEmail,
          stripeAccountId,
          onboardingStatus: stripeAccountId ? "onboarding" : "pending",
          payoutSchedule: "immediate",
          notes: "Self-registered via partner sign-up page",
          createdAt: now,
          updatedAt: now,
        }).$returningId();
        partnerId = result.id;
        if (stripeAccountId) {
          try {
            const origin = input.origin || "https://learn.allaboutultrasound.com";
            onboardingUrl = await createOnboardingLink(stripeAccountId, `${origin}/partner-signup?status=complete`, `${origin}/partner-signup?status=refresh`);
          } catch {}
        }
      }
      // Mark allowlist entry as used
      await db.update(partnerAllowlist)
        .set({ usedAt: new Date() })
        .where(eq(partnerAllowlist.email, normalizedEmail));
      return { success: true, partnerId, onboardingUrl };
    }),

  // ── Admin: List allowlist entries ─────────────────────────────────────────
  listAllowlist: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    return db.select().from(partnerAllowlist).orderBy(partnerAllowlist.createdAt);
  }),

  // ── Admin: Add email to allowlist ─────────────────────────────────────────
  addToAllowlist: protectedProcedure
    .input(z.object({ email: z.string().email(), name: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(partnerAllowlist).values({
        email: input.email.toLowerCase().trim(),
        name: input.name || null,
        notes: input.notes || null,
        invitedBy: ctx.user.id,
      });
      return { success: true };
    }),

  // ── Admin: Remove email from allowlist ────────────────────────────────────
  removeFromAllowlist: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(partnerAllowlist).where(eq(partnerAllowlist.id, input.id));
      return { success: true };
    }),

  // ── Public: Resolve onboarding token → redirect to Stripe (no login required) ─────
  // Partners receive this URL in their email. It generates a fresh Stripe onboarding
  // link server-side and returns it so the frontend can redirect — no site auth needed.
  getOnboardingLinkByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [partner] = await db
        .select()
        .from(revenueSharePartners)
        .where(eq(revenueSharePartners.onboardingToken, input.token))
        .limit(1);
      if (!partner?.stripeAccountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired onboarding link." });
      }
      const rawDomain = process.env.CANONICAL_ROOT_DOMAIN ?? "learn.allaboutultrasound.com";
      const baseUrl = rawDomain.startsWith("http") ? rawDomain : `https://${rawDomain}`;
      // Generate a fresh Stripe onboarding link (they expire after 24h)
      const url = await createOnboardingLink(
        partner.stripeAccountId,
        `${baseUrl}/partner-portal`,
        `${baseUrl}/stripe-onboarding/${input.token}`,
      );
      return { url, partnerName: partner.name };
    }),
});
