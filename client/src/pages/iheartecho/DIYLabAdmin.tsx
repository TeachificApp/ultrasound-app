/*
  DIY Accreditation Lab Admin Portal — iHeartEcho™
  Tabs: Overview | Members | Seat Management | Settings
  Brand: Teal #189aa1, Aqua #4ad9e0, Dark Navy #0e1e2e
  
  Access: SuperAdmin + Lab Admin roles only
  SuperAdmin: all tabs + can invite/revoke Lab Admins + org settings
  Lab Admin: Overview + Members + can invite DIY Members
*/
import { useState } from "react";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Users, Settings, Crown, Shield, UserPlus, Trash2,
  Loader2, AlertTriangle, CheckCircle, ChevronRight, Mail,
  Zap, Star, Lock, RefreshCw, ExternalLink, Info
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";
const AQUA = "#4ad9e0";
const NAVY = "#0e1e2e";

const PLAN_LABELS: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  starter: { label: "Accreditation Starter", color: "#6b7280", icon: Shield },
  professional: { label: "Accreditation Professional", color: BRAND, icon: Zap },
  advanced: { label: "Accreditation Advanced", color: "#7c3aed", icon: Star },
  partner: { label: "Accreditation Partner", color: "#d97706", icon: Crown },
};

const ROLE_LABELS: Record<string, { label: string; badge: string }> = {
  super_admin: { label: "SuperAdmin", badge: "bg-amber-100 text-amber-800" },
  lab_admin: { label: "Lab Admin", badge: "bg-teal-100 text-teal-800" },
  diy_member: { label: "DIY Member", badge: "bg-blue-100 text-blue-800" },
};

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  pending: { label: "Invite Pending", badge: "bg-yellow-100 text-yellow-800" },
  accepted: { label: "Active", badge: "bg-green-100 text-green-800" },
  declined: { label: "Declined", badge: "bg-red-100 text-red-800" },
  revoked: { label: "Revoked", badge: "bg-gray-100 text-gray-600" },
};

type Tab = "overview" | "members" | "seats" | "settings";

