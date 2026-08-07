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
 * Admin alerts are delivered to {@link resolvePlatformAdminEmail} (defaults to
 * admin@allaboutultrasound.com). The legacy Manus project-owner gmail is never used.
 */
export async function sendAdminAlert(title: string, content: string): Promise<boolean> {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@allaboutultrasound.com";
  const fromName = process.env.SENDGRID_FROM_NAME || "All About Ultrasound";
  const adminEmail = ENV.platformAdminEmail;

  if (!sendgridKey) {
    console.warn("[Notification] SENDGRID_API_KEY not set — admin alert email skipped.");
    return false;
  }

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#189aa1;margin-bottom:8px">${title}</h2>
      <div style="white-space:pre-wrap;color:#333;line-height:1.6">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
      <p style="color:#999;font-size:12px">This is an automated notification from UltrasoundAssist™.<br/>
      Admin alerts are delivered to: <strong>${adminEmail}</strong>.</p>
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
      return false;
    }

    console.log(`[Notification] Admin alert email sent to ${adminEmail}: ${title}`);
    return true;
  } catch (err) {
    console.warn("[Notification] Admin alert email error:", err);
    return false;
  }
}

/**
 * Sends an admin alert email to the platform admin inbox and logs the event
 * for the in-app Admin Notifications page.
 *
 * Manus project-owner push notifications are intentionally not used here because
 * they always deliver to the developer's Manus account (larawilliams0501@gmail.com),
 * not the client's admin inbox. SendGrid to PLATFORM_ADMIN_EMAIL is the sole channel.
 *
 * Pass { skipAdminEmail: true } when the caller is already sending its own
 * detailed admin email to avoid duplicates.
 */
export async function notifyOwner(
  payload: NotificationPayload,
  options?: { skipAdminEmail?: boolean }
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  let delivered = false;
  if (!options?.skipAdminEmail) {
    delivered = await sendAdminAlert(title, content);
  }

  logAdminNotification({ title, content, source: "system" }).catch(() => {});

  return delivered;
}
