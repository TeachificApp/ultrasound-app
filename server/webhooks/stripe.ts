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
import { getDb, getUserByEmail, getOrCreateUserByEmail, getOrCreateAccessToken } from "../db";
import { diySubscriptions, diyOrganizations, diyOrgMembers, userRoles, webhookEvents, lmsOrders, lmsEnrollments, lmsAffiliates, lmsAffiliateConversions, digitalPurchases, digitalBundlePurchases, digitalBundleItems, brandMemberships, physicalProductOrders, funnelPurchases, lmsCourses, userActivityLogs, membershipSubscriptions, membershipPlans, membershipDiscountCodes, membershipPlanAccess, employerProfiles, employerSubscriptions } from "../../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { sendPurchaseConfirmationEmail } from "../routers/downloadsRouter";
import { fulfillOrderBumpPurchase } from "../lib/orderBumpCheckout";
import { sendEmail, buildFunnelPurchaseConfirmationEmail, buildPaymentFailedEmail } from "../_core/email";
import { generateAutoLoginToken } from "../routes/autoLogin";

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

async function handleMembershipCheckoutCompleted(session: Record<string, unknown>) {
  const meta = (session.metadata as Record<string, string>) ?? {};
  if (meta.type !== "membership") return;

  const db = await getDb();
  if (!db) return;

  try {
    const { reconcileMembershipFromStripeSession } = await import("../lib/membershipFulfillment");
    const result = await reconcileMembershipFromStripeSession(db as any, session);
    if (!result.success) {
      console.warn(`[Stripe] Membership checkout not fulfilled: ${result.error ?? "unknown"} session=${session.id}`);
      const customerEmail =
        (session.customer_email as string) ??
        (session.customer_details as Record<string, string>)?.email ??
        meta.customer_email;
      await notifyOwner({
        title: "⚠️ Membership Purchase — Fulfillment Failed",
        content: `Session ${session.id}. Email: ${customerEmail ?? "unknown"}. Error: ${result.error ?? "unknown"}. Notes: ${result.notes.join("; ") || "none"}.`,
      });
      return;
    }
    console.log(`[Stripe] Membership fulfilled: userId=${result.userId}, planId=${result.planId}, notes=${result.notes.join(", ")}`);
  } catch (err) {
    console.error(`[Stripe] Membership fulfillment error for session ${session.id}:`, err);
    throw err;
  }
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

  // Mark order as paid (also store subscription ID if this was a subscription checkout)
  const subscriptionIdForOrder = session.subscription as string | undefined;
  await db.update(lmsOrders).set({
    status: "paid",
    stripeSessionId: sessionId,
    ...(subscriptionIdForOrder ? { stripeSubscriptionId: subscriptionIdForOrder } : {}),
  }).where(eq(lmsOrders.id, orderId));

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
  // Log purchase + enrollment to unified activity log (fire-and-forget)
  try {
    const [courseRow] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
    await db.insert(userActivityLogs).values({
      userId,
      eventType: 'purchase',
      description: `Purchased course: ${courseRow?.title ?? `Course #${courseId}`}`,
      courseId,
      contentTitle: courseRow?.title ?? null,
      metadata: { orderId, seats, amountCents: session.amount_total, sessionId },
    });
    if (!existingEnrollment) {
      await db.insert(userActivityLogs).values({
        userId,
        eventType: 'course_enroll',
        description: `Enrolled in course: ${courseRow?.title ?? `Course #${courseId}`}`,
        courseId,
        contentTitle: courseRow?.title ?? null,
        metadata: { orderId, enrollmentType: 'paid' },
      });
    }
  } catch (_e) { /* non-blocking */ }
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
  if (!productId) return;

  const db = await getDb();
  if (!db) return;

  // ── AUTO-ACCOUNT CREATION FOR GUESTS ────────────────────────────────────
  // If the buyer was a guest (no user_id in metadata), auto-create an account
  // so we can grant download access and send the access email immediately.
  let userId = meta.user_id ? parseInt(meta.user_id) : null;
  const customerEmail = (session.customer_email as string)
    ?? (session.customer_details as Record<string, string>)?.email
    ?? meta.customer_email;
  const customerName = meta.customer_name ?? (session.customer_details as Record<string, string>)?.name ?? null;

  if (!userId && customerEmail) {
    try {
      const nameParts = (customerName || "").trim().split(" ");
      const { user: autoUser, isNew, resetToken } = await getOrCreateUserByEmail({
        email: customerEmail,
        firstName: nameParts[0] || undefined,
        lastName: nameParts.slice(1).join(" ") || undefined,
        name: customerName || undefined,
      });
      userId = autoUser.id;
      if (isNew && resetToken) {
        const baseUrl = "https://app.allaboutultrasound.com";
        const setPasswordUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;
        const firstName = autoUser.firstName || nameParts[0] || "there";
        let accessTokenForEmail: string | null = null;
        try {
          accessTokenForEmail = await getOrCreateAccessToken(autoUser.id);
        } catch (atErr) {
          console.error(`[Stripe] Failed to generate access token for ${customerEmail}:`, atErr);
        }
        const accessUrl = accessTokenForEmail
          ? `${baseUrl}/api/auth/auto-login?token=${accessTokenForEmail}`
          : setPasswordUrl;
        try {
          const { buildPasswordResetEmail, sendEmail: _sendEmail } = await import("../_core/email");
          const emailContent = buildPasswordResetEmail({
            firstName,
            resetUrl: setPasswordUrl,
            brandMode: "aaus",
            purpose: "welcome",
            expiresInLabel: "7 days",
          });
          const subject = `Your purchase is ready — access your download`;
          const accessNote = accessTokenForEmail
            ? `<div style="margin:16px 0;padding:14px 16px;background:#f0fbfc;border-left:3px solid #0d9488;border-radius:0 8px 8px 0;">
                <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0e4a50;">Quick access link</p>
                <p style="margin:0;font-size:13px;color:#475569;">Click below to access your download directly — no password needed:</p>
                <p style="margin:8px 0 0;"><a href="${accessUrl}" style="color:#0d9488;font-weight:600;">${accessUrl}</a></p>
              </div>`
            : "";
          const enhancedBody = emailContent.htmlBody.replace("</body>", `${accessNote}</body>`);
          await _sendEmail({
            to: { name: customerName || firstName, email: customerEmail },
            subject,
            htmlBody: enhancedBody,
            previewText: `Access your download on All About Ultrasound`,
          });
          console.log(`[Stripe] Auto-created account for ${customerEmail} (userId=${userId}) and sent welcome email`);
        } catch (emailErr) {
          console.error(`[Stripe] Failed to send welcome email to ${customerEmail}:`, emailErr);
        }
      } else {
        console.log(`[Stripe] Resolved existing account for ${customerEmail} (userId=${userId})`);
      }
    } catch (autoErr) {
      console.error(`[Stripe] Failed to auto-create account for ${customerEmail}:`, autoErr);
    }
  }
  // ── END AUTO-ACCOUNT CREATION ────────────────────────────────────────────

  if (!userId) {
    console.warn(`[Stripe] Digital download checkout: no userId and could not resolve from email. Session: ${session.id}`);
    await notifyOwner({
      title: "⚠️ Digital Download — No User ID",
      content: `A digital download purchase was received (product ${productId}) but no user could be identified. Session: ${session.id}. Email: ${customerEmail ?? "unknown"}. Please verify manually.`,
    });
    return;
  }

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

  const [newPurchase] = await db.insert(digitalPurchases).values({
    userId,
    productId,
    stripeCheckoutSessionId: session.id as string,
  });
  const newPurchaseId = (newPurchase as any)?.insertId ?? null;

  // Track affiliate conversion for digital download
  const downloadAffiliateCode = meta.affiliate_code ?? null;
  if (downloadAffiliateCode) {
    try {
      const [affiliate] = await db.select().from(lmsAffiliates).where(eq(lmsAffiliates.code, downloadAffiliateCode)).limit(1);
      if (affiliate) {
        const amountTotal = (session.amount_total as number) ?? 0;
        const commission = Math.round(amountTotal * (affiliate.commissionPct / 100));
        await db.insert(lmsAffiliateConversions).values({
          affiliateId: affiliate.id,
          digitalPurchaseId: newPurchaseId,
          conversionType: "digital_download",
          saleAmount: amountTotal,
          commissionAmount: commission,
        });
        await db.update(lmsAffiliates).set({ totalEarned: affiliate.totalEarned + commission }).where(eq(lmsAffiliates.id, affiliate.id));
        console.log(`[Stripe] Affiliate conversion tracked: affiliate ${affiliate.id}, download product ${productId}, commission ${commission} cents`);
      }
    } catch (affErr) {
      console.error(`[Stripe] Failed to track affiliate conversion for download:`, affErr);
    }
  }

  await notifyOwner({
    title: "📦 New Digital Download Purchase",
    content: `User ID ${userId} purchased digital product ID ${productId}. Amount: $${(((session.amount_total as number) ?? 0) / 100).toFixed(2)}.`,
  });
  // Log purchase to unified activity log (fire-and-forget)
  try {
    await db.insert(userActivityLogs).values({
      userId,
      eventType: 'purchase',
      description: `Purchased digital download: product #${productId}`,
      metadata: { productId, amountCents: session.amount_total, sessionId: session.id },
    });
  } catch (_e) { /* non-blocking */ }
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
 * Handle physical product checkout completion.
 * Triggered when a user completes a Stripe checkout for a native physical product.
 * Records the order with shipping address from the Stripe session.
 */
async function handlePhysicalProductCheckoutCompleted(session: Record<string, unknown>) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.type !== "physical_product") return;

  const productId = meta.product_id ? parseInt(meta.product_id, 10) : null;
  const userId = meta.user_id ? parseInt(meta.user_id, 10) : null;
  const pricingOptionId = meta.pricing_option_id ? parseInt(meta.pricing_option_id, 10) : null;
  if (!productId || !userId) {
    console.warn("[Stripe] Physical product checkout missing productId or userId in metadata");
    return;
  }

  const db = await getDb();
  if (!db) return;

  // Idempotency check — don't double-record
  const [existing] = await db.select({ id: physicalProductOrders.id })
    .from(physicalProductOrders)
    .where(and(
      eq(physicalProductOrders.userId, userId),
      eq(physicalProductOrders.productId, productId),
      eq(physicalProductOrders.stripeCheckoutSessionId, session.id as string),
    )).limit(1);
  if (existing) {
    console.log(`[Stripe] Physical product order already recorded: user ${userId}, product ${productId}`);
    return;
  }

  // Extract shipping address from Stripe session
  const shippingDetails = (session.shipping_details ?? session.shipping) as Record<string, any> | null;
  const addr = shippingDetails?.address ?? null;
  const shippingAddress = addr ? JSON.stringify({
    name: shippingDetails?.name ?? "",
    line1: addr.line1 ?? "",
    line2: addr.line2 ?? "",
    city: addr.city ?? "",
    state: addr.state ?? "",
    postalCode: addr.postal_code ?? "",
    country: addr.country ?? "",
  }) : null;

  const amountPaid = (session.amount_total as number) ?? 0;

  await db.insert(physicalProductOrders).values({
    userId,
    productId,
    pricingOptionId: pricingOptionId || null,
    stripeCheckoutSessionId: session.id as string,
    amountPaid,
    currency: (session.currency as string) ?? "usd",
    shippingName: shippingDetails?.name ?? null,
    shippingLine1: addr?.line1 ?? null,
    shippingLine2: addr?.line2 ?? null,
    shippingCity: addr?.city ?? null,
    shippingState: addr?.state ?? null,
    shippingPostalCode: addr?.postal_code ?? null,
    shippingCountry: addr?.country ?? null,
    fulfillmentStatus: "pending",
  });

  await notifyOwner({
    title: "📦 New Physical Product Order",
    content: `User ID ${userId} (${meta.customer_email}) ordered physical product ID ${productId}. Amount: $${(amountPaid / 100).toFixed(2)}. Shipping: ${shippingAddress ? JSON.parse(shippingAddress).line1 + ", " + JSON.parse(shippingAddress).city : "N/A"}.`,
  });

  console.log(`[Stripe] Physical product order recorded: user ${userId}, product ${productId}, session ${session.id}`);
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
 * Handle employer job post ($39) and employer subscription ($199/mo) purchases.
 * Identified by metadata.product_type = 'employer_job_post' or 'employer_subscription'.
 */
