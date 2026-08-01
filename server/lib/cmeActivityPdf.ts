/**
 * cmeActivityPdf.ts
 * Generates a PDF version of the CME Activity Planning and Proposal Form
 * using PDFKit (already installed in the project).
 */
import PDFDocument from "pdfkit";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CmeFormDataForPdf {
  activityTitle?: string | null;
  activityType?: string | null;
  proposedDate?: string | null;
  activityLengthHours?: string | null;
  cmeCreditsRequested?: string | null;
  offerMocCredit?: string | null;
  offeredMoreThanOnce?: string | null;
  activityStructure?: string | null;
  targetAudience?: string | null;
  estimatedLearners?: string | null;
  practiceGapDescription?: string | null;
  practiceGapReasons?: string | null;
  improvementTypes?: string | null;
  improvementKnowledgeText?: string | null;
  improvementCompetenceText?: string | null;
  improvementPerformanceText?: string | null;
  learnerOutcomes?: string | null;
  learningObjectives?: string | null;
  deliveryDescription?: string | null;
  activityIncludes?: string | null;
  assessmentMethods?: string | null;
  facultyJson?: string | null;
  contentStatus?: string | null;
  contentAvailableDate?: string | null;
  marketingChannels?: string | null;
  marketingMentionsCme?: string | null;
  registrationFee?: string | null;
  attestationName?: string | null;
  attestationDate?: string | null;
  attestationTitle?: string | null;
  signatureDataUrl?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseArr(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

function parseFaculty(val: string | null | undefined): Array<{ name: string; credentials: string; role: string }> {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

const LABEL_MAP: Record<string, string> = {
  enduring: "Enduring (online/on-demand)",
  live: "Live (in-person or webinar)",
  blended: "Blended",
  ongoing: "Ongoing (self-paced)",
  single_session: "Single session",
  multi_session: "Multi-session series",
  sonographers: "Sonographers / Diagnostic Medical Sonographers",
  echocardiographers: "Echocardiographers / Cardiac Sonographers",
  cardiovascular_techs: "Cardiovascular Technologists",
  nurses: "Nurses / APRNs",
  physicians: "Physicians / Cardiologists",
  multi_disciplinary: "Multi-disciplinary clinical team",
  fully_developed: "Fully developed",
  partially_developed: "Partially developed",
  outline_only: "Outline only",
  not_yet_started: "Not yet started",
  knowledge_check: "Knowledge check / quiz",
  case_studies: "Case studies",
  video_demonstrations: "Video demonstrations",
  interactive_modules: "Interactive modules",
  downloadable_resources: "Downloadable resources",
  post_test: "Post-test",
  learner_evaluation: "Learner evaluation / satisfaction survey",
  pre_post_test: "Pre/post-test comparison",
  performance_improvement: "Performance improvement module",
  email: "Email list",
  website: "Website",
  social_media: "Social media",
  institutional: "Institutional promotion",
  conference: "Conference-based",
  other: "Other",
  yes: "Yes",
  no: "No",
  not_yet_determined: "Not yet determined",
};

function label(val: string | null | undefined): string {
  if (!val) return "—";
  return LABEL_MAP[val] ?? val;
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const TEAL = "#189aa1";
const DARK = "#1a1a2e";
const GRAY = "#555555";
const LIGHT_GRAY = "#f5f5f5";
const BORDER = "#dddddd";

// ─── PDF Generator ────────────────────────────────────────────────────────────
export async function generateCmeActivityPdf(data: CmeFormDataForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: "CME Activity Planning and Proposal Form",
        Author: "All About Ultrasound",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100; // margins
    let y = 50;

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(50, y, pageWidth, 60).fill(TEAL);
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold")
      .text("CME Activity Planning and Proposal Form", 60, y + 10, { width: pageWidth - 20 });
    doc.fontSize(10).font("Helvetica")
      .text("All About Ultrasound — CardioServ Joint Provider Submission", 60, y + 32, { width: pageWidth - 20 });
    y += 75;

    // ── Helper functions ──────────────────────────────────────────────────────
    const sectionHeader = (num: number, title: string) => {
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
      doc.rect(50, y, pageWidth, 22).fill(TEAL);
      doc.fillColor("white").fontSize(10).font("Helvetica-Bold")
        .text(`Section ${num}: ${title}`, 58, y + 6, { width: pageWidth - 16 });
      y += 28;
    };

    const field = (labelText: string, value: string | null | undefined, opts?: { multiline?: boolean }) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
      const val = value?.trim() || "—";
      doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold").text(labelText.toUpperCase(), 55, y);
      y += 12;
      if (opts?.multiline) {
        const textHeight = doc.heightOfString(val, { width: pageWidth - 10, fontSize: 9 });
        const boxH = Math.max(textHeight + 10, 30);
        doc.rect(55, y, pageWidth - 10, boxH).fill(LIGHT_GRAY).stroke(BORDER);
        doc.fillColor(DARK).fontSize(9).font("Helvetica").text(val, 60, y + 5, { width: pageWidth - 20 });
        y += boxH + 8;
      } else {
        doc.rect(55, y, pageWidth - 10, 20).fill(LIGHT_GRAY).stroke(BORDER);
        doc.fillColor(DARK).fontSize(9).font("Helvetica").text(val, 60, y + 5, { width: pageWidth - 20 });
        y += 26;
      }
    };

    const twoFields = (l1: string, v1: string | null | undefined, l2: string, v2: string | null | undefined) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
      const half = (pageWidth - 10) / 2;
      doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold").text(l1.toUpperCase(), 55, y);
      doc.text(l2.toUpperCase(), 55 + half + 10, y);
      y += 12;
      doc.rect(55, y, half, 20).fill(LIGHT_GRAY).stroke(BORDER);
      doc.fillColor(DARK).fontSize(9).font("Helvetica").text(v1?.trim() || "—", 60, y + 5, { width: half - 10 });
      doc.rect(55 + half + 10, y, half, 20).fill(LIGHT_GRAY).stroke(BORDER);
      doc.text(v2?.trim() || "—", 60 + half + 10, y + 5, { width: half - 10 });
      y += 26;
    };

    const listField = (labelText: string, items: string[]) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
      doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold").text(labelText.toUpperCase(), 55, y);
      y += 12;
      const text = items.length ? items.map(i => `• ${label(i)}`).join("\n") : "—";
      const textHeight = doc.heightOfString(text, { width: pageWidth - 20, fontSize: 9 });
      const boxH = Math.max(textHeight + 10, 24);
      doc.rect(55, y, pageWidth - 10, boxH).fill(LIGHT_GRAY).stroke(BORDER);
      doc.fillColor(DARK).fontSize(9).font("Helvetica").text(text, 60, y + 5, { width: pageWidth - 20 });
      y += boxH + 8;
    };

    const spacer = (h = 8) => { y += h; };

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 1: Activity Overview
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader(1, "Activity Overview");
    field("Activity Title", data.activityTitle);
    twoFields("Activity Type", label(data.activityType), "Activity Structure", label(data.activityStructure));
    twoFields("Proposed Date(s)", data.proposedDate, "Activity Length (Hours)", data.activityLengthHours);
    twoFields("CME Credits Requested", data.cmeCreditsRequested, "Offer MOC Credit?", label(data.offerMocCredit));
    twoFields("Offered More Than Once?", label(data.offeredMoreThanOnce), "Target Audience", label(data.targetAudience));
    field("Estimated Number of Learners", data.estimatedLearners);
    spacer();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 2: Professional Practice Gap
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader(2, "Professional Practice Gap");
    field("Practice Gap Description", data.practiceGapDescription, { multiline: true });
    field("Reasons for Practice Gap", data.practiceGapReasons, { multiline: true });
    spacer();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 3: Educational Needs & Improvement Types
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader(3, "Educational Needs & Desired Results");
    listField("Areas of Improvement", parseArr(data.improvementTypes));
    if (parseArr(data.improvementTypes).includes("knowledge")) {
      field("Knowledge Improvement", data.improvementKnowledgeText, { multiline: true });
    }
    if (parseArr(data.improvementTypes).includes("competence")) {
      field("Competence Improvement", data.improvementCompetenceText, { multiline: true });
    }
    if (parseArr(data.improvementTypes).includes("performance")) {
      field("Performance Improvement", data.improvementPerformanceText, { multiline: true });
    }
    field("Learner Outcomes", data.learnerOutcomes, { multiline: true });
    spacer();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 4: Learning Objectives
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader(4, "Learning Objectives");
    field("Learning Objectives", data.learningObjectives, { multiline: true });
    spacer();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 5: Educational Format & Delivery
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader(5, "Educational Format & Delivery");
    field("Delivery Description", data.deliveryDescription, { multiline: true });
    listField("Activity Includes", parseArr(data.activityIncludes));
    listField("Assessment Methods", parseArr(data.assessmentMethods));
    spacer();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 6: Faculty
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader(6, "Faculty / Planning Committee");
    const faculty = parseFaculty(data.facultyJson);
    if (faculty.length === 0) {
      field("Faculty", null);
    } else {
      faculty.forEach((f, i) => {
        if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
        doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold").text(`FACULTY ${i + 1}`, 55, y);
        y += 12;
        doc.rect(55, y, pageWidth - 10, 36).fill(LIGHT_GRAY).stroke(BORDER);
        doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold").text(f.name || "—", 60, y + 5, { width: pageWidth - 20 });
        doc.fillColor(GRAY).fontSize(8).font("Helvetica").text(`${f.credentials || ""} — ${f.role || ""}`, 60, y + 18, { width: pageWidth - 20 });
        y += 42;
      });
    }
    spacer();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 7: Content Readiness
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader(7, "Content Readiness");
    twoFields("Content Status", label(data.contentStatus), "Content Available Date", data.contentAvailableDate);
    spacer();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 8: Marketing
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader(8, "Marketing");
    listField("Marketing Channels", parseArr(data.marketingChannels));
    field("Marketing Mentions CME Credit?", label(data.marketingMentionsCme));
    spacer();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 9: Financial
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader(9, "Financial");
    field("Registration Fee Charged?", label(data.registrationFee));
    if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
    doc.rect(55, y, pageWidth - 10, 36).fill("#fffbea").stroke("#f5c518");
    doc.fillColor("#7a5c00").fontSize(8).font("Helvetica").text(
      "Commercial support is not permitted unless prior written approval is granted by CardioServ. Final revenue reporting details will follow the joint provider agreement and CardioServ guidance.",
      60, y + 6, { width: pageWidth - 20 }
    );
    y += 44;
    spacer();

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 10: Attestation & Signature
    // ═══════════════════════════════════════════════════════════════════════════
    if (y > doc.page.height - 200) { doc.addPage(); y = 50; }
    sectionHeader(10, "Attestation & Signature");

    // Attestation statements
    const statements = [
      "This activity is designed to address a defined professional practice gap.",
      "Educational content will be evidence-based and free from commercial influence.",
      "All planners, presenters and reviewers will complete required disclosure documentation.",
      "No marketing referencing CME credit will occur until written approval is granted.",
      "The activity will be delivered in alignment with the approved plan.",
    ];
    const stmtText = "I confirm that:\n" + statements.map(s => `  • ${s}`).join("\n");
    const stmtH = doc.heightOfString(stmtText, { width: pageWidth - 20, fontSize: 9 }) + 14;
    doc.rect(55, y, pageWidth - 10, stmtH).fill(LIGHT_GRAY).stroke(BORDER);
    doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold").text("I confirm that:", 60, y + 6, { width: pageWidth - 20 });
    const stmtY = y + 18;
    statements.forEach((s, i) => {
      doc.fillColor(DARK).fontSize(9).font("Helvetica").text(`• ${s}`, 65, stmtY + i * 13, { width: pageWidth - 30 });
    });
    y += stmtH + 10;

    // Name / Title / Date row
    twoFields("Name", data.attestationName, "Title / Credentials", data.attestationTitle);
    field("Date", data.attestationDate);

    // Signature
    if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
    doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold").text("SIGNATURE", 55, y);
    y += 12;

    if (data.signatureDataUrl && data.signatureDataUrl.startsWith("data:image")) {
      try {
        // Extract base64 from data URL
        const base64 = data.signatureDataUrl.split(",")[1];
        const imgBuffer = Buffer.from(base64, "base64");
        const mimeMatch = data.signatureDataUrl.match(/data:([^;]+);/);
        const mime = mimeMatch?.[1] ?? "image/png";
        const imgType = mime.includes("svg") ? "svg" : mime.includes("jpeg") ? "jpeg" : "png";

        doc.rect(55, y, pageWidth - 10, 70).fill("white").stroke(BORDER);
        if (imgType === "svg") {
          // For SVG signatures (typed), render as text instead
          const svgText = Buffer.from(base64, "base64").toString("utf8");
          const nameMatch = svgText.match(/>([^<]+)<\/text>/);
          const sigText = nameMatch?.[1] ?? data.attestationName ?? "";
          doc.fillColor(DARK).fontSize(28).font("Helvetica-Oblique").text(sigText, 60, y + 18, { width: pageWidth - 20 });
        } else {
          doc.image(imgBuffer, 60, y + 5, { height: 60, fit: [pageWidth - 20, 60] });
        }
        y += 76;
      } catch {
        // Fallback: blank signature box
        doc.rect(55, y, pageWidth - 10, 70).fill("white").stroke(BORDER);
        doc.fillColor(GRAY).fontSize(9).font("Helvetica-Oblique").text("Signature", 60, y + 28, { width: pageWidth - 20 });
        y += 76;
      }
    } else {
      // Blank signature box
      doc.rect(55, y, pageWidth - 10, 70).fill("white").stroke(BORDER);
      doc.fillColor(GRAY).fontSize(9).font("Helvetica-Oblique").text("Signature", 60, y + 28, { width: pageWidth - 20 });
      y += 76;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const totalPages = (doc as any).bufferedPageRange?.()?.count ?? 1;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fillColor(GRAY).fontSize(7).font("Helvetica")
        .text("© All About Ultrasound — CardioServ CME Joint Provider Form", 50, doc.page.height - 30, { width: pageWidth, align: "center" });
    }

    doc.end();
  });
}
