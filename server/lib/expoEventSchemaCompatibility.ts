import { TRPCError } from "@trpc/server";
import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { ultrasoundExpoEvents, ultrasoundExpoPackages } from "../../drizzle/schema";
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

/** Refresh the reader after the owner-approved startup migration has been verified. */
export function invalidateExpoTenantSchemaCache(db: object): void {
  tenantColumnCache.delete(db);
}

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
  // Raw execute returns timezone-less MySQL strings, unlike a typed Drizzle
  // select. Apply the same UTC timestamp mapper so browsers cannot reinterpret
  // the event's end instant in their own timezone (Jan 13 ET becoming Jan 14).
  const timestamp = (value: unknown, column: Pick<typeof ultrasoundExpoEvents.startsAt, "mapFromDriverValue">) =>
    typeof value === "string" ? column.mapFromDriverValue(value) : value;
  return {
    ...row,
    id: Number(row.id),
    tenant: "ultrasound_expo",
    startsAt: timestamp(row.startsAt, ultrasoundExpoEvents.startsAt),
    endsAt: timestamp(row.endsAt, ultrasoundExpoEvents.endsAt),
    createdAt: timestamp(row.createdAt, ultrasoundExpoEvents.createdAt),
    updatedAt: timestamp(row.updatedAt, ultrasoundExpoEvents.updatedAt),
  } as CompatibleExpoEvent;
}

async function legacyRows(db: Db, statement: ReturnType<typeof sql>): Promise<CompatibleExpoEvent[]> {
  const result = await db.execute(statement);
  return extractExecuteRows<Record<string, unknown>>(result).map(asLegacyExpoEvent);
}

export async function expoTenantSchemaAvailable(db: Db): Promise<boolean> {
  return hasExpoTenantColumn(db);
}

/** Omitting a value is not enough: Drizzle still inserts every schema column. */
export async function insertCompatibleExpoEvent(
  db: Db,
  values: Omit<typeof ultrasoundExpoEvents.$inferInsert, "id" | "createdAt" | "updatedAt" | "tenant"> & { tenant: ExpoEventTenant },
): Promise<number> {
  const hasTenant = await hasExpoTenantColumn(db);
  if (!hasTenant && values.tenant === "echo_expo") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "EchoExpo™ event instances require the pending additive Railway database migration for ultrasound_expo_events.tenant. No event was created; EchoExpo™ cannot be saved as UltrasoundExpo™." });
  }
  let id: number | undefined;
  try {
    if (hasTenant) {
      const created = await db.insert(ultrasoundExpoEvents).values(values).$returningId();
      id = created[0]?.id;
    } else {
      // Use only established columns, with parameterized values and the same
      // UTC serialization as the normal typed insert. Event creation performs
      // no DDL or fallback that could erase an explicit EchoExpo™ distinction.
      const result = await db.execute(sql`
        INSERT INTO ultrasound_expo_events
          (name, slug, starts_at, ends_at, timezone, location_label, description,
           hero_image_url, registration_terms, attendee_instructions, partner_instructions, status)
        VALUES (${values.name}, ${values.slug}, ${ultrasoundExpoEvents.startsAt.mapToDriverValue(values.startsAt)},
          ${values.endsAt ? ultrasoundExpoEvents.endsAt.mapToDriverValue(values.endsAt) : null},
          ${values.timezone ?? "America/New_York"}, ${values.locationLabel ?? null}, ${values.description ?? null},
          ${values.heroImageUrl ?? null}, ${values.registrationTerms ?? null}, ${values.attendeeInstructions ?? null},
          ${values.partnerInstructions ?? null}, ${values.status ?? "draft"})
      `);
      id = Number(result?.[0]?.insertId);
    }
  } catch (error) {
    // Drizzle may wrap mysql2 errors in a query error. Never expose its SQL or
    // authored values; a reused slug should explain why a new instance failed.
    const failure = error as { code?: string; cause?: { code?: string } };
    if (failure.code === "ER_DUP_ENTRY" || failure.cause?.code === "ER_DUP_ENTRY") {
      throw new TRPCError({ code: "CONFLICT", message: "An Expo event already uses this URL slug. Choose a unique slug for the new instance, such as one including its year." });
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create the Expo event instance. No existing event was changed." });
  }
  if (!id || !Number.isSafeInteger(id) || id < 1) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The Expo event save did not return an instance ID. Reload the event list before retrying." });
  }
  return id;
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

/** A pending combined-offer migration must not prevent editing event dates. */
export async function listCompatibleExpoPackages(db: Db): Promise<typeof ultrasoundExpoPackages.$inferSelect[]> {
  const result = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ultrasound_expo_packages'
      AND COLUMN_NAME = 'combined_with_package_id'
    LIMIT 1
  `);
  const hasCombinedColumn = extractExecuteRows<{ COLUMN_NAME?: string; column_name?: string }>(result)
    .some(row => (row.COLUMN_NAME ?? row.column_name) === "combined_with_package_id");
  const { combinedWithPackageId, ...existingColumns } = getTableColumns(ultrasoundExpoPackages);
  return db.select({
    ...existingColumns,
    combinedWithPackageId: hasCombinedColumn ? combinedWithPackageId : sql<number | null>`NULL`,
  }).from(ultrasoundExpoPackages)
    .orderBy(asc(ultrasoundExpoPackages.eventId), asc(ultrasoundExpoPackages.sortOrder));
}
