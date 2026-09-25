import { and, asc, eq, gte, isNull, or, sql } from "drizzle-orm";
import {
  digitalProducts,
  digitalPurchases,
  lmsCourses,
  lmsEnrollments,
  scheduledContentLinks,
  webinars,
  webinarRegistrations,
  workshopEnrollments,
  workshopInstances,
} from "../../drizzle/schema";

export type ScheduledContentSourceType = "cohort_group" | "workshop_instance";
export type ScheduledContentTargetType = "course" | "download" | "webinar" | "workshop_instance";

type ScheduledLinkDb = any;

function futureDate(days: number | null | undefined): Date | null {
  if (!days || days < 1) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function isActiveThrough(value: Date | null | undefined, now = new Date()) {
  return !value || value.getTime() >= now.getTime();
}

/**
 * Copy reusable scheduled-content links only. It deliberately never copies
 * learners, payment records, submissions, or attendance.
 */
export async function cloneScheduledContentLinks(
  db: ScheduledLinkDb,
  input: { sourceType: ScheduledContentSourceType; sourceId: number; destinationId: number; createdByUserId: number },
) {
  const links = await db.select().from(scheduledContentLinks)
    .where(and(eq(scheduledContentLinks.sourceType, input.sourceType), eq(scheduledContentLinks.sourceId, input.sourceId)))
    .orderBy(asc(scheduledContentLinks.sortOrder), asc(scheduledContentLinks.id));
  if (!links.length) return { copied: 0 };

  await db.insert(scheduledContentLinks).values(links.map((link: any, index: number) => ({
    sourceType: input.sourceType,
    sourceId: input.destinationId,
    targetType: link.targetType,
    targetId: link.targetId,
    accessDurationDays: link.accessDurationDays,
    sortOrder: index,
    createdByUserId: input.createdByUserId,
  })));
  return { copied: links.length };
}

/**
 * Grants every configured item for one enrolled scheduled run. Each target is
 * independently idempotent and never sends purchase/enrollment email by itself.
 */
export async function grantScheduledContentAccess(
  db: ScheduledLinkDb,
  input: { userId: number; sourceType: ScheduledContentSourceType; sourceId: number },
) {
  const links = await db.select().from(scheduledContentLinks)
    .where(and(
      eq(scheduledContentLinks.sourceType, input.sourceType),
      eq(scheduledContentLinks.sourceId, input.sourceId),
    ))
    .orderBy(asc(scheduledContentLinks.sortOrder), asc(scheduledContentLinks.id));

  const granted: Array<{ linkId: number; targetType: string; targetId: number }> = [];
  const skipped: Array<{ linkId: number; reason: string }> = [];

  for (const link of links) {
    const linkExpiresAt = futureDate(link.accessDurationDays);
    if (link.targetType === "course") {
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses)
        .where(eq(lmsCourses.id, link.targetId)).limit(1);
      if (!course) {
        skipped.push({ linkId: link.id, reason: "course no longer exists" });
        continue;
      }
      const [existing] = await db.select().from(lmsEnrollments).where(and(
        eq(lmsEnrollments.userId, input.userId),
        eq(lmsEnrollments.courseId, link.targetId),
      )).limit(1);
      if (!existing) {
        await db.insert(lmsEnrollments).values({
          userId: input.userId,
          courseId: link.targetId,
          enrollmentType: "full",
          source: "scheduled_link",
          ...(linkExpiresAt ? { accessExpiresAt: linkExpiresAt } : {}),
        });
        granted.push({ linkId: link.id, targetType: link.targetType, targetId: link.targetId });
      } else if (linkExpiresAt && (!existing.accessExpiresAt || existing.accessExpiresAt < linkExpiresAt)) {
        await db.update(lmsEnrollments).set({ accessExpiresAt: linkExpiresAt })
          .where(eq(lmsEnrollments.id, existing.id));
        granted.push({ linkId: link.id, targetType: link.targetType, targetId: link.targetId });
      } else {
        skipped.push({ linkId: link.id, reason: "course access already active" });
      }
      continue;
    }

    if (link.targetType === "download") {
      const [product] = await db.select({
        id: digitalProducts.id,
        defaultAccessDays: digitalProducts.defaultAccessDays,
        maxDownloadsPerFile: digitalProducts.maxDownloadsPerFile,
      }).from(digitalProducts).where(eq(digitalProducts.id, link.targetId)).limit(1);
      if (!product) {
        skipped.push({ linkId: link.id, reason: "download product no longer exists" });
        continue;
      }
      const expiresAt = linkExpiresAt ?? futureDate(product.defaultAccessDays);
      const [existing] = await db.select().from(digitalPurchases).where(and(
        eq(digitalPurchases.userId, input.userId),
        eq(digitalPurchases.productId, product.id),
        eq(digitalPurchases.status, "open"),
        or(isNull(digitalPurchases.accessExpiresAt), gte(digitalPurchases.accessExpiresAt, new Date())),
      )).limit(1);
      if (existing) {
        skipped.push({ linkId: link.id, reason: "download access already active" });
        continue;
      }
      await db.insert(digitalPurchases).values({
        userId: input.userId,
        productId: product.id,
        amount: 0,
        currency: "usd",
        status: "open",
        maxDownloadsPerFile: product.maxDownloadsPerFile,
        ...(expiresAt ? { accessExpiresAt: expiresAt } : {}),
      });
      granted.push({ linkId: link.id, targetType: link.targetType, targetId: link.targetId });
      continue;
    }

    if (link.targetType === "webinar") {
      const [webinar] = await db.select({ id: webinars.id }).from(webinars)
        .where(eq(webinars.id, link.targetId)).limit(1);
      if (!webinar) {
        skipped.push({ linkId: link.id, reason: "webinar no longer exists" });
        continue;
      }
      const [existing] = await db.select().from(webinarRegistrations).where(and(
        eq(webinarRegistrations.userId, input.userId),
        eq(webinarRegistrations.webinarId, link.targetId),
      )).limit(1);
      if (existing && isActiveThrough(existing.accessExpiresAt)) {
        skipped.push({ linkId: link.id, reason: "webinar access already active" });
        continue;
      }
      if (existing) {
        await db.update(webinarRegistrations).set({ accessLevel: "full", accessExpiresAt: linkExpiresAt })
          .where(eq(webinarRegistrations.id, existing.id));
      } else {
        await db.insert(webinarRegistrations).values({
          webinarId: link.targetId,
          userId: input.userId,
          accessLevel: "full",
          ...(linkExpiresAt ? { accessExpiresAt: linkExpiresAt } : {}),
        });
      }
      granted.push({ linkId: link.id, targetType: link.targetType, targetId: link.targetId });
      continue;
    }

    const [instance] = await db.select({ id: workshopInstances.id, workshopId: workshopInstances.workshopId, status: workshopInstances.status })
      .from(workshopInstances).where(eq(workshopInstances.id, link.targetId)).limit(1);
    if (!instance) {
      skipped.push({ linkId: link.id, reason: "workshop instance no longer exists" });
      continue;
    }
    const [existing] = await db.select({ id: workshopEnrollments.id }).from(workshopEnrollments).where(and(
      eq(workshopEnrollments.userId, input.userId),
      eq(workshopEnrollments.instanceId, instance.id),
      eq(workshopEnrollments.status, "active"),
    )).limit(1);
    if (existing) {
      skipped.push({ linkId: link.id, reason: "workshop access already active" });
      continue;
    }
    await db.insert(workshopEnrollments).values({
      userId: input.userId,
      workshopId: instance.workshopId,
      instanceId: instance.id,
      amountPaid: 0,
      currency: "usd",
      status: "active",
      accessLevel: instance.status === "presale" ? "presale" : "full",
      ...(linkExpiresAt ? { accessExpiresAt: linkExpiresAt } : {}),
    });
    await db.update(workshopInstances).set({ enrolledCount: sql`enrolled_count + 1` })
      .where(eq(workshopInstances.id, instance.id));
    granted.push({ linkId: link.id, targetType: link.targetType, targetId: link.targetId });
  }

  return { granted, skipped };
}
