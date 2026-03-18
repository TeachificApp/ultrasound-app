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
import { getVisibleProducts, buildCourseUrl, buildEnrollUrl, getUserEnrollmentsByEmail } from "../thinkific";

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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sync visible products from Thinkific into cmeCoursesCache */
export async function syncCatalogToDb(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const products = await getVisibleProducts();
  let synced = 0;

  for (const p of products) {
    const collectionIdsJson = JSON.stringify(p.collection_ids ?? []);
    await db
      .insert(cmeCoursesCache)
      .values({
        thinkificProductId: p.id,
        thinkificCourseId: p.productable_type === "Course" ? p.productable_id : null,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        cardImageUrl: p.card_image_url,
        instructorNames: p.instructor_names,
        hasCertificate: p.has_certificate,
        thinkificStatus: p.status,
        collectionIds: collectionIdsJson,
        syncedAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.price,
          cardImageUrl: p.card_image_url,
          instructorNames: p.instructor_names,
          hasCertificate: p.has_certificate,
          thinkificStatus: p.status,
          collectionIds: collectionIdsJson,
          syncedAt: new Date(),
        },
      });
    synced++;
  }
  return synced;
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
  getMyEnrollments: protectedProcedure.query(async ({ ctx }): Promise<number[]> => {
    const email = ctx.user.email;
    if (!email) return [];
    try {
      return await getUserEnrollmentsByEmail(email);
    } catch (err) {
      console.error("[CME] Failed to fetch enrollments:", err);
      return [];
    }
  }),
});
