import { describe, expect, it } from "vitest";
import { AI_SOURCE_BLIND_WRITING_RULE, AI_SOURCE_FILE_MAX_BYTES, buildAiSourceMessage, hasDirectAiSourceReference, isWithinAiSourceFileSizeLimit } from "./lib/aiSourceFile";

describe("AI source file input", () => {
  it("attaches a PDF as a file input while preserving the generation instruction", () => {
    const content = buildAiSourceMessage("Generate a course outline.", { url: "https://files.example/reference.pdf", mimeType: "application/pdf", name: "reference.pdf" });
    expect(Array.isArray(content)).toBe(true);
    expect(content).toContainEqual(expect.objectContaining({ type: "file_url", file_url: { url: "https://files.example/reference.pdf", mime_type: "application/pdf" } }));
    expect((content as any)[0].text).toContain("reference.pdf");
    expect((content as any)[0].text).toContain(AI_SOURCE_BLIND_WRITING_RULE);
  });

  it("attaches an image as a high-detail vision input", () => {
    const content = buildAiSourceMessage("Generate questions.", { url: "https://files.example/scan.png", mimeType: "image/png", name: "scan.png" });
    expect(content).toContainEqual(expect.objectContaining({ type: "image_url", image_url: { url: "https://files.example/scan.png", detail: "high" } }));
  });

  it("combines up to three reviewed source files and enforces the 50 MB per-file limit", () => {
    const content = buildAiSourceMessage("Generate from all sources.", [
      { url: "https://files.example/one.pdf", mimeType: "application/pdf", name: "one.pdf" },
      { url: "https://files.example/two.png", mimeType: "image/png", name: "two.png" },
      { url: "https://files.example/three.jpg", mimeType: "image/jpeg", name: "three.jpg" },
    ]);
    expect((content as any[]).filter(item => item.type !== "text")).toHaveLength(3);
    expect(isWithinAiSourceFileSizeLimit(AI_SOURCE_FILE_MAX_BYTES)).toBe(true);
    expect(isWithinAiSourceFileSizeLimit(AI_SOURCE_FILE_MAX_BYTES + 1)).toBe(false);
  });

  it("detects direct document-provenance and literal source wording", () => {
    expect(hasDirectAiSourceReference({ question: "According to the source document, what is measured?" })).toBe(true);
    expect(hasDirectAiSourceReference({ feedback: "The source of the Doppler signal is the transducer." })).toBe(true);
  });
});
