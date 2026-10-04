import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIGITAL_DOWNLOAD_LICENSE_CHECKOUT_TEXT,
  DIGITAL_DOWNLOAD_LICENSE_TEXT,
  DIGITAL_DOWNLOAD_STRIPE_CUSTOM_TEXT,
} from "../shared/digitalDownloadLicense";

const projectRoot = resolve(import.meta.dirname, "..");
const readProjectFile = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

describe("Learn digital download checkout license disclosure", () => {
  it("uses the requested limited, personal-use license language", () => {
    expect(DIGITAL_DOWNLOAD_LICENSE_TEXT).toContain("property of All About Ultrasound | iHeartEcho");
    expect(DIGITAL_DOWNLOAD_LICENSE_TEXT).toContain("not be copied, resold, or distributed");
    expect(DIGITAL_DOWNLOAD_LICENSE_TEXT).toContain("limited license");
    expect(DIGITAL_DOWNLOAD_LICENSE_TEXT).toContain("personal use only");
    expect(DIGITAL_DOWNLOAD_LICENSE_CHECKOUT_TEXT).toBe(DIGITAL_DOWNLOAD_LICENSE_TEXT);
    expect(DIGITAL_DOWNLOAD_STRIPE_CUSTOM_TEXT.submit.message).toBe(DIGITAL_DOWNLOAD_LICENSE_TEXT);
  });

  it("places the notice inside the existing Learn checkout agreement only for downloads", () => {
    const checkoutSource = readProjectFile("client/src/pages/Checkout.tsx");

    expect(checkoutSource).toContain('entityType === "download"');
    expect(checkoutSource).toContain("DIGITAL_DOWNLOAD_LICENSE_CHECKOUT_TEXT");
    expect(checkoutSource).toContain('htmlFor="terms"');
    expect(checkoutSource).toContain("setTermsAccepted");
  });

  it("adds the notice to every Learn download Stripe session, including direct links", () => {
    const downloadsRouterSource = readProjectFile("server/routers/downloadsRouter.ts");
    const lmsRouterSource = readProjectFile("server/routers/lmsRouter.ts");
    const funnelRouterSource = readProjectFile("server/routers/funnelRouter.ts");

    expect(downloadsRouterSource.match(/custom_text: DIGITAL_DOWNLOAD_STRIPE_CUSTOM_TEXT/g)).toHaveLength(3);
    expect(lmsRouterSource).toContain("custom_text: DIGITAL_DOWNLOAD_STRIPE_CUSTOM_TEXT");
    expect(funnelRouterSource).toContain('if (input.productType === "download")');
    expect(funnelRouterSource).toContain("sessionParams.custom_text = DIGITAL_DOWNLOAD_STRIPE_CUSTOM_TEXT");
  });
});
