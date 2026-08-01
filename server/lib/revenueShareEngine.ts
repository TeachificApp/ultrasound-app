/**
 * revenueShareEngine.ts
 * Core logic for Stripe Connect revenue sharing:
 *  - Create/onboard Express connected accounts
 *  - Calculate and execute transfers after payment
 *  - Log all transactions to revenue_share_ledger
 */
import { eq, and, isNull, or, inArray } from "drizzle-orm";
import { getStripeClient } from "./stripeClient";
import { getDb } from "../db";
import {
  revenueSharePartners,
  revenueShareAssignments,
  revenueShareLedger,
  lmsCourses,
} from "../../drizzle/schema";

// ─── Partner Onboarding ───────────────────────────────────────────────────────

/**
 * Create a Stripe Express connected account for a new partner.
 * Returns the Stripe account ID (acct_xxx).
 */
export async function createStripeConnectAccount(partner: {
  email: string;
  name: string;
}): Promise<string> {
  const stripe = getStripeClient();
  const account = await stripe.accounts.create({
    type: "express",
    email: partner.email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: { platform: "allaboutultrasound" },
  });
  return account.id;
}

/**
 * Generate an onboarding link for a partner to complete their Stripe KYC.
 * The partner clicks this link and fills in their identity/bank details on Stripe's hosted page.
 */
