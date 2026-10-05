import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const readProjectFile = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

describe("canonical bundle direct checkout", () => {
  it("lists the LMS bundle catalog separately from legacy digital bundles", () => {
    const router = readProjectFile("server/routers/funnelRouter.ts");
    const builder = readProjectFile("client/src/pages/admin/LandingPageBuilder.tsx");

    expect(router).toContain('type: "canonical_bundle" as const');
    expect(router).toContain("firstCanonicalPriceByBundleId");
    expect(router).toContain("bundlePricingOptions.isActive");
    expect(builder).toContain('return type === "canonical_bundle" ? "bundle" : type;');
    expect(builder).toContain('type === "canonical_bundle"');
  });

  it("creates a canonical bundle checkout with the bundle pricing option and public return URL", () => {
    const router = readProjectFile("server/routers/funnelRouter.ts");

    expect(router).toContain('"canonical_bundle"');
    expect(router).toContain('purchase_type: "bundle_purchase"');
    expect(router).toContain("pricing_option_id: canonicalBundleCheckout.pricingOptionId");
    expect(router).toContain("mode: checkoutMode");
    expect(router).toContain("/bundles/${canonicalBundleCheckout.slug}?success=1");
    expect(router).toContain("shipping_address_collection");
    expect(router).toContain("discountedAmount <= 0 && !canonicalBundleCheckout");
  });

  it("fulfills canonical bundle purchases in immediate and delayed Stripe webhook paths", () => {
    const webhook = readProjectFile("server/webhooks/stripe.ts");
    const fulfillment = readProjectFile("server/lib/membershipFulfillment.ts");

    expect(webhook).toContain("async function handleCanonicalBundleCheckoutCompleted");
    expect(webhook).toContain('meta.purchase_type !== "bundle_purchase"');
    expect(webhook.match(/await handleCanonicalBundleCheckoutCompleted\(/g)).toHaveLength(2);
    expect(webhook).toContain("sendBundleAccessEmail");
    expect(webhook).toContain("destinationUrl: `https://learn.allaboutultrasound.com/bundles/${bundle.slug}`");
    expect(fulfillment).toContain("export async function grantBundle");
    expect(fulfillment).toContain("pricingOptionId: checkoutDetails?.pricingOptionId");
    expect(fulfillment).toContain("stripePaymentIntentId: checkoutDetails?.stripePaymentIntentId");
  });
});
