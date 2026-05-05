/**
 * Stripe Webhook Handler — All About Ultrasound™ DIY Accreditation
 *
 * Handles:
 *  - checkout.session.completed  → Concierge add-on purchase notification
 *
 * The Concierge product uses a direct Stripe payment link:
 *   https://buy.stripe.com/7sYcN475Lcs94Nm3hH9R604
 *
 * When a payment completes, this webhook:
 *  1. Verifies the Stripe signature (if STRIPE_WEBHOOK_SECRET is set)
 *  2. Identifies the buyer by email
 *  3. Marks hasConcierge = true on their diySubscription
 *  4. Sends an owner notification via notifyOwner()
 *  5. Logs the event to webhookEvents table
 */
import type { Express, Request, Response } from "express";
import { getDb, getUserByEmail } from "../db";
import { diySubscriptions, diyOrganizations, webhookEvents, lmsOrders, lmsEnrollments, lmsAffiliates, lmsAffiliateConversions, digitalPurchases } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

// Stripe webhook secret — optional but strongly recommended in production
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// Stripe Concierge product price ID (from the payment link)
const CONCIERGE_PRICE_ID = "price_concierge_4997"; // update if Stripe price ID is known

async function handleCheckoutSessionCompleted(session: Record<string, unknown>) {
  const customerEmail = (session.customer_email as string) ?? (session.customer_details as Record<string, string>)?.email;
  const amountTotal = session.amount_total as number; // in cents
  const paymentLinkId = session.payment_link as string | undefined;

  console.log(`[Stripe] checkout.session.completed — email: ${customerEmail}, amount: ${amountTotal}`);

  // Identify this as a Concierge purchase by amount ($4,997 = 499700 cents) or payment link
  const isConcierge = amountTotal === 499700 || (paymentLinkId && paymentLinkId.includes("7sYcN475Lcs94Nm3hH9R604"));

  if (!isConcierge) {
    console.log("[Stripe] Not a Concierge purchase — ignoring.");
    return;
  }

  if (!customerEmail) {
    console.warn("[Stripe] No customer email in session — cannot link to org.");
    await notifyOwner({
      title: "⚠️ Concierge Purchase — No Email",
      content: `A Concierge purchase was received but no customer email was found in the Stripe session. Session ID: ${session.id}. Please verify manually in Stripe dashboard.`,
    });
    return;
  }

   // Find the user by email, then look up their org
  const db = await getDb();
  if (!db) {
    console.error("[Stripe] Database connection unavailable");
    return;
  }
  const user = await getUserByEmail(customerEmail);
  if (!user) {
    console.warn(`[Stripe] No user found for email: ${customerEmail}`);
    await notifyOwner({
      title: "⚠️ Concierge Purchase — User Not Found",
      content: `Concierge payment received from ${customerEmail} but no All About Ultrasound™ account was found. Amount: $${(amountTotal / 100).toFixed(2)}. Please verify manually in Stripe dashboard.`,
    });
    return;
  }

  // Find the org subscription linked to this user
  const orgRows = await db
    .select({
      orgId: diyOrganizations.id,
      orgName: diyOrganizations.name,
      subId: diySubscriptions.id,
      hasConcierge: diySubscriptions.hasConcierge,
    })
    .from(diyOrganizations)
    .leftJoin(diySubscriptions, eq(diySubscriptions.orgId, diyOrganizations.id))
    .where(eq(diyOrganizations.ownerUserId, user.id))
    .limit(1);

  if (orgRows.length === 0 || !orgRows[0].subId) {
    console.warn(`[Stripe] No active DIY subscription found for user ID: ${user.id}`);
    await notifyOwner({
      title: "⚠️ Concierge Purchase — No Subscription Found",
      content: `Concierge payment received from ${customerEmail} but no active DIY Accreditation subscription was found. Amount: $${(amountTotal / 100).toFixed(2)}. Please verify manually.`,
    });
    return;
  }

  const { orgId, orgName, subId, hasConcierge } = orgRows[0];

  if (hasConcierge) {
    console.log(`[Stripe] Org ${orgName} already has Concierge — skipping update.`);
    await notifyOwner({
      title: "ℹ️ Concierge Purchase — Already Active",
      content: `Concierge payment received from ${customerEmail} (${orgName}) but Concierge was already active on their subscription. No action taken.`,
    });
    return;
  }

  // Activate Concierge on the subscription
  await db
    .update(diySubscriptions)
    .set({ hasConcierge: true, updatedAt: new Date() })
    .where(eq(diySubscriptions.id, subId));

  console.log(`[Stripe] Concierge activated for org ${orgName} (sub ID: ${subId})`);

  // Notify owner
  await notifyOwner({
    title: "🎉 New Concierge Purchase",
    content: `Accreditation Concierge™ purchased by ${customerEmail} for organization "${orgName}". Amount: $${(amountTotal / 100).toFixed(2)}. Concierge access has been activated automatically.`,
  });
}

