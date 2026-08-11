/**
 * SCORM Extractor — Heartbeat-driven background job that extracts SCORM ZIP packages
 * and uploads all files to R2 for direct serving.
 *
 * Architecture (long-term reliable):
 * - A Heartbeat cron fires every 60s and POSTs to /api/scheduled/scorm-extract
 * - The handler picks up mediaVersions with scormExtractionStatus = 'pending'
 * - It processes ONE package at a time (to stay within Cloud Run 512MB / 180s limits)
 * - Status transitions: pending → processing → done | failed
 * - Stalled jobs (processing > 10 min) are automatically reset to pending for retry
 *
 * Memory-safe design:
 * - ZIP entries are piped directly to disk files (no entry.buffer() — no RAM spike)
 * - R2 uploads use fs.createReadStream() (no fs.readFileSync() — no RAM spike)
 * - ZIP file is deleted from /tmp immediately after extraction
 * - Work directory is deleted after all files are uploaded
 */

import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
import { createHash } from "crypto";
import unzipper from "unzipper";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq, and, lt, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { getDb } from "../db";
import { mediaVersions, mediaAssets } from "../../drizzle/schema";
import { storagePut, storageGet } from "../storage";
import type { Request, Response } from "express";
import { findScormLaunchFile, needsScormExtraction, SCORM_PACKAGE_MEDIA_TYPES } from "../lib/scormPackage";

const SCORM_EXTRACT_DIR = path.join(os.tmpdir(), "scorm-extract-job");
// Restart interrupted work after 15 minutes. Existing R2 files are skipped on
// retry, so large packages make forward progress rather than restarting uploads.
export const SCORM_RESUMABLE_STALL_THRESHOLD_MS = 15 * 60 * 1000;

export function shouldRequeueStaleScormJob(startedAt: Date | null | undefined, now = Date.now()): boolean {
  return !startedAt || now - startedAt.getTime() >= SCORM_RESUMABLE_STALL_THRESHOLD_MS;
}

/** Interrupted work must return to the queue; 'skipped' blocks Question Bank import. */
export function nextScormStatusAfterInterruption(): "pending" {
  return "pending";
}

/** Process one ZIP at a time to stay within the worker's memory and I/O budget. */
export function canStartQueuedScormExtraction(activeProcessingCount: number): boolean {
  return activeProcessingCount === 0;
}

type QueuedScormJob = {
  versionId: number;
  s3Url: string | null;
  slug: string;
  assetId: number;
};

let activeScormExtractionDrain: Promise<void> | null = null;
let railwayScormWorkerDb: ReturnType<typeof drizzle> | null = null;
let railwayScormWorkerUrl: string | null = null;
let extractionR2Client: S3Client | null = null;

/**
 * Heartbeat callbacks run on the managed deployment, while the public learning
 * site stores media in Railway. Prefer that live database when it is configured.
 */
export function resolveScormWorkerDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.RAILWAY_MYSQL_URL || null;
}

export function buildNoPendingScormDiagnostic(rawPendingVersions: number, usingRailway: boolean) {
  return {
    database: usingRailway ? "railway" : "managed",
    rawPendingVersions,
    message: rawPendingVersions > 0
      ? "Pending versions exist, but none are eligible SCORM/ZIP/LMS packages for this worker"
      : "No pending SCORM/ZIP/LMS packages remain",
  };
}

export function shouldNormalizeNonScormPendingRecord(params: {
  mediaType: string;
  mimeType?: string | null;
  fileName?: string | null;
  s3Url?: string | null;
}): boolean {
  return !needsScormExtraction(params);
}

export async function getScormWorkerDb() {
  const railwayUrl = resolveScormWorkerDatabaseUrl();
  if (!railwayUrl) return getDb();
  if (!railwayScormWorkerDb || railwayScormWorkerUrl !== railwayUrl) {
    railwayScormWorkerDb = drizzle(railwayUrl);
    railwayScormWorkerUrl = railwayUrl;
    console.log("[ScormExtractor] Using Railway media database for extraction work");
  }
  return railwayScormWorkerDb;
}

/** Existing R2 objects are preserved between interrupted large-package runs. */
export function shouldUploadScormObject(key: string, existingKeys: ReadonlySet<string>): boolean {
  return !existingKeys.has(key);
}

export function shouldUseDirectScormR2Upload(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!(env.CF_R2_ACCOUNT_ID && env.CF_R2_ACCESS_KEY_ID && env.CF_R2_SECRET_ACCESS_KEY);
}

