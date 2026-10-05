import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const readProjectFile = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

describe("direct checkout CTA picker", () => {
  it("keeps a product selection as the CTA source of truth instead of overwriting it with a parallel link update", () => {
    const builder = readProjectFile("client/src/pages/admin/LandingPageBuilder.tsx");

    expect(builder).toContain("const resolvedCheckoutLink = selectedCheckoutProduct");
    expect(builder).toContain("onCheckoutProductChange?.(type || \"\", id ? Number(id) : null);");
    expect(builder).toContain("Updating");
    expect(builder).toContain("can overwrite the product");
    expect(builder).not.toContain("onLinkChange?.(checkoutUrl)");
    expect(builder).toContain("onSetMany(patch);");
    expect(builder).toContain("onSetMany={patch => setPricingCard(i, patch)}");
  });

  it("groups canonical and legacy bundles under the single Bundle CTA filter", () => {
    const builder = readProjectFile("client/src/pages/admin/LandingPageBuilder.tsx");

    expect(builder).toContain('return type === "canonical_bundle" ? "bundle" : type;');
    expect(builder).toContain("checkoutProducts.map((product) => checkoutProductTypeFilterKey(product.type))");
    expect(builder).toContain("checkoutProductTypeFilterKey(product.type) !== normalizedProductType");
  });

  it("lists only published paid canonical bundles that can actually open Stripe Checkout", () => {
    const router = readProjectFile("server/routers/funnelRouter.ts");

    expect(router).toContain('where(eq(bundles.status, "published"))');
    expect(router).toContain("firstPaidCanonicalPriceByBundleId");
    expect(router).toContain('option.pricingType !== "free" && priceCents > 0');
    expect(router).toContain('bundle.accessType !== "free"');
  });
});
