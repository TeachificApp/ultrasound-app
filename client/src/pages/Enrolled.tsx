/*
  iHeartEcho™ — Post-Enrollment Decision-Tree Landing Page
  Shown after completing the free All About Ultrasound membership enrollment.
  Two paths: All About Ultrasound Community | iHeartEcho™ EchoAssist™ App
  Brand: Teal #189aa1, Aqua #4ad9e0, Dark navy #0e1e2e
*/
import { useEffect } from "react";
import { Link } from "wouter";
import {
  CheckCircle2,
  Users,
  Stethoscope,
  ArrowRight,
  MessageCircle,
  Calculator,
  BookOpen,
  Zap,
  Heart,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const COMMUNITY_FEATURES = [
  { icon: BookOpen,      text: "Access all your enrolled All About Ultrasound courses" },
  { icon: MessageCircle, text: "Connect with sonographers & cardiologists worldwide" },
  { icon: Users,         text: "Join live Q&A sessions and community discussions" },
];

const APP_FEATURES = [
  { icon: Stethoscope, text: "EchoAssist™ — guideline-based severity interpretation" },
  { icon: Calculator,  text: "Echo calculators for AS, MR, TR, AR, diastology & more" },
  { icon: Zap,         text: "Daily Echo Challenge to sharpen your clinical skills" },
  { icon: BookOpen,    text: "Echo Case Library with annotated teaching points" },
];

export default function Enrolled() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #0e1e2e 0%, #0b3a40 50%, #0e1e2e 100%)" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-center gap-3 px-6 py-6">
        <img
          src="https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/TTSqgyHlTBmxeODV.png?Expires=1804183007&Signature=tWUrD-cUfgsk0u97qoBm0zB3mj75cGUW2F-hh-3aepkHA9QlDWUbfY2eqgxrIpyY2Zp3wTFpuBC7DXxtNjAMv5Ju2HBWLLcCgaGJrEB5X2wKLtoJQKscrbUUOXFV7xdwiJWP5zeVe7QNQaBw5zHqqyN6EYc6a0WovYLeHtUnM~vCz5pDvUh0L43UEpwlSVUZnU9ULfYO~ML9cpjCX-M~Uwb1QHUU2IxD7Qa9wMXw3nUhLxhbrUVdc-byWsUfQg5~PCwxH3jjLLq-4hlrBvFgkyB5QJJiqv6f~GM6bMh8jFE1GfWCAPzQVdcY97tgqT4GBExpYMkQ-K7AK83Fvd5zEg__&Key-Pair-Id=K2HSFNDJXOU9YS"
          alt="iHeartEcho™"
          className="w-10 h-10 object-contain"
        />
        <span
          className="text-white font-bold text-lg"
          style={{ fontFamily: "Merriweather, serif" }}
        >
          iHeartEcho™
        </span>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center px-6 pt-4 pb-10">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ background: "rgba(74, 217, 224, 0.15)", border: "1.5px solid rgba(74,217,224,0.4)" }}>
          <CheckCircle2 className="w-7 h-7" style={{ color: "#4ad9e0" }} />
        </div>
        <h1
          className="text-3xl md:text-4xl font-bold text-white mb-3 max-w-xl leading-tight"
          style={{ fontFamily: "Merriweather, serif" }}
        >
          Welcome to <br />All About Ultrasound!
        </h1>
        <p className="text-white/60 text-base max-w-md leading-relaxed">
          Your free membership is active. <br />Choose where you'd like to go next.
        </p>
      </div>

      {/* ── Decision Cards ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row items-stretch justify-center gap-6 px-6 pb-12 max-w-5xl mx-auto w-full">

        {/* ── Path 1: All About Ultrasound Community ── */}
        <a
          href="https://member.allaboutultrasound.com/enrollments"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col flex-1 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
          style={{
            background: "linear-gradient(160deg, #0e4a50 0%, #0a3540 100%)",
            border: "1px solid rgba(74,217,224,0.2)",
          }}
        >
          {/* Card header */}
          <div
            className="px-8 py-7 flex flex-col items-start gap-3"
            style={{ borderBottom: "1px solid rgba(74,217,224,0.12)" }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(74,217,224,0.15)" }}
            >
              <Users className="w-6 h-6" style={{ color: "#4ad9e0" }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#4ad9e0" }}>
                All About Ultrasound
              </p>
              <h2
                className="text-xl font-bold text-white leading-snug"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                All About Ultrasound Dashboard
              </h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Access your All About Ultrasound member dashboard — view your enrolled courses, continue learning, and connect with the community.
            </p>
          </div>

          {/* Features */}
          <div className="px-8 py-6 flex flex-col gap-3 flex-1">
            {COMMUNITY_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(74,217,224,0.12)" }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: "#4ad9e0" }} />
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-8 pb-7">
            <div
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 group-hover:gap-3"
              style={{ background: "rgba(74,217,224,0.15)", color: "#4ad9e0", border: "1px solid rgba(74,217,224,0.3)" }}
            >
              <ExternalLink className="w-4 h-4" />
              Go to Dashboard
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>
        </a>

        {/* ── Divider (mobile: horizontal, desktop: vertical) ── */}
        <div className="flex lg:flex-col items-center justify-center gap-3 flex-shrink-0">
          <div className="flex-1 h-px lg:h-auto lg:w-px bg-white/10" />
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
          >
            or
          </span>
          <div className="flex-1 h-px lg:h-auto lg:w-px bg-white/10" />
        </div>

        {/* ── Path 2: iHeartEcho™ EchoAssist™ App ── */}
        <div
          className="group flex flex-col flex-1 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-pointer"
          style={{
            background: "linear-gradient(160deg, #0f3a50 0%, #0e2a3e 100%)",
            border: "1px solid rgba(24,154,161,0.3)",
          }}
          onClick={() => {
            if (!loading && isAuthenticated) {
              window.location.href = "/";
            } else {
              window.location.href = getLoginUrl();
            }
          }}
        >
          {/* Card header */}
          <div
            className="px-8 py-7 flex flex-col items-start gap-3"
            style={{ borderBottom: "1px solid rgba(24,154,161,0.15)" }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(24,154,161,0.18)" }}
            >
              <Heart className="w-6 h-6" style={{ color: "#189aa1" }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#189aa1" }}>
                Clinical Tools
              </p>
              <h2
                className="text-xl font-bold text-white leading-snug"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                iHeartEcho™ EchoAssist™ Echocardiography Clinical Companion
              </h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Real-time echo interpretation tools, clinical calculators, and daily learning — built for the clinical environment.
            </p>
          </div>

          {/* Features */}
          <div className="px-8 py-6 flex flex-col gap-3 flex-1">
            {APP_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(24,154,161,0.15)" }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: "#189aa1" }} />
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-8 pb-7">
            <div
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 group-hover:gap-3"
              style={{ background: "#189aa1", color: "#ffffff" }}
            >
              <Heart className="w-4 h-4" />
              {loading ? "Loading…" : isAuthenticated ? "Go to Dashboard" : "Sign In to Explore"}
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer note ────────────────────────────────────────────────────── */}
      <footer className="text-center pb-8 px-6">
        <p className="text-white/30 text-xs max-w-sm mx-auto leading-relaxed">
          Your membership is managed through All About Ultrasound. Any changes to your membership are automatically reflected in iHeartEcho™.
        </p>
      </footer>
    </div>
  );
}
