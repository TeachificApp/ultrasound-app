/**
 * disclosurePdf.ts
 * Generates a PDF of a completed Financial Disclosure Form submission.
 * Matches the CardioServ ACCME format.
 */
import PDFDocument from "pdfkit";

const TEAL = "#189aa1";
const DARK = "#1a1a2e";
const GRAY = "#555555";
const LIGHT_GRAY = "#f5f5f5";
const BORDER = "#cccccc";
const MED_GRAY = "#888888";

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
      margins: { top: 45, bottom: 45, left: 50, right: 50 },
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

    const pageW = doc.page.width - 100; // usable width (612 - 100 = 512)
    let y = 45;

    // ─── Helper: ensure page space ────────────────────────────────────────────
    const ensureSpace = (needed: number) => {
      if (y + needed > doc.page.height - 50) {
        doc.addPage();
        y = 45;
      }
    };

    // ─── Header ───────────────────────────────────────────────────────────────
    doc.rect(50, y, pageW, 44).fill(TEAL);
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold")
      .text("Financial Disclosure Form", 60, y + 13, { width: pageW - 20 });
    y += 52;

    // Joint provider line
    doc.fillColor(MED_GRAY).fontSize(8).font("Helvetica-Oblique")
      .text("All About Ultrasound™ is a CME joint provider with CardioServ, LLC.", 50, y, { width: pageW });
    y += 14;

    // Pre-filled info box — 3 rows of 14px each + 8px padding = 50px total
    const infoBoxH = 52;
    doc.rect(50, y, pageW, infoBoxH).fill("#f0fafa").stroke(TEAL);
    const infoRows = [
      { label: "Faculty:", value: data.facultyName },
      { label: "Course:", value: data.courseTitle },
      { label: "Email:", value: data.facultyEmail },
    ];
    infoRows.forEach((row, i) => {
      const rowY = y + 6 + i * 15;
      doc.fillColor(TEAL).fontSize(8).font("Helvetica-Bold").text(row.label, 56, rowY);
      doc.fillColor(DARK).fontSize(8).font("Helvetica").text(row.value, 96, rowY, { width: pageW - 50 });
    });
    y += infoBoxH + 6;

    // ─── Intro paragraphs ─────────────────────────────────────────────────────
    ensureSpace(60);
    doc.fillColor(DARK).fontSize(8.5).font("Helvetica")
      .text(
        "As a prospective planner or faculty member, we would like to ask for your help in protecting our learning environment from industry influence. Please complete the form below.",
        50, y, { width: pageW, lineGap: 1.5 }
      );
    y += doc.heightOfString(
      "As a prospective planner or faculty member, we would like to ask for your help in protecting our learning environment from industry influence. Please complete the form below.",
      { width: pageW, fontSize: 8.5 }
    ) + 6;

    ensureSpace(55);
    doc.fillColor(DARK).fontSize(8.5).font("Helvetica")
      .text(
        "The ACCME Standards for Integrity and Independence require that individuals who refuse to disclose relevant financial relationships be disqualified from involvement in the planning and implementation of accredited continuing education. Thank you for your diligence and cooperation. If you have questions, please contact: admin@allaboutultrasound.com",
        50, y, { width: pageW, lineGap: 1.5 }
      );
    y += doc.heightOfString(
      "The ACCME Standards for Integrity and Independence require that individuals who refuse to disclose relevant financial relationships be disqualified from involvement in the planning and implementation of accredited continuing education. Thank you for your diligence and cooperation. If you have questions, please contact: admin@allaboutultrasound.com",
      { width: pageW, fontSize: 8.5 }
    ) + 8;

    // Italic bold heading
    ensureSpace(20);
    doc.fillColor(DARK).fontSize(8.5).font("Helvetica-BoldOblique")
      .text("To be Completed by Planner, Faculty, or Others Who May Control Educational Content", 50, y, { width: pageW });
    y += 14;

    ensureSpace(45);
    doc.fillColor(DARK).fontSize(8.5).font("Helvetica")
      .text(
        "Please disclose all financial relationships that you have had in the past 24 months with ineligible companies (see definition below). For each financial relationship, enter the name of the ineligible company and the nature of the financial relationship(s). There is no minimum financial threshold; please disclose all financial relationships, regardless of the amount or perceived relevance to the educational activity.",
        50, y, { width: pageW, lineGap: 1.5 }
      );
    y += doc.heightOfString(
      "Please disclose all financial relationships that you have had in the past 24 months with ineligible companies (see definition below). For each financial relationship, enter the name of the ineligible company and the nature of the financial relationship(s). There is no minimum financial threshold; please disclose all financial relationships, regardless of the amount or perceived relevance to the educational activity.",
      { width: pageW, fontSize: 8.5 }
    ) + 10;

    // ─── Role section ─────────────────────────────────────────────────────────
    ensureSpace(30);
    doc.rect(50, y, pageW, 16).fill(TEAL);
    doc.fillColor("white").fontSize(8.5).font("Helvetica-Bold")
      .text("A. Your Role in This Activity", 56, y + 4, { width: pageW - 12 });
    y += 20;

    if (data.roles.length > 0) {
      const rolesText = data.roles.map(r => `• ${r}`).join("   ");
      const rH = Math.max(doc.heightOfString(rolesText, { width: pageW - 10, fontSize: 8.5 }) + 10, 20);
      ensureSpace(rH);
      doc.rect(50, y, pageW, rH).fill(LIGHT_GRAY).stroke(BORDER);
      doc.fillColor(DARK).fontSize(8.5).font("Helvetica").text(rolesText, 56, y + 5, { width: pageW - 12 });
      y += rH + 8;
    } else {
      ensureSpace(20);
      doc.rect(50, y, pageW, 18).fill(LIGHT_GRAY).stroke(BORDER);
      doc.fillColor(MED_GRAY).fontSize(8.5).font("Helvetica-Oblique").text("No roles recorded", 56, y + 5);
      y += 26;
    }

    // ─── Definition table (3 columns) ─────────────────────────────────────────
    ensureSpace(120);
    const col1W = Math.floor(pageW * 0.30);
    const col2W = Math.floor(pageW * 0.45);
    const col3W = pageW - col1W - col2W;

    const defCol1 = "An ineligible company is any entity whose primary business is producing, marketing, selling, re-selling, or distributing healthcare products used by or on patients.\n\nFor specific examples of ineligible companies visit accme.org/standards.";
    const defCol2 = "Examples of financial relationships include employee, researcher, consultant, advisor, speaker, independent contractor (including contracted research), royalties or patent beneficiary, executive role, and ownership interest. Individual stocks and stock options should be disclosed; diversified mutual funds do not need to be disclosed. Research funding from ineligible companies should be disclosed by the principal or named investigator even if that individual's institution receives the research grant and manages the funds.";
    const defCol3 = "If the financial relationship existed during the last 24 months, but has now ended, please check the box in this column. This will help the education staff determine if any mitigation steps need to be taken.";

    const defH1 = doc.heightOfString(defCol1, { width: col1W - 10, fontSize: 7.5 }) + 20;
    const defH2 = doc.heightOfString(defCol2, { width: col2W - 10, fontSize: 7.5 }) + 20;
    const defH3 = doc.heightOfString(defCol3, { width: col3W - 10, fontSize: 7.5 }) + 20;
    const defH = Math.max(defH1, defH2, defH3);

    // Header row
    doc.rect(50, y, col1W, 16).fill(TEAL);
    doc.rect(50 + col1W, y, col2W, 16).fill(TEAL);
    doc.rect(50 + col1W + col2W, y, col3W, 16).fill(TEAL);
    doc.fillColor("white").fontSize(7.5).font("Helvetica-Bold")
      .text("Enter the Name of Ineligible Company", 54, y + 4, { width: col1W - 8 });
    doc.text("Enter the Nature of Financial Relationship", 54 + col1W, y + 4, { width: col2W - 8 });
    doc.text("Has the Relationship Ended?", 54 + col1W + col2W, y + 4, { width: col3W - 8 });
    y += 16;

    // Definition body row
    doc.rect(50, y, col1W, defH).fill(LIGHT_GRAY).stroke(BORDER);
    doc.rect(50 + col1W, y, col2W, defH).fill(LIGHT_GRAY).stroke(BORDER);
    doc.rect(50 + col1W + col2W, y, col3W, defH).fill(LIGHT_GRAY).stroke(BORDER);
    doc.fillColor(DARK).fontSize(7.5).font("Helvetica")
      .text(defCol1, 54, y + 5, { width: col1W - 10, lineGap: 1 });
    doc.text(defCol2, 54 + col1W, y + 5, { width: col2W - 10, lineGap: 1 });
    doc.text(defCol3, 54 + col1W + col2W, y + 5, { width: col3W - 10, lineGap: 1 });
    y += defH + 4;

    // ─── Relationship data rows ────────────────────────────────────────────────
    const rowH = 18;
    const dataRows = data.hasRelationships === "yes" && data.relationships.length > 0
      ? data.relationships
      : [];

    // Always show at least 6 blank rows if no data
    const displayRows = dataRows.length > 0 ? dataRows : Array(6).fill({ company: "", relationship: "", ended: false });

    for (let i = 0; i < displayRows.length; i++) {
      ensureSpace(rowH + 2);
      const rel = displayRows[i];
      const bg = i % 2 === 0 ? "white" : "#fafafa";
      doc.rect(50, y, col1W, rowH).fill(bg).stroke(BORDER);
      doc.rect(50 + col1W, y, col2W, rowH).fill(bg).stroke(BORDER);
      doc.rect(50 + col1W + col2W, y, col3W, rowH).fill(bg).stroke(BORDER);

      if (rel.company) {
        doc.fillColor(DARK).fontSize(8).font("Helvetica")
          .text(rel.company, 54, y + 5, { width: col1W - 10 });
        doc.text(rel.relationship, 54 + col1W, y + 5, { width: col2W - 10 });
        // Checkbox for ended
        const cbX = 50 + col1W + col2W + Math.floor(col3W / 2) - 5;
        const cbY = y + 4;
        doc.rect(cbX, cbY, 10, 10).stroke(DARK);
        if (rel.ended) {
          doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold").text("X", cbX + 1, cbY);
        }
      } else {
        // Empty row — just draw the checkbox outline
        const cbX = 50 + col1W + col2W + Math.floor(col3W / 2) - 5;
        doc.rect(cbX, y + 4, 10, 10).stroke(BORDER);
      }
      y += rowH;
    }
    y += 6;

    // ─── No relationships checkbox ────────────────────────────────────────────
    ensureSpace(24);
    const noRelX = 50;
    const noRelY = y;
    doc.rect(noRelX, noRelY, 10, 10).stroke(DARK);
    if (data.hasRelationships === "no") {
      doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold").text("X", noRelX + 1, noRelY);
    }
    doc.fillColor(DARK).fontSize(8.5).font("Helvetica")
      .text(
        "In the past 24 months, I have not had any financial relationships with any ineligible companies.",
        noRelX + 16, noRelY + 1, { width: pageW - 20 }
      );
    y += 18;

    // CardioServ notify note
    ensureSpace(16);
    doc.fillColor(MED_GRAY).fontSize(7.5).font("Helvetica-Oblique")
      .text(
        "*Notify CardioServ CME Program immediately if any new financial relationship with an ineligible company arises within 24 months following the date of this disclosure.",
        50, y, { width: pageW, lineGap: 1 }
      );
    y += doc.heightOfString(
      "*Notify CardioServ CME Program immediately if any new financial relationship with an ineligible company arises within 24 months following the date of this disclosure.",
      { width: pageW, fontSize: 7.5 }
    ) + 10;

    // ─── Attestation ──────────────────────────────────────────────────────────
    ensureSpace(50);
    doc.fillColor(DARK).fontSize(8.5).font("Helvetica-Bold")
      .text("I attest that the above information is correct as of this date of submission.", 50, y, { width: pageW });
    y += 16;

    // Signature box
    const sigW = 160;
    const sigH = 28;
    doc.rect(50, y, sigW, sigH).fill(LIGHT_GRAY).stroke(BORDER);
    if (data.attestationName) {
      doc.fillColor(DARK).fontSize(9).font("Helvetica-BoldOblique")
        .text(data.attestationName, 56, y + 8, { width: sigW - 12 });
    }
    doc.fillColor(MED_GRAY).fontSize(7).font("Helvetica")
      .text("Signature / Full Name", 50, y + sigH + 2, { width: sigW });

    // Date box
    const dateX = 50 + sigW + 20;
    doc.rect(dateX, y, 120, sigH).fill(LIGHT_GRAY).stroke(BORDER);
    const dateStr = data.attestationDate || data.submittedAt.toLocaleDateString("en-US");
    doc.fillColor(DARK).fontSize(9).font("Helvetica")
      .text(dateStr, dateX + 6, y + 8, { width: 108 });
    doc.fillColor(MED_GRAY).fontSize(7).font("Helvetica")
      .text("Date", dateX, y + sigH + 2, { width: 120 });

    y += sigH + 20;

    // Submission info
    ensureSpace(20);
    doc.fillColor(MED_GRAY).fontSize(7.5).font("Helvetica")
      .text(
        `Submitted electronically on ${data.submittedAt.toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
        50, y, { width: pageW }
      );

    // ─── Footer on all pages ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor(MED_GRAY).fontSize(7).font("Helvetica")
        .text(
          `Financial Disclosure Form  ·  All About Ultrasound™  ·  CME Joint Provider with CardioServ, LLC  ·  Submitted ${data.submittedAt.toLocaleDateString("en-US")}`,
          50, doc.page.height - 28, { width: pageW, align: "center" }
        );
    }

    doc.flushPages();
    doc.end();
  });
}
