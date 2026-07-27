/**
 * certificatePdfOverlay.test.ts
 *
 * Tests the AcroForm-based certificate PDF overlay:
 * 1. generateCertificatePdf with usePlaceholders=true produces a PDF with
 *    three named AcroForm text fields (learner_name, course_title, issued_date).
 * 2. overlayLearnerData fills those fields with real learner data and flattens
 *    the form, producing a static PDF.
 * 3. overlayLearnerData returns the original buffer when the PDF has no AcroForm fields.
 */

import { describe, it, expect } from "vitest";
import { generateCertificatePdf } from "./lib/certificateGenerator";
import { overlayLearnerData } from "./lib/certificatePdfOverlay";
import { PDFDocument } from "pdf-lib";

describe("AcroForm certificate PDF overlay", () => {
  it("generates a placeholder PDF with three AcroForm text fields", async () => {
    const buf = await generateCertificatePdf({
      learnerName: "Test Learner",
      courseTitle: "Test Course",
      issuedAt: new Date("2026-01-15"),
      usePlaceholders: true,
    });

    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");

    // Load with pdf-lib and verify the three fields exist
    const pdfDoc = await PDFDocument.load(buf);
    const form = pdfDoc.getForm();
    const fieldNames = form.getFields().map((f) => f.getName());

    expect(fieldNames).toContain("learner_name");
    expect(fieldNames).toContain("course_title");
    expect(fieldNames).toContain("issued_date");
  });

  it("fills AcroForm fields with real learner data and flattens the form", async () => {
    // Generate a placeholder PDF (the template the admin would download)
    const templateBuf = await generateCertificatePdf({
      learnerName: "Placeholder",
      courseTitle: "Placeholder",
      issuedAt: new Date("2026-01-15"),
      usePlaceholders: true,
    });

    // Overlay real learner data
    const issuedAt = new Date("2026-07-27");
    const filled = await overlayLearnerData(templateBuf, {
      learnerName: "Jane Smith, RVT",
      courseTitle: "Advanced Echocardiography",
      issuedAt,
    });

    expect(filled.length).toBeGreaterThan(1000);
    expect(filled.slice(0, 4).toString("ascii")).toBe("%PDF");

    // After flattening, the form should have no interactive fields
    // (the filled text is embedded in the content stream, not as plain bytes)
    const pdfDoc2 = await PDFDocument.load(filled);
    expect(pdfDoc2.getForm().getFields().length).toBe(0);
  });

  it("returns original buffer when PDF has no AcroForm fields", async () => {
    // Generate a real (non-placeholder) certificate — no AcroForm fields
    const realBuf = await generateCertificatePdf({
      learnerName: "Jane Smith",
      courseTitle: "Test Course",
      issuedAt: new Date("2026-01-15"),
      usePlaceholders: false,
    });

    const result = await overlayLearnerData(realBuf, {
      learnerName: "Other Name",
      courseTitle: "Other Course",
      issuedAt: new Date("2026-01-15"),
    });

    // Should return the original buffer unchanged (no fields to fill)
    expect(result).toEqual(realBuf);
  });

  it("returns original buffer if PDF cannot be parsed", async () => {
    const garbage = Buffer.from("not a pdf at all");
    const result = await overlayLearnerData(garbage, {
      learnerName: "Test",
      courseTitle: "Test Course",
      issuedAt: new Date(),
    });
    expect(result).toEqual(garbage);
  });
});
