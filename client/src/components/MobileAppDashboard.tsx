import { Link } from "wouter";
import {
  Activity,
  BookMarked,
  BookOpen,
  Calculator,
  ChevronRight,
  ClipboardList,
  Layers,
  Scan,
  Stethoscope,
  Zap,
} from "lucide-react";

type MobileBrand = "aaus" | "iheartecho";

type MobileFeature = {
  path: string;
  label: string;
  detail: string;
  icon: typeof Stethoscope;
};

const AAUS_FEATURES: MobileFeature[] = [
  { path: "/ultrasound-assist", label: "Protocols & Scanning Guides", detail: "Step-by-step guidance at your fingertips.", icon: ClipboardList },
  { path: "/scan-coach", label: "ScanCoach™", detail: "Sharpen your scanning skills with ease.", icon: Scan },
  { path: "/quickfire-aaus", label: "QuickFire™ Quizzes", detail: "Test your knowledge and track progress.", icon: Zap },
  { path: "/flashcards", label: "Ultrasound Flashcards", detail: "High-yield learning on the go.", icon: Layers },
  { path: "/calculators", label: "Calculators", detail: "Essential tools for quick, accurate results.", icon: Calculator },
  { path: "/case-library", label: "Case Library", detail: "Explore cases and clinical teaching points.", icon: BookOpen },
];

const IHE_FEATURES: MobileFeature[] = [
  { path: "/echo-assist-hub", label: "EchoAssist™", detail: "Protocols and scanning guidance for echo.", icon: ClipboardList },
  { path: "/scan-coach", label: "ScanCoach™", detail: "Build confidence with every scan.", icon: Scan },
  { path: "/quickfire-ihe", label: "QuickFire™ Quizzes", detail: "Test your knowledge and track progress.", icon: Zap },
  { path: "/flashcards", label: "Echo Flashcards", detail: "High-yield learning on the go.", icon: Layers },
  { path: "/echoassist", label: "Echo Calculators", detail: "Quick, guideline-based measurements.", icon: Calculator },
  { path: "/guidelines-assist", label: "GuidelinesAssist™", detail: "Fast clinical reference when you need it.", icon: Activity },
];

export default function MobileAppDashboard({ brand }: { brand: MobileBrand }) {
  const isIHE = brand === "iheartecho";
  const appName = isIHE ? "EchoAssist™" : "UltrasoundAssist™";
  const organization = isIHE ? "iHeartEcho™" : "All About Ultrasound™";
  const description = isIHE
    ? "Your echocardiography companion. Anywhere. Anytime."
    : "Your ultrasound companion. Anywhere. Anytime.";
  const features = isIHE ? IHE_FEATURES : AAUS_FEATURES;

  return (
    <section className="md:hidden min-h-full bg-gradient-to-b from-[#f4fcfc] via-white to-[#e8f8f8] px-4 pt-5 pb-7">
      <div className="mx-auto max-w-md">
        <div className="mb-6 rounded-[1.65rem] bg-gradient-to-br from-[#0e5964] via-[#117c86] to-[#18aeb7] px-5 py-6 text-white shadow-[0_18px_38px_rgba(14,89,100,0.22)]">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">
            <span className="h-px flex-1 bg-white/35" />
            {organization}
            <span className="h-px flex-1 bg-white/35" />
          </div>
          <h1 className="text-[2rem] font-black leading-[1.05] tracking-[-0.04em]" style={{ fontFamily: "Merriweather, serif" }}>
            {appName}
          </h1>
          <p className="mt-3 max-w-[17rem] text-sm font-medium leading-relaxed text-white/85">
            {description}
          </p>
        </div>

        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-sm font-extrabold tracking-wide text-[#0e5964]">Start here</h2>
          <span className="text-[11px] font-semibold text-[#188f98]">Clinical tools & learning</span>
        </div>

        <div className="space-y-3">
          {features.map(({ path, label, detail, icon: Icon }) => (
            <Link key={path} href={path} aria-label={`Open ${label}`}>
              <div className="group flex min-h-[82px] items-center gap-3 rounded-2xl border border-[#0f7f891c] bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(14,89,100,0.07)] transition-transform duration-150 active:scale-[0.985]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b7280] to-[#17b7bc] text-white shadow-sm">
                  <Icon className="h-6 w-6" strokeWidth={2.15} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-extrabold leading-tight text-slate-900">{label}</h3>
                  <p className="mt-1 text-xs leading-snug text-slate-500">{detail}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#148f98] transition-transform duration-150 group-active:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
