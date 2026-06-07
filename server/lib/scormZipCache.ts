/**
 * Local /tmp cache for on-the-fly SCORM ZIP extraction (mediaServe).
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import type { Response } from "express";

export const SCORM_CACHE_DIR = path.join(os.tmpdir(), "scorm-cache");

export function getScormZipCachePaths(slug: string, zipUrl: string) {
  const urlHash = createHash("md5").update(zipUrl).digest("hex").slice(0, 8);
  const cacheDir = path.join(SCORM_CACHE_DIR, `${slug}-${urlHash}`);
  const launchMarker = path.join(cacheDir, ".launch");
  const zipPath = path.join(SCORM_CACHE_DIR, `${slug}-${urlHash}.zip`);
  return { cacheDir, launchMarker, zipPath, urlHash };
}

export function readScormZipCache(
  slug: string,
  zipUrl: string,
): { launchFile: string; cacheDir: string } | null {
  const { cacheDir, launchMarker } = getScormZipCachePaths(slug, zipUrl);
  if (!fs.existsSync(launchMarker)) return null;
  const launchFile = fs.readFileSync(launchMarker, "utf8").trim();
  if (!launchFile) return null;
  return { launchFile, cacheDir };
}

/** Resolve a relative SCORM asset path inside an extracted ZIP cache directory. */
export function resolveScormFileInCache(
  cacheDir: string,
  launchFile: string,
  relativePath: string,
): string | null {
  const launchDir = path.dirname(launchFile);

  if (relativePath === "") {
    const fullPath = path.join(cacheDir, launchFile);
    return fs.existsSync(fullPath) ? fullPath : null;
  }

  const directPath = path.join(cacheDir, relativePath);
  const launchRelPath = path.join(cacheDir, launchDir, relativePath);
  const launchDataRelPath = path.join(cacheDir, launchDir, "data", relativePath);
  const fileName = path.basename(relativePath);

  if (fs.existsSync(directPath)) return directPath;
  if (launchDir !== "." && fs.existsSync(launchRelPath)) return launchRelPath;
  if (launchDir !== "." && fs.existsSync(launchDataRelPath)) return launchDataRelPath;

  const searchRoot = launchDir !== "." ? path.join(cacheDir, launchDir) : cacheDir;
  let found: string | null = null;
  const search = (dir: string, depth: number): void => {
    if (found || depth > 5) return;
    try {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
          search(full, depth + 1);
        } else if (entry === fileName) {
          found = full;
          return;
        }
      }
    } catch {
      /* ignore unreadable dirs */
    }
  };
  search(searchRoot, 0);
  if (found && found.startsWith(cacheDir)) return found;
  return null;
}

export function tryServeScormFileFromCache(
  res: Response,
  cacheDir: string,
  launchFile: string,
  relativePath: string,
): boolean {
  const fullPath = resolveScormFileInCache(cacheDir, launchFile, relativePath);
  if (!fullPath) return false;

  const launchFull = path.join(cacheDir, launchFile);
  if (!fullPath.startsWith(cacheDir + path.sep) && fullPath !== launchFull) {
    res.status(403).send("Forbidden");
    return true;
  }

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.sendFile(fullPath);
  return true;
}