async function handleEmployerCheckoutCompleted(session: Record<string, unknown>) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  const productType = meta.product_type as string | undefined;
  if (productType !== "employer_job_post" && productType !== "employer_subscription") return;

  const userId = meta.user_id ? parseInt(meta.user_id) : null;
  if (!userId) {
    console.warn("[Stripe] Employer checkout missing user_id in metadata");
    return;
  }

  const db = await getDb();

  // Ensure employer profile exists
  const [existingProfile] = await db.select({ id: employerProfiles.id })
    .from(employerProfiles).where(eq(employerProfiles.userId, userId)).limit(1);
  const profileId = existingProfile?.id ?? (
    await db.insert(employerProfiles).values({ userId, companyName: meta.company_name ?? "My Company", status: "active" })
      .then(([r]: any) => (r as { insertId: number }).insertId)
  );

  if (productType === "employer_job_post") {
    // Add 1 job post credit
    const [existing] = await db.select().from(employerSubscriptions)
      .where(and(eq(employerSubscriptions.employerProfileId, profileId), eq(employerSubscriptions.plan, "job_post"))).limit(1);
    if (existing) {
      await db.update(employerSubscriptions)
        .set({ jobCredits: sql`${employerSubscriptions.jobCredits} + 1`, status: "active" })
        .where(eq(employerSubscriptions.id, existing.id));
    } else {
      await db.insert(employerSubscriptions).values({
        employerProfileId: profileId, plan: "job_post", status: "active",
        stripeSessionId: session.id as string, jobCredits: 1,
      });
    }
    console.log(`[Stripe] Employer job post credit added for userId=${userId}`);
  } else if (productType === "employer_subscription") {
    // Upsert unlimited subscription
    const [existing] = await db.select().from(employerSubscriptions)
      .where(and(eq(employerSubscriptions.employerProfileId, profileId), eq(employerSubscriptions.plan, "unlimited"))).limit(1);
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    if (existing) {
      await db.update(employerSubscriptions)
        .set({ status: "active", currentPeriodEnd: periodEnd, stripeSubscriptionId: meta.subscription_id ?? existing.stripeSubscriptionId })
        .where(eq(employerSubscriptions.id, existing.id));
    } else {
      await db.insert(employerSubscriptions).values({
        employerProfileId: profileId, plan: "unlimited", status: "active",
        stripeSessionId: session.id as string,
        stripeSubscriptionId: meta.subscription_id,
        currentPeriodEnd: periodEnd,
      });
    }
    console.log(`[Stripe] Employer unlimited subscription activated for userId=${userId}`);
  }

  await notifyOwner({ title: "New Employer Purchase", content: `userId=${userId} purchased ${productType}` });
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

