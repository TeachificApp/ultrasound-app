/**
 * REST routes for SCORM/HTML ZIP file upload and extraction.
 * Mounted at /api/upload in server/_core/index.ts
 *
 * POST /api/upload/package          — upload a ZIP to disk, store to S3, extract in parallel
 * GET  /api/upload/status/:id       — poll processing status
 * GET  /api/upload/progress/:id     — SSE stream of real-time extraction progress
 */
import express, { Request, Response } from "express";
import multer from "multer";
import unzipper from "unzipper";
import { existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { nanoid } from "nanoid";
import { storagePut, storagePutStream } from "./storage";
import { parseScormManifest } from "./scormParser";
import { createPackage, updatePackage, createVersion, createFileAsset, getPackageById } from "./db";
import { authenticateRequest } from "./authHelper";

const router = express.Router();

// ── Disk-based multer — avoids loading 400+ MB into RAM ──────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => cb(null, `teachific-upload-${nanoid(12)}-${file.originalname}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 * 1024 }, // 3 GB hard cap
});

// ── In-memory SSE progress map ────────────────────────────────────────────────
// packageId → { done, total, phase, error }
const progressMap = new Map<number, { done: number; total: number; phase: string; error?: string }>();
const sseClients = new Map<number, Response[]>();

export function emitProgress(packageId: number, done: number, total: number, phase: string) {
  progressMap.set(packageId, { done, total, phase });
  const clients = sseClients.get(packageId) ?? [];
  const data = JSON.stringify({ done, total, phase });
  for (const res of clients) {
    try { res.write(`data: ${data}\n\n`); } catch { /* client disconnected */ }
  }
}

// ── POST /api/upload/package ──────────────────────────────────────────────────
router.post("/package", upload.single("file"), async (req: Request, res: Response) => {
  const tmpPath = (req.file as Express.Multer.File & { path: string })?.path;
  try {
    const authUser = await authenticateRequest(req);
    if (!authUser) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!req.file || !tmpPath) return res.status(400).json({ error: "No file uploaded" });

    const orgId = parseInt(req.body.orgId ?? "0", 10);
    const uploadedBy = parseInt(req.body.uploadedBy ?? "0", 10);
    const title = req.body.title ?? req.file.originalname.replace(/\.zip$/i, "");
    const displayMode = req.body.displayMode ?? "native";
    const lmsShellConfig = req.body.lmsShellConfig;

    if (!orgId || !uploadedBy) {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(400).json({ error: "orgId and uploadedBy are required" });
    }

    const suffix = nanoid(8);
    const zipKey = `orgs/${orgId}/packages/${suffix}/${req.file.originalname}`;

    // 1. Stream original ZIP directly to S3 — no full buffer in RAM
    const { url: zipUrl } = await storagePutStream(zipKey, tmpPath, "application/zip");

    // 2. Create package record (status: processing)
    await createPackage({
      orgId,
      uploadedBy,
      title,
      originalZipKey: zipKey,
      originalZipUrl: zipUrl,
      originalZipSize: req.file.size,
      contentType: "unknown",
      scormVersion: "none",
      displayMode,
      lmsShellConfig,
      status: "processing",
    });

    const { getDb } = await import("./db");
    const { contentPackages } = await import("../drizzle/schema");
    const { desc, eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(500).json({ error: "DB unavailable" });
    }

    const pkgs = await db.select().from(contentPackages)
      .where(eq(contentPackages.orgId, orgId))
      .orderBy(desc(contentPackages.createdAt))
      .limit(1);
    const pkg = pkgs[0];
    if (!pkg) {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(500).json({ error: "Package creation failed" });
    }

    // 3. Process ZIP asynchronously — streaming extraction + parallel S3 uploads
    processZip(tmpPath, req.file.size, pkg.id, orgId, suffix).catch((err) => {
      console.error(`[ZIP Processing] Package ${pkg.id} failed:`, err);
      emitProgress(pkg.id, 0, 1, "error");
      updatePackage(pkg.id, { status: "error", processingError: String(err) }).catch(console.error);
    });

    return res.json({
      packageId: pkg.id,
      zipUrl,
      status: "processing",
      message: "Upload received. Processing in background.",
    });
  } catch (err: unknown) {
    if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
    console.error("[Upload] Error:", err);
    return res.status(500).json({ error: "Upload failed", detail: String(err) });
  }
});

