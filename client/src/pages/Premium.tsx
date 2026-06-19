/**
 * Premium Access page — brand-aware for AAUS (general ultrasound) and iHeartEcho (echo/cardiac).
 * Founding Member positioning: monthly $9.97, lifetime $99.97 (single) / $147 (dual).
 * Annual plans are HIDDEN — set showAnnual: true in brandMembershipRouter to re-enable.
 */
import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Crown, Check, Sparkles, ArrowRight, RefreshCw,
  Stethoscope, BookOpen, Zap, Activity, FileText,
  Star, Shield, Clock, Layers, Infinity, Heart, Waves,
  Lock, Timer, TrendingUp, Users, Award, Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { detectBrand } from "@/hooks/useBrand";
import { toast } from "sonner";

// ─── Countdown timer hook ─────────────────────────────────────────────────────
// Counts down to a fixed "offer end" date — 14 days from a hard-coded epoch.
// Update OFFER_END_DATE to change when the urgency timer expires.
const OFFER_END_DATE = new Date("2025-12-31T23:59:59Z");

function useCountdown(target: Date) {
  const calc = useCallback(() => {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { days, hours, minutes, seconds, expired: false };
  }, [target]);

  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);
  return time;
}

// ─── Brand-specific content ───────────────────────────────────────────────────

const VALUE_PILLARS = [
  { icon: Stethoscope, title: "Clinical Confidence", description: "Guideline-based protocols and decision support so you can scan and interpret with certainty." },
  { icon: BookOpen,    title: "Registry Prep",        description: "Targeted case libraries, flashcards, and daily challenges built around registry-level competency." },
  { icon: Zap,         title: "Everyday Workflow",    description: "Real-time calculators, report builders, and ScanCoach guidance that fit seamlessly into your day." },
  { icon: TrendingUp,  title: "Guideline-Based",      description: "Every tool, navigator, and reference is grounded in the latest ASE, IAC, and specialty society guidelines." },
  { icon: Award,       title: "Real-World Scanning",  description: "Practical, protocol-driven assistance for the cases you actually see — not just textbook scenarios." },
  { icon: Users,       title: "Community Access",     description: "Connect with fellow sonographers and echo professionals in the All About Ultrasound community hub." },
];

const AAUS_PREMIUM_FEATURES = [
  { icon: Waves,       title: "Abdominal & Vascular Navigators",   description: "Aorta, IVC, renal, hepatic, portal, and mesenteric vessel protocols with ScanCoach guidance." },
  { icon: Activity,    title: "OB/GYN Advanced Modules",           description: "2nd/3rd trimester ScanCoach, fetal echo ScanCoach, and pelvic/GYN advanced scanning protocols." },
  { icon: Stethoscope, title: "MSK & Small Parts Navigators",      description: "Thyroid, breast, scrotum, appendix, and invasive procedure ScanCoaches with premium scan guidance." },
  { icon: Activity,    title: "POCUS RUSH & Lung POCUS Modules",   description: "RUSH protocol navigator and ScanCoach, Lung POCUS 8-zone protocol, B-lines, BLUE protocol, and pleural assessment." },
  { icon: Zap,         title: "UltrasoundAssist™ Premium Engines", description: "Advanced vascular resistance, hemodynamic calculators, and specialty-specific clinical decision tools." },
  { icon: FileText,    title: "Report Builder",                    description: "Generate complete, structured ultrasound reports instantly from your measurements with guideline-compliant clinical narratives." },
  { icon: BookOpen,    title: "Unlimited Case Library",            description: "Full access to 500+ ultrasound cases with images, video, and critical thinking questions. Free members get 50 cases." },
  { icon: Layers,      title: "Unlimited Ultrasound Flashcards",   description: "Unlimited daily flashcard access with random rotation. Free members get 10 per day, resetting at midnight." },
  { icon: Activity,    title: "Daily Challenge Archive",           description: "Full archive of past daily challenges. Free members get today's challenge only — premium unlocks the complete history." },
  { icon: Shield,      title: "Accreditation Navigator",          description: "IAC standards guide with search across all ultrasound modality accreditation requirements." },
];

