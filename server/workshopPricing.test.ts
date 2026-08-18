import { describe, expect, it } from "vitest";
import { buildWorkshopCheckoutIdempotencyKey, formatWorkshopDollars, resolveWorkshopCheckoutPrice, shouldRouteWorkshopCtaToCheckout, workshopDollarsToCents } from "../shared/workshopPricing";
import { isScheduledDeadlineOpen, scheduledWallTimeToUtc } from "../shared/platformTime";

describe("workshop dollar pricing", () => {
  it("converts a $2,297.00 workshop price to Stripe cents without multiplying display values", () => {
    expect(workshopDollarsToCents(2297)).toBe(229700);
    expect(formatWorkshopDollars("2297.00")).toBe("$2,297.00");
  });

  it("routes generic workshop purchase CTAs to the next active workshop checkout", () => {
    expect(shouldRouteWorkshopCtaToCheckout("scroll_to_section", "Save My Seat")).toBe(true);
    expect(shouldRouteWorkshopCtaToCheckout("direct_checkout", "Anything")).toBe(true);
    expect(shouldRouteWorkshopCtaToCheckout("scroll_to_section", "View dates")).toBe(false);
  });

  it("uses the instance override as dollars for display and cents only in the Stripe payload", () => {
    expect(resolveWorkshopCheckoutPrice("1297.00", "2297.00")).toEqual({ displayDollars: "1297.00", stripeCents: 129700 });
  });

  it("changes the Stripe idempotency key when a corrected workshop price changes request parameters", () => {
    const original = buildWorkshopCheckoutIdempotencyKey({ userId: 42, workshopId: 60001, instanceId: 1, priceInCents: 229700, currency: "usd" });
    const corrected = buildWorkshopCheckoutIdempotencyKey({ userId: 42, workshopId: 60001, instanceId: 1, priceInCents: 229700, currency: "usd" });
    const legacyPrice = buildWorkshopCheckoutIdempotencyKey({ userId: 42, workshopId: 60001, instanceId: 1, priceInCents: 22970000, currency: "usd" });
    expect(corrected).toBe(original);
    expect(corrected).not.toBe(legacyPrice);
  });
});

describe("workshop Eastern sales deadlines", () => {
  it("keeps a configured 11:59 PM Eastern deadline open until 03:59:00 UTC", () => {
    const configuredWallTime = new Date("2026-08-17T23:59:00.000Z");
    expect(scheduledWallTimeToUtc(configuredWallTime, "America/New_York").toISOString()).toBe("2026-08-18T03:59:00.000Z");
    expect(isScheduledDeadlineOpen(configuredWallTime, "America/New_York", new Date("2026-08-18T00:41:16.000Z"))).toBe(true);
    expect(isScheduledDeadlineOpen(configuredWallTime, "America/New_York", new Date("2026-08-18T04:00:00.000Z"))).toBe(false);
  });
});