/**
 * Handle checkout.session.completed for funnel redirect checkout (Stripe Checkout).
 */
async function handleFunnelCheckoutSessionCompleted(session: Record<string, unknown>) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.type !== "funnel_form_purchase") return;

  const sessionId = session.id as string;
  const db = await getDb();
  if (!db) return;

  const [existingBySession] = await db.select({ id: funnelPurchases.id })
    .from(funnelPurchases)
    .where(eq(funnelPurchases.stripeCheckoutSessionId, sessionId))
    .limit(1);
  if (existingBySession) {
    console.log(`[Stripe] Funnel checkout session already processed: ${sessionId}`);
    return;
  }

  const piId = (session.payment_intent as string) || sessionId;
  await handleFunnelPaymentIntentSucceeded({
    metadata: meta,
    amount: session.amount_total,
    id: piId,
    checkout_session_id: sessionId,
  });
}

async function handleFunnelPaymentIntentSucceeded(paymentIntent: Record<string, unknown>) {
  const meta = (paymentIntent.metadata ?? {}) as Record<string, string>;
  // Handle both funnel_form_purchase and embedded_checkout_purchase
  const validTypes = ["funnel_form_purchase", "embedded_checkout_purchase"];
  if (!validTypes.includes(meta.type)) return;

  const funnelId = meta.funnel_id ? parseInt(meta.funnel_id) : null;
  const funnelPageId = meta.funnel_page_id ? parseInt(meta.funnel_page_id) : null;
  const landingPageId = meta.landing_page_id ? parseInt(meta.landing_page_id) : null;
  const lmsLessonId = meta.lms_lesson_id ? parseInt(meta.lms_lesson_id) : null;
  const customerEmail = meta.customer_email;
  const customerName = meta.customer_name;
  const customerPhone = meta.customer_phone ?? null;
  const userId = meta.user_id ? parseInt(meta.user_id) : null;
  const productName = meta.product_name ?? "Unknown Product";
  const productType = (meta.product_type ?? "other") as "course" | "download" | "physical" | "membership" | "bundle" | "other";
  const bumpsAdded = meta.bumps_added ?? "";
  const bumpTitles = meta.bump_titles ?? "";
  const bumpPrices = meta.bump_prices ?? "";
  const amount = paymentIntent.amount as number;
  const piId = paymentIntent.id as string;
  // Shipping address (only for physical products)
  const shippingName = meta.shipping_name ?? null;
  const shippingLine1 = meta.shipping_line1 ?? null;
  const shippingLine2 = meta.shipping_line2 ?? null;
  const shippingCity = meta.shipping_city ?? null;
  const shippingState = meta.shipping_state ?? null;
  const shippingPostalCode = meta.shipping_postal_code ?? null;
  const shippingCountry = meta.shipping_country ?? null;

  console.log(`[Stripe] payment_intent.succeeded — ${meta.type} — email: ${customerEmail}, amount: ${amount}, PI: ${piId}`);

  const db = await getDb();
  if (!db) return;

  // ── AUTO-ACCOUNT CREATION ────────────────────────────────────────────────
  // If the buyer was a guest (no account), auto-create one so we can grant
  // access to purchased content immediately. A welcome email with a
  // set-password link is sent to the new user.
  let resolvedUserId: number | null = userId;
  if (!resolvedUserId && customerEmail) {
    try {
      const nameParts = (customerName || "").trim().split(" ");
      const { user: autoUser, isNew, resetToken } = await getOrCreateUserByEmail({
        email: customerEmail,
        firstName: nameParts[0] || undefined,
        lastName: nameParts.slice(1).join(" ") || undefined,
        name: customerName || undefined,
      });
      resolvedUserId = autoUser.id;
      if (isNew && resetToken) {
        // Determine login URL from success_url or brand
        const brandMode = (meta.brand_mode as string) || "aaus";
        const baseUrl = meta.success_url
          ? meta.success_url.split("/").slice(0, 3).join("/")
          : brandMode === "iheartecho" ? "https://app.iheartecho.net" : "https://app.allaboutultrasound.com";
        const setPasswordUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;
        const firstName = autoUser.firstName || nameParts[0] || "there";
        // Generate persistent access token for the new account
        let accessTokenForEmail: string | null = null;
        try {
          accessTokenForEmail = await getOrCreateAccessToken(autoUser.id);
        } catch (atErr) {
          console.error(`[Stripe] Failed to generate access token for ${customerEmail}:`, atErr);
        }
        // Build access URL — clicking this auto-signs the user in
        const accessUrl = accessTokenForEmail
          ? `${baseUrl}/auth/access?token=${accessTokenForEmail}&next=${encodeURIComponent(baseUrl)}`
          : setPasswordUrl;
        // Send welcome + set-password email
        try {
          const { buildPasswordResetEmail, sendEmail: _sendEmail } = await import("../_core/email");
          const emailContent = buildPasswordResetEmail({
            firstName,
            resetUrl: setPasswordUrl,
            brandMode: brandMode as any,
            purpose: "welcome",
            expiresInLabel: "7 days",
          });
          // Override subject for new accounts
          const subject = `Your account is ready — access your ${meta.product_name || "purchase"}`;
          // Append access link note to the email body
          const accessNote = accessTokenForEmail
            ? `<div style="margin:16px 0;padding:14px 16px;background:#f0fbfc;border-left:3px solid #0d9488;border-radius:0 8px 8px 0;">
                <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0e4a50;">Quick access link</p>
                <p style="margin:0;font-size:13px;color:#475569;">You can also click the link below to access your purchase directly — no password needed:</p>
                <p style="margin:8px 0 0;"><a href="${accessUrl}" style="color:#0d9488;font-weight:600;">${accessUrl}</a></p>
              </div>`
            : "";
          const enhancedBody = emailContent.htmlBody.replace("</body>", `${accessNote}</body>`);
          await _sendEmail({
            to: { name: customerName || firstName, email: customerEmail },
            subject,
            htmlBody: enhancedBody,
            previewText: `Access your ${meta.product_name || "purchase"} on ${brandMode === "iheartecho" ? "iHeartEcho" : "All About Ultrasound"}`,
          });
          console.log(`[Stripe] Auto-created account for ${customerEmail} (userId=${resolvedUserId}) and sent welcome email with access token`);
        } catch (emailErr) {
          console.error(`[Stripe] Failed to send welcome email to ${customerEmail}:`, emailErr);
        }
      } else {
        console.log(`[Stripe] Resolved existing account for ${customerEmail} (userId=${resolvedUserId})`);
        // For existing users, send a purchase confirmation email with auto-login token
        // (new users get their email in the isNew branch above)
        try {
          const brandMode = (meta.brand_mode as string) || "aaus";
          const baseUrl = brandMode === "iheartecho" ? "https://app.iheartecho.net" : "https://app.allaboutultrasound.com";
          const fulfillmentDownloadIdExisting = meta.product_type === "download" && meta.product_id ? parseInt(meta.product_id) : null;
          const fulfillmentCourseIdExisting = meta.fulfillment_course_id ? parseInt(meta.fulfillment_course_id) : (meta.product_type === "course" && meta.product_id ? parseInt(meta.product_id) : null);
          let loginUrlExisting = `${baseUrl}/my-dashboard`;
          if (fulfillmentCourseIdExisting) {
            try {
              const { lmsCourses: lc } = await import("../../drizzle/schema");
              const [cr] = await db.select({ slug: lc.slug }).from(lc).where(eq(lc.id, fulfillmentCourseIdExisting)).limit(1);
              if (cr?.slug) loginUrlExisting = `${baseUrl}/courses/${cr.slug}`;
            } catch { /* keep default */ }
          } else if (fulfillmentDownloadIdExisting) {
            loginUrlExisting = `${baseUrl}/my-downloads`;
          }
          let autoLoginUrlExisting = loginUrlExisting;
          try {
            const token = await generateAutoLoginToken(resolvedUserId!, loginUrlExisting);
            autoLoginUrlExisting = `${baseUrl}/api/auth/auto-login?token=${token}`;
          } catch { /* fall back to plain URL */ }
          const firstName = (customerName || "").split(" ")[0] || "there";
          const bumpTitleArr = bumpTitles ? bumpTitles.split("|") : [];
          const bumpPriceArr = bumpPrices ? bumpPrices.split("|").map(Number) : [];
          const bumpsForEmail = bumpTitleArr.map((t, i) => ({ title: t, price: bumpPriceArr[i] ?? 0 })).filter(b => b.title);
          const { subject, htmlBody, previewText } = buildFunnelPurchaseConfirmationEmail({
            firstName,
            productName,
            amountPaid: amount ?? 0,
            orderBumps: bumpsForEmail.length > 0 ? bumpsForEmail : undefined,
            loginUrl: autoLoginUrlExisting,
            brandMode: brandMode as any,
          });
          await sendEmail({ to: { name: customerName || firstName, email: customerEmail! }, subject, htmlBody, previewText });
          console.log(`[Stripe] Purchase confirmation email sent to existing user ${customerEmail} for "${productName}"`);
        } catch (emailErr) {
          console.error(`[Stripe] Failed to send confirmation email to existing user ${customerEmail}:`, emailErr);
        }
      }
    } catch (autoErr) {
      console.error(`[Stripe] Failed to auto-create account for ${customerEmail}:`, autoErr);
    }
  }
  // ── END AUTO-ACCOUNT CREATION ────────────────────────────────────────────

  const checkoutSessionId = paymentIntent.checkout_session_id as string | undefined;

  // Idempotency check
  if (checkoutSessionId) {
    const [existingBySession] = await db.select({ id: funnelPurchases.id })
      .from(funnelPurchases)
      .where(eq(funnelPurchases.stripeCheckoutSessionId, checkoutSessionId))
      .limit(1);
    if (existingBySession) {
      console.log(`[Stripe] Funnel purchase already recorded for checkout session ${checkoutSessionId}`);
      return;
    }
  }

  const [existingPurchase] = await db.select({ id: funnelPurchases.id })
    .from(funnelPurchases)
    .where(eq(funnelPurchases.stripePaymentIntentId, piId))
    .limit(1);

  if (!existingPurchase) {
    // Build order bumps JSON
    let orderBumpsJson: string | null = null;
    if (bumpsAdded) {
      const bumpTitleArr = bumpTitles ? bumpTitles.split("|") : [];
      const bumpPriceArr = bumpPrices ? bumpPrices.split("|").map(Number) : [];
      const bumps = bumpTitleArr.map((t, i) => ({ title: t, price: bumpPriceArr[i] ?? 0 }));
      orderBumpsJson = JSON.stringify(bumps);
    }

    // Determine source type
    const sourceType = funnelId ? "funnel" : landingPageId ? "landing_page" : lmsLessonId ? "lms_lesson" : "other";

    await db.insert(funnelPurchases).values({
      userId: resolvedUserId || null,
      email: customerEmail || "",
      name: customerName || null,
      phone: customerPhone || null,
      productName,
      productType,
      orderBumps: orderBumpsJson,
      amountPaid: amount,
      currency: "usd",
      stripePaymentIntentId: piId,
      stripeCheckoutSessionId: checkoutSessionId ?? null,
      sourceType: sourceType as any,
      sourceFunnelId: funnelId,
      sourceFunnelPageId: funnelPageId,
      sourceLandingPageId: landingPageId,
      sourceLmsLessonId: lmsLessonId,
      shippingName,
      shippingLine1,
      shippingLine2,
      shippingCity,
      shippingState,
      shippingPostalCode,
      shippingCountry,
      status: "paid",
    });
    console.log(`[Stripe] Funnel purchase recorded: user ${resolvedUserId}, product "${productName}", PI: ${piId}`);
  } else {
    // Record already exists (created as "pending" by createPaymentIntent) — update to paid
    await db.update(funnelPurchases)
      .set({ status: "paid", userId: resolvedUserId || undefined })
      .where(eq(funnelPurchases.stripePaymentIntentId, piId));
    console.log(`[Stripe] Updated existing funnel purchase to paid: PI ${piId}, user ${resolvedUserId}`);
  }

  // Track conversion on the funnel page
  if (funnelPageId) {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`UPDATE funnel_pages SET conversions = conversions + 1 WHERE id = ${funnelPageId}`);
  }

  // ── AUTO-FULFILLMENT ────────────────────────────────────────────────────
  // 1. LMS course enrollment (from fulfillment_course_id OR product_id when product_type=course)
  const fulfillmentCourseId = meta.fulfillment_course_id
    ? parseInt(meta.fulfillment_course_id)
    : (meta.product_type === "course" && meta.product_id ? parseInt(meta.product_id) : null);
  if (fulfillmentCourseId && resolvedUserId) {
    try {
      const [existingEnrollment] = await db
        .select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, resolvedUserId), eq(lmsEnrollments.courseId, fulfillmentCourseId)))
        .limit(1);
      if (!existingEnrollment) {
        await db.insert(lmsEnrollments).values({
          userId: resolvedUserId,
          courseId: fulfillmentCourseId,
          orderId: null,
          affiliateCode: null,
        });
        console.log(`[Stripe] Auto-enrolled user ${resolvedUserId} in LMS course ${fulfillmentCourseId} after payment ${piId}`);
      } else {
        console.log(`[Stripe] User ${resolvedUserId} already enrolled in course ${fulfillmentCourseId} — skipping`);
      }
    } catch (err) {
      console.error(`[Stripe] Failed to auto-enroll user ${resolvedUserId} in course ${fulfillmentCourseId}:`, err);
    }
  }

  // 1b. Digital download access grant (product_type=download)
  const fulfillmentDownloadId = meta.product_type === "download" && meta.product_id ? parseInt(meta.product_id) : null;
  if (fulfillmentDownloadId && resolvedUserId) {
    try {
      const { digitalPurchases: dp } = await import("../../drizzle/schema");
      const [existingDl] = await db.select({ id: dp.id })
        .from(dp)
        .where(and(eq(dp.userId, resolvedUserId), eq(dp.productId, fulfillmentDownloadId)))
        .limit(1);
      if (!existingDl) {
        await db.insert(dp).values({ userId: resolvedUserId, productId: fulfillmentDownloadId, stripeCheckoutSessionId: piId });
        console.log(`[Stripe] Granted download access: user ${resolvedUserId}, product ${fulfillmentDownloadId} after payment ${piId}`);
      } else {
        console.log(`[Stripe] Download already granted: user ${resolvedUserId}, product ${fulfillmentDownloadId} — skipping`);
      }
    } catch (err) {
      console.error(`[Stripe] Failed to grant download access user ${resolvedUserId}, product ${fulfillmentDownloadId}:`, err);
    }
  }

  // 1c. Digital bundle access grant (product_type=bundle)
  const fulfillmentBundleId = meta.product_type === "bundle" && meta.product_id ? parseInt(meta.product_id) : null;
  if (fulfillmentBundleId && resolvedUserId) {
    try {
      const { digitalBundlePurchases: dbp, digitalBundleItems: dbi, digitalPurchases: dp } = await import("../../drizzle/schema");
      const [existingBundle] = await db.select({ id: dbp.id })
        .from(dbp)
        .where(and(eq(dbp.userId, resolvedUserId), eq(dbp.bundleId, fulfillmentBundleId)))
        .limit(1);
      if (!existingBundle) {
        await db.insert(dbp).values({ userId: resolvedUserId, bundleId: fulfillmentBundleId, stripeCheckoutSessionId: piId });
        const bundleItems = await db.select().from(dbi).where(eq(dbi.bundleId, fulfillmentBundleId));
        for (const item of bundleItems) {
          const [existingDl] = await db.select({ id: dp.id }).from(dp)
            .where(and(eq(dp.userId, resolvedUserId), eq(dp.productId, item.productId))).limit(1);
          if (!existingDl) {
            await db.insert(dp).values({ userId: resolvedUserId, productId: item.productId, stripeCheckoutSessionId: piId });
          }
        }
        console.log(`[Stripe] Granted bundle access: user ${resolvedUserId}, bundle ${fulfillmentBundleId} after payment ${piId}`);
      } else {
        console.log(`[Stripe] Bundle already granted: user ${resolvedUserId}, bundle ${fulfillmentBundleId} — skipping`);
      }
    } catch (err) {
      console.error(`[Stripe] Failed to grant bundle access user ${resolvedUserId}, bundle ${fulfillmentBundleId}:`, err);
    }
  }

  // 2. Brand membership grant (aaus, iheartecho, or both)
  const fulfillmentBrand = meta.fulfillment_brand as "aaus" | "iheartecho" | "both" | undefined;
  if (fulfillmentBrand && resolvedUserId) {
    const brandsToGrant: ("aaus" | "iheartecho")[] =
      fulfillmentBrand === "both" ? ["aaus", "iheartecho"] : [fulfillmentBrand];
    for (const brand of brandsToGrant) {
      try {
        const [existing] = await db
          .select({ id: brandMemberships.id })
          .from(brandMemberships)
          .where(and(eq(brandMemberships.userId, resolvedUserId), eq(brandMemberships.brand, brand)))
          .limit(1);
        if (existing) {
          await db.update(brandMemberships)
            .set({ tier: "premium", status: "active", source: "stripe", grantedAt: new Date() })
            .where(eq(brandMemberships.id, existing.id));
        } else {
          await db.insert(brandMemberships).values({
            userId: resolvedUserId,
            brand,
            tier: "premium",
            status: "active",
            source: "stripe",
            stripeSubscriptionId: null,
            stripeCustomerId: null,
          });
        }
        console.log(`[Stripe] Granted ${brand} premium membership to user ${resolvedUserId} after payment ${piId}`);
      } catch (err) {
        console.error(`[Stripe] Failed to grant ${brand} membership to user ${resolvedUserId}:`, err);
      }
    }
  }
  // 3. Additional access items (bonus — no extra charge)
  // These are extra products/courses/downloads granted alongside the primary product.
  const additionalAccessNotes: string[] = [];
  if (meta.additional_access && resolvedUserId) {
    try {
      const accessItems = JSON.parse(meta.additional_access) as Array<{
        type: string; productId?: number; brand?: string; label: string;
      }>;
      for (const item of accessItems) {
        try {
          if (item.type === "course" && item.productId) {
            const [existing] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
              .where(and(eq(lmsEnrollments.userId, resolvedUserId!), eq(lmsEnrollments.courseId, item.productId))).limit(1);
            if (!existing) {
              await db.insert(lmsEnrollments).values({ userId: resolvedUserId!, courseId: item.productId, orderId: null, affiliateCode: null });
              console.log(`[Stripe] Additional access: enrolled user ${resolvedUserId} in course ${item.productId} (${item.label})`);
            }
            additionalAccessNotes.push(`Course: ${item.label}`);
          } else if (item.type === "download" && item.productId) {
            const { digitalPurchases: dp } = await import("../../drizzle/schema");
            const [existing] = await db.select({ id: dp.id }).from(dp)
              .where(and(eq(dp.userId, resolvedUserId!), eq(dp.productId, item.productId))).limit(1);
            if (!existing) {
              await db.insert(dp).values({ userId: resolvedUserId!, productId: item.productId, stripeCheckoutSessionId: piId });
              console.log(`[Stripe] Additional access: granted download ${item.productId} (${item.label}) to user ${resolvedUserId}`);
            }
            additionalAccessNotes.push(`Download: ${item.label}`);
          } else if (item.type === "membership" && item.brand) {
            const brandsToGrant: ("aaus" | "iheartecho")[] =
              item.brand === "both" ? ["aaus", "iheartecho"] : [item.brand as "aaus" | "iheartecho"];
            for (const brand of brandsToGrant) {
              const [existing] = await db.select({ id: brandMemberships.id }).from(brandMemberships)
                .where(and(eq(brandMemberships.userId, resolvedUserId!), eq(brandMemberships.brand, brand))).limit(1);
              if (existing) {
                await db.update(brandMemberships)
                  .set({ tier: "premium", status: "active", source: "stripe", grantedAt: new Date() })
                  .where(eq(brandMemberships.id, existing.id));
              } else {
                await db.insert(brandMemberships).values({
                  userId: resolvedUserId!, brand, tier: "premium", status: "active", source: "stripe",
                  stripeSubscriptionId: null, stripeCustomerId: null,
                });
              }
              console.log(`[Stripe] Additional access: granted ${brand} membership to user ${resolvedUserId}`);
            }
            additionalAccessNotes.push(`Membership: ${item.label}`);
          }
        } catch (itemErr) {
          console.error(`[Stripe] Failed to grant additional access item "${item.label}" to user ${userId}:`, itemErr);
        }
      }
    } catch (parseErr) {
      console.error(`[Stripe] Failed to parse additional_access metadata:`, parseErr);
    }
  }
  // ── END AUTO-FULFILLMENT ────────────────────────────────────────────────

  // Notify owner
  const fulfillmentNote = [
    fulfillmentCourseId ? `Course enrollment: #${fulfillmentCourseId}` : null,
    fulfillmentDownloadId ? `Download access: #${fulfillmentDownloadId}` : null,
    fulfillmentBundleId ? `Bundle access: #${fulfillmentBundleId}` : null,
    fulfillmentBrand ? `Brand access: ${fulfillmentBrand}` : null,
    ...additionalAccessNotes.map(n => `Bonus: ${n}`),
  ].filter(Boolean).join(", ");
  await notifyOwner({
    title: `💰 New Funnel Purchase — ${productName}`,
    content: `Payment succeeded.\nProduct: ${productName}\nEmail: ${customerEmail}\nName: ${customerName}\nAmount: $${((amount ?? 0) / 100).toFixed(2)}\nType: ${meta.type}\nPaymentIntent: ${piId}\nUser ID: ${resolvedUserId || "guest"}${!userId && resolvedUserId ? " (auto-created)" : ""}${fulfillmentNote ? `\nFulfillment: ${fulfillmentNote}` : ""}`,
  });

  // Send buyer purchase confirmation email
  if (customerEmail) {
    try {
      const bumpTitleArr = bumpTitles ? bumpTitles.split("|") : [];
      const bumpPriceArr = bumpPrices ? bumpPrices.split("|").map(Number) : [];
      const bumpsForEmail = bumpTitleArr.map((t, i) => ({ title: t, price: bumpPriceArr[i] ?? 0 })).filter(b => b.title);
      const firstName = customerName ? customerName.split(" ")[0] : "there";
      // Build a meaningful access URL pointing to the actual content, not the funnel page
      const brandMode = (meta.brand_mode as string) || "aaus";
      const baseUrl = brandMode === "iheartecho" ? "https://app.iheartecho.net" : "https://app.allaboutultrasound.com";
      let loginUrl = `${baseUrl}/my-dashboard`;
      if (fulfillmentCourseId) {
        try {
          const [courseRow] = await db.select({ slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, fulfillmentCourseId)).limit(1);
          if (courseRow?.slug) loginUrl = `${baseUrl}/courses/${courseRow.slug}`;
        } catch { /* keep default */ }
      } else if (fulfillmentDownloadId) {
        loginUrl = `${baseUrl}/my-downloads`;
      } else if (fulfillmentBundleId) {
        loginUrl = `${baseUrl}/my-downloads`;
      } else if (fulfillmentBrand) {
        loginUrl = brandMode === "iheartecho" ? "https://app.iheartecho.net/my-dashboard" : "https://app.allaboutultrasound.com/my-dashboard";
      }
      // Generate auto-login token so the email link logs them in automatically
      let autoLoginUrl = loginUrl;
      if (resolvedUserId) {
        try {
          const token = await generateAutoLoginToken(resolvedUserId, loginUrl);
          autoLoginUrl = `${baseUrl}/api/auth/auto-login?token=${token}`;
        } catch (tokenErr) {
          console.error(`[Stripe] Failed to generate auto-login token for user ${resolvedUserId}:`, tokenErr);
          // Fall back to plain loginUrl
        }
      }
      const { subject, htmlBody, previewText } = buildFunnelPurchaseConfirmationEmail({
        firstName,
        productName,
        amountPaid: amount ?? 0,
        orderBumps: bumpsForEmail.length > 0 ? bumpsForEmail : undefined,
        loginUrl: autoLoginUrl,
        brandMode: brandMode as any,
      });
      await sendEmail({ to: { name: customerName || firstName, email: customerEmail }, subject, htmlBody, previewText });
      console.log(`[Stripe] Purchase confirmation email sent to ${customerEmail} for "${productName}" (auto-login: ${resolvedUserId ? 'yes' : 'no'})`);
    } catch (err) {
      console.error(`[Stripe] Failed to send purchase confirmation email to ${customerEmail}:`, err);
    }
  }
}

