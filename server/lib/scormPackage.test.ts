import { describe, expect, it } from "vitest";
import {
  findScormLaunchFile,
  initialScormExtractionStatus,
  needsScormExtraction,
  shouldShowScormWaitingPage,
  isZipStorageRef,
  pickScormPlaybackMode,
  isDirectHtmlScormVersion,
  resolveZipDownloadUrl,
  resolveScormServePlans,
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
describe("isZipStorageRef", () => {
  it("detects zip by url and filename", () => {
    expect(isZipStorageRef({ s3Url: "https://cdn/x/file.zip" })).toBe(true);
    expect(isZipStorageRef({ s3Url: "https://cdn/x/index.html" })).toBe(false);
    expect(isZipStorageRef({ fileName: "quiz.zip" })).toBe(true);
  });
});

describe("pickScormPlaybackMode", () => {
  it("uses server mode when current points at HTML but prefix exists", () => {
    expect(
      pickScormPlaybackMode(
        { s3Url: "https://cdn/index.html", scormExtractedPrefix: "scorm-extracted/foo" },
        []
      ).mode
    ).toBe("server");
  });

  it("finds zip from an older version when current is HTML", () => {
    const r = pickScormPlaybackMode(
      { s3Url: "https://cdn/index.html", versionNumber: 2 },
      [
        { s3Url: "https://cdn/quiz.zip", versionNumber: 2 },
        { s3Url: "https://cdn/old.zip", versionNumber: 1 },
      ]
    );
    expect(r.mode).toBe("clientZip");
    expect(r.zipS3Url).toContain(".zip");
  });

  it("uses server when current is HTML and no zip in history", () => {
    expect(
      pickScormPlaybackMode(
        { s3Url: "https://cdn/folder/index.html", versionNumber: 1 },
        [{ s3Url: "https://cdn/folder/index.html", versionNumber: 1 }]
      ).mode
    ).toBe("server");
  });
});
describe("resolveScormServePlans", () => {
  it("falls back to older HTML when latest is ZIP without extraction", () => {
    const plans = resolveScormServePlans([
      {
        versionNumber: 2,
        s3Url: "https://cdn/quiz.zip",
        fileName: "quiz.zip",
        scormExtractedPrefix: null,
      },
      {
        versionNumber: 1,
        s3Url: "https://cdn/folder/index.html",
        fileName: "index.html",
      },
    ]);
    expect(plans.some((p) => p.kind === "client_zip")).toBe(true);
    expect(plans.some((p) => p.kind === "direct_html")).toBe(true);
    expect(plans.find((p) => p.kind === "direct_html")?.kind).toBe("direct_html");
  });

  it("prefers R2 extracted prefix when present", () => {
    const plans = resolveScormServePlans([
      {
        versionNumber: 2,
        s3Url: "https://cdn/quiz.zip",
        scormExtractedPrefix: "scorm-extracted/foo-abc",
        scormLaunchFile: "index.html",
        scormExtractionStatus: "done",
      },
    ]);
    expect(plans[0].kind).toBe("r2_extracted");
  });
});

describe("isDirectHtmlScormVersion", () => {
  it("detects CDN index.html packages", () => {
    expect(
      isDirectHtmlScormVersion({
        s3Url: "https://cdn.example.com/My Quiz (Published)/index.html",
        fileName: "index.html",
      })
    ).toBe(true);
    expect(
      isDirectHtmlScormVersion({
        s3Url: "https://cdn.example.com/quiz.zip",
        fileName: "quiz.zip",
      })
    ).toBe(false);
  });
});
