import { describe, expect, it } from "vitest";
import {
  buildNoPendingScormDiagnostic,
  canStartQueuedScormExtraction,
  classifyScormExtractionFailure,
  nextScormStatusAfterInterruption,
  resolveScormWorkerDatabaseUrl,
  SCORM_RESUMABLE_STALL_THRESHOLD_MS,
  shouldRequeueStaleScormJob,
  shouldNormalizeNonScormPendingRecord,
  shouldUseDirectScormR2Upload,
  shouldUploadScormObject,
} from "./scormExtractor";

describe("SCORM extraction queue policy", () => {
  it("requeues interrupted extraction work instead of marking it skipped", () => {
    expect(nextScormStatusAfterInterruption()).toBe("pending");
  });

  it("starts a queued package only when no other extraction is active", () => {
    expect(canStartQueuedScormExtraction(0)).toBe(true);
    expect(canStartQueuedScormExtraction(1)).toBe(false);
  });

  it("selects Railway for managed Heartbeat extraction when the live media database is configured", () => {
    expect(resolveScormWorkerDatabaseUrl({ RAILWAY_MYSQL_URL: "mysql://railway.example/database" } as NodeJS.ProcessEnv))
      .toBe("mysql://railway.example/database");
    expect(resolveScormWorkerDatabaseUrl({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("explains when raw pending records are not eligible SCORM packages", () => {
    expect(buildNoPendingScormDiagnostic(19, true)).toEqual({
      database: "railway",
      rawPendingVersions: 19,
      message: "Pending versions exist, but none are eligible SCORM/ZIP/LMS packages for this worker",
    });
  });

  it("normalizes ordinary documents without bypassing a real iSpring archive", () => {
    expect(shouldNormalizeNonScormPendingRecord({
      mediaType: "document",
      fileName: "Echocardiography Exam.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    })).toBe(true);
    expect(shouldNormalizeNonScormPendingRecord({
      mediaType: "document",
      fileName: "registry-review.quiz",
      mimeType: "application/octet-stream",
    })).toBe(false);
  });

  it("makes unsupported and damaged archive failures actionable and final", () => {
    expect(classifyScormExtractionFailure("Launch file 'index.html' not found in extracted files. HTML files found: none"))
      .toMatchObject({ status: "skipped", error: expect.stringContaining("Unsupported") });
    expect(classifyScormExtractionFailure("FILE_ENDED"))
      .toMatchObject({ status: "failed", error: expect.stringContaining("Damaged archive") });
  });

  it("resumes a package by skipping R2 objects that were uploaded before interruption", () => {
    const existing = new Set(["scorm-extracted/example/index.html"]);
    expect(shouldUploadScormObject("scorm-extracted/example/index.html", existing)).toBe(false);
    expect(shouldUploadScormObject("scorm-extracted/example/data/slide.js", existing)).toBe(true);
  });

  it("requeues interrupted large packages quickly enough for resumable uploads to make progress", () => {
    expect(SCORM_RESUMABLE_STALL_THRESHOLD_MS).toBe(15 * 60 * 1000);
  });

  it("reclaims a stale active package even when the bulk date query would miss it", () => {
    const now = Date.UTC(2026, 7, 11, 18, 0, 0);
    expect(shouldRequeueStaleScormJob(new Date(now - SCORM_RESUMABLE_STALL_THRESHOLD_MS), now)).toBe(true);
    expect(shouldRequeueStaleScormJob(new Date(now - SCORM_RESUMABLE_STALL_THRESHOLD_MS + 1), now)).toBe(false);
    expect(shouldRequeueStaleScormJob(null, now)).toBe(true);
  });

  it("uses direct R2 streaming when extraction credentials are available", () => {
    expect(shouldUseDirectScormR2Upload({} as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldUseDirectScormR2Upload({
      CF_R2_ACCOUNT_ID: "account",
      CF_R2_ACCESS_KEY_ID: "key",
      CF_R2_SECRET_ACCESS_KEY: "secret",
    } as NodeJS.ProcessEnv)).toBe(true);
  });
});
