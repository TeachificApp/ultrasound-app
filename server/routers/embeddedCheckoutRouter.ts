/**
 * embeddedCheckoutRouter.ts
 *
 * tRPC procedures for the embedded_checkout content block.
 * This block can be placed on any page builder surface (funnels, landing pages,
 * product pages, LMS lessons) and provides inline Stripe PaymentElement checkout
 * with order bumps, address collection, and dashboard purchase recording.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb, getOrCreateUserByEmail } from "../db";
import { funnelPurchases, lmsEnrollments, brandMemberships, digitalPurchases, lmsCourses, digitalProducts, physicalProducts } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { sendEmail, buildFunnelPurchaseConfirmationEmail } from "../_core/email";
import { generateAutoLoginToken } from "../routes/autoLogin";
import { assertFreeOrderEligible, resolveEmbeddedCheckoutExpectedCents } from "../lib/checkoutPricing";
import { getStripeClient } from "../lib/stripeClient";

const billingAddressSchema = z.object({
  address: z.string(),
  address2: z.string().optional(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  postalCode: z.string(),
});

const shippingAddressSchema = z.object({
  name: z.string(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
});

const orderBumpInputSchema = z.object({
  title: z.string(),
  price: z.number(), // dollars
  productType: z.string().optional(),
});

export const embeddedCheckoutRouter = router({
  /**
   * Create a Stripe PaymentIntent for an embedded checkout block.
   * Works on any page type — funnel, landing page, product page, or LMS lesson.
   */
  createPaymentIntent: publicProcedure
    .input(
      z.object({
        // Customer details
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        // Primary product
        productName: z.string(),
        productPrice: z.number().min(0.5), // dollars, min $0.50
        productType: z.enum(["course", "download", "physical", "membership", "bundle", "other"]).default("other"),
        // Order bumps selected by the user
        selectedBumps: z.array(orderBumpInputSchema).default([]),
        // Address (required for physical products)
        billingAddress: billingAddressSchema.optional(),
        shippingAddress: shippingAddressSchema.optional(),
        collectShipping: z.boolean().default(false),
        // Source context (for attribution and dashboard display)
        sourceType: z.enum(["funnel", "landing_page", "product_page", "lms_lesson", "other"]).default("other"),
        sourceFunnelId: z.number().optional(),
        sourceFunnelPageId: z.number().optional(),
        sourceLandingPageId: z.number().optional(),
        sourceLmsLessonId: z.number().optional(),
        // Fulfillment: auto-enroll in LMS course or grant brand membership on payment success
        lmsCourseId: z.number().optional(),       // If set, enroll user in this course after payment
        fulfillmentBrand: z.enum(["aaus", "iheartecho", "both"]).optional(), // If set, grant brand membership after payment
        // Direct product ID for download/bundle/quiz fulfillment (overrides productType-based lookup)
        productId: z.number().optional(),
        // Redirect after success
        successRedirect: z.string().optional(),
        origin: z.string(),
        // Additional access items (no extra charge — bonus fulfillment)
        additionalAccess: z.array(z.object({
          type: z.string(),
          productId: z.number().optional(),
          brand: z.string().optional(),
          label: z.string(),
        })).optional(),
        // Optional promo code to validate and apply
        promoCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      let totalAmountCents = await resolveEmbeddedCheckoutExpectedCents(db, {
        productName: input.productName,
        productPrice: input.productPrice,
        productType: input.productType,
        productId: input.productId,
        lmsCourseId: input.lmsCourseId,
        sourceFunnelPageId: input.sourceFunnelPageId,
        selectedBumps: input.selectedBumps,
      });

      // Apply promo code discount if provided
      let discountAppliedCents = 0;
      let promoCodeId: string | undefined;
      if (input.promoCode) {
        const stripe2 = getStripeClient();
        try {
          const promoCodes = await stripe2.promotionCodes.list({ code: input.promoCode, active: true, limit: 1 });
          if (promoCodes.data.length > 0) {
            const promoCodeObj = promoCodes.data[0];
            promoCodeId = promoCodeObj.id;
            const coupon = promoCodeObj.coupon;
            if (coupon.percent_off) {
              // percent_off is a percentage (0-100)
              discountAppliedCents = Math.round(totalAmountCents * (coupon.percent_off / 100));
            } else if (coupon.amount_off) {
              // amount_off from Stripe is already in cents
              discountAppliedCents = Math.min(coupon.amount_off, totalAmountCents);
            }
            totalAmountCents = Math.max(50, totalAmountCents - discountAppliedCents);
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired promo code" });
          }
        } catch (e: any) {
          if (e instanceof TRPCError) throw e;
          // Stripe API error — ignore silently and proceed without discount
        }
      }

      if (totalAmountCents < 50) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum charge amount is $0.50" });
      }

      const totalAmount = totalAmountCents / 100; // dollars, for display only

      const stripe = getStripeClient();

      const customerName = [input.firstName, input.lastName].filter(Boolean).join(" ") || undefined;

      // Build bump metadata (pipe-separated for Stripe metadata string limits)
      const bumpTitles = input.selectedBumps.map(b => b.title).join("|");
      const bumpPrices = input.selectedBumps.map(b => b.price).join("|");

      // Success URL — resolve special values
      const resolveEcSuccessUrl = (redirect: string | undefined) => {
        if (!redirect) return `${input.origin}/?checkout_success=1`;
        if (redirect === "__dashboard__") return `${input.origin}/my-dashboard?purchase=success`;
        if (redirect.startsWith("__funnel__:")) return `${input.origin}/${redirect.slice(11)}?success=1`;
        if (redirect.startsWith("http")) return redirect;
        return `${input.origin}${redirect}`;
      };
      const successUrl = resolveEcSuccessUrl(input.successRedirect);

      // Build metadata — all values must be strings ≤ 500 chars
      const metadata: Record<string, string> = {
        type: "embedded_checkout_purchase",
        product_name: input.productName.slice(0, 490),
        product_type: input.productType,
        customer_email: input.email,
        customer_name: customerName?.slice(0, 490) ?? "",
        customer_phone: input.phone ?? "",
        user_id: ctx.user?.id?.toString() ?? "",
        bumps_added: input.selectedBumps.length > 0 ? "1" : "",
        bump_titles: bumpTitles.slice(0, 490),
        bump_prices: bumpPrices.slice(0, 490),
        source_type: input.sourceType,
        success_url: successUrl.slice(0, 490),
      };
      if (input.sourceFunnelId) metadata.funnel_id = input.sourceFunnelId.toString();
      if (input.sourceFunnelPageId) metadata.funnel_page_id = input.sourceFunnelPageId.toString();
      if (input.sourceLandingPageId) metadata.landing_page_id = input.sourceLandingPageId.toString();
      if (input.sourceLmsLessonId) metadata.lms_lesson_id = input.sourceLmsLessonId.toString();
      // Block checkout if enrollment close date has passed for cohort courses
      if (input.lmsCourseId) {
        const [courseRow] = await db.select({ enrollmentCloseDate: lmsCourses.enrollmentCloseDate })
          .from(lmsCourses).where(eq(lmsCourses.id, input.lmsCourseId)).limit(1);
        if (courseRow?.enrollmentCloseDate && new Date(courseRow.enrollmentCloseDate) < new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enrollment is closed for this cohort" });
        }
      }

      // Fulfillment metadata — used by webhook to auto-enroll/grant access
      if (input.lmsCourseId) metadata.fulfillment_course_id = input.lmsCourseId.toString();
      if (input.fulfillmentBrand) metadata.fulfillment_brand = input.fulfillmentBrand;
      if (input.productId) metadata.product_id = input.productId.toString();
      if (input.promoCode) metadata.promo_code = input.promoCode.slice(0, 100);
      if (discountAppliedCents > 0) metadata.discount_applied = (discountAppliedCents / 100).toString();
      if (promoCodeId) metadata.promo_code_id = promoCodeId;
      // Note: additionalAccess items are stored in block data and resolved server-side
      // from the page blocks after payment — not passed through Stripe metadata.

      // Add shipping address to metadata if physical product
      if (input.shippingAddress && input.collectShipping) {
        const s = input.shippingAddress;
        metadata.shipping_name = s.name.slice(0, 255);
        metadata.shipping_line1 = s.line1.slice(0, 255);
        metadata.shipping_line2 = (s.line2 ?? "").slice(0, 255);
        metadata.shipping_city = s.city.slice(0, 100);
        metadata.shipping_state = s.state.slice(0, 100);
        metadata.shipping_postal_code = s.postalCode.slice(0, 20);
        metadata.shipping_country = s.country.slice(0, 10);
      }

      // Build description
      let description = input.productName;
      if (input.selectedBumps.length > 0) {
        description += " + " + input.selectedBumps.map(b => b.title).join(", ");
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountCents,
        currency: "usd",
        description: description.slice(0, 1000),
        receipt_email: input.email,
        metadata,
        automatic_payment_methods: { enabled: true },
      });

      // Create a pending purchase record immediately (will be confirmed by webhook)
      await db.insert(funnelPurchases).values({
        userId: ctx.user?.id ?? null,
        email: input.email,
        name: customerName ?? null,
        phone: input.phone ?? null,
        productName: input.productName,
        productType: input.productType,
        orderBumps: input.selectedBumps.length > 0 ? JSON.stringify(input.selectedBumps.map(b => ({ title: b.title, price: b.price }))) : null,
        amountPaid: totalAmountCents,
        currency: "usd",
        stripePaymentIntentId: paymentIntent.id,
        sourceType: input.sourceType,
        sourceFunnelId: input.sourceFunnelId ?? null,
        sourceFunnelPageId: input.sourceFunnelPageId ?? null,
        sourceLandingPageId: input.sourceLandingPageId ?? null,
        sourceLmsLessonId: input.sourceLmsLessonId ?? null,
        shippingName: input.shippingAddress?.name ?? null,
        shippingLine1: input.shippingAddress?.line1 ?? null,
        shippingLine2: input.shippingAddress?.line2 ?? null,
        shippingCity: input.shippingAddress?.city ?? null,
        shippingState: input.shippingAddress?.state ?? null,
        shippingPostalCode: input.shippingAddress?.postalCode ?? null,
        shippingCountry: input.shippingAddress?.country ?? null,
        status: "pending",
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amount: totalAmount, // dollars for display
        successUrl,
      };
    }),

  /**
   * Confirm a payment intent succeeded (called from client after Stripe confirms).
   * Updates the funnelPurchases record status to "paid".
   */
  confirmPayment: publicProcedure
    .input(z.object({
      paymentIntentId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const stripe = getStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Payment not completed (status: ${paymentIntent.status})`,
        });
      }

      await db.update(funnelPurchases)
        .set({ status: "paid", amountPaid: paymentIntent.amount })
        .where(eq(funnelPurchases.stripePaymentIntentId, input.paymentIntentId));

      return { success: true };
    }),

  /**
   * Process a free order (total = $0) without Stripe.
   * Performs the same fulfillment as the Stripe webhook: course enrollment,
   * download access, brand membership, and additional access items.
   */
  processFreeOrder: publicProcedure
    .input(z.object({
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      productName: z.string(),
      productType: z.enum(["course", "download", "physical", "membership", "bundle", "other"]).default("other"),
      sourceType: z.enum(["funnel", "landing_page", "product_page", "lms_lesson", "other"]).default("other"),
      sourceFunnelId: z.number().optional(),
      sourceFunnelPageId: z.number().optional(),
      sourceLandingPageId: z.number().optional(),
      sourceLmsLessonId: z.number().optional(),
      lmsCourseId: z.number().optional(),
      fulfillmentBrand: z.enum(["aaus", "iheartecho", "both"]).optional(),
      productId: z.number().optional(),
      successRedirect: z.string().optional(),
      origin: z.string(),
      additionalAccess: z.array(z.object({
        type: z.string(),
        productId: z.number().optional(),
        brand: z.string().optional(),
        label: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await assertFreeOrderEligible(db, {
        productName: input.productName,
        productType: input.productType,
        productId: input.productId,
        lmsCourseId: input.lmsCourseId,
        sourceFunnelPageId: input.sourceFunnelPageId,
        sourceFunnelId: input.sourceFunnelId,
      });

      const customerName = [input.firstName, input.lastName].filter(Boolean).join(" ") || undefined;
      let userId = ctx.user?.id ?? null;

      // Resolve success URL
      const resolveSuccessUrl = (redirect: string | undefined) => {
        if (!redirect) return `${input.origin}/?checkout_success=1`;
        if (redirect === "__dashboard__") return `${input.origin}/my-dashboard?purchase=success`;
        if (redirect.startsWith("__funnel__:")) return `${input.origin}/${redirect.slice(11)}?success=1`;
        if (redirect.startsWith("http")) return redirect;
        return `${input.origin}${redirect}`;
      };
      const successUrl = resolveSuccessUrl(input.successRedirect);

      // ── Auto-create account for guests ──────────────────────────────────────
      const brandMode = "aaus"; // default; could be extended via input if needed
      const baseUrl = brandMode === "iheartecho" ? "https://app.iheartecho.net" : "https://app.allaboutultrasound.com";
      if (!userId) {
        try {
          const nameParts = (customerName || "").split(" ");
          const result = await getOrCreateUserByEmail({
            email: input.email,
            firstName: nameParts[0] || undefined,
            lastName: nameParts.slice(1).join(" ") || undefined,
            name: customerName || undefined,
          });
          userId = result.user.id;
          if (result.isNew && result.resetToken) {
            try {
              const { buildPasswordResetEmail, sendEmail: _sendEmail } = await import("../_core/email");
              const setPasswordUrl = `${baseUrl}/auth/reset-password?token=${result.resetToken}`;
              const firstName = input.firstName || nameParts[0] || "there";
              const emailContent = buildPasswordResetEmail({
                firstName,
                resetUrl: setPasswordUrl,
                brandMode: brandMode as any,
              });
              await _sendEmail({
                to: { name: customerName || firstName, email: input.email },
                subject: `Your account is ready — set your password to access ${input.productName || "your purchase"}`,
                htmlBody: emailContent.htmlBody,
                previewText: `Set your password to access your ${input.productName || "purchase"} on All About Ultrasound`,
              });
              console.log(`[FreeOrder] Sent set-password email to ${input.email} (new user ${userId})`);
            } catch (emailErr) {
              console.error(`[FreeOrder] Failed to send set-password email:`, emailErr);
            }
          }
        } catch (err) {
          console.error("[FreeOrder] Failed to create/find user:", err);
        }
      }
      // ── END AUTO-ACCOUNT CREATION ────────────────────────────────────────────

      // Record the free purchase
      await db.insert(funnelPurchases).values({
        userId,
        email: input.email,
        name: customerName ?? null,
        phone: input.phone ?? null,
        productName: input.productName,
        productType: input.productType,
        orderBumps: null,
        amountPaid: 0,
        currency: "usd",
        stripePaymentIntentId: null,
        sourceType: input.sourceType,
        sourceFunnelId: input.sourceFunnelId ?? null,
        sourceFunnelPageId: input.sourceFunnelPageId ?? null,
        sourceLandingPageId: input.sourceLandingPageId ?? null,
        sourceLmsLessonId: input.sourceLmsLessonId ?? null,
        status: "paid",
      });

      const fulfillmentNotes: string[] = [];

      // ── LMS Course Enrollment ──
      if (input.lmsCourseId && userId) {
        const [existing] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, input.lmsCourseId))).limit(1);
        if (!existing) {
          await db.insert(lmsEnrollments).values({ userId, courseId: input.lmsCourseId, orderId: null, affiliateCode: null });
        }
        fulfillmentNotes.push(`Course enrollment: #${input.lmsCourseId}`);
      }

      // ── Download Access ──
      if (input.productId && input.productType === "download" && userId) {
        const [existing] = await db.select({ id: digitalPurchases.id }).from(digitalPurchases)
          .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, input.productId))).limit(1);
        if (!existing) {
          await db.insert(digitalPurchases).values({ userId, productId: input.productId, stripeCheckoutSessionId: null });
        }
        fulfillmentNotes.push(`Download access: #${input.productId}`);
      }

      // ── Brand Membership ──
      if (input.fulfillmentBrand && userId) {
        const brandsToGrant: ("aaus" | "iheartecho")[] =
          input.fulfillmentBrand === "both" ? ["aaus", "iheartecho"] : [input.fulfillmentBrand];
        for (const brand of brandsToGrant) {
          const [existing] = await db.select({ id: brandMemberships.id }).from(brandMemberships)
            .where(and(eq(brandMemberships.userId, userId), eq(brandMemberships.brand, brand))).limit(1);
          if (existing) {
            await db.update(brandMemberships)
              .set({ tier: "premium", status: "active", source: "free", grantedAt: new Date() })
              .where(eq(brandMemberships.id, existing.id));
          } else {
            await db.insert(brandMemberships).values({
              userId, brand, tier: "premium", status: "active", source: "free",
              stripeSubscriptionId: null, stripeCustomerId: null,
            });
          }
        }
        fulfillmentNotes.push(`Brand access: ${input.fulfillmentBrand}`);
      }

      // ── Additional Access Items ──
      if (input.additionalAccess?.length && userId) {
        for (const item of input.additionalAccess) {
          try {
            if (item.type === "course" && item.productId) {
              const [existing] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
                .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, item.productId))).limit(1);
              if (!existing) {
                await db.insert(lmsEnrollments).values({ userId, courseId: item.productId, orderId: null, affiliateCode: null });
              }
              fulfillmentNotes.push(`Bonus course: ${item.label}`);
            } else if (item.type === "download" && item.productId) {
              const [existing] = await db.select({ id: digitalPurchases.id }).from(digitalPurchases)
                .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, item.productId))).limit(1);
              if (!existing) {
                await db.insert(digitalPurchases).values({ userId, productId: item.productId, stripeCheckoutSessionId: null });
              }
              fulfillmentNotes.push(`Bonus download: ${item.label}`);
            } else if (item.type === "membership" && item.brand) {
              const brandsToGrant: ("aaus" | "iheartecho")[] =
                item.brand === "both" ? ["aaus", "iheartecho"] : [item.brand as "aaus" | "iheartecho"];
              for (const brand of brandsToGrant) {
                const [existing] = await db.select({ id: brandMemberships.id }).from(brandMemberships)
                  .where(and(eq(brandMemberships.userId, userId), eq(brandMemberships.brand, brand))).limit(1);
                if (existing) {
                  await db.update(brandMemberships)
                    .set({ tier: "premium", status: "active", source: "free", grantedAt: new Date() })
                    .where(eq(brandMemberships.id, existing.id));
                } else {
                  await db.insert(brandMemberships).values({
                    userId, brand, tier: "premium", status: "active", source: "free",
                    stripeSubscriptionId: null, stripeCustomerId: null,
                  });
                }
              }
              fulfillmentNotes.push(`Bonus membership: ${item.label}`);
            }
          } catch (itemErr) {
            console.error(`[FreeOrder] Failed to grant additional access item "${item.label}":`, itemErr);
          }
        }
      }

      // ── Notify owner ──
      await notifyOwner({
        title: `🎁 New Free Order — ${input.productName}`,
        content: `Free order processed.\nProduct: ${input.productName}\nEmail: ${input.email}\nName: ${customerName ?? ""}${fulfillmentNotes.length ? `\nFulfillment: ${fulfillmentNotes.join(", ")}` : ""}`,
      }).catch(() => {});

      // ── Send confirmation email ──
      if (input.email) {
        try {
          const firstName = customerName ? customerName.split(" ")[0] : "there";
          // Build a meaningful access URL pointing to the actual content
          let loginUrl = `${baseUrl}/my-courses`;
          if (input.lmsCourseId) {
            try {
              const [courseRow] = await db.select({ slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, input.lmsCourseId)).limit(1);
              if (courseRow?.slug) loginUrl = `${baseUrl}/courses/${courseRow.slug}`;
            } catch { /* keep default */ }
          } else if (input.productType === "download") {
            loginUrl = `${baseUrl}/my-downloads`;
          } else if (input.productType === "bundle") {
            loginUrl = `${baseUrl}/my-courses`;
          } else if (input.fulfillmentBrand) {
            loginUrl = `${baseUrl}/dashboard`;
          }
          // Generate auto-login token so the email link logs them in automatically
          let autoLoginUrl = loginUrl;
          if (userId) {
            try {
              const token = await generateAutoLoginToken(userId, loginUrl);
              autoLoginUrl = `${baseUrl}/api/auth/auto-login?token=${token}`;
            } catch (tokenErr) {
              console.error(`[FreeOrder] Failed to generate auto-login token for user ${userId}:`, tokenErr);
            }
          }
          const { subject, htmlBody, previewText } = buildFunnelPurchaseConfirmationEmail({
            firstName,
            productName: input.productName,
            amountPaid: 0,
            loginUrl: autoLoginUrl,
            brandMode: brandMode as any,
          });
          await sendEmail({ to: { name: customerName || firstName, email: input.email }, subject, htmlBody, previewText });
          console.log(`[FreeOrder] Confirmation email sent to ${input.email} (auto-login: ${userId ? 'yes' : 'no'})`);
        } catch (err) {
          console.error(`[FreeOrder] Failed to send confirmation email:`, err);
        }
      }

      return { success: true, successUrl };
    }),

  /**
   * Get the after-purchase workflow for a product.
   * Called by the success step in EmbeddedCheckoutBlock to execute workflow actions.
   */
  getPostPurchaseWorkflow: publicProcedure
    .input(z.object({
      productId: z.number().optional(),
      productType: z.enum(["course", "download", "physical", "membership", "bundle", "other"]).optional(),
    }))
    .query(async ({ input }) => {
      if (!input.productId || !input.productType) return { workflow: null };
      const db = await getDb();
      if (!db) return { workflow: null };
      try {
        if (input.productType === "download") {
          const [row] = await db.select({ afterPurchaseWorkflow: digitalProducts.afterPurchaseWorkflow })
            .from(digitalProducts).where(eq(digitalProducts.id, input.productId)).limit(1);
          return { workflow: row?.afterPurchaseWorkflow ?? null };
        }
        if (input.productType === "physical") {
          const [row] = await db.select({ afterPurchaseWorkflow: physicalProducts.afterPurchaseWorkflow })
            .from(physicalProducts).where(eq(physicalProducts.id, input.productId)).limit(1);
          return { workflow: row?.afterPurchaseWorkflow ?? null };
        }
        if (input.productType === "course") {
          const [row] = await db.select({
            postPurchaseRedirectUrl: lmsCourses.postPurchaseRedirectUrl,
            welcomeEmailEnabled: lmsCourses.welcomeEmailEnabled,
            welcomeEmailSubject: lmsCourses.welcomeEmailSubject,
            welcomeEmailBody: lmsCourses.welcomeEmailBody,
            upsellEnabled: lmsCourses.upsellEnabled,
            upsellCourseId: lmsCourses.upsellCourseId,
            upsellHeadline: lmsCourses.upsellHeadline,
          }).from(lmsCourses).where(eq(lmsCourses.id, input.productId)).limit(1);
          if (!row) return { workflow: null };
          // Convert existing course fields to workflow action format
          const actions: any[] = [];
          if (row.postPurchaseRedirectUrl) {
            actions.push({ type: "redirect", url: row.postPurchaseRedirectUrl, delaySeconds: 3 });
          }
          if (row.welcomeEmailEnabled && row.welcomeEmailSubject) {
            actions.push({ type: "email", subject: row.welcomeEmailSubject, body: row.welcomeEmailBody ?? "" });
          }
          if (row.upsellEnabled && row.upsellCourseId) {
            actions.push({ type: "order_bump", orderBumpId: row.upsellCourseId, headline: row.upsellHeadline ?? "" });
          }
          return { workflow: actions.length > 0 ? JSON.stringify(actions) : null };
        }
      } catch (err) {
        console.error("[getPostPurchaseWorkflow] Error:", err);
      }
      return { workflow: null };
    }),

  /**
   * Generate an auto-login URL for the current logged-in user.
   * Used to bake auto-login into the success redirect URL.
   */
  generateAutoLoginUrl: publicProcedure
    .input(z.object({
      redirectUrl: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) return { url: input.redirectUrl };
      try {
        const token = await generateAutoLoginToken(ctx.user.id, input.redirectUrl);
        const baseUrl = input.redirectUrl.startsWith("http") ? new URL(input.redirectUrl).origin : "";
        return { url: `${baseUrl}/api/auth/auto-login?token=${token}` };
      } catch (err) {
        console.error("[generateAutoLoginUrl] Error:", err);
        return { url: input.redirectUrl };
      }
    }),
});
