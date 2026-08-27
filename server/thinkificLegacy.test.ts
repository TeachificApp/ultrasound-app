import { describe, expect, it } from "vitest";
import {
  THINKIFIC_LEGACY_BILLING_LABEL,
  THINKIFIC_LEGACY_BILLING_URL,
  isActiveThinkificMembership,
} from "../shared/thinkificLegacy";

describe("thinkificLegacy", () => {
  it("uses member billing URL and legacy label", () => {
    expect(THINKIFIC_LEGACY_BILLING_URL).toBe("https://member.allaboutultrasound.com/account/billing");
    expect(THINKIFIC_LEGACY_BILLING_LABEL).toBe("Manage Legacy Billing");
  });

  it("identifies only active non-expired Thinkific memberships", () => {
    expect(isActiveThinkificMembership({ source: "thinkific", status: "active" })).toBe(true);
    expect(isActiveThinkificMembership({ source: "thinkific", status: "cancelled" })).toBe(false);
    expect(isActiveThinkificMembership({ source: "stripe", status: "active" })).toBe(false);
    expect(isActiveThinkificMembership({
      source: "thinkific",
      status: "active",
      expiresAt: new Date(Date.now() + 86400000),
    })).toBe(true);
    expect(isActiveThinkificMembership({
      source: "thinkific",
      status: "active",
      expiresAt: new Date(Date.now() - 86400000),
    })).toBe(false);
  });
});
