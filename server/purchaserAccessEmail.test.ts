import { describe, expect, it } from "vitest";
import { buildFunnelPurchaseConfirmationEmail, buildTransactionalEmailCta } from "./_core/email";

describe("purchaser access email CTA", () => {
  const accessUrl = "https://learn.allaboutultrasound.com/api/auth/auto-login?token=test-token";

  it("uses Gmail-safe solid button markup with an explicit href", () => {
    const html = buildTransactionalEmailCta({ href: accessUrl, label: "Access Your Purchase", color: "#189aa1" });
    expect(html).toContain('bgcolor="#189aa1"');
    expect(html).toContain("background-color:#189aa1");
    expect(html).toContain(`href="${accessUrl}"`);
    expect(html).toContain("Access Your Purchase");
    expect(html).not.toContain("linear-gradient");
  });

  it("renders both a visible CTA and an accessible direct-link fallback in the purchaser confirmation", () => {
    const email = buildFunnelPurchaseConfirmationEmail({
      firstName: "Jennifer",
      productName: "Echocardiography Review",
      amountPaid: 229700,
      loginUrl: accessUrl,
      brandMode: "aaus",
    });
    expect(email.htmlBody).toContain(`href="${accessUrl}"`);
    expect(email.htmlBody).toContain('bgcolor="#189aa1"');
    expect(email.htmlBody).toContain("If the button is not visible or does not work");
    expect((email.htmlBody.match(new RegExp(accessUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
