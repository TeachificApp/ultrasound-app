import type { ResolvedEmailSender, SendEmailOptions } from "../types";

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

export async function sendViaSendGrid(
  opts: SendEmailOptions,
  sender: ResolvedEmailSender,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "SENDGRID_API_KEY not set" };
  }

  const payload = {
    personalizations: [
      {
        to: [{ name: opts.to.name, email: opts.to.email }],
        subject: opts.subject,
      },
    ],
    from: { name: sender.name, email: sender.email },
    reply_to: { name: sender.name, email: sender.email },
    content: [
      {
        type: "text/html",
        value: opts.htmlBody,
      },
    ],
    tracking_settings: {
      click_tracking: { enable: false },
      open_tracking: { enable: false },
    },
    ...(opts.attachments && opts.attachments.length > 0
      ? {
          attachments: opts.attachments.map((a) => ({
            content: a.content,
            type: a.type,
            filename: a.filename,
            disposition: a.disposition ?? "attachment",
          })),
        }
      : {}),
    ...(opts.listUnsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${opts.listUnsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  };

  const res = await fetch(SENDGRID_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `SendGrid API error ${res.status}: ${text}` };
  }

  return { ok: true };
}
