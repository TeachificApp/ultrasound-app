import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("public checkout Platform Settings isolation", () => {
  it("projects only legal terms fields instead of the full administrative settings row", () => {
    const helper = source("server/routers/checkoutTermsHelper.ts");

    expect(helper).toContain("export const checkoutPlatformTermsSelection");
    for (const field of [
      "checkoutTermsText",
      "checkoutTermsLinkText1",
      "checkoutTermsLinkUrl1",
      "checkoutTermsLinkText2",
      "checkoutTermsLinkUrl2",
      "termsUrl",
      "privacyUrl",
    ]) {
      expect(helper).toContain(`${field}: platformSettings.${field}`);
    }
  });

  it("uses the isolated terms projection for every paid checkout type", () => {
    const checkoutFiles = [
      "server/routers/workshopRouter.ts",
      "server/routers/webinarRouter.ts",
      "server/routers/downloadsRouter.ts",
      "server/routers/productsRouter.ts",
      "server/routers/membershipRouter.ts",
      "server/routers/lmsRouter.ts",
    ];

    for (const file of checkoutFiles) {
      const content = source(file);
      expect(content).toContain("checkoutPlatformTermsSelection");
    }

    const workshop = source("server/routers/workshopRouter.ts");
    expect(workshop).toContain("db.select(checkoutPlatformTermsSelection).from(platformSettings)");
    expect(workshop).not.toContain("db.select().from(platformSettings).limit(1)");
  });

  it("keeps bundle checkout independent of Platform Settings", () => {
    const bundleCheckout = source("server/routers/bundleRouter.ts");

    expect(bundleCheckout).toContain("createCheckout: publicProcedure");
    expect(bundleCheckout).toContain("STANDARD_STRIPE_CHECKOUT_OPTIONS");
    expect(bundleCheckout).not.toContain("STANDARD_STRIPE_CHECKOUT_TERMS_CONSENT");
    expect(bundleCheckout).not.toContain("platformSettings");
  });
});