async function handleLmsCheckoutCompleted(session: Record<string, unknown>) {
  const meta = (session.metadata as Record<string, string>) ?? {};
  const orderId = meta.order_id ? parseInt(meta.order_id) : null;
  const userId = meta.user_id ? parseInt(meta.user_id) : null;
  const courseId = meta.course_id ? parseInt(meta.course_id) : null;
  const seats = meta.seats ? parseInt(meta.seats) : 1;
  const affiliateCode = meta.affiliate_code ?? null;
  const sessionId = session.id as string;

  if (!orderId || !userId || !courseId) return; // Not an LMS order

  const db = await getDb();
  if (!db) return;

  // Mark order as paid
  await db.update(lmsOrders).set({ status: "paid", stripeSessionId: sessionId }).where(eq(lmsOrders.id, orderId));

  // Enroll user (and extra seats if group purchase)
  const [existingEnrollment] = await db.select().from(lmsEnrollments)
    .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId))).limit(1);
  if (!existingEnrollment) {
    await db.insert(lmsEnrollments).values({ userId, courseId, orderId, affiliateCode });
  }

  // Track affiliate conversion
  if (affiliateCode) {
    const [affiliate] = await db.select().from(lmsAffiliates).where(eq(lmsAffiliates.code, affiliateCode)).limit(1);
    if (affiliate) {
      const amountTotal = (session.amount_total as number) ?? 0;
      const commission = Math.round(amountTotal * (affiliate.commissionPct / 100));
      const [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId))).limit(1);
      if (enrollment) {
        await db.insert(lmsAffiliateConversions).values({
          affiliateId: affiliate.id, enrollmentId: enrollment.id, orderId,
          saleAmount: amountTotal, commissionAmount: commission,
        });
        await db.update(lmsAffiliates).set({ totalEarned: affiliate.totalEarned + commission }).where(eq(lmsAffiliates.id, affiliate.id));
      }
    }
  }

  await notifyOwner({
    title: "🎓 New LMS Course Purchase",
    content: `User ID ${userId} purchased course ID ${courseId} (${seats} seat${seats > 1 ? 's' : ''}). Order #${orderId}. Amount: $${((session.amount_total as number ?? 0) / 100).toFixed(2)}.`,
  });
  console.log(`[Stripe] LMS order ${orderId} fulfilled for user ${userId}, course ${courseId}`);
}

async function handleDigitalDownloadCheckoutCompleted(session: Record<string, unknown>) {
  const meta = (session.metadata as Record<string, string>) ?? {};
  if (meta.type !== "digital_download") return; // Not a digital download purchase

  const productId = meta.product_id ? parseInt(meta.product_id) : null;
  const userId = meta.user_id ? parseInt(meta.user_id) : null;
  if (!productId || !userId) return;

  const db = await getDb();
  if (!db) return;

  // Check if already purchased (idempotent)
  const [existing] = await db.select().from(digitalPurchases)
    .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, productId))).limit(1);
  if (existing) {
    console.log(`[Stripe] Digital download already purchased: user ${userId}, product ${productId}`);
    return;
  }

  await db.insert(digitalPurchases).values({
    userId,
    productId,
    stripeCheckoutSessionId: session.id as string,
  });

  await notifyOwner({
    title: "📦 New Digital Download Purchase",
    content: `User ID ${userId} purchased digital product ID ${productId}. Amount: $${(((session.amount_total as number) ?? 0) / 100).toFixed(2)}.`,
  });
  console.log(`[Stripe] Digital download purchase recorded: user ${userId}, product ${productId}`);
}

export function registerStripeWebhook(app: Express) {
  // Raw body needed for Stripe signature verification
  app.post(
    "/api/webhooks/stripe",
    // Express raw body middleware for this route only
    (req: Request, res: Response, next) => {
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (chunk: string) => { data += chunk; });
      req.on("end", () => {
        (req as Request & { rawBody: string }).rawBody = data;
        next();
      });
    },
    async (req: Request & { rawBody?: string }, res: Response) => {
      const rawBody = req.rawBody ?? "";
      const sig = req.headers["stripe-signature"] as string | undefined;

      let event: Record<string, unknown>;

      // Verify signature if secret is configured
      if (STRIPE_WEBHOOK_SECRET && sig) {
        try {
          // Simple HMAC verification without the Stripe SDK
          const crypto = await import("crypto");
          const parts = sig.split(",");
          const tPart = parts.find((p) => p.startsWith("t="));
          const v1Part = parts.find((p) => p.startsWith("v1="));
          if (!tPart || !v1Part) throw new Error("Invalid signature format");
          const timestamp = tPart.slice(2);
          const expectedSig = v1Part.slice(3);
          const payload = `${timestamp}.${rawBody}`;
          const hmac = crypto
            .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
            .update(payload)
            .digest("hex");
          if (hmac !== expectedSig) throw new Error("Signature mismatch");
          event = JSON.parse(rawBody) as Record<string, unknown>;
        } catch (err) {
          console.error("[Stripe] Webhook signature verification failed:", err);
          res.status(400).json({ error: "Invalid signature" });
          return;
        }
      } else {
        // No secret configured — accept without verification (dev mode)
        try {
          event = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          res.status(400).json({ error: "Invalid JSON" });
          return;
        }
      }

      const eventType = event.type as string;
      const eventId = event.id as string;

      // Log the event
      const logDb = await getDb();
      try {
        if (logDb) {
          await logDb.insert(webhookEvents).values({
            source: "stripe",
            resource: eventType.split(".")[0] ?? "checkout",
            action: eventType.split(".").slice(1).join(".") ?? eventType,
            email: undefined,
            outcome: "ignored",
            message: `Stripe event received: ${eventType} (${eventId})`,
            rawPayload: rawBody,
          });
        }
      } catch (err) {
        console.warn("[Stripe] Failed to log webhook event:", err);
      }

      // Handle events
      try {
        const sessionObj = (event.data as { object: Record<string, unknown> }).object;
        if (eventType === "checkout.session.completed") {
          await handleCheckoutSessionCompleted(sessionObj);
          await handleLmsCheckoutCompleted(sessionObj);
          await handleDigitalDownloadCheckoutCompleted(sessionObj);
        } else {
          console.log(`[Stripe] Unhandled event type: ${eventType}`);
        }
      } catch (err) {
        console.error(`[Stripe] Error handling event ${eventType}:`, err);
        // Still return 200 to prevent Stripe retries for handled errors
      }

      res.json({ received: true });
    }
  );

  console.log("[Stripe] Webhook registered at /api/webhooks/stripe");
}
