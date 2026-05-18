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
import { diySubscriptions, diyOrganizations, webhookEvents, lmsOrders, lmsEnrollments, lmsAffiliates, lmsAffiliateConversions, digitalPurchases, digitalBundlePurchases, digitalBundleItems, brandMemberships } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { sendPurchaseConfirmationEmail } from "../routers/downloadsRouter";
import { fulfillOrderBumpPurchase } from "../lib/orderBumpCheckout";

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
  await fulfillOrderBumpPurchase(db, meta, {
    userId,
    sessionId,
    triggerOrderType: "course",
    triggerOrderId: orderId,
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
    await fulfillOrderBumpPurchase(db, meta, {
      userId,
      sessionId: session.id as string,
      triggerOrderType: "download",
    });
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
  // Send purchase confirmation email with file links
  await sendPurchaseConfirmationEmail(userId, productId);
  await fulfillOrderBumpPurchase(db, meta, {
    userId,
    sessionId: session.id as string,
    triggerOrderType: "download",
  });
  console.log(`[Stripe] Digital download purchase recorded: user ${userId}, product ${productId}`);
}

async function handleDigitalBundleCheckoutCompleted(session: Record<string, unknown>) {
  const meta = (session.metadata as Record<string, string>) ?? {};
  if (meta.type !== "digital_bundle") return;

  const bundleId = meta.bundle_id ? parseInt(meta.bundle_id) : null;
  const userId = meta.user_id ? parseInt(meta.user_id) : null;
  if (!bundleId || !userId) return;

  const db = await getDb();
  if (!db) return;

  // Check if already purchased (idempotent)
  const [existing] = await db.select().from(digitalBundlePurchases)
    .where(and(eq(digitalBundlePurchases.userId, userId), eq(digitalBundlePurchases.bundleId, bundleId))).limit(1);
  if (existing) {
    console.log(`[Stripe] Digital bundle already purchased: user ${userId}, bundle ${bundleId}`);
    await fulfillOrderBumpPurchase(db, meta, {
      userId,
      sessionId: session.id as string,
      triggerOrderType: "bundle",
    });
    return;
  }

  // Record bundle purchase
  await db.insert(digitalBundlePurchases).values({
    userId,
    bundleId,
    stripeCheckoutSessionId: session.id as string,
  });

  // Grant access to all products in the bundle
  const bundleItems = await db.select().from(digitalBundleItems)
    .where(eq(digitalBundleItems.bundleId, bundleId));
  for (const item of bundleItems) {
    const [existingPurchase] = await db.select().from(digitalPurchases)
      .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, item.productId))).limit(1);
    if (!existingPurchase) {
      await db.insert(digitalPurchases).values({
        userId,
        productId: item.productId,
        stripeCheckoutSessionId: session.id as string,
      });
      // Send email for each product in the bundle
      await sendPurchaseConfirmationEmail(userId, item.productId);
    }
  }

  await notifyOwner({
    title: "🎁 New Digital Bundle Purchase",
    content: `User ID ${userId} purchased bundle ID ${bundleId} (${bundleItems.length} products). Amount: $${(((session.amount_total as number) ?? 0) / 100).toFixed(2)}.`,
  });
  await fulfillOrderBumpPurchase(db, meta, {
    userId,
    sessionId: session.id as string,
    triggerOrderType: "bundle",
  });
  console.log(`[Stripe] Digital bundle purchase recorded: user ${userId}, bundle ${bundleId}`);
}

/**
 * Handle brand membership upgrade checkout completion.
 * Triggered when a user completes a Stripe checkout for brand premium.
 */
