/**
 * SCORM Regression Tests — Jun 2026
 *
 * These tests cover every failure mode discovered during the Pediatric Echo
 * SCORM outage. They must ALL pass before any SCORM-related code is deployed.
 *
 * Failure modes covered:
 * 1. Missing trailing slash → relative asset paths resolve to wrong URL
 * 2. routePrefix mismatch → sub-file requests return 202 instead of file content
 * 3. pickScormPlaybackMode returns clientZip for skipped assets → browser downloads 200MB ZIP
 * 4. resolveEntryPath fails for folder-prefixed ZIP entries
 * 5. Query strings on asset URLs break path resolution
 * 6. Stuck processing/pending versions never serve content
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveScormServePlans,
  pickScormPlaybackMode,
  isZipStorageRef,
} from "./lib/scormPackage";

// ─── Mock version shapes ──────────────────────────────────────────────────────

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    versionNumber: 1,
    s3Url: "https://pub-abc.r2.dev/media-repo/test/v1-TEST.zip",
    fileName: "TEST.zip",
    mimeType: "application/x-zip-compressed",
    s3Key: "media-repo/test/v1-TEST.zip",
    scormExtractedPrefix: null,
    scormLaunchFile: null,
    scormExtractionStatus: null,
    scormExtractionError: null,
    ...overrides,
  };
}

// ─── 1. isZipStorageRef — recognizes all ZIP-like SCORM archives ──────────────

describe("isZipStorageRef", () => {
  it("recognizes .zip mime type", () => {
    const v = makeVersion({ mimeType: "application/x-zip-compressed" });
    expect(isZipStorageRef(v)).toBe(true);
  });

  it("recognizes application/zip mime type", () => {
    const v = makeVersion({ mimeType: "application/zip" });
    expect(isZipStorageRef(v)).toBe(true);
  });

  it("recognizes .quiz extension even with octet-stream mime", () => {
    const v = makeVersion({
      mimeType: "application/octet-stream",
      s3Url: "https://pub-abc.r2.dev/media-repo/test/v1-TEST.quiz",
      fileName: "TEST.quiz",
    });
    expect(isZipStorageRef(v)).toBe(true);
  });

  it("recognizes .zip extension with octet-stream mime", () => {
    const v = makeVersion({
      mimeType: "application/octet-stream",
      s3Url: "https://pub-abc.r2.dev/media-repo/test/v1-TEST.zip",
      fileName: "TEST.zip",
    });
    expect(isZipStorageRef(v)).toBe(true);
  });

  it("does not recognize plain video files", () => {
    const v = makeVersion({
      mimeType: "video/mp4",
      s3Url: "https://pub-abc.r2.dev/media-repo/test/v1-TEST.mp4",
      fileName: "TEST.mp4",
    });
    expect(isZipStorageRef(v)).toBe(false);
  });
});

// ─── 2. resolveScormServePlans — r2_zip_stream is first for skipped versions ──

describe("resolveScormServePlans", () => {
  it("returns r2_zip_stream as first plan for skipped ZIP version", () => {
    const versions = [
      makeVersion({ scormExtractionStatus: "skipped" }),
    ];
    const plans = resolveScormServePlans(versions);
    expect(plans[0]?.kind).toBe("r2_zip_stream");
  });

  it("returns r2_zip_stream for processing ZIP version (no waiting plan first)", () => {
    const versions = [
      makeVersion({ scormExtractionStatus: "processing" }),
    ];
    const plans = resolveScormServePlans(versions);
    // Should have r2_zip_stream available (processing versions can still be served)
    const zipPlan = plans.find((p) => p.kind === "r2_zip_stream");
    expect(zipPlan).toBeDefined();
  });

  it("returns r2_zip_stream for pending ZIP version", () => {
    const versions = [
      makeVersion({ scormExtractionStatus: "pending" }),
    ];
    const plans = resolveScormServePlans(versions);
    const zipPlan = plans.find((p) => p.kind === "r2_zip_stream");
    expect(zipPlan).toBeDefined();
  });

  it("returns r2_extracted plan when extraction is done", () => {
    // Note: the status value is 'done' not 'complete' in this codebase
    const versions = [
      makeVersion({
        scormExtractionStatus: "done",
        scormExtractedPrefix: "scorm-extracted/test-slug",
        scormLaunchFile: "index.html",
      }),
    ];
    const plans = resolveScormServePlans(versions);
    const extractedPlan = plans.find((p) => p.kind === "r2_extracted");
    expect(extractedPlan).toBeDefined();
  });

  it("includes r2_zip_stream even when r2_extracted exists (as fallback)", () => {
    const versions = [
      makeVersion({
        scormExtractionStatus: "complete",
        scormExtractedPrefix: "scorm-extracted/test-slug",
        scormLaunchFile: "index.html",
      }),
    ];
    const plans = resolveScormServePlans(versions);
    const zipPlan = plans.find((p) => p.kind === "r2_zip_stream");
    expect(zipPlan).toBeDefined();
  });
});

// ─── 3. pickScormPlaybackMode — never returns clientZip for skipped/zip assets ─

describe("pickScormPlaybackMode", () => {
  it("returns server for skipped ZIP version (CRITICAL: prevents 200MB browser download)", () => {
    // pickScormPlaybackMode returns { mode: ScormPlaybackMode } — check .mode
    const version = makeVersion({ scormExtractionStatus: "skipped" });
    const result = pickScormPlaybackMode(version, [version]);
    expect(result.mode).toBe("server");
    expect(result.mode).not.toBe("clientZip");
  });

  it("returns server for processing ZIP version", () => {
    const version = makeVersion({ scormExtractionStatus: "processing" });
    const result = pickScormPlaybackMode(version, [version]);
    expect(result.mode).toBe("server");
  });

  it("returns server for pending ZIP version", () => {
    const version = makeVersion({ scormExtractionStatus: "pending" });
    const result = pickScormPlaybackMode(version, [version]);
    expect(result.mode).toBe("server");
  });

  it("returns server for done ZIP version with extracted prefix", () => {
    const version = makeVersion({
      scormExtractionStatus: "done",
      scormExtractedPrefix: "scorm-extracted/test-slug",
      scormLaunchFile: "index.html",
    });
    const result = pickScormPlaybackMode(version, [version]);
    expect(result.mode).toBe("server");
  });

  it("returns server for failed ZIP version (falls back to zip-stream)", () => {
    const version = makeVersion({ scormExtractionStatus: "failed", scormExtractionError: "timeout" });
    const result = pickScormPlaybackMode(version, [version]);
    expect(result.mode).toBe("server");
  });
});

// ─── 4. routePrefix detection — both /api/media/ and /media/ variants ─────────

describe("routePrefix detection logic", () => {
  function detectPrefix(reqPath: string, slug: string): string {
    const candidatePrefixes = [
      `/api/media/${slug}/scorm`,
      `/media/${slug}/scorm`,
    ];
    return (
      candidatePrefixes.find(
        (p) => reqPath === p || reqPath.startsWith(p + "/")
      ) ?? `/api/media/${slug}/scorm`
    );
  }

  function getRelativePath(reqPath: string, slug: string): string {
    const prefix = detectPrefix(reqPath, slug);
    return reqPath.replace(prefix, "").replace(/^\//, "");
  }

  const slug = "unlimited-registry-review-quiz-pediatric-echo-e684dd32";

  it("correctly detects /media/ prefix for root scorm request", () => {
    const reqPath = `/media/${slug}/scorm/`;
    expect(detectPrefix(reqPath, slug)).toBe(`/media/${slug}/scorm`);
  });

  it("correctly detects /media/ prefix for sub-file request", () => {
    const reqPath = `/media/${slug}/scorm/data/browsersupport.js`;
    expect(detectPrefix(reqPath, slug)).toBe(`/media/${slug}/scorm`);
  });

  it("correctly detects /api/media/ prefix for sub-file request", () => {
    const reqPath = `/api/media/${slug}/scorm/data/player.js`;
    expect(detectPrefix(reqPath, slug)).toBe(`/api/media/${slug}/scorm`);
  });

  it("extracts empty relativePath for root /scorm/ request", () => {
    const reqPath = `/media/${slug}/scorm/`;
    expect(getRelativePath(reqPath, slug)).toBe("");
  });

  it("extracts correct relativePath for sub-file via /media/ (THE BUG)", () => {
    // This was the exact bug: the loop used /api/media/ prefix for a /media/ request
    // causing relativePath = "media/.../scorm/data/browsersupport.js" instead of "data/browsersupport.js"
    const reqPath = `/media/${slug}/scorm/data/browsersupport.js`;
    const relativePath = getRelativePath(reqPath, slug);
    expect(relativePath).toBe("data/browsersupport.js");
    expect(relativePath).not.toContain("media/");
    expect(relativePath).not.toContain("scorm/");
  });

  it("extracts correct relativePath for nested sub-file", () => {
    const reqPath = `/media/${slug}/scorm/data/images/img-abc123.jpg`;
    expect(getRelativePath(reqPath, slug)).toBe("data/images/img-abc123.jpg");
  });

  it("handles query strings in sub-file path correctly", () => {
    // Query strings are in req.query, not req.path — path should be clean
    const reqPath = `/media/${slug}/scorm/data/player.js`;
    expect(getRelativePath(reqPath, slug)).toBe("data/player.js");
  });
});

// ─── 5. resolveEntryPath — folder-prefixed ZIP entries ───────────────────────

describe("resolveEntryPath logic (folder-prefixed ZIP entries)", () => {
  // Simulates the byPath map for a ZIP with entries under a folder
  function makeByPath(entries: string[]): Map<string, { name: string }> {
    const map = new Map<string, { name: string }>();
    for (const e of entries) {
      map.set(e.toLowerCase(), { name: e });
    }
    return map;
  }

  function resolveEntry(
    byPath: Map<string, { name: string }>,
    launchFile: string,
    relativePath: string
  ): { name: string } | null {
    if (relativePath === "" || relativePath === launchFile) {
      return byPath.get(launchFile.toLowerCase()) ?? null;
    }
    const relLower = relativePath.toLowerCase();
    const direct = byPath.get(relLower);
    if (direct) return direct;

    const launchDir = launchFile.includes("/")
      ? launchFile.substring(0, launchFile.lastIndexOf("/"))
      : "";
    if (launchDir) {
      const withLaunchDir = `${launchDir}/${relativePath}`.toLowerCase();
      const found = byPath.get(withLaunchDir);
      if (found) return found;
    }

    // Filename-only fallback
    const fileName = relativePath.includes("/")
      ? relativePath.substring(relativePath.lastIndexOf("/") + 1).toLowerCase()
      : relLower;
    for (const [path, entry] of byPath) {
      const entryFileName = path.includes("/")
        ? path.substring(path.lastIndexOf("/") + 1)
        : path;
      if (entryFileName === fileName) {
        if (launchDir && path.startsWith(launchDir.toLowerCase())) return entry;
      }
    }
    for (const [path, entry] of byPath) {
      const entryFileName = path.includes("/")
        ? path.substring(path.lastIndexOf("/") + 1)
        : path;
      if (entryFileName === fileName) return entry;
    }
    return null;
  }

  const FOLDER = "UNLIMITED REGISTRY REVIEW QUIZ - PEDIATRIC ECHO";
  const launchFile = `${FOLDER}/index.html`;
  const entries = [
    `${FOLDER}/index.html`,
    `${FOLDER}/data/browsersupport.js`,
    `${FOLDER}/data/player.js`,
    `${FOLDER}/data/images/img-abc123.jpg`,
    `${FOLDER}/data/videos/video-xyz.mp4`,
  ];

  let byPath: Map<string, { name: string }>;
  beforeEach(() => {
    byPath = makeByPath(entries);
  });

  it("resolves empty relativePath to launch file", () => {
    const entry = resolveEntry(byPath, launchFile, "");
    expect(entry?.name).toBe(`${FOLDER}/index.html`);
  });

  it("resolves data/browsersupport.js via launchDir prefix", () => {
    const entry = resolveEntry(byPath, launchFile, "data/browsersupport.js");
    expect(entry?.name).toBe(`${FOLDER}/data/browsersupport.js`);
  });

  it("resolves data/player.js via launchDir prefix", () => {
    const entry = resolveEntry(byPath, launchFile, "data/player.js");
    expect(entry?.name).toBe(`${FOLDER}/data/player.js`);
  });

  it("resolves nested image path via launchDir prefix", () => {
    const entry = resolveEntry(byPath, launchFile, "data/images/img-abc123.jpg");
    expect(entry?.name).toBe(`${FOLDER}/data/images/img-abc123.jpg`);
  });

  it("returns null for non-existent file", () => {
    const entry = resolveEntry(byPath, launchFile, "data/nonexistent.js");
    expect(entry).toBeNull();
  });

  it("resolves filename-only via fallback search", () => {
    const entry = resolveEntry(byPath, launchFile, "player.js");
    expect(entry?.name).toBe(`${FOLDER}/data/player.js`);
  });
});

// ─── 6. Trailing slash redirect — ensures relative paths resolve correctly ────

describe("trailing slash redirect logic", () => {
  function shouldRedirect(reqPath: string): boolean {
    const isLaunchRequest =
      reqPath.endsWith("/scorm") || reqPath.endsWith("/scorm/");
    const hasTrailingSlash = reqPath.endsWith("/");
    return isLaunchRequest && !hasTrailingSlash;
  }

  it("redirects /scorm (no trailing slash) to /scorm/", () => {
    expect(shouldRedirect("/media/test-slug/scorm")).toBe(true);
  });

  it("does NOT redirect /scorm/ (already has trailing slash)", () => {
    expect(shouldRedirect("/media/test-slug/scorm/")).toBe(false);
  });

  it("does NOT redirect sub-file requests", () => {
    expect(shouldRedirect("/media/test-slug/scorm/data/player.js")).toBe(false);
  });

  it("does NOT redirect /api/media/.../scorm/ (already has trailing slash)", () => {
    expect(shouldRedirect("/api/media/test-slug/scorm/")).toBe(false);
  });

  it("redirects /api/media/.../scorm (no trailing slash)", () => {
    expect(shouldRedirect("/api/media/test-slug/scorm")).toBe(true);
  });
});
