/*
  POCUSAssistHub.tsx — POCUS-Assist™ Hub
  Exact layout mirror of EchoAssistHub.tsx.
  Modules: eFAST (free), Cardiac POCUS (free), RUSH (premium), Lung POCUS (premium)
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { usePremium } from "@/hooks/usePremium";
import {
  Shield, Zap, Heart, Wind,
  ArrowRight, Crown, Lock, Stethoscope,
} from "lucide-react";

const BRAND = "#189aa1";

type Specialty = {
  path: string;
  scanCoachPath: string;
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
  free: boolean;
};

const specialties: Specialty[] = [
  // ── Free ──────────────────────────────────────────────────────────────────
  {
    path: "/pocus-efast",
    scanCoachPath: "/pocus-efast-scan-coach",
    icon: Shield,
    title: "eFAST",
    description: "Extended Focused Assessment with Sonography for Trauma — RUQ, LUQ, pelvic, subxiphoid, and bilateral thorax windows with free-fluid grading, pneumothorax detection, and hemopericardium assessment.",
    badge: "Trauma",
    free: true,
  },
  {
    path: "/pocus-cardiac",
    scanCoachPath: "/pocus-cardiac-scan-coach",
    icon: Heart,
    title: "Cardiac POCUS",
    description: "FoCUS protocol — PLAX, PSAX, A4C, subcostal, and IVC views with LV/RV function, pericardial effusion, and volume status assessment at the bedside.",
    badge: "Cardiac",
    free: true,
  },
  // ── Premium ───────────────────────────────────────────────────────────────
  {
    path: "/pocus-rush",
    scanCoachPath: "/pocus-rush-scan-coach",
    icon: Zap,
    title: "RUSH Protocol",
    description: "Rapid Ultrasound for Shock and Hypotension — 4-step pump/tank/pipes/pneumothorax assessment with shock-type differentiation (obstructive, distributive, cardiogenic, hypovolemic).",
    badge: "Shock",
    free: false,
  },
  {
    path: "/pocus-lung",
    scanCoachPath: "/pocus-lung-scan-coach",
    icon: Wind,
    title: "Lung POCUS",
    description: "8-zone lung protocol — A-lines, B-lines, pleural sliding, consolidation patterns, BLUE protocol for acute dyspnea, and lung point detection for pneumothorax.",
    badge: "Pulmonary",
    free: false,
  },
];

const badgeColors: Record<string, string> = {
  Trauma: "#0369a1",
  Cardiac: "#189aa1",
  Shock: "#b45309",
  Pulmonary: "#0e7490",
};

export default function POCUSAssistHub() {
  const { isPremium } = usePremium();
  const [upgradeModal, setUpgradeModal] = useState<{ title: string } | null>(null);
  const freeCount = specialties.filter(s => s.free).length;
  const premiumCount = specialties.filter(s => !s.free).length;

  return (
    <Layout>
      {/* Header — identical gradient to EchoAssistHub */}
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
              <Shield className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                  <span className="text-sm text-white/80 font-medium">4 Modules · Navigator + ScanCoach</span>
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
                POCUS-Assist™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-base mt-0.5">Point-of-Care Ultrasound Navigator &amp; ScanCoach</p>
              <p className="text-white/70 text-sm md:text-base mt-2 max-w-xl leading-relaxed">
                Structured POCUS protocols with window-by-window checklists, normal reference values, scanning tips, probe guidance, and clinical decision support — for eFAST, Cardiac, RUSH, and Lung ultrasound.
              </p>
              {/* CTA buttons */}
              <div className="flex flex-wrap gap-3 mt-5">
                <Link href="/echoassist#engine-pocus">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-105"
                    style={{ background: "#189aa1" }}
                  >
                    <Stethoscope className="w-4 h-4" />
                    Open POCUS-Assist™ Calculator
                  </button>
                </Link>
                <Link href="/echoassist#engine-frank-starling">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Frank-Starling Engine
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module Grid */}
      <div className="container py-8">
        {/* Free section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="text-base font-bold text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>
              Free — Available to All Members
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {specialties.filter(s => s.free).map(({ path, scanCoachPath, icon: Icon, title, description, badge }) => {
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Free
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: badgeColor + "15", color: badgeColor }}
                      >
                        {badge}
                      </span>
                    </div>
                  </div>
                  <h3
                    className="font-bold text-gray-800 mb-1.5 text-base leading-snug"
                    style={{ fontFamily: "Merriweather, serif" }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4 flex-1">{description}</p>
                  <div className="flex items-center gap-2 mt-auto">
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
              Premium — Available with Paid Membership
            </h2>
          </div>
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
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full self-start mb-2"
                    style={{ background: badgeColor + "15", color: badgeColor }}
                  >
                    {badge}
                  </span>
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
                      <button
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                        onClick={() => setUpgradeModal({ title })}
                      >
                        <Crown className="w-3.5 h-3.5" /> Upgrade to Unlock
                      </button>
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
                  Unlock RUSH Protocol &amp; Lung POCUS
                </h3>
                <p className="text-white/60 text-sm">
                  Full RUSH shock assessment, 8-zone lung protocol, BLUE protocol, and all future premium POCUS content.
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

        {/* ── EchoAssist™ Cross-Promotion ──────────────────────────────── */}
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
                <Stethoscope className="w-7 h-7 text-[#4ad9e0]" />
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
                EchoAssist™
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                Structured echo protocols with view-by-view checklists, normal reference values, scanning tips, and guideline-based interpretation for 11 specialties — Adult TTE, Pediatric, Fetal, Strain, Diastology, UEA, Stress Echo, HOCM, Pulmonary HTN &amp; PE, Structural Heart, TEE, and ICE.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/echoassist-hub">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                    style={{ background: "#189aa1" }}
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    Open EchoAssist™ Hub
                  </button>
                </Link>
                <Link href="/echoassist">
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm border bg-white transition-all hover:bg-[#189aa1]/5"
                    style={{ borderColor: "#189aa1" + "50", color: "#189aa1" }}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Open EchoAssist™ Engine
                  </button>
                </Link>
              </div>
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
