/**
 * Storage backend selection for Manus → Railway migration.
 *
 * - `r2`: Cloudflare R2 only (Railway production)
 * - `forge`: Manus Forge API only (legacy Manus hosting)
 * - `auto` (default): R2 when fully configured, otherwise Forge
 */

export type StorageBackend = "r2" | "forge";

function hasR2Credentials(): boolean {
  return !!(
    process.env.CF_R2_ACCOUNT_ID &&
    process.env.CF_R2_ACCESS_KEY_ID &&
    process.env.CF_R2_SECRET_ACCESS_KEY &&
    process.env.CF_R2_PUBLIC_URL
  );
}

function hasForgeCredentials(): boolean {
  return !!(process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY);
}

export function resolveStorageBackend(): StorageBackend {
  const mode = (process.env.STORAGE_BACKEND ?? "auto").toLowerCase();

  if (mode === "r2") {
    if (!hasR2Credentials()) {
      throw new Error(
        "STORAGE_BACKEND=r2 but R2 is not fully configured (CF_R2_ACCOUNT_ID, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY, CF_R2_PUBLIC_URL)"
      );
    }
    return "r2";
  }

  if (mode === "forge") {
    if (!hasForgeCredentials()) {
      throw new Error(
        "STORAGE_BACKEND=forge but Forge is not configured (BUILT_IN_FORGE_API_URL, BUILT_IN_FORGE_API_KEY)"
      );
    }
    return "forge";
  }

  if (hasR2Credentials()) return "r2";
  if (hasForgeCredentials()) return "forge";

  throw new Error(
    "No storage backend configured. Set CF_R2_* for R2 or BUILT_IN_FORGE_API_* for Forge."
  );
}

/** True when this deployment is the live Railway host (not a Manus mirror source). */
export function isRailwayPrimaryHost(): boolean {
  if (process.env.RAILWAY_PRIMARY === "true") return true;

  const dbUrl = process.env.DATABASE_URL ?? "";
  if (dbUrl.includes(".rlwy.net") || dbUrl.includes("railway.internal")) return true;

  // Railway sets RAILWAY_ENVIRONMENT in production deployments
  if (process.env.RAILWAY_ENVIRONMENT === "production" && process.env.RAILWAY_PRIMARY !== "false") {
    return true;
  }

  return false;
}
