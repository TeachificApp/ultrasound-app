import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildNewsletterWelcomeEmail } from "./_core/email";

describe("newsletter opt-in welcome confirmation", () => {
  const routerSource = readFileSync(resolve(import.meta.dirname, "routers/newsletterRouter.ts"), "utf8");
  const fullSignupSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/NewsletterSubscribe.tsx"), "utf8");
  const inlineSignupSource = readFileSync(
    resolve(import.meta.dirname, "../client/src/components/NewsletterInlineWidget.tsx"),
    "utf8",
  );

  it("builds one clear subscription confirmation with safe-sender and unsubscribe guidance", () => {
    const email = buildNewsletterWelcomeEmail({
      firstName: "Jane",
      unsubscribeUrl: "https://learn.allaboutultrasound.com/unsubscribe?nltoken=test-token",
      brandMode: "combined",
    });

    expect(email.subject).toContain("You're in!");
    expect(email.previewText).toContain("safe-sender");
    expect(email.htmlBody).toContain("You're in, Jane!");
    expect(email.htmlBody).toContain("noreply@allaboutultrasound.com");
    expect(email.htmlBody).toContain("safe-sender list");
    expect(email.htmlBody).toContain("nltoken=test-token");
  });

  it("claims delivery once and releases the marker only after a failed provider attempt", () => {
    expect(routerSource).toContain("isNull(newsletterSubscribers.welcomeEmailSentAt)");
    expect(routerSource).toContain("set({ welcomeEmailSentAt: claimedAt })");
    expect(routerSource).toContain("set({ welcomeEmailSentAt: null })");
    expect(routerSource).toContain("buildNewsletterWelcomeEmail");
    expect(routerSource).toContain("listUnsubscribeUrl");
    expect(routerSource).toContain("welcomeEmailSent");
  });

  it("only promises the inbox confirmation after a provider-confirmed send", () => {
    expect(fullSignupSource).toContain("setWelcomeEmailSent(result.welcomeEmailSent)");
    expect(fullSignupSource).toContain("Check your inbox:");
    expect(inlineSignupSource).toContain("setWelcomeEmailSent(result.welcomeEmailSent)");
    expect(inlineSignupSource).toContain("welcome confirmation");
  });
});