const AAUS_FREE_FEATURES = [
  "Ultrasound Case Library — 50 cases",
  "Daily Challenge — today's challenge only",
  "Ultrasound Flashcards — 10 per day",
  "Abdominal Navigator (liver, gallbladder, pancreas, spleen, kidneys)",
  "OB 1st Trimester Navigator & ScanCoach",
  "Pelvic/GYN Navigator",
  "Thyroid, Breast, Scrotum Navigators",
  "Vascular Navigator (DVT, carotid, aorta)",
  "Cardiac POCUS, eFAST Navigator & ScanCoach",
  "UltrasoundAssist™ core clinical engines",
  "Community Hub access",
];

const AAUS_PREMIUM_ONLY_LABELS = [
  "Abdominal & Vascular ScanCoaches (premium scanning guidance)",
  "OB 2nd/3rd Trimester ScanCoach",
  "Fetal Echo ScanCoach",
  "Pelvic/GYN, Thyroid, Breast, Scrotum ScanCoaches",
  "MSK & Invasive Procedure ScanCoaches",
  "POCUS RUSH & Lung POCUS Modules",
  "UltrasoundAssist™ advanced clinical engines",
  "Report Builder",
  "Unlimited Case Library (500+ cases)",
  "Unlimited Ultrasound Flashcards (no daily limit)",
  "Daily Challenge Archive (full history)",
  "Accreditation Navigator",
];

const IHE_PREMIUM_FEATURES = [
  { icon: Heart,       title: "Stress Echo Navigator & ScanCoach",      description: "Exercise and DSE protocols, 17-segment WMSI scorer, StressEchoAssist™ engine, and interpretation criteria." },
  { icon: Stethoscope, title: "Pulmonary HTN & PE Navigator",            description: "Right heart and pulmonary pressure assessment, PH probability, RVSP, RV function, PE echo signs, and risk stratification." },
  { icon: Heart,       title: "HOCM Navigator & ScanCoach",             description: "HOCM morphology, SAM grading, resting and provoked LVOT gradients, Valsalva, MR evaluation, and HOCM LVOT Gradient calculator." },
  { icon: Stethoscope, title: "TEE Navigator & ScanCoach",              description: "ME, TG, and UE views with angle/depth guidance, clinical applications, and intraoperative checklist." },
  { icon: Heart,       title: "ICE Navigator & ScanCoach",              description: "Intracardiac echo views, procedural checklists, and key measurements for structural interventions." },
  { icon: Stethoscope, title: "Structural Heart Navigator & ScanCoach", description: "TAVR, MitraClip, WATCHMAN, and ASD/PFO closure — procedural echo guidance and post-implant assessment." },
  { icon: Activity,    title: "POCUS RUSH & Lung POCUS Modules",        description: "RUSH protocol navigator and ScanCoach, Lung POCUS 8-zone protocol, B-lines, BLUE protocol, and pleural assessment." },
  { icon: Zap,         title: "EchoAssist™ Premium Engines",            description: "LAP Grading, Diastology in Special Populations (MAC, transplant, AF, constriction), and StressEchoAssist™ WMSI." },
  { icon: FileText,    title: "Report Builder",                         description: "Generate complete, structured echo reports instantly from your measurements with 2025 ASE-compliant clinical narratives." },
  { icon: BookOpen,    title: "Unlimited Case Library",                 description: "Full access to 500+ echo cases with images, video, and critical thinking questions. Free members get 50 cases." },
  { icon: Layers,      title: "Unlimited Ultrasound Flashcards",        description: "Unlimited daily flashcard access with random rotation. Free members get 10 per day, resetting at midnight." },
  { icon: Activity,    title: "Daily Challenge Archive",                description: "Full archive of past daily challenges. Free members get today's challenge only — premium unlocks the complete history." },
  { icon: Shield,      title: "EchoAccreditation Navigator",           description: "IAC standards guide with search across TTE, TEE, Stress, Pediatric, Fetal, and HOCM accreditation requirements." },
];

