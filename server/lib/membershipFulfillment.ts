import { getStripeClient } from "./stripeClient";
/**
 * Membership fulfillment — grants membership_subscriptions + plan access items
 * after Stripe checkout (webhook, checkout-complete fallback, or admin reconcile).
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import {
  membershipPlans,
  membershipPlanAccess,
  membershipSubscriptions,
  membershipDiscountCodes,
  brandMemberships,
  lmsEnrollments,
  lmsCourses,
  digitalPurchases,
  digitalProducts,
  digitalBundlePurchases,
  digitalBundleItems,
  bundleEnrollments,
  bundleItems,
  bundles,
} from "../../drizzle/schema";
import { getUserByEmail, getOrCreateUserByEmail, getOrCreateAccessToken } from "../db";
import { generateAutoLoginToken } from "../routes/autoLogin";
import { buildPasswordResetEmail, sendEmail } from "../_core/email";
import { notifyOwner } from "../_core/notification";
import { isEnrollmentAccessActive } from "./enrollmentAccess";

export type MembershipFulfillmentContext = {
  sessionId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  amountTotalCents?: number;
  discountCodeId?: number | null;
  customerEmail?: string | null;
  customerName?: string | null;
  accessExpiresAt?: Date | null;
  stripePriceId?: string | null;
  /** Skip welcome email (e.g. when resending separately) */
  skipEmail?: boolean;
  /** Force welcome email even when enrollment already exists */
  forceWelcomeEmail?: boolean;
  /** Renew course enrollments (repurchase after expiry) */
  forceRenew?: boolean;
};

export type MembershipFulfillmentResult = {
  success: boolean;
  userId: number | null;
  planId: number | null;
  isNewUser: boolean;
  notes: string[];
  error?: string;
};

function brandFromItemType(itemType: string): "aaus" | "iheartecho" | null {
  if (itemType.startsWith("ultrasoundassist")) return "aaus";
  if (itemType.startsWith("echoassist")) return "iheartecho";
  return null;
}

export async function resolveMembershipPlanId(
  db: MySql2Database<typeof schema>,
  opts: { planId?: number | null; stripePriceId?: string | null },
): Promise<number | null> {
  if (opts.planId) return opts.planId;
  if (!opts.stripePriceId) return null;
  const [plan] = await db
    .select({ id: membershipPlans.id })
    .from(membershipPlans)
    .where(eq(membershipPlans.stripePriceId, opts.stripePriceId))
    .limit(1);
  return plan?.id ?? null;
}

export async function resolveMembershipUserId(
  db: MySql2Database<typeof schema>,
  opts: {
    metaUserId?: number | null;
    customerEmail?: string | null;
    customerName?: string | null;
  },
): Promise<{ userId: number; isNew: boolean; resetToken: string | null } | null> {
  const email = opts.customerEmail?.trim();
  if (!email) {
    if (opts.metaUserId) {
      return { userId: opts.metaUserId, isNew: false, resetToken: null };
    }
    return null;
  }

  const canonical = await getUserByEmail(email);
  if (canonical) {
    return { userId: canonical.id, isNew: false, resetToken: null };
  }

  if (opts.metaUserId) {
    return { userId: opts.metaUserId, isNew: false, resetToken: null };
  }

  const nameParts = (opts.customerName || "").trim().split(" ");
  const created = await getOrCreateUserByEmail({
    email,
    firstName: nameParts[0] || undefined,
    lastName: nameParts.slice(1).join(" ") || undefined,
    name: opts.customerName || undefined,
  });
  return { userId: created.user.id, isNew: created.isNew, resetToken: created.resetToken };
}

