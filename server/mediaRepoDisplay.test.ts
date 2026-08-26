import { describe, expect, it } from "vitest";
import {
  isInteractiveMediaPackage,
  mediaRepoScormUrl,
  mediaRepoServeUrl,
} from "../client/src/lib/mediaRepoDisplay";

describe("mediaRepoDisplay", () => {
  it("treats scorm, zip, lms, and html media types as interactive", () => {
    for (const type of ["scorm", "zip", "lms", "html"]) {
      expect(isInteractiveMediaPackage(type, "file.bin")).toBe(true);
    }
  });

  it("detects interactive packages by filename extension", () => {
    expect(isInteractiveMediaPackage("other", "ACS Flashcards.zip")).toBe(true);
    expect(isInteractiveMediaPackage("document", "ACS Flashcards.quiz")).toBe(true);
    expect(isInteractiveMediaPackage("document", "index.html")).toBe(true);
  });

  it("does not treat PDFs as interactive SCORM packages", () => {
    expect(isInteractiveMediaPackage("document", "guide.pdf")).toBe(false);
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
});
