import { describe, expect, it } from "vitest";
import {
  isStripePromotionCodeConflict,
  normalizePromotionCode,
  promotionCodeConflictMessage,
} from "./lib/couponAdmin";

describe("coupon administration promotion-code safety", () => {
  it("normalizes visible promo codes before all Stripe operations", () => {
    expect(normalizePromotionCode(" summer20 ")).toBe("SUMMER20");
    expect(normalizePromotionCode("  ")).toBeNull();
    expect(normalizePromotionCode(undefined)).toBeNull();
  });

  it("identifies Stripe duplicate-code errors without classifying other failures as duplicates", () => {
    expect(isStripePromotionCodeConflict({ code: "resource_already_exists" })).toBe(true);
    expect(isStripePromotionCodeConflict({ type: "invalid_request_error", message: "A promotion code already exists." })).toBe(true);
    expect(isStripePromotionCodeConflict({ code: "api_connection_error", message: "Connection timed out" })).toBe(false);
  });

  it("gives administrators an actionable duplicate-code message", () => {
    expect(promotionCodeConflictMessage("MUAM2026")).toContain("MUAM2026");
    expect(promotionCodeConflictMessage("MUAM2026")).toContain("already exists and is active");
  });
});
