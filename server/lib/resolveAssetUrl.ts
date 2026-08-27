import { resolveAssetUrl as resolveAssetUrlShared } from "../../shared/resolveAssetUrl";

export function resolveAssetUrl(url: string | null | undefined): string | null {
  return resolveAssetUrlShared(url, process.env.CF_R2_PUBLIC_URL ?? null);
}

export function resolveAssetUrls<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    const resolved = resolveAssetUrl(value);
    return (resolved ?? value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveAssetUrls(item)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (
        typeof val === "string" &&
        /(?:Url|URL|Image|image|Thumbnail|thumbnail|avatar|cover|logo|src|href|file_url|fileUrl|s3Url|poster|background)/.test(key)
      ) {
        out[key] = resolveAssetUrl(val) ?? val;
      } else {
        out[key] = resolveAssetUrls(val);
      }
    }
    return out as T;
  }
  return value;
}
