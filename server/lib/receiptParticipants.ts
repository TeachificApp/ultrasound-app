import { and, eq } from "drizzle-orm";
import {
  brandMemberships,
  digitalBundlePurchases,
  digitalPurchases,
  funnelPurchases,
  lmsOrders,
  lmsSubscriptionInvoices,
  manualInvoices,
  membershipSubscriptions,
  physicalProductOrders,
  purchasePayees,
  users,
  webinarRegistrations,
  workshopEnrollments,
} from "../../drizzle/schema";
import { getStripeClient } from "./stripeClient";

export const receiptParticipantSources = [
  "funnel",
  "course_order",
  "course_renewal",
  "download",
  "bundle",
  "workshop",
  "webinar",
  "physical",
  "manual_invoice",
  "stripe_invoice",
] as const;

export type ReceiptParticipantSource = (typeof receiptParticipantSources)[number];

export type ReceiptParticipant = {
  name: string | null;
  email: string;
};

export type ReceiptParticipants = {
  learner: ReceiptParticipant;
  payer: ReceiptParticipant | null;
};

type ReceiptPaymentReference = {
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  subscriptionId?: string | null;
  directPayer?: ReceiptParticipant | null;
};

function asNonBlankString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asParticipant(value: { name?: unknown; email?: unknown }): ReceiptParticipant | null {
  const email = asNonBlankString(value.email)?.toLowerCase() ?? null;
  if (!email) return null;
  return { name: asNonBlankString(value.name), email };
}

function sameEmail(left: ReceiptParticipant, right: ReceiptParticipant) {
  return left.email.trim().toLowerCase() === right.email.trim().toLowerCase();
}

/**
 * Keeps a buyer off the receipt when that buyer and the registered learner are
 * the same person. This gives a single-person purchase one clear identity,
 * while institutional or gift purchases retain both identities.
 */
export function buildReceiptParticipants(
  learner: ReceiptParticipant,
  payer: ReceiptParticipant | null,
): ReceiptParticipants {
  return {
    learner,
    payer: payer && !sameEmail(learner, payer) ? payer : null,
  };
}

/**
 * Retain a purchaser only when they differ from the registered learner. This
 * data is deliberately private to Platform Admin member records and is not
 * returned by any learner-facing route.
 */
export async function recordReceiptPayee(
  db: any,
  userId: number,
  payer: { name?: string | null; email?: string | null },
): Promise<void> {
  const normalizedPayer = asParticipant(payer);
  if (!normalizedPayer) return;
  const [learner] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const learnerEmail = asNonBlankString(learner?.email)?.toLowerCase();
  if (!learnerEmail || learnerEmail === normalizedPayer.email) return;

  const now = new Date();
  try {
    await db.insert(purchasePayees).values({
      userId,
      name: normalizedPayer.name,
      email: normalizedPayer.email,
      firstObservedAt: now,
      lastObservedAt: now,
    }).onDuplicateKeyUpdate({
      set: {
        ...(normalizedPayer.name ? { name: normalizedPayer.name } : {}),
        lastObservedAt: now,
      },
    });
  } catch (error) {
    // Payment fulfillment and learner access must remain available if this
    // nonessential administrative record cannot be saved.
    console.warn("[receiptParticipants] Unable to store alternate purchaser record", error);
  }
}

function participantFromCheckoutSession(session: Record<string, any>): ReceiptParticipant | null {
  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const customerDetails = (session.customer_details ?? {}) as Record<string, unknown>;
  return asParticipant({
    name: metadata.payer_name ?? customerDetails.name,
    email: metadata.payer_email ?? session.customer_email ?? customerDetails.email ?? metadata.customer_email,
  });
}

function participantFromPaymentIntent(paymentIntent: Record<string, any>): ReceiptParticipant | null {
  const charge = paymentIntent.latest_charge && typeof paymentIntent.latest_charge === "object"
    ? paymentIntent.latest_charge as Record<string, any>
    : {};
  const billingDetails = (charge.billing_details ?? {}) as Record<string, unknown>;
  const shipping = (paymentIntent.shipping ?? {}) as Record<string, unknown>;
  return asParticipant({
    name: shipping.name ?? billingDetails.name,
    email: paymentIntent.receipt_email ?? billingDetails.email,
  });
}

async function participantFromSubscription(subscriptionId: string): Promise<ReceiptParticipant | null> {
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["customer"] }) as unknown as Record<string, any>;
  const customer = subscription.customer;
  if (customer && typeof customer === "object") {
    return asParticipant(customer as Record<string, unknown>);
  }
  if (typeof customer === "string") {
    const resolvedCustomer = await stripe.customers.retrieve(customer) as unknown as Record<string, any>;
    return asParticipant(resolvedCustomer);
  }
  return null;
}

async function resolvePayerFromStripe(reference: ReceiptPaymentReference): Promise<ReceiptParticipant | null> {
  const stripe = getStripeClient();
  try {
    if (reference.checkoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(reference.checkoutSessionId) as unknown as Record<string, any>;
      return participantFromCheckoutSession(session);
    }
    if (reference.paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(reference.paymentIntentId, { expand: ["latest_charge"] }) as unknown as Record<string, any>;
      return participantFromPaymentIntent(paymentIntent);
    }
    if (reference.subscriptionId) {
      return await participantFromSubscription(reference.subscriptionId);
    }
  } catch {
    // A legacy or redacted Stripe record must not prevent the learner receipt
    // from rendering. The verified learner identity remains available below.
  }
  return reference.directPayer ?? null;
}