function getExtractionR2Client(): S3Client | null {
  if (extractionR2Client) return extractionR2Client;
  if (!shouldUseDirectScormR2Upload()) return null;
  extractionR2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
    },
  });
  return extractionR2Client;
}

async function uploadScormObjectToR2(key: string, filePath: string, contentType: string): Promise<void> {
  const client = getExtractionR2Client();
  if (client) {
    await client.send(new PutObjectCommand({
      Bucket: process.env.CF_R2_BUCKET_NAME || "ultrasound-assist",
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
    }));
    return;
  }

  // Retain the platform storage fallback for environments without direct R2 credentials.
  await storagePut(key, fs.readFileSync(filePath), contentType);
}

async function listExistingScormR2Keys(prefix: string): Promise<Set<string>> {
  const accountId = process.env.CF_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return new Set();

  try {
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    const keys = new Set<string>();
    let continuationToken: string | undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({
        Bucket: process.env.CF_R2_BUCKET_NAME || "ultrasound-assist",
        Prefix: `${prefix}/`,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }));
      for (const object of page.Contents || []) {
        if (object.Key) keys.add(object.Key);
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  } catch (error: any) {
    console.warn(`[ScormExtractor] Could not read existing R2 extraction output: ${error?.message || error}`);
    return new Set();
  }
}

// ─── Download helper ──────────────────────────────────────────────────────────

/**
 * Detect whether a stored URL is a Manus storage-proxy URL that needs a fresh
 * presigned download URL, vs a direct CDN/CloudFront URL that can be fetched as-is.
 *
 * Storage-proxy URLs look like:
 *   https://api.manus.im/v1/storage/...?path=<key>   (explicit ?path= param)
 *   https://<forge-host>/v1/storage/...              (Forge API host)
 *
 * Direct CDN URLs look like:
 *   https://d2xsxph8kpxj0f.cloudfront.net/...        (CloudFront)
 *   https://<r2-public-url>/...                       (R2 public bucket)
 *
 * We MUST NOT call storageGet() on direct CDN URLs because storageGet() treats
 * the full pathname as a relative storage key and prepends the storage base path
 * again, producing a doubled path that results in HTTP 403.
 */
function isStorageProxyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Explicit storage-proxy URLs always have a ?path= query param
    if (u.searchParams.has("path")) return true;
    // Forge API host pattern (contains /v1/storage/ in path)
    if (u.pathname.includes("/v1/storage/")) return true;
    return false;
  } catch {
    return false;
  }
}

