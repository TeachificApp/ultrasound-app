import { getBrandDisplayConfig, type BrandMode } from "@shared/brands";
import type { EmailProviderId, ResolvedEmailSender } from "./types";

function parseProviderId(raw: string | undefined, fallback: EmailProviderId): EmailProviderId {
  const v = (raw ?? fallback).trim().toLowerCase();
  if (v === "sendgrid") return "sendgrid";
  if (v === "smtpcom" || v === "smtp.com" || v === "smtp_com" || v === "smtp") return "smtpcom";
  return fallback;
}

function envFirst(...names: string[]): string {
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return "";
}

/** SMTP.com API key (supports legacy SMPTCOM_* secret typo in some environments). */
export function getSmtpComApiKey(): string {
  return envFirst("SMTPCOM_API_KEY", "SMPTCOM_API_KEY");
}

export function getSmtpComFromEmail(): string {
  return envFirst("SMTPCOM_FROM_EMAIL", "SMPTCOM_FROM_EMAIL");
}

export function getSmtpComFromName(): string {
  return envFirst("SMTPCOM_FROM_NAME", "SMPTCOM_FROM_NAME");
}

export function isSmtpComConfigured(): boolean {
  return !!(getSmtpComApiKey() && process.env.SMTPCOM_CHANNEL?.trim());
}

export function isSendGridConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY?.trim();
}

/** Auth, purchase, password reset, and other service mail (default: SendGrid). */
export function getTransactionalEmailProviderId(): EmailProviderId {
  return parseProviderId(
    process.env.TRANSACTIONAL_EMAIL_PROVIDER ?? process.env.EMAIL_PROVIDER,
    "sendgrid",
  );
}

/** Platform email campaigns and marketing sends (default: SMTP.com). */
export function getCampaignEmailProviderId(): EmailProviderId {
  return parseProviderId(
    process.env.CAMPAIGN_EMAIL_PROVIDER ?? process.env.EMAIL_CAMPAIGN_PROVIDER,
    "smtpcom",
  );
}

/** @deprecated Use getTransactionalEmailProviderId — kept for debug/status callers. */
export function getEmailProviderId(): EmailProviderId {
  return getTransactionalEmailProviderId();
}

export function resolveEffectiveTransactionalProvider(): EmailProviderId | null {
  const preferred = getTransactionalEmailProviderId();
  if (preferred === "sendgrid") {
    if (isSendGridConfigured()) return "sendgrid";
    if (isSmtpComConfigured()) return "smtpcom";
    return null;
  }
  if (isSmtpComConfigured()) return "smtpcom";
  if (isSendGridConfigured()) return "sendgrid";
  return null;
}

export function resolveEffectiveCampaignProvider(): EmailProviderId | null {
  const preferred = getCampaignEmailProviderId();
  if (preferred === "smtpcom") {
    if (isSmtpComConfigured()) return "smtpcom";
    if (isSendGridConfigured()) return "sendgrid";
    return null;
  }
  if (isSendGridConfigured()) return "sendgrid";
  if (isSmtpComConfigured()) return "smtpcom";
  return null;
}

/** @deprecated Use resolveEffectiveTransactionalProvider. */
export function resolveEffectiveEmailProvider(): EmailProviderId | null {
  return resolveEffectiveTransactionalProvider();
}

export function isSendGridProvider(): boolean {
  return resolveEffectiveTransactionalProvider() === "sendgrid";
}

export function isSmtpComProvider(): boolean {
  return resolveEffectiveCampaignProvider() === "smtpcom";
}

export function isEmailProviderConfigured(): boolean {
  return resolveEffectiveTransactionalProvider() !== null;
}

export function isCampaignEmailConfigured(): boolean {
  return resolveEffectiveCampaignProvider() !== null;
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
      ? getSmtpComFromEmail() || process.env.SENDGRID_FROM_EMAIL || brandConfig.senderEmail
      : process.env.SENDGRID_FROM_EMAIL || brandConfig.senderEmail;

  const defaultName =
    provider === "smtpcom"
      ? getSmtpComFromName() || process.env.SENDGRID_FROM_NAME || brandConfig.senderName
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
  const transactionalPreferred = getTransactionalEmailProviderId();
  const campaignPreferred = getCampaignEmailProviderId();
  const transactionalEffective = resolveEffectiveTransactionalProvider();
  const campaignEffective = resolveEffectiveCampaignProvider();
  return {
    provider: transactionalPreferred,
    effectiveProvider: transactionalEffective,
    configured: transactionalEffective !== null,
    usingFallback: transactionalEffective !== null && transactionalEffective !== transactionalPreferred,
    transactionalProvider: transactionalPreferred,
    transactionalEffectiveProvider: transactionalEffective,
    campaignProvider: campaignPreferred,
    campaignEffectiveProvider: campaignEffective,
    campaignConfigured: campaignEffective !== null,
    sendgrid: {
      hasApiKey: isSendGridConfigured(),
      fromEmail: process.env.SENDGRID_FROM_EMAIL || "NOT SET",
      fromName: process.env.SENDGRID_FROM_NAME || "NOT SET",
    },
    smtpcom: {
      hasApiKey: !!getSmtpComApiKey(),
      hasChannel: !!process.env.SMTPCOM_CHANNEL,
      channel: process.env.SMTPCOM_CHANNEL || "NOT SET",
      fromEmail: getSmtpComFromEmail() || process.env.SENDGRID_FROM_EMAIL || "NOT SET",
      fromName: getSmtpComFromName() || process.env.SENDGRID_FROM_NAME || "NOT SET",
    },
  };
}
