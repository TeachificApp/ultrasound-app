/*
  DIY Accreditation™ — Public Landing/Sales Page
  For accreditation.iheartecho.com root route
  Brand: Teal #189aa1, Navy #0e1e2e, Aqua #4ad9e0
  No auth required — fully public
*/
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, CheckCircle2, ArrowRight, ChevronDown, ChevronUp,
  Users, ClipboardList, FileText, BarChart2, Star, Building2,
  BookOpen, Zap, Lock, Award, Globe, Clock, TrendingUp,
  CheckSquare, HeartPulse, Layers, Menu, X
} from "lucide-react";
import { getLoginUrl } from "@/_core/const";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";
const NAVY = "#0e1e2e";
const AQUA = "#4ad9e0";

// ─── Navigation ───────────────────────────────────────────────────────────────
function NavBar() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm leading-tight" style={{ fontFamily: "Merriweather, serif" }}>DIY Accreditation™</div>
            <div className="text-[10px] text-gray-400 leading-tight">by All About Ultrasound™</div>
          </div>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <a href="#features" className="hover:text-[#189aa1] transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-[#189aa1] transition-colors">How It Works</a>
          <a href="#pricing" className="hover:text-[#189aa1] transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-[#189aa1] transition-colors">FAQ</a>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href={getLoginUrl()} className="text-sm text-gray-600 hover:text-[#189aa1] transition-colors">Sign In</a>
          <Link href="/diy-accreditation-plans">
            <Button size="sm" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, color: "white" }} className="font-semibold shadow-sm">
              View Plans
            </Button>
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          <a href="#features" className="block text-sm text-gray-700 py-2" onClick={() => setOpen(false)}>Features</a>
          <a href="#how-it-works" className="block text-sm text-gray-700 py-2" onClick={() => setOpen(false)}>How It Works</a>
          <a href="#pricing" className="block text-sm text-gray-700 py-2" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#faq" className="block text-sm text-gray-700 py-2" onClick={() => setOpen(false)}>FAQ</a>
          <div className="pt-2 flex flex-col gap-2">
            <a href={getLoginUrl()} className="block text-center text-sm text-gray-600 border border-gray-200 rounded-lg py-2">Sign In</a>
            <Link href="/diy-accreditation-plans">
              <Button className="w-full font-semibold" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, color: "white" }}>
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative pt-24 pb-20 overflow-hidden" style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #0e3040 50%, #0a4a50 100%)` }}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, ${AQUA} 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${BRAND} 0%, transparent 40%)`
      }} />

      <div className="relative max-w-6xl mx-auto px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
          <Award className="w-3.5 h-3.5" style={{ color: AQUA }} />
          Powered by All About Ultrasound™ Clinical Intelligence
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
          The Smarter Path to<br />
          <span style={{ color: AQUA }}>Ultrasound Accreditation</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-white/75 max-w-2xl mx-auto mb-10 leading-relaxed">
          DIY Accreditation™ gives your echo lab everything it needs to achieve and maintain IAC accreditation — 
          workflow management, peer review, documentation, and expert guidance — all in one platform.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
          <Link href="/diy-accreditation-plans">
            <Button size="lg" className="font-bold text-base px-8 py-4 shadow-xl hover:shadow-2xl transition-all" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, color: "white" }}>
              <Shield className="w-5 h-5 mr-2" />
              Start Your Accreditation Journey
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/diy-register">
            <Button size="lg" variant="outline" className="font-semibold text-base px-8 py-4 border-white/30 text-white hover:bg-white/10">
              Register Your Lab
            </Button>
          </Link>
        </div>

        {/* Social proof strip */}
        <div className="flex flex-wrap justify-center gap-8 text-white/60 text-sm">
          {[
            { icon: Building2, label: "Used by echo labs nationwide" },
            { icon: Shield, label: "IAC protocol-aligned workflows" },
            { icon: Clock, label: "Streamlined accreditation process" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="w-4 h-4" style={{ color: AQUA }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 80L1440 80L1440 40C1200 0 960 80 720 40C480 0 240 80 0 40L0 80Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}

// ─── Feature highlights ───────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: ClipboardList,
    title: "Accreditation Workflow Management",
    desc: "Step-by-step IAC accreditation workflows with task assignments, deadline tracking, and progress dashboards. Never miss a requirement.",
    color: BRAND,
  },
  {
    icon: Users,
    title: "Lab Admin & Seat Management",
    desc: "Onboard your entire team with role-based access. Assign Lab Admins, sonographers, and reviewers — each with the right level of access.",
    color: "#7c3aed",
  },
  {
    icon: FileText,
    title: "Policy & Document Library",
    desc: "Centralized document management for policies, protocols, and accreditation submissions. Upload, version, and share with your team.",
    color: "#0891b2",
  },
  {
    icon: HeartPulse,
    title: "Peer Review & QA/QI Tracking",
    desc: "Structured peer review submission and tracking. Built-in quality assurance workflows that meet IAC standards.",
    color: "#dc2626",
  },
  {
    icon: BarChart2,
    title: "Analytics & Compliance Reporting",
    desc: "Real-time dashboards showing your accreditation readiness score, outstanding tasks, and compliance metrics across your lab.",
    color: "#d97706",
  },
  {
    icon: BookOpen,
    title: "EchoAccreditation Navigator™",
    desc: "Guided IAC protocol workflows with clinical reference checklists — helping your team understand exactly what accreditation requires.",
    color: "#059669",
  },
];

function Features() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-14">
          <Badge className="mb-4 text-xs font-semibold px-3 py-1" style={{ background: `${BRAND}15`, color: BRAND, border: `1px solid ${BRAND}30` }}>
            Platform Features
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: "Merriweather, serif" }}>
            Everything Your Lab Needs to Get Accredited
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            A complete accreditation management platform built specifically for echo labs pursuing IAC accreditation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-100 bg-white p-6 hover:shadow-lg transition-all hover:-translate-y-0.5 group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}15` }}>
                <f.icon className="w-6 h-6" style={{ color: f.color }} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-base">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    title: "Register Your Lab",
    desc: "Create your DIY Accreditation™ organization. Add your lab details, choose your accreditation type (IAC Echo, Vascular, or other), and invite your team.",
    icon: Building2,
  },
  {
    num: "02",
    title: "Follow the Guided Workflow",
    desc: "The EchoAccreditation Navigator™ walks you through every IAC requirement — from policies to case volumes to peer review — with step-by-step checklists.",
    icon: ClipboardList,
  },
  {
    num: "03",
    title: "Build Your Document Library",
    desc: "Upload policies, protocols, and supporting documentation. Track versions and ensure every required document is complete and current.",
    icon: FileText,
  },
  {
    num: "04",
    title: "Complete Peer Review & QA",
    desc: "Assign peer review cases, track completion, and generate QA/QI reports that demonstrate your lab's commitment to quality.",
    icon: HeartPulse,
  },
  {
    num: "05",
    title: "Submit with Confidence",
    desc: "Your accreditation readiness score shows you exactly where you stand. When you're ready, submit your application knowing every requirement is met.",
    icon: Award,
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20" style={{ background: "#f8fafb" }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-14">
          <Badge className="mb-4 text-xs font-semibold px-3 py-1" style={{ background: `${BRAND}15`, color: BRAND, border: `1px solid ${BRAND}30` }}>
            The Process
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: "Merriweather, serif" }}>
            How DIY Accreditation™ Works
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            A structured, guided process that takes the guesswork out of accreditation.
          </p>
        </div>

        <div className="relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute left-1/2 top-12 bottom-12 w-0.5 -translate-x-1/2" style={{ background: `linear-gradient(to bottom, ${BRAND}40, ${BRAND}10)` }} />

          <div className="space-y-8">
            {STEPS.map((step, i) => (
              <div key={step.num} className={`flex flex-col lg:flex-row gap-6 items-start lg:items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
                {/* Content */}
                <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${BRAND}15` }}>
                      <step.icon className="w-5 h-5" style={{ color: BRAND }} />
                    </div>
                    <div>
                      <div className="text-xs font-bold mb-1" style={{ color: BRAND }}>STEP {step.num}</div>
                      <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </div>

                {/* Center dot */}
                <div className="hidden lg:flex w-12 h-12 rounded-full border-4 border-white shadow-lg flex-shrink-0 items-center justify-center z-10" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
                  <span className="text-white text-xs font-bold">{step.num}</span>
                </div>

                {/* Spacer for alternating layout */}
                <div className="flex-1 hidden lg:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Accreditation types ──────────────────────────────────────────────────────
const ACCREDITATION_TYPES = [
  { name: "IAC Echo", desc: "Transthoracic, TEE, Stress, Pediatric, Fetal", icon: HeartPulse },
  { name: "IAC Vascular", desc: "Peripheral arterial, venous, cerebrovascular", icon: TrendingUp },
  { name: "IAC POCUS", desc: "Point-of-care ultrasound programs", icon: Zap },
  { name: "IAC Nuclear/PET", desc: "Nuclear cardiology and PET programs", icon: Layers },
];

function AccreditationTypes() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3" style={{ fontFamily: "Merriweather, serif" }}>
            Supported Accreditation Programs
          </h2>
          <p className="text-gray-500">DIY Accreditation™ supports all major IAC accreditation programs.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ACCREDITATION_TYPES.map((t) => (
            <div key={t.name} className="rounded-xl border border-gray-100 bg-white p-5 text-center hover:shadow-md transition-shadow hover:border-[#189aa1]/30">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: `${BRAND}12` }}>
                <t.icon className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <div className="font-bold text-gray-900 text-sm mb-1">{t.name}</div>
              <div className="text-xs text-gray-400 leading-snug">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing teaser ───────────────────────────────────────────────────────────
function PricingTeaser() {
  return (
    <section id="pricing" className="py-20" style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #0a3a45 100%)` }}>
      <div className="max-w-4xl mx-auto px-4 text-center">
        <Badge className="mb-6 text-xs font-semibold px-3 py-1.5 bg-white/10 text-white border-white/20">
          Flexible Plans
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-5" style={{ fontFamily: "Merriweather, serif" }}>
          Plans for Every Lab Size
        </h2>
        <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto">
          From small single-location clinics to large multi-site health systems — DIY Accreditation™ scales with your organization.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { name: "Starter", price: "$397", seats: "5 seats", color: "#6b7280" },
            { name: "Professional", price: "$997", seats: "15 seats", color: BRAND, popular: true },
            { name: "Advanced", price: "$1,997", seats: "30 seats", color: "#7c3aed" },
            { name: "Partner", price: "Custom", seats: "Unlimited", color: "#d97706" },
          ].map((plan) => (
            <div key={plan.name} className={`rounded-2xl p-5 text-center relative ${plan.popular ? "ring-2 ring-white/40" : ""}`} style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full text-white" style={{ background: BRAND }}>POPULAR</span>
                </div>
              )}
              <div className="font-bold text-white text-sm mb-1">{plan.name}</div>
              <div className="text-2xl font-bold mb-1" style={{ color: AQUA }}>{plan.price}</div>
              <div className="text-white/50 text-xs">{plan.seats}</div>
            </div>
          ))}
        </div>

        <Link href="/diy-accreditation-plans">
          <Button size="lg" className="font-bold text-base px-10 shadow-xl" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, color: "white" }}>
            View Full Pricing & Features
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

