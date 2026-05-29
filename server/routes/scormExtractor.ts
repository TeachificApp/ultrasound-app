/**
 * SCORM Extractor — Background job that extracts SCORM ZIP packages
 * and uploads all files to R2 for direct serving.
 *
 * This avoids downloading + extracting 100MB+ ZIPs on every request
 * (which exceeds Cloud Run's 512MB RAM and 180s timeout).
 *
 * Flow:
 * 1. After a SCORM upload completes (finalizeUpload), this is called fire-and-forget
 * 2. Downloads the ZIP from R2/S3 to /tmp (streaming)
 * 3. Extracts it locally
 * 4. Uploads each extracted file to R2 under scorm-extracted/<slug>-<hash>/
 * 5. Updates the mediaVersions row with scormExtractedPrefix and scormLaunchFile
 */

import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
import { createHash } from "crypto";
import unzipper from "unzipper";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { mediaVersions } from "../../drizzle/schema";
import { storagePut } from "../storage";

const SCORM_EXTRACT_DIR = path.join(os.tmpdir(), "scorm-extract-job");

/**
 * Download a URL to a local file (streaming).
 */
function downloadToFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (targetUrl: string, redirects = 0): void => {
      if (redirects > 5) { reject(new Error("Too many redirects")); return; }
      const proto = targetUrl.startsWith("https") ? https : http;
      proto.get(targetUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const ws = fs.createWriteStream(destPath);
        res.pipe(ws);
        ws.on("finish", () => resolve());
        ws.on("error", reject);
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

/**
 * Parse imsmanifest.xml to find the SCO launch file.
 */
function findScormLaunchFile(manifestXml: string): string {
  const scoMatch =
    manifestXml.match(/<resource[^>]+type=['"'][^'"]*sco[^'"]*['"'][^>]*href=['"']([^'"]+)['"']/i) ||
    manifestXml.match(/<resource[^>]+href=['"']([^'"]+)['"'][^>]*type=['"'][^'"]*sco[^'"]*['"']/i);
  if (scoMatch) return scoMatch[1].split("?")[0];
  const anyMatch = manifestXml.match(/<resource[^>]+href=['"']([^'"]+)['"']/i);
  if (anyMatch) return anyMatch[1].split("?")[0];
  return "index.html";
}

/**
 * Recursively collect all files in a directory.
 */
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

/**
 * Guess MIME type from file extension.
 */
function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".xml": "application/xml",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".swf": "application/x-shockwave-flash",
  };
  return mimeMap[ext] || "application/octet-stream";
}

/**
 * Extract a SCORM ZIP and upload all files to R2.
 * Called fire-and-forget after upload completes.
 */
export async function extractAndUploadScorm(
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

    // 1. Stream download ZIP to disk (URL-encode path to handle spaces/special chars)
    const encodedUrl = (() => {
      try {
        const u = new URL(s3Url);
        u.pathname = u.pathname.split("/").map(encodeURIComponent).join("/");
        return u.toString();
      } catch { return s3Url; }
    })();
    await downloadToFile(encodedUrl, zipPath);
    console.log(`[ScormExtractor] Downloaded ZIP to ${zipPath}`);

    // 2. Extract using unzipper.Open.file — pure Node.js, no system binary required.
    // Uses the Open API (not Extract stream) which correctly handles filenames with spaces.
    const directory = await unzipper.Open.file(zipPath);
    for (const entry of directory.files) {
      if (entry.type === "File") {
        const destPath = path.join(workDir, entry.path);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        const content = await entry.buffer();
        fs.writeFileSync(destPath, content);
      }
    }
    console.log(`[ScormExtractor] Extracted to ${workDir}`);

    // Clean up ZIP file to save /tmp space
    try { fs.unlinkSync(zipPath); } catch {}

    // 3. Find launch file
    const manifestPath = path.join(workDir, "imsmanifest.xml");
    let launchFile = "index.html";
    if (fs.existsSync(manifestPath)) {
      const manifestXml = fs.readFileSync(manifestPath, "utf8");
      launchFile = findScormLaunchFile(manifestXml);
    } else {
      // Search for index.html
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

    // 4. Upload all extracted files to R2
    const allFiles = collectFiles(workDir);
    console.log(`[ScormExtractor] Uploading ${allFiles.length} files to R2 under ${prefix}/`);

    // Upload in batches of 10 to avoid overwhelming the API
    const BATCH_SIZE = 10;
    let uploaded = 0;
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (relPath) => {
          const fullPath = path.join(workDir, relPath);
          const fileBuffer = fs.readFileSync(fullPath);
          const mime = guessMime(relPath);
          const key = `${prefix}/${relPath}`;
          await storagePut(key, fileBuffer, mime);
          uploaded++;
        })
      );
      if (uploaded % 50 === 0 || uploaded === allFiles.length) {
        console.log(`[ScormExtractor] Uploaded ${uploaded}/${allFiles.length} files`);
      }
    }

    // 5. Update the mediaVersions row
    const db = await getDb();
    if (db) {
      await db
        .update(mediaVersions)
        .set({
          scormExtractedPrefix: prefix,
          scormLaunchFile: launchFile,
        })
        .where(eq(mediaVersions.id, versionId));
      console.log(`[ScormExtractor] Updated version ${versionId}: prefix=${prefix}, launch=${launchFile}`);
    }

    // 6. Clean up work directory
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}

    console.log(`[ScormExtractor] Done! ${allFiles.length} files uploaded for slug=${slug}`);
  } catch (err: any) {
    console.error(`[ScormExtractor] Failed for version ${versionId}:`, err.message);
    // Clean up
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(zipPath); } catch {}
  }
}
