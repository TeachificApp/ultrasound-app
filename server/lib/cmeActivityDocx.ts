/**
 * cmeActivityDocx.ts
 * Generates a DOCX file for the CME Activity Planning and Proposal Form
 * matching the CardioServ template structure.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  PageBreak,
  convertInchesToTwip,
} from "docx";

// ─── Label helpers ────────────────────────────────────────────────────────────
const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  live_in_person: "Live/In-Person",
  live_virtual: "Live Virtual",
  enduring: "Enduring / On-Demand",
  hybrid: "Hybrid",
};
const MOC_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  not_yet_determined: "Not yet determined",
};
const OFFERED_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  not_yet_determined: "Not yet determined",
};
const STRUCTURE_LABELS: Record<string, string> = {
  one_time: "One-time activity",
  recurring: "Recurring series",
  ongoing: "Ongoing / evergreen",
  not_yet_determined: "Not yet determined",
};
const AUDIENCE_LABELS: Record<string, string> = {
  physicians: "Physicians",
  sonographers: "Sonographers",
  advanced_practice: "Advanced Practice Providers",
  mixed: "Mixed Audience",
  other: "Other",
};
const ACTIVITY_INCLUDES_LABELS: Record<string, string> = {
  hands_on: "Hands-on workshop / scanning lab",
  case_based: "Case-based discussion",
  audience_qa: "Audience Q&A",
  interactive_polling: "Interactive polling",
  gamification: "Gamification / game-based learning",
  knowledge_check: "Knowledge check / assessment",
  other: "Other",
};
const ASSESSMENT_LABELS: Record<string, string> = {
  pre_test: "Pre-test",
  post_test: "Post-test",
  case_based: "Case-based questions",
  audience_polling: "Audience polling",
  learner_evaluation: "Learner evaluation survey",
  practice_change: "Intended practice change question",
  other: "Other",
  not_yet_determined: "Not yet determined",
};
const CONTENT_STATUS_LABELS: Record<string, string> = {
  fully_developed: "Fully developed",
  partially_developed: "Partially developed",
  outline_only: "Outline only",
  not_yet_started: "Not yet started",
};
const MARKETING_LABELS: Record<string, string> = {
  email: "Email list",
  website: "Website",
  social_media: "Social media",
  institutional: "Institutional promotion",
  conference: "Conference-based",
  other: "Other",
};
const YES_NO_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  not_yet_determined: "Not yet determined",
};

// ─── Parse JSON array safely ──────────────────────────────────────────────────
function parseArr(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

// ─── Paragraph builders ───────────────────────────────────────────────────────
function sectionHeading(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } },
  });
}

function questionLabel(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    spacing: { before: 200, after: 60 },
  });
}

function bodyText(text: string) {
  if (!text?.trim()) return new Paragraph({ text: "", spacing: { after: 80 } });
  // Split on newlines to preserve bullet formatting
  const lines = text.split("\n");
  const paras: Paragraph[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
      paras.push(new Paragraph({
        children: [new TextRun({ text: trimmed.replace(/^[•\-]\s*/, ""), size: 20 })],
        bullet: { level: 0 },
        spacing: { after: 40 },
      }));
    } else if (trimmed) {
      paras.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 20 })],
        spacing: { after: 60 },
      }));
    }
  }
  return paras.length === 1 ? paras[0] : paras;
}

function checklistItem(label: string, checked: boolean) {
  return new Paragraph({
    children: [
      new TextRun({ text: checked ? "☑  " : "☐  ", size: 20 }),
      new TextRun({ text: label, size: 20 }),
    ],
    indent: { left: convertInchesToTwip(0.3) },
    spacing: { after: 40 },
  });
}

function radioItem(label: string, selected: boolean) {
  return new Paragraph({
    children: [
      new TextRun({ text: selected ? "●  " : "○  ", size: 20 }),
      new TextRun({ text: label, size: 20 }),
    ],
    indent: { left: convertInchesToTwip(0.3) },
    spacing: { after: 40 },
  });
}

