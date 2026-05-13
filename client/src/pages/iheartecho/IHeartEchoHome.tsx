/*
  iHeartEcho™ — Dashboard Home
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useEffect, useState, useRef } from "react";

// Animated count-up hook — re-animates whenever target changes
function useCountUp(target: number, duration = 1800, enabled = true) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    // Cancel any in-progress animation
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const startValue = count; // animate from current displayed value
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(startValue + eased * (target - startValue)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, enabled]);
  return count;
}
import { useAuth } from "@/_core/hooks/useAuth";
import { usePremium } from "@/hooks/usePremium";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import {
  Calculator, ClipboardList, Activity, BookOpen, FileText,
  ArrowRight, Users, Award, Zap, Stethoscope, ExternalLink, MessageCircle, GraduationCap, BookMarked, Crown, Shield, Trophy, Volume2, Layers, CreditCard, BookCheck
} from "lucide-react";

const BRAND = "#189aa1";

type InterestKey = "acs" | "adultEcho" | "pediatricEcho" | "fetalEcho";
type Module = { path: string; icon: any; title: string; description: string; badge: string; color: string; premium?: boolean; subscriptionTag?: string; external?: boolean; pinLast?: boolean; interests?: InterestKey[] };
// NOTE: Any module with pinLast: true will always render at the end of the grid,
// regardless of its position in this array. Add new modules ABOVE the Community Hub entry.
const modules: Module[] = [
  {
    path: "/echo-assist-hub",
    icon: Stethoscope,
    title: "EchoAssist™",
    description: "Echo protocol + scan coach for all 11 specialties — Adult Echo, Pediatric, Fetal, Stress, Strain, UEA, HOCM, Pulmonary HTN & PE, Structural Heart, TEE, and ICE. View-by-view checklists, reference values, and probe guidance.",
    badge: "11 Specialties",
    color: BRAND,
    interests: ["adultEcho", "pediatricEcho", "fetalEcho", "acs"],
  },
  {
    path: "/pocus-assist-hub",
    icon: Shield,
    title: "POCUS-Assist™",
    description: "Point-of-care ultrasound protocols for eFAST, Cardiac POCUS, RUSH, and Lung POCUS — window-by-window checklists, probe guidance, IVC CI, B-line scorer, and eFAST free-fluid grader.",
    badge: "4 Modules",
    color: BRAND,
    interests: ["acs"],
  },
  {
    path: "/echoassist",
    icon: Calculator,
    title: "EchoAssist™ Calculators",
    description: "Guideline-based severity calculators for AS, MR, AR, TR, MS, LV function, diastology, strain, RV function, PA pressure, SV/CO, and LAP estimation.",
    badge: "Guideline-Based",
    color: BRAND,
    interests: ["adultEcho", "acs"],
  },
  {
    path: "/guidelines-assist",
    icon: BookCheck,
    title: "GuidelinesAssist™",
    description: "Fast-lookup ASE guideline quick-reference: measurement cut-offs, grading algorithms, and normal values for every major echo domain — linked to EchoAssist calculators and ScanCoach.",
    badge: "ASE Guidelines",
    color: BRAND,
    interests: ["adultEcho", "pediatricEcho", "fetalEcho", "acs"],
  },
  {
    path: "/quickfire",
    icon: Trophy,
    title: "Daily Challenge",
    description: "One question. One case. One chance today. Answer the challenge, see the explanation. Maintain your streak, earn points and compare with other echo professionals.",
    badge: "Daily",
    color: BRAND,
    interests: ["adultEcho", "pediatricEcho", "fetalEcho", "acs"],
  },
  {
    path: "/soundbytes",
    icon: Volume2,
    title: "SoundBytes™",
    description: "Quick-hit video micro-lessons — clinical pearls in minutes. Filter by specialty and watch on demand.",
    badge: "Premium",
    color: BRAND,
    interests: ["adultEcho", "pediatricEcho", "fetalEcho", "acs"],
  },

  {
    path: "/hemodynamics",
    icon: Activity,
    title: "Hemodynamics Lab",
    description: "Adjust preload, afterload, and contractility. See PV loop changes and echo findings in real time.",
    badge: "Training",
    color: BRAND,
    interests: ["adultEcho", "acs"],
  },
  {
    path: "/cme",
    icon: GraduationCap,
    title: "CME Hub",
    description: "Browse accredited CME courses from All About Ultrasound — SDMS, AMA PRA, and more. Click to enroll directly on Thinkific.",
    badge: "CME",
    color: BRAND,
    interests: ["adultEcho", "pediatricEcho", "fetalEcho", "acs"],
  },
  {
    path: "/registry-review",
    icon: BookMarked,
    title: "Registry Review",
    description: "Prepare for ARDMS, CCI, and other registry exams with comprehensive review courses from All About Ultrasound.",
    badge: "Registry Prep",
    color: BRAND,
    interests: ["adultEcho", "pediatricEcho", "fetalEcho", "acs"],
  },

  {
    path: "/accreditation-navigator",
    icon: Award,
    title: "EchoAccreditation Navigator™",
    description: "Free IAC standards guide — search case mix requirements, CME, staff qualifications, policies, and common deficiencies for TTE, TEE, Stress, Pediatric, Fetal, and HOCM.",
    badge: "Free · IAC",
    color: BRAND,
    interests: ["adultEcho", "pediatricEcho", "fetalEcho"],
  },
  {
    path: "/accreditation",
    icon: ClipboardList,
    title: "DIY Accreditation Tool™",
    description: "Quality reviews, peer review tracking, policy builder, and appropriate use monitoring — everything your lab needs for IAC accreditation.",
    badge: "Accreditation",
    color: BRAND,
    premium: true,
    subscriptionTag: "Accreditation Subscription",
    interests: ["adultEcho", "pediatricEcho", "fetalEcho", "acs"],
  },
  // ⚠️ pinLast: true — Community Hub always renders last. Do not remove this flag.
  {
    path: "https://member.allaboutultrasound.com/products/communities/allaboutultrasound-community",
    icon: MessageCircle,
    title: "iHeartEcho™ Community",
    description: "Join the All About Ultrasound | iHeartEcho™ community on Thinkific — case discussions, peer learning, and specialty hubs for echo professionals.",
    badge: "Community",
    color: BRAND,
    external: true,
    pinLast: true,
  },
];
// Stable sort: pinLast items always go to the end, preserving relative order of all others
const sortedModules = [
  ...modules.filter(m => !m.pinLast),
  ...modules.filter(m => m.pinLast),
];

const STATIC_STATS = [
  { label: "Clinical Calculators", value: "20+", icon: Calculator },
  { label: "Echo Cases", value: "500+", icon: BookOpen },
];

export default function Home() {
  const { user } = useAuth();
  const { isPremium } = usePremium();

  // SEO: set page title, description, and keywords
  useEffect(() => {
    document.title = "iHeartEcho™ — Echocardiography Clinical Intelligence";
    // Meta description
    let desc = document.querySelector<HTMLMetaElement>("meta[name='description']");
    if (!desc) {
      desc = document.createElement("meta");
      desc.name = "description";
      document.head.appendChild(desc);
    }
    desc.content = "iHeartEcho™ is a real-time echocardiography clinical companion for sonographers and cardiologists. Guideline-based echo protocols, calculators, daily challenges, and case library.";
    // Meta keywords
    let kw = document.querySelector<HTMLMetaElement>("meta[name='keywords']");
    if (!kw) {
      kw = document.createElement("meta");
      kw.name = "keywords";
      document.head.appendChild(kw);
    }
    kw.content = "echocardiography, echo, ultrasound, cardiology, sonography, POCUS, TTE, TEE, ASE guidelines, echo protocols, cardiac imaging, echo calculator, daily challenge, CME, ARDMS, CCI";
  }, []);

  // Live user count — cached for 5 minutes so it stays fresh
  const { data: userCountData } = trpc.stats.userCount.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
  // The server already adds the display offset (3997), so use the returned total directly.
  // Only fall back when the query hasn't resolved yet (undefined).
  const memberTarget = userCountData?.total ?? 0;
  // Animated count-up — starts as soon as the target is known
  const animatedCount = useCountUp(memberTarget, 1800, true);
  const displayedMembers = animatedCount.toLocaleString();

  const stats = [
    ...STATIC_STATS,
    {
      label: "Members",
      value: displayedMembers,
      icon: Users,
    },
  ];
  return (
    <Layout>
      {/* Hero Banner */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative container py-12 md:py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
              <span className="text-sm text-white/80 font-medium">Real-time Clinical Decision Support</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <img
                src="https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/TTSqgyHlTBmxeODV.png?Expires=1804183007&Signature=tWUrD-cUfgsk0u97qoBm0zB3mj75cGUW2F-hh-3aepkHA9QlDWUbfY2eqgxrIpyY2Zp3wTFpuBC7DXxtNjAMv5Ju2HBWLLcCgaGJrEB5X2wKLtoJQKscrbUUOXFV7xdwiJWP5zeVe7QNQaBw5zHqqyN6EYc6a0WovYLeHtUnM~vCz5pDvUh0L43UEpwlSVUZnU9ULfYO~ML9cpjCX-M~Uwb1QHUU2IxD7Qa9wMXw3nUhLxhbrUVdc-byWsUfQg5~PCwxH3jjLLq-4hlrBvFgkyB5QJJiqv6f~GM6bMh8jFE1GfWCAPzQVdcY97tgqT4GBExpYMkQ-K7AK83Fvd5zEg__&Key-Pair-Id=K2HSFNDJXOU9YS"
                alt="iHeartEcho™ Logo"
                className="w-20 h-20 object-contain drop-shadow-lg"
              />
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                  iHeartEcho™
                </h1>
                <p className="text-lg text-[#4ad9e0] font-semibold">EchoAssist™ Echocardiography Clinical Intelligence</p>
              </div>
            </div>
            <p className="text-white/70 text-sm md:text-base leading-relaxed mb-6 max-w-lg">
              A real-time echo interpretation and measurement assistant for cardiac ultrasound students, sonographers, echocardiographers, cardiologists, physicians, residents, ACS professionals, and echo educators. Guideline-based, fast, and built for the clinical environment.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/echo-assist-hub">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
                  style={{ background: "#189aa1" }}>
                  <Stethoscope className="w-4 h-4" />
                  Open EchoAssist™
                </button>
              </Link>
              <Link href="/quickfire">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                  <Trophy className="w-4 h-4" />
                  Daily Challenge
                </button>
              </Link>
              <a href="https://www.iheartecho.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
                <ExternalLink className="w-4 h-4" />
                iheartecho.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white border-b border-[#189aa1]/10">
        <div className="container py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f0fbfc" }}>
                  <Icon className="w-4 h-4" style={{ color: "#189aa1" }} />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold" style={{ fontFamily: "JetBrains Mono, monospace", color: "#189aa1" }}>{value}</div>
                  <div className="text-xs md:text-sm text-gray-500">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Clinical Modules</h2>
          <div className="flex items-center gap-1.5 text-xs md:text-sm text-[#189aa1] font-medium">
            <Zap className="w-3.5 h-3.5" />
            {modules.length} Modules Available
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedModules.map(({ path, icon: Icon, title, description, badge, color, premium, subscriptionTag, external }) => {
            const cardContent = (
              <div className="module-card bg-white rounded-xl p-5 cursor-pointer group h-full relative overflow-hidden">
                {premium && subscriptionTag && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-[#0e4a50] to-[#189aa1] text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-lg tracking-wide uppercase shadow-sm">
                      {subscriptionTag}
                    </div>
                  </div>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  {!premium && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: color + "15", color }}>
                      {badge}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-800 mb-1.5 text-sm md:text-base leading-snug" style={{ fontFamily: "Merriweather, serif" }}>
                  {title}
                </h3>
                <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-3">{description}</p>
                <div className="flex items-center gap-1 text-xs md:text-sm font-semibold group-hover:gap-2 transition-all" style={{ color }}>
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

        {/* Premium CTA — shown only to non-premium users */}
        {!isPremium ? (
          <div className="mt-8 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-[#4ad9e0]" />
                <span className="text-xs md:text-sm font-semibold text-[#4ad9e0] uppercase tracking-wider">Premium Access</span>
              </div>
              <h3 className="text-white font-bold text-base md:text-lg mb-1" style={{ fontFamily: "Merriweather, serif" }}>
                Unlock Full Clinical Suite
              </h3>
              <p className="text-white/60 text-xs md:text-sm">
                UEA Navigator, HOCM-Assist™ Navigator, full interpretation engine, 500+ cases, and all premium modules — $9.97/month.
              </p>
            </div>
            <a href="https://member.allaboutultrasound.com/enroll/3703267?price_id=4651832" target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "#189aa1" }}>
              <ExternalLink className="w-4 h-4" />
              Upgrade
            </a>
          </div>
        ) : (
          <div className="mt-8 rounded-xl p-5 flex items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#189aa1" }}>
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs md:text-sm font-semibold text-[#4ad9e0] uppercase tracking-wider">Premium Active</span>
              </div>
              <p className="text-white font-semibold text-sm md:text-base">You have full Premium Access — all modules are unlocked.</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
