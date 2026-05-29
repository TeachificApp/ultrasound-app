/**
 * Media Repository Upload Routes
 *
 * Strategy:
 *  - Files ≤ 50 MB  → single-shot upload via Forge API proxy (storagePut)
 *  - Files > 50 MB  → R2 native multipart upload tracked in DB
 *
 * Two chunked endpoints (used by the frontend for ALL file sizes):
 *
 * 1. POST /api/upload-media-repo/init
 *    Returns { uploadId, strategy: "direct" | "multipart" }
 *
 * 2. POST /api/upload-media-repo/chunk
 *    For "direct":    assembles chunks in memory, uploads via storagePut on last chunk.
 *    For "multipart": streams each chunk directly to R2 as a multipart part.
 *
 * Session state is stored in the DB so it survives server/sandbox restarts.
 * Platform admin only. No file-size limit.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";
import os from "os";
import { execFile } from "child_process";
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

/**
 * Peek inside a ZIP buffer (first 2 MB) using `unzip -l` to detect SCORM packages.
 * Returns true if the ZIP contains imsmanifest.xml OR a root-level index.html.
 * This runs synchronously in a tmp file so it doesn't block the event loop for long.
 */
async function detectScormInZip(zipBuffer: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    const tmpPath = path.join(os.tmpdir(), `scorm-detect-${randomBytes(4).toString("hex")}.zip`);
    try {
      // Write a partial buffer (first 2 MB is enough to read the ZIP central directory)
      const partial = zipBuffer.slice(0, Math.min(zipBuffer.length, 2 * 1024 * 1024));
      fs.writeFileSync(tmpPath, partial);
    } catch {
      resolve(false);
      return;
    }
    execFile("unzip", ["-l", tmpPath], { timeout: 8000 }, (err, stdout) => {
      try { fs.unlinkSync(tmpPath); } catch {}
      if (err && !stdout) { resolve(false); return; }
      // Check for imsmanifest.xml (SCORM 1.2 / 2004) or root index.html
      const lines = stdout.split("\n");
      const hasManifest = lines.some(l => /imsmanifest\.xml$/i.test(l.trim()));
      // Root-level index.html: no path separator before the filename
      const hasRootIndex = lines.some(l => {
        const m = l.match(/\s+(\S+)$/);
        if (!m) return false;
        const p = m[1].replace(/\\/g, "/");
        // Allow one level of nesting (some SCORM packages wrap in a single folder)
        const parts = p.split("/").filter(Boolean);
        return parts.length <= 2 && parts[parts.length - 1].toLowerCase() === "index.html";
      });
      resolve(hasManifest || hasRootIndex);
    });
  });
}

async function authenticateAdmin(req: Request): Promise<{ id: number; role: string } | null> {
  try {
    const user = await sdk.authenticateRequest(req) as any;
    if (user?.role === "admin") return user;
  } catch {}
  return null;
}

// Threshold: files above this use R2 multipart, below use Forge API single-shot
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50 MB

const router = Router();

// Multer — chunks held in memory briefly while we process them
const upload = multer({ storage: multer.memoryStorage() });

// ── /api/upload-media-repo/init ──────────────────────────────────────────────
router.post("/api/upload-media-repo/init", async (req: Request, res: Response) => {
  const user = await authenticateAdmin(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }

  const db = await getDb();
  if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

  try {
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

  // Choose strategy based on file size
  const strategy: "direct" | "multipart" = fileSize > LARGE_FILE_THRESHOLD ? "multipart" : "direct";

  // Determine the S3 key upfront
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

  let r2UploadId: string | null = null;

  if (strategy === "multipart") {
    // Initiate R2 multipart upload
    try {
      const r2 = getR2Client();
      const result = await r2.send(new CreateMultipartUploadCommand({
        Bucket: getR2Bucket(),
        Key: s3Key,
        ContentType: mimeType,
      }));
      r2UploadId = result.UploadId!;
    } catch (err: any) {
      console.error("[upload-media-repo/init] R2 multipart init failed:", err.message);
      // Fall back to direct strategy
      r2UploadId = null;
    }
    // If R2 failed, fall back to direct
    if (!r2UploadId) {
      console.warn("[upload-media-repo/init] R2 unavailable, falling back to direct strategy");
    }
  }

  // Use direct if: explicitly chosen, or R2 fallback
  const finalStrategy: "direct" | "multipart" = (strategy === "multipart" && r2UploadId) ? "multipart" : "direct";

  const uploadId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await db.insert(mediaUploadSessions).values({
    uploadId,
    r2UploadId: r2UploadId || "",
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
    strategy: finalStrategy,
    existingAssetId,
    createdByUserId: user.id,
    expiresAt,
  });

  res.json({ uploadId, strategy: finalStrategy });
  } catch (err: any) {
    console.error("[upload-media-repo/init] Unhandled error:", err);
    res.status(500).json({ error: err?.message || "Init failed" });
  }
});