// ─── Benefits strip ───────────────────────────────────────────────────────────
const BENEFITS = [
  "No accreditation consultant fees",
  "IAC-aligned protocol checklists",
  "Centralized document management",
  "Structured peer review tracking",
  "Real-time readiness scoring",
  "Multi-site support",
  "Role-based team access",
  "Expert clinical content from All About Ultrasound™",
];

function BenefitsStrip() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3" style={{ fontFamily: "Merriweather, serif" }}>
            Why Labs Choose DIY Accreditation™
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BENEFITS.map((b) => (
            <div key={b} className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
              <span className="text-sm text-gray-700 font-medium">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is IAC accreditation?",
    a: "The Intersocietal Accreditation Commission (IAC) is a non-profit organization that accredits facilities in the performance and interpretation of diagnostic imaging. IAC accreditation demonstrates that your lab meets established standards for quality patient care.",
  },
  {
    q: "How does DIY Accreditation™ help with the IAC application process?",
    a: "DIY Accreditation™ provides structured workflows, checklists, and document management tools that guide your lab through every IAC requirement. The EchoAccreditation Navigator™ maps directly to IAC standards, so you always know exactly what's needed.",
  },
  {
    q: "Do I need an accreditation consultant?",
    a: "DIY Accreditation™ is designed to reduce or eliminate the need for expensive accreditation consultants. The platform provides expert guidance, protocol checklists, and workflow management — everything a consultant would provide, at a fraction of the cost.",
  },
  {
    q: "What accreditation programs are supported?",
    a: "DIY Accreditation™ currently supports IAC Echo (TTE, TEE, Stress, Pediatric, Fetal), IAC Vascular, IAC POCUS, and IAC Nuclear/PET programs.",
  },
  {
    q: "How many team members can I add?",
    a: "Plans range from 5 seats (Starter) to unlimited seats (Partner). Each plan includes a specific number of Lab Admin seats and Member seats. You can upgrade at any time.",
  },
  {
    q: "Is there a free trial?",
    a: "Contact us to discuss a trial or demo for your lab. We offer personalized onboarding for all Professional plans and above.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="py-20" style={{ background: "#f8fafb" }}>
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3" style={{ fontFamily: "Merriweather, serif" }}>
            Frequently Asked Questions
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <button
                className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-semibold text-gray-900 text-sm">{faq.q}</span>
                {open === i ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ──────────────────────────────────────────────────────────────
function CTASection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <div className="rounded-3xl p-10 md:p-14 shadow-2xl" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0a3a45 100%)` }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "Merriweather, serif" }}>
            Ready to Start Your Accreditation Journey?
          </h2>
          <p className="text-white/70 text-lg mb-8 max-w-lg mx-auto">
            Join echo labs across the country using DIY Accreditation™ to achieve and maintain IAC accreditation — without the consultant fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/diy-accreditation-plans">
              <Button size="lg" className="font-bold text-base px-8 shadow-xl" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, color: "white" }}>
                <Shield className="w-5 h-5 mr-2" />
                View Plans & Pricing
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/diy-register">
              <Button size="lg" variant="outline" className="font-semibold text-base px-8 border-white/30 text-white hover:bg-white/10">
                Register Your Lab
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-gray-900 text-white/60 py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">DIY Accreditation™</div>
              <div className="text-[10px] text-white/40">by All About Ultrasound™</div>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/diy-accreditation-plans" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/diy-register" className="hover:text-white transition-colors">Register</Link>
            <a href="https://allaboutultrasound.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">All About Ultrasound™</a>
          </div>
          <div className="text-xs text-white/30">
            © {new Date().getFullYear()} All About Ultrasound™. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function DIYAccreditationLanding() {
  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <Hero />
      <Features />
      <HowItWorks />
      <AccreditationTypes />
      <BenefitsStrip />
      <PricingTeaser />
      <FAQ />
      <CTASection />
      <Footer />
    </div>
  );
}
