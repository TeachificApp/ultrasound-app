/*
  DIY Accreditation™ — Organization Registration
  Step 1: Select plan → Step 2: Org details → Step 3: Confirmation
  Brand: Teal #189aa1, Aqua #4ad9e0, Dark Navy #0e1e2e
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import {
  Shield, Zap, Star, Crown, Check, ChevronRight,
  Building2, Phone, Globe, ClipboardList, Users,
  CheckCircle2, Loader2, AlertCircle, ArrowLeft
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";
const NAVY = "#0e1e2e";
const BRAND_DARK = "#0e4a50";

const PLANS = [
  {
    id: "starter" as const,
    name: "Accreditation Starter",
    price: "$397/mo",
    tagline: "Begin your accreditation journey",
    icon: Shield,
    seats: { labAdmins: 1, members: 4, total: 5 },
    highlight: ["1 Lab Admin", "4 DIY Members", "Workflow management", "Policy upload"],
  },
  {
    id: "professional" as const,
    name: "Accreditation Professional",
    price: "$997/mo",
    tagline: "Structured QA/QI for growing labs",
    icon: Zap,
    popular: true,
    seats: { labAdmins: 2, members: 13, total: 15 },
    highlight: ["2 Lab Admins", "13 DIY Members", "Analytics & reporting", "Policy Builder", "IAC-ready PDFs"],
  },
  {
    id: "advanced" as const,
    name: "Accreditation Advanced",
    price: "$1,697/mo",
    tagline: "Multi-site & large lab solution",
    icon: Star,
    seats: { labAdmins: 5, members: 45, total: 50 },
    highlight: ["5 Lab Admins", "45 DIY Members", "Multi-site support", "Advanced analytics"],
  },
  {
    id: "partner" as const,
    name: "Accreditation Partner",
    price: "$2,497/mo",
    tagline: "Unlimited seats + expert guidance",
    icon: Crown,
    seats: { labAdmins: 10, members: null, total: null },
    highlight: ["10 Lab Admins", "Unlimited Members", "Expert consulting", "Dedicated account manager"],
  },
] as const;

type PlanId = typeof PLANS[number]["id"];
type AccredType = "adult_echo" | "pediatric_fetal_echo";

export default function DIYRegister() {
  const { isAuthenticated, user, loading } = useAuth();
  const [, navigate] = useLocation();
  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);

  // Org form state
  const [orgName, setOrgName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [accredTypes, setAccredTypes] = useState<AccredType[]>([]);

  // Result state
  const [createdOrgId, setCreatedOrgId] = useState<number | null>(null);

  const createOrg = trpc.diy.createOrg.useMutation({
    onSuccess: (data) => {
      setCreatedOrgId(data.orgId);
      setStep(3);
    },
    onError: (err) => {
      toast.error(`Registration failed: ${err.message}`);
    },
  });

  // ── Auth guard ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `${BRAND}18` }}>
            <Shield className="w-7 h-7" style={{ color: BRAND }} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Sign in to Register Your Organization</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            You need a free iHeartEcho™ account to create a DIY Accreditation organization.
          </p>
          <a href="/login">
            <Button style={{ background: BRAND }} className="text-white">Sign In / Create Account</Button>
          </a>
        </div>
      </Layout>
    );
  }

  // ── Step indicators ──────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: "Select Plan" },
    { n: 2, label: "Organization Details" },
    { n: 3, label: "Confirmation" },
  ];

  // ── Step 1: Plan selection ───────────────────────────────────────────────────
  const renderStep1 = () => (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-1">Choose Your Plan</h2>
      <p className="text-sm text-gray-500 mb-6">Select the tier that fits your lab's size and needs.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const selected = selectedPlan === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                selected ? "border-[#189aa1] shadow-md" : "border-gray-200"
              } ${"popular" in plan && plan.popular ? "ring-1 ring-[#189aa1]/30" : ""}`}
            >
              {"popular" in plan && plan.popular && (
                <div className="absolute -top-2.5 left-4">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: BRAND }}>Most Popular</span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${BRAND}18` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: BRAND }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-gray-800 leading-tight">{plan.name}</p>
                    {selected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.tagline}</p>
                  <p className="text-sm font-bold mt-1.5" style={{ color: BRAND }}>{plan.price}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {plan.highlight.slice(0, 3).map((f) => (
                      <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          disabled={!selectedPlan}
          onClick={() => setStep(2)}
          style={{ background: selectedPlan ? BRAND : undefined }}
          className={selectedPlan ? "text-white" : ""}
        >
          Continue <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <p className="text-xs text-gray-400 mt-3 text-center">
        After registration, you'll be directed to complete payment via our secure checkout.
      </p>
    </div>
  );

  // ── Step 2: Org details ──────────────────────────────────────────────────────
  const renderStep2 = () => {
    const plan = PLANS.find((p) => p.id === selectedPlan)!;
    const toggleAccred = (t: AccredType) => {
      setAccredTypes((prev) =>
        prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
      );
    };

    return (
      <div>
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to plan selection
        </button>

        {/* Selected plan summary */}
        <div className="flex items-center gap-3 p-3 rounded-xl mb-6"
          style={{ background: `${BRAND}10`, border: `1px solid ${BRAND}30` }}>
          <plan.icon className="w-5 h-5 flex-shrink-0" style={{ color: BRAND }} />
          <div>
            <p className="text-sm font-bold text-gray-800">{plan.name}</p>
            <p className="text-xs text-gray-500">{plan.price} · {plan.seats.labAdmins} Lab Admin{plan.seats.labAdmins > 1 ? "s" : ""} · {plan.seats.members === null ? "Unlimited" : plan.seats.members} Members</p>
          </div>
          <button onClick={() => setStep(1)} className="ml-auto text-xs font-medium" style={{ color: BRAND }}>Change</button>
        </div>

        <h2 className="text-lg font-bold text-gray-800 mb-1">Organization Details</h2>
        <p className="text-sm text-gray-500 mb-5">Tell us about your lab or organization. You are registering as the SuperAdmin.</p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="orgName" className="text-sm font-medium text-gray-700">
              Organization / Lab Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Valley Cardiology Imaging Lab"
                className="pl-9"
                maxLength={300}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address" className="text-sm font-medium text-gray-700">Address (optional)</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State ZIP"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone (optional)</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="website" className="text-sm font-medium text-gray-700">Website (optional)</Label>
              <div className="relative mt-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourlab.com"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700">Accreditation Type(s) (optional)</Label>
            <p className="text-xs text-gray-400 mb-2">Select the accreditation programs you are pursuing.</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "adult_echo" as AccredType, label: "Adult Echocardiography" },
                { id: "pediatric_fetal_echo" as AccredType, label: "Pediatric/Fetal Echo" },
              ].map(({ id, label }) => {
                const active = accredTypes.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleAccred(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active ? "text-white border-transparent" : "text-gray-600 border-gray-200 bg-white hover:border-[#189aa1]"
                    }`}
                    style={active ? { background: BRAND, borderColor: BRAND } : {}}
                  >
                    {active && <Check className="w-3 h-3" />}
                    <ClipboardList className="w-3 h-3" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SuperAdmin note */}
          <div className="flex items-start gap-2 p-3 rounded-lg text-xs"
            style={{ background: `${BRAND}08`, border: `1px solid ${BRAND}20` }}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
            <p className="text-gray-600">
              You ({user?.email ?? user?.name}) will be registered as the <strong>SuperAdmin</strong> of this organization.
              The SuperAdmin role occupies one of your plan's Lab Admin seats and cannot be transferred.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            disabled={orgName.trim().length < 2 || createOrg.isPending}
            onClick={() =>
              createOrg.mutate({
                name: orgName.trim(),
                address: address.trim() || undefined,
                phone: phone.trim() || undefined,
                website: website.trim() || undefined,
                accreditationTypes: accredTypes.length > 0 ? accredTypes : undefined,
                plan: selectedPlan!,
              })
            }
            style={{ background: orgName.trim().length >= 2 ? BRAND : undefined }}
            className={orgName.trim().length >= 2 ? "text-white" : ""}
          >
            {createOrg.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating Organization…</>
            ) : (
              <>Register Organization <ChevronRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // ── Step 3: Confirmation ─────────────────────────────────────────────────────
  const renderStep3 = () => {
    const plan = PLANS.find((p) => p.id === selectedPlan)!;
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: `${BRAND}18` }}>
          <CheckCircle2 className="w-8 h-8" style={{ color: BRAND }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Organization Registered!</h2>
        <p className="text-sm text-gray-500 mb-1">
          <strong>{orgName}</strong> has been created with the <strong>{plan.name}</strong> plan.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          You are now the SuperAdmin. Complete your subscription payment to activate your seats.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <a href={
            selectedPlan === "starter" ? "https://member.allaboutultrasound.com/enroll/3706401?price_id=4655411"
            : selectedPlan === "professional" ? "https://member.allaboutultrasound.com/enroll/3706397?price_id=4655406"
            : selectedPlan === "advanced" ? "https://member.allaboutultrasound.com/enroll/3706392?price_id=4655402"
            : "https://member.allaboutultrasound.com/enroll/3706344?price_id=4655349"
          } target="_blank" rel="noopener noreferrer">
            <Button style={{ background: BRAND }} className="text-white w-full sm:w-auto">
              Complete Payment →
            </Button>
          </a>
          <Link href="/diy-lab-admin">
            <Button variant="outline" className="w-full sm:w-auto">
              Go to Lab Admin Portal
            </Button>
          </Link>
        </div>

        <div className="p-4 rounded-xl text-left max-w-sm mx-auto"
          style={{ background: `${BRAND}08`, border: `1px solid ${BRAND}20` }}>
          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" style={{ color: BRAND }} /> Your Seat Allotment
          </p>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Lab Admin seats (incl. SuperAdmin)</span>
              <span className="font-bold">{plan.seats.labAdmins}</span>
            </div>
            <div className="flex justify-between">
              <span>DIY Member seats</span>
              <span className="font-bold">{plan.seats.members === null ? "Unlimited" : plan.seats.members}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
              <span>Total seats</span>
              <span className="font-bold">{plan.seats.total === null ? "Unlimited" : plan.seats.total}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* Hero */}
      <div className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BRAND_DARK} 60%, ${BRAND} 100%)` }}>
        <div className="container py-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: AQUA }} />
            <span className="text-xs text-white/80 font-medium">DIY Accreditation™ Registration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white mb-2" style={{ fontFamily: "Merriweather, serif" }}>
            Register Your Organization
          </h1>
          <p className="text-white/70 text-sm max-w-md mx-auto">
            Set up your DIY Accreditation™ organization in 2 steps. You'll be the SuperAdmin with full control over seats and workflow.
          </p>
        </div>
      </div>

      {/* Step progress */}
      <div className="bg-white border-b border-gray-100">
        <div className="container py-4">
          <div className="flex items-center justify-center gap-2">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  step === s.n
                    ? "text-white"
                    : step > s.n
                    ? "text-white"
                    : "text-gray-400 bg-gray-100"
                }`}
                  style={step >= s.n ? { background: BRAND } : {}}>
                  {step > s.n ? <Check className="w-3 h-3" /> : <span>{s.n}</span>}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="container py-10">
        <div className="max-w-2xl mx-auto">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 md:p-8">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </CardContent>
          </Card>

          {step !== 3 && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Already have an organization?{" "}
              <Link href="/diy-lab-admin" className="underline" style={{ color: BRAND }}>Go to Lab Admin Portal</Link>
              {" · "}
              <Link href="/diy-accreditation-plans" className="underline" style={{ color: BRAND }}>View all plans</Link>
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
