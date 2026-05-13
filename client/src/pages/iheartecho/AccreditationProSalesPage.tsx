/*
  iHeartEcho™ — Accreditation Pro Sales Page
  Combined ad-copy landing page for:
    1. Accreditation Navigator™ (included with Premium)
    2. DIY Accreditation™ Tool (standalone subscription)
  No prices shown — CTAs link to /diy-accreditation-plans or premium enroll URL.
  Route: /accreditation-pro
*/
import { Link } from "wouter";
import {
  CheckCircle2,
  ClipboardList,
  Star,
  FileText,
  BarChart2,
  GitCompare,
  ImageIcon,
  Stethoscope,
  Shield,
  BookOpen,
  TrendingUp,
  Calendar,
  CheckSquare,
  Users,
  Building2,
  ArrowRight,
  Zap,
  Award,
  Lock,
  ChevronDown,
  ChevronUp,
  Heart,
} from "lucide-react";
import { useState } from "react";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";
const NAVY = "#0e1e2e";

const PREMIUM_URL = "https://member.allaboutultrasound.com/enroll/3703267?price_id=4651832";
const DIY_PLANS_PATH = "/diy-accreditation-plans";

// ─── Navigator Features ───────────────────────────────────────────────────────
const NAVIGATOR_FEATURES = [
  {
    icon: ClipboardList,
    title: "Based on the IAC Standards",
    desc: "Fully mapped IAC requirements for Adult TTE, Adult TEE, Stress Echo, Pediatric TTE, Pediatric TEE, Fetal Echo, and PeriOp TEE — no PDF hunting required.",
  },
  {
    icon: CheckSquare,
    title: "Interactive Readiness Checklist",
    desc: "Check off each standard as you meet it. Per-tab readiness scores and an overall progress bar show exactly where you stand before submission day.",
  },
  {
    icon: Shield,
    title: "7 Accreditation Types Covered",
    desc: "Switch between accreditation types with one click. Each filter loads the precise standards for that modality — Equipment, Facility, Medical Director, Technical Staff, CME, Case Studies, and more.",
  },
  {
    icon: BookOpen,
    title: "Section-by-Section Guidance",
    desc: "Every standard is broken into actionable sections with plain-language descriptions, so your team knows exactly what documentation and processes to have in place.",
  },
  {
    icon: TrendingUp,
    title: "Progress Saved Per User",
    desc: "Checklist state is saved to your account. Come back any time — your readiness progress is always where you left it.",
  },
  {
    icon: Award,
    title: "Included with Premium",
    desc: "Accreditation Navigator™ is included at no extra cost with your iHeartEcho™ Premium subscription. One subscription, full clinical suite.",
  },
];

// ─── DIY Tool Features ────────────────────────────────────────────────────────
const DIY_FEATURES = [
  {
    icon: ImageIcon,
    title: "Image Quality Review (IQR)",
    desc: "Score sonographer studies on image quality, protocol adherence, and report accuracy. Generate printable IQR forms and track trends over time.",
  },
  {
    icon: ClipboardList,
    title: "Sonographer Peer Review",
    desc: "Structured peer review workflow for sonographers — assign reviewers, capture scores, and maintain a complete audit trail for accreditation submissions.",
  },
  {
    icon: Star,
    title: "Physician Peer Review",
    desc: "Physician-level review with image quality, report accuracy, and technical adherence scoring. Weighted quality scores calculated automatically.",
  },
  {
    icon: GitCompare,
    title: "Echo Correlations",
    desc: "Track echo-to-cath, echo-to-surgery, and echo-to-CT correlations. Identify discordance patterns and document findings for IAC case study requirements.",
  },
  {
    icon: BarChart2,
    title: "Appropriate Use Criteria (AUC)",
    desc: "Monitor appropriate use across your lab. Flag rarely-appropriate studies, track trends, and generate AUC compliance reports.",
  },
  {
    icon: FileText,
    title: "Policy Builder",
    desc: "Generate, store, and manage all required lab policies — infection control, equipment maintenance, protocol adherence, and more — in one organised library.",
  },
  {
    icon: Stethoscope,
    title: "Case Study Submission",
    desc: "Submit and track IAC case study requirements directly in the platform. Case mix tracking ensures you meet volume and diversity thresholds.",
  },
  {
    icon: TrendingUp,
    title: "Reports & Analytics",
    desc: "Comprehensive lab analytics dashboard — quality score trends, peer review completion rates, AUC compliance, and staff performance over time.",
  },
  {
    icon: CheckSquare,
    title: "Readiness Dashboard",
    desc: "A single-screen readiness view that aggregates your QA/QI data against IAC requirements — so you always know your accreditation readiness score.",
  },
  {
    icon: Calendar,
    title: "Quality Meetings Log",
    desc: "Document and archive quality improvement meeting minutes, action items, and outcomes to satisfy IAC meeting documentation requirements.",
  },
  {
    icon: Users,
    title: "Multi-Seat Lab Management",
    desc: "Invite Lab Admins and members, manage seat allocations, and control access levels — from a solo practitioner to a multi-site enterprise lab.",
  },
  {
    icon: Building2,
    title: "Organisation Settings & Branding",
    desc: "Configure your lab's name, accreditation type, and org settings. SuperAdmin controls billing, seats, and member access from one dashboard.",
  },
];

