/**
 * Record a user login in both user_login_events and user_activity_logs.
 * Call from every successful authentication path so admin activity/logins stay in sync.
 */
import type { Request } from "express";
import { userLoginEvents, userActivityLogs } from "../../drizzle/schema";

export type LoginMethod =
  | "password"
  | "magic_link"
  | "access_token"
  | "oauth"
  | "auto_login"
  | "email_auth"
  | "guest_checkout"
  | "unknown";

export function getRequestClientInfo(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    null;
  const userAgent = req.headers["user-agent"]?.substring(0, 500) ?? null;
  return {
    ipAddress: ip ? ip.substring(0, 64) : null,
    userAgent,
  };
}

const METHOD_LABELS: Record<LoginMethod, string> = {
  password: "password",
  magic_link: "magic link",
  access_token: "access link",
  oauth: "OAuth",
  auto_login: "auto-login link",
  email_auth: "email sign-in",
  guest_checkout: "guest checkout",
  unknown: "sign-in",
};

export async function recordUserLogin(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>,
  opts: {
    userId: number;
    ipAddress?: string | null;
    userAgent?: string | null;
    method?: LoginMethod;
  },
): Promise<void> {
  const ip = opts.ipAddress ?? null;
  const userAgent = opts.userAgent ?? null;
  const method = opts.method ?? "unknown";
  const methodLabel = METHOD_LABELS[method] ?? "sign-in";

  try {
    await db.insert(userLoginEvents).values({
      userId: opts.userId,
      ipAddress: ip,
      userAgent,
    });
  } catch (err) {
    console.warn("[recordUserLogin] user_login_events insert failed:", err);
  }

  try {
    await db.insert(userActivityLogs).values({
      userId: opts.userId,
      eventType: "login",
      description: `Logged in via ${methodLabel}${ip ? ` from ${ip}` : ""}`,
      ipAddress: ip,
      userAgent,
      metadata: { method },
    });
  } catch (err) {
    console.warn("[recordUserLogin] user_activity_logs insert failed:", err);
  }
}
