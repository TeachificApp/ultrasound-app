import { downloadStorageObject } from "./downloadStorageObject";
import { storagePut } from "../storage";

export type ZipEntryLike = { entryName: string; getData: () => Buffer };

function normalizeZipPath(p: string): string {
  const withoutQuery = p.split(/[?#]/, 1)[0] ?? "";
  const decoded = (() => {
    try { return decodeURIComponent(withoutQuery); } catch { return withoutQuery; }
  })();
  return decoded
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

function isVideoPath(filePath: string): boolean {
  return /\.(mp4|m4v|webm|mov|wmv|avi|m3u8)(?:$|[?#])/i.test(filePath);
}

function findZipEntry(entries: ZipEntryLike[], relativePath: string): ZipEntryLike | undefined {
  const target = normalizeZipPath(relativePath);
  const exact = entries.find((entry) => {
    const name = normalizeZipPath(entry.entryName);
    return name === target || name.endsWith(`/${target}`);
  });
  if (exact) return exact;

  // iSpring may leave a stale extension in quiz metadata while archiving the
  // same image under another supported image extension. Exact matches win.
  const targetBase = target.replace(/\.[a-z0-9]+$/i, "");
  return entries.find((entry) => {
    const name = normalizeZipPath(entry.entryName);
    const nameBase = name.replace(/\.[a-z0-9]+$/i, "");
    return nameBase === targetBase || nameBase.endsWith(`/${targetBase}`);
  });
}

function mediaPathCandidates(ref: string): string[] {
  const withoutScheme = normalizeZipPath(ref.replace(/^storage:\/\//, ""));
  const rootCandidates = [
    `data/${withoutScheme}`,
    withoutScheme,
    `data/storage/${withoutScheme}`,
  ];
  const extensionMatch = /\.[a-z0-9]+$/i.exec(withoutScheme);
  if (!extensionMatch) return rootCandidates;
  const extensions = isVideoPath(withoutScheme)
    ? ["mp4", "m4v", "webm", "mov", "wmv", "avi", "m3u8"]
    : ["jpg", "jpeg", "png", "gif", "webp", "svg"];
  const stem = withoutScheme.slice(0, -extensionMatch[0].length);
  return [...new Set([
    ...rootCandidates,
    ...extensions.flatMap((extension) => [
      `data/${stem}.${extension}`,
      `${stem}.${extension}`,
      `data/storage/${stem}.${extension}`,
    ]),
  ])];
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
    mp4: "video/mp4",
    m4v: "video/x-m4v",
    webm: "video/webm",
    mov: "video/quicktime",
    wmv: "video/x-ms-wmv",
    avi: "video/x-msvideo",
    m3u8: "application/vnd.apple.mpegurl",
  };
  return map[ext] ?? "image/png";
}

const DEFAULT_MEDIA_UPLOAD_CONCURRENCY = 8;

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await fn(current);
    }
  }));
}

async function uploadSingleMediaRef(
  entries: ZipEntryLike[],
  ref: string,
): Promise<[string, string] | null> {
  const withoutScheme = normalizeZipPath(ref.replace(/^storage:\/\//, ""));
  let entry: ZipEntryLike | undefined;
  for (const candidate of mediaPathCandidates(ref)) {
    entry = findZipEntry(entries, candidate);
    if (entry) break;
  }
  if (!entry) return null;

  const buf = entry.getData();
  if (!buf.length) return null;

  const fileName = normalizeZipPath(entry.entryName).split("/").pop() ?? withoutScheme.split("/").pop() ?? "image.png";
  const key = `question-bank/ispring/${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`;
  const { url } = await storagePut(key, buf, mimeFromPath(fileName));
  return [ref, url];
}

async function uploadSingleMediaRefFromPrefix(
  prefix: string,
  ref: string,
): Promise<[string, string] | null> {
  const withoutScheme = normalizeZipPath(ref.replace(/^storage:\/\//, ""));
  let buf: Buffer | null = null;
  let resolvedKey: string | null = null;
  for (const candidate of mediaPathCandidates(ref)) {
    const key = `${prefix}/${candidate}`.replace(/\/+/g, "/");
    try {
      buf = await downloadStorageObject(key);
      if (buf.length > 0) {
        resolvedKey = key;
        break;
      }
    } catch {
      buf = null;
    }
  }
  if (!buf?.length) return null;

  const fileName = resolvedKey?.split("/").pop() ?? withoutScheme.split("/").pop() ?? "image.png";
  const storageKey = `question-bank/ispring/${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`;
  const { url } = await storagePut(storageKey, buf, mimeFromPath(fileName));
  return [ref, url];
}

/** Map package or storage:// media refs to uploaded Question Bank URLs. */
export async function uploadISpringMediaFromZip(
  entries: ZipEntryLike[],
  mediaRefs: string[],
  concurrency = DEFAULT_MEDIA_UPLOAD_CONCURRENCY,
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const uniqueRefs = [...new Set(mediaRefs)];

  await mapWithConcurrency(uniqueRefs, concurrency, async (ref) => {
    const uploaded = await uploadSingleMediaRef(entries, ref);
    if (uploaded) urlMap.set(uploaded[0], uploaded[1]);
  });

  return urlMap;
}

export function rewriteStorageRefs(text: string, urlMap: Map<string, string>): string {
  if (!text || urlMap.size === 0) return text;
  let out = text;
  for (const [ref, url] of urlMap) out = out.split(ref).join(url);
  return out;
}

/** Upload iSpring images and videos from an already-extracted SCORM storage prefix. */
export async function uploadISpringMediaFromExtractedPrefix(
  prefix: string,
  mediaRefs: string[],
  concurrency = DEFAULT_MEDIA_UPLOAD_CONCURRENCY,
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const uniqueRefs = [...new Set(mediaRefs)];

  await mapWithConcurrency(uniqueRefs, concurrency, async (ref) => {
    const uploaded = await uploadSingleMediaRefFromPrefix(prefix, ref);
    if (uploaded) urlMap.set(uploaded[0], uploaded[1]);
  });

  return urlMap;
}

/** @deprecated Use MIME-aware uploadISpringMediaFromZip. */
export const uploadISpringImagesFromZip = uploadISpringMediaFromZip;
/** @deprecated Use MIME-aware uploadISpringMediaFromExtractedPrefix. */
export const uploadISpringImagesFromExtractedPrefix = uploadISpringMediaFromExtractedPrefix;
