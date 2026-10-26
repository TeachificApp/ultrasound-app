import { asc, eq, sql } from "drizzle-orm";
import { ultrasoundExpoEvents } from "../../drizzle/schema";
import { type ExpoEventTenant } from "../../shared/expoTenant";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = any;

/**
 * The initial UltrasoundExpo™ table predates the additive `tenant` column that
 * separates EchoExpo™ instances. Railway may run the current application
 * against that older table while its migration is pending. These helpers keep
 * established UltrasoundExpo™ records readable without guessing that any
 * legacy row belongs to EchoExpo™.
 */
export type CompatibleExpoEvent = Omit<typeof ultrasoundExpoEvents.$inferSelect, "tenant"> & {
  tenant: ExpoEventTenant;
};

const legacyEventColumns = sql.raw(`
  id,
  name,
  slug,
  starts_at AS startsAt,
  ends_at AS endsAt,
  timezone,
  location_label AS locationLabel,
  description,
  hero_image_url AS heroImageUrl,
  registration_terms AS registrationTerms,
  attendee_instructions AS attendeeInstructions,
  partner_instructions AS partnerInstructions,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt
`);

const tenantColumnCache = new WeakMap<object, Promise<boolean>>();

async function hasExpoTenantColumn(db: Db): Promise<boolean> {
  if (!db || typeof db !== "object") return false;
  const cached = tenantColumnCache.get(db);
  if (cached) return cached;

  const lookup = (async () => {
    try {
      const result = await db.execute(sql`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'ultrasound_expo_events'
          AND COLUMN_NAME = 'tenant'
        LIMIT 1
      `);
      return extractExecuteRows<{ COLUMN_NAME?: string; column_name?: string }>(result)
        .some(row => (row.COLUMN_NAME ?? row.column_name) === "tenant");
    } catch (error) {
      console.error("[Expo schema compatibility] Unable to inspect the event tenant column.", error);
      // Do not assume EchoExpo™ attribution when the schema cannot be checked.
      return false;
    }
  })();
  tenantColumnCache.set(db, lookup);
  return lookup;
}

function asLegacyExpoEvent(row: Record<string, unknown>): CompatibleExpoEvent {
  return {
    ...row,
    id: Number(row.id),
    tenant: "ultrasound_expo",
  } as CompatibleExpoEvent;
}

async function legacyRows(db: Db, statement: ReturnType<typeof sql>): Promise<CompatibleExpoEvent[]> {
  const result = await db.execute(statement);
  return extractExecuteRows<Record<string, unknown>>(result).map(asLegacyExpoEvent);
}

export async function expoTenantSchemaAvailable(db: Db): Promise<boolean> {
  return hasExpoTenantColumn(db);
}

export async function listCompatibleExpoEvents(db: Db, options: { publishedOnly?: boolean } = {}): Promise<CompatibleExpoEvent[]> {
  if (await hasExpoTenantColumn(db)) {
    const query = db.select().from(ultrasoundExpoEvents);
    const rows = options.publishedOnly
      ? await query.where(eq(ultrasoundExpoEvents.status, "published")).orderBy(asc(ultrasoundExpoEvents.startsAt))
      : await query.orderBy(asc(ultrasoundExpoEvents.startsAt));
    return rows as CompatibleExpoEvent[];
  }
  return legacyRows(db, options.publishedOnly
    ? sql`SELECT ${legacyEventColumns} FROM ultrasound_expo_events WHERE status = 'published' ORDER BY starts_at ASC`
    : sql`SELECT ${legacyEventColumns} FROM ultrasound_expo_events ORDER BY starts_at ASC`);
}

export async function getCompatibleExpoEventById(db: Db, eventId: number): Promise<CompatibleExpoEvent | null> {
  if (await hasExpoTenantColumn(db)) {
    const [event] = await db.select().from(ultrasoundExpoEvents).where(eq(ultrasoundExpoEvents.id, eventId)).limit(1);
    return (event as CompatibleExpoEvent | undefined) ?? null;
  }
  const [event] = await legacyRows(db, sql`SELECT ${legacyEventColumns} FROM ultrasound_expo_events WHERE id = ${eventId} LIMIT 1`);
  return event ?? null;
}

export async function getCompatibleExpoEventBySlug(
  db: Db,
  eventSlug: string,
  options: { publishedOnly?: boolean } = {},
): Promise<CompatibleExpoEvent | null> {
  if (await hasExpoTenantColumn(db)) {
    const query = db.select().from(ultrasoundExpoEvents).where(
      options.publishedOnly
        ? sql`${ultrasoundExpoEvents.slug} = ${eventSlug} AND ${ultrasoundExpoEvents.status} = 'published'`
        : eq(ultrasoundExpoEvents.slug, eventSlug),
    );
    const [event] = await query.limit(1);
    return (event as CompatibleExpoEvent | undefined) ?? null;
  }
  const [event] = await legacyRows(db, options.publishedOnly
    ? sql`SELECT ${legacyEventColumns} FROM ultrasound_expo_events WHERE slug = ${eventSlug} AND status = 'published' LIMIT 1`
    : sql`SELECT ${legacyEventColumns} FROM ultrasound_expo_events WHERE slug = ${eventSlug} LIMIT 1`);
  return event ?? null;
}

export function normalizeLegacyExpoEvent<T extends Record<string, unknown>>(event: T, schemaHasTenant: boolean): T & { tenant: ExpoEventTenant } {
  return {
    ...event,
    tenant: schemaHasTenant && event.tenant === "echo_expo" ? "echo_expo" : "ultrasound_expo",
  };
}
