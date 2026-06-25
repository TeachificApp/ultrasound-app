import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  users,
  userRoles,
  lmsEnrollments,
  digitalPurchases,
  digitalDownloadEvents,
  lmsGroupSeats,
  lmsCohortGroupEnrollments,
  generalFormSubmissions,
  emailListSubscribers,
  userInterests,
  lmsOrders,
  brandMemberships,
  membershipSubscriptions,
  bundleEnrollments,
  workshopEnrollments,
  communityMembers,
} from "../../drizzle/schema";
import {
  type AudienceFilter,
  type CampaignRecipient,
  pickAbVariant,
} from "../../shared/emailCampaignAudience";

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type UserRow = {
  id: number;
  email: string;
  displayName: string | null;
  name: string | null;
  isPremium: boolean;
  interestPrefs: string | null;
  isPending: boolean | null;
  unsubscribedAt: Date | null;
};

function toRecipient(u: UserRow): CampaignRecipient {
  return {
    userId: u.id,
    email: u.email,
    displayName: u.displayName,
    name: u.name,
  };
}

async function loadListSubscribers(
  listIds: number[],
): Promise<Map<string, CampaignRecipient>> {
  const db = await getDb();
  const map = new Map<string, CampaignRecipient>();
  if (!db || listIds.length === 0) return map;

  const rows = await db
    .select({
      id: emailListSubscribers.id,
      email: emailListSubscribers.email,
      name: emailListSubscribers.name,
      userId: emailListSubscribers.userId,
      status: emailListSubscribers.status,
    })
    .from(emailListSubscribers)
    .where(
      and(
        inArray(emailListSubscribers.listId, listIds),
        eq(emailListSubscribers.status, "subscribed"),
      ),
    );

  for (const row of rows) {
    if (!row.email) continue;
    const email = normalizeEmail(row.email);
    map.set(email, {
      userId: row.userId ?? null,
      email: row.email.trim(),
      displayName: row.name,
      name: row.name,
      listSubscriberId: row.id,
    });
  }
  return map;
}

async function loadAllUsers(): Promise<UserRow[]> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  return db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      name: users.name,
      isPremium: users.isPremium,
      interestPrefs: users.interestPrefs,
      isPending: users.isPending,
      unsubscribedAt: users.unsubscribedAt,
    })
    .from(users);
}

function applyBaseUserFilters(allUsers: UserRow[], filter: AudienceFilter): UserRow[] {
  let filtered = allUsers.filter((u) => u.email && u.email.trim() !== "" && !u.unsubscribedAt);

  if (filter.userStatus === "active") {
    filtered = filtered.filter((u) => !u.isPending);
  } else if (filter.userStatus === "pending") {
    filtered = filtered.filter((u) => u.isPending);
  }

  if (filter.subscriptionType === "premium") {
    filtered = filtered.filter((u) => u.isPremium);
  } else if (filter.subscriptionType === "free") {
    filtered = filtered.filter((u) => !u.isPremium);
  }

  return filtered;
}

function mergeRecipientMaps(
  a: Map<string, CampaignRecipient>,
  b: Map<string, CampaignRecipient>,
): Map<string, CampaignRecipient> {
  const out = new Map(a);
  for (const [email, rec] of b) {
    if (!out.has(email)) out.set(email, rec);
    else {
      const existing = out.get(email)!;
      out.set(email, {
        ...existing,
        userId: existing.userId ?? rec.userId,
        displayName: existing.displayName ?? rec.displayName,
        name: existing.name ?? rec.name,
      });
    }
  }
  return out;
}

function intersectRecipientMaps(
  a: Map<string, CampaignRecipient>,
  b: Map<string, CampaignRecipient>,
): Map<string, CampaignRecipient> {
  const out = new Map<string, CampaignRecipient>();
  for (const [email, rec] of a) {
    if (b.has(email)) {
      const other = b.get(email)!;
      out.set(email, {
        ...rec,
        userId: rec.userId ?? other.userId,
        displayName: rec.displayName ?? other.displayName,
        name: rec.name ?? other.name,
        listSubscriberId: rec.listSubscriberId ?? other.listSubscriberId,
      });
    }
  }
  return out;
}

