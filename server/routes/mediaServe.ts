/**
 * Media Repository — Public Serve & Embed Routes
 *
 * These routes are intentionally COOKIELESS so they work when embedded
 * in iframes on third-party sites (third-party cookies are blocked by
 * Chrome, Safari, Firefox, and Brave by default).
 *
 * Access control is enforced via a URL query parameter `?token=<grant_token>`.
 * Public assets require no token. Private assets require a valid, non-revoked,
 * non-expired grant token that was issued by a platform admin.
 *
 * Routes:
 *   GET /media/:slug              — serve content inline (or embed viewer for HTML/SCORM/ZIP)
 *   GET /media/:slug/embed        — serve a responsive HTML embed viewer page
 *   GET /media/:slug/download     — force file download (Content-Disposition: attachment)
 *   GET /media/:slug/info         — JSON metadata (for iframe postMessage usage)
 *   GET /media/:slug/scorm-launch — extract SCORM ZIP and serve the launch HTML file
 *   GET /media/:slug/scorm-files/* — serve extracted SCORM asset files (JS, CSS, images, etc.)
 */

import { Router, Request, Response } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { createHash } from "crypto";
import https from "https";
import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import AdmZip from "adm-zip";
import {
  mediaAssets,
  mediaVersions,
  mediaAccessGrants,
  mediaViewEvents,
} from "../../drizzle/schema";

const router = Router();

// ─── Shared access check ──────────────────────────────────────────────────────

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + "media-repo-salt").digest("hex").slice(0, 16);
}

async function recordView(
  assetId: number,
  viewType: "embed" | "direct",
  req: Request,
  grantId?: number,
  viewerEmail?: string
) {
  try {
    const db = await getDb();
    if (!db) return;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "";
    const referer = (req.headers["referer"] as string) || null;
    await db.insert(mediaViewEvents).values({
      assetId,
      grantId: grantId ?? null,
      viewerEmail: viewerEmail ?? null,
      referer,
      ipHash: hashIp(ip),
      viewType,
    });
  } catch {
    // fire-and-forget, never block the response
  }
}

async function resolveMedia(slug: string, token?: string) {
  const db = await getDb();
  if (!db) return null;

  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.slug, slug), isNull(mediaAssets.deletedAt)))
    .limit(1);
  if (!asset) return null;

  // Get current version (highest versionNumber)
  const [version] = await db
    .select()
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, asset.id))
    .orderBy(desc(mediaVersions.versionNumber))
    .limit(1);

  if (asset.access === "public") {
    return { asset, version: version ?? null, allowed: true };
  }

  // Private: token required
  if (!token) return { asset, version: null, allowed: false };

  const [grant] = await db
    .select()
    .from(mediaAccessGrants)
    .where(
      and(
        eq(mediaAccessGrants.assetId, asset.id),
        eq(mediaAccessGrants.token, token),
        isNull(mediaAccessGrants.revokedAt)
      )
    )
    .limit(1);

  if (!grant) return { asset, version: null, allowed: false };
  if (grant.expiresAt && grant.expiresAt < new Date()) {
    return { asset, version: null, allowed: false };
  }

  // Record first use (fire-and-forget)
  if (!grant.firstUsedAt) {
    db.update(mediaAccessGrants)
      .set({ firstUsedAt: new Date() })
      .where(eq(mediaAccessGrants.id, grant.id))
      .catch(() => {});
  }

  return { asset, version: version ?? null, allowed: true };
}

// ─── CORS headers for embed use ───────────────────────────────────────────────

function setCorsHeaders(res: Response) {
  // Allow any origin to load this resource in an iframe
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Allow embedding in iframes from any origin
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
}

// ─── SCORM ZIP extraction helpers ────────────────────────────────────────────
// Extracted SCORM packages are cached in /tmp/scorm-cache/<slug>/ so we only
// download and unzip once per server process lifetime.

const SCORM_CACHE_DIR = path.join(os.tmpdir(), "scorm-cache");

/**
 * Download a remote URL to a Buffer.
 */
function downloadToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/**
 * Parse imsmanifest.xml to find the SCO launch file (href of the first <resource>
 * with type containing "sco"). Falls back to the first resource href, then index.html.
 */
