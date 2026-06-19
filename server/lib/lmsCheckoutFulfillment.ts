/**
 * LMS hosted checkout fulfillment — enrolls users after Stripe payment.
 * Handles guest buyers (no user_id / order_id in metadata).
 */

import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import {
  lmsCourses,
  lmsEnrollments,
  lmsOrders,
  lmsPricingOptions,
} from "../../drizzle/schema";
import { getOrCreateUserByEmail, getOrCreateAccessToken } from "../db";
import { sendEnrollmentEmail } from "./enrollmentEmail";
import { notifyOwner } from "../_core/notification";
import { isEnrollmentAccessActive } from "./enrollmentAccess";

export type LmsCheckoutFulfillmentResult = {
  success: boolean;
  userId: number | null;
  courseId: number | null;
  orderId: number | null;
  isNewUser: boolean;
  notes: string[];
  error?: string;
};

export function extractStripePriceId(session: Record<string, unknown>): string | null {
  try {
    const lineItems = session.line_items as { data?: Array<{ price?: { id?: string } }> } | undefined;
    return lineItems?.data?.[0]?.price?.id ?? null;
  } catch {
    return null;
  }
}

export function isLmsHostedCheckoutMetadata(meta: Record<string, string>): boolean {
  if (meta.type === "membership") return false;
  if (meta.course_id) return true;
  if (meta.source?.startsWith("hosted_checkout")) return true;
  if (meta.order_id) return true;
  return false;
}

export type LinkLmsStripeSubscriptionInput = {
  stripeSubscriptionId: string;
  userId?: number;
  courseId?: number;
  enrollmentId?: number;
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  amountCents?: number | null;
};

export type StripeSubscriptionDetails = {
  accessExpiresAt: Date | null;
  paymentIntentId: string | null;
  amountCents: number | null;
  currency: string;
};

/** Load period end + payment intent from Stripe for `lms_enrollments.access_expires_at` / `lms_orders`. */
export async function fetchStripeSubscriptionDetails(
  stripeSubscriptionId: string,
): Promise<StripeSubscriptionDetails> {
  const empty: StripeSubscriptionDetails = {
    accessExpiresAt: null,
    paymentIntentId: null,
    amountCents: null,
    currency: "usd",
  };
  if (!process.env.STRIPE_SECRET_KEY) return empty;
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["latest_invoice.payment_intent"],
    });
    const accessExpiresAt = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null;
    const latestInvoice = sub.latest_invoice as { payment_intent?: string | { id?: string } } | null;
    let paymentIntentId: string | null = null;
    if (typeof latestInvoice?.payment_intent === "string") {
      paymentIntentId = latestInvoice.payment_intent;
    } else if (latestInvoice?.payment_intent && typeof latestInvoice.payment_intent === "object") {
      paymentIntentId = latestInvoice.payment_intent.id ?? null;
    }
    const price = sub.items?.data?.[0]?.price;
    return {
      accessExpiresAt,
      paymentIntentId,
      amountCents: price?.unit_amount ?? null,
      currency: price?.currency ?? sub.currency ?? "usd",
    };
  } catch (err) {
    console.warn(`[LmsCheckoutFulfillment] Could not load subscription ${stripeSubscriptionId}:`, err);
    return empty;
  }
}