// ── POST /api/upload/version/:packageId ─────────────────────────────────────
// Upload a new version of an existing package. The package ID and embed URL
// stay the same; only the extracted content files change.
router.post("/version/:packageId", upload.single("file"), async (req: Request, res: Response) => {
  const tmpPath = (req.file as Express.Multer.File & { path: string })?.path;
  try {
    const authUser = await authenticateRequest(req);
    if (!authUser) {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!req.file || !tmpPath) return res.status(400).json({ error: "No file uploaded" });

    const packageId = parseInt(req.params.packageId, 10);
    const uploadedBy = parseInt(req.body.uploadedBy ?? "0", 10);
    const changelog = req.body.changelog ?? "New version";

    const pkg = await getPackageById(packageId);
    if (!pkg) {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(404).json({ error: "Package not found" });
    }

    const suffix = nanoid(8);
    const orgId = pkg.orgId;

    // 1. Stream original ZIP directly to S3 — no full buffer in RAM
    const zipKey = `orgs/${orgId}/packages/${suffix}/original.zip`;
    const { url: zipUrl } = await storagePutStream(zipKey, tmpPath, "application/zip");

    // 2. Set package back to processing
    await updatePackage(packageId, { status: "processing" });

    // 3. Process ZIP asynchronously — same logic as initial upload
    processZipVersion(tmpPath, req.file.size, packageId, orgId, suffix, uploadedBy, changelog).catch((err) => {
      console.error(`[ZIP Version] Package ${packageId} failed:`, err);
      emitProgress(packageId, 0, 1, "error");
      updatePackage(packageId, { status: "error", processingError: String(err) }).catch(console.error);
    });

    return res.json({
      packageId,
      zipUrl,
      status: "processing",
      message: "Version upload received. Processing in background.",
    });
  } catch (err: unknown) {
    if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
    console.error("[Version Upload] Error:", err);
    return res.status(500).json({ error: "Version upload failed", detail: String(err) });
  }
});

// ── GET /api/upload/status/:packageId ─────────────────────────────────────────
router.get("/status/:packageId", async (req: Request, res: Response) => {
  try {
    const packageId = parseInt(req.params.packageId, 10);
    const pkg = await getPackageById(packageId);
    if (!pkg) return res.status(404).json({ error: "Package not found" });
    const progress = progressMap.get(packageId);
    return res.json({
      packageId: pkg.id,
      status: pkg.status,
      contentType: pkg.contentType,
      scormVersion: pkg.scormVersion,
      scormEntryPoint: pkg.scormEntryPoint,
      processingError: pkg.processingError,
      progress: progress ?? null,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: "Status check failed", detail: String(err) });
  }
});

