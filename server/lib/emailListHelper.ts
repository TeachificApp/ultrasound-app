/**
 * Shared helpers for managing email lists and subscribers.
 *
 * Key exports:
 *   addToEmailList(email, name?, options?) — upsert a subscriber into a list
 *   addToAllContacts(email, name?, options?) — add to the master "All Contacts" list
 *   ensureAllContactsList() — get or create the "All Contacts" list, returns its ID
 *   backfillAllContacts() — reconcile eligible users and newsletter subscribers into All Contacts
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { emailLists, emailListSubscribers, newsletterSubscribers, users } from "../../drizzle/schema";
import {
  EXPO_EMAIL_LISTS,
  getExpoAttendeeListKey,
  getExpoProgramLabel,
  getPartnerProgramTags,
  getPartnerRoleTags,
} from "../../shared/expoEmailAudience";
import { normalizeExpoEventInterests, type ExpoEventTenant } from "../../shared/expoTenant";
import type { EmailAutomationScope } from "../../shared/emailAutomation";

// Cache the All Contacts list ID so we don't query on every call.
let allContactsListId: number | null = null;
const expoAudienceListIds = new Map<keyof typeof EXPO_EMAIL_LISTS, number>();

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function mergeMetadata(existing: string | null | undefined, incoming: Record<string, unknown> | undefined): string | null {
  if (!incoming) return existing ?? null;
  const merged = { ...parseMetadata(existing) };
  for (const [key, value] of Object.entries(incoming)) {
    if (Array.isArray(value) && Array.isArray(merged[key])) {
      merged[key] = [...new Set([...(merged[key] as unknown[]), ...value])];
    } else {
      merged[key] = value;
    }
  }
  return JSON.stringify(merged);
}

async function ensureNamedEmailList(
  key: keyof typeof EXPO_EMAIL_LISTS,
): Promise<number> {
  const cached = expoAudienceListIds.get(key);
  if (cached) return cached;
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const definition = EXPO_EMAIL_LISTS[key];
  const [existing] = await db.select({ id: emailLists.id })
    .from(emailLists)
    .where(eq(emailLists.name, definition.name))
    .limit(1);
  if (existing) {
    expoAudienceListIds.set(key, existing.id);
    return existing.id;
  }
  const [created] = await db.insert(emailLists).values({
    name: definition.name,
    description: definition.description,
    isActive: true,
    subscriberCount: 0,
  });
  const listId = (created as { insertId: number }).insertId;
  expoAudienceListIds.set(key, listId);
  return listId;
}

/** Ensures the three system-managed Expo audience lists are available to admins. */
export async function ensureExpoAudienceLists(): Promise<Record<keyof typeof EXPO_EMAIL_LISTS, number>> {
  const entries = await Promise.all(
    (Object.keys(EXPO_EMAIL_LISTS) as Array<keyof typeof EXPO_EMAIL_LISTS>)
      .map(async (key) => [key, await ensureNamedEmailList(key)] as const),
  );
  return Object.fromEntries(entries) as Record<keyof typeof EXPO_EMAIL_LISTS, number>;
}

/** Adds a confirmed event attendee to the appropriate program-specific audience. */
export async function addExpoAttendeeToEmailList(input: {
  tenant: ExpoEventTenant;
  eventId: number;
  eventName: string;
  registrationId: number;
  userId?: number | null;
  email: string;
  name?: string | null;
}): Promise<void> {
  try {
    const listId = await ensureNamedEmailList(getExpoAttendeeListKey(input.tenant));
    const program = getExpoProgramLabel(input.tenant);
    await addToEmailList(listId, input.email, input.name, {
      userId: input.userId ?? undefined,
      source: "expo_attendee_registration",
      sourceId: String(input.registrationId),
      metadata: {
        programTags: [program],
        participantType: "Attendee",
        participantRoles: ["Attendee"],
        eventTenant: input.tenant,
        eventId: input.eventId,
        eventName: input.eventName,
      },
      automationScope: "expo",
    });
  } catch (error) {
    console.error("[emailListHelper] Unable to add Expo attendee to audience list", error);
  }
}

