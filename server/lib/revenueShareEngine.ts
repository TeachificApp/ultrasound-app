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
  stripeAccountId: string | null;
  canTransfer: boolean;
  pendingReason: string | null;
  shareAmountCents: number;
  sharePercentage: number;
  label: string | null;
}

export interface PaymentTimeRevenueShare {
  partnerId: number;
  assignmentId: number;
  stripeAccountId: string;
  shareAmountCents: number;
  sharePercentage: number;
}

export type RevenueShareProcessMethod = "payment_time" | "stripe_transfer" | "manual";

export function calculateShareAmountCents(grossAmountCents: number, sharePercentage: number): number {
  return Math.floor((grossAmountCents * sharePercentage) / 100);
}

/** True when funds were routed automatically (checkout split or post-payment transfer). */
export function isAutoProcessedLedgerEntry(entry: {
  status: string;
  processMethod?: string | null;
  stripeTransferId?: string | null;
}): boolean {
  if (entry.processMethod === "payment_time" || entry.processMethod === "stripe_transfer") return true;
  // Legacy paid rows predate process_method and were always auto-processed.
  if (entry.status === "paid" && !entry.processMethod) return true;
  return false;
}

export function canManualProcessLedgerEntry(entry: {
  status: string;
  processMethod?: string | null;
  autoProcessedAt?: number | null;
  stripeTransferId?: string | null;
}): { allowed: boolean; reason?: string } {
  if (entry.processMethod === "payment_time") {
    return { allowed: false, reason: "Payment-time split already routed partner share at checkout" };
  }
  if (entry.status === "paid") {
    if (isAutoProcessedLedgerEntry(entry) || entry.autoProcessedAt) {
      return { allowed: false, reason: "Already auto-processed — cannot reprocess" };
    }
    return { allowed: false, reason: "Already paid" };
  }
  if (entry.status === "processing") {
    return { allowed: false, reason: "Transfer already in progress" };
  }
  if (entry.status === "cancelled") {
    return { allowed: false, reason: "Entry cancelled" };
  }
  return { allowed: true };
}

type AssignmentWithPartner = {
  assignmentId: number;
  partnerId: number;
  percentage: string | number;
  stripeAccountId: string | null;
  onboardingStatus: string | null;
  label?: string | null;
};

export function buildPaymentTimeRevenueShareMetadata(share: PaymentTimeRevenueShare): Record<string, string> {
  return {
    revenue_share_payment_time: "true",
    revenue_share_partner_id: String(share.partnerId),
    revenue_share_assignment_id: String(share.assignmentId),
    revenue_share_amount_cents: String(share.shareAmountCents),
    revenue_share_percentage: String(share.sharePercentage),
  };
}

export function buildPaymentTimeRevenueShareCheckoutOptions(share: PaymentTimeRevenueShare | null): {
  metadata: Record<string, string>;
  paymentIntentData: Record<string, unknown>;
} {
  if (!share) return { metadata: {}, paymentIntentData: {} };
  const metadata = buildPaymentTimeRevenueShareMetadata(share);
  return {
    metadata,
    paymentIntentData: {
      transfer_data: {
        destination: share.stripeAccountId,
        amount: share.shareAmountCents,
      },
      metadata,
    },
  };
}

/** Course-specific assignments win; otherwise fall back to global (courseId IS NULL). */
export async function fetchActiveAssignmentsForCourse(courseId: number): Promise<AssignmentWithPartner[]> {
  const db = await getDb();
  if (!db) return [];

  const baseSelect = {
    assignmentId: revenueShareAssignments.id,
    partnerId: revenueShareAssignments.partnerId,
    percentage: revenueShareAssignments.percentage,
    stripeAccountId: revenueSharePartners.stripeAccountId,
    onboardingStatus: revenueSharePartners.onboardingStatus,
    label: revenueShareAssignments.label,
  };

  const courseSpecific = await db
    .select(baseSelect)
    .from(revenueShareAssignments)
    .leftJoin(revenueSharePartners, eq(revenueSharePartners.id, revenueShareAssignments.partnerId))
    .where(and(eq(revenueShareAssignments.active, true), eq(revenueShareAssignments.courseId, courseId)));

  if (courseSpecific.length > 0) return courseSpecific;

  return db
    .select(baseSelect)
    .from(revenueShareAssignments)
    .leftJoin(revenueSharePartners, eq(revenueSharePartners.id, revenueShareAssignments.partnerId))
    .where(and(eq(revenueShareAssignments.active, true), isNull(revenueShareAssignments.courseId)));
}

