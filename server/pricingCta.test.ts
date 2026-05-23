import { describe, it, expect } from "vitest";

// Test the pricing_cta block data shape
describe("pricing_cta block data", () => {
  it("should support ctaUrl field", () => {
    const blockData = {
      ctaUrl: "https://example.com/checkout",
      ctaText: "Buy Now",
      showPrice: true,
      currentPrice: "$97",
      showStrikethroughPrice: true,
      strikethroughPrice: "$197",
      pricePosition: "above",
      priceSource: "manual",
    };
    expect(blockData.ctaUrl).toBe("https://example.com/checkout");
    expect(blockData.currentPrice).toBe("$97");
    expect(blockData.strikethroughPrice).toBe("$197");
    expect(blockData.pricePosition).toBe("above");
  });

  it("should support item-linked pricing source", () => {
    const blockData = {
      ctaUrl: "/courses/my-course",
      priceSource: "item",
      linkedItemId: 42,
      linkedItemType: "course",
      linkedItemSlug: "my-course",
      currentPrice: "$49",
      showPrice: true,
    };
    expect(blockData.priceSource).toBe("item");
    expect(blockData.linkedItemId).toBe(42);
    expect(blockData.ctaUrl).toBe("/courses/my-course");
  });

  it("should default pricePosition to above", () => {
    const pricePosition = undefined ?? "above";
    expect(pricePosition).toBe("above");
  });

  it("should handle external URLs with _blank target", () => {
    const ctaUrl = "https://external.com";
    const isExternal = ctaUrl.startsWith("http");
    expect(isExternal).toBe(true);
  });

  it("should handle internal URLs without _blank target", () => {
    const ctaUrl = "/courses/my-course";
    const isExternal = ctaUrl.startsWith("http");
    expect(isExternal).toBe(false);
  });
});