async function handleBrandMembershipCheckoutCompleted(session: Record<string, unknown>) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.type !== "brand_membership_upgrade") return; // Not a brand membership checkout

  const userId = parseInt(meta.user_id, 10);
  const brand = meta.brand as "aaus" | "iheartecho";
  const subscriptionId = session.subscription as string | undefined;
  const customerId = session.customer as string | undefined;

  if (!userId || !brand) {
    console.warn("[Stripe] Brand membership checkout missing userId or brand in metadata");
    return;
  }

  const db = await getDb();
  if (!db) return;

  // Check if membership already exists
  const [existing] = await db
    .select()
    .from(brandMemberships)
    .where(and(eq(brandMemberships.userId, userId), eq(brandMemberships.brand, brand)))
    .limit(1);

  if (existing) {
    // Update existing membership to premium
    await db.update(brandMemberships)
      .set({
        tier: "premium",
        status: "active",
        source: "stripe",
        stripeSubscriptionId: subscriptionId ?? null,
        stripeCustomerId: customerId ?? null,
        grantedAt: new Date(),
      })
      .where(eq(brandMemberships.id, existing.id));
  } else {
    // Create new premium membership
    await db.insert(brandMemberships).values({
      userId,
      brand,
      tier: "premium",
      status: "active",
      source: "stripe",
      stripeSubscriptionId: subscriptionId ?? null,
      stripeCustomerId: customerId ?? null,
    });
  }

  await notifyOwner({
    title: `\u2B50 New ${brand === "iheartecho" ? "EchoAssist" : "UltrasoundAssist"} Premium Subscription`,
    content: `User ID ${userId} (${meta.customer_email}) upgraded to ${brand} premium via Stripe. Subscription: ${subscriptionId ?? "N/A"}.`,
  });

  console.log(`[Stripe] Brand membership upgrade recorded: user ${userId}, brand ${brand}, subscription ${subscriptionId}`);
}

/**
 * Handle dual membership checkout completion.
 * Grants premium access to BOTH aaus and iheartecho brands.
 * Also syncs the user to Thinkific.
 */
async function handleDualMembershipCheckoutCompleted(session: Record<string, unknown>) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.type !== "dual_membership") return;

  const userId = parseInt(meta.user_id, 10);
  const subscriptionId = session.subscription as string | undefined;
  const customerId = session.customer as string | undefined;

  if (!userId) {
    console.warn("[Stripe] Dual membership checkout missing userId in metadata");
    return;
  }

  const db = await getDb();
  if (!db) return;

  const brands: ("aaus" | "iheartecho")[] = ["aaus", "iheartecho"];
  for (const brand of brands) {
    const [existing] = await db
      .select()
      .from(brandMemberships)
      .where(and(eq(brandMemberships.userId, userId), eq(brandMemberships.brand, brand)))
      .limit(1);

    if (existing) {
      await db.update(brandMemberships)
        .set({
          tier: "premium",
          status: "active",
          source: "stripe_dual",
          stripeSubscriptionId: subscriptionId ?? null,
          stripeCustomerId: customerId ?? null,
          grantedAt: new Date(),
        })
        .where(eq(brandMemberships.id, existing.id));
    } else {
      await db.insert(brandMemberships).values({
        userId,
        brand,
        tier: "premium",
        status: "active",
        source: "stripe_dual",
        stripeSubscriptionId: subscriptionId ?? null,
        stripeCustomerId: customerId ?? null,
      });
    }
  }

  // Sync user to Thinkific
  try {
    const user = await getUserByEmail(meta.customer_email);
    if (user) {
      const { findOrCreateThinkificUser } = await import("../thinkific");
      await findOrCreateThinkificUser(
        meta.customer_email,
        meta.customer_name?.split(" ")[0] ?? "Member",
        meta.customer_name?.split(" ").slice(1).join(" ") ?? ""
      );
      console.log(`[Stripe] Dual membership: Thinkific user ensured for ${meta.customer_email}`);
    }
  } catch (err) {
    console.error("[Stripe] Dual membership Thinkific sync failed:", err);
  }

  await notifyOwner({
    title: "⭐⭐ New Dual Membership Subscription",
    content: `User ID ${userId} (${meta.customer_email}) subscribed to the All Access Dual Membership ($12.99/mo). Both AAUS + iHeartEcho premium granted. Subscription: ${subscriptionId ?? "N/A"}.`,
  });

  console.log(`[Stripe] Dual membership recorded: user ${userId}, both brands, subscription ${subscriptionId}`);
}

/**
 * Handle subscription lifecycle events (cancellation, updates).
 * Updates the brandMemberships table when a subscription is cancelled or changes status.
 */
