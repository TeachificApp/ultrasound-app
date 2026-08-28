/**
 * SCORM / ZIP packages must render in /scorm/ — never via /download (attachment).
 * Plain files (PDF, DOCX, etc.) keep using /download in File Download blocks.
 */

export const SCORM_PACKAGE_MEDIA_TYPES = new Set(["scorm", "zip", "lms"]);

/** Archive extensions used by iSpring and SCORM exporters (.html handouts are NOT included). */
const SCORM_ARCHIVE_EXTENSIONS = /\.(zip|quiz|scorm)$/i;

export function isInteractiveMediaPackage(
  mediaType?: string | null,
  fileName?: string | null,
): boolean {
  const type = (mediaType ?? "").toLowerCase();
  if (SCORM_PACKAGE_MEDIA_TYPES.has(type)) return true;
  return SCORM_ARCHIVE_EXTENSIONS.test(fileName ?? "");
}

export function mediaRepoScormUrl(slug: string): string {
  return `/api/media/${slug}/scorm/`;
}

export function mediaRepoDownloadUrl(slug: string): string {
  return `/api/media/${slug}/download`;
}

/** Extract media asset slug from any stored Manus/Railway media-repo URL. */
export function parseMediaRepoSlug(url: string): string | null {
  const pathOnly = url.split("?")[0] ?? url;
  const match = pathOnly.match(
    /\/(?:api\/)?media\/([^/]+)\/(?:embed|download|scorm|scorm-zip|scorm-launch)\/?$/,
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/** Resolve slug for SCORM / HTML Package (display) blocks from migrated block data. */
export function resolveScormEmbedSlug(data: Record<string, unknown>): string {
  const direct = data.mediaAssetSlug;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  for (const field of ["mediaAssetUrl", "embedUrl", "url", "fileUrl"]) {
    const val = data[field];
    if (typeof val === "string" && val.trim()) {
      const slug = parseMediaRepoSlug(val);
      if (slug) return slug;
    }
  }
  return "";
}

/** Viewer URL for SCORM; download URL for everything else. */
export function mediaRepoServeUrl(
  slug: string,
  mediaType?: string | null,
  fileName?: string | null,
): string {
  return isInteractiveMediaPackage(mediaType, fileName)
    ? mediaRepoScormUrl(slug)
    : mediaRepoDownloadUrl(slug);
}

export type LessonScormSource = {
  type?: string | null;
  embedUrl?: string | null;
  content?: string | null;
};

export type LinkedLessonMediaRef = {
  slug: string;
  mediaType?: string | null;
  fileName?: string | null;
} | null;

function isPlainDocumentAsset(
  mediaType?: string | null,
  fileName?: string | null,
): boolean {
  return (
    mediaType === "document" &&
    !!fileName &&
    !isInteractiveMediaPackage(mediaType, fileName)
  );
}

/**
 * Resolve the SCORM player URL for an LMS lesson that references the media repo.
 * Handles legacy rows imported as download lessons with /download content URLs.
 */
export function resolveLessonMediaScormUrl(
  lesson: LessonScormSource,
  linked: LinkedLessonMediaRef,
): string | null {
  const slug =
    linked?.slug ??
    (lesson.embedUrl ? parseMediaRepoSlug(lesson.embedUrl) : null) ??
    (lesson.content ? parseMediaRepoSlug(lesson.content) : null);

  if (!slug) return null;

  const mediaType = linked?.mediaType ?? null;
  const fileName = linked?.fileName ?? null;

  if (linked && isInteractiveMediaPackage(mediaType, fileName)) {
    return mediaRepoScormUrl(slug);
  }

  if (lesson.type === "embed") {
    return mediaRepoScormUrl(slug);
  }

  if (
    lesson.embedUrl &&
    (lesson.embedUrl.includes("/api/media/") || lesson.embedUrl.includes("/media/"))
  ) {
    return mediaRepoScormUrl(slug);
  }

  if (lesson.content && parseMediaRepoSlug(lesson.content)) {
    if (linked?.slug === slug && !isPlainDocumentAsset(mediaType, fileName)) {
      return mediaRepoScormUrl(slug);
    }
    if (lesson.type === "download" && !isPlainDocumentAsset(mediaType, fileName)) {
      return mediaRepoScormUrl(slug);
    }
  }

  return null;
}
