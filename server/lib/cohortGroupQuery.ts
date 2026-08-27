import { asc, and, eq, isNull, or, type SQL } from "drizzle-orm";
import { lmsCohortGroups } from "../../drizzle/schema";
import type { getDb } from "../db";
import type { AnyColumn } from "drizzle-orm";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * When a cohort group is selected, include both group-specific rows and course-wide
 * rows (cohort_group_id IS NULL). Manus-era content was often stored at course scope.
 */
export function cohortGroupScopeFilter(
  cohortGroupIdColumn: AnyColumn,
  cohortGroupId: number | undefined,
): SQL | undefined {
  if (!cohortGroupId) return undefined;
  return or(isNull(cohortGroupIdColumn), eq(cohortGroupIdColumn, cohortGroupId));
}

export function cohortCourseContentWhere(
  courseIdColumn: AnyColumn,
  cohortGroupIdColumn: AnyColumn,
  courseId: number,
  cohortGroupId?: number,
  extra?: SQL,
): SQL {
  const base = cohortGroupId
    ? and(eq(courseIdColumn, courseId), cohortGroupScopeFilter(cohortGroupIdColumn, cohortGroupId))
    : eq(courseIdColumn, courseId);
  return extra ? and(base, extra) : base;
}

/** Columns present in the original Manus/Railway mirror (0007 migration). */
export const cohortGroupBaseSelect = {
  id: lmsCohortGroups.id,
  courseId: lmsCohortGroups.courseId,
  name: lmsCohortGroups.name,
  slug: lmsCohortGroups.slug,
  description: lmsCohortGroups.description,
  startDate: lmsCohortGroups.startDate,
  endDate: lmsCohortGroups.endDate,
  enrollmentCloseDate: lmsCohortGroups.enrollmentCloseDate,
  maxStudents: lmsCohortGroups.maxStudents,
  status: lmsCohortGroups.status,
  pageBlocks: lmsCohortGroups.pageBlocks,
  isFeaturedOnLanding: lmsCohortGroups.isFeaturedOnLanding,
  sortOrder: lmsCohortGroups.sortOrder,
  createdAt: lmsCohortGroups.createdAt,
  updatedAt: lmsCohortGroups.updatedAt,
} as const;

/** Columns confirmed working on production public getCourse queries. */
export const cohortGroupPublicSelect = {
  location: lmsCohortGroups.location,
  durationHours: lmsCohortGroups.durationHours,
  waitlistEnabled: lmsCohortGroups.waitlistEnabled,
  waitlistHeading: lmsCohortGroups.waitlistHeading,
  waitlistBody: lmsCohortGroups.waitlistBody,
  waitlistCtaLabel: lmsCohortGroups.waitlistCtaLabel,
  waitlistCtaUrl: lmsCohortGroups.waitlistCtaUrl,
  waitlistRedirectUrl: lmsCohortGroups.waitlistRedirectUrl,
  waitlistSuccessMessage: lmsCohortGroups.waitlistSuccessMessage,
} as const;

/** Columns that may still be missing until ensureLmsCohortGroupsSchema runs. */
export const cohortGroupMirrorGapSelect = {
  landingBlocks: lmsCohortGroups.landingBlocks,
  accessDurationDays: lmsCohortGroups.accessDurationDays,
  presaleWelcomeHeading: lmsCohortGroups.presaleWelcomeHeading,
  presaleWelcomeBody: lmsCohortGroups.presaleWelcomeBody,
  presaleWelcomeMediaUrl: lmsCohortGroups.presaleWelcomeMediaUrl,
  presaleWelcomeCtaLabel: lmsCohortGroups.presaleWelcomeCtaLabel,
  presaleWelcomeCtaUrl: lmsCohortGroups.presaleWelcomeCtaUrl,
} as const;

export const cohortGroupAdminListSelect = {
  ...cohortGroupBaseSelect,
  ...cohortGroupPublicSelect,
  ...cohortGroupMirrorGapSelect,
} as const;

