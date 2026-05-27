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

async function thinkificFetch<T>(path: string, retries = 5): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: thinkificHeaders(),
    });
    if (res.status === 429) {
      // Rate limited — wait with exponential backoff then retry
      const retryAfterHeader = res.headers.get("Retry-After");
      const waitMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : Math.min(3000 * Math.pow(2, attempt), 60000); // 3s, 6s, 12s, 24s, 48s, max 60s
      if (attempt < retries) {
        console.warn(`[Thinkific] 429 rate limit on ${path} — waiting ${waitMs}ms before retry ${attempt + 1}/${retries}`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(`Thinkific API rate limit exceeded after ${retries} retries for ${path}. Please wait a minute and try again.`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Thinkific API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }
  throw new Error(`Thinkific API rate limit exceeded after ${retries} retries for ${path}. Please wait a minute and try again.`);
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
  return `https://${MEMBER_DOMAIN}/product/${productSlug}`;
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
  course_card_image_url: string | null; // Correct field name returned by Thinkific API
  /** @deprecated Use course_card_image_url instead */
  card_image_url?: string | null;       // Not returned by API — kept for backward compat
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
  contentable_type: string;
  free: boolean | undefined;
  take_url: string | null;
  // Fields below are NOT returned by the API but kept for type compat
  course_id?: number;
  free_preview?: boolean;
  description?: string | null;
  video_url?: string | null;
  html_description?: string | null;
  duration_in_seconds?: number | null;
  permanent_url?: string | null;
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

// ─── Rich Content Detail ─────────────────────────────────────────────────────

export interface ThinkificContentAnswer {
  id: number;
  text: string;
  correct: boolean;
  image_url?: string | null;
}

export interface ThinkificContentQuestion {
  id: number;
  text: string;
  question_type: string; // "multiple_choice" | "true_false" | "short_answer" | "file_upload"
  correct_answer?: string | null;
  explanation?: string | null;
  image_url?: string | null;
  answers?: ThinkificContentAnswer[];
}

/**
 * Full content detail returned by GET /contents/{id}.
 * Covers all Thinkific content types: Text, Video, Download, Presentation, Quiz, Exam, Survey, Assignment.
 */
export interface ThinkificContentDetail extends ThinkificContent {
  // Common
  description: string | null;
  html_description: string | null; // rich HTML body — Text lessons include inline <img> tags with full URLs
  body?: string | null;            // alias used by some content types
  duration_in_seconds: number | null;
  permanent_url: string | null;

  // Video
  video_url?: string | null;
  wistia_hashed_id?: string | null;
  youtube_video_id?: string | null;
  vimeo_video_id?: string | null;
  video_id?: string | null;

  // Download / File attachment
  download_url?: string | null;    // direct download link
  file_name?: string | null;
  file_size?: number | null;       // bytes
  content_type?: string | null;    // MIME type

  // Presentation
  slide_urls?: string[] | null;

  // Quiz / Exam / Survey
  questions?: ThinkificContentQuestion[];
  pass_percent?: number | null;
  randomize_questions?: boolean;
  show_answers?: boolean;

  // Assignment
  assignment_due_date?: string | null;
  assignment_instructions?: string | null;
}

/**
 * Fetch full content detail for a single lesson.
 * Rate limit: 120 req/min — use sparingly in bulk imports.
 */
export async function getContentDetail(contentId: number): Promise<ThinkificContentDetail | null> {
  try {
    return await thinkificFetch<ThinkificContentDetail>(`/contents/${contentId}`);
  } catch (err) {
    console.error(`[Thinkific] Failed to fetch content detail for ${contentId}:`, err);
    return null;
  }
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

// ─── Admin Session Auth (for lesson content scraping) ────────────────────────
//
// The Thinkific public API v1 does NOT expose lesson body content through
// /contents/{id} — it only returns metadata. The actual html_description,
// video IDs, and rich content are only accessible via the course player API,
// which requires an authenticated user session.
//
// This helper authenticates as the site admin using email + password to obtain
// a session cookie, then uses that session to call the internal course player
// API at /api/course_player/v2/contents/{id}.

interface ThinkificAdminSession {
  cookie: string;
  expiresAt: number; // Unix ms — sessions last ~24h, we refresh after 20h
}

let _adminSession: ThinkificAdminSession | null = null;

/**
 * Sign in to Thinkific as the site admin and return the session cookie string.
 * Caches the session for 20 hours before refreshing.
 */
export async function getThinkificAdminSession(): Promise<string> {
  const now = Date.now();
  if (_adminSession && _adminSession.expiresAt > now) {
    return _adminSession.cookie;
  }

  const email = ENV.thinkificAdminEmail;
  const password = ENV.thinkificAdminPassword;
  const subdomain = ENV.thinkificSubdomain;

  if (!email || !password) {
    throw new Error(
      "[Thinkific] THINKIFIC_ADMIN_EMAIL and THINKIFIC_ADMIN_PASSWORD are required for lesson content scraping. " +
      "Add them in Settings → Secrets."
    );
  }

  const res = await fetch(`https://${subdomain}.thinkific.com/users/sign_in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ user: { email, password } }),
  });

  // Thinkific returns HTTP 200 with HTML on successful login (it's a redirect page),
  // or HTTP 200 with JSON containing status=FAILED on bad credentials.
  // The session cookie is the authoritative indicator of success.
  const setCookieHeader = res.headers.get("set-cookie") ?? "";
  const sessionMatch = setCookieHeader.match(/_thinkific_session=([^;]+)/);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[Thinkific] Admin sign-in failed ${res.status}: ${body.substring(0, 200)}`);
  }

  // If JSON response, check for explicit FAILED status
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json() as { data?: { status?: string; errors?: { message: string }[] } };
    if (data?.data?.status === "FAILED") {
      const msg = data.data.errors?.[0]?.message ?? "unknown error";
      throw new Error(`[Thinkific] Admin sign-in rejected: ${msg}. Check THINKIFIC_ADMIN_EMAIL and THINKIFIC_ADMIN_PASSWORD.`);
    }
  } else {
    // HTML response — consume body to free connection
    await res.text().catch(() => "");
  }

  if (!sessionMatch) {
    throw new Error("[Thinkific] Admin sign-in returned HTTP 200 but no session cookie. Check THINKIFIC_ADMIN_EMAIL and THINKIFIC_ADMIN_PASSWORD.");
  }

  const cookie = `_thinkific_session=${sessionMatch[1]}`;
  _adminSession = { cookie, expiresAt: now + 20 * 60 * 60 * 1000 }; // 20h
  console.log("[Thinkific] Admin session refreshed successfully.");
  return cookie;
}

/**
 * Invalidate the cached admin session (call after 401 responses).
 */
export function invalidateThinkificAdminSession(): void {
  _adminSession = null;
}

/**
 * Full lesson content detail returned by the Thinkific course player API.
 * This is the ONLY way to get html_description, video IDs, and rich content
 * because the public API v1 /contents/{id} does not expose them.
 */
export interface ThinkificLessonContent {
  id: number;
  name: string;
  contentable_type: string;
  // Text / HTML lessons
  html_description?: string | null;
  body?: string | null;
  // Video lessons
  wistia_hashed_id?: string | null;
  youtube_video_id?: string | null;
  vimeo_video_id?: string | null;
  video_url?: string | null;
  // Download / file
  download_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;       // bytes (may be returned by player API)
  content_type?: string | null;
  // Description / plain text body (may be returned by player API)
  description?: string | null;
  // Presentation
  slide_urls?: string[] | null;
  // Quiz / Exam
  questions?: ThinkificContentQuestion[];
  pass_percent?: number | null;
  randomize_questions?: boolean;
  show_answers?: boolean;
  // Iframe / multimedia
  iframe_url?: string | null;
  // Duration
  duration_in_seconds?: number | null;
}

/**
 * Fetch full lesson content using the Thinkific course player API.
 * Falls back to null on error (e.g., auth failure, rate limit).
 *
 * NOTE: Requires THINKIFIC_ADMIN_EMAIL and THINKIFIC_ADMIN_PASSWORD secrets.
 */
/**
 * Unwrap a Thinkific course player API response.
 * The API sometimes wraps the content in { content: {...} } or { data: {...} }.
 * This helper normalises both wrapped and bare responses.
 */
function unwrapPlayerResponse(raw: unknown): ThinkificLessonContent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Bare object with an `id` field → already unwrapped
  if (typeof r.id === "number" || typeof r.id === "string") return r as unknown as ThinkificLessonContent;
  // Wrapped: { content: { id, ... } }
  if (r.content && typeof r.content === "object") return r.content as ThinkificLessonContent;
  // Wrapped: { data: { id, ... } }
  if (r.data && typeof r.data === "object") return r.data as ThinkificLessonContent;
  return null;
}

export async function getContentDetailWithSession(
  contentId: number,
  courseSlug: string
): Promise<ThinkificLessonContent | null> {
  const subdomain = ENV.thinkificSubdomain;
  const memberDomain = "member.allaboutultrasound.com";

  // Endpoints to try in order (member domain first, then subdomain)
  const endpoints = [
    `https://${memberDomain}/api/course_player/v2/contents/${contentId}`,
    `https://${subdomain}.thinkific.com/api/course_player/v2/contents/${contentId}`,
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const sessionCookie = await getThinkificAdminSession();

      for (const endpoint of endpoints) {
        const res = await fetch(endpoint, {
          headers: {
            "Cookie": sessionCookie,
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": `https://${memberDomain}/courses/${courseSlug}/take`,
          },
        });

        if (res.status === 401) {
          invalidateThinkificAdminSession();
          break; // break inner loop, retry outer
        }
        if (!res.ok) {
          console.warn(`[Thinkific] player API ${endpoint} → ${res.status}`);
          continue; // try next endpoint
        }

        const raw = await res.json();
        const content = unwrapPlayerResponse(raw);
        if (content) {
          const hasRichContent = !!(content.html_description || (content as any).body || content.wistia_hashed_id || content.youtube_video_id || content.vimeo_video_id || content.download_url || content.questions?.length);
          console.log(`[Thinkific] player API OK for ${contentId} (${content.contentable_type ?? "?"})${hasRichContent ? " ✓ has content" : " (metadata only)"}`);
          return content;
        }
        console.warn(`[Thinkific] player API ${endpoint} returned unexpected shape:`, JSON.stringify(raw).substring(0, 200));
      }
    } catch (err) {
      console.error(`[Thinkific] getContentDetailWithSession error for ${contentId}:`, err);
      if (attempt === 0) {
        invalidateThinkificAdminSession();
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Scrape a Thinkific lesson page by fetching the take_url HTML with the admin session.
 *
 * Thinkific embeds the full lesson state as JSON inside a <script> tag:
 *   window.__INITIAL_STATE__ = { ... }
 * or as a data attribute on the root element.
 *
 * This is the LAST-RESORT fallback when the course player JSON API returns no rich content.
 * It handles text, video (Wistia/YouTube/Vimeo), download, and embed lesson types.
 *
 * @param takeUrl  Relative path, e.g. "/courses/slug/take/123/456"
 * @returns        ThinkificLessonContent-shaped object, or null on failure
 */
export async function scrapeLessonFromTakeUrl(takeUrl: string): Promise<ThinkificLessonContent | null> {
  const memberDomain = "member.allaboutultrasound.com";
  const fullUrl = takeUrl.startsWith("http") ? takeUrl : `https://${memberDomain}${takeUrl}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const sessionCookie = await getThinkificAdminSession();
      const res = await fetch(fullUrl, {
        headers: {
          "Cookie": sessionCookie,
          "Accept": "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": `https://${memberDomain}/`,
        },
        redirect: "follow",
      });

      if (res.status === 401 || res.status === 403) {
        invalidateThinkificAdminSession();
        if (attempt === 0) continue;
        return null;
      }
      if (!res.ok) {
        console.warn(`[Thinkific] scrapeLessonFromTakeUrl: ${fullUrl} → ${res.status}`);
        return null;
      }

      const html = await res.text();

      // ── 1. Try to extract window.__INITIAL_STATE__ JSON ──────────────────────
      // Thinkific embeds the full lesson state as JSON in a <script> tag.
      // Pattern: window.__INITIAL_STATE__={"content":{"id":...}}
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})(?:\s*;|\s*<\/script>)/);
      if (stateMatch) {
        try {
          const state = JSON.parse(stateMatch[1]);
          // The content is usually at state.content or state.coursePlayer.content
          const raw = state?.content ?? state?.coursePlayer?.content ?? state?.lesson ?? null;
          const content = unwrapPlayerResponse(raw);
          if (content) {
            console.log(`[Thinkific] scrapeLessonFromTakeUrl: extracted __INITIAL_STATE__ for ${fullUrl}`);
            return content;
          }
        } catch {
          // JSON parse failed — fall through to HTML parsing
        }
      }

      // ── 2. Try data-react-props or data-props JSON ────────────────────────────
      const propsMatch = html.match(/data-(?:react-)?props="([^"]+)"/);
      if (propsMatch) {
        try {
          const props = JSON.parse(propsMatch[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
          const raw = props?.content ?? props?.lesson ?? null;
          const content = unwrapPlayerResponse(raw);
          if (content) {
            console.log(`[Thinkific] scrapeLessonFromTakeUrl: extracted data-props for ${fullUrl}`);
            return content;
          }
        } catch {
          // fall through
        }
      }

      // ── 3. HTML parsing fallback ──────────────────────────────────────────────
      // Extract lesson title
      const titleMatch = html.match(/<h1[^>]*class="[^"]*(?:lesson|content)[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
        || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const name = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : "";

      // Extract rich HTML content
      const htmlContentMatch = html.match(/<div[^>]*class="[^"]*(?:html-content|lesson-content|content-body|text-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const html_description = htmlContentMatch ? htmlContentMatch[1].trim() : null;

      // Extract Wistia embed
      const wistiaMatch = html.match(/wistia_async_([a-z0-9]+)/i) || html.match(/wistia\.com\/medias\/([a-z0-9]+)/i);
      const wistia_hashed_id = wistiaMatch ? wistiaMatch[1] : null;

      // Extract YouTube embed
      const youtubeMatch = html.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const youtube_video_id = youtubeMatch ? youtubeMatch[1] : null;

      // Extract Vimeo embed
      const vimeoMatch = html.match(/player\.vimeo\.com\/video\/(\d+)/);
      const vimeo_video_id = vimeoMatch ? vimeoMatch[1] : null;

      if (html_description || wistia_hashed_id || youtube_video_id || vimeo_video_id) {
        console.log(`[Thinkific] scrapeLessonFromTakeUrl: HTML-parsed content for ${fullUrl}`);
        return {
          id: 0,
          name,
          contentable_type: wistia_hashed_id || youtube_video_id || vimeo_video_id ? "Video" : "HtmlItem",
          html_description,
          wistia_hashed_id,
          youtube_video_id,
          vimeo_video_id,
        };
      }

      console.warn(`[Thinkific] scrapeLessonFromTakeUrl: no content found in HTML for ${fullUrl}`);
      return null;
    } catch (err) {
      console.error(`[Thinkific] scrapeLessonFromTakeUrl error for ${fullUrl}:`, err);
      if (attempt === 0) {
        invalidateThinkificAdminSession();
        continue;
      }
      return null;
    }
  }
  return null;
}
