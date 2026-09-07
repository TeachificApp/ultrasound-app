/**
 * Server-enforced active-session policy for ordinary users.
 *
 * The database stores only opaque random session identifiers, never session
 * cookies or device fingerprints. A second login receives a short-lived signed
 * replacement token and no session cookie until the user explicitly confirms.
 */
import * as crypto from "crypto";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { userActiveSessions, userRoles, type User } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { SESSION_REPLACEMENT_TOKEN_TTL_MS, ONE_YEAR_MS } from "@shared/const";
import { setAuthSessionCookies } from "./setAuthSessionCookies";
import { resolveSessionFromCookies } from "./resolveSessionCookie";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

const REPLACEMENT_AUDIENCE = "single-device-session-replacement";

export type PreparedUserSession =
  | { status: "issued"; sessionId: string }
  | { status: "replacement_required"; sessionReplacementToken: string };

function sessionSecret(): Uint8Array {
  if (!ENV.cookieSecret) throw new Error("Session secret is not configured");
  return new TextEncoder().encode(ENV.cookieSecret);
}

function newSessionId(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashDeviceId(deviceId: string | undefined): string | null {
  if (!deviceId || !/^[A-Za-z0-9_-]{24,160}$/.test(deviceId)) return null;
  return crypto.createHash("sha256").update(deviceId).digest("hex");
}

/** Read the opaque session identifier from an authenticated first-party request. */
export async function getSignedSessionId(req: Request): Promise<string | null> {
  const cookies = new Map(Object.entries(parseCookieHeader(req.headers.cookie ?? "")));
  const resolved = await resolveSessionFromCookies(cookies, (value) => sdk.verifySession(value));
  return resolved?.session.sessionId ?? null;
}

export async function isPlatformAdminUser(db: Db, user: Pick<User, "id" | "role">): Promise<boolean> {
  if (user.role === "admin") return true;
  const [role] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, "platform_admin")))
    .limit(1);
  return Boolean(role);
}

async function createReplacementToken(
  userId: number,
  proposedSessionId: string,
  deviceHash: string | null,
): Promise<string> {
  const issuedAt = Date.now();
  return new SignJWT({ userId, proposedSessionId, deviceHash })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience(REPLACEMENT_AUDIENCE)
    .setIssuedAt(Math.floor(issuedAt / 1000))
    .setExpirationTime(Math.floor((issuedAt + SESSION_REPLACEMENT_TOKEN_TTL_MS) / 1000))
    .sign(sessionSecret());
}

async function readReplacementToken(
  token: string,
): Promise<{ userId: number; proposedSessionId: string; deviceHash: string | null } | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"], audience: REPLACEMENT_AUDIENCE });
    const userId = payload.userId;
    const proposedSessionId = payload.proposedSessionId;
    const deviceHash = typeof payload.deviceHash === "string" ? payload.deviceHash : null;
    if (!Number.isInteger(userId) || typeof proposedSessionId !== "string" || proposedSessionId.length < 24) return null;
    return { userId: Number(userId), proposedSessionId, deviceHash };
  } catch {
    return null;
  }
}

async function activateSession(
  db: Db,
  userId: number,
  sessionId: string,
  deviceHash: string | null,
): Promise<void> {
  const [existing] = await db
    .select({ userId: userActiveSessions.userId })
    .from(userActiveSessions)
    .where(eq(userActiveSessions.userId, userId))
    .limit(1);
  if (existing) {
    await db.update(userActiveSessions).set({ sessionId, deviceHash: deviceHash ?? "unknown", updatedAt: new Date() }).where(eq(userActiveSessions.userId, userId));
    return;
  }
  await db.insert(userActiveSessions).values({ userId, sessionId, deviceHash: deviceHash ?? "unknown" });
}

/** Persist a pre-approved new session for a non-admin account. */
export async function activatePreparedUserSession(
  db: Db,
  user: Pick<User, "id" | "role">,
  sessionId: string,
  deviceId?: string,
): Promise<void> {
  if (ENV.authBackend !== "local" || await isPlatformAdminUser(db, user)) return;
  await activateSession(db, user.id, sessionId, hashDeviceId(deviceId));
}

/** Pre-flight a passwordless or password session before any cookie is issued. */
export async function prepareUserSession(
  db: Db,
  user: Pick<User, "id" | "role">,
  deviceId?: string,
): Promise<PreparedUserSession> {
  if (ENV.authBackend !== "local" || await isPlatformAdminUser(db, user)) {
    return { status: "issued", sessionId: newSessionId() };
  }

  const [active] = await db
    .select({ sessionId: userActiveSessions.sessionId, deviceHash: userActiveSessions.deviceHash })
    .from(userActiveSessions)
    .where(eq(userActiveSessions.userId, user.id))
    .limit(1);
  if (!active) return { status: "issued", sessionId: newSessionId() };

  const deviceHash = hashDeviceId(deviceId);
  if (deviceHash && active.deviceHash === deviceHash) {
    return { status: "issued", sessionId: active.sessionId };
  }

  return {
    status: "replacement_required",
    sessionReplacementToken: await createReplacementToken(user.id, newSessionId(), deviceHash),
  };
}

/** Confirm the author-selected replacement and issue the only active user session. */
export async function confirmUserSessionReplacement(
  db: Db,
  token: string,
): Promise<{ userId: number; sessionId: string } | null> {
  const replacement = await readReplacementToken(token);
  if (!replacement) return null;
  await activateSession(db, replacement.userId, replacement.proposedSessionId, replacement.deviceHash);
  return { userId: replacement.userId, sessionId: replacement.proposedSessionId };
}

/** Issue a session already approved by pre-flight or explicit replacement confirmation. */
export async function issueApprovedUserSession(opts: {
  req: Request;
  res: Response;
  openId: string;
  name: string;
  sessionId: string;
  hostnameOverride?: string;
}): Promise<void> {
  const sessionToken = await sdk.createSessionToken(opts.openId, {
    name: opts.name,
    expiresInMs: ONE_YEAR_MS,
    sessionId: opts.sessionId,
  });
  setAuthSessionCookies(opts.req, opts.res, sessionToken, opts.hostnameOverride);
}

/** True when this signed cookie is the active non-admin session. */
export async function isAuthenticatedSessionActive(
  db: Db,
  user: Pick<User, "id" | "role">,
  sessionId: string | undefined,
): Promise<boolean> {
  if (ENV.authBackend !== "local" || await isPlatformAdminUser(db, user)) return true;
  const [active] = await db
    .select({ sessionId: userActiveSessions.sessionId })
    .from(userActiveSessions)
    .where(eq(userActiveSessions.userId, user.id))
    .limit(1);
  // Existing cookies predating the policy work until the account next creates an
  // active-session row. Once a new session is chosen, older unsigned cookies fail.
  if (!active) {
    if (sessionId) await activateSession(db, user.id, sessionId, null);
    return true;
  }
  return Boolean(sessionId && active.sessionId === sessionId);
}

/** Intentionally release the matching session during a real logout only. */
export async function releaseAuthenticatedSession(db: Db, userId: number, sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  await db.delete(userActiveSessions).where(and(eq(userActiveSessions.userId, userId), eq(userActiveSessions.sessionId, sessionId)));
}
