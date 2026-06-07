/**
 * Email alerts when SCORM assets fall out of healthy status.
 */
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";
import { ENV } from "../_core/env";
import { mediaAssets, mediaVersions, platformSettings, users } from "../../drizzle/schema";
import {
  needsScormExtraction,
  resolveScormServePlans,
  SCORM_PACKAGE_MEDIA_TYPES,
} from "./scormPackage";
import { isR2ScormExtractionPlayable } from "./scormR2Probe";
import {
  buildScormAdminUrls,
  classifyScormHealth,
  newlyUnhealthyAssetIds,
  parseScormHealthSnapshot,
  type ScormHealthRow,
  type ScormHealthSnapshot,
} from "./scormHealth";
import { desc, inArray } from "drizzle-orm";

function appBaseUrl(): string {
  return (process.env.VITE_APP_URL || ENV.appUrl || "https://app.allaboutultrasound.com").replace(/\/$/, "");
}

export async function resolveScormAlertEmail(): Promise<string | null> {
  const override = process.env.SCORM_HEALTH_ALERT_EMAIL?.trim();
  if (override) return override;

  const db = await getDb();
  if (db) {
    const [settings] = await db
      .select({ email: platformSettings.scormHealthAlertEmail })
      .from(platformSettings)
      .where(eq(platformSettings.id, 1))
      .limit(1);
    if (settings?.email?.trim()) return settings.email.trim();
  }

  const ownerOpenId = process.env.OWNER_OPEN_ID?.trim();
  if (ownerOpenId && db) {
    const [owner] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.openId, ownerOpenId))
      .limit(1);
    if (owner?.email?.trim()) return owner.email.trim();
  }

  const fallback = process.env.SENDGRID_FROM_EMAIL?.trim();
  return fallback || null;
}

/** Load all SCORM/ZIP/LMS assets with health classification (DB-only, fast). */
export async function listScormHealthRows(): Promise<ScormHealthRow[]> {
  const db = await getDb();
  if (!db) return [];

  const baseUrl = appBaseUrl();
  const assets = await db
    .select({
      id: mediaAssets.id,
      slug: mediaAssets.slug,
      title: mediaAssets.title,
      mediaType: mediaAssets.mediaType,
      folder: mediaAssets.folder,
      mimeType: mediaAssets.mimeType,
    })
    .from(mediaAssets)
    .where(
      and(
        isNull(mediaAssets.deletedAt),
        inArray(mediaAssets.mediaType, [...SCORM_PACKAGE_MEDIA_TYPES, "html"] as any),
      ),
    )
    .orderBy(mediaAssets.title);

  const rows: ScormHealthRow[] = [];

  for (const asset of assets) {
    const versions = await db
      .select({
        id: mediaVersions.id,
        s3Url: mediaVersions.s3Url,
        fileName: mediaVersions.fileName,
        mimeType: mediaVersions.mimeType,
        s3Key: mediaVersions.s3Key,
        versionNumber: mediaVersions.versionNumber,
        scormExtractedPrefix: mediaVersions.scormExtractedPrefix,
        scormLaunchFile: mediaVersions.scormLaunchFile,
        scormExtractionStatus: mediaVersions.scormExtractionStatus,
        scormExtractionError: mediaVersions.scormExtractionError,
        scormExtractionStartedAt: mediaVersions.scormExtractionStartedAt,
        createdAt: mediaVersions.createdAt,
      })
      .from(mediaVersions)
      .where(eq(mediaVersions.assetId, asset.id))
      .orderBy(desc(mediaVersions.versionNumber));

    let { health, detail } = classifyScormHealth({
      mediaType: asset.mediaType,
      mimeType: asset.mimeType,
      versions,
    });

    if (health === "healthy") {
      const primary = resolveScormServePlans(versions)[0];
      if (primary?.kind === "r2_extracted") {
        const probe = await isR2ScormExtractionPlayable(primary.prefix, primary.launchFile);
        if (!probe.playable) {
          health = "unhealthy";
          detail = probe.reason
            ? `${probe.reason} — embed will fail until re-extracted`
            : "R2 extraction incomplete — re-extract recommended";
        }
      }
    }

    const latest = versions[0];
    const urls = buildScormAdminUrls(asset.id, baseUrl);

    rows.push({
      assetId: asset.id,
      slug: asset.slug,
      title: asset.title,
      mediaType: asset.mediaType,
      folder: asset.folder,
      versionId: latest?.id ?? null,
      versionNumber: latest?.versionNumber ?? null,
      extractionStatus: latest?.scormExtractionStatus ?? null,
      extractionError: latest?.scormExtractionError ?? null,
      health,
      healthDetail: detail,
      adminUrl: urls.adminUrl,
      reExtractUrl: urls.reExtractUrl,
    });
  }

  return rows;
}

