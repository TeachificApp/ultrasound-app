/*
  UltrasoundAssist™ — Ultrasound Protocol Navigator & ScanCoach Hub
  Exact pattern from EchoAssistHub — AAUS teal/aqua brand colors
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import {
  Activity, Baby, Scan, TrendingUp, BookOpen, Crown,
  Stethoscope, Brain, Bone, Circle, Zap, Microscope
} from "lucide-react";
import { usePremium } from "@/hooks/usePremium";

const specialties = [
  // ── FREE ──────────────────────────────────────────────────────────────────
  {
    path: "/abdominal-navigator",
    scanCoachPath: "/abdominal-scan-coach",
    icon: Activity,
    title: "Abdominal Ultrasound",
    description: "Liver, gallbladder, bile ducts, pancreas, spleen, kidneys, aorta, and IVC — complete abdominal protocol with view-by-view checklist and AIUM-based reference values.",
    badge: "Abdominal",
    free: true,
  },
  {
    path: "/pelvic-gyn-navigator",
    scanCoachPath: "/pelvic-gyn-scan-coach",
    icon: Circle,
    title: "Pelvic/Gyn Ultrasound",
    description: "Uterus, endometrium, ovaries, adnexa, and cul-de-sac — transabdominal and transvaginal pelvic ultrasound protocol per AIUM guidelines.",
    badge: "Pelvic/Gyn",
    free: true,
  },
  {
    path: "/ob1-navigator",
    scanCoachPath: "/ob1-scan-coach",
    icon: Baby,
    title: "Obstetric 1st Trimester",
    description: "Gestational sac, yolk sac, embryo/fetus, CRL, NT measurement, and early anatomy — first trimester obstetric ultrasound per AIUM guidelines.",
    badge: "OB 1st Tri",
    free: true,
  },
  {
    path: "/venous-navigator",
    scanCoachPath: "/venous-scan-coach",
    icon: TrendingUp,
    title: "Vascular — Venous (Upper & Lower)",
    description: "DVT evaluation of upper and lower extremity veins — compression technique, color Doppler, and spectral waveform analysis per AIUM/SVU guidelines.",
    badge: "Venous",
    free: true,
  },
  {
    path: "/thyroid-navigator",
    scanCoachPath: "/thyroid-scan-coach",
    icon: Microscope,
    title: "Small Parts — Thyroid",
    description: "Thyroid lobes, isthmus, nodule characterization (ACR TIRADS), and cervical lymph nodes — thyroid ultrasound protocol per AIUM guidelines.",
    badge: "Thyroid",
    free: true,
  },
  {
    path: "/pocus-assist-hub",
    scanCoachPath: "/pocus-assist-hub",
    icon: Zap,
    title: "POCUS — Lung, eFAST, RUSH",
    description: "Point-of-care ultrasound protocols — Lung B-lines, eFAST trauma survey, and RUSH hemodynamic assessment with view-by-view checklists and ScanCoach.",
    badge: "POCUS",
    free: true,
  },
  // ── PREMIUM ───────────────────────────────────────────────────────────────
  {
    path: "/ob23-navigator",
    scanCoachPath: "/ob23-scan-coach",
    icon: Baby,
    title: "Obstetric 2nd/3rd Trimester",
    description: "Fetal biometry, anatomy survey, placenta, amniotic fluid, umbilical cord, and cervical length — second and third trimester obstetric ultrasound per AIUM guidelines.",
    badge: "OB 2nd/3rd Tri",
    free: false,
  },
  {
    path: "/scrotum-navigator",
    scanCoachPath: "/scrotum-scan-coach",
    icon: Scan,
    title: "Small Parts — Scrotum",
    description: "Testes, epididymis, vas deferens, and scrotal wall — scrotal ultrasound protocol with Doppler assessment per AIUM guidelines.",
    badge: "Scrotum",
    free: false,
  },
  {
    path: "/breast-navigator",
    scanCoachPath: "/breast-scan-coach",
    icon: Scan,
    title: "Breast Ultrasound",
    description: "Breast lesion characterization (ACR BI-RADS), whole-breast screening, and axillary lymph node assessment — breast ultrasound protocol per AIUM guidelines.",
    badge: "Breast",
    free: false,
  },
  {
    path: "/arterial-navigator",
    scanCoachPath: "/arterial-scan-coach",
    icon: TrendingUp,
    title: "Vascular — Arterial (Upper & Lower)",
    description: "Peripheral arterial disease evaluation — ABI, segmental pressures, and duplex imaging of upper and lower extremity arteries per AIUM guidelines.",
    badge: "Arterial",
    free: false,
  },
  {
    path: "/abdominal-vascular-navigator",
    scanCoachPath: "/abdominal-vascular-scan-coach",
    icon: Activity,
    title: "Vascular — Abdominal/Renal/Mesenteric",
    description: "Renal arteries, mesenteric arteries, celiac axis, and portal venous system — abdominal vascular duplex ultrasound per AIUM guidelines.",
    badge: "Abdominal Vascular",
    free: false,
  },
  {
    path: "/aorta-navigator",
    scanCoachPath: "/aorta-scan-coach",
    icon: Activity,
    title: "Vascular — Abdominal Aorta/EndoLeak",
    description: "Abdominal aortic aneurysm measurement, surveillance, and post-EVAR endoleak detection — aorta ultrasound protocol per AIUM 2025 guidelines.",
    badge: "Aorta/EndoLeak",
    free: false,
  },
  {
    path: "/carotid-navigator",
    scanCoachPath: "/carotid-scan-coach",
    icon: Activity,
    title: "Vascular — Extracranial Carotid Artery",
    description: "CCA, ICA, ECA, and vertebral artery — extracranial carotid duplex ultrasound with SRU consensus stenosis grading per AIUM guidelines.",
    badge: "Carotid",
    free: false,
  },
  {
    path: "/tcd-navigator",
    scanCoachPath: "/tcd-scan-coach",
    icon: Brain,
    title: "Vascular — Intracranial Duplex/TCD",
    description: "Transcranial Doppler and duplex — MCA, ACA, PCA, basilar, and vertebral arteries via temporal, orbital, and suboccipital windows per AIUM guidelines.",
    badge: "TCD",
    free: false,
  },
  {
    path: "/msk-navigator",
    scanCoachPath: "/msk-scan-coach",
    icon: Bone,
    title: "MSK Ultrasound",
    description: "Shoulder, elbow, wrist/hand, hip, knee, and ankle/foot — musculoskeletal ultrasound protocol with dynamic assessment per AIUM 2023 guidelines.",
    badge: "MSK",
    free: false,
  },
  {
    path: "/fetal-navigator",
    scanCoachPath: "/fetal-echo-assist",
    icon: Baby,
    title: "Fetal Echo",
    description: "Fetal cardiac anatomy, segmental analysis, 4-chamber view, outflow tracts, 3VV, 3VT, and fetal arrhythmia — fetal echocardiography per ASE guidelines.",
    badge: "Fetal Echo",
    free: false,
  },
];

export default function UltrasoundAssistHub() {
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
                  <span className="text-sm text-white/80 font-medium">16 Specialties · Protocol + ScanCoach</span>
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
                UltrasoundAssist™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-base mt-0.5">Ultrasound Protocol Navigator &amp; ScanCoach</p>
              <p className="text-white/70 text-sm md:text-base mt-2 max-w-xl leading-relaxed">
                Structured ultrasound protocols with view-by-view checklists, normal reference values, scanning tips, probe guidance, and guideline-based interpretation — for every modality and patient population.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Specialty Grid */}
      <div className="container py-8">
        {/* Free section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="text-base font-bold text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>
              Free — Available to All Members
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specialties.filter(s => s.free).map((spec, i) => {
              const Icon = spec.icon;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
                      >
                        <Icon className="w-5 h-5 text-[#4ad9e0]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#189aa1" }}>
                            {spec.badge}
                          </span>
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Free</span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm mt-1 leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                          {spec.title}
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">{spec.description}</p>
                    <div className="flex gap-2">
                      <Link href={spec.path}>
                        <button
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white transition-all hover:opacity-90"
                          style={{ background: "#189aa1" }}
                        >
                          <BookOpen className="w-3 h-3" />
                          Navigator
                        </button>
                      </Link>
                      <Link href={spec.scanCoachPath}>
                        <button
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border bg-white transition-all hover:bg-[#f0fbfc]"
                          style={{ borderColor: "#189aa1" + "50", color: "#189aa1" }}
                        >
                          <Scan className="w-3 h-3" />
                          ScanCoach™
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Premium section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-bold text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>
              Premium — Upgrade for Full Access
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specialties.filter(s => !s.free).map((spec, i) => {
              const Icon = spec.icon;
              const locked = !isPremium;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: locked ? "#f3f4f6" : "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
                      >
                        <Icon className={`w-5 h-5 ${locked ? "text-gray-400" : "text-[#4ad9e0]"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ background: locked ? "#9ca3af" : "#189aa1" }}
                          >
                            {spec.badge}
                          </span>
                          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5" /> Premium
                          </span>
                        </div>
                        <h3
                          className={`font-bold text-sm mt-1 leading-tight ${locked ? "text-gray-400" : "text-gray-900"}`}
                          style={{ fontFamily: "Merriweather, serif" }}
                        >
                          {spec.title}
                        </h3>
                      </div>
                    </div>
                    <p className={`text-xs leading-relaxed mb-4 ${locked ? "text-gray-400" : "text-gray-500"}`}>
                      {spec.description}
                    </p>
                    {locked ? (
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white transition-all hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                        onClick={() => setUpgradeModal({ title: spec.title })}
                      >
                        <Crown className="w-3 h-3" />
                        Unlock with Premium
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <Link href={spec.path}>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white transition-all hover:opacity-90"
                            style={{ background: "#189aa1" }}
                          >
                            <BookOpen className="w-3 h-3" />
                            Navigator
                          </button>
                        </Link>
                        <Link href={spec.scanCoachPath}>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border bg-white transition-all hover:bg-[#f0fbfc]"
                            style={{ borderColor: "#189aa1" + "50", color: "#189aa1" }}
                          >
                            <Scan className="w-3 h-3" />
                            ScanCoach™
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
