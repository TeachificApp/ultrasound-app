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
  shouldUseBackgroundScormExtraction,
  SCORM_BACKGROUND_EXTRACT_BYTES,
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

  it("needsScormExtraction detects iSpring .quiz archives", () => {
    expect(
      needsScormExtraction({
        mediaType: "other",
        fileName: "UNLIMITED REGISTRY REVIEW QUIZ - PEDIATRIC ECHO.quiz",
        s3Url:
          "https://cdn.example.com/media-repo/quiz/v1-UNLIMITED REGISTRY REVIEW QUIZ - PEDIATRIC ECHO.quiz",
      }),
    ).toBe(true);
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
describe("shouldUseBackgroundScormExtraction", () => {
  it("requires background extract for large packages", () => {
    expect(
      shouldUseBackgroundScormExtraction({
        fileSize: SCORM_BACKGROUND_EXTRACT_BYTES + 1,
        scormExtractionStatus: "done",
      }),
    ).toBe(true);
  });

  it("allows small packages when extraction is done", () => {
    expect(
      shouldUseBackgroundScormExtraction({
        fileSize: 1024,
        scormExtractionStatus: "done",
      }),
    ).toBe(false);
  });
});

describe("isZipStorageRef", () => {
  it("detects zip by url and filename", () => {
    expect(isZipStorageRef({ s3Url: "https://cdn/x/file.zip" })).toBe(true);
    expect(isZipStorageRef({ s3Url: "https://cdn/x/index.html" })).toBe(false);
    expect(isZipStorageRef({ fileName: "quiz.zip" })).toBe(true);
  });

  it("detects iSpring .quiz files as zip archives", () => {
    expect(
      isZipStorageRef({
        s3Url:
          "https://pub.example.r2.dev/media-repo/unlimited-registry-review-quiz-pediatric-echo-8384d011/v1-UNLIMITED REGISTRY REVIEW QUIZ - PEDIATRIC ECHO.quiz",
        fileName: "UNLIMITED REGISTRY REVIEW QUIZ - PEDIATRIC ECHO.quiz",
        mimeType: "application/octet-stream",
      }),
    ).toBe(true);
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

  it("uses server mode when zip exists in history (r2_zip_stream takes priority over clientZip)", () => {
    // r2_zip_stream is added for all ZIP versions and always wins, so the browser
    // gets a server-side streaming iframe rather than client-side ZIP extraction.
    const r = pickScormPlaybackMode(
      { s3Url: "https://cdn/index.html", versionNumber: 2 },
      [
        { s3Url: "https://cdn/quiz.zip", versionNumber: 2 },
        { s3Url: "https://cdn/old.zip", versionNumber: 1 },
      ]
    );
    expect(r.mode).toBe("server");
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

  it("includes client_zip plan for iSpring .quiz packages", () => {
    const plans = resolveScormServePlans([
      {
        versionNumber: 1,
        s3Url:
          "https://cdn.example.com/v1-UNLIMITED REGISTRY REVIEW QUIZ - PEDIATRIC ECHO.quiz",
        fileName: "UNLIMITED REGISTRY REVIEW QUIZ - PEDIATRIC ECHO.quiz",
        mimeType: "application/octet-stream",
        scormExtractionStatus: "failed",
        scormExtractionError: "test",
      },
    ]);
    expect(plans.some((p) => p.kind === "client_zip")).toBe(true);
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
