import { describe, expect, it } from "vitest";
import { resolveCheckoutTerms } from "./routers/checkoutTermsHelper";

const PLATFORM_TERMS_URL = "https://www.allaboutultrasound.com/terms.html";

describe("checkout Terms resolution", () => {
  it("uses the public platform Terms page when no course or content override exists", () => {
    const terms = resolveCheckoutTerms(null, null);

    expect(terms.checkoutTermsLink1Url).toBe(PLATFORM_TERMS_URL);
    expect(terms.termsUrl).toBe(PLATFORM_TERMS_URL);
  });

  it("retains an explicit course or content Terms override", () => {
    const terms = resolveCheckoutTerms(
      { purchaseTermsLinkUrl1: "https://example.com/course-specific-terms" },
      { checkoutTermsLinkUrl1: PLATFORM_TERMS_URL },
    );

    expect(terms.checkoutTermsLink1Url).toBe("https://example.com/course-specific-terms");
  });
});