async function grantBrandAccess(
  db: MySql2Database<typeof schema>,
  userId: number,
  itemType: string,
  stripeSubscriptionId: string | null,
  stripeCustomerId: string | null,
  notes: string[],
): Promise<void> {
  const brandKey = brandFromItemType(itemType);
  if (!brandKey) return;
  const tier = itemType.endsWith("_premium") ? "premium" : "free";
  const [existingBM] = await db
    .select()
    .from(brandMemberships)
    .where(and(eq(brandMemberships.userId, userId), eq(brandMemberships.brand, brandKey)))
    .limit(1);
  if (existingBM) {
    const shouldUpgrade = tier === "premium" && existingBM.tier !== "premium";
    if (shouldUpgrade || existingBM.status !== "active") {
      await db
        .update(brandMemberships)
        .set({
          tier: tier as "free" | "premium",
          status: "active",
          source: "membership",
          stripeSubscriptionId: stripeSubscriptionId ?? existingBM.stripeSubscriptionId,
          stripeCustomerId: stripeCustomerId ?? existingBM.stripeCustomerId,
          grantedAt: new Date(),
        })
        .where(eq(brandMemberships.id, existingBM.id));
    }
  } else {
    await db.insert(brandMemberships).values({
      userId,
      brand: brandKey,
      tier: tier as "free" | "premium",
      status: "active",
      source: "membership",
      stripeSubscriptionId,
      stripeCustomerId,
    });
  }
  notes.push(`Brand: ${brandKey} ${tier}`);
}

type EnrollOpts = {
  accessExpiresAt?: Date | null;
  stripeSubscriptionId?: string | null;
  source?: string;
  forceRenew?: boolean;
};

async function enrollCourseOrQuiz(
  db: MySql2Database<typeof schema>,
  userId: number,
  courseId: number,
  notes: string[],
  opts?: EnrollOpts,
): Promise<{ courseTitle: string; courseSlug: string; isQuiz: boolean; renewed: boolean } | null> {
  const [course] = await db
    .select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, courseType: lmsCourses.type })
    .from(lmsCourses)
    .where(eq(lmsCourses.id, courseId))
    .limit(1);
  if (!course) return null;

  const [existing] = await db
    .select({
      id: lmsEnrollments.id,
      enrollmentType: lmsEnrollments.enrollmentType,
      accessExpiresAt: lmsEnrollments.accessExpiresAt,
    })
    .from(lmsEnrollments)
    .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId)))
    .limit(1);

  let renewed = false;
  if (!existing) {
    await db.insert(lmsEnrollments).values({
      userId,
      courseId,
      orderId: null,
      affiliateCode: null,
      enrollmentType: "full",
      enrolledAt: new Date(),
      accessExpiresAt: opts?.accessExpiresAt ?? null,
      source: opts?.source ?? "stripe",
      stripeSubscriptionId: opts?.stripeSubscriptionId ?? null,
    });
    notes.push(`Enrolled: ${course.title}`);
    renewed = true;
  } else {
    const wasExpired = !isEnrollmentAccessActive(existing);
    const shouldRenew =
      wasExpired ||
      existing.enrollmentType === "free_preview" ||
      !!opts?.forceRenew;

    if (shouldRenew) {
      await db.update(lmsEnrollments).set({
        enrollmentType: "full",
        enrolledAt: new Date(),
        accessExpiresAt: opts?.accessExpiresAt ?? null,
        source: opts?.source ?? "stripe",
        stripeSubscriptionId: opts?.stripeSubscriptionId ?? undefined,
      }).where(eq(lmsEnrollments.id, existing.id));
      notes.push(wasExpired ? `Renewed expired enrollment: ${course.title}` : `Renewed: ${course.title}`);
      renewed = true;
    } else {
      notes.push(`Already enrolled: ${course.title}`);
    }
  }
  return {
    courseTitle: course.title,
    courseSlug: course.slug,
    isQuiz: course.courseType === "quiz",
    renewed,
  };
}

async function grantDownload(
  db: MySql2Database<typeof schema>,
  userId: number,
  productId: number,
  sessionId: string | null,
  notes: string[],
): Promise<{ title: string; slug: string } | null> {
  const [product] = await db
    .select({ id: digitalProducts.id, title: digitalProducts.title, slug: digitalProducts.slug })
    .from(digitalProducts)
    .where(eq(digitalProducts.id, productId))
    .limit(1);
  if (!product) return null;

  const [existing] = await db
    .select({ id: digitalPurchases.id })
    .from(digitalPurchases)
    .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, productId)))
    .limit(1);
  if (!existing) {
    await db.insert(digitalPurchases).values({
      userId,
      productId,
      stripeCheckoutSessionId: sessionId,
    });
    notes.push(`Download: ${product.title}`);
  }
  return { title: product.title, slug: product.slug };
}