export default function DIYLabAdmin() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"lab_admin" | "diy_member">("diy_member");
  const [isInviting, setIsInviting] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const { data: orgDetails, isLoading, refetch } = trpc.diy.getOrgDetails.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const inviteMutation = trpc.diy.inviteMember.useMutation({
    onSuccess: () => {
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("diy_member");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = trpc.diy.revokeMember.useMutation({
    onSuccess: () => {
      toast.success("Member access revoked");
      setRevokingId(null);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      setRevokingId(null);
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await inviteMutation.mutateAsync({
        email: inviteEmail.trim(),
        displayName: inviteName.trim() || undefined,
        diyRole: inviteRole,
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevoke = async (memberId: number) => {
    setRevokingId(memberId);
    await revokeMutation.mutateAsync({ memberId });
  };

  if (authLoading) {
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
        <div className="container py-16 text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
          <p className="text-gray-500 mb-4">Please sign in to access the DIY Lab Admin portal.</p>
          <Button asChild style={{ background: BRAND }}>
            <a href="/login">Sign In</a>
          </Button>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
        </div>
      </Layout>
    );
  }

  // No org — redirect to upgrade/registration
  if (!orgDetails) {
    return (
      <Layout>
        <div className="container py-16 max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: `${BRAND}18` }}>
            <Building2 className="w-8 h-8" style={{ color: BRAND }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: "Merriweather, serif", color: NAVY }}>
            No DIY Accreditation Subscription Found
          </h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            You don't have an active DIY Accreditation subscription, or you haven't been assigned a Lab Admin role yet.
            Start your accreditation journey by choosing a plan below.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild style={{ background: BRAND, color: "white" }}>
              <Link href="/diy-accreditation-plans">View Plans &amp; Pricing</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/diy-member">I Have an Invite Token</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const { org, subscription: sub, members, seatUsage, myRole } = orgDetails;
  const isSuperAdmin = myRole === "super_admin";
  const planInfo = sub ? PLAN_LABELS[sub.plan] : null;
  const isProfessionalOrAbove = sub ? ["professional", "advanced", "partner"].includes(sub.plan) : false;
  const PlanIcon = planInfo?.icon ?? Shield;

  const activeMembers = members.filter((m) => m.isActive && m.inviteStatus === "accepted");
  const pendingMembers = members.filter((m) => m.isActive && m.inviteStatus === "pending");

  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "members", label: "Members", icon: Users },
    { id: "seats", label: "Seat Management", icon: Shield },
    ...(isSuperAdmin ? [{ id: "settings" as Tab, label: "Settings", icon: Settings }] : []),
  ];

  return (
    <Layout>
      {/* Header */}
      <div className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BRAND_DARK} 60%, ${BRAND} 100%)` }}>
        <div className="container py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.15)" }}>
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                  {org.name}
                </h1>
                {isSuperAdmin && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30">
                    <Crown className="w-3 h-3" /> SuperAdmin
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {planInfo && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(255,255,255,0.15)", color: AQUA }}>
                    <PlanIcon className="w-3.5 h-3.5" />
                    {planInfo.label}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  sub?.status === "active" ? "bg-green-400/20 text-green-200" : "bg-red-400/20 text-red-200"
                }`}>
                  {sub?.status === "active" ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {sub?.status ?? "Unknown"}
                </span>
                {sub?.hasConcierge && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-200">
                    <Star className="w-3 h-3" /> Concierge
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="container">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === id
                    ? "border-[#189aa1] text-[#189aa1]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* ── Overview Tab ────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Seat usage cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Lab Admin Seats</span>
                    <Crown className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <div className="text-3xl font-bold" style={{ color: BRAND }}>
                    {seatUsage.labAdminUsed}
                    <span className="text-lg text-gray-400 font-normal"> / {seatUsage.labAdminTotal}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (seatUsage.labAdminUsed / seatUsage.labAdminTotal) * 100)}%`,
                        background: BRAND,
                      }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Includes SuperAdmin seat</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">DIY Member Seats</span>
                    <Users className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <div className="text-3xl font-bold" style={{ color: BRAND }}>
                    {seatUsage.memberUsed}
                    <span className="text-lg text-gray-400 font-normal">
                      {seatUsage.isUnlimitedMembers ? " / ∞" : ` / ${seatUsage.memberTotal}`}
                    </span>
                  </div>
                  {!seatUsage.isUnlimitedMembers && (
                    <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (seatUsage.memberUsed / seatUsage.memberTotal) * 100)}%`,
                          background: BRAND,
                        }} />
                    </div>
                  )}
                  {seatUsage.isUnlimitedMembers && (
                    <p className="text-xs text-green-600 mt-1 font-medium">Unlimited members</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Pending Invites</span>
                    <Mail className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <div className="text-3xl font-bold" style={{ color: BRAND }}>
                    {pendingMembers.length}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Awaiting acceptance</p>
                </CardContent>
              </Card>
            </div>

            {/* Subscription info */}
            {sub && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4" style={{ color: BRAND }} />
                    Subscription Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Plan</p>
                      <p className="font-semibold">{PLAN_LABELS[sub.plan]?.label ?? sub.plan}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Status</p>
                      <p className={`font-semibold ${sub.status === "active" ? "text-green-600" : "text-red-500"}`}>
                        {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Concierge Add-on</p>
                      <p className={`font-semibold ${sub.hasConcierge ? "text-green-600" : "text-gray-400"}`}>
                        {sub.hasConcierge ? "Active" : "Not purchased"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Total Seats</p>
                      <p className="font-semibold">
                        {sub.isUnlimitedMembers ? `${sub.labAdminSeats} Admins + Unlimited Members` : `${sub.totalSeats} total`}
                      </p>
                    </div>
                  </div>
                  {/* Org ID — needed when purchasing Concierge via Stripe */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                    <span className="text-xs text-gray-400">Organization ID:</span>
                    <code className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: `${BRAND}12`, color: BRAND }}>{org.id}</code>
                    <button
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy Org ID"
                      onClick={() => { navigator.clipboard.writeText(String(org.id)); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                    <span className="text-xs text-gray-400">— Enter this when purchasing Concierge</span>
                  </div>
                  {!sub.hasConcierge && isProfessionalOrAbove && (
                    <div className="mt-4 p-3 rounded-lg flex items-start gap-3" style={{ background: `${BRAND}10`, border: `1px solid ${BRAND}30` }}>
                      <Star className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: NAVY }}>Add Accreditation Concierge™</p>
                        <p className="text-xs mt-0.5" style={{ color: BRAND }}>
                          Expert-guided IAC accreditation support — one-time $4,997 add-on for active subscribers.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {["Application Preparation", "Policy & Protocol Review", "Case Study Guidance", "Mock Readiness Assessment", "IAC Submission Assistance"].map(item => (
                            <span key={item} className="px-2 py-0.5 rounded-full text-white text-xs" style={{ background: BRAND }}>{item}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex flex-col gap-1 items-end">
                        <a
                          href={`https://buy.stripe.com/7sYcN475Lcs94Nm3hH9R604?prefilled_custom_field_0=${org.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" className="text-white" style={{ background: BRAND }}>
                            Add Concierge <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </a>
                        <span className="text-xs text-gray-400">Your Org ID ({org.id}) is pre-filled</span>
                      </div>
                    </div>
                  )}
                  {!sub.hasConcierge && !isProfessionalOrAbove && (
                    <div className="mt-4 p-3 rounded-lg flex items-start gap-3 bg-gray-50 border border-gray-200">
                      <Lock className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-600">Accreditation Concierge™</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Available on Professional, Advanced, and Partner plans. Upgrade to unlock expert-guided IAC accreditation support.
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="flex-shrink-0" asChild>
                        <Link href="/diy-accreditation-plans">Upgrade Plan</Link>
                      </Button>
                    </div>
                  )}
                  {isSuperAdmin && (
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/diy-accreditation-plans">Upgrade Plan</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setActiveTab("members")}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#189aa1] hover:bg-[#189aa1]/5 transition-all text-left"
                  >
                    <UserPlus className="w-5 h-5 flex-shrink-0" style={{ color: BRAND }} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Invite Member</p>
                      <p className="text-xs text-gray-500">Add a Lab Admin or DIY Member</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                  </button>
                  <button
                    onClick={() => setActiveTab("seats")}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#189aa1] hover:bg-[#189aa1]/5 transition-all text-left"
                  >
                    <Shield className="w-5 h-5 flex-shrink-0" style={{ color: BRAND }} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Seat Management</p>
                      <p className="text-xs text-gray-500">View seat allotments and usage</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Members Tab ─────────────────────────────────────────────────────── */}
        {activeTab === "members" && (
          <div className="space-y-6">
            {/* Invite form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="w-4 h-4" style={{ color: BRAND }} />
                  Invite New Member
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <Input
                    placeholder="Email address *"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    type="email"
                  />
                  <Input
                    placeholder="Display name (optional)"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as "lab_admin" | "diy_member")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isSuperAdmin && (
                        <SelectItem value="lab_admin">Lab Admin</SelectItem>
                      )}
                      <SelectItem value="diy_member">DIY Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start gap-3">
                  <Button
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim() || isInviting}
                    style={{ background: BRAND }}
                    className="text-white"
                  >
                    {isInviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                    Send Invite
                  </Button>
                  <div className="flex-1 p-2 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-700">
                      <Info className="w-3 h-3 inline mr-1" />
                      {inviteRole === "lab_admin"
                        ? "Lab Admins can manage workflows, upload policies, assign tasks, and view analytics."
                        : "DIY Members can participate in case review and complete workflow tasks."}
                      {inviteRole === "lab_admin" && !isSuperAdmin && " Only SuperAdmins can invite Lab Admins."}
                    </p>
                  </div>
                </div>

                {/* Seat availability warning */}
                {inviteRole === "lab_admin" && seatUsage.labAdminUsed >= seatUsage.labAdminTotal && (
                  <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700">
                      Lab Admin seat limit reached ({seatUsage.labAdminTotal} seats).{" "}
                      <Link href="/diy-accreditation-plans" className="underline font-semibold">Upgrade your plan</Link> to add more Lab Admins.
                    </p>
                  </div>
                )}
                {inviteRole === "diy_member" && !seatUsage.isUnlimitedMembers && seatUsage.memberUsed >= seatUsage.memberTotal && (
                  <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700">
                      DIY Member seat limit reached ({seatUsage.memberTotal} seats).{" "}
                      <Link href="/diy-accreditation-plans" className="underline font-semibold">Upgrade your plan</Link> to add more members.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: BRAND }} />
                  Active Members ({activeMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeMembers.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No active members yet. Invite your first member above.</p>
                ) : (
                  <div className="space-y-2">
                    {activeMembers.map((m) => {
                      const roleInfo = ROLE_LABELS[m.diyRole];
                      return (
                        <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                            style={{ background: BRAND }}>
                            {(m.displayName ?? m.inviteEmail).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {m.displayName ?? m.inviteEmail}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{m.inviteEmail}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleInfo.badge}`}>
                            {roleInfo.label}
                          </span>
                          {isSuperAdmin && m.diyRole !== "super_admin" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                              onClick={() => handleRevoke(m.id)}
                              disabled={revokingId === m.id}
                            >
                              {revokingId === m.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending invites */}
            {pendingMembers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="w-4 h-4 text-yellow-500" />
                    Pending Invites ({pendingMembers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingMembers.map((m) => {
                      const roleInfo = ROLE_LABELS[m.diyRole];
                      return (
                        <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-yellow-100 bg-yellow-50">
                          <Mail className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{m.inviteEmail}</p>
                            <p className="text-xs text-gray-400">Invite sent — awaiting acceptance</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleInfo.badge}`}>
                            {roleInfo.label}
                          </span>
                          {isSuperAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                              onClick={() => handleRevoke(m.id)}
                              disabled={revokingId === m.id}
                            >
                              {revokingId === m.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Seat Management Tab ─────────────────────────────────────────────── */}
        {activeTab === "seats" && sub && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" style={{ color: BRAND }} />
                  Seat Allotment — {PLAN_LABELS[sub.plan]?.label ?? sub.plan}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* SuperAdmin seat */}
                  <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-600" />
                        <span className="font-semibold text-amber-800 text-sm">SuperAdmin Seat</span>
                      </div>
                      <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">1 / 1</span>
                    </div>
                    <p className="text-xs text-amber-700">
                      1 SuperAdmin per organization. The SuperAdmin occupies 1 of the {sub.labAdminSeats} Lab Admin seat{sub.labAdminSeats > 1 ? "s" : ""} included in your plan.
                      SuperAdmin has full org control including billing, member management, and settings.
                    </p>
                  </div>

                  {/* Lab Admin seats */}
                  <div className="p-4 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" style={{ color: BRAND }} />
                        <span className="font-semibold text-gray-800 text-sm">Lab Admin Seats</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${BRAND}15`, color: BRAND }}>
                        {seatUsage.labAdminUsed} / {seatUsage.labAdminTotal}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 mb-2 overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (seatUsage.labAdminUsed / seatUsage.labAdminTotal) * 100)}%`,
                          background: BRAND,
                        }} />
                    </div>
                    <p className="text-xs text-gray-500">
                      Lab Admins can manage workflows, upload policies, assign tasks, manage staff, and view analytics.
                      Includes the SuperAdmin seat. Only SuperAdmin can invite Lab Admins.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                        <p className="text-gray-400">Used</p>
                        <p className="font-bold text-gray-700">{seatUsage.labAdminUsed}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                        <p className="text-gray-400">Available</p>
                        <p className="font-bold" style={{ color: BRAND }}>
                          {Math.max(0, seatUsage.labAdminTotal - seatUsage.labAdminUsed)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* DIY Member seats */}
                  <div className="p-4 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" style={{ color: BRAND }} />
                        <span className="font-semibold text-gray-800 text-sm">DIY Member Seats</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${BRAND}15`, color: BRAND }}>
                        {seatUsage.memberUsed} / {seatUsage.isUnlimitedMembers ? "∞" : seatUsage.memberTotal}
                      </span>
                    </div>
                    {!seatUsage.isUnlimitedMembers && (
                      <div className="h-2 rounded-full bg-gray-100 mb-2 overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (seatUsage.memberUsed / seatUsage.memberTotal) * 100)}%`,
                            background: BRAND,
                          }} />
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      DIY Members can participate in case review, submit documentation, and complete workflow tasks.
                      {seatUsage.isUnlimitedMembers
                        ? " Your Partner plan includes unlimited DIY Member seats."
                        : ` Your ${PLAN_LABELS[sub.plan]?.label ?? sub.plan} plan includes ${seatUsage.memberTotal} DIY Member seats.`}
                    </p>
                    {!seatUsage.isUnlimitedMembers && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                          <p className="text-gray-400">Used</p>
                          <p className="font-bold text-gray-700">{seatUsage.memberUsed}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                          <p className="text-gray-400">Available</p>
                          <p className="font-bold" style={{ color: BRAND }}>
                            {Math.max(0, seatUsage.memberTotal - seatUsage.memberUsed)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Upgrade CTA if seats are near limit */}
                  {(!seatUsage.isUnlimitedMembers && seatUsage.memberUsed >= seatUsage.memberTotal * 0.8) && (
                    <div className="p-4 rounded-xl border border-[#189aa1]/30 bg-[#189aa1]/5">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold" style={{ color: BRAND_DARK }}>
                            Approaching seat limit
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            You've used {seatUsage.memberUsed} of {seatUsage.memberTotal} DIY Member seats.
                            Upgrade your plan to add more capacity.
                          </p>
                          <Button size="sm" className="mt-2 text-white" style={{ background: BRAND }} asChild>
                            <Link href="/diy-accreditation-plans">Upgrade Plan</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Permission matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Permission Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-4 text-gray-500 font-medium text-xs">Permission</th>
                        <th className="text-center py-2 px-3 text-xs font-medium text-amber-700">SuperAdmin</th>
                        <th className="text-center py-2 px-3 text-xs font-medium" style={{ color: BRAND }}>Lab Admin</th>
                        <th className="text-center py-2 px-3 text-xs font-medium text-blue-700">DIY Member</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        ["Manage Workflows", true, true, false],
                        ["Upload Policies", true, true, false],
                        ["Assign Tasks", true, true, false],
                        ["Manage Staff / Invite Members", true, true, false],
                        ["View Analytics", true, true, false],
                        ["Policy Builder", true, true, false],
                        ["Case Studies", true, true, false],
                        ["Accreditation Readiness", true, true, false],
                        ["Participate in Case Review", true, true, true],
                        ["Submit Documentation", true, true, true],
                        ["Complete Workflow Tasks", true, true, true],
                        ["Org Settings & Billing", true, false, false],
                        ["Invite Lab Admins", true, false, false],
                        ["Revoke Members", true, false, false],
                      ].map(([label, sa, la, dm]) => (
                        <tr key={label as string} className="hover:bg-gray-50">
                          <td className="py-2 pr-4 text-gray-700 text-xs">{label as string}</td>
                          <td className="text-center py-2 px-3">
                            {sa ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">—</span>}
                          </td>
                          <td className="text-center py-2 px-3">
                            {la ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">—</span>}
                          </td>
                          <td className="text-center py-2 px-3">
                            {dm ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Settings Tab (SuperAdmin only) ──────────────────────────────────── */}
        {activeTab === "settings" && isSuperAdmin && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" style={{ color: BRAND }} />
                  Organization Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Organization Name</p>
                    <p className="font-semibold">{org.name}</p>
                  </div>
                  {org.phone && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Phone</p>
                      <p className="font-semibold">{org.phone}</p>
                    </div>
                  )}
                  {org.website && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Website</p>
                      <a href={org.website} target="_blank" rel="noopener noreferrer"
                        className="font-semibold flex items-center gap-1 hover:underline" style={{ color: BRAND }}>
                        {org.website} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {org.address && (
                    <div className="sm:col-span-2">
                      <p className="text-gray-500 text-xs mb-1">Address</p>
                      <p className="font-semibold">{org.address}</p>
                    </div>
                  )}
                  {org.accreditationTypes && (
                    <div className="sm:col-span-2">
                      <p className="text-gray-500 text-xs mb-1">Accreditation Types</p>
                      <div className="flex gap-2 flex-wrap">
                        {(JSON.parse(org.accreditationTypes) as string[]).map((t) => (
                          <span key={t} className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${BRAND}15`, color: BRAND }}>
                            {t === "adult_echo" ? "Adult Echo" : "Pediatric/Fetal Echo"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  To update organization details, contact support at{" "}
                  <a href="mailto:support@allaboutultrasound.com" className="underline" style={{ color: BRAND }}>
                    support@allaboutultrasound.com
                  </a>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  SuperAdmin Role
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <p className="font-semibold mb-1">You are the SuperAdmin of this organization.</p>
                  <p className="text-xs text-amber-700">
                    The SuperAdmin role is unique — there is exactly 1 SuperAdmin per organization. It cannot be transferred or revoked.
                    The SuperAdmin occupies 1 of the Lab Admin seats in your plan. You have full control over all org settings, billing, and member management.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