/**
 * Handle invoice.paid — confirm subscription renewal and extend expiresAt for all brand/DIY memberships.
 */
async function handleInvoicePaid(invoice: Record<string, unknown>) {
  const subscriptionId = invoice.subscription as string | null;
  if (!subscriptionId) return;
  const db = await getDb();
  if (!db) return;
  const periodEnd = (invoice.lines as any)?.data?.[0]?.period?.end as number | undefined;
  const expiresAt = periodEnd ? new Date(periodEnd * 1000) : null;
  // Update brandMemberships
  const [membership] = await db.select().from(brandMemberships)
    .where(eq(brandMemberships.stripeSubscriptionId, subscriptionId)).limit(1);
  if (membership) {
    await db.update(brandMemberships)
      .set({ status: "active", tier: "premium", ...(expiresAt ? { expiresAt } : {}) })
      .where(eq(brandMemberships.stripeSubscriptionId, subscriptionId));
    console.log(`[Stripe] invoice.paid — brand membership renewed: user ${membership.userId}, brand ${membership.brand}`);
    // For dual memberships, update both brand rows
    if (membership.source === "stripe_dual") {
      await db.update(brandMemberships)
        .set({ status: "active", tier: "premium", ...(expiresAt ? { expiresAt } : {}) })
        .where(and(eq(brandMemberships.userId, membership.userId), eq(brandMemberships.source, "stripe_dual")));
    }
  }
  // Update membershipSubscriptions
  const [memSub] = await db.select().from(membershipSubscriptions)
    .where(eq(membershipSubscriptions.stripeSubscriptionId, subscriptionId)).limit(1);
  if (memSub) {
    await db.update(membershipSubscriptions)
      .set({ status: "active", ...(expiresAt ? { currentPeriodEnd: expiresAt.getTime() } : {}) })
      .where(eq(membershipSubscriptions.stripeSubscriptionId, subscriptionId));
    console.log(`[Stripe] invoice.paid — membership subscription renewed: id ${memSub.id}`);
  }
  // Update DIY subscriptions
  const [diySub] = await db.select().from(diySubscriptions)
    .where(eq(diySubscriptions.stripeSubscriptionId, subscriptionId)).limit(1);
  if (diySub) {
    await db.update(diySubscriptions)
      .set({ status: "active", ...(expiresAt ? { currentPeriodEnd: expiresAt } : {}) })
      .where(eq(diySubscriptions.stripeSubscriptionId, subscriptionId));
    console.log(`[Stripe] invoice.paid — DIY subscription renewed: id ${diySub.id}`);
  }
}

