/**
 * Load the latest media version bytes for a repository asset.
 * Uses s3Key (R2) with s3Url fallback — never treats /media/:slug URLs as storage keys.
 */
import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { mediaVersions } from "../../drizzle/schema";
import { getDb } from "../db";
import { downloadStorageObject } from "./downloadStorageObject";

export async function loadLatestMediaVersionBuffer(assetId: number): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const [version] = await db
    .select({ s3Key: mediaVersions.s3Key, s3Url: mediaVersions.s3Url })
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, assetId))
    .orderBy(sql`${mediaVersions.versionNumber} DESC`)
    .limit(1);

  if (!version?.s3Key) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No version found for this asset" });
  }

  try {
    return await downloadStorageObject(version.s3Key, version.s3Url);
  } catch (err: any) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err?.message ?? "Failed to download media file",
    });
  }
}
