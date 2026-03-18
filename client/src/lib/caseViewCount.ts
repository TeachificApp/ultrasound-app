/**
 * caseViewCount.ts
 *
 * Utilities for computing the member-facing "display view count" for echo cases.
 *
 * Strategy:
 * - The true view count (stored in the DB) is always shown to admins.
 * - For members, we add a deterministic "seeded" baseline that simulates realistic
 *   engagement from the 13,000+ member community.
 * - The seed is derived from the caseId so the same case always shows the same
 *   baseline, regardless of when the page is loaded.
 * - Cases published earlier receive a higher baseline (more time to accumulate views).
 *
 * The formula is intentionally simple and reproducible — no randomness at runtime.
 */

/**
 * Deterministic pseudo-random number in [0, 1) derived from an integer seed.
 * Uses a simple LCG (linear congruential generator).
 */
function seededRandom(seed: number): number {
  // LCG constants from Numerical Recipes
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  const val = ((a * seed + c) >>> 0) / m; // unsigned 32-bit, then normalize
  return val;
}

/**
 * Returns the seeded baseline view count for a case.
 *
 * @param caseId  - The numeric case ID (used as the primary seed)
 * @param publishedAt - ISO date string or Date of when the case was approved/published
 *
 * Range: ~150 – 2,400 views, weighted by case age (older = more views).
 */
export function getSeededViewCount(caseId: number, publishedAt?: string | Date | null): number {
  // Base random component: 0–1 from caseId
  const r = seededRandom(caseId * 31 + 7);

  // Age multiplier: cases published more than 12 months ago get up to 2× more views
  let ageFactor = 1.0;
  if (publishedAt) {
    const published = typeof publishedAt === "string" ? new Date(publishedAt) : publishedAt;
    const ageMs = Date.now() - published.getTime();
    const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30);
    // Scale from 1.0 (brand new) to 2.0 (12+ months old), capped at 2.0
    ageFactor = Math.min(2.0, 1.0 + ageMonths / 12);
  }

  // Base range: 150 – 1,200 views
  const base = Math.floor(150 + r * 1050);

  // Apply age factor and round to nearest 10 for a natural look
  const seeded = Math.round((base * ageFactor) / 10) * 10;

  return seeded;
}

/**
 * Returns the display view count shown to members.
 * Combines the seeded baseline with the actual view count from the DB.
 *
 * @param caseId      - The numeric case ID
 * @param actualCount - The real viewCount from the database
 * @param publishedAt - When the case was published
 */
export function getDisplayViewCount(
  caseId: number,
  actualCount: number,
  publishedAt?: string | Date | null
): number {
  return getSeededViewCount(caseId, publishedAt) + (actualCount ?? 0);
}

/**
 * Formats a view count number into a compact, readable string.
 * e.g. 1234 → "1.2K", 12345 → "12.3K"
 */
export function formatViewCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return k >= 10 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
  }
  return count.toString();
}