export type CohortGroupRow = {
  id: number;
  courseId: number;
  name: string;
  slug: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  enrollmentCloseDate: Date | null;
  maxStudents: number | null;
  status: "draft" | "open" | "active" | "completed" | "archived" | "waitlist" | "presale";
  pageBlocks: string | null;
  isFeaturedOnLanding: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  location: string | null;
  durationHours: number | null;
  landingBlocks: string | null;
  accessDurationDays: number | null;
  waitlistEnabled: boolean;
  waitlistHeading: string | null;
  waitlistBody: string | null;
  waitlistCtaLabel: string | null;
  waitlistCtaUrl: string | null;
  waitlistRedirectUrl: string | null;
  waitlistSuccessMessage: string | null;
  presaleWelcomeHeading: string | null;
  presaleWelcomeBody: string | null;
  presaleWelcomeMediaUrl: string | null;
  presaleWelcomeCtaLabel: string | null;
  presaleWelcomeCtaUrl: string | null;
};

const MIRROR_GAP_DEFAULTS = {
  landingBlocks: null,
  accessDurationDays: null,
  presaleWelcomeHeading: null,
  presaleWelcomeBody: null,
  presaleWelcomeMediaUrl: null,
  presaleWelcomeCtaLabel: null,
  presaleWelcomeCtaUrl: null,
} satisfies Partial<CohortGroupRow>;

const PUBLIC_DEFAULTS = {
  location: null,
  durationHours: null,
  waitlistEnabled: false,
  waitlistHeading: null,
  waitlistBody: null,
  waitlistCtaLabel: null,
  waitlistCtaUrl: null,
  waitlistRedirectUrl: null,
  waitlistSuccessMessage: null,
} satisfies Partial<CohortGroupRow>;

const SELECT_TIERS = [
  { select: cohortGroupAdminListSelect, defaults: {} },
  { select: { ...cohortGroupBaseSelect, ...cohortGroupPublicSelect }, defaults: MIRROR_GAP_DEFAULTS },
  { select: cohortGroupBaseSelect, defaults: { ...PUBLIC_DEFAULTS, ...MIRROR_GAP_DEFAULTS } },
] as const;

function withDefaults<T extends Record<string, unknown>>(
  row: T,
  defaults: Partial<CohortGroupRow>,
): CohortGroupRow {
  return { ...PUBLIC_DEFAULTS, ...MIRROR_GAP_DEFAULTS, ...defaults, ...row } as CohortGroupRow;
}

async function selectCohortGroupsWithFallback(
  db: Db,
  where: ReturnType<typeof eq>,
): Promise<CohortGroupRow[]> {
  const order = [
    asc(lmsCohortGroups.startDate),
    asc(lmsCohortGroups.sortOrder),
    asc(lmsCohortGroups.createdAt),
  ];
  let lastError: unknown;
  for (const tier of SELECT_TIERS) {
    try {
      const rows = await db
        .select(tier.select)
        .from(lmsCohortGroups)
        .where(where)
        .orderBy(...order);
      return rows.map((row) => withDefaults(row, tier.defaults));
    } catch (err) {
      lastError = err;
      console.warn(
        "[cohortGroupQuery] Select tier failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to load cohort groups");
}

/** List cohort groups for admin — works even when mirror-gap columns are missing from MySQL. */
export async function listCohortGroupsForAdmin(
  db: Db,
  courseId: number,
): Promise<CohortGroupRow[]> {
  return selectCohortGroupsWithFallback(db, eq(lmsCohortGroups.courseId, courseId));
}

/** Fetch one cohort group by id — resilient to missing mirror-gap columns. */
export async function getCohortGroupById(
  db: Db,
  cohortGroupId: number,
): Promise<CohortGroupRow | null> {
  for (const tier of SELECT_TIERS) {
    try {
      const [row] = await db
        .select(tier.select)
        .from(lmsCohortGroups)
        .where(eq(lmsCohortGroups.id, cohortGroupId))
        .limit(1);
      return row ? withDefaults(row, tier.defaults) : null;
    } catch (err) {
      console.warn(
        "[cohortGroupQuery] Select tier failed for group",
        cohortGroupId,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return null;
}

/** Public page builder blocks — tries landing_blocks, returns [] when column is missing. */
export async function getCohortGroupLandingBlocks(
  db: Db,
  cohortGroupId: number,
): Promise<unknown[]> {
  try {
    const [row] = await db
      .select({ landingBlocks: lmsCohortGroups.landingBlocks })
      .from(lmsCohortGroups)
      .where(eq(lmsCohortGroups.id, cohortGroupId))
      .limit(1);
    if (!row?.landingBlocks) return [];
    return JSON.parse(row.landingBlocks) as unknown[];
  } catch {
    return [];
  }
}
