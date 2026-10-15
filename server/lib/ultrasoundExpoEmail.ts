import { emailWrapper } from "../_core/email";
import { formatExpoMoney, ULTRASOUND_EXPO_NAME } from "../../shared/ultrasoundExpo";

export type UltrasoundExpoEmailRecord = {
  attendeeName: string;
  attendeeEmail: string;
  organizationName?: string | null;
  eventName: string;
  packageName: string;
  packageType: string;
  amountCents: number;
  currency?: string | null;
  ticketCode?: string | null;
};

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function details(record: UltrasoundExpoEmailRecord): string {
  const rows = [
    ["Event", record.eventName],
    ["Selection", record.packageName],
    ["Category", record.packageType],
    ["Amount paid", formatExpoMoney(record.amountCents, record.currency ?? "usd")],
  ];
  if (record.organizationName) rows.splice(1, 0, ["Organization", record.organizationName]);
  if (record.ticketCode) rows.push(["Confirmation code", record.ticketCode]);
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#334155;">${rows.map(([label, value]) =>
    `<tr><td style="padding:9px 0;border-bottom:1px solid #ccecef;width:39%;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:9px 0;border-bottom:1px solid #ccecef;">${escapeHtml(value)}</td></tr>`
  ).join("")}</table>`;
}

export function buildUltrasoundExpoThankYouEmail(record: UltrasoundExpoEmailRecord) {
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:28px;line-height:1.2;color:#075a68;">Thank you for joining ${ULTRASOUND_EXPO_NAME}</h1>
    <p style="margin:0 0 17px;font-size:16px;line-height:1.65;color:#334155;">Hi ${escapeHtml(record.attendeeName)},</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#334155;">Your ${escapeHtml(record.packageType.toLowerCase())} purchase for <strong>${escapeHtml(record.eventName)}</strong> is confirmed.</p>
    <div style="border:1px solid #c8edf0;border-radius:10px;background:#f2fcfd;padding:18px 20px;margin:0 0 22px;">${details(record)}</div>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">Your ticket details and UltrasoundExpo™ purchases will be available in your UltrasoundExpo™ Dashboard. For help, contact <a href="mailto:support@allaboutultrasound.com" style="color:#087f8c;text-decoration:underline;">support@allaboutultrasound.com</a>.</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">With appreciation,<br/><strong>${ULTRASOUND_EXPO_NAME} by All About Ultrasound™</strong></p>`;
  return {
    subject: `${ULTRASOUND_EXPO_NAME} confirmation — ${record.packageName}`,
    htmlBody: emailWrapper(content, "aaus", "You received this email because an UltrasoundExpo™ registration or partnership payment was completed with"),
  };
}

export function buildUltrasoundExpoAdminAlertEmail(record: UltrasoundExpoEmailRecord) {
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#075a68;">New ${ULTRASOUND_EXPO_NAME} payment</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">A registration, exhibit, or sponsorship payment is ready for UltrasoundExpo™ team follow-up.</p>
    ${details(record)}
    <p style="margin:22px 0 0;font-size:14px;color:#475569;">Review the transaction in the UltrasoundExpo™ administration dashboard.</p>`;
  return {
    subject: `${ULTRASOUND_EXPO_NAME} payment received — ${record.attendeeName}`,
    htmlBody: emailWrapper(content, "aaus", "This administrative notice was sent because an UltrasoundExpo™ payment was completed with"),
  };
}
