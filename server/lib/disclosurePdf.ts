/**
 * disclosurePdf.ts
 * Generates a PDF of a completed Financial Disclosure Form submission.
 * Used to attach to the notification email sent to admin/CardioServ.
 */
import PDFDocument from "pdfkit";

const TEAL = "#189aa1";
const DARK = "#1a1a2e";
const GRAY = "#555555";
const LIGHT_GRAY = "#f5f5f5";
const BORDER = "#dddddd";

export interface DisclosurePdfData {
  facultyName: string;
  facultyEmail: string;
  courseTitle: string;
  roles: string[];
  hasRelationships: "yes" | "no";
  relationships: Array<{ company: string; relationship: string; ended: boolean }>;
  attestationName: string;
  attestationDate: string;
  submittedAt: Date;
}

export async function generateDisclosurePdf(data: DisclosurePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: "Financial Disclosure Form — " + data.facultyName,
        Author: "All About Ultrasound",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100;
    let y = 50;

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(50, y, pageWidth, 44).fill(TEAL);
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold")
      .text("Financial Disclosure Form", 60, y + 13, { width: pageWidth - 20 });
    y += 58;

    // ── Helper ────────────────────────────────────────────────────────────────
    const row = (labelText: string, value: string) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
      doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold").text(labelText.toUpperCase(), 55, y);
      y += 12;
      doc.rect(55, y, pageWidth - 10, 20).fill(LIGHT_GRAY).stroke(BORDER);
      doc.fillColor(DARK).fontSize(9).font("Helvetica").text(value || "—", 60, y + 5, { width: pageWidth - 20 });
      y += 26;
    };

    // ── Section 1: Faculty Info ───────────────────────────────────────────────
    doc.rect(50, y, pageWidth, 22).fill(TEAL);
    doc.fillColor("white").fontSize(10).font("Helvetica-Bold")
      .text("Section 1: Faculty Information", 58, y + 6, { width: pageWidth - 16 });
    y += 28;

    row("Faculty Name", data.facultyName);
    row("Faculty Email", data.facultyEmail);
    row("Course / Activity", data.courseTitle);
    row("Submission Date", data.submittedAt.toLocaleString("en-US", { timeZone: "America/New_York" }) + " ET");
    y += 8;

    // ── Section 2: Role(s) ────────────────────────────────────────────────────
    if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
    doc.rect(50, y, pageWidth, 22).fill(TEAL);
    doc.fillColor("white").fontSize(10).font("Helvetica-Bold")
      .text("Section 2: Role(s) in this Activity", 58, y + 6, { width: pageWidth - 16 });
    y += 28;

    if (data.roles.length === 0) {
      row("Roles Selected", "None recorded");
    } else {
      doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold").text("ROLES SELECTED", 55, y);
      y += 12;
      const rolesText = data.roles.map(r => `• ${r}`).join("\n");
      const rolesH = Math.max(doc.heightOfString(rolesText, { width: pageWidth - 20, fontSize: 9 }) + 14, 30);
      doc.rect(55, y, pageWidth - 10, rolesH).fill(LIGHT_GRAY).stroke(BORDER);
      doc.fillColor(DARK).fontSize(9).font("Helvetica").text(rolesText, 60, y + 5, { width: pageWidth - 20 });
      y += rolesH + 8;
    }
    y += 8;

    // ── Section 3: Financial Relationships ───────────────────────────────────
    if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
    doc.rect(50, y, pageWidth, 22).fill(TEAL);
    doc.fillColor("white").fontSize(10).font("Helvetica-Bold")
      .text("Section 3: Financial Relationships", 58, y + 6, { width: pageWidth - 16 });
    y += 28;

    if (data.hasRelationships === "no" || data.relationships.length === 0) {
      // Green "no relationships" box
      doc.rect(55, y, pageWidth - 10, 28).fill("#f0fff4").stroke("#86efac");
      doc.fillColor("#166534").fontSize(9).font("Helvetica-Bold")
        .text("✓ No financial relationships to disclose", 60, y + 9, { width: pageWidth - 20 });
      y += 36;
    } else {
      // Table header
      const col1 = (pageWidth - 10) * 0.4;
      const col2 = (pageWidth - 10) * 0.4;
      const col3 = (pageWidth - 10) * 0.2;
      doc.rect(55, y, pageWidth - 10, 18).fill(TEAL);
      doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
        .text("Company / Entity", 60, y + 4, { width: col1 - 5 });
      doc.text("Relationship Type", 60 + col1, y + 4, { width: col2 - 5 });
      doc.text("Ended?", 60 + col1 + col2, y + 4, { width: col3 - 5 });
      y += 18;

      data.relationships.forEach((rel, i) => {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
        const bg = i % 2 === 0 ? LIGHT_GRAY : "white";
        doc.rect(55, y, pageWidth - 10, 18).fill(bg).stroke(BORDER);
        doc.fillColor(DARK).fontSize(8).font("Helvetica")
          .text(rel.company || "—", 60, y + 4, { width: col1 - 5 });
        doc.text(rel.relationship || "—", 60 + col1, y + 4, { width: col2 - 5 });
        doc.text(rel.ended ? "Yes" : "No", 60 + col1 + col2, y + 4, { width: col3 - 5 });
        y += 18;
      });
      y += 8;
    }
    y += 8;

    // ── Section 4: Attestation ────────────────────────────────────────────────
    if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
    doc.rect(50, y, pageWidth, 22).fill(TEAL);
    doc.fillColor("white").fontSize(10).font("Helvetica-Bold")
      .text("Section 4: Attestation", 58, y + 6, { width: pageWidth - 16 });
    y += 28;

    const attestText = "I attest that the information provided in this disclosure is accurate and complete to the best of my knowledge. I understand that all financial relationships must be disclosed and that any identified conflicts of interest will be managed prior to my participation in this CME activity.";
    const attestH = doc.heightOfString(attestText, { width: pageWidth - 20, fontSize: 9 }) + 14;
    doc.rect(55, y, pageWidth - 10, attestH).fill(LIGHT_GRAY).stroke(BORDER);
    doc.fillColor(DARK).fontSize(9).font("Helvetica").text(attestText, 60, y + 7, { width: pageWidth - 20 });
    y += attestH + 10;

    row("Signed By (Full Name)", data.attestationName);
    row("Date", data.attestationDate || data.submittedAt.toLocaleDateString("en-US"));

    // ── Footer ────────────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor(GRAY).fontSize(7).font("Helvetica")
        .text(
          `© All About Ultrasound — Financial Disclosure Form — Submitted ${data.submittedAt.toLocaleDateString("en-US")}`,
          50, doc.page.height - 30, { width: pageWidth, align: "center" }
        );
    }

    doc.flushPages();
    doc.end();
  });
}
