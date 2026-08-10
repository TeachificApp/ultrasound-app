import { describe, it, expect } from "vitest";
import { shouldUseBackgroundScormExtraction, SCORM_BACKGROUND_EXTRACT_BYTES } from "./scormPackage";

describe("scormQuestionBankImport prerequisites", () => {
  it("requires background extraction for packages over 50MB", () => {
    expect(
      shouldUseBackgroundScormExtraction({ fileSize: 407 * 1024 * 1024, scormExtractionStatus: "pending" })
    ).toBe(true);
  });

  it("marks large packages as background-only even when extraction is done", () => {
    expect(
      shouldUseBackgroundScormExtraction({ fileSize: 407 * 1024 * 1024, scormExtractionStatus: "done" })
    ).toBe(true);
  });

  it("allows small packages without background extraction", () => {
    expect(
      shouldUseBackgroundScormExtraction({ fileSize: 10 * 1024 * 1024, scormExtractionStatus: "skipped" })
    ).toBe(false);
  });

  it("uses 50MB threshold constant", () => {
    expect(SCORM_BACKGROUND_EXTRACT_BYTES).toBe(50 * 1024 * 1024);
  });
});
