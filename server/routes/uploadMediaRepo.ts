/**
 * POST /api/upload-media-repo
 *
 * Multipart/form-data upload for the media repository.
 * Accepts any file type up to 500 MB.
 * Platform admin only.
 *
 * Form fields:
 *   file         — the binary file
 *   title        — display title (required)
 *   description  — optional description
 *   tags         — optional comma-separated tags
 *   access       — "public" | "private" (default: "private")
 *   mediaType    — optional override for media type category
 *   notes        — optional version notes
 *   assetId      — if provided, creates a new version of an existing asset
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { storagePut } from "../storage";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import {
  mediaAssets,
  mediaVersions,
} from "../../drizzle/schema";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base}-${randomBytes(4).toString("hex")}`;
}

function detectMediaType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "text/html") return "html";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("word") ||
    mimeType.includes("presentation") ||
    mimeType.includes("spreadsheet")
  )
    return "document";
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed"
  )
    return "zip";
  return "other";
}

router.post(
  "/api/upload-media-repo",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Auth: platform admin only
      let user: { id: number; role: string } | null = null;
      try {
        user = await sdk.authenticateRequest(req) as any;
      } catch {}
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (user.role !== "admin") {
        res.status(403).json({ error: "Platform admin access required" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database unavailable" });
        return;
      }

      const { originalname, mimetype, buffer, size } = req.file;
      const title = (req.body.title as string)?.trim() || originalname;
      const description = (req.body.description as string) || null;
      const tags = (req.body.tags as string) || null;
      const access = (req.body.access as string) === "public" ? "public" : "private";
      const notes = (req.body.notes as string) || null;
      const existingAssetId = req.body.assetId ? parseInt(req.body.assetId, 10) : null;
      const mediaType = (req.body.mediaType as string) || detectMediaType(mimetype);

      if (existingAssetId) {
        // ── Re-upload: add a new version to an existing asset ──────────────────
        const [asset] = await db
          .select({ slug: mediaAssets.slug })
          .from(mediaAssets)
          .where(and(eq(mediaAssets.id, existingAssetId), isNull(mediaAssets.deletedAt)))
          .limit(1);
        if (!asset) {
          res.status(404).json({ error: "Asset not found" });
          return;
        }

        const [{ maxVer }] = await db
          .select({ maxVer: sql<number>`MAX(versionNumber)` })
          .from(mediaVersions)
          .where(eq(mediaVersions.assetId, existingAssetId));
        const nextVersion = (maxVer ?? 0) + 1;

        const s3Key = `media-repo/${asset.slug}/v${nextVersion}-${originalname}`;
        const { url: s3Url } = await storagePut(s3Key, buffer, mimetype);

        await db.insert(mediaVersions).values({
          assetId: existingAssetId,
          versionNumber: nextVersion,
          s3Key,
          s3Url,
          fileName: originalname,
          fileSize: size,
          mimeType: mimetype,
          notes,
          uploadedByUserId: user.id,
        });

        // Update asset mimeType
        await db
          .update(mediaAssets)
          .set({ mimeType: mimetype, mediaType: mediaType as any })
          .where(eq(mediaAssets.id, existingAssetId));

        res.json({ assetId: existingAssetId, versionNumber: nextVersion, s3Url });
      } else {
        // ── New asset upload ────────────────────────────────────────────────────
        const slug = generateSlug(title);
        const s3Key = `media-repo/${slug}/v1-${originalname}`;
        const { url: s3Url } = await storagePut(s3Key, buffer, mimetype);

        const [assetResult] = await db.insert(mediaAssets).values({
          slug,
          title,
          description,
          mediaType: mediaType as any,
          mimeType: mimetype,
          access: access as any,
          tags,
          createdByUserId: user.id,
        });
        const assetId = (assetResult as any).insertId as number;

        await db.insert(mediaVersions).values({
          assetId,
          versionNumber: 1,
          s3Key,
          s3Url,
          fileName: originalname,
          fileSize: size,
          mimeType: mimetype,
          notes,
          uploadedByUserId: user.id,
        });

        res.json({ assetId, slug, versionNumber: 1, s3Url });
      }
    } catch (err: any) {
      console.error("[upload-media-repo]", err);
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  }
);

export function registerUploadMediaRepoRoute(app: import("express").Application) {
  app.use(router);
}
