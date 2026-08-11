import { describe, expect, it } from "vitest";
import {
  shouldNormalizeMirroredNonScormRecord,
  shouldPreserveScormExtractionState,
  shouldRunLegacyRailwayDatabaseMirror,
} from "./mirrorSync";

describe("Railway SCORM state preservation", () => {
  it("preserves live extraction and completion states through a database mirror", () => {
    expect(shouldPreserveScormExtractionState("pending")).toBe(true);
    expect(shouldPreserveScormExtractionState("processing")).toBe(true);
    expect(shouldPreserveScormExtractionState("done")).toBe(true);
    expect(shouldPreserveScormExtractionState("failed")).toBe(true);
  });

  it("does not restore legacy skipped states over a fresh managed queue", () => {
    expect(shouldPreserveScormExtractionState("skipped")).toBe(false);
    expect(shouldPreserveScormExtractionState(null)).toBe(false);
  });

  it("keeps destructive Railway database replacement disabled unless explicitly opted in", () => {
    expect(shouldRunLegacyRailwayDatabaseMirror({} as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldRunLegacyRailwayDatabaseMirror({ ENABLE_LEGACY_RAILWAY_DB_MIRROR: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("normalizes ordinary mirrored documents while preserving quiz archives", () => {
    expect(shouldNormalizeMirroredNonScormRecord({
      mediaType: "document",
      fileName: "Echocardiography Exam.pptx",
    })).toBe(true);
    expect(shouldNormalizeMirroredNonScormRecord({
      mediaType: "document",
      fileName: "registry-review.quiz",
    })).toBe(false);
  });
});
