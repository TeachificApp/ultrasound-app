/*
  SonographerPeerReview — 6-step form mapped from Formsite (xywdastuhm)
  Exam-type identifiers: AETTE, AETEE, AE_STRESS, PETTE, PETEE, FE
  Review Type is hardcoded as "PEER REVIEW".
  Key differences from Quality Review:
    - No Indication Appropriateness question
    - No Demographics Accurate question
    - No IAC Acceptable question
    - Sonographer Email is REQUIRED (not optional)
    - Page 3 uses different question set (Overall Image Quality vs Basic Exam Quality)
    - Page 4 is Measurements (same structure)
    - Page 5 is Doppler Quality (same structure)
    - Page 6 is Cardiac Evaluation + Overall Findings + Review Summary (slightly different questions)
*/
import { useState, useRef, useMemo } from "react";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, ChevronRight, Flag, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const BRAND = "#189aa1";
const TOTAL_STEPS = 6;

type ExamType = "ADULT TTE" | "ADULT TEE" | "ADULT STRESS" | "PEDIATRIC TTE" | "PEDIATRIC TEE" | "FETAL ECHO" | "";

interface PRForm {
  // Step 1 — Header Info
  reviewDate: string;
  examDate: string;
  examIdentifier: string;
  examType: ExamType;
  examScope: string;
  stressStudyType: string;
  examIndication: string;
  sonographerEmail: string; // required in Peer Review
  // Step 2 — Protocol Sequence
  protocolViewsObtained: string[];
  protocolViewsObtainedOther: string;
  protocolDopplerViewsObtained: string[]; // PETTE/PETEE shared doppler section
  // Step 3 — Overall Image Quality
  contrastUsed: string;
  contrastUsedComments: string;
  contrastSettingsAppropriate: string;
  contrastSettingsComments: string;
  onAxisImaging: string;
  onAxisImagingComments: string;
  effortSuboptimalViews: string;
  effortSuboptimalViewsComments: string;
  // Step 4 — Measurements/Accuracy
  allMeasurementsObtained: string;
  allMeasurementsComments: string;
  ventricularFunctionAccurate: string;
  ventricularFunctionComments: string;
  // Step 5 — Doppler Quality
  dopplerWaveformSettings: string;
  dopplerWaveformComments: string;
  forwardFlowSpectrum: string;
  forwardFlowComments: string;
  sampleVolumePlacement: string;
  sampleVolumePlacementComments: string;
  colorFlowInterrogation: string; // AETTE, PETTE, FE
  colorFlowComments: string;
  diastolicFunctionEval: string[]; // AETTE only — checkbox
  diastolicFunctionComments: string;
  pulmonaryVeinDoppler: string; // AETTE, PETTE, FE
  pulmonaryVeinComments: string;
  rightHeartFunctionEval: string[]; // AETTE, PETTE — checkbox
  rightHeartFunctionComments: string;
  // Step 6 — Cardiac Evaluation + Overall Findings + Review Summary
  aorticValveEval: string;
  aorticValveComments: string;
  mitralValveEval: string;
  mitralValveComments: string;
  tricuspidValveEval: string;
  tricuspidValveComments: string;
  pulmonicValveEval: string;
  pulmonicValveComments: string;
  additionalImagingMethods: string[];
  additionalImagingMethodsOther: string;
  strainCorrect: string; // AETTE only
  strainCorrectComments: string;
  imageOptimizationSummary: string;
  imageOptimizationComments: string;
  measurementAccuracySummary: string;
  measurementAccuracyComments: string;
  dopplerSettingsSummary: string;
  dopplerSettingsComments: string;
  protocolSequenceFollowed: string;
  protocolSequenceComments: string;
  pathologyDocumented: string;
  pathologyComments: string;
  clinicalQuestionAnswered: string;
  clinicalQuestionComments: string;
  reportConcordant: string;
  comparableToPreview: string;
  qualityScore: string;
  reviewComments: string;
  notifyAdmin: string;
  notifyAdminEmail: string;
  notifyAdminComments: string;
  notifySonographerComments: string;
}

// ── View lists ────────────────────────────────────────────────────────────────
const TTE_VIEWS = [
  "Parasternal long axis view",
  "Parasternal long axis m-mode",
  "Parasternal short axis views (at all levels AV, basal, mid & apical)",
  "Right ventricular inflow view (from anteriorly directed PLAX view)",
  "Right ventricular outflow view (from both PLAX and PSAX with correct measurements of peak velocity and acceleration time)",
  "Apical four-chamber view",
  "Apical five-chamber view",
  "Apical two-chamber view",
  "Apical long-axis/three-chamber view",
  "Subcostal four-chamber view",
  "Subcostal short axis view (when indicated)",
  "Subcostal IVC/hepatic vein view",
  "Subcostal Abdominal Aorta view",
  "Suprasternal notch view (with Color & CW Doppler)",
  "Right Parasternal view (when indicated)",
  "If limited exam - all components obtained or attempted",
  "Other",
];

const TEE_VIEWS = [
  "Mid Esophageal - Five Chamber View",
  "Mid Esophageal - Four Chamber View",
  "Mid Esophageal - Mitral Commissural View",
  "Mid Esophageal - Two Chamber View",
  "Mid Esophageal - LAX/AV",
  "Mid Esophageal - Asc AO/LAX",
  "Mid Esophageal - Asc AO/SAX",
  "Mid Esophageal - Pulm Veins",
  "Mid Esophageal - RV inflow/outflow",
  "Mid Esophageal - Bicaval View",
  "Mid Esophageal - LA Appendage View",
  "Mid Esophageal - LA Appendage Doppler",
  "Transgastric - Basal SAX View",
  "Transgastric - Midpapillary SAX View",
  "Transgastric - Apical SAX View",
  "Transgastric - RV inflow/outflow View",
  "Deep Transgastric - Five Chamber View",
  "Transgastric - Two Chamber View",
  "Transgastric - LAX View",
  "Upper Esophageal - Aortic Arch/LAX View",
  "Upper Esophageal - Aortic Arch/SAX View",
];

const STRESS_VIEWS = [
  "PRE Apical Four Chamber",
  "PRE Apical Two Chamber",
  "PRE PSAX at Mid Papillary Level",
  "PRE PLAX at Mid Ventricle",
  "IMPOST Apical Four Chamber (within 60 seconds of exercise cessation and/or peak target heart rate)",
  "IMPOST Apical Two Chamber",
  "IMPOST PSAX at Mid Papillary Level",
  "IMPOST PLAX at Mid Ventricle",
  "Side-By-Side View of PRE/IMPOST/STAGES Images",
];

const PETTE_VIEWS = [
  "Right, left or single ventricular anatomy and function",
  "Right, left or single atrial anatomy and function",
  "Systemic/pulmonary semilunar valve anatomy and function",
  "Ventricular and atrial septae",
  "Mitral, tricuspid or single atrioventricular valve anatomy and function",
  "Main pulmonary artery and proximal branches",
  "Inferior and superior vena cavae",
  "Hepatic veins",
  "Pulmonary veins",
  "Pericardium",
  "Measurements of the cardiac chambers and ventricular function where standard measurements are available",
  "Coronary arteries with decreased PRF/scale and measurements - when visible",
  "Ascending, transverse and descending aorta with definition of arch sidedness",
  "All appropriate views and clips",
  "Other",
];

const PETTE_PETEE_DOPPLER_VIEWS = [
  "Atrioventricular Valves",
  "Semilunar Valves",
  "Great Vessels",
  "Atrial Septum",
  "Ventricular Septum",
  "All identified areas of abnormality (if applicable)",
];

