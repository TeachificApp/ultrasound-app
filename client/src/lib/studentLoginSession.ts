const STUDENT_LOGIN_TOKEN_QUERY_PARAM = "student_login";
const STUDENT_LOGIN_TOKEN_STORAGE_KEY = "aau_student_login_token";

/**
 * Captures a one-time URL handoff into tab-scoped storage, then removes it from
 * the address bar so it is not retained in copied links, browser history, or
 * referrer URLs. The server still validates the signed token on every request.
 */
export function captureStudentLoginTokenFromUrl(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const token = url.searchParams.get(STUDENT_LOGIN_TOKEN_QUERY_PARAM);
  if (!token) return;

  try {
    window.sessionStorage.setItem(STUDENT_LOGIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage can be unavailable in privacy-restricted browser modes. Keep the
    // token in the URL for this initial page load rather than silently signing
    // the administrator into the wrong account.
    return;
  }

  url.searchParams.delete(STUDENT_LOGIN_TOKEN_QUERY_PARAM);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function getStudentLoginToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STUDENT_LOGIN_TOKEN_STORAGE_KEY);
  } catch {
    return new URL(window.location.href).searchParams.get(STUDENT_LOGIN_TOKEN_QUERY_PARAM);
  }
}

export function isStudentLoginActive(): boolean {
  return Boolean(getStudentLoginToken());
}

export function clearStudentLoginSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STUDENT_LOGIN_TOKEN_STORAGE_KEY);
  } catch {
    // Nothing else to clear when storage is unavailable.
  }
}
