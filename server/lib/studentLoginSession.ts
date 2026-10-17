import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../_core/env";

/**
 * A signed, short-lived handoff used only when a Platform Admin opens a separate
 * browser tab as an existing learner. It is deliberately not a session cookie:
 * the administrator's ordinary session remains untouched in their original tab.
 */
export const STUDENT_LOGIN_TOKEN_TTL_MS = 20 * 60 * 1000;
const STUDENT_LOGIN_TOKEN_AUDIENCE = "student-login";

type StudentLoginClaims = {
  targetUserId: number;
  realAdminId: number;
  expiresAt: Date;
};

function sessionSecret() {
  if (!ENV.cookieSecret) {
    throw new Error("Student login is unavailable because the session secret is not configured.");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createStudentLoginToken(params: {
  targetUserId: number;
  realAdminId: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + STUDENT_LOGIN_TOKEN_TTL_MS);
  const token = await new SignJWT({
    purpose: STUDENT_LOGIN_TOKEN_AUDIENCE,
    targetUserId: params.targetUserId,
    realAdminId: params.realAdminId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(sessionSecret());

  return { token, expiresAt };
}

/** Returns null for expired, malformed, or non-student-login tokens. */
export async function verifyStudentLoginToken(token: string | undefined): Promise<StudentLoginClaims | null> {
  if (!token || token.length > 4_096) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (
      payload.purpose !== STUDENT_LOGIN_TOKEN_AUDIENCE ||
      typeof payload.targetUserId !== "number" ||
      !Number.isSafeInteger(payload.targetUserId) ||
      payload.targetUserId <= 0 ||
      typeof payload.realAdminId !== "number" ||
      !Number.isSafeInteger(payload.realAdminId) ||
      payload.realAdminId <= 0 ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return {
      targetUserId: payload.targetUserId,
      realAdminId: payload.realAdminId,
      expiresAt: new Date(payload.exp * 1_000),
    };
  } catch {
    return null;
  }
}
