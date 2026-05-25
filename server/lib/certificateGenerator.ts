/**
 * certificateGenerator.ts
 * Generates a PDF certificate of completion using pdfkit.
 * Returns a Buffer containing the PDF bytes.
 * Supports custom templates via lmsCertificateTemplates fields.
 */
import PDFDocument from "pdfkit";
import https from "https";
import http from "http";

export interface CertificateTemplate {
  primaryColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  signatureName?: string | null;
  signatureTitle?: string | null;
  signatureImageUrl?: string | null;
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

export async function generateCertificatePdf(opts: CertificateOptions): Promise<Buffer> {
  const tmpl = opts.template ?? {};

  // Resolve colors with fallback to brand defaults
  const TEAL = tmpl.primaryColor || "#189aa1";
  const GOLD = tmpl.accentColor || "#c9a84c";
  const DARK = tmpl.textColor || "#0e1e2e";
  const LIGHT_BG = "#f0fbfc";
  const orgName = tmpl.organizationName || "All About Ultrasound™";
  const sigName = tmpl.signatureName || "Lara Williams, RVT, RDMS";
  const sigTitle = tmpl.signatureTitle || `Founder, ${orgName}`;
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
    if (bgImageBuffer) {
      try {
        doc.image(bgImageBuffer, 0, 0, { width: W, height: H });
        // Semi-transparent overlay for readability (simulate with a light rect)
        doc.rect(0, 0, W, H).fillOpacity(0.7).fill("#ffffff").fillOpacity(1);
      } catch {
        doc.rect(0, 0, W, H).fill(LIGHT_BG);
      }
    } else {
      doc.rect(0, 0, W, H).fill(LIGHT_BG);
    }

    if (layout === "minimal") {
      // ── Minimal layout: clean lines, no heavy header band ──────────────────
      doc.moveTo(40, 40).lineTo(W - 40, 40).lineWidth(2).stroke(TEAL);
      doc.moveTo(40, H - 40).lineTo(W - 40, H - 40).lineWidth(2).stroke(TEAL);

      // Logo or org name at top
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

      const displayName = opts.credentials ? `${opts.learnerName}, ${opts.credentials}` : opts.learnerName;
      doc.font("Helvetica-Bold").fontSize(30).fillColor(DARK).text(displayName, 60, 172, { align: "center", width: W - 120 });

      doc.font("Helvetica").fontSize(12).fillColor("#475569").text("has successfully completed", 0, 230, { align: "center" });
      doc.font("Helvetica-Bold").fontSize(16).fillColor(TEAL).text(opts.courseTitle, 80, 254, { align: "center", width: W - 160 });

      doc.moveTo(W / 2 - 120, 300).lineTo(W / 2 + 120, 300).lineWidth(0.5).stroke(GOLD);

      const dateStr = opts.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      doc.font("Helvetica").fontSize(10).fillColor("#64748b").text(`Issued: ${dateStr}`, 0, 314, { align: "center" });

      // Signature
      const sigX = W / 2 - 80;
      doc.moveTo(sigX, 390).lineTo(sigX + 160, 390).lineWidth(0.5).stroke("#94a3b8");
      doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(sigName, sigX - 20, 398, { width: 200, align: "center" });
      doc.font("Helvetica").fontSize(8).fillColor("#94a3b8").text(sigTitle, sigX - 20, 410, { width: 200, align: "center" });

      doc.font("Helvetica").fontSize(8).fillColor("#94a3b8").text(footerText, 0, H - 32, { align: "center" });

    } else if (layout === "modern") {
      // ── Modern layout: left accent bar, asymmetric ─────────────────────────
      doc.rect(0, 0, 12, H).fill(TEAL);
      doc.rect(12, 0, 4, H).fill(GOLD);

      const lx = 50; // left content x

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

      const displayName = opts.credentials ? `${opts.learnerName}, ${opts.credentials}` : opts.learnerName;
      doc.font("Helvetica-Bold").fontSize(28).fillColor(DARK).text(displayName, lx, 164, { width: W - lx - 40 });

      doc.font("Helvetica").fontSize(11).fillColor("#475569").text("has successfully completed", lx, 220);
      doc.font("Helvetica-Bold").fontSize(16).fillColor(TEAL).text(opts.courseTitle, lx, 244, { width: W - lx - 40 });

      doc.moveTo(lx, 290).lineTo(lx + 240, 290).lineWidth(1).stroke(GOLD);

      const dateStr = opts.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      doc.font("Helvetica").fontSize(10).fillColor("#64748b").text(`Issued: ${dateStr}`, lx, 304);

      // Signature
      doc.moveTo(lx, 400).lineTo(lx + 160, 400).lineWidth(0.5).stroke("#94a3b8");
      doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(sigName, lx, 408);
      doc.font("Helvetica").fontSize(8).fillColor("#94a3b8").text(sigTitle, lx, 420);

      doc.rect(0, H - 40, W, 40).fill(DARK);
      doc.font("Helvetica").fontSize(8).fillColor("#94a3b8").text(footerText, 0, H - 26, { align: "center" });

    } else {
      // ── Classic layout (default) ────────────────────────────────────────────
      // Decorative border
      doc.rect(18, 18, W - 36, H - 36).lineWidth(3).stroke(TEAL);
      doc.rect(24, 24, W - 48, H - 48).lineWidth(1).stroke(GOLD);

      // Top header band
      doc.rect(18, 18, W - 36, 90).fill(DARK);

      // Logo or org name in header
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

      const displayName = opts.credentials ? `${opts.learnerName}, ${opts.credentials}` : opts.learnerName;
      doc.font("Helvetica-Bold").fontSize(32).fillColor(DARK).text(displayName, 60, 192, { align: "center", width: W - 120 });

      doc.font("Helvetica").fontSize(12).fillColor("#475569").text("has successfully completed the course", 0, 248, { align: "center" });
      doc.font("Helvetica-Bold").fontSize(18).fillColor(TEAL).text(opts.courseTitle, 80, 272, { align: "center", width: W - 160 });

      doc.moveTo(W / 2 - 160, 320).lineTo(W / 2 + 160, 320).lineWidth(1).stroke(GOLD);

      const dateStr = opts.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      doc.font("Helvetica").fontSize(11).fillColor("#64748b").text(`Issued: ${dateStr}`, 0, 334, { align: "center" });

      // Signature
      const sigX = W / 2 - 80;
      doc.moveTo(sigX, 420).lineTo(sigX + 160, 420).lineWidth(1).stroke("#94a3b8");
      doc.font("Helvetica").fontSize(10).fillColor("#94a3b8").text(sigName, sigX - 20, 428, { width: 200, align: "center" });
      doc.font("Helvetica").fontSize(9).fillColor("#94a3b8").text(sigTitle, sigX - 20, 442, { width: 200, align: "center" });

      // Footer
      doc.rect(18, H - 50, W - 36, 32).fill(DARK);
      doc.font("Helvetica").fontSize(9).fillColor("#94a3b8").text(footerText, 0, H - 40, { align: "center" });
    }

    doc.end();
  });
}