// ── /api/upload-media-repo/chunk ─────────────────────────────────────────────
router.post(
  "/api/upload-media-repo/chunk",
  upload.single("chunk"),
  async (req: Request, res: Response) => {
   try {
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

        // Read strategy from dedicated DB column (set at init time)
    const strategy: "direct" | "multipart" = (session.strategy as any) === "multipart" ? "multipart" : "direct";
    // Parse completed parts state
    let storedState: { parts: { partNumber: number; etag: string }[]; chunks?: Record<number, string> };
    try {
      const parsed = JSON.parse(session.completedParts || "[]");
      if (Array.isArray(parsed)) {
        storedState = { parts: parsed };
      } else {
        storedState = { parts: parsed.parts || [], chunks: parsed.chunks || {} };
      }
    } catch {
      storedState = { parts: [], chunks: {} };
    }

    if (strategy === "multipart" && session.r2UploadId) {
      // ── R2 Multipart path ───────────────────────────────────────────────────
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
        console.error(`[upload-media-repo/chunk] R2 part upload failed (part ${partNumber}):`, err.message);
        res.status(500).json({ error: "Failed to upload chunk to storage: " + err.message });
        return;
      }

      const existingParts = storedState.parts || [];
      existingParts.push({ partNumber, etag });
      existingParts.sort((a, b) => a.partNumber - b.partNumber);
      storedState.parts = existingParts;

      await db
        .update(mediaUploadSessions)
        .set({ completedParts: JSON.stringify(storedState) })
        .where(eq(mediaUploadSessions.uploadId, uploadId));

      const receivedCount = existingParts.length;

      if (receivedCount < session.totalChunks) {
        res.json({ received: chunkIndex, total: session.totalChunks, done: false });
        return;
      }

      // Complete the R2 multipart upload
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
        console.error("[upload-media-repo/chunk] R2 complete failed:", err.message);
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
      return finalizeUpload(req, res, db, session, s3Url, user.id, uploadId);

    } else {
      // ── Direct (Forge API) path ─────────────────────────────────────────────
      // Write chunk to /tmp directory (fast, no DB bloat)
      const tmpDir = path.join(os.tmpdir(), "media-chunks", uploadId);
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, `chunk-${chunkIndex}`), req.file.buffer);

      // Track received chunk count in DB state
      const receivedSet: number[] = storedState.parts.map((p: any) => p.partNumber - 1);
      receivedSet.push(chunkIndex);
      const uniqueReceived = [...new Set(receivedSet)].sort((a, b) => a - b);
      storedState.parts = uniqueReceived.map(i => ({ partNumber: i + 1, etag: "" }));

      await db
        .update(mediaUploadSessions)
        .set({ completedParts: JSON.stringify(storedState) })
        .where(eq(mediaUploadSessions.uploadId, uploadId));

      const receivedCount = uniqueReceived.length;

      if (receivedCount < session.totalChunks) {
        res.json({ received: chunkIndex, total: session.totalChunks, done: false });
        return;
      }

      // All chunks received — reassemble from /tmp and upload via storagePut
      try {
        const chunkBuffers: Buffer[] = [];
        for (let i = 0; i < session.totalChunks; i++) {
          const chunkPath = path.join(tmpDir, `chunk-${i}`);
          if (!fs.existsSync(chunkPath)) {
            res.status(500).json({ error: `Missing chunk ${i} — please restart the upload` });
            return;
          }
          chunkBuffers.push(fs.readFileSync(chunkPath));
        }
        const fullBuffer = Buffer.concat(chunkBuffers);

        const { storagePut, storagePutLarge } = await import("../storage");
        // Use storagePutLarge for files > 50MB to avoid Forge API size limits
        const uploadFn = fullBuffer.length > LARGE_FILE_THRESHOLD ? storagePutLarge : storagePut;
        const { url: s3Url } = await uploadFn(session.s3Key, fullBuffer, session.mimeType);

        // Clean up tmp chunks
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

        return finalizeUpload(req, res, db, session, s3Url, user.id, uploadId);
      } catch (err: any) {
        console.error("[upload-media-repo/chunk] storagePut failed:", err.message);
        await db.delete(mediaUploadSessions).where(eq(mediaUploadSessions.uploadId, uploadId));
        res.status(500).json({ error: "Storage upload failed: " + err.message });
        return;
      }
    }
   } catch (err: any) {
    console.error("[upload-media-repo/chunk] Unhandled error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Chunk processing failed: " + (err?.message || "unknown error") });
    }
   }
  }
);

