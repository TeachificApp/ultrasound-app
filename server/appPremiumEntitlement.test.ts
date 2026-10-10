import { describe, expect, it } from "vitest";
import {
  hasExplicitBrandPremium,
  resolveAppPremiumFromMemberships,
  type AppMembershipSnapshot,
} from "./lib/appPremiumEntitlement";

const NOW = new Date("2026-10-10T12:00:00.000Z");

function membership(overrides: Partial<AppMembershipSnapshot>): AppMembershipSnapshot {
  return {
    brand: "aaus",
    tier: "free",
    status: "active",
    expiresAt: null,
    ...overrides,
  };
}

describe("brand-scoped app Premium entitlement", () => {
  it("keeps an iHeartEcho-only Premium subscription out of the AAUS app", () => {
    const memberships = [
      membership({ brand: "iheartecho", tier: "premium", expiresAt: "2026-10-13T16:59:18.000Z" }),
      membership({ brand: "aaus", tier: "free" }),
    ];

    expect(resolveAppPremiumFromMemberships({ brand: "iheartecho", memberships, legacyIsPremium: true, now: NOW })).toBe(true);
    expect(resolveAppPremiumFromMemberships({ brand: "aaus", memberships, legacyIsPremium: true, now: NOW })).toBe(false);
  });

  it("unlocks both apps only when each brand has an active paid entitlement", () => {
    const memberships = [
      membership({ brand: "aaus", tier: "premium" }),
      membership({ brand: "iheartecho", tier: "premium" }),
    ];

    expect(resolveAppPremiumFromMemberships({ brand: "aaus", memberships, legacyIsPremium: false, now: NOW })).toBe(true);
    expect(resolveAppPremiumFromMemberships({ brand: "iheartecho", memberships, legacyIsPremium: false, now: NOW })).toBe(true);
  });

  it("does not honor an expired or cancelled subscription", () => {
    const expired = [membership({ brand: "aaus", tier: "premium", expiresAt: "2026-10-09T12:00:00.000Z" })];
    const cancelled = [membership({ brand: "aaus", tier: "premium", status: "cancelled" })];

    expect(resolveAppPremiumFromMemberships({ brand: "aaus", memberships: expired, legacyIsPremium: true, now: NOW })).toBe(false);
    expect(resolveAppPremiumFromMemberships({ brand: "aaus", memberships: cancelled, legacyIsPremium: true, now: NOW })).toBe(false);
  });

  it("keeps a legacy global Premium flag scoped to the original AAUS app", () => {
    expect(resolveAppPremiumFromMemberships({ brand: "aaus", memberships: [], legacyIsPremium: true, now: NOW })).toBe(true);
    expect(resolveAppPremiumFromMemberships({ brand: "iheartecho", memberships: [], legacyIsPremium: true, now: NOW })).toBe(false);
    expect(resolveAppPremiumFromMemberships({ brand: "aaus", memberships: [membership()], legacyIsPremium: true, now: NOW })).toBe(true);
  });

  it("reports the direct per-brand paid state separately", () => {
    const memberships = [membership({ brand: "iheartecho", tier: "premium" })];
    expect(hasExplicitBrandPremium({ brand: "iheartecho", memberships, now: NOW })).toBe(true);
    expect(hasExplicitBrandPremium({ brand: "aaus", memberships, now: NOW })).toBe(false);
  });
});
