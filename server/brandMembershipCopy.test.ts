import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_PRODUCTS, DUAL_MEMBERSHIP_PRODUCT } from "./routers/brandMembershipRouter";

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("brand membership copy", () => {
  it("removes Founding Member language from app and checkout copy without changing lifetime prices or price identifiers", () => {
    const premiumPage = projectFile("client/src/pages/Premium.tsx");
    const membershipRouter = projectFile("server/routers/brandMembershipRouter.ts");
    const appConstants = projectFile("shared/appConstants.ts");

    expect(`${premiumPage}\n${membershipRouter}\n${appConstants}`).not.toMatch(/founding[\s-]*member/i);
    expect(BRAND_PRODUCTS.aaus.annualPrice).toBe(9997);
    expect(BRAND_PRODUCTS.iheartecho.annualPrice).toBe(9997);
    expect(DUAL_MEMBERSHIP_PRODUCT.annualPrice).toBe(14700);
    expect(BRAND_PRODUCTS.aaus.annualPriceId).toBeTruthy();
    expect(BRAND_PRODUCTS.iheartecho.annualPriceId).toBeTruthy();
    expect(DUAL_MEMBERSHIP_PRODUCT.annualPriceId).toBeTruthy();
    expect(BRAND_PRODUCTS.aaus.legacyLifetimePriceId).toBeTruthy();
    expect(BRAND_PRODUCTS.iheartecho.legacyLifetimePriceId).toBeTruthy();
    expect(DUAL_MEMBERSHIP_PRODUCT.legacyLifetimePriceId).toBeTruthy();
  });
});
