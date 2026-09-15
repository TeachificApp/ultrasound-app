import { storageGet } from "../storage";

/** Extract object key from a public R2 URL when CF_R2_PUBLIC_URL is configured. */
export function storageKeyFromStoredUrl(storedUrl: string | null | undefined): string | null {
  if (!storedUrl) return null;
  const base = process.env.CF_R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (base && storedUrl.startsWith(`${base}/`)) {
    const raw = storedUrl.slice(base.length + 1).split("?")[0];
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  try {
    const u = new URL(storedUrl);
    const path = u.pathname.replace(/^\/+/, "");
    if (
      path.startsWith("digital-downloads/") ||
      path.startsWith("digital-files/") ||
      path.startsWith("certificates/")
    ) {
      return decodeURIComponent(path);
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Prefer fileKey; refresh Forge presigned URLs via storageGet. */
export async function resolveStoredFileUrl(input: {
  fileKey?: string | null;
  storedUrl?: string | null;
}): Promise<string> {
  const key = input.fileKey?.replace(/^\/+/, "") || storageKeyFromStoredUrl(input.storedUrl);
  if (key) {
    const { url } = await storageGet(key);
    return url;
  }
  if (input.storedUrl) return input.storedUrl;
  throw new Error("File storage location is missing");
}
