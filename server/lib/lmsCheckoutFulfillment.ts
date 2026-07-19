import { getStripeClient } from "./stripeClient";
/**
 * LMS hosted checkout fulfillment — enrolls users after Stripe payment.
 * Handles guest buyers (no user_id / order_id in metadata).
 */

import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import {
  lmsCourses,
  lmsCohortGroups,
  lmsCohortGroupEnrollments,
  lmsEnrollments,
  lmsOrders,
  lmsPricingOptions,
  platformSettings,
} from "../../drizzle/schema";
import { getOrCreateUserByEmail, getOrCreateAccessToken } from "../db";
import { sendEnrollmentEmail, sendQuizAccessEmail } from "./enrollmentEmail";
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
    const stripe = getStripeClient();
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
  let newUserResetToken: string | null = null;

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
    newUserResetToken = created.isNew ? (created as any).resetToken ?? null : null;
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
    .select({ title: lmsCourses.title, slug: lmsCourses.slug, type: lmsCourses.type, sendEnrollmentEmail: lmsCourses.sendEnrollmentEmail })
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
  // (not a subscription renewal), notify admin — do NOT auto-refund.
  //
  // IMPORTANT: Before firing the alert, check if this session was already
  // processed (i.e. an order with this session ID exists). If so, this is a
  // Stripe webhook retry — NOT a real duplicate payment — and we should skip
  // the alert silently.
  const pricingType = meta.pricing_type ?? "one_time";
  const isDuplicateOneTimePayment =
    !shouldRenew &&
    !stripeSubscriptionId &&
    (pricingType === "one_time" || pricingType === "payment_plan") &&
    paymentIntentFromSession;

  if (isDuplicateOneTimePayment) {
    // Check if this session was already fulfilled (webhook retry guard)
    const [alreadyProcessed] = await db
      .select({ id: lmsOrders.id })
      .from(lmsOrders)
      .where(and(eq(lmsOrders.userId, userId), eq(lmsOrders.stripeSessionId, sessionId)))
      .limit(1);
    if (alreadyProcessed) {
      console.log(`[LmsCheckoutFulfillment] Webhook retry detected for session ${sessionId} — enrollment already exists, skipping duplicate alert`);
      notes.push("Webhook retry — enrollment already active, no action needed");
      return { success: true, userId, courseId, orderId, isNewUser, notes };
    }
    const courseTitle = course?.title ?? `Course #${courseId}`;
    const stripeLink = `https://dashboard.stripe.com/payments/${paymentIntentFromSession}`;
    const adminEmail = process.env.PLATFORM_ADMIN_EMAIL ?? "admin@allaboutultrasound.com";
    // Notify owner via in-app notification
    await notifyOwner({
      title: "⚠️ Duplicate LMS Payment — Action Required",
      content: `User ${userId} (${customerEmail}) was already enrolled in "${courseTitle}" but submitted a second payment.\n\nPayment Intent: ${paymentIntentFromSession}\nOrder ID: ${orderId ?? "N/A"}\n\nAction required: Review in Stripe Dashboard and issue a manual refund if appropriate.\nStripe link: ${stripeLink}`,
    }, { skipAdminEmail: true }).catch(() => {});
    // Send admin email with full details and instructions
    const { sendEmail } = await import("../_core/email");
    await sendEmail({
      to: { name: "Platform Admin", email: adminEmail },
      subject: `⚠️ Duplicate LMS Payment — ${courseTitle} — Action Required`,
      htmlBody: `
        <h2 style="color:#b91c1c;">Duplicate LMS Payment Detected</h2>
        <p>A user has been charged a second time for a course they are already enrolled in. <strong>No automatic action has been taken.</strong> Please review and refund manually if appropriate.</p>
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>User ID</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${userId}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Email</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${customerEmail ?? "unknown"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Course</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${courseTitle} (ID: ${courseId})</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Payment Intent</strong></td><td style="padding:8px;border:1px solid #e5e7eb;"><a href="${stripeLink}">${paymentIntentFromSession}</a></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Order ID</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${orderId ?? "N/A"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Pricing Type</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${pricingType}</td></tr>
        </table>
        <h3 style="margin-top:24px;">Recommended Actions</h3>
        <ol>
          <li>Open the <a href="${stripeLink}">Stripe payment</a> and confirm it is a genuine duplicate (same user, same course).</li>
          <li>If confirmed duplicate: click <strong>Refund</strong> in Stripe Dashboard and select reason <em>Duplicate</em>.</li>
          <li>If the user intended to purchase a different course or product, contact them before refunding.</li>
          <li>If the user should retain access (e.g. gift purchase), do not refund — update enrollment manually in the admin panel.</li>
        </ol>
        <p style="color:#6b7280;font-size:12px;">This notification was generated automatically. No refund has been issued.</p>
      `,
    }).catch((emailErr: unknown) => {
      console.error("[LmsCheckoutFulfillment] Failed to send duplicate payment admin email:", emailErr);
    });
    console.warn(`[LmsCheckoutFulfillment] Duplicate one-time payment detected: user=${userId} course=${courseId} pi=${paymentIntentFromSession} — admin notified, no auto-refund`);
    notes.push(`Duplicate payment detected (${paymentIntentFromSession}) — admin notified, no auto-refund`);
    const { logDuplicatePaymentFlag } = await import("./duplicatePaymentLog");
    await logDuplicatePaymentFlag({
      kind: "lms_duplicate_payment",
      email: customerEmail,
      productName: courseTitle,
      userId,
      stripePaymentIntentId: paymentIntentFromSession,
      message: `Duplicate LMS payment for "${courseTitle}" — review refund in Stripe`,
      rawPayload: { courseId, orderId, pricingType },
    });
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
      // Respect per-course and platform-level email enable flags
      const courseEmailEnabled = course.sendEnrollmentEmail !== false;
      let platformEmailEnabled = true;
      try {
        const [platformRow] = await db.select({ enrollmentEmailEnabled: platformSettings.enrollmentEmailEnabled }).from(platformSettings).limit(1);
        platformEmailEnabled = platformRow?.enrollmentEmailEnabled !== false;
      } catch { /* non-fatal */ }

      if (courseEmailEnabled && platformEmailEnabled) {
        let accessToken: string | null = null;
        try {
          accessToken = await getOrCreateAccessToken(userId);
        } catch { /* optional */ }
        // For new guest accounts, include a set-password URL so they can create a permanent login
        const setPasswordUrl = newUserResetToken
          ? `https://app.allaboutultrasound.com/auth/reset-password?token=${newUserResetToken}`
          : null;
        if (course.type === "quiz") {
          await sendQuizAccessEmail({
            to: { name: customerName || customerEmail.split("@")[0], email: customerEmail },
            quizTitle: course.title,
            accessToken,
            setPasswordUrl,
          });
          notes.push("Quiz access email sent");
        } else {
          await sendEnrollmentEmail({
            to: { name: customerName || customerEmail.split("@")[0], email: customerEmail },
            courseTitle: course.title,
            courseSlug: course.slug,
            accessToken,
            setPasswordUrl,
          });
          notes.push("Enrollment email sent");
        }
      } else {
        notes.push(`Enrollment email skipped (course=${courseEmailEnabled}, platform=${platformEmailEnabled})`);
      }
    } catch (err) {
      console.error(`[LmsCheckoutFulfillment] Email failed for ${customerEmail}:`, err);
      notes.push("Enrollment email failed");
    }
  }

  // Only notify when enrollment was newly created or renewed — not on idempotent re-runs
  // (prevents duplicate notifications when both webhook and frontend polling call this function)
  if (shouldRenew || !existingEnrollment) {
    await notifyOwner({
      title: "🎓 LMS Checkout Fulfilled",
      content: `User ${userId} (${customerEmail}) — ${course?.title ?? courseId}. ${notes.join("; ")}`,
    }).catch(() => {});
  }

  if (userId && courseId && (shouldRenew || !existingEnrollment)) {
    const { onCourseEnrollment } = await import("./communityAutoJoin");
    onCourseEnrollment(userId, courseId);
  }

  // ── Cohort group auto-assignment ──────────────────────────────────────────
  // If this is a cohort course, auto-assign the student to the featured group.
  // Only runs on new enrollment or renewal (not idempotent re-runs).
  if (userId && courseId && course?.type === "cohort" && (shouldRenew || !existingEnrollment)) {
    try {
      // Find the featured cohort group (isFeaturedOnLanding = true), or fall back
      // to the next upcoming open group ordered by start_date asc.
      const [featuredGroup] = await db
        .select({ id: lmsCohortGroups.id })
        .from(lmsCohortGroups)
        .where(and(eq(lmsCohortGroups.courseId, courseId), eq(lmsCohortGroups.isFeaturedOnLanding, true)))
        .limit(1);

      const cohortGroupId = featuredGroup?.id ?? null;

      if (cohortGroupId) {
        // Get the enrollment id we just created/updated
        const [enrollment] = await db
          .select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId)))
          .limit(1);

        if (enrollment) {
          // Check if already assigned to avoid duplicates
          const [existing] = await db
            .select({ id: lmsCohortGroupEnrollments.id })
            .from(lmsCohortGroupEnrollments)
            .where(and(
              eq(lmsCohortGroupEnrollments.userId, userId),
              eq(lmsCohortGroupEnrollments.courseId, courseId),
            ))
            .limit(1);

          if (!existing) {
            await db.insert(lmsCohortGroupEnrollments).values({
              cohortGroupId,
              enrollmentId: enrollment.id,
              userId,
              courseId,
            });
            notes.push(`Auto-assigned to cohort group #${cohortGroupId}`);
          } else {
            notes.push(`Already assigned to cohort group #${existing.id}`);
          }
        }
      } else {
        notes.push("No featured cohort group found — skipping group assignment");
      }
    } catch (cohortErr) {
      console.error("[LmsCheckoutFulfillment] Cohort group assignment failed:", cohortErr);
      notes.push("Cohort group assignment failed (non-fatal)");
    }
  }

  return { success: true, userId, courseId, orderId, isNewUser, notes };
}
