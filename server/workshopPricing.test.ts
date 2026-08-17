import { describe, expect, it } from "vitest";
import { formatWorkshopDollars, resolveWorkshopCheckoutPrice, shouldRouteWorkshopCtaToCheckout, workshopDollarsToCents } from "../shared/workshopPricing";

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
});
