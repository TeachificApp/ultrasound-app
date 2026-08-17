import { describe, expect, it } from "vitest";
import { courseDollarsToStripeCents, resolveCourseCheckoutPrice } from "./lib/courseCheckoutPricing";
import { resolveCourseOfferCheckoutCents } from "./routers/lmsRouter";

describe("course subscription pricing", () => {
  it("preserves a displayed $99.97 course subscription and sends 9,997 cents to Stripe", () => {
    expect(resolveCourseCheckoutPrice("99.97")).toEqual({ displayDollars: 99.97, stripeCents: 9997 });
    expect(courseDollarsToStripeCents(99.97)).toBe(9997);
  });

  it("preserves a cohort offer’s displayed dollars and sends its exact Stripe cents", () => {
    const cohortOffer = { courseType: "cohort", displayedPrice: "2297.00" };
    expect(resolveCourseOfferCheckoutCents(cohortOffer.displayedPrice)).toBe(229700);
  });
});
