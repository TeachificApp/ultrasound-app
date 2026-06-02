import { describe, expect, it } from "vitest";
import {
  findScormLaunchFile,
  initialScormExtractionStatus,
  needsScormExtraction,
  shouldShowScormWaitingPage,
} from "./scormPackage";

describe("scormPackage", () => {
  it("needsScormExtraction includes scorm, zip, and lms types", () => {
    expect(needsScormExtraction({ mediaType: "scorm" })).toBe(true);
    expect(needsScormExtraction({ mediaType: "zip" })).toBe(true);
    expect(needsScormExtraction({ mediaType: "lms" })).toBe(true);
    expect(needsScormExtraction({ mediaType: "video" })).toBe(false);
  });

  it("needsScormExtraction detects zip by mime or filename", () => {
    expect(needsScormExtraction({ mediaType: "other", mimeType: "application/zip" })).toBe(true);
    expect(needsScormExtraction({ mediaType: "other", fileName: "course.zip" })).toBe(true);
  });

  it("initialScormExtractionStatus returns skipped for non-packages", () => {
    expect(initialScormExtractionStatus({ mediaType: "image" })).toBe("skipped");
    expect(initialScormExtractionStatus({ mediaType: "lms" })).toBe("pending");
  });

  it("findScormLaunchFile finds adlcp:scormtype sco resources", () => {
    const manifest = `<?xml version="1.0"?>
<manifest>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="story.html">
    </resource>
  </resources>
</manifest>`;
    expect(findScormLaunchFile(manifest)).toBe("story.html");
  });

  it("shouldShowScormWaitingPage returns false for stale pending", () => {
    const old = new Date(Date.now() - 10 * 60 * 1000);
    expect(
      shouldShowScormWaitingPage("pending", { createdAt: old, scormExtractionStartedAt: null })
    ).toBe(false);
  });

  it("shouldShowScormWaitingPage returns true for recent pending", () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(
      shouldShowScormWaitingPage("pending", { createdAt: recent, scormExtractionStartedAt: null })
    ).toBe(true);
  });
});
