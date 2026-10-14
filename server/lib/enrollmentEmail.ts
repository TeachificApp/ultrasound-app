/**
 * enrollmentEmail.ts
 * Sends welcome/enrollment confirmation emails when a student is granted access to
 * any content type: course, digital download, bundle, or quiz.
 * Respects both the platform-level master switch and per-item toggles.
 *
 * All access links include a persistent auto-login token so users are signed in
 * automatically when they click the link — no separate login required.
 */

import {
  buildTransactionalEmailCta,
  emailWrapper as transactionalEmailWrapper,
  sendEmail,
} from "../_core/email";
import type { Brand, BrandMode } from "../../shared/brands";
const brandColor = "#0d9488";
const brandDark = "#0e4a50";


export type ContentType = "course" | "download" | "bundle" | "quiz";

/**
 * Build an access URL that auto-signs the user in.
 * Format: /auth/access?token=<accessToken>&next=<destination>
 * Falls back to the destination URL if no token is provided.
 */
export function learnOriginForBrand(brand: Brand = "aaus"): string {
  return brand === "iheartecho" ? "https://learn.iheartecho.com" : "https://learn.allaboutultrasound.com";
}

function appOriginForBrand(brand: Brand = "aaus"): string {
  return brand === "iheartecho" ? "https://app.iheartecho.com" : "https://app.allaboutultrasound.com";
}

export function buildPersistentAccessUrl(
  destination: string,
  accessToken?: string | null,
  brand: Brand = "aaus",
): string {
  if (!accessToken) return destination;
  return `${learnOriginForBrand(brand)}/auth/access?token=${accessToken}&next=${encodeURIComponent(destination)}`;
}

function buildAccessUrl(destination: string, accessToken?: string | null, brand: Brand = "aaus"): string {
  return buildPersistentAccessUrl(destination, accessToken, brand);
}

function emailWrapper(content: string, brandMode: BrandMode = "combined"): string {
  return transactionalEmailWrapper(content, brandMode, "You received this email because a purchase or enrollment was completed with");
}

async function deliverEmail(opts: {
  to: { name: string; email: string };
  subject: string;
  htmlBody: string;
  brandMode?: BrandMode;
  payee?: { name: string; email: string } | null;
  forPurchase?: boolean;
}): Promise<boolean> {
  const recipientEmails = [opts.to.email, opts.payee?.email].filter(Boolean) as string[];
  for (const email of recipientEmails) {
    try {
      const { ensureTransactionalEmailDelivery } = await import("./ensureTransactionalEmailDelivery");
      await ensureTransactionalEmailDelivery(email);
    } catch (err) {
      console.warn("[enrollmentEmail] Suppression clear failed (non-fatal):", err);
    }
  }
  return sendEmail({
    to: opts.to,
    subject: opts.subject,
    htmlBody: opts.htmlBody,
    brandMode: opts.brandMode ?? "combined",
    ...(opts.forPurchase
      ? { purchaseAccess: { payee: opts.payee ?? null }, transactional: true }
      : {}),
  });
}

function accessCtaWithFallback(url: string, label: string): string {
  return `${buildTransactionalEmailCta({ href: url, label, color: brandColor })}
    <p style="margin:0 0 24px;text-align:center;font-size:13px;color:#64748b;line-height:1.5;">
      If the button is not visible or does not work, use this direct access link:<br />
      <a href="${url}" style="color:${brandColor};font-weight:700;word-break:break-word;">${label}</a>
    </p>`;
}


// ─── Course Enrollment Email ──────────────────────────────────────────────────
export async function sendEnrollmentEmail(opts: {
  to: { name: string; email: string };
  courseTitle: string;
  courseSlug: string;
  creditHours?: string | null;
  customSubject?: string | null;
  customIntro?: string | null;
  accessToken?: string | null;
  setPasswordUrl?: string | null;
  brand?: Brand;
  payee?: { name: string; email: string } | null;
  forPurchase?: boolean;
}): Promise<boolean> {
  const { formatCmeCreditLabel } = await import("../../shared/cmeCreditLabel");
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const creditLabel = formatCmeCreditLabel(opts.creditHours);
  const subject = opts.customSubject || (creditLabel
    ? `Welcome to "${opts.courseTitle}" — ${creditLabel} 🎉`
    : `Welcome to "${opts.courseTitle}" 🎉`);
  const learnerBrand = opts.brand ?? "aaus";
  const courseDestination = `${learnOriginForBrand(learnerBrand)}/courses/${opts.courseSlug}/player`;
  const courseUrl = buildAccessUrl(courseDestination, opts.accessToken, learnerBrand);
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
  `, "combined");
  return deliverEmail({
    to: opts.to,
    subject,
    htmlBody,
    brandMode: "combined",
    payee: opts.payee,
    forPurchase: opts.forPurchase,
  });
}

export async function sendEnrollmentEmailForUser(opts: {
  userId: number;
  courseId: number;
  db?: any;
}): Promise<boolean> {
  try {
    const { getDb, getOrCreateAccessToken } = await import("../db");
    const { lmsCourses, platformSettings, users } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = opts.db ?? await getDb();
    if (!db) return false;

    const [course] = await db
      .select({
        title: lmsCourses.title,
        slug: lmsCourses.slug,
        creditHours: lmsCourses.creditHours,
        sendEnrollmentEmail: lmsCourses.sendEnrollmentEmail,
        brand: lmsCourses.brand,
      })
      .from(lmsCourses)
      .where(eq(lmsCourses.id, opts.courseId))
      .limit(1);
    if (!course) return false;
    if (course.sendEnrollmentEmail === false) return false;

    try {
      const [platformRow] = await db
        .select({ enrollmentEmailEnabled: platformSettings.enrollmentEmailEnabled })
        .from(platformSettings)
        .limit(1);
      if (platformRow?.enrollmentEmailEnabled === false) return false;
    } catch { /* non-fatal */ }

    const [user] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, opts.userId))
      .limit(1);
    if (!user?.email) return false;

    let accessToken: string | null = null;
    try { accessToken = await getOrCreateAccessToken(opts.userId); } catch { /* optional */ }

    return await sendEnrollmentEmail({
      to: { name: user.name || user.email.split("@")[0], email: user.email },
      courseTitle: course.title,
      courseSlug: course.slug,
      creditHours: course.creditHours,
      accessToken,
      brand: course.brand,
    });
  } catch (err) {
    console.error("[sendEnrollmentEmailForUser] Failed:", err);
    return false;
  }
}

export async function sendDownloadAccessEmail(opts: {
  to: { name: string; email: string };
  productTitle: string;
  productSlug: string;
  customSubject?: string | null;
  customIntro?: string | null;
  accessToken?: string | null;
  brand?: Brand;
  payee?: { name: string; email: string } | null;
  forPurchase?: boolean;
}): Promise<boolean> {
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const subject = opts.customSubject || `Your download is ready: "${opts.productTitle}"`;
  const learnerBrand = opts.brand ?? "aaus";
  const filesDestination = `${appOriginForBrand(learnerBrand)}/downloads/${opts.productSlug}/files`;
  const filesUrl = buildAccessUrl(filesDestination, opts.accessToken, learnerBrand);
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
  `, "combined");
  return deliverEmail({
    to: opts.to,
    subject,
    htmlBody,
    brandMode: "combined",
    payee: opts.payee,
    forPurchase: opts.forPurchase,
  });
}

