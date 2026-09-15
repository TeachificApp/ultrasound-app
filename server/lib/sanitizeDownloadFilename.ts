/** Safe filename for Content-Disposition (ASCII fallback). */
export function sanitizeDownloadFilename(name: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, " ");
  const ascii = trimmed.replace(/[^\x20-\x7E]/g, "_").slice(0, 180);
  return ascii || "download";
}
