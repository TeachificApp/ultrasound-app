/**
 * certificatePdfOverlay.ts
 *
 * Fills AcroForm text fields in a custom PDF certificate template with real
 * learner data on certificate issuance.
 *
 * The downloaded sample PDF contains three named AcroForm text fields:
 *   "learner_name"  — learner's display name (with credentials if set)
 *   "course_title"  — course title
 *   "issued_date"   — formatted issue date (e.g. "July 27, 2026")
 *
 * The admin can open the sample in Acrobat/Preview, reposition and resize
 * these fields, then re-upload the edited PDF. On issuance, this module
 * fills the fields by name and flattens the form so the output is a
 * non-editable PDF.
 *
 * Falls back gracefully if the PDF has no AcroForm or the expected fields
 * are missing (e.g. a legacy plain-text template).
 */

import { PDFDocument, TextAlignment } from "pdf-lib";

export interface OverlayOptions {
  learnerName: string;
  courseTitle: string;
  issuedAt: Date;
  /** Optional CME/CE credit hours string, e.g. "1.5" */
  creditHours?: string | null;
}

/**
 * Fill AcroForm fields in a custom PDF template with real learner data,
 * then flatten the form so the result is a static, non-editable PDF.
 *
 * Falls back to the original buffer if the PDF cannot be parsed or has
 * no AcroForm fields.
 */
export async function overlayLearnerData(
  pdfBuffer: Buffer,
  opts: OverlayOptions
): Promise<Buffer> {
  const dateStr = opts.issuedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    // Fill each field if it exists — silently skip missing fields so legacy
    // templates (plain-text placeholders) degrade gracefully.
    const creditsValue = opts.creditHours
      ? `${opts.creditHours} CME Credit${parseFloat(opts.creditHours) !== 1 ? "s" : ""}`
      : "";

    const fieldMap: Record<string, string> = {
      learner_name: opts.learnerName,
      course_title: opts.courseTitle,
      issued_date:  dateStr,
      ...(creditsValue ? { credits: creditsValue } : {}),
    };

    // Fields that must always be left-aligned regardless of template definition.
    // The credits and issued_date fields in the ACCME template are stored as
    // center-aligned but the design requires them to share a left-aligned
    // starting position matching the "Type of Credit Awarded" label value.
    const forceLeftAlign = new Set(['credits', 'issued_date']);

    let filledCount = 0;
    for (const [fieldName, value] of Object.entries(fieldMap)) {
      try {
        const field = form.getTextField(fieldName);
        // Preserve the field's existing alignment before setting text.
        // pdf-lib resets alignment to Left when setText is called, so we
        // read it first and re-apply it afterwards.
        // Exception: fields in forceLeftAlign are always set to Left.
        let existingAlignment: TextAlignment | undefined;
        if (forceLeftAlign.has(fieldName)) {
          existingAlignment = TextAlignment.Left;
        } else {
          try {
            existingAlignment = field.getAlignment();
          } catch {
            // getAlignment may throw on older field definitions — ignore
          }
        }
        field.setText(value);
        if (existingAlignment !== undefined) {
          field.setAlignment(existingAlignment);
        }
        // Auto-scale the learner name font size so long names always fit.
        // We use a simple heuristic: base size 36pt, shrink by ~0.6pt per
        // character over 20 chars, with a floor of 18pt.
        if (fieldName === "learner_name") {
          const baseSize = 36;
          const floor = 18;
          const charCount = value.length;
          const size = charCount > 20
            ? Math.max(floor, baseSize - Math.floor((charCount - 20) * 0.65))
            : baseSize;
          field.setFontSize(size);
        }
        filledCount++;
      } catch {
        // Field not found — skip
      }
    }

    if (filledCount === 0) {
      // No AcroForm fields found — return original buffer unchanged.
      // The caller (lmsHelpers) will serve the raw PDF as-is.
      console.warn("[certificatePdfOverlay] No AcroForm fields found in template PDF — serving raw template");
      return pdfBuffer;
    }

    // Flatten the form so the filled values become static text and the
    // PDF is no longer editable.
    form.flatten();

    const saved = await pdfDoc.save();
    return Buffer.from(saved);
  } catch (err) {
    console.warn("[certificatePdfOverlay] Failed to fill PDF form fields, returning original:", err);
    return pdfBuffer;
  }
}
