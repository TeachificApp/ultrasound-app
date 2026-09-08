import { TRPCError } from "@trpc/server";
import { sendEmail } from "./email";
import { isEmailProviderConfigured } from "../lib/email/providerConfig";
import { logAdminNotification } from "../lib/logAdminNotification";
import { getPlatformAdminNotificationEmail } from "../lib/platformAdminNotification";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title is required." });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Notification content is required." });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.` });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.` });
  }
  return { title, content };
};

/**
 * Send a plain-text admin alert email via the configured provider to the platform admin address.
 *
 * This is the PRIMARY admin notification channel. It delivers to PLATFORM_ADMIN_EMAIL
 * (defaults to admin@allaboutultrasound.com) regardless of which Manus account owns
 * the project. This makes the system portable for consulting work where the client
 * should receive admin alerts, not the developer's personal Manus account.
 *
 * Call this directly via sendAdminAlert() for fire-and-forget admin emails.
 */
export async function sendAdminAlert(title: string, content: string): Promise<void> {
  const adminEmail = getPlatformAdminNotificationEmail();

  if (!isEmailProviderConfigured()) {
    console.warn("[Notification] Email provider not configured — admin alert email skipped.");
    return;
  }

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#189aa1;margin-bottom:8px">${title}</h2>
      <div style="white-space:pre-wrap;color:#333;line-height:1.6">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
      <p style="color:#999;font-size:12px">This is an automated notification from UltrasoundAssist™.<br/>
      Admin alerts are delivered to: <strong>${adminEmail}</strong> (configured via PLATFORM_ADMIN_EMAIL).</p>
    </div>
  `;

  const sent = await sendEmail({
    to: { name: "Admin", email: adminEmail },
    subject: `[Admin Alert] ${title}`,
    htmlBody,
  });
  if (sent) {
    console.log(`[Notification] Admin alert email sent to ${adminEmail}: ${title}`);
  } else {
    console.warn(`[Notification] Admin alert email failed for ${adminEmail}: ${title}`);
  }
}

/**
 * Dispatches a Railway-compatible administrator notification using the configured
 * email provider and the local administrative-notification table. It deliberately
 * makes no call to Manus-managed notification services.
 *
 * Returns whether an email provider is configured. Validation errors bubble up as
 * TRPC errors so callers can fix the payload.
 *
 * Pass { skipAdminEmail: true } when the caller is already sending its own
 * detailed admin email to avoid duplicates.
 */
export async function notifyOwner(
  payload: NotificationPayload,
  options?: { skipAdminEmail?: boolean }
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  // PRIMARY: Send admin alert email to PLATFORM_ADMIN_EMAIL via configured provider.
  // This is the reliable channel for client-facing admin notifications.
  // Fire-and-forget — never blocks the main flow.
  if (!options?.skipAdminEmail) {
    sendAdminAlert(title, content).catch(() => {});
  }

  // Log to the in-app admin notifications DB (fire-and-forget, never throws)
  logAdminNotification({ title, content, source: "system" }).catch(() => {});

  return isEmailProviderConfigured();
}
