/*
  UltrasoundAssist™ — Dashboard Home
  Brand: Teal #189aa1, Aqua #4ad9e0, Dark Navy #0e1e2e
  Fonts: Merriweather headings, Open Sans body
*/
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";

/** Animates a number from 0 to `target` over `duration` ms */
function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!target) return;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return count;
}
import {
  Calculator, ClipboardList, Activity, BookOpen, FileText,
  ArrowRight, Users, Award, Zap, Stethoscope, ExternalLink, MessageCircle, GraduationCap, BookMarked, Crown, Shield, Heart, ClipboardCheck
} from "lucide-react";

const BRAND = "#189aa1";

type Module = {
  path: string;
  icon: any;
  title: string;
  description: string;
  badge: string;
  color: string;
  premium?: boolean;
  external?: boolean;
  pinLast?: boolean;
};

// NOTE: Any module with pinLast: true will always render at the end of the grid.
const modules: Module[] = [
  {
    path: "/ultrasound-assist",
    icon: Stethoscope,
    title: "UltrasoundAssist™",
    description: "Scan navigator and ScanCoach for all 15 ultrasound specialties — Abdominal, Pelvic/Gyn, OB 1st & 2nd/3rd Trimester, Thyroid, Scrotum, Breast, Venous, Arterial, Abdominal Vascular, Carotid, TCD, MSK, and POCUS. View-by-view checklists, reference values, and probe guidance.",
    badge: "15 Specialties",
    color: BRAND,
  },
  // POCUS-Assist™ and Fetal EchoAssist™ accessible via UltrasoundAssist™ pathway
  // { path: "/pocus-assist-hub", icon: Shield, title: "POCUS-Assist™", ... },
  // { path: "/fetal-echo-assist-hub", icon: Heart, title: "Fetal EchoAssist™", ... },
  {
    path: "/calculators",
    icon: Calculator,
    title: "UltrasoundAssist™ Calculators",
    description: "Guideline-based calculators for POCUS (IVC CI, B-line score, eFAST grader) and Fetal Echo (biometrics, cardiac measurements, z-scores).",
    badge: "Guideline-Based",
    color: BRAND,
  },
  {
    path: "/quickfire",
    icon: BookOpen,
    title: "Daily Challenge",
    description: "One question. One case. One chance today. Answer the challenge, see the explanation. Maintain your streak, earn points and compare with other ultrasound professionals.",
    badge: "Daily",
    color: BRAND,
  },
  {
    path: "/flashcards",
    icon: BookMarked,
    title: "Ultrasound Flashcards™",
    description: "Review key ultrasound concepts across 15 categories — Abdominal, Vascular, OB, Fetal Echo, POCUS, Physics, and more. Spaced repetition with daily limits.",
    badge: "16 Categories",
    color: BRAND,
  },
  {
    path: "/case-library",
    icon: FileText,
    title: "Case Library",
    description: "Clinical cases with imaging, findings, and teaching points. Browse POCUS and Fetal Echo cases with detailed explanations.",
    badge: "Cases",
    color: BRAND,
  },
  {
    path: "/soundbytes",
    icon: Activity,
    title: "SoundBytes™",
    description: "Short-form ultrasound education videos — quick tips, technique pearls, and clinical insights from All About Ultrasound™ educators.",
    badge: "Video",
    color: BRAND,
  },
  {
    path: "/cme",
    icon: GraduationCap,
    title: "CME Hub",
    description: "Browse accredited CME courses from All About Ultrasound™ — SDMS, AMA PRA, and more. Click to enroll directly on Thinkific.",
    badge: "CME",
    color: BRAND,
  },
  {
    path: "/registry-review",
    icon: ClipboardCheck,
    title: "Registry Review Hub",
    description: "Prepare for ARDMS, ARRT, CCI, and SVU registry exams with comprehensive review courses and test & learn quizzes from All About Ultrasound™.",
    badge: "Registry",
    color: BRAND,
  },
  // Learn Fetal Echo card removed from dashboard (accessible via sidebar nav)
  // Accreditation Navigator and DIY Accreditation Tool hidden until requested
  // { path: "/accreditation-navigator", icon: Award, title: "Accreditation Navigator™", ... },
  // { path: "/accreditation", icon: ClipboardList, title: "DIY Accreditation Tool™", ... },
  // ⚠️ pinLast: true — Community Hub always renders last.
  {
    path: "https://member.allaboutultrasound.com/products/communities/allaboutultrasound-community",
    icon: MessageCircle,
    title: "All About Ultrasound™ Community",
    description: "Join the All About Ultrasound™ community on Thinkific — case discussions, peer learning, and specialty hubs for ultrasound professionals.",
    badge: "Community",
    color: BRAND,
    external: true,
    pinLast: true,
  },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = user?.isPremium === true || user?.role === "admin";
  useEffect(() => {
    document.title = "UltrasoundAssist™ | All About Ultrasound™";
  }, []);
  const pinnedLast = modules.filter(m => m.pinLast);
  const sortedModules = [...modules.filter(m => !m.pinLast), ...pinnedLast];

  // Live member count from DB
  const { data: statsData } = trpc.stats.userCount.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // cache for 5 min
  });
  const liveCount = statsData?.total ?? 0;
  const animatedCount = useCountUp(liveCount);

  return (
    <Layout>
      {/* Hero Banner */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        {/* Background probe image */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/ultrasound-hero-probe-3bWMAQMJw9YFHoPXwbt8bZ.webp")`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
          }}
        />
        <div className="relative container py-8 md:py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: "rgba(74,217,224,0.15)", color: "#4ad9e0" }}
                >
                  All About Ultrasound™
                </span>
              </div>
              <h1
                className="text-2xl md:text-3xl font-bold text-white mb-1"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                UltrasoundAssist™
              </h1>
              <p className="text-white/70 text-sm md:text-base max-w-xl mb-5">
                Advanced, guideline-driven clinical intelligence app designed for sonographers, physicians, and ultrasound learners across general, vascular, and point-of-care imaging — serving as the ultimate pocket reference for real-time scanning and clinical decision support.
              </p>

              {/* CTA Buttons — iHeartEcho style */}
              <div className="flex flex-wrap gap-3">
                <Link href="/ultrasound-assist">
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
                    style={{ background: "#189aa1" }}
                  >
                    <Stethoscope className="w-4 h-4" />
                    Open UltrasoundAssist™
                  </button>
                </Link>
                <Link href="/quickfire">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                    <Zap className="w-4 h-4" />
                    Daily Challenge
                  </button>
                </Link>
                <a
                  href="https://www.allaboutultrasound.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  allaboutultrasound.com
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* Stats row */}
        <div className="relative border-t border-white/10">
          <div className="container py-4">
            <div className="flex flex-wrap gap-6 md:gap-10">
              <div className="flex items-center gap-2 text-white/80">
                <Calculator className="w-4 h-4 text-[#4ad9e0]" />
                <span className="text-lg font-bold text-white">20+</span>
                <span className="text-xs text-white/60">Clinical Calculators</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <BookOpen className="w-4 h-4 text-[#4ad9e0]" />
                <span className="text-lg font-bold text-white">500+</span>
                <span className="text-xs text-white/60">Ultrasound Cases</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <ClipboardList className="w-4 h-4 text-[#4ad9e0]" />
                <span className="text-lg font-bold text-white">15</span>
                <span className="text-xs text-white/60">Protocols Covered</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <Users className="w-4 h-4 text-[#4ad9e0]" />
                <span className="text-lg font-bold text-white">
                  {liveCount > 0 ? animatedCount.toLocaleString() : "—"}
                </span>
                <span className="text-xs text-white/60">Members</span>
              </div>
            </div>
          </div>
        </div>
        {/* Decorative wave */}
        <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden">
          <svg viewBox="0 0 1440 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 24L1440 24L1440 0C1200 20 960 24 720 12C480 0 240 4 0 0L0 24Z" fill="white" fillOpacity="0.04" />
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-6 md:py-8">
        <div className="flex items-center justify-between mb-5">
          <h2
            className="text-xl md:text-2xl font-bold text-gray-800"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            Clinical Modules
          </h2>
          <div className="flex items-center gap-1.5 text-xs md:text-sm text-[#189aa1] font-medium">
            <Zap className="w-3.5 h-3.5" />
            {modules.length} Modules Available
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedModules.map(({ path, icon: Icon, title, description, badge, color, premium, external }) => {
            const cardContent = (
              <div className="module-card bg-white rounded-xl p-5 cursor-pointer group h-full relative overflow-hidden">
                {premium && (
                  <div className="absolute top-0 right-0">
                    <div
                      className="text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-lg tracking-wide uppercase shadow-sm"
                      style={{ background: "linear-gradient(to right, #0e4a50, #189aa1)" }}
                    >
                      Accreditation Subscription
                    </div>
                  </div>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: color + "18" }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  {!premium && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: color + "15", color }}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                <h3
                  className="font-bold text-gray-800 mb-1.5 text-sm md:text-base leading-snug"
                  style={{ fontFamily: "Merriweather, serif" }}
                >
                  {title}
                </h3>
                <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-3">{description}</p>
                <div
                  className="flex items-center gap-1 text-xs md:text-sm font-semibold group-hover:gap-2 transition-all"
                  style={{ color }}
                >
                  {external ? (
                    <>Visit Community <ExternalLink className="w-3 h-3" /></>
                  ) : (
                    <>Open Module <ArrowRight className="w-3 h-3" /></>
                  )}
                </div>
              </div>
            );

            return external ? (
              <a key={path} href={path} target="_blank" rel="noopener noreferrer">
                {cardContent}
              </a>
            ) : (
              <Link key={path} href={path}>
                {cardContent}
              </Link>
            );
          })}
        </div>

        {/* Premium CTA */}
        {!isPremium ? (
          <div
            className="mt-8 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-[#4ad9e0]" />
                <span className="text-xs md:text-sm font-semibold text-[#4ad9e0] uppercase tracking-wider">
                  Premium Access
                </span>
              </div>
              <h3
                className="text-white font-bold text-base md:text-lg mb-1"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                Unlock Full Clinical Suite
              </h3>
              <p className="text-white/60 text-xs md:text-sm">
                All 15 specialty navigators, full ScanCoach library, 500+ cases, and all premium modules — $9.97/month or $99.97/year.
              </p>
            </div>
            <a
              href="https://member.allaboutultrasound.com/enroll/3714929?price_id=4664974"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "#189aa1" }}
            >
              <ExternalLink className="w-4 h-4" />
              Upgrade
            </a>
          </div>
        ) : (
          <div
            className="mt-8 rounded-xl p-5 flex items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#189aa1" }}
            >
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs md:text-sm font-semibold text-[#4ad9e0] uppercase tracking-wider">
                  Premium Active
                </span>
              </div>
              <p className="text-white font-semibold text-sm md:text-base">
                You have full Premium Access — all 15 specialty modules are unlocked.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
