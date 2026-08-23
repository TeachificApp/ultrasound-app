import { COOKIE_NAME, LAX_COOKIE_NAME } from "@shared/const";

export type VerifiedSession = {
  openId: string;
  appId: string;
  name: string;
};

/**
 * Pick the first session cookie that verifies successfully.
 *
 * Browsers may still send a stale domain-scoped `app_session_id` after magic-link
 * login sets a fresh `app_session_lax` (host-only). Using primary || lax would
 * always prefer the stale cookie — works in incognito (no stale cookies) but
 * fails in a normal profile.
 */
export async function resolveSessionFromCookies(
  cookies: Map<string, string>,
  verifySession: (value: string) => Promise<VerifiedSession | null>,
): Promise<{ session: VerifiedSession; cookieValue: string } | null> {
  const candidates: string[] = [];
  // Prefer lax (host-only magic-link cookie) before legacy domain-scoped primary cookie.
  for (const name of [LAX_COOKIE_NAME, COOKIE_NAME]) {
    const value = cookies.get(name);
    if (value && !candidates.includes(value)) {
      candidates.push(value);
    }
  }

  for (const cookieValue of candidates) {
    const session = await verifySession(cookieValue);
    if (session) {
      return { session, cookieValue };
    }
  }

  return null;
}

/** True when the request carries session cookies (possibly stale Manus-era JWTs). */
export function requestHasSessionCookies(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  return (
    cookieHeader.includes(`${COOKIE_NAME}=`) ||
    cookieHeader.includes(`${LAX_COOKIE_NAME}=`)
  );
}
