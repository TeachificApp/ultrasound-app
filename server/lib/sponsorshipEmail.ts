import { emailWrapper } from "../_core/email";
import {
  formatSponsorshipAmount,
  SPONSORSHIP_TIERS,
  sponsorshipTargetLabel,
  type SponsorshipScope,
  type SponsorshipTier,
} from "../../shared/sponsorship";

export type SponsorshipEmailRecord = {
  contactName: string;
  contactEmail: string;
  organizationName: string;
  tier: SponsorshipTier;
  scope: SponsorshipScope;
  amountCents: number;
  currency?: string | null;
  workshopTitle?: string | null;
  workshopInstanceTitle?: string | null;
  otherPurpose?: string | null;
};

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sponsorshipSummary(record: SponsorshipEmailRecord) {
  const tier = SPONSORSHIP_TIERS[record.tier];
  return {
    tierLabel: tier.label,
    amount: formatSponsorshipAmount(record.amountCents, record.currency ?? "usd"),
    target: sponsorshipTargetLabel(record),
  };
}

export function buildSponsorThankYouEmail(record: SponsorshipEmailRecord) {
  const summary = sponsorshipSummary(record);
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:27px;line-height:1.2;color:#0b4f59;">Thank you for your sponsorship</h1>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#334155;">Hi ${escapeHtml(record.contactName)},</p>
    <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#334155;">Thank you for supporting ultrasound education. Your ${escapeHtml(summary.tierLabel)} sponsorship from <strong>${escapeHtml(record.organizationName)}</strong> has been received.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c9edf0;border-radius:10px;background:#f3fdfe;margin:0 0 22px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 8px;font-size:14px;color:#0f5964;"><strong>Support level:</strong> ${escapeHtml(summary.tierLabel)}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#0f5964;"><strong>Amount received:</strong> ${escapeHtml(summary.amount)}</p>
        <p style="margin:0;font-size:14px;color:#0f5964;"><strong>Supporting:</strong> ${escapeHtml(summary.target)}</p>
      </td></tr>
    </table>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">Our team will follow up to coordinate the recognition details associated with this sponsorship. If you have questions in the meantime, contact <a href="mailto:support@allaboutultrasound.com" style="color:#087f8c;text-decoration:underline;">support@allaboutultrasound.com</a>.</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">With appreciation,<br/><strong>All About Ultrasound™ | iHeartEcho™</strong></p>
  `;
  return {
    subject: `Thank you for supporting All About Ultrasound™ | iHeartEcho™`,
    htmlBody: emailWrapper(content, "combined", "You received this email because a sponsorship payment was completed with"),
  };
}

export function buildAdminSponsorshipAlertEmail(record: SponsorshipEmailRecord) {
  const summary = sponsorshipSummary(record);
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#0b4f59;">New sponsorship received</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">A sponsorship payment has completed and is ready for recognition follow-up.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#334155;">
      <tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;width:38%;font-weight:700;">Organization</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(record.organizationName)}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;font-weight:700;">Contact</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(record.contactName)} · <a href="mailto:${escapeHtml(record.contactEmail)}" style="color:#087f8c;">${escapeHtml(record.contactEmail)}</a></td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;font-weight:700;">Support level</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(summary.tierLabel)}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;font-weight:700;">Amount paid</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(summary.amount)}</td></tr>
      <tr><td style="padding:9px 0;font-weight:700;">Supporting</td><td style="padding:9px 0;">${escapeHtml(summary.target)}</td></tr>
    </table>
    <p style="margin:22px 0 0;font-size:14px;color:#475569;">Review the sponsorship record in the platform’s Exhibitors &amp; Sponsorships admin dashboard to coordinate benefits and outreach.</p>
  `;
  return {
    subject: `Sponsorship received — ${summary.tierLabel} · ${record.organizationName}`,
    htmlBody: emailWrapper(content, "combined", "This administrative notice was sent because a sponsorship payment was completed with"),
  };
}
