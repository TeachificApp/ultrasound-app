/**
 * Mandatory license disclosure for Learn-platform digital download purchases.
 * It intentionally does not apply to the UltrasoundAssist or EchoAssist app subscriptions.
 */
export const DIGITAL_DOWNLOAD_LICENSE_TEXT =
  "Digital products are the property of All About Ultrasound | iHeartEcho and may not be copied, resold, or distributed. Your purchase grants a limited license to view the product for your personal use only.";

/** Displayed inside the existing checkout agreement checkbox on the Learn checkout page. */
export const DIGITAL_DOWNLOAD_LICENSE_CHECKOUT_TEXT =
  DIGITAL_DOWNLOAD_LICENSE_TEXT;

/** Shown by Stripe for any Learn download checkout path that opens Stripe-hosted checkout directly. */
export const DIGITAL_DOWNLOAD_STRIPE_CUSTOM_TEXT = {
  submit: {
    message: DIGITAL_DOWNLOAD_LICENSE_TEXT,
  },
} as const;
