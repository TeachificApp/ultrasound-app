/**
 * mediaRepoRouter.ts
 * Platform-admin-only media repository.
 *
 * Procedures:
 *   uploadAsset       — create a new asset + first version (multipart base64)
 *   listAssets        — paginated list with search/type filter
 *   getAsset          — full asset detail + current version + version history
 *   updateAsset       — edit title/description/tags/access
 *   deleteAsset       — soft-delete
 *   reuploadVersion   — add a new version without changing the slug/links
 *   listVersions      — all versions for an asset
 *   restoreVersion    — make an older version the "current" one
 *   setAccess         — toggle public/private
 *   inviteByEmail     — create a signed access grant and send invite email
 *   listGrants        — list access grants for an asset
 *   revokeGrant       — revoke a specific grant
 *   validateToken     — public: check if a token is valid for an asset slug
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, gte, inArray, isNull, like, or, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { storagePut, storageDelete } from "../storage";
import { sendEmail } from "../_core/email";
import AdmZip from "adm-zip";
import {
  mediaAssets,
  mediaVersions,
  mediaAccessGrants,
  mediaViewEvents,
  mediaFolders,
  lmsEnrollments,
} from "../../drizzle/schema";
import { initialScormExtractionStatus, needsScormExtraction, queueScormExtractionIfNeeded, pickScormPlaybackMode } from "../lib/scormPackage";
import { extractAndUploadScormVersion } from "../routes/scormExtractor";
import { buildMediaAuthQuery, signMediaViewerToken } from "../lib/mediaEmbedAccess";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertPlatformAdmin(ctx: { user: { id: number; role: string } }) {
  const ownerId = process.env.OWNER_OPEN_ID;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const [user] = await db
    .select({ role: (await import("../../drizzle/schema")).users.role, openId: (await import("../../drizzle/schema")).users.openId })
    .from((await import("../../drizzle/schema")).users)
    .where(eq((await import("../../drizzle/schema")).users.id, ctx.user.id))
    .limit(1);
  if (!user || (user.role !== "admin" && user.openId !== ownerId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  }
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const suffix = randomBytes(4).toString("hex");
  return `${base}-${suffix}`;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function detectMediaType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "text/html") return "html";
  if (mimeType === "application/pdf" || mimeType.includes("word") || mimeType.includes("presentation")) return "document";
  if (mimeType === "application/zip" || mimeType === "application/x-zip-compressed") return "zip";
  return "other";
}

/**
 * Inspect a ZIP buffer to determine if it is a SCORM package.
 * SCORM packages contain imsmanifest.xml at the root or one level deep.
 */
function detectIfScorm(buffer: Buffer): boolean {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().map(e => e.entryName.toLowerCase());
    return entries.some(name =>
      name === "imsmanifest.xml" ||
      /^[^/]+\/imsmanifest\.xml$/.test(name)
    );
  } catch {
    return false;
  }
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const MEDIA_TYPES = ["image", "video", "audio", "document", "html", "scorm", "zip", "lms", "other"] as const;

const uploadFileSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  tags: z.string().max(500).optional(),
  access: z.enum(["public", "private"]).default("private"),
  mediaType: z.enum(MEDIA_TYPES).optional(),
  // Base64-encoded file data
  fileData: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  fileSize: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const mediaRepoRouter = router({
  /**
   * Upload a new asset (creates asset row + version 1).
   * File data is base64-encoded to avoid multipart complexity.
   */
  uploadAsset: protectedProcedure
    .input(uploadFileSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const slug = generateSlug(input.title);
      // Upload to S3
      const buffer = Buffer.from(input.fileData, "base64");
      // Auto-detect SCORM: if no explicit mediaType provided and the file is a ZIP,
      // inspect its contents for imsmanifest.xml
      let detectedType = input.mediaType ?? detectMediaType(input.mimeType);
      if (!input.mediaType && detectedType === "zip" && detectIfScorm(buffer)) {
        detectedType = "scorm";
      }
      const mediaType = detectedType as typeof MEDIA_TYPES[number];
      const s3Key = `media-repo/${slug}/v1-${input.fileName}`;
      const { url: s3Url } = await storagePut(s3Key, buffer, input.mimeType);

      // Insert asset
      const [assetResult] = await db.insert(mediaAssets).values({
        slug,
        title: input.title,
        description: input.description ?? null,
        mediaType,
        mimeType: input.mimeType,
        access: input.access,
        tags: input.tags ?? null,
        createdByUserId: ctx.user.id,
      });
      const assetId = (assetResult as any).insertId as number;

      // Insert version 1
      await db.insert(mediaVersions).values({
        assetId,
        versionNumber: 1,
        s3Key,
        s3Url,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        notes: input.notes ?? null,
        uploadedByUserId: ctx.user.id,
        scormExtractionStatus: initialScormExtractionStatus({
          mediaType,
          mimeType: input.mimeType,
          fileName: input.fileName,
        }),
      });

      const [insertedVersion] = await db
        .select({ id: mediaVersions.id })
        .from(mediaVersions)
        .where(and(eq(mediaVersions.assetId, assetId), eq(mediaVersions.versionNumber, 1)))
        .limit(1);
      if (insertedVersion) {
        await queueScormExtractionIfNeeded(insertedVersion.id, s3Url, slug, {
          mediaType,
          mimeType: input.mimeType,
          fileName: input.fileName,
        });
      }

      return { id: assetId, slug, s3Url };
    }),

  /**
   * List all assets (non-deleted) with optional search and type filter.
   */
  listAssets: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      mediaType: z.enum(MEDIA_TYPES).optional(),
      access: z.enum(["public", "private"]).optional(),
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      folder: z.string().nullable().optional(), // null = uncategorized, string = specific folder, undefined = all
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(24),
    }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const offset = (input.page - 1) * input.pageSize;

      const conditions = [isNull(mediaAssets.deletedAt)];
      if (input.mediaType) conditions.push(eq(mediaAssets.mediaType, input.mediaType));
      if (input.access) conditions.push(eq(mediaAssets.access, input.access));
      if (input.brand) conditions.push(eq(mediaAssets.brand, input.brand));
      if (input.search) {
        conditions.push(
          or(
            like(mediaAssets.title, `%${input.search}%`),
            like(mediaAssets.tags, `%${input.search}%`)
          )!
        );
      }
      if (input.folder !== undefined) {
        if (input.folder === null || input.folder === "") {
          conditions.push(isNull(mediaAssets.folder));
        } else {
          conditions.push(eq(mediaAssets.folder, input.folder));
        }
      }

      const where = and(...conditions);

      const assets = await db
        .select()
        .from(mediaAssets)
        .where(where)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      // Get current version URL for each asset
      const enriched = await Promise.all(
        assets.map(async (asset) => {
          const [currentVersion] = await db
            .select({ s3Url: mediaVersions.s3Url, versionNumber: mediaVersions.versionNumber, fileName: mediaVersions.fileName, fileSize: mediaVersions.fileSize })
            .from(mediaVersions)
            .where(eq(mediaVersions.assetId, asset.id))
            .orderBy(desc(mediaVersions.versionNumber))
            .limit(1);
          return { ...asset, currentVersion: currentVersion ?? null };
        })
      );

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mediaAssets)
        .where(where);

      // Get all distinct folders for sidebar
      const folderRows = await db
        .selectDistinct({ folder: mediaAssets.folder })
        .from(mediaAssets)
        .where(isNull(mediaAssets.deletedAt))
        .orderBy(mediaAssets.folder);
      const folders = folderRows
        .map(r => r.folder)
        .filter((f): f is string => !!f)
        .sort();

      return { assets: enriched, total: count, page: input.page, pageSize: input.pageSize, folders };
    }),

  /**
   * Get full asset detail including all versions and access grants.
   */
  getAsset: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [asset] = await db
        .select()
        .from(mediaAssets)
        .where(and(eq(mediaAssets.id, input.id), isNull(mediaAssets.deletedAt)))
        .limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" });

      const versions = await db
        .select()
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, input.id))
        .orderBy(desc(mediaVersions.versionNumber));

      const grants = await db
        .select()
        .from(mediaAccessGrants)
        .where(eq(mediaAccessGrants.assetId, input.id))
        .orderBy(desc(mediaAccessGrants.createdAt));

      return { asset, versions, grants };
    }),

  /**
   * Update asset metadata (title, description, tags, access).
   */
  updateAsset: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().min(1).max(255).optional(),
      slug: z.string().min(1).max(128).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only").optional(),
      description: z.string().max(2000).nullable().optional(),
      tags: z.string().max(500).nullable().optional(),
      access: z.enum(["public", "private"]).optional(),
      mediaType: z.enum(MEDIA_TYPES).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Validate slug uniqueness if changing
      if (input.slug) {
        const [existing] = await db.select({ id: mediaAssets.id }).from(mediaAssets)
          .where(and(eq(mediaAssets.slug, input.slug), sql`${mediaAssets.id} != ${input.id}`))
          .limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "A media asset with this slug already exists" });
      }

      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.slug !== undefined) updates.slug = input.slug;
      if (input.description !== undefined) updates.description = input.description;
      if (input.tags !== undefined) updates.tags = input.tags;
      if (input.access !== undefined) updates.access = input.access;
      if (input.mediaType !== undefined) updates.mediaType = input.mediaType;

      if (Object.keys(updates).length === 0) return { updated: false };

      await db.update(mediaAssets).set(updates).where(eq(mediaAssets.id, input.id));
      return { updated: true };
    }),

  /**
   * Soft-delete an asset (moves to trash). Permanently purged after 30 days.
   */
  deleteAsset: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(mediaAssets)
        .set({ deletedAt: new Date() })
        .where(and(eq(mediaAssets.id, input.id), isNull(mediaAssets.deletedAt)));
      return { deleted: true };
    }),

  /**
   * Restore a soft-deleted asset from trash.
   */
  restoreAsset: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(mediaAssets)
        .set({ deletedAt: null })
        .where(eq(mediaAssets.id, input.id));
      return { restored: true };
    }),

  /**
   * List all soft-deleted assets (trash view).
   */
  listTrashed: protectedProcedure
    .query(async ({ ctx }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db
        .select()
        .from(mediaAssets)
        .where(sql`${mediaAssets.deletedAt} IS NOT NULL`)
        .orderBy(desc(mediaAssets.deletedAt));
      return rows;
    }),

  /**
   * Permanently purge assets deleted more than 30 days ago.
   * Deletes S3 files and all related DB rows.
   */
  purgeExpiredAssets: protectedProcedure
    .mutation(async ({ ctx }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const expired = await db
        .select({ id: mediaAssets.id })
        .from(mediaAssets)
        .where(and(
          sql`${mediaAssets.deletedAt} IS NOT NULL`,
          sql`${mediaAssets.deletedAt} < ${cutoff.toISOString()}`
        ));

      let purged = 0;
      for (const { id } of expired) {
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
      }
      return { purged };
    }),

  /**
   * Revert to a specific version: makes that version the "current" one by
   * inserting a new version row that is a copy of the target, preserving history.
   */
  revertToVersion: protectedProcedure
    .input(z.object({
      assetId: z.number().int().positive(),
      versionId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch the target version
      const [target] = await db
        .select()
        .from(mediaVersions)
        .where(and(
          eq(mediaVersions.id, input.versionId),
          eq(mediaVersions.assetId, input.assetId)
        ))
        .limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });

      // Get the current max version number
      const [maxRow] = await db
        .select({ max: sql<number>`MAX(${mediaVersions.versionNumber})` })
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, input.assetId));
      const nextVersion = (maxRow?.max ?? 0) + 1;

      // Insert a new version row copying the target's S3 key/url/size/mime
      const [asset] = await db
        .select({ slug: mediaAssets.slug, mediaType: mediaAssets.mediaType, mimeType: mediaAssets.mimeType })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, input.assetId))
        .limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

      await db.insert(mediaVersions).values({
        assetId: input.assetId,
        versionNumber: nextVersion,
        s3Key: target.s3Key,
        s3Url: target.s3Url,
        fileName: target.fileName,
        fileSize: target.fileSize,
        mimeType: target.mimeType,
        notes: `Reverted to v${target.versionNumber}`,
        uploadedByUserId: ctx.user.id,
        createdAt: new Date(),
        scormExtractionStatus: initialScormExtractionStatus({
          mediaType: asset.mediaType,
          mimeType: target.mimeType,
          fileName: target.fileName,
        }),
      });

      const [insertedVersion] = await db
        .select({ id: mediaVersions.id })
        .from(mediaVersions)
        .where(and(eq(mediaVersions.assetId, input.assetId), eq(mediaVersions.versionNumber, nextVersion)))
        .limit(1);
      if (insertedVersion) {
        await queueScormExtractionIfNeeded(insertedVersion.id, target.s3Url, asset.slug, {
          mediaType: asset.mediaType,
          mimeType: target.mimeType,
          fileName: target.fileName,
        });
      }

      await db
        .update(mediaAssets)
        .set({ updatedAt: new Date() })
        .where(eq(mediaAssets.id, input.assetId));

      return { reverted: true, newVersionNumber: nextVersion };
    }),

  /**
   * Re-upload a new version of an existing asset.
   * The slug and all existing links remain unchanged.
   */
  reuploadVersion: protectedProcedure
    .input(z.object({
      assetId: z.number().int().positive(),
      fileData: z.string().min(1),
      fileName: z.string().min(1).max(255),
      mimeType: z.string().min(1).max(128),
      fileSize: z.number().int().positive(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [asset] = await db
        .select({ slug: mediaAssets.slug })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.id, input.assetId), isNull(mediaAssets.deletedAt)))
        .limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" });

      // Determine next version number
      const [{ maxVer }] = await db
        .select({ maxVer: sql<number>`MAX(versionNumber)` })
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, input.assetId));
      const nextVersion = (maxVer ?? 0) + 1;

      // Upload to S3
      const buffer = Buffer.from(input.fileData, "base64");
      const s3Key = `media-repo/${asset.slug}/v${nextVersion}-${input.fileName}`;
      const { url: s3Url } = await storagePut(s3Key, buffer, input.mimeType);

      // Detect SCORM for ZIP files (inspect manifest)
      let detectedType = detectMediaType(input.mimeType);
      if (detectedType === "zip") {
        try {
          const admZip = new AdmZip(buffer);
          const hasManifest = admZip.getEntries().some(e => e.entryName.toLowerCase().endsWith("imsmanifest.xml"));
          if (hasManifest) detectedType = "scorm";
        } catch {}
      }

      await db.insert(mediaVersions).values({
        assetId: input.assetId,
        versionNumber: nextVersion,
        s3Key,
        s3Url,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        notes: input.notes ?? null,
        uploadedByUserId: ctx.user.id,
        scormExtractionStatus: initialScormExtractionStatus({
          mediaType: detectedType,
          mimeType: input.mimeType,
          fileName: input.fileName,
        }),
      });

      // Update asset mimeType to reflect new version
      await db
        .update(mediaAssets)
        .set({ mimeType: input.mimeType, mediaType: detectedType as any })
        .where(eq(mediaAssets.id, input.assetId));

      const [insertedVersion] = await db
        .select({ id: mediaVersions.id })
        .from(mediaVersions)
        .where(and(eq(mediaVersions.assetId, input.assetId), eq(mediaVersions.versionNumber, nextVersion)))
        .limit(1);
      if (insertedVersion) {
        await queueScormExtractionIfNeeded(insertedVersion.id, s3Url, asset.slug, {
          mediaType: detectedType,
          mimeType: input.mimeType,
          fileName: input.fileName,
        });
      }

      // Invalidate on-the-fly SCORM cache for this slug
      if (needsScormExtraction({ mediaType: detectedType, mimeType: input.mimeType, fileName: input.fileName })) {
        try {
          const os = await import("os");
          const pathMod = await import("path");
          const fsMod = await import("fs");
          const cacheRoot = pathMod.join(os.tmpdir(), "scorm-cache");
          if (fsMod.existsSync(cacheRoot)) {
            for (const entry of fsMod.readdirSync(cacheRoot)) {
              if (entry.startsWith(`${asset.slug}-`)) {
                fsMod.rmSync(pathMod.join(cacheRoot, entry), { recursive: true, force: true });
              }
            }
            console.log(`[SCORM] Cache invalidated for slug=${asset.slug}`);
          }
        } catch (e) {
          console.warn(`[SCORM] Failed to invalidate cache for slug=${asset.slug}:`, e);
        }
      }

      return { versionNumber: nextVersion, s3Url };
    }),

  /**
   * List all versions for an asset.
   */
  listVersions: protectedProcedure
    .input(z.object({ assetId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return db
        .select()
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, input.assetId))
        .orderBy(desc(mediaVersions.versionNumber));
    }),

  /**
   * Restore an older version as the "current" one by duplicating it as a new version.
   */
  restoreVersion: protectedProcedure
    .input(z.object({
      assetId: z.number().int().positive(),
      versionId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [version] = await db
        .select()
        .from(mediaVersions)
        .where(and(eq(mediaVersions.id, input.versionId), eq(mediaVersions.assetId, input.assetId)))
        .limit(1);
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });

      const [{ maxVer }] = await db
        .select({ maxVer: sql<number>`MAX(versionNumber)` })
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, input.assetId));
      const nextVersion = (maxVer ?? 0) + 1;

      const [asset] = await db
        .select({ slug: mediaAssets.slug, mediaType: mediaAssets.mediaType })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, input.assetId))
        .limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

      await db.insert(mediaVersions).values({
        assetId: input.assetId,
        versionNumber: nextVersion,
        s3Key: version.s3Key,
        s3Url: version.s3Url,
        fileName: version.fileName,
        fileSize: version.fileSize,
        mimeType: version.mimeType,
        notes: `Restored from v${version.versionNumber}`,
        uploadedByUserId: ctx.user.id,
        scormExtractionStatus: initialScormExtractionStatus({
          mediaType: asset.mediaType,
          mimeType: version.mimeType,
          fileName: version.fileName,
        }),
      });

      const [insertedVersion] = await db
        .select({ id: mediaVersions.id })
        .from(mediaVersions)
        .where(and(eq(mediaVersions.assetId, input.assetId), eq(mediaVersions.versionNumber, nextVersion)))
        .limit(1);
      if (insertedVersion) {
        await queueScormExtractionIfNeeded(insertedVersion.id, version.s3Url, asset.slug, {
          mediaType: asset.mediaType,
          mimeType: version.mimeType,
          fileName: version.fileName,
        });
      }

      return { restored: true, newVersionNumber: nextVersion };
    }),

  /**
   * Set access mode for an asset.
   */
  setAccess: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      access: z.enum(["public", "private"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db.update(mediaAssets).set({ access: input.access }).where(eq(mediaAssets.id, input.id));
      return { access: input.access };
    }),

  /**
   * Create an email-based access grant and send an invite email.
   */
  inviteByEmail: protectedProcedure
    .input(z.object({
      assetId: z.number().int().positive(),
      email: z.string().email(),
      expiresInDays: z.number().int().min(1).max(365).optional(),
      message: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [asset] = await db
        .select({ slug: mediaAssets.slug, title: mediaAssets.title })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.id, input.assetId), isNull(mediaAssets.deletedAt)))
        .limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" });

      const token = generateToken();
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86400_000)
        : null;

      await db.insert(mediaAccessGrants).values({
        assetId: input.assetId,
        email: input.email,
        token,
        expiresAt,
        createdByUserId: ctx.user.id,
      });

      // Build access URL (uses the app's canonical URL from env)
      const origin = process.env.VITE_APP_URL || "https://app.allaboutultrasound.com";
      const accessUrl = `${origin}/media/${asset.slug}?token=${token}`;

      await sendEmail({
        to: { name: input.email.split("@")[0], email: input.email },
        subject: `You've been granted access to "${asset.title}"`,
        htmlBody: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
            <h2 style="color:#189aa1;margin-bottom:8px;">Media Access Granted</h2>
            <p style="color:#374151;">You have been granted access to the following media file:</p>
            <p style="font-weight:bold;color:#111827;">${asset.title}</p>
            ${input.message ? `<p style="color:#374151;font-style:italic;">"${input.message}"</p>` : ""}
            <a href="${accessUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#189aa1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
              View / Embed Media
            </a>
            ${expiresAt ? `<p style="color:#6b7280;font-size:13px;margin-top:16px;">This link expires on ${expiresAt.toLocaleDateString()}.</p>` : ""}
            <p style="color:#9ca3af;font-size:12px;margin-top:24px;">All About Ultrasound™ — Clinical Intelligence Platform</p>
          </div>
        `,
      });

      return { token, accessUrl, expiresAt };
    }),

  /**
   * List all access grants for an asset.
   */
  listGrants: protectedProcedure
    .input(z.object({ assetId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return db
        .select()
        .from(mediaAccessGrants)
        .where(eq(mediaAccessGrants.assetId, input.assetId))
        .orderBy(desc(mediaAccessGrants.createdAt));
    }),

  /**
   * Revoke a specific access grant.
   */
  revokeGrant: protectedProcedure
    .input(z.object({ grantId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(mediaAccessGrants)
        .set({ revokedAt: new Date() })
        .where(eq(mediaAccessGrants.id, input.grantId));
      return { revoked: true };
    }),

  /**
   * Update folder for an asset.
   */
  setFolder: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      folder: z.string().max(255).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(mediaAssets).set({ folder: input.folder }).where(eq(mediaAssets.id, input.id));
      return { updated: true };
    }),

  /**
   * Set thumbnail URL for an asset.
   */
  setThumbnail: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      thumbnailUrl: z.string().url().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(mediaAssets).set({ thumbnailUrl: input.thumbnailUrl }).where(eq(mediaAssets.id, input.id));
      return { updated: true };
    }),

  /**
   * Get distinct folder list.
   */
  listFolders: protectedProcedure
    .query(async ({ ctx }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db
        .selectDistinct({ folder: mediaAssets.folder })
        .from(mediaAssets)
        .where(isNull(mediaAssets.deletedAt))
        .orderBy(mediaAssets.folder);
      return rows.map(r => r.folder).filter((f): f is string => !!f).sort();
    }),

  /**
   * Get analytics for an asset: total views, unique viewer IPs, daily breakdown (last 30 days).
   */
  getAnalytics: protectedProcedure
    .input(z.object({ assetId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);

      const [{ totalViews }] = await db
        .select({ totalViews: sql<number>`count(*)` })
        .from(mediaViewEvents)
        .where(eq(mediaViewEvents.assetId, input.assetId));

      const [{ uniqueViewers }] = await db
        .select({ uniqueViewers: sql<number>`count(distinct ipHash)` })
        .from(mediaViewEvents)
        .where(eq(mediaViewEvents.assetId, input.assetId));

      const [{ embedViews }] = await db
        .select({ embedViews: sql<number>`count(*)` })
        .from(mediaViewEvents)
        .where(and(eq(mediaViewEvents.assetId, input.assetId), eq(mediaViewEvents.viewType, "embed")));

      const [{ directViews }] = await db
        .select({ directViews: sql<number>`count(*)` })
        .from(mediaViewEvents)
        .where(and(eq(mediaViewEvents.assetId, input.assetId), eq(mediaViewEvents.viewType, "direct")));

      // Daily breakdown for last 30 days
      const daily = await db
        .select({
          date: sql<string>`DATE(createdAt)`,
          views: sql<number>`count(*)`,
        })
        .from(mediaViewEvents)
        .where(and(
          eq(mediaViewEvents.assetId, input.assetId),
          gte(mediaViewEvents.createdAt, thirtyDaysAgo)
        ))
        .groupBy(sql`DATE(createdAt)`)
        .orderBy(sql`DATE(createdAt)`);

      // Top referers
      const topReferers = await db
        .select({
          referer: mediaViewEvents.referer,
          views: sql<number>`count(*)`,
        })
        .from(mediaViewEvents)
        .where(and(
          eq(mediaViewEvents.assetId, input.assetId),
          sql`referer IS NOT NULL`
        ))
        .groupBy(mediaViewEvents.referer)
        .orderBy(desc(sql`count(*)`));

      return { totalViews, uniqueViewers, embedViews, directViews, daily, topReferers };
    }),

  /**
   * Public: validate a token for a given asset slug.
   * Returns the current version URL if valid.
   */
  validateToken: protectedProcedure
    .input(z.object({
      slug: z.string().min(1),
      token: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [asset] = await db
        .select()
        .from(mediaAssets)
        .where(and(eq(mediaAssets.slug, input.slug), isNull(mediaAssets.deletedAt)))
        .limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" });

      // Public assets: anyone can access
      if (asset.access === "public") {
        const [version] = await db
          .select()
          .from(mediaVersions)
          .where(eq(mediaVersions.assetId, asset.id))
          .orderBy(desc(mediaVersions.versionNumber))
          .limit(1);
        return { allowed: true, asset, version: version ?? null };
      }

      // Private: check token
      if (!input.token) return { allowed: false, asset, version: null };

      const [grant] = await db
        .select()
        .from(mediaAccessGrants)
        .where(and(
          eq(mediaAccessGrants.assetId, asset.id),
          eq(mediaAccessGrants.token, input.token),
          isNull(mediaAccessGrants.revokedAt)
        ))
        .limit(1);

      if (!grant) return { allowed: false, asset, version: null };
      if (grant.expiresAt && grant.expiresAt < new Date()) return { allowed: false, asset, version: null };

      // Mark first use
      if (!grant.firstUsedAt) {
        await db
          .update(mediaAccessGrants)
          .set({ firstUsedAt: new Date() })
          .where(eq(mediaAccessGrants.id, grant.id));
      }

      const [version] = await db
        .select()
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, asset.id))
        .orderBy(desc(mediaVersions.versionNumber))
        .limit(1);

      return { allowed: true, asset, version: version ?? null };
    }),

  /**
   * Resolve a cookieless embed URL for SCORM/HTML media (adds ?access= for private assets).
   * Allowed for platform admins, public assets, or enrolled learners when courseId is provided.
   */
  getMediaEmbedUrl: protectedProcedure
    .input(z.object({
      slug: z.string().min(1),
      courseId: z.number().int().positive().optional(),
      path: z.enum(["embed", "download", "scorm"]).default("embed"),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [asset] = await db
        .select()
        .from(mediaAssets)
        .where(and(eq(mediaAssets.slug, input.slug), isNull(mediaAssets.deletedAt)))
        .limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Media asset not found" });

      const basePath = `/api/media/${asset.slug}/${input.path}`;

      if (asset.access === "public") {
        return { url: basePath, isPublic: true as const };
      }

      let allowed = false;
      try {
        await assertPlatformAdmin(ctx);
        allowed = true;
      } catch {
        if (input.courseId) {
          const [enrollment] = await db
            .select({ id: lmsEnrollments.id })
            .from(lmsEnrollments)
            .where(and(
              eq(lmsEnrollments.userId, ctx.user.id),
              eq(lmsEnrollments.courseId, input.courseId)
            ))
            .limit(1);
          allowed = !!enrollment;
        }
      }

      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this media asset" });
      }

      const access = signMediaViewerToken(asset.slug, ctx.user.id, input.courseId ?? null);
      const authQuery = buildMediaAuthQuery({ access });
      return { url: `${basePath}${authQuery}`, isPublic: false as const };
    }),

  /**
   * Returns the direct S3/CDN URL for a SCORM ZIP so the browser can fetch and
   * extract it client-side (iSpring-style).  Access is gated the same way as
   * getMediaEmbedUrl: enrolled learners or platform admins only.
   */
  getScormZipUrl: protectedProcedure
    .input(z.object({
      slug: z.string().min(1),
      courseId: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [asset] = await db
        .select()
        .from(mediaAssets)
        .where(and(eq(mediaAssets.slug, input.slug), isNull(mediaAssets.deletedAt)))
        .limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Media asset not found" });
      // Access check
      let allowed = false;
      try {
        await assertPlatformAdmin(ctx);
        allowed = true;
      } catch {
        if (asset.access === "public") {
          allowed = true;
        } else if (input.courseId) {
          const [enrollment] = await db
            .select({ id: lmsEnrollments.id })
            .from(lmsEnrollments)
            .where(and(
              eq(lmsEnrollments.userId, ctx.user.id),
              eq(lmsEnrollments.courseId, input.courseId)
            ))
            .limit(1);
          allowed = !!enrollment;
        }
      }
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "No access to this media asset" });
      const versions = await db
        .select({
          id: mediaVersions.id,
          s3Url: mediaVersions.s3Url,
          fileName: mediaVersions.fileName,
          mimeType: mediaVersions.mimeType,
          s3Key: mediaVersions.s3Key,
          versionNumber: mediaVersions.versionNumber,
          scormExtractedPrefix: mediaVersions.scormExtractedPrefix,
          scormLaunchFile: mediaVersions.scormLaunchFile,
          scormExtractionStatus: mediaVersions.scormExtractionStatus,
          scormExtractionError: mediaVersions.scormExtractionError,
        })
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, asset.id))
        .orderBy(desc(mediaVersions.versionNumber));
      const current = versions[0];
      if (!current?.s3Url) throw new TRPCError({ code: "NOT_FOUND", message: "No file found for this asset" });

      const access = signMediaViewerToken(asset.slug, ctx.user.id, input.courseId ?? null);
      const authQuery = buildMediaAuthQuery({ access });
      const strategy = pickScormPlaybackMode(current, versions);

      if (strategy.mode === "server") {
        return {
          mode: "server" as const,
          embedUrl: `/api/media/${asset.slug}/scorm${authQuery}`,
          title: asset.title,
        };
      }

      if (!strategy.zipS3Url) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No playable SCORM ZIP found for this asset" });
      }

      return {
        mode: "clientZip" as const,
        zipUrl: `/api/media/${asset.slug}/scorm-zip${authQuery}`,
        title: asset.title,
      };
    }),

  // ─── Folder CRUD ──────────────────────────────────────────────────────────────

  /**
   * List all folders with asset counts.
   */
  listFoldersFull: protectedProcedure.query(async ({ ctx }) => {
    await assertPlatformAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const folders = await db
      .select()
      .from(mediaFolders)
      .orderBy(mediaFolders.sortOrder, mediaFolders.name);
    const counts = await db
      .select({ folder: mediaAssets.folder, count: sql<number>`count(*)` })
      .from(mediaAssets)
      .where(isNull(mediaAssets.deletedAt))
      .groupBy(mediaAssets.folder);
    const countMap = new Map(counts.map(c => [c.folder ?? "", Number(c.count)]));
    return folders.map(f => ({ ...f, assetCount: countMap.get(f.slug) ?? 0 }));
  }),

  /**
   * Create a new folder.
   */
  createFolder: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      parentId: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      const baseSlug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let slug = baseSlug;
      let attempt = 0;
      while (true) {
        const [existing] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(eq(mediaFolders.slug, slug)).limit(1);
        if (!existing) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }
      const [result] = await db.insert(mediaFolders).values({
        name: input.name,
        slug,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      return { id: (result as any).insertId, slug };
    }),

  /**
   * Rename / update a folder.
   */
  renameFolder: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().min(1).max(255),
      description: z.string().max(1000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(mediaFolders)
        .set({ name: input.name, description: input.description ?? null, updatedAt: Date.now() })
        .where(eq(mediaFolders.id, input.id));
      return { ok: true };
    }),

  /**
   * Delete a folder. Assets in the folder are moved to uncategorized (null).
   */
  deleteFolder: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [folder] = await db.select().from(mediaFolders).where(eq(mediaFolders.id, input.id)).limit(1);
      if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      await db.update(mediaAssets).set({ folder: null }).where(eq(mediaAssets.folder, folder.slug));
      const children = await db.select().from(mediaFolders).where(eq(mediaFolders.parentId, input.id));
      for (const child of children) {
        await db.update(mediaAssets).set({ folder: null }).where(eq(mediaAssets.folder, child.slug));
        await db.delete(mediaFolders).where(eq(mediaFolders.id, child.id));
      }
      await db.delete(mediaFolders).where(eq(mediaFolders.id, input.id));
      return { ok: true };
    }),

  /**
   * Move an asset to a folder by slug (or null for uncategorized).
   */
  moveAssetToFolder: protectedProcedure
    .input(z.object({
      assetId: z.number().int(),
      folderSlug: z.string().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(mediaAssets)
        .set({ folder: input.folderSlug })
        .where(eq(mediaAssets.id, input.assetId));
      return { ok: true };
    }),

  /**
   * Bulk move assets to a folder.
   */
  bulkMoveToFolder: protectedProcedure
    .input(z.object({
      assetIds: z.array(z.number().int()),
      folderSlug: z.string().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      for (const id of input.assetIds) {
        await db.update(mediaAssets).set({ folder: input.folderSlug }).where(eq(mediaAssets.id, id));
      }
      return { ok: true };
    }),

  /**
   * Re-trigger SCORM extraction for an existing asset.
   * Resets status to 'pending' so the heartbeat cron picks it up within 60 seconds.
   * Works for both failed extractions and re-uploads.
   */
  reExtractScorm: protectedProcedure
    .input(z.object({ assetId: z.number().int(), versionId: z.number().int().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // If a specific versionId is provided, use that version; otherwise use the latest
      let version;
      if (input.versionId) {
        const [v] = await db.select().from(mediaVersions)
          .where(and(eq(mediaVersions.id, input.versionId), eq(mediaVersions.assetId, input.assetId)))
          .limit(1);
        version = v;
      } else {
        const [v] = await db.select().from(mediaVersions)
          .where(eq(mediaVersions.assetId, input.assetId))
          .orderBy(desc(mediaVersions.versionNumber))
          .limit(1);
        version = v;
      }
      if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "No version found for asset" });
      const [asset] = await db.select().from(mediaAssets)
        .where(eq(mediaAssets.id, input.assetId)).limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      if (!needsScormExtraction({ mediaType: asset.mediaType, mimeType: version.mimeType, fileName: version.fileName, s3Url: version.s3Url })) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This asset is not a SCORM/LMS/ZIP package" });
      }
      // Mark as processing immediately and run extraction in background (priority — bypasses queue)
      await db.update(mediaVersions)
        .set({
          scormExtractionStatus: "processing" as any,
          scormExtractionError: null,
          scormExtractionStartedAt: new Date(),
          scormExtractedPrefix: null,
          scormLaunchFile: null,
        })
        .where(eq(mediaVersions.id, version.id));
      console.log(`[ReExtractScorm] Priority extraction started for asset ${input.assetId} (version ${version.id})`);
      // Fire-and-forget background extraction (bypasses the heartbeat queue)
      extractAndUploadScormVersion(version.id, version.s3Url!, asset.slug).catch((err: any) => {
        console.error(`[ReExtractScorm] Background extraction failed for version ${version.id}:`, err.message);
      });
      return { ok: true, versionId: version.id, status: "processing" };
    }),

  /**
   * Re-extract ALL SCORM/ZIP assets — resets every version to pending so the
   * heartbeat cron re-processes them. Use when bulk storage migration or R2
   * key changes have broken existing extracted prefixes.
   */
  reExtractAllScorm: protectedProcedure
    .mutation(async ({ ctx }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Find all SCORM/ZIP/LMS/HTML asset IDs (all types that may need SCORM extraction)
      const scormAssets = await db
        .select({ id: mediaAssets.id })
        .from(mediaAssets)
        .where(and(inArray(mediaAssets.mediaType, ["scorm", "zip", "lms", "html"] as any), isNull(mediaAssets.deletedAt)));

      if (scormAssets.length === 0) return { ok: true, count: 0 };

      const assetIds = scormAssets.map(a => a.id);

      // For each asset, reset the latest version to pending
      let count = 0;
      for (const { id: assetId } of scormAssets) {
        const [version] = await db
          .select({ id: mediaVersions.id })
          .from(mediaVersions)
          .where(eq(mediaVersions.assetId, assetId))
          .orderBy(desc(mediaVersions.versionNumber))
          .limit(1);
        if (!version) continue;
        await db.update(mediaVersions)
          .set({
            scormExtractionStatus: "pending" as any,
            scormExtractionError: null,
            scormExtractionStartedAt: null,
            scormExtractedPrefix: null,
            scormLaunchFile: null,
          })
          .where(eq(mediaVersions.id, version.id));
        count++;
      }

      console.log(`[ReExtractAllScorm] Queued ${count} SCORM assets for heartbeat extraction`);
      return { ok: true, count };
    }),

  /**
   * Get SCORM extraction status for an asset's current version.
   * Used by admin UI to show extraction progress.
   */
  getScormStatus: protectedProcedure
    .input(z.object({ assetId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [version] = await db.select({
        id: mediaVersions.id,
        scormExtractionStatus: (mediaVersions as any).scormExtractionStatus,
        scormExtractionError: (mediaVersions as any).scormExtractionError,
        scormExtractionStartedAt: (mediaVersions as any).scormExtractionStartedAt,
        scormExtractedPrefix: mediaVersions.scormExtractedPrefix,
      })
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, input.assetId))
        .orderBy(desc(mediaVersions.versionNumber))
        .limit(1);
      if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "No version found" });
      return version;
    }),

  /** SCORM health dashboard rows (admin). */
  listScormHealth: protectedProcedure.query(async ({ ctx }) => {
    await assertPlatformAdmin(ctx);
    const { listScormHealthRows } = await import("../lib/scormHealthAlerts");
    return listScormHealthRows();
  }),

  /** Run health scan + email pass immediately (admin). */
  runScormHealthScanNow: protectedProcedure.mutation(async ({ ctx }) => {
    await assertPlatformAdmin(ctx);
    const { runScormHealthAlertPass } = await import("../lib/scormHealthAlerts");
    return runScormHealthAlertPass();
  }),

  /** Snapshot metadata for SCORM health settings (last alert, alerted IDs). */
  getScormHealthMeta: protectedProcedure.query(async ({ ctx }) => {
    await assertPlatformAdmin(ctx);
    const { getScormHealthMeta } = await import("../lib/scormHealthAlerts");
    return getScormHealthMeta();
  }),

  /**
   * Re-extract SCORM packages flagged by health alerts only (not all SCORM assets).
   * - unhealthy: every package currently marked unhealthy
   * - alerted: packages from the last alert email that are still unhealthy
   */
  reExtractUnhealthyScorm: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["unhealthy", "alerted"]).default("alerted"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const { queueScormReExtractionForAssets, resolveScormReExtractAssetIds } = await import(
        "../lib/scormHealthAlerts"
      );
      const assetIds = await resolveScormReExtractAssetIds(input.scope);
      if (assetIds.length === 0) {
        return { ok: true, queued: 0, skipped: 0, scope: input.scope };
      }
      const result = await queueScormReExtractionForAssets(assetIds);
      return { ok: true, scope: input.scope, ...result };
    }),

});