export async function createOnboardingLink(
  stripeAccountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  const stripe = getStripeClient();
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/**
 * Generate a Stripe Express dashboard login link for an active partner.
 * Partners use this to view their own balance and payout history on Stripe.
 */
export async function createExpressDashboardLink(stripeAccountId: string): Promise<string> {
  const stripe = getStripeClient();
  const link = await stripe.accounts.createLoginLink(stripeAccountId);
  return link.url;
}

/**
 * Retrieve a Stripe account to check its current status.
 */
export async function getStripeAccountStatus(stripeAccountId: string): Promise<{
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(stripeAccountId);
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

// ─── Revenue Share Calculation ────────────────────────────────────────────────

export interface RevenueShareContext {
  courseId: number | null;
  grossAmountCents: number;
  currency: string;
  paymentIntentId: string | null;
  checkoutSessionId: string | null;
  customerEmail: string | null;
  courseTitle: string | null;
}

export interface PartnerShare {
  partnerId: number;
  assignmentId: number;
  stripeAccountId: string;
  shareAmountCents: number;
  sharePercentage: number;
  label: string | null;
}

/**
 * Look up all active revenue share assignments for a given course (or global assignments).
 * Returns the list of partners with their calculated share amounts.
 */
export async function calculateRevenueShares(
  ctx: RevenueShareContext
): Promise<PartnerShare[]> {
  const db = await getDb();
  if (!db) return [];

  // Find assignments: course-specific first, then global (courseId IS NULL)
  const assignments = await db
    .select({
      id: revenueShareAssignments.id,
      partnerId: revenueShareAssignments.partnerId,
      courseId: revenueShareAssignments.courseId,
      percentage: revenueShareAssignments.percentage,
      label: revenueShareAssignments.label,
    })
    .from(revenueShareAssignments)
    .where(
      and(
        eq(revenueShareAssignments.active, true),
        ctx.courseId
          ? or(
              eq(revenueShareAssignments.courseId, ctx.courseId),
              isNull(revenueShareAssignments.courseId)
            )
          : isNull(revenueShareAssignments.courseId)
      )
    );

  if (assignments.length === 0) return [];

  // Load partner Stripe account IDs
  const partnerIds = [...new Set(assignments.map((a) => a.partnerId))];
  const partners = await db
    .select({
      id: revenueSharePartners.id,
      stripeAccountId: revenueSharePartners.stripeAccountId,
      onboardingStatus: revenueSharePartners.onboardingStatus,
    })
    .from(revenueSharePartners)
    .where(inArray(revenueSharePartners.id, partnerIds));

  const partnerMap = new Map(partners.map((p) => [p.id, p]));

  const shares: PartnerShare[] = [];
  for (const assignment of assignments) {
    const partner = partnerMap.get(assignment.partnerId);
    // Only include partners who have completed Stripe onboarding
    if (!partner?.stripeAccountId || partner.onboardingStatus !== "active") continue;

    const pct = parseFloat(String(assignment.percentage));
    const shareAmountCents = Math.floor((ctx.grossAmountCents * pct) / 100);
    if (shareAmountCents < 1) continue; // Stripe minimum is $0.01

    shares.push({
      partnerId: assignment.partnerId,
      assignmentId: assignment.id,
      stripeAccountId: partner.stripeAccountId,
      shareAmountCents,
      sharePercentage: pct,
      label: assignment.label,
    });
  }

  return shares;
}

// ─── Transfer Execution ───────────────────────────────────────────────────────

/**
 * Execute Stripe transfers for all revenue share partners on a payment.
 * Creates a ledger entry for each partner, then fires the Stripe transfer.
 * Non-blocking: errors are logged but don't fail the main checkout flow.
 */
export async function executeRevenueShareTransfers(ctx: RevenueShareContext): Promise<void> {
  const db = await getDb();
  if (!db) return;

  let shares: PartnerShare[];
  try {
    shares = await calculateRevenueShares(ctx);
  } catch (err) {
    console.error("[RevenueShare] Failed to calculate shares:", err);
    return;
  }

  if (shares.length === 0) {
    console.log(`[RevenueShare] No active assignments for course ${ctx.courseId ?? "global"}`);
    return;
  }

  const stripe = getStripeClient();
  const now = Date.now();

  for (const share of shares) {
    // Insert ledger entry as "processing"
    let ledgerId: number | null = null;
    try {
      const [inserted] = await db
        .insert(revenueShareLedger)
        .values({
          partnerId: share.partnerId,
          assignmentId: share.assignmentId,
          courseId: ctx.courseId ?? undefined,
          courseTitle: ctx.courseTitle,
          paymentIntentId: ctx.paymentIntentId,
          checkoutSessionId: ctx.checkoutSessionId,
          customerEmail: ctx.customerEmail,
          grossAmount: ctx.grossAmountCents,
          sharePercentage: String(share.sharePercentage),
          shareAmount: share.shareAmountCents,
          currency: ctx.currency,
          status: "processing",
          createdAt: now,
          updatedAt: now,
        });
      ledgerId = (inserted as any).insertId ?? null;
    } catch (dbErr) {
      console.error("[RevenueShare] Failed to insert ledger entry:", dbErr);
      continue;
    }

    // Fire the Stripe transfer
    try {
      const transfer = await stripe.transfers.create({
        amount: share.shareAmountCents,
        currency: ctx.currency,
        destination: share.stripeAccountId,
        source_transaction: ctx.paymentIntentId ?? undefined,
        description: `Revenue share: ${ctx.courseTitle ?? `Course #${ctx.courseId}`} — ${share.sharePercentage}%`,
        metadata: {
          course_id: String(ctx.courseId ?? ""),
          course_title: ctx.courseTitle ?? "",
          checkout_session_id: ctx.checkoutSessionId ?? "",
          partner_id: String(share.partnerId),
          assignment_id: String(share.assignmentId),
        },
      });

      // Update ledger to "paid"
      if (ledgerId) {
        await db
          .update(revenueShareLedger)
          .set({
            stripeTransferId: transfer.id,
            status: "paid",
            paidAt: Date.now(),
            updatedAt: Date.now(),
          })
          .where(eq(revenueShareLedger.id, ledgerId));
      }

      console.log(
        `[RevenueShare] Transfer ${transfer.id} → partner ${share.partnerId}: ` +
          `$${(share.shareAmountCents / 100).toFixed(2)} (${share.sharePercentage}% of $${(ctx.grossAmountCents / 100).toFixed(2)})`
      );
    } catch (stripeErr: any) {
      console.error(`[RevenueShare] Stripe transfer failed for partner ${share.partnerId}:`, stripeErr?.message);
      if (ledgerId) {
        await db
          .update(revenueShareLedger)
          .set({
            status: "failed",
            errorMessage: stripeErr?.message ?? "Unknown error",
            updatedAt: Date.now(),
          })
          .where(eq(revenueShareLedger.id, ledgerId));
      }
    }
  }
}

/**
 * Manually process a single pending/failed ledger entry.
 * Used by the admin "Retry" action.
 */
export async function retryLedgerEntry(ledgerEntryId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "No database" };

  const [entry] = await db
    .select()
    .from(revenueShareLedger)
    .where(eq(revenueShareLedger.id, ledgerEntryId))
    .limit(1);

  if (!entry) return { success: false, error: "Ledger entry not found" };
  if (entry.status === "paid") return { success: true }; // Already paid

  const [partner] = await db
    .select()
    .from(revenueSharePartners)
    .where(eq(revenueSharePartners.id, entry.partnerId))
    .limit(1);

  if (!partner?.stripeAccountId) return { success: false, error: "Partner has no Stripe account" };
  if (partner.onboardingStatus !== "active") return { success: false, error: "Partner onboarding not complete" };

  const stripe = getStripeClient();
  try {
    await db
      .update(revenueShareLedger)
      .set({ status: "processing", updatedAt: Date.now() })
      .where(eq(revenueShareLedger.id, ledgerEntryId));

    const transfer = await stripe.transfers.create({
      amount: entry.shareAmount,
      currency: entry.currency,
      destination: partner.stripeAccountId,
      description: `Revenue share retry: ${entry.courseTitle ?? `Course #${entry.courseId}`} — ${entry.sharePercentage}%`,
    });

    await db
      .update(revenueShareLedger)
      .set({
        stripeTransferId: transfer.id,
        status: "paid",
        paidAt: Date.now(),
        errorMessage: null,
        updatedAt: Date.now(),
      })
      .where(eq(revenueShareLedger.id, ledgerEntryId));

    return { success: true };
  } catch (err: any) {
    await db
      .update(revenueShareLedger)
      .set({
        status: "failed",
        errorMessage: err?.message ?? "Unknown error",
        updatedAt: Date.now(),
      })
      .where(eq(revenueShareLedger.id, ledgerEntryId));
    return { success: false, error: err?.message };
  }
}