async function handleBrandSubscriptionLifecycle(subscription: Record<string, unknown>, eventType: string) {
  const subscriptionId = subscription.id as string;
  if (!subscriptionId) return;

  const db = await getDb();
  if (!db) return;

  // Find the brand membership by stripeSubscriptionId
  const [membership] = await db
    .select()
    .from(brandMemberships)
    .where(eq(brandMemberships.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!membership) {
    // Not a brand membership subscription — ignore
    return;
  }

  const status = subscription.status as string;

  if (eventType === "customer.subscription.deleted" || status === "canceled" || status === "unpaid") {
    await db.update(brandMemberships)
      .set({ status: "cancelled", tier: "free" })
      .where(eq(brandMemberships.id, membership.id));
    console.log(`[Stripe] Brand membership cancelled: user ${membership.userId}, brand ${membership.brand}`);
  } else if (status === "past_due") {
    // Keep premium but mark as past_due for grace period
    await db.update(brandMemberships)
      .set({ status: "expired" })
      .where(eq(brandMemberships.id, membership.id));
    console.log(`[Stripe] Brand membership past_due: user ${membership.userId}, brand ${membership.brand}`);
  } else if (status === "active") {
    // Reactivated
    await db.update(brandMemberships)
      .set({ status: "active", tier: "premium" })
      .where(eq(brandMemberships.id, membership.id));
    console.log(`[Stripe] Brand membership reactivated: user ${membership.userId}, brand ${membership.brand}`);
  }
}

/**
 * Handle payment_intent.succeeded for inline funnel form checkout.
 * This is triggered when a user pays inline via Stripe Elements (PaymentIntent flow)
 * instead of being redirected to Stripe Checkout.
 */
async function handleFunnelPaymentIntentSucceeded(paymentIntent: Record<string, unknown>) {
  const meta = (paymentIntent.metadata ?? {}) as Record<string, string>;
  if (meta.type !== "funnel_form_purchase") return; // Not a funnel form purchase

  const funnelId = meta.funnel_id ? parseInt(meta.funnel_id) : null;
  const funnelPageId = meta.funnel_page_id ? parseInt(meta.funnel_page_id) : null;
  const customerEmail = meta.customer_email;
  const customerName = meta.customer_name;
  const amount = paymentIntent.amount as number;
  const piId = paymentIntent.id as string;

  console.log(`[Stripe] payment_intent.succeeded — funnel form purchase — email: ${customerEmail}, amount: ${amount}, PI: ${piId}`);

  const db = await getDb();
  if (!db) return;

  // Track conversion on the funnel page
  if (funnelPageId) {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`UPDATE funnel_pages SET conversions = conversions + 1 WHERE id = ${funnelPageId}`);
  }

  // Notify owner
  await notifyOwner({
    title: "💰 New Funnel Payment (Inline Checkout)",
    content: `Funnel form payment succeeded.\nEmail: ${customerEmail}\nName: ${customerName}\nAmount: $${((amount ?? 0) / 100).toFixed(2)}\nFunnel ID: ${funnelId}\nPage ID: ${funnelPageId}\nPaymentIntent: ${piId}`,
  });
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
          await handleDigitalBundleCheckoutCompleted(sessionObj);
          await handleBrandMembershipCheckoutCompleted(sessionObj);
          await handleDualMembershipCheckoutCompleted(sessionObj);
        } else if (eventType === "payment_intent.succeeded") {
          await handleFunnelPaymentIntentSucceeded(sessionObj);
        } else if (eventType === "customer.subscription.deleted" || eventType === "customer.subscription.updated") {
          await handleBrandSubscriptionLifecycle(sessionObj, eventType);
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

  // Also register at /api/stripe/webhook (production webhook URL)
  app.post("/api/stripe/webhook", (req: Request, res: Response) => {
    // Forward to the main webhook handler by re-emitting the request
    req.url = "/api/webhooks/stripe";
    (app as any).handle(req, res);
  });

  console.log("[Stripe] Webhook registered at /api/webhooks/stripe and /api/stripe/webhook");
}
