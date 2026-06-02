/**
 * Shared SCORM / LMS package detection and manifest parsing.
 * Use everywhere we decide whether to extract, queue, or serve via /scorm/.
 */

/** Media types that require ZIP → R2 extraction before embed works reliably. */
export const SCORM_PACKAGE_MEDIA_TYPES = ["scorm", "zip", "lms"] as const;
export type ScormPackageMediaType = (typeof SCORM_PACKAGE_MEDIA_TYPES)[number];

export function isScormPackageMediaType(mediaType: string): mediaType is ScormPackageMediaType {
  return (SCORM_PACKAGE_MEDIA_TYPES as readonly string[]).includes(mediaType);
}

/** Whether this asset/version should go through SCORM extraction + /scorm/ serving. */
export function needsScormExtraction(params: {
  mediaType: string;
  mimeType?: string | null;
  fileName?: string | null;
  s3Url?: string | null;
}): boolean {
  if (isScormPackageMediaType(params.mediaType)) return true;
  const mime = (params.mimeType ?? "").toLowerCase();
  if (mime.includes("zip") || mime.includes("scorm")) return true;
  const name = (params.fileName ?? "").toLowerCase();
  if (name.endsWith(".zip")) return true;
  const url = (params.s3Url ?? "").toLowerCase().split("?")[0];
  if (url.endsWith(".zip")) return true;
  return false;
}

/** Initial extraction status for a new mediaVersions row. */
export function initialScormExtractionStatus(params: {
  mediaType: string;
  mimeType?: string | null;
  fileName?: string | null;
}): "pending" | "skipped" {
  return needsScormExtraction(params) ? "pending" : "skipped";
}

/** How long to show "Content Being Prepared" before trying on-the-fly extraction. */
export const SCORM_PENDING_WAIT_MS = 3 * 60 * 1000;
export const SCORM_PROCESSING_STALL_MS = 10 * 60 * 1000;

export function shouldShowScormWaitingPage(
  status: string | null | undefined,
  version: { scormExtractionStartedAt?: Date | null; createdAt?: Date | null }
): boolean {
  if (status !== "pending" && status !== "processing") return false;
  const now = Date.now();
  if (status === "processing") {
    const started = version.scormExtractionStartedAt?.getTime();
    if (!started) return false;
    return now - started < SCORM_PROCESSING_STALL_MS;
  }
  const since = (version.scormExtractionStartedAt ?? version.createdAt)?.getTime();
  if (!since) return true;
  return now - since < SCORM_PENDING_WAIT_MS;
}

/**
 * Parse imsmanifest.xml and return the SCO launch file path.
 * Supports adlcp:scormtype="sco" (Storyline, iSpring, etc.) and legacy type= attributes.
 */
export function findScormLaunchFile(manifestXml: string): string {
  const resourceBlocks = manifestXml.match(/<resource\b[^>]*>/gi) ?? [];
  for (const block of resourceBlocks) {
    const isSco =
      /(?:adlcp:)?scormtype=["']sco["']/i.test(block) ||
      /type=["'][^"']*sco[^"']*["']/i.test(block);
    const hrefMatch = block.match(/\bhref=["']([^"']+)["']/i);
    if (isSco && hrefMatch) return hrefMatch[1].split("?")[0];
  }
  for (const block of resourceBlocks) {
    const hrefMatch = block.match(/\bhref=["']([^"']+)["']/i);
    if (hrefMatch) return hrefMatch[1].split("?")[0];
  }
  return "index.html";
}

/** Queue background extraction (sets status=pending; heartbeat does the work). */
export async function queueScormExtractionIfNeeded(
  versionId: number,
  s3Url: string,
  slug: string,
  asset: { mediaType: string; mimeType?: string | null; fileName?: string | null }
): Promise<void> {
  if (!needsScormExtraction({ ...asset, s3Url })) return;
  const { extractAndUploadScorm } = await import("../routes/scormExtractor");
  await extractAndUploadScorm(versionId, s3Url, slug);
}
