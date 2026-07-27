/**
 * certificatePdfOverlay.ts
 *
 * Replaces placeholder text in pdfkit-generated PDF certificate templates with
 * real learner data on certificate issuance.
 *
 * pdfkit stores text using the TJ operator with hex-encoded strings and kerning
 * adjustments, e.g.:
 *   [<48656c6c6f> 50 <20576f726c64> 0] TJ
 *
 * Long strings are split into multiple hex chunks with kerning numbers between
 * them. This module reassembles the full text from each TJ array, checks if it
 * contains a placeholder, and replaces the entire TJ array with a new one that
 * renders the replacement value as a single un-kerned hex string.
 *
 * Supported placeholders (visible in the downloaded sample PDF):
 *   {{LEARNER_NAME}}   → learner's display name (with credentials if set)
 *   {{COURSE_TITLE}}   → course title
 *   {{ISSUED_DATE}}    → formatted issue date (e.g. "July 27, 2026")
 *
 * Admin workflow:
 * 1. Download the sample PDF — placeholders appear as visible text.
 * 2. Edit the design in any PDF editor without changing the placeholder strings.
 * 3. Re-upload the edited PDF.
 * 4. On issuance, this module swaps the placeholders for real learner data.
 */

import { PDFDocument } from "pdf-lib";

export interface OverlayOptions {
  learnerName: string;
  courseTitle: string;
  issuedAt: Date;
}

/** Convert a UTF-8 string to its lowercase hex representation */
function toHex(str: string): string {
  return Buffer.from(str, "utf8").toString("hex").toLowerCase();
}

/**
 * Decode a pdfkit TJ array into the plain text it renders.
 * TJ arrays look like: [<hex1> num <hex2> num ... <hexN> 0]
 * We concatenate all hex chunks and ignore the kerning numbers.
 */
function decodeTJArray(tjContent: string): string {
  const hexChunks = [...tjContent.matchAll(/<([0-9a-f]+)>/gi)];
  const allHex = hexChunks.map((m) => m[1]).join("");
  try {
    return Buffer.from(allHex, "hex").toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Build a replacement TJ array that renders `text` as a single hex string
 * with no kerning. Preserves the surrounding [ ] brackets.
 */
function buildTJArray(text: string): string {
  const hex = toHex(text);
  return `[<${hex}> 0] TJ`;
}

/**
 * Replace placeholder strings in a pdfkit-generated PDF buffer with real learner data.
 *
 * Scans all TJ arrays in the PDF content streams, decodes the text they render,
 * and replaces any that contain a placeholder with a new TJ array containing the
 * real value. After patching, pdf-lib re-serialises the document to fix the xref.
 *
 * Falls back to the original buffer if parsing or patching fails.
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

  const replacements: [string, string][] = [
    ["{{LEARNER_NAME}}", opts.learnerName],
    ["{{COURSE_TITLE}}", opts.courseTitle],
    ["{{ISSUED_DATE}}", dateStr],
    // Handle the compound form used by the generator
    [`Issued: {{ISSUED_DATE}}`, `Issued: ${dateStr}`],
  ];

  try {
    let pdfString = pdfBuffer.toString("latin1");

    // Match all TJ arrays: [...] TJ  (handles both single-line and multi-chunk forms)
    // The regex captures everything between [ and ] followed by optional whitespace and TJ
    pdfString = pdfString.replace(/\[([^\]]+)\]\s*TJ/g, (match, tjContent) => {
      const decoded = decodeTJArray(tjContent);
      if (!decoded) return match;

      // Check if any placeholder appears in the decoded text
      for (const [placeholder, value] of replacements) {
        if (decoded.includes(placeholder)) {
          // Replace the placeholder in the decoded text and rebuild the TJ array
          const newText = decoded.split(placeholder).join(value);
          return buildTJArray(newText);
        }
      }
      return match;
    });

    const patched = Buffer.from(pdfString, "latin1");

    // Re-serialise with pdf-lib to fix the cross-reference table
    const pdfDoc = await PDFDocument.load(patched, { ignoreEncryption: true });
    const fixed = await pdfDoc.save();
    return Buffer.from(fixed);
  } catch (err) {
    console.warn("[certificatePdfOverlay] Failed to patch PDF, returning original:", err);
    return pdfBuffer;
  }
}