export async function loadScormHealthSnapshot(): Promise<ScormHealthSnapshot> {
  const db = await getDb();
  if (!db) return { unhealthyAssetIds: [], lastAlertAt: null };
  const [row] = await db
    .select({ snapshot: platformSettings.scormHealthSnapshot })
    .from(platformSettings)
    .where(eq(platformSettings.id, 1))
    .limit(1);
  return parseScormHealthSnapshot(row?.snapshot);
}

export async function saveScormHealthSnapshot(snapshot: ScormHealthSnapshot): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(platformSettings)
    .set({ scormHealthSnapshot: JSON.stringify(snapshot) })
    .where(eq(platformSettings.id, 1));
}

/** Queue heartbeat re-extraction for specific SCORM assets (latest version each). */
export async function queueScormReExtractionForAssets(
  assetIds: number[],
): Promise<{ queued: number; skipped: number }> {
  const db = await getDb();
  if (!db || assetIds.length === 0) return { queued: 0, skipped: 0 };

  let queued = 0;
  let skipped = 0;

  for (const assetId of assetIds) {
    const [version] = await db
      .select()
      .from(mediaVersions)
      .where(eq(mediaVersions.assetId, assetId))
      .orderBy(desc(mediaVersions.versionNumber))
      .limit(1);
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), isNull(mediaAssets.deletedAt)))
      .limit(1);

    if (!version || !asset) {
      skipped++;
      continue;
    }

    if (
      !needsScormExtraction({
        mediaType: asset.mediaType,
        mimeType: version.mimeType,
        fileName: version.fileName,
        s3Url: version.s3Url,
      })
    ) {
      skipped++;
      continue;
    }

    await db
      .update(mediaVersions)
      .set({
        scormExtractionStatus: "pending" as any,
        scormExtractionError: null,
        scormExtractionStartedAt: null,
        scormExtractedPrefix: null,
        scormLaunchFile: null,
      })
      .where(eq(mediaVersions.id, version.id));
    queued++;
  }

  if (queued > 0) {
    console.log(`[ScormHealth] Queued re-extraction for ${queued} asset(s)`);
  }

  return { queued, skipped };
}

export type ScormReExtractScope = "unhealthy" | "alerted";

/** Resolve asset IDs to re-extract for bulk health actions. */
export async function resolveScormReExtractAssetIds(
  scope: ScormReExtractScope,
): Promise<number[]> {
  const rows = await listScormHealthRows();
  const unhealthyIds = new Set(
    rows.filter((r) => r.health === "unhealthy").map((r) => r.assetId),
  );

  if (scope === "unhealthy") {
    return [...unhealthyIds];
  }

  const snapshot = await loadScormHealthSnapshot();
  return snapshot.lastAlertedAssetIds.filter((id) => unhealthyIds.has(id));
}

export async function getScormHealthMeta(): Promise<{
  lastAlertAt: string | null;
  lastAlertedAssetIds: number[];
  lastAlertedStillUnhealthy: number;
}> {
  const snapshot = await loadScormHealthSnapshot();
  const rows = await listScormHealthRows();
  const unhealthyIds = new Set(
    rows.filter((r) => r.health === "unhealthy").map((r) => r.assetId),
  );
  const lastAlertedStillUnhealthy = snapshot.lastAlertedAssetIds.filter((id) =>
    unhealthyIds.has(id),
  ).length;

  return {
    lastAlertAt: snapshot.lastAlertAt,
    lastAlertedAssetIds: snapshot.lastAlertedAssetIds,
    lastAlertedStillUnhealthy,
  };
}

