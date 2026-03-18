/**
 * Premium Access page — explains the $9.97/month or $99.97/year plan and handles checkout redirect.
 * Also handles the post-checkout sync when the user returns from checkout.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Crown, Check, Sparkles, ArrowRight, RefreshCw,
  Stethoscope, BookOpen, Zap, Activity, Users, FileText,
  Star, Shield, Clock, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";

const CHECKOUT_URL_MONTHLY =
  "https://member.allaboutultrasound.com/enroll/3703267?price_id=4651832";
const CHECKOUT_URL_ANNUAL =
  "https://member.allaboutultrasound.com/enroll/3703267?price_id=4656275";

const PREMIUM_FEATURES = [
  {
    icon: Stethoscope,
    title: "Stress Echo Navigator & ScanCoach",
    description: "Exercise and DSE protocols, 17-segment WMSI scorer, StressEchoAssist™ engine, and interpretation criteria.",
  },
  {
    icon: Stethoscope,
    title: "Pulmonary HTN & PE Navigator",
    description: "Right heart and pulmonary pressure assessment, PH probability, RVSP, RV function, PE echo signs, and risk stratification.",
  },
  {
    icon: Stethoscope,
    title: "HOCM Navigator & ScanCoach",
    description: "HOCM morphology, SAM grading, resting and provoked LVOT gradients, Valsalva, MR evaluation, and HOCM LVOT Gradient calculator.",
  },
  {
    icon: Stethoscope,
    title: "TEE Navigator & ScanCoach",
    description: "ME, TG, and UE views with angle/depth guidance, clinical applications, and intraoperative checklist.",
  },
  {
    icon: Stethoscope,
    title: "ICE Navigator & ScanCoach",
    description: "Intracardiac echo views, procedural checklists, and key measurements for structural interventions.",
  },
  {
    icon: Stethoscope,
    title: "Structural Heart Navigator & ScanCoach",
    description: "TAVR, MitraClip, WATCHMAN, and ASD/PFO closure — procedural echo guidance and post-implant assessment.",
  },
  {
    icon: Activity,
    title: "POCUS RUSH & Lung POCUS Modules",
    description: "RUSH protocol navigator and ScanCoach, Lung POCUS 8-zone protocol, B-lines, BLUE protocol, and pleural assessment.",
  },
  {
    icon: Zap,
    title: "EchoAssist™ Premium Engines",
    description: "LAP Grading, Diastology in Special Populations (MAC, transplant, AF, constriction), and StressEchoAssist™ WMSI.",
  },
  {
    icon: FileText,
    title: "Report Builder",
    description: "Generate complete, structured echo reports instantly from your measurements with 2025 ASE-compliant clinical narratives.",
  },
  {
    icon: BookOpen,
    title: "Unlimited Case Library",
    description: "Full access to 500+ echo cases with images, video, and critical thinking questions. Free members get 50 cases.",
  },
  {
    icon: Layers,
    title: "Unlimited Echo Flashcards",
    description: "Unlimited daily flashcard access with random rotation. Free members get 10 per day, resetting at midnight.",
  },
  {
    icon: Activity,
    title: "Daily Challenge Archive",
    description: "Full archive of past daily challenges. Free members get today's challenge only — premium unlocks the complete history.",
  },
  {
    icon: Shield,
    title: "EchoAccreditation Navigator",
    description: "IAC standards guide with search across TTE, TEE, Stress, Pediatric, Fetal, and HOCM accreditation requirements.",
  },
];

const FREE_FEATURES = [
  "Echo Case Library — 50 cases (mix of image/video and text-based)",
  "Daily Challenge — today's challenge only (no archive access)",
  "Echo Flashcards — 10 per day, random rotation, resets at midnight",
  "Adult TTE Navigator & ScanCoach",
  "Pediatric, Fetal & Adult Congenital Navigators",
  "Strain Navigator & ScanCoach",
  "UEA Navigator & ScanCoach",
  "Diastolic Function Navigator",
  "Cardiac POCUS, eFAST Navigator & ScanCoach",
  "EchoAssist™ core engines (LV, Diastology, Strain, AS, MS, AR, MR, TR, RV, PH, SV, Frank-Starling)",
  "Community Hub access",
];

const PREMIUM_ONLY_LABELS = [
  "Stress Echo, Pulmonary HTN, HOCM, TEE, ICE & Structural Heart Navigators",
  "Stress Echo, HOCM, TEE, ICE & Structural Heart ScanCoaches",
  "POCUS RUSH & Lung POCUS Modules",
  "EchoAssist™ LAP Grading, Diastology Special Populations & StressEchoAssist™",
  "HOCM LVOT Gradient Calculator",
  "Report Builder",
  "Unlimited Case Library (500+ cases)",
  "Unlimited Echo Flashcards (no daily limit)",
  "Daily Challenge Archive (full history)",
  "EchoAccreditation Navigator",
];

export default function Premium() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading, refetch } = trpc.premium.getStatus.useQuery(
    undefined,
    { enabled: !!user }
  );

  const checkAndSync = trpc.premium.checkAndSync.useMutation({
    onSuccess: (data) => {
      setSyncMessage(data.message);
      setSyncing(false);
      refetch();
      if (data.isPremium) {
        setTimeout(() => navigate("/"), 2000);
      }
    },
    onError: () => {
      setSyncing(false);
      setSyncMessage("Could not verify membership — please try again.");
    },
  });

  // Auto-sync when returning from checkout (URL has ?sync=1)
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

  return (
    <Layout>
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="relative container py-14 md:py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-white/90 font-medium">iHeartEcho™ Premium Access</span>
            </div>
            <h1
              className="text-3xl md:text-5xl font-black text-white leading-tight mb-4"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              The Complete Echo Clinical Suite
            </h1>
            <p className="text-white/70 text-base md:text-lg leading-relaxed mb-8 max-w-xl mx-auto">
              Everything a sonographer, cardiologist, or ACS professional needs — protocols,
              calculators, cases, and AI tools — in one guideline-based platform.
            </p>

            {/* Pricing cards */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              {/* Monthly */}
              <div className="bg-white rounded-2xl shadow-xl px-7 py-6 text-center flex-1 max-w-xs">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Monthly</div>
                <div className="text-5xl font-black text-[#189aa1] mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>
                  $9.97
                </div>
                <div className="text-gray-500 text-sm mb-4">per month · cancel anytime</div>
                {loading ? (
                  <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-2">
                    <div className="w-4 h-4 border-2 border-[#189aa1] border-t-transparent rounded-full animate-spin" />
                    Checking…
                  </div>
                ) : status?.isPremium ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold text-sm">
                    <Check className="w-4 h-4" /> Active
                  </div>
                ) : user ? (
                  <a href={CHECKOUT_URL_MONTHLY} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-6 py-2.5 text-sm rounded-xl w-full">
                      <Crown className="w-4 h-4 mr-1.5" /> Get Monthly
                    </Button>
                  </a>
                ) : (
                  <a href="/login">
                    <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-6 py-2.5 text-sm rounded-xl w-full">
                      Sign In to Upgrade
                    </Button>
                  </a>
                )}
              </div>

              {/* Annual — highlighted */}
              <div className="bg-white rounded-2xl shadow-xl px-7 py-6 text-center flex-1 max-w-xs border-2 border-[#189aa1] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#189aa1] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                  Best Value — Save 16%
                </div>
                <div className="text-xs font-semibold text-[#189aa1] uppercase tracking-wider mb-1">Annual</div>
                <div className="text-5xl font-black text-[#189aa1] mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>
                  $99.97
                </div>
                <div className="text-gray-500 text-sm mb-4">per year · ~$8.33/mo</div>
                {loading ? (
                  <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-2">
                    <div className="w-4 h-4 border-2 border-[#189aa1] border-t-transparent rounded-full animate-spin" />
                    Checking…
                  </div>
                ) : status?.isPremium ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold text-sm">
                    <Check className="w-4 h-4" /> Active
                  </div>
                ) : user ? (
                  <a href={CHECKOUT_URL_ANNUAL} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-6 py-2.5 text-sm rounded-xl w-full">
                      <Crown className="w-4 h-4 mr-1.5" /> Get Annual
                    </Button>
                  </a>
                ) : (
                  <a href="/login">
                    <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-6 py-2.5 text-sm rounded-xl w-full">
                      Sign In to Upgrade
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Already a member sync */}
            {user && !status?.isPremium && (
              <div className="text-center mb-2">
                <button
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="text-xs text-white/60 hover:text-white flex items-center gap-1 mx-auto transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                  Already a member? Sync now
                </button>
                {syncMessage && (
                  <p className="text-xs text-white/50 mt-1 max-w-xs mx-auto">{syncMessage}</p>
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

            <div className="flex flex-wrap items-center justify-center gap-4 text-white/60 text-xs">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure checkout</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Cancel anytime</span>
              <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Instant access</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div className="container py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>
            Everything Included in Premium
          </h2>
          <p className="text-gray-500 text-sm">All tools, all protocols, all cases — one subscription.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {PREMIUM_FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-white rounded-xl border border-gray-100 p-5 hover:border-[#189aa1]/30 hover:shadow-md transition-all"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: "#f0fbfc" }}>
                <Icon className="w-4 h-4" style={{ color: "#189aa1" }} />
              </div>
              <h3 className="font-bold text-gray-800 text-sm mb-1" style={{ fontFamily: "Merriweather, serif" }}>
                {title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Free vs Premium comparison */}
        <div className="max-w-2xl mx-auto">
          <h3 className="text-center text-lg font-bold text-gray-700 mb-6" style={{ fontFamily: "Merriweather, serif" }}>
            Free vs Premium
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Free */}
            <div className="rounded-xl border border-gray-200 p-5">
              <div className="font-bold text-gray-500 text-sm mb-4 uppercase tracking-wider">Free</div>
              <ul className="space-y-2.5">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-500">
                    <Check className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            {/* Premium */}
            <div className="rounded-xl border-2 border-[#189aa1] p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#189aa1] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                $9.97/mo
              </div>
              <div className="font-bold text-[#189aa1] text-sm mb-4 uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> Premium
              </div>
              <ul className="space-y-2.5">
                {PREMIUM_ONLY_LABELS.map((label) => (
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

        {/* Bottom CTA */}
        {!status?.isPremium && (
          <div className="mt-12 text-center">
            {user ? (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href={CHECKOUT_URL_MONTHLY} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-[#189aa1] text-[#189aa1] hover:bg-[#189aa1] hover:text-white font-bold px-8 py-3 text-base rounded-xl">
                    <Crown className="w-4 h-4 mr-2" />
                    Monthly — $9.97/mo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
                <a href={CHECKOUT_URL_ANNUAL} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-8 py-3 text-base rounded-xl">
                    <Crown className="w-4 h-4 mr-2" />
                    Annual — $99.97/yr
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              </div>
            ) : (
              <a href="/login">
                <Button className="bg-[#189aa1] hover:bg-[#147a80] text-white font-bold px-10 py-3 text-base rounded-xl">
                  Sign In to Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </a>
            )}
            <p className="text-gray-400 text-xs mt-3">
              Secure checkout · Cancel anytime from your account
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
