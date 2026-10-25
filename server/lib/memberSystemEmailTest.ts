import type { Brand, BrandMode } from "../../shared/brands";
import {
  buildAccessGrantedEmail,
  buildFunnelPurchaseConfirmationEmail,
  buildMagicLinkEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail,
} from "../_core/email";
import {
  renderBundleAccessEmail,
  renderDownloadAccessEmail,
  renderEnrollmentEmail,
  renderQuizAccessEmail,
} from "./enrollmentEmail";

/**
 * System email previews must never include a usable login, reset, verification,
 * or auto-access token. The test copy stays visually faithful while every action
 * link is intentionally non-routable.
 */
export const MEMBER_SYSTEM_EMAIL_TEST_ACTION_URL = "https://example.invalid/member-system-email-test";

export const MEMBER_SYSTEM_EMAIL_TEST_TYPES = [
  "welcome",
  "password_reset",
  "magic_link",
  "course_access",
  "quiz_access",
  "download_access",
  "bundle_access",
  "membership_access",
  "purchase_confirmation",
] as const;

export type MemberSystemEmailTestType = typeof MEMBER_SYSTEM_EMAIL_TEST_TYPES[number];

export const MEMBER_SYSTEM_EMAIL_TEST_LABELS: Record<MemberSystemEmailTestType, string> = {
  welcome: "Account welcome",
  password_reset: "Password reset",
  magic_link: "Magic sign-in link",
  course_access: "Course access",
  quiz_access: "Quiz access",
  download_access: "Download access",
  bundle_access: "Bundle access",
  membership_access: "Membership access",
  purchase_confirmation: "Purchase confirmation",
};

export type MemberSystemEmailTest = {
  subject: string;
  htmlBody: string;
  previewText?: string;
  templateLabel: string;
};

function toContentBrand(brandMode: BrandMode): Brand {
  return brandMode === "iheartecho" ? "iheartecho" : "aaus";
}

function addSafeTestBanner(htmlBody: string): string {
  const banner = `<div role="note" style="background:#fff8e1;border-bottom:2px solid #f59e0b;color:#92400e;padding:12px 16px;text-align:center;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.02em;">TEST EMAIL — rendered from the member system template. All action links are non-working previews.</div>`;
  const withBanner = htmlBody.replace(/<body([^>]*)>/i, `<body$1>${banner}`);
  // Make every web action non-routable. This preserves visual CTA treatment but
  // prevents a test message from granting access or changing an account.
  return withBanner.replace(/href="https?:\/\/[^"\s]+"/gi, `href="${MEMBER_SYSTEM_EMAIL_TEST_ACTION_URL}"`);
}

export async function renderMemberSystemEmailTest(opts: {
  type: MemberSystemEmailTestType;
  memberFirstName: string;
  brandMode: BrandMode;
}): Promise<MemberSystemEmailTest> {
  const firstName = opts.memberFirstName.trim() || "Member";
  const contentBrand = toContentBrand(opts.brandMode);
  const safeActionUrl = MEMBER_SYSTEM_EMAIL_TEST_ACTION_URL;

  let rendered: { subject: string; htmlBody: string; previewText?: string };
  switch (opts.type) {
    case "welcome":
      rendered = buildWelcomeEmail({
        firstName,
        loginUrl: safeActionUrl,
        roles: ["premium_user"],
        brandMode: opts.brandMode,
      });
      break;
    case "password_reset":
      rendered = buildPasswordResetEmail({
        firstName,
        resetUrl: safeActionUrl,
        brandMode: opts.brandMode,
      });
      break;
    case "magic_link":
      rendered = buildMagicLinkEmail({
        firstName,
        magicUrl: safeActionUrl,
        brandMode: opts.brandMode,
      });
      break;
    case "course_access":
      rendered = await renderEnrollmentEmail({
        to: { name: firstName, email: "member@example.invalid" },
        courseTitle: "Sample Course",
        courseSlug: "sample-course",
        brand: contentBrand,
      });
      break;
    case "quiz_access":
      rendered = await renderQuizAccessEmail({
        to: { name: firstName, email: "member@example.invalid" },
        quizTitle: "Sample Quiz",
        courseSlug: "sample-quiz",
        brand: contentBrand,
      });
      break;
    case "download_access":
      rendered = await renderDownloadAccessEmail({
        to: { name: firstName, email: "member@example.invalid" },
        productTitle: "Sample Download",
        productSlug: "sample-download",
        brand: contentBrand,
      });
      break;
    case "bundle_access":
      rendered = await renderBundleAccessEmail({
        to: { name: firstName, email: "member@example.invalid" },
        bundleTitle: "Sample Bundle",
        bundleSlug: "sample-bundle",
        brand: contentBrand,
      });
      break;
    case "membership_access":
      rendered = buildAccessGrantedEmail({
        firstName,
        tier: "premium",
        loginUrl: safeActionUrl,
        brandMode: opts.brandMode,
      });
      break;
    case "purchase_confirmation":
      rendered = buildFunnelPurchaseConfirmationEmail({
        firstName,
        productName: "Sample Learning Product",
        amountPaid: 14900,
        loginUrl: safeActionUrl,
        brandMode: opts.brandMode,
      });
      break;
  }

  return {
    subject: `[TEST] ${rendered.subject}`,
    htmlBody: addSafeTestBanner(rendered.htmlBody),
    previewText: `[TEST] ${rendered.previewText ?? rendered.subject}`,
    templateLabel: MEMBER_SYSTEM_EMAIL_TEST_LABELS[opts.type],
  };
}
