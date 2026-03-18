/*
  EchoAccreditation Navigator™ — iHeartEcho™
  IAC Standards guide with search for TTE, TEE, Stress, Pediatric, Fetal, HOCM
  Case Mix section uses the full IAC structured data from CaseMixSubmission
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { trpc } from "@/lib/trpc";
import AccreditationReadiness from "./AccreditationReadiness";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search, BookOpen, ChevronDown, ChevronUp, ExternalLink, Award, Users,
  FileText, Clock, GraduationCap, Stethoscope, Activity, Baby, Heart, Zap,
  Info, CheckCircle2, Building2, Zap as ZapIcon, ClipboardList, ShieldCheck, Lock
} from "lucide-react";
import { Microscope } from "lucide-react";

const BRAND = "#189aa1";

// ─── Types ────────────────────────────────────────────────────────────────────
type Modality = "TTE" | "TEE" | "Stress" | "Pediatric" | "Fetal" | "HOCM";
type Category = "personnel" | "facility" | "equipment" | "procedures" | "case_mix" | "cme" | "quality" | "policies";

interface Standard {
  id: string;
  section: string;
  title: string;
  content: string;
  modalities: Modality[];
  category: Category;
  tags: string[];
}

// ─── IAC Standards Data ───────────────────────────────────────────────────────
const STANDARDS: Standard[] = [
  // ─── PERSONNEL ──────────────────────────────────────────────────────────────
  {
    id: "pers-01",
    section: "Section 1.1",
    title: "Medical Director Qualifications",
    content: `The Medical Director must be a licensed physician with documented training and experience in echocardiography. Requirements include:\n\n• Board certification in cardiovascular disease, pediatric cardiology, or equivalent specialty\n• Minimum 3 years of echocardiography experience post-training\n• Active involvement in the echo laboratory (minimum 25% time)\n• Responsible for overall quality, protocol development, and staff supervision\n• Must interpret a minimum number of studies per year to maintain competency (varies by modality)\n\nFor TTE/TEE: ABIM or equivalent board certification in cardiovascular disease\nFor Pediatric/Fetal: Board certification in pediatric cardiology\nFor Stress Echo: Additional training in stress testing protocols required`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "personnel",
    tags: ["medical director", "physician", "qualifications", "board certification", "leadership"],
  },
  {
    id: "pers-02",
    section: "Section 1.2",
    title: "Sonographer Qualifications",
    content: `Sonographers performing echocardiographic studies must meet the following requirements:\n\n• Registered Diagnostic Cardiac Sonographer (RDCS) credential from ARDMS, or\n• Registered Cardiac Sonographer (RCS) credential from CCI, or\n• Equivalent recognized credential\n• Alternatively: documented training under direct physician supervision with a defined competency pathway\n\nFor TEE: Additional training and competency documentation required\nFor Stress Echo: Training in stress testing protocols and emergency response\nFor Pediatric/Fetal: Specialized training in congenital heart disease imaging\n\nNew graduates: Must work under direct supervision until credentialing is obtained. A defined timeline for credential attainment must be documented.`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "personnel",
    tags: ["sonographer", "ARDMS", "RDCS", "RCS", "credentials", "qualifications", "certification"],
  },
  {
    id: "pers-03",
    section: "Section 1.3",
    title: "Interpreting Physician Qualifications",
    content: `Physicians interpreting echocardiographic studies must demonstrate:\n\n• Appropriate board certification (cardiovascular disease, pediatric cardiology, or equivalent)\n• Documented training in echocardiography interpretation\n• Minimum annual volume requirements for interpretation (varies by modality):\n  - TTE: Typically 150+ studies/year\n  - TEE: Typically 50+ studies/year\n  - Stress Echo: Typically 50+ studies/year\n  - Pediatric: Typically 150+ studies/year\n\nPhysicians must maintain competency through ongoing CME and case volume. Documentation of annual interpretation volumes must be maintained.`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "personnel",
    tags: ["interpreting physician", "cardiologist", "volume", "competency", "annual", "interpretation"],
  },
  {
    id: "pers-04",
    section: "Section 1.4",
    title: "CME Requirements — Sonographers",
    content: `Continuing Medical Education (CME) / Continuing Education (CE) requirements for sonographers:\n\n• ARDMS RDCS: 30 CE credits every 3 years (triennium)\n• CCI RCS: 30 CE credits every 3 years\n• At least 50% of CE credits must be in the registered specialty\n• CE activities must be from approved providers (ARDMS/CCI approved)\n\nDocumentation requirements:\n• CE certificates must be maintained in personnel files\n• Annual review of CE status recommended\n• Failure to maintain CE results in credential lapse\n\nApproved CE sources include: ASE annual meeting, ASE online education, ICAEL workshops, accredited echo conferences, online CME providers.`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "cme",
    tags: ["CME", "CE", "continuing education", "ARDMS", "CCI", "credits", "renewal", "30 credits", "triennium"],
  },
  {
    id: "pers-05",
    section: "Section 1.5",
    title: "CME Requirements — Interpreting Physicians",
    content: `CME requirements for physicians interpreting echocardiographic studies:\n\n• ABIM Maintenance of Certification (MOC) requirements apply\n• Echocardiography-specific CME strongly recommended\n• ASE recommends minimum 15 hours of echo-specific CME per year\n• Documentation of echo-specific CME must be maintained\n\nFor HOCM/HCM specialists:\n• Additional training in LVOT obstruction assessment\n• Familiarity with septal reduction therapy evaluation\n\nApproved CME sources: ASE Scientific Sessions, ACC/AHA meetings, SCAI, echo-specific online CME, peer-reviewed journal CME.`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "cme",
    tags: ["CME", "physician", "MOC", "ABIM", "continuing education", "15 hours", "annual"],
  },

  // ─── QUALITY ─────────────────────────────────────────────────────────────────
  {
    id: "qa-01",
    section: "Section 5.1",
    title: "Peer Review Program Requirements",
    content: `IAC requires a formal peer review program with the following elements:\n\n• Minimum 5–10% of studies must be peer reviewed\n• Peer review must be performed by a qualified interpreting physician\n• Discordant findings must be tracked and addressed\n• Results must be used for quality improvement\n\nDocumentation requirements:\n• Peer review log with study date, reviewer, original interpretation, peer review interpretation, and discordance rating\n• Trending of discordance rates over time\n• Annual summary report reviewed by Medical Director\n• Action plan for outlier reviewers or systematic discordances\n\nAcceptable peer review formats: blinded re-read, prospective over-read, retrospective review, external peer review.`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "quality",
    tags: ["peer review", "5%", "10%", "discordance", "quality", "blinded", "over-read", "annual summary"],
  },
  {
    id: "qa-02",
    section: "Section 5.2",
    title: "Image Quality Monitoring",
    content: `Laboratories must have a systematic program for monitoring and improving image quality:\n\n• Image quality must be graded on a defined scale (e.g., excellent, good, adequate, technically limited)\n• Technically limited studies must be tracked and trended\n• Feedback must be provided to individual sonographers\n• Remediation plans for sonographers with high technically limited rates\n\nDocumentation:\n• Image quality log or database\n• Trending reports (monthly or quarterly)\n• Feedback documentation in personnel files\n• Remediation plans when applicable\n\nTarget: Technically limited rate should be monitored and benchmarked against laboratory goals.`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "quality",
    tags: ["image quality", "technically limited", "monitoring", "grading", "feedback", "remediation", "trending"],
  },
  {
    id: "qa-03",
    section: "Section 5.3",
    title: "Appropriate Use Criteria (AUC) Monitoring",
    content: `IAC requires documentation of appropriate use criteria monitoring:\n\n• AUC monitoring must be performed for at least a representative sample of studies\n• ACCF/AHA/ASE Appropriate Use Criteria for Echo should be referenced\n• Rarely appropriate studies must be tracked and reviewed\n• Feedback to ordering physicians for outlier patterns\n\nDocumentation requirements:\n• AUC monitoring log with indication, modality, and appropriateness rating\n• Trending of rarely appropriate studies\n• Communication with ordering physicians/departments\n• Annual AUC summary report\n\nNote: AUC monitoring is increasingly emphasized in IAC reviews. Laboratories should track indications prospectively.`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "quality",
    tags: ["appropriate use", "AUC", "rarely appropriate", "indications", "monitoring", "ordering physician", "ACCF", "AHA"],
  },

  // ─── POLICIES ─────────────────────────────────────────────────────────────────
  {
    id: "pol-01",
    section: "Section 6.1",
    title: "Required Written Policies",
    content: `IAC requires the following written policies to be in place and reviewed annually:\n\n• Infection control and transducer disinfection\n• Patient safety and emergency response\n• Equipment maintenance and calibration\n• Report turnaround time\n• Peer review program\n• Image quality monitoring\n• Appropriate use criteria monitoring\n• Staff competency and credentialing\n• Contrast agent use (if applicable)\n• TEE procedure policy (if applicable)\n• Stress echo emergency protocol (if applicable)\n• Patient consent procedures\n• HIPAA compliance\n\nAll policies must:\n• Be dated and version-controlled\n• Have a defined review date (typically annual)\n• Be accessible to all laboratory personnel\n• Be signed/approved by the Medical Director`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "policies",
    tags: ["policies", "written", "infection control", "patient safety", "annual review", "Medical Director", "HIPAA", "consent"],
  },
  {
    id: "pol-02",
    section: "Section 6.2",
    title: "Infection Control — Transducer Disinfection",
    content: `Transducer disinfection policies must comply with IAC and CDC standards:\n\n• Low-level disinfection (LLD): Required for external transducers (TTE) after each patient\n  - Approved LLD agents: CaviWipes, Sani-Cloth, or equivalent\n  - Wipe down all contact surfaces\n  - Allow appropriate contact time per product instructions\n\n• High-level disinfection (HLD): Required for TEE probes and all semi-critical transducers\n  - Approved HLD methods: Cidex OPA, Cidex Plus, automated reprocessors (Medivator, Trophon)\n  - Complete immersion for full contact time\n  - Rinse and dry per protocol\n  - Log each HLD cycle (probe ID, date, time, solution lot, operator)\n\n• Probe covers: Required for all TEE and intracavitary procedures\n• Gel hygiene: Single-use gel packets recommended; multi-use bottles must be capped between uses`,
    modalities: ["TTE", "TEE"],
    category: "policies",
    tags: ["infection control", "disinfection", "HLD", "LLD", "TEE probe", "Cidex", "Trophon", "transducer", "high-level disinfection"],
  },
  {
    id: "pol-03",
    section: "Section 6.3",
    title: "Contrast Agent Policy",
    content: `If ultrasound enhancing agents (UEA) / contrast are used, the following policies are required:\n\n• Written protocol for UEA administration\n• Physician supervision during contrast administration\n• Monitoring requirements (ECG, pulse oximetry, BP)\n• Contraindication screening (right-to-left shunt, known hypersensitivity)\n• Emergency response plan for adverse reactions\n• Resuscitation equipment immediately available\n• Post-procedure monitoring period (minimum 30 minutes)\n\nDocumentation:\n• Consent for contrast administration\n• Contrast administration log (agent, lot, dose, patient response)\n• Adverse event reporting\n\nApproved agents: Definity (perflutren), Lumason (sulfur hexafluoride), Optison (perflutren)\nFDA Black Box Warning: Must be reviewed with patients at high cardiopulmonary risk.`,
    modalities: ["TTE", "Stress"],
    category: "policies",
    tags: ["contrast", "UEA", "Definity", "Lumason", "Optison", "perflutren", "adverse reaction", "consent", "monitoring", "FDA"],
  },
  {
    id: "pol-04",
    section: "Section 6.4",
    title: "Stress Echo Emergency Protocol",
    content: `A written emergency protocol is required for all stress echocardiography programs:\n\n• Physician must be present during all pharmacological stress studies\n• ACLS-trained personnel must be available during all stress studies\n• Crash cart with defibrillator must be immediately accessible\n• Reversal agents must be available:\n  - Dobutamine reversal: IV beta-blocker (metoprolol, esmolol, atropine for bradycardia)\n  - Adenosine/regadenoson reversal: Aminophylline\n\n• Absolute contraindications to stress echo must be screened:\n  - Acute MI within 2 days\n  - Unstable angina\n  - Severe symptomatic AS\n  - Uncontrolled arrhythmias\n  - Decompensated heart failure\n\n• Termination criteria must be posted and followed\n• Post-stress monitoring minimum 15-30 minutes`,
    modalities: ["Stress"],
    category: "policies",
    tags: ["stress echo", "emergency", "ACLS", "crash cart", "dobutamine", "reversal", "contraindications", "termination criteria", "aminophylline"],
  },

  // ─── ACCREDITATION PROCESS ────────────────────────────────────────────────────
  {
    id: "acc-01",
    section: "Section 7.1",
    title: "IAC Application Process Overview",
    content: `The IAC accreditation process for echocardiography laboratories:\n\n1. Pre-application preparation:\n   • Review current IAC Standards document for desired modality\n   • Conduct internal gap analysis against standards\n   • Implement required policies and programs\n   • Collect required documentation\n\n2. Application submission:\n   • Complete online application at intersocietal.org\n   • Submit required documentation (policies, case logs, staff credentials)\n   • Pay application fee\n\n3. Review process:\n   • IAC reviewers evaluate submitted documentation\n   • Site visit may be required for initial accreditation\n   • Deficiency letters issued if standards not met\n\n4. Accreditation decision:\n   • Accreditation granted (3-year cycle)\n   • Conditional accreditation (deficiencies must be corrected)\n   • Denial (significant deficiencies)\n\n5. Reaccreditation:\n   • Required every 3 years\n   • Ongoing compliance monitoring`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "procedures",
    tags: ["IAC", "application", "process", "accreditation", "3 years", "reaccreditation", "site visit", "gap analysis", "intersocietal"],
  },
  {
    id: "acc-02",
    section: "Section 7.2",
    title: "Common Deficiencies and How to Avoid Them",
    content: `The most common IAC deficiencies cited during accreditation reviews:\n\n1. Incomplete peer review documentation\n   • Fix: Implement a systematic peer review log; review minimum 5-10% of studies\n\n2. Missing or outdated policies\n   • Fix: Annual policy review cycle; Medical Director signature required\n\n3. Staff credentials not current\n   • Fix: Maintain credential expiration tracking; CE documentation in personnel files\n\n4. Inadequate case mix documentation\n   • Fix: Prospective case logging by type; annual case mix analysis\n\n5. Turnaround time non-compliance\n   • Fix: Track report completion times; document outliers with explanations\n\n6. Missing infection control logs\n   • Fix: Daily TEE probe HLD logs; transducer cleaning documentation\n\n7. Inadequate AUC monitoring\n   • Fix: Prospective AUC tracking; feedback to ordering physicians\n\n8. Equipment maintenance gaps\n   • Fix: Preventive maintenance schedule; repair logs; calibration records`,
    modalities: ["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"],
    category: "quality",
    tags: ["deficiencies", "common", "peer review", "policies", "credentials", "case mix", "turnaround", "infection control", "AUC", "equipment"],
  },
];

// ─── Category Config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<Category, { label: string; color: string; icon: React.ElementType }> = {
  personnel: { label: "Personnel", color: "#189aa1", icon: Users },
  facility: { label: "Facility", color: "#0e7a80", icon: Stethoscope },
  equipment: { label: "Equipment", color: "#2ab8bf", icon: Activity },
  procedures: { label: "Procedures & Protocols", color: "#189aa1", icon: ClipboardListIcon },
  case_mix: { label: "Case Studies", color: "#0e6b70", icon: FileText },
  cme: { label: "CME / Education", color: "#4ad9e0", icon: GraduationCap },
  quality: { label: "Quality Assurance", color: "#0e4a50", icon: Award },
  policies: { label: "Policies", color: "#3ab5bc", icon: FileText },
};

function ClipboardListIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="12" y2="16" />
    </svg>
  );
}

const MODALITY_CONFIG: Record<Modality, { label: string; color: string; icon: React.ElementType }> = {
  TTE: { label: "TTE", color: "#189aa1", icon: Stethoscope },
  TEE: { label: "TEE", color: "#0e7a80", icon: Activity },
  Stress: { label: "Stress Echo", color: "#2ab8bf", icon: ZapIcon },
  Pediatric: { label: "Pediatric", color: "#4ad9e0", icon: Users },
  Fetal: { label: "Fetal", color: "#0e6b70", icon: Baby },
  HOCM: { label: "HOCM / HCM", color: "#0e4a50", icon: Heart },
};

// ─── Standard Card ────────────────────────────────────────────────────────────
function StandardCard({ standard }: { standard: Standard }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORY_CONFIG[standard.category];
  const CatIcon = cat.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: cat.color + "18" }}>
          <CatIcon className="w-4 h-4" style={{ color: cat.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-semibold text-gray-400">{standard.section}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cat.color + "15", color: cat.color }}>{cat.label}</span>
              </div>
              <h3 className="text-sm font-bold text-gray-800">{standard.title}</h3>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {standard.modalities.map(m => {
                  const mc = MODALITY_CONFIG[m];
                  return (
                    <span key={m} className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: mc.color + "15", color: mc.color }}>
                      {mc.label}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex-shrink-0 mt-1">
              {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="pt-3 text-xs text-gray-700 leading-relaxed whitespace-pre-line">{standard.content}</div>
          <div className="flex flex-wrap gap-1 mt-3">
            {standard.tags.map(tag => (
              <span key={tag} className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#189aa1" + "15", color: "#189aa1" }}>{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Case Mix Requirements (full IAC structured data, no tracker) ─────────────
type StaffTier = "le5" | "6to8" | "9to15" | "16to25" | "gt25";
interface CaseBreakdown { label: string; count: number; }
interface ModalityRequirement {
  id: string; label: string; fullName: string; icon: React.ElementType; color: string;
  staffBased: boolean; casesByTier?: Record<StaffTier, number>; fixedNote?: string;
  breakdownByTier?: Record<StaffTier, CaseBreakdown[]>;
  caseTypeRules: string[]; submissionRules: string[]; lookbackMonths: number;
}

const STAFF_TIERS: { id: StaffTier; label: string }[] = [
  { id: "le5",    label: "5 or fewer staff" },
  { id: "6to8",   label: "6 – 8 staff" },
  { id: "9to15",  label: "9 – 15 staff" },
  { id: "16to25", label: "16 – 25 staff" },
  { id: "gt25",   label: "Greater than 25 staff" },
];

const CM_MODALITIES: ModalityRequirement[] = [
  {
    id: "ATTE", label: "Adult TTE", fullName: "Adult Transthoracic Echocardiography",
    icon: Stethoscope, color: "#189aa1", staffBased: true,
    casesByTier: { le5: 4, "6to8": 6, "9to15": 8, "16to25": 10, gt25: 12 },
    breakdownByTier: {
      le5:     [{ label: "Abnormal LV systolic function (EF < 50%)", count: 1 }, { label: "Aortic stenosis (moderate or severe)", count: 1 }, { label: "Other complete TTE", count: 2 }],
      "6to8":  [{ label: "Abnormal LV systolic function (EF < 50%)", count: 2 }, { label: "Aortic stenosis (moderate or severe)", count: 1 }, { label: "Other complete TTE", count: 3 }],
      "9to15": [{ label: "Abnormal LV systolic function (EF < 50%)", count: 2 }, { label: "Aortic stenosis (moderate or severe)", count: 2 }, { label: "Other complete TTE", count: 4 }],
      "16to25":[{ label: "Abnormal LV systolic function (EF < 50%)", count: 3 }, { label: "Aortic stenosis (moderate or severe)", count: 2 }, { label: "Other complete TTE", count: 5 }],
      gt25:    [{ label: "Abnormal LV systolic function (EF < 50%)", count: 3 }, { label: "Aortic stenosis (moderate or severe)", count: 3 }, { label: "Other complete TTE", count: 6 }],
    },
    caseTypeRules: [
      "ALL cases must be COMPLETE examinations (not focused or limited).",
      "At least ONE case must demonstrate abnormal LV systolic function (EF < 50%).",
      "At least ONE case must demonstrate aortic stenosis (moderate or severe).",
      "Cases must include standard views, Doppler assessments, and measurements per ASE guidelines.",
    ],
    submissionRules: [
      "Represent as many CURRENT staff members as possible without duplicating.",
      "One case study must be submitted from the Technical Director.",
      "Medical Director must be represented.",
      "Cases must NOT be independently performed by sonographer or physician trainees.",
      "The same case may not be submitted twice within a testing section.",
    ],
    lookbackMonths: 12,
  },
  {
    id: "STRESS", label: "Adult Stress Echo", fullName: "Adult Stress Echocardiography",
    icon: Activity, color: "#d97706", staffBased: true,
    casesByTier: { le5: 4, "6to8": 6, "9to15": 8, "16to25": 10, gt25: 12 },
    caseTypeRules: [
      "Any ONE of the following case types is acceptable: (1) abnormal regional wall motion at rest due to CAD or MI, OR (2) inducible regional wall motion abnormality due to CAD or MI, OR (3) a stress case using ultrasound enhancing agents (may be normal or abnormal).",
    ],
    submissionRules: [
      "Represent as many CURRENT staff members as possible without duplicating.",
      "One case study must be submitted from the Technical Director.",
      "Medical Director must be represented.",
      "Cases must NOT be independently performed by sonographer or physician trainees.",
      "The same case may not be submitted twice within a testing section.",
    ],
    lookbackMonths: 36,
  },
  {
    id: "ATEE", label: "Adult TEE", fullName: "Adult Transesophageal Echocardiography",
    icon: Microscope, color: "#0e6b72", staffBased: false,
    fixedNote: "1 complete case per physician who performs TEE at the facility.",
    caseTypeRules: [
      "Each case must be a COMPLETE examination including all standard views and Doppler assessments.",
      "TEE representative cases must have an indication or finding of significant mitral regurgitation OR suspected cardiac source of embolus.",
      "At least ONE representative case from the facility must have a finding of significant mitral regurgitation.",
      "Intraoperative TEE may be submitted if the facility physician performed the entire study.",
      "Limited or shorter pathology-directed TEE exams are NOT acceptable.",
    ],
    submissionRules: [
      "Cases must NOT be independently performed by physician trainees.",
      "The same case may not be submitted twice within a testing section.",
    ],
    lookbackMonths: 12,
  },
  {
    id: "ACTE", label: "Adult Congenital TTE", fullName: "Adult Congenital Transthoracic Echocardiography",
    icon: Heart, color: "#7c3aed", staffBased: true,
    casesByTier: { le5: 4, "6to8": 6, "9to15": 8, "16to25": 10, gt25: 12 },
    caseTypeRules: [
      "ONE case study must demonstrate Tetralogy of Fallot (repaired or palliated).",
      "Remaining cases must demonstrate complex congenital heart disease: Conotruncal defects, AV canal defects, ToF, Single ventricle (Fontan), D-TGA (repaired) or L-TGA, Ross procedure.",
    ],
    submissionRules: [
      "Represent as many CURRENT congenital staff members as possible without duplicating.",
      "One case study must be submitted from the Lead Congenital Sonographer.",
      "Lead Congenital Echocardiographer must be represented.",
      "Cases must NOT be independently performed by sonographer or physician trainees.",
      "The same case may not be submitted twice within a testing section.",
    ],
    lookbackMonths: 12,
  },
  {
    id: "PTTE", label: "Pediatric TTE", fullName: "Pediatric Transthoracic Echocardiography",
    icon: Users, color: "#059669", staffBased: true,
    casesByTier: { le5: 4, "6to8": 6, "9to15": 8, "16to25": 10, gt25: 12 },
    breakdownByTier: {
      le5:     [{ label: "Shunt lesions", count: 2 }, { label: "Simple obstructions", count: 1 }, { label: "Complex defects", count: 1 }],
      "6to8":  [{ label: "Shunt lesions", count: 2 }, { label: "Simple obstructions", count: 2 }, { label: "Complex defects", count: 2 }],
      "9to15": [{ label: "Shunt lesions", count: 4 }, { label: "Simple obstructions", count: 2 }, { label: "Complex defects", count: 2 }],
      "16to25":[{ label: "Shunt lesions", count: 4 }, { label: "Simple obstructions", count: 3 }, { label: "Complex defects", count: 3 }],
      gt25:    [{ label: "Shunt lesions", count: 4 }, { label: "Simple obstructions", count: 4 }, { label: "Complex defects", count: 4 }],
    },
    caseTypeRules: [
      "ALL cases must be ABNORMAL.",
      "ALL cases must be COMPLETE examinations.",
      "Shunt lesions: ASD, VSD, or PDA.",
      "Simple obstructions: aortic and/or pulmonary valve stenosis, coarctation of the aorta.",
      "Complex defects: shunt lesions plus an obstruction, mitral or tricuspid atresia, AV canal defect, Tetralogy of Fallot, ventricular hypoplasia, anomalous coronary artery, truncus arteriosus, interrupted aortic arch.",
    ],
    submissionRules: [
      "Represent as many CURRENT staff members as possible without duplicating.",
      "One case study must be submitted from the Technical Director.",
      "Medical Director must be represented.",
      "Cases must NOT be independently performed by sonographer or physician trainees.",
      "The same case may not be submitted twice within a testing section.",
    ],
    lookbackMonths: 12,
  },
  {
    id: "PTEE", label: "Pediatric TEE", fullName: "Pediatric Transesophageal Echocardiography",
    icon: Microscope, color: "#0891b2", staffBased: false,
    fixedNote: "1 case per physician — complete examination (not focused/limited). Reaccreditation: 1 focused case per physician if a complete exam was previously submitted.",
    caseTypeRules: [
      "First-time application: 1 complete case per physician (not focused/limited).",
      "Reaccreditation: 1 focused case per physician if a complete exam was previously submitted; otherwise 1 complete case per physician.",
    ],
    submissionRules: [
      "Cases must NOT be independently performed by physician trainees.",
      "The same case may not be submitted twice within a testing section.",
    ],
    lookbackMonths: 36,
  },
  {
    id: "FETAL", label: "Fetal Echo", fullName: "Fetal Echocardiography",
    icon: Baby, color: "#db2777", staffBased: true,
    casesByTier: { le5: 4, "6to8": 6, "9to15": 8, "16to25": 10, gt25: 12 },
    breakdownByTier: {
      le5:     [{ label: "Shunts", count: 1 }, { label: "Simple obstructions", count: 1 }, { label: "Fetal arrhythmia", count: 1 }, { label: "Hypoplastic ventricle", count: 1 }],
      "6to8":  [{ label: "Shunts", count: 2 }, { label: "Simple obstructions", count: 2 }, { label: "Fetal arrhythmia", count: 1 }, { label: "Hypoplastic ventricle", count: 1 }],
      "9to15": [{ label: "Shunts", count: 4 }, { label: "Simple obstructions", count: 2 }, { label: "Fetal arrhythmia", count: 1 }, { label: "Hypoplastic ventricle", count: 1 }],
      "16to25":[{ label: "Shunts", count: 4 }, { label: "Simple obstructions", count: 3 }, { label: "Complex defect", count: 1 }, { label: "Fetal arrhythmia", count: 1 }, { label: "Hypoplastic ventricle", count: 1 }],
      gt25:    [{ label: "Shunts", count: 4 }, { label: "Simple obstructions", count: 4 }, { label: "Complex defects", count: 2 }, { label: "Fetal arrhythmia", count: 1 }, { label: "Hypoplastic ventricle", count: 1 }],
    },
    caseTypeRules: [
      "Cases must NOT be independently performed by sonographer or physician trainees.",
    ],
    submissionRules: [
      "The same case may not be submitted twice within a testing section.",
    ],
    lookbackMonths: 12,
  },
];

const GLOBAL_RULES = [
  "Represent as many CURRENT staff members as possible without duplicating across cases.",
  "Cases submitted must NOT be independently performed by sonographer or physician trainees.",
  "One case study must be submitted from the Technical Director.",
  "Medical Director must be represented.",
  "All cases must be COMPLETE examinations — limited exams are not acceptable.",
  "All cases must be selected from within the applicable lookback window from the date of application filing.",
  "The same case may not be submitted twice within a testing section.",
];

const MULTI_SITE_ADULT = [
  "1 abnormal TTE (AS or LV case*) from each site.",
  "1 representative Adult TEE case and its final report for each physician that performs TEE at the multiple site, unless previously represented at the main site.",
  "1 stress echocardiogram from each site (abnormal RWMA at rest, inducible RWMA, or stress with ultrasound enhancing agents).",
  "1 adult congenital TTE from each site if the facility performs adult congenital studies.",
];
const MULTI_SITE_PEDIATRIC = [
  "1 abnormal PTTE from each site: shunt, simple obstruction, or complex defect.",
  "1 representative PTEE case and its final report for each physician that performs PTEE at the multiple site, unless previously represented at the main site.",
];
const MULTI_SITE_FETAL = [
  "1 abnormal fetal case from each site: complex defect, fetal arrhythmia, shunt, simple obstruction, or hypoplastic ventricle.",
];
const MULTI_SITE_NOTE =
  "*LV cases = regional wall motion abnormalities due to CAD or MI (NOT global LV dysfunction or diastolic dysfunction). Takotsubo cardiomyopathy with regional abnormalities is accepted. AS cases must be native valvular AS with Vmax ≥ 2 m/s.";

function RuleList({ items, color = BRAND }: { items: string[]; color?: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-gray-700 leading-relaxed">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CollapsibleSection({
  title, subtitle, icon: Icon, color, defaultOpen = false, children,
}: {
  title: string; subtitle?: string; icon: React.ElementType; color: string;
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{title}</div>
            {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function ModalityCard({ modality, tier }: { modality: ModalityRequirement; tier: StaffTier }) {
  const totalCases = modality.staffBased ? (modality.casesByTier?.[tier] ?? 0) : null;
  const breakdown = modality.staffBased ? (modality.breakdownByTier?.[tier] ?? []) : [];
  return (
    <CollapsibleSection title={modality.label} subtitle={modality.fullName} icon={modality.icon} color={modality.color}>
      <div className="space-y-5">
        {modality.staffBased && totalCases !== null ? (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Required Cases</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl font-black" style={{ fontFamily: "JetBrains Mono, monospace", color: modality.color }}>{totalCases}</div>
              <div className="text-xs text-gray-500">cases required<br />within {modality.lookbackMonths}-month lookback</div>
            </div>
            {breakdown.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {breakdown.map(b => (
                  <div key={b.label} className="rounded-lg px-3 py-2 text-center" style={{ background: modality.color + "10" }}>
                    <div className="text-lg font-black" style={{ color: modality.color, fontFamily: "JetBrains Mono, monospace" }}>{b.count}</div>
                    <div className="text-xs text-gray-600 leading-tight">{b.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Required Cases</div>
            <p className="text-xs text-gray-700 leading-relaxed">{modality.fixedNote}</p>
            <div className="mt-1 text-xs text-gray-500">Lookback: {modality.lookbackMonths} months</div>
          </div>
        )}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Case Type Requirements</div>
          <RuleList items={modality.caseTypeRules} color={modality.color} />
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Submission Rules</div>
          <RuleList items={modality.submissionRules} color={modality.color} />
        </div>
      </div>
    </CollapsibleSection>
  );
}

function CaseMixRequirementsView() {
  const [tier, setTier] = useState<StaffTier>("le5");
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
            IAC Case Studies Requirements
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">IAC Echocardiography Accreditation</p>
        </div>
        <Link href="/accreditation?tab=case-mix&view=tracker">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-[#f0fbfc]" style={{ color: BRAND, borderColor: BRAND + "40" }}>
            <ClipboardList className="w-3.5 h-3.5" />
            Open Case Tracker →
          </button>
        </Link>
      </div>

      {/* Staff tier selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: BRAND }} />
            <span className="text-xs font-semibold text-gray-700">Staff Count Tier:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {STAFF_TIERS.map(t => (
              <button
                key={t.id}
                onClick={() => setTier(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tier === t.id ? "text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                style={tier === t.id ? { background: BRAND } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Summary Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Stethoscope className="w-4 h-4" style={{ color: BRAND }} />
          <span className="text-sm font-bold text-gray-800">Required Cases at a Glance</span>
          <span className="ml-auto text-xs text-gray-400 font-medium">{STAFF_TIERS.find(t => t.id === tier)?.label}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-2.5 font-semibold text-gray-500">Modality</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Cases Required</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Lookback</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Key Requirement</th>
              </tr>
            </thead>
            <tbody>
              {CM_MODALITIES.map(m => {
                const count = m.staffBased ? m.casesByTier?.[tier] : null;
                return (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: m.color + "18" }}>
                          <m.icon className="w-3 h-3" style={{ color: m.color }} />
                        </div>
                        <span className="font-semibold text-gray-800">{m.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {count !== null && count !== undefined
                        ? <span className="font-bold text-base" style={{ color: m.color, fontFamily: "JetBrains Mono, monospace" }}>{count}</span>
                        : <span className="text-gray-500 italic">Per physician</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{m.lookbackMonths} mo</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      {m.id === "ATEE" && "1 complete case per TEE physician; ≥1 case with significant MR"}
                      {m.id === "PTEE" && "1 complete case per physician (focused ok for reaccreditation)"}
                      {m.id === "STRESS" && "Abnormal RWMA at rest, inducible RWMA, or UEA stress case"}
                      {m.id === "ACTE" && "Must include ≥1 ToF case; remainder from approved complex CHD list"}
                      {m.id === "PTTE" && (() => {
                        const bd = m.breakdownByTier?.[tier];
                        return bd ? bd.map(b => `${b.count} ${b.label}`).join(", ") : "Shunts, obstructions, complex defects";
                      })()}
                      {m.id === "FETAL" && (() => {
                        const bd = m.breakdownByTier?.[tier];
                        return bd ? bd.map(b => `${b.count} ${b.label}`).join(", ") : "Shunts, obstructions, arrhythmia, hypoplastic ventricle";
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Rules */}
      <CollapsibleSection title="Universal Submission Rules" subtitle="Applies to all modalities" icon={Info} color={BRAND} defaultOpen={true}>
        <RuleList items={GLOBAL_RULES} color={BRAND} />
      </CollapsibleSection>

      {/* Per-Modality Cards */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Modality-Specific Requirements</div>
        <div className="space-y-3">
          {CM_MODALITIES.map(m => <ModalityCard key={m.id} modality={m} tier={tier} />)}
        </div>
      </div>

      {/* Multiple Sites */}
      <CollapsibleSection title="Multiple Sites — Additional Requirements" subtitle="Required in addition to base facility cases" icon={Building2} color="#6b7280">
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Adult Facility (each additional site)</div>
            <RuleList items={MULTI_SITE_ADULT} color="#6b7280" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pediatric Facility (each additional site)</div>
            <RuleList items={MULTI_SITE_PEDIATRIC} color="#059669" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fetal (each additional site, if applicable)</div>
            <RuleList items={MULTI_SITE_FETAL} color="#db2777" />
          </div>
          <div className="rounded-lg p-3 text-xs text-gray-600 leading-relaxed" style={{ background: "#f8fafc", borderLeft: "3px solid #6b7280" }}>
            {MULTI_SITE_NOTE}
          </div>
        </div>
      </CollapsibleSection>

      <p className="text-xs text-gray-400 text-center pb-2">
        Source: IAC Echocardiography Accreditation Checklist ·{" "}
        <a href="https://www.intersocietal.org/echo/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
          intersocietal.org/echo
        </a>
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccreditationNavigator() {
  const [activeTab, setActiveTab] = useState<"standards" | "readiness">("standards");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModality, setActiveModality] = useState<Modality | "All">("All");
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");

  // Check if user has an active paid DIY Tool subscription
  const { data: myLab } = trpc.lab.getMyLab.useQuery(undefined, { retry: false });
  const hasPaidSubscription = myLab?.status === "active";

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return STANDARDS.filter(s => {
      const modalityMatch = activeModality === "All" || s.modalities.includes(activeModality as Modality);
      const categoryMatch = activeCategory === "All" || s.category === activeCategory;
      const textMatch = !q || (
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q)) ||
        s.section.toLowerCase().includes(q)
      );
      return modalityMatch && categoryMatch && textMatch;
    });
  }, [searchQuery, activeModality, activeCategory]);

  const modalities: Array<Modality | "All"> = ["All", "TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM"];
  const categories: Array<Category | "All"> = ["All", "personnel", "case_mix", "cme", "procedures", "quality", "policies", "facility", "equipment"];

  const showCaseMix = activeCategory === "case_mix" && activeModality === "All" && !searchQuery;

  return (
    <Layout>
      {/* Header */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="container py-8">
          <div className="mb-3">
            <BackToEchoAssist className="text-white/70 hover:text-white" />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <BookOpen className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-xs text-white/80 font-medium">Free Resource</span>
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                EchoAccreditation Navigator™
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Your go-to guide for IAC echo accreditation standards — search case requirements, CME, staff qualifications, and policies for TTE, TEE, Stress, Pediatric, Fetal, and HOCM.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href="/accreditation">
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                    <ClipboardList className="w-3.5 h-3.5" />
                    DIY Accreditation Tool™ →
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="container">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab("standards")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "standards"
                  ? "border-[#189aa1] text-[#189aa1]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Standards & Requirements
            </button>
            <button
              onClick={() => setActiveTab("readiness")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "readiness"
                  ? "border-[#189aa1] text-[#189aa1]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Accreditation Readiness
            </button>
          </div>
        </div>
      </div>

      {/* Readiness Tab */}
      {activeTab === "readiness" && (
        <div className="container py-6 max-w-3xl">
          {hasPaidSubscription ? (
            // Paid subscribers → prompt to use the full DIY Tool
            <div className="rounded-xl border border-[#189aa1]/30 bg-gradient-to-br from-[#f0fbfc] to-white p-8 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#189aa1" }}>
                <Lock className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>
                You have access to the full DIY Accreditation Tool™
              </h2>
              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                Your active subscription includes the complete Accreditation Readiness checklist with staff linking, case data integration, and more — available in the DIY Tool.
              </p>
              <Link href="/accreditation">
                <button
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                  style={{ background: "#189aa1" }}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Open DIY Accreditation Tool™
                </button>
              </Link>
            </div>
          ) : (
            // Free users → full interactive readiness checklist (Navigator backend)
            <AccreditationReadiness trpcNamespace="accreditationReadinessNavigator" />
          )}
        </div>
      )}

      {/* Standards Tab content */}
      {activeTab !== "readiness" && (
      <>
      {/* Search & Filters */}
      <div className="border-b border-gray-200 bg-[#f0fbfc] sticky top-[49px] z-10">
        <div className="container py-3 space-y-2">
          {/* Search */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9 h-9 text-sm bg-white"
              placeholder="Search standards, case requirements, CME, policies..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Modality filter */}
          <div className="flex flex-wrap gap-1">
            {modalities.map(m => {
              const isActive = activeModality === m;
              const mc = m !== "All" ? MODALITY_CONFIG[m as Modality] : null;
              return (
                <button
                  key={m}
                  onClick={() => setActiveModality(m)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${isActive ? "text-white shadow-sm" : "bg-white hover:bg-[#f0fbfc]"}`}
                  style={isActive ? { background: mc?.color ?? BRAND } : { color: "#189aa1", border: "1px solid #189aa1" + "40" }}
                >
                  {m === "All" ? "All Modalities" : mc?.label}
                </button>
              );
            })}
          </div>
          {/* Category filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${activeCategory === "All" ? "text-white shadow-sm" : "bg-white hover:bg-[#f0fbfc]"}`}
              style={activeCategory === "All" ? { background: BRAND } : { color: "#189aa1", border: "1px solid #189aa1" + "40" }}
            >
              All Topics
            </button>
            {(Object.keys(CATEGORY_CONFIG) as Category[]).map(cat => {
              const cc = CATEGORY_CONFIG[cat];
              const CatIcon = cc.icon;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${isActive ? "text-white shadow-sm" : "bg-white hover:bg-[#f0fbfc]"}`}
                  style={isActive ? { background: cc.color } : { color: "#189aa1", border: "1px solid #189aa1" + "40" }}
                >
                  <CatIcon className="w-3 h-3" />
                  {cc.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container py-6">
        {showCaseMix ? (
          <CaseMixRequirementsView />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-800">{filtered.length}</span> standard{filtered.length !== 1 ? "s" : ""} found
                {searchQuery && <span> for "<span className="font-medium text-[#189aa1]">{searchQuery}</span>"</span>}
              </p>
              <a
                href="https://intersocietal.org/programs/echocardiography/standards/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#189aa1] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Official IAC Standards
              </a>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No standards found matching your search.</p>
                <button onClick={() => { setSearchQuery(""); setActiveModality("All"); setActiveCategory("All"); }} className="mt-2 text-xs text-[#189aa1] hover:underline">Clear filters</button>
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl">
                {filtered.map(s => <StandardCard key={s.id} standard={s} />)}
              </div>
            )}
          </>
        )}
      </div>
      </>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white">
        <div className="container py-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Based on IAC Standards for Echocardiography Accreditation. Always refer to the current official IAC Standards document for definitive requirements.</span>
            </div>
            <div className="flex gap-3">
              <a href="https://intersocietal.org/programs/echocardiography/standards/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">IAC Standards →</a>
              <a href="https://www.asecho.org/guidelines/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">ASE Guidelines →</a>
              <a href="https://www.ardms.org/maintain-certification/ce-requirements/" target="_blank" rel="noopener noreferrer" className="text-[#189aa1] hover:underline">ARDMS CE →</a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
