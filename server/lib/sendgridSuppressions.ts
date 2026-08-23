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
 *   Global unsubscribes: GET/DELETE /v3/asm/suppressions/global[/{email}]
 *   Bounces/blocks/etc.: GET/DELETE /v3/suppression/{type}[/{email}]
 */

const SENDGRID_API_BASE = "https://api.sendgrid.com/v3";

function getSendGridApiKey(): string {
  return process.env.SENDGRID_API_KEY ?? "";
}

function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getSendGridApiKey()}`,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
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

export type ClearAllSuppressionsResult = Record<
  SendGridSuppressionList,
  { cleared: boolean; status: number; count?: number; error?: string }
>;

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

function bulkSuppressionPath(list: Exclude<SendGridSuppressionList, "global_unsubscribe">): string {
  return `${SENDGRID_API_BASE}/suppression/${list}`;
}

function parseSuppressionPresence(
  list: SendGridSuppressionList,
  body: unknown,
): boolean {
  if (list === "global_unsubscribe") {
    if (!body || typeof body !== "object") return false;
    const recipient = (body as { recipient_email?: unknown }).recipient_email;
    return typeof recipient === "string" && recipient.trim().length > 0;
  }
  return Array.isArray(body) && body.length > 0;
}

async function isOnSuppressionList(
  list: SendGridSuppressionList,
  email: string,
): Promise<boolean> {
  if (!getSendGridApiKey()) return false;
  try {
    const res = await fetch(suppressionPath(list, email), {
      headers: authHeaders(),
    });
    if (res.status === 404) return false;
    if (res.status !== 200) {
      console.warn(
        `[SendGridSuppressions] Unexpected status checking ${list} for ${email}: HTTP ${res.status}`,
      );
      return false;
    }
    const body = await res.json().catch(() => null);
    return parseSuppressionPresence(list, body);
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
      headers: authHeaders(),
    });
    // Global unsubscribe DELETE returns 204 even when already absent.
    if (list === "global_unsubscribe" && res.status === 204) {
      const after = await isOnSuppressionList(list, email);
      return { removed: !after, status: res.status };
    }
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

async function listAllGlobalUnsubscribes(): Promise<string[]> {
  const emails: string[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const res = await fetch(
      `${SENDGRID_API_BASE}/asm/suppressions/global?limit=${limit}&offset=${offset}`,
      { headers: authHeaders() },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to list global suppressions: HTTP ${res.status} ${text}`);
    }
    const body = (await res.json()) as Array<{ recipient_email?: string }>;
    if (!Array.isArray(body) || body.length === 0) break;
    for (const row of body) {
      if (row.recipient_email) emails.push(normalizeEmail(row.recipient_email));
    }
    if (body.length < limit) break;
    offset += limit;
  }

  return emails;
}

async function clearBulkSuppressionList(
  list: Exclude<SendGridSuppressionList, "global_unsubscribe">,
): Promise<{ cleared: boolean; status: number; error?: string }> {
  if (!getSendGridApiKey()) return { cleared: false, status: 0, error: "missing_api_key" };
  try {
    const res = await fetch(bulkSuppressionPath(list), {
      method: "DELETE",
      headers: authHeaders(true),
      body: JSON.stringify({ delete_all: true }),
    });
    if (res.status === 204 || res.ok) {
      console.log(`[SendGridSuppressions] Cleared all entries from ${list}`);
      return { cleared: true, status: res.status };
    }
    const text = await res.text();
    return { cleared: false, status: res.status, error: text };
  } catch (err) {
    return {
      cleared: false,
      status: 0,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function getSendGridSuppressionStatus(
  email: string,
): Promise<SendGridSuppressionStatus> {
  const normalized = normalizeEmail(email);
  const entries = await Promise.all(
    SENDGRID_SUPPRESSION_LISTS.map(
      async (list) => [list, await isOnSuppressionList(list, normalized)] as const,
    ),
  );
  return Object.fromEntries(entries) as SendGridSuppressionStatus;
}

export function isSendGridDeliveryBlocked(status: SendGridSuppressionStatus): boolean {
  return SENDGRID_SUPPRESSION_LISTS.some((list) => status[list]);
}

/**
 * Remove an address from all SendGrid suppression lists so transactional mail can deliver.
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
 * Wipe every SendGrid suppression list for this account.
 * Global unsubscribes must be deleted one-by-one; other lists support delete_all.
 */
export async function clearAllSendGridSuppressionLists(): Promise<ClearAllSuppressionsResult> {
  const result: Partial<ClearAllSuppressionsResult> = {};

  const bulkLists = ["bounces", "blocks", "spam_reports", "invalid_emails"] as const;
  for (const list of bulkLists) {
    result[list] = await clearBulkSuppressionList(list);
  }

  if (!getSendGridApiKey()) {
    result.global_unsubscribe = { cleared: false, status: 0, error: "missing_api_key" };
    return result as ClearAllSuppressionsResult;
  }

  try {
    const emails = await listAllGlobalUnsubscribes();
    let removed = 0;
    for (const email of emails) {
      const { removed: wasRemoved } = await removeFromSuppressionList("global_unsubscribe", email);
      if (wasRemoved) removed += 1;
    }
    result.global_unsubscribe = {
      cleared: true,
      status: 204,
      count: removed,
    };
  } catch (err) {
    result.global_unsubscribe = {
      cleared: false,
      status: 0,
      error: err instanceof Error ? err.message : "unknown",
    };
  }

  return result as ClearAllSuppressionsResult;
}

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
      headers: authHeaders(true),
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