async function downloadToFile(storedUrl: string, destPath: string): Promise<void> {
  // Only call storageGet() for Manus storage-proxy URLs that need a fresh presigned URL.
  // Direct CDN/CloudFront URLs must be used as-is — calling storageGet() on them
  // would double the path prefix and produce HTTP 403.
  let downloadUrl = storedUrl;
  if (isStorageProxyUrl(storedUrl)) {
    try {
      const u = new URL(storedUrl);
      const pathParam = u.searchParams.get("path");
      const relKey = pathParam ?? u.pathname.replace(/^\/+/, "");
      if (relKey) {
        const { url } = await storageGet(relKey);
        downloadUrl = url;
      }
    } catch {
      // If URL parsing fails, try the original URL directly
    }
  }

  return new Promise((resolve, reject) => {
    const follow = (targetUrl: string, redirects = 0): void => {
      if (redirects > 10) { reject(new Error("Too many redirects")); return; }
      const proto = targetUrl.startsWith("https") ? https : http;
      proto.get(targetUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Download failed: HTTP ${res.statusCode} for ${targetUrl}`));
          return;
        }
        const ws = fs.createWriteStream(destPath);
        res.pipe(ws);
        ws.on("finish", () => resolve());
        ws.on("error", reject);
        res.on("error", reject);
      }).on("error", reject);
    };
    // URL-encode path segments to handle spaces and special characters
    try {
      const u = new URL(downloadUrl);
      u.pathname = u.pathname.split("/").map(p => encodeURIComponent(decodeURIComponent(p))).join("/");
      follow(u.toString());
    } catch {
      follow(downloadUrl);
    }
  });
}

// ─── MIME type helper ─────────────────────────────────────────────────────────

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".html": "text/html", ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript", ".mjs": "application/javascript",
    ".json": "application/json",
    ".xml": "application/xml",
    ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon",
    ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm",
    ".ogg": "audio/ogg", ".wav": "audio/wav",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".swf": "application/x-shockwave-flash",
    ".txt": "text/plain",
  };
  return mimeMap[ext] || "application/octet-stream";
}

// ─── Collect all files in a directory recursively ────────────────────────────

function collectFiles(dir: string, base: string = dir): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results.push(...collectFiles(full, base));
      } else {
        results.push(path.relative(base, full));
      }
    }
  } catch {}
  return results;
}

// ─── Core extraction + upload function ───────────────────────────────────────

/**
 * Extract a SCORM ZIP and upload all files to R2.
 * Uses streaming extraction (pipe to disk) and streaming upload (readStream to R2)
 * to stay within Cloud Run's 512MB RAM limit even for 500MB+ packages.
 */
export async function extractAndUploadScormVersion(
  versionId: number,
  s3Url: string,
  slug: string
): Promise<void> {
  const urlHash = createHash("md5").update(s3Url).digest("hex").slice(0, 8);
  const prefix = `scorm-extracted/${slug}-${urlHash}`;
  const workDir = path.join(SCORM_EXTRACT_DIR, `${slug}-${urlHash}`);
  const zipPath = `${workDir}.zip`;

  console.log(`[ScormExtractor] Starting extraction for version ${versionId}, slug=${slug}`);

  try {
    fs.mkdirSync(SCORM_EXTRACT_DIR, { recursive: true });
    fs.mkdirSync(workDir, { recursive: true });

    // ── Step 1: Stream download ZIP to disk ──────────────────────────────────
    await downloadToFile(s3Url, zipPath);
    const zipSizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    console.log(`[ScormExtractor] Downloaded ZIP (${zipSizeMB} MB) to ${zipPath}`);

    // ── Step 2: Stream-extract each entry to disk (NO entry.buffer() calls) ──
    // Using unzipper.Open.file + entry.stream() to pipe directly to disk files.
    // This avoids loading entire file contents into RAM.
    const directory = await unzipper.Open.file(zipPath);
    let extractedCount = 0;
    for (const entry of directory.files) {
      if (entry.type === "File") {
        const destPath = path.join(workDir, entry.path);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        // Stream pipe: ZIP entry → disk file (zero RAM buffering)
        await new Promise<void>((resolve, reject) => {
          const ws = fs.createWriteStream(destPath);
          entry.stream()
            .pipe(ws)
            .on("finish", resolve)
            .on("error", reject);
        });
        extractedCount++;
      }
    }
    console.log(`[ScormExtractor] Extracted ${extractedCount} files to ${workDir}`);

    // Delete ZIP immediately to free /tmp space before uploading
    try { fs.unlinkSync(zipPath); } catch {}

    // ── Step 3: Find launch file from manifest ───────────────────────────────
    const manifestPath = path.join(workDir, "imsmanifest.xml");
    let launchFile = "index.html";
    if (fs.existsSync(manifestPath)) {
      const manifestXml = fs.readFileSync(manifestPath, "utf8");
      launchFile = findScormLaunchFile(manifestXml);
    } else {
      // Search for index.html recursively
      const findIndex = (dir: string, depth: number): string | null => {
        if (depth > 4) return null;
        try {
          for (const entry of fs.readdirSync(dir)) {
            const full = path.join(dir, entry);
            if (fs.statSync(full).isDirectory()) {
              const found = findIndex(full, depth + 1);
              if (found) return found;
            } else if (entry.toLowerCase() === "index.html") {
              return path.relative(workDir, full);
            }
          }
        } catch {}
        return null;
      };
      const indexEntry = findIndex(workDir, 0);
      if (indexEntry) launchFile = indexEntry;
    }
    console.log(`[ScormExtractor] Launch file: ${launchFile}`);

    // ── Step 4: Upload all files to R2 using streams (NO fs.readFileSync) ────
    const allFiles = collectFiles(workDir);
    console.log(`[ScormExtractor] Uploading ${allFiles.length} files to R2 under ${prefix}/`);
    const existingR2Keys = await listExistingScormR2Keys(prefix);
    if (existingR2Keys.size > 0) {
      console.log(`[ScormExtractor] Resuming package upload: ${existingR2Keys.size} file(s) already present in R2`);
    }

    // Upload in batches of 20 to maximize R2 throughput (each upload is ~1-2s on Cloud Run)
    const BATCH_SIZE = 20;
    let uploaded = 0;
    let skippedExisting = 0;
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (relPath) => {
          const fullPath = path.join(workDir, relPath);
          const mime = guessMime(relPath);
          const key = `${prefix}/${relPath}`;
          if (!shouldUploadScormObject(key, existingR2Keys)) {
            skippedExisting++;
            return;
          }
          await uploadScormObjectToR2(key, fullPath, mime);
          uploaded++;
        })
      );
      const completed = uploaded + skippedExisting;
      if (completed % 20 === 0 || completed === allFiles.length) {
        console.log(`[ScormExtractor] Uploaded ${uploaded} new / skipped ${skippedExisting} existing / ${allFiles.length} total files`);
      }
    }

    // ── Step 5: Validate launch file exists in uploaded files, auto-correct if needed ──
    // Normalize paths to forward slashes for comparison
    const normalize = (p: string) => p.replace(/\\/g, "/");
    const uploadedRelPaths = allFiles.map(f => normalize(f));
    let validatedLaunchFile = normalize(launchFile);

    if (!uploadedRelPaths.some(p => p === validatedLaunchFile || p.toLowerCase() === validatedLaunchFile.toLowerCase())) {
      // Launch file not found in uploaded set — scan for any index.html
      const indexHtmlRel = uploadedRelPaths.find(p => p.toLowerCase().endsWith("/index.html") || p.toLowerCase() === "index.html");
      if (indexHtmlRel) {
        console.warn(`[ScormExtractor] Launch file '${launchFile}' not in extracted files. Auto-corrected to '${indexHtmlRel}'`);
        validatedLaunchFile = indexHtmlRel;
      } else {
        const htmlFiles = uploadedRelPaths.filter(p => p.toLowerCase().endsWith(".html")).slice(0, 5);
        throw new Error(`Launch file '${launchFile}' not found in extracted files. HTML files found: ${htmlFiles.join(", ") || "none"}`);
      }
    }

    // ── Step 6: Update DB row with prefix + validated launch file + status = done ──
    const db = await getScormWorkerDb();
    if (db) {
      await db
        .update(mediaVersions)
        .set({
          scormExtractedPrefix: prefix,
          scormLaunchFile: validatedLaunchFile,
          scormExtractionStatus: "done",
          scormExtractionError: null,
        })
        .where(eq(mediaVersions.id, versionId));
      console.log(`[ScormExtractor] ✓ Done: version ${versionId}, prefix=${prefix}, launch=${validatedLaunchFile}`);
    }

    // ── Step 6: Clean up work directory ──────────────────────────────────────
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}

  } catch (err: any) {
    console.error(`[ScormExtractor] ✗ Failed for version ${versionId}:`, err.message);
    // Clean up partial files
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {}

    // Mark as failed in DB
    try {
      const db = await getScormWorkerDb();
      if (db) {
        await db
          .update(mediaVersions)
          .set({
            scormExtractionStatus: "failed",
            scormExtractionError: err.message || "Unknown error",
          })
          .where(eq(mediaVersions.id, versionId));
      }
    } catch (dbErr) {
      console.error(`[ScormExtractor] Failed to update DB status:`, dbErr);
    }
    throw err; // Re-throw so heartbeat handler knows it failed
  }
}

// ─── Legacy fire-and-forget entry point (kept for backward compat) ────────────
// Still used by uploadMediaRepo.ts after upload. Now just queues the job by
// ensuring status = 'pending' — the heartbeat handler does the actual work.

export async function extractAndUploadScorm(
  versionId: number,
  s3Url: string,
  slug: string
): Promise<void> {
  try {
    const db = await getScormWorkerDb();
    if (!db) return;
    // Reset to pending so the heartbeat picks it up
    await db
      .update(mediaVersions)
      .set({
        scormExtractionStatus: "pending",
        scormExtractionError: null,
        scormExtractedPrefix: null,
        scormLaunchFile: null,
        scormExtractionStartedAt: null,
      })
      .where(eq(mediaVersions.id, versionId));
    console.log(`[ScormExtractor] Queued version ${versionId} (slug=${slug}) for heartbeat extraction`);
  } catch (err) {
    console.error(`[ScormExtractor] Failed to queue version ${versionId}:`, err);
  }
}

// ─── SCORM Health-Check Heartbeat: POST /api/scheduled/scorm-health-check ────
// Runs periodically (e.g. every 10 min). Audits all 'done' versions to verify
// their launch file actually exists in R2. Re-queues any broken ones.

export async function scormHealthCheckHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = await getScormWorkerDb();
    if (!db) { res.json({ ok: true, skipped: "no-db" }); return; }

    // Get all 'done' versions that have an extracted prefix (not direct-HTML)
    const doneVersions = await db
      .select({
        versionId: mediaVersions.id,
        slug: mediaAssets.slug,
        prefix: mediaVersions.scormExtractedPrefix,
        launchFile: mediaVersions.scormLaunchFile,
      })
      .from(mediaVersions)
      .innerJoin(mediaAssets, eq(mediaAssets.id, mediaVersions.assetId))
      .where(
        and(
          eq(mediaVersions.scormExtractionStatus as any, "done"),
          inArray(mediaAssets.mediaType, [...SCORM_PACKAGE_MEDIA_TYPES])
        )
      )
      .limit(50); // Check up to 50 per run to stay within request timeout

    const broken: number[] = [];
    const healed: number[] = [];

    for (const v of doneVersions) {
      if (!v.prefix || v.prefix.startsWith("__direct_html__:")) continue; // skip direct HTML
      const launchKey = `${v.prefix}/${v.launchFile || "index.html"}`;
      try {
        // Quick HEAD check via R2 list (cheaper than GET)
        const { S3Client, HeadObjectCommand, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
        const r2Client = new S3Client({
          region: "auto",
          endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!, secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY! },
        });
        try {
          await r2Client.send(new HeadObjectCommand({ Bucket: process.env.CF_R2_BUCKET_NAME!, Key: launchKey }));
          // Launch file exists — healthy
        } catch (headErr: any) {
          if (headErr?.name === "NotFound" || headErr?.$metadata?.httpStatusCode === 404) {
            // Launch file missing — try to auto-heal by scanning R2
            const listResult = await r2Client.send(new ListObjectsV2Command({ Bucket: process.env.CF_R2_BUCKET_NAME!, Prefix: `${v.prefix}/`, MaxKeys: 500 }));
            const keys = (listResult.Contents || []).map(o => o.Key || "");
            const indexKey = keys.find(k => k.toLowerCase().endsWith("/index.html") || k.toLowerCase() === `${v.prefix}/index.html`);
            if (indexKey) {
              const correctedLaunchFile = indexKey.replace(`${v.prefix}/`, "");
              await db.update(mediaVersions).set({ scormLaunchFile: correctedLaunchFile }).where(eq(mediaVersions.id, v.versionId));
              console.log(`[ScormHealthCheck] Healed version ${v.versionId} (${v.slug}): '${v.launchFile}' → '${correctedLaunchFile}'`);
              healed.push(v.versionId);
            } else {
              // R2 prefix is stale — queue re-extraction but keep prefix until a new one is written.
              // Also try to mark an HTML fallback version if one exists on CDN.
              const htmlRows = await db
                .select({ id: mediaVersions.id, s3Url: mediaVersions.s3Url })
                .from(mediaVersions)
                .innerJoin(mediaAssets, eq(mediaAssets.id, mediaVersions.assetId))
                .where(eq(mediaAssets.slug, v.slug));
              const htmlFallback = htmlRows.find((row) => {
                const u = (row.s3Url ?? "").toLowerCase().split("?")[0];
                return u.endsWith(".html") || u.endsWith(".htm");
              });
              if (htmlFallback?.s3Url) {
                const launchFile = htmlFallback.s3Url.substring(htmlFallback.s3Url.lastIndexOf("/") + 1);
                await db.update(mediaVersions).set({
                  scormExtractionStatus: "done",
                  scormExtractedPrefix: `__direct_html__:${htmlFallback.s3Url}`,
                  scormLaunchFile: launchFile,
                  scormExtractionError: null,
                }).where(eq(mediaVersions.id, v.versionId));
                console.warn(`[ScormHealthCheck] HTML fallback for ${v.slug} (version ${v.versionId})`);
                healed.push(v.versionId);
              } else {
                await db.update(mediaVersions).set({
                  scormExtractionStatus: "pending" as any,
                  scormExtractionError: "Launch file missing from R2; queued re-extraction",
                }).where(eq(mediaVersions.id, v.versionId));
                console.warn(`[ScormHealthCheck] Re-queued version ${v.versionId} (${v.slug}): launch file missing from R2`);
                broken.push(v.versionId);
              }
            }
          }
          // Other errors (network, auth) — skip this version silently
        }
      } catch (err) {
        console.error(`[ScormHealthCheck] Error checking version ${v.versionId}:`, err);
      }
    }

    // ── Recover stale processing versions without abandoning extraction ─────────
    // A package may take time to download and upload, but it must remain eligible
    // for Question Bank import. Requeue stale work instead of changing it to
    // 'skipped', which would permanently block the import workflow.
    const healCutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
    const stuckVersions = await db
      .select({ id: mediaVersions.id, s3Url: mediaVersions.s3Url, mimeType: mediaVersions.mimeType, fileName: mediaVersions.fileName })
      .from(mediaVersions)
      .where(
        and(
          eq(mediaVersions.scormExtractionStatus as any, "processing"),
          lt(mediaVersions.createdAt, healCutoff)
        )
      );
    const requeuedVersionIds: number[] = [];
    for (const sv of stuckVersions) {
      await db
        .update(mediaVersions)
        .set({
          scormExtractionStatus: nextScormStatusAfterInterruption(),
          scormExtractionStartedAt: null,
          scormExtractionError: "Extraction was requeued after an interrupted worker run",
        })
        .where(eq(mediaVersions.id, sv.id));
      requeuedVersionIds.push(sv.id);
      console.log(`[ScormHealthCheck] Requeued interrupted extraction for version ${sv.id}`);
    }

    let alertSummary: Awaited<ReturnType<typeof import("../lib/scormHealthAlerts").runScormHealthAlertPass>> | undefined;
    try {
      const { runScormHealthAlertPass } = await import("../lib/scormHealthAlerts");
      alertSummary = await runScormHealthAlertPass();
    } catch (alertErr: any) {
      console.error(`[ScormHealthCheck] Alert pass failed:`, alertErr?.message ?? alertErr);
    }

    res.json({ ok: true, checked: doneVersions.length, healed, requeued: [...broken, ...requeuedVersionIds], alerts: alertSummary });
  } catch (err: any) {
    console.error(`[ScormHealthCheck] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Heartbeat handler: POST /api/scheduled/scorm-extract ────────────────────
// Claims the next package, then the Always On worker drains queued packages
// sequentially. The Heartbeat remains the reliable trigger after restarts.

async function claimNextPendingScormJob(db: NonNullable<Awaited<ReturnType<typeof getScormWorkerDb>>>): Promise<QueuedScormJob | null> {
  while (true) {
    const pending = await db
      .select({
        versionId: mediaVersions.id,
        s3Url: mediaVersions.s3Url,
        slug: mediaAssets.slug,
        assetId: mediaVersions.assetId,
      })
      .from(mediaVersions)
      .innerJoin(mediaAssets, eq(mediaAssets.id, mediaVersions.assetId))
      .where(
        and(
          eq(mediaVersions.scormExtractionStatus as any, "pending"),
          inArray(mediaAssets.mediaType, [...SCORM_PACKAGE_MEDIA_TYPES])
        )
      )
      .limit(1);

    if (pending.length === 0) return null;
    const job = pending[0] as QueuedScormJob;

    if (!job.s3Url) {
      await db.update(mediaVersions)
        .set({ scormExtractionStatus: "failed", scormExtractionError: "No S3 URL available" })
        .where(eq(mediaVersions.id, job.versionId));
      continue;
    }

    const urlLower = job.s3Url.toLowerCase().split("?")[0];
    if (urlLower.endsWith(".html") || urlLower.endsWith(".htm")) {
      const launchFile = job.s3Url.substring(job.s3Url.lastIndexOf("/") + 1);
      await db.update(mediaVersions).set({
        scormExtractionStatus: "done",
        scormExtractedPrefix: `__direct_html__:${job.s3Url}`,
        scormLaunchFile: launchFile,
        scormExtractionError: null,
      }).where(eq(mediaVersions.id, job.versionId));
      console.log(`[ScormExtractor] Marked pre-extracted HTML version ${job.versionId} ready`);
      continue;
    }

    await db.update(mediaVersions)
      .set({ scormExtractionStatus: "processing", scormExtractionStartedAt: new Date(), scormExtractionError: null })
      .where(and(eq(mediaVersions.id, job.versionId), eq(mediaVersions.scormExtractionStatus as any, "pending")));
    return job;
  }
}

async function drainScormExtractionQueue(initialJob: QueuedScormJob): Promise<void> {
  let job: QueuedScormJob | null = initialJob;
  while (job) {
    try {
      await extractAndUploadScormVersion(job.versionId, job.s3Url!, job.slug);
    } catch (err: any) {
      console.error(`[ScormExtractor] Queue item ${job.versionId} failed:`, err.message);
    }

    const db = await getScormWorkerDb();
    job = db ? await claimNextPendingScormJob(db) : null;
  }
  console.log("[ScormExtractor] Queue drain complete — no pending packages remain");
}

function startScormExtractionDrain(job: QueuedScormJob): void {
  activeScormExtractionDrain = drainScormExtractionQueue(job)
    .catch((err) => console.error("[ScormExtractor] Queue drain stopped unexpectedly:", err))
    .finally(() => { activeScormExtractionDrain = null; });
}

export async function scormExtractHeartbeatHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = await getScormWorkerDb();
    if (!db) {
      res.json({ ok: true, skipped: "no-db" });
      return;
    }

    // Legacy mirrors can leave ordinary images/documents marked pending. Clear
    // those rows before calculating capacity so the SCORM backlog stays accurate.
    const pendingRecords = await db
      .select({
        versionId: mediaVersions.id,
        mediaType: mediaAssets.mediaType,
        mimeType: mediaVersions.mimeType,
        fileName: mediaVersions.fileName,
        s3Url: mediaVersions.s3Url,
      })
      .from(mediaVersions)
      .innerJoin(mediaAssets, eq(mediaAssets.id, mediaVersions.assetId))
      .where(eq(mediaVersions.scormExtractionStatus as any, "pending"))
      .limit(250);
    const nonScormVersionIds = pendingRecords
      .filter((record) => shouldNormalizeNonScormPendingRecord(record))
      .map((record) => record.versionId);
    if (nonScormVersionIds.length > 0) {
      await db.update(mediaVersions).set({
        scormExtractionStatus: "skipped",
        scormExtractionError: "Not a SCORM or iSpring quiz package; extraction is not required",
        scormExtractionStartedAt: null,
      }).where(inArray(mediaVersions.id, nonScormVersionIds));
      console.log(`[ScormExtractor][Heartbeat] Normalized ${nonScormVersionIds.length} non-SCORM pending records`);
    }

    // Only one package may extract at a time. The actual extraction continues
    // after this Heartbeat returns, so a second invocation must not start another
    // large ZIP while the first one is still downloading or uploading.
    const activeProcessing = await db
      .select({ versionId: mediaVersions.id, startedAt: mediaVersions.scormExtractionStartedAt })
      .from(mediaVersions)
      .where(eq(mediaVersions.scormExtractionStatus as any, "processing"))
      .limit(1);

    const activeJob = activeProcessing[0];
    if (activeJob && shouldRequeueStaleScormJob(activeJob.startedAt)) {
      await db.update(mediaVersions)
        .set({
          scormExtractionStatus: nextScormStatusAfterInterruption(),
          scormExtractionStartedAt: null,
          scormExtractionError: "Extraction was requeued after an interrupted worker run",
        })
        .where(eq(mediaVersions.id, activeJob.versionId));
      console.log(`[ScormExtractor][Heartbeat] Requeued stale extraction ${activeJob.versionId}`);
    } else if (!canStartQueuedScormExtraction(activeProcessing.length)) {
      res.json({ ok: true, skipped: "active-extraction", versionId: activeProcessing[0].versionId });
      return;
    }

    const job = await claimNextPendingScormJob(db);
    if (!job) {
      const [rawPending] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(mediaVersions)
        .where(eq(mediaVersions.scormExtractionStatus as any, "pending"));
      res.json({
        ok: true,
        skipped: "no-pending",
        diagnostic: buildNoPendingScormDiagnostic(
          Number(rawPending?.count ?? 0),
          !!resolveScormWorkerDatabaseUrl(),
        ),
      });
      return;
    }
    console.log(`[ScormExtractor][Heartbeat] Processing version ${job.versionId}, slug=${job.slug}`);

    // Respond immediately; Always On keeps the sequential queue drain alive after
    // this Heartbeat request completes.
    res.status(202).json({ ok: true, accepted: { versionId: job.versionId, slug: job.slug } });
    startScormExtractionDrain(job);
  } catch (err: any) {
    console.error(`[ScormExtractor][Heartbeat] Error:`, err.message);
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
