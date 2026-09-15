import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "webhooks/stripe.ts"), "utf8");

describe("digital-download Stripe fulfillment safeguards", () => {
  it("uses the Stripe PaymentIntent as the primary idempotency key before checking product ownership", () => {
    const paymentCheck = source.indexOf("Digital download payment already reconciled");
    const entitlementCheck = source.indexOf("Digital download already purchased");

    expect(paymentCheck).toBeGreaterThan(-1);
    expect(entitlementCheck).toBeGreaterThan(-1);
    expect(paymentCheck).toBeLessThan(entitlementCheck);
    expect(source).toContain("eq(digitalPurchases.stripePaymentIntentId, paymentIntentId)");
  });

  it("does not silently reassign an already-reconciled payment to another account", () => {
    expect(source).toContain("Digital Download — Payment Account Conflict");
    expect(source).toContain("No reassignment was applied automatically.");
  });

  it("records the actual download-email outcome for new and duplicate checkout fulfillment", () => {
    expect(source).toContain("const deliverySucceeded = await sendPurchaseConfirmationEmail(userId, productId)");
    expect(source).toContain('eventType: deliverySucceeded ? "email_sent" : "email_failed"');
    expect(source).toContain("Download access email failed");
  });
});
