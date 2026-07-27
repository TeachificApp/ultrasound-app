import { describe, it, expect } from "vitest";
import { overlayLearnerData } from "./lib/certificatePdfOverlay";
import { generateCertificatePdf } from "./lib/certificateGenerator";

/** pdfkit hex-encodes text in the content stream */
function toHex(str: string): string {
  return Buffer.from(str, "utf8").toString("hex").toLowerCase();
}

/**
 * Decode all TJ arrays in a PDF buffer and return the concatenated plain text.
 * This mirrors what a PDF viewer would render.
 */
function extractTextFromPdf(buf: Buffer): string {
  const txt = buf.toString("latin1");
  const parts: string[] = [];
  for (const m of txt.matchAll(/\[([^\]]+)\]\s*TJ/g)) {
    const hexChunks = [...m[1].matchAll(/<([0-9a-f]+)>/gi)];
    const allHex = hexChunks.map((c) => c[1]).join("");
    try {
      parts.push(Buffer.from(allHex, "hex").toString("utf8"));
    } catch { /* skip */ }
  }
  return parts.join(" ");
}

describe("certificatePdfOverlay", () => {
  it("replaces all three placeholder strings in a pdfkit-generated PDF", async () => {
    // Generate a sample PDF with placeholder strings
    const sampleBuffer = await generateCertificatePdf({
      learnerName: "",
      courseTitle: "",
      issuedAt: new Date("2026-01-15"),
      credentials: null,
      template: null,
      usePlaceholders: true,
    });

    // Verify placeholders appear in the rendered text
    const sampleText = extractTextFromPdf(sampleBuffer);
    expect(sampleText).toContain("{{LEARNER_NAME}}");
    expect(sampleText).toContain("{{COURSE_TITLE}}");
    expect(sampleText).toContain("{{ISSUED_DATE}}");

    // Apply overlay with real learner data
    const issuedAt = new Date("2026-07-27");
    const patched = await overlayLearnerData(sampleBuffer, {
      learnerName: "Jane Smith, RVT",
      courseTitle: "Advanced Echo Fundamentals",
      issuedAt,
    });

    const patchedText = extractTextFromPdf(patched);

    // Placeholders should be gone
    expect(patchedText).not.toContain("{{LEARNER_NAME}}");
    expect(patchedText).not.toContain("{{COURSE_TITLE}}");
    expect(patchedText).not.toContain("{{ISSUED_DATE}}");

    // Real values should be present
    expect(patchedText).toContain("Jane Smith, RVT");
    expect(patchedText).toContain("Advanced Echo Fundamentals");
    expect(patchedText).toContain("July 27, 2026");

    // Result should still be a valid PDF
    expect(patched.slice(0, 4).toString("ascii")).toBe("%PDF");
    expect(patched.length).toBeGreaterThan(1000);
  });

  it("returns original buffer if PDF cannot be parsed", async () => {
    const garbage = Buffer.from("not a pdf at all");
    const result = await overlayLearnerData(garbage, {
      learnerName: "Test",
      courseTitle: "Test Course",
      issuedAt: new Date(),
    });
    // Should fall back to original (pdf-lib validation fails, returns original)
    expect(result).toEqual(garbage);
  });
});
