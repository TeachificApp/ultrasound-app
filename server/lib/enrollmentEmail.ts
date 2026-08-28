/**
 * enrollmentEmail.ts
 * Sends welcome/enrollment confirmation emails when a student is granted access to
 * any content type: course, digital download, bundle, or quiz.
 * Respects both the platform-level master switch and per-item toggles.
 *
 * All access links include a persistent auto-login token so users are signed in
 * automatically when they click the link — no separate login required.
 */

import { buildTransactionalEmailCta, sendEmail } from "../_core/email";
import {
  buildQuizCoursePlayerUrl,
  buildStudentDashboardUrl,
} from "../../shared/studentDashboardUrls";
const brandColor = "#0d9488";
const brandDark = "#0e4a50";

// LMS sender name shown in email clients
const LMS_FROM_NAME = process.env.LMS_FROM_NAME
  || process.env.SENDGRID_FROM_NAME
  || "All About Ultrasound™ Learning";

export type ContentType = "course" | "download" | "bundle" | "quiz";

/**
 * Build an access URL that auto-signs the user in.
 * Format: /auth/access?token=<accessToken>&next=<destination>
 * Falls back to the destination URL if no token is provided.
 */
export function buildPersistentAccessUrl(
  destination: string,
  accessToken?: string | null,
): string {
  if (!accessToken) return destination;
  const encoded = encodeURIComponent(destination);
  // Use learn subdomain for LMS auto-login so the session cookie is scoped correctly
  return `https://learn.allaboutultrasound.com/auth/access?token=${accessToken}&next=${encoded}`;
}

function buildAccessUrl(destination: string, accessToken?: string | null): string {
  return buildPersistentAccessUrl(destination, accessToken);
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
            <td bgcolor="#0e4a50" style="background-color:#0e4a50;padding:28px 32px;text-align:center;">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp"
                alt="All About Ultrasound™" width="72" height="72"
                style="border-radius:50%;display:block;margin:0 auto 12px;" />
              <div style="font-size:20px;font-weight:700;color:#ffffff;font-family:Georgia,serif;">All About Ultrasound™</div>
              <div style="font-size:11px;color:#4ad9e0;margin-top:4px;letter-spacing:0.5px;">learn.allaboutultrasound.com</div>
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
                © All About Ultrasound, Inc. dba iHeartEcho · <a href="https://www.allaboutultrasound.com" style="color:${brandColor};text-decoration:none;">www.allaboutultrasound.com</a> · <a href="https://www.iheartecho.com" style="color:${brandColor};text-decoration:none;">www.iheartecho.com</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;">
                All sales are final. · <a href="https://app.allaboutultrasound.com/terms" style="color:${brandColor};text-decoration:underline;">Terms of Service</a>
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

function accessCtaWithFallback(url: string, label: string): string {
  return `${buildTransactionalEmailCta({ href: url, label, color: brandColor })}
    <p style="margin:0 0 24px;text-align:center;font-size:13px;color:#64748b;line-height:1.5;">
      If the button is not visible or does not work, use this direct access link:<br />
      <a href="${url}" style="color:${brandColor};font-weight:700;word-break:break-word;">${label}</a>
    </p>`;
}

async function deliverEmail(opts: {
  to: { name: string; email: string };
  subject: string;
  htmlBody: string;
}): Promise<boolean> {
  try {
    const { ensureTransactionalEmailDelivery } = await import("./ensureTransactionalEmailDelivery");
    await ensureTransactionalEmailDelivery(opts.to.email);
  } catch (err) {
    console.warn("[enrollmentEmail] Suppression clear failed (non-fatal):", err);
  }

  return sendEmail({
    to: opts.to,
    subject: opts.subject,
    htmlBody: opts.htmlBody,
    fromName: LMS_FROM_NAME,
  });
}

// ─── Course Enrollment Email ──────────────────────────────────────────────────
export async function sendEnrollmentEmail(opts: {
  to: { name: string; email: string };
  courseTitle: string;
  courseSlug: string;
  creditHours?: string | null;
  customSubject?: string | null;
  customIntro?: string | null;
  /** Persistent access token — auto-signs user in when they click the link */
  accessToken?: string | null;
  /** For new guest accounts: URL to set a permanent password */
  setPasswordUrl?: string | null;
}): Promise<boolean> {
  const { formatCmeCreditLabel } = await import("../../shared/cmeCreditLabel");
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const creditLabel = formatCmeCreditLabel(opts.creditHours);
  const subject = opts.customSubject || (creditLabel
    ? `Welcome to "${opts.courseTitle}" — ${creditLabel} 🎉`
    : `Welcome to "${opts.courseTitle}" 🎉`);
  // Link directly to the course player so the user lands in the course immediately after sign-in
  const courseDestination = `https://learn.allaboutultrasound.com/courses/${opts.courseSlug}/player`;
  const courseUrl = buildAccessUrl(courseDestination, opts.accessToken);
  const introHtml = opts.customIntro
    ? `<div style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">${opts.customIntro}</div>`
    : "";
  const setPasswordHtml = opts.setPasswordUrl
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:14px;color:#9a3412;font-weight:600;">⚠️ Set your password to keep access</p>
      <p style="margin:0 0 12px;font-size:13px;color:#7c2d12;line-height:1.5;">Your account was created automatically. Set a password so you can log back in anytime.</p>
      <a href="${opts.setPasswordUrl}" style="display:inline-block;background:#ea580c;color:#ffffff;font-weight:600;font-size:13px;padding:10px 20px;border-radius:6px;text-decoration:none;">Set My Password</a>
    </div>`
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
    ${setPasswordHtml}
    <div style="background:#f0fbfc;border-left:3px solid ${brandColor};padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#0e4a50;font-weight:600;">Getting started:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#475569;">
        <li style="margin:4px 0;">Click the button below — you'll be signed in automatically</li>
        <li style="margin:4px 0;">Track your progress and complete lessons at your own pace</li>
        <li style="margin:4px 0;">${creditLabel
          ? `Earn your certificate of completion (${creditLabel}) when you finish`
          : "Earn a certificate of completion when you finish"}</li>
      </ul>
    </div>
    ${accessCtaWithFallback(courseUrl, "Start Learning Now")}
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
      If you have any questions, reply to this email or visit our help center.
    </p>
  `);
  return deliverEmail({ to: opts.to, subject, htmlBody });
}

