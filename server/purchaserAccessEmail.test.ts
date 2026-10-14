import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/email")>();
  return { ...actual, sendEmail: vi.fn().mockResolvedValue(true) };
});

vi.mock("./lib/ensureTransactionalEmailDelivery", () => ({
  ensureTransactionalEmailDelivery: vi.fn().mockResolvedValue(undefined),
}));

import { buildFunnelPurchaseConfirmationEmail, buildTransactionalEmailCta, sendEmail } from "./_core/email";
import { sendEnrollmentEmail, sendPurchaseAccessEmail } from "./lib/enrollmentEmail";

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
    const payload = vi.mocked(sendEmail).mock.calls.at(-1)?.[0];
    const courseUrl = "https://learn.allaboutultrasound.com/auth/access?token=access-token&next=https%3A%2F%2Flearn.allaboutultrasound.com%2Fcourses%2Fsonography-ergonomics%2Fplayer";
    expect(payload?.htmlBody).toContain('bgcolor="#0d9488"');
    expect(payload?.htmlBody).toContain(`href="${courseUrl}"`);
    expect(payload?.htmlBody).toContain("If the button is not visible or does not work");
  });

  it("keeps iHeartEcho course access and combined Learn email identity on the iHeartEcho domain", async () => {
    const sent = await sendEnrollmentEmail({
      to: { name: "Echo Learner", email: "learner@example.com" },
      courseTitle: "Advanced Echocardiography",
      courseSlug: "advanced-echocardiography",
      accessToken: "echo-access-token",
      brand: "iheartecho",
    });
    expect(sent).toBe(true);
    const payload = vi.mocked(sendEmail).mock.calls.at(-1)?.[0];
    expect(payload?.brandMode).toBe("combined");
    expect(payload?.htmlBody).toContain("learn.iheartecho.com/auth/access?token=echo-access-token");
    expect(payload?.htmlBody).toContain("learn.iheartecho.com%2Fcourses%2Fadvanced-echocardiography%2Fplayer");
    expect(payload?.htmlBody).not.toContain("learn.allaboutultrasound.com%2Fcourses%2Fadvanced-echocardiography");
  });

  it("creates a branded generic confirmation with an auto-login CTA", async () => {
    const sent = await sendPurchaseAccessEmail({
      to: { name: "Workshop Learner", email: "learner@example.com" },
      subject: "Workshop confirmed",
      heading: "Your workshop registration is confirmed",
      intro: "your registration is complete.",
      accessLabel: "View Workshop Details",
      destinationUrl: "https://learn.iheartecho.com/workshops/echo-basics",
      accessToken: "workshop-token",
      brand: "iheartecho",
      brandMode: "combined",
    });
    expect(sent).toBe(true);
    const payload = vi.mocked(sendEmail).mock.calls.at(-1)?.[0];
    expect(payload?.brandMode).toBe("combined");
    expect(payload?.htmlBody).toContain("View Workshop Details");
    expect(payload?.htmlBody).toContain("learn.iheartecho.com/auth/access?token=workshop-token");
  });
});
