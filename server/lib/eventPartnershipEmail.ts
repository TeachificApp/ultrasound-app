import { emailWrapper } from "../_core/email";
import { EVENT_PARTNERSHIP_TYPES, formatEventPartnershipAmount, type EventPartnershipType } from "../../shared/eventPartnership";

export type EventPartnershipEmailRecord = {
  targetType: EventPartnershipType;
  targetTitle: string;
  packageName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  organizationName: string;
  organizationWebsite?: string | null;
  amountCents: number;
  currency?: string | null;
};

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function detailsTable(record: EventPartnershipEmailRecord) {
  const type = EVENT_PARTNERSHIP_TYPES[record.targetType];
  const rows = [
    ["Organization", record.organizationName],
    ["Contact", `${record.contactName} · ${record.contactEmail}`],
    [type.label, record.targetTitle],
    [type.packageLabel, record.packageName],
    ["Amount paid", formatEventPartnershipAmount(record.amountCents, record.currency ?? "usd")],
  ];
  if (record.contactPhone) rows.splice(2, 0, ["Phone", record.contactPhone]);
  if (record.organizationWebsite) rows.splice(2, 0, ["Website", record.organizationWebsite]);

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#334155;">${rows.map(([label, value]) =>
    `<tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;width:38%;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(value)}</td></tr>`
  ).join("")}</table>`;
}

export function buildEventPartnershipThankYouEmail(record: EventPartnershipEmailRecord) {
  const type = EVENT_PARTNERSHIP_TYPES[record.targetType];
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:27px;line-height:1.2;color:#0b4f59;">Thank you for your ${escapeHtml(type.label.toLowerCase())}</h1>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#334155;">Hi ${escapeHtml(record.contactName)},</p>
    <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#334155;">Thank you for reserving the <strong>${escapeHtml(record.packageName)}</strong> for <strong>${escapeHtml(record.targetTitle)}</strong>. Your payment has been received.</p>
    <div style="border:1px solid #c9edf0;border-radius:10px;background:#f3fdfe;padding:18px 20px;margin:0 0 22px;">${detailsTable(record)}</div>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">Our team will follow up to coordinate the details and benefits associated with your selection. If you have questions in the meantime, contact <a href="mailto:support@allaboutultrasound.com" style="color:#087f8c;text-decoration:underline;">support@allaboutultrasound.com</a>.</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">With appreciation,<br/><strong>All About Ultrasound™ | iHeartEcho™</strong></p>
  `;
  return {
    subject: `Thank you — ${type.label} reserved for ${record.targetTitle}`,
    htmlBody: emailWrapper(content, "combined", "You received this email because an event partnership payment was completed with"),
  };
}

export function buildAdminEventPartnershipAlertEmail(record: EventPartnershipEmailRecord) {
  const type = EVENT_PARTNERSHIP_TYPES[record.targetType];
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#0b4f59;">New ${escapeHtml(type.label.toLowerCase())} payment</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">A paid event partnership is ready for follow-up.</p>
    ${detailsTable(record)}
    <p style="margin:22px 0 0;font-size:14px;color:#475569;">Review this record in the related workshop instance or webinar administration panel to coordinate benefits and outreach.</p>
  `;
  return {
    subject: `${type.label} payment received — ${record.organizationName}`,
    htmlBody: emailWrapper(content, "combined", "This administrative notice was sent because an event partnership payment was completed with"),
  };
}
