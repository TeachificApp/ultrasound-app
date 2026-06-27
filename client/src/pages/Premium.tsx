/**
 * Premium Access page — brand-aware for AAUS (general ultrasound) and iHeartEcho (echo/cardiac).
 * Founding Member positioning: monthly $9.97, lifetime $99.97 (single) / $147 (dual).
 * Annual plans are HIDDEN — set showAnnual: true in brandMembershipRouter to re-enable.
 */
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Crown, Check, Sparkles, ArrowRight, RefreshCw,
  Stethoscope, BookOpen, Zap, Activity, FileText,
  Star, Shield, Clock, Layers, Infinity, Heart, Waves,
  Lock, Timer, TrendingUp, Users, Award, Flame,
  Building2, Mail, Send, CheckCircle2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { detectBrand } from "@/hooks/useBrand";
import { toast } from "sonner";
import { useCheckoutClickGuard } from "@/hooks/useCheckoutClickGuard";
import { SUBSCRIPTION_RESUME_LABEL, premiumResumeHref } from "@/lib/accessCta";

// ─── Countdown timer hook ─────────────────────────────────────────────────────
// Counts down to a fixed "offer end" date — 14 days from a hard-coded epoch.
// Update OFFER_END_DATE to change when the urgency timer expires.
// July 31 2026 11:59 PM ET = Aug 1 2026 03:59 UTC
const OFFER_END_DATE = new Date("2026-08-01T03:59:00.000Z");

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
  { icon: Users,       title: "Community Access",     description: "Connect with fellow ultrasound and echo professionals, sonographers, and physicians in the community hub." },
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

  // Team inquiry form state
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [teamSubmitted, setTeamSubmitted] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamEmail, setTeamEmail] = useState("");
  const [teamOrg, setTeamOrg] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const teamFormRef = useRef<HTMLDivElement>(null);

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
    ? "Everything an Echo Professional needs — cardiologists, sonographers, and clinicians — protocols, calculators, cases, and AI tools — in one guideline-based platform."
    : "Everything an Ultrasound Professional needs — sonographers, physicians, and clinicians — protocols, calculators, cases, and AI tools — in one guideline-based platform.";

  const badgeLabel = isIHE
    ? "iHeartEcho™ — Founding Member Access"
    : "All About Ultrasound™ — Founding Member Access";

  const appName = isIHE ? "EchoAssist™" : "UltrasoundAssist™";

  const { data: status, isLoading: statusLoading, refetch } = trpc.premium.getStatus.useQuery(
    undefined,
    { enabled: !!user }
  );

  const handleCheckoutSuccess = (data: { checkoutUrl?: string | null; free?: boolean }) => {
    if (data.free) {
      toast.success("Premium access activated!", { description: "Your membership is ready." });
      refetch();
      setTimeout(() => navigate("/upgrade-success"), 800);
      return;
    }
    if (data.checkoutUrl) {
      window.open(data.checkoutUrl, "_blank");
      toast("Redirecting to checkout…", { description: "Opening Stripe in a new tab." });
    } else {
      toast.error("Checkout failed — no payment URL returned. Please try again.");
    }
  };

  const handleCheckoutError = (e: { data?: { code?: string }; message?: string }) => {
    if (e?.data?.code === "BAD_REQUEST" && e.message?.toLowerCase().includes("already")) {
      toast.success("You already have premium access!", { description: "Redirecting to your dashboard..." });
      setTimeout(() => navigate("/"), 1200);
      return;
    }
    toast.error(e.message || "Checkout failed — please try again.");
  };

  // Stripe checkout mutations
  const singleMonthly = trpc.brandMembership.createCheckout.useMutation({
    onSuccess: handleCheckoutSuccess,
    onError: handleCheckoutError,
  });

  const singleLifetime = trpc.brandMembership.createCheckout.useMutation({
    onSuccess: handleCheckoutSuccess,
    onError: handleCheckoutError,
  });

  const dualMonthly = trpc.brandMembership.createDualMembershipCheckout.useMutation({
    onSuccess: handleCheckoutSuccess,
    onError: handleCheckoutError,
  });

  const dualLifetime = trpc.brandMembership.createDualLifetimeCheckout.useMutation({
    onSuccess: handleCheckoutSuccess,
    onError: handleCheckoutError,
  });

  const dualAnnual = trpc.brandMembership.createDualAnnualCheckout.useMutation({
    onSuccess: handleCheckoutSuccess,
    onError: handleCheckoutError,
  });

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

  const lifetimeExpired = countdown.expired; // true after July 31 11:59 PM ET
  const loading = authLoading || statusLoading;
  const { runGuarded, isGuarded } = useCheckoutClickGuard();

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
        onClick={() => runGuarded(onPay)}
        disabled={isPending || isGuarded}
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

  function ResumeBtn() {
    return (
      <a href={premiumResumeHref(brand)}>
        <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-5 py-2.5 text-sm rounded-xl w-full">
          <ArrowRight className="w-4 h-4 mr-1.5" />{SUBSCRIPTION_RESUME_LABEL}
        </Button>
      </a>
    );
  }

  return (
    <Layout>
      {/* ── Urgency Banner ──────────────────────────────────────────────────── */}
      {!lifetimeExpired && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-xs font-bold tracking-wide flex items-center justify-center gap-2">
          <Flame className="w-3.5 h-3.5 flex-shrink-0" />
          Founding Member pricing ending July 31 — lock in lifetime access before it’s gone.
          <Flame className="w-3.5 h-3.5 flex-shrink-0" />
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="relative container py-14 md:py-20">
          <div className="max-w-5xl mx-auto text-center">
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

            {/* ── Early CTA Banner (compact) ───────────────────────────── */}
            {!status?.isPremium && (
              <div className="inline-block bg-amber-50/10 border border-amber-400/30 rounded-2xl px-5 py-4 mb-6 w-full max-w-md mx-auto">
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  {!lifetimeExpired && <Flame className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                  <span className="font-black text-white text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                    {lifetimeExpired ? "Annual Membership" : "Founding Member Pricing — Limited Time"}
                  </span>
                  {!lifetimeExpired && <Flame className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                </div>
                <p className="text-white/60 text-xs mb-3">
                  {lifetimeExpired
                    ? `Get full annual access to ${appName} — $99.97/year.`
                    : `Lock in lifetime access to ${appName} before future pricing increases.`}
                </p>
                {user ? (
                  <Button
                    onClick={() => lifetimeExpired
                      ? singleLifetime.mutate({ interval: "annual", origin: window.location.origin })
                      : singleLifetime.mutate({ interval: "lifetime", origin: window.location.origin })}
                    disabled={singleLifetime.isPending}
                    className="font-bold px-6 py-2 text-sm rounded-xl text-white w-full sm:w-auto"
                    style={{ background: lifetimeExpired ? "#189aa1" : "linear-gradient(90deg, #189aa1, #f59e0b)" }}
                  >
                    <Crown className="w-3.5 h-3.5 mr-1.5" />
                    {lifetimeExpired ? "Get Annual Access — $99.97/yr" : "Get Lifetime Access — $99.97"}
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                ) : (
                  <a href="/login">
                    <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-8 py-2.5 text-sm rounded-xl w-full sm:w-auto">
                      Sign In to Get Started
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </a>
                )}
              </div>
            )}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-left w-full">

              {/* 1. Monthly — single app */}
              <div className="bg-white rounded-2xl shadow-lg px-5 py-6 flex flex-col min-h-[260px]">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Monthly</div>
                <div className="text-3xl sm:text-4xl font-black text-[#189aa1] mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>
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
                    <ResumeBtn />
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

              {/* 2. Lifetime (before deadline) / Annual (after deadline) — single app — FEATURED */}
              <div className={`bg-white rounded-2xl shadow-2xl px-5 py-6 flex flex-col relative min-h-[260px] ${lifetimeExpired ? "border-2 border-[#189aa1]" : "border-2 border-amber-400"}`}>
                {!lifetimeExpired && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-amber-400 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                    <Timer className="w-3 h-3" /> Limited Time
                  </div>
                )}
                {lifetimeExpired && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#189aa1] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                    <Crown className="w-3 h-3" /> Best Value
                  </div>
                )}
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${lifetimeExpired ? "text-[#189aa1]" : "text-amber-500"}`}>
                  {lifetimeExpired ? "Annual Access" : "Lifetime Access"}
                </div>
                <div className={`text-3xl sm:text-4xl font-black mb-0.5 ${lifetimeExpired ? "text-[#189aa1]" : "text-amber-500"}`} style={{ fontFamily: "Merriweather, serif" }}>
                  $99.97
                </div>
                <div className="text-gray-400 text-xs mb-0.5">{lifetimeExpired ? "per year · renews annually" : "one-time payment"}</div>
                <div className={`text-[10px] font-semibold mb-1 ${lifetimeExpired ? "text-[#189aa1]" : "text-amber-500"}`}>{appName} only</div>
                <div className="text-[10px] text-gray-400 mb-4">
                  {lifetimeExpired ? "Full annual access — cancel anytime." : "Lock in lifetime access before future pricing increases."}
                </div>
                <div className="mt-auto">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-xs py-2">
                      <div className={`w-3 h-3 border-2 ${lifetimeExpired ? "border-[#189aa1]" : "border-amber-400"} border-t-transparent rounded-full animate-spin`} />
                      Checking…
                    </div>
                  ) : status?.isPremium ? (
                    <ResumeBtn />
                  ) : user ? (
                    <CheckoutBtn
                      label={lifetimeExpired ? "Get Annual Access" : "Get Lifetime Access"}
                      onPay={() => singleLifetime.mutate({ interval: lifetimeExpired ? "annual" : "lifetime", origin: window.location.origin, promoCode: promoCode ?? undefined })}
                      isPending={singleLifetime.isPending}
                      variant={lifetimeExpired ? "teal" : "gold"}
                    />
                  ) : (
                    <SignInBtn />
                  )}
                </div>
              </div>

              {/* 3. Dual Monthly */}
              <div className="bg-white rounded-2xl shadow-lg px-5 py-6 flex flex-col border border-gray-100 min-h-[260px]">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Both Apps · Monthly</div>
                <div className="text-3xl sm:text-4xl font-black text-[#189aa1] mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>
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

              {/* 4. Dual Lifetime (before deadline) / Dual Annual (after deadline) — BEST VALUE */}
              <div className="rounded-2xl shadow-2xl px-5 py-6 flex flex-col relative overflow-hidden min-h-[260px]"
                style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {lifetimeExpired ? <><Crown className="w-2.5 h-2.5" /> Best Value</> : <><Timer className="w-2.5 h-2.5" /> Limited-time offer</>}
                </div>
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                  {lifetimeExpired ? "Both Apps · Annual" : "Both Apps · Lifetime"}
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>
                  $147
                </div>
                <div className="text-white/50 text-xs mb-0.5">{lifetimeExpired ? "per year · renews annually" : "one-time payment"}</div>
                <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold mb-1">
                  <Infinity className="w-3 h-3" />
                  UltrasoundAssist™ + EchoAssist™
                </div>
                <div className="text-[10px] text-white/40 mb-4">
                  {lifetimeExpired ? "Full annual access to both apps — cancel anytime." : "Founding Member pricing. Lock in before future increases."}
                </div>
                <div className="mt-auto">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 text-white/50 text-xs py-2">
                      <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      Checking…
                    </div>
                  ) : user ? (
                    <Button
                      onClick={() => lifetimeExpired
                        ? dualAnnual.mutate({ origin: window.location.origin })
                        : dualLifetime.mutate({ origin: window.location.origin })}
                      disabled={lifetimeExpired ? dualAnnual.isPending : dualLifetime.isPending}
                      className="font-bold px-5 py-2.5 text-sm rounded-xl w-full text-white"
                      style={{ background: "linear-gradient(90deg, #189aa1, #f59e0b)" }}
                    >
                      {(lifetimeExpired ? dualAnnual.isPending : dualLifetime.isPending) ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Processing…</>
                      ) : lifetimeExpired ? (
                        <><Crown className="w-4 h-4 mr-1.5" />Get Annual — Both Apps</>
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
            <div className="flex flex-wrap items-center justify-center gap-3 text-white/50 text-[11px] mb-4">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure Stripe checkout</span>
              <span className="flex items-center gap-1"><Clock  className="w-3 h-3" /> Monthly &amp; annual plans cancel anytime</span>
              {!lifetimeExpired && (
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> One-time payment = permanent access</span>
              )}
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

      {/* ── Team / Institution Pricing ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="container py-10">
          <div className="max-w-2xl mx-auto">
            <div
              className="rounded-2xl border-2 border-dashed border-[#189aa1]/40 bg-gradient-to-br from-[#f0fbfc] to-white p-7 text-center cursor-pointer hover:border-[#189aa1]/70 transition-all"
              onClick={() => {
                setTeamFormOpen(o => !o);
                setTimeout(() => teamFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="w-5 h-5" style={{ color: "#189aa1" }} />
                <span className="font-black text-gray-800 text-base" style={{ fontFamily: "Merriweather, serif" }}>
                  Team &amp; Institution Pricing
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-3">
                Training a residency program, sonography school, or clinical team?
                We offer custom group rates for 5+ users.
              </p>
              <span
                className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2 text-white"
                style={{ background: "#189aa1" }}
              >
                <Mail className="w-4 h-4" />
                {teamFormOpen ? "Hide Form" : "Request Group Pricing"}
              </span>
            </div>

            {teamFormOpen && (
              <div ref={teamFormRef} className="mt-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                {teamSubmitted ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "#189aa1" }} />
                    <p className="font-bold text-gray-800 text-base mb-1">Thanks! We'll be in touch soon.</p>
                    <p className="text-gray-500 text-sm">We typically respond within 1 business day.</p>
                  </div>
                ) : (
                  <TeamInquiryForm
                    brand={brand}
                    user={user}
                    name={teamName} setName={setTeamName}
                    email={teamEmail} setEmail={setTeamEmail}
                    org={teamOrg} setOrg={setTeamOrg}
                    size={teamSize} setSize={setTeamSize}
                    message={teamMessage} setMessage={setTeamMessage}
                    onSuccess={() => setTeamSubmitted(true)}
                  />
                )}
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
              {isIHE ? "Built for Echo Professionals Who Want to Be Better" : "Built for Ultrasound Professionals Who Want to Be Better"}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className={`inline-block rounded-2xl px-8 py-6 mb-6 ${lifetimeExpired ? "bg-[#f0fbfc] border border-[#189aa1]/30" : "bg-amber-50 border border-amber-200"}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {!lifetimeExpired && <Flame className="w-4 h-4 text-amber-500" />}
                <span className="font-black text-gray-800 text-base" style={{ fontFamily: "Merriweather, serif" }}>
                  {lifetimeExpired ? "Annual Membership" : "Founding Member Pricing — Limited Time"}
                </span>
                {!lifetimeExpired && <Flame className="w-4 h-4 text-amber-500" />}
              </div>
              <p className="text-gray-500 text-sm mb-4">
                {lifetimeExpired
                  ? `Get full annual access to ${appName} — cancel anytime.`
                  : `Lock in lifetime access to ${appName} before future pricing increases.`}
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
                    onClick={() => singleLifetime.mutate({ interval: lifetimeExpired ? "annual" : "lifetime", origin: window.location.origin })}
                    disabled={singleLifetime.isPending}
                    className="font-bold px-8 py-3 text-sm rounded-xl text-white"
                    style={{ background: lifetimeExpired ? "#189aa1" : "linear-gradient(90deg, #b45309, #d97706)" }}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {lifetimeExpired ? "Annual Access — $99.97/yr" : "Lifetime Access — $99.97"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    onClick={() => lifetimeExpired
                      ? dualAnnual.mutate({ origin: window.location.origin })
                      : dualLifetime.mutate({ origin: window.location.origin })}
                    disabled={lifetimeExpired ? dualAnnual.isPending : dualLifetime.isPending}
                    className="font-bold px-8 py-3 text-sm rounded-xl text-white"
                    style={{ background: "linear-gradient(90deg, #189aa1, #f59e0b)" }}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {lifetimeExpired ? "Both Apps Annual — $147/yr" : "Both Apps Lifetime — $147"}
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
              Secure Stripe checkout · Monthly &amp; annual plans cancel anytime
              {!lifetimeExpired && " · One-time payment = permanent access"}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ─── TeamInquiryForm ──────────────────────────────────────────────────────────
function TeamInquiryForm({
  brand, user,
  name, setName,
  email, setEmail,
  org, setOrg,
  size, setSize,
  message, setMessage,
  onSuccess,
}: {
  brand: "aaus" | "iheartecho";
  user: { name?: string | null; email?: string | null; displayName?: string | null } | null;
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  org: string; setOrg: (v: string) => void;
  size: string; setSize: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  onSuccess: () => void;
}) {
  const submitInquiry = trpc.brandMembership.submitTeamInquiry.useMutation({
    onSuccess: () => onSuccess(),
    onError: (e) => toast.error(e.message || "Submission failed — please try again."),
  });

  // Pre-fill from logged-in user on first render
  useEffect(() => {
    if (user) {
      if (!name) setName(user.displayName ?? user.name ?? "");
      if (!email) setEmail(user.email ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !org.trim() || !size.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    submitInquiry.mutate({ name: name.trim(), email: email.trim(), organization: org.trim(), teamSize: size.trim(), message: message.trim() || undefined, brand });
  }

  const TEAM_SIZES = ["5–10 users", "11–25 users", "26–50 users", "51–100 users", "100+ users"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <p className="font-bold text-gray-800 text-sm">Tell us about your team</p>
        <p className="text-gray-500 text-xs mt-0.5">We'll follow up with custom pricing options.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Your Name *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className="text-sm" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@hospital.org" className="text-sm" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Organization / Institution *</label>
          <Input value={org} onChange={e => setOrg(e.target.value)} placeholder="City Medical Center" className="text-sm" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Team Size *</label>
          <select
            value={size}
            onChange={e => setSize(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            required
          >
            <option value="">Select team size…</option>
            {TEAM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Notes (optional)</label>
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tell us about your program, use case, or any specific requirements…"
          className="text-sm resize-none"
          rows={3}
        />
      </div>
      <Button
        type="submit"
        disabled={submitInquiry.isPending}
        className="w-full font-bold text-sm rounded-xl text-white"
        style={{ background: "#189aa1" }}
      >
        {submitInquiry.isPending ? (
          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Sending…</>
        ) : (
          <><Send className="w-4 h-4 mr-2" />Send Inquiry</>
        )}
      </Button>
    </form>
  );
}
