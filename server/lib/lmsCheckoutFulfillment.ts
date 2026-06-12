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

export async function reconcileLmsCheckoutFromStripeSession(
  db: MySql2Database<typeof schema>,
  session: Record<string, unknown>,
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

  let userId = meta.user_id ? parseInt(meta.user_id, 10) : null;
  let isNewUser = false;

  if (!userId && customerEmail) {
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
  let accessExpiresAt: Date | null = null;

  if (stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      if (sub.current_period_end) {
        accessExpiresAt = new Date(sub.current_period_end * 1000);
      }
    } catch (err) {
      console.warn(`[LmsCheckoutFulfillment] Could not load subscription ${stripeSubscriptionId}:`, err);
    }
  }

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
    } else {
      const [inserted] = await db.insert(lmsOrders).values({
        userId,
        courseId,
        amount: amountTotal,
        currency: (session.currency as string) ?? "usd",
        stripeSessionId: sessionId,
        stripeSubscriptionId,
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
    })
    .from(lmsEnrollments)
    .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId)))
    .limit(1);

  const shouldRenew =
    !existingEnrollment ||
    existingEnrollment.enrollmentType === "free_preview" ||
    !isEnrollmentAccessActive(existingEnrollment);

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
  } else {
    notes.push("Already enrolled (active)");
  }

  if (customerEmail && course?.slug && (shouldRenew || isNewUser)) {
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

  return { success: true, userId, courseId, orderId, isNewUser, notes };
}
