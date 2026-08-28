/**
 * Enrollment-aware access checks for private media assets embedded in LMS lessons.
 */
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import { lmsLessons, lmsSections, mediaAssets, mediaVersions } from "../../drizzle/schema";
import { resolveEnrollmentForCourse } from "./enrollmentAccess";

type MediaAssetRef = {
  id: number;
  slug: string;
  access: string;
};

/** True when the learner may view a private media asset in course context. */
export async function userCanAccessMediaAssetForCourse(
  db: MySql2Database<typeof schema>,
  userId: number,
  asset: MediaAssetRef,
  courseId?: number,
  isPlatformAdmin = false,
): Promise<boolean> {
  if (isPlatformAdmin) return true;
  if (asset.access === "public") return true;

  if (courseId != null) {
    const enrollment = await resolveEnrollmentForCourse(db, userId, courseId);
    if (enrollment) return true;
  }

  const slugPattern = `%/media/${asset.slug}/%`;
  const linkedLessons = await db
    .select({
      courseId: lmsLessons.courseId,
      sectionCourseId: lmsSections.courseId,
      embedUrl: lmsLessons.embedUrl,
      content: lmsLessons.content,
    })
    .from(lmsLessons)
    .leftJoin(lmsSections, eq(lmsLessons.sectionId, lmsSections.id))
    .where(
      or(
        eq(lmsLessons.mediaAssetId, asset.id),
        sql`${lmsLessons.embedUrl} LIKE ${slugPattern}`,
        sql`${lmsLessons.content} LIKE ${slugPattern}`,
      ),
    );

  for (const row of linkedLessons) {
    const resolvedCourseId = row.courseId ?? row.sectionCourseId;
    if (resolvedCourseId == null) continue;
    const enrollment = await resolveEnrollmentForCourse(db, userId, resolvedCourseId);
    if (enrollment) return true;
  }

  return false;
}

export type LinkedLessonMediaAsset = {
  id: number;
  slug: string;
  mediaType: string | null;
  title: string;
  fileName: string | null;
};

/** Resolve the media asset attached to a lesson, including current version filename. */
export async function loadLinkedLessonMediaAsset(
  db: MySql2Database<typeof schema>,
  mediaAssetId: number | null | undefined,
): Promise<LinkedLessonMediaAsset | null> {
  if (!mediaAssetId) return null;

  const [asset] = await db
    .select({
      id: mediaAssets.id,
      slug: mediaAssets.slug,
      mediaType: mediaAssets.mediaType,
      title: mediaAssets.title,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaAssetId))
    .limit(1);
  if (!asset) return null;

  const [version] = await db
    .select({ fileName: mediaVersions.fileName })
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, asset.id))
    .orderBy(desc(mediaVersions.versionNumber))
    .limit(1);

  return {
    ...asset,
    fileName: version?.fileName ?? null,
  };
}
