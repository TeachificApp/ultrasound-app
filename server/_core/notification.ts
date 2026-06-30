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

const buildEndpointUrl = (baseUrl: string): string => {
  const normalizedBase = baseUrl.endsWith("/")
    ? baseUrl
    : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Send a plain-text admin alert email via SendGrid to the platform admin address.
 * This runs in parallel with the Manus notification so the admin always receives
 * an email regardless of which Manus account the project is registered under.
 */
async function sendAdminEmail(title: string, content: string): Promise<void> {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.LMS_FROM_EMAIL || "noreply@allaboutultrasound.com";
  const fromName = process.env.SENDGRID_FROM_NAME || process.env.LMS_FROM_NAME || "All About Ultrasound";
  const adminEmail = ENV.platformAdminEmail || "admin@allaboutultrasound.com";

  if (!sendgridKey) return; // SendGrid not configured — skip silently

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#189aa1;margin-bottom:8px">${title}</h2>
      <div style="white-space:pre-wrap;color:#333;line-height:1.6">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
      <p style="color:#999;font-size:12px">This is an automated notification from UltrasoundAssist™.</p>
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
      console.warn(`[Notification] Admin email failed (${response.status}): ${detail}`);
    }
  } catch (err) {
    console.warn("[Notification] Admin email error:", err);
  }
}

/**
 * Dispatches a project-owner notification through the Manus Notification Service
 * AND sends a parallel email to admin@allaboutultrasound.com via SendGrid.
 *
 * Returns `true` if the Manus notification request was accepted, `false` when
 * the upstream service cannot be reached. Validation errors bubble up as TRPC
 * errors so callers can fix the payload.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured.",
    });
  }

  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured.",
    });
  }

  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);

  // NOTE: We do NOT call sendAdminEmail here anymore.
  // Fulfillment code that needs an admin email sends it explicitly via sendEmail().
  // Calling it here caused duplicate emails for every transaction.

  // Log to the in-app admin notifications DB (fire-and-forget, never throws)
  logAdminNotification({ title, content, source: "system" }).catch(() => {});

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${
          detail ? `: ${detail}` : ""
        }`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}
