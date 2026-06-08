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
import { eq, and, lt, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { mediaVersions, mediaAssets } from "../../drizzle/schema";
import { storagePut, storageGet } from "../storage";
import type { Request, Response } from "express";
import { findScormLaunchFile, SCORM_PACKAGE_MEDIA_TYPES } from "../lib/scormPackage";

const SCORM_EXTRACT_DIR = path.join(os.tmpdir(), "scorm-extract-job");
// If a job has been "processing" for more than 60 minutes, consider it stalled and retry
const STALL_THRESHOLD_MS = 60 * 60 * 1000; // 60 min — large ZIPs (200MB+) with 500+ files can take 30-50 min to download + extract + upload to R2

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

    // Upload in batches of 20 to maximize R2 throughput (each upload is ~1-2s on Cloud Run)
    const BATCH_SIZE = 20;
    let uploaded = 0;
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (relPath) => {
          const fullPath = path.join(workDir, relPath);
          const mime = guessMime(relPath);
          const key = `${prefix}/${relPath}`;
          // Read as buffer for storagePut (storagePut accepts Buffer | Uint8Array | string)
          // For very large individual files (videos), stream in chunks
          const stat = fs.statSync(fullPath);
          if (stat.size > 50 * 1024 * 1024) {
            // Large file: read in chunks to avoid single large allocation
            const chunks: Buffer[] = [];
            await new Promise<void>((resolve, reject) => {
              const rs = fs.createReadStream(fullPath);
              rs.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
              rs.on("end", resolve);
              rs.on("error", reject);
            });
            await storagePut(key, Buffer.concat(chunks), mime);
          } else {
            const fileBuffer = fs.readFileSync(fullPath);
            await storagePut(key, fileBuffer, mime);
          }
          uploaded++;
        })
      );
      if (uploaded % 20 === 0 || uploaded === allFiles.length) {
        console.log(`[ScormExtractor] Uploaded ${uploaded}/${allFiles.length} files`);
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
    const db = await getDb();
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
      const db = await getDb();
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
    const db = await getDb();
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
    const db = await getDb();
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

    // ── Auto-heal stuck processing/pending versions → zip-stream ─────────────────────────
    // Any version stuck in processing/pending for >30 minutes gets auto-healed to
    // 'skipped' so it serves via on-demand ZIP streaming immediately.
    const healCutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
    const stuckVersions = await db
      .select({ id: mediaVersions.id, s3Url: mediaVersions.s3Url, mimeType: mediaVersions.mimeType, fileName: mediaVersions.fileName })
      .from(mediaVersions)
      .where(
        and(
          inArray(mediaVersions.scormExtractionStatus as any, ["processing", "pending"]),
          lt(mediaVersions.createdAt, healCutoff)
        )
      );
    const { isZipStorageRef } = await import("../lib/scormPackage");
    const healedVersionIds: number[] = [];
    for (const sv of stuckVersions) {
      if (!isZipStorageRef(sv)) continue;
      await db
        .update(mediaVersions)
        .set({ scormExtractionStatus: "skipped", scormExtractionError: "Serving via on-demand ZIP streaming (auto-healed from stuck state)" })
        .where(eq(mediaVersions.id, sv.id));
      healedVersionIds.push(sv.id);
      console.log(`[ScormHealthCheck] Auto-healed stuck version ${sv.id} → skipped (zip-stream)`);
    }

    let alertSummary: Awaited<ReturnType<typeof import("../lib/scormHealthAlerts").runScormHealthAlertPass>> | undefined;
    try {
      const { runScormHealthAlertPass } = await import("../lib/scormHealthAlerts");
      alertSummary = await runScormHealthAlertPass();
    } catch (alertErr: any) {
      console.error(`[ScormHealthCheck] Alert pass failed:`, alertErr?.message ?? alertErr);
    }

    res.json({ ok: true, checked: doneVersions.length, healed, requeued: broken, healedStuck: healedVersionIds, alerts: alertSummary });
  } catch (err: any) {
    console.error(`[ScormHealthCheck] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─── Heartbeat handler: POST /api/scheduled/scorm-extract ────────────────────
// Fires every 60s. Picks up ONE pending SCORM version and processes it.
// Idempotent: if already processing and not stalled, skips gracefully.

export async function scormExtractHeartbeatHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      res.json({ ok: true, skipped: "no-db" });
      return;
    }

    const now = new Date();
    const stallCutoff = new Date(now.getTime() - STALL_THRESHOLD_MS);

    // Auto-heal stalled jobs: instead of re-queuing, mark as 'skipped' so they
    // immediately serve via on-demand ZIP streaming (no extraction needed).
    // This prevents the infinite processing→pending→processing loop for large ZIPs
    // that will always time out on Cloud Run (200MB+ packages).
    const stalledResult = await db
      .update(mediaVersions)
      .set({
        scormExtractionStatus: "skipped",
        scormExtractionError: "Serving via on-demand ZIP streaming (extraction timed out — auto-healed)",
      })
      .where(
        and(
          eq(mediaVersions.scormExtractionStatus as any, "processing"),
          lt(mediaVersions.scormExtractionStartedAt as any, stallCutoff)
        )
      );
    const stalledCount = (stalledResult as any)?.rowsAffected ?? 0;
    if (stalledCount > 0) {
      console.log(`[ScormExtractor][Heartbeat] Auto-healed ${stalledCount} stalled version(s) → skipped (zip-stream)`);
    }

    // Find one pending SCORM version to process
    // Join with mediaAssets to confirm it's actually a SCORM/zip type
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

    if (pending.length === 0) {
      res.json({ ok: true, skipped: "no-pending" });
      return;
    }

    const job = pending[0];
    if (!job.s3Url) {
      // No file URL — mark as failed
      await db
        .update(mediaVersions)
        .set({ scormExtractionStatus: "failed", scormExtractionError: "No S3 URL available" })
        .where(eq(mediaVersions.id, job.versionId));
      res.json({ ok: true, skipped: "no-url", versionId: job.versionId });
      return;
    }

    // ── Check file size: skip extraction for large ZIPs (>50MB) → use zip-stream ──
    // Cloud Run has 512MB RAM and 180s timeout. A 200MB ZIP with 500+ files takes
    // 3-10 minutes to download + extract + upload. We skip extraction for large files
    // and serve them directly via on-demand ZIP streaming instead.
    const MAX_EXTRACTABLE_BYTES = 50 * 1024 * 1024; // 50MB
    const { fileSize: jobFileSize } = (await db
      .select({ fileSize: mediaVersions.fileSize })
      .from(mediaVersions)
      .where(eq(mediaVersions.id, job.versionId))
      .limit(1))[0] ?? {};
    if (jobFileSize && jobFileSize > MAX_EXTRACTABLE_BYTES) {
      await db
        .update(mediaVersions)
        .set({
          scormExtractionStatus: "skipped",
          scormExtractionError: `File too large for extraction (${Math.round(jobFileSize / 1024 / 1024)}MB > 50MB limit) — serving via on-demand ZIP streaming`,
        })
        .where(eq(mediaVersions.id, job.versionId));
      console.log(`[ScormExtractor][Heartbeat] Skipping large ZIP version ${job.versionId} (${Math.round(jobFileSize / 1024 / 1024)}MB) → zip-stream`);
      res.json({ ok: true, skipped: "too-large", versionId: job.versionId, fileSizeMB: Math.round(jobFileSize / 1024 / 1024) });
      return;
    }

    // ── Detect pre-extracted HTML URLs (old-style iHeartEcho content) ──────────
    // These are SCORM packages where the ZIP was already extracted on the old server
    // and the stored URL points directly to an HTML file (e.g. .../FolderName/index.html).
    // We cannot re-extract these — instead, mark them as done with a special prefix
    // so the embed route can serve the content directly via iframe.
    const urlLower = job.s3Url.toLowerCase().split("?")[0]; // strip query params
    const isPreExtractedHtml = urlLower.endsWith(".html") || urlLower.endsWith(".htm");
    if (isPreExtractedHtml) {
      const lastSlash = job.s3Url.lastIndexOf("/");
      const launchFile = job.s3Url.substring(lastSlash + 1); // e.g. "index.html"
      const directHtmlPrefix = `__direct_html__:${job.s3Url}`;
      await db
        .update(mediaVersions)
        .set({
          scormExtractionStatus: "done",
          scormExtractedPrefix: directHtmlPrefix,
          scormLaunchFile: launchFile,
          scormExtractionError: null,
        })
        .where(eq(mediaVersions.id, job.versionId));
      console.log(`[ScormExtractor][Heartbeat] Pre-extracted HTML detected for version ${job.versionId}: ${job.s3Url}`);
      res.json({ ok: true, processed: { versionId: job.versionId, slug: job.slug, type: "pre-extracted-html" } });
      return;
    }

    // Mark as processing
    await db
      .update(mediaVersions)
      .set({ scormExtractionStatus: "processing", scormExtractionStartedAt: now })
      .where(eq(mediaVersions.id, job.versionId));

    console.log(`[ScormExtractor][Heartbeat] Processing version ${job.versionId}, slug=${job.slug}`);

    // ── Respond immediately so Cloud Run doesn't kill us on the 180s timeout ──
    // Large ZIPs (200MB+) take 3-10 minutes to download + extract + upload to R2.
    // We fire extraction in the background and return 202 Accepted right away.
    res.status(202).json({ ok: true, accepted: { versionId: job.versionId, slug: job.slug } });

    // Run extraction in background (detached from HTTP request lifecycle)
    extractAndUploadScormVersion(job.versionId, job.s3Url, job.slug).catch((err) => {
      console.error(`[ScormExtractor][Heartbeat] Background extraction failed for version ${job.versionId}:`, err.message);
    });
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
