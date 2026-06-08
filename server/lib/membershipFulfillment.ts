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
  webinarRegistrations,
  funnelPages,
} from "../../drizzle/schema";
import { getUserByEmail, getOrCreateUserByEmail, getOrCreateAccessToken } from "../db";
import { generateAutoLoginToken } from "../routes/autoLogin";
import { buildPasswordResetEmail, sendEmail } from "../_core/email";
import { notifyOwner } from "../_core/notification";

export type MembershipFulfillmentContext = {
  sessionId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  amountTotalCents?: number;
  discountCodeId?: number | null;
  customerEmail?: string | null;
  customerName?: string | null;
  /** Unix timestamp (seconds) for when the current billing period ends */
  currentPeriodEnd?: number | null;
  /** Whether the subscription is set to cancel at period end */
  cancelAtPeriodEnd?: boolean;
  /** Skip welcome email (e.g. when resending separately) */
  skipEmail?: boolean;
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

async function enrollCourseOrQuiz(
  db: MySql2Database<typeof schema>,
  userId: number,
  courseId: number,
  notes: string[],
): Promise<{ courseTitle: string; courseSlug: string; isQuiz: boolean } | null> {
  const [course] = await db
    .select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, courseType: lmsCourses.type })
    .from(lmsCourses)
    .where(eq(lmsCourses.id, courseId))
    .limit(1);
  if (!course) return null;

  const [existing] = await db
    .select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType })
    .from(lmsEnrollments)
    .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId)))
    .limit(1);
  if (!existing) {
    await db.insert(lmsEnrollments).values({
      userId,
      courseId,
      orderId: null,
      affiliateCode: null,
      enrollmentType: "full",
    });
    notes.push(`Enrolled: ${course.title}`);
  } else if (existing.enrollmentType === "free_preview") {
    await db.update(lmsEnrollments).set({ enrollmentType: "full" }).where(eq(lmsEnrollments.id, existing.id));
    notes.push(`Upgraded preview: ${course.title}`);
  } else {
    notes.push(`Already enrolled: ${course.title}`);
  }
  return {
    courseTitle: course.title,
    courseSlug: course.slug,
    isQuiz: course.courseType === "quiz",
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
      await enrollCourseOrQuiz(db, userId, item.itemId, notes);
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

async function grantFunnelPageProduct(
  db: MySql2Database<typeof schema>,
  userId: number,
  productType: string,
  productId: number,
  sessionId: string | null,
  notes: string[],
): Promise<void> {
  switch (productType) {
    case "course":
    case "quiz":
      await enrollCourseOrQuiz(db, userId, productId, notes);
      break;
    case "download":
      await grantDownload(db, userId, productId, sessionId, notes);
      break;
    case "bundle":
      await grantBundle(db, userId, productId, sessionId, notes);
      break;
    case "physical":
      notes.push(`Physical product #${productId} requires manual fulfillment`);
      break;
    default:
      notes.push(`Funnel product type "${productType}" #${productId} — skipped`);
  }
}

async function grantFunnelProducts(
  db: MySql2Database<typeof schema>,
  userId: number,
  funnelId: number,
  sessionId: string | null,
  notes: string[],
): Promise<void> {
  const pages = await db
    .select({
      productType: funnelPages.productType,
      productId: funnelPages.productId,
    })
    .from(funnelPages)
    .where(and(
      eq(funnelPages.funnelId, funnelId),
      eq(funnelPages.isActive, true),
      sql`${funnelPages.productId} IS NOT NULL`,
    ));
  for (const page of pages) {
    if (!page.productId || !page.productType) continue;
    await grantFunnelPageProduct(db, userId, page.productType, page.productId, sessionId, notes);
  }
}

export async function fulfillMembershipPlanAccess(
  db: MySql2Database<typeof schema>,
  userId: number,
  planId: number,
  ctx: Pick<MembershipFulfillmentContext, "sessionId" | "stripeSubscriptionId" | "stripeCustomerId">,
): Promise<string[]> {
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
          if (item.itemId) await enrollCourseOrQuiz(db, userId, item.itemId, notes);
          break;
        case "download":
          if (item.itemId) await grantDownload(db, userId, item.itemId, ctx.sessionId ?? null, notes);
          break;
        case "bundle":
          if (item.itemId) await grantBundle(db, userId, item.itemId, ctx.sessionId ?? null, notes);
          break;
        case "all_courses": {
          const courses = await db
            .select({ id: lmsCourses.id })
            .from(lmsCourses)
            .where(eq(lmsCourses.status, "public"));
          for (const c of courses) {
            await enrollCourseOrQuiz(db, userId, c.id, notes);
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
        case "all_bundles": {
          const allBundles = await db.select({ id: bundles.id }).from(bundles);
          for (const b of allBundles) {
            await grantBundle(db, userId, b.id, ctx.sessionId ?? null, notes);
          }
          break;
        }
        case "webinar": {
          if (item.itemId) {
            // Register user for webinar (idempotent)
            const [existing] = await db
              .select({ id: webinarRegistrations.id })
              .from(webinarRegistrations)
              .where(and(eq(webinarRegistrations.userId, userId), eq(webinarRegistrations.webinarId, item.itemId)))
              .limit(1);
            if (!existing) {
              await db.insert(webinarRegistrations).values({
                userId,
                webinarId: item.itemId,
              });
              notes.push(`Webinar registration: #${item.itemId}`);
            }
          }
          break;
        }
        case "all_webinars": {
          // Grant access to all webinars by enrolling in all courses of type 'quiz' (webinar replays)
          // Webinars themselves are registered on-demand; this ensures replay access
          const webinarCourses = await db
            .select({ id: lmsCourses.id })
            .from(lmsCourses)
            .where(and(eq(lmsCourses.status, "public")));
          for (const c of webinarCourses) {
            await enrollCourseOrQuiz(db, userId, c.id, notes);
          }
          break;
        }
        case "funnel": {
          if (item.itemId) {
            // Grant all products linked to checkout/upsell pages in this funnel
            await grantFunnelProducts(db, userId, item.itemId, ctx.sessionId ?? null, notes);
          }
          break;
        }
        case "all_funnel_products": {
          // Grant all products from all funnel checkout/upsell pages
          const allFunnelPages = await db
            .select({
              productType: funnelPages.productType,
              productId: funnelPages.productId,
            })
            .from(funnelPages)
            .where(and(
              eq(funnelPages.isActive, true),
              sql`${funnelPages.productId} IS NOT NULL`,
            ));
          for (const page of allFunnelPages) {
            if (!page.productId || !page.productType) continue;
            await grantFunnelPageProduct(db, userId, page.productType, page.productId, ctx.sessionId ?? null, notes);
          }
          break;
        }
        case "cohort": {
          // Cohort enrollment is handled by the course enrollment (cohort courses are lmsCourses)
          if (item.itemId) await enrollCourseOrQuiz(db, userId, item.itemId, notes);
          break;
        }
        case "physical_product":
        case "product":
          // Physical products require manual fulfillment — log for owner notification
          notes.push(`Physical product #${item.itemId ?? "unknown"} requires manual fulfillment`);
          break;
        case "community":
          // Community access is handled by brand membership tier — no separate action needed
          notes.push(`Community access included via brand membership`);
          break;
        default:
          // Future-proof: log any unrecognized item type but don't crash
          notes.push(`Unknown access type "${item.itemType}" #${item.itemId ?? "?"} — skipped (add handler when ready)`);
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
  let existingSub = null as { id: number; userId: number; planId: number } | null;
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

  const periodEnd = ctx.currentPeriodEnd ?? null;
  const cancelAtEnd = ctx.cancelAtPeriodEnd ?? false;

  if (existingSub) {
    await db
      .update(membershipSubscriptions)
      .set({
        status: cancelAtEnd ? "active" : "active",
        userId,
        stripeSubscriptionId: stripeSubscriptionId ?? undefined,
        stripeCustomerId: stripeCustomerId ?? undefined,
        currentPeriodEnd: periodEnd ?? undefined,
        cancelAtPeriodEnd: cancelAtEnd,
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
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: cancelAtEnd,
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

  const accessNotes = await fulfillMembershipPlanAccess(db, userId, planId, {
    sessionId,
    stripeSubscriptionId,
    stripeCustomerId,
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
  if (!ctx.skipEmail && email) {
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
  // Also check metadata.stripe_price_id (set by bulk reconcile for subscriptions without checkout sessions)
  if (!stripePriceId && meta.stripe_price_id) stripePriceId = meta.stripe_price_id;

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

  const result = await fulfillMembershipPurchase(db, planId, resolved, {
    sessionId: session.id as string,
    stripeSubscriptionId: (session.subscription as string) ?? null,
    stripeCustomerId: (session.customer as string) ?? null,
    amountTotalCents: (session.amount_total as number) ?? 0,
    discountCodeId: meta.discount_code_id ? parseInt(meta.discount_code_id, 10) : null,
    customerEmail,
    customerName,
    currentPeriodEnd: (session.current_period_end as number) ?? null,
    cancelAtPeriodEnd: (session.cancel_at_period_end as boolean) ?? false,
  });

  if (result.success) {
    await notifyOwner({
      title: "🎫 Membership Fulfilled",
      content: `User ${result.userId} (${customerEmail}) — plan ${planId}. ${result.notes.join("; ")}`,
    }).catch(() => {});
  }

  return result;
}
