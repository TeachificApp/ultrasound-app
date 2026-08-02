/**
 * sendgridContacts.ts
 *
 * Helpers for syncing subscribers to SendGrid Marketing Contacts.
 * Uses the SendGrid Marketing Contacts v3 API (PUT /v3/marketing/contacts).
 *
 * Docs: https://docs.sendgrid.com/api-reference/contacts/add-or-update-a-contact
 */

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? "";
const SENDGRID_API_BASE = "https://api.sendgrid.com/v3";

export interface SendGridContact {
  email: string;
  first_name?: string;
  last_name?: string;
  /** Optional: SendGrid list IDs to add this contact to */
  list_ids?: string[];
  /** Custom fields — must be pre-created in SendGrid dashboard */
  custom_fields?: Record<string, string | number>;
}

/**
 * Upsert one or more contacts into SendGrid Marketing Contacts.
 * Optionally adds them to specific list IDs.
 * Fails silently — never throws, only logs errors.
 */
export async function upsertSendGridContacts(
  contacts: SendGridContact[],
  listIds?: string[],
): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn("[SendGridContacts] SENDGRID_API_KEY not set — skipping contact sync.");
    return;
  }
  if (contacts.length === 0) return;

  const payload: Record<string, unknown> = {
    contacts: contacts.map((c) => ({
      email: c.email.toLowerCase().trim(),
      ...(c.first_name ? { first_name: c.first_name } : {}),
      ...(c.last_name ? { last_name: c.last_name } : {}),
      ...(c.custom_fields ? { custom_fields: c.custom_fields } : {}),
    })),
  };

  if (listIds && listIds.length > 0) {
    payload.list_ids = listIds;
  }

  try {
    const res = await fetch(`${SENDGRID_API_BASE}/marketing/contacts`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[SendGridContacts] Failed to upsert ${contacts.length} contact(s): HTTP ${res.status} — ${body}`,
      );
    } else {
      console.log(
        `[SendGridContacts] Upserted ${contacts.length} contact(s) to SendGrid Marketing Contacts.`,
      );
    }
  } catch (err) {
    console.error("[SendGridContacts] Network error upserting contacts:", err);
  }
}

/**
 * Look up a SendGrid contact ID by email.
 * Returns the contact ID string or null if not found.
 */
export async function getSendGridContactId(email: string): Promise<string | null> {
  if (!SENDGRID_API_KEY) return null;
  try {
    const res = await fetch(`${SENDGRID_API_BASE}/marketing/contacts/search/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emails: [email.toLowerCase().trim()] }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { result: Record<string, { contact: { id: string } }> };
    const entry = Object.values(data.result ?? {})[0];
    return entry?.contact?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Remove a contact from a specific SendGrid Marketing List (not a global delete).
 * Fails silently.
 */
export async function removeSendGridContactFromList(
  email: string,
  listId: string,
): Promise<void> {
  if (!SENDGRID_API_KEY) return;
  try {
    const contactId = await getSendGridContactId(email);
    if (!contactId) return;
    const res = await fetch(
      `${SENDGRID_API_BASE}/marketing/lists/${listId}/contacts?contact_ids=${contactId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[SendGridContacts] Failed to remove contact from list: HTTP ${res.status} — ${body}`);
    } else {
      console.log(`[SendGridContacts] Removed contact ${email} from list ${listId}.`);
    }
  } catch (err) {
    console.error("[SendGridContacts] Error removing contact from list:", err);
  }
}

/**
 * Get or create a SendGrid Marketing List by name.
 * Returns the list ID string (e.g. "abc123-...").
 * Caches the result in memory so repeated calls are fast.
 */
const listIdCache: Record<string, string> = {};

export async function getOrCreateSendGridList(name: string): Promise<string | null> {
  if (!SENDGRID_API_KEY) return null;
  if (listIdCache[name]) return listIdCache[name];

  try {
    // Fetch all lists
    const res = await fetch(`${SENDGRID_API_BASE}/marketing/lists?page_size=100`, {
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
    });
    if (!res.ok) {
      console.error(`[SendGridContacts] Failed to fetch lists: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json() as { result: Array<{ id: string; name: string }> };
    const existing = data.result?.find((l) => l.name === name);
    if (existing) {
      listIdCache[name] = existing.id;
      return existing.id;
    }

    // Create the list
    const createRes = await fetch(`${SENDGRID_API_BASE}/marketing/lists`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      console.error(`[SendGridContacts] Failed to create list "${name}": HTTP ${createRes.status} — ${body}`);
      return null;
    }
    const created = await createRes.json() as { id: string };
    listIdCache[name] = created.id;
    console.log(`[SendGridContacts] Created SendGrid list "${name}" with ID ${created.id}`);
    return created.id;
  } catch (err) {
    console.error("[SendGridContacts] Error getting/creating list:", err);
    return null;
  }
}
