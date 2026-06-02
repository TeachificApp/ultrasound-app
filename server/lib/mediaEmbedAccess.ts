/**
 * Short-lived signed tokens for cookieless media embeds (SCORM/HTML in iframes).
 * Issued after authenticated enrollment/admin checks; verified in mediaServe resolveMedia.
 */
import crypto from "crypto";
import { ENV } from "../_core/env";

const VIEWER_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function signMediaViewerToken(
  slug: string,
  userId: number,
  courseId?: number | null
): string {
  const exp = Date.now() + VIEWER_TOKEN_TTL_MS;
  const coursePart = courseId != null ? String(courseId) : "";
  const payload = `${slug}:${userId}:${coursePart}:${exp}`;
  const hmac = crypto.createHmac("sha256", ENV.cookieSecret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function verifyMediaViewerToken(
  accessToken: string,
  expectedSlug: string
): { userId: number; courseId: number | null } | null {
  if (!ENV.cookieSecret) return null;
  try {
    const decoded = Buffer.from(accessToken, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon <= 0) return null;
    const hmac = decoded.slice(lastColon + 1);
    const payload = decoded.slice(0, lastColon);
    const parts = payload.split(":");
    if (parts.length !== 4) return null;
    const [slug, userIdStr, courseIdStr, expStr] = parts;
    if (slug !== expectedSlug) return null;
    const userId = parseInt(userIdStr, 10);
    const exp = parseInt(expStr, 10);
    if (isNaN(userId) || isNaN(exp)) return null;
    if (Date.now() > exp) return null;
    const expected = crypto.createHmac("sha256", ENV.cookieSecret).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }
    const courseId = courseIdStr ? parseInt(courseIdStr, 10) : null;
    return { userId, courseId: courseId != null && !isNaN(courseId) ? courseId : null };
  } catch {
    return null;
  }
}

export function buildMediaAuthQuery(params: { token?: string; access?: string }): string {
  const parts: string[] = [];
  if (params.token) parts.push(`token=${encodeURIComponent(params.token)}`);
  if (params.access) parts.push(`access=${encodeURIComponent(params.access)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
