/*
 * Accreditation Readiness Tool
 * Full IAC Echocardiography Accreditation Checklist with per-section progress markers.
 * Data is persisted per lab via tRPC.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight,
  Save, AlertCircle, Info, ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

// ─── IAC Checklist Data ───────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  text: string;
  note?: string;
  required?: boolean;
  /** If true: clickable/trackable but excluded from readiness progress calculations */
  caseMixItem?: boolean;
}

interface ChecklistSection {
  id: string;
  title: string;
  subtitle?: string;
  items: ChecklistItem[];
}

interface ChecklistStep {
  id: string;
  step: number;
  title: string;
  description: string;
  sections: ChecklistSection[];
  /** If true: this entire step is excluded from readiness % (Case Mix category) */
  caseMixStep?: boolean;
}

const IAC_CHECKLIST: ChecklistStep[] = [
  {
    id: "step2",
    step: 1,
    title: "Personnel",
    description: "Medical Director, Technical Director, sonographers, and interpreting physicians must meet IAC qualifications.",
    sections: [
      {
        id: "s2-medical-director",
        title: "Medical Director",
        subtitle: "Must be a licensed physician with appropriate training and credentials",
        items: [
          { id: "s2-md-1", text: "Medical Director identified and CV on file", required: true },
          { id: "s2-md-2", text: "Medical Director holds appropriate board certification (ABNM, ABR, ABIM, ABPN, or equivalent)", required: true },
          { id: "s2-md-3", text: "Medical Director has documented echocardiography training/experience", required: true },
          { id: "s2-md-4", text: "Medical Director oversees quality assurance program", required: true },
          { id: "s2-md-5", text: "Medical Director reviews and approves all policies and procedures", required: true },
          { id: "s2-md-6", text: "Medical Director continuing education documented (30 CME/3 years in echo)", required: true },
        ],
      },
      {
        id: "s2-tech-director",
        title: "Technical Director",
        subtitle: "Must hold appropriate credential (RDCS, RCS, RCCS, or equivalent)",
        items: [
          { id: "s2-td-1", text: "Technical Director identified and CV on file", required: true },
          { id: "s2-td-2", text: "Technical Director holds RDCS, RCS, RCCS, or equivalent credential", required: true },
          { id: "s2-td-3", text: "Technical Director has ≥3 years clinical experience in applicable echo modality", required: true },
          { id: "s2-td-4", text: "Technical Director oversees sonographer training and competency", required: true },
          { id: "s2-td-5", text: "Technical Director continuing education documented (30 CME/3 years)", required: true },
        ],
      },
      {
        id: "s2-sonographers",
        title: "Sonographers",
        subtitle: "All performing sonographers must meet minimum credential requirements",
        items: [
          { id: "s2-s-1", text: "All sonographers hold RDCS, RCS, RCCS, or equivalent credential (or are in training under supervision)", required: true },
          { id: "s2-s-2", text: "Sonographer credentials and CVs on file for all performing staff", required: true },
          { id: "s2-s-3", text: "Sonographers performing stress echo have documented stress echo training", required: true },
          { id: "s2-s-4", text: "Sonographers performing TEE have documented TEE training", required: true },
          { id: "s2-s-5", text: "Sonographers performing pediatric/fetal echo have documented pediatric/fetal training", required: true },
          { id: "s2-s-6", text: "Continuing education documented for all sonographers (30 CME/3 years)", required: true },
        ],
      },
      {
        id: "s2-physicians",
        title: "Interpreting Physicians",
        subtitle: "All interpreting physicians must meet minimum training requirements",
        items: [
          { id: "s2-p-1", text: "All interpreting physicians identified with CVs on file", required: true },
          { id: "s2-p-2", text: "Interpreting physicians have documented echo training/experience (ASE Level II or equivalent)", required: true },
          { id: "s2-p-3", text: "Interpreting physicians hold appropriate board certification", required: true },
          { id: "s2-p-4", text: "Continuing education documented for all interpreting physicians (30 CME/3 years)", required: true },
          { id: "s2-p-5", text: "Physician peer review (inter-reader variability) program in place", required: true },
        ],
      },
    ],
  },
  {
    id: "step3",
    step: 2,
    title: "Equipment",
    description: "All equipment must meet IAC technical standards and be properly maintained.",
    sections: [
      {
        id: "s3-equipment",
        title: "Ultrasound Equipment",
        items: [
          { id: "s3-1", text: "All ultrasound equipment listed with make, model, and serial number", required: true },
          { id: "s3-2", text: "Equipment meets minimum technical specifications for each accreditation program", required: true },
          { id: "s3-3", text: "Equipment maintenance and service records on file", required: true },
          { id: "s3-4", text: "Equipment cleaning and disinfection protocols documented", required: true },
          { id: "s3-5", text: "Transducer inventory documented with cleaning/disinfection logs", required: true },
          { id: "s3-6", text: "Backup equipment plan documented", required: false },
        ],
      },
      {
        id: "s3-stress",
        title: "Stress Echo Equipment (if applicable)",
        items: [
          { id: "s3-st-1", text: "Treadmill or bicycle ergometer available and maintained (exercise stress)", required: false },
          { id: "s3-st-2", text: "Pharmacologic stress agents available with emergency protocols", required: false },
          { id: "s3-st-3", text: "Crash cart and defibrillator available in stress echo area", required: false },
          { id: "s3-st-4", text: "ECG monitoring equipment available during stress testing", required: false },
          { id: "s3-st-5", text: "Reversal agents available for pharmacologic stress (atropine, aminophylline)", required: false },
        ],
      },
      {
        id: "s3-reporting",
        title: "Reporting & Storage",
        items: [
          { id: "s3-r-1", text: "Digital image storage system in place (PACS or equivalent)", required: true },
          { id: "s3-r-2", text: "Image retention policy documented (minimum 5 years for adults, longer for pediatric)", required: true },
          { id: "s3-r-3", text: "Report generation system in place with structured reporting", required: true },
          { id: "s3-r-4", text: "Turnaround time for reports documented and monitored", required: true },
        ],
      },
    ],
  },
  {
    id: "step4",
    step: 3,
    title: "Policies & Procedures",
    description: "Written policies and procedures must be in place, reviewed annually, and signed by the Medical Director.",
    sections: [
      {
        id: "s4-clinical",
        title: "Clinical Policies",
        items: [
          { id: "s4-c-1", text: "Written protocol for each accreditation program (ATTE, ATEE, STRESS, etc.)", required: true },
          { id: "s4-c-2", text: "Indications and contraindications for each procedure documented", required: true },
          { id: "s4-c-3", text: "Patient preparation instructions documented", required: true },
          { id: "s4-c-4", text: "Procedure protocols reviewed and signed by Medical Director within last 12 months", required: true },
          { id: "s4-c-5", text: "Contrast echo protocol (if applicable) including indications and safety monitoring", required: false },
          { id: "s4-c-6", text: "TEE protocol including patient preparation, sedation, and monitoring (if applicable)", required: false },
          { id: "s4-c-7", text: "Stress echo emergency protocol including physician availability", required: false },
        ],
      },
      {
        id: "s4-safety",
        title: "Safety & Emergency Policies",
        items: [
          { id: "s4-s-1", text: "Emergency response plan documented and staff trained", required: true },
          { id: "s4-s-2", text: "Infection control and hand hygiene protocols documented", required: true },
          { id: "s4-s-3", text: "Patient safety and incident reporting policy in place", required: true },
          { id: "s4-s-4", text: "Radiation safety policy (if applicable)", required: false },
          { id: "s4-s-5", text: "Latex allergy protocol documented", required: true },
          { id: "s4-s-6", text: "Patient identification verification protocol documented", required: true },
        ],
      },
      {
        id: "s4-qa",
        title: "Quality Assurance Policies",
        items: [
          { id: "s4-qa-1", text: "Written QA program in place with defined metrics and review frequency", required: true },
          { id: "s4-qa-2", text: "Image quality review process documented (IQR program)", required: true },
          { id: "s4-qa-3", text: "Physician inter-reader variability program documented", required: true },
          { id: "s4-qa-4", text: "Turnaround time monitoring policy documented", required: true },
          { id: "s4-qa-5", text: "Corrected report policy documented", required: true },
          { id: "s4-qa-6", text: "Correlation study policy documented (echo vs. other imaging or cath)", required: true },
          { id: "s4-qa-7", text: "QA results reviewed at least annually with documented action plans", required: true },
        ],
      },
      {
        id: "s4-admin",
        title: "Administrative Policies",
        items: [
          { id: "s4-a-1", text: "Patient confidentiality and HIPAA compliance policy documented", required: true },
          { id: "s4-a-2", text: "Informed consent policy documented", required: true },
          { id: "s4-a-3", text: "Competency assessment policy for all staff documented", required: true },
          { id: "s4-a-4", text: "New employee orientation and training policy documented", required: true },
          { id: "s4-a-5", text: "Continuing education policy documented", required: true },
          { id: "s4-a-6", text: "Supervision policy for students and trainees documented", required: true },
        ],
      },
    ],
  },
  {
    id: "step5",
    step: 4,
    title: "Quality Assurance Program",
    description: "Active QA program with documented results is required for all accreditation programs.",
    sections: [
      {
        id: "s5-iqr",
        title: "Image Quality Review (IQR)",
        subtitle: "Required for ATTE, ATEE, STRESS, ACTE, PTTE, PTEE, and FETAL",
        items: [
          { id: "s5-iqr-1", text: "IQR program active with documented reviews for each sonographer", required: true },
          { id: "s5-iqr-2", text: "IQR reviews conducted at least annually per sonographer", required: true },
          { id: "s5-iqr-3", text: "IQR scoring criteria documented and applied consistently", required: true },
          { id: "s5-iqr-4", text: "IQR results reviewed with sonographers and action plans documented", required: true },
          { id: "s5-iqr-5", text: "Technical Director reviews and signs off on all IQR results", required: true },
        ],
      },
      {
        id: "s5-peer",
        title: "Physician Peer Review (Inter-Reader Variability)",
        items: [
          { id: "s5-pr-1", text: "Physician peer review program active with documented reviews", required: true },
          { id: "s5-pr-2", text: "Peer reviews conducted at least annually per interpreting physician", required: true },
          { id: "s5-pr-3", text: "Concordance/discordance rates tracked and documented", required: true },
          { id: "s5-pr-4", text: "Discordant findings reviewed and action plans documented", required: true },
          { id: "s5-pr-5", text: "Medical Director reviews and signs off on all peer review results", required: true },
        ],
      },
      {
        id: "s5-correlation",
        title: "Correlation Studies",
        items: [
          { id: "s5-cor-1", text: "Echo-to-catheterization or echo-to-other-imaging correlation studies documented", required: true },
          { id: "s5-cor-2", text: "Minimum required correlation studies submitted per IAC requirements", required: true },
          { id: "s5-cor-3", text: "Correlation study results reviewed and action plans documented", required: true },
        ],
      },
      {
        id: "s5-reporting",
        title: "Reporting & Turnaround Times",
        items: [
          { id: "s5-rt-1", text: "Report turnaround time monitored and documented (inpatient: ≤24h, outpatient: ≤48h recommended)", required: true },
          { id: "s5-rt-2", text: "Corrected report rate tracked and documented", required: true },
          { id: "s5-rt-3", text: "Structured reporting format used consistently", required: true },
          { id: "s5-rt-4", text: "Final reports include all required IAC elements (measurements, calculations, clinical impression)", required: true },
        ],
      },
    ],
  },
];

