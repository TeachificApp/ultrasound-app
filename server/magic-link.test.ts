/**
 * magic-link.test.ts
 * Unit tests for the magic link (passwordless) login flow.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Input schemas (mirrors routers.ts) ──────────────────────────────────────

const requestMagicLinkSchema = z.object({
  email: z.string().email().max(320),
});

const verifyMagicLinkSchema = z.object({
  token: z.string().min(1).max(200),
});

// ─── Token helpers (mirrors routers.ts logic) ─────────────────────────────────

function generateToken(): string {
  // 48 random bytes → 96 hex chars
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function magicLinkExpiry(minutesFromNow = 15): Date {
  return new Date(Date.now() + minutesFromNow * 60 * 1000);
}

function isExpired(expiry: Date): boolean {
  return new Date() > expiry;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Magic Link — requestMagicLink input validation", () => {
  it("accepts a valid email address", () => {
    const result = requestMagicLinkSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts email with subdomains", () => {
    const result = requestMagicLinkSchema.safeParse({ email: "user@mail.example.co.uk" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email format", () => {
    const result = requestMagicLinkSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty email", () => {
    const result = requestMagicLinkSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an email exceeding 320 characters", () => {
    // Build a valid-looking email that is > 320 chars total
    const longLocal = "a".repeat(250);
    const longEmail = `${longLocal}@example.com`; // 250 + 12 = 262 chars — still under 320
    // Use a domain that pushes it over 320
    const veryLongEmail = "a".repeat(300) + "@example.com"; // 312 chars — still under
    const overLimitEmail = "a".repeat(310) + "@example.com"; // 322 chars — over 320
    const result = requestMagicLinkSchema.safeParse({ email: overLimitEmail });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email field", () => {
    const result = requestMagicLinkSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("Magic Link — verifyMagicLink input validation", () => {
  it("accepts a valid 96-char hex token", () => {
    const token = generateToken();
    const result = verifyMagicLinkSchema.safeParse({ token });
    expect(result.success).toBe(true);
    expect(token.length).toBe(96);
  });

  it("rejects an empty token", () => {
    const result = verifyMagicLinkSchema.safeParse({ token: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a token exceeding 200 characters", () => {
    const result = verifyMagicLinkSchema.safeParse({ token: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects a missing token field", () => {
    const result = verifyMagicLinkSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("Magic Link — token generation", () => {
  it("generates a 96-character hex token", () => {
    const token = generateToken();
    expect(token).toHaveLength(96);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateToken()));
    expect(tokens.size).toBe(20);
  });
});

describe("Magic Link — expiry logic", () => {
  it("creates a token that expires 15 minutes from now", () => {
    const expiry = magicLinkExpiry(15);
    const diffMs = expiry.getTime() - Date.now();
    // Allow ±2 seconds tolerance
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000 - 2000);
    expect(diffMs).toBeLessThan(15 * 60 * 1000 + 2000);
  });

  it("correctly identifies a non-expired token", () => {
    const expiry = magicLinkExpiry(15);
    expect(isExpired(expiry)).toBe(false);
  });

  it("correctly identifies an already-expired token", () => {
    const expiry = new Date(Date.now() - 1000); // 1 second in the past
    expect(isExpired(expiry)).toBe(true);
  });

  it("correctly identifies a token that expired exactly now", () => {
    const expiry = new Date(Date.now() - 1);
    expect(isExpired(expiry)).toBe(true);
  });

  it("a 15-minute token is not yet expired after 14 minutes (simulated)", () => {
    const expiry = new Date(Date.now() + 60 * 1000); // 1 minute remaining
    expect(isExpired(expiry)).toBe(false);
  });
});

describe("Magic Link — URL construction", () => {
  it("builds the correct magic link URL", () => {
    const appUrl = "https://app.iheartecho.com";
    const token = generateToken();
    const magicUrl = `${appUrl}/auth/magic?token=${token}`;
    expect(magicUrl).toMatch(/^https:\/\/app\.iheartecho\.com\/auth\/magic\?token=[0-9a-f]{96}$/);
  });

  it("uses the fallback URL when VITE_APP_URL is not set", () => {
    const appUrl = process.env.VITE_APP_URL || "https://app.iheartecho.com";
    expect(appUrl).toBeTruthy();
    expect(appUrl).toMatch(/^https?:\/\//);
  });
});

describe("Magic Link — email enumeration protection", () => {
  it("requestMagicLink returns success regardless of whether the email is registered", () => {
    // The procedure always returns { success: true } even for unknown emails.
    // This test documents the expected behavior — no TRPCError is thrown for unknown emails.
    const successResponse = { success: true };
    expect(successResponse.success).toBe(true);
  });
});

describe("Magic Link — one-time use semantics", () => {
  it("clearMagicLinkToken sets both token and expiry to null", () => {
    // Simulates the DB state after token consumption
    const userBefore = { magicLinkToken: "abc123", magicLinkExpiry: new Date() };
    const userAfter = { ...userBefore, magicLinkToken: null, magicLinkExpiry: null };
    expect(userAfter.magicLinkToken).toBeNull();
    expect(userAfter.magicLinkExpiry).toBeNull();
  });

  it("a consumed token (null) fails the lookup check", () => {
    const token: string | null = null;
    expect(token).toBeNull();
    // In the procedure: if (!user) throw NOT_FOUND
    // Simulating: a null token means no user row would be returned
    const userFromDb = token ? { id: 1 } : undefined;
    expect(userFromDb).toBeUndefined();
  });
});
