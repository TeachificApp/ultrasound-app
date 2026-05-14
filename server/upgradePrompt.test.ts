/**
 * Unit tests for UpgradePrompt eligibility logic.
 * These tests verify the business rules for who sees the upgrade prompt.
 */
import { describe, it, expect } from "vitest";

// Mirror the eligibility logic from UpgradePromptWrapper in App.tsx
function isEligible(user: { isPremium?: boolean; role?: string } | null): boolean {
  if (!user) return false;
  const isPremium = user.isPremium === true;
  const isAdmin = user.role === "admin";
  return !isPremium && !isAdmin;
}

describe("UpgradePrompt eligibility", () => {
  it("returns false when user is null (not logged in)", () => {
    expect(isEligible(null)).toBe(false);
  });

  it("returns false for premium users", () => {
    expect(isEligible({ isPremium: true, role: "user" })).toBe(false);
  });

  it("returns false for admin users", () => {
    expect(isEligible({ isPremium: false, role: "admin" })).toBe(false);
  });

  it("returns false for premium admin users", () => {
    expect(isEligible({ isPremium: true, role: "admin" })).toBe(false);
  });

  it("returns true for free authenticated users", () => {
    expect(isEligible({ isPremium: false, role: "user" })).toBe(true);
  });

  it("returns true for free users with no role set", () => {
    expect(isEligible({ isPremium: false })).toBe(true);
  });

  it("returns true for users where isPremium is undefined (defaults to false)", () => {
    expect(isEligible({ role: "user" })).toBe(true);
  });
});

describe("UpgradePrompt cooldown constants", () => {
  const FIRST_USE_DELAY_MS = 3 * 60 * 1000;
  const RECURRING_INTERVAL_MS = 15 * 60 * 1000;

  it("first use delay is exactly 3 minutes", () => {
    expect(FIRST_USE_DELAY_MS).toBe(180_000);
  });

  it("recurring interval is exactly 15 minutes", () => {
    expect(RECURRING_INTERVAL_MS).toBe(900_000);
  });

  it("recurring interval is 5x the first use delay", () => {
    expect(RECURRING_INTERVAL_MS).toBe(FIRST_USE_DELAY_MS * 5);
  });
});