// DIY plan config (mirrors diyRouter.ts DIY_PLANS)
const DIY_PLAN_CONFIG: Record<string, { totalSeats: number; labAdminSeats: number; memberSeats: number; isUnlimitedMembers: boolean; thinkificProductId: number }> = {
  starter:      { totalSeats: 5,    labAdminSeats: 1,  memberSeats: 4,    isUnlimitedMembers: false, thinkificProductId: 3706401 },
  professional: { totalSeats: 15,   labAdminSeats: 2,  memberSeats: 13,   isUnlimitedMembers: false, thinkificProductId: 3706397 },
  advanced:     { totalSeats: 50,   labAdminSeats: 5,  memberSeats: 45,   isUnlimitedMembers: false, thinkificProductId: 3706392 },
  partner:      { totalSeats: 9999, labAdminSeats: 10, memberSeats: 9999, isUnlimitedMembers: true,  thinkificProductId: 3706344 },
};

/**
 * Handle DIY Accreditation checkout.session.completed — create org + subscription natively.
 */
async function handleDiyCheckoutCompleted(session: Record<string, unknown>) {
  const metadata = (session.metadata as Record<string, string>) ?? {};
  if (metadata.product_type !== "diy_accreditation") return;
  const customerEmail = (session.customer_email as string)
    ?? (session.customer_details as Record<string, string>)?.email;
  const plan = metadata.diy_plan as "starter" | "professional" | "advanced" | "partner" | undefined;
  const orgName = metadata.org_name ?? "My Organization";
  const subscriptionId = session.subscription as string | null;
  const customerId = session.customer as string | null;
  if (!customerEmail || !plan || !DIY_PLAN_CONFIG[plan]) {
    console.warn("[Stripe] handleDiyCheckoutCompleted: missing email, plan, or unknown plan in metadata");
    return;
  }
  const db = await getDb();
  if (!db) return;
  const planConfig = DIY_PLAN_CONFIG[plan];
  const user = await getOrCreateUserByEmail({ email: customerEmail });
  if (!user?.user) {
    console.warn(`[Stripe] handleDiyCheckoutCompleted: could not find/create user for ${customerEmail}`);
    return;
  }
  const userId = user.user.id;
  // Check if user already owns an org
  const [existing] = await db.select().from(diyOrganizations)
    .where(eq(diyOrganizations.ownerUserId, userId)).limit(1);
  if (existing) {
    const [existingSub] = await db.select().from(diySubscriptions)
      .where(eq(diySubscriptions.orgId, existing.id)).limit(1);
    if (existingSub) {
      await db.update(diySubscriptions).set({
        plan, status: "active",
        totalSeats: planConfig.totalSeats, labAdminSeats: planConfig.labAdminSeats,
        memberSeats: planConfig.memberSeats, isUnlimitedMembers: planConfig.isUnlimitedMembers,
        stripeSubscriptionId: subscriptionId ?? existingSub.stripeSubscriptionId,
        stripeCustomerId: customerId ?? existingSub.stripeCustomerId,
      }).where(eq(diySubscriptions.id, existingSub.id));
    }
    return;
  }
  // Create new org
  const [orgResult] = await db.insert(diyOrganizations).values({ ownerUserId: userId, name: orgName });
  const orgId = (orgResult as any).insertId as number;
  const [subResult] = await db.insert(diySubscriptions).values({
    orgId, plan, status: "active",
    totalSeats: planConfig.totalSeats, labAdminSeats: planConfig.labAdminSeats,
    memberSeats: planConfig.memberSeats, isUnlimitedMembers: planConfig.isUnlimitedMembers,
    thinkificProductId: planConfig.thinkificProductId,
    stripeSubscriptionId: subscriptionId ?? null, stripeCustomerId: customerId ?? null,
  });
  const diySubId = (subResult as any).insertId as number;
  await db.insert(diyOrgMembers).values({
    orgId, subscriptionId: diySubId, userId,
    inviteEmail: customerEmail,
    displayName: user.user.name ?? user.user.displayName ?? null,
    diyRole: "super_admin",
    canManageWorkflows: true, canUploadPolicies: true, canAssignTasks: true,
    canManageStaff: true, canViewAnalytics: true, canViewPolicyBuilder: true,
    canViewCaseStudies: true, canViewReadiness: true,
    inviteStatus: "accepted", joinedAt: new Date(), isActive: true,
  });
  await db.insert(userRoles).values({ userId, role: "diy_admin", grantedByLabId: orgId, assignedByUserId: userId });
  // Grant AAUS premium access for Lab Admins
  const [existingMem] = await db.select().from(brandMemberships)
    .where(and(eq(brandMemberships.userId, userId), eq(brandMemberships.brand, "aaus"))).limit(1);
  if (!existingMem) {
    await db.insert(brandMemberships).values({ userId, brand: "aaus", tier: "premium", status: "active", source: "diy_accreditation" });
  } else if (existingMem.tier !== "premium") {
    await db.update(brandMemberships).set({ tier: "premium", status: "active", source: "diy_accreditation" })
      .where(eq(brandMemberships.id, existingMem.id));
  }
  await notifyOwner({
    title: `New DIY Accreditation Org: ${orgName}`,
    content: `Plan: ${plan}\nOrg: ${orgName}\nOwner: ${customerEmail}\nUser ID: ${userId}\nStripe Sub: ${subscriptionId ?? "N/A"}`,
  });
  console.log(`[Stripe] DIY checkout completed: org ${orgId}, plan ${plan}, user ${userId}`);
}