function findScormLaunchFile(manifestXml: string): string {
  // Try SCO resource first
  const scoMatch =
    manifestXml.match(/<resource[^>]+type=['"'][^'"]*sco[^'"]*['"'][^>]*href=['"']([^'"]+)['"']/i) ||
    manifestXml.match(/<resource[^>]+href=['"']([^'"]+)['"'][^>]*type=['"'][^'"]*sco[^'"]*['"']/i);
  if (scoMatch) return scoMatch[1].split("?")[0];

  // Fallback: first resource with any href
  const anyMatch = manifestXml.match(/<resource[^>]+href=['"']([^'"]+)['"']/i);
  if (anyMatch) return anyMatch[1].split("?")[0];

  return "index.html";
}

/**
 * Extract a SCORM ZIP to the cache directory and return the launch file path.
 * Returns null if extraction fails.
 */
async function extractScormZip(
  slug: string,
  zipUrl: string
): Promise<{ launchFile: string; cacheDir: string } | null> {
  // Use a hash of the URL as part of the cache key so re-uploads always get fresh extraction
  const urlHash = require("crypto").createHash("md5").update(zipUrl).digest("hex").slice(0, 8);
  const cacheDir = path.join(SCORM_CACHE_DIR, `${slug}-${urlHash}`);
  const launchMarker = path.join(cacheDir, ".launch");

  // Already extracted — return cached launch file
  if (fs.existsSync(launchMarker)) {
    const launchFile = fs.readFileSync(launchMarker, "utf8").trim();
    return { launchFile, cacheDir };
  }

  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const zipBuffer = await downloadToBuffer(zipUrl);
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(cacheDir, true);

    // Find launch file
    const manifestPath = path.join(cacheDir, "imsmanifest.xml");
    let launchFile = "index.html";
    if (fs.existsSync(manifestPath)) {
      const manifestXml = fs.readFileSync(manifestPath, "utf8");
      launchFile = findScormLaunchFile(manifestXml);
    } else {
      // Try to find any index.html in the extracted files
      const entries = zip.getEntries().map((e) => e.entryName);
      const indexEntry = entries.find((e) => e.toLowerCase().endsWith("index.html"));
      if (indexEntry) launchFile = indexEntry;
    }

    // Cache the launch file path
    fs.writeFileSync(launchMarker, launchFile, "utf8");
    return { launchFile, cacheDir };
  } catch (err) {
    console.error(`[SCORM] Failed to extract ZIP for slug=${slug}:`, err);
    // Clean up partial extraction
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    } catch {}
    return null;
  }
}

// ─── OPTIONS preflight handler for all /media routes ────────────────────────
// Required for cross-origin <img> and fetch() preflight requests
// Both /api/media/ and /media/ prefixes are supported (original stored URLs use /media/)
for (const prefix of ["/api/media", "/media"]) {
  router.options(`${prefix}/:slug`, (req: Request, res: Response) => {
    setCorsHeaders(res);
    res.status(204).end();
  });
  router.options(`${prefix}/:slug/embed`, (req: Request, res: Response) => {
    setCorsHeaders(res);
    res.status(204).end();
  });
  router.options(`${prefix}/:slug/info`, (req: Request, res: Response) => {
    setCorsHeaders(res);
    res.status(204).end();
  });
  router.options(`${prefix}/:slug/download`, (req: Request, res: Response) => {
    setCorsHeaders(res);
    res.status(204).end();
  });
  router.options(`${prefix}/:slug/scorm-launch`, (req: Request, res: Response) => {
    setCorsHeaders(res);
    res.status(204).end();
  });
  router.options(`${prefix}/:slug/scorm-files/*`, (req: Request, res: Response) => {
    setCorsHeaders(res);
    res.status(204).end();
  });
}

// ─── GET /media/:slug/scorm-launch — redirect to /scorm/ for backward compat ──
// The /scorm/* route below handles everything; this keeps old links working.
for (const slugPath of ["/api/media/:slug/scorm-launch", "/media/:slug/scorm-launch"]) {
  router.get(slugPath, (req: Request, res: Response) => {
    const token = (req.query.token as string) || undefined;
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    res.redirect(302, `/api/media/${req.params.slug}/scorm/${tokenParam}`);
  });
} // end for slugPath (scorm-launch redirect)

// ─── GET /media/:slug/scorm/* — unified SCORM content server ─────────────────
// Serves the SCORM launch file at /scorm/ and all assets at /scorm/path/to/asset.
// Because all content is under the same URL prefix, relative paths in the SCORM
// HTML resolve correctly without needing a <base> tag injection.
for (const slugPath of ["/api/media/:slug/scorm", "/media/:slug/scorm"]) {
  router.get([slugPath, `${slugPath}/*`], async (req: Request, res: Response) => {
    setCorsHeaders(res);
    const token = (req.query.token as string) || undefined;
    const result = await resolveMedia(req.params.slug, token);

    if (!result) { res.status(404).send(errorPage("Media not found.")); return; }
    if (!result.allowed) { res.status(403).send(errorPage("Access denied.")); return; }
    if (!result.version) { res.status(404).send(errorPage("No file available.")); return; }

    const { asset, version } = result;

    // Extract SCORM ZIP on first request; subsequent requests use the cache.
    const extracted = await extractScormZip(asset.slug, version.s3Url);
    if (!extracted) {
      res.status(500).send(errorPage("Failed to extract SCORM package."));
      return;
    }

    const { launchFile, cacheDir } = extracted;

    // Determine which file to serve:
    // - /scorm/  or  /scorm  → serve the launch file
    // - /scorm/path/to/asset → serve that asset relative to the cache root
    const prefix = slugPath.replace(":slug", req.params.slug);
    // Decode URI components since Express does NOT decode req.path for wildcard routes
    const rawRelative = req.path.replace(prefix, "").replace(/^\//, "");
    const relativePath = decodeURIComponent(rawRelative);

    // The launch file may be nested inside a sub-folder (e.g. 'CourseName/index.html').
    // Relative asset paths in the HTML resolve relative to /scorm/ (the iframe src),
    // so 'data/foo.js' resolves to /scorm/data/foo.js — but the actual file lives at
    // cacheDir/CourseName/data/foo.js.  We try the direct path first, then fall back
    // to looking inside the launch file's parent directory.
    const launchDir = path.dirname(launchFile); // e.g. 'CourseName'
    let targetFile: string;
    let fullPath: string;
    if (relativePath === "") {
      // Root request → serve the launch file
      targetFile = launchFile;
      fullPath = path.join(cacheDir, launchFile);
    } else {
      // Try direct path first (works when ZIP extracts flat or path already includes folder)
      const directPath = path.join(cacheDir, relativePath);
      // Then try relative to the launch file's directory
      const launchRelPath = path.join(cacheDir, launchDir, relativePath);
      // Also try with 'data/' prefix relative to launchDir (iSpring quirk: player.js requests
      // 'images/foo.png' but file lives at 'data/images/foo.png' relative to launch dir)
      const launchDataRelPath = path.join(cacheDir, launchDir, "data", relativePath);
      const fileName = path.basename(relativePath);

      if (fs.existsSync(directPath)) {
        targetFile = relativePath;
        fullPath = directPath;
      } else if (launchDir !== "." && fs.existsSync(launchRelPath)) {
        targetFile = path.join(launchDir, relativePath);
        fullPath = launchRelPath;
      } else if (launchDir !== "." && fs.existsSync(launchDataRelPath)) {
        // iSpring fallback: file lives under data/ subdirectory
        targetFile = path.join(launchDir, "data", relativePath);
        fullPath = launchDataRelPath;
      } else {
        // Last resort: recursive search for the filename within the launch directory
        const searchRoot = launchDir !== "." ? path.join(cacheDir, launchDir) : cacheDir;
        let found: string | null = null;
        const search = (dir: string, depth: number): void => {
          if (found || depth > 5) return;
          try {
            for (const entry of fs.readdirSync(dir)) {
              const full = path.join(dir, entry);
              if (fs.statSync(full).isDirectory()) {
                search(full, depth + 1);
              } else if (entry === fileName) {
                found = full;
                return;
              }
            }
          } catch {}
        };
        search(searchRoot, 0);
        if (found && found.startsWith(cacheDir)) {
          targetFile = path.relative(cacheDir, found);
          fullPath = found;
        } else {
          targetFile = relativePath;
          fullPath = directPath; // will 404 below
        }
      }
    }

    // Security: prevent path traversal
    if (!fullPath.startsWith(cacheDir + path.sep) && fullPath !== path.join(cacheDir, launchFile)) {
      res.status(403).send("Forbidden");
      return;
    }

    if (!fs.existsSync(fullPath)) {
      res.status(404).send("File not found");
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(fullPath);
  });
} // end for slugPath (scorm)

// ─── GET /media/:slug — serve content inline (no forced download) ────────────

/**
 * Determine whether a media type should be served via the embed viewer page
 * (HTML wrapper with sandboxed iframe) rather than proxied directly.
 * This covers HTML, SCORM, LMS, and ZIP packages.
 */
function needsViewerPage(mediaType: string, mimeType: string): boolean {
  return (
    mediaType === "html" ||
    mediaType === "scorm" ||
    mediaType === "lms" ||
    mediaType === "zip" ||
    mimeType === "text/html" ||
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed"
  );
}

/**
 * Proxy a remote URL through our server so we can set Content-Disposition: inline
 * and the correct Content-Type, preventing the browser from forcing a download.
 */
function proxyInline(
  fileUrl: string,
  mimeType: string,
  fileName: string,
  res: Response
): void {
  const safeFileName = encodeURIComponent(fileName);
  res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Cache-Control", "public, max-age=3600");

  const protocol = fileUrl.startsWith("https") ? https : http;
  protocol
    .get(fileUrl, (upstream) => {
      // Forward content-length if available so the browser shows progress
      const cl = upstream.headers["content-length"];
      if (cl) res.setHeader("Content-Length", cl);
      res.status(upstream.statusCode ?? 200);
      upstream.pipe(res);
    })
    .on("error", () => {
      if (!res.headersSent) res.status(502).send("Failed to fetch media file.");
    });
}

// Serve on both /api/media/:slug (new) and /media/:slug (original stored URLs — never redirect)
for (const slugPath of ["/api/media/:slug", "/media/:slug"]) {
router.get(slugPath, async (req: Request, res: Response) => {
  setCorsHeaders(res);
  const token = (req.query.token as string) || undefined;
  const result = await resolveMedia(req.params.slug, token);

  if (!result) {
    res.status(404).send(errorPage("Media not found."));
    return;
  }
  if (!result.allowed) {
    res.status(403).send(errorPage("Access denied. A valid token is required."));
    return;
  }
  if (!result.version) {
    res.status(404).send(errorPage("No file version available."));
    return;
  }

  const { asset, version } = result;
  const mimeType = version.mimeType ?? asset.mimeType ?? "application/octet-stream";
  const mediaType = asset.mediaType;
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";

  // Record view event (fire-and-forget)
  recordView(asset.id, "direct", req);

  // For HTML, SCORM, LMS, and ZIP: render the full embed viewer page so the
  // content displays in a sandboxed iframe rather than downloading.
  if (needsViewerPage(mediaType, mimeType)) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(
      buildEmbedPage({
        slug: asset.slug,
        asset,
        version,
        fileUrl: version.s3Url,
        mimeType,
        mediaType,
        tokenParam,
      })
    );
    return;
  }

  // For all other types: proxy through our server with Content-Disposition: inline
  // so the browser renders the content (video, audio, image, PDF) instead of downloading.
  proxyInline(
    version.s3Url,
    mimeType,
    version.fileName ?? asset.title,
    res
  );
});
} // end for slugPath

// ─── GET /media/:slug/download — force file download (Content-Disposition: attachment) ───
// Serve on both /api/media/:slug/download and /media/:slug/download (original stored URLs)
for (const slugPath of ["/api/media/:slug/download", "/media/:slug/download"]) {
router.get(slugPath, async (req: Request, res: Response) => {
  setCorsHeaders(res);
  const token = (req.query.token as string) || undefined;
  const result = await resolveMedia(req.params.slug, token);

  if (!result) {
    res.status(404).send(errorPage("Media not found."));
    return;
  }
  if (!result.allowed) {
    res.status(403).send(errorPage("Access denied. A valid token is required."));
    return;
  }
  if (!result.version) {
    res.status(404).send(errorPage("No file version available."));
    return;
  }

  const { asset, version } = result;
  const mimeType = version.mimeType ?? asset.mimeType ?? "application/octet-stream";
  const fileName = version.fileName ?? asset.title;
  const safeFileName = encodeURIComponent(fileName);

  // Record view event (fire-and-forget)
  recordView(asset.id, "direct", req);

  // Proxy through our server with Content-Disposition: attachment to force download
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Cache-Control", "public, max-age=3600");

  const protocol = version.s3Url.startsWith("https") ? https : http;
  protocol
    .get(version.s3Url, (upstream) => {
      const cl = upstream.headers["content-length"];
      if (cl) res.setHeader("Content-Length", cl);
      res.status(upstream.statusCode ?? 200);
      upstream.pipe(res);
    })
    .on("error", () => {
      if (!res.headersSent) res.status(502).send("Failed to fetch media file.");
    });
});
} // end for slugPath (download)

// ─── GET /media/:slug/info — JSON metadata ────────────────────────────────────
// Serve on both /api/media/:slug/info and /media/:slug/info (original stored URLs)
for (const slugPath of ["/api/media/:slug/info", "/media/:slug/info"]) {
router.get(slugPath, async (req: Request, res: Response) => {
  setCorsHeaders(res);
  const token = (req.query.token as string) || undefined;
  const result = await resolveMedia(req.params.slug, token);

  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  if (!result.allowed) { res.status(403).json({ error: "Access denied" }); return; }

  res.json({
    id: result.asset.id,
    slug: result.asset.slug,
    title: result.asset.title,
    mediaType: result.asset.mediaType,
    mimeType: result.version?.mimeType ?? result.asset.mimeType,
    url: result.version?.s3Url ?? null,
    fileName: result.version?.fileName ?? null,
    fileSize: result.version?.fileSize ?? null,
    versionNumber: result.version?.versionNumber ?? null,
  });
});
} // end for slugPath (info)

// ─── GET /media/:slug/embed — responsive HTML embed viewer ───────────────────
// Serve on both /api/media/:slug/embed and /media/:slug/embed (original stored URLs)
for (const slugPath of ["/api/media/:slug/embed", "/media/:slug/embed"]) {
router.get(slugPath, async (req: Request, res: Response) => {
  setCorsHeaders(res);
  const token = (req.query.token as string) || undefined;
  const result = await resolveMedia(req.params.slug, token);

  if (!result) { res.status(404).send(errorPage("Media not found")); return; }
  if (!result.allowed) { res.status(403).send(errorPage("Access denied — a valid access token is required to view this content.")); return; }
  if (!result.version) { res.status(404).send(errorPage("No file available for this media asset.")); return; }

  const { asset, version } = result;
  const fileUrl = version.s3Url;
  const mimeType = version.mimeType ?? asset.mimeType ?? "application/octet-stream";
  const mediaType = asset.mediaType;
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";

  // Record view event (fire-and-forget)
  recordView(asset.id, "embed", req);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(buildEmbedPage({ slug: asset.slug, asset, version, fileUrl, mimeType, mediaType, tokenParam }));
});
} // end for slugPath (embed)

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Media Unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; background: #f9fafb; color: #374151; }
    .box { text-align: center; padding: 32px; max-width: 400px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { margin: 0 0 8px; font-size: 18px; color: #111827; }
    p { margin: 0; font-size: 14px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">🔒</div>
    <h2>Content Unavailable</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

interface EmbedPageOptions {
  slug: string;
  asset: { title: string; description?: string | null; mediaType: string };
  version: { fileName?: string | null; fileSize?: number | null };
  fileUrl: string;
  mimeType: string;
  mediaType: string;
  tokenParam: string;
}

// Mobile "Desktop Site" banner for SCORM/HTML content.
// Shown at the TOP of the screen so it doesn't cover navigation controls at the bottom.
// Dismissed by clicking the × button. Detection script is injected at page bottom.
const mobileBanner = `
  <div id="mobile-banner" style="
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: #1e3a5f;
    color: #fff;
    padding: 10px 40px 10px 16px;
    font-size: 13px;
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.4;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  ">
    <strong>&#x1F4F1; Mobile tip:</strong> For the best experience, enable <strong>Desktop Site</strong> mode in your browser settings.
    <button onclick="document.getElementById('mobile-banner').style.display='none';" style="
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      padding: 4px 6px;
      min-height: unset;
      min-width: unset;
    ">&times;</button>
  </div>`;

// Script that detects mobile and shows the banner — injected at page bottom
const mobileBannerScript = `
  <script>
    (function() {
      var ua = navigator.userAgent || '';
      var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
      var isAndroid = /Android/.test(ua);
      var isMobile = isIOS || isAndroid || window.innerWidth < 768;
      if (isMobile) {
        var banner = document.getElementById('mobile-banner');
        if (banner) banner.style.display = 'block';
      }
    })();
  <\/script>`;

function buildEmbedPage(opts: EmbedPageOptions): string {
  const { slug, asset, version, fileUrl, mimeType, mediaType, tokenParam } = opts;
  const fileName = version.fileName ?? "";
  const isZipFile = mediaType === "scorm" || mediaType === "lms" || mediaType === "zip" ||
    mimeType === "application/zip" || mimeType === "application/x-zip-compressed" ||
    mimeType === "application/x-zip" ||
    fileName.toLowerCase().endsWith(".zip") ||
    fileUrl.toLowerCase().includes(".zip");

  let contentHtml = "";
  let needsMobileBanner = false;

  if (mediaType === "video" || mimeType.startsWith("video/")) {
    contentHtml = `
      <video controls playsinline style="width:100%;max-height:100%;background:#000;display:block;">
        <source src="${escHtml(fileUrl)}" type="${escHtml(mimeType)}">
        Your browser does not support the video tag.
      </video>`;
  } else if (mediaType === "audio" || mimeType.startsWith("audio/")) {
    contentHtml = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;">
        <audio controls style="width:100%;max-width:600px;">
          <source src="${escHtml(fileUrl)}" type="${escHtml(mimeType)}">
          Your browser does not support the audio tag.
        </audio>
      </div>`;
  } else if (mediaType === "image" || mimeType.startsWith("image/")) {
    contentHtml = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:8px;">
        <img src="${escHtml(fileUrl)}" alt="${escHtml(asset.title)}"
             style="max-width:100%;max-height:100%;object-fit:contain;display:block;" />
      </div>`;
  } else if (mediaType === "document" && mimeType === "application/pdf") {
    // Mobile browsers (iOS Safari, Android WebView) cannot render PDFs in iframes.
    // We use a JS-detected approach: show the iframe on desktop, and a friendly
    // open/download panel on mobile. A persistent download button is always shown.
    contentHtml = `
      <div id="pdf-container" style="width:100%;height:100%;position:relative;">
        <!-- Desktop: native PDF iframe -->
        <iframe id="pdf-frame" src="${escHtml(fileUrl)}" style="width:100%;height:100%;border:none;display:block;"
                title="${escHtml(asset.title)}"></iframe>
        <!-- Mobile fallback overlay (hidden by default, shown via JS) -->
        <div id="pdf-mobile" style="display:none;flex-direction:column;align-items:center;justify-content:center;
             height:100%;gap:20px;padding:clamp(20px,6vw,48px);background:#fff;text-align:center;">
          <div style="font-size:56px;">📄</div>
          <div>
            <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 6px;">${escHtml(asset.title)}</p>
            <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">PDF Document</p>
          </div>
          <div class="action-group">
            <a href="${escHtml(fileUrl)}" target="_blank" rel="noopener" class="action-btn action-btn-primary">
              &#x1F4C4; Open PDF
            </a>
            <a href="${escHtml(fileUrl)}" download class="action-btn action-btn-secondary">
              &#x2B07; Download
            </a>
          </div>
          <p style="font-size:12px;color:#9ca3af;max-width:320px;margin:0;">
            Tap &ldquo;Open PDF&rdquo; to view in your browser&rsquo;s PDF reader.
          </p>
        </div>
      </div>
      <script>
        (function() {
          var ua = navigator.userAgent || '';
          var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
          var isAndroid = /Android/.test(ua);
          var isMobile = isIOS || isAndroid || window.innerWidth < 768;
          if (isMobile) {
            var frame = document.getElementById('pdf-frame');
            var mobile = document.getElementById('pdf-mobile');
            if (frame) frame.style.display = 'none';
            if (mobile) mobile.style.display = 'flex';
          }
        })();
      </script>`;
  } else if (mediaType === "html" || mimeType === "text/html") {
    needsMobileBanner = true;
    // Serve HTML content in an iframe WITHOUT sandbox — sandbox with allow-same-origin
    // blocks cross-origin content (e.g. CloudFront CDN assets) even with allow-same-origin.
    // Cross-origin iframes already can't navigate the parent by default, so sandbox is
    // not needed for security here.
    contentHtml = `
      ${mobileBanner}
      <iframe src="${escHtml(fileUrl)}" style="width:100%;height:100%;border:none;"
              allow="autoplay; fullscreen"
              title="${escHtml(asset.title)}"></iframe>`;
  } else if (isZipFile) {
    needsMobileBanner = true;
    // SCORM/LMS/ZIP content: always render in an iframe via the scorm-launch route.
    // The server extracts the ZIP, parses imsmanifest.xml, and serves the HTML entry point.
    const iframeSrc = `/api/media/${escHtml(slug)}/scorm/${escHtml(tokenParam)}`;
    contentHtml = `
      ${mobileBanner}
      <iframe src="${iframeSrc}" style="width:100%;height:100%;border:none;"
              allow="autoplay; fullscreen"
              title="${escHtml(asset.title)}"></iframe>`;
  } else {
    // Generic fallback: open-in-new-tab + download
    contentHtml = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:32px;background:#f9fafb;">
        <div style="font-size:48px;">📄</div>
        <p style="font-size:16px;font-weight:600;color:#111827;margin:0;">${escHtml(asset.title)}</p>
        <div class="action-group">
          <a href="${escHtml(fileUrl)}" target="_blank" rel="noopener" class="action-btn action-btn-primary">
            Open File
          </a>
          <a href="${escHtml(fileUrl)}" download class="action-btn action-btn-secondary">
            Download
          </a>
        </div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>${escHtml(asset.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
                 font-family: system-ui, -apple-system, sans-serif; background: #000;
                 -webkit-text-size-adjust: 100%; }
    .embed-wrapper { width: 100%; height: 100%; display: flex; flex-direction: column; }
    .embed-content { flex: 1; overflow: hidden; position: relative; }
    .embed-content > * { position: absolute; inset: 0; }
    /* Audio gets a light background */
    .embed-content.audio-bg { background: #f9fafb; }
    .embed-content.image-bg { background: #111; }
    .embed-content.doc-bg { background: #fff; }
    .embed-content.download-bg { background: #f9fafb; }
    /* Mobile-friendly touch targets */
    a, button { min-height: 44px; min-width: 44px; }
    /* Responsive action buttons */
    .action-btn {
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .action-btn-primary { background: #189aa1; color: #fff; border: none; }
    .action-btn-secondary { background: #fff; color: #374151; border: 1px solid #d1d5db; }
    .action-group { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
    @media (max-width: 480px) {
      .action-btn { width: 100%; justify-content: center; font-size: 14px; }
      .action-group { flex-direction: column; align-items: stretch; width: 100%; max-width: 320px; }
    }
  </style>
</head>
<body>
  <div class="embed-wrapper">
    <div class="embed-content ${getBgClass(mediaType, mimeType)}">
      ${contentHtml}
    </div>
  </div>
  <script>
    // Notify parent frame of ready state (for postMessage integrations)
    window.addEventListener('load', function() {
      try {
        window.parent.postMessage({ type: 'media-embed-ready', slug: '${escHtml(slug)}' }, '*');
      } catch(e) {}
    });
  </script>
  ${needsMobileBanner ? mobileBannerScript : ""}
</body>
</html>`;
}

function getBgClass(mediaType: string, mimeType: string): string {
  if (mediaType === "audio" || mimeType.startsWith("audio/")) return "audio-bg";
  if (mediaType === "image" || mimeType.startsWith("image/")) return "image-bg";
  if (mediaType === "document" || mimeType === "application/pdf") return "doc-bg";
  if (mediaType === "zip" || mediaType === "other") return "download-bg";
  return "";
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function registerMediaServeRoutes(app: import("express").Application) {
  app.use(router);
}
