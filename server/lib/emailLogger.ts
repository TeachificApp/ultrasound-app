/**
 * emailLogger.ts
 * Lightweight helper to log every sent email to the email_send_log table.
 * Call `logEmail()` immediately after a successful SendGrid send.
 * Failures are silently swallowed so they never break the primary email flow.
 */
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export type EmailType =
  | "magic_link"
  | "welcome"
  | "certificate"
  | "enrollment"
  | "campaign"
  | "password_reset"
  | "invite"
  | "purchase_confirmation"
  | "other";

export interface LogEmailParams {
  userId?: number | null;
  recipientEmail: string;
  recipientName?: string | null;
  emailType: EmailType;
  subject: string;
  campaignId?: number | null;
  status?: "sent" | "failed";
  metadata?: Record<string, unknown>;
}

export async function logEmail(params: LogEmailParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      INSERT INTO email_send_log
        (user_id, recipient_email, recipient_name, email_type, subject, campaign_id, status, metadata, sent_at, created_at)
      VALUES
        (${params.userId ?? null},
         ${params.recipientEmail},
         ${params.recipientName ?? null},
         ${params.emailType},
         ${params.subject},
         ${params.campaignId ?? null},
         ${params.status ?? "sent"},
         ${params.metadata ? JSON.stringify(params.metadata) : null},
         NOW(), NOW())
    `);
  } catch {
    // Never let logging failures break the primary flow
  }
}
