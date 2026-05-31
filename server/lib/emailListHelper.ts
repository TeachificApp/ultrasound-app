/**
 * emailListHelper.ts
 * Shared helpers for managing email lists and subscribers.
 *
 * Key exports:
 *   addToEmailList(email, name?, options?) — upsert a subscriber into a list
 *   addToAllContacts(email, name?, options?) — add to the master "All Contacts" list
 *   ensureAllContactsList() — get or create the "All Contacts" list, returns its ID
 *   backfillAllContacts() — one-time backfill of all existing users into All Contacts
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { emailLists, emailListSubscribers, users } from "../../drizzle/schema";

// Cache the All Contacts list ID so we don't query on every call
let allContactsListId: number | null = null;

/** Get or create the master "All Contacts" email list. Returns its ID. */
export async function ensureAllContactsList(): Promise<number> {
  if (allContactsListId) return allContactsListId;
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Try to find existing
  const existing = await db
    .select({ id: emailLists.id })
    .from(emailLists)
    .where(eq(emailLists.name, "All Contacts"))
    .limit(1);

  if (existing[0]) {
    allContactsListId = existing[0].id;
    return allContactsListId;
  }

  // Create it
  const [result] = await db.insert(emailLists).values({
    name: "All Contacts",
    description: "Automatically populated with every contact who interacts with the platform (registrations, purchases, enrollments, form submissions).",
    isActive: true,
    subscriberCount: 0,
  });
  allContactsListId = (result as any).insertId as number;
  return allContactsListId;
}

export interface AddToListOptions {
  userId?: number;
  source?: string;       // "registration" | "purchase" | "enrollment" | "form" | "content_block" | "manual" | "import"
  sourceId?: string;     // e.g. formId, productId
  metadata?: Record<string, unknown>;
}

/**
 * Upsert a subscriber into a specific email list.
 * If the subscriber already exists (same listId + email), updates name/userId/metadata.
 * Skips if email is empty or the subscriber has unsubscribed from this list.
 */
export async function addToEmailList(
  listId: number,
  email: string,
  name?: string | null,
  options: AddToListOptions = {},
): Promise<void> {
  if (!email || !email.trim()) return;
  const normalizedEmail = email.trim().toLowerCase();

  const db = await getDb();
  if (!db) return;

  try {
    // Check if already subscribed (any status)
    const existing = await db
      .select({ id: emailListSubscribers.id, status: emailListSubscribers.status })
      .from(emailListSubscribers)
      .where(
        and(
          eq(emailListSubscribers.listId, listId),
          eq(emailListSubscribers.email, normalizedEmail),
        ),
      )
      .limit(1);

    if (existing[0]) {
      // If they previously unsubscribed from this list, don't re-add
      if (existing[0].status === "unsubscribed") return;
      // Update name/userId if we have better info
      if (name || options.userId) {
        await db
          .update(emailListSubscribers)
          .set({
            ...(name ? { name } : {}),
            ...(options.userId ? { userId: options.userId } : {}),
          })
          .where(eq(emailListSubscribers.id, existing[0].id));
      }
      return;
    }

    // Insert new subscriber
    await db.insert(emailListSubscribers).values({
      listId,
      email: normalizedEmail,
      name: name ?? null,
      userId: options.userId ?? null,
      source: options.source ?? "manual",
      sourceId: options.sourceId ?? null,
      status: "subscribed",
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    });

    // Increment subscriber count
    await db
      .update(emailLists)
      .set({ subscriberCount: sql`subscriberCount + 1` })
      .where(eq(emailLists.id, listId));
  } catch (err: any) {
    // Ignore duplicate key errors (race condition)
    if (err?.code === "ER_DUP_ENTRY") return;
    console.error("[emailListHelper] addToEmailList error:", err);
  }
}

/**
 * Add a contact to the master "All Contacts" list.
 * Safe to call from anywhere — creates the list if it doesn't exist.
 */
export async function addToAllContacts(
  email: string,
  name?: string | null,
  options: AddToListOptions = {},
): Promise<void> {
  try {
    const listId = await ensureAllContactsList();
    await addToEmailList(listId, email, name, options);
  } catch (err) {
    // Never throw — this is a background operation
    console.error("[emailListHelper] addToAllContacts error:", err);
  }
}

/**
 * One-time backfill: add all existing users to the "All Contacts" list.
 * Safe to call on startup — skips already-subscribed users.
 */
export async function backfillAllContacts(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const listId = await ensureAllContactsList();

    // Fetch all users with email addresses who haven't globally unsubscribed
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        displayName: users.displayName,
        unsubscribedAt: users.unsubscribedAt,
      })
      .from(users);

    let added = 0;
    for (const u of allUsers) {
      if (!u.email || u.unsubscribedAt) continue;
      const displayName = u.displayName || u.name || null;
      await addToEmailList(listId, u.email, displayName, {
        userId: u.id,
        source: "registration",
      });
      added++;
    }

    console.log(`[emailListHelper] Backfill complete — ${added} contacts added to "All Contacts" list.`);
  } catch (err) {
    console.error("[emailListHelper] backfillAllContacts error:", err);
  }
}
