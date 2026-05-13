/*
  Navigator Hub — iHeartEcho™
  FREE navigators shown first, PREMIUM navigators in a separate section at the bottom.
*/
import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import PremiumModal from "@/components/PremiumModal";
import { usePremium } from "@/hooks/usePremium";
import {
  Stethoscope, Microscope, Zap, Users, Baby, Heart,
  Cpu, FlaskConical, BarChart3, ArrowRight, Scan, Lock, Droplets, Activity, Wind, Crown, CircuitBoard
} from "lucide-react";

const BRAND = "#189aa1";

const freeNavigators = [
  {
    path: "/tte",
    icon: Stethoscope,
    title: "Adult TTE Navigator",
    description: "View-by-view checklist, critical item tracking, normal reference values, and ASE 2025 guidelines.",
    badge: "Adult Echo",
  },
  {
    path: "/pediatric",
    icon: Users,
    title: "Pediatric Navigator",
    description: "CHD findings, BSA Z-score calculators, Qp/Qs shunt estimation, segmental analysis, and neonatal hemodynamics.",
    badge: "Congenital Heart",
  },
  {
    path: "/fetal",
    icon: Baby,
    title: "Fetal Navigator",
    description: "Fetal cardiac findings, CHD differentials, biometry Z-scores, situs, arch patterns, and scan coach.",
    badge: "Congenital Heart",
  },
];

const premiumNavigators = [
  {
    path: "/achd",
    icon: Heart,
    title: "Adult Congenital Navigator",
    description: "ACHD lesion-specific protocols for ASD, VSD, ToF, CoA, TGA, and Fontan with ASE/AHA thresholds.",
    badge: "Congenital Heart",
  },
  {
    path: "/strain",
    icon: BarChart3,
    title: "Strain Navigator",
    description: "Protocol checklist, scanning tips, basic pathology overview, and LV/RV/LA strain reference values.",
    badge: "Adult Echo",
  },
  {
    path: "/uea-navigator",
    icon: Droplets,
    title: "UEA Navigator",
    description: "Contrast echo protocol: safety screening, agent preparation, view-by-view LVO and myocardial perfusion assessment, and reporting guidance.",
    badge: "Contrast Echo",
  },
  {
    path: "/stress",
    icon: Zap,
    title: "Stress Echo Navigator",
    description: "Exercise and DSE protocols, 17-segment WMSI scorer, target HR calculator, and interpretation criteria.",
    badge: "Stress Echo",
  },
  {
    path: "/pulm-htn",
    icon: Wind,
    title: "Pulmonary HTN & PE Navigator",
    description: "Comprehensive right heart and pulmonary pressure assessment: TRV-based PH probability, RVSP estimation, RV function, PA dilation, PE echo signs (McConnell's, 60/60, D-sign), risk stratification, and ASE 2025 reporting thresholds.",
    badge: "Pulmonary",
  },
  {
    path: "/hocm-navigator",
    icon: Activity,    title: "HOCM-Assist™ Navigator",
    description: "Comprehensive HOCM-Assist™ protocol: morphology assessment, SAM grading, resting and provoked LVOT gradients, goal-directed Valsalva, MR evaluation, and ASE/AHA reporting thresholds.",
    badge: "Cardiomyopathy",
  },
  {
    path: "/tee",
    icon: Microscope,
    title: "TEE Navigator",
    description: "ME, TG, and UE views with angle/depth guidance, clinical applications, and intraoperative checklist.",
    badge: "Structural Heart",
  },
  {
    path: "/ice",
    icon: Cpu,
    title: "ICE Navigator",
    description: "Intracardiac echo views, procedural checklists, and key measurements for structural interventions.",
    badge: "Structural Heart",
  },
  {
    path: "/device",
    icon: FlaskConical,
    title: "Structural Heart Navigator",
    description: "TAVR, MitraClip, WATCHMAN, and ASD/PFO closure — procedural echo guidance and post-implant assessment.",
    badge: "Structural Heart",
  },
  {
    path: "/mechanical-support-navigator",
    icon: CircuitBoard,
    title: "MechanicalSupportAssist™ Navigator",
    description: "Echo assessment for LVAD, ECMO, Impella (all versions), LifeVest, and ICD/CRT-D — pre-implant, positioning, post-implant, and weaning protocols.",
    badge: "MCS",
  },
];

const badgeColors: Record<string, string> = {
  "Adult Echo": "#189aa1",
  "Structural Heart": "#0e7490",
  "Stress Echo": "#0f766e",
  "Congenital Heart": "#0369a1",
  "Contrast Echo": "#0e7490",
  "Cardiomyopathy": "#b45309",
  "Pulmonary": "#0e7490",
  "MCS": "#7c3aed",
};

