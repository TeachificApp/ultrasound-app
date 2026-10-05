import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const readProjectFile = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

describe("bundle landing page editor", () => {
  it("starts new bundle pages with an editable sales-page structure", () => {
    const builder = readProjectFile("client/src/pages/admin/BundleLandingPageBuilder.tsx");

    expect(builder).toContain("createBundleStarterBlocks");
    expect(builder).toContain('type: "hero"');
    expect(builder).toContain('type: "pricing_options_auto"');
    expect(builder).toContain('type: "included_items_auto"');
    expect(builder).toContain('checkoutProductType: "bundle"');
    expect(builder).toContain("setBlocks(createBundleStarterBlocks(bundle))");
    expect(builder).toContain("Bundle Page Settings");
    expect(builder).toContain("Open Bundle Settings");
  });

  it("makes the saved visual page the complete public bundle landing page", () => {
    const publicLanding = readProjectFile("client/src/pages/BundleLanding.tsx");

    expect(publicLanding).toContain("{landingBlocks.length === 0 && <>");
    expect(publicLanding).toContain("A saved visual page controls the entire public bundle URL");
    expect(publicLanding).toContain("BundlePricingOptionsBlock");
    expect(publicLanding).toContain("onCheckoutPage={(pricingOptionId?: number) => runCheckout(bundle.id");
  });

  it("uses current structured bundle pricing rather than stale page-block price data", () => {
    const router = readProjectFile("server/routers/bundleRouter.ts");

    expect(router).toContain("Structured options are authoritative");
    expect(router).toContain("from(bundlePricingOptions)");
    expect(router).toContain("resolveBundleCheckoutDollars(option.price, true)");
    expect(router).toContain("return { bundle, items: enrichedItems, isEnrolled, pricingOptions }");
  });

  it("labels the bundle admin surface as a landing-page editor", () => {
    const admin = readProjectFile("client/src/pages/admin/BundlesAdmin.tsx");

    expect(admin).toContain('value="landing-page"');
    expect(admin).toContain("Bundle Landing Page");
    expect(admin).toContain("Open Landing Page Editor");
    expect(admin).not.toContain("Checkout Page Editor");
  });
});
