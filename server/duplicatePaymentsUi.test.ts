import { describe, it, expect } from "vitest";
import { CHECKOUT_CLICK_GUARD_MS } from "../client/src/hooks/useCheckoutClickGuard";

describe("useCheckoutClickGuard", () => {
  it("exports 5 second default cooldown", () => {
    expect(CHECKOUT_CLICK_GUARD_MS).toBe(5000);
  });
});

describe("accessCta labels", () => {
  it("uses Resume for subscriptions and Access for purchases", async () => {
    const { SUBSCRIPTION_RESUME_LABEL, PURCHASE_ACCESS_LABEL } = await import("../client/src/lib/accessCta");
    expect(SUBSCRIPTION_RESUME_LABEL).toBe("Resume");
    expect(PURCHASE_ACCESS_LABEL).toBe("Access");
  });
});