async function grantBundle(
  db: MySql2Database<typeof schema>,
  userId: number,
  bundleId: number,
  sessionId: string | null,
  notes: string[],
  enrollOpts?: EnrollOpts,
): Promise<{ title: string; slug: string } | null> {
  const [bundle] = await db
    .select({ id: bundles.id, title: bundles.title, slug: bundles.slug })
    .from(bundles)
    .where(eq(bundles.id, bundleId))
    .limit(1);
  if (!bundle) return null;

  const [existingBundle] = await db
    .select({ id: bundleEnrollments.id })
    .from(bundleEnrollments)
    .where(and(eq(bundleEnrollments.bundleId, bundleId), eq(bundleEnrollments.userId, userId)))
    .limit(1);
  if (!existingBundle) {
    await db.insert(bundleEnrollments).values({ bundleId, userId });
    notes.push(`Bundle: ${bundle.title}`);
  }

  const [existingDigitalBundle] = await db
    .select({ id: digitalBundlePurchases.id })
    .from(digitalBundlePurchases)
    .where(and(eq(digitalBundlePurchases.userId, userId), eq(digitalBundlePurchases.bundleId, bundleId)))
    .limit(1);
  if (!existingDigitalBundle) {
    await db.insert(digitalBundlePurchases).values({
      userId,
      bundleId,
      stripeCheckoutSessionId: sessionId,
    });
  }

  const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundleId));
  for (const item of items) {
    if (item.itemType === "download" && item.itemId) {
      await grantDownload(db, userId, item.itemId, sessionId, notes);
    } else if ((item.itemType === "course" || item.itemType === "quiz") && item.itemId) {
      await enrollCourseOrQuiz(db, userId, item.itemId, notes, enrollOpts);
    }
  }

  const digitalBundleItems = await db
    .select()
    .from(digitalBundleItems)
    .where(eq(digitalBundleItems.bundleId, bundleId));
  for (const item of digitalBundleItems) {
    await grantDownload(db, userId, item.productId, sessionId, notes);
  }

  return { title: bundle.title, slug: bundle.slug };
}

export async function fulfillMembershipPlanAccess(
  db: MySql2Database<typeof schema>,
  userId: number,
  planId: number,
  ctx: Pick<MembershipFulfillmentContext, "sessionId" | "stripeSubscriptionId" | "stripeCustomerId" | "accessExpiresAt" | "forceRenew">,
): Promise<string[]> {
  const enrollOpts: EnrollOpts = {
    accessExpiresAt: ctx.accessExpiresAt ?? null,
    stripeSubscriptionId: ctx.stripeSubscriptionId ?? null,
    source: "stripe",
    forceRenew: ctx.forceRenew,
  };
  const notes: string[] = [];
  const accessItems = await db
    .select()
    .from(membershipPlanAccess)
    .where(eq(membershipPlanAccess.planId, planId))
    .orderBy(membershipPlanAccess.sortOrder);

  for (const item of accessItems) {
    try {
      if (brandFromItemType(item.itemType)) {
        await grantBrandAccess(
          db,
          userId,
          item.itemType,
          ctx.stripeSubscriptionId ?? null,
          ctx.stripeCustomerId ?? null,
          notes,
        );
        continue;
      }

      switch (item.itemType) {
        case "course":
        case "quiz":
          if (item.itemId) await enrollCourseOrQuiz(db, userId, item.itemId, notes, enrollOpts);
          break;
        case "download":
          if (item.itemId) await grantDownload(db, userId, item.itemId, ctx.sessionId ?? null, notes);
          break;
        case "bundle":
          if (item.itemId) await grantBundle(db, userId, item.itemId, ctx.sessionId ?? null, notes, enrollOpts);
          break;
        case "all_courses": {
          const courses = await db
            .select({ id: lmsCourses.id })
            .from(lmsCourses)
            .where(eq(lmsCourses.status, "public"));
          for (const c of courses) {
            await enrollCourseOrQuiz(db, userId, c.id, notes, enrollOpts);
          }
          break;
        }
        case "all_downloads": {
          const products = await db.select({ id: digitalProducts.id }).from(digitalProducts);
          for (const p of products) {
            await grantDownload(db, userId, p.id, ctx.sessionId ?? null, notes);
          }
          break;
        }
        default:
          if (item.itemId && (item.itemType === "product" || item.itemType === "webinar" || item.itemType === "community")) {
            notes.push(`Skipped unsupported access type ${item.itemType} #${item.itemId}`);
          }
          break;
      }
    } catch (err) {
      console.error(`[MembershipFulfillment] Failed item ${item.itemType} plan=${planId} user=${userId}:`, err);
      notes.push(`Error: ${item.itemType}`);
    }
  }

  return notes;
}

