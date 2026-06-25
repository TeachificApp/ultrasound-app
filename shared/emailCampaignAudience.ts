import { z } from "zod";

/** Legacy echo interest keys stored in users.interestPrefs JSON */
export const LEGACY_INTEREST_KEYS = [
  "acs",
  "adultEcho",
  "pediatricEcho",
  "fetalEcho",
  "pocus",
] as const;

export type LegacyInterestKey = (typeof LEGACY_INTEREST_KEYS)[number];

export const AbTestVariantSchema = z.object({
  key: z.string().min(1).max(10),
  name: z.string().max(100).optional(),
  weight: z.number().int().min(1).max(100),
  subject: z.string().max(500).optional(),
  htmlBody: z.string().optional(),
});

export const AbTestConfigSchema = z.object({
  enabled: z.boolean().default(false),
  variants: z.array(AbTestVariantSchema).default([]),
});

export const AudienceFilterSchema = z.object({
  /** Target pre-built email lists */
  listIds: z.array(z.number().int()).default([]),
  /** How lists combine with user filters: only | union | intersect */
  listMode: z.enum(["only", "union", "intersect"]).default("intersect"),
  /** Legacy interest categories from users.interestPrefs */
  interests: z.array(z.enum(LEGACY_INTEREST_KEYS)).default([]),
  /** Normalized lms_interests IDs (user_interests join) */
  interestIds: z.array(z.number().int()).default([]),
  roles: z.array(z.string()).default([]),
  subscriptionType: z.enum(["all", "premium", "free"]).default("all"),
  userStatus: z.enum(["all", "active", "pending"]).default("all"),
  specificEmails: z.array(z.string().email()).default([]),
  enrolledInCourseIds: z.array(z.number().int()).default([]),
  completedCourseIds: z.array(z.number().int()).default([]),
  freePreviewCourseIds: z.array(z.number().int()).default([]),
  /** Users with active (non-completed) full enrollment in these courses */
  activeAccessCourseIds: z.array(z.number().int()).default([]),
  purchasedProductIds: z.array(z.number().int()).default([]),
  downloadedProductIds: z.array(z.number().int()).default([]),
  /** Paid LMS course orders (lms_orders.status = paid) */
  purchasedCourseIds: z.array(z.number().int()).default([]),
  inGroupIds: z.array(z.number().int()).default([]),
  inCohortGroupIds: z.array(z.number().int()).default([]),
  submittedFormIds: z.array(z.number().int()).default([]),
  enrolledAfter: z.string().optional(),
  enrolledBefore: z.string().optional(),
  purchasedAfter: z.string().optional(),
  purchasedBefore: z.string().optional(),
  /** Filter by brand/App: "aaus" | "iheartecho" — users who have a brandMembership for this brand */
  brands: z.array(z.enum(["aaus", "iheartecho"])).default([]),
  /** Users subscribed to these membership plan IDs (membership_subscriptions) */
  membershipPlanIds: z.array(z.number().int()).default([]),
  /** Users enrolled in these bundle IDs (bundle_enrollments) */
  bundleIds: z.array(z.number().int()).default([]),
  /** Users enrolled in these workshop IDs (workshop_enrollments) */
  workshopIds: z.array(z.number().int()).default([]),
  /** Users enrolled in these workshop instance IDs (specific scheduled sessions) */
  workshopInstanceIds: z.array(z.number().int()).default([]),
  /** Users who purchased these physical product IDs */
  purchasedPhysicalProductIds: z.array(z.number().int()).default([]),
  /** Users who are members of these community IDs (community_members) */
  communityIds: z.array(z.number().int()).default([]),
  /** Users registered for these webinar IDs (webinar_registrations) */
  webinarIds: z.array(z.number().int()).default([]),
  /** Users who purchased these digital download bundle IDs */
  purchasedDigitalBundleIds: z.array(z.number().int()).default([]),
  /** Quiz offerings (lms_courses.type = quiz) — same enrollment tables as courses */
  enrolledInQuizIds: z.array(z.number().int()).default([]),
  completedQuizIds: z.array(z.number().int()).default([]),
  freePreviewQuizIds: z.array(z.number().int()).default([]),
  activeAccessQuizIds: z.array(z.number().int()).default([]),
  purchasedQuizIds: z.array(z.number().int()).default([]),
  /** Filter to users who opened a specific sent campaign */
  openedCampaignIds: z.array(z.number().int()).default([]),
  /** Filter to users who clicked a link in a specific sent campaign */
  clickedCampaignIds: z.array(z.number().int()).default([]),
  logic: z.enum(["and", "or"]).default("and"),
  abTest: AbTestConfigSchema.optional(),
});

