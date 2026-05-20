/**
 * Thinkific API helper — wraps the Thinkific Admin REST API v1.
 *
 * All requests use the API key + subdomain header auth.
 * Rate limit: 120 req/min — we cache aggressively to stay well under.
 *
 * Reference: https://developers.thinkific.com/api/api-documentation/
 */

import { ENV } from "./_core/env";

const BASE_URL = "https://api.thinkific.com/api/public/v1";

function thinkificHeaders() {
  return {
    "X-Auth-API-Key": ENV.thinkificApiKey,
    "X-Auth-Subdomain": ENV.thinkificSubdomain,
    "Content-Type": "application/json",
  };
}

async function thinkificFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: thinkificHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Thinkific API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThinkificProduct {
  id: number;
  productable_id: number; // course ID
  productable_type: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  status: string; // "published" | "draft"
  hidden: boolean;
  private: boolean;
  has_certificate: boolean;
  card_image_url: string | null;
  instructor_names: string | null;
  collection_ids: number[];
}

export interface ThinkificEnrollment {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  course_id: number;
  course_name: string;
  percentage_completed: string; // "0.0" – "1.0"
  completed: boolean;
  completed_at: string | null;
  started_at: string | null;
  expiry_date: string | null;
  expired: boolean;
  is_free_trial: boolean;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThinkificUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

interface PaginatedResponse<T> {
  items: T[];
  meta: {
    pagination: {
      current_page: number;
      next_page: number | null;
      total_pages: number;
      total_items: number;
    };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch all pages of a paginated endpoint */
async function fetchAllPages<T>(basePath: string, limit = 250): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  while (true) {
    const sep = basePath.includes("?") ? "&" : "?";
    const data = await thinkificFetch<PaginatedResponse<T>>(
      `${basePath}${sep}page=${page}&limit=${limit}`
    );
    results.push(...data.items);
    if (!data.meta.pagination.next_page) break;
    page++;
  }
  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all visible, published, non-archived products from Thinkific.
 * Filters out: hidden=true, status!="published", name starts with "ARCHIVE".
 */
export async function getVisibleProducts(): Promise<ThinkificProduct[]> {
  const all = await fetchAllPages<ThinkificProduct>("/products");
  return all.filter(
    (p) =>
      !p.hidden &&
      p.status === "published" &&
      !p.name.toUpperCase().startsWith("ARCHIVE")
  );
}

/**
 * Fetch all products (including hidden/archived) — for admin sync.
 */
export async function getAllProducts(): Promise<ThinkificProduct[]> {
  return fetchAllPages<ThinkificProduct>("/products");
}

/**
 * Look up a Thinkific user by email address.
 * Returns null if not found.
 */
export async function getUserByEmail(email: string): Promise<ThinkificUser | null> {
  try {
    const data = await thinkificFetch<PaginatedResponse<ThinkificUser>>(
      `/users?query=${encodeURIComponent(email)}&page=1&limit=10`
    );
    // The query param does a broad search — find exact email match
    const match = data.items.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    return match ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a single enrollment by its ID.
 * Used when the webhook payload only contains the enrollment ID.
 */
export async function getEnrollmentById(
  enrollmentId: number
): Promise<ThinkificEnrollment | null> {
  try {
    const data = await thinkificFetch<ThinkificEnrollment>(`/enrollments/${enrollmentId}`);
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch all enrollments for a specific Thinkific user ID.
 */
export async function getEnrollmentsByUserId(
  thinkificUserId: number
): Promise<ThinkificEnrollment[]> {
  return fetchAllPages<ThinkificEnrollment>(
    `/enrollments?user_id=${thinkificUserId}`
  );
}

/**
 * Parse CME credit hours from a course name.
 * Looks for patterns like "2.5 SDMS CME", "1 SDMS FREE CME", "2 SDMS Credits"
 * Returns null if no match found.
 */
export function parseCreditHoursFromName(name: string): {
  hours: string;
  type: "SDMS" | "AMA_PRA_1" | "ANCC" | "OTHER";
} | null {
  const sdmsMatch = name.match(/(\d+\.?\d*)\s*SDMS/i);
  if (sdmsMatch) return { hours: sdmsMatch[1], type: "SDMS" };

  const amaMatch = name.match(/(\d+\.?\d*)\s*AMA\s*PRA/i);
  if (amaMatch) return { hours: amaMatch[1], type: "AMA_PRA_1" };

  const anccMatch = name.match(/(\d+\.?\d*)\s*ANCC/i);
  if (anccMatch) return { hours: anccMatch[1], type: "ANCC" };

  return null;
}

/**
 * Fetch all enrolled course IDs for a user by email.
 * Returns an empty array if the user is not found in Thinkific.
 */
export async function getUserEnrollmentsByEmail(
  email: string
): Promise<number[]> {
  const user = await getUserByEmail(email);
  if (!user) return [];
  const enrollments = await getEnrollmentsByUserId(user.id);
  return enrollments.map((e) => e.course_id);
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface ThinkificOrder {
  id: number;
  product_id: number;
  product_name: string;
  status: string; // "Complete" | "Refunded" | "Pending"
  user_id: number;
  user_email: string;
  user_name: string;
  subscription: boolean;
  created_at: string;
}

/**
 * Fetch orders for a specific Thinkific user ID.
 * Returns only the first page (most recent 250 orders) to stay within rate limits.
 */
export async function getOrdersByUserId(
  thinkificUserId: number
): Promise<ThinkificOrder[]> {
  try {
    const data = await thinkificFetch<{ items: ThinkificOrder[] }>(
      `/orders?user_id=${thinkificUserId}&page=1&limit=250`
    );
    return data.items ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch orders for a specific email address directly.
 * More reliable than getUserByEmail + getOrdersByUserId because the
 * /users?query= endpoint can return Internal Server Error for some emails.
 */
export async function getOrdersByEmail(
  email: string
): Promise<ThinkificOrder[]> {
  try {
    const data = await thinkificFetch<{ items: ThinkificOrder[] }>(
      `/orders?user_email=${encodeURIComponent(email)}&page=1&limit=250`
    );
    return data.items ?? [];
  } catch {
    return [];
  }
}

/**
 * The Thinkific product ID for the UltrasoundAssist™ App - Premium Access subscription.
 * Enrollment URL: https://member.allaboutultrasound.com/enroll/3714929?price_id=4664974
 */
export const IHEARTECHO_PREMIUM_PRODUCT_ID = 3714929; // UltrasoundAssist™ Premium product ID
export const ULTRASOUNDASSIST_PREMIUM_PRODUCT_ID = 3714929;

// ─── Collections ─────────────────────────────────────────────────────────────

export interface ThinkificCollection {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  product_ids: number[];
}

/**
 * Fetch all collections (categories) from Thinkific.
 */
export async function getCollections(): Promise<ThinkificCollection[]> {
  return fetchAllPages<ThinkificCollection>("/collections");
}

/** Custom domain for All About Ultrasound™ member portal */
const MEMBER_DOMAIN = "member.allaboutultrasound.com";

/**
 * Build the direct course URL on the member portal.
 */
export function buildCourseUrl(slug: string): string {
  return `https://${MEMBER_DOMAIN}/courses/${slug}`;
}

/**
 * Build the enrollment/checkout URL on the member portal.
 */
export function buildEnrollUrl(productSlug: string): string {
  return `https://${MEMBER_DOMAIN}/products/${productSlug}`;
}

// ─── Free Membership Auto-Enrollment ─────────────────────────────────────────

/**
 * The Free Membership bundle for UltrasoundAssist™ on Thinkific.
 * Enrollment URL: https://member.allaboutultrasound.com/enroll/3714918?price_id=4664963
 */
export const FREE_MEMBERSHIP_COURSE_IDS = [3714918] as const;

/**
 * Find a Thinkific user by email, or create a new account if not found.
 * Returns the Thinkific user ID.
 *
 * @param email - The user's email address
 * @param firstName - First name for new account creation
 * @param lastName - Last name for new account creation
 */
export async function findOrCreateThinkificUser(
  email: string,
  firstName: string,
  lastName: string
): Promise<number> {
  // Try to find existing user first
  const existing = await getUserByEmail(email);
  if (existing) return existing.id;

  // Create a new Thinkific user
  const res = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: thinkificHeaders(),
    body: JSON.stringify({
      first_name: firstName || "Member",
      last_name: lastName || "",
      email,
      skip_custom_fields_validation: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Thinkific create user error ${res.status}: ${body}`);
  }

  const newUser = await res.json() as ThinkificUser;
  return newUser.id;
}

/**
 * Enroll a Thinkific user (by ID) into a single course.
 * Silently ignores 422 (already enrolled) errors.
 */
export async function enrollInCourse(
  thinkificUserId: number,
  courseId: number
): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/enrollments`, {
    method: "POST",
    headers: thinkificHeaders(),
    body: JSON.stringify({
      user_id: thinkificUserId,
      course_id: courseId,
      activated_at: new Date().toISOString(),
    }),
  });

  // 422 = already enrolled — treat as success
  if (res.status === 422) return true;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Thinkific enroll error ${res.status}: ${body}`);
  }

  return true;
}

/**
 * Enroll a user (by email) into all courses in the Free Membership bundle.
 * Creates the Thinkific account if it doesn't exist yet.
 * Returns the number of courses successfully enrolled.
 *
 * This is safe to call multiple times — already-enrolled courses are silently skipped.
 */
export async function enrollInFreeMembership(
  email: string,
  firstName: string,
  lastName: string
): Promise<{ thinkificUserId: number; coursesEnrolled: number }> {
  const thinkificUserId = await findOrCreateThinkificUser(email, firstName, lastName);

  let coursesEnrolled = 0;
  for (const courseId of FREE_MEMBERSHIP_COURSE_IDS) {
    try {
      await enrollInCourse(thinkificUserId, courseId);
      coursesEnrolled++;
    } catch (err) {
      // Log but don't fail the whole enrollment if one course fails
      console.error(`[Thinkific] Failed to enroll user ${email} in course ${courseId}:`, err);
    }
  }

  return { thinkificUserId, coursesEnrolled };
}

/**
 * Fetch all users from Thinkific (paginated, up to 250 per page).
 * Used for bulk backfill of All About Ultrasound™ accounts for existing members.
 * NOTE: This can be slow for large user bases — run as a background job.
 */
export async function getAllThinkificUsers(): Promise<ThinkificUser[]> {
  return fetchAllPages<ThinkificUser>("/users");
}
// ─── Course Structure (for import) ───────────────────────────────────────────
export interface ThinkificCourse {
  id: number;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  card_image_url: string | null;
  banner_image_url: string | null;
  instructor_id: number | null;
  course_card_text: string | null;
  keywords: string | null;
  duration_in_days: number | null;
  reviews_enabled: boolean;
  certificate_enabled: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ThinkificChapter {
  id: number;
  name: string;
  position: number;
  course_id: number;
  chapter_type: string;
  free_preview: boolean;
}

export interface ThinkificContent {
  id: number;
  name: string;
  position: number;
  chapter_id: number;
  course_id: number;
  contentable_type: string;
  free_preview: boolean;
  take_url: string | null;
  description: string | null;
  video_url: string | null;
  html_description: string | null;
  duration_in_seconds: number | null;
  permanent_url: string | null;
}

export interface ThinkificInstructor {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  slug: string;
  bio: string | null;
  title: string | null;
  avatar_image_url: string | null;
}

export async function getThinkificCourse(courseId: number): Promise<ThinkificCourse> {
  return thinkificFetch<ThinkificCourse>(`/courses/${courseId}`);
}

export async function getAllThinkificCourses(): Promise<ThinkificCourse[]> {
  return fetchAllPages<ThinkificCourse>("/courses");
}

export async function getChaptersForCourse(courseId: number): Promise<ThinkificChapter[]> {
  // Thinkific API v1: chapters are nested under /courses/:id/chapters
  const all = await fetchAllPages<ThinkificChapter>(`/courses/${courseId}/chapters`);
  return all.sort((a, b) => a.position - b.position);
}

export async function getContentsForChapter(chapterId: number): Promise<ThinkificContent[]> {
  // Thinkific API v1: contents are nested under /chapters/:id/contents
  // (the old /contents?chapter_id=X endpoint returns 404)
  const all = await fetchAllPages<ThinkificContent>(`/chapters/${chapterId}/contents`);
  return all.sort((a, b) => a.position - b.position);
}

export async function getEnrollmentsForCourse(courseId: number): Promise<ThinkificEnrollment[]> {
  // Thinkific API v1 requires query[course_id] to filter enrollments by course
  return fetchAllPages<ThinkificEnrollment>(`/enrollments?query[course_id]=${courseId}`);
}

export async function getThinkificInstructor(instructorId: number): Promise<ThinkificInstructor | null> {
  try {
    return await thinkificFetch<ThinkificInstructor>(`/instructors/${instructorId}`);
  } catch {
    return null;
  }
}
