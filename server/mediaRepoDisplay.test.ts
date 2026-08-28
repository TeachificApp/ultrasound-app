import { describe, expect, it } from "vitest";
import { resolveLessonMediaScormUrl } from "@shared/mediaRepoDisplay";

describe("resolveLessonMediaScormUrl", () => {
  it("uses linked interactive media assets", () => {
    const url = resolveLessonMediaScormUrl(
      { type: "embed", embedUrl: null, content: null },
      { slug: "pediatric-echo-exam", mediaType: "zip", fileName: "exam.zip" },
    );
    expect(url).toBe("/api/media/pediatric-echo-exam/scorm/");
  });

  it("detects .quiz archives stored as document media type", () => {
    const url = resolveLessonMediaScormUrl(
      { type: "download", content: "/api/media/registry-review-quiz/download", embedUrl: null },
      { slug: "registry-review-quiz", mediaType: "document", fileName: "registry-review.quiz" },
    );
    expect(url).toBe("/api/media/registry-review-quiz/scorm/");
  });

  it("renders legacy download lessons with media repo content as SCORM", () => {
    const url = resolveLessonMediaScormUrl(
      {
        type: "download",
        content: "/api/media/unlimited-registry-review-quiz-pediatric-echo-e684dd32/download",
        embedUrl: null,
      },
      null,
    );
    expect(url).toBe("/api/media/unlimited-registry-review-quiz-pediatric-echo-e684dd32/scorm/");
  });

  it("keeps plain PDF download lessons as non-SCORM", () => {
    const url = resolveLessonMediaScormUrl(
      { type: "download", content: "/api/media/study-guide/download", embedUrl: null },
      { slug: "study-guide", mediaType: "document", fileName: "study-guide.pdf" },
    );
    expect(url).toBeNull();
  });

  it("treats embed-type lessons with media repo URLs as SCORM", () => {
    const url = resolveLessonMediaScormUrl(
      { type: "embed", embedUrl: "/api/media/my-package/embed", content: null },
      null,
    );
    expect(url).toBe("/api/media/my-package/scorm/");
  });
});
