import { describe, expect, it } from "vitest";
import { isInteractiveMediaPackage } from "../../shared/mediaRepoDisplay";

describe("mediaAssetCourseAccess", () => {
  it("treats zip and lms media types as interactive lesson packages", () => {
    for (const mediaType of ["scorm", "zip", "lms"]) {
      expect(isInteractiveMediaPackage(mediaType, null)).toBe(true);
    }
  });

  it("detects interactive packages from archive filenames", () => {
    expect(isInteractiveMediaPackage("document", "registry-review.quiz")).toBe(true);
    expect(isInteractiveMediaPackage("document", "guide.pdf")).toBe(false);
  });
});