/**
 * Handle DIY subscription lifecycle (renewal, cancellation, plan change).
 */
async function handleDiySubscriptionLifecycle(subscription: Record<string, unknown>, eventType: string) {
  const subscriptionId = subscription.id as string;
  if (!subscriptionId) return;
  const db = await getDb();
  if (!db) return;
  const [diySub] = await db.select().from(diySubscriptions)
    .where(eq(diySubscriptions.stripeSubscriptionId, subscriptionId)).limit(1);
  if (!diySub) return;
  const status = subscription.status as string;
  const periodEnd = subscription.current_period_end as number | undefined;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;
  if (eventType === "customer.subscription.deleted" || status === "canceled" || status === "unpaid") {
    await db.update(diySubscriptions)
      .set({ status: "canceled" })
      .where(eq(diySubscriptions.id, diySub.id));
    console.log(`[Stripe] DIY subscription cancelled: sub ${diySub.id}`);
  } else if (status === "past_due") {
    await db.update(diySubscriptions)
      .set({ status: "past_due" })
      .where(eq(diySubscriptions.id, diySub.id));
  } else if (status === "active") {
    const items = (subscription.items as any)?.data as Array<{ price: { metadata?: Record<string, string> } }> | undefined;
    const newPlan = items?.[0]?.price?.metadata?.diy_plan as string | undefined;
    const planUpdate = newPlan && DIY_PLAN_CONFIG[newPlan] ? {
      plan: newPlan as "starter" | "professional" | "advanced" | "partner",
      ...DIY_PLAN_CONFIG[newPlan],
    } : {};
    await db.update(diySubscriptions)
      .set({ status: "active", ...(currentPeriodEnd ? { currentPeriodEnd } : {}), ...planUpdate })
      .where(eq(diySubscriptions.id, diySub.id));
    console.log(`[Stripe] DIY subscription active: sub ${diySub.id}${newPlan ? `, plan: ${newPlan}` : ""}`);
  }
}