async function emailsMatchingDimension(
  filter: AudienceFilter,
  dimension: string,
  candidateUserIds: Set<number>,
  candidateEmails: Set<string>,
): Promise<Set<string>> {
  const db = await getDb();
  const matches = new Set<string>();
  if (!db) return matches;

  const enrolledAfter = parseDate(filter.enrolledAfter);
  const enrolledBefore = parseDate(filter.enrolledBefore);
  const purchasedAfter = parseDate(filter.purchasedAfter);
  const purchasedBefore = parseDate(filter.purchasedBefore);

  if (dimension === "roles" && filter.roles.length > 0) {
    const roleUserIds = new Set<number>();
    for (const role of filter.roles) {
      const rows = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(eq(userRoles.role, role as never));
      rows.forEach((r) => roleUserIds.add(r.userId));
    }
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (roleUserIds.has(u.id) && u.email) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  if (dimension === "interests") {
    const legacy = filter.interests;
    const ids = filter.interestIds;
    if (legacy.length === 0 && ids.length === 0) return matches;

    const interestUserIds = new Set<number>();
    if (ids.length > 0) {
      const rows = await db
        .select({ userId: userInterests.userId })
        .from(userInterests)
        .where(inArray(userInterests.interestId, ids));
      rows.forEach((r) => interestUserIds.add(r.userId));
    }

    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (!u.email) continue;
      let ok = false;
      if (ids.length > 0 && interestUserIds.has(u.id)) ok = true;
      if (!ok && legacy.length > 0 && u.interestPrefs) {
        try {
          const prefs = JSON.parse(u.interestPrefs) as Record<string, boolean>;
          ok = legacy.some((k) => prefs[k] === true);
        } catch {
          /* ignore */
        }
      }
      if (ok) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  if (dimension === "enrolled" && filter.enrolledInCourseIds.length > 0) {
    for (const courseId of filter.enrolledInCourseIds) {
      const conditions = [eq(lmsEnrollments.courseId, courseId)];
      if (enrolledAfter) conditions.push(gte(lmsEnrollments.enrolledAt, enrolledAfter));
      if (enrolledBefore) conditions.push(lte(lmsEnrollments.enrolledAt, enrolledBefore));
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(and(...conditions));
      const allUsers = await loadAllUsers();
      const idSet = new Set(rows.map((r) => r.userId));
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "completed" && filter.completedCourseIds.length > 0) {
    for (const courseId of filter.completedCourseIds) {
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.courseId, courseId), isNotNull(lmsEnrollments.completedAt)));
      const allUsers = await loadAllUsers();
      const idSet = new Set(rows.map((r) => r.userId));
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "freePreview" && filter.freePreviewCourseIds.length > 0) {
    for (const courseId of filter.freePreviewCourseIds) {
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(
          and(
            eq(lmsEnrollments.courseId, courseId),
            eq(lmsEnrollments.enrollmentType, "free_preview"),
          ),
        );
      const allUsers = await loadAllUsers();
      const idSet = new Set(rows.map((r) => r.userId));
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "activeAccess" && filter.activeAccessCourseIds.length > 0) {
    for (const courseId of filter.activeAccessCourseIds) {
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(
          and(
            eq(lmsEnrollments.courseId, courseId),
            eq(lmsEnrollments.enrollmentType, "full"),
            isNull(lmsEnrollments.completedAt),
          ),
        );
      const allUsers = await loadAllUsers();
      const idSet = new Set(rows.map((r) => r.userId));
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "purchasedProducts" && filter.purchasedProductIds.length > 0) {
    for (const productId of filter.purchasedProductIds) {
      const conditions = [eq(digitalPurchases.productId, productId)];
      if (purchasedAfter) conditions.push(gte(digitalPurchases.purchasedAt, purchasedAfter));
      if (purchasedBefore) conditions.push(lte(digitalPurchases.purchasedAt, purchasedBefore));
      const rows = await db
        .select({ userId: digitalPurchases.userId })
        .from(digitalPurchases)
        .where(and(...conditions));
      const allUsers = await loadAllUsers();
      const idSet = new Set(rows.map((r) => r.userId));
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "downloaded" && filter.downloadedProductIds.length > 0) {
    for (const productId of filter.downloadedProductIds) {
      const conditions = [eq(digitalDownloadEvents.productId, productId)];
      if (purchasedAfter) conditions.push(gte(digitalDownloadEvents.downloadedAt, purchasedAfter));
      if (purchasedBefore) conditions.push(lte(digitalDownloadEvents.downloadedAt, purchasedBefore));
      const rows = await db
        .select({ userId: digitalDownloadEvents.userId })
        .from(digitalDownloadEvents)
        .where(and(...conditions));
      const allUsers = await loadAllUsers();
      const idSet = new Set(rows.map((r) => r.userId));
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "purchasedCourses" && filter.purchasedCourseIds.length > 0) {
    for (const courseId of filter.purchasedCourseIds) {
      const conditions = [
        eq(lmsOrders.courseId, courseId),
        eq(lmsOrders.status, "paid"),
      ];
      if (purchasedAfter) conditions.push(gte(lmsOrders.createdAt, purchasedAfter));
      if (purchasedBefore) conditions.push(lte(lmsOrders.createdAt, purchasedBefore));
      const rows = await db
        .select({ userId: lmsOrders.userId })
        .from(lmsOrders)
        .where(and(...conditions));
      const allUsers = await loadAllUsers();
      const idSet = new Set(rows.map((r) => r.userId));
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "groups" && filter.inGroupIds.length > 0) {
    for (const groupId of filter.inGroupIds) {
      const rows = await db
        .select({ email: lmsGroupSeats.email })
        .from(lmsGroupSeats)
        .where(and(eq(lmsGroupSeats.groupId, groupId), eq(lmsGroupSeats.status, "active")));
      rows.forEach((r) => {
        if (r.email) matches.add(normalizeEmail(r.email));
      });
    }
    return matches;
  }

  if (dimension === "cohorts" && filter.inCohortGroupIds.length > 0) {
    for (const cohortGroupId of filter.inCohortGroupIds) {
      const rows = await db
        .select({ userId: lmsCohortGroupEnrollments.userId })
        .from(lmsCohortGroupEnrollments)
        .where(eq(lmsCohortGroupEnrollments.cohortGroupId, cohortGroupId));
      const allUsers = await loadAllUsers();
      const idSet = new Set(rows.map((r) => r.userId));
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "forms" && filter.submittedFormIds.length > 0) {
    for (const formId of filter.submittedFormIds) {
      const rows = await db
        .select({ userEmail: generalFormSubmissions.userEmail })
        .from(generalFormSubmissions)
        .where(
          and(
            eq(generalFormSubmissions.formId, formId),
            isNotNull(generalFormSubmissions.userEmail),
          ),
        );
      rows.forEach((r) => {
        if (r.userEmail) matches.add(normalizeEmail(r.userEmail));
      });
    }
    return matches;
  }

  // ── New dimensions ────────────────────────────────────────────────────────

  if (dimension === "brands" && filter.brands.length > 0) {
    const rows = await db
      .select({ userId: brandMemberships.userId })
      .from(brandMemberships)
      .where(
        and(
          inArray(brandMemberships.brand, filter.brands as string[]),
          eq(brandMemberships.status, "active"),
        ),
      );
    const idSet = new Set(rows.map((r) => r.userId));
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  if (dimension === "membershipPlans" && filter.membershipPlanIds.length > 0) {
    const rows = await db
      .select({ userId: membershipSubscriptions.userId })
      .from(membershipSubscriptions)
      .where(
        and(
          inArray(membershipSubscriptions.planId, filter.membershipPlanIds),
          inArray(membershipSubscriptions.status, ["active", "trialing"]),
        ),
      );
    const idSet = new Set(rows.map((r) => r.userId));
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  if (dimension === "bundles" && filter.bundleIds.length > 0) {
    const rows = await db
      .select({ userId: bundleEnrollments.userId })
      .from(bundleEnrollments)
      .where(inArray(bundleEnrollments.bundleId, filter.bundleIds));
    const idSet = new Set(rows.map((r) => r.userId));
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  if (dimension === "workshops" && filter.workshopIds.length > 0) {
    const rows = await db
      .select({ userId: workshopEnrollments.userId })
      .from(workshopEnrollments)
      .where(inArray(workshopEnrollments.workshopId, filter.workshopIds));
    const idSet = new Set(rows.map((r) => r.userId));
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  if (dimension === "communities" && filter.communityIds.length > 0) {
    const rows = await db
      .select({ userId: communityMembers.userId })
      .from(communityMembers)
      .where(
        and(
          inArray(communityMembers.communityId, filter.communityIds),
          eq(communityMembers.memberStatus, "approved"),
        ),
      );
    const idSet = new Set(rows.map((r) => r.userId));
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  // ── Quiz dimensions (same enrollment tables as courses, filtered by type='quiz') ──

  if (dimension === "enrolledInQuiz" && (filter.enrolledInQuizIds ?? []).length > 0) {
    for (const quizId of filter.enrolledInQuizIds!) {
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.courseId, quizId), eq(lmsEnrollments.status, "enrolled")));
      const idSet = new Set(rows.map((r) => r.userId));
      const allUsers = await loadAllUsers();
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "completedQuiz" && (filter.completedQuizIds ?? []).length > 0) {
    for (const quizId of filter.completedQuizIds!) {
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.courseId, quizId), eq(lmsEnrollments.status, "completed")));
      const idSet = new Set(rows.map((r) => r.userId));
      const allUsers = await loadAllUsers();
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "freePreviewQuiz" && (filter.freePreviewQuizIds ?? []).length > 0) {
    for (const quizId of filter.freePreviewQuizIds!) {
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.courseId, quizId), eq(lmsEnrollments.status, "free_preview")));
      const idSet = new Set(rows.map((r) => r.userId));
      const allUsers = await loadAllUsers();
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "activeAccessQuiz" && (filter.activeAccessQuizIds ?? []).length > 0) {
    for (const quizId of filter.activeAccessQuizIds!) {
      const rows = await db
        .select({ userId: lmsEnrollments.userId })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.courseId, quizId), eq(lmsEnrollments.status, "active")));
      const idSet = new Set(rows.map((r) => r.userId));
      const allUsers = await loadAllUsers();
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  if (dimension === "purchasedQuiz" && (filter.purchasedQuizIds ?? []).length > 0) {
    for (const quizId of filter.purchasedQuizIds!) {
      const rows = await db
        .select({ userId: lmsOrders.userId })
        .from(lmsOrders)
        .where(and(eq(lmsOrders.courseId, quizId), eq(lmsOrders.status, "paid")));
      const idSet = new Set(rows.map((r) => r.userId));
      const allUsers = await loadAllUsers();
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    }
    return matches;
  }

  // ── Webinars ────────────────────────────────────────────────────────────────

  if (dimension === "webinars" && (filter.webinarIds ?? []).length > 0) {
    const [rows] = (await db.execute(sql`
      SELECT user_id as userId FROM webinar_registrations
      WHERE webinar_id IN (${sql.join(filter.webinarIds!.map((id) => sql`${id}`), sql`, `)})
    `)) as [{ userId: number }[], unknown];
    const idSet = new Set((Array.isArray(rows) ? rows : []).map((r) => r.userId));
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  // ── Digital bundles ─────────────────────────────────────────────────────────

  if (dimension === "digitalBundles" && (filter.purchasedDigitalBundleIds ?? []).length > 0) {
    const [rows] = (await db.execute(sql`
      SELECT user_id as userId FROM digital_bundle_purchases
      WHERE bundle_id IN (${sql.join(filter.purchasedDigitalBundleIds!.map((id) => sql`${id}`), sql`, `)})
    `)) as [{ userId: number }[], unknown];
    const idSet = new Set((Array.isArray(rows) ? rows : []).map((r) => r.userId));
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  // ── Workshop instances ──────────────────────────────────────────────────────

  if (dimension === "workshopInstances" && (filter.workshopInstanceIds ?? []).length > 0) {
    const rows = await db
      .select({ userId: workshopEnrollments.userId })
      .from(workshopEnrollments)
      .where(inArray(workshopEnrollments.workshopInstanceId, filter.workshopInstanceIds!));
    const idSet = new Set(rows.map((r) => r.userId));
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  // ── Physical products ───────────────────────────────────────────────────────

  if (dimension === "physicalProducts" && (filter.purchasedPhysicalProductIds ?? []).length > 0) {
    const [rows] = (await db.execute(sql`
      SELECT user_id as userId FROM physical_product_orders
      WHERE product_id IN (${sql.join(filter.purchasedPhysicalProductIds!.map((id) => sql`${id}`), sql`, `)})
        AND status IN ('paid', 'fulfilled', 'shipped')
    `)) as [{ userId: number }[], unknown];
    const idSet = new Set((Array.isArray(rows) ? rows : []).map((r) => r.userId));
    const allUsers = await loadAllUsers();
    for (const u of allUsers) {
      if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
    }
    return matches;
  }

  // ── Campaign engagement (opened / clicked) ────────────────────────────────

  if (dimension === "openedCampaigns" && (filter.openedCampaignIds ?? []).length > 0) {
    try {
      const [rows] = (await db.execute(sql`
        SELECT DISTINCT userId FROM emailCampaignEvents
        WHERE campaignId IN (${sql.join(filter.openedCampaignIds!.map((id) => sql`${id}`), sql`, `)})
          AND eventType = 'open'
      `)) as [{ userId: number }[], unknown];
      const idSet = new Set((Array.isArray(rows) ? rows : []).map((r) => r.userId).filter(Boolean));
      const allUsers = await loadAllUsers();
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    } catch (err) {
      console.error("[AudienceResolver] openedCampaigns filter error:", err);
    }
    return matches;
  }

  if (dimension === "clickedCampaigns" && (filter.clickedCampaignIds ?? []).length > 0) {
    try {
      const [rows] = (await db.execute(sql`
        SELECT DISTINCT userId FROM emailCampaignEvents
        WHERE campaignId IN (${sql.join(filter.clickedCampaignIds!.map((id) => sql`${id}`), sql`, `)})
          AND eventType = 'click'
      `)) as [{ userId: number }[], unknown];
      const idSet = new Set((Array.isArray(rows) ? rows : []).map((r) => r.userId).filter(Boolean));
      const allUsers = await loadAllUsers();
      for (const u of allUsers) {
        if (u.email && idSet.has(u.id)) matches.add(normalizeEmail(u.email));
      }
    } catch (err) {
      console.error("[AudienceResolver] clickedCampaigns filter error:", err);
    }
    return matches;
  }

  void candidateUserIds;
  void candidateEmails;
  return matches;
}

function activeDimensions(filter: AudienceFilter): string[] {
  const dims: string[] = [];
  if (filter.roles.length > 0) dims.push("roles");
  // Only activate the interests dimension when interestIds (userInterests table) are selected.
  // Legacy filter.interests (JSON interestPrefs) is no longer surfaced in the UI and most
  // Thinkific-synced users lack that data, so ignoring it prevents incorrect narrow counts.
  if (filter.interestIds.length > 0) dims.push("interests");
  if (filter.enrolledInCourseIds.length > 0) dims.push("enrolled");
  if (filter.completedCourseIds.length > 0) dims.push("completed");
  if (filter.freePreviewCourseIds.length > 0) dims.push("freePreview");
  if (filter.activeAccessCourseIds.length > 0) dims.push("activeAccess");
  if (filter.purchasedProductIds.length > 0) dims.push("purchasedProducts");
  if (filter.downloadedProductIds.length > 0) dims.push("downloaded");
  if (filter.purchasedCourseIds.length > 0) dims.push("purchasedCourses");
  if (filter.inGroupIds.length > 0) dims.push("groups");
  if (filter.inCohortGroupIds.length > 0) dims.push("cohorts");
  if (filter.submittedFormIds.length > 0) dims.push("forms");
  if ((filter.brands ?? []).length > 0) dims.push("brands");
  if ((filter.membershipPlanIds ?? []).length > 0) dims.push("membershipPlans");
  if ((filter.bundleIds ?? []).length > 0) dims.push("bundles");
  if ((filter.workshopIds ?? []).length > 0) dims.push("workshops");
  if ((filter.communityIds ?? []).length > 0) dims.push("communities");
  // New PR #45 dimensions
  if ((filter.enrolledInQuizIds ?? []).length > 0) dims.push("enrolledInQuiz");
  if ((filter.completedQuizIds ?? []).length > 0) dims.push("completedQuiz");
  if ((filter.freePreviewQuizIds ?? []).length > 0) dims.push("freePreviewQuiz");
  if ((filter.activeAccessQuizIds ?? []).length > 0) dims.push("activeAccessQuiz");
  if ((filter.purchasedQuizIds ?? []).length > 0) dims.push("purchasedQuiz");
  if ((filter.webinarIds ?? []).length > 0) dims.push("webinars");
  if ((filter.purchasedDigitalBundleIds ?? []).length > 0) dims.push("digitalBundles");
  if ((filter.workshopInstanceIds ?? []).length > 0) dims.push("workshopInstances");
  if ((filter.purchasedPhysicalProductIds ?? []).length > 0) dims.push("physicalProducts");
  if ((filter.openedCampaignIds ?? []).length > 0) dims.push("openedCampaigns");
  if ((filter.clickedCampaignIds ?? []).length > 0) dims.push("clickedCampaigns");
  return dims;
}

function applyDimensionLogic(
  base: Map<string, CampaignRecipient>,
  filter: AudienceFilter,
  dimensionSets: Set<string>[],
): Map<string, CampaignRecipient> {
  if (dimensionSets.length === 0) return base;

  const emailsPassing = new Set<string>();
  if (filter.logic === "and") {
    for (const email of base.keys()) {
      if (dimensionSets.every((set) => set.has(email))) emailsPassing.add(email);
    }
  } else {
    for (const set of dimensionSets) {
      for (const email of set) {
        if (base.has(email)) emailsPassing.add(email);
      }
    }
  }

  const out = new Map<string, CampaignRecipient>();
  for (const email of emailsPassing) {
    const rec = base.get(email);
    if (rec) out.set(email, rec);
  }
  return out;
}

export async function resolveRecipients(
  filter: AudienceFilter,
  campaignId?: number,
): Promise<CampaignRecipient[]> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  if (filter.specificEmails.length > 0) {
    const results: CampaignRecipient[] = [];
    const seen = new Set<string>();
    for (const raw of filter.specificEmails) {
      const email = normalizeEmail(raw);
      if (seen.has(email)) continue;
      seen.add(email);
      const [found] = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          name: users.name,
          unsubscribedAt: users.unsubscribedAt,
        })
        .from(users)
        .where(eq(users.email, raw.trim()))
        .limit(1);
      if (found?.email && !found.unsubscribedAt) {
        results.push({
          userId: found.id,
          email: found.email,
          displayName: found.displayName,
          name: found.name,
        });
      } else if (!found) {
        results.push({
          userId: null,
          email: raw.trim(),
          displayName: null,
          name: null,
        });
      }
    }
    return assignAbVariants(results, filter, campaignId);
  }

  const listSubs = await loadListSubscribers(filter.listIds);
  const allUsers = await loadAllUsers();
  const filteredUsers = applyBaseUserFilters(allUsers, filter);

  const userMap = new Map<string, CampaignRecipient>();
  for (const u of filteredUsers) {
    userMap.set(normalizeEmail(u.email), toRecipient(u));
  }

  let base: Map<string, CampaignRecipient>;
  if (filter.listIds.length === 0) {
    base = userMap;
  } else if (filter.listMode === "only") {
    base = new Map();
    for (const [email, rec] of listSubs) {
      const user = allUsers.find((u) => u.email && normalizeEmail(u.email) === email);
      if (user?.unsubscribedAt) continue;
      base.set(email, rec);
    }
  } else if (filter.listMode === "union") {
    base = mergeRecipientMaps(listSubs, userMap);
    for (const [email, rec] of base) {
      const user = allUsers.find((u) => u.email && normalizeEmail(u.email) === email);
      if (user?.unsubscribedAt) base.delete(email);
      else if (!user && rec.userId === null) {
        /* list-only subscriber — keep */
      }
    }
  } else {
    base = intersectRecipientMaps(listSubs, userMap);
  }

  const dims = activeDimensions(filter);
  if (dims.length > 0) {
    const dimensionSets: Set<string>[] = [];
    for (const dim of dims) {
      dimensionSets.push(
        await emailsMatchingDimension(
          filter,
          dim,
          new Set(filteredUsers.map((u) => u.id)),
          new Set(base.keys()),
        ),
      );
    }
    base = applyDimensionLogic(base, filter, dimensionSets);
  }

  const recipients = Array.from(base.values());
  return assignAbVariants(recipients, filter, campaignId);
}

function assignAbVariants(
  recipients: CampaignRecipient[],
  filter: AudienceFilter,
  campaignId?: number,
): CampaignRecipient[] {
  if (!filter.abTest?.enabled) return recipients;
  return recipients.map((r) => {
    const variant = pickAbVariant(r.email, filter.abTest, campaignId);
    return variant ? { ...r, abVariant: variant.key } : r;
  });
}
