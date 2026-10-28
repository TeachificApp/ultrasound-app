import { emailWrapper } from "../_core/email";
import { VENDOR_PARTNER_SCOPE_LABELS, VENDOR_PARTNER_TYPE_LABELS, type VendorPartnerScope, type VendorPartnerType } from "../../shared/vendorPartner";
import { formatExpoEventInterests, type ExpoEventTenant } from "../../shared/expoTenant";

export type VendorApplicationEmailRecord = {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  organizationWebsite?: string | null;
  message?: string | null;
  requestedScopes: VendorPartnerScope[];
  partnerTypes: VendorPartnerType[];
  eventInterests?: ExpoEventTenant[];
};

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scopeText(scopes: VendorPartnerScope[]) {
  return scopes.map(scope => VENDOR_PARTNER_SCOPE_LABELS[scope]).join(" · ") || "Not specified";
}

function typeText(types: VendorPartnerType[]) {
  return types.map(type => VENDOR_PARTNER_TYPE_LABELS[type]).join(" · ") || "Partner";
}

function eventInterestText(interests?: ExpoEventTenant[]) {
  return interests?.length ? formatExpoEventInterests(interests) : null;
}

export function buildVendorApplicationReceivedEmail(record: VendorApplicationEmailRecord) {
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:27px;line-height:1.2;color:#0b4f59;">Thank you for your partnership application</h1>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#334155;">Hi ${escapeHtml(record.contactName)},</p>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#334155;">We received ${escapeHtml(record.organizationName)}’s application to participate as a ${escapeHtml(typeText(record.partnerTypes).toLowerCase())}. The All About Ultrasound™ team will review the request before partner resources, pricing, or payment are made available.</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#475569;"><strong>Requested area:</strong> ${escapeHtml(scopeText(record.requestedScopes))}</p>
    ${eventInterestText(record.eventInterests) ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#475569;"><strong>Requested Expo event${record.eventInterests?.length === 1 ? "" : "s"}:</strong> ${escapeHtml(eventInterestText(record.eventInterests))}</p>` : ""}
    <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">If your application is approved, we will send next steps for signing in with the same email address. Questions? Contact <a href="mailto:support@allaboutultrasound.com" style="color:#087f8c;">support@allaboutultrasound.com</a>.</p>
  `;
  return {
    subject: "We received your partner application",
    htmlBody: emailWrapper(content, "combined", "You received this email because a partnership application was submitted to"),
  };
}

export function buildVendorApplicationAdminAlertEmail(record: VendorApplicationEmailRecord) {
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#0b4f59;">New partner application</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">A vendor, exhibitor, or sponsor application is ready for review in the platform administration workspace.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#334155;">
      <tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;width:38%;font-weight:700;">Organization</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(record.organizationName)}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;font-weight:700;">Contact</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(record.contactName)} · <a href="mailto:${escapeHtml(record.contactEmail)}" style="color:#087f8c;">${escapeHtml(record.contactEmail)}</a></td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;font-weight:700;">Phone</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(record.contactPhone || "Not provided")}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;font-weight:700;">Partner type</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(typeText(record.partnerTypes))}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;font-weight:700;">Requested area</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(scopeText(record.requestedScopes))}</td></tr>
      ${eventInterestText(record.eventInterests) ? `<tr><td style="padding:9px 0;border-bottom:1px solid #dceff1;font-weight:700;">Requested Expo events</td><td style="padding:9px 0;border-bottom:1px solid #dceff1;">${escapeHtml(eventInterestText(record.eventInterests))}</td></tr>` : ""}
      <tr><td style="padding:9px 0;font-weight:700;vertical-align:top;">Message</td><td style="padding:9px 0;white-space:pre-wrap;">${escapeHtml(record.message || "No message provided")}</td></tr>
    </table>
  `;
  return {
    subject: `Partner application — ${record.organizationName}`,
    htmlBody: emailWrapper(content, "combined", "This administrative notice was sent because a partner application was submitted to"),
  };
}

export function buildVendorApprovedEmail(record: Pick<VendorApplicationEmailRecord, "organizationName" | "contactName"> & { approvedScopes: VendorPartnerScope[] }) {
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:27px;line-height:1.2;color:#0b4f59;">Your partner access is approved</h1>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#334155;">Hi ${escapeHtml(record.contactName)},</p>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#334155;">${escapeHtml(record.organizationName)} is now approved for the requested partner area${record.approvedScopes.length === 1 ? "" : "s"}: <strong>${escapeHtml(scopeText(record.approvedScopes))}</strong>.</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#475569;">Sign in with this email address to access the password-protected Partner Portal. From there, your team can review approved opportunities, event resources, booth preferences, and secure payment paths.</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">If you need help accessing your account, use the regular password reset or magic-link sign-in options, or contact <a href="mailto:support@allaboutultrasound.com" style="color:#087f8c;">support@allaboutultrasound.com</a>.</p>
  `;
  return {
    subject: "Your approved partner access is ready",
    htmlBody: emailWrapper(content, "combined", "You received this email because a partner application was approved by"),
  };
}

export function buildVendorRejectedEmail(record: Pick<VendorApplicationEmailRecord, "organizationName" | "contactName"> & { note?: string | null }) {
  const content = `
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:27px;line-height:1.2;color:#0b4f59;">Partner application update</h1>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#334155;">Hi ${escapeHtml(record.contactName)},</p>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#334155;">Thank you for your interest in partnering with All About Ultrasound™. We are not able to approve ${escapeHtml(record.organizationName)}’s application at this time.</p>
    ${record.note ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#475569;">${escapeHtml(record.note)}</p>` : ""}
    <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">For questions or future partnership opportunities, contact <a href="mailto:support@allaboutultrasound.com" style="color:#087f8c;">support@allaboutultrasound.com</a>.</p>
  `;
  return {
    subject: "Partner application update",
    htmlBody: emailWrapper(content, "combined", "You received this email because a partnership application was reviewed by"),
  };
}