/**
 * Handle invoice.payment_failed — retry for 3 days, then cancel subscription and revoke access.
 * Logic:
 *   - Always send a payment failed email with a link to update payment method.
 *   - If attempt_count >= 3 OR next_payment_attempt is null (Stripe gave up), cancel the subscription.
 */
async function handleInvoicePaymentFailed(invoice: Record<string, unknown>) {
  const subscriptionId = invoice.subscription as string | null;
  const customerEmail = (invoice.customer_email as string) ?? null;
  const attemptCount = (invoice.attempt_count as number) ?? 1;
  const nextPaymentAttempt = invoice.next_payment_attempt as number | null;
  const amountDue = (invoice.amount_due as number) ?? 0;

  console.log(`[Stripe] invoice.payment_failed — sub: ${subscriptionId}, email: ${customerEmail}, attempt: ${attemptCount}, nextAttempt: ${nextPaymentAttempt}`);

  if (!customerEmail) {
    console.warn("[Stripe] invoice.payment_failed: no customer email — cannot notify user");
    return;
  }

  const db = await getDb();
  if (!db) return;

  // Find the user
  const user = await getUserByEmail(customerEmail);
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";

  // Determine brand from subscription metadata or membership record
  let brandMode: "aaus" | "iheartecho" = "aaus";
  let membership: typeof brandMemberships.$inferSelect | null = null;
  if (subscriptionId && user) {
    const [mem] = await db.select().from(brandMemberships)
      .where(eq(brandMemberships.stripeSubscriptionId, subscriptionId)).limit(1);
    if (mem) {
      membership = mem;
      brandMode = mem.brand === "iheartecho" ? "iheartecho" : "aaus";
    }
  }

  const baseUrl = brandMode === "iheartecho" ? "https://app.iheartecho.net" : "https://app.allaboutultrasound.com";
  const updatePaymentUrl = `${baseUrl}/dashboard`;

  // Send payment failed email
  const productName = membership ? `Your ${brandMode === "iheartecho" ? "iHeartEcho" : "All About Ultrasound"} Membership` : "Your Subscription";
  try {
    const { subject, htmlBody, previewText } = buildPaymentFailedEmail({
      firstName,
      productName,
      updatePaymentUrl,
      brandMode,
    });
    await sendEmail({ to: { name: firstName, email: customerEmail }, subject, htmlBody, previewText });
    console.log(`[Stripe] Payment failed email sent to ${customerEmail} (attempt ${attemptCount})`);
  } catch (emailErr) {
    console.error(`[Stripe] Failed to send payment failed email to ${customerEmail}:`, emailErr);
  }

  // Cancel subscription if Stripe has given up (attempt_count >= 3 or no next retry)
  const shouldCancel = attemptCount >= 3 || nextPaymentAttempt === null;
  if (shouldCancel && subscriptionId && membership) {
    await db.update(brandMemberships)
      .set({ status: "cancelled", tier: "free" })
      .where(eq(brandMemberships.id, membership.id));
    console.log(`[Stripe] Subscription cancelled after ${attemptCount} failed payment attempts: sub ${subscriptionId}, user ${membership.userId}`);
    await notifyOwner({
      title: "⚠️ Subscription Cancelled — Failed Payments",
      content: `Subscription ${subscriptionId} for ${customerEmail} has been cancelled after ${attemptCount} failed payment attempts. Access revoked.`,
    });
  } else if (shouldCancel && subscriptionId && !membership) {
    console.warn(`[Stripe] invoice.payment_failed: no brand membership found for subscription ${subscriptionId} — cannot revoke access`);
  }
}