function parseMetadataUserId(meta: Record<string, string>): number | null {
  if (!meta.user_id) return null;
  const parsed = parseInt(meta.user_id, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Link an existing manual enrollment + order to a paid Stripe subscription.
 * Use after admin creates the user/enrollment; sets `lms_orders.stripe_subscription_id`
 * and `lms_enrollments.stripe_subscription_id` / `access_expires_at` / `source`.
 */
export async function linkLmsEnrollmentToStripeSubscription(
  db: MySql2Database<typeof schema>,
  input: LinkLmsStripeSubscriptionInput,
): Promise<LmsCheckoutFulfillmentResult> {
  const notes: string[] = [];
  const stripeDetails = await fetchStripeSubscriptionDetails(input.stripeSubscriptionId);
  const accessExpiresAt = stripeDetails.accessExpiresAt;
  const paymentIntentId = input.stripePaymentIntentId ?? stripeDetails.paymentIntentId;
  const amountCents = input.amountCents ?? stripeDetails.amountCents ?? 0;

  let enrollment: {
    id: number;
    userId: number;
    courseId: number;
    orderId: number | null;
    stripeSubscriptionId: string | null;
  } | null = null;

  if (input.enrollmentId) {
    const [row] = await db
      .select({
        id: lmsEnrollments.id,
        userId: lmsEnrollments.userId,
        courseId: lmsEnrollments.courseId,
        orderId: lmsEnrollments.orderId,
        stripeSubscriptionId: lmsEnrollments.stripeSubscriptionId,
      })
      .from(lmsEnrollments)
      .where(eq(lmsEnrollments.id, input.enrollmentId))
      .limit(1);
    enrollment = row ?? null;
  } else if (input.userId && input.courseId) {
    const [row] = await db
      .select({
        id: lmsEnrollments.id,
        userId: lmsEnrollments.userId,
        courseId: lmsEnrollments.courseId,
        orderId: lmsEnrollments.orderId,
        stripeSubscriptionId: lmsEnrollments.stripeSubscriptionId,
      })
      .from(lmsEnrollments)
      .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, input.courseId)))
      .limit(1);
    enrollment = row ?? null;
  }

  if (!enrollment) {
    return {
      success: false,
      userId: input.userId ?? null,
      courseId: input.courseId ?? null,
      orderId: null,
      isNewUser: false,
      notes,
      error: "Enrollment not found — create the user and enrollment first, then link Stripe",
    };
  }

  if (
    enrollment.stripeSubscriptionId &&
    enrollment.stripeSubscriptionId !== input.stripeSubscriptionId
  ) {
    return {
      success: false,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      orderId: enrollment.orderId,
      isNewUser: false,
      notes,
      error: `Enrollment already linked to subscription ${enrollment.stripeSubscriptionId}`,
    };
  }

  let orderId = enrollment.orderId;

  const [orderBySub] = await db
    .select({ id: lmsOrders.id })
    .from(lmsOrders)
    .where(eq(lmsOrders.stripeSubscriptionId, input.stripeSubscriptionId))
    .limit(1);
  if (orderBySub) {
    orderId = orderBySub.id;
    await db.update(lmsOrders).set({
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: "paid",
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      ...(input.stripeCheckoutSessionId ? { stripeSessionId: input.stripeCheckoutSessionId } : {}),
      ...(amountCents > 0 ? { amount: amountCents } : {}),
    }).where(eq(lmsOrders.id, orderId));
    notes.push(`Updated order #${orderId} with Stripe subscription`);
  } else if (orderId) {
    await db.update(lmsOrders).set({
      stripeSubscriptionId: input.stripeSubscriptionId,
      status: "paid",
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      ...(input.stripeCheckoutSessionId ? { stripeSessionId: input.stripeCheckoutSessionId } : {}),
      ...(amountCents > 0 ? { amount: amountCents } : {}),
    }).where(eq(lmsOrders.id, orderId));
    notes.push(`Linked order #${orderId} to subscription ${input.stripeSubscriptionId}`);
  } else {
    const [inserted] = await db.insert(lmsOrders).values({
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      amount: amountCents,
      currency: stripeDetails.currency,
      stripePaymentIntentId: paymentIntentId,
      stripeSessionId: input.stripeCheckoutSessionId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status: "paid",
      seats: 1,
    }).$returningId();
    orderId = inserted?.id ?? null;
    notes.push(`Created order #${orderId} for subscription ${input.stripeSubscriptionId}`);
  }

  await db.update(lmsEnrollments).set({
    orderId: orderId ?? undefined,
    enrollmentType: "full",
    source: "stripe",
    stripeSubscriptionId: input.stripeSubscriptionId,
    ...(accessExpiresAt ? { accessExpiresAt } : {}),
  }).where(eq(lmsEnrollments.id, enrollment.id));

  notes.push(`Linked enrollment #${enrollment.id} to subscription ${input.stripeSubscriptionId}`);

  return {
    success: true,
    userId: enrollment.userId,
    courseId: enrollment.courseId,
    orderId,
    isNewUser: false,
    notes,
  };
}

