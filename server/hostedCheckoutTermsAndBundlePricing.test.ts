import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const readProjectFile = (path: string) =>
  readFileSync(resolve(projectRoot, path), "utf8");

describe("hosted checkout terms and bundle pricing", () => {
  it("requires Stripe terms consent for every hosted consumer checkout path", () => {
    const helper = readProjectFile("server/routers/checkoutTermsHelper.ts");
    const hostedRouters = [
      "server/routers/lmsRouter.ts",
      "server/routers/bundleRouter.ts",
      "server/routers/funnelRouter.ts",
      "server/routers/downloadsRouter.ts",
      "server/routers/productsRouter.ts",
      "server/routers/membershipRouter.ts",
      "server/routers/brandMembershipRouter.ts",
      "server/routers/workshopRouter.ts",
    ].map(readProjectFile);

    expect(helper).toContain('terms_of_service: "required"');
    hostedRouters.forEach(source => {
      expect(source).toContain("STANDARD_STRIPE_CHECKOUT_TERMS_CONSENT");
    });
  });

  it("uses active structured bundle pricing for library cards and reserves Free for free access", () => {
    const router = readProjectFile("server/routers/bundleRouter.ts");
    const library = readProjectFile("client/src/pages/EducationLibrary.tsx");

    expect(router).toContain(
      "const pricedRows = await Promise.all(rows.map(async (bundle) => {"
    );
    expect(router).toContain("eq(bundlePricingOptions.isActive, true)");
    expect(router).toContain(
      "price: resolveBundleCheckoutDollars(option.price, true)"
    );
    expect(library).toContain(
      'const isFree = bundle.accessType === "free" || bundle.isFree === true;'
    );
    expect(library).not.toContain(
      'bundle.accessType === "free" || lowestPrice === 0'
    );
    expect(library).toContain("From {price}");
  });
});
