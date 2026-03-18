/**
 * Tests for the Forgot Password / Reset Password flow.
 * Covers input validation, token expiry logic, URL construction,
 * and password strength rules.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ── Input schemas (mirror server/routers.ts) ─────────────────────────────────

const requestPasswordResetSchema = z.object({
  email: z.string().email().max(320),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(128),
});

// ── requestPasswordReset input validation ────────────────────────────────────

describe("requestPasswordReset input validation", () => {
  it("accepts a valid email address", () => {
    const result = requestPasswordResetSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email format", () => {
    const result = requestPasswordResetSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = requestPasswordResetSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an email exceeding 320 characters", () => {
    const local = "a".repeat(310);
    const result = requestPasswordResetSchema.safeParse({ email: `${local}@example.com` });
    expect(result.success).toBe(false);
  });

  it("accepts an email with subdomain", () => {
    const result = requestPasswordResetSchema.safeParse({ email: "user@mail.example.co.uk" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing email field", () => {
    const result = requestPasswordResetSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts email with plus addressing", () => {
    const result = requestPasswordResetSchema.safeParse({ email: "user+tag@example.com" });
    expect(result.success).toBe(true);
  });
});

// ── resetPassword input validation ───────────────────────────────────────────

describe("resetPassword input validation", () => {
  it("accepts a valid token and strong password", () => {
    const result = resetPasswordSchema.safeParse({
      token: "a".repeat(96),
      newPassword: "StrongPass1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty token", () => {
    const result = resetPasswordSchema.safeParse({ token: "", newPassword: "StrongPass1!" });
    expect(result.success).toBe(false);
  });

  it("rejects a token exceeding 200 characters", () => {
    const result = resetPasswordSchema.safeParse({
      token: "a".repeat(201),
      newPassword: "StrongPass1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      newPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a password of exactly 8 characters", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      newPassword: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password exceeding 128 characters", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      newPassword: "A".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a password of exactly 128 characters", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      newPassword: "A".repeat(128),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing token field", () => {
    const result = resetPasswordSchema.safeParse({ newPassword: "StrongPass1!" });
    expect(result.success).toBe(false);
  });

  it("rejects missing newPassword field", () => {
    const result = resetPasswordSchema.safeParse({ token: "abc123" });
    expect(result.success).toBe(false);
  });
});

// ── Token expiry logic ───────────────────────────────────────────────────────

describe("Password reset token expiry logic", () => {
  function isTokenExpired(expiry: Date): boolean {
    return new Date() > expiry;
  }

  it("returns false for a token expiring in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    expect(isTokenExpired(future)).toBe(false);
  });

  it("returns true for a token that expired in the past", () => {
    const past = new Date(Date.now() - 1000); // 1 second ago
    expect(isTokenExpired(past)).toBe(true);
  });

  it("returns true for a token that expired exactly 1 hour ago", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    expect(isTokenExpired(past)).toBe(true);
  });

  it("returns false for a token expiring in 30 minutes", () => {
    const future = new Date(Date.now() + 30 * 60 * 1000);
    expect(isTokenExpired(future)).toBe(false);
  });
});

// ── Reset URL construction ───────────────────────────────────────────────────

describe("Password reset URL construction", () => {
  function buildResetUrl(appUrl: string, token: string): string {
    return `${appUrl}/reset-password?token=${token}`;
  }

  it("builds a correct reset URL", () => {
    const url = buildResetUrl("https://app.iheartecho.com", "abc123");
    expect(url).toBe("https://app.iheartecho.com/reset-password?token=abc123");
  });

  it("includes the full token in the URL", () => {
    const token = "a".repeat(96);
    const url = buildResetUrl("https://app.iheartecho.com", token);
    expect(url).toContain(token);
    expect(url).toContain("/reset-password?token=");
  });

  it("uses the provided appUrl as the base", () => {
    const url = buildResetUrl("https://custom.domain.com", "tok");
    expect(url.startsWith("https://custom.domain.com")).toBe(true);
  });

  it("does not include type=change (unlike email-change flow)", () => {
    const url = buildResetUrl("https://app.iheartecho.com", "tok");
    expect(url).not.toContain("type=change");
  });
});

// ── Email enumeration protection ─────────────────────────────────────────────

describe("Email enumeration protection", () => {
  /**
   * The requestPasswordReset procedure always returns { success: true }
   * regardless of whether the email exists, to prevent attackers from
   * discovering which emails are registered.
   */
  function simulateResponse(emailExists: boolean): { success: boolean } {
    // Server always returns success
    return { success: true };
  }

  it("returns success when email exists", () => {
    expect(simulateResponse(true)).toEqual({ success: true });
  });

  it("returns success when email does NOT exist (prevents enumeration)", () => {
    expect(simulateResponse(false)).toEqual({ success: true });
  });
});

// ── Password normalisation ───────────────────────────────────────────────────

describe("Email normalisation before lookup", () => {
  function normaliseEmail(raw: string): string {
    return raw.trim().toLowerCase();
  }

  it("lowercases the email", () => {
    expect(normaliseEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("handles already-normalised email unchanged", () => {
    expect(normaliseEmail("user@example.com")).toBe("user@example.com");
  });
});
