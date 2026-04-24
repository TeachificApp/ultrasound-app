/**
 * certificateGenerator.ts
 * Generates a PDF certificate of completion using pdfkit.
 * Returns a Buffer containing the PDF bytes.
 */
import PDFDocument from "pdfkit";

export interface CertificateOptions {
  learnerName: string;
  courseTitle: string;
  issuedAt: Date;
  /** Optional credential string, e.g. "RVT, RDMS" */
  credentials?: string | null;
}

/** Hex brand colours */
const TEAL = "#189aa1";
const DARK = "#0e1e2e";
const GOLD = "#c9a84c";
const LIGHT_BG = "#f0fbfc";

export async function generateCertificatePdf(opts: CertificateOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;   // 841.89
    const H = doc.page.height;  // 595.28

    // ── Background ──────────────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill(LIGHT_BG);

    // ── Decorative border ───────────────────────────────────────────────────
    doc.rect(18, 18, W - 36, H - 36)
      .lineWidth(3)
      .stroke(TEAL);
    doc.rect(24, 24, W - 48, H - 48)
      .lineWidth(1)
      .stroke(GOLD);

    // ── Top teal header band ─────────────────────────────────────────────────
    doc.rect(18, 18, W - 36, 90).fill(DARK);

    // ── Brand name in header ─────────────────────────────────────────────────
    doc.font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#ffffff")
      .text("All About Ultrasound™", 0, 38, { align: "center" });

    doc.font("Helvetica")
      .fontSize(10)
      .fillColor(TEAL)
      .text("General & Vascular Ultrasound Clinical Intelligence", 0, 64, { align: "center" });

    // ── Certificate of Completion heading ────────────────────────────────────
    doc.font("Helvetica")
      .fontSize(13)
      .fillColor(TEAL)
      .text("CERTIFICATE OF COMPLETION", 0, 128, { align: "center", characterSpacing: 3 });

    // ── Decorative gold line ─────────────────────────────────────────────────
    doc.moveTo(W / 2 - 160, 150).lineTo(W / 2 + 160, 150).lineWidth(1).stroke(GOLD);

    // ── "This certifies that" ────────────────────────────────────────────────
    doc.font("Helvetica")
      .fontSize(12)
      .fillColor("#475569")
      .text("This certifies that", 0, 168, { align: "center" });

    // ── Learner name ─────────────────────────────────────────────────────────
    const displayName = opts.credentials
      ? `${opts.learnerName}, ${opts.credentials}`
      : opts.learnerName;

    doc.font("Helvetica-Bold")
      .fontSize(32)
      .fillColor(DARK)
      .text(displayName, 60, 192, { align: "center", width: W - 120 });

    // ── "has successfully completed" ─────────────────────────────────────────
    doc.font("Helvetica")
      .fontSize(12)
      .fillColor("#475569")
      .text("has successfully completed the course", 0, 248, { align: "center" });

    // ── Course title ─────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(TEAL)
      .text(opts.courseTitle, 80, 272, { align: "center", width: W - 160 });

    // ── Gold divider ─────────────────────────────────────────────────────────
    doc.moveTo(W / 2 - 160, 320).lineTo(W / 2 + 160, 320).lineWidth(1).stroke(GOLD);

    // ── Issue date ───────────────────────────────────────────────────────────
    const dateStr = opts.issuedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    doc.font("Helvetica")
      .fontSize(11)
      .fillColor("#64748b")
      .text(`Issued: ${dateStr}`, 0, 334, { align: "center" });

    // ── Signature line ───────────────────────────────────────────────────────
    const sigX = W / 2 - 80;
    doc.moveTo(sigX, 420).lineTo(sigX + 160, 420).lineWidth(1).stroke("#94a3b8");
    doc.font("Helvetica")
      .fontSize(10)
      .fillColor("#94a3b8")
      .text("Lara Williams, RVT, RDMS", sigX - 20, 428, { width: 200, align: "center" });
    doc.font("Helvetica")
      .fontSize(9)
      .fillColor("#94a3b8")
      .text("Founder, All About Ultrasound™", sigX - 20, 442, { width: 200, align: "center" });

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.rect(18, H - 50, W - 36, 32).fill(DARK);
    doc.font("Helvetica")
      .fontSize(9)
      .fillColor("#94a3b8")
      .text("www.allaboutultrasound.com  ·  © All About Ultrasound™", 0, H - 40, { align: "center" });

    doc.end();
  });
}
