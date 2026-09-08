import type { ResolvedEmailSender, SendEmailOptions } from "../types";

const SMTPCOM_API_URL = "https://api.smtp.com/v4/messages";

/**
 * Send via SMTP.com REST API v4.
 * @see https://www.smtp.com/resources/api-documentation/
 */
export async function sendViaSmtpCom(
  opts: SendEmailOptions,
  sender: ResolvedEmailSender,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SMTPCOM_API_KEY?.trim();
  const channel = process.env.SMTPCOM_CHANNEL?.trim();
  if (!apiKey) {
    return { ok: false, error: "SMTPCOM_API_KEY not set" };
  }
  if (!channel) {
    return { ok: false, error: "SMTPCOM_CHANNEL not set" };
  }

  const customHeaders: Record<string, string> = {};
  if (opts.listUnsubscribeUrl) {
    customHeaders["List-Unsubscribe"] = `<${opts.listUnsubscribeUrl}>`;
    customHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const payload: Record<string, unknown> = {
    channel,
    subject: opts.subject,
    originator: {
      from: {
        address: sender.email,
        name: sender.name,
      },
      reply_to: {
        address: sender.email,
        name: sender.name,
      },
    },
    recipients: {
      to: [
        {
          address: opts.to.email,
          ...(opts.to.name ? { name: opts.to.name } : {}),
        },
      ],
    },
    body: {
      parts: [
        {
          type: "text/html",
          content: opts.htmlBody,
          charset: "utf-8",
        },
      ],
      ...(opts.attachments && opts.attachments.length > 0
        ? {
            attachments: opts.attachments.map((a) => ({
              content: a.content.replace(/\s+/g, ""),
              type: a.type,
              encoding: "base64",
              filename: a.filename,
              disposition: a.disposition ?? "attachment",
            })),
          }
        : {}),
    },
    ...(Object.keys(customHeaders).length > 0 ? { custom_headers: customHeaders } : {}),
  };

  const res = await fetch(SMTPCOM_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: `SMTP.com API error ${res.status}: ${text}` };
  }

  try {
    const parsed = JSON.parse(text) as { status?: string; data?: { error_key?: string } };
    if (parsed.status === "fail") {
      return { ok: false, error: `SMTP.com API rejected message: ${text}` };
    }
  } catch {
    // Non-JSON success bodies are acceptable for 200 responses.
  }

  return { ok: true };
}
