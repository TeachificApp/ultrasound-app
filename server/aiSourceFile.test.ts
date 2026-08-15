import { describe, expect, it } from "vitest";
import { buildAiSourceMessage } from "./lib/aiSourceFile";

describe("AI source file input", () => {
  it("attaches a PDF as a file input while preserving the generation instruction", () => {
    const content = buildAiSourceMessage("Generate a course outline.", { url: "https://files.example/reference.pdf", mimeType: "application/pdf", name: "reference.pdf" });
    expect(Array.isArray(content)).toBe(true);
    expect(content).toContainEqual(expect.objectContaining({ type: "file_url", file_url: { url: "https://files.example/reference.pdf", mime_type: "application/pdf" } }));
    expect((content as any)[0].text).toContain("reference.pdf");
  });

  it("attaches an image as a high-detail vision input", () => {
    const content = buildAiSourceMessage("Generate questions.", { url: "https://files.example/scan.png", mimeType: "image/png", name: "scan.png" });
    expect(content).toContainEqual(expect.objectContaining({ type: "image_url", image_url: { url: "https://files.example/scan.png", detail: "high" } }));
  });
});
