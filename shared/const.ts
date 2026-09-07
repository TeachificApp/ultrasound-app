export const COOKIE_NAME = "app_session_id";
export const LAX_COOKIE_NAME = "app_session_lax"; // SameSite=Lax fallback for browsers blocking SameSite=None
export const DEMO_COOKIE_NAME = "app_demo_session";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const TWO_HOURS_MS = 1000 * 60 * 60 * 2;
/** Maximum lifetime for a user-confirmed active-session replacement choice. */
export const SESSION_REPLACEMENT_TOKEN_TTL_MS = 10 * 60 * 1000;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