const PETEE_VIEWS = [
  "Mid Esophageal - Five Chamber View",
  "Mid Esophageal - Four Chamber View",
  "Mid Esophageal - Mitral Commissural View",
  "Mid Esophageal - Two Chamber View",
  "Mid Esophageal - LAX/AV",
  "Mid Esophageal - Asc AO/LAX",
  "Mid Esophageal - Asc AO/SAX",
  "Mid Esophageal - Pulm Veins",
  "Mid Esophageal - RV inflow/outflow",
  "Mid Esophageal - Bicaval View",
  "Mid Esophageal - LA Appendage View",
  "Transgastric - Basal SAX View",
  "Transgastric - Midpapillary SAX View",
  "Transgastric - Apical SAX View",
  "Transgastric - RV inflow/outflow View",
  "Deep Transgastric - Five Chamber View",
  "Transgastric - Two Chamber View",
  "Transgastric - LAX View",
  "Upper Esophageal - Aortic Arch/LAX View",
  "Upper Esophageal - Aortic Arch/SAX View",
  "Other",
];

const FETAL_VIEWS = [
  "Presence of single or multiple gestations and the locations of fetus(s) relative to mother (and each other)",
  "Survey of fetal lie and position defining fetal orientation",
  "Measurement of biparietal diameter (BPD), head circumference or other measures for estimation of fetal size/gestational age",
  "Cardiac position and visceral situs",
  "Measurement of chest and heart circumference and area for calculation of size ratios",
  "Assessment of fetal heart rate and rhythm using appropriate M-Mode/Doppler techniques",
  "Short axis view of fetal umbilical cord vasculature with Doppler evaluation of flow in the fetal umbilical vessels and ductus venosus",
  "Imaging of the pericardial and pleural spaces, abdomen and skin for fluid or edema",
  "Imaging and Doppler/color flow Doppler interrogation of the systemic veins, their course and cardiac connection",
  "Imaging and Doppler/color flow Doppler interrogation of the pulmonary veins, their course and cardiac connection",
  "Multiple imaging planes of the atria, atrial septum, foramen ovale, ductus arteriosus and ventricular septum, with appropriate Doppler assessment of flow direction and velocity",
  "Multiple imaging planes of the atrioventricular (mitral and/or tricuspid) valves, with appropriate Doppler evaluation",
  "Four-chamber or equivalent and short axis views of the heart for assessment of cardiac chamber size and function",
  "Assessment of ventricular outflow and semilunar valves including the ventriculoarterial connections with appropriate Doppler/color flow",
  "Short & long axis views of the ascending, descending and transverse aortic arch and ductus arteriosus with appropriate Doppler/color flow",
  "Short & long axis views of the main pulmonary artery and proximal portions of the right and left pulmonary arteries",
];

const DIASTOLIC_FUNCTION_OPTIONS = [
  "Not Fully Evaluated",
  "Mitral Annulus TDI Performed (BOTH Lateral & Medial)",
  "Mitral Inflow PW Performed",
  "TR RVSP/PASP",
  "Pulmonary Vein Inflow Performed",
  "LARS Performed when indicated",
  "E/SR IVRT",
  "Deceleration Time",
  "Mitral Inflow PW with Valsalva Performed (if indicated)",
  "N/A - Limited Exam",
];

const RIGHT_HEART_OPTIONS = [
  "Not Fully Evaluated",
  "Appropriate RV Focused View",
  "Tricuspid Inflow Performed",
  "Tricuspid Annulus TDI Performed",
  "TAPSE Performed",
  "RV1 and RV2 Diameter Measurements",
  "RA Volume Measurements",
  "N/A - Limited Exam",
];

const ADDITIONAL_IMAGING_OPTIONS = ["None Performed", "2D Strain", "3D Imaging", "3D EF", "Other"];

const QUALITY_SCORES = Array.from({ length: 41 }, (_, i) => String(110 - i));

// ── Exam type helpers ─────────────────────────────────────────────────────────
function isAETTE(et: ExamType) { return et === "ADULT TTE"; }
function isAETEE(et: ExamType) { return et === "ADULT TEE"; }
function isStress(et: ExamType) { return et === "ADULT STRESS"; }
function isPETTE(et: ExamType) { return et === "PEDIATRIC TTE"; }
function isPETEE(et: ExamType) { return et === "PEDIATRIC TEE"; }
function isFE(et: ExamType) { return et === "FETAL ECHO"; }
function isAETTE_PETTE(et: ExamType) { return isAETTE(et) || isPETTE(et); }
function isAETTE_PETTE_FE(et: ExamType) { return isAETTE(et) || isPETTE(et) || isFE(et); }
function isAETEE_PETEE(et: ExamType) { return isAETEE(et) || isPETEE(et); }
function isPETTE_PETEE(et: ExamType) { return isPETTE(et) || isPETEE(et); }
function isAETTE_AETEE_PETTE_PETEE(et: ExamType) { return isAETTE(et) || isAETEE(et) || isPETTE(et) || isPETEE(et); }

// ── UI helpers ────────────────────────────────────────────────────────────────
function RadioGroup({ label, name, options, value, onChange, comments, onCommentsChange }: {
  label: string; name: string; options: string[]; value: string;
  onChange: (v: string) => void; comments?: string; onCommentsChange?: (v: string) => void;
}) {
  return (
    <div className="mb-5">
      <Label className="text-sm font-semibold text-gray-700 mb-2 block">{label}</Label>
      <div className="flex flex-col gap-1.5">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="accent-[#189aa1] w-4 h-4 flex-shrink-0"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
      {onCommentsChange !== undefined && (
        <Textarea
          className="mt-2 min-h-[48px] text-sm"
          placeholder="Comments (optional)"
          value={comments ?? ""}
          onChange={e => onCommentsChange(e.target.value)}
        />
      )}
    </div>
  );
}

function CheckboxGroup({ label, options, selected, onChange, comments, onCommentsChange, showSelectAll }: {
  label: string; options: string[]; selected: string[];
  onChange: (v: string[]) => void; comments?: string; onCommentsChange?: (v: string) => void;
  showSelectAll?: boolean;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  const allSelected = options.every(o => selected.includes(o));
  const handleSelectAll = () => {
    if (allSelected) onChange([]);
    else onChange([...options]);
  };
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold text-gray-700">{label}</Label>
        {showSelectAll && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs font-semibold px-2 py-0.5 rounded-md border transition-colors"
            style={{
              color: BRAND,
              borderColor: BRAND + "40",
              background: allSelected ? BRAND + "15" : "transparent",
            }}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selected.includes(opt)}
              onCheckedChange={() => toggle(opt)}
              className="data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1]"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
      {onCommentsChange !== undefined && (
        <Textarea
          className="mt-2 min-h-[48px] text-sm"
          placeholder="Comments (optional)"
          value={comments ?? ""}
          onChange={e => onCommentsChange(e.target.value)}
        />
      )}
    </div>
  );
}

