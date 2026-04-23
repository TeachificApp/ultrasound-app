/**
 * mediaPurgeCron.ts
 * Runs once per day. Permanently deletes media assets that were soft-deleted
 * more than 30 days ago: removes S3 files and all related DB rows.
 */

import { getDb } from "../db";
import { mediaAssets, mediaVersions, mediaAccessGrants, mediaViewEvents } from "../../drizzle/schema";
import { storageDelete } from "../storage";
import { and, eq, sql } from "drizzle-orm";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function purgeExpiredMedia() {
  const db = await getDb();
  if (!db) return;

  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const expired = await db
    .select({ id: mediaAssets.id, title: mediaAssets.title })
    .from(mediaAssets)
    .where(
      and(
        sql`${mediaAssets.deletedAt} IS NOT NULL`,
        sql`${mediaAssets.deletedAt} < ${cutoff.toISOString()}`
      )
    );

  if (expired.length === 0) return;

  let purged = 0;
  for (const { id, title } of expired) {
    try {
      const versions = await db
        .select({ s3Key: mediaVersions.s3Key })
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, id));

      await Promise.allSettled(versions.map((v) => storageDelete(v.s3Key)));

      await db.delete(mediaAccessGrants).where(eq(mediaAccessGrants.assetId, id));
      await db.delete(mediaViewEvents).where(eq(mediaViewEvents.assetId, id));
      await db.delete(mediaVersions).where(eq(mediaVersions.assetId, id));
      await db.delete(mediaAssets).where(eq(mediaAssets.id, id));

      purged++;
      console.log(`[MediaPurge] Permanently deleted asset #${id}: "${title}"`);
    } catch (err) {
      console.error(`[MediaPurge] Failed to purge asset #${id}:`, err);
    }
  }

  console.log(`[MediaPurge] Purged ${purged}/${expired.length} expired assets.`);
}

export function startMediaPurgeCron() {
  // Run once at startup (in case server was down during a scheduled window)
  purgeExpiredMedia().catch(console.error);

  // Then run every 24 hours
  setInterval(() => {
    purgeExpiredMedia().catch(console.error);
  }, 24 * 60 * 60 * 1000);

  console.log("[MediaPurge] Daily purge cron started.");
}
