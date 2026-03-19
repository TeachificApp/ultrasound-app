/**
 * EducatorAssist.tsx — Marketing & Pricing Page
 *
 * Visibility gate:
 *   - When `educatorPlatformVisible` flag is false → only platform_admin and
 *     education_manager can view this page.
 *   - When flag is true → visible to all users.
 *
 * The gate is controlled via the Platform Admin panel (toggle one flag).
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Users,
  BookOpen,
  BarChart3,
  CheckCircle2,
  Star,
  Zap,
  Building2,
  Globe,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Lock,
  ChevronRight,
  Award,
  ClipboardList,
  Video,
  FileQuestion,
  Layers,
  TrendingUp,
} from "lucide-react";

// ─── Pricing tiers ────────────────────────────────────────────────────────────
const TIERS = [
  {
    id: "individual",
    name: "Individual Educator",
    price: "$59.97",
    period: "/ month",
    tagline: "Perfect for independent educators, course creators, and conference instructors",
    icon: GraduationCap,
    color: "#189aa1",
    highlight: false,
    maxEducators: "1 educator",
    maxStudents: "Up to 50 learners",
    includes: [
      "Build challenges",
      "Upload cases",
      "Create modules",
      "Track learner progress",
      "Issue certificates",
      "Analytics dashboard",
    ],
  },
  {
    id: "program",
    name: "Sonography Program",
    price: "$199.97",
    period: "/ month",
    tagline: "Built for sonography schools, residency programs, and hospital training departments",
    icon: Building2,
    color: "#0e4a50",
    highlight: true,
    maxEducators: "Up to 5 educators",
    maxStudents: "Up to 250 learners",
    includes: [
      "Everything in Individual",
      "Multi-educator team",
      "Competency tracking",
      "Cohort management",
      "Custom branding",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise / Health System",
    price: "Custom",
    period: "",
    tagline: "For large health systems, national programs, and conference organizations",
    icon: Globe,
    color: "#7c3aed",
    highlight: false,
    maxEducators: "Unlimited educators",
    maxStudents: "Unlimited learners",
    includes: [
      "Everything in Program",
      "Unlimited seats",
      "SSO / SAML integration",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

// ─── Feature highlights ───────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Layers,
    title: "Course Builder",
    description: "Create structured learning paths with modules, lessons, and assessments — all within All About Ultrasound™.",
  },
  {
    icon: FileQuestion,
    title: "Challenge Bank",
    description: "Build custom Daily Challenge question banks for your learners, with MCQ, image-based, and scenario questions.",
  },
  {
    icon: Video,
    title: "Case Library",
    description: "Upload and curate ultrasound cases for your cohort — image, video, and clinical scenario formats supported.",
  },
  {
    icon: ClipboardList,
    title: "Competency Tracking",
    description: "Track learner progress against ARDMS, SDMS, and custom competency frameworks with real-time dashboards.",
  },
  {
    icon: Award,
    title: "Certificates",
    description: "Issue branded completion certificates and CME credits directly from your educator dashboard.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Detailed engagement analytics — question accuracy, case views, module completion rates, and cohort benchmarks.",
  },
];

// ─── Gate component ───────────────────────────────────────────────────────────
function AdminOnlyGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { data: flagData, isLoading: flagLoading } = trpc.educator.getPlatformVisible.useQuery();
  if (loading || flagLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
      </div>
    );
  }
  const isVisible = flagData?.visible === true;
  const isAdmin =
    (user as any)?.appRoles?.includes("platform_admin") ||
    (user as any)?.appRoles?.includes("education_manager") ||
    (user as any)?.role === "admin";
  if (!isVisible && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}
            >
              <Lock className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              Coming Soon
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              EducatorAssist™ is currently in private preview. Contact us to learn more about early access.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" className="w-full gap-2">
              <ArrowRight className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EducatorAssist() {
  const { user } = useAuth();
  const { data: flagData } = trpc.educator.getPlatformVisible.useQuery();

  useEffect(() => {
    document.title = "EducatorAssist™ — All About Ultrasound™ | Clinical Education Platform";
    const desc = document.querySelector('meta[name="description"]');
    if (desc)
      desc.setAttribute(
        "content",
        "EducatorAssist™ by All About Ultrasound™ — the clinical education platform for sonographers, ultrasound labs, and imaging programs. Build courses, track competencies, and manage learner progress."
      );
  }, []);

  const isAdmin =
    (user as any)?.appRoles?.includes("platform_admin") ||
    (user as any)?.appRoles?.includes("education_manager") ||
    (user as any)?.role === "admin";

  return (
    <AdminOnlyGate>
      <Layout>
        {/* ── Admin preview banner ─────────────────────────────────────────── */}
        {isAdmin && flagData?.visible === false && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Admin Preview:</strong> EducatorAssist™ is currently hidden from public users. Only Platform Admins can see this page.
              </span>
            </div>
            <Link href="/platform-admin">
              <Button
                size="sm"
                variant="outline"
                className="text-amber-800 border-amber-300 hover:bg-amber-100 text-xs gap-1"
              >
                Manage Visibility <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        )}

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          <div className="relative container py-16 md:py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5">
                <GraduationCap className="w-3.5 h-3.5 text-[#4ad9e0]" />
                <span className="text-xs text-white/80 font-medium">Clinical Education Platform</span>
              </div>
              <h1
                className="text-4xl md:text-5xl font-black text-white leading-tight mb-4"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                EducatorAssist™
              </h1>
              <p className="text-xl text-[#4ad9e0] font-semibold mb-4">
                Build. Teach. Track. Certify.
              </p>
              <p className="text-white/70 text-base leading-relaxed mb-8 max-w-xl">
                The clinical education platform built for ultrasound educators, sonography schools, and hospital imaging programs. Create courses, track competencies, and manage learner progress — all within All About Ultrasound™.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="gap-2 font-semibold"
                  style={{ background: "#189aa1" }}
                  onClick={() => window.open("mailto:education@allaboutultrasound.com?subject=EducatorAssist%20Early%20Access", "_blank")}
                >
                  <GraduationCap className="w-4 h-4" />
                  Request Early Access
                </Button>
                <Button variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10">
                  <Star className="w-4 h-4" />
                  View Pricing
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Feature grid ─────────────────────────────────────────────────── */}
        <div className="container py-16">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-teal-50 text-[#189aa1] border-teal-200">Platform Features</Badge>
            <h2
              className="text-3xl font-bold text-gray-800 mb-4"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              Everything you need to teach ultrasound
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              EducatorAssist™ integrates directly with the All About Ultrasound™ platform — your learners use the same app, you get a powerful educator dashboard on top.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}
                >
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-gray-800 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pricing ──────────────────────────────────────────────────────── */}
        <div className="bg-gray-50 border-t border-gray-100 py-16">
          <div className="container">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-teal-50 text-[#189aa1] border-teal-200">Pricing</Badge>
              <h2
                className="text-3xl font-bold text-gray-800 mb-4"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                Plans for every educator
              </h2>
              <p className="text-gray-500">
                All plans include a 14-day free trial. No credit card required.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={`bg-white rounded-2xl p-6 border shadow-sm flex flex-col ${
                    tier.highlight
                      ? "border-[#189aa1] ring-2 ring-[#189aa1]/20 shadow-lg"
                      : "border-gray-200"
                  }`}
                >
                  {tier.highlight && (
                    <div className="text-center mb-4">
                      <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: "#189aa1" }}>
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: tier.color }}
                    >
                      <tier.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 text-sm">{tier.name}</div>
                      <div className="text-xs text-gray-400">{tier.maxEducators} · {tier.maxStudents}</div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <span className="text-3xl font-black text-gray-800">{tier.price}</span>
                    {tier.period && <span className="text-sm text-gray-400 ml-1">{tier.period}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-5 leading-relaxed">{tier.tagline}</p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {tier.includes.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#189aa1" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full gap-2 font-semibold"
                    variant={tier.highlight ? "default" : "outline"}
                    style={tier.highlight ? { background: "#189aa1" } : {}}
                    onClick={() =>
                      window.open(
                        `mailto:education@allaboutultrasound.com?subject=EducatorAssist%20${encodeURIComponent(tier.name)}%20Inquiry`,
                        "_blank"
                      )
                    }
                  >
                    {tier.price === "Custom" ? "Contact Sales" : "Start Free Trial"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats bar ────────────────────────────────────────────────────── */}
        <div
          className="py-12"
          style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}
        >
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { value: "11,000+", label: "Active Learners", icon: Users },
                { value: "300+", label: "Ultrasound Cases", icon: BookOpen },
                { value: "15", label: "Specialty Areas", icon: Zap },
                { value: "ARDMS / SDMS", label: "Aligned Frameworks", icon: TrendingUp },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="text-2xl font-black text-white">{s.value}</div>
                  <div className="text-xs text-[#4ad9e0]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <div className="container py-16 text-center">
          <GraduationCap className="w-12 h-12 mx-auto mb-4" style={{ color: "#189aa1" }} />
          <h2
            className="text-2xl font-bold text-gray-800 mb-3"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            Ready to transform how you teach ultrasound?
          </h2>
          <p className="text-gray-500 mb-6 max-w-xl mx-auto">
            Join the waitlist for early access. We're onboarding programs in batches — apply now to secure your spot.
          </p>
          <Button
            size="lg"
            className="gap-2 font-semibold"
            style={{ background: "#189aa1" }}
            onClick={() =>
              window.open(
                "mailto:education@allaboutultrasound.com?subject=EducatorAssist%20Early%20Access%20Request",
                "_blank"
              )
            }
          >
            <GraduationCap className="w-5 h-5" />
            Apply for Early Access
          </Button>
        </div>
      </Layout>
    </AdminOnlyGate>
  );
}