function buildAlertEmailHtml(items: ScormHealthRow[]): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;vertical-align:top;">
          <strong>${escapeHtml(item.title)}</strong><br/>
          <span style="font-size:12px;color:#6b7280;font-family:monospace;">${escapeHtml(item.slug)}</span>
        </td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#991b1b;vertical-align:top;">
          ${escapeHtml(item.healthDetail)}
        </td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;vertical-align:top;white-space:nowrap;">
          <a href="${item.reExtractUrl}" style="display:inline-block;background:#179ca3;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
            Re-extract
          </a>
          <br/>
          <a href="${item.adminUrl}" style="font-size:12px;color:#179ca3;margin-top:8px;display:inline-block;">View in Media Repository</a>
        </td>
      </tr>`,
    )
    .join("");

  return `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1f2937;">
      <h2 style="color:#b91c1c;margin:0 0 8px;">SCORM health alert</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">
        ${items.length} SCORM package${items.length === 1 ? "" : "s"} ${items.length === 1 ? "is" : "are"} no longer in good health.
        Use the <strong>Re-extract</strong> link for each file to open it in the Media Repository and queue a fresh extraction.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Asset</th>
            <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Issue</th>
            <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px;">
        <a href="${appBaseUrl()}/admin/media-repository?scormHealth=1&amp;reExtractAlerted=1" style="display:inline-block;background:#1f2937;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
          Re-extract all alerted packages
        </a>
      </p>
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">
        Or open Media Repository → SCORM Health for the full panel and per-file actions.
      </p>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Evaluate health, email on newly unhealthy assets, persist snapshot.
 * Returns summary for cron JSON response.
 */
export async function runScormHealthAlertPass(): Promise<{
  total: number;
  healthy: number;
  preparing: number;
  unhealthy: number;
  newlyUnhealthy: number;
  emailed: boolean;
  emailError?: string;
}> {
  const rows = await listScormHealthRows();
  const unhealthyRows = rows.filter((r) => r.health === "unhealthy");
  const currentIds = unhealthyRows.map((r) => r.assetId);

  const previous = await loadScormHealthSnapshot();
  const newIds = newlyUnhealthyAssetIds(previous, currentIds);
  const toEmail = unhealthyRows.filter((r) => newIds.includes(r.assetId));

  let emailed = false;
  let emailError: string | undefined;

  if (toEmail.length > 0) {
    const alertEmail = await resolveScormAlertEmail();
    if (!alertEmail) {
      emailError = "No alert email configured (set SCORM_HEALTH_ALERT_EMAIL or platform owner email)";
      console.warn(`[ScormHealthAlert] ${emailError}`);
    } else {
      try {
        await sendEmail({
          to: { name: "Platform Admin", email: alertEmail },
          subject: `[UltrasoundAssist] SCORM health alert — ${toEmail.length} package${toEmail.length === 1 ? "" : "s"} need attention`,
          htmlBody: buildAlertEmailHtml(toEmail),
          brandMode: "aaus",
        });
        emailed = true;
        console.log(`[ScormHealthAlert] Sent alert to ${alertEmail} for ${toEmail.length} asset(s)`);
      } catch (err: any) {
        emailError = err?.message ?? "Failed to send email";
        console.error(`[ScormHealthAlert] Email failed:`, err);
      }
    }
  }

  await saveScormHealthSnapshot({
    unhealthyAssetIds: currentIds,
    lastAlertedAssetIds: emailed
      ? toEmail.map((r) => r.assetId)
      : previous.lastAlertedAssetIds,
    lastAlertAt: emailed ? new Date().toISOString() : previous.lastAlertAt,
  });

  return {
    total: rows.length,
    healthy: rows.filter((r) => r.health === "healthy").length,
    preparing: rows.filter((r) => r.health === "preparing").length,
    unhealthy: unhealthyRows.length,
    newlyUnhealthy: newIds.length,
    emailed,
    emailError,
  };
}
