/**
 * sendgridSuppressions.ts
 *
 * Helpers for managing SendGrid's Global Unsubscribe (suppression) list.
 *
 * When a user unsubscribes in either UltrasoundAssist or iHeartEcho, their
 * email is added to SendGrid's global suppression list. SendGrid will then
 * automatically block delivery to that address for ALL sends from this
 * SendGrid account — regardless of which app triggers the send.
 *
 * API reference:
 *   POST https://api.sendgrid.com/v3/asm/suppressions/global
 *   GET  https://api.sendgrid.com/v3/asm/suppressions/global/{email}
 *   DELETE https://api.sendgrid.com/v3/asm/suppressions/global/{email}
 */

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? "";
const SENDGRID_API_BASE = "https://api.sendgrid.com/v3";

/**
 * Add one or more email addresses to SendGrid's Global Unsubscribe list.
 * Safe to call multiple times — SendGrid deduplicates automatically.
 * Fails silently (logs error) so it never blocks the main unsubscribe flow.
 */
export async function addToSendGridGlobalUnsubscribes(emails: string[]): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn("[SendGridSuppressions] SENDGRID_API_KEY not set — skipping global unsubscribe.");
    return;
  }
  if (emails.length === 0) return;

  // Normalise: lowercase, trim, deduplicate
  const normalised = Array.from(new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean)));

  try {
    const res = await fetch(`${SENDGRID_API_BASE}/asm/suppressions/global`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_emails: normalised }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[SendGridSuppressions] Failed to add ${normalised.length} email(s) to global unsubscribes: HTTP ${res.status} — ${body}`
      );
    } else {
      console.log(
        `[SendGridSuppressions] Added ${normalised.length} email(s) to SendGrid global unsubscribe list.`
      );
    }
  } catch (err) {
    console.error("[SendGridSuppressions] Network error adding to global unsubscribes:", err);
  }
}

/**
 * Check if an email is on SendGrid's Global Unsubscribe list.
 * Returns true if suppressed, false if not (or if API unavailable).
 */
export async function isOnSendGridGlobalUnsubscribes(email: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) return false;
  const encoded = encodeURIComponent(email.toLowerCase().trim());
  try {
    const res = await fetch(`${SENDGRID_API_BASE}/asm/suppressions/global/${encoded}`, {
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    return false;
  } catch {
    return false;
  }
}

/**
 * Remove an email from SendGrid's Global Unsubscribe list (re-subscribe).
 * Use with caution — only call when user explicitly opts back in.
 */
export async function removeFromSendGridGlobalUnsubscribes(email: string): Promise<void> {
  if (!SENDGRID_API_KEY) return;
  const encoded = encodeURIComponent(email.toLowerCase().trim());
  try {
    const res = await fetch(`${SENDGRID_API_BASE}/asm/suppressions/global/${encoded}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
    });
    if (!res.ok && res.status !== 404) {
      console.error(`[SendGridSuppressions] Failed to remove ${email} from global unsubscribes: HTTP ${res.status}`);
    } else {
      console.log(`[SendGridSuppressions] Removed ${email} from SendGrid global unsubscribe list.`);
    }
  } catch (err) {
    console.error("[SendGridSuppressions] Network error removing from global unsubscribes:", err);
  }
}
