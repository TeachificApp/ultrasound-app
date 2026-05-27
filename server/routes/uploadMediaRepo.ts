/**
 * Media Repository Upload Routes
 *
 * Two endpoints:
 *
 * 1. POST /api/upload-media-repo/init
 *    Initialises an R2 multipart upload session. Returns { uploadId }.
 *    Session state is stored in the DB so it survives server/sandbox restarts.
 *
 * 2. POST /api/upload-media-repo/chunk
 *    Uploads a single chunk (multipart, field "chunk").
 *    Each chunk is forwarded directly to R2 as a multipart upload part.
 *    On the final chunk the server completes the R2 upload and writes
 *    the mediaAssets/mediaVersions rows.
 *
 * Why DB-backed: /tmp is cleared on sandbox reset; in-memory stores are cleared
 * on any server restart. Only the database survives both.
 *
 * Platform admin only. No file-size limit.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import path from "path";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { mediaAssets, mediaVersions, mediaUploadSessions } from "../../drizzle/schema";
import { detectBrandFromHostname } from "../../shared/brands";

// ── R2 Client ─────────────────────────────────────────────────────────────────

function getR2Client(): S3Client {
  const accountId = process.env.CF_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getR2Bucket(): string {
  return process.env.CF_R2_BUCKET_NAME || "ultrasound-assist";
}

function getR2PublicUrl(): string {
  const url = process.env.CF_R2_PUBLIC_URL;
  if (!url) throw new Error("CF_R2_PUBLIC_URL not configured");
  return url.replace(/\/+$/, "");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBrandFromRequest(req: Request): "aaus" | "iheartecho" {
  const origin = (req.headers.origin || req.headers.referer || "") as string;
  try {
    const hostname = new URL(origin).hostname;
    return detectBrandFromHostname(hostname);
  } catch {
    return "aaus";
  }
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base}-${randomBytes(4).toString("hex")}`;
}

function detectMediaType(mimeType: string, fileName?: string): string {
  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".zip") return "zip";
    if (ext === ".html" || ext === ".htm") return "html";
    if (ext === ".pdf") return "document";
    if (ext === ".mp4" || ext === ".webm" || ext === ".mov" || ext === ".avi") return "video";
    if (ext === ".mp3" || ext === ".wav" || ext === ".ogg" || ext === ".m4a") return "audio";
    if (ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".gif" || ext === ".webp") return "image";
  }
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "text/html") return "html";
  if (mimeType === "application/pdf" || mimeType.includes("word") || mimeType.includes("presentation") || mimeType.includes("spreadsheet")) return "document";
  if (mimeType === "application/zip" || mimeType === "application/x-zip-compressed") return "zip";
  if (mimeType.includes("scorm") || mimeType.includes("lms") || mimeType.includes("aicc")) return "scorm";
  return "other";
}

function resolveMimeType(mimeType: string, fileName: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const ext = path.extname(fileName).toLowerCase();
  const extMap: Record<string, string> = {
    ".zip": "application/zip",
    ".html": "text/html",
    ".htm": "text/html",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return extMap[ext] || mimeType || "application/octet-stream";
}

async function authenticateAdmin(req: Request): Promise<{ id: number; role: string } | null> {
  try {
    const user = await sdk.authenticateRequest(req) as any;
    if (user?.role === "admin") return user;
  } catch {}
  return null;
}

const router = Router();

// Multer — each chunk is held in memory briefly while we stream it to R2
const upload = multer({ storage: multer.memoryStorage() });

// ── /api/upload-media-repo/init ──────────────────────────────────────────────
router.post("/api/upload-media-repo/init", async (req: Request, res: Response) => {
  const user = await authenticateAdmin(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const db = await getDb();
  if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

  const existingAssetId = req.body.assetId ? parseInt(req.body.assetId, 10) : null;
  const fileName = (req.body.fileName as string) || "upload";
  const rawMimeType = (req.body.mimeType as string) || "application/octet-stream";
  const mimeType = resolveMimeType(rawMimeType, fileName);
  const totalChunks = parseInt(req.body.totalChunks, 10) || 1;
  const title = (req.body.title as string)?.trim() || fileName;
  const description = (req.body.description as string) || null;
  const tags = (req.body.tags as string) || null;
  const access = (req.body.access as string) === "public" ? "public" : "private";
  const notes = (req.body.notes as string) || null;
  const mediaType = (req.body.mediaType as string) || detectMediaType(mimeType, fileName);
  const folderSlug = (req.body.folder as string) || null;
  const brand = getBrandFromRequest(req);
  const fileSize = parseInt(req.body.fileSize, 10) || 0;

  if (existingAssetId) {
    const [asset] = await db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, existingAssetId), isNull(mediaAssets.deletedAt)))
      .limit(1);
    if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  }

  // Determine the S3 key upfront (needed for R2 multipart init)
  let s3Key: string;
  if (existingAssetId) {
    const [asset] = await db
      .select({ slug: mediaAssets.slug })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, existingAssetId))
      .limit(1);
    const [{ maxVer }] = await db
      .select({ maxVer: sql<number>`MAX(versionNumber)` })
      .from(mediaVersions)
      .where(eq(mediaVersions.assetId, existingAssetId));
    const nextVersion = (maxVer ?? 0) + 1;
    s3Key = `media-repo/${asset!.slug}/v${nextVersion}-${fileName}`;
  } else {
    const slug = generateSlug(title);
    s3Key = `media-repo/${slug}/v1-${fileName}`;
  }

  // Initiate R2 multipart upload
  let r2UploadId: string;
  try {
    const r2 = getR2Client();
    const result = await r2.send(new CreateMultipartUploadCommand({
      Bucket: getR2Bucket(),
      Key: s3Key,
      ContentType: mimeType,
    }));
    r2UploadId = result.UploadId!;
  } catch (err: any) {
    console.error("[upload-media-repo/init] R2 init failed:", err);
    res.status(500).json({ error: "Failed to initialise upload: " + err.message });
    return;
  }

  const uploadId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await db.insert(mediaUploadSessions).values({
    uploadId,
    r2UploadId,
    s3Key,
    mimeType,
    totalChunks,
    completedParts: "[]",
    fileName,
    fileSize,
    title,
    description,
    tags,
    access,
    notes,
    mediaType,
    folder: folderSlug,
    brand,
    existingAssetId,
    createdByUserId: user.id,
    expiresAt,
  });

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

    if (!uploadId || isNaN(chunkIndex)) {
      res.status(400).json({ error: "Missing uploadId or chunkIndex" });
      return;
    }

    const db = await getDb();
    if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

    // Load session from DB
    const [session] = await db
      .select()
      .from(mediaUploadSessions)
      .where(eq(mediaUploadSessions.uploadId, uploadId))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Upload session not found — please restart the upload" });
      return;
    }

    // Upload this chunk as an R2 multipart part (part numbers are 1-indexed)
    const partNumber = chunkIndex + 1;
    let etag: string;
    try {
      const r2 = getR2Client();
      const result = await r2.send(new UploadPartCommand({
        Bucket: getR2Bucket(),
        Key: session.s3Key,
        UploadId: session.r2UploadId,
        PartNumber: partNumber,
        Body: req.file.buffer,
      }));
      etag = result.ETag!;
    } catch (err: any) {
      console.error(`[upload-media-repo/chunk] R2 part upload failed (part ${partNumber}):`, err);
      res.status(500).json({ error: "Failed to upload chunk to storage: " + err.message });
      return;
    }

    // Record the completed part in the DB
    const existingParts: { partNumber: number; etag: string }[] = JSON.parse(session.completedParts || "[]");
    existingParts.push({ partNumber, etag });
    existingParts.sort((a, b) => a.partNumber - b.partNumber);

    await db
      .update(mediaUploadSessions)
      .set({ completedParts: JSON.stringify(existingParts) })
      .where(eq(mediaUploadSessions.uploadId, uploadId));

    const receivedCount = existingParts.length;

    // Not the final chunk yet
    if (receivedCount < session.totalChunks) {
      res.json({ received: chunkIndex, total: session.totalChunks, done: false });
      return;
    }

    // ── All parts uploaded — complete the R2 multipart upload ─────────────────
    try {
      const r2 = getR2Client();
      await r2.send(new CompleteMultipartUploadCommand({
        Bucket: getR2Bucket(),
        Key: session.s3Key,
        UploadId: session.r2UploadId,
        MultipartUpload: {
          Parts: existingParts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }));
    } catch (err: any) {
      console.error("[upload-media-repo/chunk] R2 complete failed:", err);
      // Abort the multipart upload to avoid orphaned parts
      try {
        const r2 = getR2Client();
        await r2.send(new AbortMultipartUploadCommand({
          Bucket: getR2Bucket(),
          Key: session.s3Key,
          UploadId: session.r2UploadId,
        }));
      } catch {}
      await db.delete(mediaUploadSessions).where(eq(mediaUploadSessions.uploadId, uploadId));
      res.status(500).json({ error: "Failed to complete upload: " + err.message });
      return;
    }

    const s3Url = `${getR2PublicUrl()}/${session.s3Key}`;
    const { fileName, mimeType, fileSize, title, description, tags, access, notes, mediaType, folder, brand, existingAssetId } = session;

    try {
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

        await db.insert(mediaVersions).values({
          assetId: existingAssetId,
          versionNumber: nextVersion,
          s3Key: session.s3Key,
          s3Url,
          fileName,
          fileSize: fileSize || 0,
          mimeType,
          notes: notes || null,
          uploadedByUserId: user.id,
        });

        await db
          .update(mediaAssets)
          .set({ mimeType, mediaType: mediaType as any, updatedAt: new Date() })
          .where(eq(mediaAssets.id, existingAssetId));

        await db.delete(mediaUploadSessions).where(eq(mediaUploadSessions.uploadId, uploadId));
        res.json({ done: true, assetId: existingAssetId, versionNumber: nextVersion, s3Url });
      } else {
        // New asset — extract slug from s3Key
        const slugMatch = session.s3Key.match(/^media-repo\/([^/]+)\//);
        const slug = slugMatch ? slugMatch[1] : generateSlug(title || fileName);

        const [assetResult] = await db.insert(mediaAssets).values({
          slug,
          title: title || fileName,
          description: description || null,
          mediaType: mediaType as any,
          mimeType,
          access: access as any,
          tags: tags || null,
          folder: folder || null,
          brand: brand as any,
          createdByUserId: user.id,
        });
        const assetId = (assetResult as any).insertId as number;

        await db.insert(mediaVersions).values({
          assetId,
          versionNumber: 1,
          s3Key: session.s3Key,
          s3Url,
          fileName,
          fileSize: fileSize || 0,
          mimeType,
          notes: notes || null,
          uploadedByUserId: user.id,
        });

        await db.delete(mediaUploadSessions).where(eq(mediaUploadSessions.uploadId, uploadId));
        res.json({ done: true, assetId, slug, versionNumber: 1, s3Url });
      }
    } catch (err: any) {
      console.error("[upload-media-repo/chunk] DB write failed:", err);
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

    const { originalname, buffer, size } = req.file;
    const rawMimeType = req.file.mimetype;
    const mimetype = resolveMimeType(rawMimeType, originalname);
    const title = (req.body.title as string)?.trim() || originalname;
    const description = (req.body.description as string) || null;
    const tags = (req.body.tags as string) || null;
    const access = (req.body.access as string) === "public" ? "public" : "private";
    const notes = (req.body.notes as string) || null;
    const existingAssetId = req.body.assetId ? parseInt(req.body.assetId, 10) : null;
    const mediaType = (req.body.mediaType as string) || detectMediaType(mimetype, originalname);
    const folderSlug = (req.body.folder as string) || null;

    try {
      // For small files, use storagePut (forge proxy); for large, use R2 directly
      const { storagePut, storagePutLarge } = await import("../storage");
      const uploadFn = buffer.length > 50 * 1024 * 1024 ? storagePutLarge : storagePut;

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
        const { url: s3Url } = await uploadFn(s3Key, buffer, mimetype);

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
        const { url: s3Url } = await uploadFn(s3Key, buffer, mimetype);

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
