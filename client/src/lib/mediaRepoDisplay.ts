/** Media types and filenames that must render in the SCORM/embed viewer — not download. */
const INTERACTIVE_MEDIA_TYPES = new Set(["scorm", "zip", "lms", "html"]);

const INTERACTIVE_EXTENSIONS = /\.(zip|quiz|scorm|html?)$/i;

export function isInteractiveMediaPackage(
  mediaType?: string | null,
  fileName?: string | null,
): boolean {
  const type = (mediaType ?? "").toLowerCase();
  if (INTERACTIVE_MEDIA_TYPES.has(type)) return true;
  return INTERACTIVE_EXTENSIONS.test(fileName ?? "");
}

/** Learner-facing URL — renders the package in /scorm/ (never forces download). */
export function mediaRepoScormUrl(slug: string): string {
  return `/api/media/${slug}/scorm/`;
}

/** Admin/download URL — attachment Content-Disposition. */
export function mediaRepoDownloadUrl(slug: string): string {
  return `/api/media/${slug}/download`;
}

/** Pick display vs download URL for a media repository asset. */
export function mediaRepoServeUrl(
  slug: string,
  mediaType?: string | null,
  fileName?: string | null,
): string {
  return isInteractiveMediaPackage(mediaType, fileName)
    ? mediaRepoScormUrl(slug)
    : mediaRepoDownloadUrl(slug);
}
