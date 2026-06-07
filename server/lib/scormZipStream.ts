/**
 * SCORM On-Demand ZIP Streaming
 *
 * Serves individual SCORM asset files directly from a ZIP stored on R2 using
 * HTTP Range requests — no local extraction, no /tmp disk usage, no Cloud Run
 * timeout issues.
 *
 * Architecture:
 * 1. On first request for a SCORM package, fetch the ZIP's central directory
 *    (last ~64 KB of the file) using a Range request to R2.
 * 2. Parse the central directory to build a filename → {offset, size, method} map.
 * 3. Cache this map in memory (keyed by ZIP URL) so subsequent requests are fast.
 * 4. For each sub-file request, look up the byte range, fetch just that slice from
 *    R2, decompress if needed (deflate), and stream directly to the browser.
 *
 * This approach:
 * - Eliminates the need for local extraction entirely.
 * - Works within Cloud Run's 180s timeout (each sub-request only downloads the
 *   specific file needed, typically a few KB to a few MB).
 * - No /tmp disk space issues.
 * - No stall threshold problems.
 * - Handles any ZIP size.
 */

import https from "https";
import http from "http";
import zlib from "zlib";
import { createHash } from "crypto";
import type { Response } from "express";
import { findScormLaunchFile } from "./scormPackage";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZipEntry {
  /** Path inside the ZIP (forward slashes). */
  name: string;
  /** Byte offset of the local file header in the ZIP. */
  localHeaderOffset: number;
  /** Compressed size in bytes. */
  compressedSize: number;
  /** Uncompressed size in bytes. */
  uncompressedSize: number;
  /** Compression method: 0 = stored, 8 = deflated. */
  method: number;
}

export interface ZipDirectory {
  /** All entries in the ZIP central directory. */
  entries: ZipEntry[];
  /** Map from normalized path (lowercase, forward slashes) to entry. */
  byPath: Map<string, ZipEntry>;
  /** Total size of the ZIP file in bytes. */
  fileSize: number;
  /** SCORM launch file (from imsmanifest.xml or index.html fallback). */
  launchFile: string;
}

// ─── In-memory directory cache ────────────────────────────────────────────────
// Keyed by MD5 of the ZIP URL. Entries are evicted after 24 hours.

interface CacheEntry {
  dir: ZipDirectory;
  cachedAt: number;
}

const directoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cacheKey(zipUrl: string): string {
  return createHash("md5").update(zipUrl).digest("hex");
}

function getCachedDirectory(zipUrl: string): ZipDirectory | null {
  const key = cacheKey(zipUrl);
  const entry = directoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    directoryCache.delete(key);
    return null;
  }
  return entry.dir;
}

function setCachedDirectory(zipUrl: string, dir: ZipDirectory): void {
  const key = cacheKey(zipUrl);
  directoryCache.set(key, { dir, cachedAt: Date.now() });
}

// ─── HTTP Range fetch helpers ─────────────────────────────────────────────────

/**
 * Fetch a byte range from a URL using an HTTP Range request.
 * Returns the response body as a Buffer.
 */
