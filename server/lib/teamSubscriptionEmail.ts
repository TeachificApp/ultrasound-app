import { dashboardBillingAndReceiptNotice, emailWrapper } from "../_core/email";

export type TeamSubscriptionEmailInput = {
  recipientName: string;
  brand: "aaus" | "iheartecho" | "both";
  plan: "lifetime" | "monthly";
  organizationName: string;
  seatCount: number;
  discountPercent: number;
  totalAmountCents: number;
  dashboardUrl: string;
};

/**
 * Renders the organizer's team subscription confirmation. Rendering is pure:
 * it never sends an email, creates a token, or changes subscription data.
 */
export function renderTeamSubscriptionConfirmationEmail(input: TeamSubscriptionEmailInput) {
  const brandName = input.brand === "aaus"
    ? "UltrasoundAssist™"
    : input.brand === "iheartecho"
      ? "EchoAssist™"
      : "UltrasoundAssist™ + EchoAssist™";
  const planLabel = input.plan === "lifetime" ? "Lifetime" : "Monthly";
  const subject = `Your ${brandName} Team Subscription is active — ${input.organizationName}`;
  const htmlBody = emailWrapper(`
    <h2 style="margin:0 0 16px;">Team subscription confirmed!</h2>
    <p>Hi ${input.recipientName || "there"},</p>
    <p>Your <strong>${brandName} Team/University ${planLabel}</strong> subscription for <strong>${input.organizationName}</strong> is now active.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#64748b;">Organisation</td><td style="padding:8px 0;font-weight:600;">${input.organizationName}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Plan</td><td style="padding:8px 0;">${brandName} ${planLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Seats</td><td style="padding:8px 0;">${input.seatCount} seat${input.seatCount > 1 ? "s" : ""}${input.discountPercent > 0 ? ` (${input.discountPercent}% bulk discount)` : ""}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Total</td><td style="padding:8px 0;">$${(input.totalAmountCents / 100).toFixed(2)}${input.plan === "monthly" ? "/month" : " one-time"}</td></tr>
    </table>
    <p>Head to your team dashboard to invite members and manage seats:</p>
    <p style="margin:20px 0;"><a href="${input.dashboardUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Manage Team →</a></p>
    <p style="color:#64748b;font-size:13px;">Each member you invite will receive an email with a link to activate their access.</p>
    ${dashboardBillingAndReceiptNotice()}
  `);
  return { subject, htmlBody };
}
