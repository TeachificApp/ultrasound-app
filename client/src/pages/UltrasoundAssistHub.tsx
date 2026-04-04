/*
  UltrasoundAssist™ — Ultrasound Protocol Navigator & ScanCoach Hub
  v3 — clean rewrite: no conditional colors, no Premium badges, 3 FREE badges only.
  Order: General → OB/Fetal → Vascular (Carotid, Venous, Arterial, AbdVascular, Aorta, TCD)
       → Small Parts → Procedural → MSK → POCUS
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import {
  Activity, Baby, Scan, TrendingUp, BookOpen, Crown, Lock,
  Stethoscope, Brain, Bone, Circle, Zap, Search, Syringe, Calculator
} from "lucide-react";
import { usePremium } from "@/hooks/usePremium";

const specialties = [
  // ── GENERAL ──────────────────────────────────────────────────────────────
  {
    path: "/abdominal-navigator",
    scanCoachPath: "/abdominal-scan-coach",
    icon: Activity,
    title: "Abdominal Ultrasound",
    description: "Liver, gallbladder, bile ducts, pancreas, spleen, kidneys, aorta, and IVC — complete abdominal protocol with view-by-view checklist and AIUM-based reference values.",
    badge: "Abdominal",
    navigatorFree: true,
    scanCoachFree: true,
  },
  {
    path: "/pelvic-gyn-navigator",
    scanCoachPath: "/pelvic-gyn-scan-coach",
    icon: Circle,
    title: "Pelvic/Gyn Ultrasound",
    description: "Uterus, endometrium, ovaries, adnexa, and cul-de-sac — transabdominal and transvaginal pelvic ultrasound protocol per AIUM guidelines.",
    badge: "Pelvic/Gyn",
    navigatorFree: true,
    scanCoachFree: true,
  },
  // ── OB / FETAL ────────────────────────────────────────────────────────────
  {
    path: "/ob1-navigator",
    scanCoachPath: "/ob1-scan-coach",
    icon: Baby,
    title: "OB 1st Trimester",
    description: "Gestational sac, yolk sac, embryo/fetus, CRL, NT measurement, and early anatomy — first trimester obstetric ultrasound per AIUM guidelines.",
    badge: "OB 1st Tri",
    navigatorFree: true,
    scanCoachFree: true,
  },
  {
    path: "/ob23-navigator",
    scanCoachPath: "/ob23-scan-coach",
    icon: Baby,
    title: "OB 2nd/3rd Trimester",
    description: "Fetal biometry, anatomy survey, placenta, amniotic fluid, umbilical cord, and cervical length — second and third trimester obstetric ultrasound per AIUM guidelines.",
    badge: "OB 2nd/3rd Tri",
    navigatorFree: false,
    scanCoachFree: false,
  },
  {
    path: "/fetal-navigator",
    scanCoachPath: "/fetal-echo-assist",
    icon: Baby,
    title: "Fetal Echo",
    description: "Fetal cardiac anatomy, segmental analysis, 4-chamber view, outflow tracts, 3VV, 3VT, and fetal arrhythmia — fetal echocardiography per ASE guidelines.",
    badge: "Fetal Echo",
    navigatorFree: true,
    scanCoachFree: false,
  },
  // ── SMALL PARTS ───────────────────────────────────────────────────────────
  {
    path: "/thyroid-navigator",
    scanCoachPath: "/thyroid-scan-coach",
    icon: Activity,
    title: "Thyroid & Small Parts",
    description: "Thyroid lobes, isthmus, nodule characterization (ACR TI-RADS), cervical lymph nodes, and ultrasound-guided FNA/core biopsy — per ACR TI-RADS 2017 guidelines.",
    badge: "Thyroid",
    navigatorFree: true,
    scanCoachFree: false,
  },
  {
    path: "/scrotum-navigator",
    scanCoachPath: "/scrotum-scan-coach",
    icon: Circle,
    title: "Scrotum Ultrasound",
    description: "Testes, epididymis, and extratesticular structures — scrotal ultrasound protocol with torsion assessment and color Doppler per AIUM guidelines.",
    badge: "Scrotum",
    navigatorFree: true,
    scanCoachFree: false,
  },
  {
    path: "/breast-navigator",
    scanCoachPath: "/breast-scan-coach",
    icon: Circle,
    title: "Breast Ultrasound",
    description: "Systematic breast survey, lesion characterization (ACR BI-RADS), ultrasound-guided biopsy (core/FNA/VAB), and pre-surgical lumpectomy localisation.",
    badge: "Breast",
    navigatorFree: false,
    scanCoachFree: false,
  },
  // ── PROCEDURAL ────────────────────────────────────────────────────────────
  {
    path: "/appendix-navigator",
    scanCoachPath: "/appendix-scan-coach",
    icon: Search,
    title: "Appendix Ultrasound",
    description: "Graded compression technique for appendicitis — RLQ survey, appendix identification, periappendiceal assessment, and alternative RLQ diagnoses per ACR 2022 guidelines.",
    badge: "Appendix",
    navigatorFree: false,
    scanCoachFree: false,
  },
  {
    path: "/invasive-procedures-navigator",
    scanCoachPath: "/invasive-procedures-scan-coach",
    icon: Syringe,
    title: "Invasive Procedures",
    description: "Ultrasound-guided paracentesis and thoracentesis — site selection, real-time needle guidance, and post-procedure assessment per ACCP/ATS/SHM/SCCM 2020 consensus.",
    badge: "Procedures",
    navigatorFree: false,
    scanCoachFree: false,
  },
  // ── PEDIATRIC ────────────────────────────────────────────────────────────
  {
    path: "/pediatric-navigator",
    scanCoachPath: "/pediatric-scan-coach",
    calculatorPath: "/pediatric-calculators",
    icon: Baby,
    title: "PediatricAssist™",
    description: "Pediatric ultrasound — Appendix, Intussusception, Pyloric Stenosis, Kidneys, Spine, Hips (Graf DDH), and Neonatal Neuro with age-based nomograms and clinical decision support.",
    badge: "Pediatric",
    navigatorFree: true,
    scanCoachFree: false,
  },
  // ── VASCULAR — all 6, Carotid first, immediately before MSK ──────────────
  {
    path: "/carotid-navigator",
    scanCoachPath: "/carotid-scan-coach",
    icon: Activity,
    title: "Vascular — Extracranial Carotid Artery",
    description: "CCA, ICA, ECA, and vertebral artery — extracranial carotid duplex ultrasound with SRU consensus stenosis grading per AIUM guidelines.",
    badge: "Carotid",
    navigatorFree: true,
    scanCoachFree: false,
  },
  {
    path: "/venous-navigator",
    scanCoachPath: "/venous-scan-coach",
    icon: TrendingUp,
    title: "Vascular — Venous (Upper & Lower)",
    description: "DVT evaluation of upper and lower extremity veins — compression technique, color Doppler, and spectral waveform analysis per AIUM/SVU guidelines.",
    badge: "Venous",
    navigatorFree: false,
    scanCoachFree: false,
  },
  {
    path: "/arterial-navigator",
    scanCoachPath: "/arterial-scan-coach",
    icon: TrendingUp,
    title: "Vascular — Arterial (Upper & Lower)",
    description: "Peripheral arterial disease evaluation — ABI, segmental pressures, and duplex imaging of upper and lower extremity arteries per AIUM guidelines.",
    badge: "Arterial",
    navigatorFree: false,
    scanCoachFree: false,
  },
  {
    path: "/abdominal-vascular-navigator",
    scanCoachPath: "/abdominal-vascular-scan-coach",
    icon: Activity,
    title: "Vascular — Abdominal/Renal/Mesenteric",
    description: "Renal arteries, mesenteric arteries, celiac axis, and portal venous system — abdominal vascular duplex ultrasound per AIUM guidelines.",
    badge: "Abdominal Vascular",
    navigatorFree: false,
    scanCoachFree: false,
  },
  {
    path: "/aorta-navigator",
    scanCoachPath: "/aorta-scan-coach",
    icon: Activity,
    title: "Vascular — Abdominal Aorta/EndoLeak",
    description: "Abdominal aortic aneurysm measurement, surveillance, and post-EVAR endoleak detection — aorta ultrasound protocol per AIUM 2025 guidelines.",
    badge: "Aorta/EndoLeak",
    navigatorFree: false,
    scanCoachFree: false,
  },
  {
    path: "/tcd-navigator",
    scanCoachPath: "/tcd-scan-coach",
    icon: Brain,
    title: "Vascular — Intracranial Duplex/TCD",
    description: "Transcranial Doppler and duplex — MCA, ACA, PCA, basilar, and vertebral arteries via temporal, orbital, and suboccipital windows per AIUM guidelines.",
    badge: "TCD",
    navigatorFree: false,
    scanCoachFree: false,
  },
  // ── MSK (always second-to-last) ───────────────────────────────────────────
  {
    path: "/msk-navigator",
    scanCoachPath: "/msk-scan-coach",
    icon: Bone,
    title: "MSK Ultrasound",
    description: "Shoulder, elbow, wrist/hand, hip, knee, and ankle/foot — musculoskeletal ultrasound protocol with dynamic assessment per AIUM 2023 guidelines.",
    badge: "MSK",
    navigatorFree: false,
    scanCoachFree: false,
  },
  // ── POCUS (always last) ───────────────────────────────────────────────────
  {
    path: "/pocus-assist",
    scanCoachPath: "/pocus-assist",
    icon: Zap,
    title: "POCUS — Lung, eFAST, RUSH",
    description: "Point-of-care ultrasound protocols — Lung B-lines, eFAST trauma survey, and RUSH hemodynamic assessment with view-by-view checklists and ScanCoach.",
    badge: "POCUS",
    navigatorFree: true,
    scanCoachFree: false,
  },
];

export default function UltrasoundAssistHub() {
  const { isPremium } = usePremium();
  const [upgradeModal, setUpgradeModal] = useState<{ title: string; type: "navigator" | "scancoach" } | null>(null);

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
                  <span className="text-sm text-white/80 font-medium">{specialties.length} Specialties · Protocol + ScanCoach</span>
                </div>
              </div>
              <h1
                className="text-2xl md:text-3xl font-black text-white leading-tight"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                UltrasoundAssist™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-base mt-0.5">Ultrasound Protocol Navigator &amp; ScanCoach</p>
              <p className="text-white/70 text-sm md:text-base mt-2 max-w-xl leading-relaxed">
                Advanced, guideline-driven clinical intelligence app designed for sonographers, physicians, and ultrasound learners across general, vascular, and point-of-care imaging — serving as the ultimate pocket reference for real-time scanning and clinical decision support.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Specialty Grid */}
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {specialties.map((spec, i) => {
            const Icon = spec.icon;
            const navLocked = !spec.navigatorFree && !isPremium;
            const coachLocked = !spec.scanCoachFree && !isPremium;
            const fullyLocked = navLocked && coachLocked;
            const isFullyFree = spec.navigatorFree && spec.scanCoachFree;

            return (
              <div
                key={i}
                className={`relative bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                  fullyLocked
                    ? "border-gray-100 hover:shadow-md cursor-pointer"
                    : "border-gray-100 hover:shadow-md hover:border-[#189aa1]/30"
                }`}
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                onClick={fullyLocked ? () => setUpgradeModal({ title: spec.title, type: "navigator" }) : undefined}
              >
                {/* FREE corner badge — only on fully-free cards */}
                {isFullyFree && (
                  <div className="absolute top-0 right-0">
                    <div
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white rounded-bl-xl"
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                    >
                      <span>✓</span>
                      FREE
                    </div>
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Icon — always teal, no conditional color */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
                    >
                      <Icon className="w-5 h-5 text-[#4ad9e0]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Badge — always teal, no conditional color */}
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: "#189aa1" }}
                        >
                          {spec.badge}
                        </span>
                      </div>
                      <h3
                        className="font-bold text-sm mt-1 leading-tight text-gray-800"
                        style={{ fontFamily: "Merriweather, serif" }}
                      >
                        {spec.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed mb-4 text-gray-500">
                    {spec.description}
                  </p>

                  {fullyLocked ? (
                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-400">
                      <Lock className="w-3 h-3" /> Premium Access Required
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {/* Navigator button */}
                      {navLocked ? (
                        <button
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border border-gray-200 bg-gray-50 text-gray-400 transition-all hover:bg-gray-100"
                          onClick={(e) => { e.stopPropagation(); setUpgradeModal({ title: spec.title, type: "navigator" }); }}
                        >
                          <Lock className="w-3 h-3" />
                          Navigator
                        </button>
                      ) : (
                        <Link href={spec.path}>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white transition-all hover:opacity-90"
                            style={{ background: "#189aa1" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <BookOpen className="w-3 h-3" />
                            Navigator
                          </button>
                        </Link>
                      )}

                      {/* Calculators button — only for specialties with calculatorPath */}
                      {(spec as any).calculatorPath && (
                        <Link href={(spec as any).calculatorPath}>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border bg-white transition-all hover:bg-[#f0fbfc]"
                            style={{ borderColor: "#189aa150", color: "#189aa1" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Calculator className="w-3 h-3" />
                            Calculators
                          </button>
                        </Link>
                      )}

                      {/* ScanCoach button — Crown icon when locked */}
                      {coachLocked ? (
                        <button
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border border-gray-200 bg-gray-50 text-gray-400 transition-all hover:bg-gray-100"
                          onClick={(e) => { e.stopPropagation(); setUpgradeModal({ title: spec.title, type: "scancoach" }); }}
                        >
                          <Crown className="w-3 h-3" />
                          ScanCoach™
                        </button>
                      ) : (
                        <Link href={spec.scanCoachPath}>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border bg-white transition-all hover:bg-[#f0fbfc]"
                            style={{ borderColor: "#189aa150", color: "#189aa1" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Scan className="w-3 h-3" />
                            ScanCoach™
                          </button>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* iHeartEcho EchoAssist CTA — brand teal/navy */}
      <div className="container pb-10">
        <div
          className="relative overflow-hidden rounded-2xl p-6 md:p-8 border border-[#189aa1]/20"
          style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0a3040 50%, #0e4a50 100%)" }}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(24,154,161,0.2)", border: "1px solid rgba(74,217,224,0.3)" }}
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21C12 21 3 15 3 9C3 6.23858 5.23858 4 8 4C9.65685 4 11.1217 4.7835 12 6C12.8783 4.7835 14.3431 4 16 4C18.7614 4 21 6.23858 21 9C21 15 12 21 12 21Z" fill="#4ad9e0" stroke="#4ad9e0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(74,217,224,0.15)", border: "1px solid rgba(74,217,224,0.35)", color: "#4ad9e0" }}
                >
                  Echo-Focused
                </span>
              </div>
              <h3
                className="text-lg md:text-xl font-black text-white leading-tight"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                Looking for Echo-Focused ScanCoach™?
              </h3>
              <p className="text-white/60 text-sm mt-1.5 max-w-lg">
                iHeartEcho EchoAssist™ provides dedicated echocardiography ScanCoach™ guidance — cardiac views, measurements, and clinical decision support for echo-focused practitioners.
              </p>
            </div>
            <a
              href="https://app.iheartecho.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
                style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 21C12 21 3 15 3 9C3 6.23858 5.23858 4 8 4C9.65685 4 11.1217 4.7835 12 6C12.8783 4.7835 14.3431 4 16 4C18.7614 4 21 6.23858 21 9C21 15 12 21 12 21Z" fill="white" stroke="white" strokeWidth="1.5"/>
                </svg>
                Try EchoAssist™
              </button>
            </a>
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
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
              >
                <Crown className="w-8 h-8 text-[#4ad9e0]" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>Premium Feature</h3>
              <p className="text-sm text-gray-500 mt-1">
                <strong>{upgradeModal.title}</strong>{" "}
                {upgradeModal.type === "scancoach" ? "ScanCoach™" : "Navigator"} requires a Premium membership.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/premium" onClick={() => setUpgradeModal(null)}>
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white"
                  style={{ background: "#189aa1" }}
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
