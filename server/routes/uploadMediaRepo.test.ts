import { describe, expect, it } from "vitest";
import { buildInitialMediaVersionExtractionFields } from "./uploadMediaRepo";

describe("media upload extraction state", () => {
  it("marks a new document version skipped at upload time", () => {
    expect(buildInitialMediaVersionExtractionFields({
      mediaType: "document",
      fileName: "Echocardiography Exam.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    })).toEqual({
      scormExtractionStatus: "skipped",
      scormExtractionError: "Not a SCORM or iSpring quiz package; extraction is not required",
    });
  });

  it("keeps a SCORM archive pending at upload time", () => {
    expect(buildInitialMediaVersionExtractionFields({
      mediaType: "zip",
      fileName: "registry-review.zip",
      mimeType: "application/zip",
    })).toEqual({ scormExtractionStatus: "pending" });
  });
});
