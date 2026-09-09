import { getBrandDisplayConfig, type BrandMode } from "@shared/brands";
import type { EmailProviderId, ResolvedEmailSender } from "./types";

/** Active transactional email provider preference (default: smtpcom / SMTP.com). */
export function getEmailProviderId(): EmailProviderId {
  const raw = (process.env.EMAIL_PROVIDER ?? "smtpcom").trim().toLowerCase();
  if (raw === "sendgrid") return "sendgrid";
  if (raw === "smtpcom" || raw === "smtp.com" || raw === "smtp_com" || raw === "smtp") return "smtpcom";
  return "smtpcom";
}

export function isSmtpComConfigured(): boolean {
  return !!(process.env.SMTPCOM_API_KEY?.trim() && process.env.SMTPCOM_CHANNEL?.trim());
}

export function isSendGridConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY?.trim();
}

/**
 * Provider actually used to send mail. Prefers configured SMTP.com when selected,
 * otherwise falls back to SendGrid (and vice versa) so auth emails keep working.
 */
export function resolveEffectiveEmailProvider(): EmailProviderId | null {
  const preferred = getEmailProviderId();
  if (preferred === "smtpcom") {
    if (isSmtpComConfigured()) return "smtpcom";
    if (isSendGridConfigured()) return "sendgrid";
    return null;
  }
  if (isSendGridConfigured()) return "sendgrid";
  if (isSmtpComConfigured()) return "smtpcom";
  return null;
}

export function isSendGridProvider(): boolean {
  return resolveEffectiveEmailProvider() === "sendgrid";
}

export function isSmtpComProvider(): boolean {
  return resolveEffectiveEmailProvider() === "smtpcom";
}

export function isEmailProviderConfigured(): boolean {
  return resolveEffectiveEmailProvider() !== null;
}

export function resolveEmailSender(opts: {
  brandMode?: BrandMode;
  fromName?: string;
  fromEmail?: string;
  /** Override which provider's from-env vars to use (defaults to effective provider). */
  provider?: EmailProviderId;
}): ResolvedEmailSender {
  const brandConfig = getBrandDisplayConfig(opts.brandMode || "aaus");
  const provider = opts.provider ?? resolveEffectiveEmailProvider() ?? getEmailProviderId();

  const defaultEmail =
    provider === "smtpcom"
      ? process.env.SMTPCOM_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || brandConfig.senderEmail
      : process.env.SENDGRID_FROM_EMAIL || brandConfig.senderEmail;

  const defaultName =
    provider === "smtpcom"
      ? process.env.SMTPCOM_FROM_NAME || process.env.SENDGRID_FROM_NAME || brandConfig.senderName
      : process.env.SENDGRID_FROM_NAME || brandConfig.senderName;

  return {
    email: opts.fromEmail || defaultEmail,
    name: opts.fromName || defaultName,
  };
}

export function emailProviderStatus() {
  const preferred = getEmailProviderId();
  const effective = resolveEffectiveEmailProvider();
  return {
    provider: preferred,
    effectiveProvider: effective,
    configured: effective !== null,
    usingFallback: effective !== null && effective !== preferred,
    sendgrid: {
      hasApiKey: isSendGridConfigured(),
      keyPrefix: process.env.SENDGRID_API_KEY?.substring(0, 7) || "NOT SET",
      fromEmail: process.env.SENDGRID_FROM_EMAIL || "NOT SET",
      fromName: process.env.SENDGRID_FROM_NAME || "NOT SET",
    },
    smtpcom: {
      hasApiKey: !!process.env.SMTPCOM_API_KEY,
      hasChannel: !!process.env.SMTPCOM_CHANNEL,
      channel: process.env.SMTPCOM_CHANNEL || "NOT SET",
      fromEmail: process.env.SMTPCOM_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || "NOT SET",
      fromName: process.env.SMTPCOM_FROM_NAME || process.env.SENDGRID_FROM_NAME || "NOT SET",
    },
  };
}
