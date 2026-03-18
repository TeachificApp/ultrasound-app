/*
  DIY Accreditation™ Plans & Pricing — iHeartEcho™
  4 tiers: Starter / Professional / Advanced / Partner
  Add-on: Accreditation Concierge™ ($4,997 one-time)
  Brand: Teal #189aa1, Aqua #4ad9e0, Dark Navy #0e1e2e
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield, Zap, Star, Crown, Check, Lock, Users, Building2,
  ClipboardList, FileText, BarChart2, BookOpen, ChevronDown,
  ChevronUp, ExternalLink
} from "lucide-react";
import { Link } from "wouter";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";
const AQUA = "#4ad9e0";
const NAVY = "#0e1e2e";

// ─── Plan Definitions ─────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "starter",
    name: "Accreditation Starter",
    price: "$397",
    period: "/mo",
    tagline: "Begin your accreditation journey",
    bestFor: "Small labs, new echo labs, or single-location clinics beginning the accreditation process.",
    icon: Shield,
    color: "#6b7280",
    popular: false,
    seats: {
      total: 5,
      labAdmins: 1,
      members: 4,
    },
    features: [
      "1 Accreditation Lab Admin",
      "4 DIY Member profiles",
      "Accreditation workflow management",
      "Policy & documentation upload",
      "Case review assignment",
      "Staff access management",
      "DIY Member task participation",
      "Peer review submission",
      "Limited analytics & reporting (no drill-downs or export)",
    ],
    checkoutUrl: "https://member.allaboutultrasound.com/enroll/3706401?price_id=4655411",
  },
  {
    id: "professional",
    name: "Accreditation Professional",
    price: "$997",
    period: "/mo",
    tagline: "Structured QA/QI for growing labs",
    bestFor: "Growing labs implementing structured QA/QI and peer review programs.",
    icon: Zap,
    color: BRAND,
    popular: true,
    seats: {
      total: 15,
      labAdmins: 2,
      members: 13,
    },
    features: [
      "2 Accreditation Lab Admins",
      "13 DIY Member profiles",
      "All Starter features",
      "Full analytics & reporting dashboard",
      "Analytics drill-downs & PDF/CSV export",
      "Automated Quality Improvement management",
      "Quality Meeting tool",
      "Policy Builder",
      "Case Studies manager",
      "DIY Accreditation Readiness tracker",
      "IAC-ready PDF bundles",
      "Lab Admin — iHeartEcho™ App access included",
    ],
    checkoutUrl: "https://member.allaboutultrasound.com/enroll/3706397?price_id=4655406",
  },
  {
    id: "advanced",
    name: "Accreditation Advanced",
    price: "$1,697",
    period: "/mo",
    tagline: "Multi-site & large lab solution",
    bestFor: "Large labs, multi-site organizations, hospital departments, and IDTF groups.",
    icon: Star,
    color: BRAND,
    popular: false,
    seats: {
      total: 50,
      labAdmins: 5,
      members: 45,
    },
    features: [
      "5 Accreditation Lab Admins",
      "45 DIY Member profiles",
      "All Professional features",
      "Multi-site workflow support",
      "Advanced analytics & benchmarking",
      "Dedicated policy library",
      "Priority support",
      "All Lab Admins — iHeartEcho™ App access included",
      "Accreditation Concierge™ add-on available",
    ],
    checkoutUrl: "https://member.allaboutultrasound.com/enroll/3706392?price_id=4655402",
  },
  {
    id: "partner",
    name: "Accreditation Partner",
    price: "$2,497",
    period: "/mo",
    tagline: "Unlimited seats + expert guidance",
    bestFor: "Labs that want ongoing expert guidance while using the platform.",
    icon: Crown,
    color: BRAND,
    popular: false,
    seats: {
      total: null, // unlimited
      labAdmins: 10,
      members: null, // unlimited
    },
    features: [
      "Up to 10 Accreditation Lab Admins",
      "Unlimited DIY Member profiles",
      "All Advanced features",
      "Personalized accreditation consulting",
      "Monthly Accreditation Advisory Meeting",
      "Expert guidance on policies & procedures",
      "Accreditation readiness monitoring & review",
      "Dedicated account manager",
      "All Lab Admins — iHeartEcho™ App access included",
      "Accreditation Concierge™ add-on available",
    ],
    checkoutUrl: "https://member.allaboutultrasound.com/enroll/3706344?price_id=4655349",
  },
] as const;

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is the difference between a Lab Admin and a DIY Member?",
    a: "Lab Admins manage the accreditation workflow — they upload policies, assign case reviews, manage staff access, and access analytics and reporting. DIY Members participate in case reviews, submit documentation, and complete workflow tasks. Lab Admins also receive full iHeartEcho™ App access as part of their Accreditation Subscription.",
  },
  {
    q: "What is the SuperAdmin role?",
    a: "Each organization has exactly one SuperAdmin — the account owner who subscribes. The SuperAdmin has full control over org settings, billing, and can invite/revoke Lab Admins. The SuperAdmin seat counts as one of the Lab Admin seats in your plan.",
  },
  {
    q: "Can a DIY Member also access iHeartEcho™ Premium features?",
    a: "Yes. DIY Members can independently upgrade to a Premium App subscription. Multiple membership types are supported — a user can be both a DIY Member and a Premium subscriber.",
  },
  {
    q: "What happens when I reach my seat limit?",
    a: "You will not be able to invite additional members once you reach your plan's seat limit. Upgrade to a higher tier to increase your seat allotment.",
  },
  {
    q: "Do I get access to iHeartEcho™ app features?",
    a: "All DIY Accreditation subscribers get access to the DIY tools. Lab Admins additionally receive full iHeartEcho™ App access as part of their Accreditation Subscription. DIY Members have free-tier app access unless they independently upgrade.",
  },
];

export default function DIYAccreditationPlans() {
  const { isAuthenticated } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <Layout>
      {/* Hero */}
      <div className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BRAND_DARK} 60%, ${BRAND} 100%)` }}>
        <div className="container py-14 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: AQUA }} />
            <span className="text-xs text-white/80 font-medium">IAC Accreditation Support Platform</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-3" style={{ fontFamily: "Merriweather, serif" }}>
            DIY Accreditation™ Plans
          </h1>
          <p className="text-white/70 max-w-xl mx-auto text-sm leading-relaxed mb-6">
            Everything your lab needs to prepare for, manage, and submit your IAC accreditation application —
            from structured workflows to expert-guided consulting.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white/80">
              <ClipboardList className="w-3.5 h-3.5" style={{ color: AQUA }} />
              Workflow Management
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white/80">
              <FileText className="w-3.5 h-3.5" style={{ color: AQUA }} />
              Policy Builder
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white/80">
              <BarChart2 className="w-3.5 h-3.5" style={{ color: AQUA }} />
              Analytics & Reporting
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white/80">
              <BookOpen className="w-3.5 h-3.5" style={{ color: AQUA }} />
              Case Studies
            </div>
          </div>
        </div>
      </div>

      {/* Role overview */}
      <div className="bg-white border-b border-gray-100">
        <div className="container py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Crown,
                role: "SuperAdmin",
                color: BRAND,
                desc: "1 per organization. Full org control: billing, settings, Lab Admin management. Counts as 1 Lab Admin seat.",
              },
              {
                icon: Shield,
                role: "Lab Admin",
                color: BRAND,
                desc: "Manage workflows, upload policies, assign tasks, manage staff, access analytics. Includes iHeartEcho™ App access.",
              },
              {
                icon: Users,
                role: "DIY Member",
                color: "#6b7280",
                desc: "Participate in case reviews, submit documentation, complete workflow tasks. Free-tier app access (upgradeable).",
              },
            ].map(({ icon: Icon, role, color, desc }) => (
              <div key={role} className="flex items-start gap-3 p-4 rounded-xl border border-gray-100">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{role}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="container py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div key={plan.id}
                className={`relative rounded-2xl border-2 flex flex-col overflow-hidden transition-shadow hover:shadow-lg ${
                  plan.popular ? "border-[#189aa1] shadow-md" : "border-gray-200"
                }`}>
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 text-center text-xs font-bold text-white py-1"
                    style={{ background: BRAND }}>
                    Most Popular
                  </div>
                )}
                <div className={`p-6 ${plan.popular ? "pt-8" : ""}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${plan.color}18` }}>
                      <Icon className="w-5 h-5" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm leading-tight">{plan.name}</h3>
                      <p className="text-xs text-gray-500">{plan.tagline}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-3xl font-black" style={{ color: plan.color }}>{plan.price}</span>
                    <span className="text-gray-500 text-sm">{plan.period}</span>
                  </div>

                  {/* Seats */}
                  <div className="p-3 rounded-xl mb-4" style={{ background: `${plan.color}10` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-3.5 h-3.5" style={{ color: plan.color }} />
                      <span className="text-xs font-bold" style={{ color: plan.color }}>
                        {plan.seats.total ? `${plan.seats.total} Total Seats` : "Unlimited Seats"}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-xs text-gray-600">
                      <p>• {plan.seats.labAdmins} Lab Admin{plan.seats.labAdmins > 1 ? "s" : ""} (incl. SuperAdmin)</p>
                      <p>• {plan.seats.members ? `${plan.seats.members} DIY Members` : "Unlimited DIY Members"}</p>
                    </div>
                  </div>

                  {/* Best for */}
                  <p className="text-xs text-gray-500 italic mb-4 leading-relaxed">{plan.bestFor}</p>

                  {/* CTA */}
                  <a href={plan.checkoutUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Button className="w-full text-white font-semibold"
                      style={{ background: plan.popular ? BRAND : plan.color }}>
                      Get Started <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </a>
                </div>

                {/* Features */}
                <div className="border-t border-gray-100 p-6 flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Includes</p>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                        <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Accreditation Concierge™ is shown only to Professional+ Lab Admins in the Lab Admin Portal */}

        {/* Feature comparison table */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-center mb-6" style={{ fontFamily: "Merriweather, serif", color: NAVY }}>
            Plan Comparison
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: NAVY }}>
                  <th className="text-left py-3 px-4 text-white/70 font-medium text-xs">Feature</th>
                  <th className="text-center py-3 px-3 text-white text-xs font-bold">Starter</th>
                  <th className="text-center py-3 px-3 text-xs font-bold" style={{ color: AQUA }}>Professional</th>
                  <th className="text-center py-3 px-3 text-white text-xs font-bold">Advanced</th>
                  <th className="text-center py-3 px-3 text-amber-300 text-xs font-bold">Partner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ["Lab Admin Seats", "1", "2", "5", "10"],
                  ["DIY Member Seats", "4", "13", "45", "Unlimited"],
                  ["Total Seats", "5", "15", "50", "Unlimited"],
                  ["Workflow Management", true, true, true, true],
                  ["Policy Upload & Builder", true, true, true, true],
                  ["Case Review Assignment", true, true, true, true],
                  ["Analytics & Reporting", "Limited", true, true, true],
                  ["Analytics Drill-downs & Export", false, true, true, true],
                  ["Automated QI Management", false, true, true, true],
                  ["Quality Meeting Tool", false, true, true, true],
                  ["Case Studies Manager", false, true, true, true],
                  ["DIY Readiness Tracker", false, true, true, true],
                  ["IAC-Ready PDF Bundles", false, true, true, true],
                  ["Lab Admin — iHeartEcho™ App Access", true, true, true, true],
                  ["Expert Consulting", false, false, false, true],
                  ["Monthly Advisory Meeting", false, false, false, true],
                  ["Accreditation Concierge™ Add-on", false, false, true, true],
                ].map(([label, s, p, a, pa]) => (
                  <tr key={label as string} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4 text-gray-700 text-xs font-medium">{label as string}</td>
                    {[s, p, a, pa].map((val, i) => (
                      <td key={i} className="text-center py-2.5 px-3">
                        {typeof val === "boolean" ? (
                          val ? (
                            <Check className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <span className="text-gray-300 text-lg">—</span>
                          )
                        ) : val === "Limited" ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700">⚠ Limited</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-700">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-6" style={{ fontFamily: "Merriweather, serif", color: NAVY }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  {faq.q}
                  {openFaq === i ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 rounded-2xl p-8 text-center"
          style={{ background: `linear-gradient(135deg, ${NAVY}, ${BRAND_DARK})` }}>
          <h3 className="text-xl font-black text-white mb-2" style={{ fontFamily: "Merriweather, serif" }}>
            Already have a subscription?
          </h3>
          <p className="text-white/60 text-sm mb-5">
            Access your Lab Admin portal to manage your team, workflows, and accreditation progress.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button style={{ background: BRAND, color: "white" }} asChild>
              <Link href="/diy-lab-admin">Open Lab Admin Portal</Link>
            </Button>
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
              <Link href="/diy-member">Member Portal</Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
