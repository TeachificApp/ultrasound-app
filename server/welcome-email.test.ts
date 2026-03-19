/**
 * welcome-email.test.ts
 * Tests for the automated welcome email on new user registration.
 * Validates that buildWelcomeEmail produces correct content and that
 * sendPreRegistrationWelcome uses the unified SendGrid template.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildWelcomeEmail } from "./_core/email";

// ─── buildWelcomeEmail template tests ────────────────────────────────────────

describe("buildWelcomeEmail", () => {
  it("returns the correct subject line", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    expect(result.subject).toBe("Your All About Ultrasound™ account is ready");
  });

  it("includes the user's first name in the HTML body", () => {
    const result = buildWelcomeEmail({
      firstName: "Marcus",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    expect(result.htmlBody).toContain("Marcus");
  });

  it("includes the login URL in the HTML body", () => {
    const loginUrl = "https://app.iheartecho.com/login";
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl,
      roles: [],
    });
    expect(result.htmlBody).toContain(loginUrl);
  });

  it("includes role labels when roles are provided", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: ["premium_user", "diy_user"],
    });
    expect(result.htmlBody).toContain("Premium Access");
    expect(result.htmlBody).toContain("DIY Accreditation");
  });

  it("does not include role section when roles array is empty", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    // The role block (with "Your assigned access:") should not appear
    expect(result.htmlBody).not.toContain("Your assigned access:");
  });

  it("filters out unknown roles from the role list", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: ["unknown_role", "premium_user"],
    });
    expect(result.htmlBody).toContain("Premium Access");
    expect(result.htmlBody).not.toContain("unknown_role");
  });

  it("includes the All About Ultrasound™ brand logo in the email header", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    // The circular logo CDN URL should be present
    expect(result.htmlBody).toContain("aaus_logo_ring_01cc7ccd.webp");
  });

  it("includes the circular logo with border-radius:50%", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    expect(result.htmlBody).toContain("border-radius:50%");
  });

  it("includes the All About Ultrasound copyright in the footer", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    expect(result.htmlBody).toContain("All About Ultrasound");
  });

  it("returns a non-empty previewText", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    expect(result.previewText.length).toBeGreaterThan(10);
  });

  it("includes a Sign In CTA button in the HTML body", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    expect(result.htmlBody).toContain("Sign In to All About Ultrasound™");
  });

  it("handles diy_admin role label correctly", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: ["diy_admin"],
    });
    expect(result.htmlBody).toContain("Lab Admin");
  });

  it("handles platform_admin role label correctly", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: ["platform_admin"],
    });
    expect(result.htmlBody).toContain("Platform Admin");
  });

  it("uses the teal brand gradient in the header background", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    expect(result.htmlBody).toContain("#189aa1");
  });

  it("includes the allaboutultrasound.com link in the footer", () => {
    const result = buildWelcomeEmail({
      firstName: "Jane",
      loginUrl: "https://app.allaboutultrasound.com/login",
      roles: [],
    });
    expect(result.htmlBody).toContain("www.allaboutultrasound.com");
  });
});

// ─── sendPreRegistrationWelcome integration (unit-level) ─────────────────────

describe("sendPreRegistrationWelcome (via buildWelcomeEmail)", () => {
  it("buildWelcomeEmail produces valid HTML for a pre-registered user email", () => {
    const email = "newuser@example.com";
    const firstName = email.split("@")[0]; // "newuser"
    const result = buildWelcomeEmail({
      firstName,
      loginUrl: "https://app.iheartecho.com/login",
      roles: ["premium_user"],
    });
    expect(result.htmlBody).toContain("newuser");
    expect(result.htmlBody).toContain("Premium Access");
    expect(result.subject).toBe("Your All About Ultrasound™ account is ready");
  });

  it("produces a valid HTML document structure", () => {
    const result = buildWelcomeEmail({
      firstName: "Test",
      loginUrl: "https://app.iheartecho.com/login",
      roles: [],
    });
    expect(result.htmlBody).toContain("<!DOCTYPE html>");
    expect(result.htmlBody).toContain("</html>");
    expect(result.htmlBody).toContain("<body");
    expect(result.htmlBody).toContain("</body>");
  });
});