const IHE_FREE_FEATURES = [
  "Echo Case Library — 50 cases",
  "Daily Challenge — today's challenge only",
  "Ultrasound Flashcards — 10 per day",
  "Adult TTE Navigator & ScanCoach",
  "Pediatric & Adult Congenital Navigators",
  "Fetal Echo Navigator",
  "OB 2nd/3rd Trimester Navigator",
  "Strain Navigator & ScanCoach",
  "UEA Navigator & ScanCoach",
  "Diastolic Function Navigator",
  "Cardiac POCUS, eFAST Navigator & ScanCoach",
  "EchoAssist™ core engines",
  "Community Hub access",
];

const IHE_PREMIUM_ONLY_LABELS = [
  "Stress Echo, Pulmonary HTN, HOCM, TEE, ICE & Structural Heart Navigators",
  "Stress Echo, HOCM, TEE, ICE & Structural Heart ScanCoaches",
  "POCUS RUSH & Lung POCUS Modules",
  "EchoAssist™ LAP Grading, Diastology Special Populations & StressEchoAssist™",
  "HOCM LVOT Gradient Calculator",
  "Report Builder",
  "Unlimited Case Library (500+ cases)",
  "Unlimited Ultrasound Flashcards (no daily limit)",
  "Daily Challenge Archive (full history)",
  "EchoAccreditation Navigator",
  "Fetal Echo ScanCoach",
  "OB 2nd/3rd Trimester ScanCoach",
];