/** Adds an Expo-related vendor, exhibitor, or sponsor contact with role and program tags. */
export async function addExpoPartnerToEmailList(input: {
  applicationId?: number | null;
  userId?: number | null;
  email: string;
  name?: string | null;
  partnerTypes: readonly string[];
  requestedScopes: readonly string[];
  eventFocus?: string | null;
  eventInterests?: unknown;
  status: "pending" | "approved" | "rejected" | "suspended";
}): Promise<void> {
  try {
    const listId = await ensureNamedEmailList("exhibitorsAndSponsors");
    const participantRoles = getPartnerRoleTags(input.partnerTypes);
    const eventInterests = input.requestedScopes.includes("ultrasound_expo")
      ? normalizeExpoEventInterests(input.eventInterests, input.eventFocus)
      : [];
    const programTags = getPartnerProgramTags({
      requestedScopes: input.requestedScopes,
      eventFocus: input.eventFocus,
      eventInterests,
    });
    // General AAUS/iHeartEcho partner submissions remain outside this Expo list
    // unless they selected the shared UltrasoundExpo™ vendor pathway.
    if (participantRoles.length === 0 || programTags.length === 0) return;
    await addToEmailList(listId, input.email, input.name, {
      userId: input.userId ?? undefined,
      source: "expo_partner_application",
      sourceId: input.applicationId ? String(input.applicationId) : undefined,
      metadata: {
        programTags,
        participantRoles,
        sponsorPrograms: input.partnerTypes.includes("sponsor") ? programTags : [],
        eventFocus: input.eventFocus ?? null,
        eventInterests,
        applicationStatus: input.status,
      },
      automationScope: "expo",
    });
  } catch (error) {
    console.error("[emailListHelper] Unable to add Expo partner to audience list", error);
  }
}

/** Get or create the master "All Contacts" email list. Returns its ID. */
export async function ensureAllContactsList(): Promise<number> {
  if (allContactsListId) return allContactsListId;
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await db
    .select({ id: emailLists.id })
    .from(emailLists)
    .where(eq(emailLists.name, "All Contacts"))
    .limit(1);

  if (existing[0]) {
    allContactsListId = existing[0].id;
    return allContactsListId;
  }

  const [result] = await db.insert(emailLists).values({
    name: "All Contacts",
    description: "Automatically populated with every contact who interacts with the platform (registrations, purchases, enrollments, form submissions, and newsletter subscriptions).",
    isActive: true,
    subscriberCount: 0,
  });
  allContactsListId = (result as { insertId: number }).insertId;
  return allContactsListId;
}

export interface AddToListOptions {
  userId?: number;
  source?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  /** Only use after a contact explicitly opts in again. */
  resubscribe?: boolean;
  /** Limits an automatic list-signup workflow event to its platform area. */
  automationScope?: EmailAutomationScope;
}

export type EmailListMembershipAction = "insert" | "update" | "reactivate" | "skip";

export function resolveEmailListMembershipAction(
  existingStatus: string | undefined,
  hasNewIdentityData: boolean,
  resubscribe = false,
): EmailListMembershipAction {
  if (!existingStatus) return "insert";
  if (existingStatus === "unsubscribed") return resubscribe ? "reactivate" : "skip";
  return hasNewIdentityData ? "update" : "skip";
}

/**
 * Upsert a subscriber into a specific email list. A previous opt-out is never
 * reversed unless the caller records an explicit re-subscription.
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
    const existing = await db
      .select({ id: emailListSubscribers.id, status: emailListSubscribers.status, metadata: emailListSubscribers.metadata })
      .from(emailListSubscribers)
      .where(and(eq(emailListSubscribers.listId, listId), eq(emailListSubscribers.email, normalizedEmail)))
      .limit(1);

    const action = resolveEmailListMembershipAction(existing[0]?.status, Boolean(name || options.userId || options.metadata), options.resubscribe);
    if (action === "skip") return;

    if (action === "reactivate" && existing[0]) {
      await db
        .update(emailListSubscribers)
        .set({
          status: "subscribed",
          subscribedAt: new Date(),
          unsubscribedAt: null,
          ...(name ? { name } : {}),
          ...(options.userId ? { userId: options.userId } : {}),
          ...(options.metadata ? { metadata: mergeMetadata(existing[0].metadata, options.metadata) } : {}),
        })
        .where(eq(emailListSubscribers.id, existing[0].id));
      await db
        .update(emailLists)
        .set({ subscriberCount: sql`subscriberCount + 1` })
        .where(eq(emailLists.id, listId));
      const [list] = await db.select({ name: emailLists.name }).from(emailLists).where(eq(emailLists.id, listId)).limit(1);
      import("./emailAutomation").then(({ fireEmailAutomationEvent }) => {
        const scopes = options.automationScope ? [options.automationScope] : ["learn", "apps", "expo"] as const;
        for (const scope of scopes) {
          fireEmailAutomationEvent({
            type: "list_signup", scope, userId: options.userId ?? null, email: normalizedEmail, name: name ?? null,
            targetId: listId, eventName: list?.name ?? "Email list", sourceKey: `email-list:${listId}:${normalizedEmail}:reactivated`,
          }).catch(() => {});
        }
      }).catch(() => {});
      return;
    }

    if (action === "update" && existing[0]) {
      await db
        .update(emailListSubscribers)
        .set({
          ...(name ? { name } : {}),
          ...(options.userId ? { userId: options.userId } : {}),
          ...(options.metadata ? { metadata: mergeMetadata(existing[0].metadata, options.metadata) } : {}),
        })
        .where(eq(emailListSubscribers.id, existing[0].id));
      return;
    }

    const [created] = await db.insert(emailListSubscribers).values({
      listId,
      email: normalizedEmail,
      name: name ?? null,
      userId: options.userId ?? null,
      source: options.source ?? "manual",
      sourceId: options.sourceId ?? null,
      status: "subscribed",
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    });
    await db
      .update(emailLists)
      .set({ subscriberCount: sql`subscriberCount + 1` })
      .where(eq(emailLists.id, listId));
    const [list] = await db.select({ name: emailLists.name }).from(emailLists).where(eq(emailLists.id, listId)).limit(1);
    import("./emailAutomation").then(({ fireEmailAutomationEvent }) => {
      const scopes = options.automationScope ? [options.automationScope] : ["learn", "apps", "expo"] as const;
      for (const scope of scopes) {
        fireEmailAutomationEvent({
          type: "list_signup", scope, userId: options.userId ?? null, email: normalizedEmail, name: name ?? null,
          targetId: listId, eventName: list?.name ?? "Email list", sourceKey: `email-list:${listId}:${normalizedEmail}:${(created as any).insertId ?? "new"}`,
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY") return;
    console.error("[emailListHelper] addToEmailList error:", err);
  }
}

/** Add a contact to the master "All Contacts" list. */
export async function addToAllContacts(
  email: string,
  name?: string | null,
  options: AddToListOptions = {},
): Promise<void> {
  try {
    const listId = await ensureAllContactsList();
    await addToEmailList(listId, email, name, options);
  } catch (err) {
    console.error("[emailListHelper] addToAllContacts error:", err);
  }
}

