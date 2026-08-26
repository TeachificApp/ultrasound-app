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
