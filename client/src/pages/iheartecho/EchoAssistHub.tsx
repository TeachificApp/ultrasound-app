/*
  iHeartEcho™ — EchoAssist™ Hub
  Unified entry point for all echo protocol + scan coach specialties
  Brand: Teal #189aa1, Aqua #4ad9e0
  US spelling throughout
  Free: Adult Echo, Pediatric Echo, Fetal Echo, Strain, UEA
  Premium: Stress Echo, HOCM-Assist™, Pulmonary HTN & PE, Structural Heart, TEE, ICE, MechanicalSupportAssist™
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import {
  Stethoscope, Microscope, Zap, Users, Baby, Heart,
  Cpu, BarChart3, ArrowRight, Droplets, Activity, Wind, Crown, Lock, Shield, Radio, BookOpen, CircuitBoard
} from "lucide-react";
import { usePremium } from "@/hooks/usePremium";

const BRAND = "#189aa1";

type Specialty = {
  path: string;
  icon: any;
  title: string;
  description: string;
  badge: string;
  scanCoachPath?: string;
  echoAssistPath?: string;
  free: boolean;
  scanCoachPremium?: boolean;
};

const specialties: Specialty[] = [
  { path: "/tte", scanCoachPath: "/scan-coach?tab=tte", echoAssistPath: "/echoassist", icon: Stethoscope, title: "Adult Echo", description: "View-by-view TTE protocol with checklist, critical item tracking, normal reference values, guideline-based reference values, and probe guidance with anatomy overlays.", badge: "Adult TTE", free: true },
  { path: "/pediatric", scanCoachPath: "/scan-coach?tab=chd", echoAssistPath: "/pediatric-echo-assist", icon: Users, title: "Pediatric Echo", description: "CHD findings, BSA Z-score calculators, Qp/Qs shunt estimation, segmental analysis, neonatal hemodynamics, and pediatric CHD scan guidance. Includes PediatricEchoAssist™ calculator engine.", badge: "Congenital Heart", free: true, scanCoachPremium: true },
  { path: "/fetal", scanCoachPath: "/scan-coach?tab=fetal", echoAssistPath: "/fetal-echo-assist", icon: Baby, title: "Fetal Echo", description: "Fetal cardiac findings, CHD differentials, biometry Z-scores, situs, arch patterns, fetal scan coach with clinical images, and FetalEchoAssist™ calculator engine.", badge: "Fetal", free: true, scanCoachPremium: true },
  { path: "/stress", scanCoachPath: "/stress-scan-coach", icon: Zap, title: "Stress Echo", description: "Exercise and DSE protocols, 17-segment WMSI scorer, target HR calculator, interpretation criteria, and pharmacologic stress guidance.", badge: "Stress Echo", free: false },
  { path: "/diastolic", scanCoachPath: "/scan-coach?tab=diastolic", echoAssistPath: "/echoassist#engine-diastologyassist", icon: Activity, title: "Diastolic Function", description: "Step-by-step diastolic assessment: mitral inflow, TDI e', E/e' ratio, LAVI, TR velocity, pulmonary venous flow, and guideline-based grading algorithm with scan coach.", badge: "Diastology", free: true },
  { path: "/strain", scanCoachPath: "/strain-scan-coach", icon: BarChart3, title: "Strain", description: "LV GLS, RV strain, LA strain, bull's-eye display, clinical interpretation, segmental curves, and strain scan coach with tips and clinical pattern library.", badge: "Strain", free: true },
  { path: "/uea-navigator", scanCoachPath: "/uea-scan-coach", icon: Droplets, title: "UEA (Contrast Echo)", description: "Contrast echo protocol: safety screening, agent preparation, view-by-view LVO and myocardial perfusion assessment, and reporting guidance.", badge: "Contrast Echo", free: true },
  { path: "/hocm-navigator", scanCoachPath: "/hocm-scan-coach", icon: Activity, title: "HOCM-Assist™", description: "Morphology assessment, SAM grading, resting and provoked LVOT gradients, goal-directed Valsalva, MR evaluation, and guideline-based reporting thresholds.", badge: "Cardiomyopathy", free: false },
  { path: "/pulm-htn", scanCoachPath: "/scan-coach?tab=pulm", icon: Wind, title: "Pulmonary HTN & PE", description: "TRV-based PH probability, RVSP estimation, RV function, PA dilation, PE echo signs (McConnell's, 60/60, D-sign), risk stratification, and guideline-based thresholds.", badge: "Pulmonary", free: false },
  { path: "/device", scanCoachPath: "/structural-heart-scan-coach", icon: Heart, title: "Structural Heart", description: "TAVR, MitraClip, WATCHMAN, and ASD/PFO closure — procedural echo guidance, post-implant assessment, and structural intervention checklists.", badge: "Structural Heart", free: false },
  { path: "/tee", scanCoachPath: "/tee-scan-coach", icon: Microscope, title: "TEE", description: "ME, TG, and UE views with angle/depth guidance, clinical applications, intraoperative checklist, and TEE scan coach with view acquisition tips.", badge: "TEE", free: false },
  { path: "/ice", scanCoachPath: "/ice-scan-coach", icon: Cpu, title: "ICE", description: "Intracardiac echo views, procedural checklists, key measurements for structural interventions, and ICE scan coach with view acquisition guidance.", badge: "ICE", free: false },
  { path: "/mechanical-support-navigator", scanCoachPath: "/mechanical-support-scan-coach", icon: CircuitBoard, title: "MechanicalSupportAssist™", description: "Echo assessment for LVAD, ECMO, Impella (all versions), LifeVest, and ICD/CRT-D — pre-implant, device positioning, post-implant monitoring, and weaning protocols.", badge: "MCS", free: false },
];

const badgeColors: Record<string, string> = {
  "Adult TTE": "#189aa1",
  "Congenital Heart": "#189aa1",
  "Fetal": "#189aa1",
  "Stress Echo": "#189aa1",
  "Strain": "#189aa1",
  "Contrast Echo": "#189aa1",
  "Cardiomyopathy": "#189aa1",
  "Pulmonary": "#189aa1",
  "Structural Heart": "#189aa1",
  "TEE": "#189aa1",
  "ICE": "#189aa1",
  "Diastology": "#189aa1",
  "MCS": "#7c3aed",
};

export default function EchoAssistHub() {
  const { isPremium } = usePremium();
  const [upgradeModal, setUpgradeModal] = useState<{ title: string } | null>(null);
  const freeCount = specialties.filter(s => s.free).length;
  const premiumCount = specialties.filter(s => !s.free).length;

  return (
    <Layout>
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-10 md:py-14">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <Stethoscope className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                  <span className="text-sm text-white/80 font-medium">12 Specialties · Protocol + Scan Coach</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1">
                  <span className="text-sm text-emerald-300 font-medium">{freeCount} Free</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/30 rounded-full px-3 py-1">
                  <Crown className="w-3 h-3 text-amber-300" />
                  <span className="text-sm text-amber-300 font-medium">{premiumCount} Premium</span>
                </div>
              </div>
              <h1
                className="text-2xl md:text-3xl font-black text-white leading-tight"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                EchoAssist™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-base mt-0.5">Echo Protocol Navigator &amp; ScanCoach</p>
              <p className="text-white/70 text-sm md:text-base mt-2 max-w-xl leading-relaxed">
                Structured echo protocols with view-by-view checklists, normal reference values, scanning tips, probe guidance, and guideline-based interpretation — for every modality and patient population.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Specialty Grid */}
      <div className="container py-8">
        {/* Free section */}
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {specialties.filter(s => s.free).map(({ path, scanCoachPath, echoAssistPath, icon: Icon, title, description, badge, scanCoachPremium }) => {
              const badgeColor = badgeColors[badge] ?? BRAND;
              return (
                <div
                  key={path}
                  className="bg-white rounded-xl border border-emerald-100 p-5 h-full hover:shadow-md transition-all hover:border-emerald-300/50 flex flex-col"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
                      <Icon className="w-5 h-5" style={{ color: BRAND }} />
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: badgeColor + "15", color: badgeColor }}
                    >
                      {badge}
                    </span>
                  </div>
                  <h3
                    className="font-bold text-gray-800 mb-1.5 text-base leading-snug"
                    style={{ fontFamily: "Merriweather, serif" }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4 flex-1">{description}</p>
                  <div className="flex flex-col gap-2 mt-auto">
                    <div className="flex items-center gap-2">
                      <Link href={path} className="flex-1">
                        <button
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: BRAND }}
                        >
                          Go to Navigator <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                      {scanCoachPath && (
                        scanCoachPremium && !isPremium ? (
                          <button
                            className="flex-1 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-all hover:bg-amber-50"
                            style={{ borderColor: "#f59e0b40", color: "#d97706" }}
                            onClick={() => setUpgradeModal({ title })}
                          >
                            <Crown className="w-3.5 h-3.5" />
                            ScanCoach
                          </button>
                        ) : (
                          <Link href={scanCoachPath} className="flex-1">
                            <button
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-all hover:bg-[#189aa1]/5"
                              style={{ borderColor: BRAND + "40", color: BRAND }}
                            >
                              Go to ScanCoach
                            </button>
                          </Link>
                        )
                      )}
                    </div>
                    {echoAssistPath && (
                      <Link href={echoAssistPath}>
                        <button
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-all hover:bg-[#189aa1]/5"
                          style={{ borderColor: BRAND + "40", color: BRAND }}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          {badge === "Fetal" ? "FetalEchoAssist™ Calculators" : badge === "Congenital Heart" ? "PediatricEchoAssist™ Calculators" : badge === "Diastology" ? "DiastologyAssist™ Calculators" : "EchoAssist™ Calculators"}
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Premium section */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {specialties.filter(s => !s.free).map(({ path, scanCoachPath, icon: Icon, title, description, badge }) => {
              const badgeColor = badgeColors[badge] ?? BRAND;
              return (
                <div
                  key={path}
                  className="bg-white rounded-xl border border-amber-100 p-5 h-full hover:shadow-md transition-all hover:border-amber-300/50 flex flex-col relative"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                >
                  {/* Premium corner ribbon */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <Crown className="w-3 h-3 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600">Premium</span>
                  </div>

                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
                      <Icon className="w-5 h-5" style={{ color: BRAND }} />
                    </div>
                    <div className="w-24" /> {/* spacer for the absolute badge */}
                  </div>
                  <div className="mb-1.5">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: badgeColor + "15", color: badgeColor }}
                    >
                      {badge}
                    </span>
                  </div>
                  <h3
                    className="font-bold text-gray-800 mb-1.5 text-base leading-snug"
                    style={{ fontFamily: "Merriweather, serif" }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4 flex-1">{description}</p>
                  <div className="flex items-center gap-2 mt-auto">
                    {isPremium ? (
                      <>
                        <Link href={path} className="flex-1">
                          <button
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                            style={{ background: BRAND }}
                          >
                            Go to Navigator <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                        {scanCoachPath && (
                          <Link href={scanCoachPath} className="flex-1">
                            <button
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-all hover:bg-[#189aa1]/5"
                              style={{ borderColor: BRAND + "40", color: BRAND }}
                            >
                              Go to ScanCoach
                            </button>
                          </Link>
                        )}
                      </>
                    ) : (
                      <Link href={path} className="w-full">
                        <button
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
                        >
                          Preview Content <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upgrade CTA — only shown to free users */}
          {!isPremium && (
          <div
            className="mt-6 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Premium Access</span>
              </div>
              <h3
                className="text-white font-bold text-base mb-1"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                Unlock All {premiumCount} Premium Specialties
              </h3>
              <p className="text-white/60 text-sm">
                Stress Echo, HOCM-Assist™, Pulmonary HTN & PE, Structural Heart, TEE, ICE, and MechanicalSupportAssist™ — plus all future premium content.
              </p>
            </div>
            <Link href="/premium" className="flex-shrink-0">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                style={{ background: "#189aa1" }}
              >
                <Crown className="w-4 h-4" />
                Upgrade Membership
              </button>
            </Link>
          </div>
          )}
        </div>

        {/* ── ACHDEchoAssist™ Cross-Promotion ──────────────────────────── */}
        <div
          className="mt-8 rounded-xl p-5 border"
          style={{ borderColor: "#189aa1" + "40", background: "#f0fbfc" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
              >
                <Heart className="w-7 h-7 text-[#4ad9e0]" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#189aa1" }}>
                  Adult Congenital Heart Disease Calculators
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1" style={{ fontFamily: "Merriweather, serif" }}>
                ACHDEchoAssist™
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                12 guideline-based calculators — Fontan Hepatic Index, Ebstein's Severity, CoA Re-coarctation Index, Qp:Qs, RVSP, Aortic Root Z-score, RV FAC, TAPSE, Tei Index, Systemic AV Regurgitation, Pulmonary Regurgitation Fraction, and Shunt Significance.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/achd-echo-assist">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#189aa1" }}
                  >
                    <Heart className="w-3.5 h-3.5" />
                    Open ACHDEchoAssist™
                  </button>
                </Link>
                <Link href="/achd">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border bg-white transition-all hover:bg-[#f0fbfc]"
                    style={{ borderColor: "#189aa1" + "50", color: "#189aa1" }}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    ACHD Navigator
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── PediatricEchoAssist™ Cross-Promotion ─────────────────────── */}
        <div
          className="mt-8 rounded-xl p-5 border"
          style={{ borderColor: "#189aa1" + "40", background: "#f0fbfc" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
              >
                <Baby className="w-7 h-7 text-[#4ad9e0]" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#189aa1" }}>
                  Pediatric &amp; Congenital Echo Calculators
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1" style={{ fontFamily: "Merriweather, serif" }}>
                PediatricEchoAssist™
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                20 guideline-based calculators — BSA, 6 Z-scores, Coronary Z-score (Kawasaki), Qp:Qs, RVSP, Rp:Rs, Shortening Fraction, Bullet EF (5/6 AL), Tei Index, TAPSE Z-score, RV FAC, Nakata Index, McGoon Ratio, CoA Gradient, Pediatric AVA, and Ross Score.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/pediatric-echo-assist">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#189aa1" }}
                  >
                    <Baby className="w-3.5 h-3.5" />
                    Open PediatricEchoAssist™
                  </button>
                </Link>
                <Link href="/pediatric">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border bg-white transition-all hover:bg-[#f0fbfc]"
                    style={{ borderColor: "#189aa1" + "50", color: "#189aa1" }}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Pediatric Navigator
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── FetalEchoAssist™ Cross-Promotion ─────────────────────────── */}
        <div
          className="mt-8 rounded-xl p-5 border"
          style={{ borderColor: "#189aa1" + "40", background: "#f0fbfc" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0e1e2e, #0369a1)" }}
              >
                <Baby className="w-7 h-7 text-[#4ad9e0]" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#189aa1" }}>
                  Fetal Echo Calculators
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1" style={{ fontFamily: "Merriweather, serif" }}>
                FetalEchoAssist™
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                12 fetal echo calculators with guideline-based interpretation — Celermajer Index, CVPS, CTR, Tei Index, E/A Ratio, Ductus Venosus PIV, UA Doppler, MCA PSV (MoM), FHR Classification, PA/Ao Ratio, Wall Thickness Z-score, and Shortening Fraction.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/fetal-echo-assist">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#189aa1" }}
                  >
                    <Baby className="w-3.5 h-3.5" />
                    Open FetalEchoAssist™
                  </button>
                </Link>
                <Link href="/fetal">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border bg-white transition-all hover:bg-[#0369a1]/5"
                    style={{ borderColor: "#189aa1" + "50", color: "#189aa1" }}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Fetal Echo Navigator
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── POCUS-Assist™ Cross-Promotion ──────────────────────────────── */}
        <div
          className="mt-8 rounded-xl p-5 border"
          style={{ borderColor: "#189aa1" + "40", background: "#f0fbfc" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
              >
                <Shield className="w-7 h-7 text-[#4ad9e0]" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#189aa1" }}
                >
                  Also in iHeartEcho
                </span>
              </div>
              <h3
                className="font-bold text-gray-900 text-base mb-1"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                POCUS-Assist™
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                Point-of-care ultrasound protocols for eFAST, RUSH, Cardiac POCUS, and Lung POCUS — each with a Navigator, ScanCoach, and guideline-based engine calculators including IVC Collapsibility Index, 8-Zone B-Line Scorer, and eFAST Free-Fluid Grader.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/pocus-assist-hub">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#189aa1" }}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Open POCUS-Assist™ Hub
                  </button>
                </Link>
                <Link href="/echoassist#engine-pocus">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border bg-white transition-all hover:bg-[#189aa1]/5"
                    style={{ borderColor: "#189aa1" + "50", color: "#189aa1" }}
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    POCUS Engine Calculators
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── ECG-Assist™ Suite Cross-Promotion ─────────────────────────── */}
        <div
          className="mt-8 rounded-xl p-5 border"
          style={{ borderColor: "#189aa1" + "40", background: "#f0fbfc" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
              >
                <Radio className="w-7 h-7 text-[#4ad9e0]" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#189aa1" }}>
                  ECG Interpretation Suite
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1" style={{ fontFamily: "Merriweather, serif" }}>
                ECG-Assist™ Suite
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                Three-part ECG suite — ECG Navigator (free, 9 clinical sections covering rate/rhythm, ST-T changes, Brugada, Sgarbossa, pacemaker ECGs), ECG Coach (premium, lead placement and neonatal ECG guidance), and ECG Calculators (premium, 12 guideline-based calculators including QTc, LVH voltage criteria, HEART score, GRACE score, and Brugada VT criteria).
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/ecg-navigator">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#189aa1" }}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    ECG Navigator
                  </button>
                </Link>
                <Link href="/ecg-coach">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border bg-white transition-all hover:bg-[#f0fbfc]"
                    style={{ borderColor: "#189aa1" + "50", color: "#189aa1" }}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    ECG Coach
                  </button>
                </Link>
                <Link href="/ecg-assist">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border bg-white transition-all hover:bg-[#f0fbfc]"
                    style={{ borderColor: "#189aa1" + "50", color: "#189aa1" }}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    ECG Calculators
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* UltrasoundAssist CTA */}
      <div className="container pb-10">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
        >
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-shrink-0">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(74,217,224,0.15)", border: "1.5px solid rgba(74,217,224,0.3)" }}
              >
                <Radio className="w-7 h-7" style={{ color: "#4ad9e0" }} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(74,217,224,0.15)", color: "#4ad9e0", border: "1px solid rgba(74,217,224,0.3)" }}
                >
                  General &amp; Vascular Ultrasound
                </span>
              </div>
              <h3
                className="text-white font-bold text-lg md:text-xl mb-1.5"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                UltrasoundAssist&#8482;
              </h3>
              <p className="text-white/70 text-sm leading-relaxed max-w-xl">
                Extend your clinical toolkit beyond echo. UltrasoundAssist&#8482; provides structured ScanCoach guidance for general and vascular ultrasound &mdash; abdominal, MSK, thyroid, carotid, venous, and more &mdash; all built on AIUM, SVU and ultrasound society guidelines.
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col sm:flex-row gap-3">
              <a
                href="https://app.allaboutultrasound.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
                style={{ background: "#189aa1" }}
              >
                <Radio className="w-4 h-4" />
                Open UltrasoundAssist&#8482;
              </a>

            </div>
          </div>
        </div>
      </div>

      {/* Upgrade modal */}
      {upgradeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setUpgradeModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                <Crown className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>Premium Feature</h3>
              <p className="text-sm text-gray-500 mt-1">
                <strong>{upgradeModal.title}</strong> requires a Premium membership.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/premium" onClick={() => setUpgradeModal(null)}>
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                >
                  <Crown className="w-4 h-4" /> Upgrade to Premium
                </button>
              </Link>
              <button
                className="w-full px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 border border-gray-200"
                onClick={() => setUpgradeModal(null)}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
