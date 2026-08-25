import { and, eq, gte, sql } from "drizzle-orm";
import {
  AUTH_EMAIL_COOLDOWN_MS,
  AUTH_EMAIL_MAX_PER_ADDRESS_HOUR,
  AUTH_EMAIL_MAX_PER_IP_HOUR,
  normalizeAuthEmailForRateLimit,
  type AuthEmailRateLimitResult,
  type AuthEmailType,
} from "../../shared/authEmailRateLimit";
import { authEmailSendLog } from "../../drizzle/schema";
import { getDb } from "../db";

const HOUR_MS = 60 * 60 * 1000;

function formatSqlError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as Error & { cause?: unknown }).cause;
  const parts = [error.message];
  if (cause instanceof Error) parts.push(cause.message);
  return parts.join(" | ");
}

/** Gracefully allow sends when the log table is missing (pre-migration). */
function isMissingAuthEmailLogTable(error: unknown): boolean {
  const message = formatSqlError(error).toLowerCase();
  if (!message.includes("auth_email_send_log")) return false;
  return (
    message.includes("doesn't exist")
    || message.includes("unknown table")
    || message.includes("er_no_such_table")
    || message.includes("failed query")
  );
}

export async function checkAuthEmailRateLimit(input: {
  email: string;
  type: AuthEmailType;
  ipAddress: string | null;
}): Promise<AuthEmailRateLimitResult> {
  const db = await getDb();
  if (!db) return { allowed: true };

  const email = normalizeAuthEmailForRateLimit(input.email);
  const now = Date.now();
  const hourAgo = new Date(now - HOUR_MS);
  const cooldownSince = new Date(now - AUTH_EMAIL_COOLDOWN_MS);

  try {
    const [hourlyEmail] = await db.select({ count: sql<number>`count(*)` })
      .from(authEmailSendLog)
      .where(and(
        eq(authEmailSendLog.email, email),
        eq(authEmailSendLog.emailType, input.type),
        gte(authEmailSendLog.sentAt, hourAgo),
      ));
    if (Number(hourlyEmail?.count ?? 0) >= AUTH_EMAIL_MAX_PER_ADDRESS_HOUR) {
      return { allowed: false, reason: "email_hourly" };
    }

    const [cooldownRow] = await db.select({ count: sql<number>`count(*)` })
      .from(authEmailSendLog)
      .where(and(
        eq(authEmailSendLog.email, email),
        eq(authEmailSendLog.emailType, input.type),
        gte(authEmailSendLog.sentAt, cooldownSince),
      ));
    if (Number(cooldownRow?.count ?? 0) >= 1) {
      return { allowed: false, reason: "cooldown" };
    }

    if (input.ipAddress) {
      const [hourlyIp] = await db.select({ count: sql<number>`count(*)` })
        .from(authEmailSendLog)
        .where(and(
          eq(authEmailSendLog.ipAddress, input.ipAddress),
          gte(authEmailSendLog.sentAt, hourAgo),
        ));
      if (Number(hourlyIp?.count ?? 0) >= AUTH_EMAIL_MAX_PER_IP_HOUR) {
        return { allowed: false, reason: "ip_hourly" };
      }
    }
  } catch (error) {
    if (!isMissingAuthEmailLogTable(error)) throw error;
    console.warn("[auth-email-rate-limit] auth_email_send_log missing — skipping rate limit until migration runs");
  }

  return { allowed: true };
}

export async function recordAuthEmailSend(input: {
  email: string;
  type: AuthEmailType;
  ipAddress: string | null;
  userId?: number | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(authEmailSendLog).values({
      email: normalizeAuthEmailForRateLimit(input.email),
      emailType: input.type,
      ipAddress: input.ipAddress,
      userId: input.userId ?? null,
    });
  } catch (error) {
    if (!isMissingAuthEmailLogTable(error)) throw error;
  }
}

export async function shouldSendAuthEmail(input: {
  email: string;
  type: AuthEmailType;
  ipAddress: string | null;
  userId?: number | null;
}): Promise<AuthEmailRateLimitResult> {
  const result = await checkAuthEmailRateLimit(input);
  if (!result.allowed) {
    console.warn(
      `[auth-email-rate-limit] Blocked ${input.type} for ${normalizeAuthEmailForRateLimit(input.email)}`
      + ` (${result.reason}) from IP ${input.ipAddress ?? "unknown"}`,
    );
  }
  return result;
}

export async function markAuthEmailSent(input: {
  email: string;
  type: AuthEmailType;
  ipAddress: string | null;
  userId?: number | null;
}): Promise<void> {
  await recordAuthEmailSend(input);
}