function fetchRange(url: string, start: number, end: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const follow = (targetUrl: string, redirects = 0): void => {
      if (redirects > 5) { reject(new Error("Too many redirects")); return; }

      let safeUrl = targetUrl;
      try {
        const preEncoded = targetUrl.replace(/ /g, "%20");
        const parsed = new URL(preEncoded);
        parsed.pathname = parsed.pathname
          .split("/")
          .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
          .join("/");
        safeUrl = parsed.toString();
      } catch {
        safeUrl = targetUrl.replace(/ /g, "%20");
      }

      const proto = safeUrl.startsWith("https") ? https : http;
      const options = {
        headers: { Range: `bytes=${start}-${end}` },
      };

      proto.get(safeUrl, options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode && res.statusCode !== 206 && res.statusCode !== 200) {
          reject(new Error(`Range fetch failed: HTTP ${res.statusCode} for ${safeUrl}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

/**
 * Fetch a byte range from a URL and stream it directly to an Express response.
 * Used for serving individual SCORM files without buffering the whole thing.
 */
function streamRange(url: string, start: number, end: number, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (targetUrl: string, redirects = 0): void => {
      if (redirects > 5) { reject(new Error("Too many redirects")); return; }

      let safeUrl = targetUrl;
      try {
        const preEncoded = targetUrl.replace(/ /g, "%20");
        const parsed = new URL(preEncoded);
        parsed.pathname = parsed.pathname
          .split("/")
          .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
          .join("/");
        safeUrl = parsed.toString();
      } catch {
        safeUrl = targetUrl.replace(/ /g, "%20");
      }

      const proto = safeUrl.startsWith("https") ? https : http;
      const options = {
        headers: { Range: `bytes=${start}-${end}` },
      };

      proto.get(safeUrl, options, (res_) => {
        if (res_.statusCode && res_.statusCode >= 300 && res_.statusCode < 400 && res_.headers.location) {
          follow(res_.headers.location, redirects + 1);
          return;
        }
        if (res_.statusCode && res_.statusCode !== 206 && res_.statusCode !== 200) {
          reject(new Error(`Range fetch failed: HTTP ${res_.statusCode}`));
          return;
        }
        res_.on("error", reject);
        res_.pipe(res);
        res.on("finish", resolve);
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

/**
 * Get the total size of a remote file using a HEAD request.
 */
function getFileSize(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const follow = (targetUrl: string, redirects = 0): void => {
      if (redirects > 5) { reject(new Error("Too many redirects")); return; }

      let safeUrl = targetUrl;
      try {
        const preEncoded = targetUrl.replace(/ /g, "%20");
        const parsed = new URL(preEncoded);
        parsed.pathname = parsed.pathname
          .split("/")
          .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
          .join("/");
        safeUrl = parsed.toString();
      } catch {
        safeUrl = targetUrl.replace(/ /g, "%20");
      }

      const proto = safeUrl.startsWith("https") ? https : http;
      const req = proto.request(safeUrl, { method: "HEAD" }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }
        const cl = res.headers["content-length"];
        if (cl) {
          resolve(parseInt(cl, 10));
        } else {
          reject(new Error("No Content-Length header in HEAD response"));
        }
      });
      req.on("error", reject);
      req.end();
    };
    follow(url);
  });
}

// ─── ZIP format parsing ───────────────────────────────────────────────────────

const EOCD_SIGNATURE = 0x06054b50;
const EOCD64_SIGNATURE = 0x06064b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

/**
 * Parse the ZIP End-of-Central-Directory record from the tail of the file.
 * Returns { centralDirOffset, centralDirSize, entryCount }.
 */
function parseEOCD(buf: Buffer, fileSize: number, tailStart: number): {
  centralDirOffset: number;
  centralDirSize: number;
  entryCount: number;
} | null {
  // Search for EOCD signature from the end (it can be preceded by a comment)
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) {
      const diskEntries = buf.readUInt16LE(i + 10);
      const centralDirSize = buf.readUInt32LE(i + 12);
      let centralDirOffset = buf.readUInt32LE(i + 16);

      // Check for ZIP64 (offset = 0xFFFFFFFF means look at ZIP64 EOCD locator)
      if (centralDirOffset === 0xFFFFFFFF) {
        // Find ZIP64 EOCD locator (20 bytes before EOCD)
        const locatorPos = i - 20;
        if (locatorPos >= 0 && buf.readUInt32LE(locatorPos) === 0x07064b50) {
          const eocd64Offset = Number(buf.readBigUInt64LE(locatorPos + 8));
          const eocd64BufOffset = eocd64Offset - tailStart;
          if (eocd64BufOffset >= 0 && eocd64BufOffset + 56 <= buf.length) {
            if (buf.readUInt32LE(eocd64BufOffset) === EOCD64_SIGNATURE) {
              const entryCount64 = Number(buf.readBigUInt64LE(eocd64BufOffset + 32));
              const centralDirSize64 = Number(buf.readBigUInt64LE(eocd64BufOffset + 40));
              const centralDirOffset64 = Number(buf.readBigUInt64LE(eocd64BufOffset + 48));
              return {
                centralDirOffset: centralDirOffset64,
                centralDirSize: centralDirSize64,
                entryCount: entryCount64,
              };
            }
          }
        }
      }

      return {
        centralDirOffset,
        centralDirSize,
        entryCount: diskEntries,
      };
    }
  }
  return null;
}

/**
 * Parse the ZIP central directory from a Buffer.
 * Returns an array of ZipEntry objects.
 */
function parseCentralDirectory(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 46 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== CENTRAL_DIR_SIGNATURE) break;

    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const uncompressedSize = buf.readUInt32LE(offset + 24);
    const fileNameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    let localHeaderOffset = buf.readUInt32LE(offset + 42);

    const nameEnd = offset + 46 + fileNameLen;
    if (nameEnd > buf.length) break;

    const name = buf.slice(offset + 46, nameEnd).toString("utf8").replace(/\\/g, "/");

    // Handle ZIP64 extra fields
    let actualCompressedSize = compressedSize;
    let actualUncompressedSize = uncompressedSize;
    let actualLocalHeaderOffset = localHeaderOffset;

    if (extraLen > 0 && (compressedSize === 0xFFFFFFFF || uncompressedSize === 0xFFFFFFFF || localHeaderOffset === 0xFFFFFFFF)) {
      const extraStart = nameEnd;
      const extraEnd = extraStart + extraLen;
      let extraOffset = extraStart;
      while (extraOffset + 4 <= extraEnd && extraOffset < buf.length) {
        const headerId = buf.readUInt16LE(extraOffset);
        const dataSize = buf.readUInt16LE(extraOffset + 2);
        if (headerId === 0x0001) {
          // ZIP64 extended information
          let zip64Offset = extraOffset + 4;
          if (uncompressedSize === 0xFFFFFFFF && zip64Offset + 8 <= extraEnd) {
            actualUncompressedSize = Number(buf.readBigUInt64LE(zip64Offset));
            zip64Offset += 8;
          }
          if (compressedSize === 0xFFFFFFFF && zip64Offset + 8 <= extraEnd) {
            actualCompressedSize = Number(buf.readBigUInt64LE(zip64Offset));
            zip64Offset += 8;
          }
          if (localHeaderOffset === 0xFFFFFFFF && zip64Offset + 8 <= extraEnd) {
            actualLocalHeaderOffset = Number(buf.readBigUInt64LE(zip64Offset));
          }
          break;
        }
        extraOffset += 4 + dataSize;
      }
    }

    // Skip directories
    if (!name.endsWith("/")) {
      entries.push({
        name,
        localHeaderOffset: actualLocalHeaderOffset,
        compressedSize: actualCompressedSize,
        uncompressedSize: actualUncompressedSize,
        method,
      });
    }

    offset += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

// ─── Local file header parsing ────────────────────────────────────────────────

/**
 * Fetch the local file header for a ZIP entry to get the actual data offset.
 * The local file header has variable-length fields that may differ from the central directory.
 */
async function getDataOffset(zipUrl: string, entry: ZipEntry): Promise<number> {
  // Local file header: 30 bytes fixed + variable filename + extra
  const headerBuf = await fetchRange(zipUrl, entry.localHeaderOffset, entry.localHeaderOffset + 29);
  if (headerBuf.readUInt32LE(0) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`Invalid local file header signature for ${entry.name}`);
  }
  const fileNameLen = headerBuf.readUInt16LE(26);
  const extraLen = headerBuf.readUInt16LE(28);
  return entry.localHeaderOffset + 30 + fileNameLen + extraLen;
}

// ─── MIME type helper ─────────────────────────────────────────────────────────

function guessMime(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    html: "text/html", htm: "text/html",
    css: "text/css",
    js: "application/javascript", mjs: "application/javascript",
    json: "application/json",
    xml: "application/xml",
    svg: "image/svg+xml",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", ico: "image/x-icon",
    mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm",
    ogg: "audio/ogg", wav: "audio/wav",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
    pdf: "application/pdf",
    zip: "application/zip",
    swf: "application/x-shockwave-flash",
    txt: "text/plain",
    cur: "image/vnd.microsoft.icon",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load and cache the ZIP central directory for a remote ZIP file.
 * Uses HTTP Range requests — only downloads the last ~128KB of the file.
 * Returns the parsed directory with all entry metadata.
 */
export async function loadZipDirectory(zipUrl: string): Promise<ZipDirectory> {
  const cached = getCachedDirectory(zipUrl);
  if (cached) return cached;

  console.log(`[ZipStream] Loading ZIP directory for ${zipUrl.slice(-60)}`);

  // Step 1: Get file size via HEAD request
  const fileSize = await getFileSize(zipUrl);
  console.log(`[ZipStream] ZIP file size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

  // Step 2: Fetch the tail of the file to find the EOCD record
  // ZIP comments can be up to 65535 bytes, so we need to fetch enough tail
  // to find the EOCD. 128KB is safe for virtually all ZIPs.
  const tailSize = Math.min(128 * 1024, fileSize);
  const tailStart = fileSize - tailSize;
  const tailBuf = await fetchRange(zipUrl, tailStart, fileSize - 1);

  // Step 3: Parse EOCD to find central directory location
  const eocd = parseEOCD(tailBuf, fileSize, tailStart);
  if (!eocd) {
    throw new Error("Could not find ZIP End-of-Central-Directory record");
  }
  console.log(`[ZipStream] Central directory: offset=${eocd.centralDirOffset}, size=${eocd.centralDirSize}, entries=${eocd.entryCount}`);

  // Step 4: Fetch the central directory
  // If it's within the tail we already fetched, use that; otherwise fetch separately
  let centralDirBuf: Buffer;
  const cdStart = eocd.centralDirOffset;
  const cdEnd = cdStart + eocd.centralDirSize - 1;

  if (cdStart >= tailStart) {
    // Central directory is within the tail buffer
    const relStart = cdStart - tailStart;
    const relEnd = relStart + eocd.centralDirSize;
    centralDirBuf = tailBuf.slice(relStart, relEnd);
  } else {
    // Need to fetch central directory separately
    centralDirBuf = await fetchRange(zipUrl, cdStart, cdEnd);
  }

  // Step 5: Parse central directory entries
  const entries = parseCentralDirectory(centralDirBuf);
  console.log(`[ZipStream] Parsed ${entries.length} entries from central directory`);

  // Step 6: Build lookup map (normalized paths)
  const byPath = new Map<string, ZipEntry>();
  for (const entry of entries) {
    byPath.set(entry.name.toLowerCase(), entry);
    // Also index by just the filename for fuzzy matching
  }

  // Step 7: Find SCORM launch file from imsmanifest.xml
  let launchFile = "index.html";
  const manifestEntry = byPath.get("imsmanifest.xml") ??
    entries.find((e) => e.name.toLowerCase().endsWith("/imsmanifest.xml"));

  if (manifestEntry) {
    try {
      const manifestBuf = await readZipEntry(zipUrl, manifestEntry);
      const manifestXml = manifestBuf.toString("utf8");
      launchFile = findScormLaunchFile(manifestXml);
      console.log(`[ZipStream] Launch file from manifest: ${launchFile}`);
    } catch (err) {
      console.warn(`[ZipStream] Could not read imsmanifest.xml:`, err);
    }
  } else {
    // Fallback: find any index.html
    const indexEntry = entries.find(
      (e) => e.name.toLowerCase() === "index.html" || e.name.toLowerCase().endsWith("/index.html")
    );
    if (indexEntry) {
      launchFile = indexEntry.name;
      console.log(`[ZipStream] Launch file fallback: ${launchFile}`);
    }
  }

  const dir: ZipDirectory = { entries, byPath, fileSize, launchFile };
  setCachedDirectory(zipUrl, dir);
  return dir;
}

/**
 * Read a ZIP entry's data into a Buffer (for small files like manifests).
 */
async function readZipEntry(zipUrl: string, entry: ZipEntry): Promise<Buffer> {
  const dataOffset = await getDataOffset(zipUrl, entry);
  const dataEnd = dataOffset + entry.compressedSize - 1;
  const compressed = await fetchRange(zipUrl, dataOffset, dataEnd);

  if (entry.method === 0) {
    // Stored (no compression)
    return compressed;
  } else if (entry.method === 8) {
    // Deflated — decompress using raw deflate (no zlib header)
    return new Promise((resolve, reject) => {
      zlib.inflateRaw(compressed, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  } else {
    throw new Error(`Unsupported compression method: ${entry.method}`);
  }
}

/**
 * Resolve a SCORM sub-file path against the ZIP directory.
 * Handles the same path-resolution heuristics as scormZipCache.ts:
 * 1. Direct match
 * 2. launchDir/relativePath
 * 3. launchDir/data/relativePath
 * 4. Filename-only search under launchDir
 */
function resolveEntryPath(dir: ZipDirectory, launchFile: string, relativePath: string): ZipEntry | null {
  if (relativePath === "" || relativePath === launchFile) {
    return dir.byPath.get(launchFile.toLowerCase()) ?? null;
  }

  const relLower = relativePath.toLowerCase();

  // 1. Direct match
  const direct = dir.byPath.get(relLower);
  if (direct) return direct;

  // 2. launchDir/relativePath
  const launchDir = launchFile.includes("/") ? launchFile.substring(0, launchFile.lastIndexOf("/")) : "";
  if (launchDir) {
    const withLaunchDir = `${launchDir}/${relativePath}`.toLowerCase();
    const withLaunchDirEntry = dir.byPath.get(withLaunchDir);
    if (withLaunchDirEntry) return withLaunchDirEntry;

    // 3. launchDir/data/relativePath
    const withDataDir = `${launchDir}/data/${relativePath}`.toLowerCase();
    const withDataDirEntry = dir.byPath.get(withDataDir);
    if (withDataDirEntry) return withDataDirEntry;
  }

  // 4. Filename-only search (for assets that reference just the filename)
  const fileName = relativePath.includes("/")
    ? relativePath.substring(relativePath.lastIndexOf("/") + 1).toLowerCase()
    : relLower;

  for (const [path, entry] of dir.byPath) {
    const entryFileName = path.includes("/") ? path.substring(path.lastIndexOf("/") + 1) : path;
    if (entryFileName === fileName) {
      // Prefer entries under the launch directory
      if (launchDir && path.startsWith(launchDir.toLowerCase())) return entry;
    }
  }
  // Accept any match if no launch-dir match found
  for (const [path, entry] of dir.byPath) {
    const entryFileName = path.includes("/") ? path.substring(path.lastIndexOf("/") + 1) : path;
    if (entryFileName === fileName) return entry;
  }

  return null;
}

/**
 * Serve a SCORM sub-file directly from the ZIP on R2.
 *
 * @param zipUrl - Public URL of the ZIP file on R2
 * @param relativePath - Requested path relative to the SCORM root (empty = launch file)
 * @param res - Express response object
 * @returns true if the file was served, false if not found
 */
export async function serveScormFileFromZip(
  zipUrl: string,
  relativePath: string,
  res: Response
): Promise<boolean> {
  try {
    const dir = await loadZipDirectory(zipUrl);
    const entry = resolveEntryPath(dir, dir.launchFile, relativePath);

    if (!entry) {
      console.warn(`[ZipStream] Entry not found: "${relativePath}" in ${zipUrl.slice(-60)}`);
      return false;
    }

    // Get actual data offset (local header may have different extra field length)
    const dataOffset = await getDataOffset(zipUrl, entry);
    const dataEnd = dataOffset + entry.compressedSize - 1;

    const contentType = guessMime(entry.name);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");

    if (entry.method === 0) {
      // Stored — stream directly without decompression
      res.setHeader("Content-Length", entry.uncompressedSize);
      await streamRange(zipUrl, dataOffset, dataEnd, res);
    } else if (entry.method === 8) {
      // Deflated — fetch compressed bytes and decompress via inflateRaw stream
      // We can't set Content-Length because we don't know the exact output size
      // until we decompress (though uncompressedSize should be accurate)
      res.setHeader("Content-Length", entry.uncompressedSize);

      await new Promise<void>((resolve, reject) => {
        const follow = (targetUrl: string, redirects = 0): void => {
          if (redirects > 5) { reject(new Error("Too many redirects")); return; }

          let safeUrl = targetUrl;
          try {
            const preEncoded = targetUrl.replace(/ /g, "%20");
            const parsed = new URL(preEncoded);
            parsed.pathname = parsed.pathname
              .split("/")
              .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
              .join("/");
            safeUrl = parsed.toString();
          } catch {
            safeUrl = targetUrl.replace(/ /g, "%20");
          }

          const proto = safeUrl.startsWith("https") ? https : http;
          proto.get(safeUrl, { headers: { Range: `bytes=${dataOffset}-${dataEnd}` } }, (httpRes) => {
            if (httpRes.statusCode && httpRes.statusCode >= 300 && httpRes.statusCode < 400 && httpRes.headers.location) {
              follow(httpRes.headers.location, redirects + 1);
              return;
            }
            if (httpRes.statusCode && httpRes.statusCode !== 206 && httpRes.statusCode !== 200) {
              reject(new Error(`Range fetch failed: HTTP ${httpRes.statusCode}`));
              return;
            }
            const inflate = zlib.createInflateRaw();
            httpRes.on("error", reject);
            inflate.on("error", reject);
            res.on("error", reject);
            res.on("finish", resolve);
            httpRes.pipe(inflate).pipe(res);
          }).on("error", reject);
        };
        follow(zipUrl);
      });
    } else {
      console.warn(`[ZipStream] Unsupported compression method ${entry.method} for ${entry.name}`);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error(`[ZipStream] Error serving "${relativePath}":`, err?.message ?? err);
    return false;
  }
}

/**
 * Get the SCORM launch file path for a ZIP without serving any content.
 * Used to determine the launch URL before the user opens the course.
 */
export async function getScormLaunchFile(zipUrl: string): Promise<string> {
  const dir = await loadZipDirectory(zipUrl);
  return dir.launchFile;
}

/**
 * Invalidate the cached directory for a ZIP URL (e.g., after re-upload).
 */
export function invalidateZipDirectoryCache(zipUrl: string): void {
  const key = cacheKey(zipUrl);
  directoryCache.delete(key);
}

/**
 * Return cache stats for diagnostics.
 */
export function getZipDirectoryCacheStats(): { size: number; keys: string[] } {
  return {
    size: directoryCache.size,
    keys: Array.from(directoryCache.keys()),
  };
}
