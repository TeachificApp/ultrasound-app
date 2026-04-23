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
 *   GET /media/:slug              — redirect to the current S3 URL (or 403/404)
 *   GET /media/:slug/embed        — serve a responsive HTML embed viewer page
 *   GET /media/:slug/info         — JSON metadata (for iframe postMessage usage)
 */

import { Router, Request, Response } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { createHash } from "crypto";
import https from "https";
import http from "http";
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

router.get("/media/:slug", async (req: Request, res: Response) => {
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

// ─── GET /media/:slug/download — force file download (Content-Disposition: attachment) ───

router.get("/media/:slug/download", async (req: Request, res: Response) => {
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

// ─── GET /media/:slug/info — JSON metadata ────────────────────────────────────────────

router.get("/media/:slug/info", async (req: Request, res: Response) => {
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

// ─── GET /media/:slug/embed — responsive HTML embed viewer ───────────────────

router.get("/media/:slug/embed", async (req: Request, res: Response) => {
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
  res.send(buildEmbedPage({ asset, version, fileUrl, mimeType, mediaType, tokenParam }));
});

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
  asset: { title: string; description?: string | null; mediaType: string };
  version: { fileName?: string | null; fileSize?: number | null };
  fileUrl: string;
  mimeType: string;
  mediaType: string;
  tokenParam: string;
}

function buildEmbedPage(opts: EmbedPageOptions): string {
  const { asset, fileUrl, mimeType, mediaType } = opts;

  let contentHtml = "";

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
    contentHtml = `
      <iframe src="${escHtml(fileUrl)}" style="width:100%;height:100%;border:none;"
              title="${escHtml(asset.title)}"></iframe>`;
  } else if (mediaType === "html" || mimeType === "text/html") {
    // Serve HTML content in a sandboxed iframe
    contentHtml = `
      <iframe src="${escHtml(fileUrl)}" style="width:100%;height:100%;border:none;"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="${escHtml(asset.title)}"></iframe>`;
  } else if (mediaType === "scorm" || mediaType === "lms") {
    // SCORM/LMS ZIP package: show a launch page with an open-in-new-tab button
    // and a download option. The ZIP itself cannot be iframed directly — the LMS
    // host must extract and serve it. We provide the download link so the admin
    // can deploy it to their LMS, and an "Open" button for direct inspection.
    contentHtml = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:clamp(20px,5vw,40px);background:#f0fdf4;">
        <div style="font-size:56px;">🎓</div>
        <div style="text-align:center;">
          <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 6px;">${escHtml(asset.title)}</p>
          <p style="font-size:13px;color:#6b7280;margin:0;">SCORM / LMS Package</p>
        </div>
        <div class="action-group">
          <a href="${escHtml(fileUrl)}" target="_blank" rel="noopener" class="action-btn action-btn-primary">
            &#x1F517; Open Package
          </a>
          <a href="${escHtml(fileUrl)}" download class="action-btn action-btn-secondary">
            &#x2B07; Download ZIP
          </a>
        </div>
        <p style="font-size:12px;color:#9ca3af;text-align:center;max-width:400px;margin:0;">
          To run this SCORM package in your LMS, download the ZIP and upload it to your learning management system.
        </p>
      </div>`;
  } else if (mediaType === "zip") {
    // Generic ZIP: show a viewer page with open and download options
    contentHtml = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:clamp(20px,5vw,40px);background:#fafafa;">
        <div style="font-size:56px;">🗜️</div>
        <div style="text-align:center;">
          <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 6px;">${escHtml(asset.title)}</p>
          <p style="font-size:13px;color:#6b7280;margin:0;">ZIP Archive</p>
        </div>
        <div class="action-group">
          <a href="${escHtml(fileUrl)}" target="_blank" rel="noopener" class="action-btn action-btn-primary">
            &#x1F517; Open File
          </a>
          <a href="${escHtml(fileUrl)}" download class="action-btn action-btn-secondary">
            &#x2B07; Download
          </a>
        </div>
      </div>`;
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
        window.parent.postMessage({ type: 'media-embed-ready', slug: '${escHtml(opts.asset.title)}' }, '*');
      } catch(e) {}
    });
  </script>
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