async function sendMembershipWelcomeEmail(opts: {
  userId: number;
  email: string;
  name: string;
  planTitle: string;
  isNewUser: boolean;
  resetToken: string | null;
  planId: number;
  primaryCourseSlug?: string | null;
}): Promise<void> {
  const baseUrl = "https://app.allaboutultrasound.com";
  const learnBase = "https://learn.allaboutultrasound.com";
  const firstName = opts.name.split(" ")[0] || "there";
  const destination = opts.primaryCourseSlug
    ? `${learnBase}/courses/${opts.primaryCourseSlug}/player`
    : `${baseUrl}/my-dashboard`;

  let autoLoginUrl = destination;
  try {
    const token = await generateAutoLoginToken(opts.userId, destination);
    autoLoginUrl = `${baseUrl}/api/auth/auto-login?token=${token}`;
  } catch {
    try {
      const accessToken = await getOrCreateAccessToken(opts.userId);
      autoLoginUrl = `${learnBase}/auth/access?token=${accessToken}&next=${encodeURIComponent(destination)}`;
    } catch { /* keep plain URL */ }
  }

  const setPasswordUrl = opts.resetToken
    ? `${baseUrl}/auth/reset-password?token=${opts.resetToken}`
    : null;

  const accessNote = `<div style="margin:16px 0;padding:14px 16px;background:#f0fbfc;border-left:3px solid #0d9488;border-radius:0 8px 8px 0;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0e4a50;">Quick access</p>
    <p style="margin:0;font-size:13px;color:#475569;">Click below to open your membership — you'll be signed in automatically:</p>
    <p style="margin:8px 0 0;"><a href="${autoLoginUrl}" style="color:#0d9488;font-weight:600;">${autoLoginUrl}</a></p>
  </div>`;

  if (opts.isNewUser && setPasswordUrl) {
    const emailContent = buildPasswordResetEmail({
      firstName,
      resetUrl: setPasswordUrl,
      brandMode: "aaus",
      purpose: "welcome",
      expiresInLabel: "7 days",
    });
    const subject = `Your ${opts.planTitle} membership is ready`;
    const enhancedBody = emailContent.htmlBody.replace("</body>", `${accessNote}</body>`);
    await sendEmail({
      to: { name: opts.name, email: opts.email },
      subject,
      htmlBody: enhancedBody,
      previewText: `Access your ${opts.planTitle} membership on All About Ultrasound`,
    });
    return;
  }

  const { buildFunnelPurchaseConfirmationEmail } = await import("../_core/email");
  const { subject, htmlBody, previewText } = buildFunnelPurchaseConfirmationEmail({
    firstName,
    productName: opts.planTitle,
    amountPaid: 0,
    loginUrl: autoLoginUrl,
    brandMode: "aaus",
  });
  await sendEmail({
    to: { name: opts.name, email: opts.email },
    subject: subject.replace("Purchase confirmed", `Your ${opts.planTitle} membership is active`),
    htmlBody: htmlBody.replace("</body>", `${accessNote}</body>`),
    previewText,
  });
}

/**
 * Full membership purchase fulfillment (idempotent).
 */
