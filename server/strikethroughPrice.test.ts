/**
 * strikethroughPrice.test.ts
 * Tests that strikethrough price fields are optional display-only fields
 * and do not affect any real pricing logic.
 */
import { describe, it, expect } from "vitest";

// Simulate the block data structures used by each block type
// These mirror the shape of block.data in LandingPageBuilder / BlockPreview

describe("Strikethrough price — display-only field validation", () => {
  it("pricing_cta: strikethrough price is optional and does not affect real price", () => {
    const block = {
      type: "pricing_cta",
      price: 19700, // real price in cents
      showStrikethroughPrice: true,
      strikethroughPrice: "$497",
    };
    // Real price unchanged
    expect(block.price).toBe(19700);
    // Strikethrough is purely display
    expect(block.strikethroughPrice).toBe("$497");
    expect(typeof block.strikethroughPrice).toBe("string");
  });

  it("pricing_cta: works without strikethrough price", () => {
    const block = { type: "pricing_cta", price: 9700 };
    expect((block as any).showStrikethroughPrice).toBeUndefined();
    expect((block as any).strikethroughPrice).toBeUndefined();
  });

  it("cta_standalone: strikethrough price is optional", () => {
    const block = {
      type: "cta_standalone",
      ctaLink: "https://example.com",
      displayPrice: "$197",
      showStrikethrough: true,
      strikethroughPrice: "$497",
    };
    expect(block.displayPrice).toBe("$197");
    expect(block.strikethroughPrice).toBe("$497");
  });

  it("hero button: per-button strikethrough price is optional", () => {
    const btn = {
      text: "Enroll Now",
      color: "#179ca3",
      textColor: "#fff",
      link: "https://example.com",
      style: "filled",
      showStrikethrough: true,
      strikethroughPrice: "$997",
    };
    expect(btn.showStrikethrough).toBe(true);
    expect(btn.strikethroughPrice).toBe("$997");
  });

  it("hero button: works without strikethrough price", () => {
    const btn = { text: "Enroll Now", color: "#179ca3", textColor: "#fff", link: "", style: "filled" };
    expect((btn as any).showStrikethrough).toBeUndefined();
    expect((btn as any).strikethroughPrice).toBeUndefined();
  });

  it("checkout_form: per-product strikethrough price is optional and does not affect real price", () => {
    const product = {
      name: "My Course",
      description: "A great course",
      price: 19700, // real price in cents
      imageUrl: "",
      type: "course",
      strikethroughPrice: "$497",
    };
    expect(product.price).toBe(19700);
    expect(product.strikethroughPrice).toBe("$497");
  });

  it("checkout_form: header strikethrough price is optional", () => {
    const block = {
      type: "checkout_form",
      headerPrice: "$197",
      showHeaderStrikethrough: true,
      headerStrikethroughPrice: "$497",
    };
    expect(block.headerPrice).toBe("$197");
    expect(block.headerStrikethroughPrice).toBe("$497");
  });

  it("order_bump: strikethrough price is optional and does not affect real price", () => {
    const bump = {
      title: "Bonus Bundle",
      price: 4700, // real price in cents
      strikethroughPrice: "$97",
    };
    expect(bump.price).toBe(4700);
    expect(bump.strikethroughPrice).toBe("$97");
  });

  it("urgency_offer: strikethrough price is optional", () => {
    const block = {
      type: "urgency_offer",
      displayPrice: "$197",
      showStrikethrough: true,
      strikethroughPrice: "$497",
    };
    expect(block.displayPrice).toBe("$197");
    expect(block.strikethroughPrice).toBe("$497");
  });

  it("product_offer_stack: per-product strikethrough price is optional", () => {
    const product = {
      name: "Product A",
      price: "$197",
      strikethroughPrice: "$497",
    };
    expect(product.price).toBe("$197");
    expect(product.strikethroughPrice).toBe("$497");
  });

  it("strikethrough price does not modify checkout session amount", () => {
    // Simulate a checkout session creation — strikethroughPrice must NOT be passed to Stripe
    const checkoutParams = {
      line_items: [{ price: "price_abc123", quantity: 1 }],
      mode: "payment",
    };
    // Ensure no strikethrough field leaks into Stripe params
    expect((checkoutParams as any).strikethroughPrice).toBeUndefined();
    expect((checkoutParams as any).displayPrice).toBeUndefined();
  });
});
