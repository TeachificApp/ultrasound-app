/**
 * Bulk SCORM Re-Extraction Script
 * 
 * Finds all mediaVersions rows where scormExtractedPrefix is NULL
 * and runs extractAndUploadScorm() for each one.
 * 
 * Run with: node scripts/bulk-extract-scorm.mjs
 * 
 * Safe to re-run — already-extracted files are skipped.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Inline helpers (avoid tsx import issues) ─────────────────────────────────

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const follow = (targetUrl, redirects = 0) => {
      if (redirects > 5) { reject(new Error('Too many redirects')); return; }
      const proto = targetUrl.startsWith('https') ? https : http;
      proto.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode >= 400) {
          reject(new Error(`Download failed: HTTP ${res.statusCode} for ${targetUrl}`));
          return;
        }
        const ws = fs.createWriteStream(destPath);
        res.pipe(ws);
        ws.on('finish', resolve);
        ws.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

function findScormLaunchFile(manifestXml) {
  const scoMatch =
    manifestXml.match(/<resource[^>]+type=['"][^'"]*sco[^'"]*['"][^>]*href=['"]([^'"]+)['"]/i) ||
    manifestXml.match(/<resource[^>]+href=['"]([^'"]+)['"][^>]*type=['"][^'"]*sco[^'"]*['"]/i);
  if (scoMatch) return scoMatch[1].split('?')[0];
  const anyMatch = manifestXml.match(/<resource[^>]+href=['"]([^'"]+)['"]/i);
  if (anyMatch) return anyMatch[1].split('?')[0];
  return 'index.html';
}

function collectFiles(dir, base = dir) {
  const results = [];
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

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css',
    '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.json': 'application/json', '.xml': 'application/xml',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
    '.webm': 'video/webm', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject', '.pdf': 'application/pdf',
    '.swf': 'application/x-shockwave-flash',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

// ─── R2 Upload (using S3 API) ──────────────────────────────────────────────────

// Create S3 client once
const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
  },
  maxAttempts: 5,
});

async function storagePut(key, buffer, contentType, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.CF_R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = attempt * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ─── Main extraction function ──────────────────────────────────────────────────

const SCORM_EXTRACT_DIR = path.join(os.tmpdir(), 'scorm-bulk-extract');

async function extractAndUpload(conn, versionId, s3Url, slug) {
  // Use the same URL hash as the main extractor for consistency
  const urlHash = createHash('md5').update(s3Url).digest('hex').slice(0, 8);
  const prefix = `scorm-extracted/${slug}-${urlHash}`;
  const workDir = path.join(SCORM_EXTRACT_DIR, `${slug}-${urlHash}`);
  const zipPath = `${workDir}.zip`;

  console.log(`  [${versionId}] Downloading ${(s3Url.length > 80 ? s3Url.slice(0,80)+'...' : s3Url)}`);

  try {
    fs.mkdirSync(SCORM_EXTRACT_DIR, { recursive: true });
    fs.mkdirSync(workDir, { recursive: true });

    await downloadToFile(s3Url, zipPath);
    const zipSizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    console.log(`  [${versionId}] Downloaded ${zipSizeMB}MB, extracting...`);

    // Extract using unzipper
    const unzipper = require('unzipper');
    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: workDir }))
        .on('close', resolve)
        .on('error', reject);
    });
    try { fs.unlinkSync(zipPath); } catch {}
    console.log(`  [${versionId}] Extracted OK`);

    // Find launch file
    const manifestPath = path.join(workDir, 'imsmanifest.xml');
    let launchFile = 'index.html';
    if (fs.existsSync(manifestPath)) {
      const manifestXml = fs.readFileSync(manifestPath, 'utf8');
      launchFile = findScormLaunchFile(manifestXml);
    } else {
      const findIndex = (dir, depth) => {
        if (depth > 4) return null;
        try {
          for (const entry of fs.readdirSync(dir)) {
            const full = path.join(dir, entry);
            if (fs.statSync(full).isDirectory()) {
              const found = findIndex(full, depth + 1);
              if (found) return found;
            } else if (entry.toLowerCase() === 'index.html') {
              return path.relative(workDir, full);
            }
          }
        } catch {}
        return null;
      };
      const indexEntry = findIndex(workDir, 0);
      if (indexEntry) launchFile = indexEntry;
    }

    // Upload all files to R2 — sequential to avoid ECONNRESET on R2
    const allFiles = collectFiles(workDir);
    console.log(`  [${versionId}] Uploading ${allFiles.length} files to R2 prefix: ${prefix}/`);

    let uploaded = 0;
    for (const relPath of allFiles) {
      const fullPath = path.join(workDir, relPath);
      const fileBuffer = fs.readFileSync(fullPath);
      const mime = guessMime(relPath);
      const key = `${prefix}/${relPath}`;
      await storagePut(key, fileBuffer, mime);
      uploaded++;
      if (uploaded % 20 === 0 || uploaded === allFiles.length) {
        process.stdout.write(`  [${versionId}] Uploaded ${uploaded}/${allFiles.length}\r`);
      }
    }
    console.log(`  [${versionId}] Uploaded ${uploaded}/${allFiles.length} files   `);

    // Update DB
    await conn.execute(
      'UPDATE mediaVersions SET scormExtractedPrefix = ?, scormLaunchFile = ? WHERE id = ?',
      [prefix, launchFile, versionId]
    );
    console.log(`  [${versionId}] DB updated: prefix=${prefix}, launch=${launchFile}`);

    // Clean up
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
    return { ok: true, prefix, launchFile, filesCount: allFiles.length };
  } catch (err) {
    console.error(`  [${versionId}] FAILED: ${err.message}`);
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {}
    return { ok: false, error: err.message };
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all unextracted SCORM/ZIP versions (latest version per asset only)
const [rows] = await conn.execute(`
  SELECT mv.id as versionId, mv.s3Url, ma.slug, ma.title, mv.fileSize, mv.scormExtractedPrefix
  FROM mediaAssets ma
  JOIN mediaVersions mv ON mv.assetId = ma.id
  WHERE ma.mediaType IN ('scorm', 'zip')
    AND (mv.scormExtractedPrefix IS NULL OR mv.scormExtractedPrefix = '')
  ORDER BY mv.fileSize ASC
`);

// Deduplicate by slug (keep the one with the largest fileSize = most recent meaningful version)
const bySlug = new Map();
for (const row of rows) {
  const existing = bySlug.get(row.slug);
  if (!existing || (row.fileSize || 0) > (existing.fileSize || 0)) {
    bySlug.set(row.slug, row);
  }
}
const toProcess = Array.from(bySlug.values());

console.log(`Found ${rows.length} unextracted version rows across ${toProcess.length} unique slugs`);
console.log('Processing in order of file size (smallest first)...\n');

const results = { ok: 0, failed: 0, skipped: 0 };
const failures = [];

for (let i = 0; i < toProcess.length; i++) {
  const { versionId, s3Url, slug, title, fileSize } = toProcess[i];
  const mb = fileSize ? (fileSize / 1024 / 1024).toFixed(1) : '?';
  console.log(`\n[${i + 1}/${toProcess.length}] ${title} (${mb}MB) — versionId=${versionId}`);

  const result = await extractAndUpload(conn, versionId, s3Url, slug);
  if (result.ok) {
    results.ok++;
  } else {
    results.failed++;
    failures.push({ slug, title, error: result.error });
  }
}

await conn.end();

console.log('\n═══════════════════════════════════════════════');
console.log(`DONE: ${results.ok} extracted, ${results.failed} failed`);
if (failures.length > 0) {
  console.log('\nFailed files:');
  failures.forEach(f => console.log(` - ${f.slug}: ${f.error}`));
}
