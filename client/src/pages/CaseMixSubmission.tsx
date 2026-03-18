/*
 * Case Mix Submission — IAC Echocardiography Accreditation
 * Two modes:
 *  1. Requirements — static IAC reference (staff-count based)
 *  2. Case Tracker — per-case data entry with running totals
 */
import { useState, useMemo } from "react";
import {
  Info, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  Users, Activity, Microscope, Baby, Heart, Stethoscope, Building2,
  PlusCircle, Trash2, ClipboardList, BookOpen, ChevronRight, X,
  CheckCheck, Clock, AlertTriangle
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import PossibleCaseStudies from "@/components/PossibleCaseStudies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// ─── Brand ────────────────────────────────────────────────────────────────────
const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";

// ─── Staff-count tiers ────────────────────────────────────────────────────────
type StaffTier = "le5" | "6to8" | "9to15" | "16to25" | "gt25";

const STAFF_TIERS: { id: StaffTier; label: string }[] = [
  { id: "le5",    label: "5 or fewer staff" },
  { id: "6to8",   label: "6 – 8 staff" },
  { id: "9to15",  label: "9 – 15 staff" },
  { id: "16to25", label: "16 – 25 staff" },
  { id: "gt25",   label: "Greater than 25 staff" },
];

// ─── Modality data ─────────────────────────────────────────────────────────────
interface CaseBreakdown { label: string; count: number; }

interface ModalityRequirement {
  id: string;
  label: string;
  fullName: string;
  icon: React.ElementType;
  color: string;
  staffBased: boolean;
  casesByTier?: Record<StaffTier, number>;
  fixedNote?: string;
  breakdownByTier?: Record<StaffTier, CaseBreakdown[]>;
  caseTypeRules: string[];
  submissionRules: string[];
  lookbackMonths: number;
  /** Case type options for the tracker dropdown */
  caseTypeOptions: string[];
}

const MODALITIES: ModalityRequirement[] = [
  {
    id: "ATTE",
    label: "Adult TTE",
    fullName: "Adult Transthoracic Echocardiography",
    icon: Stethoscope,
    color: "#189aa1",
    staffBased: true,
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
    caseTypeOptions: [
      "LV RWMA (Regional Wall Motion Abnormality)",
      "Aortic Stenosis",
    ],
  },
  {
    id: "STRESS",
    label: "Adult Stress Echo",
    fullName: "Adult Stress Echocardiography",
    icon: Activity,
    color: "#d97706",
    staffBased: true,
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
    caseTypeOptions: [
      "Abnormal RWMA at rest (CAD/MI)",
      "Inducible RWMA (CAD/MI)",
      "Stress with Ultrasound Enhancing Agents (UEA)",
    ],
  },
  {
    id: "ATEE",
    label: "Adult TEE",
    fullName: "Adult Transesophageal Echocardiography",
    icon: Microscope,
    color: "#0e6b72",
    staffBased: false,
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
    caseTypeOptions: [
      "Significant Mitral Regurgitation",
      "Suspected Cardiac Source of Embolus",
      "Intraoperative TEE (complete)",
      "Other Complete TEE",
    ],
  },
  {
    id: "ACTE",
    label: "Adult Congenital TTE",
    fullName: "Adult Congenital Transthoracic Echocardiography",
    icon: Heart,
    color: "#7c3aed",
    staffBased: true,
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
    caseTypeOptions: [
      "Tetralogy of Fallot (repaired/palliated)",
      "Conotruncal Defect",
      "AV Canal Defect",
      "Single Ventricle / Fontan",
      "D-TGA (repaired)",
      "L-TGA (congenitally corrected transposition)",
      "Ross Procedure",
    ],
  },
  {
    id: "PTTE",
    label: "Pediatric TTE",
    fullName: "Pediatric Transthoracic Echocardiography",
    icon: Users,
    color: "#059669",
    staffBased: true,
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
    caseTypeOptions: [
      "Shunt — ASD",
      "Shunt — VSD",
      "Shunt — PDA",
      "Simple Obstruction — Aortic Valve Stenosis",
      "Simple Obstruction — Pulmonary Valve Stenosis",
      "Simple Obstruction — Coarctation of the Aorta",
      "Complex Defect — AV Canal",
      "Complex Defect — Tetralogy of Fallot",
      "Complex Defect — Ventricular Hypoplasia",
      "Complex Defect — Truncus Arteriosus",
      "Complex Defect — Interrupted Aortic Arch",
      "Complex Defect — Other",
    ],
  },
  {
    id: "PTEE",
    label: "Pediatric TEE",
    fullName: "Pediatric Transesophageal Echocardiography",
    icon: Microscope,
    color: "#0891b2",
    staffBased: false,
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
    caseTypeOptions: [
      "Complete PTEE",
      "Focused PTEE (reaccreditation only)",
    ],
  },
  {
    id: "FETAL",
    label: "Fetal Echo",
    fullName: "Fetal Echocardiography",
    icon: Baby,
    color: "#db2777",
    staffBased: true,
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
    caseTypeOptions: [
      "Shunt (ASD/VSD/PDA)",
      "Simple Obstruction",
      "Complex Defect",
      "Fetal Arrhythmia",
      "Hypoplastic Ventricle",
    ],
  },
];

// ─── Global Submission Rules ───────────────────────────────────────────────────
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
  "1 adult congenital TTE from each site: conotruncal defects, AV canal defects, ToF, single ventricle (Fontan), D-TGA (repaired) or L-TGA, or Ross procedure.",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Case Tracker ─────────────────────────────────────────────────────────────
type ModalityId = "ATTE" | "ATEE" | "STRESS" | "ACTE" | "PTTE" | "PTEE" | "FETAL";

/** Helper: format a staff member's display label with credentials */
function staffLabel(m: any): string {
  const name = m.displayName || m.inviteEmail || "Unknown";
  const creds = m.credentials ? `, ${m.credentials}` : "";
  const roleLabel =
    m.role === "technical_director" ? " [Tech Dir]" :
    m.role === "medical_director" ? " [Med Dir]" : "";
  return `${name}${creds}${roleLabel}`;
}

// Modality IDs that belong to each accreditation type
const ADULT_ECHO_MODALITIES = ["ATTE", "STRESS", "ATEE", "ACTE"];
const PEDS_FETAL_MODALITIES = ["PTTE", "PTEE", "FETAL"];

function CaseTracker({ tier }: { tier: StaffTier }) {
  const { isAuthenticated } = useAuth();

  // Fetch lab info to get accreditation types
  const { data: labData } = trpc.lab.getMyLab.useQuery(undefined, { enabled: isAuthenticated });
  const accreditationTypes: string[] = (() => {
    try { return JSON.parse((labData as any)?.accreditationTypes ?? "[]"); } catch { return []; }
  })();

  // Filter modalities based on accreditation type selection
  // If no selection yet, show all modalities
  const visibleModalities = accreditationTypes.length === 0
    ? MODALITIES
    : MODALITIES.filter(m => {
        if (ADULT_ECHO_MODALITIES.includes(m.id) && accreditationTypes.includes("adult_echo")) return true;
        if (PEDS_FETAL_MODALITIES.includes(m.id) && accreditationTypes.includes("pediatric_fetal_echo")) return true;
        return false;
      });

  const [activeModality, setActiveModality] = useState<string>(() => visibleModalities[0]?.id ?? MODALITIES[0].id);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [studyId, setStudyId] = useState("");
  const [studyDate, setStudyDate] = useState("");
  const [caseType, setCaseType] = useState("");
  // Sonographer — either a lab member ID (number) or "_freetext_"
  const [sonographerMemberId, setSonographerMemberId] = useState<number | "_freetext_" | null>(null);
  const [sonographerFreeText, setSonographerFreeText] = useState("");
  // Physician — either a lab member ID (number) or "_freetext_"
  const [physicianMemberId, setPhysicianMemberId] = useState<number | "_freetext_" | null>(null);
  const [physicianFreeText, setPhysicianFreeText] = useState("");
  const [isTechDir, setIsTechDir] = useState(false);
  const [isMedDir, setIsMedDir] = useState(false);
  const [notes, setNotes] = useState("");

  // tRPC
  const { data: cases = [], refetch } = trpc.caseMix.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: staffData } = trpc.caseMix.getLabStaff.useQuery(undefined, { enabled: isAuthenticated });
  const createMutation = trpc.caseMix.create.useMutation({
    onSuccess: () => {
      toast.success("Case saved", { description: `${activeModality} case added to tracker.` });
      refetch();
      resetForm();
      setShowForm(false);
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });
  const deleteMutation = trpc.caseMix.delete.useMutation({
    onSuccess: () => { toast.success("Case removed"); refetch(); },
    onError: (err) => toast.error("Error", { description: err.message }),
  });

  function resetForm() {
    setStudyId(""); setStudyDate(""); setCaseType("");
    setSonographerMemberId(null); setSonographerFreeText("");
    setPhysicianMemberId(null); setPhysicianFreeText("");
    setIsTechDir(false); setIsMedDir(false); setNotes("");
  }

  // Ensure activeModality is always within visible modalities
  const effectiveModality = visibleModalities.find(m => m.id === activeModality)
    ? activeModality
    : (visibleModalities[0]?.id ?? activeModality);
  const modality = MODALITIES.find(m => m.id === effectiveModality)!;
  const modalityCases = cases.filter((c: any) => c.modality === activeModality);
  const required = modality.staffBased ? (modality.casesByTier?.[tier] ?? 0) : null;
  const pct = required ? Math.min(100, Math.round((modalityCases.length / required) * 100)) : null;

  const sonographers = staffData?.sonographers ?? [];
  const physicians = staffData?.physicians ?? [];

  /** When a sonographer is selected from the dropdown, auto-set IAC Tech Dir flag */
  function handleSonographerSelect(val: string) {
    if (val === "_freetext_") {
      setSonographerMemberId("_freetext_");
      setIsTechDir(false);
    } else {
      const id = Number(val);
      setSonographerMemberId(id);
      const member = sonographers.find((s: any) => s.id === id);
      if (member?.role === "technical_director") setIsTechDir(true);
      else setIsTechDir(false);
    }
  }

  /** When a physician is selected from the dropdown, auto-set IAC Med Dir flag */
  function handlePhysicianSelect(val: string) {
    if (val === "_freetext_") {
      setPhysicianMemberId("_freetext_");
      setIsMedDir(false);
    } else {
      const id = Number(val);
      setPhysicianMemberId(id);
      const member = physicians.find((p: any) => p.id === id);
      if (member?.role === "medical_director") setIsMedDir(true);
      else setIsMedDir(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studyId.trim()) { toast.error("Study ID required"); return; }
    if (!caseType) { toast.error("Case type required"); return; }

    // Resolve sonographer
    let resolvedSonoId: number | undefined;
    let resolvedSonoName: string | undefined;
    if (sonographerMemberId === "_freetext_") {
      resolvedSonoName = sonographerFreeText || undefined;
    } else if (typeof sonographerMemberId === "number") {
      resolvedSonoId = sonographerMemberId;
      const m = sonographers.find((s: any) => s.id === sonographerMemberId);
      resolvedSonoName = m ? (m.displayName || m.inviteEmail) : undefined;
    }

    // Resolve physician
    let resolvedMdId: number | undefined;
    let resolvedMdName: string | undefined;
    if (physicianMemberId === "_freetext_") {
      resolvedMdName = physicianFreeText || undefined;
    } else if (typeof physicianMemberId === "number") {
      resolvedMdId = physicianMemberId;
      const m = physicians.find((p: any) => p.id === physicianMemberId);
      resolvedMdName = m ? (m.displayName || m.inviteEmail) : undefined;
    }

    createMutation.mutate({
      modality: activeModality as ModalityId,
      caseType,
      studyIdentifier: studyId.trim(),
      studyDate: studyDate || undefined,
      sonographerLabMemberId: resolvedSonoId,
      sonographerName: resolvedSonoName,
      physicianLabMemberId: resolvedMdId,
      physicianName: resolvedMdName,
      isTechDirectorCase: isTechDir,
      isMedDirectorCase: isMedDir,
      notes: notes || undefined,
    });
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
        <p className="text-sm text-gray-600 font-medium">Sign in to track your case mix submissions</p>
        <p className="text-xs text-gray-400 mt-1">Cases are saved to your lab account</p>
      </div>
    );
  }

  // ─── Per-category summary data ───────────────────────────────────────────────
  const categorySummary = visibleModalities.map(m => {
    const logged = cases.filter((c: any) => c.modality === m.id).length;
    const required = m.staffBased ? (m.casesByTier?.[tier] ?? 0) : null;
    const pct = required ? Math.min(100, Math.round((logged / required) * 100)) : null;
    const isComplete = required !== null && logged >= required;
    return { ...m, logged, required, pct, isComplete };
  });

  const completedCount = categorySummary.filter(s => s.isComplete).length;
  const totalWithRequirements = categorySummary.filter(s => s.required !== null).length;

  return (
    <div className="space-y-4">
      {/* ── Case Count Summary Banner ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" style={{ color: BRAND }} />
            <span className="text-sm font-bold text-gray-800">Case Count Summary</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Categories met:</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
              background: completedCount === totalWithRequirements ? "#dcfce7" : BRAND + "15",
              color: completedCount === totalWithRequirements ? "#16a34a" : BRAND
            }}>
              {completedCount} / {totalWithRequirements}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-0 divide-x divide-y divide-gray-50">
          {categorySummary.map(s => (
            <button
              key={s.id}
              onClick={() => { setActiveModality(s.id); setShowForm(false); }}
              className={`flex flex-col gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                activeModality === s.id ? "bg-gray-50" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <s.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.color }} />
                  <span className="text-xs font-semibold text-gray-700 leading-tight">{s.label}</span>
                </div>
                {s.isComplete ? (
                  <CheckCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : s.required !== null && s.logged > 0 ? (
                  <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                ) : s.required !== null ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                ) : null}
              </div>
              {s.required !== null ? (
                <>
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-black leading-none" style={{
                      fontFamily: "JetBrains Mono, monospace",
                      color: s.isComplete ? "#16a34a" : s.color
                    }}>
                      {s.logged}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">/ {s.required}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.pct ?? 0}%`, background: s.isComplete ? "#10b981" : s.color }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {s.isComplete ? "Requirement met" : `${s.required! - s.logged} more needed`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-gray-400 italic">Per MD discretion</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Modality selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto">
          {visibleModalities.map(m => {
            const mCases = cases.filter((c: any) => c.modality === m.id);
            const mRequired = m.staffBased ? (m.casesByTier?.[tier] ?? 0) : null;
            const isActive = activeModality === m.id;
            const isComplete = mRequired !== null && mCases.length >= mRequired;
            return (
              <button
                key={m.id}
                onClick={() => { setActiveModality(m.id); setShowForm(false); }}
                className={`flex flex-col items-center gap-1 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                  isActive ? "border-b-2 text-white" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                style={isActive ? { borderBottomColor: m.color, background: m.color + "12", color: m.color } : {}}
              >
                <div className="flex items-center gap-1.5">
                  <m.icon className="w-3.5 h-3.5" />
                  {m.label}
                  {isComplete && <CheckCheck className="w-3 h-3 text-green-500" />}
                </div>
                <span className="text-xs font-bold" style={{ color: isActive ? m.color : "#9ca3af" }}>
                  {mCases.length}{mRequired !== null ? `/${mRequired}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active modality panel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: modality.color + "18" }}>
              <modality.icon className="w-4 h-4" style={{ color: modality.color }} />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{modality.label}</div>
              <div className="text-xs text-gray-500">{modality.fullName}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {required !== null && (
              <div className="text-right">
                <div className="text-xs text-gray-500">Progress</div>
                <div className="text-sm font-bold" style={{ color: modality.color, fontFamily: "JetBrains Mono, monospace" }}>
                  {modalityCases.length} / {required}
                </div>
              </div>
            )}
            <Button
              size="sm"
              onClick={() => setShowForm(v => !v)}
              className="text-white text-xs"
              style={{ background: modality.color }}
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1" />
              Add Case
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {pct !== null && (
          <div className="px-5 pt-3 pb-1">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct >= 100 ? "#10b981" : modality.color }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{pct}% complete</span>
              {pct >= 100
                ? <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCheck className="w-3 h-3" /> Requirement met</span>
                : <span>{required! - modalityCases.length} more needed</span>
              }
            </div>
          </div>
        )}

        {/* Add case form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-gray-100 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">New Case Entry</span>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* De-identified Study ID */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">De-identified Study ID *</label>
                <Input
                  value={studyId}
                  onChange={e => setStudyId(e.target.value)}
                  placeholder="e.g. ECHO-2024-001"
                  className="text-xs h-8"
                  required
                />
              </div>
              {/* Study Date */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Study Date</label>
                <Input
                  type="date"
                  value={studyDate}
                  onChange={e => setStudyDate(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              {/* Case Type */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Case Type *</label>
                <Select value={caseType} onValueChange={setCaseType}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Select case type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {modality.caseTypeOptions.map(opt => (
                      <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Sonographer — linked to Lab Admin staff */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Sonographer
                  {sonographers.length > 0 && (
                    <span className="ml-1.5 text-[10px] font-normal text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">from Lab Admin</span>
                  )}
                </label>
                {sonographers.length > 0 ? (
                  <>
                    <Select
                      value={sonographerMemberId !== null ? String(sonographerMemberId) : ""}
                      onValueChange={handleSonographerSelect}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Select staff member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sonographers.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                            {staffLabel(s)}
                          </SelectItem>
                        ))}
                        <SelectItem value="_freetext_" className="text-xs italic text-gray-400">Enter name manually…</SelectItem>
                      </SelectContent>
                    </Select>
                    {sonographerMemberId === "_freetext_" && (
                      <Input
                        value={sonographerFreeText}
                        onChange={e => setSonographerFreeText(e.target.value)}
                        placeholder="Enter sonographer name..."
                        className="text-xs h-8 mt-1"
                        autoFocus
                      />
                    )}
                  </>
                ) : (
                  <Input
                    value={sonographerFreeText}
                    onChange={e => setSonographerFreeText(e.target.value)}
                    placeholder="Sonographer name (optional)"
                    className="text-xs h-8"
                  />
                )}
              </div>
              {/* Interpreting Physician — linked to Lab Admin staff */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Interpreting Physician
                  {physicians.length > 0 && (
                    <span className="ml-1.5 text-[10px] font-normal text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">from Lab Admin</span>
                  )}
                </label>
                {physicians.length > 0 ? (
                  <>
                    <Select
                      value={physicianMemberId !== null ? String(physicianMemberId) : ""}
                      onValueChange={handlePhysicianSelect}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Select staff member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {physicians.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                            {staffLabel(p)}
                          </SelectItem>
                        ))}
                        <SelectItem value="_freetext_" className="text-xs italic text-gray-400">Enter name manually…</SelectItem>
                      </SelectContent>
                    </Select>
                    {physicianMemberId === "_freetext_" && (
                      <Input
                        value={physicianFreeText}
                        onChange={e => setPhysicianFreeText(e.target.value)}
                        placeholder="Enter physician name..."
                        className="text-xs h-8 mt-1"
                        autoFocus
                      />
                    )}
                  </>
                ) : (
                  <Input
                    value={physicianFreeText}
                    onChange={e => setPhysicianFreeText(e.target.value)}
                    placeholder="Physician name (optional)"
                    className="text-xs h-8"
                  />
                )}
              </div>
              {/* Notes */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notes (optional)</label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="text-xs h-8"
                />
              </div>
            </div>
            {/* IAC flags */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={isTechDir} onChange={e => setIsTechDir(e.target.checked)} className="rounded" />
                <span>Technical Director case</span>
                {isTechDir && typeof sonographerMemberId === "number" && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">auto-set</span>
                )}
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={isMedDir} onChange={e => setIsMedDir(e.target.checked)} className="rounded" />
                <span>Medical Director represented</span>
                {isMedDir && typeof physicianMemberId === "number" && (
                  <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full font-medium">auto-set</span>
                )}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => { resetForm(); setShowForm(false); }}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-xs h-7 text-white" style={{ background: modality.color }} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save Case"}
              </Button>
            </div>
          </form>
        )}

        {/* Case list */}
        <div className="divide-y divide-gray-50">
          {modalityCases.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">No cases logged yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Click "Add Case" to start tracking</p>
            </div>
          ) : (
            modalityCases.map((c: any, idx: number) => (
              <div key={c.id} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: modality.color + "18", color: modality.color }}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800">{c.studyIdentifier}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: modality.color + "15", color: modality.color }}>
                        {c.caseType}
                      </span>
                      {c.isTechDirectorCase && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Tech Dir</span>
                      )}
                      {c.isMedDirectorCase && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">Med Dir</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.studyDate && <span className="text-xs text-gray-400">{c.studyDate}</span>}
                      {c.sonographerName && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="font-medium text-gray-400">Sono:</span>
                          {c.sonographerName}
                          {c.sonographerLabMemberId && (
                            <span className="text-[10px] text-teal-600 bg-teal-50 px-1 py-0.5 rounded">linked</span>
                          )}
                        </span>
                      )}
                      {c.physicianName && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="font-medium text-gray-400">MD:</span>
                          {c.physicianName}
                          {c.physicianLabMemberId && (
                            <span className="text-[10px] text-teal-600 bg-teal-50 px-1 py-0.5 rounded">linked</span>
                          )}
                        </span>
                      )}
                    </div>
                    {c.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{c.notes}</p>}
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate({ id: c.id })}
                  className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-1"
                  title="Remove case"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Breakdown progress (for modalities with case type breakdowns) */}
        {modality.breakdownByTier && modality.breakdownByTier[tier] && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Case Type Breakdown Progress</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {modality.breakdownByTier[tier].map(b => {
                // Count how many logged cases match this breakdown category (fuzzy match on caseType)
                const matchCount = modalityCases.filter((c: any) =>
                  c.caseType.toLowerCase().includes(b.label.toLowerCase().split(" ")[0])
                ).length;
                const isMetBd = matchCount >= b.count;
                return (
                  <div key={b.label} className={`rounded-lg px-3 py-2 text-center border ${isMetBd ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
                    <div className="text-sm font-bold" style={{ color: isMetBd ? "#10b981" : modality.color, fontFamily: "JetBrains Mono, monospace" }}>
                      {matchCount}/{b.count}
                    </div>
                    <div className="text-xs text-gray-600 leading-tight">{b.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Summary across all modalities */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <CheckCheck className="w-4 h-4" style={{ color: BRAND }} />
          <span className="text-sm font-bold text-gray-800">Overall Tracker Summary</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-2.5 font-semibold text-gray-500">Modality</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Logged</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Required</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleModalities.map(m => {
                const mCases = cases.filter((c: any) => c.modality === m.id);
                const mRequired = m.staffBased ? (m.casesByTier?.[tier] ?? 0) : null;
                const isComplete = mRequired !== null && mCases.length >= mRequired;
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
                    <td className="px-4 py-3 text-center font-bold" style={{ color: m.color, fontFamily: "JetBrains Mono, monospace" }}>
                      {mCases.length}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {mRequired !== null ? mRequired : <span className="italic text-gray-400">Per MD</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {mRequired === null ? (
                        <span className="text-xs text-gray-400 italic">Track manually</span>
                      ) : isComplete ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                          <CheckCheck className="w-3 h-3" /> Met
                        </span>
                      ) : mCases.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <Clock className="w-3 h-3" /> In Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400">
                          <AlertTriangle className="w-3 h-3" /> Not started
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CaseMixSubmission({ initialView }: { initialView?: "requirements" | "tracker" | "possible-cases" }) {
  const { isAuthenticated } = useAuth();
  const [tier, setTier] = useState<StaffTier>("le5");
  const [view, setView] = useState<"requirements" | "tracker" | "possible-cases">(initialView ?? "requirements");

  // Fetch lab info to get accreditation types for filtering
  const { data: labData } = trpc.lab.getMyLab.useQuery(undefined, { enabled: isAuthenticated });
  const accreditationTypes: string[] = (() => {
    try { return JSON.parse((labData as any)?.accreditationTypes ?? "[]"); } catch { return []; }
  })();
  const visibleModalities = accreditationTypes.length === 0
    ? MODALITIES
    : MODALITIES.filter(m => {
        if (ADULT_ECHO_MODALITIES.includes(m.id) && accreditationTypes.includes("adult_echo")) return true;
        if (PEDS_FETAL_MODALITIES.includes(m.id) && accreditationTypes.includes("pediatric_fetal_echo")) return true;
        return false;
      });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
            Case Mix Submissions
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">IAC Echocardiography Accreditation — Updated 6-8-2023</p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          <button
            onClick={() => setView("requirements")}
            className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${view === "requirements" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={view === "requirements" ? { background: BRAND } : {}}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Requirements
          </button>
          <button
            onClick={() => setView("tracker")}
            className={`px-4 py-2 flex items-center gap-1.5 transition-colors border-l border-gray-200 ${view === "tracker" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={view === "tracker" ? { background: BRAND } : {}}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Case Tracker
          </button>
          <button
            onClick={() => setView("possible-cases")}
            className={`px-4 py-2 flex items-center gap-1.5 transition-colors border-l border-gray-200 ${view === "possible-cases" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={view === "possible-cases" ? { background: BRAND } : {}}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            Possible Cases
          </button>
        </div>
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tier === t.id ? "text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={tier === t.id ? { background: BRAND } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Accreditation Type Filter Indicator */}
      {accreditationTypes.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#189aa1]/20 bg-[#189aa1]/5 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BRAND }} />
          <span className="text-gray-600">
            Showing modalities for:
            {accreditationTypes.includes("adult_echo") && (
              <span className="ml-1 font-semibold text-gray-800">Adult Echocardiography</span>
            )}
            {accreditationTypes.includes("adult_echo") && accreditationTypes.includes("pediatric_fetal_echo") && (
              <span className="mx-1 text-gray-400">+</span>
            )}
            {accreditationTypes.includes("pediatric_fetal_echo") && (
              <span className="font-semibold text-gray-800">Pediatric / Fetal Echocardiography</span>
            )}
          </span>
          <span className="ml-auto text-[#189aa1] font-medium cursor-pointer hover:underline"
            onClick={() => window.location.href = "/lab-admin"}>
            Change in Lab Admin
          </span>
        </div>
      )}
      {accreditationTypes.length === 0 && isAuthenticated && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
          <span className="text-amber-700">
            No accreditation type selected — showing all modalities.
          </span>
          <span className="ml-auto text-amber-600 font-medium cursor-pointer hover:underline"
            onClick={() => window.location.href = "/lab-admin"}>
            Set in Lab Admin
          </span>
        </div>
      )}

      {/* Content */}
      {view === "requirements" ? (
        <div className="space-y-4">
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
                  {visibleModalities.map(m => {
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
              {visibleModalities.map(m => <ModalityCard key={m.id} modality={m} tier={tier} />)}
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
            Source: IAC Echocardiography Accreditation Checklist, Updated 6-8-2023 ·{" "}
            <a href="https://www.intersocietal.org/echo/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
              intersocietal.org/echo
            </a>
          </p>
        </div>
      ) : view === "tracker" ? (
        <CaseTracker tier={tier} />
      ) : (
        <PossibleCaseStudies />
      )}
    </div>
  );
}
