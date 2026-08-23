/**
 * sendgridSuppressions.ts
 *
 * Helpers for managing SendGrid suppression lists.
 *
 * When a user unsubscribes, bounces, or marks mail as spam, SendGrid adds the
 * address to a suppression list. The Mail Send API may still return 202 Accepted
 * while silently skipping delivery — which looks like "emailSent: true" in app logs.
 *
 * API reference:
 *   Global unsubscribes: POST/GET/DELETE /v3/asm/suppressions/global[/{email}]
 *   Bounces/blocks/etc.: GET/DELETE /v3/suppression/{type}/{email}
 */

const SENDGRID_API_BASE = "https://api.sendgrid.com/v3";

function getSendGridApiKey(): string {
  return process.env.SENDGRID_API_KEY ?? "";
}

export const SENDGRID_SUPPRESSION_LISTS = [
  "global_unsubscribe",
  "bounces",
  "blocks",
  "spam_reports",
  "invalid_emails",
] as const;

export type SendGridSuppressionList = (typeof SENDGRID_SUPPRESSION_LISTS)[number];

export type SendGridSuppressionStatus = Record<SendGridSuppressionList, boolean>;

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function suppressionPath(list: SendGridSuppressionList, email: string): string {
  const encoded = encodeURIComponent(normalizeEmail(email));
  switch (list) {
    case "global_unsubscribe":
      return `${SENDGRID_API_BASE}/asm/suppressions/global/${encoded}`;
    case "bounces":
    case "blocks":
    case "spam_reports":
    case "invalid_emails":
      return `${SENDGRID_API_BASE}/suppression/${list}/${encoded}`;
  }
}

async function isOnSuppressionList(
  list: SendGridSuppressionList,
  email: string,
): Promise<boolean> {
  if (!getSendGridApiKey()) return false;
  try {
    const res = await fetch(suppressionPath(list, email), {
      headers: { Authorization: `Bearer ${getSendGridApiKey()}` },
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    console.warn(
      `[SendGridSuppressions] Unexpected status checking ${list} for ${email}: HTTP ${res.status}`,
    );
    return false;
  } catch (err) {
    console.error(`[SendGridSuppressions] Error checking ${list} for ${email}:`, err);
    return false;
  }
}

async function removeFromSuppressionList(
  list: SendGridSuppressionList,
  email: string,
): Promise<{ removed: boolean; status: number }> {
  if (!getSendGridApiKey()) return { removed: false, status: 0 };
  try {
    const res = await fetch(suppressionPath(list, email), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getSendGridApiKey()}` },
    });
    if (res.ok || res.status === 404) {
      if (res.status !== 404) {
        console.log(`[SendGridSuppressions] Removed ${email} from ${list}`);
      }
      return { removed: res.status !== 404, status: res.status };
    }
    console.error(
      `[SendGridSuppressions] Failed to remove ${email} from ${list}: HTTP ${res.status}`,
    );
    return { removed: false, status: res.status };
  } catch (err) {
    console.error(`[SendGridSuppressions] Error removing ${email} from ${list}:`, err);
    return { removed: false, status: 0 };
  }
}

export async function getSendGridSuppressionStatus(
  email: string,
): Promise<SendGridSuppressionStatus> {
  const normalized = normalizeEmail(email);
  const entries = await Promise.all(
    SENDGRID_SUPPRESSION_LISTS.map(async (list) => [list, await isOnSuppressionList(list, normalized)] as const),
  );
  return Object.fromEntries(entries) as SendGridSuppressionStatus;
}

export function isSendGridDeliveryBlocked(status: SendGridSuppressionStatus): boolean {
  return SENDGRID_SUPPRESSION_LISTS.some((list) => status[list]);
}

/**
 * Remove an address from all SendGrid suppression lists so transactional mail can deliver.
 * Use when the user explicitly requests magic-link or password-reset email.
 */
export async function clearSendGridSuppressionLists(
  email: string,
  lists: readonly SendGridSuppressionList[] = SENDGRID_SUPPRESSION_LISTS,
): Promise<Record<SendGridSuppressionList, { removed: boolean; status: number }>> {
  const normalized = normalizeEmail(email);
  const results = await Promise.all(
    lists.map(async (list) => {
      const result = await removeFromSuppressionList(list, normalized);
      return [list, result] as const;
    }),
  );
  return Object.fromEntries(results) as Record<
    SendGridSuppressionList,
    { removed: boolean; status: number }
  >;
}

/**
 * Add one or more email addresses to SendGrid's Global Unsubscribe list.
 * Safe to call multiple times — SendGrid deduplicates automatically.
 * Fails silently (logs error) so it never blocks the main unsubscribe flow.
 */
export async function addToSendGridGlobalUnsubscribes(emails: string[]): Promise<void> {
  if (!getSendGridApiKey()) {
    console.warn("[SendGridSuppressions] SENDGRID_API_KEY not set — skipping global unsubscribe.");
    return;
  }
  if (emails.length === 0) return;

  const normalised = Array.from(new Set(emails.map(normalizeEmail).filter(Boolean)));

  try {
    const res = await fetch(`${SENDGRID_API_BASE}/asm/suppressions/global`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSendGridApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_emails: normalised }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[SendGridSuppressions] Failed to add ${normalised.length} email(s) to global unsubscribes: HTTP ${res.status} — ${body}`,
      );
    } else {
      console.log(
        `[SendGridSuppressions] Added ${normalised.length} email(s) to SendGrid global unsubscribe list.`,
      );
    }
  } catch (err) {
    console.error("[SendGridSuppressions] Network error adding to global unsubscribes:", err);
  }
}

/** @deprecated Use getSendGridSuppressionStatus(email).global_unsubscribe */
export async function isOnSendGridGlobalUnsubscribes(email: string): Promise<boolean> {
  const status = await getSendGridSuppressionStatus(email);
  return status.global_unsubscribe;
}

/** @deprecated Use clearSendGridSuppressionLists(email, ["global_unsubscribe"]) */
export async function removeFromSendGridGlobalUnsubscribes(email: string): Promise<void> {
  await clearSendGridSuppressionLists(email, ["global_unsubscribe"]);
}
