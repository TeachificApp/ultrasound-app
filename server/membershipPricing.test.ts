import { describe, expect, it } from "vitest";
import { dollarsToStripeCents } from "./lib/stripePriceUnits";

describe("membership checkout pricing", () => {
  it("converts a decimal-dollar membership price into Stripe cents", () => {
    expect(dollarsToStripeCents("99.97")).toBe(9997);
    expect(dollarsToStripeCents("2297.00")).toBe(229700);
  });
});
