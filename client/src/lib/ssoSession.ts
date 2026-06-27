/**
 * SSO session state helpers.
 *
 * IMPORTANT: All keys use localStorage (not sessionStorage) so that the lock
 * survives page reloads. sessionStorage is cleared on reload in most browsers,
 * which caused the infinite loop: bridge fires → cookie set → reload →
 * sessionStorage cleared → bridge fires again → loop.
 *
 * localStorage persists until explicitly cleared or the TTL expires.
 */

/** localStorage keys */
export const SSO_BRIDGE_KEY = "sso_bridge_attempted_at";
export const SSO_SUCCESS_KEY = "sso_success_at";
export const SSO_BROADCAST_KEY_PREFIX = "sso_broadcast_done";

/** How long to block the bridge after an attempt (5 minutes) */
export const SSO_BRIDGE_RETRY_MS = 5 * 60 * 1000;

/** How long to treat a successful exchange as "done" (5 minutes) */
export const SSO_SUCCESS_TTL_MS = 5 * 60 * 1000;

function readTimestamp(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function writeTimestamp(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage full or private mode */
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Returns true if the bridge was attempted recently enough that we should
 * NOT attempt it again (prevents the reload loop).
 */
export function isSsoBridgeBlocked(): boolean {
  const ts = readTimestamp(SSO_BRIDGE_KEY);
  if (ts === null) return false;
  if (Date.now() - ts >= SSO_BRIDGE_RETRY_MS) {
    removeKey(SSO_BRIDGE_KEY);
    return false;
  }
  return true;
}

export function markSsoBridgeAttempted(): void {
  writeTimestamp(SSO_BRIDGE_KEY);
}

export function clearSsoBridgeLock(): void {
  removeKey(SSO_BRIDGE_KEY);
}

/**
 * Called by useSsoConsumer BEFORE window.location.reload().
 * useSsoBridge checks this flag and skips the bridge if set recently,
 * breaking the reload → bridge → reload loop.
 */
export function markSsoSuccess(): void {
  writeTimestamp(SSO_SUCCESS_KEY);
}

/**
 * Returns true if a successful SSO exchange happened recently.
 * useSsoBridge uses this to skip re-triggering after a successful login.
 */
export function isSsoSuccessRecent(): boolean {
  const ts = readTimestamp(SSO_SUCCESS_KEY);
  if (ts === null) return false;
  if (Date.now() - ts >= SSO_SUCCESS_TTL_MS) {
    removeKey(SSO_SUCCESS_KEY);
    return false;
  }
  return true;
}

export function clearSsoSuccessFlag(): void {
  removeKey(SSO_SUCCESS_KEY);
}

export function broadcastStorageKey(userId: number | string): string {
  return `${SSO_BROADCAST_KEY_PREFIX}_${userId}`;
}

/** Clear SSO gates so a fresh login can broadcast / bridge again */
export function clearSsoSessionLocks(): void {
  clearSsoBridgeLock();
  clearSsoSuccessFlag();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(SSO_BROADCAST_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}