function stripeWebhookRawBody(req: Request, res: Response, next: () => void) {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (chunk: string) => { data += chunk; });
  req.on("end", () => {
    (req as Request & { rawBody: string }).rawBody = data;
    next();
  });
}

async function stripeWebhookHandler(req: Request & { rawBody?: string }, res: Response) {
  const rawBody = req.rawBody ?? "";
  const sig = req.headers["stripe-signature"] as string | undefined;
  let event: Record<string, unknown>;

  if (STRIPE_WEBHOOK_SECRET) {
    if (!sig) {
      console.error("[Stripe] Webhook rejected: missing stripe-signature header");
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    try {
      const crypto = await import("crypto");
      const parts = sig.split(",");
      const tPart = parts.find((p) => p.startsWith("t="));
      const v1Part = parts.find((p) => p.startsWith("v1="));
      if (!tPart || !v1Part) throw new Error("Invalid signature format");
      const timestamp = tPart.slice(2);
      const expectedSig = v1Part.slice(3);
      const payload = `${timestamp}.${rawBody}`;
      const hmac = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(payload).digest("hex");
      if (hmac !== expectedSig) throw new Error("Signature mismatch");
      event = JSON.parse(rawBody) as Record<string, unknown>;
    } catch (err) {
      console.error("[Stripe] Webhook signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  } else {
    try {
      event = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }
  }

  const eventType = event.type as string;
  const eventId = event.id as string;
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

  try {
    const sessionObj = (event.data as { object: Record<string, unknown> }).object;
    if (eventType === "checkout.session.completed") {
      await handleFunnelCheckoutSessionCompleted(sessionObj);
      await handleCheckoutSessionCompleted(sessionObj);
      await handleEmployerCheckoutCompleted(sessionObj);
      await handleLmsCheckoutCompleted(sessionObj);
      await handleDigitalDownloadCheckoutCompleted(sessionObj);
      await handleDigitalBundleCheckoutCompleted(sessionObj);
      await handleBrandMembershipCheckoutCompleted(sessionObj);
      await handleDualMembershipCheckoutCompleted(sessionObj);
      await handlePhysicalProductCheckoutCompleted(sessionObj);
      await handleMembershipCheckoutCompleted(sessionObj);
      await handleDiyCheckoutCompleted(sessionObj);
    } else if (eventType === "payment_intent.succeeded") {
      await handleFunnelPaymentIntentSucceeded(sessionObj);
    } else if (eventType === "customer.subscription.deleted" || eventType === "customer.subscription.updated") {
      await handleBrandSubscriptionLifecycle(sessionObj, eventType);
      await handleDiySubscriptionLifecycle(sessionObj, eventType);
    } else if (eventType === "invoice.paid") {
      await handleInvoicePaid(sessionObj);
    } else if (eventType === "invoice.payment_failed") {
      await handleInvoicePaymentFailed(sessionObj);
    } else {
      console.log(`[Stripe] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`[Stripe] Error handling event ${eventType}:`, err);
  }

  res.json({ received: true });
}

export function registerStripeWebhook(app: Express) {
  app.post("/api/webhooks/stripe", stripeWebhookRawBody, stripeWebhookHandler);
  app.post("/api/stripe/webhook", stripeWebhookRawBody, stripeWebhookHandler);
  console.log("[Stripe] Webhook registered at /api/webhooks/stripe and /api/stripe/webhook");
}
