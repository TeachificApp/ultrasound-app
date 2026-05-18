/**
 * Media Repository Upload Routes
 *
 * Two endpoints:
 *
 * 1. POST /api/upload-media-repo/init
 *    Initialises an upload session. Returns { uploadId, assetId? }.
 *    For new assets: creates the DB row and returns assetId.
 *    For re-uploads: validates the existing assetId.
 *
 * 2. POST /api/upload-media-repo/chunk
 *    Uploads a single chunk (multipart, field "chunk").
 *    Fields: uploadId, chunkIndex, totalChunks, fileName, mimeType, fileSize,
 *            title, description, tags, access, mediaType, notes, assetId (optional), folder
 *    On the final chunk (chunkIndex === totalChunks - 1) the server assembles
 *    the buffer, pushes to S3, and writes the mediaVersions row.
 *
 * Platform admin only. No file-size limit — chunks are 10 MB each by default.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { storagePut } from "../storage";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { mediaAssets, mediaVersions } from "../../drizzle/schema";
import { detectBrandFromHostname } from "../../shared/brands";

function getBrandFromRequest(req: Request): "aaus" | "iheartecho" {
  const origin = (req.headers.origin || req.headers.referer || "") as string;
  try {
    const hostname = new URL(origin).hostname;
    return detectBrandFromHostname(hostname);
  } catch {
    return "aaus";
  }
}

const router = Router();

// In-memory chunk store: uploadId → Map<chunkIndex, Buffer>
const chunkStore = new Map<string, Map<number, Buffer>>();

// Multer with no file size limit — chunks are small by design
const upload = multer({
  storage: multer.memoryStorage(),
  // No limits — each chunk is ~10 MB; the frontend enforces chunk size
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
  if (
    mimeType.includes("scorm") ||
    mimeType.includes("lms") ||
    mimeType.includes("aicc")
  )
    return "scorm";
  return "other";
}

async function authenticateAdmin(req: Request): Promise<{ id: number; role: string } | null> {
  try {
    const user = await sdk.authenticateRequest(req) as any;
    if (user?.role === "admin") return user;
  } catch {}
  return null;
}

// ── /api/upload-media-repo/init ──────────────────────────────────────────────
router.post("/api/upload-media-repo/init", async (req: Request, res: Response) => {
  const user = await authenticateAdmin(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const uploadId = randomBytes(16).toString("hex");
  chunkStore.set(uploadId, new Map());

  // If this is a re-upload, validate the existing asset exists
  const existingAssetId = req.body.assetId ? parseInt(req.body.assetId, 10) : null;
  if (existingAssetId) {
    const db = await getDb();
    if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }
    const [asset] = await db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, existingAssetId), isNull(mediaAssets.deletedAt)))
      .limit(1);
    if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  }

  res.json({ uploadId });
});

// ── /api/upload-media-repo/chunk ─────────────────────────────────────────────
router.post(
  "/api/upload-media-repo/chunk",
  upload.single("chunk"),
  async (req: Request, res: Response) => {
    const user = await authenticateAdmin(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    if (!req.file) { res.status(400).json({ error: "No chunk provided" }); return; }

    const uploadId = req.body.uploadId as string;
    const chunkIndex = parseInt(req.body.chunkIndex, 10);
    const totalChunks = parseInt(req.body.totalChunks, 10);

    if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
      res.status(400).json({ error: "Missing uploadId, chunkIndex, or totalChunks" });
      return;
    }

    if (!chunkStore.has(uploadId)) {
      res.status(400).json({ error: "Unknown uploadId — call /init first" });
      return;
    }

    // Store this chunk
    chunkStore.get(uploadId)!.set(chunkIndex, req.file.buffer);

    const receivedChunks = chunkStore.get(uploadId)!.size;

    // Not the final chunk yet — acknowledge and wait
    if (receivedChunks < totalChunks) {
      res.json({ received: chunkIndex, total: totalChunks, done: false });
      return;
    }

    // ── All chunks received — assemble and upload to S3 ──────────────────────
    try {
      const chunks = chunkStore.get(uploadId)!;
      const buffers: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks.get(i);
        if (!chunk) {
          res.status(400).json({ error: `Missing chunk ${i}` });
          return;
        }
        buffers.push(chunk);
      }
      const fullBuffer = Buffer.concat(buffers);
      chunkStore.delete(uploadId); // Free memory

      const db = await getDb();
      if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

      const originalname = req.body.fileName as string;
      const mimetype = req.body.mimeType as string;
      const fileSize = parseInt(req.body.fileSize, 10) || fullBuffer.length;
      const title = (req.body.title as string)?.trim() || originalname;
      const description = (req.body.description as string) || null;
      const tags = (req.body.tags as string) || null;
      const access = (req.body.access as string) === "public" ? "public" : "private";
      const notes = (req.body.notes as string) || null;
      const existingAssetId = req.body.assetId ? parseInt(req.body.assetId, 10) : null;
      const mediaType = (req.body.mediaType as string) || detectMediaType(mimetype);
      const folderSlug = (req.body.folder as string) || null;

      if (existingAssetId) {
        // Re-upload: new version of existing asset
        const [asset] = await db
          .select({ slug: mediaAssets.slug })
          .from(mediaAssets)
          .where(and(eq(mediaAssets.id, existingAssetId), isNull(mediaAssets.deletedAt)))
          .limit(1);
        if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }

        const [{ maxVer }] = await db
          .select({ maxVer: sql<number>`MAX(versionNumber)` })
          .from(mediaVersions)
          .where(eq(mediaVersions.assetId, existingAssetId));
        const nextVersion = (maxVer ?? 0) + 1;

        const s3Key = `media-repo/${asset.slug}/v${nextVersion}-${originalname}`;
        const { url: s3Url } = await storagePut(s3Key, fullBuffer, mimetype);

        await db.insert(mediaVersions).values({
          assetId: existingAssetId,
          versionNumber: nextVersion,
          s3Key,
          s3Url,
          fileName: originalname,
          fileSize,
          mimeType: mimetype,
          notes,
          uploadedByUserId: user.id,
        });

        await db
          .update(mediaAssets)
          .set({ mimeType: mimetype, mediaType: mediaType as any, updatedAt: new Date() })
          .where(eq(mediaAssets.id, existingAssetId));

        res.json({ done: true, assetId: existingAssetId, versionNumber: nextVersion, s3Url });
      } else {
        // New asset
        const slug = generateSlug(title);
        const s3Key = `media-repo/${slug}/v1-${originalname}`;
        const { url: s3Url } = await storagePut(s3Key, fullBuffer, mimetype);

        const [assetResult] = await db.insert(mediaAssets).values({
          slug,
          title,
          description,
          mediaType: mediaType as any,
          mimeType: mimetype,
          access: access as any,
          tags,
          folder: folderSlug,
          brand: getBrandFromRequest(req),
          createdByUserId: user.id,
        });
        const assetId = (assetResult as any).insertId as number;

        await db.insert(mediaVersions).values({
          assetId,
          versionNumber: 1,
          s3Key,
          s3Url,
          fileName: originalname,
          fileSize,
          mimeType: mimetype,
          notes,
          uploadedByUserId: user.id,
        });

        res.json({ done: true, assetId, slug, versionNumber: 1, s3Url });
      }
    } catch (err: any) {
      chunkStore.delete(req.body.uploadId);
      console.error("[upload-media-repo/chunk]", err);
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  }
);

// ── Legacy single-shot endpoint (kept for backward compat) ───────────────────
const uploadLegacy = multer({ storage: multer.memoryStorage() });

router.post(
  "/api/upload-media-repo",
  uploadLegacy.single("file"),
  async (req: Request, res: Response) => {
    const user = await authenticateAdmin(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }

    const db = await getDb();
    if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

    const { originalname, mimetype, buffer, size } = req.file;
    const title = (req.body.title as string)?.trim() || originalname;
    const description = (req.body.description as string) || null;
    const tags = (req.body.tags as string) || null;
    const access = (req.body.access as string) === "public" ? "public" : "private";
    const notes = (req.body.notes as string) || null;
    const existingAssetId = req.body.assetId ? parseInt(req.body.assetId, 10) : null;
    const mediaType = (req.body.mediaType as string) || detectMediaType(mimetype);
    const folderSlug = (req.body.folder as string) || null;

    try {
      if (existingAssetId) {
        const [asset] = await db
          .select({ slug: mediaAssets.slug })
          .from(mediaAssets)
          .where(and(eq(mediaAssets.id, existingAssetId), isNull(mediaAssets.deletedAt)))
          .limit(1);
        if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }

        const [{ maxVer }] = await db
          .select({ maxVer: sql<number>`MAX(versionNumber)` })
          .from(mediaVersions)
          .where(eq(mediaVersions.assetId, existingAssetId));
        const nextVersion = (maxVer ?? 0) + 1;

        const s3Key = `media-repo/${asset.slug}/v${nextVersion}-${originalname}`;
        const { url: s3Url } = await storagePut(s3Key, buffer, mimetype);

        await db.insert(mediaVersions).values({
          assetId: existingAssetId, versionNumber: nextVersion, s3Key, s3Url,
          fileName: originalname, fileSize: size, mimeType: mimetype, notes,
          uploadedByUserId: user.id,
        });

        await db.update(mediaAssets)
          .set({ mimeType: mimetype, mediaType: mediaType as any })
          .where(eq(mediaAssets.id, existingAssetId));

        res.json({ assetId: existingAssetId, versionNumber: nextVersion, s3Url });
      } else {
        const slug = generateSlug(title);
        const s3Key = `media-repo/${slug}/v1-${originalname}`;
        const { url: s3Url } = await storagePut(s3Key, buffer, mimetype);

        const [assetResult] = await db.insert(mediaAssets).values({
          slug, title, description, mediaType: mediaType as any, mimeType: mimetype,
          access: access as any, tags, folder: folderSlug, brand: getBrandFromRequest(req), createdByUserId: user.id,
        });
        const assetId = (assetResult as any).insertId as number;

        await db.insert(mediaVersions).values({
          assetId, versionNumber: 1, s3Key, s3Url,
          fileName: originalname, fileSize: size, mimeType: mimetype, notes,
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
