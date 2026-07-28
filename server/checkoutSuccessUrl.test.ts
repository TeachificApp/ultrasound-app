import { describe, it, expect } from "vitest";

/**
 * Tests for the post-purchase redirect URL construction logic.
 * Mirrors the logic in lmsRouter.ts createCheckout and guestCheckoutRegister.
 */

function buildSuccessUrl(
  origin: string,
  course: { slug: string; postPurchaseRedirectUrl?: string | null; customThankYouEnabled?: boolean },
): string {
  const postPurchasePath = course.postPurchaseRedirectUrl
    ? course.postPurchaseRedirectUrl
    : course.customThankYouEnabled
      ? `/courses/${course.slug}/thank-you`
      : `/my-dashboard?tab=content&enrolled=1`;
  const successUrl = postPurchasePath.startsWith("http")
    ? `${postPurchasePath}${postPurchasePath.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`
    : `${origin}${postPurchasePath}${postPurchasePath.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
  return successUrl;
}

describe("buildSuccessUrl", () => {
  const origin = "https://learn.allaboutultrasound.com";

  it("defaults to /my-dashboard?tab=content&enrolled=1 when no overrides", () => {
    const url = buildSuccessUrl(origin, { slug: "echo-basics" });
    expect(url).toBe(`${origin}/my-dashboard?tab=content&enrolled=1&session_id={CHECKOUT_SESSION_ID}`);
  });

  it("uses customThankYou page when customThankYouEnabled is true", () => {
    const url = buildSuccessUrl(origin, { slug: "echo-basics", customThankYouEnabled: true });
    expect(url).toBe(`${origin}/courses/echo-basics/thank-you?session_id={CHECKOUT_SESSION_ID}`);
  });

  it("uses postPurchaseRedirectUrl when set (relative)", () => {
    const url = buildSuccessUrl(origin, { slug: "echo-basics", postPurchaseRedirectUrl: "/welcome" });
    expect(url).toBe(`${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`);
  });

  it("uses postPurchaseRedirectUrl when set (absolute external URL)", () => {
    const url = buildSuccessUrl(origin, { slug: "echo-basics", postPurchaseRedirectUrl: "https://example.com/thanks" });
    expect(url).toBe("https://example.com/thanks?session_id={CHECKOUT_SESSION_ID}");
  });

  it("postPurchaseRedirectUrl takes priority over customThankYouEnabled", () => {
    const url = buildSuccessUrl(origin, {
      slug: "echo-basics",
      postPurchaseRedirectUrl: "/special-redirect",
      customThankYouEnabled: true,
    });
    expect(url).toBe(`${origin}/special-redirect?session_id={CHECKOUT_SESSION_ID}`);
  });

  it("does NOT produce /courses/:slug/success anymore", () => {
    const url = buildSuccessUrl(origin, { slug: "echo-basics" });
    expect(url).not.toContain("/success");
  });
});
