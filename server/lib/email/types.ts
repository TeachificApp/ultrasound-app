import type { BrandMode } from "@shared/brands";

export interface EmailRecipient {
  name: string;
  email: string;
}

export interface EmailAttachment {
  /** Base64-encoded file content */
  content: string;
  /** MIME type, e.g. "application/pdf" */
  type: string;
  /** File name shown in the email client */
  filename: string;
  /** SendGrid disposition: "attachment" (default) or "inline" */
  disposition?: "attachment" | "inline";
}

export interface SendEmailOptions {
  to: EmailRecipient;
  subject: string;
  htmlBody: string;
  previewText?: string;
  /** Brand mode for sender override. Defaults to "aaus" if not provided. */
  brandMode?: BrandMode;
  /** Override sender name (campaign sender profiles) */
  fromName?: string;
  /** Override sender email (campaign sender profiles) */
  fromEmail?: string;
  /** List-Unsubscribe header value (RFC 8058 one-click) */
  listUnsubscribeUrl?: string;
  /** Optional file attachments */
  attachments?: EmailAttachment[];
}

export type EmailProviderId = "sendgrid" | "smtpcom";

export interface ResolvedEmailSender {
  email: string;
  name: string;
}
