/**
 * certificateEmail.ts
 * Builds and sends the certificate of completion email via SendGrid.
 * The PDF is attached as a base64 encoded attachment.
 */

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";
const brandColor = "#189aa1";
const brandDark = "#0e1e2e";

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificate of Completion — All About Ultrasound™</title>
</head>
<body style="margin:0;padding:0;background:#f0fbfc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fbfc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${brandDark} 0%,#0e4a50 60%,${brandColor} 100%);padding:28px 32px;text-align:center;">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp"
                alt="All About Ultrasound™" width="80" height="80"
                style="border-radius:50%;display:block;margin:0 auto 12px;" />
              <div style="font-size:22px;font-weight:700;color:#ffffff;font-family:Georgia,serif;">All About Ultrasound™</div>
              <div style="font-size:12px;color:#4ad9e0;margin-top:4px;">General & Vascular Ultrasound Clinical Intelligence</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fffe;border-top:1px solid #e5f7f8;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © All About Ultrasound™ · <a href="https://www.allaboutultrasound.com" style="color:${brandColor};text-decoration:none;">www.allaboutultrasound.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendCertificateEmail(opts: {
  to: { name: string; email: string };
  courseTitle: string;
  certificateUrl: string;
  pdfBuffer: Buffer;
  issuedAt: Date;
}): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const senderEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@allaboutultrasound.com";
  const senderName = process.env.SENDGRID_FROM_NAME || "All About Ultrasound™";

  if (!apiKey) {
    console.warn("[certificate-email] SENDGRID_API_KEY not set — skipping email");
    return false;
  }

  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const dateStr = opts.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const htmlBody = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:${brandDark};font-family:Georgia,serif;">
      🎓 Congratulations, ${firstName}!
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      You have successfully completed <strong style="color:${brandDark};">${opts.courseTitle}</strong> on ${dateStr}.
      Your certificate of completion is attached to this email and available for download below.
    </p>
    <div style="background:#f0fbfc;border-left:3px solid ${brandColor};padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#0e4a50;font-weight:600;">What this means:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#475569;">
        <li style="margin:4px 0;">You have demonstrated mastery of the course content</li>
        <li style="margin:4px 0;">Your certificate is valid for professional portfolio use</li>
        <li style="margin:4px 0;">Keep learning — more courses are available in your library</li>
      </ul>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${opts.certificateUrl}"
        style="display:inline-block;background:linear-gradient(135deg,${brandColor},#4ad9e0);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Download Certificate
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
      Your certificate PDF is also attached to this email.
    </p>
  `);

  const pdfBase64 = opts.pdfBuffer.toString("base64");

  const payload = {
    personalizations: [
      {
        to: [{ name: opts.to.name, email: opts.to.email }],
        subject: `🎓 Your Certificate of Completion — ${opts.courseTitle}`,
      },
    ],
    from: { name: senderName, email: senderEmail },
    reply_to: { name: senderName, email: senderEmail },
    content: [{ type: "text/html", value: htmlBody }],
    attachments: [
      {
        content: pdfBase64,
        type: "application/pdf",
        filename: `certificate-${opts.courseTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`,
        disposition: "attachment",
      },
    ],
    tracking_settings: {
      click_tracking: { enable: false },
      open_tracking: { enable: false },
    },
  };

  try {
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
      console.error(`[certificate-email] SendGrid error ${res.status}: ${text}`);
      return false;
    }

    console.log(`[certificate-email] Sent certificate for "${opts.courseTitle}" to ${opts.to.email}`);
    return true;
  } catch (err) {
    console.error("[certificate-email] Failed:", err);
    return false;
  }
}
