/**
 * SCORM package health classification for admin dashboard + alert cron.
 */
import {
  isDirectHtmlScormVersion,
  isZipStorageRef,
  needsScormExtraction,
  resolveScormServePlans,
  SCORM_PENDING_WAIT_MS,
  SCORM_PROCESSING_STALL_MS,
  type MediaVersionZipRef,
} from "./scormPackage";

export type ScormHealthStatus =
  | "healthy"
  | "preparing"
  | "unhealthy";

export type ScormHealthRow = {
  assetId: number;
  slug: string;
  title: string;
  mediaType: string;
  folder: string | null;
  versionId: number | null;
  versionNumber: number | null;
  extractionStatus: string | null;
  extractionError: string | null;
  health: ScormHealthStatus;
  healthDetail: string;
  adminUrl: string;
  reExtractUrl: string;
};

export function buildScormAdminUrls(assetId: number, baseUrl: string): { adminUrl: string; reExtractUrl: string } {
  const base = baseUrl.replace(/\/$/, "");
  const adminUrl = `${base}/admin/media-repository?assetId=${assetId}`;
  const reExtractUrl = `${base}/admin/media-repository?assetId=${assetId}&reExtract=1`;
  return { adminUrl, reExtractUrl };
}

export function classifyScormHealth(params: {
  mediaType: string;
  mimeType?: string | null;
  fileName?: string | null;
  s3Url?: string | null;
  versions: MediaVersionZipRef[];
  scormExtractionStartedAt?: Date | null;
  createdAt?: Date | null;
}): { health: ScormHealthStatus; detail: string } {
  const { mediaType, versions } = params;
  const latest = versions[0];
  if (!latest) {
    return { health: "unhealthy", detail: "No file version uploaded" };
  }

  const needsPackage = needsScormExtraction({
    mediaType,
    mimeType: latest.mimeType ?? params.mimeType,
    fileName: latest.fileName ?? params.fileName,
    s3Url: latest.s3Url ?? params.s3Url,
  });

  if (!needsPackage) {
    return { health: "healthy", detail: "Not a SCORM/ZIP package" };
  }

  const status = latest.scormExtractionStatus ?? "pending";
  const now = Date.now();

  if (status === "processing") {
    const started = latest.scormExtractionStartedAt?.getTime();
    if (started && now - started < SCORM_PROCESSING_STALL_MS) {
      return { health: "preparing", detail: "Extraction in progress" };
    }
    return { health: "unhealthy", detail: "Extraction stalled — re-extract recommended" };
  }

  if (status === "pending") {
    const since = (latest.scormExtractionStartedAt ?? params.createdAt)?.getTime();
    if (!since || now - since < SCORM_PENDING_WAIT_MS) {
      return { health: "preparing", detail: "Queued for extraction" };
    }
    return { health: "unhealthy", detail: "Extraction pending too long — re-extract or check heartbeat cron" };
  }

  if (status === "failed") {
    return {
      health: "unhealthy",
      detail: latest.scormExtractionError || "Extraction failed",
    };
  }

  const plans = resolveScormServePlans(versions);
  const primary = plans[0];
  if (primary?.kind === "missing") {
    const hasZip = versions.some((v) => isZipStorageRef(v) && v.s3Url);
    const hasHtml = versions.some((v) => isDirectHtmlScormVersion(v));
    if (!hasZip && !hasHtml) {
      return { health: "unhealthy", detail: "No ZIP or HTML source file found" };
    }
    return { health: "unhealthy", detail: "No playable SCORM source resolved" };
  }

  if (primary.kind === "waiting") {
    return { health: "preparing", detail: `Extraction ${primary.status}` };
  }

  if (primary.kind === "failed") {
    return { health: "unhealthy", detail: primary.error };
  }

  if (status === "done" || status === "skipped" || primary.kind === "direct_html" || primary.kind === "r2_extracted" || primary.kind === "client_zip") {
    return { health: "healthy", detail: "Ready to serve" };
  }

  return { health: "unhealthy", detail: `Unknown extraction status: ${status}` };
}

export type ScormHealthSnapshot = {
  unhealthyAssetIds: number[];
  /** Asset IDs included in the most recent alert email (for bulk re-extract). */
  lastAlertedAssetIds: number[];
  lastAlertAt: string | null;
};

export function parseScormHealthSnapshot(raw: string | null | undefined): ScormHealthSnapshot {
  if (!raw?.trim()) return { unhealthyAssetIds: [], lastAlertedAssetIds: [], lastAlertAt: null };
  try {
    const parsed = JSON.parse(raw) as Partial<ScormHealthSnapshot>;
    return {
      unhealthyAssetIds: Array.isArray(parsed.unhealthyAssetIds)
        ? parsed.unhealthyAssetIds.filter((n) => typeof n === "number")
        : [],
      lastAlertedAssetIds: Array.isArray(parsed.lastAlertedAssetIds)
        ? parsed.lastAlertedAssetIds.filter((n) => typeof n === "number")
        : [],
      lastAlertAt: typeof parsed.lastAlertAt === "string" ? parsed.lastAlertAt : null,
    };
  } catch {
    return { unhealthyAssetIds: [], lastAlertedAssetIds: [], lastAlertAt: null };
  }
}

export function newlyUnhealthyAssetIds(
  previous: ScormHealthSnapshot,
  currentUnhealthyIds: number[],
): number[] {
  const prev = new Set(previous.unhealthyAssetIds);
  return currentUnhealthyIds.filter((id) => !prev.has(id));
}
