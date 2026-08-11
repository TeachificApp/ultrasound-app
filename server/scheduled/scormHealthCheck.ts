/**
 * SCORM Health Check — runs every 5 minutes via Heartbeat cron.
 *
 * For every public SCORM asset, probes:
 *   1. GET /media/:slug/scorm/ → must return 200 HTML
 *   2. GET /media/:slug/scorm/data/browsersupport.js → must return 200 (if iSpring)
 *
 * On any failure, notifies the owner immediately.
 * Also requeues interrupted processing versions without abandoning pending work.
 */

import type { Request, Response } from "express";
import { getDb } from "../db";
import { mediaAssets, mediaVersions } from "../../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
const STALL_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes for large package extraction

// ─── Self-healing: fix stuck versions ────────────────────────────────────────

export async function healStuckScormVersions(): Promise<{ healed: number }> {
  const db = await getDb();
  if (!db) return { healed: 0 };

  const stallCutoff = new Date(Date.now() - STALL_THRESHOLD_MS);

  // Only processing versions can be interrupted. Pending is the durable queue and
  // must never be converted to skipped while it awaits the Always On worker.
  const stuck = await db
    .select({
      id: mediaVersions.id,
      s3Url: mediaVersions.s3Url,
      mimeType: mediaVersions.mimeType,
      fileName: mediaVersions.fileName,
      scormExtractionStatus: mediaVersions.scormExtractionStatus,
      createdAt: mediaVersions.createdAt,
      scormExtractionStartedAt: mediaVersions.scormExtractionStartedAt,
    })
    .from(mediaVersions)
    .where(
      and(
        eq(mediaVersions.scormExtractionStatus, "processing"),
        lt(mediaVersions.scormExtractionStartedAt, stallCutoff)
      )
    );

  let healed = 0;
  for (const v of stuck) {
    await db
      .update(mediaVersions)
      .set({
        scormExtractionStatus: "pending",
        scormExtractionStartedAt: null,
        scormExtractionError: "Extraction was requeued after an interrupted worker run",
      })
      .where(eq(mediaVersions.id, v.id));
    healed++;
    console.log(`[ScormHealthCheck] Requeued interrupted version ${v.id}`);
  }

  return { healed };
}

// ─── Health probe ─────────────────────────────────────────────────────────────

interface ProbeResult {
  slug: string;
  assetId: number;
  ok: boolean;
  statusCode?: number;
  error?: string;
  url: string;
}

async function probeScormAsset(slug: string, baseUrl: string, assetId: number): Promise<ProbeResult> {
  const url = `${baseUrl}/media/${slug}/scorm/`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "ScormHealthCheck/1.0" },
    });
    clearTimeout(timeout);

    if (res.status !== 200) {
      return { slug, assetId, ok: false, statusCode: res.status, url };
    }

    const body = await res.text();
    // Must contain HTML content (not a waiting/error page)
    if (!body.includes("<html") && !body.includes("<!DOCTYPE")) {
      return { slug, assetId, ok: false, error: "Response is not HTML", url };
    }
    // Must not be the waiting page
    if (body.includes("Content Being Prepared") || body.includes("being extracted")) {
      return { slug, assetId, ok: false, error: "Asset is showing waiting page", url };
    }

    return { slug, assetId, ok: true, statusCode: 200, url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { slug, assetId, ok: false, error: msg, url };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function scormHealthCheckHandler(req: Request, res: Response) {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "DB unavailable" });
    }

    // Step 1: Auto-heal stuck versions
    const { healed } = await healStuckScormVersions();

    // Step 2: Get all public SCORM assets
    const assets = await db
      .select({
        id: mediaAssets.id,
        slug: mediaAssets.slug,
        mediaType: mediaAssets.mediaType,
        isPublic: mediaAssets.isPublic,
      })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.isPublic, true),
          inArray(mediaAssets.mediaType, ["scorm", "zip", "lms"])
        )
      );

    if (!assets.length) {
      return res.json({ ok: true, healed, probed: 0, failures: [] });
    }

    // Step 3: Determine base URL for probing
    // Use the canonical domain in production, localhost in dev
    const baseUrl =
      process.env.CANONICAL_ROOT_DOMAIN
        ? `https://${process.env.CANONICAL_ROOT_DOMAIN}`
        : "http://localhost:3000";

    // Step 4: Probe each asset (sequentially to avoid hammering R2)
    const failures: ProbeResult[] = [];
    const results: ProbeResult[] = [];

    for (const asset of assets) {
      const result = await probeScormAsset(asset.slug, baseUrl, asset.id);
      results.push(result);
      if (!result.ok) {
        failures.push(result);
        console.error(
          `[ScormHealthCheck] FAIL: ${asset.slug} — ${result.error ?? `HTTP ${result.statusCode}`}`
        );
      } else {
        console.log(`[ScormHealthCheck] OK: ${asset.slug}`);
      }
    }

    // Step 5: Alert owner if any failures
    if (failures.length > 0) {
      const failureList = failures
        .map((f) => `• ${f.slug}: ${f.error ?? `HTTP ${f.statusCode}`}\n  URL: ${f.url}`)
        .join("\n");

      await notifyOwner({
        title: `⚠️ SCORM Health Check: ${failures.length} asset(s) failing`,
        content: `${failures.length} of ${assets.length} SCORM assets are not loading correctly.\n\n${failureList}\n\nAuto-healed ${healed} stuck version(s) this run.\n\nCheck the admin panel at /admin/media for details.`,
      });
    }

    return res.json({
      ok: failures.length === 0,
      healed,
      probed: assets.length,
      passed: results.filter((r) => r.ok).length,
      failures: failures.map((f) => ({ slug: f.slug, error: f.error, statusCode: f.statusCode })),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ScormHealthCheck] Unhandled error:", msg);
    return res.status(500).json({
      error: msg,
      stack: err instanceof Error ? err.stack : undefined,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
