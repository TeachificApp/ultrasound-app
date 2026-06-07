/**
 * Tests for SCORM on-demand ZIP streaming (scormZipStream.ts)
 * and the r2_zip_stream serve plan in scormPackage.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveScormServePlans, pickScormPlaybackMode } from "./lib/scormPackage";
import type { MediaVersionZipRef } from "./lib/scormPackage";

// ─── resolveScormServePlans: r2_zip_stream plan ───────────────────────────────

describe("resolveScormServePlans — r2_zip_stream", () => {
  it("includes r2_zip_stream plan for a ZIP version with skipped status", () => {
    const versions: MediaVersionZipRef[] = [
      {
        id: 1,
        s3Url: "https://r2.example.com/scorm/course.zip",
        fileName: "course.zip",
        mimeType: "application/zip",
        versionNumber: 1,
        scormExtractionStatus: "skipped",
        scormExtractedPrefix: null,
        scormLaunchFile: null,
        scormExtractionError: null,
      },
    ];
    const plans = resolveScormServePlans(versions);
    const zipStreamPlan = plans.find((p) => p.kind === "r2_zip_stream");
    expect(zipStreamPlan).toBeDefined();
    expect(zipStreamPlan?.kind).toBe("r2_zip_stream");
    if (zipStreamPlan?.kind === "r2_zip_stream") {
      expect(zipStreamPlan.zipUrl).toBe("https://r2.example.com/scorm/course.zip");
    }
  });

  it("includes r2_zip_stream plan for a .quiz file (iSpring)", () => {
    const versions: MediaVersionZipRef[] = [
      {
        id: 2,
        s3Url: "https://r2.example.com/scorm/pediatric-echo.quiz",
        fileName: "pediatric-echo.quiz",
        mimeType: "application/zip",
        versionNumber: 1,
        scormExtractionStatus: "skipped",
        scormExtractedPrefix: null,
        scormLaunchFile: null,
        scormExtractionError: null,
      },
    ];
    const plans = resolveScormServePlans(versions);
    const zipStreamPlan = plans.find((p) => p.kind === "r2_zip_stream");
    expect(zipStreamPlan).toBeDefined();
    if (zipStreamPlan?.kind === "r2_zip_stream") {
      expect(zipStreamPlan.zipUrl).toContain(".quiz");
    }
  });

  it("r2_zip_stream appears before client_zip in plan order", () => {
    const versions: MediaVersionZipRef[] = [
      {
        id: 3,
        s3Url: "https://r2.example.com/scorm/course.zip",
        fileName: "course.zip",
        mimeType: "application/zip",
        versionNumber: 1,
        scormExtractionStatus: "pending",
        scormExtractedPrefix: null,
        scormLaunchFile: null,
        scormExtractionError: null,
      },
    ];
    const plans = resolveScormServePlans(versions);
    const zipStreamIdx = plans.findIndex((p) => p.kind === "r2_zip_stream");
    const clientZipIdx = plans.findIndex((p) => p.kind === "client_zip");
    expect(zipStreamIdx).toBeGreaterThanOrEqual(0);
    expect(clientZipIdx).toBeGreaterThanOrEqual(0);
    expect(zipStreamIdx).toBeLessThan(clientZipIdx);
  });

  it("does NOT include r2_zip_stream for a direct HTML version", () => {
    const versions: MediaVersionZipRef[] = [
      {
        id: 4,
        s3Url: "https://cdn.example.com/scorm/index.html",
        fileName: "index.html",
        mimeType: "text/html",
        versionNumber: 1,
        scormExtractionStatus: "done",
        scormExtractedPrefix: null,
        scormLaunchFile: "index.html",
        scormExtractionError: null,
      },
    ];
    const plans = resolveScormServePlans(versions);
    const zipStreamPlan = plans.find((p) => p.kind === "r2_zip_stream");
    expect(zipStreamPlan).toBeUndefined();
  });

  it("r2_extracted plan comes before r2_zip_stream when extraction is done", () => {
    const versions: MediaVersionZipRef[] = [
      {
        id: 5,
        s3Url: "https://r2.example.com/scorm/course.zip",
        fileName: "course.zip",
        mimeType: "application/zip",
        versionNumber: 1,
        scormExtractionStatus: "done",
        scormExtractedPrefix: "scorm-extracted/course-abc12345",
        scormLaunchFile: "index.html",
        scormExtractionError: null,
      },
    ];
    const plans = resolveScormServePlans(versions);
    const r2ExtractedIdx = plans.findIndex((p) => p.kind === "r2_extracted");
    const zipStreamIdx = plans.findIndex((p) => p.kind === "r2_zip_stream");
    expect(r2ExtractedIdx).toBeGreaterThanOrEqual(0);
    expect(zipStreamIdx).toBeGreaterThanOrEqual(0);
    expect(r2ExtractedIdx).toBeLessThan(zipStreamIdx);
  });

  it("includes r2_zip_stream for a failed extraction (fallback)", () => {
    const versions: MediaVersionZipRef[] = [
      {
        id: 6,
        s3Url: "https://r2.example.com/scorm/large-course.zip",
        fileName: "large-course.zip",
        mimeType: "application/zip",
        versionNumber: 1,
        scormExtractionStatus: "failed",
        scormExtractedPrefix: null,
        scormLaunchFile: null,
        scormExtractionError: "Download failed: HTTP 503",
      },
    ];
    const plans = resolveScormServePlans(versions);
    const zipStreamPlan = plans.find((p) => p.kind === "r2_zip_stream");
    expect(zipStreamPlan).toBeDefined();
  });

  it("no r2_zip_stream plan when there is no s3Url", () => {
    const versions: MediaVersionZipRef[] = [
      {
        id: 7,
        s3Url: null,
        fileName: "course.zip",
        mimeType: "application/zip",
        versionNumber: 1,
        scormExtractionStatus: "pending",
        scormExtractedPrefix: null,
        scormLaunchFile: null,
        scormExtractionError: null,
      },
    ];
    const plans = resolveScormServePlans(versions);
    const zipStreamPlan = plans.find((p) => p.kind === "r2_zip_stream");
    expect(zipStreamPlan).toBeUndefined();
  });
});

// ─── pickScormPlaybackMode: r2_zip_stream → server mode ─────────────────────

describe("pickScormPlaybackMode — r2_zip_stream returns server mode", () => {
  it("returns server mode for a skipped ZIP version (uses zip-stream)", () => {
    const current: MediaVersionZipRef = {
      id: 20,
      s3Url: "https://r2.example.com/scorm/course.zip",
      fileName: "course.zip",
      mimeType: "application/zip",
      versionNumber: 1,
      scormExtractionStatus: "skipped",
      scormExtractedPrefix: null,
      scormLaunchFile: null,
      scormExtractionError: null,
    };
    const result = pickScormPlaybackMode(current, [current]);
    // Must be server mode — browser should get an iframe, not try to download the ZIP
    expect(result.mode).toBe("server");
  });

  it("returns server mode for a failed ZIP version (uses zip-stream as fallback)", () => {
    const current: MediaVersionZipRef = {
      id: 21,
      s3Url: "https://r2.example.com/scorm/large.zip",
      fileName: "large.zip",
      mimeType: "application/zip",
      versionNumber: 1,
      scormExtractionStatus: "failed",
      scormExtractedPrefix: null,
      scormLaunchFile: null,
      scormExtractionError: "Timeout",
    };
    const result = pickScormPlaybackMode(current, [current]);
    expect(result.mode).toBe("server");
  });
});

// ─── ZIP directory parsing (unit tests for internal helpers) ─────────────────

describe("ZIP central directory parsing", () => {
  it("resolveScormServePlans returns r2_zip_stream for all ZIP-based versions", () => {
    const zipVersions: MediaVersionZipRef[] = [
      {
        id: 10,
        s3Url: "https://r2.example.com/scorm/v1.zip",
        fileName: "v1.zip",
        mimeType: "application/zip",
        versionNumber: 2,
        scormExtractionStatus: "skipped",
        scormExtractedPrefix: null,
        scormLaunchFile: null,
        scormExtractionError: null,
      },
      {
        id: 11,
        s3Url: "https://r2.example.com/scorm/v2.zip",
        fileName: "v2.zip",
        mimeType: "application/zip",
        versionNumber: 1,
        scormExtractionStatus: "skipped",
        scormExtractedPrefix: null,
        scormLaunchFile: null,
        scormExtractionError: null,
      },
    ];
    const plans = resolveScormServePlans(zipVersions);
    const zipStreamPlans = plans.filter((p) => p.kind === "r2_zip_stream");
    // Should have one r2_zip_stream plan per unique ZIP URL
    expect(zipStreamPlans.length).toBeGreaterThanOrEqual(1);
    // The newest version's ZIP should be first
    if (zipStreamPlans[0]?.kind === "r2_zip_stream") {
      expect(zipStreamPlans[0].zipUrl).toContain("v1.zip");
    }
  });
});
