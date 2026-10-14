import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/email")>();
  return { ...actual, sendEmail: vi.fn().mockResolvedValue(true) };
});

import { buildFunnelPurchaseConfirmationEmail, buildTransactionalEmailCta, sendEmail } from "./_core/email";
import { sendEnrollmentEmail } from "./lib/enrollmentEmail";

describe("purchaser access email CTA", () => {
  const accessUrl = "https://learn.allaboutultrasound.com/api/auth/auto-login?token=test-token";

  beforeEach(() => vi.clearAllMocks());

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

  it("uses the same visible CTA and direct-link fallback in the actual enrollment email workflow", async () => {
    const sent = await sendEnrollmentEmail({
      to: { name: "Jennifer Olsen", email: "jennifer@example.com" },
      courseTitle: "Sonography Ergonomics",
      courseSlug: "sonography-ergonomics",
      accessToken: "access-token",
    });
    expect(sent).toBe(true);
    const payload = vi.mocked(sendEmail).mock.calls[0]?.[0];
    const courseUrl = "https://learn.allaboutultrasound.com/auth/access?token=access-token&next=https%3A%2F%2Flearn.allaboutultrasound.com%2Fcourses%2Fsonography-ergonomics%2Fplayer";
    expect(payload?.htmlBody).toContain('bgcolor="#0d9488"');
    expect(payload?.htmlBody).toContain(`href="${courseUrl}"`);
    expect(payload?.htmlBody).toContain("If the button is not visible or does not work");
  });
});
