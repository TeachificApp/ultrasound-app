/*
  DIY Accreditation Member Portal — iHeartEcho™
  Access: diy_member role (and above)
  Shows: org info, assigned tasks, workflow access, upgrade prompts for restricted features
  Brand: Teal #189aa1, Aqua #4ad9e0, Dark Navy #0e1e2e
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import {
  Building2, Users, CheckCircle, Lock, Loader2, ChevronRight,
  FileText, ClipboardList, BookOpen, BarChart2, Shield, Star,
  AlertTriangle, UserCheck, Zap, ArrowRight, ClipboardCheck
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";
const AQUA = "#4ad9e0";
const NAVY = "#0e1e2e";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SuperAdmin",
  lab_admin: "Lab Admin",
  diy_member: "DIY Member",
};

// Features available to DIY Members
const MEMBER_FEATURES = [
  {
    icon: ClipboardList,
    title: "Workflow Tasks",
    description: "Complete assigned accreditation workflow tasks and submit required documentation.",
    available: true,
    link: "/lab-admin?tab=quality",
  },
  {
    icon: FileText,
    title: "Case Review Participation",
    description: "Participate in peer case reviews and submit your review findings.",
    available: true,
    link: "/lab-admin?tab=quality",
  },
  {
    icon: BookOpen,
    title: "Policy Library",
    description: "View and acknowledge required lab policies and procedures.",
    available: true,
    link: "/lab-admin?tab=organization&sub=policy",
  },
];

// Features restricted to Lab Admin / SuperAdmin
const RESTRICTED_FEATURES = [
  {
    icon: BarChart2,
    title: "Analytics Dashboard",
    description: "Lab-wide quality score trends, staff performance analytics, and monthly summaries.",
    requiredRole: "Lab Admin",
  },
  {
    icon: Shield,
    title: "Policy Builder",
    description: "Create and manage lab policies, upload documentation, and track acknowledgements.",
    requiredRole: "Lab Admin",
  },
  {
    icon: BookOpen,
    title: "Case Studies Manager",
    description: "Identify and manage IAC case submission candidates from your quality reviews.",
    requiredRole: "Lab Admin",
  },
  {
    icon: CheckCircle,
    title: "Accreditation Readiness",
    description: "Track your lab's readiness score and checklist progress toward IAC accreditation.",
    requiredRole: "Lab Admin",
  },
];

export default function DIYMemberPortal() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [inviteToken, setInviteToken] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  const { data: myContext, isLoading, refetch } = trpc.diy.getMyContext.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const acceptInviteMutation = trpc.diy.acceptInvite.useMutation({
    onSuccess: (data) => {
      toast.success(`Welcome! You've joined as a ${ROLE_LABELS[data.diyRole] ?? data.diyRole}.`);
      setInviteToken("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAcceptInvite = async () => {
    if (!inviteToken.trim()) return;
    setIsAccepting(true);
    try {
      await acceptInviteMutation.mutateAsync({ inviteToken: inviteToken.trim() });
    } finally {
      setIsAccepting(false);
    }
  };

  if (authLoading || isLoading) {
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
        <div className="container py-16 text-center max-w-md mx-auto">
          <Lock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
          <p className="text-gray-500 mb-4">Please sign in to access your DIY Accreditation member portal.</p>
          <Button style={{ background: BRAND, color: "white" }} asChild>
            <a href="/login">Sign In</a>
          </Button>
        </div>
      </Layout>
    );
  }

  // No membership — show invite token entry + upgrade CTA
  if (!myContext) {
    return (
      <Layout>
        <div className="container py-10 max-w-2xl mx-auto space-y-6">
          {/* Invite token entry */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="w-4 h-4" style={{ color: BRAND }} />
                Accept an Invitation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                If your Lab Admin has sent you an invitation, enter your invite token below to join your organization.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter invite token"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleAcceptInvite}
                  disabled={!inviteToken.trim() || isAccepting}
                  style={{ background: BRAND, color: "white" }}
                >
                  {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* No subscription — upgrade CTA */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: `${BRAND}18` }}>
                  <Building2 className="w-8 h-8" style={{ color: BRAND }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "Merriweather, serif", color: NAVY }}>
                  Start Your Accreditation Journey
                </h3>
                <p className="text-gray-500 text-sm mb-4 max-w-sm mx-auto">
                  Subscribe to a DIY Accreditation plan to create your organization and begin the accreditation process.
                </p>
                <Button style={{ background: BRAND, color: "white" }} asChild>
                  <Link href="/diy-accreditation-plans">
                    View Plans &amp; Pricing <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const { membership, org, subscription: sub } = myContext;
  const isLabAdmin = membership.diyRole === "super_admin" || membership.diyRole === "lab_admin";

  // Fetch dynamic form menu items assigned to this org's form types
  const { data: dynamicForms } = trpc.formBuilder.getFormMenuItems.useQuery(
    { orgId: org?.id },
    { enabled: isAuthenticated }
  );
  const [activeDynamicForm, setActiveDynamicForm] = useState<{ templateId: number; formType: string; name: string } | null>(null);

  return (
    <Layout>
      {/* Header */}
      <div className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BRAND_DARK} 60%, ${BRAND} 100%)` }}>
        <div className="container py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.15)" }}>
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                  DIY Member Portal
                </h1>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/90">
                  {ROLE_LABELS[membership.diyRole] ?? membership.diyRole}
                </span>
              </div>
              <p className="text-white/70 text-sm">{org?.name}</p>
              {sub && (
                <p className="text-xs mt-1" style={{ color: AQUA }}>
                  {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} Plan
                  {sub.hasConcierge && " · Concierge Active"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Lab Admin redirect banner */}
        {isLabAdmin && (
          <div className="p-4 rounded-xl border border-[#189aa1]/30 bg-[#189aa1]/5 flex items-center gap-3">
            <Shield className="w-5 h-5 flex-shrink-0" style={{ color: BRAND }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: BRAND_DARK }}>
                You have Lab Admin access
              </p>
              <p className="text-xs text-gray-600">
                Access the full Lab Admin portal for analytics, policy management, and staff oversight.
              </p>
            </div>
            <Button size="sm" style={{ background: BRAND, color: "white" }} asChild>
              <Link href="/lab-admin">
                Open Lab Admin <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        )}

        {/* Dynamic form renderer overlay */}
        {activeDynamicForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  {activeDynamicForm.name}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setActiveDynamicForm(null)}>✕</Button>
              </div>
              <div className="p-4">
                <DynamicFormRenderer
                  templateId={activeDynamicForm.templateId}
                  formType={activeDynamicForm.formType}
                  onSubmitted={() => setActiveDynamicForm(null)}
                  onCancel={() => setActiveDynamicForm(null)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Available features */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-3">Your Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {MEMBER_FEATURES.map(({ icon: Icon, title, description, link }) => (
              <Link key={title} href={link}>
                <div className="group p-4 rounded-xl border border-gray-200 hover:border-[#189aa1] hover:bg-[#189aa1]/5 transition-all cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: `${BRAND}18` }}>
                      <Icon className="w-4.5 h-4.5" style={{ color: BRAND }} />
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 mb-1">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
                  <div className="flex items-center gap-1 text-xs font-semibold mt-3 group-hover:gap-2 transition-all"
                    style={{ color: BRAND }}>
                    Open <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Dynamic forms from Form Builder */}
          {dynamicForms && dynamicForms.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              {dynamicForms.map((form) => (
                <button
                  key={form.id}
                  onClick={() => setActiveDynamicForm({ templateId: form.templateId, formType: form.formType, name: form.templateName })}
                  className="group p-4 rounded-xl border border-gray-200 hover:border-[#189aa1] hover:bg-[#189aa1]/5 transition-all cursor-pointer text-left h-full"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${BRAND}18` }}>
                      <ClipboardCheck className="w-4 h-4" style={{ color: BRAND }} />
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 mb-1">{form.templateName}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{form.formType.replace(/_/g, " ")}</p>
                  <div className="flex items-center gap-1 text-xs font-semibold mt-3 group-hover:gap-2 transition-all" style={{ color: BRAND }}>
                    Open Form <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Restricted features */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-1">Lab Admin Features</h2>
          <p className="text-xs text-gray-500 mb-3">These features require Lab Admin or SuperAdmin access.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RESTRICTED_FEATURES.map(({ icon: Icon, title, description, requiredRole }) => (
              <div key={title} className="p-4 rounded-xl border border-gray-200 bg-gray-50 opacity-75">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-200">
                    <Icon className="w-4.5 h-4.5 text-gray-400" />
                  </div>
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
                <h3 className="text-sm font-bold text-gray-600 mb-1">{title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-2">{description}</p>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">
                  Requires {requiredRole}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade CTA (for members who want to become Lab Admin) */}
        {!isLabAdmin && (
          <div className="rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: `linear-gradient(135deg, ${NAVY}, ${BRAND_DARK})` }}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4" style={{ color: AQUA }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: AQUA }}>
                  Unlock Full Access
                </span>
              </div>
              <h3 className="text-white font-bold text-base mb-1" style={{ fontFamily: "Merriweather, serif" }}>
                Need Lab Admin access?
              </h3>
              <p className="text-white/60 text-xs">
                Ask your SuperAdmin to upgrade your role, or start your own organization with a DIY Accreditation plan.
              </p>
            </div>
            <Button className="flex-shrink-0 text-white" style={{ background: BRAND }} asChild>
              <Link href="/diy-accreditation-plans">View Plans</Link>
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
