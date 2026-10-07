import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

describe("Meta Pixel verified purchase tracking", () => {
  const pixel = source("client/src/components/MetaPixel.tsx");
  const checkoutComplete = source("client/src/pages/CheckoutComplete.tsx");
  const bundleLanding = source("client/src/pages/BundleLanding.tsx");
  const directPurchaseTracker = source("client/src/components/PurchaseSuccessTracker.tsx");
  const app = source("client/src/App.tsx");
  const funnelRouter = source("server/routers/funnelRouter.ts");

  it("loads the configured per-host pixel and keeps PageView tracking", () => {
    expect(pixel).toContain("trpc.siteSettings.getPixelIds.useQuery");
    expect(pixel).toContain("isLearnDomain()");
    expect(pixel).toContain("isIHeartEchoDomain()");
    expect(pixel).toContain("fbq('track', 'PageView')");
    expect(pixel).toContain("function isValidMetaPixelId(pixelId: string)");
    expect(pixel).toContain("/^\\d{5,32}$/.test(pixelId)");
  });

  it("emits a privacy-minimal Purchase only once per verified checkout session", () => {
    expect(pixel).toContain('const PURCHASE_STORAGE_PREFIX = "meta-pixel-purchase:"');
    expect(pixel).toContain("export function trackMetaPurchaseOnce(checkoutSessionId: string)");
    expect(pixel).toContain('window.fbq("track", "Purchase", {})');
    expect(pixel).toContain("window.sessionStorage.getItem(storageKey)");
    expect(pixel).toContain("META_PIXEL_READY_EVENT");
    expect(pixel).not.toContain('value:');
    expect(pixel).not.toContain('currency:');
    expect(pixel).not.toContain('email:');
  });

  it("requires a confirmed payment before tracking standard checkout completion", () => {
    expect(checkoutComplete).toContain('import { trackMetaPurchaseOnce } from "@/components/MetaPixel"');
    expect(checkoutComplete).toContain('data?.status !== "complete" || isPaymentPending');
    expect(checkoutComplete).toContain('data?.paymentStatus !== "paid" && data?.paymentStatus !== "no_payment_required"');
    expect(checkoutComplete).toContain("trackMetaPurchaseOnce(sessionId)");
  });

  it("passes canonical bundle checkout session IDs through a fulfilled bundle return", () => {
    expect(funnelRouter).toContain("?success=1&session_id={CHECKOUT_SESSION_ID}");
    expect(bundleLanding).toContain('params.get("success") === "1" && checkoutSessionId && data?.isEnrolled');
    expect(bundleLanding).toContain("trackMetaPurchaseOnce(checkoutSessionId)");
  });

  it("verifies direct funnel returns before tracking them as a purchase", () => {
    expect(funnelRouter).toContain("purchase=success&product=${encodeURIComponent(productName)}&session_id={CHECKOUT_SESSION_ID}");
    expect(directPurchaseTracker).toContain('params.get("purchase") === "success"');
    expect(directPurchaseTracker).toContain("trpc.lmsLearner.getCheckoutSessionStatus.useQuery");
    expect(directPurchaseTracker).toContain('checkout.data?.status !== "complete"');
    expect(directPurchaseTracker).toContain("trackMetaPurchaseOnce(checkoutSessionId)");
    expect(app).toContain("<PurchaseSuccessTracker />");
  });
});
