/**
 * Set session cookies for direct auth flows (magic link, password, SSO exchange).
 *
 * Sets three cookies for maximum compatibility:
 *  1. SameSite=None + Domain (cross-subdomain SSO)
 *  2. SameSite=Lax + Domain (fallback when None is blocked)
 *  3. SameSite=Lax host-only (no Domain) — most reliable for email magic-link
 *     top-level navigations where Domain-scoped cookies are sometimes dropped
 */
import type { Request, Response } from "express";
import {
  clearSessionCookies,
  getHostOnlyLaxSessionCookieOptions,
  getLaxSessionCookieOptions,
  getSessionCookieOptions,
  resolveAuthHostname,
} from "../_core/cookies";
import { COOKIE_NAME, LAX_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export function setAuthSessionCookies(
  req: Request,
  res: Response,
  sessionToken: string,
  hostnameOverride?: string,
): void {
  // Wipe stale domain/host cookie variants before issuing a new session.
  clearSessionCookies(res, req, [COOKIE_NAME, LAX_COOKIE_NAME]);

  const hostname = resolveAuthHostname(req, hostnameOverride) ?? hostnameOverride;
  const maxAge = ONE_YEAR_MS;

  const noneOpts = getSessionCookieOptions(req, hostname);
  res.cookie(COOKIE_NAME, sessionToken, { ...noneOpts, maxAge });

  const laxOpts = getLaxSessionCookieOptions(req, hostname);
  res.cookie(LAX_COOKIE_NAME, sessionToken, { ...laxOpts, maxAge });

  // Host-only Lax — critical for magic links opened from email clients
  const hostOnlyLax = getHostOnlyLaxSessionCookieOptions(req);
  res.cookie(LAX_COOKIE_NAME, sessionToken, { ...hostOnlyLax, maxAge });
}
