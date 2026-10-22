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
  /**
   * Marks a message as transactional when an unusual sender needs to override
   * automatic classification. Outbound messages are transactional by default;
   * a campaign ID or List-Unsubscribe header marks a message as marketing.
   */
  transactional?: boolean;
  /** Optional file attachments */
  attachments?: EmailAttachment[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  /** Routes secure learner access plus token-free payer/admin purchase receipts. */
  purchaseAccess?: {
    /** Purchaser when access is assigned to a different learner. */
    payee?: EmailRecipient | null;
    /** Non-secret operational data included only in the platform-admin receipt. */
    userId?: number | null;
    contentTitle?: string | null;
    amountCents?: number | null;
    currency?: string | null;
  };
  /**
   * Non-PII campaign identifier forwarded to SendGrid as a custom argument.
   * It associates Event Webhook delivery outcomes with the originating
   * platform campaign without transmitting recipient identity as metadata.
   */
  campaignId?: number;
}

export type EmailProviderId = "sendgrid" | "smtpcom";

export interface ResolvedEmailSender {
  email: string;
  name: string;
}
