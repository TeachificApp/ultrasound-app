import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import { logAdminNotification } from "../lib/logAdminNotification";

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
 * Send a plain-text admin alert email via SendGrid to the platform admin address.
 *
 * This is the PRIMARY admin notification channel. It delivers to PLATFORM_ADMIN_EMAIL
 * (defaults to admin@allaboutultrasound.com) regardless of which Manus account owns
 * the project. This makes the system portable for consulting work where the client
 * should receive admin alerts, not the developer's personal Manus account.
 *
 * Call this directly via sendAdminAlert() for fire-and-forget admin emails.
 */
export async function sendAdminAlert(title: string, content: string): Promise<void> {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  // Use a "from" address that is different from the "to" address to avoid spam filters
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@allaboutultrasound.com";
  const fromName = process.env.SENDGRID_FROM_NAME || "All About Ultrasound";
  // PLATFORM_ADMIN_EMAIL is the single source of truth for who receives admin alerts.
  // Set this env var to the client's email address for consulting projects.
  const adminEmail = ENV.platformAdminEmail || "admin@allaboutultrasound.com";

  if (!sendgridKey) {
    console.warn("[Notification] SENDGRID_API_KEY not set — admin alert email skipped.");
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

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: adminEmail, name: "Admin" }] }],
        from: { email: fromEmail, name: fromName },
        subject: `[Admin Alert] ${title}`,
        content: [{ type: "text/html", value: htmlBody }],
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(`[Notification] Admin alert email failed (${response.status}): ${detail}`);
    } else {
      console.log(`[Notification] Admin alert email sent to ${adminEmail}: ${title}`);
    }
  } catch (err) {
    console.warn("[Notification] Admin alert email error:", err);
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

  // PRIMARY: Send admin alert email to PLATFORM_ADMIN_EMAIL via SendGrid.
  // This is the reliable channel for client-facing admin notifications.
  // Fire-and-forget — never blocks the main flow.
  if (!options?.skipAdminEmail) {
    sendAdminAlert(title, content).catch(() => {});
  }

  // Log to the in-app admin notifications DB (fire-and-forget, never throws)
  logAdminNotification({ title, content, source: "system" }).catch(() => {});

  return Boolean(process.env.SENDGRID_API_KEY);
}
