const DEVICE_ID_STORAGE_KEY = "aau_active_device_id_v1";

/**
 * Returns an opaque browser-local identifier. It is never displayed or sent to
 * analytics; the server stores only its SHA-256 hash for session comparison.
 */
export function getOrCreateDeviceId(): string {
  try {
    const current = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (current && /^[A-Za-z0-9_-]{24,160}$/.test(current)) return current;
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    const deviceId = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  } catch {
    // Privacy-restricted browsers may not expose localStorage. The server will
    // conservatively present the explicit session choice on a later sign-in.
    return "";
  }
}