export async function resolveLmsCourseIdFromSession(
  db: MySql2Database<typeof schema>,
  session: Record<string, unknown>,
  meta: Record<string, string>,
): Promise<number | null> {
  if (meta.course_id) return parseInt(meta.course_id, 10);
  const priceId = extractStripePriceId(session);
  if (!priceId) return null;

  const [course] = await db
    .select({ id: lmsCourses.id })
    .from(lmsCourses)
    .where(eq(lmsCourses.stripePriceId, priceId))
    .limit(1);
  if (course) return course.id;

  const [opt] = await db
    .select({ courseId: lmsPricingOptions.courseId })
    .from(lmsPricingOptions)
    .where(eq(lmsPricingOptions.stripePriceId, priceId))
    .limit(1);
  return opt?.courseId ?? null;
}

export type LmsReconcileOptions = {
  /** Use when admin already created the user (manual enroll before Stripe link) */
  userId?: number;
  courseId?: number;
  enrollmentId?: number;
  /** Only link Stripe IDs to existing enrollment; do not create user/enrollment or send email */
  linkOnly?: boolean;
};

export async function reconcileLmsCheckoutFromStripeSession(
  db: MySql2Database<typeof schema>,
  session: Record<string, unknown>,
  options: LmsReconcileOptions = {},
): Promise<LmsCheckoutFulfillmentResult> {
  const meta = (session.metadata as Record<string, string>) ?? {};
  const notes: string[] = [];

  if (!isLmsHostedCheckoutMetadata(meta)) {
    const courseIdByPrice = await resolveLmsCourseIdFromSession(db, session, meta);
    if (!courseIdByPrice) {
      return { success: false, userId: null, courseId: null, orderId: null, isNewUser: false, notes, error: "Not an LMS checkout" };
    }
    meta.course_id = String(courseIdByPrice);
  }

  const courseId = await resolveLmsCourseIdFromSession(db, session, meta);
  if (!courseId) {
    return { success: false, userId: null, courseId: null, orderId: null, isNewUser: false, notes, error: "Could not resolve LMS course" };
  }

  const customerEmail =
    (session.customer_email as string) ??
    (session.customer_details as Record<string, string>)?.email ??
    meta.customer_email;
  const customerName =
    meta.customer_name ?? (session.customer_details as Record<string, string>)?.name ?? null;

  let userId = options.userId ?? parseMetadataUserId(meta);
  let isNewUser = false;

  if (options.linkOnly && options.enrollmentId) {
    const stripeSubscriptionId = (session.subscription as string) ?? null;
    if (!stripeSubscriptionId) {
      return {
        success: false,
        userId: options.userId ?? null,
        courseId: options.courseId ?? courseId,
        orderId: null,
        isNewUser: false,
        notes: [],
        error: "Checkout session has no subscription id",
      };
    }
    const sessionId = session.id as string;
    const paymentIntent = session.payment_intent as string | undefined;
    return linkLmsEnrollmentToStripeSubscription(db, {
      enrollmentId: options.enrollmentId,
      userId: options.userId,
      courseId: options.courseId ?? courseId,
      stripeSubscriptionId,
      stripePaymentIntentId: paymentIntent ?? null,
      stripeCheckoutSessionId: sessionId.startsWith("reconcile_sub_") ? null : sessionId,
      amountCents: (session.amount_total as number) ?? null,
    });
  }

  if (options.linkOnly && options.userId && (options.courseId ?? courseId)) {
    const stripeSubscriptionId = (session.subscription as string) ?? null;
    if (!stripeSubscriptionId) {
      return {
        success: false,
        userId: options.userId,
        courseId: options.courseId ?? courseId,
        orderId: null,
        isNewUser: false,
        notes: [],
        error: "Checkout session has no subscription id",
      };
    }
    const sessionId = session.id as string;
    const paymentIntent = session.payment_intent as string | undefined;
    return linkLmsEnrollmentToStripeSubscription(db, {
      userId: options.userId,
      courseId: options.courseId ?? courseId,
      stripeSubscriptionId,
      stripePaymentIntentId: paymentIntent ?? null,
      stripeCheckoutSessionId: sessionId.startsWith("reconcile_sub_") ? null : sessionId,
      amountCents: (session.amount_total as number) ?? null,
    });
  }

  if (!userId && customerEmail && !options.linkOnly) {
    const nameParts = (customerName || "").trim().split(" ");
    const created = await getOrCreateUserByEmail({
      email: customerEmail,
      firstName: nameParts[0] || undefined,
      lastName: nameParts.slice(1).join(" ") || undefined,
      name: customerName || undefined,
    });
    userId = created.user.id;
    isNewUser = created.isNew;
    notes.push(isNewUser ? `Created account for ${customerEmail}` : `Resolved account ${customerEmail}`);
  }

  if (!userId) {
    return { success: false, userId: null, courseId, orderId: null, isNewUser: false, notes, error: "No user could be resolved" };
  }

  const sessionId = session.id as string;
  const stripeSubscriptionId = (session.subscription as string) ?? null;
  const stripeDetails = stripeSubscriptionId
    ? await fetchStripeSubscriptionDetails(stripeSubscriptionId)
    : null;
  const accessExpiresAt = stripeDetails?.accessExpiresAt ?? null;
  const paymentIntentFromSession = session.payment_intent as string | undefined;

  let orderId = meta.order_id ? parseInt(meta.order_id, 10) : null;
  const amountTotal = (session.amount_total as number) ?? 0;

  if (orderId) {
    await db.update(lmsOrders).set({
      status: "paid",
      userId,
      stripeSessionId: sessionId,
      ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    }).where(eq(lmsOrders.id, orderId));
    notes.push(`Order #${orderId} marked paid`);
  } else {
    const [existingOrder] = await db
      .select({ id: lmsOrders.id })
      .from(lmsOrders)
      .where(and(eq(lmsOrders.userId, userId), eq(lmsOrders.stripeSessionId, sessionId)))
      .limit(1);
    if (existingOrder) {
      orderId = existingOrder.id;
      if (stripeSubscriptionId) {
        await db.update(lmsOrders).set({
          stripeSubscriptionId,
          status: "paid",
          ...(paymentIntentFromSession || stripeDetails?.paymentIntentId
            ? { stripePaymentIntentId: paymentIntentFromSession ?? stripeDetails?.paymentIntentId ?? undefined }
            : {}),
        }).where(eq(lmsOrders.id, orderId));
      }
    } else if (stripeSubscriptionId) {
      const [orderBySub] = await db
        .select({ id: lmsOrders.id })
        .from(lmsOrders)
        .where(eq(lmsOrders.stripeSubscriptionId, stripeSubscriptionId))
        .limit(1);
      if (orderBySub) {
        orderId = orderBySub.id;
        await db.update(lmsOrders).set({ userId, courseId, status: "paid" }).where(eq(lmsOrders.id, orderId));
        notes.push(`Reused order #${orderId} for subscription ${stripeSubscriptionId}`);
      }
    }
    if (!orderId) {
      const [inserted] = await db.insert(lmsOrders).values({
        userId,
        courseId,
        amount: amountTotal || stripeDetails?.amountCents || 0,
        currency: (session.currency as string) ?? stripeDetails?.currency ?? "usd",
        stripeSessionId: sessionId.startsWith("reconcile_sub_") ? null : sessionId,
        stripeSubscriptionId,
        stripePaymentIntentId: paymentIntentFromSession ?? stripeDetails?.paymentIntentId ?? null,
        status: "paid",
        seats: meta.seats ? parseInt(meta.seats, 10) : 1,
      }).$returningId();
      orderId = inserted?.id ?? null;
      notes.push(`Created order #${orderId}`);
    }
  }

  const [course] = await db
    .select({ title: lmsCourses.title, slug: lmsCourses.slug })
    .from(lmsCourses)
    .where(eq(lmsCourses.id, courseId))
    .limit(1);

  const [existingEnrollment] = await db
    .select({
      id: lmsEnrollments.id,
      enrollmentType: lmsEnrollments.enrollmentType,
      accessExpiresAt: lmsEnrollments.accessExpiresAt,
      stripeSubscriptionId: lmsEnrollments.stripeSubscriptionId,
    })
    .from(lmsEnrollments)
    .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId)))
    .limit(1);

  const shouldRenew =
    !existingEnrollment ||
    existingEnrollment.enrollmentType === "free_preview" ||
    !isEnrollmentAccessActive(existingEnrollment);

  // ── Duplicate one-time payment guard ──────────────────────────────────────
  // If the user is already actively enrolled and this is a one-time payment
  // (not a subscription renewal), automatically refund the duplicate charge.
  const pricingType = meta.pricing_type ?? "one_time";
  const isDuplicateOneTimePayment =
    !shouldRenew &&
    !stripeSubscriptionId &&
    (pricingType === "one_time" || pricingType === "payment_plan") &&
    paymentIntentFromSession;

  if (isDuplicateOneTimePayment) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
      await stripe.refunds.create({
        payment_intent: paymentIntentFromSession!,
        reason: "duplicate",
      });
      notes.push(`Duplicate payment auto-refunded: ${paymentIntentFromSession}`);
      await notifyOwner({
        title: "⚠️ Duplicate LMS Payment Auto-Refunded",
        content: `User ${userId} (${customerEmail}) was already enrolled in ${course?.title ?? `course #${courseId}`}. Payment ${paymentIntentFromSession} has been automatically refunded.`,
      }).catch(() => {});
    } catch (refundErr) {
      console.error(`[LmsCheckoutFulfillment] Auto-refund failed for ${paymentIntentFromSession}:`, refundErr);
      notes.push(`Auto-refund FAILED for ${paymentIntentFromSession} — manual action required`);
      await notifyOwner({
        title: "🚨 Duplicate LMS Payment — REFUND FAILED",
        content: `User ${userId} (${customerEmail}) was already enrolled in ${course?.title ?? `course #${courseId}`}. Auto-refund of ${paymentIntentFromSession} FAILED. Manual refund required in Stripe Dashboard.`,
      }).catch(() => {});
    }
    return { success: true, userId, courseId, orderId, isNewUser, notes };
  }

  if (!existingEnrollment) {
    await db.insert(lmsEnrollments).values({
      userId,
      courseId,
      orderId,
      affiliateCode: meta.affiliate_code ?? null,
      enrollmentType: "full",
      enrolledAt: new Date(),
      accessExpiresAt,
      source: "stripe",
      stripeSubscriptionId,
    });
    notes.push(`Enrolled in ${course?.title ?? `course #${courseId}`}`);
  } else if (shouldRenew) {
    await db.update(lmsEnrollments).set({
      enrollmentType: "full",
      orderId: orderId ?? undefined,
      enrolledAt: new Date(),
      accessExpiresAt,
      source: "stripe",
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
    }).where(eq(lmsEnrollments.id, existingEnrollment.id));
    notes.push(`Renewed enrollment for ${course?.title ?? `course #${courseId}`}`);
  } else if (stripeSubscriptionId && !existingEnrollment.stripeSubscriptionId) {
    await db.update(lmsEnrollments).set({
      orderId: orderId ?? undefined,
      source: "stripe",
      stripeSubscriptionId,
      ...(accessExpiresAt ? { accessExpiresAt } : {}),
    }).where(eq(lmsEnrollments.id, existingEnrollment.id));
    notes.push(`Linked Stripe subscription to existing enrollment #${existingEnrollment.id}`);
  } else {
    notes.push("Already enrolled (active)");
  }

  if (customerEmail && course?.slug && (shouldRenew || isNewUser) && !options.linkOnly) {
    try {
      let accessToken: string | null = null;
      try {
        accessToken = await getOrCreateAccessToken(userId);
      } catch { /* optional */ }
      await sendEnrollmentEmail({
        to: { name: customerName || customerEmail.split("@")[0], email: customerEmail },
        courseTitle: course.title,
        courseSlug: course.slug,
        accessToken,
      });
      notes.push("Enrollment email sent");
    } catch (err) {
      console.error(`[LmsCheckoutFulfillment] Email failed for ${customerEmail}:`, err);
      notes.push("Enrollment email failed");
    }
  }

  await notifyOwner({
    title: "🎓 LMS Checkout Fulfilled",
    content: `User ${userId} (${customerEmail}) — ${course?.title ?? courseId}. ${notes.join("; ")}`,
  }).catch(() => {});

  if (userId && courseId && (shouldRenew || !existingEnrollment)) {
    const { onCourseEnrollment } = await import("./communityAutoJoin");
    onCourseEnrollment(userId, courseId);
  }

  return { success: true, userId, courseId, orderId, isNewUser, notes };
}
