import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const courseLanding = source("client/src/pages/CourseLanding.tsx");
const lmsRouter = source("server/routers/lmsRouter.ts");
const checkoutComplete = source("client/src/pages/CheckoutComplete.tsx");

describe("guest checkout identity and post-payment access", () => {
  it("keeps new buyer checkout available without a pre-existing account", () => {
    expect(lmsRouter).toContain("guestCheckoutRegister: publicProcedure");
    expect(courseLanding).toContain("No account setup is required before payment.");
    expect(courseLanding).toContain("Continue to Checkout");
  });

  it("collects the intended email before opening Stripe rather than relying on Apple Pay relay data", () => {
    const guestCtaWindow = courseLanding.slice(
      courseLanding.indexOf("const handleEnroll = async"),
      courseLanding.indexOf("// Auto-trigger checkout"),
    );
    expect(guestCtaWindow).toContain("openGuestCheckoutModal(selectedPricingOptionId)");
    expect(guestCtaWindow).toContain("openGuestCheckoutModal(pricingOptionId)");
    expect(guestCtaWindow).not.toContain("handleGoToCheckoutPage(selectedPricingOptionId)");
    expect(lmsRouter).toContain("customer_email: input.email");
    expect(courseLanding).toContain("Apple Pay uses a private relay address");
  });

  it("honors configured post-purchase workflows and otherwise returns buyers to Learn sign-in", () => {
    expect(lmsRouter).toContain("course.postPurchaseRedirectUrl");
    expect(lmsRouter).toContain("course.customThankYouEnabled");
    expect(lmsRouter).toContain('`/login?returnTo=${encodeURIComponent("/my-dashboard?tab=content&enrolled=1")}`');
    expect(checkoutComplete).toContain("window.location.assign(getLoginUrl(returnTo))");
    expect(checkoutComplete).toContain("window.location.assign(getLoginUrl(dest))");
  });
});