// ─── Shared checklist data export for free-tier Navigator use ─────────────────
export { IAC_CHECKLIST };
export type { ChecklistItem, ChecklistSection, ChecklistStep };

// ─── Component ────────────────────────────────────────────────────────────────

const BRAND = "#189aa1";

/**
 * Props for embedding in other contexts (e.g. EchoAccreditation Navigator™).
 * When `trpcProcedure` is provided, uses that instead of the default DIY tool procedure.
 */
interface AccreditationReadinessProps {
  /** tRPC procedure namespace to use. Defaults to "accreditationReadiness" (DIY tool). */
  trpcNamespace?: "accreditationReadiness" | "accreditationReadinessNavigator";
}

export default function AccreditationReadiness({ trpcNamespace = "accreditationReadiness" }: AccreditationReadinessProps = {}) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(["step2"]));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // ── Data loading — use the correct tRPC namespace ──
  const diyQuery = trpc.accreditationReadiness.get.useQuery(undefined, {
    enabled: trpcNamespace === "accreditationReadiness",
    retry: false,
  });
  const navQuery = trpc.accreditationReadinessNavigator.get.useQuery(undefined, {
    enabled: trpcNamespace === "accreditationReadinessNavigator",
    retry: false,
  });
  // Auto-check signals from DB (DIY tool only — Navigator has no lab membership)
  const autoChecksQuery = trpc.accreditationReadiness.autoChecks.useQuery(undefined, {
    enabled: trpcNamespace === "accreditationReadiness",
    retry: false,
  });
  const autoChecks: Record<string, boolean> = autoChecksQuery.data ?? {};

  const savedData = trpcNamespace === "accreditationReadiness" ? diyQuery.data : navQuery.data;
  const isLoading = trpcNamespace === "accreditationReadiness" ? diyQuery.isLoading : navQuery.isLoading;

  useEffect(() => {
    if (savedData) {
      try {
        const progress = JSON.parse(savedData.checklistProgress || "{}");
        const notes = JSON.parse(savedData.itemNotes || "{}");
        setChecklistProgress(progress);
        setItemNotes(notes);
      } catch {
        // ignore parse errors
      }
    }
  }, [savedData]);

  // ── Save mutations — one per namespace ──
  const diySave = trpc.accreditationReadiness.save.useMutation({
    onSuccess: () => { setIsDirty(false); toast.success("Progress saved."); },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });
  const navSave = trpc.accreditationReadinessNavigator.save.useMutation({
    onSuccess: () => { setIsDirty(false); toast.success("Progress saved."); },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });
  const saveMutation = trpcNamespace === "accreditationReadiness" ? diySave : navSave;

  // Effective check state: auto-checked items are always true (but user can still manually override)
  const effectiveProgress = useMemo(() => {
    const merged: Record<string, boolean> = { ...checklistProgress };
    for (const [id, val] of Object.entries(autoChecks)) {
      if (val) merged[id] = true; // auto-check overrides unchecked state
    }
    return merged;
  }, [checklistProgress, autoChecks]);

  // ── Progress calculations ──
  const allReadinessItems = IAC_CHECKLIST.flatMap(s => s.sections.flatMap(sec => sec.items));
  const requiredItems = allReadinessItems.filter(i => i.required !== false);
  const checkedTotal = allReadinessItems.filter(i => effectiveProgress[i.id]).length;
  const checkedRequired = requiredItems.filter(i => effectiveProgress[i.id]).length;
  const overallPct = allReadinessItems.length > 0 ? Math.round((checkedTotal / allReadinessItems.length) * 100) : 0;
  const requiredPct = requiredItems.length > 0 ? Math.round((checkedRequired / requiredItems.length) * 100) : 0;

  const handleCheck = useCallback((itemId: string, checked: boolean) => {
    // If auto-checked, don't allow unchecking — the data needs to be removed from the source
    if (autoChecks[itemId] && !checked) return;
    setChecklistProgress(prev => ({ ...prev, [itemId]: checked }));
    setIsDirty(true);
  }, [autoChecks]);

  const handleSave = useCallback(() => {
    saveMutation.mutate({ checklistProgress, itemNotes, completionPct: overallPct });
  }, [checklistProgress, itemNotes, overallPct, saveMutation]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId); else next.add(stepId);
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
      return next;
    });
  };

  const getStepProgress = (step: ChecklistStep) => {
    const items = step.sections.flatMap(s => s.items);
    const checked = items.filter(i => effectiveProgress[i.id]).length;
    return { checked, total: items.length, pct: items.length > 0 ? Math.round((checked / items.length) * 100) : 0 };
  };

  const getSectionProgress = (section: ChecklistSection) => {
    const checked = section.items.filter(i => effectiveProgress[i.id]).length;
    return { checked, total: section.items.length, pct: section.items.length > 0 ? Math.round((checked / section.items.length) * 100) : 0 };
  };

  const getReadinessStatus = () => {
    if (requiredPct >= 100) return { label: "Ready to Apply", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> };
    if (requiredPct >= 75) return { label: "Almost Ready", color: "bg-yellow-100 text-yellow-800", icon: <AlertCircle className="w-4 h-4 text-yellow-600" /> };
    if (requiredPct >= 40) return { label: "In Progress", color: "bg-blue-100 text-blue-800", icon: <Info className="w-4 h-4 text-blue-600" /> };
    return { label: "Getting Started", color: "bg-gray-100 text-gray-700", icon: <Circle className="w-4 h-4 text-gray-500" /> };
  };

  const status = getReadinessStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: BRAND }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
            Accreditation Readiness Checklist
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            IAC Echocardiography Accreditation Checklist — track your lab's readiness for each requirement.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          className="flex items-center gap-2 text-white"
          style={{ background: BRAND }}
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "Saving..." : "Save Progress"}
        </Button>
      </div>

      {/* Overall Progress Card */}
      <Card className="border border-[#189aa1]/20 bg-gradient-to-r from-[#f0fbfc] to-white">
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {status.icon}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
              </div>
              <div className="text-3xl font-bold" style={{ color: BRAND }}>{overallPct}%</div>
              <div className="text-xs text-gray-500">Overall readiness</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Required Items</div>
              <div className="text-2xl font-bold text-gray-800">{checkedRequired}<span className="text-base font-normal text-gray-400">/{requiredItems.length}</span></div>
              <Progress value={requiredPct} className="mt-2 h-2" />
              <div className="text-xs text-gray-500 mt-1">{requiredPct}% of required items complete</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist Steps */}
      <div className="space-y-3">
        {IAC_CHECKLIST.map((step) => {
          const stepProg = getStepProgress(step);
          const isExpanded = expandedSteps.has(step.id);
          const isCaseMix = !!step.caseMixStep;

          return (
            <Card
              key={step.id}
              className={`overflow-hidden ${isCaseMix ? "border border-amber-200" : "border border-gray-200"}`}
            >
              {/* Step Header */}
              <button className="w-full text-left" onClick={() => toggleStep(step.id)}>
                <div className={`flex items-center justify-between p-4 transition-colors ${isCaseMix ? "hover:bg-amber-50 bg-amber-50/40" : "hover:bg-gray-50"}`}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{
                        background: isCaseMix
                          ? "#d97706"
                          : stepProg.pct === 100 ? "#22c55e" : BRAND,
                      }}
                    >
                      {isCaseMix
                        ? <ClipboardCheck className="w-4 h-4" />
                        : stepProg.pct === 100 ? <CheckCircle2 className="w-4 h-4" /> : step.step
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-sm">{step.title}</span>
                        {isCaseMix && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            Tracked separately
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{step.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-semibold" style={{ color: isCaseMix ? "#d97706" : BRAND }}>
                        {stepProg.checked}/{stepProg.total}
                      </div>
                      <div className="text-xs text-gray-400">{isCaseMix ? "acknowledged" : `${stepProg.pct}% done`}</div>
                    </div>
                    {!isCaseMix && (
                      <div className="w-16 hidden sm:block">
                        <Progress value={stepProg.pct} className="h-1.5" />
                      </div>
                    )}
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
              </button>

              {/* Step Content */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {step.sections.map((section) => {
                    const secProg = getSectionProgress(section);
                    const isSectionExpanded = expandedSections.has(section.id) || step.sections.length === 1;

                    return (
                      <div key={section.id} className="border-b border-gray-50 last:border-0">
                        {/* Section Header */}
                        <button
                          className="w-full text-left"
                          onClick={() => step.sections.length > 1 && toggleSection(section.id)}
                        >
                          <div className={`flex items-center justify-between px-5 py-3 ${step.sections.length > 1 ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"} transition-colors`}>
                            <div>
                              <div className="font-medium text-gray-700 text-sm">{section.title}</div>
                              {section.subtitle && <div className="text-xs text-gray-400 mt-0.5">{section.subtitle}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{
                                  borderColor: isCaseMix ? "#d97706" : secProg.pct === 100 ? "#22c55e" : BRAND,
                                  color: isCaseMix ? "#d97706" : secProg.pct === 100 ? "#22c55e" : BRAND,
                                }}
                              >
                                {secProg.checked}/{secProg.total}
                              </Badge>
                              {step.sections.length > 1 && (
                                isSectionExpanded
                                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Section Items */}
                        {isSectionExpanded && (
                          <div className="px-5 pb-3 space-y-1">
                            {section.items.map((item) => {
                              const isAutoChecked = !!autoChecks[item.id];
                              const isChecked = !!effectiveProgress[item.id];
                              const hasNote = !!itemNotes[item.id];
                              const isEditingThis = editingNote === item.id;
                              const isCaseMixItem = !!item.caseMixItem;

                              return (
                                <div
                                  key={item.id}
                                  className={`rounded-lg p-3 transition-colors ${
                                    isChecked
                                      ? isCaseMixItem ? "bg-amber-50" : "bg-green-50"
                                      : "bg-gray-50 hover:bg-gray-100"
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <button
                                      className={`mt-0.5 flex-shrink-0 ${isAutoChecked ? "cursor-default" : ""}`}
                                      onClick={() => !isAutoChecked && handleCheck(item.id, !isChecked)}
                                      title={isAutoChecked ? "Auto-verified from your lab data — remove the source record to uncheck" : isCaseMixItem ? "Mark as acknowledged (does not affect readiness score)" : undefined}
                                    >
                                      {isChecked
                                        ? <CheckCircle2 className={`w-5 h-5 ${isCaseMixItem ? "text-amber-500" : isAutoChecked ? "text-teal-500" : "text-green-500"}`} />
                                        : <Circle className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                                      }
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-sm leading-snug ${isChecked ? "text-gray-500 line-through" : "text-gray-700"}`}>
                                        {item.text}
                                        {isAutoChecked && (
                                          <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5 no-underline" style={{ textDecoration: "none" }}>auto-verified</span>
                                        )}
                                        {item.required === false && !isCaseMixItem && !isAutoChecked && (
                                          <span className="ml-2 text-xs text-gray-400 no-underline">(recommended)</span>
                                        )}
                                        {isCaseMixItem && (
                                          <span className="ml-2 text-xs text-amber-600 no-underline font-medium">(tracked separately)</span>
                                        )}
                                      </div>
                                      {item.note && (
                                        <div className="mt-1 text-xs text-blue-600 flex items-start gap-1">
                                          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                          {item.note}
                                        </div>
                                      )}
                                      {/* Note toggle */}
                                      <div className="mt-1.5 flex items-center gap-2">
                                        <button
                                          className="text-xs text-gray-400 hover:text-gray-600 underline"
                                          onClick={() => setEditingNote(isEditingThis ? null : item.id)}
                                        >
                                          {isEditingThis ? "Close note" : hasNote ? "Edit note" : "Add note"}
                                        </button>
                                        {hasNote && !isEditingThis && (
                                          <span className="text-xs text-gray-500 italic truncate max-w-xs">{itemNotes[item.id]}</span>
                                        )}
                                      </div>
                                      {isEditingThis && (
                                        <Textarea
                                          className="mt-2 text-xs h-16 resize-none"
                                          placeholder="Add a note, document location, or action item..."
                                          value={itemNotes[item.id] ?? ""}
                                          onChange={(e) => {
                                            setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }));
                                            setIsDirty(true);
                                          }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom Save */}
      {isDirty && (
        <div className="sticky bottom-4 flex justify-center">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 text-white shadow-lg"
            style={{ background: BRAND }}
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "Saving..." : "Save Progress"}
          </Button>
        </div>
      )}
    </div>
  );
}
