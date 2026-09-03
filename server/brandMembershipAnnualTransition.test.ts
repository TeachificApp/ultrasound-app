import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_PRODUCTS, DUAL_MEMBERSHIP_PRODUCT } from "./routers/brandMembershipRouter";

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("annual membership transition", () => {
  it("uses approved recurring annual prices while preserving legacy lifetime price IDs for existing entitlements", () => {
    expect(BRAND_PRODUCTS.aaus).toMatchObject({ annualPrice: 9997, annualPriceId: expect.any(String) });
    expect(BRAND_PRODUCTS.iheartecho).toMatchObject({ annualPrice: 9997, annualPriceId: expect.any(String) });
    expect(DUAL_MEMBERSHIP_PRODUCT).toMatchObject({ annualPrice: 14700, annualPriceId: expect.any(String) });
    expect(BRAND_PRODUCTS.aaus.legacyLifetimePriceId).toEqual(expect.any(String));
    expect(BRAND_PRODUCTS.iheartecho.legacyLifetimePriceId).toEqual(expect.any(String));
    expect(DUAL_MEMBERSHIP_PRODUCT.legacyLifetimePriceId).toEqual(expect.any(String));
  });

  it("removes all new lifetime purchase routes and app-facing lifetime-offer controls", () => {
    const router = projectFile("server/routers/brandMembershipRouter.ts");
    const premiumPage = projectFile("client/src/pages/Premium.tsx");

    expect(router).not.toContain("createDualLifetimeCheckout");
    expect(router).not.toContain('z.enum(["monthly", "annual", "lifetime"])');
    expect(premiumPage).not.toMatch(/lifetime access|lifetime pricing|one-time payment/i);
    expect(premiumPage).toContain('interval: "annual"');
    expect(premiumPage).toContain("dualAnnual.mutate");
  });
});
