import { describe, expect, it } from "vitest";
import { courseDollarsToStripeCents, resolveCourseCheckoutPrice } from "./lib/courseCheckoutPricing";

describe("course subscription pricing", () => {
  it("preserves a displayed $99.97 course subscription and sends 9,997 cents to Stripe", () => {
    expect(resolveCourseCheckoutPrice("99.97")).toEqual({ displayDollars: 99.97, stripeCents: 9997 });
    expect(courseDollarsToStripeCents(99.97)).toBe(9997);
  });
});