// ─── Plans Summary (no prices) ────────────────────────────────────────────────
const DIY_PLANS = [
  {
    name: "Accreditation Starter",
    tagline: "Begin your accreditation journey",
    seats: "1 Lab Admin · 4 Member Seats · 5 Total",
    url: "https://member.allaboutultrasound.com/enroll/3706401?price_id=4655411",
  },
  {
    name: "Accreditation Professional",
    tagline: "Structured QA/QI for growing labs",
    seats: "2 Lab Admins · 13 Member Seats · 15 Total",
    url: "https://member.allaboutultrasound.com/enroll/3706397?price_id=4655406",
    popular: true,
  },
  {
    name: "Accreditation Advanced",
    tagline: "Multi-site & large lab solution",
    seats: "5 Lab Admins · 45 Member Seats · 50 Total",
    url: "https://member.allaboutultrasound.com/enroll/3706392?price_id=4655402",
  },
  {
    name: "Accreditation Partner",
    tagline: "Unlimited seats + expert guidance",
    seats: "10 Lab Admins · Unlimited Member Seats",
    url: "https://member.allaboutultrasound.com/enroll/3706344?price_id=4655349",
  },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is the difference between Accreditation Navigator™ and the DIY Accreditation™ Tool?",
    a: "Accreditation Navigator™ is a read-only reference and checklist tool — it maps the IAC Standards so you always know what is required and lets you track your readiness. The DIY Accreditation™ Tool is an active QA/QI platform where your lab performs peer reviews, image quality reviews, policy management, case study submissions, and generates the documentation required for accreditation.",
  },
  {
    q: "Is Accreditation Navigator™ included with my Premium subscription?",
    a: "Yes. Accreditation Navigator™ is included at no extra cost with any active iHeartEcho™ Premium subscription. Simply sign in and navigate to Accreditation Navigator from the sidebar.",
  },
  {
    q: "Do I need both tools?",
    a: "Most labs pursuing IAC accreditation will benefit from both. Accreditation Navigator™ keeps you aligned with the standards, while the DIY Accreditation™ Tool generates the QA/QI documentation and evidence required to submit. Together they form a complete accreditation preparation system.",
  },
  {
    q: "Which accreditation types are supported?",
    a: "Both tools support IAC Adult Echo (TTE, TEE, Stress), IAC Pediatric/Congenital Echo (Ped TTE, Ped TEE, Fetal), and IAC PeriOp TEE — covering the full IAC Standards.",
  },
  {
    q: "Can multiple people in my lab use the DIY Accreditation™ Tool?",
    a: "Yes. Each plan includes a set number of Lab Admin seats and Member seats. Lab Admins can perform reviews, manage policies, and access all QA/QI tools. Members have access to their own review submissions and the member portal.",
  },
  {
    q: "Do Lab Admins get access to the full iHeartEcho™ app?",
    a: "Yes. All Lab Admins on a DIY Accreditation™ subscription receive full iHeartEcho™ app access as part of their accreditation subscription.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border rounded-xl overflow-hidden cursor-pointer transition-all"
      style={{ borderColor: open ? BRAND : "rgba(24,154,161,0.2)", background: open ? "rgba(24,154,161,0.04)" : "white" }}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <p className="font-semibold text-gray-800 text-sm leading-snug">{q}</p>
        {open
          ? <ChevronUp className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
          : <ChevronDown className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />}
      </div>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function AccreditationProSalesPage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BRAND_DARK} 60%, ${BRAND} 100%)` }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative container py-16 md:py-20 max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left: copy */}
            <div className="flex-1 max-w-xl">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-xs text-white/80 font-semibold tracking-wide uppercase">Based on the IAC Standards · Built for Echo Labs</span>
              </div>
              <h1
                className="text-4xl md:text-5xl font-black text-white leading-tight mb-5"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                Accreditation<br />
                <span style={{ color: "#4ad9e0" }}>Simplified.</span>
              </h1>
              <p className="text-white/70 text-lg leading-relaxed mb-8">
                The only platform built specifically for echo lab accreditation — combining an interactive IAC standards navigator with a complete QA/QI documentation suite. From readiness checklist to submission-ready evidence, in one place.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href={PREMIUM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
                  style={{ background: BRAND }}
                >
                  <Zap className="w-4 h-4" />
                  Get Accreditation Navigator™ — Premium
                  <ArrowRight className="w-4 h-4" />
                </a>
                <Link href={DIY_PLANS_PATH}>
                  <span className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all cursor-pointer">
                    <Building2 className="w-4 h-4" />
                    Explore DIY Accreditation™ Plans
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              </div>
            </div>
            {/* Right: hero graphic */}
            <div className="flex-1 w-full max-w-2xl">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/accreditation-quality-v2.webp"
                alt="DIY Accreditation Quality Dashboard showing accreditation readiness metrics, quality trend charts, and echo imaging"
                className="w-full rounded-2xl shadow-2xl border border-white/10"
                style={{ maxHeight: 380, objectFit: "cover", objectPosition: "center" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Trust Bar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-wrap gap-6 items-center justify-center md:justify-between">
          {[
            { icon: CheckCircle2, text: "Based on the IAC Standards" },
            { icon: Shield, text: "7 Accreditation Types Supported" },
            { icon: FileText, text: "Submission-Ready Documentation" },
            { icon: Heart, text: "Built by Echo Professionals" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
              <span className="text-sm font-medium text-gray-600">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 1: Accreditation Navigator™ ──────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-3"
              style={{ background: "rgba(24,154,161,0.1)", color: BRAND }}>
              <Zap className="w-3.5 h-3.5" />
              Included with Premium
            </div>
            <h2
              className="text-3xl md:text-4xl font-black text-gray-900 leading-tight"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              Accreditation Navigator™
            </h2>
            <p className="text-gray-500 text-base mt-3 max-w-xl leading-relaxed">
              Your interactive guide to the IAC Standards. Know exactly what is required, track your readiness section by section, and walk into your accreditation survey with confidence.
            </p>
          </div>
          <a
            href={PREMIUM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 whitespace-nowrap"
            style={{ background: BRAND }}
          >
            Get Premium Access
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {NAVIGATOR_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-6 border transition-shadow hover:shadow-md"
              style={{ borderColor: "rgba(24,154,161,0.15)", background: "rgba(24,154,161,0.02)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(24,154,161,0.12)" }}
              >
                <Icon className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <h3 className="font-bold text-gray-800 text-sm mb-2 leading-snug">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Premium CTA banner */}
        <div
          className="mt-10 rounded-2xl p-7 flex flex-col sm:flex-row items-start sm:items-center gap-5"
          style={{ background: `linear-gradient(135deg, ${NAVY}, ${BRAND_DARK})` }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4" style={{ color: "#4ad9e0" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#4ad9e0" }}>Premium Subscription</span>
            </div>
            <h3 className="text-white font-bold text-base mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Accreditation Navigator™ is included with iHeartEcho™ Premium
            </h3>
            <p className="text-white/60 text-xs leading-relaxed">
              One Premium subscription unlocks the full clinical suite — EchoAssist™, SoundBytes™, Case Library, Daily Challenge, ScanCoach™, and Accreditation Navigator™.
            </p>
          </div>
          <a
            href={PREMIUM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
            style={{ background: BRAND }}
          >
            Subscribe to Premium
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100" />

      {/* ── Section 2: DIY Accreditation™ Tool ───────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-3"
              style={{ background: "rgba(14,74,80,0.1)", color: BRAND_DARK }}>
              <Building2 className="w-3.5 h-3.5" />
              Lab Subscription
            </div>
            <h2
              className="text-3xl md:text-4xl font-black text-gray-900 leading-tight"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              DIY Accreditation™ Tool
            </h2>
            <p className="text-gray-500 text-base mt-3 max-w-xl leading-relaxed">
              The complete QA/QI documentation platform for echo labs pursuing IAC accreditation. Peer reviews, image quality scoring, policy management, case studies, and analytics — all in one place, all submission-ready.
            </p>
          </div>
          <Link href={DIY_PLANS_PATH}>
            <span
              className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 whitespace-nowrap cursor-pointer"
              style={{ background: BRAND_DARK }}
            >
              View Plans
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DIY_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-6 border transition-shadow hover:shadow-md"
              style={{ borderColor: "rgba(14,74,80,0.12)", background: "rgba(14,74,80,0.02)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(14,74,80,0.1)" }}
              >
                <Icon className="w-5 h-5" style={{ color: BRAND_DARK }} />
              </div>
              <h3 className="font-bold text-gray-800 text-sm mb-2 leading-snug">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Plans Summary ─────────────────────────────────────────────────────── */}
      <div style={{ background: "#f8fffe" }} className="border-t border-b border-[#189aa1]/10">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2
              className="text-3xl font-black text-gray-900 mb-3"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              DIY Accreditation™ Plans
            </h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              Choose the plan that fits your lab size. All plans include the full DIY Accreditation™ Tool and full iHeartEcho™ app access for Lab Admins.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {DIY_PLANS.map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-2xl p-6 border flex flex-col transition-shadow hover:shadow-lg"
                style={{
                  borderColor: plan.popular ? BRAND : "rgba(24,154,161,0.2)",
                  background: plan.popular ? `linear-gradient(160deg, rgba(24,154,161,0.06), rgba(14,74,80,0.04))` : "white",
                  boxShadow: plan.popular ? `0 0 0 2px ${BRAND}` : undefined,
                }}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                    style={{ background: BRAND }}
                  >
                    Most Popular
                  </div>
                )}
                <h3 className="font-bold text-gray-900 text-sm mb-1 leading-snug">{plan.name}</h3>
                <p className="text-xs text-gray-400 mb-4">{plan.tagline}</p>
                <div
                  className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 mb-5"
                  style={{ background: "rgba(24,154,161,0.08)", color: BRAND_DARK }}
                >
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />
                  {plan.seats}
                </div>
                <div className="mt-auto">
                  <a
                    href={plan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                    style={
                      plan.popular
                        ? { background: BRAND, color: "white" }
                        : { background: "rgba(24,154,161,0.1)", color: BRAND }
                    }
                  >
                    Get Started
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href={DIY_PLANS_PATH}>
              <span className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer hover:underline" style={{ color: BRAND }}>
                View full plan comparison
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Comparison: Navigator vs DIY ─────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2
            className="text-3xl font-black text-gray-900 mb-3"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            Which Tool Do You Need?
          </h2>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Both tools are designed to work together — but each serves a distinct purpose in your accreditation journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Navigator card */}
          <div
            className="rounded-2xl p-8 border"
            style={{ borderColor: "rgba(24,154,161,0.25)", background: "rgba(24,154,161,0.03)" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(24,154,161,0.15)" }}>
                <ClipboardList className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Accreditation Navigator™</h3>
                <span className="text-xs font-semibold" style={{ color: BRAND }}>Included with Premium</span>
              </div>
            </div>
            <ul className="space-y-3">
              {[
                "Know what IAC requires for each accreditation type",
                "Track your readiness section by section",
                "Understand documentation requirements before you start",
                "Reference standards during your preparation process",
                "Ideal for individuals and teams preparing for accreditation",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                  <span className="text-sm text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
            <a
              href={PREMIUM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
              style={{ background: BRAND }}
            >
              Get Premium
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* DIY card */}
          <div
            className="rounded-2xl p-8 border"
            style={{ borderColor: "rgba(14,74,80,0.2)", background: "rgba(14,74,80,0.02)" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(14,74,80,0.12)" }}>
                <Building2 className="w-5 h-5" style={{ color: BRAND_DARK }} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">DIY Accreditation™ Tool</h3>
                <span className="text-xs font-semibold" style={{ color: BRAND_DARK }}>Lab Subscription</span>
              </div>
            </div>
            <ul className="space-y-3">
              {[
                "Perform and document peer reviews and image quality reviews",
                "Build and store all required lab policies",
                "Submit and track IAC case studies and case mix",
                "Monitor appropriate use criteria compliance",
                "Generate submission-ready reports and analytics",
                "Manage your entire lab team with multi-seat access",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND_DARK }} />
                  <span className="text-sm text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
            <Link href={DIY_PLANS_PATH}>
              <span
                className="mt-7 flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 cursor-pointer"
                style={{ background: BRAND_DARK }}
              >
                View DIY Plans
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <h2
              className="text-3xl font-black text-gray-900 mb-3"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BRAND_DARK} 100%)` }}
      >
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <Lock className="w-10 h-10 mx-auto mb-5 opacity-30 text-white" />
          <h2
            className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            Your accreditation journey<br />starts today.
          </h2>
          <p className="text-white/60 text-base mb-8 max-w-lg mx-auto leading-relaxed">
            Whether you are preparing for your first IAC survey or maintaining an existing accreditation, iHeartEcho™ has the tools to get you there — confidently and efficiently.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={PREMIUM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
              style={{ background: BRAND }}
            >
              <Zap className="w-4 h-4" />
              Get Premium — Includes Navigator™
            </a>
            <Link href={DIY_PLANS_PATH}>
              <span className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all cursor-pointer">
                <Building2 className="w-4 h-4" />
                Explore DIY Accreditation™ Plans
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Footer note ───────────────────────────────────────────────────────── */}
      <div className="text-center py-6 px-6 bg-white border-t border-gray-100">
        <p className="text-xs text-gray-400">
          iHeartEcho™ is an educational and clinical decision support platform. Accreditation Navigator™ and DIY Accreditation™ are tools to assist in preparation — accreditation decisions are made solely by the relevant accrediting body.
        </p>
      </div>

    </div>
  );
}
