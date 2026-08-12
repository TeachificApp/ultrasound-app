/**
 * Identifies lazy-route failures caused by an HTML document referencing a bundle
 * that was replaced during deployment.
 */
export function isStaleAssetError(error: Error): boolean {
  const message = error?.message ?? "";
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("Loading CSS chunk") ||
    /ChunkLoadError/.test(message)
  );
}

/** Keeps retries specific to the missing bundle rather than blocking later deploys. */
export function staleAssetRecoveryKey(error: Error): string {
  return `stale_asset_recovery:${encodeURIComponent((error?.message ?? "unknown").slice(0, 240))}`;
}

/** Forces a fresh document request while preserving the current route and hash. */
export function buildFreshAssetUrl(currentUrl: string, timestamp = Date.now()): string {
  const url = new URL(currentUrl);
  url.searchParams.set("__asset_refresh", String(timestamp));
  return url.toString();
}
