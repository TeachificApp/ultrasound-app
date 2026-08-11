import { describe, expect, it } from "vitest";
import {
  resolveScormExtractionStage,
  summarizeScormExtractionStatuses,
} from "../../shared/scormExtractionWorkflow";
import { initialScormExtractionStatus } from "./scormPackage";

describe("resolveScormExtractionStage", () => {
  it("moves an uploaded SCORM archive through queued, extracting, and ready states", () => {
    const packageInput = { mediaType: "zip", fileName: "adult-echo-review.quiz" };

    const initialStatus = initialScormExtractionStatus(packageInput);
    expect(initialStatus).toBe("pending");
    expect(resolveScormExtractionStage({ ...packageInput, extractionStatus: initialStatus })).toBe("queued");
    expect(resolveScormExtractionStage({ ...packageInput, extractionStatus: "processing" })).toBe("extracting");
    expect(resolveScormExtractionStage({ ...packageInput, extractionStatus: "done" })).toBe("ready");
  });

  it("does not require Question Bank extraction for non-package media", () => {
    expect(resolveScormExtractionStage({ mediaType: "video", fileName: "intro.mp4" })).toBe("not_required");
  });

  it("covers the upload-to-ready flow and the corresponding live backfill counts", () => {
    const packageInput = { mediaType: "scorm", fileName: "registry-review.zip" };
    const uploaded = initialScormExtractionStatus(packageInput);
    const states = [
      resolveScormExtractionStage({ ...packageInput, extractionStatus: uploaded }),
      resolveScormExtractionStage({ ...packageInput, extractionStatus: "processing" }),
      resolveScormExtractionStage({ ...packageInput, extractionStatus: "done" }),
    ];

    expect(states).toEqual(["queued", "extracting", "ready"]);
    expect(summarizeScormExtractionStatuses([uploaded, "processing", "done", "failed", "skipped"])).toEqual({
      pending: 1,
      processing: 1,
      done: 1,
      failed: 1,
      skipped: 1,
    });
  });
});
