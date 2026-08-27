import { downloadStorageObject } from "./downloadStorageObject";
import { storagePut } from "../storage";

export type ZipEntryLike = { entryName: string; getData: () => Buffer };

function normalizeZipPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

function findZipEntry(entries: ZipEntryLike[], relativePath: string): ZipEntryLike | undefined {
  const target = normalizeZipPath(relativePath);
  return entries.find((e) => {
    const name = normalizeZipPath(e.entryName);
    return name === target || name.endsWith(`/${target}`);
  });
}

function mimeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "png";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return map[ext] ?? "image/png";
}

/** Map storage:// refs to uploaded CDN URLs. */
export async function uploadISpringImagesFromZip(
  entries: ZipEntryLike[],
  imageRefs: string[],
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const uniqueRefs = [...new Set(imageRefs)];

  for (const ref of uniqueRefs) {
    const withoutScheme = ref.replace(/^storage:\/\//, "");
    const candidates = [
      `data/${withoutScheme}`,
      withoutScheme,
      `data/storage/${withoutScheme}`,
    ];

    let entry: ZipEntryLike | undefined;
    for (const candidate of candidates) {
      entry = findZipEntry(entries, candidate);
      if (entry) break;
    }
    if (!entry) continue;

    const buf = entry.getData();
    if (!buf.length) continue;

    const fileName = withoutScheme.split("/").pop() ?? "image.png";
    const key = `question-bank/ispring/${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`;
    const { url } = await storagePut(key, buf, mimeFromPath(fileName));
    urlMap.set(ref, url);
  }

  return urlMap;
}

export function rewriteStorageRefs(text: string, urlMap: Map<string, string>): string {
  if (!text || urlMap.size === 0) return text;
  let out = text;
  for (const [ref, url] of urlMap) {
    out = out.split(ref).join(url);
  }
  return out;
}

/** Upload iSpring images from an already-extracted SCORM R2 prefix. */
export async function uploadISpringImagesFromExtractedPrefix(
  prefix: string,
  imageRefs: string[],
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const uniqueRefs = [...new Set(imageRefs)];

  for (const ref of uniqueRefs) {
    const withoutScheme = ref.replace(/^storage:\/\//, "");
    const keys = [
      `${prefix}/data/${withoutScheme}`,
      `${prefix}/${withoutScheme}`,
      `${prefix}/data/storage/${withoutScheme}`,
    ];

    let buf: Buffer | null = null;
    for (const key of keys) {
      try {
        buf = await downloadStorageObject(key);
        if (buf.length > 0) break;
      } catch {
        buf = null;
      }
    }
    if (!buf?.length) continue;

    const fileName = withoutScheme.split("/").pop() ?? "image.png";
    const storageKey = `question-bank/ispring/${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`;
    const { url } = await storagePut(storageKey, buf, mimeFromPath(fileName));
    urlMap.set(ref, url);
  }

  return urlMap;
}
