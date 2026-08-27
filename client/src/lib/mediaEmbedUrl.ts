/** Parse `/api/media/:slug/embed|download|scorm` paths from stored embed URLs. */
export function parseMediaRepoUrl(
  url: string
): { slug: string; path: "embed" | "download" | "scorm" } | null {
  const pathOnly = url.split("?")[0] ?? url;
  const match = pathOnly.match(/\/(?:api\/)?media\/([^/]+)\/(embed|download|scorm)\/?$/);
  if (!match) return null;
  const path = match[2] as "embed" | "download" | "scorm";
  return { slug: decodeURIComponent(match[1]), path };
}

/** True when a media-repo URL should use the SCORM viewer (display blocks), not /download. */
export function isMediaRepoScormViewerPath(url: string): boolean {
  const parsed = parseMediaRepoUrl(url);
  if (!parsed) return false;
  return parsed.path === "scorm" || parsed.path === "embed";
}

export function isMediaRepoEmbedUrl(url: string): boolean {
  return parseMediaRepoUrl(url) != null;
}