async function findPaymentReference(
  db: any,
  userId: number,
  source: ReceiptParticipantSource,
  transactionId: number | string,
): Promise<ReceiptPaymentReference | null> {
  const numericId = typeof transactionId === "number" ? transactionId : Number(transactionId);
  if (source !== "stripe_invoice" && (!Number.isInteger(numericId) || numericId < 1)) return null;

  if (source === "funnel") {
    const [row] = await db.select({
      checkoutSessionId: funnelPurchases.stripeCheckoutSessionId,
      paymentIntentId: funnelPurchases.stripePaymentIntentId,
      payerName: funnelPurchases.name,
      payerEmail: funnelPurchases.email,
    }).from(funnelPurchases).where(and(eq(funnelPurchases.id, numericId), eq(funnelPurchases.userId, userId))).limit(1);
    return row ? {
      checkoutSessionId: row.checkoutSessionId,
      paymentIntentId: row.paymentIntentId,
      directPayer: asParticipant({ name: row.payerName, email: row.payerEmail }),
    } : null;
  }

  if (source === "course_order") {
    const [row] = await db.select({
      checkoutSessionId: lmsOrders.stripeSessionId,
      paymentIntentId: lmsOrders.stripePaymentIntentId,
      subscriptionId: lmsOrders.stripeSubscriptionId,
    }).from(lmsOrders).where(and(eq(lmsOrders.id, numericId), eq(lmsOrders.userId, userId))).limit(1);
    return row ?? null;
  }

  if (source === "course_renewal") {
    const [row] = await db.select({
      paymentIntentId: lmsSubscriptionInvoices.stripePaymentIntentId,
      subscriptionId: lmsSubscriptionInvoices.stripeSubscriptionId,
    }).from(lmsSubscriptionInvoices).where(and(eq(lmsSubscriptionInvoices.id, numericId), eq(lmsSubscriptionInvoices.userId, userId))).limit(1);
    return row ?? null;
  }

  if (source === "download") {
    const [row] = await db.select({
      checkoutSessionId: digitalPurchases.stripeCheckoutSessionId,
      paymentIntentId: digitalPurchases.stripePaymentIntentId,
    }).from(digitalPurchases).where(and(eq(digitalPurchases.id, numericId), eq(digitalPurchases.userId, userId))).limit(1);
    return row ?? null;
  }

  if (source === "bundle") {
    const [row] = await db.select({
      checkoutSessionId: digitalBundlePurchases.stripeCheckoutSessionId,
      subscriptionId: digitalBundlePurchases.stripeSubscriptionId,
    }).from(digitalBundlePurchases).where(and(eq(digitalBundlePurchases.id, numericId), eq(digitalBundlePurchases.userId, userId))).limit(1);
    return row ?? null;
  }

  if (source === "workshop") {
    const [row] = await db.select({
      checkoutSessionId: workshopEnrollments.stripeSessionId,
      paymentIntentId: workshopEnrollments.stripePaymentIntentId,
    }).from(workshopEnrollments).where(and(eq(workshopEnrollments.id, numericId), eq(workshopEnrollments.userId, userId))).limit(1);
    return row ?? null;
  }

  if (source === "webinar") {
    const [row] = await db.select({
      paymentIntentId: webinarRegistrations.stripePaymentIntentId,
    }).from(webinarRegistrations).where(and(eq(webinarRegistrations.id, numericId), eq(webinarRegistrations.userId, userId))).limit(1);
    return row ?? null;
  }

  if (source === "physical") {
    const [row] = await db.select({
      checkoutSessionId: physicalProductOrders.stripeCheckoutSessionId,
      paymentIntentId: physicalProductOrders.stripePaymentIntentId,
    }).from(physicalProductOrders).where(and(eq(physicalProductOrders.id, numericId), eq(physicalProductOrders.userId, userId))).limit(1);
    return row ?? null;
  }

  if (source === "manual_invoice") {
    const [row] = await db.select({ id: manualInvoices.id })
      .from(manualInvoices)
      .where(and(eq(manualInvoices.id, numericId), eq(manualInvoices.userId, userId)))
      .limit(1);
    return row ? {} : null;
  }

  const invoiceId = asNonBlankString(transactionId);
  if (!invoiceId) return null;
  const customerRows = await Promise.all([
    db.select({ stripeCustomerId: membershipSubscriptions.stripeCustomerId })
      .from(membershipSubscriptions)
      .where(eq(membershipSubscriptions.userId, userId)),
    db.select({ stripeCustomerId: brandMemberships.stripeCustomerId })
      .from(brandMemberships)
      .where(eq(brandMemberships.userId, userId)),
  ]);
  const authorizedCustomerIds = new Set(customerRows.flat().map((row: any) => row.stripeCustomerId).filter(Boolean));
  if (authorizedCustomerIds.size === 0) return null;

  try {
    const invoice = await getStripeClient().invoices.retrieve(invoiceId) as unknown as Record<string, any>;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId || !authorizedCustomerIds.has(customerId)) return null;
    return {
      directPayer: asParticipant({ name: invoice.customer_name, email: invoice.customer_email }),
      paymentIntentId: typeof invoice.payment_intent === "string" ? invoice.payment_intent : invoice.payment_intent?.id,
    };
  } catch {
    return null;
  }
}

export async function resolveReceiptParticipants(
  db: any,
  userId: number,
  source: ReceiptParticipantSource,
  transactionId: number | string,
): Promise<ReceiptParticipants | null> {
  const [user] = await db.select({
    name: users.name,
    displayName: users.displayName,
    email: users.email,
  }).from(users).where(eq(users.id, userId)).limit(1);
  const learner = asParticipant({ name: user?.displayName ?? user?.name, email: user?.email });
  if (!learner) return null;

  const reference = await findPaymentReference(db, userId, source, transactionId);
  if (!reference) return null;
  const payer = await resolvePayerFromStripe(reference);
  return buildReceiptParticipants(learner, payer);
}