// ─── Convenience wrapper: send enrollment email by userId + courseId ─────────
/**
 * Looks up the user and course, checks the per-course `sendEnrollmentEmail` flag
 * and the platform-level `enrollmentEmailEnabled` flag, then sends the email.
 * This is the preferred call site for all free/admin enrollment paths so the
 * flag is respected consistently across every code path.
 *
 * Returns true if the email was sent, false if skipped or failed.
 */
export async function sendEnrollmentEmailForUser(opts: {
  userId: number;
  courseId: number;
  db?: any; // optional — will call getDb() if not provided
}): Promise<boolean> {
  try {
    const { getDb, getOrCreateAccessToken } = await import("../db");
    const { lmsCourses, platformSettings, users } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = opts.db ?? await getDb();
    if (!db) return false;

    // Fetch course flag
    const [course] = await db
      .select({
        title: lmsCourses.title,
        slug: lmsCourses.slug,
        creditHours: lmsCourses.creditHours,
        sendEnrollmentEmail: lmsCourses.sendEnrollmentEmail,
      })
      .from(lmsCourses)
      .where(eq(lmsCourses.id, opts.courseId))
      .limit(1);
    if (!course) return false;
    if (course.sendEnrollmentEmail === false) return false;

    // Fetch platform flag
    try {
      const [platformRow] = await db
        .select({ enrollmentEmailEnabled: platformSettings.enrollmentEmailEnabled })
        .from(platformSettings)
        .limit(1);
      if (platformRow?.enrollmentEmailEnabled === false) return false;
    } catch { /* non-fatal */ }

    // Fetch user
    const [user] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, opts.userId))
      .limit(1);
    if (!user?.email) return false;

    // Get access token
    let accessToken: string | null = null;
    try { accessToken = await getOrCreateAccessToken(opts.userId); } catch { /* optional */ }

    return await sendEnrollmentEmail({
      to: { name: user.name || user.email.split("@")[0], email: user.email },
      courseTitle: course.title,
      courseSlug: course.slug,
      creditHours: course.creditHours,
      accessToken,
    });
  } catch (err) {
    console.error("[sendEnrollmentEmailForUser] Failed:", err);
    return false;
  }
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
    ${accessCtaWithFallback(filesUrl, "Access Your Files")}
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
    ${accessCtaWithFallback(bundleUrl, "Access Your Bundle")}
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
  courseSlug?: string | null;
  customSubject?: string | null;
  customIntro?: string | null;
  /** Persistent access token — auto-signs user in when they click the link */
  accessToken?: string | null;
  /** For new guest accounts: URL to set a permanent password */
  setPasswordUrl?: string | null;
}): Promise<boolean> {
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const subject = opts.customSubject || `Your access to "${opts.quizTitle}" is ready 🎯`;
  const destination = opts.courseSlug
    ? buildQuizCoursePlayerUrl(opts.courseSlug)
    : buildStudentDashboardUrl({ contentTab: "quizzes" });
  const appUrl = buildAccessUrl(destination, opts.accessToken);
  const introHtml = opts.customIntro
    ? `<div style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">${opts.customIntro}</div>`
    : "";
  const setPasswordHtml = opts.setPasswordUrl
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:14px;color:#9a3412;font-weight:600;">⚠️ Set your password to keep access</p>
      <p style="margin:0 0 12px;font-size:13px;color:#7c2d12;line-height:1.5;">Your account was created automatically. Set a password so you can log back in anytime.</p>
      <a href="${opts.setPasswordUrl}" style="display:inline-block;background:#ea580c;color:#ffffff;font-weight:600;font-size:13px;padding:10px 20px;border-radius:6px;text-decoration:none;">Set My Password</a>
    </div>`
    : "";
  const htmlBody = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:${brandDark};font-family:Georgia,serif;">
      Hi ${firstName}, your access is ready! 🎯
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      You now have full access to <strong style="color:${brandDark};">${opts.quizTitle}</strong>.
    </p>
    ${introHtml}
    ${setPasswordHtml}
    <div style="background:#f0fbfc;border-left:3px solid ${brandColor};padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#0e4a50;font-weight:600;">How to access:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#475569;">
        <li style="margin:4px 0;">Click the button below — you'll be signed in automatically</li>
        <li style="margin:4px 0;">${opts.courseSlug ? "Start the quiz right away in your course player" : "Go to My Dashboard → My Content → Quizzes"}</li>
        <li style="margin:4px 0;">Start the quiz at any time during your access period</li>
      </ul>
    </div>
    ${accessCtaWithFallback(appUrl, opts.courseSlug ? "Start Quiz Now" : "Access My Quiz")}
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
      If you have any questions, reply to this email or visit our help center.
    </p>
  `);
  return deliverEmail({ to: opts.to, subject, htmlBody });
}
