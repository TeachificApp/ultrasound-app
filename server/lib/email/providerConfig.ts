import { getBrandDisplayConfig, type BrandMode } from "@shared/brands";
import type { EmailProviderId, ResolvedEmailSender, SendEmailOptions } from "./types";

/** Legacy configuration preference; message routing is governed by its delivery class below. */
export function getEmailProviderId(): EmailProviderId {
  const raw = (process.env.EMAIL_PROVIDER ?? "sendgrid").trim().toLowerCase();
  if (raw === "sendgrid") return "sendgrid";
  if (raw === "smtpcom" || raw === "smtp.com" || raw === "smtp_com" || raw === "smtp") return "smtpcom";
  return "sendgrid";
}

export function isSmtpComConfigured(): boolean {
  return !!(process.env.SMTPCOM_API_KEY?.trim() && process.env.SMTPCOM_CHANNEL?.trim());
}

export function isSendGridConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY?.trim();
}

/** Campaigns use SMTP.com; account, security, billing, receipt and access messages stay on SendGrid. */
export function getMessageEmailProvider(opts: Pick<SendEmailOptions, "transactional" | "campaignId" | "listUnsubscribeUrl">): EmailProviderId {
  const transactional = opts.transactional ?? !(opts.campaignId || opts.listUnsubscribeUrl);
  return transactional ? "sendgrid" : "smtpcom";
}

/**
 * Default transactional provider readiness. Marketing has its own explicit
 * SMTP.com configuration and must never be used as a transactional fallback.
 */
export function resolveEffectiveEmailProvider(): EmailProviderId | null {
  return isSendGridConfigured() ? "sendgrid" : null;
}

export function isSendGridProvider(): boolean {
  return resolveEffectiveEmailProvider() === "sendgrid";
}

export function isSmtpComProvider(): boolean {
  return isSmtpComConfigured();
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
  const provider = opts.provider ?? "sendgrid";

  const defaultEmail =
    provider === "smtpcom"
      ? process.env.SMTPCOM_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || brandConfig.senderEmail
      : process.env.SENDGRID_FROM_EMAIL || brandConfig.senderEmail;

  const defaultName =
    provider === "smtpcom"
      ? process.env.SMTPCOM_FROM_NAME || process.env.SENDGRID_FROM_NAME || brandConfig.senderName
      : process.env.SENDGRID_FROM_NAME || brandConfig.senderName;

  // Provider-level names identify the sending infrastructure, not the product
  // the member interacted with. When a caller has selected a brand, its display
  // name must be visible in the recipient's mailbox. An explicit campaign
  // `fromName` remains the only override.
  const senderName = opts.fromName || (opts.brandMode ? brandConfig.senderName : defaultName);

  return {
    email: opts.fromEmail || defaultEmail,
    name: senderName,
  };
}

export function emailProviderStatus() {
  const preferred = getEmailProviderId();
  const effective = resolveEffectiveEmailProvider();
  return {
    transactionalProvider: "sendgrid",
    transactionalConfigured: isSendGridConfigured(),
    campaignProvider: "smtpcom",
    campaignConfigured: isSmtpComConfigured(),
    legacyPreference: preferred,
    provider: "sendgrid",
    effectiveProvider: effective,
    configured: effective !== null,
    usingFallback: false,
    sendgrid: {
      hasApiKey: isSendGridConfigured(),
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