export async function sendBundleAccessEmail(opts: {
  to: { name: string; email: string };
  bundleTitle: string;
  bundleSlug: string;
  customSubject?: string | null;
  customIntro?: string | null;
  destinationUrl?: string | null;
  accessToken?: string | null;
  brand?: Brand;
  payee?: { name: string; email: string } | null;
  forPurchase?: boolean;
}): Promise<boolean> {
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const subject = opts.customSubject || `You've been granted access to "${opts.bundleTitle}"`;
  const learnerBrand = opts.brand ?? "aaus";
  const bundleDestination = opts.destinationUrl ?? `${appOriginForBrand(learnerBrand)}/downloads/bundle/${opts.bundleSlug}`;
  const bundleUrl = buildAccessUrl(bundleDestination, opts.accessToken, learnerBrand);
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
  `, "combined");
  return deliverEmail({
    to: opts.to,
    subject,
    htmlBody,
    brandMode: "combined",
    payee: opts.payee,
    forPurchase: opts.forPurchase,
  });
}

export async function sendQuizAccessEmail(opts: {
  to: { name: string; email: string };
  quizTitle: string;
  courseSlug?: string | null;
  customSubject?: string | null;
  customIntro?: string | null;
  accessToken?: string | null;
  setPasswordUrl?: string | null;
  brand?: Brand;
  payee?: { name: string; email: string } | null;
  forPurchase?: boolean;
}): Promise<boolean> {
  const firstName = opts.to.name.split(" ")[0] || opts.to.name;
  const subject = opts.customSubject || `Your access to "${opts.quizTitle}" is ready 🎯`;
  const learnerBrand = opts.brand ?? "aaus";
  const destination = opts.courseSlug
    ? `${learnOriginForBrand(learnerBrand)}/courses/${opts.courseSlug}/player`
    : `${learnOriginForBrand(learnerBrand)}/my-dashboard?content=quizzes`;
  const appUrl = buildAccessUrl(destination, opts.accessToken, learnerBrand);
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
  `, "combined");
  return deliverEmail({
    to: opts.to,
    subject,
    htmlBody,
    brandMode: "combined",
    payee: opts.payee,
    forPurchase: opts.forPurchase,
  });
}

export async function sendPurchaseAccessEmail(opts: {
  to: { name: string; email: string };
  subject: string;
  heading: string;
  intro: string;
  accessLabel: string;
  destinationUrl: string;
  accessToken?: string | null;
  brand?: Brand;
  brandMode?: BrandMode;
  detailsHtml?: string;
  payee?: { name: string; email: string } | null;
  forPurchase?: boolean;
}): Promise<boolean> {
  const brand = opts.brand ?? "aaus";
  const name = opts.to.name.split(" ")[0] || opts.to.name || "there";
  const accessUrl = buildPersistentAccessUrl(opts.destinationUrl, opts.accessToken, brand);
  const htmlBody = emailWrapper(`
    <h2 style="margin:0 0 12px;font-size:22px;color:${brandDark};font-family:Georgia,serif;">${opts.heading}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">Hi ${name}, ${opts.intro}</p>
    ${opts.detailsHtml ?? ""}
    ${accessCtaWithFallback(accessUrl, opts.accessLabel)}
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">If you have questions, reply to this email or contact support.</p>
  `, opts.brandMode ?? "combined");
  return deliverEmail({
    to: opts.to,
    subject: opts.subject,
    htmlBody,
    brandMode: opts.brandMode ?? "combined",
    payee: opts.payee,
    forPurchase: opts.forPurchase ?? true,
  });
}
