/**
 * TEACH Chunked Upload Route
 *
 * Accepts multipart/form-data chunked uploads from TEACH instructors and admins.
 * Bypasses the tRPC JSON body limit (100 MB) and the base64 overhead (~33%).
 *
 * Flow:
 * 1. POST /api/upload-teach/init  → returns { uploadId, strategy }
 * 2. POST /api/upload-teach/chunk → sends chunks, returns { done, assetId, s3Url } on last chunk
 *
 * After upload completes, the frontend calls trpc.teach.parsePptxFromUrl to parse the PPTX.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { randomBytes } from "crypto";
import { eq, sql, and, isNull } from "drizzle-orm";
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
import { storagePut, storagePutLarge } from "../storage";
import { requireTeachAccess } from "../routers/teachRouter";
import { teachFolderSlug } from "../lib/teachAccess";
import {
  importTeachUploadedFileAsync,
  TEACH_IMPORT_FAILED_PREFIX,
} from "../lib/teachPptxMaterialImport";

// ── R2 helpers (shared with uploadMediaRepo) ──────────────────────────────────
function getR2Client(): S3Client {
  const accountId = process.env.CF_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) throw new Error("R2 credentials not configured");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}
function getR2Bucket(): string { return process.env.CF_R2_BUCKET_NAME || "ultrasound-assist"; }
function getR2PublicUrl(): string {
  const url = process.env.CF_R2_PUBLIC_URL;
  if (!url) throw new Error("CF_R2_PUBLIC_URL not configured");
  return url.replace(/\/+$/, "");
}

function generateSlug(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${base}-${randomBytes(4).toString("hex")}`;
}

const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50 MB

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── Auth helper ───────────────────────────────────────────────────────────────
async function authenticateTeachUser(req: Request): Promise<{ id: number; role: string } | null> {
  try {
    const user = await sdk.authenticateRequest(req) as any;
    if (!user?.id) return null;
    // Allow platform admins unconditionally
    if (user.role === "admin") return user;
    // Allow users with TEACH access (instructors, education managers)
    try {
      await requireTeachAccess(user.id);
      return user;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// ── POST /api/upload-teach/init ───────────────────────────────────────────────
router.post("/api/upload-teach/init", async (req: Request, res: Response) => {
  const user = await authenticateTeachUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const db = await getDb();
  if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

  try {
    const fileName = (req.body.fileName as string) || "upload";
    const rawMimeType = (req.body.mimeType as string) || "application/octet-stream";
    const totalChunks = parseInt(req.body.totalChunks, 10) || 1;
    const title = (req.body.title as string)?.trim() || fileName.replace(/\.[^.]+$/, "");
    const fileSize = parseInt(req.body.fileSize, 10) || 0;
    const ownerContext = (req.body.ownerContext as string) || "lms_instructor";
    const educatorOrgId = req.body.educatorOrgId ? parseInt(req.body.educatorOrgId, 10) : null;

    const slug = generateSlug(title);
    const s3Key = `media-repo/${slug}/v1-${fileName}`;
    const strategy: "direct" | "multipart" = fileSize > LARGE_FILE_THRESHOLD ? "multipart" : "direct";

    let r2UploadId: string | null = null;
    if (strategy === "multipart") {
      try {
        const r2 = getR2Client();
        const result = await r2.send(new CreateMultipartUploadCommand({
          Bucket: getR2Bucket(),
          Key: s3Key,
          ContentType: rawMimeType,
        }));
        r2UploadId = result.UploadId!;
      } catch (err: any) {
        console.error("[upload-teach/init] R2 multipart init failed:", err.message);
      }
    }

    const finalStrategy: "direct" | "multipart" = (strategy === "multipart" && r2UploadId) ? "multipart" : "direct";
    const uploadId = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(mediaUploadSessions).values({
      uploadId,
      r2UploadId: r2UploadId || "",
      s3Key,
      mimeType: rawMimeType,
      totalChunks,
      completedParts: "[]",
      fileName,
      fileSize,
      title,
      description: null,
      tags: null,
      access: "private",
      notes: null,
      mediaType: "document",
      folder: teachFolderSlug(user.id),
      brand: "aaus",
      strategy: finalStrategy,
      existingAssetId: null,
      createdByUserId: user.id,
      expiresAt,
    });

    res.json({ uploadId, strategy: finalStrategy, slug, s3Key, ownerContext, educatorOrgId });
  } catch (err: any) {
    console.error("[upload-teach/init] Error:", err);
    res.status(500).json({ error: err?.message || "Init failed" });
  }
});

// ── POST /api/upload-teach/chunk ──────────────────────────────────────────────
router.post("/api/upload-teach/chunk", upload.single("chunk"), async (req: Request, res: Response) => {
  const user = await authenticateTeachUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No chunk provided" }); return; }

  const uploadId = req.body.uploadId as string;
  const chunkIndex = parseInt(req.body.chunkIndex, 10);
  if (!uploadId || isNaN(chunkIndex)) {
    res.status(400).json({ error: "Missing uploadId or chunkIndex" }); return;
  }

  const db = await getDb();
  if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

  const [session] = await db
    .select()
    .from(mediaUploadSessions)
    .where(eq(mediaUploadSessions.uploadId, uploadId))
    .limit(1);
  if (!session) { res.status(404).json({ error: "Upload session not found — please restart the upload" }); return; }

  // Verify ownership
  if (session.createdByUserId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const strategy = session.strategy as "direct" | "multipart";
  let storedState: { parts: Array<{ partNumber: number; etag: string }>; chunks?: Record<string, boolean> } = { parts: [] };
  try {
    const parsed = JSON.parse(session.completedParts || "{}");
    storedState = { parts: parsed.parts || [], chunks: parsed.chunks || {} };
  } catch {
    storedState = { parts: [], chunks: {} };
  }

  if (strategy === "multipart" && session.r2UploadId) {
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
      console.error(`[upload-teach/chunk] R2 part upload failed (part ${partNumber}):`, err.message);
      res.status(500).json({ error: "Failed to upload chunk: " + err.message }); return;
    }

    const existingParts = storedState.parts || [];
    existingParts.push({ partNumber, etag });
    existingParts.sort((a, b) => a.partNumber - b.partNumber);
    storedState.parts = existingParts;
    await db.update(mediaUploadSessions).set({ completedParts: JSON.stringify(storedState) }).where(eq(mediaUploadSessions.uploadId, uploadId));

    if (existingParts.length < session.totalChunks) {
      res.json({ received: chunkIndex, total: session.totalChunks, done: false }); return;
    }

    // Complete R2 multipart
    try {
      const r2 = getR2Client();
      await r2.send(new CompleteMultipartUploadCommand({
        Bucket: getR2Bucket(),
        Key: session.s3Key,
        UploadId: session.r2UploadId,
        MultipartUpload: { Parts: existingParts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })) },
      }));
    } catch (err: any) {
      try { const r2 = getR2Client(); await r2.send(new AbortMultipartUploadCommand({ Bucket: getR2Bucket(), Key: session.s3Key, UploadId: session.r2UploadId })); } catch {}
      res.status(500).json({ error: "Failed to complete upload: " + err.message }); return;
    }

    const s3Url = `${getR2PublicUrl()}/${session.s3Key}`;
    return finalizeTeachUpload(res, db, session, s3Url, user.id, uploadId);
  } else {
    // Direct (Forge API) path — reassemble from /tmp
    const tmpDir = path.join(os.tmpdir(), "teach-chunks", uploadId);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, `chunk-${chunkIndex}`), req.file.buffer);

    const receivedSet: number[] = storedState.parts.map((p: any) => p.partNumber - 1);
    receivedSet.push(chunkIndex);
    const uniqueReceived = [...new Set(receivedSet)].sort((a, b) => a - b);
    storedState.parts = uniqueReceived.map(i => ({ partNumber: i + 1, etag: "" }));
    await db.update(mediaUploadSessions).set({ completedParts: JSON.stringify(storedState) }).where(eq(mediaUploadSessions.uploadId, uploadId));

    if (uniqueReceived.length < session.totalChunks) {
      res.json({ received: chunkIndex, total: session.totalChunks, done: false }); return;
    }

    // All chunks received — reassemble and upload
    try {
      const chunkBuffers: Buffer[] = [];
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(tmpDir, `chunk-${i}`);
        if (!fs.existsSync(chunkPath)) { res.status(500).json({ error: `Missing chunk ${i} — please restart the upload` }); return; }
        chunkBuffers.push(fs.readFileSync(chunkPath));
      }
      const fullBuffer = Buffer.concat(chunkBuffers);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

      // Use R2 multipart for assembled buffers > 20 MB to avoid storage proxy timeouts
      const DIRECT_LARGE_THRESHOLD = 20 * 1024 * 1024;
      const { url: s3Url } = fullBuffer.length > DIRECT_LARGE_THRESHOLD
        ? await storagePutLarge(session.s3Key, fullBuffer, session.mimeType)
        : await storagePut(session.s3Key, fullBuffer, session.mimeType);
      return finalizeTeachUpload(res, db, session, s3Url, user.id, uploadId);
    } catch (err: any) {
      console.error("[upload-teach/chunk] Reassembly failed:", err.message);
      res.status(500).json({ error: "Failed to assemble upload: " + err.message }); return;
    }
  }
});

async function finalizeTeachUpload(
  res: Response,
  db: any,
  session: any,
  s3Url: string,
  userId: number,
  uploadId: string,
) {
  const { fileName, mimeType, fileSize, title, s3Key } = session;
  try {
    const slug = s3Key.split("/")[1] || generateSlug(title);
    const [assetResult] = await db.insert(mediaAssets).values({
      slug,
      title,
      description: null,
      mediaType: "document",
      mimeType,
      access: "private",
      folder: session.folder,
      createdByUserId: userId,
    });
    const assetId = (assetResult as { insertId: number }).insertId;
    await db.insert(mediaVersions).values({
      assetId,
      versionNumber: 1,
      s3Key,
      s3Url,
      fileName,
      fileSize: fileSize || 0,
      mimeType,
      uploadedByUserId: userId,
    });
    await db.delete(mediaUploadSessions).where(eq(mediaUploadSessions.uploadId, uploadId));
    res.json({ done: true, assetId, s3Url, s3Key, slug, fileName, mimeType, fileSize });
  } catch (err: any) {
    console.error("[upload-teach/finalize] Error:", err);
    res.status(500).json({ error: err?.message || "Finalize failed" });
  }
}

// ── POST /api/upload-teach/parse ──────────────────────────────────────────────
// Parses an uploaded PPTX after chunked upload completes. Runs parsing in the
// background so the HTTP response returns before gateway timeouts.
router.post("/api/upload-teach/parse", async (req: Request, res: Response) => {
  const user = await authenticateTeachUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const body = req.body ?? {};
    const assetId = parseInt(body.assetId, 10);
    const fileSize = parseInt(body.fileSize, 10) || 0;
    if (!assetId || !body.s3Key || !body.s3Url || !body.fileName || !body.title) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const result = await importTeachUploadedFileAsync({
      userId: user.id,
      assetId,
      s3Key: String(body.s3Key),
      s3Url: String(body.s3Url),
      fileName: String(body.fileName),
      mimeType: String(body.mimeType || "application/octet-stream"),
      fileSize,
      title: String(body.title).trim(),
      description: body.description ? String(body.description) : undefined,
      ownerContext: body.ownerContext === "educator_assist" ? "educator_assist" : "lms_instructor",
      educatorOrgId: body.educatorOrgId ? parseInt(body.educatorOrgId, 10) : undefined,
    });

    res.json({
      materialId: result.materialId,
      mediaAssetId: result.mediaAssetId,
      folder: result.folder,
      parsed: result.parsed,
      slideMasterId: result.slideMasterId,
      processing: result.processing,
    });
  } catch (err: any) {
    const message = err?.message || "Parse failed";
    if (message.includes("TEACH access")) {
      res.status(403).json({ error: message });
      return;
    }
    console.error("[upload-teach/parse] Error:", err);
    res.status(500).json({ error: message });
  }
});

// ── GET /api/upload-teach/parse-status/:materialId ────────────────────────────
router.get("/api/upload-teach/parse-status/:materialId", async (req: Request, res: Response) => {
  const user = await authenticateTeachUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const materialId = parseInt(req.params.materialId, 10);
  if (!materialId) { res.status(400).json({ error: "Invalid materialId" }); return; }

  const db = await getDb();
  if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }

  const { teachMaterials } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [material] = await db
    .select({
      id: teachMaterials.id,
      ownerUserId: teachMaterials.ownerUserId,
      description: teachMaterials.description,
      slidesData: teachMaterials.slidesData,
      slidesDataUrl: teachMaterials.slidesDataUrl,
      slideMasterId: teachMaterials.slideMasterId,
      materialType: teachMaterials.materialType,
    })
    .from(teachMaterials)
    .where(eq(teachMaterials.id, materialId))
    .limit(1);

  if (!material) { res.status(404).json({ error: "Material not found" }); return; }
  if (material.ownerUserId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const desc = material.description ?? "";
  if (desc.startsWith(TEACH_IMPORT_FAILED_PREFIX)) {
    res.json({
      status: "failed",
      error: desc.slice(TEACH_IMPORT_FAILED_PREFIX.length).trim(),
      materialId,
    });
    return;
  }

  const hasSlides = Boolean(material.slidesData || material.slidesDataUrl);
  if (hasSlides || material.materialType !== "presentation") {
    res.json({
      status: "done",
      materialId,
      parsed: hasSlides,
      slideMasterId: material.slideMasterId,
    });
    return;
  }

  res.json({ status: "processing", materialId });
});

export function registerUploadTeachRoute(app: any) {
  app.use(router);
}