export type AudienceFilter = z.infer<typeof AudienceFilterSchema>;
export type AbTestConfig = z.infer<typeof AbTestConfigSchema>;
export type AbTestVariant = z.infer<typeof AbTestVariantSchema>;

export type CampaignRecipient = {
  userId: number | null;
  email: string;
  displayName: string | null;
  name: string | null;
  listSubscriberId?: number;
  abVariant?: string;
};

export const DEFAULT_AUDIENCE_FILTER: AudienceFilter = {
  listIds: [],
  listMode: "intersect",
  interests: [],
  interestIds: [],
  roles: [],
  subscriptionType: "all",
  userStatus: "all",
  specificEmails: [],
  enrolledInCourseIds: [],
  completedCourseIds: [],
  freePreviewCourseIds: [],
  activeAccessCourseIds: [],
  purchasedProductIds: [],
  downloadedProductIds: [],
  purchasedCourseIds: [],
  inGroupIds: [],
  inCohortGroupIds: [],
  submittedFormIds: [],
  brands: [],
  membershipPlanIds: [],
  bundleIds: [],
  workshopIds: [],
  workshopInstanceIds: [],
  purchasedPhysicalProductIds: [],
  communityIds: [],
  webinarIds: [],
  purchasedDigitalBundleIds: [],
  enrolledInQuizIds: [],
  completedQuizIds: [],
  freePreviewQuizIds: [],
  activeAccessQuizIds: [],
  purchasedQuizIds: [],
  openedCampaignIds: [],
  clickedCampaignIds: [],
  logic: "and",
};

/** Stable bucket 0–99 from email for A/B assignment */
export function abBucketForEmail(email: string, campaignId = 0): number {
  const normalized = email.trim().toLowerCase();
  let hash = campaignId;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

export function pickAbVariant(
  email: string,
  abTest: AbTestConfig | undefined,
  campaignId?: number,
): AbTestVariant | null {
  if (!abTest?.enabled || abTest.variants.length === 0) return null;
  const bucket = abBucketForEmail(email, campaignId ?? 0);
  let cursor = 0;
  for (const variant of abTest.variants) {
    cursor += variant.weight;
    if (bucket < cursor) return variant;
  }
  return abTest.variants[abTest.variants.length - 1] ?? null;
}

export function buildRecipientTrackingKey(recipient: {
  userId: number | null;
  email: string;
}): string {
  if (recipient.userId) return `u${recipient.userId}`;
  return `e${Buffer.from(recipient.email.trim().toLowerCase()).toString("base64url")}`;
}

export function parseRecipientTrackingKey(key: string): {
  userId: number | null;
  email: string | null;
} {
  const cleaned = key.replace(/\.gif$/i, "");
  if (cleaned.startsWith("u")) {
    const id = parseInt(cleaned.slice(1), 10);
    return { userId: Number.isNaN(id) ? null : id, email: null };
  }
  if (cleaned.startsWith("e")) {
    try {
      return {
        userId: null,
        email: Buffer.from(cleaned.slice(1), "base64url").toString("utf8"),
      };
    } catch {
      return { userId: null, email: null };
    }
  }
  const legacyId = parseInt(cleaned, 10);
  if (!Number.isNaN(legacyId)) return { userId: legacyId, email: null };
  return { userId: null, email: null };
}
