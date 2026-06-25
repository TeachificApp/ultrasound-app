/**
 * Shared SCORM / LMS package detection and manifest parsing.
 * Use everywhere we decide whether to extract, queue, or serve via /scorm/.
 */

/** Media types that require ZIP → R2 extraction before embed works reliably. */
export const SCORM_PACKAGE_MEDIA_TYPES = ["scorm", "zip", "lms"] as const;
export type ScormPackageMediaType = (typeof SCORM_PACKAGE_MEDIA_TYPES)[number];

/**
 * File extensions that are ZIP archives containing SCORM (iSpring uses .quiz).
 * These must be treated like .zip for extraction and /scorm serving.
 */
export const SCORM_ARCHIVE_EXTENSIONS = [".zip", ".quiz"] as const;

/** True when a URL or filename uses a SCORM archive extension (.zip, .quiz, …). */
export function hasScormArchiveExtension(ref: string): boolean {
  const lower = ref.toLowerCase().split("?")[0];
  return SCORM_ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

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
  const name = params.fileName ?? "";
  if (hasScormArchiveExtension(name)) return true;
  const url = params.s3Url ?? "";
  if (hasScormArchiveExtension(url)) return true;
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

/** Packages larger than this must use the heartbeat R2 extractor — never sync extract on HTTP requests. */
export const SCORM_BACKGROUND_EXTRACT_BYTES = 50 * 1024 * 1024;

export function shouldUseBackgroundScormExtraction(params: {
  fileSize?: number | null;
  scormExtractionStatus?: string | null;
}): boolean {
  const size = params.fileSize ?? 0;
  if (size > SCORM_BACKGROUND_EXTRACT_BYTES) return true;
  const status = params.scormExtractionStatus ?? "pending";
  return status === "pending" || status === "processing" || status === "failed";
}

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


/** True when the stored file reference points at a ZIP archive (not extracted HTML). */
export function isZipStorageRef(params: {
  s3Url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  s3Key?: string | null;
}): boolean {
  const url = (params.s3Url ?? "").toLowerCase().split("?")[0];
  const name = (params.fileName ?? params.s3Key ?? "").toLowerCase();
  const mime = (params.mimeType ?? "").toLowerCase();
  if (hasScormArchiveExtension(url)) return true;
  if (hasScormArchiveExtension(name)) return true;
  if (mime.includes("zip") && !mime.includes("html")) return true;
  return false;
}

/** Encode storage/CDN URLs so paths with spaces and special chars fetch reliably. */
export function encodeStorageFetchUrl(rawUrl: string): string {
  try {
    const preEncoded = rawUrl.replace(/ /g, "%20");
    const parsed = new URL(preEncoded);
    parsed.pathname = parsed.pathname
      .split("/")
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/");
    return parsed.toString();
  } catch {
    return rawUrl.replace(/ /g, "%20");
  }
}

export type ScormPlaybackMode = "clientZip" | "server";

export type MediaVersionZipRef = {
  s3Url: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  s3Key?: string | null;
  versionNumber?: number;
  scormExtractedPrefix?: string | null;
  scormLaunchFile?: string | null;
  scormExtractionStatus?: string | null;
  scormExtractionError?: string | null;
  id?: number;
};

export type ScormServePlan =
  | { kind: "r2_extracted"; prefix: string; launchFile: string; versionId?: number }
  | { kind: "r2_zip_stream"; zipUrl: string; versionId?: number }
  | { kind: "direct_html"; url: string; launchFile: string; versionId?: number }
  | { kind: "client_zip"; zipUrl: string; versionId?: number }
  | { kind: "waiting"; status: "pending" | "processing" }
  | { kind: "failed"; error: string }
  | { kind: "missing" };

function launchFileFromUrl(url: string): string {
  const pathPart = url.split("?")[0];
  const last = pathPart.lastIndexOf("/");
  return last >= 0 ? pathPart.slice(last + 1) : "index.html";
}

/**
 * Ordered fallback plans for serving SCORM (newest versions first within each tier).
 * Callers should try each plan until one succeeds — never wipe DB state on a single miss.
 */
export function resolveScormServePlans(versions: MediaVersionZipRef[]): ScormServePlan[] {
  if (!versions.length) return [{ kind: "missing" }];

  const sorted = [...versions].sort((a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0));
  const latest = sorted[0];
  const plans: ScormServePlan[] = [];
  const seen = new Set<string>();

  const push = (plan: ScormServePlan) => {
    const key =
      plan.kind === "r2_extracted"
        ? `r2:${plan.prefix}:${plan.launchFile}`
        : plan.kind === "direct_html"
          ? `html:${plan.url}`
          : plan.kind === "client_zip"
            ? `zip:${plan.zipUrl}`
            : plan.kind;
    if (seen.has(key)) return;
    seen.add(key);
    plans.push(plan);
  };

  for (const v of sorted) {
    const prefix = v.scormExtractedPrefix;
    if (prefix && !prefix.startsWith("__direct_html__:")) {
      const st = v.scormExtractionStatus;
      if (st === "done" || st == null || st === "skipped") {
        push({
          kind: "r2_extracted",
          prefix,
          launchFile: v.scormLaunchFile || "index.html",
          versionId: v.id,
        });
      }
    }
  }

  for (const v of sorted) {
    if (v.scormExtractedPrefix?.startsWith("__direct_html__:")) {
      const url = v.scormExtractedPrefix.replace("__direct_html__:", "");
      push({
        kind: "direct_html",
        url,
        launchFile: v.scormLaunchFile || launchFileFromUrl(url),
        versionId: v.id,
      });
    } else if (isDirectHtmlScormVersion(v) && v.s3Url) {
      push({
        kind: "direct_html",
        url: v.s3Url,
        launchFile: v.scormLaunchFile || launchFileFromUrl(v.s3Url),
        versionId: v.id,
      });
    }
  }

  // r2_zip_stream: serve directly from the ZIP on R2 (no extraction needed).
  // Added for versions whose extraction is pending/failed/stuck — the ZIP itself
  // is already on R2 and can be served on-demand via HTTP Range requests.
  // This plan is added for ALL ZIP versions so it always acts as a fallback.
  for (const v of sorted) {
    if (isZipStorageRef(v) && v.s3Url) {
      push({ kind: "r2_zip_stream", zipUrl: v.s3Url, versionId: v.id });
    }
  }

  for (const v of sorted) {
    if (isZipStorageRef(v) && v.s3Url) {
      push({ kind: "client_zip", zipUrl: v.s3Url, versionId: v.id });
    }
  }

  if (shouldShowScormWaitingPage(latest.scormExtractionStatus, latest)) {
    push({ kind: "waiting", status: latest.scormExtractionStatus as "pending" | "processing" });
  } else if (latest.scormExtractionStatus === "failed") {
    push({ kind: "failed", error: latest.scormExtractionError || "Extraction failed" });
  }

  if (plans.length === 0) plans.push({ kind: "missing" });
  return plans;
}

/** Primary plan (first fallback). */
export function resolveScormServePlan(versions: MediaVersionZipRef[]): ScormServePlan {
  return resolveScormServePlans(versions)[0] ?? { kind: "missing" };
}

/**
 * Choose client-side ZIP extraction vs server /scorm/ serving.
 * Many legacy assets point the "current" version at extracted index.html — not the ZIP.
 */
export function pickScormPlaybackMode(
  current: MediaVersionZipRef,
  allVersions: MediaVersionZipRef[] = []
): { mode: ScormPlaybackMode; zipS3Url?: string } {
  const versions =
    allVersions.length > 0
      ? allVersions
      : [current];
  const plans = resolveScormServePlans(versions);

  // r2_zip_stream is the primary strategy — always use server mode when available.
  // This means the browser gets a plain iframe to /api/media/:slug/scorm and the
  // server streams individual files on-demand from the ZIP using Range requests.
  if (plans.some((p) => p.kind === "r2_zip_stream")) {
    return { mode: "server" };
  }

  const plan = plans[0] ?? { kind: "missing" };
  if (plan.kind === "client_zip") {
    return { mode: "clientZip", zipS3Url: plan.zipUrl };
  }
  if (plan.kind === "r2_extracted" || plan.kind === "direct_html") {
    return { mode: "server" };
  }
  if (isZipStorageRef(current) && current.s3Url) {
    return { mode: "clientZip", zipS3Url: current.s3Url };
  }
  if (current.s3Url && !isZipStorageRef(current)) {
    return { mode: "server" };
  }
  return { mode: "server" };
}


export function isDirectHtmlScormVersion(version: MediaVersionZipRef): boolean {
  if (!version.s3Url || isZipStorageRef(version)) return false;
  const url = version.s3Url.toLowerCase().split("?")[0];
  return url.endsWith(".html") || url.endsWith(".htm");
}

/** ZIP URL for server-side extraction, or null when content should be served as HTML/R2. */
export function resolveZipDownloadUrl(
  current: MediaVersionZipRef,
  allVersions: MediaVersionZipRef[] = []
): string | null {
  const strategy = pickScormPlaybackMode(current, allVersions);
  if (strategy.mode === "clientZip" && strategy.zipS3Url) return strategy.zipS3Url;
  return null;
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