export async function fulfillMembershipPurchase(
  db: MySql2Database<typeof schema>,
  planId: number,
  resolved: { userId: number; isNew: boolean; resetToken: string | null },
  ctx: MembershipFulfillmentContext,
): Promise<MembershipFulfillmentResult> {
  const notes: string[] = [];
  const userId = resolved.userId;
  const sessionId = ctx.sessionId ?? null;
  const stripeSubscriptionId = ctx.stripeSubscriptionId ?? null;
  const stripeCustomerId = ctx.stripeCustomerId ?? null;

  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);
  if (!plan) {
    return { success: false, userId, planId, isNewUser: resolved.isNew, notes, error: "Plan not found" };
  }

  // Idempotency: prefer stripe subscription id
  let existingSub = null as {
    id: number;
    userId: number;
    planId: number;
    stripeSubscriptionId: string | null;
  } | null;
  if (stripeSubscriptionId) {
    const [bySub] = await db
      .select()
      .from(membershipSubscriptions)
      .where(eq(membershipSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
    if (bySub) existingSub = bySub;
  }
  if (!existingSub) {
    const [byUserPlan] = await db
      .select()
      .from(membershipSubscriptions)
      .where(and(eq(membershipSubscriptions.userId, userId), eq(membershipSubscriptions.planId, planId)))
      .limit(1);
    if (byUserPlan) existingSub = byUserPlan;
  }

  const previousStripeSubId = existingSub?.stripeSubscriptionId ?? null;
  const periodEndMs = ctx.accessExpiresAt?.getTime() ?? null;

  if (existingSub) {
    await db
      .update(membershipSubscriptions)
      .set({
        status: "active",
        userId,
        stripeSubscriptionId: stripeSubscriptionId ?? undefined,
        stripeCustomerId: stripeCustomerId ?? undefined,
        ...(periodEndMs ? { currentPeriodEnd: periodEndMs } : {}),
        updatedAt: new Date(),
      })
      .where(eq(membershipSubscriptions.id, existingSub.id));
    notes.push("Subscription updated (idempotent)");
  } else {
    await db.insert(membershipSubscriptions).values({
      userId,
      planId,
      status: "active",
      stripeSubscriptionId,
      stripeCustomerId,
      currentPeriodEnd: periodEndMs,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    notes.push("Subscription created");
  }

  if (ctx.discountCodeId) {
    await db
      .update(membershipDiscountCodes)
      .set({ usedCount: sql`used_count + 1` })
      .where(eq(membershipDiscountCodes.id, ctx.discountCodeId));
  }

  const isNewStripeSubscription =
    !!stripeSubscriptionId &&
    stripeSubscriptionId !== previousStripeSubId;

  const accessNotes = await fulfillMembershipPlanAccess(db, userId, planId, {
    sessionId,
    stripeSubscriptionId,
    stripeCustomerId,
    accessExpiresAt: ctx.accessExpiresAt ?? null,
    forceRenew: ctx.forceRenew ?? isNewStripeSubscription,
  });
  notes.push(...accessNotes);

  // Determine primary course for email deep link
  const [firstCourseItem] = await db
    .select()
    .from(membershipPlanAccess)
    .where(
      and(
        eq(membershipPlanAccess.planId, planId),
        inArray(membershipPlanAccess.itemType, ["course", "quiz"]),
      ),
    )
    .limit(1);
  let primaryCourseSlug: string | null = null;
  if (firstCourseItem?.itemId) {
    const [c] = await db
      .select({ slug: lmsCourses.slug })
      .from(lmsCourses)
      .where(eq(lmsCourses.id, firstCourseItem.itemId))
      .limit(1);
    primaryCourseSlug = c?.slug ?? null;
  }

  const email = ctx.customerEmail?.trim();
  const shouldSendEmail =
    !ctx.skipEmail &&
    !!email &&
    (ctx.forceWelcomeEmail || resolved.isNew || !existingSub || isNewStripeSubscription);

  if (shouldSendEmail && email) {
    try {
      await sendMembershipWelcomeEmail({
        userId,
        email,
        name: ctx.customerName || email.split("@")[0],
        planTitle: plan.title,
        isNewUser: resolved.isNew,
        resetToken: resolved.resetToken,
        planId,
        primaryCourseSlug,
      });
      notes.push("Welcome email sent");
    } catch (err) {
      console.error(`[MembershipFulfillment] Welcome email failed for ${email}:`, err);
      notes.push("Welcome email failed");
    }
  }

  // Silently ensure Free Membership is also active for this user (idempotent, no email)
  // This guarantees that any purchaser always has the free tier as a baseline.
  import("./ensureFreeMembership").then(({ ensureFreeMembership }) => {
    ensureFreeMembership(userId).catch(() => {});
  }).catch(() => {});

  return { success: true, userId, planId, isNewUser: resolved.isNew, notes };
}

export async function reconcileMembershipFromStripeSession(
  db: MySql2Database<typeof schema>,
  session: Record<string, unknown>,
): Promise<MembershipFulfillmentResult> {
  const meta = (session.metadata as Record<string, string>) ?? {};
  const customerEmail =
    (session.customer_email as string) ??
    (session.customer_details as Record<string, string>)?.email ??
    meta.customer_email;
  const customerName =
    meta.customer_name ?? (session.customer_details as Record<string, string>)?.name ?? null;

  let stripePriceId: string | null = null;
  try {
    const lineItems = session.line_items as { data?: Array<{ price?: { id?: string } }> } | undefined;
    stripePriceId = lineItems?.data?.[0]?.price?.id ?? null;
  } catch { /* optional */ }

  const planId = await resolveMembershipPlanId(db, {
    planId: meta.plan_id ? parseInt(meta.plan_id, 10) : null,
    stripePriceId,
  });
  if (!planId) {
    return {
      success: false,
      userId: null,
      planId: null,
      isNewUser: false,
      notes: [],
      error: "Could not resolve membership plan",
    };
  }

  const resolved = await resolveMembershipUserId(db, {
    metaUserId: meta.user_id ? parseInt(meta.user_id, 10) : null,
    customerEmail,
    customerName,
  });
  if (!resolved) {
    return {
      success: false,
      userId: null,
      planId,
      isNewUser: false,
      notes: [],
      error: "Could not resolve user for membership purchase",
    };
  }

  let accessExpiresAt: Date | null = null;
  const stripeSubscriptionId = (session.subscription as string) ?? null;
  const stripeCustomerId = (session.customer as string) ?? null;

  if (stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      if (sub.current_period_end) {
        accessExpiresAt = new Date(sub.current_period_end * 1000);
      }
      if (!stripePriceId && sub.items?.data?.[0]?.price?.id) {
        stripePriceId = sub.items.data[0].price.id;
      }
    } catch (err) {
      console.warn(`[MembershipFulfillment] Could not load Stripe subscription ${stripeSubscriptionId}:`, err);
    }
  }

  const result = await fulfillMembershipPurchase(db, planId, resolved, {
    sessionId: session.id as string,
    stripeSubscriptionId,
    stripeCustomerId,
    amountTotalCents: (session.amount_total as number) ?? 0,
    discountCodeId: meta.discount_code_id ? parseInt(meta.discount_code_id, 10) : null,
    customerEmail,
    customerName,
    accessExpiresAt,
    stripePriceId,
    forceWelcomeEmail: true,
    forceRenew: true,
  });

  if (result.success && stripeCustomerId && stripeSubscriptionId) {
    const duplicates = await cancelDuplicateStripeSubscriptions({
      stripeCustomerId,
      keepSubscriptionId: stripeSubscriptionId,
      stripePriceId,
      customerEmail,
    });
    if (duplicates.length > 0) {
      result.notes.push(`Duplicate subscriptions detected (admin notified): ${duplicates.join(", ")}`);
    }
  }

  // Only notify when membership was newly created or renewed — not on idempotent re-runs
  // (prevents duplicate notifications when both webhook and frontend polling call this function)
  const isNewOrRenewed = result.success && result.notes.some(n => n === "Subscription created" || n.startsWith("Renewed"));
  if (isNewOrRenewed) {
    await notifyOwner({
      title: "🎫 Membership Fulfilled",
      content: `User ${result.userId} (${customerEmail}) — plan ${planId}. ${result.notes.join("; ")}`,
    }).catch(() => {});
  }

  return result;
}

/**
 * Detect extra active Stripe subscriptions for the same price.
 * Does NOT auto-cancel — instead notifies admin with full details and instructions.
 */
export async function cancelDuplicateStripeSubscriptions(opts: {
  stripeCustomerId: string;
  keepSubscriptionId: string;
  stripePriceId?: string | null;
  customerEmail?: string | null;
}): Promise<string[]> {
  if (!process.env.STRIPE_SECRET_KEY) return [];
  const stripe = getStripeClient();
  const duplicates: string[] = [];
  try {
    const subs = await stripe.subscriptions.list({
      customer: opts.stripeCustomerId,
      status: "active",
      limit: 20,
    });
    for (const sub of subs.data) {
      if (sub.id === opts.keepSubscriptionId) continue;
      const priceId = sub.items?.data?.[0]?.price?.id;
      if (opts.stripePriceId && priceId !== opts.stripePriceId) continue;
      duplicates.push(sub.id);
      console.warn(`[MembershipFulfillment] Duplicate subscription detected: ${sub.id} (active alongside ${opts.keepSubscriptionId}) — admin notified, no auto-cancel`);
    }
    if (duplicates.length > 0) {
      const adminEmail = process.env.PLATFORM_ADMIN_EMAIL ?? "admin@allaboutultrasound.com";
      const keepLink = `https://dashboard.stripe.com/subscriptions/${opts.keepSubscriptionId}`;
      const dupLinks = duplicates.map(id => `<a href="https://dashboard.stripe.com/subscriptions/${id}">${id}</a>`).join("<br>");
      // In-app notification
      await notifyOwner({
        title: "⚠️ Duplicate Stripe Subscription Detected — Action Required",
        content: `Customer ${opts.stripeCustomerId} (${opts.customerEmail ?? "unknown"}) has multiple active subscriptions for the same plan.\n\nKept (newest): ${opts.keepSubscriptionId}\nDuplicates: ${duplicates.join(", ")}\n\nAction required: Review in Stripe Dashboard and cancel the duplicate(s) manually.`,
      }, { skipAdminEmail: true }).catch(() => {});
      // Admin email with instructions
      const { sendEmail } = await import("../_core/email");
      await sendEmail({
        to: { name: "Platform Admin", email: adminEmail },
        subject: `⚠️ Duplicate Stripe Subscription — Action Required`,
        htmlBody: `
          <h2 style="color:#b91c1c;">Duplicate Stripe Subscription Detected</h2>
          <p>A customer has multiple active subscriptions for the same plan. <strong>No automatic action has been taken.</strong> Please review and cancel the duplicate(s) manually.</p>
          <table style="border-collapse:collapse;width:100%;max-width:600px;">
            <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Customer ID</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.stripeCustomerId}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Customer Email</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.customerEmail ?? "unknown"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Keep (newest)</strong></td><td style="padding:8px;border:1px solid #e5e7eb;"><a href="${keepLink}">${opts.keepSubscriptionId}</a></td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Duplicates to Review</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${dupLinks}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Price ID</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.stripePriceId ?? "N/A"}</td></tr>
          </table>
          <h3 style="margin-top:24px;">Recommended Actions</h3>
          <ol>
            <li>Open each duplicate subscription link above in Stripe Dashboard.</li>
            <li>Confirm the customer was charged twice for the same plan (check payment dates).</li>
            <li>Cancel the older duplicate subscription(s) and issue a refund for any duplicate charge if appropriate.</li>
            <li>If the customer intentionally has two subscriptions (e.g. different accounts), do not cancel — contact them first.</li>
          </ol>
          <p style="color:#6b7280;font-size:12px;">This notification was generated automatically. No subscription has been cancelled.</p>
        `,
      }).catch((emailErr: unknown) => {
        console.error("[MembershipFulfillment] Failed to send duplicate subscription admin email:", emailErr);
      });
      const { logDuplicatePaymentFlag } = await import("./duplicatePaymentLog");
      await logDuplicatePaymentFlag({
        kind: "membership_duplicate_subscription",
        email: opts.customerEmail,
        stripeSubscriptionId: opts.keepSubscriptionId,
        message: `Duplicate active subscriptions for same plan — kept ${opts.keepSubscriptionId}, review: ${duplicates.join(", ")}`,
        rawPayload: {
          stripeCustomerId: opts.stripeCustomerId,
          keepSubscriptionId: opts.keepSubscriptionId,
          duplicateSubscriptionIds: duplicates,
          stripePriceId: opts.stripePriceId,
        },
      });
    }
  } catch (err) {
    console.error("[MembershipFulfillment] cancelDuplicateStripeSubscriptions failed:", err);
  }
  return duplicates;
}
