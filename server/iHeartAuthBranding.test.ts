import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildPasswordResetEmail, emailWrapper } from "./_core/email";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("iHeartEcho authentication branding", () => {
  it("uses the active domain brand for password reset and setup pages", () => {
    for (const file of [
      "client/src/pages/ForgotPassword.tsx",
      "client/src/pages/ResetPassword.tsx",
    ]) {
      const page = source(file);
      expect(page).toContain('from "@/lib/authPageBrand"');
      expect(page).toContain("getAuthPageBrandName()");
      expect(page).toContain("getAuthPageLogoUrl()");
      expect(page).not.toContain('alt="All About Ultrasound™"');
    }
  });

  it("creates iHeartEcho reset email content with iHeartEcho identity and destination", () => {
    const resetUrl = "https://app.iheartecho.com/reset-password?token=example";
    const email = buildPasswordResetEmail({
      firstName: "Lara",
      resetUrl,
      brandMode: "iheartecho",
      purpose: "welcome",
      expiresInLabel: "7 days",
    });

    expect(email.subject).toContain("iHeartEcho™");
    expect(email.htmlBody).toContain("iHeartEcho™");
    expect(email.htmlBody).toContain(resetUrl);
    expect(email.htmlBody).toContain("www.iheartecho.com");
    expect(emailWrapper("content", "iheartecho")).toContain("https://app.iheartecho.com/terms");
  });

  it("uses the iHeartEcho application origin for iHeartEcho membership welcome links", () => {
    const webhook = source("server/webhooks/stripe.ts");
    const start = webhook.indexOf("export async function handleBrandMembershipCheckoutCompleted");
    const end = webhook.indexOf("export async function handleDualMembershipCheckoutCompleted", start);
    const membershipHandler = webhook.slice(start, end);

    expect(membershipHandler).toContain('const baseUrl = getBrandDisplayConfig(brandMode).appUrl;');
    expect(membershipHandler).toContain('const setPasswordUrl = `${baseUrl}/reset-password?token=${resetToken}`;');
    expect(membershipHandler).not.toContain('const setPasswordUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;');
  });
});