/**
 * Records a marketing opt-out in All Contacts instead of deleting the contact,
 * retaining the preference and preventing accidental re-addition.
 */
export async function unsubscribeFromAllContacts(email: string): Promise<void> {
  if (!email || !email.trim()) return;
  try {
    const db = await getDb();
    if (!db) return;
    const listId = await ensureAllContactsList();
    const [existing] = await db
      .select({ id: emailListSubscribers.id, status: emailListSubscribers.status })
      .from(emailListSubscribers)
      .where(and(eq(emailListSubscribers.listId, listId), eq(emailListSubscribers.email, email.trim().toLowerCase())))
      .limit(1);
    if (!existing || existing.status === "unsubscribed") return;

    await db
      .update(emailListSubscribers)
      .set({ status: "unsubscribed", unsubscribedAt: new Date() })
      .where(eq(emailListSubscribers.id, existing.id));
    await db
      .update(emailLists)
      .set({ subscriberCount: sql`GREATEST(subscriberCount - 1, 0)` })
      .where(eq(emailLists.id, listId));
  } catch (err) {
    console.error("[emailListHelper] unsubscribeFromAllContacts error:", err);
  }
}

/**
 * Reconciles eligible users and active newsletter subscribers into the
 * campaign-visible All Contacts list. Existing members and opt-outs are safe.
 */
export async function backfillAllContacts(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const listId = await ensureAllContactsList();

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        displayName: users.displayName,
        unsubscribedAt: users.unsubscribedAt,
      })
      .from(users);

    let processed = 0;
    const globallyUnsubscribedEmails = new Set<string>();
    for (const user of allUsers) {
      if (!user.email) continue;
      const email = user.email.trim().toLowerCase();
      if (user.unsubscribedAt) {
        globallyUnsubscribedEmails.add(email);
        continue;
      }
      await addToEmailList(listId, user.email, user.displayName || user.name || null, {
        userId: user.id,
        source: "registration",
      });
      processed += 1;
    }

    const activeNewsletterSubscribers = await db
      .select({
        email: newsletterSubscribers.email,
        firstName: newsletterSubscribers.firstName,
        lastName: newsletterSubscribers.lastName,
      })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.isActive, 1));
    for (const subscriber of activeNewsletterSubscribers) {
      if (!subscriber.email || globallyUnsubscribedEmails.has(subscriber.email.trim().toLowerCase())) continue;
      const name = [subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ") || null;
      await addToEmailList(listId, subscriber.email, name, { source: "newsletter_subscribe" });
      processed += 1;
    }

    console.log(`[emailListHelper] All Contacts reconciliation complete — ${processed} eligible user/newsletter records processed.`);
  } catch (err) {
    console.error("[emailListHelper] backfillAllContacts error:", err);
  }
}
