/**
 * mirrorSync.ts
 * Continuous mirror sync job that keeps Railway MySQL and Cloudflare R2
 * in sync with the primary Manus database and S3 storage.
 *
 * DB Sync: Runs mysqldump from Manus TiDB → imports into Railway MySQL.
 * Media Sync: Scans DB for media URLs, downloads from Manus CDN, uploads to R2.
 *
 * Schedule: Every 6 hours by default (configurable).
 * Can also be triggered manually via admin tRPC procedure.
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";
import https from "https";
import http from "http";

const execAsync = promisify(exec);

// ── Configuration ──────────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Manus CDN base path (files are stored under this prefix)
const MANUS_CDN_BASE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/";

// Railway MySQL connection string (from env)
function getRailwayUrl(): string {
  return process.env.RAILWAY_MYSQL_URL || "";
}

// R2 credentials (from env)
function getR2Client(): S3Client | null {
  const accountId = process.env.CF_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.log("[MirrorSync] R2 credentials not configured, skipping media sync");
    return null;
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

// ── Sync State ─────────────────────────────────────────────────────────────────

let syncRunning = false;
let lastSyncResult: SyncResult | null = null;

export interface SyncResult {
  startedAt: Date;
  completedAt: Date;
  dbSync: { success: boolean; tablesImported: number; error?: string };
  mediaSync: { success: boolean; uploaded: number; skipped: number; failed: number; error?: string };
}

// ── Database Sync ──────────────────────────────────────────────────────────────

async function syncDatabase(): Promise<SyncResult["dbSync"]> {
  const railwayUrl = getRailwayUrl();
  if (!railwayUrl) {
    return { success: false, tablesImported: 0, error: "RAILWAY_MYSQL_URL not configured" };
  }

  // Parse the Manus DATABASE_URL
  const manusUrl = process.env.DATABASE_URL || "";
  if (!manusUrl) {
    return { success: false, tablesImported: 0, error: "DATABASE_URL (Manus) not available" };
  }

  try {
    // Parse Manus TiDB connection
    const manusMatch = manusUrl.match(
      /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/
    );
    if (!manusMatch) {
      return { success: false, tablesImported: 0, error: "Cannot parse Manus DATABASE_URL" };
    }
    const [, mUser, mPass, mHost, mPort, mDb] = manusMatch;

    // Parse Railway connection
    const railwayMatch = railwayUrl.match(
      /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/
    );
    if (!railwayMatch) {
      return { success: false, tablesImported: 0, error: "Cannot parse RAILWAY_MYSQL_URL" };
    }
    const [, rUser, rPass, rHost, rPort, rDb] = railwayMatch;

    console.log("[MirrorSync] Starting DB dump from Manus TiDB...");

    // Step 1: Dump from Manus
    const dumpCmd = `mysqldump --ssl-mode=REQUIRED -h ${mHost} -P ${mPort} -u '${mUser}' -p'${mPass}' --set-gtid-purged=OFF --column-statistics=0 --no-tablespaces --skip-lock-tables --routines --triggers ${mDb}`;
    const dumpFile = "/tmp/mirror_sync_dump.sql";

    await execAsync(`${dumpCmd} > ${dumpFile} 2>/dev/null`, { maxBuffer: 100 * 1024 * 1024 });

    // Count tables in dump
    const { stdout: tableCount } = await execAsync(
      `grep -c "CREATE TABLE" ${dumpFile}`
    );
    const tables = parseInt(tableCount.trim(), 10);
    console.log(`[MirrorSync] Dump complete: ${tables} tables`);

    // Step 2: Drop all tables in Railway
    console.log("[MirrorSync] Dropping existing Railway tables...");
    const dropCmd = `mysql -h ${rHost} -P ${rPort} -u ${rUser} -p'${rPass}' ${rDb} -e "SET FOREIGN_KEY_CHECKS=0; SET GROUP_CONCAT_MAX_LEN=1000000; SET @tables=NULL; SELECT GROUP_CONCAT('\\\`',table_name,'\\\`') INTO @tables FROM information_schema.tables WHERE table_schema='${rDb}'; SET @tables=IFNULL(CONCAT('DROP TABLE IF EXISTS ',@tables),'SELECT 1'); PREPARE stmt FROM @tables; EXECUTE stmt; DEALLOCATE PREPARE stmt; SET FOREIGN_KEY_CHECKS=1;"`;
    await execAsync(`${dropCmd} 2>/dev/null`);

    // Step 3: Import into Railway
    console.log("[MirrorSync] Importing into Railway MySQL...");
    const importCmd = `mysql -h ${rHost} -P ${rPort} -u ${rUser} -p'${rPass}' ${rDb} < ${dumpFile}`;
    await execAsync(`${importCmd} 2>/dev/null`, { maxBuffer: 100 * 1024 * 1024 });

    // Cleanup
    await execAsync(`rm -f ${dumpFile}`).catch(() => {});

    console.log(`[MirrorSync] DB sync complete: ${tables} tables imported to Railway`);
    return { success: true, tablesImported: tables };
  } catch (err: any) {
    console.error("[MirrorSync] DB sync failed:", err.message);
    return { success: false, tablesImported: 0, error: err.message };
  }
}

// ── Media Sync ─────────────────────────────────────────────────────────────────

function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location!).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    wmv: "video/x-ms-wmv",
    pdf: "application/pdf",
    zip: "application/zip",
  };
  return types[ext] || "application/octet-stream";
}

function getR2Key(url: string): string {
  if (url.startsWith(MANUS_CDN_BASE)) {
    return url.substring(MANUS_CDN_BASE.length);
  }
  const match = url.match(/UrcfdRVE8J6mpMNR48QuFe\/(.+)$/);
  return match ? match[1] : url.split("/").slice(-2).join("/");
}

async function existsInR2(r2: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function syncMedia(): Promise<SyncResult["mediaSync"]> {
  const r2 = getR2Client();
  if (!r2) {
    return { success: false, uploaded: 0, skipped: 0, failed: 0, error: "R2 not configured" };
  }

  const bucket = getR2Bucket();

  try {
    const db = await getDb();
    if (!db) {
      return { success: false, uploaded: 0, skipped: 0, failed: 0, error: "DB not available" };
    }

    // Collect all media URLs from the database
    const urlQueries = [
      db.execute(sql`SELECT DISTINCT echoImageUrl as url FROM scanCoachOverrides WHERE echoImageUrl IS NOT NULL AND echoImageUrl LIKE '%cloudfront.net%'`),
      db.execute(sql`SELECT DISTINCT thumbnailUrl as url FROM mediaAssets WHERE thumbnailUrl IS NOT NULL AND thumbnailUrl LIKE '%cloudfront.net%'`),
      db.execute(sql`SELECT DISTINCT s3Url as url FROM mediaVersions WHERE s3Url IS NOT NULL AND s3Url LIKE '%cloudfront.net%'`),
      db.execute(sql`SELECT DISTINCT cover_image_url as url FROM lms_courses WHERE cover_image_url IS NOT NULL AND cover_image_url LIKE '%cloudfront.net%'`),
      db.execute(sql`SELECT DISTINCT file_url as url FROM digital_product_files WHERE file_url IS NOT NULL AND file_url LIKE '%cloudfront.net%'`),
      db.execute(sql`SELECT DISTINCT thumbnail_url as url FROM digital_products WHERE thumbnail_url IS NOT NULL AND thumbnail_url LIKE '%cloudfront.net%'`),
      db.execute(sql`SELECT DISTINCT url FROM echoLibraryCaseMedia WHERE url IS NOT NULL AND url LIKE '%cloudfront.net%'`),
    ];

    const results = await Promise.allSettled(urlQueries);
    const allUrls = new Set<string>();

    for (const result of results) {
      if (result.status === "fulfilled") {
        const rows = (result.value as any)[0] || result.value;
        if (Array.isArray(rows)) {
          for (const row of rows) {
            const url = row.url;
            if (url && typeof url === "string") {
              allUrls.add(url);
            }
          }
        }
      }
    }

    console.log(`[MirrorSync] Found ${allUrls.size} unique media URLs to sync`);

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const url of Array.from(allUrls)) {
      const key = getR2Key(url);
      try {
        const exists = await existsInR2(r2, bucket, key);
        if (exists) {
          skipped++;
          continue;
        }

        const buffer = await downloadFile(url);
        const filename = url.split("/").pop() || "file";
        const contentType = getContentType(filename);

        await r2.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          })
        );

        uploaded++;
        console.log(`[MirrorSync] Uploaded to R2: ${key}`);
      } catch (err: any) {
        failed++;
        console.error(`[MirrorSync] Failed to sync ${key}: ${err.message}`);
      }
    }

    console.log(
      `[MirrorSync] Media sync complete: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`
    );
    return { success: true, uploaded, skipped, failed };
  } catch (err: any) {
    console.error("[MirrorSync] Media sync failed:", err.message);
    return { success: false, uploaded: 0, skipped: 0, failed: 0, error: err.message };
  }
}

// ── Main Sync Runner ───────────────────────────────────────────────────────────

export async function runMirrorSync(): Promise<SyncResult> {
  if (syncRunning) {
    console.log("[MirrorSync] Sync already in progress, skipping");
    return lastSyncResult || {
      startedAt: new Date(),
      completedAt: new Date(),
      dbSync: { success: false, tablesImported: 0, error: "Already running" },
      mediaSync: { success: false, uploaded: 0, skipped: 0, failed: 0, error: "Already running" },
    };
  }

  syncRunning = true;
  const startedAt = new Date();
  console.log(`[MirrorSync] Starting mirror sync at ${startedAt.toISOString()}`);

  try {
    // Run DB sync first, then media sync
    const dbSync = await syncDatabase();
    const mediaSync = await syncMedia();

    const completedAt = new Date();
    const duration = ((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1);
    console.log(`[MirrorSync] Sync completed in ${duration}s`);

    lastSyncResult = { startedAt, completedAt, dbSync, mediaSync };
    return lastSyncResult;
  } catch (err: any) {
    console.error("[MirrorSync] Sync failed:", err);
    const result: SyncResult = {
      startedAt,
      completedAt: new Date(),
      dbSync: { success: false, tablesImported: 0, error: err.message },
      mediaSync: { success: false, uploaded: 0, skipped: 0, failed: 0, error: err.message },
    };
    lastSyncResult = result;
    return result;
  } finally {
    syncRunning = false;
  }
}

export function getLastSyncResult(): SyncResult | null {
  return lastSyncResult;
}

export function isSyncRunning(): boolean {
  return syncRunning;
}

// ── Cron Starter ───────────────────────────────────────────────────────────────

let mirrorSyncStarted = false;

export function startMirrorSync() {
  if (mirrorSyncStarted) return;
  mirrorSyncStarted = true;

  // Check if Railway/R2 credentials are configured
  const hasRailway = !!getRailwayUrl();
  const hasR2 = !!process.env.CF_R2_ACCOUNT_ID && !!process.env.CF_R2_ACCESS_KEY_ID;

  if (!hasRailway && !hasR2) {
    console.log("[MirrorSync] No Railway/R2 credentials configured, mirror sync disabled");
    return;
  }

  console.log(
    `[MirrorSync] Mirror sync enabled (Railway: ${hasRailway ? "✓" : "✗"}, R2: ${hasR2 ? "✓" : "✗"}). Interval: ${SYNC_INTERVAL_MS / 3600000}h`
  );

  // Run first sync after a 2-minute delay (let server fully start)
  setTimeout(() => {
    runMirrorSync().catch((err) =>
      console.error("[MirrorSync] Initial sync failed:", err)
    );
  }, 2 * 60 * 1000);

  // Then run on interval
  setInterval(() => {
    runMirrorSync().catch((err) =>
      console.error("[MirrorSync] Periodic sync failed:", err)
    );
  }, SYNC_INTERVAL_MS);
}
