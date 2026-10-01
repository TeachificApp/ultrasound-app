import { and, eq } from "drizzle-orm";
import {
  lmsCourses,
  lmsEnrollments,
  lmsOrders,
  lmsSubscriptionInvoices,
  users,
} from "../../drizzle/schema";

/**
 * The platform stores the initial Checkout payment in lms_orders. Every later
 * paid Stripe invoice is stored separately so renewals are never mistaken for
 * a second enrollment, and so member/admin totals have an auditable ledger.
 */
export type StripeInvoiceRecord = {
  id?: string;
  subscription?: string | { id?: string } | null;
  payment_intent?: string | { id?: string } | null;
  amount_paid?: number | null;
  currency?: string | null;
  number?: string | null;
  hosted_invoice_url?: string | null;
  billing_reason?: string | null;
  created?: number | null;
  status_transitions?: { paid_at?: number | null } | null;
  lines?: { data?: Array<{ description?: string | null }> } | null;
};

export type StripeSubscriptionRecord = {
  id: string;
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: number | null;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
        product?: string | { id?: string; metadata?: Record<string, string> | null; name?: string | null } | null;
      } | null;
    }>;
  } | null;
  description?: string | null;
};

export type StripePriceRecord = {
  id: string;
  product?: string | { id?: string } | null;
};

export type StripeReconciliationClient = {
  subscriptions: {
    retrieve: (id: string, options?: Record<string, unknown>) => Promise<StripeSubscriptionRecord>;
    list: (params: Record<string, unknown>) => Promise<{ data: StripeSubscriptionRecord[] }>;
  };
  customers: {
    list: (params: Record<string, unknown>) => Promise<{ data: Array<{ id: string }> }>;
  };
  prices: {
    retrieve: (id: string) => Promise<StripePriceRecord>;
  };
  invoices: {
    list: (params: Record<string, unknown>) => Promise<{ data: StripeInvoiceRecord[] }>;
  };
};

type LmsOrderCandidate = {
  id: number;
  userId: number;
  courseId: number;
  stripeSubscriptionId: string | null;
  stripeSessionId: string | null;
  email: string | null;
  courseTitle: string | null;
  pricingType: string | null;
  stripePriceId: string | null;
};

export function stripeResourceId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") return value.id;
  return null;
}

/** The Checkout invoice is already represented by lms_orders; mirror paid renewals and paid changes only. */
export function shouldMirrorLmsSubscriptionInvoice(invoice: StripeInvoiceRecord): boolean {
  return Boolean(invoice.id)
    && Number(invoice.amount_paid ?? 0) > 0
    && invoice.billing_reason !== "subscription_create";
}

export function subscriptionMatchesOrder(
  subscription: StripeSubscriptionRecord,
  order: LmsOrderCandidate,
  stripeProductId: string | null = null,
): boolean {
  const metadata = subscription.metadata ?? {};
  if (metadata.order_id === String(order.id) || metadata.course_id === String(order.courseId)) return true;

  const product = subscription.items?.data?.[0]?.price?.product;
  if (order.stripePriceId && subscription.items?.data?.some((item) => item.price?.id === order.stripePriceId)) {
    return true;
  }
  if (stripeProductId && subscription.items?.data?.some((item) => stripeResourceId(item.price?.product) === stripeProductId)) {
    return true;
  }
  if (product && typeof product === "object") {
    if (product.metadata?.course_id === String(order.courseId)) return true;
    if (order.courseTitle && product.name?.trim().toLowerCase() === order.courseTitle.trim().toLowerCase()) return true;
  }

  return Boolean(
    order.courseTitle
    && subscription.description?.toLowerCase().includes(order.courseTitle.toLowerCase()),
  );
}

/**
 * Resolve a local subscription reference safely. The primary path is the stored
 * ID. Legacy records with a malformed/missing value are recovered only from a
 * matching Stripe Customer subscription (order/course metadata or product).
 */
export async function resolveStripeSubscriptionForLmsOrder(
  stripe: StripeReconciliationClient,
  order: LmsOrderCandidate,
): Promise<StripeSubscriptionRecord | null> {
  if (order.stripeSubscriptionId) {
    try {
      return await stripe.subscriptions.retrieve(order.stripeSubscriptionId);
    } catch (error: any) {
      if (error?.code !== "resource_missing" && error?.statusCode !== 404) throw error;
    }
  }

  if (!order.email) return null;
  let stripeProductId: string | null = null;
  if (order.stripePriceId) {
    try {
      stripeProductId = stripeResourceId((await stripe.prices.retrieve(order.stripePriceId)).product);
    } catch (error: any) {
      if (error?.code !== "resource_missing" && error?.statusCode !== 404) throw error;
    }
  }
  const customers = await stripe.customers.list({ email: order.email, limit: 10 });
  const candidates: StripeSubscriptionRecord[] = [];
  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 100,
    });
    for (const subscription of subscriptions.data) {
      if (subscriptionMatchesOrder(subscription, order, stripeProductId)) {
        candidates.push(subscription);
        continue;
      }

      // Older Checkouts can have a truncated local subscription ID and lack
      // subscription metadata. A paid invoice line naming the exact course is
      // still a deterministic Stripe-side match without guessing by customer.
      if (order.courseTitle) {
        const invoices = await stripe.invoices.list({ subscription: subscription.id, status: "paid", limit: 100 });
        const hasCourseInvoice = invoices.data.some((invoice) =>
          invoice.lines?.data?.some((line) =>
            line.description?.toLowerCase().includes(order.courseTitle!.toLowerCase()),
          ),
        );
        if (hasCourseInvoice) candidates.push(subscription);
      }
    }
  }

  return candidates.length === 1 ? candidates[0] : null;
}

