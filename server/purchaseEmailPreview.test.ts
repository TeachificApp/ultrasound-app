import { describe, expect, it } from "vitest";
import { renderCurrentPurchaseEmailPreview } from "./lib/purchaseEmailPreview";

describe("purchase email previews", () => {
  it("renders the generic funnel fallback without sending or exposing a token", async () => {
    const preview = await renderCurrentPurchaseEmailPreview({} as any, {
      source: "funnel_fallback",
      contentId: 1,
    });

    expect(preview.contentType).toBe("System fallback");
    expect(preview.subject).toContain("Your purchase is confirmed");
    expect(preview.htmlBody).toContain("Sample Learner");
    expect(preview.htmlBody).not.toContain("token=");
    expect(preview.accessLinkNotice).toContain("safe preview");
  });

  it("renders the correct branded app membership preview without a live token", async () => {
    const preview = await renderCurrentPurchaseEmailPreview({} as any, {
      source: "brand_membership",
      contentId: 3,
    });

    expect(preview.contentTitle).toContain("EchoAssist™");
    expect(preview.htmlBody).toContain("app.iheartecho.com");
    expect(preview.htmlBody).not.toContain("token=");
  });

  it("renders the dual-app membership template for review", async () => {
    const preview = await renderCurrentPurchaseEmailPreview({} as any, {
      source: "dual_membership",
      contentId: 2,
    });

    expect(preview.contentTitle).toContain("All Access Dual Membership");
    expect(preview.htmlBody).toContain("EchoAssist™");
    expect(preview.htmlBody).not.toContain("token=");
  });

  it("renders the free-purchase account setup email without a live reset token", async () => {
    const preview = await renderCurrentPurchaseEmailPreview({} as any, {
      source: "free_purchase_account_setup",
      contentId: 2,
    });

    expect(preview.contentType).toBe("Account setup");
    expect(preview.subject).toContain("set your password");
    expect(preview.htmlBody).toContain("app.iheartecho.net");
    expect(preview.htmlBody).not.toContain("token=");
  });

  it("renders the same team subscription confirmation used by checkout fulfillment", async () => {
    const preview = await renderCurrentPurchaseEmailPreview({} as any, {
      source: "team_subscription",
      contentId: 3,
    });

    expect(preview.contentType).toBe("Team subscription");
    expect(preview.subject).toContain("Team Subscription is active");
    expect(preview.htmlBody).toContain("Sample Organization");
    expect(preview.htmlBody).toContain("10 seats");
    expect(preview.htmlBody).not.toContain("token=");
  });
});
