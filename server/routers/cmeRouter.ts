/**
 * CME Hub Router — Thinkific-backed public course catalog.
 *
 * Scope (simplified):
 *   cmeCatalog.getCatalog — public: returns visible, published, non-archived courses
 *                           with Thinkific deep-links (email pre-fill supported client-side)
 *
 * The catalog is cached in cmeCoursesCache and refreshed every 6 hours.
 * No enrollment tracking, no transcript, no admin metadata panel.
 */
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cmeCoursesCache } from "../../drizzle/schema";
// Thinkific URL helpers (inlined after thinkific.ts was removed)
const THINKIFIC_BASE = "https://allaboutultrasound.thinkific.com";
function buildCourseUrl(slug: string): string {
  return `${THINKIFIC_BASE}/courses/${slug}`;
}
function buildEnrollUrl(slug: string): string {
  return `${THINKIFIC_BASE}/enroll/${slug}`;
}

/** Thinkific collection ID for "E-Learning & CME" on allaboutultrasound */
const CME_COLLECTION_ID = 131827;

/** Thinkific collection ID for "Registry Review" on allaboutultrasound */
const REGISTRY_COLLECTION_ID = 131826;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogCourse {
  thinkificProductId: number;
  thinkificCourseId: number | null;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  cardImageUrl: string | null;
  instructorNames: string | null;
  hasCertificate: boolean;
  /** Direct course URL on Thinkific */
  courseUrl: string;
  /** Checkout/enroll URL on Thinkific */
  enrollUrl: string;
  /** Native LMS course ID if this course has been imported natively */
  nativeLmsCourseId: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sync visible products from Thinkific into cmeCoursesCache.
 * NOTE: Thinkific API client removed — sync is now a no-op; catalog is served from existing DB cache.
 */
export async function syncCatalogToDb(): Promise<number> {
  return 0;
}

/** Map cached DB rows to CatalogCourse objects */
function mapToCatalogCourse(c: typeof cmeCoursesCache.$inferSelect): CatalogCourse {
  return {
    thinkificProductId: c.thinkificProductId,
    thinkificCourseId: c.thinkificCourseId,
    name: c.name,
    slug: c.slug,
    description: c.description,
    price: c.price ?? "0.0",
    cardImageUrl: c.cardImageUrl,
    instructorNames: c.instructorNames,
    hasCertificate: c.hasCertificate,
    courseUrl: buildCourseUrl(c.slug),
    enrollUrl: buildEnrollUrl(c.slug),
    nativeLmsCourseId: c.nativeLmsCourseId ?? null,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const cmeRouter = router({
  /**
   * Public: returns the visible course catalog for E-Learning & CME collection.
   * If the cache is empty or stale (>6 hours), triggers a sync first.
   * The client appends ?email=<user_email> to the deep-links for pre-fill.
   */
  getCatalog: publicProcedure.query(async (): Promise<CatalogCourse[]> => {
    const db = await getDb();
    if (!db) return [];

    const cached = await db.select().from(cmeCoursesCache).limit(1);

    if (cached.length === 0) {
      // First load — sync from Thinkific synchronously
      await syncCatalogToDb();
    } else {
      // Stale check (6 hours) — background refresh
      const ageMs = Date.now() - cached[0].syncedAt.getTime();
      if (ageMs > 6 * 60 * 60 * 1000) {
        syncCatalogToDb().catch(console.error);
      }
    }

    const allCourses = await db.select().from(cmeCoursesCache);
    // Filter to only courses in the E-Learning & CME collection (ID 131827)
    const courses = allCourses.filter((c) => {
      if (!c.collectionIds) return false;
      try {
        const ids: number[] = JSON.parse(c.collectionIds);
        return ids.includes(CME_COLLECTION_ID);
      } catch {
        return false;
      }
    });
    // If no courses pass the filter (e.g. first sync before collectionIds are stored),
    // fall back to showing all courses so the page is never blank.
    const result = courses.length > 0 ? courses : allCourses;
    return result.map(mapToCatalogCourse);
  }),

  /**
   * Public: returns the visible course catalog for the Registry Review collection.
   * Reuses the same cmeCoursesCache table, filtered by REGISTRY_COLLECTION_ID.
   * If the cache is empty or stale (>6 hours), triggers a sync first.
   */
  getRegistryCatalog: publicProcedure.query(async (): Promise<CatalogCourse[]> => {
    const db = await getDb();
    if (!db) return [];

    const cached = await db.select().from(cmeCoursesCache).limit(1);

    if (cached.length === 0) {
      await syncCatalogToDb();
    } else {
      const ageMs = Date.now() - cached[0].syncedAt.getTime();
      if (ageMs > 6 * 60 * 60 * 1000) {
        syncCatalogToDb().catch(console.error);
      }
    }

    const allCourses = await db.select().from(cmeCoursesCache);
    const courses = allCourses.filter((c) => {
      if (!c.collectionIds) return false;
      try {
        const ids: number[] = JSON.parse(c.collectionIds);
        return ids.includes(REGISTRY_COLLECTION_ID);
      } catch {
        return false;
      }
    });
    // Fall back to all courses if filter returns nothing (e.g. first sync)
    const result = courses.length > 0 ? courses : [];
    return result.map(mapToCatalogCourse);
  }),

  /**
   * Protected: returns the list of Thinkific course IDs the current user is enrolled in.
   * Used by CME Hub and Registry Review Hub to show "Continue Learning" vs "Enroll".
   * Returns an empty array if the user has no Thinkific account.
   */
  /** Returns empty array — Thinkific enrollment lookup removed. */
  getMyEnrollments: protectedProcedure.query(async (): Promise<number[]> => {
    return [];
  }),
});
