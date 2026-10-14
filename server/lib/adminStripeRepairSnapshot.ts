import { and, desc, eq } from "drizzle-orm";
import type { getDb } from "../db";
import {
  brandMemberships,
  lmsEnrollments,
  lmsCourses,
  lmsOrders,
  membershipPlans,
  membershipSubscriptions,
  users,
  workshopEnrollments,
  workshopInstances,
  workshops,
} from "../../drizzle/schema";
import { getStripeClient } from "./stripeClient";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type StripeSubscriptionSummary = {
  id: string;
  status: string;
  customerId: string;
  priceId: string | null;
  productName: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type StripeCheckoutSessionSummary = {
  id: string;
  status: string | null;
  paymentStatus: string | null;
  mode: string | null;
  amountTotal: number | null;
  customerEmail: string | null;
  subscriptionId: string | null;
  metadataType: string | null;
  createdAt: string | null;
};

export type AdminStripeRepairSnapshot = {
  userId: number;
  email: string;
  db: {
    nativeMembershipSubscriptions: Array<{
      id: number;
      planTitle: string | null;
      status: string | null;
      stripeSubscriptionId: string | null;
      currentPeriodEnd: string | null;
    }>;
    brandMemberships: Array<{
      id: number;
      brand: string;
      tier: string;
      status: string;
      stripeSubscriptionId: string | null;
    }>;
    lmsEnrollments: Array<{
      enrollmentId: number;
      courseId: number;
      courseTitle: string | null;
      stripeSubscriptionId: string | null;
      orderStripeSessionId: string | null;
    }>;
    workshopEnrollments: Array<{
      enrollmentId: number;
      workshopTitle: string | null;
      instanceTitle: string | null;
      stripeSessionId: string | null;
      status: string | null;
    }>;
  };
  stripe: {
    configured: boolean;
    customers: Array<{ id: string; email: string | null }>;
    subscriptions: StripeSubscriptionSummary[];
    recentCheckoutSessions: StripeCheckoutSessionSummary[];
    duplicateSubscriptionIds: string[];
  };
  suggestedActions: string[];
};

function metaType(meta: Record<string, string> | null | undefined): string | null {
  if (!meta?.type) return null;
  return meta.type;
}

/** Load DB + Stripe view for platform-admin purchase repair. */
export async function buildAdminStripeRepairSnapshot(
  db: Db,
  userId: number,
): Promise<AdminStripeRepairSnapshot> {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.email) {
    throw new Error("User not found or missing email");
  }
  const email = user.email.trim();

  const nativeRows = await db
    .select({
      id: membershipSubscriptions.id,
      status: membershipSubscriptions.status,
      stripeSubscriptionId: membershipSubscriptions.stripeSubscriptionId,
      currentPeriodEnd: membershipSubscriptions.currentPeriodEnd,
      planTitle: membershipPlans.title,
    })
    .from(membershipSubscriptions)
    .leftJoin(membershipPlans, eq(membershipPlans.id, membershipSubscriptions.planId))
    .where(eq(membershipSubscriptions.userId, userId))
    .orderBy(desc(membershipSubscriptions.id));

  const brandRows = await db
    .select({
      id: brandMemberships.id,
      brand: brandMemberships.brand,
      tier: brandMemberships.tier,
      status: brandMemberships.status,
      stripeSubscriptionId: brandMemberships.stripeSubscriptionId,
    })
    .from(brandMemberships)
    .where(eq(brandMemberships.userId, userId));

  const lmsRows = await db
    .select({
      enrollmentId: lmsEnrollments.id,
      courseId: lmsEnrollments.courseId,
      courseTitle: lmsCourses.title,
      stripeSubscriptionId: lmsEnrollments.stripeSubscriptionId,
      orderStripeSessionId: lmsOrders.stripeSessionId,
    })
    .from(lmsEnrollments)
    .leftJoin(lmsCourses, eq(lmsCourses.id, lmsEnrollments.courseId))
    .leftJoin(lmsOrders, eq(lmsOrders.id, lmsEnrollments.orderId))
    .where(eq(lmsEnrollments.userId, userId))
    .orderBy(desc(lmsEnrollments.id));

  const workshopRows = await db
    .select({
      enrollmentId: workshopEnrollments.id,
      workshopTitle: workshops.title,
      instanceTitle: workshopInstances.title,
      stripeSessionId: workshopEnrollments.stripeSessionId,
      status: workshopEnrollments.status,
    })
    .from(workshopEnrollments)
    .leftJoin(workshops, eq(workshops.id, workshopEnrollments.workshopId))
    .leftJoin(workshopInstances, eq(workshopInstances.id, workshopEnrollments.instanceId))
    .where(eq(workshopEnrollments.userId, userId))
    .orderBy(desc(workshopEnrollments.id));

  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY?.trim();
  const customers: AdminStripeRepairSnapshot["stripe"]["customers"] = [];
  const subscriptions: StripeSubscriptionSummary[] = [];
  const recentCheckoutSessions: StripeCheckoutSessionSummary[] = [];
  const duplicateSubscriptionIds: string[] = [];

  if (stripeConfigured) {
    try {
      const stripe = getStripeClient();
      const customerList = await stripe.customers.list({ email, limit: 10 });
      for (const c of customerList.data) {
        customers.push({ id: c.id, email: c.email });
        const subs = await stripe.subscriptions.list({
          customer: c.id,
          status: "all",
          limit: 25,
        });
        const byPrice = new Map<string, string[]>();
        for (const sub of subs.data) {
          const priceId = sub.items?.data?.[0]?.price?.id ?? null;
          const product = sub.items?.data?.[0]?.price?.product;
          const productName =
            typeof product === "object" && product && "name" in product
              ? String((product as { name?: string }).name ?? "")
              : null;
          subscriptions.push({
            id: sub.id,
            status: sub.status,
            customerId: c.id,
            priceId,
            productName,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
          });
          if (priceId && (sub.status === "active" || sub.status === "trialing")) {
            const list = byPrice.get(priceId) ?? [];
            list.push(sub.id);
            byPrice.set(priceId, list);
          }
        }
        for (const ids of byPrice.values()) {
          if (ids.length > 1) duplicateSubscriptionIds.push(...ids);
        }

        const sessions = await stripe.checkout.sessions.list({ customer: c.id, limit: 15 });
        for (const s of sessions.data) {
          recentCheckoutSessions.push({
            id: s.id,
            status: s.status,
            paymentStatus: s.payment_status,
            mode: s.mode,
            amountTotal: s.amount_total,
            customerEmail: s.customer_details?.email ?? s.customer_email ?? null,
            subscriptionId: typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null,
            metadataType: metaType(s.metadata as Record<string, string>),
            createdAt: s.created ? new Date(s.created * 1000).toISOString() : null,
          });
        }
      }
    } catch (err) {
      console.error("[adminStripeRepairSnapshot] Stripe lookup failed:", err);
    }
  }

  const suggestedActions: string[] = [];
  if (duplicateSubscriptionIds.length > 0) {
    suggestedActions.push(
      "Multiple active Stripe subscriptions share the same price — pick one sub_… to keep, cancel extras in Stripe Dashboard, then run membership.reconcileStripeMembership on the kept sub.",
    );
  }
  if (subscriptions.some((s) => s.status === "active") && nativeRows.every((r) => !r.stripeSubscriptionId)) {
    suggestedActions.push(
      "Stripe shows an active subscription but Learn membership_subscriptions has no stripe_subscription_id — run Add Subscription from Stripe (membership.reconcileStripeMembership).",
    );
  }
  if (
    recentCheckoutSessions.some((s) => s.metadataType === "hosted_checkout" || s.metadataType === "course")
    && lmsRows.length === 0
  ) {
    suggestedActions.push(
      "Paid LMS checkout session exists but no enrollment — run LMS reconcile with cs_… or sub_… (lmsEnrollmentAdmin.reconcileStripeLmsCheckout).",
    );
  }
  if (
    recentCheckoutSessions.some((s) => s.metadataType === "workshop")
    && workshopRows.length === 0
  ) {
    suggestedActions.push(
      "Paid workshop checkout session exists but no workshop_enrollments row — run workshop reconcile with cs_….",
    );
  }
  if (suggestedActions.length === 0) {
    suggestedActions.push(
      "Compare Subscriptions tab to Stripe. If access is missing, use Repair Access, then reconcile by product type with the matching cs_… or sub_… id.",
    );
  }

  return {
    userId,
    email,
    db: {
      nativeMembershipSubscriptions: nativeRows.map((r) => ({
        id: r.id,
        planTitle: r.planTitle,
        status: r.status,
        stripeSubscriptionId: r.stripeSubscriptionId,
        currentPeriodEnd: r.currentPeriodEnd
          ? new Date(Number(r.currentPeriodEnd) * 1000).toISOString()
          : null,
      })),
      brandMemberships: brandRows.map((r) => ({
        id: r.id,
        brand: r.brand,
        tier: r.tier,
        status: r.status,
        stripeSubscriptionId: r.stripeSubscriptionId,
      })),
      lmsEnrollments: lmsRows.map((r) => ({
        enrollmentId: r.enrollmentId,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        stripeSubscriptionId: r.stripeSubscriptionId,
        orderStripeSessionId: r.orderStripeSessionId,
      })),
      workshopEnrollments: workshopRows.map((r) => ({
        enrollmentId: r.enrollmentId,
        workshopTitle: r.workshopTitle,
        instanceTitle: r.instanceTitle,
        stripeSessionId: r.stripeSessionId,
        status: r.status,
      })),
    },
    stripe: {
      configured: stripeConfigured,
      customers,
      subscriptions,
      recentCheckoutSessions,
      duplicateSubscriptionIds: [...new Set(duplicateSubscriptionIds)],
    },
    suggestedActions,
  };
}