export function getPartnerShareDisposition(partner: {
  stripeAccountId?: string | null;
  onboardingStatus?: string | null;
}): Pick<PartnerShare, "canTransfer" | "pendingReason"> {
  if (!partner.stripeAccountId) {
    return { canTransfer: false, pendingReason: "Partner has no connected Stripe account" };
  }
  if (partner.onboardingStatus !== "active") {
    return { canTransfer: false, pendingReason: "Partner Stripe onboarding is not complete" };
  }
  return { canTransfer: true, pendingReason: null };
}

/**
 * A Stripe PaymentIntent can route one destination amount from the same customer
 * charge. Return that split only when exactly one active revenue partner is
 * eligible; all other cases remain on the safeguarded ledger path.
 */
export async function resolvePaymentTimeRevenueShare(input: {
  courseId: number;
  grossAmountCents: number;
}): Promise<PaymentTimeRevenueShare | null> {
  if (input.grossAmountCents < 1) return null;

  const assignments = await fetchActiveAssignmentsForCourse(input.courseId);
  if (assignments.length !== 1) return null;
  const assignment = assignments[0];
  const disposition = getPartnerShareDisposition(assignment);
  if (!disposition.canTransfer || !assignment.stripeAccountId) return null;

  const sharePercentage = Number(assignment.percentage);
  const shareAmountCents = Math.floor((input.grossAmountCents * sharePercentage) / 100);
  if (!Number.isFinite(sharePercentage) || shareAmountCents < 1 || shareAmountCents >= input.grossAmountCents) return null;

  return {
    partnerId: assignment.partnerId,
    assignmentId: assignment.assignmentId,
    stripeAccountId: assignment.stripeAccountId,
    shareAmountCents,
    sharePercentage,
  };
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

  const assignmentRows = ctx.courseId
    ? await fetchActiveAssignmentsForCourse(ctx.courseId)
    : await db
        .select({
          assignmentId: revenueShareAssignments.id,
          partnerId: revenueShareAssignments.partnerId,
          percentage: revenueShareAssignments.percentage,
          stripeAccountId: revenueSharePartners.stripeAccountId,
          onboardingStatus: revenueSharePartners.onboardingStatus,
          label: revenueShareAssignments.label,
        })
        .from(revenueShareAssignments)
        .leftJoin(revenueSharePartners, eq(revenueSharePartners.id, revenueShareAssignments.partnerId))
        .where(and(eq(revenueShareAssignments.active, true), isNull(revenueShareAssignments.courseId)));

  if (assignmentRows.length === 0) return [];

  const assignments = assignmentRows.map(row => ({
    id: row.assignmentId,
    partnerId: row.partnerId,
    percentage: row.percentage,
    label: row.label,
  }));

  const partnerMap = new Map(assignmentRows.map(row => [row.partnerId, row]));

  const shares: PartnerShare[] = [];
  for (const assignment of assignments) {
    const partner = partnerMap.get(assignment.partnerId);
    const disposition = getPartnerShareDisposition({
      stripeAccountId: partner?.stripeAccountId,
      onboardingStatus: partner?.onboardingStatus,
    });

    const pct = parseFloat(String(assignment.percentage));
    const shareAmountCents = Math.floor((ctx.grossAmountCents * pct) / 100);
    if (shareAmountCents < 1) continue; // Stripe minimum is $0.01

    shares.push({
      partnerId: assignment.partnerId,
      assignmentId: assignment.id,
      stripeAccountId: partner?.stripeAccountId ?? null,
      ...disposition,
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
/** Attach payment-time destination split metadata/options when exactly one partner qualifies. */
export async function applyRevenueShareToCheckoutSession(input: {
  courseId: number;
  grossAmountCents: number;
  excludePaymentTime?: boolean;
}) {
  if (input.excludePaymentTime || input.grossAmountCents < 1) {
    return buildPaymentTimeRevenueShareCheckoutOptions(null);
  }
  const share = await resolvePaymentTimeRevenueShare({
    courseId: input.courseId,
    grossAmountCents: input.grossAmountCents,
  });
  return buildPaymentTimeRevenueShareCheckoutOptions(share);
}

/** Webhook helper: record payment-time ledger entry or run post-payment transfers. */
export async function recordRevenueShareFromCompletedCheckout(input: {
  session: Record<string, unknown>;
  courseId: number;
  courseTitle?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const meta = (input.session.metadata as Record<string, string>) ?? {};
  const paymentTimeSplit = meta.revenue_share_payment_time === "true";
  if (paymentTimeSplit) {
    const partnerId = Number(meta.revenue_share_partner_id);
    const assignmentId = Number(meta.revenue_share_assignment_id);
    const shareAmount = Number(meta.revenue_share_amount_cents);
    const sharePercentage = meta.revenue_share_percentage;
    if (Number.isInteger(partnerId) && Number.isInteger(assignmentId) && Number.isInteger(shareAmount) && shareAmount > 0 && sharePercentage) {
      const sessionId = input.session.id as string;
      const [existing] = await db.select({ id: revenueShareLedger.id })
        .from(revenueShareLedger)
        .where(and(
          eq(revenueShareLedger.partnerId, partnerId),
          eq(revenueShareLedger.assignmentId, assignmentId),
          eq(revenueShareLedger.checkoutSessionId, sessionId),
        ))
        .limit(1);
      if (!existing) {
        const now = Date.now();
        await db.insert(revenueShareLedger).values({
          partnerId,
          assignmentId,
          courseId: input.courseId,
          courseTitle: input.courseTitle ?? null,
          paymentIntentId: (input.session.payment_intent as string) ?? null,
          checkoutSessionId: sessionId,
          customerEmail: (input.session.customer_email as string) ?? (input.session.customer_details as any)?.email ?? null,
          grossAmount: (input.session.amount_total as number) ?? 0,
          sharePercentage,
          shareAmount,
          currency: (input.session.currency as string) ?? "usd",
          status: "paid",
          paidAt: now,
          processMethod: "payment_time",
          autoProcessedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return;
  }

  await executeRevenueShareTransfers({
    courseId: input.courseId,
    grossAmountCents: (input.session.amount_total as number) ?? 0,
    currency: (input.session.currency as string) ?? "usd",
    paymentIntentId: typeof input.session.payment_intent === "string"
      ? input.session.payment_intent
      : (input.session.payment_intent as { id?: string } | undefined)?.id ?? null,
    checkoutSessionId: input.session.id as string,
    customerEmail: (input.session.customer_email as string) ?? (input.session.customer_details as any)?.email ?? null,
    courseTitle: input.courseTitle ?? null,
  });
}

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
    console.log(`[RevenueShare] No assignments for course ${ctx.courseId ?? "global"}`);
    return;
  }

  const stripe = getStripeClient();
  const now = Date.now();

  for (const share of shares) {
    const paymentMatches = [
      ctx.paymentIntentId ? eq(revenueShareLedger.paymentIntentId, ctx.paymentIntentId) : null,
      ctx.checkoutSessionId ? eq(revenueShareLedger.checkoutSessionId, ctx.checkoutSessionId) : null,
    ].filter(Boolean);
    if (paymentMatches.length > 0) {
      const [existing] = await db
        .select({ id: revenueShareLedger.id })
        .from(revenueShareLedger)
        .where(and(
          eq(revenueShareLedger.partnerId, share.partnerId),
          eq(revenueShareLedger.assignmentId, share.assignmentId),
          or(...paymentMatches as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]),
        ))
        .limit(1);
      if (existing) continue;
    }

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
          status: share.canTransfer ? "processing" : "pending",
          errorMessage: share.pendingReason,
          createdAt: now,
          updatedAt: now,
        });
      ledgerId = (inserted as any).insertId ?? null;
    } catch (dbErr) {
      console.error("[RevenueShare] Failed to insert ledger entry:", dbErr);
      continue;
    }

    // Keep an auditable pending entry until the partner completes Stripe onboarding.
    if (!share.canTransfer || !share.stripeAccountId) {
      console.warn(`[RevenueShare] Pending partner share ${share.partnerId}: ${share.pendingReason}`);
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
        const paidAt = Date.now();
        await db
          .update(revenueShareLedger)
          .set({
            stripeTransferId: transfer.id,
            status: "paid",
            paidAt,
            processMethod: "stripe_transfer",
            autoProcessedAt: paidAt,
            updatedAt: paidAt,
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
 * Admin manual payout for a pending/failed ledger entry.
 * Optional sharePercentage recalculates shareAmount from gross before transfer.
 */
export async function processManualLedgerPayout(input: {
  ledgerEntryId: number;
  sharePercentage?: number;
  processedByUserId?: number;
}): Promise<{ success: boolean; error?: string; shareAmount?: number; sharePercentage?: number }> {
  const db = await getDb();
  if (!db) return { success: false, error: "No database" };

  const [entry] = await db
    .select()
    .from(revenueShareLedger)
    .where(eq(revenueShareLedger.id, input.ledgerEntryId))
    .limit(1);

  if (!entry) return { success: false, error: "Ledger entry not found" };

  const guard = canManualProcessLedgerEntry(entry);
  if (!guard.allowed) return { success: false, error: guard.reason ?? "Cannot process this entry" };

  const [partner] = await db
    .select()
    .from(revenueSharePartners)
    .where(eq(revenueSharePartners.id, entry.partnerId))
    .limit(1);

  if (!partner?.stripeAccountId) return { success: false, error: "Partner has no Stripe account" };
  if (partner.onboardingStatus !== "active") return { success: false, error: "Partner onboarding not complete" };

  const sharePercentage = input.sharePercentage ?? parseFloat(String(entry.sharePercentage));
  if (!Number.isFinite(sharePercentage) || sharePercentage <= 0 || sharePercentage >= 100) {
    return { success: false, error: "Share percentage must be between 0.01 and 99.99" };
  }

  const shareAmount = calculateShareAmountCents(entry.grossAmount, sharePercentage);
  if (shareAmount < 1) return { success: false, error: "Share amount must be at least $0.01" };
  if (shareAmount >= entry.grossAmount) {
    return { success: false, error: "Share amount must be less than gross payment" };
  }

  const stripe = getStripeClient();
  const now = Date.now();
  try {
    await db
      .update(revenueShareLedger)
      .set({
        sharePercentage: String(sharePercentage),
        shareAmount,
        status: "processing",
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(revenueShareLedger.id, input.ledgerEntryId));

    const transfer = await stripe.transfers.create({
      amount: shareAmount,
      currency: entry.currency,
      destination: partner.stripeAccountId,
      source_transaction: entry.paymentIntentId ?? undefined,
      description: `Revenue share (manual): ${entry.courseTitle ?? `Course #${entry.courseId}`} — ${sharePercentage}%`,
      metadata: {
        ledger_id: String(entry.id),
        partner_id: String(entry.partnerId),
        processed_by: input.processedByUserId ? String(input.processedByUserId) : "",
      },
    });

    await db
      .update(revenueShareLedger)
      .set({
        stripeTransferId: transfer.id,
        status: "paid",
        paidAt: now,
        processMethod: "manual",
        processedByUserId: input.processedByUserId ?? null,
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(revenueShareLedger.id, input.ledgerEntryId));

    return { success: true, shareAmount, sharePercentage };
  } catch (err: any) {
    await db
      .update(revenueShareLedger)
      .set({
        status: "failed",
        errorMessage: err?.message ?? "Unknown error",
        updatedAt: Date.now(),
      })
      .where(eq(revenueShareLedger.id, input.ledgerEntryId));
    return { success: false, error: err?.message };
  }
}

/** Retry a failed entry using current ledger amounts (no percentage override). */
export async function retryLedgerEntry(ledgerEntryId: number, processedByUserId?: number): Promise<{ success: boolean; error?: string }> {
  const result = await processManualLedgerPayout({ ledgerEntryId, processedByUserId });
  return { success: result.success, error: result.error };
}