// ── Finalize: write DB rows after successful storage upload ───────────────────
async function finalizeUpload(
  req: Request,
  res: Response,
  db: any,
  session: any,
  s3Url: string,
  userId: number,
  uploadId: string
) {
  let { fileName, mimeType, fileSize, title, description, tags, access, notes, mediaType, folder, brand, existingAssetId } = session;

  try {
    // Auto-detect SCORM packages: if the file is a ZIP, peek inside to check for
    // imsmanifest.xml or a root-level index.html and upgrade mediaType to "scorm".
    if (mediaType === "zip") {
      try {
        const https = await import("https");
        const http = await import("http");
        const partialBuffer = await new Promise<Buffer>((resolve, reject) => {
          const proto = s3Url.startsWith("https") ? https.default : http.default;
          const encodedUrl = (() => {
            try {
              const u = new URL(s3Url);
              u.pathname = u.pathname.split("/").map(encodeURIComponent).join("/");
              return u.toString();
            } catch { return s3Url; }
          })();
          const reqOpts = Object.assign(new URL(encodedUrl), { headers: { Range: "bytes=0-2097151" } });
          proto.get(reqOpts as any, (res: any) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => resolve(Buffer.concat(chunks)));
            res.on("error", reject);
          }).on("error", reject);
        });
        const isScorm = await detectScormInZip(partialBuffer);
        if (isScorm) {
          mediaType = "scorm";
          console.log(`[Upload] Auto-detected SCORM package for ${fileName}, upgrading mediaType zip→scorm`);
        }
      } catch (e: any) {
        console.warn("[Upload] SCORM auto-detect failed (non-fatal):", e.message);
      }
    }

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

      await db.insert(mediaVersions).values({
        assetId: existingAssetId,
        versionNumber: nextVersion,
        s3Key: session.s3Key,
        s3Url,
        fileName,
        fileSize: fileSize || 0,
        mimeType,
        notes: notes || null,
        uploadedByUserId: userId,
      });

      await db
        .update(mediaAssets)
        .set({ mimeType, mediaType: mediaType as any, updatedAt: new Date() })
        .where(eq(mediaAssets.id, existingAssetId));

      await db.delete(mediaUploadSessions).where(eq(mediaUploadSessions.uploadId, uploadId));
      res.json({ done: true, assetId: existingAssetId, versionNumber: nextVersion, s3Url });

      // Fire-and-forget: extract SCORM/ZIP package to R2 for fast serving
      if (mediaType === "scorm" || mediaType === "zip") {
        const { extractAndUploadScorm } = await import("./scormExtractor");
        const [insertedVersion] = await db
          .select({ id: mediaVersions.id })
          .from(mediaVersions)
          .where(and(eq(mediaVersions.assetId, existingAssetId), eq(mediaVersions.versionNumber, nextVersion)))
          .limit(1);
        if (insertedVersion) {
          extractAndUploadScorm(insertedVersion.id, s3Url, asset.slug).catch((e: any) =>
            console.error("[ScormExtractor] Background extraction failed:", e.message)
          );
        }
      }
    } else {
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
        createdByUserId: userId,
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
        uploadedByUserId: userId,
      });

      await db.delete(mediaUploadSessions).where(eq(mediaUploadSessions.uploadId, uploadId));
      res.json({ done: true, assetId, slug, versionNumber: 1, s3Url });

      // Fire-and-forget: extract SCORM/ZIP package to R2 for fast serving
      if (mediaType === "scorm" || mediaType === "zip") {
        const { extractAndUploadScorm } = await import("./scormExtractor");
        const [insertedVersion] = await db
          .select({ id: mediaVersions.id })
          .from(mediaVersions)
          .where(and(eq(mediaVersions.assetId, assetId), eq(mediaVersions.versionNumber, 1)))
          .limit(1);
        if (insertedVersion) {
          extractAndUploadScorm(insertedVersion.id, s3Url, slug).catch((e: any) =>
            console.error("[ScormExtractor] Background extraction failed:", e.message)
          );
        }
      }
    }
  } catch (err: any) {
    console.error("[upload-media-repo] DB write failed:", err.message);
    res.status(500).json({ error: err.message ?? "Upload failed" });
  }
}

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
      const { storagePut, storagePutLarge } = await import("../storage");
      const uploadFn = buffer.length > LARGE_FILE_THRESHOLD ? storagePutLarge : storagePut;

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

// ── Admin endpoint to trigger SCORM extraction for existing assets ───────────
router.post("/api/upload-media-repo/extract-scorm", async (req: Request, res: Response) => {
  const user = await authenticateAdmin(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const db = await getDb();
  if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

  const { slug } = req.body;
  if (!slug) { res.status(400).json({ error: "slug is required" }); return; }

  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.slug, slug), isNull(mediaAssets.deletedAt)))
    .limit(1);
  if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }

  const [version] = await db
    .select()
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, asset.id))
    .orderBy(desc(mediaVersions.versionNumber))
    .limit(1);
  if (!version) { res.status(404).json({ error: "No version found" }); return; }

  // Trigger extraction in background
  const { extractAndUploadScorm } = await import("./scormExtractor");
  extractAndUploadScorm(version.id, version.s3Url, asset.slug).catch((e: any) =>
    console.error("[ScormExtractor] Manual extraction failed:", e.message)
  );

  res.json({ ok: true, message: "SCORM extraction started in background. Check back in a few minutes." });
});

export function registerUploadMediaRepoRoute(app: import("express").Application) {
  app.use(router);
}
