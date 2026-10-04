import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const landingBuilderSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/admin/LandingPageBuilder.tsx"),
  "utf8"
);

describe("landing hero Stripe checkout configuration", () => {
  it("makes the direct checkout product list searchable, filterable, and sortable", () => {
    expect(landingBuilderSource).toContain("filterAndSortCheckoutProducts");
    expect(landingBuilderSource).toContain("Search Stripe checkout products");
    expect(landingBuilderSource).toContain(
      "Filter Stripe checkout products by type"
    );
    expect(landingBuilderSource).toContain("Sort Stripe checkout products");
    expect(landingBuilderSource).toContain("Name (A–Z)");
    expect(landingBuilderSource).toContain("Product type, then name");
    expect(landingBuilderSource).toContain("Price (low to high)");
  });

  it("binds every selected hero product to its checkout type and ID", () => {
    const heroSettings = landingBuilderSource.slice(
      landingBuilderSource.indexOf('case "hero":'),
      landingBuilderSource.indexOf('case "ai_content":')
    );

    expect(heroSettings).toContain('label="Button Action"');
    expect(heroSettings).toContain(
      "checkoutProductTypeValue={btn.checkoutProductType}"
    );
    expect(heroSettings).toContain(
      "checkoutProductIdValue={btn.checkoutProductId ?? null}"
    );
    expect(heroSettings).toContain("checkoutProductType: type || undefined");
    expect(heroSettings).toContain("checkoutProductId: id ?? undefined");
  });

  it("makes the generated link visible and copyable after selecting a checkout product", () => {
    expect(landingBuilderSource).toContain("Resolved checkout link");
    expect(landingBuilderSource).toContain("Resolved Stripe checkout link");
    expect(landingBuilderSource).toContain("Checkout link copied");
    expect(landingBuilderSource).toContain("The button opens this product’s Stripe checkout flow");
    expect(landingBuilderSource).toContain("available to copy for direct use");
  });
});