export async function persistLmsSubscriptionInvoice(
  db: any,
  order: Pick<LmsOrderCandidate, "id" | "userId" | "courseId">,
  subscriptionId: string,
  invoice: StripeInvoiceRecord,
): Promise<boolean> {
  if (!shouldMirrorLmsSubscriptionInvoice(invoice) || !invoice.id) return false;

  const [existing] = await db.select({ id: lmsSubscriptionInvoices.id })
    .from(lmsSubscriptionInvoices)
    .where(eq(lmsSubscriptionInvoices.stripeInvoiceId, invoice.id))
    .limit(1);
  if (existing) return false;

  const paidAtSeconds = invoice.status_transitions?.paid_at ?? invoice.created ?? Math.floor(Date.now() / 1_000);
  await db.insert(lmsSubscriptionInvoices).values({
    userId: order.userId,
    courseId: order.courseId,
    orderId: order.id,
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: stripeResourceId(invoice.payment_intent),
    amountPaid: Math.round(Number(invoice.amount_paid ?? 0)),
    currency: (invoice.currency ?? "usd").toLowerCase(),
    invoiceNumber: invoice.number ?? null,
    invoiceUrl: invoice.hosted_invoice_url ?? null,
    description: invoice.lines?.data?.[0]?.description ?? null,
    paidAt: new Date(paidAtSeconds * 1_000),
  });
  return true;
}

export type LmsSubscriptionReconciliationSummary = {
  scanned: number;
  referencesRepaired: number;
  invoicesAdded: number;
  unresolved: number;
};

/**
 * Reconcile existing LMS recurring billing against Stripe. Safe to run repeatedly:
 * references are updated only after a deterministic match and invoice IDs are unique.
 */
export async function reconcileLmsSubscriptionBilling(
  db: any,
  stripe: StripeReconciliationClient,
  input: { userId?: number } = {},
): Promise<LmsSubscriptionReconciliationSummary> {
  const where = input.userId
    ? and(eq(lmsOrders.status, "paid"), eq(lmsOrders.userId, input.userId))
    : eq(lmsOrders.status, "paid");
  const orders: LmsOrderCandidate[] = await db.select({
    id: lmsOrders.id,
    userId: lmsOrders.userId,
    courseId: lmsOrders.courseId,
    stripeSubscriptionId: lmsOrders.stripeSubscriptionId,
    stripeSessionId: lmsOrders.stripeSessionId,
    email: users.email,
    courseTitle: lmsCourses.title,
    pricingType: lmsCourses.pricingType,
    stripePriceId: lmsCourses.stripePriceId,
  })
    .from(lmsOrders)
    .leftJoin(users, eq(users.id, lmsOrders.userId))
    .leftJoin(lmsCourses, eq(lmsCourses.id, lmsOrders.courseId))
    .where(where);

  const summary: LmsSubscriptionReconciliationSummary = {
    scanned: orders.length,
    referencesRepaired: 0,
    invoicesAdded: 0,
    unresolved: 0,
  };

  for (const order of orders) {
    // Never infer a subscription from a one-time Checkout. Legacy recurring rows
    // can be repaired from their session/customer details even if their stored
    // subscription ID was corrupted.
    if (!order.stripeSubscriptionId && !["subscription", "payment_plan", "trial_then_subscription"].includes(order.pricingType ?? "")) continue;

    let subscription: StripeSubscriptionRecord | null = null;
    try {
      subscription = await resolveStripeSubscriptionForLmsOrder(stripe, order);
    } catch (error) {
      console.warn(`[LMS billing] Unable to resolve Stripe subscription for order ${order.id}:`, error);
      summary.unresolved++;
      continue;
    }
    if (!subscription) {
      summary.unresolved++;
      continue;
    }

    if (order.stripeSubscriptionId !== subscription.id) {
      await db.update(lmsOrders)
        .set({ stripeSubscriptionId: subscription.id })
        .where(eq(lmsOrders.id, order.id));
      await db.update(lmsEnrollments)
        .set({ stripeSubscriptionId: subscription.id })
        .where(and(eq(lmsEnrollments.orderId, order.id), eq(lmsEnrollments.userId, order.userId)));
      summary.referencesRepaired++;
    }

    const invoices = await stripe.invoices.list({ subscription: subscription.id, status: "paid", limit: 100 });
    for (const invoice of invoices.data) {
      if (await persistLmsSubscriptionInvoice(db, order, subscription.id, invoice)) summary.invoicesAdded++;
    }
  }

  return summary;
}

export async function getLmsSubscriptionInvoicesForUser(db: any, userId: number) {
  return db.select({
    id: lmsSubscriptionInvoices.id,
    orderId: lmsSubscriptionInvoices.orderId,
    courseId: lmsSubscriptionInvoices.courseId,
    courseTitle: lmsCourses.title,
    amountPaid: lmsSubscriptionInvoices.amountPaid,
    currency: lmsSubscriptionInvoices.currency,
    stripePaymentIntentId: lmsSubscriptionInvoices.stripePaymentIntentId,
    stripeInvoiceId: lmsSubscriptionInvoices.stripeInvoiceId,
    invoiceNumber: lmsSubscriptionInvoices.invoiceNumber,
    invoiceUrl: lmsSubscriptionInvoices.invoiceUrl,
    description: lmsSubscriptionInvoices.description,
    paidAt: lmsSubscriptionInvoices.paidAt,
  })
    .from(lmsSubscriptionInvoices)
    .leftJoin(lmsCourses, eq(lmsCourses.id, lmsSubscriptionInvoices.courseId))
    .where(eq(lmsSubscriptionInvoices.userId, userId));
}
