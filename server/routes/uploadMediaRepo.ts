/**
 * Media Repository Upload Routes
 *
 * Two endpoints:
 *
 * 1. POST /api/upload-media-repo/init
 *    Initialises an upload session. Returns { uploadId }.
 *    For re-uploads: validates the existing assetId.
 *
 * 2. POST /api/upload-media-repo/chunk
 *    Uploads a single chunk (multipart, field "chunk").
 *    Fields: uploadId, chunkIndex, totalChunks, fileName, mimeType, fileSize,
 *            title, description, tags, access, mediaType, notes, assetId (optional), folder
 *    On the final chunk the server assembles the file, pushes to S3, and writes
 *    the mediaVersions row.
 *
 * Chunks are written to disk under /tmp/media-chunks/{uploadId}/ so they survive
 * server restarts (tsx watch reloads the module but /tmp persists).
 *
 * Platform admin only. No file-size limit — chunks are 10 MB each by default.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { storagePut, storagePutLarge } from "../storage";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { mediaAssets, mediaVersions } from "../../drizzle/schema";
import { detectBrandFromHostname } from "../../shared/brands";

// ── Disk-based chunk store ────────────────────────────────────────────────────
// Chunks are written to /tmp/media-chunks/{uploadId}/{chunkIndex}.bin
// This survives tsx watch restarts because /tmp is not cleared on module reload.
const CHUNK_DIR = "/tmp/media-chunks";

function chunkPath(uploadId: string, chunkIndex: number): string {
  return path.join(CHUNK_DIR, uploadId, `${chunkIndex}.bin`);
}

function chunkMetaPath(uploadId: string): string {
  return path.join(CHUNK_DIR, uploadId, "_meta.json");
}

function ensureUploadDir(uploadId: string): void {
  fs.mkdirSync(path.join(CHUNK_DIR, uploadId), { recursive: true });
}

function countChunksOnDisk(uploadId: string): number {
  const dir = path.join(CHUNK_DIR, uploadId);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith(".bin")).length;
}

function readChunkFromDisk(uploadId: string, chunkIndex: number): Buffer | null {
  const p = chunkPath(uploadId, chunkIndex);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

function cleanupUploadDir(uploadId: string): void {
  try {
    const dir = path.join(CHUNK_DIR, uploadId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
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
  // Detect SCORM from file extension when MIME is generic
  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".zip") {
      // SCORM packages are always .zip — treat as zip (user can reclassify as scorm)
      return "zip";
    }
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

// Resolve the best MIME type for a file — browsers often report .zip as
// "application/octet-stream", so we fall back to extension-based detection.
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

// Multer with disk storage — write directly to the upload dir to avoid holding
// large chunks in memory and to survive server restarts.
const upload = multer({
  storage: multer.memoryStorage(),
  // No limits — each chunk is ~10 MB; the frontend enforces chunk size
});

// ── /api/upload-media-repo/init ──────────────────────────────────────────────
router.post("/api/upload-media-repo/init", async (req: Request, res: Response) => {
  const user = await authenticateAdmin(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const uploadId = randomBytes(16).toString("hex");
  ensureUploadDir(uploadId);

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

    // Ensure upload directory exists (recreate if server restarted mid-upload)
    const uploadDir = path.join(CHUNK_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) {
      // Server was restarted — recreate the directory and accept the chunk
      // (the client will re-send any missing chunks if they get an error,
      //  but we can gracefully handle a restart by just recreating the dir)
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Write chunk to disk
    try {
      fs.writeFileSync(chunkPath(uploadId, chunkIndex), req.file.buffer);
    } catch (err: any) {
      console.error("[upload-media-repo/chunk] Failed to write chunk to disk:", err);
      res.status(500).json({ error: "Failed to store chunk: " + err.message });
      return;
    }

    const receivedChunks = countChunksOnDisk(uploadId);

    // Not the final chunk yet — acknowledge and wait
    if (receivedChunks < totalChunks) {
      res.json({ received: chunkIndex, total: totalChunks, done: false });
      return;
    }

    // ── All chunks received — assemble and upload to S3 ──────────────────────
    try {
      const buffers: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunk = readChunkFromDisk(uploadId, i);
        if (!chunk) {
          res.status(400).json({ error: `Missing chunk ${i} — please retry the upload` });
          return;
        }
        buffers.push(chunk);
      }
      const fullBuffer = Buffer.concat(buffers);
      cleanupUploadDir(uploadId); // Free disk space

      const db = await getDb();
      if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

      const originalname = req.body.fileName as string;
      const rawMimeType = req.body.mimeType as string;
      const mimetype = resolveMimeType(rawMimeType, originalname);
      const fileSize = parseInt(req.body.fileSize, 10) || fullBuffer.length;
      const title = (req.body.title as string)?.trim() || originalname;
      const description = (req.body.description as string) || null;
      const tags = (req.body.tags as string) || null;
      const access = (req.body.access as string) === "public" ? "public" : "private";
      const notes = (req.body.notes as string) || null;
      const existingAssetId = req.body.assetId ? parseInt(req.body.assetId, 10) : null;
      const mediaType = (req.body.mediaType as string) || detectMediaType(mimetype, originalname);
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
        const uploadFn = fullBuffer.length > 50 * 1024 * 1024 ? storagePutLarge : storagePut;
        const { url: s3Url } = await uploadFn(s3Key, fullBuffer, mimetype);

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
        const uploadFn = fullBuffer.length > 50 * 1024 * 1024 ? storagePutLarge : storagePut;
        const { url: s3Url } = await uploadFn(s3Key, fullBuffer, mimetype);

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
      cleanupUploadDir(uploadId);
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
