import { describe, expect, it } from "vitest";
import { resolveBundleCheckoutDollars } from "./routers/bundleRouter";
import { dollarsToStripeCents } from "./lib/stripePriceUnits";

describe("bundle checkout pricing", () => {
  it("converts a structured cents value into displayed dollars and returns the same cents to Stripe", () => {
    const displayDollars = resolveBundleCheckoutDollars(19997, true);
    expect(displayDollars).toBe(199.97);
    expect(dollarsToStripeCents(displayDollars)).toBe(19997);
  });

  it("keeps a legacy bundle option expressed in dollars intact before Stripe conversion", () => {
    const displayDollars = resolveBundleCheckoutDollars(99.97, false);
    expect(displayDollars).toBe(99.97);
    expect(dollarsToStripeCents(displayDollars)).toBe(9997);
  });
});
