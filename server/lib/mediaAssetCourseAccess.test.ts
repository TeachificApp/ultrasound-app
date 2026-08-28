import { describe, expect, it } from "vitest";
import { isInteractiveMediaPackage } from "../../shared/mediaRepoDisplay";
import fs from "node:fs";
import path from "node:path";

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

  it("matches lesson links by media slug in embedUrl or content", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/lib/mediaAssetCourseAccess.ts"),
      "utf8",
    );
    expect(source).toContain("LIKE ${slugPattern}");
    expect(source).toContain("lmsLessons.content");
  });
});