function SectionCard({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
      {title && <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">{title}</h3>}
      {children}
    </div>
  );
}

const STEP_TITLES = [
  "Header Info",
  "Protocol Sequence",
  "Image Quality",
  "Measurements",
  "Doppler Quality",
  "Review Summary",
];

const TODAY_PR = new Date().toISOString().slice(0, 10);

const EMPTY_FORM: PRForm = {
  reviewDate: TODAY_PR, examDate: TODAY_PR, examIdentifier: "",
  examType: "", examScope: "", stressStudyType: "", examIndication: "",
  sonographerEmail: "",
  protocolViewsObtained: [], protocolViewsObtainedOther: "",
  protocolDopplerViewsObtained: [],
  contrastUsed: "", contrastUsedComments: "",
  contrastSettingsAppropriate: "", contrastSettingsComments: "",
  onAxisImaging: "", onAxisImagingComments: "",
  effortSuboptimalViews: "", effortSuboptimalViewsComments: "",
  allMeasurementsObtained: "", allMeasurementsComments: "",
  ventricularFunctionAccurate: "", ventricularFunctionComments: "",
  dopplerWaveformSettings: "", dopplerWaveformComments: "",
  forwardFlowSpectrum: "", forwardFlowComments: "",
  sampleVolumePlacement: "", sampleVolumePlacementComments: "",
  colorFlowInterrogation: "", colorFlowComments: "",
  diastolicFunctionEval: [], diastolicFunctionComments: "",
  pulmonaryVeinDoppler: "", pulmonaryVeinComments: "",
  rightHeartFunctionEval: [], rightHeartFunctionComments: "",
  aorticValveEval: "", aorticValveComments: "",
  mitralValveEval: "", mitralValveComments: "",
  tricuspidValveEval: "", tricuspidValveComments: "",
  pulmonicValveEval: "", pulmonicValveComments: "",
  additionalImagingMethods: [], additionalImagingMethodsOther: "",
  strainCorrect: "", strainCorrectComments: "",
  imageOptimizationSummary: "", imageOptimizationComments: "",
  measurementAccuracySummary: "", measurementAccuracyComments: "",
  dopplerSettingsSummary: "", dopplerSettingsComments: "",
  protocolSequenceFollowed: "", protocolSequenceComments: "",
  pathologyDocumented: "", pathologyComments: "",
  clinicalQuestionAnswered: "", clinicalQuestionComments: "",
  reportConcordant: "", comparableToPreview: "",
  qualityScore: "", reviewComments: "",
  notifyAdmin: "", notifyAdminEmail: "", notifyAdminComments: "",
  notifySonographerComments: "",
};

export default function SonographerPeerReview({ embedded }: { embedded?: boolean }) {
  const [form, setForm] = useState<PRForm>(EMPTY_FORM);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);

  const et = form.examType;
  const progress = Math.round(((step - 1) / TOTAL_STEPS) * 100);

  const set = <K extends keyof PRForm>(key: K, value: PRForm[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const toggleView = (view: string) => {
    setForm(f => ({
      ...f,
      protocolViewsObtained: f.protocolViewsObtained.includes(view)
        ? f.protocolViewsObtained.filter(v => v !== view)
        : [...f.protocolViewsObtained, view],
    }));
  };

  const toggleDopplerView = (view: string) => {
    setForm(f => ({
      ...f,
      protocolDopplerViewsObtained: f.protocolDopplerViewsObtained.includes(view)
        ? f.protocolDopplerViewsObtained.filter(v => v !== view)
        : [...f.protocolDopplerViewsObtained, view],
    }));
  };

  const createReview = trpc.iqr.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      formTopRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e) => toast.error(e.message),
  });

  // ── IAC Flag Modal State ──────────────────────────────────────────────────
  const [iacModalOpen, setIacModalOpen] = useState(false);
  const [iacFlagSent, setIacFlagSent] = useState(false);
  const [iacCaseStudyId, setIacCaseStudyId] = useState("");

  const sprExamTypeMap: Record<string, string> = {
    "ADULT TTE": "AETTE",
    "ADULT TEE": "AETEE",
    "ADULT STRESS": "AE_STRESS",
    "PEDIATRIC TTE": "PETTE",
    "PEDIATRIC TEE": "PETEE",
    "FETAL ECHO": "FE",
  };

  const sprAccreditationTypeFromExam: Record<string, string> = {
    "ADULT TTE": "Adult Echo",
    "ADULT TEE": "TEE",
    "ADULT STRESS": "Stress Echo",
    "PEDIATRIC TTE": "Pediatric/Fetal Echo",
    "PEDIATRIC TEE": "Pediatric/Fetal Echo",
    "FETAL ECHO": "Pediatric/Fetal Echo",
  };

  const [iacForm, setIacFormState] = useState({
    diagnosis: "",
    sonographerName: "",
    sonographerEmail: "",
    interpretingPhysicianName: "",
    interpretingPhysicianEmail: "",
    accreditationType: "",
    submissionNotes: "",
    isTechnicalDirectorCase: false,
    isMedicalDirectorCase: false,
  });

  function setIacField<K extends keyof typeof iacForm>(key: K, val: typeof iacForm[K]) {
    setIacFormState(prev => ({ ...prev, [key]: val }));
  }

  function openIacModal() {
    setIacFormState(prev => ({
      ...prev,
      accreditationType: sprAccreditationTypeFromExam[form.examType] ?? "Adult Echo",
      submissionNotes: form.reviewComments || "",
    }));
    setIacModalOpen(true);
  }

  const flagCaseStudyMutation = trpc.caseStudies.create.useMutation({
    onSuccess: (data) => {
      setIacFlagSent(true);
      setIacCaseStudyId(data.caseStudyId);
      setIacModalOpen(false);
      toast.success(`Case flagged as IAC candidate — ID: ${data.caseStudyId}`);
    },
    onError: (e) => {
      toast.error(e.message || "Failed to flag case. Please try again.");
    },
  });

  function handleFlagForCaseStudy() {
    if (flagCaseStudyMutation.isPending) return;
    flagCaseStudyMutation.mutate({
      examType: sprExamTypeMap[form.examType] ?? form.examType,
      examDate: form.examDate || undefined,
      patientMrn: form.examIdentifier || undefined,
      diagnosis: iacForm.diagnosis || undefined,
      clinicalNotes: iacForm.submissionNotes || form.reviewComments || undefined,
      sonographerName: iacForm.sonographerName || undefined,
      sonographerEmail: iacForm.sonographerEmail || undefined,
      interpretingPhysicianName: iacForm.interpretingPhysicianName || undefined,
      interpretingPhysicianEmail: iacForm.interpretingPhysicianEmail || undefined,
      accreditationType: iacForm.accreditationType || "Adult Echo",
      submissionStatus: "identified",
      submissionNotes: iacForm.submissionNotes || undefined,
      isTechnicalDirectorCase: iacForm.isTechnicalDirectorCase,
      isMedicalDirectorCase: iacForm.isMedicalDirectorCase,
    });
  }

  function goToStep(n: number) {
    if (n < 1 || n > TOTAL_STEPS) return;
    setStep(n);
    formTopRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // ── Quality Score Auto-Calculation (same logic as Quality Review, minus IAC field) ──
  const qualityScoreCalc = useMemo(() => {
    function scoreField(val: string): { scored: boolean; points: number; maxPoints: number } {
      if (!val) return { scored: false, points: 0, maxPoints: 1 };
      const v = val.toLowerCase();
      if (
        v.startsWith("yes") || v.startsWith("adequate") || v.startsWith("excellent") ||
        v.startsWith("complete") || v.startsWith("n/a") || v.startsWith("comparable") ||
        v.startsWith("sufficient") || v === "apex not visualized" || v.startsWith("concordant")
      ) return { scored: true, points: 1, maxPoints: 1 };
      if (
        v.startsWith("no") || v.includes("deficien") || v.includes("incomplete") ||
        v.includes("inadequate") || v.includes("not fully") || v.includes("some deficien")
      ) return { scored: true, points: 0, maxPoints: 1 };
      return { scored: false, points: 0, maxPoints: 1 };
    }

    const fields: Array<{ scored: boolean; points: number; maxPoints: number }> = [];

    // Step 3 — Overall Image Quality
    fields.push(scoreField(form.onAxisImaging));
    fields.push(scoreField(form.effortSuboptimalViews));
    if (isAETTE_PETTE_FE(et)) fields.push(scoreField(form.contrastUsed));
    if (isAETTE_PETTE_FE(et)) fields.push(scoreField(form.contrastSettingsAppropriate));

    // Step 4 — Measurements
    fields.push(scoreField(form.allMeasurementsObtained));
    fields.push(scoreField(form.ventricularFunctionAccurate));

    // Step 5 — Doppler Quality
    fields.push(scoreField(form.dopplerWaveformSettings));
    fields.push(scoreField(form.forwardFlowSpectrum));
    fields.push(scoreField(form.sampleVolumePlacement));
    if (isAETTE_PETTE_FE(et)) fields.push(scoreField(form.colorFlowInterrogation));
    if (isAETTE_PETTE_FE(et)) fields.push(scoreField(form.pulmonaryVeinDoppler));

    // Step 6 — Cardiac Evaluation
    fields.push(scoreField(form.aorticValveEval));
    fields.push(scoreField(form.mitralValveEval));
    fields.push(scoreField(form.tricuspidValveEval));
    fields.push(scoreField(form.pulmonicValveEval));
    if (isAETTE(et)) fields.push(scoreField(form.strainCorrect));

    // Step 6 — Overall Findings
    fields.push(scoreField(form.imageOptimizationSummary));
    fields.push(scoreField(form.measurementAccuracySummary));
    fields.push(scoreField(form.dopplerSettingsSummary));
    fields.push(scoreField(form.protocolSequenceFollowed));
    fields.push(scoreField(form.pathologyDocumented));
    fields.push(scoreField(form.clinicalQuestionAnswered));
    fields.push(scoreField(form.reportConcordant));
    fields.push(scoreField(form.comparableToPreview));

    const allScored = fields.every(f => f.scored);
    if (!allScored) return null;

    const totalPoints = fields.reduce((sum, f) => sum + f.points, 0);
    const maxPoints = fields.reduce((sum, f) => sum + f.maxPoints, 0);
    const pct = Math.round((totalPoints / maxPoints) * 100);

    let tier: string;
    let color: string;
    if (pct >= 90) { tier = "Excellent"; color = "#16a34a"; }
    else if (pct >= 75) { tier = "Good"; color = "#189aa1"; }
    else if (pct >= 60) { tier = "Adequate"; color = "#d97706"; }
    else { tier = "Needs Improvement"; color = "#dc2626"; }

    return { pct, tier, color, totalPoints, maxPoints };
  }, [form, et]);

  function handleSubmit() {
    if (!form.sonographerEmail) {
      toast.error("Sonographer email is required.");
      return;
    }
    const payload = {
      reviewType: "PEER REVIEW" as const,
      dateReviewCompleted: form.reviewDate || undefined,
      examDos: form.examDate || undefined,
      examIdentifier: form.examIdentifier || undefined,
      examType: form.examType || undefined,
      examScope: form.examScope || undefined,
      stressType: form.stressStudyType || undefined,
      examIndication: form.examIndication || undefined,
      protocolViews: form.protocolViewsObtained.length > 0 ? JSON.stringify(form.protocolViewsObtained) : undefined,
      protocolViewsOther: form.protocolViewsObtainedOther || undefined,
      // Step 3 — Overall Image Quality
      contrastUtilized: form.contrastUsed || undefined,
      contrastUtilizedOther: form.contrastUsedComments || undefined,
      // Step 4 — Measurements
      allMeasurementsObtained: form.allMeasurementsObtained || undefined,
      allMeasurementsExplain: form.allMeasurementsComments || undefined,
      ventricularFunction: form.ventricularFunctionAccurate || undefined,
      // Step 5 — Doppler
      dopplerWaveformSettings: form.dopplerWaveformSettings || undefined,
      forwardFlowSpectrum: form.forwardFlowSpectrum || undefined,
      dopplerSampleVolumes: form.sampleVolumePlacement || undefined,
      colorFlowInterrogation: form.colorFlowInterrogation || undefined,
      diastolicFunctionEval: form.diastolicFunctionEval.length > 0 ? JSON.stringify(form.diastolicFunctionEval) : undefined,
      diastolicFunctionEvalOther: form.diastolicFunctionComments || undefined,
      pulmonaryVeinDoppler: form.pulmonaryVeinDoppler || undefined,
      rightHeartFunctionEval: form.rightHeartFunctionEval.length > 0 ? JSON.stringify(form.rightHeartFunctionEval) : undefined,
      rightHeartFunctionEvalOther: form.rightHeartFunctionComments || undefined,
      // Step 6 — Cardiac Evaluation
      aorticValvePeer: form.aorticValveEval || undefined,
      mitralValvePeer: form.mitralValveEval || undefined,
      tricuspidValvePeer: form.tricuspidValveEval || undefined,
      pulmonicValvePeer: form.pulmonicValveEval || undefined,
      additionalImagingMethods: form.additionalImagingMethods.length > 0 ? JSON.stringify(form.additionalImagingMethods) : undefined,
      additionalImagingMethodsOther: form.additionalImagingMethodsOther || undefined,
      strainCorrect: form.strainCorrect || undefined,
      strainCorrectOther: form.strainCorrectComments || undefined,
      imageOptimizationSummary: form.imageOptimizationSummary || undefined,
      measurementAccuracySummary: form.measurementAccuracySummary || undefined,
      dopplerSettingsSummary: form.dopplerSettingsSummary || undefined,
      protocolSequenceFollowed: form.protocolSequenceFollowed || undefined,
      pathologyDocumented: form.pathologyDocumented || undefined,
      clinicalQuestionAnswered: form.clinicalQuestionAnswered || undefined,
      reportConcordant: form.reportConcordant || undefined,
      comparableToPrevious: form.comparableToPreview || undefined,
      qualityScore: qualityScoreCalc ? qualityScoreCalc.pct : (form.qualityScore ? parseInt(form.qualityScore) : undefined),
      reviewComments: form.reviewComments || undefined,
      notifyAdmin: form.notifyAdmin || undefined,
      notifyAdminEmail: form.notifyAdminEmail || undefined,
      notifyAdminComments: form.notifyAdminComments || undefined,
      notifySonographerEmail: form.sonographerEmail || undefined,
      notifySonographerComments: form.notifySonographerComments || undefined,
    };
    createReview.mutate(payload);
  }

  // ── Step renderers ────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <SectionCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Date Review Completed</Label>
            <Input type="date" value={form.reviewDate} onChange={e => set("reviewDate", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Exam DOS</Label>
            <Input type="date" value={form.examDate} onChange={e => set("examDate", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Exam Identifier (LAS, FIR)</Label>
            <Input value={form.examIdentifier} onChange={e => set("examIdentifier", e.target.value)} placeholder="e.g. LAS001 or FIR-2026" />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Sonographer Email *</Label>
            <Input
              type="email"
              value={form.sonographerEmail}
              onChange={e => set("sonographerEmail", e.target.value)}
              placeholder="sonographer@lab.com"
              required
            />
          </div>
        </div>
        <div className="mb-4">
          <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Exam Type</Label>
          <Select value={form.examType} onValueChange={v => set("examType", v as ExamType)}>
            <SelectTrigger><SelectValue placeholder="Select exam type..." /></SelectTrigger>
            <SelectContent>
              {["ADULT TTE", "ADULT TEE", "ADULT STRESS", "PEDIATRIC TTE", "PEDIATRIC TEE", "FETAL ECHO"].map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mb-4">
          <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Limited/Complete Exam</Label>
          <Select value={form.examScope} onValueChange={v => set("examScope", v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Complete Exam">Complete Exam</SelectItem>
              <SelectItem value="Limited/Follow Up Exam">Limited/Follow Up Exam</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isStress(et) && (
          <div className="mb-4">
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">What type of stress study was performed?</Label>
            <Input value={form.stressStudyType} onChange={e => set("stressStudyType", e.target.value)} placeholder="e.g. Exercise, DSE, Pharmacologic" />
          </div>
        )}
        <div className="mb-4">
          <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Exam Indication</Label>
          <Textarea value={form.examIndication} onChange={e => set("examIndication", e.target.value)} className="min-h-[60px]" />
        </div>
      </SectionCard>
    );
  }

  function renderStep2() {
    if (!et) {
      return (
        <SectionCard>
          <p className="text-sm text-gray-500 italic">Please select an exam type on Step 1 to see the protocol sequence checklist.</p>
        </SectionCard>
      );
    }

    let viewsList: string[] = [];
    let sectionTitle = "All required views obtained or attempted";
    let hasDopplerSection = false;

    if (isAETTE(et)) {
      viewsList = TTE_VIEWS;
      sectionTitle = "ADULT TTE — All of the following required views were obtained or attempted";
    } else if (isAETEE(et)) {
      viewsList = TEE_VIEWS;
      sectionTitle = "ADULT TEE — All of the following required views were obtained or attempted";
    } else if (isStress(et)) {
      viewsList = STRESS_VIEWS;
      sectionTitle = "ADULT STRESS — All of the following required views were obtained or attempted";
    } else if (isPETTE(et)) {
      viewsList = PETTE_VIEWS;
      sectionTitle = "PEDIATRIC TTE — All of the following required views/images were obtained or attempted";
      hasDopplerSection = true;
    } else if (isPETEE(et)) {
      viewsList = PETEE_VIEWS;
      sectionTitle = "PEDIATRIC TEE — All of the following required views were obtained or attempted";
      hasDopplerSection = true;
    } else if (isFE(et)) {
      viewsList = FETAL_VIEWS;
      sectionTitle = "FETAL ECHO — All of the following required images/views were obtained";
    }

    const hasOther = viewsList.includes("Other");
    const mainViews = hasOther ? viewsList.filter(v => v !== "Other") : viewsList;

    const allMainSelected = mainViews.every(v => form.protocolViewsObtained.includes(v));
    const handleSelectAllViews = () => {
      if (allMainSelected) set("protocolViewsObtained", []);
      else set("protocolViewsObtained", [...mainViews, ...(hasOther && form.protocolViewsObtained.includes("Other") ? ["Other"] : [])]);
    };
    const allDopplerSelected = hasDopplerSection && PETTE_PETEE_DOPPLER_VIEWS.every(v => form.protocolDopplerViewsObtained.includes(v));
    const handleSelectAllDoppler = () => {
      if (allDopplerSelected) set("protocolDopplerViewsObtained", []);
      else set("protocolDopplerViewsObtained", [...PETTE_PETEE_DOPPLER_VIEWS]);
    };

    // Protocol progress indicator
    const totalViews = mainViews.length;
    const checkedViews = form.protocolViewsObtained.filter(v => mainViews.includes(v)).length;
    const totalDoppler = hasDopplerSection ? PETTE_PETEE_DOPPLER_VIEWS.length : 0;
    const checkedDoppler = hasDopplerSection ? form.protocolDopplerViewsObtained.filter(v => PETTE_PETEE_DOPPLER_VIEWS.includes(v)).length : 0;
    const totalAll = totalViews + totalDoppler;
    const checkedAll = checkedViews + checkedDoppler;
    const progressPct = totalAll > 0 ? Math.round((checkedAll / totalAll) * 100) : 0;
    const progressColor = progressPct === 100 ? "#16a34a" : progressPct >= 50 ? "#d97706" : "#189aa1";

    return (
      <>
        {/* Progress indicator */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: progressColor }}
            />
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: progressColor + "18", color: progressColor }}
          >
            {checkedAll} / {totalAll} views
          </span>
        </div>
        <SectionCard title={sectionTitle}>
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={handleSelectAllViews}
              className="text-xs font-semibold px-2 py-0.5 rounded-md border transition-colors"
              style={{ color: BRAND, borderColor: BRAND + "40", background: allMainSelected ? BRAND + "15" : "transparent" }}
            >
              {allMainSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="space-y-2 mb-4">
            {mainViews.map(view => (
              <label key={view} className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={form.protocolViewsObtained.includes(view)}
                  onCheckedChange={() => toggleView(view)}
                  className="mt-0.5 data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1]"
                />
                <span className="text-sm text-gray-700 leading-snug">{view}</span>
              </label>
            ))}
          </div>
          {hasOther && (
            <div className="mb-4">
              <label className="flex items-start gap-2 cursor-pointer mb-2">
                <Checkbox
                  checked={form.protocolViewsObtained.includes("Other")}
                  onCheckedChange={() => toggleView("Other")}
                  className="mt-0.5 data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1]"
                />
                <span className="text-sm text-gray-700">Other</span>
              </label>
              {form.protocolViewsObtained.includes("Other") && (
                <Input
                  className="text-sm"
                  placeholder="Specify other views..."
                  value={form.protocolViewsObtainedOther}
                  onChange={e => set("protocolViewsObtainedOther", e.target.value)}
                />
              )}
            </div>
          )}
          {hasDopplerSection && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">Doppler/color flow interrogation</h4>
                <button
                  type="button"
                  onClick={handleSelectAllDoppler}
                  className="text-xs font-semibold px-2 py-0.5 rounded-md border transition-colors"
                  style={{ color: BRAND, borderColor: BRAND + "40", background: allDopplerSelected ? BRAND + "15" : "transparent" }}
                >
                  {allDopplerSelected ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="space-y-2">
                {PETTE_PETEE_DOPPLER_VIEWS.map(view => (
                  <label key={view} className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.protocolDopplerViewsObtained.includes(view)}
                      onCheckedChange={() => toggleDopplerView(view)}
                      className="mt-0.5 data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1]"
                    />
                    <span className="text-sm text-gray-700 leading-snug">{view}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </>
    );
  }

  function renderStep3() {
    return (
      <>
        <SectionCard title="Overall Image Quality">
          {isAETTE_AETEE_PETTE_PETEE(et) && (
            <>
              <RadioGroup
                label="Was contrast/UAE used if it was appropriate to do so?"
                name="contrastUsed"
                options={[
                  "Yes (with appropriate use criteria and good image optimization/contrast UEA settings)",
                  "Yes (with appropriate use criteria but deficient contrast settings/imaging)",
                  "Contrast/UEA Not Available",
                  "Patient Refused Contrast/UEA",
                  "N/A - Limited Exam/Contrast UEA Not Needed",
                  "No - Contrast/UEA not used when needed.",
                  "Contrast/UEA used in TDS. However, image optimization not performed - may have eliminated need for contrast use.",
                  "Contrast/UEA not used in TDS. Image optimization not performed - may have eliminated the need for contrast use.",
                ]}
                value={form.contrastUsed}
                onChange={v => set("contrastUsed", v)}
                comments={form.contrastUsedComments}
                onCommentsChange={v => set("contrastUsedComments", v)}
              />
              <RadioGroup
                label="If contrast was used, were the settings appropriate?"
                name="contrastSettingsAppropriate"
                options={["Yes", "N/A", "No"]}
                value={form.contrastSettingsAppropriate}
                onChange={v => set("contrastSettingsAppropriate", v)}
                comments={form.contrastSettingsComments}
                onCommentsChange={v => set("contrastSettingsComments", v)}
              />
            </>
          )}
          {isAETTE_PETTE(et) && (
            <RadioGroup
              label="Does the study demonstrate standard on axis imaging planes?"
              name="onAxisImaging"
              options={[
                "Yes - On axis imaging with no foreshortening",
                "Some Deficiencies - No documentation of patient position/attempts to correct",
                "Some Deficiencies - Annotations noted with patient position/attempts to correct",
                "No - Off axis imaging with significant foreshortening",
              ]}
              value={form.onAxisImaging}
              onChange={v => set("onAxisImaging", v)}
              comments={form.onAxisImagingComments}
              onCommentsChange={v => set("onAxisImagingComments", v)}
            />
          )}
          <RadioGroup
            label="Was an effort made to better define any suboptimal views?"
            name="effortSuboptimalViews"
            options={["Yes - Image optimization attempted", "N/A", "No"]}
            value={form.effortSuboptimalViews}
            onChange={v => set("effortSuboptimalViews", v)}
            comments={form.effortSuboptimalViewsComments}
            onCommentsChange={v => set("effortSuboptimalViewsComments", v)}
          />
        </SectionCard>
      </>
    );
  }

  function renderStep4() {
    return (
      <SectionCard title="Measurements/Accuracy">
        <RadioGroup
          label="Were all protocol measurements obtained?"
          name="allMeasurementsObtained"
          options={[
            "Complete",
            "Sufficient attempts made in a TDS",
            "Limited exam: all appropriate measurements performed.",
            "Deficiencies Noted",
          ]}
          value={form.allMeasurementsObtained}
          onChange={v => set("allMeasurementsObtained", v)}
          comments={form.allMeasurementsComments}
          onCommentsChange={v => set("allMeasurementsComments", v)}
        />
        <RadioGroup
          label="Does the study accurately measure ventricular function?"
          name="ventricularFunctionAccurate"
          options={["Excellent", "Adequate", "Some Deficiencies", "N/A - Limited Exam", "No"]}
          value={form.ventricularFunctionAccurate}
          onChange={v => set("ventricularFunctionAccurate", v)}
          comments={form.ventricularFunctionComments}
          onCommentsChange={v => set("ventricularFunctionComments", v)}
        />
      </SectionCard>
    );
  }

  function renderStep5() {
    return (
      <>
        <SectionCard title="Doppler Quality">
          <RadioGroup
            label="Are Doppler waveform settings correct (Baseline/PRF-Scale)?"
            name="dopplerWaveformSettings"
            options={["Excellent", "Adequate", "N/A - Limited Exam", "Deficiencies Noted"]}
            value={form.dopplerWaveformSettings}
            onChange={v => set("dopplerWaveformSettings", v)}
            comments={form.dopplerWaveformComments}
            onCommentsChange={v => set("dopplerWaveformComments", v)}
          />
          <RadioGroup
            label="Does the study demonstrate a forward flow spectrum for each of the valves?"
            name="forwardFlowSpectrum"
            options={["Yes", "N/A - Limited Exam", "No"]}
            value={form.forwardFlowSpectrum}
            onChange={v => set("forwardFlowSpectrum", v)}
            comments={form.forwardFlowComments}
            onCommentsChange={v => set("forwardFlowComments", v)}
          />
          <RadioGroup
            label="Are Doppler sample volumes and measurement calipers placed in the correct location/angle consistently?"
            name="sampleVolumePlacement"
            options={["Yes", "Some Deficiencies", "N/A - Limited Exam", "No"]}
            value={form.sampleVolumePlacement}
            onChange={v => set("sampleVolumePlacement", v)}
            comments={form.sampleVolumePlacementComments}
            onCommentsChange={v => set("sampleVolumePlacementComments", v)}
          />
          {isAETTE_PETTE_FE(et) && (
            <RadioGroup
              label="Does the study demonstrate color flow interrogation of all normal and abnormal flows within the heart?"
              name="colorFlowInterrogation"
              options={["Yes", "N/A - Limited Exam", "No"]}
              value={form.colorFlowInterrogation}
              onChange={v => set("colorFlowInterrogation", v)}
              comments={form.colorFlowComments}
              onCommentsChange={v => set("colorFlowComments", v)}
            />
          )}
          {isAETTE(et) && (
            <CheckboxGroup
              label="Was Diastolic Function/LAP evaluated appropriately?"
              options={DIASTOLIC_FUNCTION_OPTIONS}
              selected={form.diastolicFunctionEval}
              onChange={v => set("diastolicFunctionEval", v)}
              comments={form.diastolicFunctionComments}
              onCommentsChange={v => set("diastolicFunctionComments", v)}
            />
          )}
          {isAETTE_PETTE_FE(et) && (
            <RadioGroup
              label="Was Pulmonary Vein Inflow Doppler measured/assessed properly (if applicable)?"
              name="pulmonaryVeinDoppler"
              options={["Yes", "N/A", "No"]}
              value={form.pulmonaryVeinDoppler}
              onChange={v => set("pulmonaryVeinDoppler", v)}
              comments={form.pulmonaryVeinComments}
              onCommentsChange={v => set("pulmonaryVeinComments", v)}
            />
          )}
          {isAETTE_PETTE(et) && (
            <CheckboxGroup
              label="Was Right Heart Function evaluated appropriately?"
              options={RIGHT_HEART_OPTIONS}
              selected={form.rightHeartFunctionEval}
              onChange={v => set("rightHeartFunctionEval", v)}
              comments={form.rightHeartFunctionComments}
              onCommentsChange={v => set("rightHeartFunctionComments", v)}
            />
          )}
        </SectionCard>
      </>
    );
  }

  function renderStep6() {
    return (
      <>
        <SectionCard title="Cardiac Evaluation">
          <RadioGroup
            label="Is the Aortic Valve evaluated with 2D/Color/CW Doppler appropriately?"
            name="aorticValveEval"
            options={["Yes", "N/A", "No"]}
            value={form.aorticValveEval}
            onChange={v => set("aorticValveEval", v)}
            comments={form.aorticValveComments}
            onCommentsChange={v => set("aorticValveComments", v)}
          />
          <RadioGroup
            label="Is the Mitral Valve evaluated with 2D/Color/CW/PW Doppler appropriately?"
            name="mitralValveEval"
            options={["Yes", "N/A", "Deficiencies Noted"]}
            value={form.mitralValveEval}
            onChange={v => set("mitralValveEval", v)}
            comments={form.mitralValveComments}
            onCommentsChange={v => set("mitralValveComments", v)}
          />
          <RadioGroup
            label="Is the Tricuspid Valve evaluated with 2D/Color/CW Doppler appropriately?"
            name="tricuspidValveEval"
            options={["Yes", "N/A", "No"]}
            value={form.tricuspidValveEval}
            onChange={v => set("tricuspidValveEval", v)}
            comments={form.tricuspidValveComments}
            onCommentsChange={v => set("tricuspidValveComments", v)}
          />
          <RadioGroup
            label="Is the Pulmonic Valve evaluated with 2D/Color/CW/PW Doppler appropriately?"
            name="pulmonicValveEval"
            options={["Yes", "N/A", "No"]}
            value={form.pulmonicValveEval}
            onChange={v => set("pulmonicValveEval", v)}
            comments={form.pulmonicValveComments}
            onCommentsChange={v => set("pulmonicValveComments", v)}
          />
        </SectionCard>

        <SectionCard title="Overall Findings">
          <CheckboxGroup
            label="Additional Imaging Methods"
            options={ADDITIONAL_IMAGING_OPTIONS}
            selected={form.additionalImagingMethods}
            onChange={v => set("additionalImagingMethods", v)}
            comments={form.additionalImagingMethodsOther}
            onCommentsChange={v => set("additionalImagingMethodsOther", v)}
          />
          {isAETTE(et) && (
            <RadioGroup
              label="If strain imaging/speckle tracking was performed, was it performed correctly?"
              name="strainCorrect"
              options={["Yes", "N/A - Strain Not Performed", "No"]}
              value={form.strainCorrect}
              onChange={v => set("strainCorrect", v)}
              comments={form.strainCorrectComments}
              onCommentsChange={v => set("strainCorrectComments", v)}
            />
          )}
          <RadioGroup
            label="Are 2D images optimized appropriately (Gain/Depth/Focus/Sector)?"
            name="imageOptimizationSummary"
            options={["Excellent", "Adequate", "N/A - Limited Exam", "Deficiencies Noted"]}
            value={form.imageOptimizationSummary}
            onChange={v => set("imageOptimizationSummary", v)}
            comments={form.imageOptimizationComments}
            onCommentsChange={v => set("imageOptimizationComments", v)}
          />
          <RadioGroup
            label="Are measurements placed accurately?"
            name="measurementAccuracySummary"
            options={["Excellent", "Adequate", "N/A", "Deficiencies Noted"]}
            value={form.measurementAccuracySummary}
            onChange={v => set("measurementAccuracySummary", v)}
            comments={form.measurementAccuracyComments}
            onCommentsChange={v => set("measurementAccuracyComments", v)}
          />
          <RadioGroup
            label="Are Color/Doppler settings optimized appropriately (Gain/Sector/Angle/Baseline/PRF-Scale)?"
            name="dopplerSettingsSummary"
            options={["Excellent", "Adequate", "N/A - Limited Exam", "Deficiencies Noted"]}
            value={form.dopplerSettingsSummary}
            onChange={v => set("dopplerSettingsSummary", v)}
            comments={form.dopplerSettingsComments}
            onCommentsChange={v => set("dopplerSettingsComments", v)}
          />
          <RadioGroup
            label="Was the department protocol image sequence followed?"
            name="protocolSequenceFollowed"
            options={[
              "Complete (to BEST ability - if TDS study documents attempts at all views)",
              "Minor Deficiencies Noted (all required images are present and in order, but missing measurements)",
              "Minor Deficiencies Noted (images/measurements are documented but taken out of protocol sequence)",
              "Minor Deficiencies Noted (see review comments)",
              "Moderate Deficiencies Noted (missing images, measurements and/or documentation)",
              "Major Deficiencies Noted (missing views, images and or measurements)",
            ]}
            value={form.protocolSequenceFollowed}
            onChange={v => set("protocolSequenceFollowed", v)}
            comments={form.protocolSequenceComments}
            onCommentsChange={v => set("protocolSequenceComments", v)}
          />
          <RadioGroup
            label="Was all pathology documented/measured/evaluated appropriately?"
            name="pathologyDocumented"
            options={["Yes", "N/A", "No"]}
            value={form.pathologyDocumented}
            onChange={v => set("pathologyDocumented", v)}
            comments={form.pathologyComments}
            onCommentsChange={v => set("pathologyComments", v)}
          />
          <RadioGroup
            label="Was all pathology documented/measured/evaluated appropriately and the overall clinical concern/question answered?"
            name="clinicalQuestionAnswered"
            options={["Yes", "No"]}
            value={form.clinicalQuestionAnswered}
            onChange={v => set("clinicalQuestionAnswered", v)}
            comments={form.clinicalQuestionComments}
            onCommentsChange={v => set("clinicalQuestionComments", v)}
          />
          <RadioGroup
            label="Is the sonographer preliminary report concordant with final physician report?"
            name="reportConcordant"
            options={["Yes", "N/A - NOT COMPLETED", "N/A - UNABLE TO CONFIRM", "No"]}
            value={form.reportConcordant}
            onChange={v => set("reportConcordant", v)}
          />
          <div className="mb-5">
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Is the exam comparable to the previous study, if applicable?</Label>
            <Select value={form.comparableToPreview} onValueChange={v => set("comparableToPreview", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="N/A">N/A</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SectionCard>

        <SectionCard title="Review Summary">
          {/* IAC Case Study Flag */}
          <div className="mb-6 rounded-xl border-2 p-4" style={{ borderColor: iacFlagSent ? "#16a34a40" : "#189aa140", background: iacFlagSent ? "#f0fdf4" : "#f0fbfc" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iacFlagSent ? "#16a34a18" : "#189aa118" }}>
                <Flag className="w-4 h-4" style={{ color: iacFlagSent ? "#16a34a" : "#189aa1" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800 mb-0.5">Flag as IAC Case Study Candidate</p>
                <p className="text-xs text-gray-500 mb-3">Add this case to the Possible Case Studies tracker for IAC accreditation submission consideration.</p>
                {iacFlagSent ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Case flagged and added to Case Studies tracker
                    </div>
                    {iacCaseStudyId && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-200">
                          {iacCaseStudyId}
                        </span>
                        <Link href="/accreditation?tab=case-mix">
                          <span className="text-xs text-[#189aa1] underline flex items-center gap-1 cursor-pointer">
                            View in Case Studies <ExternalLink className="w-3 h-3" />
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openIacModal}
                    className="text-white border-0"
                    style={{ background: "#189aa1" }}
                  >
                    <span className="flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" />Flag for IAC Case Studies</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* IAC Flag Modal */}
          <Dialog open={iacModalOpen} onOpenChange={setIacModalOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Flag className="w-4 h-4" style={{ color: BRAND }} />
                  Flag as IAC Case Study Candidate
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Pre-filled read-only summary */}
                <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: BRAND + "08", border: `1px solid ${BRAND}20` }}>
                  <div className="flex gap-4 flex-wrap">
                    {form.examType && <span><span className="font-semibold text-gray-600">Exam Type:</span> <span className="text-gray-800">{form.examType}</span></span>}
                    {form.examDate && <span><span className="font-semibold text-gray-600">Date:</span> <span className="text-gray-800">{form.examDate}</span></span>}
                    {form.examIdentifier && <span><span className="font-semibold text-gray-600">ID:</span> <span className="text-gray-800">{form.examIdentifier}</span></span>}
                  </div>
                </div>

                {/* Diagnosis */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700 mb-1 block">Diagnosis / Primary Finding</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="e.g. Severe AS, Dilated CMP, Normal study"
                    value={iacForm.diagnosis}
                    onChange={e => setIacField("diagnosis", e.target.value)}
                  />
                </div>

                {/* Accreditation Type */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700 mb-1 block">Accreditation Category *</Label>
                  <Select value={iacForm.accreditationType} onValueChange={v => setIacField("accreditationType", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {["Adult Echo", "Pediatric/Fetal Echo", "Stress Echo", "TEE"].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sonographer */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Sonographer Name</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="e.g. Jane Smith"
                      value={iacForm.sonographerName}
                      onChange={e => setIacField("sonographerName", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Sonographer Email</Label>
                    <Input
                      className="h-8 text-sm"
                      type="email"
                      placeholder="email@lab.com"
                      value={iacForm.sonographerEmail}
                      onChange={e => setIacField("sonographerEmail", e.target.value)}
                    />
                  </div>
                </div>

                {/* Interpreting Physician */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Interpreting Physician</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="e.g. Dr. Johnson"
                      value={iacForm.interpretingPhysicianName}
                      onChange={e => setIacField("interpretingPhysicianName", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Physician Email</Label>
                    <Input
                      className="h-8 text-sm"
                      type="email"
                      placeholder="email@lab.com"
                      value={iacForm.interpretingPhysicianEmail}
                      onChange={e => setIacField("interpretingPhysicianEmail", e.target.value)}
                    />
                  </div>
                </div>

                {/* Submission Notes */}
                <div>
                  <Label className="text-xs font-semibold text-gray-700 mb-1 block">Submission Notes</Label>
                  <Textarea
                    className="text-sm min-h-[70px]"
                    placeholder="Why this case is a good IAC submission candidate..."
                    value={iacForm.submissionNotes}
                    onChange={e => setIacField("submissionNotes", e.target.value)}
                  />
                </div>

                {/* IAC Role Flags */}
                <div className="rounded-lg p-3 space-y-2" style={{ background: "#f8f9fa", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs font-semibold text-gray-600 mb-2">IAC Case Mix Requirements</p>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <Checkbox
                      checked={iacForm.isTechnicalDirectorCase}
                      onCheckedChange={v => setIacFormState(prev => ({ ...prev, isTechnicalDirectorCase: !!v }))}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">Technical Director Case</span>
                      <p className="text-xs text-gray-500">This exam was performed by the lab's Technical Director (required for IAC case mix)</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <Checkbox
                      checked={iacForm.isMedicalDirectorCase}
                      onCheckedChange={v => setIacFormState(prev => ({ ...prev, isMedicalDirectorCase: !!v }))}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">Medical Director Case</span>
                      <p className="text-xs text-gray-500">This exam was interpreted by the lab's Medical Director (required for IAC case mix)</p>
                    </div>
                  </label>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIacModalOpen(false)} size="sm">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleFlagForCaseStudy}
                  disabled={flagCaseStudyMutation.isPending || !iacForm.accreditationType}
                  className="text-white"
                  style={{ background: BRAND }}
                >
                  {flagCaseStudyMutation.isPending ? (
                    <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Flagging...</span>
                  ) : (
                    <span className="flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" />Flag Case</span>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Auto-calculated Quality Score */}
          <div className="mb-6 rounded-xl border-2 p-5" style={{ borderColor: qualityScoreCalc ? qualityScoreCalc.color + "40" : "#e5e7eb", background: qualityScoreCalc ? qualityScoreCalc.color + "08" : "#f9fafb" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700">Auto-Calculated Quality Score</span>
              {qualityScoreCalc ? (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: qualityScoreCalc.color }}>
                  {qualityScoreCalc.tier}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">Complete all scored fields to calculate</span>
              )}
            </div>
            {qualityScoreCalc ? (
              <>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-black" style={{ color: qualityScoreCalc.color }}>{qualityScoreCalc.pct}%</span>
                  <span className="text-sm text-gray-500 mb-1">{qualityScoreCalc.totalPoints} / {qualityScoreCalc.maxPoints} pts</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${qualityScoreCalc.pct}%`, background: qualityScoreCalc.color }} />
                </div>
              </>
            ) : (
              <div className="h-2.5 rounded-full bg-gray-100" />
            )}
          </div>
          <div className="mb-4">
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Review Comments *</Label>
            <Textarea
              value={form.reviewComments}
              onChange={e => set("reviewComments", e.target.value)}
              className="min-h-[100px]"
              placeholder="Enter review comments..."
            />
          </div>
          <div className="mb-4">
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Would you like to send this review result directly to an administrator/manager?</Label>
            <Select value={form.notifyAdmin} onValueChange={v => set("notifyAdmin", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="YES">YES</SelectItem>
                <SelectItem value="NO">NO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.notifyAdmin === "YES" && (
            <>
              <div className="mb-4">
                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Administrator/Manager Email</Label>
                <Input
                  type="email"
                  value={form.notifyAdminEmail}
                  onChange={e => set("notifyAdminEmail", e.target.value)}
                  placeholder="admin@lab.com"
                />
              </div>
              <div className="mb-4">
                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Comments for Administrator</Label>
                <Textarea
                  value={form.notifyAdminComments}
                  onChange={e => set("notifyAdminComments", e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </>
          )}
          <div className="mb-4">
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Comments for Sonographer</Label>
            <Textarea
              value={form.notifySonographerComments}
              onChange={e => set("notifySonographerComments", e.target.value)}
              className="min-h-[60px]"
              placeholder="Feedback to send to the sonographer..."
            />
          </div>
        </SectionCard>
      </>
    );
  }

  if (submitted) {
    return (
      <div ref={formTopRef} className={embedded ? "" : ""}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="w-16 h-16 mb-4" style={{ color: BRAND }} />
          <h2 className="text-2xl font-black text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>
            Peer Review Submitted
          </h2>
          <p className="text-gray-500 mb-6 max-w-sm">
            Your peer review has been saved successfully.
          </p>
          <Button
            onClick={() => { setForm(EMPTY_FORM); setStep(1); setSubmitted(false); }}
            style={{ background: BRAND }}
            className="text-white"
          >
            Submit Another Review
          </Button>
        </div>
      </div>
    );
  }

  const content = (
    <div ref={formTopRef}>
      {!embedded && (
        <>
          {/* Hero Banner */}
          <div
            className="relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
          >
            <div className="container py-8 md:py-10">
              <div className="flex items-center gap-2 mb-2">
                <Link href="/diy-accreditation-plans">
                  <button className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> DIY Accreditation
                  </button>
                </Link>
                <ChevronRight className="w-3 h-3 text-white/30" />
                <span className="text-white/60 text-xs">Sonographer Peer Review</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                    Sonographer Peer Review
                  </h1>
                  <p className="text-[#4ad9e0] text-sm font-medium">Peer Review — Step {step} of {TOTAL_STEPS}</p>
                </div>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100">
            <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: BRAND }} />
          </div>
        </>
      )}
      {/* Step tabs */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto">
        <div className="container flex gap-0">
          {STEP_TITLES.map((title, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <button
                key={n}
                onClick={() => goToStep(n)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                  active ? "border-[#189aa1] text-[#189aa1]" : done ? "border-transparent text-gray-400 hover:text-gray-600" : "border-transparent text-gray-300"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  active ? "bg-[#189aa1] text-white" : done ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-400"
                }`}>{n}</span>
                {title}
              </button>
            );
          })}
        </div>
      </div>
      {/* Form content */}
      <div className="container py-6 max-w-3xl">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}
        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={() => goToStep(step - 1)}
            disabled={step === 1}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          {step < TOTAL_STEPS ? (
            <Button
              onClick={() => goToStep(step + 1)}
              className="flex items-center gap-2 text-white"
              style={{ background: BRAND }}
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              {/* Send Feedback — sends comments to the sonographer email without full submission */}
              {form.sonographerEmail && form.notifySonographerComments && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!form.sonographerEmail) { toast.error("Sonographer email is required to send feedback."); return; }
                    if (!form.notifySonographerComments) { toast.error("Please enter feedback comments before sending."); return; }
                    toast.success(`Feedback queued for ${form.sonographerEmail} — will be sent on submission.`);
                  }}
                  className="flex items-center gap-2 border-[#189aa1] text-[#189aa1] hover:bg-[#189aa1]/5"
                >
                  Send Feedback
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={createReview.isPending}
                className="flex items-center gap-2 text-white"
                style={{ background: BRAND }}
              >
                {createReview.isPending ? "Submitting..." : "Submit Review"}
                <CheckCircle2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) return content;

  return <Layout>{content}</Layout>;
}