function inlineField(label: string, value: string | null | undefined) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label} `, bold: true, size: 22 }),
      new TextRun({ text: value ?? "", size: 22 }),
    ],
    spacing: { before: 120, after: 60 },
  });
}

function noteText(text: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: "Note: ", bold: true, size: 18, italics: true }),
      new TextRun({ text, size: 18, italics: true }),
    ],
    spacing: { before: 80, after: 80 },
  });
}

function warningText(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 20 })],
    spacing: { before: 80, after: 80 },
  });
}

// ─── Main generator ───────────────────────────────────────────────────────────
export async function generateCmeActivityDocx(form: Record<string, any>): Promise<Buffer> {
  const activityIncludes = parseArr(form.activityIncludes);
  const assessmentMethods = parseArr(form.assessmentMethods);
  const marketingChannels = parseArr(form.marketingChannels);
  const faculty: Array<{ name: string; credentials: string; role: string }> = parseArr(form.facultyJson);

  const children: (Paragraph | Table)[] = [];

  // ── Title block ──────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Activity Planning and Proposal Form", bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Completion of this form is required for all jointly provided activities seeking CME credit.", size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Written approval from CardioServ is required before marketing or delivery.", size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Please feel free to type directly into the document. If any questions come up along the way, feel free to leave comments or reach out directly.", size: 20, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  // ── Section 1: Activity Overview ─────────────────────────────────────────
  children.push(sectionHeading("Section 1: Activity Overview"));

  children.push(inlineField("1. Activity Title:", form.activityTitle));

  children.push(questionLabel("2. Activity Type:"));
  for (const [key, label] of Object.entries(ACTIVITY_TYPE_LABELS)) {
    children.push(radioItem(label, form.activityType === key));
  }

  children.push(inlineField("3. Proposed Date(s) or Launch Date:", form.proposedDate));
  children.push(inlineField("4. Estimated Activity Length (in hours):", form.activityLengthHours));
  children.push(inlineField("5. Estimated CME credit hours requested (if known):", form.cmeCreditsRequested));

  children.push(questionLabel("6. Would you be interested in offering MOC credit for this activity if available?"));
  for (const [key, label] of Object.entries(MOC_LABELS)) {
    children.push(radioItem(label, form.offerMocCredit === key));
  }

  children.push(questionLabel("7. Do you anticipate offering this activity more than once?"));
  for (const [key, label] of Object.entries(OFFERED_LABELS)) {
    children.push(radioItem(label, form.offeredMoreThanOnce === key));
  }

  children.push(questionLabel("8. Activity Structure"));
  for (const [key, label] of Object.entries(STRUCTURE_LABELS)) {
    children.push(radioItem(label, form.activityStructure === key));
  }

  children.push(questionLabel("9. Primary Target Audience:"));
  for (const [key, label] of Object.entries(AUDIENCE_LABELS)) {
    children.push(radioItem(label, form.targetAudience === key));
  }

  children.push(inlineField("10. Estimated Number of Learners, if known (per offering):", form.estimatedLearners));

  // ── Section 2: Professional Practice Gap ─────────────────────────────────
  children.push(sectionHeading("Section 2: Professional Practice Gap"));

  children.push(questionLabel("1. Describe the specific practice-based problem or challenge you're trying to solve:"));
  const pgDesc = bodyText(form.practiceGapDescription ?? "");
  if (Array.isArray(pgDesc)) children.push(...pgDesc); else children.push(pgDesc);

  children.push(questionLabel("2. What are the primary reasons contributing to this problem:"));
  const pgReasons = bodyText(form.practiceGapReasons ?? "");
  if (Array.isArray(pgReasons)) children.push(...pgReasons); else children.push(pgReasons);

  // ── Section 3: Educational Needs ─────────────────────────────────────────
  children.push(sectionHeading("Section 3: Educational Needs and Desired Change (Big Picture)"));

  children.push(questionLabel("1. What Type of Improvement Is This Activity Designed to Support?"));
  const knowledgeText = bodyText(form.improvementKnowledgeText ?? "");
  if (Array.isArray(knowledgeText)) children.push(...knowledgeText); else children.push(knowledgeText);
  const competenceText = bodyText(form.improvementCompetenceText ?? "");
  if (Array.isArray(competenceText)) children.push(...competenceText); else children.push(competenceText);
  const performanceText = bodyText(form.improvementPerformanceText ?? "");
  if (Array.isArray(performanceText)) children.push(...performanceText); else children.push(performanceText);

  children.push(questionLabel("2. What should learners be able to improve or do differently after this activity?"));
  children.push(new Paragraph({ children: [new TextRun({ text: "After completing this activity, learners should be able to:", size: 20 })], spacing: { after: 60 } }));
  const outcomes = bodyText(form.learnerOutcomes ?? "");
  if (Array.isArray(outcomes)) children.push(...outcomes); else children.push(outcomes);

  // ── Section 4: Learning Objectives ───────────────────────────────────────
  children.push(sectionHeading("Section 4: Learning Objectives"));
  const objectives = bodyText(form.learningObjectives ?? "");
  if (Array.isArray(objectives)) children.push(...objectives); else children.push(objectives);

  // ── Section 5: Educational Format ────────────────────────────────────────
  children.push(sectionHeading("Section 5: Educational Format and Design"));

  children.push(questionLabel("1. Briefly describe how the activity will be delivered:"));
  const delivery = bodyText(form.deliveryDescription ?? "");
  if (Array.isArray(delivery)) children.push(...delivery); else children.push(delivery);

  children.push(questionLabel("2. Will this activity include:"));
  for (const [key, label] of Object.entries(ACTIVITY_INCLUDES_LABELS)) {
    children.push(checklistItem(label, activityIncludes.includes(key)));
  }

  children.push(questionLabel("3. Learner Assessment and Outcomes"));
  children.push(new Paragraph({ children: [new TextRun({ text: "Will this activity include any method for assessing learner understanding, engagement, or intended practice change?", size: 20, italics: true })], spacing: { after: 80 } }));
  for (const [key, label] of Object.entries(ASSESSMENT_LABELS)) {
    children.push(checklistItem(label, assessmentMethods.includes(key)));
  }

  // ── Section 6: Faculty ────────────────────────────────────────────────────
  children.push(sectionHeading("Section 6: Faculty and Planning Team"));
  children.push(new Paragraph({ children: [new TextRun({ text: "List all individuals involved in planning, reviewing, presenting, or influencing educational content.", size: 20 })], spacing: { after: 80 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Name | Credentials | Role (Planner / Presenter / Reviewer / Contributor):", size: 20 })], spacing: { after: 80 } }));

  if (faculty.length === 0) {
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  } else {
    faculty.forEach((f, i) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${i + 1}. ${f.name}${f.credentials ? ", " + f.credentials : ""} | ${f.role}`, size: 20 })],
        spacing: { after: 60 },
      }));
    });
  }

  children.push(noteText("All listed individuals must complete CardioServ Financial Disclosure Forms before participating in planning or delivery."));

  // ── Section 7: Content Readiness ─────────────────────────────────────────
  children.push(sectionHeading("Section 7: Content Readiness"));

  children.push(questionLabel("1. Current Content Status:"));
  for (const [key, label] of Object.entries(CONTENT_STATUS_LABELS)) {
    children.push(radioItem(label, form.contentStatus === key));
  }

  children.push(questionLabel("When do you expect draft content to be available for review?"));
  const availDate = bodyText(form.contentAvailableDate ?? "");
  if (Array.isArray(availDate)) children.push(...availDate); else children.push(availDate);

  // ── Section 8: Marketing ──────────────────────────────────────────────────
  children.push(sectionHeading("Section 8: Marketing and Distribution"));

  children.push(questionLabel("1. How will this activity be promoted?"));
  for (const [key, label] of Object.entries(MARKETING_LABELS)) {
    children.push(checklistItem(label, marketingChannels.includes(key)));
  }

  children.push(questionLabel("2. Will any marketing materials mention CME, credit, CardioServ, Better Cardiology, accreditation, or AMA PRA Category 1 Credit™?"));
  for (const [key, label] of Object.entries(YES_NO_LABELS)) {
    children.push(radioItem(label, form.marketingMentionsCme === key));
  }

  children.push(warningText("All marketing materials referencing CME credit, CardioServ, Better Cardiology, accreditation, or AMA PRA Category 1 Credit™ must be submitted to CardioServ for review and written approval prior to distribution."));

  // ── Section 9: Financial ──────────────────────────────────────────────────
  children.push(sectionHeading("Section 9: Financial Overview"));

  children.push(questionLabel("1. Will learners be charged a registration fee?"));
  for (const [key, label] of Object.entries(YES_NO_LABELS)) {
    children.push(radioItem(label, form.registrationFee === key));
  }

  children.push(warningText("Commercial support is not permitted unless prior written approval is granted by CardioServ."));
  children.push(new Paragraph({ children: [new TextRun({ text: "Final revenue reporting details will follow the joint provider agreement and CardioServ guidance.", size: 20 })], spacing: { after: 80 } }));

  // ── Section 10: Attestation & Signature ───────────────────────────────────
  children.push(sectionHeading("Section 10: Attestation & Signature"));

  children.push(new Paragraph({ children: [new TextRun({ text: "I confirm that:", size: 20 })], spacing: { after: 80 } }));
  for (const stmt of [
    "This activity is designed to address a defined professional practice gap.",
    "Educational content will be evidence-based and free from commercial influence.",
    "All planners, presenters and reviewers will complete required disclosure documentation.",
    "No marketing referencing CME credit will occur until written approval is granted.",
    "The activity will be delivered in alignment with the approved plan.",
  ]) {
    children.push(new Paragraph({
      children: [new TextRun({ text: "• " + stmt, size: 20 })],
      spacing: { after: 60 },
    }));
  }

  children.push(new Paragraph({ text: "", spacing: { before: 400, after: 80 } }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Name: ", bold: true, size: 22 }),
      new TextRun({ text: (form as any).attestationName ?? "Lara Williams", size: 22 }),
      new TextRun({ text: "     Title: ", bold: true, size: 22 }),
      new TextRun({ text: (form as any).attestationTitle ?? "", size: 22 }),
    ],
    spacing: { after: 80 },
  }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Date: ", bold: true, size: 22 }),
      new TextRun({ text: (form as any).attestationDate ?? "", size: 22 }),
    ],
    spacing: { after: 160 },
  }));
  // Signature line
  children.push(new Paragraph({
    children: [new TextRun({ text: "Signature:", bold: true, size: 22 })],
    spacing: { after: 80 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: " ", size: 22 })],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "AAAAAA" },
    },
    spacing: { before: 400, after: 200 },
  }));

  // ── Build document ────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.25),
            right: convertInchesToTwip(1.25),
          },
        },
      },
      children,
    }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
      paragraphStyles: [
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { bold: true, size: 26, color: "1F3864" },
          paragraph: { spacing: { before: 320, after: 120 } },
        },
      ],
    },
  });

  return Packer.toBuffer(doc);
}
