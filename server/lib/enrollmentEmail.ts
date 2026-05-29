/**
 * enrollmentEmail.ts
 * Sends welcome/enrollment confirmation emails when a student is granted access to
 * any content type: course, digital download, bundle, or quiz.
 * Respects both the platform-level master switch and per-item toggles.
 *
 * All access links include a persistent auto-login token so users are signed in
 * automatically when they click the link — no separate login required.
 */

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";
const brandColor = "#0d9488";
const brandDark = "#0e4a50";

// LMS emails use a dedicated from address so recipients can identify the source
// as the learning platform. Falls back to the platform-wide SENDGRID_FROM_EMAIL.
const LMS_FROM_EMAIL = process.env.LMS_FROM_EMAIL
  || process.env.SENDGRID_FROM_EMAIL
  || "learn@allaboutultrasound.com";
const LMS_FROM_NAME = process.env.LMS_FROM_NAME
  || process.env.SENDGRID_FROM_NAME
  || "All About Ultrasound™ Learning";

export type ContentType = "course" | "download" | "bundle" | "quiz";

/**
 * Build an access URL that auto-signs the user in.
 * Format: /auth/access?token=<accessToken>&next=<destination>
 * Falls back to the destination URL if no token is provided.
 */
function buildAccessUrl(destination: string, accessToken?: string | null): string {
  if (!accessToken) return destination;
  const encoded = encodeURIComponent(destination);
  // Use learn subdomain for LMS auto-login so the session cookie is scoped correctly
  return `https://learn.allaboutultrasound.com/auth/access?token=${accessToken}&next=${encoded}`;
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0e4a50 0%,#0e4a50 60%,${brandColor} 100%);padding:28px 32px;text-align:center;">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp"
                alt="All About Ultrasound™" width="80" height="80"
                style="border-radius:50%;display:block;margin:0 auto 12px;" />
              <div style="font-size:22px;font-weight:700;color:#ffffff;font-family:Georgia,serif;">All About Ultrasound™</div>
              <div style="font-size:12px;color:#4ad9e0;margin-top:4px;">General &amp; Vascular Ultrasound Clinical Intelligence</div>
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

async function deliverEmail(opts: {
  to: { name: string; email: string };
  subject: string;
  htmlBody: string;
}): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const senderEmail = LMS_FROM_EMAIL;
  const senderName = LMS_FROM_NAME;
  if (!apiKey) {
    console.warn("[enrollment-email] SENDGRID_API_KEY not set — skipping email");
    return false;
  }
  const payload = {
    personalizations: [{ to: [{ name: opts.to.name, email: opts.to.email }], subject: opts.subject }],
    from: { name: senderName, email: senderEmail },
    reply_to: { name: senderName, email: senderEmail },
    content: [{ type: "text/html", value: opts.htmlBody }],
    tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
  };
  try {
    const res = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[enrollment-email] SendGrid error ${res.status}: ${text}`);
      return false;
    }
    console.log(`[enrollment-email] Sent enrollment email to ${opts.to.email}`);
    return true;
  } catch (err) {
    console.error("[enrollment-email] Failed:", err);
    return false;
  }
}

// ─── Course Enrollment Email ──────────────────────────────────────────────────
export async function sendEnrollmentEmail(opts: {
  to: { name: string; email: string };
  courseTitle: string;
  courseSlug: string;
  customSubject?: string | null;
  customIntro?: string | null;
  /** Persistent access token — auto-signs user in when they click the link */
  accessToken?: string | null;
}): Promise<boolean> {
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const subject = opts.customSubject || `Welcome to "${opts.courseTitle}" 🎉`;
  const courseDestination = `https://learn.allaboutultrasound.com/courses/${opts.courseSlug}`;
  const courseUrl = buildAccessUrl(courseDestination, opts.accessToken);
  const introHtml = opts.customIntro
    ? `<div style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">${opts.customIntro}</div>`
    : "";
  const htmlBody = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:${brandDark};font-family:Georgia,serif;">
      Welcome, ${firstName}! 🎉
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      You've been successfully enrolled in <strong style="color:${brandDark};">${opts.courseTitle}</strong>.
      We're excited to have you on board!
    </p>
    ${introHtml}
    <div style="background:#f0fbfc;border-left:3px solid ${brandColor};padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#0e4a50;font-weight:600;">Getting started:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#475569;">
        <li style="margin:4px 0;">Click the button below — you'll be signed in automatically</li>
        <li style="margin:4px 0;">Track your progress and complete lessons at your own pace</li>
        <li style="margin:4px 0;">Earn a certificate of completion when you finish</li>
      </ul>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${courseUrl}"
        style="display:inline-block;background:linear-gradient(135deg,${brandColor},#4ad9e0);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Start Learning Now
      </a>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
      If you have any questions, reply to this email or visit our help center.
    </p>
  `);
  return deliverEmail({ to: opts.to, subject, htmlBody });
}

// ─── Digital Download Access Email ───────────────────────────────────────────
export async function sendDownloadAccessEmail(opts: {
  to: { name: string; email: string };
  productTitle: string;
  productSlug: string;
  customSubject?: string | null;
  customIntro?: string | null;
  /** Persistent access token — auto-signs user in when they click the link */
  accessToken?: string | null;
}): Promise<boolean> {
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const subject = opts.customSubject || `Your download is ready: "${opts.productTitle}"`;
  const filesDestination = `https://app.allaboutultrasound.com/downloads/${opts.productSlug}/files`;
  const filesUrl = buildAccessUrl(filesDestination, opts.accessToken);
  const introHtml = opts.customIntro
    ? `<div style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">${opts.customIntro}</div>`
    : "";
  const htmlBody = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:${brandDark};font-family:Georgia,serif;">
      Hi ${firstName}, your download is ready! 📥
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      You've been granted access to <strong style="color:${brandDark};">${opts.productTitle}</strong>.
    </p>
    ${introHtml}
    <div style="background:#f0fbfc;border-left:3px solid ${brandColor};padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#0e4a50;font-weight:600;">Accessing your files:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#475569;">
        <li style="margin:4px 0;">Click the button below — you'll be signed in automatically</li>
        <li style="margin:4px 0;">Files are available anytime from your account</li>
        <li style="margin:4px 0;">Contact support if you experience any issues</li>
      </ul>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${filesUrl}"
        style="display:inline-block;background:linear-gradient(135deg,${brandColor},#4ad9e0);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Access Your Files
      </a>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
      If you have any questions, reply to this email or visit our help center.
    </p>
  `);
  return deliverEmail({ to: opts.to, subject, htmlBody });
}

// ─── Bundle Access Email ──────────────────────────────────────────────────────
export async function sendBundleAccessEmail(opts: {
  to: { name: string; email: string };
  bundleTitle: string;
  bundleSlug: string;
  customSubject?: string | null;
  customIntro?: string | null;
  /** Persistent access token — auto-signs user in when they click the link */
  accessToken?: string | null;
}): Promise<boolean> {
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const subject = opts.customSubject || `You've been granted access to "${opts.bundleTitle}"`;
  const bundleDestination = `https://app.allaboutultrasound.com/downloads/bundle/${opts.bundleSlug}`;
  const bundleUrl = buildAccessUrl(bundleDestination, opts.accessToken);
  const introHtml = opts.customIntro
    ? `<div style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">${opts.customIntro}</div>`
    : "";
  const htmlBody = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:${brandDark};font-family:Georgia,serif;">
      Hi ${firstName}, your bundle is ready! 📦
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      You've been granted access to the <strong style="color:${brandDark};">${opts.bundleTitle}</strong> bundle.
    </p>
    ${introHtml}
    <div style="background:#f0fbfc;border-left:3px solid ${brandColor};padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#0e4a50;font-weight:600;">What's included:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#475569;">
        <li style="margin:4px 0;">Click the button below — you'll be signed in automatically</li>
        <li style="margin:4px 0;">Download files are available immediately</li>
        <li style="margin:4px 0;">Contact support if you need assistance</li>
      </ul>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${bundleUrl}"
        style="display:inline-block;background:linear-gradient(135deg,${brandColor},#4ad9e0);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Access Your Bundle
      </a>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
      If you have any questions, reply to this email or visit our help center.
    </p>
  `);
  return deliverEmail({ to: opts.to, subject, htmlBody });
}

// ─── Quiz Access Email ────────────────────────────────────────────────────────
export async function sendQuizAccessEmail(opts: {
  to: { name: string; email: string };
  quizTitle: string;
  customSubject?: string | null;
  customIntro?: string | null;
  /** Persistent access token — auto-signs user in when they click the link */
  accessToken?: string | null;
}): Promise<boolean> {
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const subject = opts.customSubject || `You've been invited to "${opts.quizTitle}"`;
  const appDestination = `https://app.allaboutultrasound.com`;
  const appUrl = buildAccessUrl(appDestination, opts.accessToken);
  const introHtml = opts.customIntro
    ? `<div style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">${opts.customIntro}</div>`
    : "";
  const htmlBody = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:${brandDark};font-family:Georgia,serif;">
      Hi ${firstName}, you've been invited! 🎯
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      You've been invited to participate in <strong style="color:${brandDark};">${opts.quizTitle}</strong>.
    </p>
    ${introHtml}
    <div style="background:#f0fbfc;border-left:3px solid ${brandColor};padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#0e4a50;font-weight:600;">How to join:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#475569;">
        <li style="margin:4px 0;">Click the button below — you'll be signed in automatically</li>
        <li style="margin:4px 0;">Your instructor will share the session link</li>
        <li style="margin:4px 0;">Compete in real-time with other participants</li>
      </ul>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${appUrl}"
        style="display:inline-block;background:linear-gradient(135deg,${brandColor},#4ad9e0);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Go to Platform
      </a>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
      If you have any questions, reply to this email or visit our help center.
    </p>
  `);
  return deliverEmail({ to: opts.to, subject, htmlBody });
}
