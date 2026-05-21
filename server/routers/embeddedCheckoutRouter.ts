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
import { getDb } from "../db";
import { funnelPurchases } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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
  price: z.number(), // cents
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
        productPrice: z.number().int().min(50), // cents, min $0.50
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Calculate total
      let totalAmount = input.productPrice;
      for (const bump of input.selectedBumps) {
        if (bump.price > 0) totalAmount += bump.price;
      }
      if (totalAmount < 50) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum charge amount is $0.50" });
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      const customerName = [input.firstName, input.lastName].filter(Boolean).join(" ") || undefined;

      // Build bump metadata (pipe-separated for Stripe metadata string limits)
      const bumpTitles = input.selectedBumps.map(b => b.title).join("|");
      const bumpPrices = input.selectedBumps.map(b => b.price).join("|");

      // Success URL — resolve special values
      const resolveEcSuccessUrl = (redirect: string | undefined) => {
        if (!redirect) return `${input.origin}/?checkout_success=1`;
        if (redirect === "__dashboard__") return `${input.origin}/my-dashboard?purchase=success`;
        if (redirect.startsWith("__funnel__:")) return `${input.origin}/f/${redirect.slice(11)}?success=1`;
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
      // Fulfillment metadata — used by webhook to auto-enroll/grant access
      if (input.lmsCourseId) metadata.fulfillment_course_id = input.lmsCourseId.toString();
      if (input.fulfillmentBrand) metadata.fulfillment_brand = input.fulfillmentBrand;
      if (input.productId) metadata.product_id = input.productId.toString();
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
        amount: totalAmount,
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
        amountPaid: totalAmount,
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
        amount: totalAmount,
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

      await db.update(funnelPurchases)
        .set({ status: "paid" })
        .where(eq(funnelPurchases.stripePaymentIntentId, input.paymentIntentId));

      return { success: true };
    }),
});