// ── GET /api/upload/progress/:packageId  (SSE) ────────────────────────────────
router.get("/progress/:packageId", (req: Request, res: Response) => {
  const packageId = parseInt(req.params.packageId, 10);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send current state immediately if available
  const current = progressMap.get(packageId);
  if (current) res.write(`data: ${JSON.stringify(current)}\n\n`);

  const clients = sseClients.get(packageId) ?? [];
  clients.push(res);
  sseClients.set(packageId, clients);

  req.on("close", () => {
    const remaining = (sseClients.get(packageId) ?? []).filter((c) => c !== res);
    sseClients.set(packageId, remaining);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function parallelUpload<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency = 10
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ─── Background ZIP processing — streaming extraction to avoid RAM exhaustion ─
export async function processZip(
  tmpPath: string,
  zipSize: number,
  packageId: number,
  orgId: number,
  suffix: string
) {
  try {
    type FileEntry = { key: string; url: string; path: string; size: number; mimeType: string };
    const extractedFiles: FileEntry[] = [];
    let manifestXml: string | null = null;
    let indexHtmlPath: string | null = null;

    emitProgress(packageId, 0, 1, "reading");

    // ── Pass 1: Count total files (fast directory scan) ──────────────────────
    const directory = await unzipper.Open.file(tmpPath);
    const fileEntries = directory.files.filter((f) => f.type !== "Directory");
    const total = fileEntries.length;

    emitProgress(packageId, 0, total, "extracting");

    // ── Pass 2: Stream-extract each file and upload to S3 in parallel ────────
    // We process in batches to keep memory bounded: read CONCURRENCY files at a
    // time, upload them, then move on.  This avoids loading all 345 buffers at once.
    const CONCURRENCY = 8;
    let done = 0;

    // Split entries into batches
    const batches: typeof fileEntries[] = [];
    for (let i = 0; i < fileEntries.length; i += CONCURRENCY) {
      batches.push(fileEntries.slice(i, i + CONCURRENCY));
    }

    for (const batch of batches) {
      // Read batch buffers sequentially (unzipper is not safe for concurrent reads)
      const buffers: Array<{ path: string; buffer: Buffer; mimeType: string }> = [];
      for (const file of batch) {
        const filePath = file.path.replace(/^\//, "");
        const fileBuffer = await file.buffer();
        const mimeType = guessMime(filePath);
        buffers.push({ path: filePath, buffer: fileBuffer, mimeType });

        // Capture manifest and entry point candidates
        if (filePath.toLowerCase() === "imsmanifest.xml" || filePath.toLowerCase().endsWith("/imsmanifest.xml")) {
          manifestXml = fileBuffer.toString("utf-8");
        }
        if (!indexHtmlPath) {
          const lower = filePath.toLowerCase();
          if (lower === "index.html" || lower.endsWith("/index.html") ||
              lower === "story.html" || lower.endsWith("/story.html") ||
              lower === "index_lms.html" || lower.endsWith("/index_lms.html")) {
            indexHtmlPath = filePath;
          }
        }
      }

      // Upload batch to S3 in parallel
      await parallelUpload(buffers, async ({ path: filePath, buffer: fileBuffer, mimeType }) => {
        const s3Key = `orgs/${orgId}/packages/${suffix}/extracted/${filePath}`;
        const { url: fileS3Url } = await storagePut(s3Key, fileBuffer, mimeType);
        extractedFiles.push({ key: s3Key, url: fileS3Url, path: filePath, size: fileBuffer.length, mimeType });
        done++;
        emitProgress(packageId, done, total, "uploading");
      }, CONCURRENCY);
    }

    emitProgress(packageId, total, total, "finalizing");

    // ── Parse SCORM manifest ──────────────────────────────────────────────────
    let scormVersion: "1.2" | "2004" | "none" = "none";
    let scormEntryPoint: string | undefined;
    let scormManifest: string | undefined;
    let contentType: "scorm" | "html" | "articulate" | "ispring" | "unknown" = "unknown";
    let entryPoint: string | null = null;

    if (manifestXml) {
      try {
        const parsed = await parseScormManifest(manifestXml);
        scormVersion = (parsed?.version ?? "none") as "1.2" | "2004" | "none";
        scormEntryPoint = parsed?.entryPoint ?? undefined;
        scormManifest = JSON.stringify(parsed);
        contentType = "scorm";
        if (manifestXml.includes("articulate") || manifestXml.includes("Articulate")) contentType = "articulate";
        if (manifestXml.includes("ispring") || manifestXml.includes("iSpring")) contentType = "ispring";
      } catch (e) {
        console.warn("[SCORM Parse] Failed to parse manifest:", e);
      }
    } else if (indexHtmlPath) {
      contentType = "html";
      entryPoint = indexHtmlPath;
    }

    // Resolve entry point — prefer deepest index.html if SCORM entry not found
    let resolvedEntryPath = scormEntryPoint ?? entryPoint ?? indexHtmlPath ?? "index.html";

    // If the resolved entry doesn't match any extracted file, find the deepest index.html
    const entryMatch = extractedFiles.find(
      (f) => f.path.toLowerCase() === resolvedEntryPath.toLowerCase()
    );
    if (!entryMatch) {
      const htmlCandidates = extractedFiles.filter((f) =>
        f.path.toLowerCase().endsWith("index.html") ||
        f.path.toLowerCase().endsWith("story.html") ||
        f.path.toLowerCase().endsWith("index_lms.html")
      );
      if (htmlCandidates.length > 0) {
        // Pick the deepest (most path segments)
        htmlCandidates.sort((a, b) => b.path.split("/").length - a.path.split("/").length);
        resolvedEntryPath = htmlCandidates[0].path;
      }
    }

    // ── Create version record ─────────────────────────────────────────────────
    await createVersion({
      packageId,
      versionNumber: 1,
      versionLabel: "v1.0",
      changelog: "Initial upload",
      zipKey: `orgs/${orgId}/packages/${suffix}/original.zip`,
      zipUrl: "",
      zipSize: zipSize,
      extractedFolderKey: `orgs/${orgId}/packages/${suffix}/extracted/`,
      entryPoint: resolvedEntryPath,
      fileCount: extractedFiles.length,
      uploadedBy: 0,
    });

    const { getVersionsByPackage } = await import("./db");
    const versions = await getVersionsByPackage(packageId);
    const versionId = versions[0]?.id;

    // ── Store file assets ─────────────────────────────────────────────────────
    if (versionId) {
      // Insert in batches of 50 to avoid huge single queries
      const ASSET_BATCH = 50;
      for (let i = 0; i < extractedFiles.length; i += ASSET_BATCH) {
        const assetBatch = extractedFiles.slice(i, i + ASSET_BATCH);
        await Promise.all(assetBatch.map((f) =>
          createFileAsset({
            packageId,
            versionId,
            relativePath: f.path,
            s3Key: f.key,
            s3Url: f.url,
            fileSize: f.size,
            mimeType: f.mimeType,
            isEntryPoint: f.path.toLowerCase() === resolvedEntryPath.toLowerCase(),
          })
        ));
      }
    }

    // ── Update package to ready ───────────────────────────────────────────────
    await updatePackage(packageId, {
      status: "ready",
      contentType,
      scormVersion,
      scormEntryPoint: resolvedEntryPath,
      scormManifest,
      extractedFolderKey: `orgs/${orgId}/packages/${suffix}/extracted/`,
      currentVersionId: versionId,
    });

    emitProgress(packageId, total, total, "ready");
    console.log(`[ZIP Processing] Package ${packageId} ready. ${extractedFiles.length} files extracted. Entry: ${resolvedEntryPath}`);
  } finally {
    // Always clean up temp file
    if (existsSync(tmpPath)) {
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
}

// ─── Background ZIP processing for a new version of an existing package ─────
export async function processZipVersion(
  tmpPath: string,
  zipSize: number,
  packageId: number,
  orgId: number,
  suffix: string,
  uploadedBy: number,
  changelog: string
) {
  try {
    type FileEntry = { key: string; url: string; path: string; size: number; mimeType: string };
    const extractedFiles: FileEntry[] = [];
    let manifestXml: string | null = null;
    let indexHtmlPath: string | null = null;

    emitProgress(packageId, 0, 1, "reading");

    const directory = await unzipper.Open.file(tmpPath);
    const fileEntries = directory.files.filter((f) => f.type !== "Directory");
    const total = fileEntries.length;

    emitProgress(packageId, 0, total, "extracting");

    const CONCURRENCY = 8;
    let done = 0;
    const batches: typeof fileEntries[] = [];
    for (let i = 0; i < fileEntries.length; i += CONCURRENCY) {
      batches.push(fileEntries.slice(i, i + CONCURRENCY));
    }

    for (const batch of batches) {
      const buffers: Array<{ path: string; buffer: Buffer; mimeType: string }> = [];
      for (const file of batch) {
        const filePath = file.path.replace(/^\//, "");
        const fileBuffer = await file.buffer();
        const mimeType = guessMime(filePath);
        buffers.push({ path: filePath, buffer: fileBuffer, mimeType });
        if (filePath.toLowerCase() === "imsmanifest.xml" || filePath.toLowerCase().endsWith("/imsmanifest.xml")) {
          manifestXml = fileBuffer.toString("utf-8");
        }
        if (!indexHtmlPath) {
          const lower = filePath.toLowerCase();
          if (lower === "index.html" || lower.endsWith("/index.html") ||
              lower === "story.html" || lower.endsWith("/story.html") ||
              lower === "index_lms.html" || lower.endsWith("/index_lms.html")) {
            indexHtmlPath = filePath;
          }
        }
      }
      await parallelUpload(buffers, async ({ path: filePath, buffer: fileBuffer, mimeType }) => {
        const s3Key = `orgs/${orgId}/packages/${suffix}/extracted/${filePath}`;
        const { url: fileS3Url } = await storagePut(s3Key, fileBuffer, mimeType);
        extractedFiles.push({ key: s3Key, url: fileS3Url, path: filePath, size: fileBuffer.length, mimeType });
        done++;
        emitProgress(packageId, done, total, "uploading");
      }, CONCURRENCY);
    }

    emitProgress(packageId, total, total, "finalizing");

    let scormVersion: "1.2" | "2004" | "none" = "none";
    let scormEntryPoint: string | undefined;
    let scormManifest: string | undefined;
    let contentType: "scorm" | "html" | "articulate" | "ispring" | "unknown" = "unknown";
    let entryPoint: string | null = null;

    if (manifestXml) {
      try {
        const parsed = await parseScormManifest(manifestXml);
        scormVersion = (parsed?.version ?? "none") as "1.2" | "2004" | "none";
        scormEntryPoint = parsed?.entryPoint ?? undefined;
        scormManifest = JSON.stringify(parsed);
        contentType = "scorm";
        if (manifestXml.includes("articulate") || manifestXml.includes("Articulate")) contentType = "articulate";
        if (manifestXml.includes("ispring") || manifestXml.includes("iSpring")) contentType = "ispring";
      } catch (e) {
        console.warn("[SCORM Parse] Failed to parse manifest:", e);
      }
    } else if (indexHtmlPath) {
      contentType = "html";
      entryPoint = indexHtmlPath;
    }

    let resolvedEntryPath = scormEntryPoint ?? entryPoint ?? indexHtmlPath ?? "index.html";
    const entryMatch = extractedFiles.find((f) => f.path.toLowerCase() === resolvedEntryPath.toLowerCase());
    if (!entryMatch) {
      const htmlCandidates = extractedFiles.filter((f) =>
        f.path.toLowerCase().endsWith("index.html") ||
        f.path.toLowerCase().endsWith("story.html") ||
        f.path.toLowerCase().endsWith("index_lms.html")
      );
      if (htmlCandidates.length > 0) {
        htmlCandidates.sort((a, b) => b.path.split("/").length - a.path.split("/").length);
        resolvedEntryPath = htmlCandidates[0].path;
      }
    }

    // Get the next version number
    const { getLatestVersionNumber } = await import("./db");
    const latestNum = await getLatestVersionNumber(packageId);
    const nextNum = latestNum + 1;

    await createVersion({
      packageId,
      versionNumber: nextNum,
      versionLabel: `v${nextNum}.0`,
      changelog,
      zipKey: `orgs/${orgId}/packages/${suffix}/original.zip`,
      zipUrl: "",
      zipSize,
      extractedFolderKey: `orgs/${orgId}/packages/${suffix}/extracted/`,
      entryPoint: resolvedEntryPath,
      fileCount: extractedFiles.length,
      uploadedBy,
    });

    const { getVersionsByPackage } = await import("./db");
    const versions = await getVersionsByPackage(packageId);
    const versionId = versions[0]?.id;

    if (versionId) {
      const ASSET_BATCH = 50;
      for (let i = 0; i < extractedFiles.length; i += ASSET_BATCH) {
        const assetBatch = extractedFiles.slice(i, i + ASSET_BATCH);
        await Promise.all(assetBatch.map((f) =>
          createFileAsset({
            packageId,
            versionId,
            relativePath: f.path,
            s3Key: f.key,
            s3Url: f.url,
            fileSize: f.size,
            mimeType: f.mimeType,
            isEntryPoint: f.path.toLowerCase() === resolvedEntryPath.toLowerCase(),
          })
        ));
      }
    }

    await updatePackage(packageId, {
      status: "ready",
      contentType,
      scormVersion,
      scormEntryPoint: resolvedEntryPath,
      scormManifest,
      extractedFolderKey: `orgs/${orgId}/packages/${suffix}/extracted/`,
      currentVersionId: versionId,
    });

    emitProgress(packageId, total, total, "ready");
    console.log(`[ZIP Version] Package ${packageId} version ${nextNum} ready. ${extractedFiles.length} files. Entry: ${resolvedEntryPath}`);
  } finally {
    if (existsSync(tmpPath)) {
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
}

function guessMime(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    html: "text/html", htm: "text/html", css: "text/css",
    js: "application/javascript", mjs: "application/javascript",
    json: "application/json", xml: "application/xml",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", svg: "image/svg+xml", webp: "image/webp",
    mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg",
    wav: "audio/wav", ogg: "audio/ogg",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
    pdf: "application/pdf", zip: "application/zip",
    swf: "application/x-shockwave-flash", ico: "image/x-icon", txt: "text/plain",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}

export default router;
