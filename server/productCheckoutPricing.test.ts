import { describe, expect, it } from "vitest";
import { resolveProductCheckoutCents } from "./routers/productsRouter";

describe("digital and physical product checkout pricing", () => {
  it("converts displayed download and physical product dollar amounts once for Stripe", () => {
    expect(resolveProductCheckoutCents("7.00")).toBe(700);
    expect(resolveProductCheckoutCents("97.00")).toBe(9700);
    expect(resolveProductCheckoutCents("299.97")).toBe(29997);
  });
});
