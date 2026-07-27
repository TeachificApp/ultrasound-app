/**
 * certificateGenerator.ts
 * Generates a PDF certificate of completion using pdfkit for the visual design,
 * then optionally adds AcroForm text fields via pdf-lib for dynamic learner data.
 *
 * When usePlaceholders=true (sample download):
 *   - pdfkit renders the static design elements (background, borders, labels)
 *   - pdf-lib adds three named, styled, repositionable AcroForm text fields:
 *       "learner_name"  — positioned where the learner name renders
 *       "course_title"  — positioned where the course title renders
 *       "issued_date"   — positioned where the date renders
 *   - The admin can open the PDF in Acrobat/Preview and drag/resize these fields
 *
 * When usePlaceholders=false (real certificate issuance):
 *   - If pdfTemplateUrl is set, overlayLearnerData fills the AcroForm fields
 *   - Otherwise, pdfkit renders real learner data directly
 */
import PDFDocument from "pdfkit";
import https from "https";
import http from "http";
import { PDFDocument as LibPDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface CertificateTemplate {
  primaryColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  backgroundImageUrl?: string | null;
  logoUrl?: string | null;
  footerText?: string | null;
  organizationName?: string | null;
  layout?: "classic" | "modern" | "minimal" | null;
}

export interface CertificateOptions {
  learnerName: string;
  courseTitle: string;
  issuedAt: Date;
  /** Optional credential string, e.g. "RVT, RDMS" */
  credentials?: string | null;
  /** Optional template — falls back to hardcoded defaults if null */
  template?: CertificateTemplate | null;
  /**
   * When true, render the static design and add AcroForm fields for
   * learner_name, course_title, and issued_date instead of real data.
   * Defaults to false (real data rendered).
   */
  usePlaceholders?: boolean;
}

/** Fetch a URL and return a Buffer (used for logo/background images) */
function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Parse a CSS hex color string into pdf-lib rgb() values (0–1 range) */
function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Field definitions for the three dynamic data fields.
 * Coordinates are in PDF points from the bottom-left of an A4 landscape page
 * (W=841.89, H=595.28). These match the visual positions in the classic layout.
 * The admin can reposition them in Acrobat/Preview.
 */
interface FieldDef {
  name: string;
  label: string;
  /** x from left edge (points) */
  x: number;
  /** y from bottom edge (points) */
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

function getFieldDefs(layout: string, W: number, H: number): FieldDef[] {
  if (layout === "minimal") {
    return [
      { name: "learner_name",  label: "Learner Name",  x: 60,  y: H - 172 - 40, width: W - 120, height: 44, fontSize: 28 },
      { name: "course_title",  label: "Course Title",  x: 80,  y: H - 254 - 28, width: W - 160, height: 32, fontSize: 16 },
      { name: "issued_date",   label: "Issued Date",   x: 60,  y: H - 314 - 18, width: W - 120, height: 22, fontSize: 10 },
    ];
  }
  if (layout === "modern") {
    return [
      { name: "learner_name",  label: "Learner Name",  x: 50,  y: H - 164 - 40, width: W - 90,  height: 44, fontSize: 26 },
      { name: "course_title",  label: "Course Title",  x: 50,  y: H - 244 - 28, width: W - 90,  height: 32, fontSize: 16 },
      { name: "issued_date",   label: "Issued Date",   x: 50,  y: H - 304 - 18, width: 300,     height: 22, fontSize: 10 },
    ];
  }
  // classic (default)
  return [
    { name: "learner_name",  label: "Learner Name",  x: 60,  y: H - 192 - 44, width: W - 120, height: 48, fontSize: 30 },
    { name: "course_title",  label: "Course Title",  x: 80,  y: H - 272 - 30, width: W - 160, height: 34, fontSize: 18 },
    { name: "issued_date",   label: "Issued Date",   x: 60,  y: H - 334 - 20, width: W - 120, height: 24, fontSize: 11 },
  ];
}

/**
 * Add AcroForm text fields to a pdfkit-generated PDF buffer.
 * Fields are styled to match the certificate design and are repositionable
 * in any PDF editor.
 */
async function addAcroFormFields(
  pdfBuffer: Buffer,
  layout: string,
  TEAL: string,
  DARK: string,
): Promise<Buffer> {
  const pdfDoc = await LibPDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const page = pages[0];
  const { width: W, height: H } = page.getSize();

  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fieldDefs = getFieldDefs(layout, W, H);

  for (const fd of fieldDefs) {
    const field = form.createTextField(fd.name);
    field.setText(fd.label);  // Pre-fill with the label so admin sees the field name
    field.setAlignment(1 as any); // center
    field.addToPage(page, {
      x: fd.x,
      y: fd.y,
      width: fd.width,
      height: fd.height,
      textColor: hexToRgb(DARK),
      backgroundColor: rgb(0.95, 0.99, 1.0),  // very light teal tint
      borderColor: hexToRgb(TEAL),
      borderWidth: 1,
      font,
      fontSize: fd.fontSize,
    });
  }

  const saved = await pdfDoc.save();
  return Buffer.from(saved);
}

export async function generateCertificatePdf(opts: CertificateOptions): Promise<Buffer> {
  const tmpl = opts.template ?? {};

  // Resolve colors with fallback to brand defaults
  const TEAL = tmpl.primaryColor || "#189aa1";
  const GOLD = tmpl.accentColor || "#c9a84c";
  const DARK = tmpl.textColor || "#0e1e2e";
  const LIGHT_BG = "#f0fbfc";
  const orgName = tmpl.organizationName || "All About Ultrasound™";
  const footerText = tmpl.footerText || `www.allaboutultrasound.com  ·  © ${orgName}`;
  const layout = tmpl.layout || "classic";

  // Pre-fetch images if provided
  let bgImageBuffer: Buffer | null = null;
  let logoBuffer: Buffer | null = null;
  if (tmpl.backgroundImageUrl) {
    try { bgImageBuffer = await fetchBuffer(tmpl.backgroundImageUrl); } catch { /* ignore */ }
  }
  if (tmpl.logoUrl) {
    try { logoBuffer = await fetchBuffer(tmpl.logoUrl); } catch { /* ignore */ }
  }

  // When generating a placeholder PDF, we render the static design without
  // the dynamic text fields, then add AcroForm fields via pdf-lib.
  const ph = !!opts.usePlaceholders;

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      compress: false,  // keep uncompressed for easier pdf-lib processing
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;   // 841.89
    const H = doc.page.height;  // 595.28

    // ── Background ──────────────────────────────────────────────────────────
    if (bgImageBuffer) {
      try {
        doc.image(bgImageBuffer, 0, 0, { width: W, height: H });
        doc.rect(0, 0, W, H).fillOpacity(0.7).fill("#ffffff").fillOpacity(1);
      } catch {
        doc.rect(0, 0, W, H).fill(LIGHT_BG);
      }
    } else {
      doc.rect(0, 0, W, H).fill(LIGHT_BG);
    }

    // Resolve display values — when generating placeholders, leave space for
    // AcroForm fields (render nothing at those positions)
    const displayName = ph ? "" : (opts.credentials ? `${opts.learnerName}, ${opts.credentials}` : opts.learnerName);
    const courseTitle = ph ? "" : opts.courseTitle;
    const dateLabel = ph ? "" : `Issued: ${opts.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;

    if (layout === "minimal") {
      doc.moveTo(40, 40).lineTo(W - 40, 40).lineWidth(2).stroke(TEAL);
      doc.moveTo(40, H - 40).lineTo(W - 40, H - 40).lineWidth(2).stroke(TEAL);

      if (logoBuffer) {
        try { doc.image(logoBuffer, W / 2 - 60, 55, { width: 120, height: 60, fit: [120, 60] }); }
        catch { /* ignore */ }
        doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(orgName, 0, 122, { align: "center" });
      } else {
        doc.font("Helvetica-Bold").fontSize(20).fillColor(TEAL).text(orgName, 0, 55, { align: "center" });
      }

      doc.font("Helvetica").fontSize(11).fillColor("#64748b")
        .text("CERTIFICATE OF COMPLETION", 0, 110, { align: "center", characterSpacing: 2 });
      doc.moveTo(W / 2 - 120, 130).lineTo(W / 2 + 120, 130).lineWidth(0.5).stroke(GOLD);

      doc.font("Helvetica").fontSize(12).fillColor("#475569").text("This certifies that", 0, 148, { align: "center" });
      if (!ph) doc.font("Helvetica-Bold").fontSize(30).fillColor(DARK).text(displayName, 60, 172, { align: "center", width: W - 120 });

      doc.font("Helvetica").fontSize(12).fillColor("#475569").text("has successfully completed", 0, 230, { align: "center" });
      if (!ph) doc.font("Helvetica-Bold").fontSize(16).fillColor(TEAL).text(courseTitle, 80, 254, { align: "center", width: W - 160 });

      doc.moveTo(W / 2 - 120, 300).lineTo(W / 2 + 120, 300).lineWidth(0.5).stroke(GOLD);
      if (!ph) doc.font("Helvetica").fontSize(10).fillColor("#64748b").text(dateLabel, 0, 314, { align: "center" });

      doc.font("Helvetica").fontSize(8).fillColor("#94a3b8").text(footerText, 0, H - 32, { align: "center" });

    } else if (layout === "modern") {
      doc.rect(0, 0, 12, H).fill(TEAL);
      doc.rect(12, 0, 4, H).fill(GOLD);
      const lx = 50;

      if (logoBuffer) {
        try { doc.image(logoBuffer, lx, 30, { width: 100, height: 50, fit: [100, 50] }); }
        catch { /* ignore */ }
        doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(orgName, lx, 86);
      } else {
        doc.font("Helvetica-Bold").fontSize(18).fillColor(TEAL).text(orgName, lx, 40);
      }

      doc.font("Helvetica").fontSize(10).fillColor("#64748b")
        .text("CERTIFICATE OF COMPLETION", lx, 110, { characterSpacing: 2 });
      doc.moveTo(lx, 128).lineTo(lx + 240, 128).lineWidth(1).stroke(GOLD);

      doc.font("Helvetica").fontSize(11).fillColor("#475569").text("This certifies that", lx, 144);
      if (!ph) doc.font("Helvetica-Bold").fontSize(28).fillColor(DARK).text(displayName, lx, 164, { width: W - lx - 40 });

      doc.font("Helvetica").fontSize(11).fillColor("#475569").text("has successfully completed", lx, 220);
      if (!ph) doc.font("Helvetica-Bold").fontSize(16).fillColor(TEAL).text(courseTitle, lx, 244, { width: W - lx - 40 });

      doc.moveTo(lx, 290).lineTo(lx + 240, 290).lineWidth(1).stroke(GOLD);
      if (!ph) doc.font("Helvetica").fontSize(10).fillColor("#64748b").text(dateLabel, lx, 304);

      doc.rect(0, H - 40, W, 40).fill(DARK);
      doc.font("Helvetica").fontSize(8).fillColor("#94a3b8").text(footerText, 0, H - 26, { align: "center" });

    } else {
      // classic
      doc.rect(18, 18, W - 36, H - 36).lineWidth(3).stroke(TEAL);
      doc.rect(24, 24, W - 48, H - 48).lineWidth(1).stroke(GOLD);
      doc.rect(18, 18, W - 36, 90).fill(DARK);

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, W / 2 - 40, 22, { width: 80, height: 50, fit: [80, 50] });
          doc.font("Helvetica").fontSize(9).fillColor(TEAL).text(orgName, 0, 76, { align: "center" });
        } catch {
          doc.font("Helvetica-Bold").fontSize(22).fillColor("#ffffff").text(orgName, 0, 38, { align: "center" });
          doc.font("Helvetica").fontSize(10).fillColor(TEAL).text("General & Vascular Ultrasound Clinical Intelligence", 0, 64, { align: "center" });
        }
      } else {
        doc.font("Helvetica-Bold").fontSize(22).fillColor("#ffffff").text(orgName, 0, 38, { align: "center" });
        doc.font("Helvetica").fontSize(10).fillColor(TEAL).text("General & Vascular Ultrasound Clinical Intelligence", 0, 64, { align: "center" });
      }

      doc.font("Helvetica").fontSize(13).fillColor(TEAL)
        .text("CERTIFICATE OF COMPLETION", 0, 128, { align: "center", characterSpacing: 3 });
      doc.moveTo(W / 2 - 160, 150).lineTo(W / 2 + 160, 150).lineWidth(1).stroke(GOLD);

      doc.font("Helvetica").fontSize(12).fillColor("#475569").text("This certifies that", 0, 168, { align: "center" });
      if (!ph) doc.font("Helvetica-Bold").fontSize(32).fillColor(DARK).text(displayName, 60, 192, { align: "center", width: W - 120 });

      doc.font("Helvetica").fontSize(12).fillColor("#475569").text("has successfully completed the course", 0, 248, { align: "center" });
      if (!ph) doc.font("Helvetica-Bold").fontSize(18).fillColor(TEAL).text(courseTitle, 80, 272, { align: "center", width: W - 160 });

      doc.moveTo(W / 2 - 160, 320).lineTo(W / 2 + 160, 320).lineWidth(1).stroke(GOLD);
      if (!ph) doc.font("Helvetica").fontSize(11).fillColor("#64748b").text(dateLabel, 0, 334, { align: "center" });

      doc.rect(18, H - 50, W - 36, 32).fill(DARK);
      doc.font("Helvetica").fontSize(9).fillColor("#94a3b8").text(footerText, 0, H - 40, { align: "center" });
    }

    doc.end();
  });

  // When generating a sample/placeholder PDF, add AcroForm fields via pdf-lib
  if (ph) {
    return addAcroFormFields(pdfBuffer, layout, TEAL, DARK);
  }

  return pdfBuffer;
}
