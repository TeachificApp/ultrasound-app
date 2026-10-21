import { buildPasswordResetEmail, dashboardBillingAndReceiptNotice, emailWrapper } from "../_core/email";
import { getBrandDisplayConfig } from "@shared/brands";
import { TRANSACTIONAL_EMAIL_DEEP_TEAL, TRANSACTIONAL_EMAIL_TEAL, TRANSACTIONAL_EMAIL_TINT } from "../../shared/transactionalEmailPalette";

export type AppMembershipBrand = "aaus" | "iheartecho";

function membershipLabel(brand: AppMembershipBrand, isLifetime: boolean, isTrial: boolean) {
  const appName = brand === "iheartecho" ? "EchoAssist™" : "UltrasoundAssist™";
  return isLifetime
    ? `${appName} Lifetime Premium Membership`
    : isTrial
      ? `${appName} Premium Membership — 3-Day Free Trial`
      : `${appName} Premium Membership`;
}

export function renderNewBrandMembershipAccessEmail(input: {
  firstName: string;
  brand: AppMembershipBrand;
  accessUrl: string;
  setPasswordUrl: string;
  isLifetime: boolean;
  isTrial: boolean;
}) {
  const brandMode = input.brand;
  const brandLabel = input.brand === "iheartecho" ? "EchoAssist™" : "UltrasoundAssist™";
  const emailContent = buildPasswordResetEmail({
    firstName: input.firstName,
    resetUrl: input.setPasswordUrl,
    brandMode,
    purpose: "welcome",
    expiresInLabel: "7 days",
  });
  const accessNote = `<div style="margin:16px 0;padding:14px 16px;background:${TRANSACTIONAL_EMAIL_TINT};border-left:3px solid ${TRANSACTIONAL_EMAIL_TEAL};border-radius:0 8px 8px 0;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${TRANSACTIONAL_EMAIL_DEEP_TEAL};">Access your membership now</p>
    <p style="margin:0;font-size:13px;color:#475569;">Click below to access your ${brandLabel} premium membership — no password needed:</p>
    <p style="margin:8px 0 0;"><a href="${input.accessUrl}" style="color:${TRANSACTIONAL_EMAIL_TEAL};font-weight:600;">${input.accessUrl}</a></p>
  </div>`;
  return {
    subject: `Your ${brandLabel} Premium Membership is ready`,
    htmlBody: emailContent.htmlBody.replace("</body>", `${accessNote}${dashboardBillingAndReceiptNotice()}</body>`),
    previewText: `Access your ${brandLabel} premium membership on ${getBrandDisplayConfig(brandMode).shortName}`,
  };
}

export function renderExistingBrandMembershipAccessEmail(input: {
  firstName: string;
  brand: AppMembershipBrand;
  accessUrl: string;
  isLifetime: boolean;
  isTrial: boolean;
}) {
  const brandMode = input.brand;
  const planLabel = membershipLabel(input.brand, input.isLifetime, input.isTrial);
  const htmlBody = emailWrapper(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${TRANSACTIONAL_EMAIL_DEEP_TEAL};">Your ${planLabel} is active</h2>
    <p style="margin:0 0 16px;color:#334155;">Hi ${input.firstName}, your ${planLabel} is now active and ready to use.${input.isTrial ? " Your paid subscription begins automatically after the 3-day trial unless you cancel before it ends." : ""}</p>
    <div style="margin:16px 0;padding:14px 16px;background:${TRANSACTIONAL_EMAIL_TINT};border-left:3px solid ${TRANSACTIONAL_EMAIL_TEAL};border-radius:0 8px 8px 0;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${TRANSACTIONAL_EMAIL_DEEP_TEAL};">Access your membership</p>
      <p style="margin:0 0 8px;font-size:13px;color:#475569;">Click below to access your content — no password needed:</p>
      <p style="margin:0;"><a href="${input.accessUrl}" style="color:${TRANSACTIONAL_EMAIL_TEAL};font-weight:600;">${input.accessUrl}</a></p>
    </div>
    ${dashboardBillingAndReceiptNotice()}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">If you have any questions, reply to this email or contact support.</p>
  `, brandMode);
  return {
    subject: `Your ${planLabel} is ready`,
    htmlBody,
    previewText: `Access your ${planLabel} on ${getBrandDisplayConfig(brandMode).shortName}`,
  };
}