// ─── Countdown display ────────────────────────────────────────────────────────
function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/15 border border-white/20 rounded-lg px-3 py-2 min-w-[52px] text-center">
        <span className="text-2xl font-black text-white tabular-nums">{String(value).padStart(2, "0")}</span>
      </div>
      <span className="text-[10px] text-white/50 uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Premium() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState<string | null>(null);

  const brand = detectBrand();
  const isIHE = brand === "iheartecho";
  const countdown = useCountdown(OFFER_END_DATE);

  const premiumFeatures    = isIHE ? IHE_PREMIUM_FEATURES    : AAUS_PREMIUM_FEATURES;
  const freeFeatures       = isIHE ? IHE_FREE_FEATURES       : AAUS_FREE_FEATURES;
  const premiumOnlyLabels  = isIHE ? IHE_PREMIUM_ONLY_LABELS : AAUS_PREMIUM_ONLY_LABELS;

  const heroTitle = isIHE
    ? "The Complete Echo Clinical Suite"
    : "The Complete Ultrasound Clinical Suite";

  const heroSubtitle = isIHE
    ? "Everything an echocardiographer or echo professional needs — protocols, calculators, cases, and AI tools — in one guideline-based platform."
    : "Everything a sonographer or ultrasound professional needs — protocols, calculators, cases, and AI tools — in one guideline-based platform.";

  const badgeLabel = isIHE
    ? "iHeartEcho™™ — Founding Member Access"
    : "All About Ultrasound™™ — Founding Member Access";

  const appName = isIHE ? "EchoAssist™" : "UltrasoundAssist™";

  // Stripe checkout mutations
  const singleMonthly = trpc.brandMembership.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast("Redirecting to checkout…", { description: "Opening Stripe in a new tab." });
      }
    },
    onError: (e: any) => {
      if (e?.data?.code === "BAD_REQUEST" && e.message?.toLowerCase().includes("already")) {
        toast.success("You already have premium access!", { description: "Redirecting to your dashboard..." });
        setTimeout(() => navigate("/"), 1200);
      } else {
        toast.error("Checkout failed — please try again.");
      }
    },
  });

  const singleLifetime = trpc.brandMembership.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast("Redirecting to checkout…", { description: "Opening Stripe in a new tab." });
      }
    },
    onError: (e: any) => {
      if (e?.data?.code === "BAD_REQUEST" && e.message?.toLowerCase().includes("already")) {
        toast.success("You already have premium access!", { description: "Redirecting to your dashboard..." });
        setTimeout(() => navigate("/"), 1200);
      } else {
        toast.error("Checkout failed — please try again.");
      }
    },
  });

  const dualMonthly = trpc.brandMembership.createDualMembershipCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast("Redirecting to checkout…", { description: "Opening Stripe in a new tab." });
      }
    },
    onError: (e: any) => {
      if (e?.data?.code === "BAD_REQUEST" && e.message?.toLowerCase().includes("already")) {
        toast.success("You already have premium access!", { description: "Redirecting to your dashboard..." });
        setTimeout(() => navigate("/"), 1200);
      } else {
        toast.error("Checkout failed — please try again.");
      }
    },
  });

  const dualLifetime = trpc.brandMembership.createDualLifetimeCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast("Redirecting to checkout…", { description: "Opening Stripe in a new tab." });
      }
    },
    onError: (e: any) => {
      if (e?.data?.code === "BAD_REQUEST" && e.message?.toLowerCase().includes("already")) {
        toast.success("You already have premium access!", { description: "Redirecting to your dashboard..." });
        setTimeout(() => navigate("/"), 1200);
      } else {
        toast.error("Checkout failed — please try again.");
      }
    },
  });

  const { data: status, isLoading: statusLoading, refetch } = trpc.premium.getStatus.useQuery(
    undefined,
    { enabled: !!user }
  );

  const checkAndSync = trpc.premium.checkAndSync.useMutation({
    onSuccess: (data) => {
      setSyncMessage(data.message);
      setSyncing(false);
      refetch();
      if (data.isPremium) setTimeout(() => navigate("/"), 2000);
    },
    onError: () => {
      setSyncing(false);
      setSyncMessage("Could not verify membership — please try again.");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sync") === "1" && user && !syncing) {
      setSyncing(true);
      checkAndSync.mutate();
    }
  }, [user]);

  const handleManualSync = () => {
    if (!user) return;
    setSyncing(true);
    setSyncMessage(null);
    checkAndSync.mutate();
  };

  const loading = authLoading || statusLoading;

  // ─── CTA button helper ─────────────────────────────────────────────────────
  function CheckoutBtn({
    label, onPay, isPending, variant = "teal",
  }: { label: string; onPay: () => void; isPending: boolean; variant?: "teal" | "amber" | "gold" }) {
    const styles: Record<string, string> = {
      teal:  "bg-[#189aa1] hover:bg-[#147a80] text-white",
      amber: "text-white",
      gold:  "text-white",
    };
    const gradients: Record<string, string | undefined> = {
      teal:  undefined,
      amber: "linear-gradient(90deg, #189aa1, #f59e0b)",
      gold:  "linear-gradient(90deg, #b45309, #d97706)",
    };
    return (
      <Button
        onClick={onPay}
        disabled={isPending}
        className={`font-bold px-5 py-2.5 text-sm rounded-xl w-full ${styles[variant]}`}
        style={gradients[variant] ? { background: gradients[variant] } : undefined}
      >
        {isPending ? (
          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Processing…</>
        ) : (
          <><Crown className="w-4 h-4 mr-1.5" />{label}</>
        )}
      </Button>
    );
  }

  function SignInBtn() {
    return (
      <a href="/login">
        <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-5 py-2.5 text-sm rounded-xl w-full">
          Sign In to Get Started
        </Button>
      </a>
    );
  }

  function ActiveBadge() {
    return (
      <div className="flex items-center justify-center gap-2 text-teal-600 font-semibold text-sm py-1">
        <Check className="w-4 h-4" /> Active
      </div>
    );
  }

  return (
    <Layout>
      {/* ── Urgency Banner ──────────────────────────────────────────────────── */}
      {!countdown.expired && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-xs font-bold tracking-wide flex items-center justify-center gap-2">
          <Flame className="w-3.5 h-3.5 flex-shrink-0" />
          Founding Member pricing ending soon — lock in lifetime access before prices increase.
          <Flame className="w-3.5 h-3.5 flex-shrink-0" />
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="relative container py-14 md:py-20">
          <div className="max-w-2xl mx-auto text-center">
            {/* Founding Member badge */}
            <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/40 rounded-full px-4 py-1.5 mb-4">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-300 font-semibold">{badgeLabel}</span>
            </div>

            <h1
              className="text-3xl md:text-5xl font-black text-white leading-tight mb-3"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              {heroTitle}
            </h1>
            <p className="text-white/70 text-base md:text-lg leading-relaxed mb-6 max-w-xl mx-auto">
              {heroSubtitle}
            </p>

            {/* Countdown */}
            {!countdown.expired && (
              <div className="mb-8">
                <p className="text-white/60 text-xs uppercase tracking-widest mb-3 font-semibold">
                  Limited Lifetime Pricing Ends In
                </p>
                <div className="flex items-start justify-center gap-3">
                  <CountdownUnit value={countdown.days}    label="Days"    />
                  <span className="text-white/40 text-2xl font-bold mt-2">:</span>
                  <CountdownUnit value={countdown.hours}   label="Hours"   />
                  <span className="text-white/40 text-2xl font-bold mt-2">:</span>
                  <CountdownUnit value={countdown.minutes} label="Min"     />
                  <span className="text-white/40 text-2xl font-bold mt-2">:</span>
                  <CountdownUnit value={countdown.seconds} label="Sec"     />
                </div>
              </div>
            )}



            {/* ── Pricing Cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-left">

              {/* 1. Monthly — single app */}
              <div className="bg-white rounded-2xl shadow-lg px-5 py-5 flex flex-col">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Monthly</div>
                <div className="text-4xl font-black text-[#189aa1] mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>
                  $9.97
                </div>
                <div className="text-gray-400 text-xs mb-1">per month · cancel anytime</div>
                <div className="text-[10px] text-gray-400 mb-4">{appName} only</div>
                <div className="mt-auto">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-xs py-2">
                      <div className="w-3 h-3 border-2 border-[#189aa1] border-t-transparent rounded-full animate-spin" />
                      Checking…
                    </div>
                  ) : status?.isPremium ? (
                    <ActiveBadge />
                  ) : user ? (
                    <CheckoutBtn
                      label="Get Monthly"
                      onPay={() => singleMonthly.mutate({ interval: "monthly", origin: window.location.origin, promoCode: promoCode ?? undefined })}
                      isPending={singleMonthly.isPending}
                      variant="teal"
                    />
                  ) : (
                    <SignInBtn />
                  )}
                </div>
              </div>

              {/* 2. Lifetime — single app — FEATURED */}
              <div className="bg-white rounded-2xl shadow-2xl px-5 py-5 flex flex-col border-2 border-amber-400 relative">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-amber-400 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                  <Timer className="w-3 h-3" /> Limited Time
                </div>
                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Lifetime Access</div>
                <div className="text-4xl font-black text-amber-500 mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>
                  $99.97
                </div>
                <div className="text-gray-400 text-xs mb-0.5">one-time payment</div>
                <div className="text-[10px] text-amber-500 font-semibold mb-1">{appName} only</div>
                <div className="text-[10px] text-gray-400 mb-4">Lock in lifetime access before future pricing increases.</div>
                <div className="mt-auto">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-xs py-2">
                      <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      Checking…
                    </div>
                  ) : status?.isPremium ? (
                    <ActiveBadge />
                  ) : user ? (
                    <CheckoutBtn
                      label="Get Lifetime Access"
                      onPay={() => singleLifetime.mutate({ interval: "lifetime", origin: window.location.origin, promoCode: promoCode ?? undefined })}
                      isPending={singleLifetime.isPending}
                      variant="gold"
                    />
                  ) : (
                    <SignInBtn />
                  )}
                </div>
              </div>

              {/* 3. Dual Monthly */}
              <div className="bg-white rounded-2xl shadow-lg px-5 py-5 flex flex-col border border-gray-100">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Both Apps · Monthly</div>
                <div className="text-4xl font-black text-[#189aa1] mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>
                  $12.99
                </div>
                <div className="text-gray-400 text-xs mb-0.5">per month · cancel anytime</div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-4">
                  <Infinity className="w-3 h-3" />
                  UltrasoundAssist™ + EchoAssist™
                </div>
                <div className="mt-auto">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-xs py-2">
                      <div className="w-3 h-3 border-2 border-[#189aa1] border-t-transparent rounded-full animate-spin" />
                      Checking…
                    </div>
                  ) : user ? (
                    <CheckoutBtn
                      label="Get Both Apps"
                      onPay={() => dualMonthly.mutate({ origin: window.location.origin })}
                      isPending={dualMonthly.isPending}
                      variant="amber"
                    />
                  ) : (
                    <SignInBtn />
                  )}
                </div>
              </div>

              {/* 4. Dual Lifetime — BEST VALUE */}
              <div className="rounded-2xl shadow-2xl px-5 py-5 flex flex-col relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gradient-to-r from-[#189aa1] to-amber-400 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                  <Star className="w-3 h-3" /> Best Value
                </div>
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Both Apps · Lifetime</div>
                <div className="text-4xl font-black text-white mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>
                  $147
                </div>
                <div className="text-white/50 text-xs mb-0.5">one-time payment</div>
                <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold mb-1">
                  <Infinity className="w-3 h-3" />
                  UltrasoundAssist™ + EchoAssist™
                </div>
                <div className="text-[10px] text-white/40 mb-4">Founding Member pricing. Lock in before future increases.</div>
                <div className="mt-auto">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 text-white/50 text-xs py-2">
                      <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      Checking…
                    </div>
                  ) : user ? (
                    <Button
                      onClick={() => dualLifetime.mutate({ origin: window.location.origin })}
                      disabled={dualLifetime.isPending}
                      className="font-bold px-5 py-2.5 text-sm rounded-xl w-full text-white"
                      style={{ background: "linear-gradient(90deg, #189aa1, #f59e0b)" }}
                    >
                      {dualLifetime.isPending ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Processing…</>
                      ) : (
                        <><Crown className="w-4 h-4 mr-1.5" />Get Lifetime — Both Apps</>
                      )}
                    </Button>
                  ) : (
                    <a href="/login">
                      <Button className="font-bold px-5 py-2.5 text-sm rounded-xl w-full text-white"
                        style={{ background: "linear-gradient(90deg, #189aa1, #f59e0b)" }}>
                        Sign In to Get Started
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-white/50 text-xs mb-4">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure Stripe checkout</span>
              <span className="flex items-center gap-1"><Clock  className="w-3 h-3" /> Monthly plans cancel anytime</span>
              <span className="flex items-center gap-1"><Lock   className="w-3 h-3" /> One-time payment = permanent access</span>
              <span className="flex items-center gap-1"><Star   className="w-3 h-3" /> Instant access after checkout</span>
            </div>

            {/* Already a member sync */}
            {user && !status?.isPremium && (
              <div className="text-center mb-2">
                <button
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="text-xs text-white/50 hover:text-white flex items-center gap-1 mx-auto transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                  Already a member? Sync now
                </button>
                {syncMessage && (
                  <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">{syncMessage}</p>
                )}
              </div>
            )}
            {status?.isPremium && (
              <div className="text-center mb-2">
                <a href={status.manageUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                    Manage Subscription
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Value Pillars ────────────────────────────────────────────────────── */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="container py-12">
          <div className="text-center mb-8">
            <h2 className="text-xl font-black text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>
              Built for Sonographers Who Want to Be Better
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              Not just an app — a clinical intelligence platform designed around how you actually work.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {VALUE_PILLARS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#f0fbfc" }}>
                  <Icon className="w-4 h-4" style={{ color: "#189aa1" }} />
                </div>
                <div>
                  <div className="font-bold text-gray-800 text-sm mb-0.5">{title}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features Grid ────────────────────────────────────────────────────── */}
      <div className="container py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>
            Everything Included in Premium
          </h2>
          <p className="text-gray-500 text-sm">
            {isIHE
              ? "All echo tools, all protocols, all cases — one membership."
              : "All ultrasound tools, all protocols, all cases — one membership."}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {premiumFeatures.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-white rounded-xl border border-gray-100 p-5 hover:border-[#189aa1]/30 hover:shadow-md transition-all">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: "#f0fbfc" }}>
                <Icon className="w-4 h-4" style={{ color: "#189aa1" }} />
              </div>
              <h3 className="font-bold text-gray-800 text-sm mb-1" style={{ fontFamily: "Merriweather, serif" }}>{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* ── Free vs Premium comparison ───────────────────────────────────── */}
        <div className="max-w-2xl mx-auto">
          <h3 className="text-center text-lg font-bold text-gray-700 mb-6" style={{ fontFamily: "Merriweather, serif" }}>
            Free vs Premium
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 p-5">
              <div className="font-bold text-gray-500 text-sm mb-4 uppercase tracking-wider">Free</div>
              <ul className="space-y-2.5">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-500">
                    <Check className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border-2 border-[#189aa1] p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#189aa1] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                from $9.97/mo
              </div>
              <div className="font-bold text-[#189aa1] text-sm mb-4 uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> Premium
              </div>
              <ul className="space-y-2.5">
                {premiumOnlyLabels.map((label) => (
                  <li key={label} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-[#189aa1] mt-0.5 flex-shrink-0" />
                    {label}
                  </li>
                ))}
                <li className="flex items-start gap-2 text-sm text-[#189aa1] font-medium">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  + all premium modules
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
        {!status?.isPremium && (
          <div className="mt-14 text-center">
            <div className="inline-block bg-amber-50 border border-amber-200 rounded-2xl px-8 py-6 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="font-black text-gray-800 text-base" style={{ fontFamily: "Merriweather, serif" }}>
                  Founding Member Pricing — Limited Time
                </span>
                <Flame className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Lock in lifetime access to {appName} before future pricing increases.
              </p>
              {user ? (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => singleMonthly.mutate({ interval: "monthly", origin: window.location.origin })}
                    disabled={singleMonthly.isPending}
                    variant="outline"
                    className="border-[#189aa1] text-[#189aa1] hover:bg-[#189aa1] hover:text-white font-bold px-8 py-3 text-sm rounded-xl"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Monthly — $9.97/mo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    onClick={() => singleLifetime.mutate({ interval: "lifetime", origin: window.location.origin })}
                    disabled={singleLifetime.isPending}
                    className="font-bold px-8 py-3 text-sm rounded-xl text-white"
                    style={{ background: "linear-gradient(90deg, #b45309, #d97706)" }}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Lifetime Access — $99.97
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    onClick={() => dualLifetime.mutate({ origin: window.location.origin })}
                    disabled={dualLifetime.isPending}
                    className="font-bold px-8 py-3 text-sm rounded-xl text-white"
                    style={{ background: "linear-gradient(90deg, #189aa1, #f59e0b)" }}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Both Apps Lifetime — $147
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <a href="/login">
                  <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-10 py-3 text-base rounded-xl">
                    Sign In to Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              )}
            </div>
            <p className="text-gray-400 text-xs">
              Secure Stripe checkout · Monthly plans cancel anytime · One-time payment = permanent access
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
