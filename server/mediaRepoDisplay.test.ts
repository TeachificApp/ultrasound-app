import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isInteractiveMediaPackage,
  mediaRepoScormUrl,
  mediaRepoServeUrl,
  mediaRepoDownloadUrl,
  parseMediaRepoSlug,
  resolveScormEmbedSlug,
} from "../shared/mediaRepoDisplay";

describe("mediaRepoDisplay", () => {
  it("treats scorm, zip, and lms media types as interactive packages", () => {
    for (const type of ["scorm", "zip", "lms"]) {
      expect(isInteractiveMediaPackage(type, "file.bin")).toBe(true);
    }
  });

  it("does not treat generic html media type as a SCORM package", () => {
    expect(isInteractiveMediaPackage("html", "handout.html")).toBe(false);
  });

  it("detects SCORM archives by filename extension", () => {
    expect(isInteractiveMediaPackage("document", "ACS Flashcards.zip")).toBe(true);
    expect(isInteractiveMediaPackage("document", "ACS Flashcards.quiz")).toBe(true);
  });

  it("allows plain HTML and PDF files to use download URLs", () => {
    expect(isInteractiveMediaPackage("document", "guide.pdf")).toBe(false);
    expect(isInteractiveMediaPackage("html", "worksheet.html")).toBe(false);
    expect(mediaRepoServeUrl("worksheet", "html", "worksheet.html")).toBe(
      mediaRepoDownloadUrl("worksheet"),
    );
  });

  it("returns scorm viewer URL for interactive packages", () => {
    expect(mediaRepoServeUrl("acs-flashcards", "scorm", "deck.zip")).toBe(
      mediaRepoScormUrl("acs-flashcards"),
    );
  });

  it("returns download URL for static files", () => {
    expect(mediaRepoServeUrl("study-guide", "document", "guide.pdf")).toBe(
      "/api/media/study-guide/download",
    );
  });

  it("parses slug from Manus-era embed and download URLs", () => {
    expect(parseMediaRepoSlug("/api/media/acs-flashcards/embed")).toBe("acs-flashcards");
    expect(parseMediaRepoSlug("/media/acs-flashcards/scorm/")).toBe("acs-flashcards");
    expect(parseMediaRepoSlug("/api/media/acs-flashcards/download?access=x")).toBe("acs-flashcards");
  });

  it("resolves SCORM display block slug from legacy stored URLs", () => {
    expect(
      resolveScormEmbedSlug({
        mediaAssetUrl: "/api/media/acs-flashcards/embed",
        mediaAssetTitle: "ACS Flashcards",
      }),
    ).toBe("acs-flashcards");
    expect(
      resolveScormEmbedSlug({
        mediaAssetSlug: "acs-flashcards",
      }),
    ).toBe("acs-flashcards");
  });
});

describe("download route SCORM guard", () => {
  it("mediaServe redirects SCORM packages away from /download", () => {
    const source = readFileSync(join(process.cwd(), "server/routes/mediaServe.ts"), "utf8");
    expect(source).toContain("isInteractiveMediaPackage(asset.mediaType, fileName)");
    expect(source).toContain("redirect(302");
  });
});