function FreeNavCard({ path, icon: Icon, title, description, badge }: typeof freeNavigators[0]) {
  const badgeColor = badgeColors[badge] ?? BRAND;
  return (
    <Link href={path}>
      <div
        className="relative bg-white rounded-xl border border-gray-100 p-5 cursor-pointer group h-full hover:shadow-md transition-all hover:border-[#189aa1]/30"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
            <Icon className="w-5 h-5" style={{ color: BRAND }} />
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: badgeColor + "15", color: badgeColor }}>
            {badge}
          </span>
        </div>
        <h3 className="font-bold text-gray-800 mb-1.5 text-sm leading-snug" style={{ fontFamily: "Merriweather, serif" }}>{title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-3">{description}</p>
        <div className="flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all" style={{ color: BRAND }}>
          Open Protocol <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

function PremiumNavCard({
  path, icon: Icon, title, description, badge, isPremium, onLock,
}: typeof premiumNavigators[0] & { isPremium: boolean; onLock: () => void }) {
  const badgeColor = badgeColors[badge] ?? BRAND;
  if (isPremium) {
    return (
      <Link href={path}>
        <div
          className="relative bg-white rounded-xl border border-amber-100 p-5 cursor-pointer group h-full hover:shadow-md transition-all hover:border-amber-300/50"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        >
          {/* Crown badge */}
          <div className="absolute top-0 right-0 overflow-hidden rounded-tr-xl rounded-bl-xl">
            <div className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              <Crown className="w-2.5 h-2.5" />
              PREMIUM
            </div>
          </div>
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
              <Icon className="w-5 h-5" style={{ color: BRAND }} />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: badgeColor + "15", color: badgeColor }}>
              {badge}
            </span>
          </div>
          <h3 className="font-bold text-gray-800 mb-1.5 text-sm leading-snug" style={{ fontFamily: "Merriweather, serif" }}>{title}</h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-3">{description}</p>
          <div className="flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all" style={{ color: BRAND }}>
            Open Protocol <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </Link>
    );
  }
  return (
    <div className="cursor-pointer" onClick={onLock}>
      <div
        className="relative bg-white rounded-xl border border-amber-100 p-5 group h-full hover:shadow-md transition-all hover:border-amber-300/50"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        {/* Crown badge */}
        <div className="absolute top-0 right-0 overflow-hidden rounded-tr-xl rounded-bl-xl">
          <div className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            <Crown className="w-2.5 h-2.5" />
            PREMIUM
          </div>
        </div>
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#f59e0b15" }}>
            <Icon className="w-5 h-5 text-amber-500" />
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: badgeColor + "15", color: badgeColor }}>
            {badge}
          </span>
        </div>
        <h3 className="font-bold text-gray-800 mb-1.5 text-sm leading-snug" style={{ fontFamily: "Merriweather, serif" }}>{title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-3">{description}</p>
        <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
          <Lock className="w-3 h-3" /> Upgrade to Access
        </div>
      </div>
    </div>
  );
}

export default function EchoNavigatorHub() {
  const { isPremium } = usePremium();
  const [premiumModal, setPremiumModal] = useState<{ name: string; description: string } | null>(null);
  return (
    <Layout>
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-10">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <Stethoscope className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-xs text-white/80 font-medium">12 Protocols Available</span>
              </div>
              <h1
                className="text-2xl font-black text-white leading-tight"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                Navigator
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-xl">
                Structured echo protocols with view-by-view checklists, normal reference values, scanning tips, and guideline-based interpretation — for every modality and patient population.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/scan-coach">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <Scan className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    ScanCoach
                    <span className="text-[#4ad9e0] text-xs">→</span>
                  </button>
                </Link>
                <Link href="/echo-assist-hub">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all">
                    <Zap className="w-3.5 h-3.5 text-[#4ad9e0]" />
                    EchoAssist™
                    <span className="text-[#4ad9e0] text-xs">→</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-10">
        {/* FREE Navigators */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-[#189aa1] bg-[#189aa1]/10 border border-[#189aa1]/20">
              <div className="w-2 h-2 rounded-full bg-[#189aa1]" />
              FREE — Included with all memberships
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {freeNavigators.map((nav) => (
              <FreeNavCard key={nav.path} {...nav} />
            ))}
          </div>
        </div>

        {/* PREMIUM Navigators */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
              <Crown className="w-3 h-3 text-amber-500" />
              PREMIUM — Requires Premium membership ($9.97/month)
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {premiumNavigators.map((nav) => (
              <PremiumNavCard
                key={nav.path}
                {...nav}
                isPremium={isPremium}
                onLock={() => setPremiumModal({ name: nav.title, description: nav.description })}
              />
            ))}
          </div>
          {!isPremium && (
            <div className="mt-4 text-center">
              <Link href="/premium">
                <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                  <Crown className="w-4 h-4" />
                  Upgrade to Premium — $9.97/month
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {premiumModal && (
        <PremiumModal
          featureName={premiumModal.name}
          featureDescription={premiumModal.description}
          onClose={() => setPremiumModal(null)}
        />
      )}
    </Layout>
  );
}
