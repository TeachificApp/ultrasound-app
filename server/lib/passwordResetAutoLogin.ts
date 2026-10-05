/**
 * Password-reset automatic-login handoff.
 *
 * `generateAutoLoginToken` returns only the secret token. The browser must be
 * sent to the verified server route, never to the raw token as a path.
 */
export function buildPasswordResetAutoLoginUrl(token: string): string {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error("An automatic sign-in token is required.");
  }

  return `/api/auth/auto-login?token=${encodeURIComponent(normalizedToken)}`;
}
