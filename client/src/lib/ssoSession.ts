/** Session storage keys used by cross-domain SSO hooks */
export const SSO_BRIDGE_KEY = "sso_bridge_attempted";
export const SSO_BROADCAST_KEY_PREFIX = "sso_broadcast_done";

/** How long to wait before retrying redirect-based SSO bridge (ms) */
export const SSO_BRIDGE_RETRY_MS = 3 * 60 * 1000;

export function isSsoBridgeBlocked(): boolean {
  const raw = sessionStorage.getItem(SSO_BRIDGE_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) {
    sessionStorage.removeItem(SSO_BRIDGE_KEY);
    return false;
  }
  if (Date.now() - ts >= SSO_BRIDGE_RETRY_MS) {
    sessionStorage.removeItem(SSO_BRIDGE_KEY);
    return false;
  }
  return true;
}

export function markSsoBridgeAttempted(): void {
  sessionStorage.setItem(SSO_BRIDGE_KEY, String(Date.now()));
}

export function clearSsoBridgeLock(): void {
  sessionStorage.removeItem(SSO_BRIDGE_KEY);
}

export function broadcastStorageKey(userId: number | string): string {
  return `${SSO_BROADCAST_KEY_PREFIX}_${userId}`;
}

/** Clear SSO gates so a fresh login can broadcast / bridge again */
export function clearSsoSessionLocks(): void {
  clearSsoBridgeLock();
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(SSO_BROADCAST_KEY_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  }
}
