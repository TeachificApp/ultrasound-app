/**
 * Shared helper for resolving checkout terms checkbox text.
 *
 * Priority: product-level override → platform_settings global → hardcoded fallback
 *
 * The checkout page renders:
 *   "[checkoutTermsText] [link1Text] and [link2Text]"
 * e.g. "I have reviewed and agree to the Terms of Service and Privacy Policy"
 */

export interface CheckoutTermsSource {
  purchaseTermsText?: string | null;
  purchaseTermsLinkText1?: string | null;
  purchaseTermsLinkUrl1?: string | null;
  purchaseTermsLinkText2?: string | null;
  purchaseTermsLinkUrl2?: string | null;
}

export interface PlatformTermsSource {
  checkoutTermsText?: string | null;
  checkoutTermsLinkText1?: string | null;
  checkoutTermsLinkUrl1?: string | null;
  checkoutTermsLinkText2?: string | null;
  checkoutTermsLinkUrl2?: string | null;
  // Legacy fields kept for backward compat
  termsUrl?: string | null;
  privacyUrl?: string | null;
}

export interface ResolvedCheckoutTerms {
  checkoutTermsText: string;
  checkoutTermsLink1Text: string;
  checkoutTermsLink1Url: string;
  checkoutTermsLink2Text: string;
  checkoutTermsLink2Url: string;
  /** @deprecated use checkoutTermsLink1Url — kept for backward compat */
  termsUrl: string;
  /** @deprecated use checkoutTermsLink2Url — kept for backward compat */
  privacyUrl: string;
}

const DEFAULT_TERMS_TEXT = "I have reviewed and agree to the";
const DEFAULT_LINK1_TEXT = "Terms of Service";
const DEFAULT_LINK1_URL = "https://www.allaboutultrasound.com/terms";
const DEFAULT_LINK2_TEXT = "Privacy Policy";
const DEFAULT_LINK2_URL = "https://www.allaboutultrasound.com/privacy-policy.html";

/**
 * Resolve the checkout terms for a specific product checkout.
 *
 * @param product  - The product row (course, download, webinar, workshop, etc.)
 * @param platform - The platform_settings row (or null if not fetched)
 */
export function resolveCheckoutTerms(
  product: CheckoutTermsSource | null | undefined,
  platform: PlatformTermsSource | null | undefined,
): ResolvedCheckoutTerms {
  // Product-level overrides take priority; fall back to platform, then hardcoded defaults.
  const termsText =
    product?.purchaseTermsText?.trim() ||
    platform?.checkoutTermsText?.trim() ||
    DEFAULT_TERMS_TEXT;

  const link1Text =
    product?.purchaseTermsLinkText1?.trim() ||
    platform?.checkoutTermsLinkText1?.trim() ||
    DEFAULT_LINK1_TEXT;

  const link1Url =
    product?.purchaseTermsLinkUrl1?.trim() ||
    platform?.checkoutTermsLinkUrl1?.trim() ||
    platform?.termsUrl?.trim() ||
    DEFAULT_LINK1_URL;

  const link2Text =
    product?.purchaseTermsLinkText2?.trim() ||
    platform?.checkoutTermsLinkText2?.trim() ||
    DEFAULT_LINK2_TEXT;

  const link2Url =
    product?.purchaseTermsLinkUrl2?.trim() ||
    platform?.checkoutTermsLinkUrl2?.trim() ||
    platform?.privacyUrl?.trim() ||
    DEFAULT_LINK2_URL;

  return {
    checkoutTermsText: termsText,
    checkoutTermsLink1Text: link1Text,
    checkoutTermsLink1Url: link1Url,
    checkoutTermsLink2Text: link2Text,
    checkoutTermsLink2Url: link2Url,
    // Backward compat
    termsUrl: link1Url,
    privacyUrl: link2Url,
  };
}
