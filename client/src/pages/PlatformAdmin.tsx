/*
  Platform Admin — iHeartEcho™
  Accessible only to users with role === "admin" (owner) or "platform_admin" role.
  Features:
  - Add user by email (search → preview → assign role)
  - User list with search/filter
  - Inline role assignment and removal
  - Stats overview
*/

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Shield,
  Users,
  Search,
  UserCog,
  Crown,
  Stethoscope,
  ClipboardList,
  User,
  Trash2,
  Plus,
  RefreshCw,
  Lock,
  ChevronRight,
  UserPlus,
  Mail,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Building2,
  BarChart2,
  ExternalLink,
  Library,
  Zap,
  Scan,
  Webhook,
  FlaskConical,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import BulkCsvUploadPanel, { type BulkResult } from "@/components/BulkCsvUploadPanel";

type AppRole = "user" | "premium_user" | "diy_admin" | "diy_user" | "platform_admin" | "accreditation_manager";

const ROLE_META: Record<AppRole, { label: string; color: string; icon: React.ElementType; description: string }> = {
  user: {
    label: "User",
    color: "bg-gray-100 text-gray-700",
    icon: User,
    description: "Default role — basic access to free features",
  },
  premium_user: {
    label: "Premium User",
    color: "bg-amber-100 text-amber-700",
    icon: Crown,
    description: "Access to premium navigator features",
  },
  diy_admin: {
    label: "DIY Admin",
    color: "bg-teal-100 text-teal-700",
    icon: ClipboardList,
    description: "Manages the DIY Accreditation Tool™ and assigns seats",
  },
  diy_user: {
    label: "DIY User",
    color: "bg-blue-100 text-blue-700",
    icon: Stethoscope,
    description: "Seat-assigned access to the DIY Accreditation Tool™",
  },
  platform_admin: {
    label: "Platform Admin",
    color: "bg-purple-100 text-purple-700",
    icon: Shield,
    description: "Full platform management access",
  },
  accreditation_manager: {
    label: "Accreditation Manager",
    color: "bg-indigo-100 text-indigo-700",
    icon: ClipboardList,
    description: "Full access to all DIY Accreditation organizations and managed accounts — assigned by platform admins only",
  },
};

function RoleBadge({ role, onRemove }: { role: AppRole; onRemove?: () => void }) {
  const meta = ROLE_META[role];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <meta.icon className="w-3 h-3" />
      {meta.label}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
          title={`Remove ${meta.label}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

type UserWithRoles = {
  id: number;
  name: string | null;
  email: string | null;
  displayName: string | null;
  role: string;
  createdAt: Date;
  lastSignedIn: Date;
  isPending: boolean;
  isDemo: boolean;
  roles: AppRole[];
};

// ─── Add User by Email Panel ─────────────────────────────────────────────────
// Uses a mutation-based state machine for reliable on-demand lookup.
// States: idle → searching → found | notFound | error
type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "found"; user: { id: number; name: string | null; email: string | null; displayName: string | null; role: string; roles: AppRole[]; isPending: boolean; createdAt: Date; lastSignedIn: Date } }
  | { status: "notFound"; email: string }
  | { status: "error"; message: string };

function AddUserByEmailPanel({ onSuccess, isPlatformAdminOrOwner }: { onSuccess: () => void; isPlatformAdminOrOwner: boolean }) {
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("premium_user");
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  // Use a mutation for on-demand lookup (not useQuery, which fires automatically)
  const findUserMutation = trpc.platformAdmin.findUserByEmail.useMutation({
    onSuccess: (data) => {
      if (data === null || data === undefined) {
        setSearchState({ status: "notFound", email: email.trim() });
      } else {
        setSearchState({ status: "found", user: data as any });
      }
    },
    onError: (err) => {
      setSearchState({ status: "error", message: err.message });
    },
  });

  const assignRoleByEmail = trpc.platformAdmin.assignRoleByEmail.useMutation({
    onSuccess: (data) => {
      const emailUsed = searchState.status === "found"
        ? (searchState.user.email ?? email.trim())
        : searchState.status === "notFound" ? searchState.email : email.trim();
      if (data.wasPreRegistered) {
        toast.success(`Pre-registered ${data.displayName ?? emailUsed} with role "${ROLE_META[selectedRole]?.label}" — role will activate on first login.`);
      } else {
        toast.success(`Role "${ROLE_META[selectedRole]?.label}" assigned to ${data.displayName ?? emailUsed}.`);
      }
      setEmail("");
      setSearchState({ status: "idle" });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSearch = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSearchState({ status: "searching" });
    findUserMutation.mutate({ email: trimmed });
  };

  const handleClear = () => {
    setEmail("");
    setSearchState({ status: "idle" });
    inputRef.current?.focus();
  };

  const isFetching = searchState.status === "searching";
  const foundUser = searchState.status === "found" ? searchState.user : null;
  const isNotFound = searchState.status === "notFound";
  const findError = searchState.status === "error" ? { message: searchState.message } : null;
  const notFoundEmail = searchState.status === "notFound" ? searchState.email : email.trim();
  const alreadyHasRole = foundUser ? foundUser.roles.includes(selectedRole) : false;
  const hasResult = searchState.status === "found" || searchState.status === "notFound" || searchState.status === "error";

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#189aa1]" />
          Add User by Email
        </CardTitle>
        <p className="text-xs text-gray-500 mt-0.5">
          Search for a user by email and assign a role. If the user has not yet signed in, they will be pre-registered — their role will be applied automatically when they first log in.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Email search row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              ref={inputRef}
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                // Reset result when user edits the email
                if (hasResult) setSearchState({ status: "idle" });
              }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="pl-9 pr-8"
            />
            {email && (
              <button
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={isFetching || !email.trim()}
            style={{ background: "#189aa1" }}
            className="text-white gap-2 flex-shrink-0"
          >
            {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </Button>
        </div>

        {/* Result panel */}
        {hasResult && (
          <>
            {findError ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {findError.message}
              </div>
            ) : isNotFound ? (
              <div className="p-4 rounded-xl border border-violet-200 bg-violet-50 space-y-3">
                <div className="flex items-start gap-3">
                  <UserPlus className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-violet-800">No existing account — pre-register?</p>
                    <p className="text-xs text-violet-600 mt-0.5">
                      <strong>{notFoundEmail}</strong> has not signed in yet. Select a role below and pre-register them — the role will be applied automatically on their first login.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 block mb-1">Role to assign on first login</label>
                    <Select value={selectedRole} onValueChange={v => setSelectedRole(v as AppRole)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(ROLE_META) as [AppRole, typeof ROLE_META[AppRole]][])
                          .filter(([role]) => role !== "accreditation_manager" || isPlatformAdminOrOwner)
                          .map(([role, meta]) => (
                          <SelectItem key={role} value={role}>
                            <div className="flex items-center gap-2">
                              <meta.icon className="w-3.5 h-3.5" />
                              {meta.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {ROLE_META[selectedRole] && (
                      <p className="text-xs text-gray-400 mt-1">{ROLE_META[selectedRole].description}</p>
                    )}
                  </div>
                  <Button
                    onClick={() => assignRoleByEmail.mutate({ email: notFoundEmail, role: selectedRole })}
                    disabled={assignRoleByEmail.isPending}
                    className="flex-shrink-0 gap-2 text-white"
                    style={{ background: "#7c3aed" }}
                  >
                    {assignRoleByEmail.isPending ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Pre-registering…</>
                    ) : (
                      <><UserPlus className="w-4 h-4" /> Pre-register &amp; Assign</>
                    )}
                  </Button>
                </div>
              </div>
            ) : foundUser ? (
              <div className={`p-4 rounded-xl border space-y-3 ${foundUser.isPending ? 'border-orange-200 bg-orange-50' : 'border-[#189aa1]/20 bg-teal-50/30'}`}>
                {/* User preview */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: foundUser.isPending ? '#f97316' : '#189aa1' }}
                  >
                    {(foundUser.displayName ?? foundUser.name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-sm text-gray-900">
                        {foundUser.displayName ?? foundUser.name ?? foundUser.email ?? "Unknown User"}
                      </div>
                      {foundUser.isPending && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          <Clock className="w-3 h-3" />
                          Pending Sign-In
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{foundUser.email}</div>
                  </div>
                </div>
                {/* Role selector + assign */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 block mb-1">Role to assign</label>
                    <Select value={selectedRole} onValueChange={v => setSelectedRole(v as AppRole)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(ROLE_META) as [AppRole, typeof ROLE_META[AppRole]][])
                          .filter(([role]) => role !== "accreditation_manager" || isPlatformAdminOrOwner)
                          .map(([role, meta]) => (
                            <SelectItem key={role} value={role}>
                              <div className="flex items-center gap-2">
                                <meta.icon className="w-3.5 h-3.5" />
                                {meta.label}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {ROLE_META[selectedRole] && (
                      <p className="text-xs text-gray-400 mt-1">{ROLE_META[selectedRole].description}</p>
                    )}
                  </div>
                  <Button
                    onClick={() => assignRoleByEmail.mutate({ email: foundUser.email ?? email.trim(), role: selectedRole })}
                    disabled={assignRoleByEmail.isPending || alreadyHasRole}
                    style={{ background: alreadyHasRole ? undefined : "#189aa1" }}
                    variant={alreadyHasRole ? "outline" : "default"}
                    className={`flex-shrink-0 gap-2 ${!alreadyHasRole ? "text-white" : ""}`}
                  >
                    {assignRoleByEmail.isPending ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Assigning…</>
                    ) : alreadyHasRole ? (
                      <><CheckCircle2 className="w-4 h-4" /> Already assigned</>
                    ) : (
                      <><Plus className="w-4 h-4" /> Assign Role</>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── DIY Organizations Panel ─────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  advanced: "Advanced",
  partner: "Partner",
  // Consulting Client: only assignable by Accreditation Managers / Platform Admins
  consulting_client: "Consulting Client",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#16a34a",
  trialing: "#2563eb",
  past_due: "#d97706",
  canceled: "#dc2626",
  paused: "#6b7280",
};

function DIYOrgsPanel() {
  const { data: orgs, isLoading, refetch } = trpc.diy.adminListOrgs.useQuery();
  const updateSub = trpc.diy.adminUpdateSubscription.useMutation({
    onSuccess: () => { toast.success("Subscription updated."); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const [editingOrg, setEditingOrg] = useState<number | null>(null);
  const [editPlan, setEditPlan] = useState<"starter" | "professional" | "advanced" | "partner" | "consulting_client">("starter");
  const [editStatus, setEditStatus] = useState<"active" | "trialing" | "past_due" | "canceled" | "paused">("active");
  const [editConcierge, setEditConcierge] = useState(false);

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#189aa1]" />
            DIY Accreditation Organizations ({orgs?.length ?? 0})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-1 text-xs">
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
            <Link href="/diy-accreditation-plans">
              <Button size="sm" className="flex items-center gap-1 text-xs text-white" style={{ background: "#189aa1" }}>
                <ExternalLink className="w-3 h-3" /> Plans Page
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-[#189aa1]" />
          </div>
        ) : !orgs || orgs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No DIY Accreditation organizations registered yet.
            <div className="mt-2">
              <Link href="/diy-register">
                <Button size="sm" variant="outline" className="text-xs">Register First Org</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Organization</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Plan</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Seats Used</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Concierge</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orgs.map(({ org, subscription: sub, memberCount }) => (
                  <tr key={org.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#189aa118" }}>
                          <Building2 className="w-3.5 h-3.5" style={{ color: "#189aa1" }} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-xs leading-tight">{org.name}</p>
                          {org.website && (
                            <a href={org.website} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-gray-400 hover:underline flex items-center gap-0.5">
                              <ExternalLink className="w-2.5 h-2.5" /> {org.website.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#189aa1" }}>
                        {sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {sub ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                          background: `${STATUS_COLORS[sub.status] ?? "#6b7280"}18`,
                          color: STATUS_COLORS[sub.status] ?? "#6b7280",
                        }}>
                          {sub.status}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No subscription</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <BarChart2 className="w-3 h-3 text-gray-400" />
                        {memberCount} / {sub?.totalSeats ?? "—"}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {sub?.hasConcierge ? (
                        <span className="text-xs font-medium text-[#189aa1] flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          setEditingOrg(org.id);
                          setEditPlan((sub?.plan as typeof editPlan) ?? "starter");
                          setEditStatus((sub?.status as typeof editStatus) ?? "active");
                          setEditConcierge(sub?.hasConcierge ?? false);
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Edit subscription dialog */}
      <Dialog open={editingOrg !== null} onOpenChange={(open) => { if (!open) setEditingOrg(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#189aa1]" />
              Edit Subscription
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Plan</label>
              <Select value={editPlan} onValueChange={(v) => setEditPlan(v as typeof editPlan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_LABELS).map(([id, label]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Status</label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as typeof editStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(STATUS_COLORS).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="concierge"
                checked={editConcierge}
                onChange={(e) => setEditConcierge(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="concierge" className="text-sm text-gray-700">Concierge Add-on Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingOrg === null) return;
                updateSub.mutate({ orgId: editingOrg, plan: editPlan, status: editStatus, hasConcierge: editConcierge });
                setEditingOrg(null);
              }}
              disabled={updateSub.isPending}
              style={{ background: "#189aa1" }}
              className="text-white"
            >
              {updateSub.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Demo Mode Panel ─────────────────────────────────────────────────────────

function DemoModePanel() {
  const { data: demoUsers, isLoading, refetch } = trpc.demo.listDemoUsers.useQuery();
  const [, navigate] = useLocation();
  const startDemo = trpc.demo.start.useMutation({
    onSuccess: async (data) => {
      toast.success(`Entering demo mode as ${data.targetUser.displayName ?? 'demo user'}…`);
      // Small delay to let the cookie settle before navigating
      setTimeout(() => navigate('/accreditation'), 300);
    },
    onError: (err) => toast.error(`Failed to start demo: ${err.message}`),
  });

  // Group by lab
  const byLab = (demoUsers ?? []).reduce<Record<string, typeof demoUsers>>((acc, u) => {
    const key = u.labName ?? 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(u);
    return acc;
  }, {});

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-600" />
            Demo Mode
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Enter the DIY Accreditation experience as a demo user. A purple banner will appear — click <strong>Exit Demo</strong> to return to your admin account.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-500" />
          </div>
        ) : !demoUsers || demoUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No demo users found. Run the seed script to create demo accounts.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byLab).map(([labName, members]) => (
              <div key={labName}>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-600">{labName}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(members ?? []).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => startDemo.mutate({ targetUserId: u.id })}
                      disabled={startDemo.isPending}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/50 transition-all text-left group disabled:opacity-60"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                        {(u.displayName ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-gray-800 truncate">{u.displayName}</div>
                        {u.credentials && <div className="text-[10px] text-gray-400 truncate">{u.credentials}</div>}
                        <div className="text-[10px] text-purple-500 font-medium mt-0.5 capitalize">
                          {u.memberRole === 'admin' ? 'Lab Admin' : u.memberRole ?? 'Member'}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlatformAdmin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userType, setUserType] = useState<'all'|'pending'|'active'|'premium'|'diy_admin'|'diy_user'|'platform_admin'|'free'>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);
  const [roleToAdd, setRoleToAdd] = useState<AppRole>("premium_user");
  const [bulkRole, setBulkRole] = useState<AppRole>("premium_user");

  const bulkAssignRoleMutation = trpc.platformAdmin.bulkAssignRole.useMutation({
    onSuccess: () => refetchUsers(),
    onError: (err) => toast.error(err.message),
  });

  const [lastSyncResult, setLastSyncResult] = useState<{ count: number; syncedAt: Date } | null>(null);
  const [lastRegistrySyncResult, setLastRegistrySyncResult] = useState<{ count: number; syncedAt: Date } | null>(null);
  const [lastMemberSyncResult, setLastMemberSyncResult] = useState<{ total: number; created: number; skipped: number; errors: number; syncedAt: Date } | null>(null);
  const syncAllMembersMutation = trpc.platformAdmin.syncAllThinkificMembers.useMutation({
    onSuccess: (data) => {
      setLastMemberSyncResult(data);
      toast.success(`Member sync complete: ${data.created} new accounts created, ${data.skipped} already existed.`);
    },
    onError: (err) => toast.error(`Member sync failed: ${err.message}`),
  });
  const syncCoursesMutation = trpc.platformAdmin.syncThinkificCourses.useMutation({
    onSuccess: (data) => {
      setLastSyncResult(data);
      toast.success(`Synced ${data.count} CME course${data.count !== 1 ? "s" : ""} from Thinkific.`);
    },
    onError: (err) => toast.error(`Sync failed: ${err.message}`),
  });

  const syncRegistryMutation = trpc.platformAdmin.syncRegistryCourses.useMutation({
    onSuccess: (data) => {
      setLastRegistrySyncResult(data);
      toast.success(`Synced ${data.count} Registry Review course${data.count !== 1 ? "s" : ""}.`);
    },
    onError: (err) => toast.error(`Registry sync failed: ${err.message}`),
  });

  const { data: isAdmin, isLoading: checkingAdmin } = trpc.platformAdmin.isAdmin.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );

  // Debounce search input so we don't fire a query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: users,
    isLoading: loadingUsers,
    refetch: refetchUsers,
  } = trpc.platformAdmin.listUsers.useQuery(
    { limit: 500, offset: 0, search: debouncedSearch, userType },
    { enabled: !!isAdmin },
  );

  const cleanupRolesMutation = trpc.platformAdmin.cleanupUserRoles.useMutation({
    onSuccess: (data: { deduped: number; backfilled: number }) => {
      toast.success(`Roles fixed: ${data.deduped} duplicates removed, ${data.backfilled} missing roles backfilled.`);
      refetchUsers();
    },
    onError: (err) => toast.error(`Cleanup failed: ${err.message}`),
  });

  const { data: userCount } = trpc.platformAdmin.userCount.useQuery(
    undefined,
    { enabled: !!isAdmin },
  );

  const assignRoleMutation = trpc.platformAdmin.assignRole.useMutation({
    onSuccess: () => {
      toast.success("Role assigned successfully.");
      refetchUsers();
      setAddRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeRoleMutation = trpc.platformAdmin.removeRole.useMutation({
    onSuccess: () => {
      toast.success("Role removed.");
      refetchUsers();
    },
    onError: (err) => toast.error(err.message),
  });

  // Auth checks
  if (loading || checkingAdmin) {
    return (
      <Layout>
        <div className="container py-12 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Authentication Required</h2>
          <p className="text-gray-500 mb-4">Please sign in to access the admin panel.</p>
          <Link href="/"><Button variant="outline">Go Home</Button></Link>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-4">You do not have permission to access the Platform Admin panel.</p>
          <Link href="/"><Button variant="outline">Go Home</Button></Link>
        </div>
      </Layout>
    );
  }

  // Search and filtering is now server-side — use the result directly
  const filteredUsers = users ?? [];

  // Only platform admins and owner can see/assign the accreditation_manager role
  const currentUserAppRoles: string[] = (user as any)?.appRoles ?? [];
  const isPlatformAdminOrOwner = (user as any)?.role === "admin" || currentUserAppRoles.includes("platform_admin");

  const handleAddRole = () => {
    if (!selectedUser) return;
    assignRoleMutation.mutate({ userId: selectedUser.id, role: roleToAdd });
  };

  const handleRemoveRole = (userId: number, role: AppRole) => {
    removeRoleMutation.mutate({ userId, role });
  };

  return (
    <Layout>
      <div className="container py-8 max-w-6xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#189aa1" }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>
                Platform Admin
              </h1>
              <p className="text-sm text-gray-500">Manage users, roles, and platform access</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchUsers()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Users", value: userCount ?? 0, icon: Users, color: "#189aa1" },
            { label: "Premium Users", value: (users ?? []).filter(u => u.roles.includes("premium_user")).length, icon: Crown, color: "#d97706" },
            { label: "DIY Admins", value: (users ?? []).filter(u => u.roles.includes("diy_admin")).length, icon: ClipboardList, color: "#0d9488" },
            { label: "DIY Users", value: (users ?? []).filter(u => u.roles.includes("diy_user")).length, icon: Stethoscope, color: "#2563eb" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Admin Tools Hub */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Admin Tools</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                href: "/admin/cases",
                icon: Library,
                label: "Case Management",
                description: "Review, approve, and manage submitted echo cases",
                color: "#189aa1",
              },
              {
                href: "/admin/quickfire",
                icon: Zap,
                label: "Daily Challenge",
                description: "Question bank, challenge queue, and AI generator",
                color: "#7c3aed",
              },
              {
                href: "/admin/scancoach",
                icon: Scan,
                label: "ScanCoach Editor",
                description: "Edit scan coach views, anatomy, and Doppler guidance",
                color: "#0d9488",
              },
              {
                href: "/admin/thinkific-webhook",
                icon: Webhook,
                label: "Thinkific Webhook",
                description: "Manage course sync, webhook events, and enrollment",
                color: "#d97706",
              },
              {
                href: "/admin/form-builder",
                icon: ClipboardList,
                label: "Form Builder",
                description: "Create and edit accreditation review forms with branching logic and quality scoring",
                color: "#0891b2",
              },
              {
                href: "/admin/email",
                icon: Mail,
                label: "Email Campaigns",
                description: "Compose and send targeted emails to users filtered by interest, role, and subscription",
                color: "#7c3aed",
              },
            ].map(({ href, icon: Icon, label, description, color }) => (
              <Link key={href} href={href}>
                <div className="group flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200 cursor-pointer transition-all h-full">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
                    <Icon className="w-4.5 h-4.5" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{label}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium group-hover:gap-2 transition-all" style={{ color }}>
                    Open <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Add User by Email */}
        <AddUserByEmailPanel onSuccess={() => refetchUsers()} isPlatformAdminOrOwner={isPlatformAdminOrOwner} />

        {/* Bulk CSV Role Assignment */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#189aa1]" />
              Bulk Role Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BulkCsvUploadPanel
              title="Upload a CSV of emails to assign a role in bulk"
              description="Upload a CSV or paste emails — one per line. All emails will receive the selected role. New users will be pre-registered automatically."
              submitLabel="Assign Role to All"
              isPending={bulkAssignRoleMutation.isPending}
              onSubmit={async (emails) => {
                const result = await bulkAssignRoleMutation.mutateAsync({ emails, role: bulkRole });
                return result as unknown as BulkResult;
              }}
              actionSlot={
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Role to assign to all</label>
                  <Select value={bulkRole} onValueChange={v => setBulkRole(v as AppRole)}>
                    <SelectTrigger className="h-9 text-sm w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(ROLE_META) as [AppRole, typeof ROLE_META[AppRole]][])
                        .filter(([role]) => role !== "accreditation_manager" || isPlatformAdminOrOwner)
                        .map(([role, meta]) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <meta.icon className="w-3.5 h-3.5" />
                            {meta.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {ROLE_META[bulkRole] && (
                    <p className="text-xs text-gray-400 mt-1">{ROLE_META[bulkRole].description}</p>
                  )}
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* Sync CME Courses */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              CME Course Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">
                  Manually pull the latest course catalog from Thinkific (E-Learning &amp; CME collection).
                  The catalog also auto-syncs every 6 hours and on webhook events.
                </p>
                {lastSyncResult ? (
                  <p className="text-xs text-[#189aa1] font-medium">
                    Last sync: {lastSyncResult.count} course{lastSyncResult.count !== 1 ? "s" : ""} &mdash;{" "}
                    {new Date(lastSyncResult.syncedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">No sync performed this session.</p>
                )}
              </div>
              <Button
                onClick={() => syncCoursesMutation.mutate()}
                disabled={syncCoursesMutation.isPending}
                className="flex items-center gap-2 flex-shrink-0"
                style={{ background: "#189aa1" }}
              >
                <RefreshCw className={`w-4 h-4 ${syncCoursesMutation.isPending ? "animate-spin" : ""}`} />
                {syncCoursesMutation.isPending ? "Syncing…" : "Sync Now"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sync Registry Review Courses */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Registry Review Course Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">
                  Manually pull the latest course catalog for the Registry Review collection.
                  The catalog also auto-syncs every 6 hours and on webhook events.
                </p>
                {lastRegistrySyncResult ? (
                  <p className="text-xs text-[#189aa1] font-medium">
                    Last sync: {lastRegistrySyncResult.count} course{lastRegistrySyncResult.count !== 1 ? "s" : ""} &mdash;{" "}
                    {new Date(lastRegistrySyncResult.syncedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">No sync performed this session.</p>
                )}
              </div>
              <Button
                onClick={() => syncRegistryMutation.mutate()}
                disabled={syncRegistryMutation.isPending}
                className="flex items-center gap-2 flex-shrink-0"
                style={{ background: "#189aa1" }}
              >
                <RefreshCw className={`w-4 h-4 ${syncRegistryMutation.isPending ? "animate-spin" : ""}`} />
                {syncRegistryMutation.isPending ? "Syncing…" : "Sync Now"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sync All Thinkific Members */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Sync All Thinkific Members
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">
                  Create iHeartEcho accounts for all existing Thinkific members who don&apos;t have one yet.
                  No emails are sent. Future members are handled automatically via webhook.
                </p>
                {lastMemberSyncResult ? (
                  <p className="text-xs text-[#189aa1] font-medium">
                    Last sync: {lastMemberSyncResult.created} created, {lastMemberSyncResult.skipped} already existed
                    {lastMemberSyncResult.errors > 0 ? `, ${lastMemberSyncResult.errors} errors` : ""} &mdash;{" "}
                    {new Date(lastMemberSyncResult.syncedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">No sync performed this session.</p>
                )}
              </div>
              <Button
                onClick={() => syncAllMembersMutation.mutate()}
                disabled={syncAllMembersMutation.isPending}
                className="flex items-center gap-2 flex-shrink-0"
                style={{ background: "#189aa1" }}
              >
                <Users className={`w-4 h-4 ${syncAllMembersMutation.isPending ? "animate-spin" : ""}`} />
                {syncAllMembersMutation.isPending ? "Syncing…" : "Sync Members"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Role Reference */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Role Definitions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.entries(ROLE_META) as [AppRole, typeof ROLE_META[AppRole]][]).map(([role, meta]) => (
                <div key={role} className="flex items-start gap-2 p-3 rounded-lg bg-gray-50">
                  <RoleBadge role={role} />
                  <span className="text-xs text-gray-500 leading-relaxed">{meta.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User List */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#189aa1]" />
                All Users ({filteredUsers.length})
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-[#189aa1]" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                {search ? "No users match your search." : "No users found."}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="py-3 flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                      style={{ background: (u as UserWithRoles).isPending ? "#9ca3af" : "#189aa1" }}
                    >
                      {(u as UserWithRoles).isPending
                        ? <Clock className="w-4 h-4" />
                        : (u.displayName ?? u.name ?? "?")[0]?.toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">
                          {u.displayName ?? u.name ?? "Unknown User"}
                        </span>
                        {u.role === "admin" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <Crown className="w-3 h-3" />
                            Owner
                          </span>
                        )}
                        {(u as UserWithRoles).isPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3" />
                            Pending Sign-In
                          </span>
                        )}
                        {(u as UserWithRoles).isDemo && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            <FlaskConical className="w-3 h-3" />
                            Demo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{u.email ?? "No email"}</div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {u.roles.map(role => (
                          <RoleBadge
                            key={role}
                            role={role}
                            onRemove={
                              role !== "user" && u.role !== "admin"
                                ? () => handleRemoveRole(u.id, role)
                                : undefined
                            }
                          />
                        ))}
                        {u.roles.length === 0 && (
                          <span className="text-xs text-gray-400 italic">No roles assigned</span>
                        )}
                      </div>
                    </div>

                    {/* Add Role button */}
                    {u.role !== "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 h-7 text-xs gap-1"
                        onClick={() => {
                          setSelectedUser(u as UserWithRoles);
                          setRoleToAdd("premium_user");
                          setAddRoleDialogOpen(true);
                        }}
                      >
                        <Plus className="w-3 h-3" />
                        Add Role
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lab Seat Management Link */}
        <Card className="mt-6 border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#189aa118" }}>
                  <Stethoscope className="w-4 h-4" style={{ color: "#189aa1" }} />
                </div>
                <div>
                  <div className="font-medium text-gray-800 text-sm">DIY Accreditation Seat Management</div>
                  <div className="text-xs text-gray-500">Manage per-lab seat assignments in Lab Admin</div>
                </div>
              </div>
              <Link href="/lab-admin">
                <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs">
                  Lab Admin <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* DIY Organizations */}
        <DIYOrgsPanel />

        {/* Demo Mode */}
        <DemoModePanel />

      </div>

      {/* Add Role Dialog (from user list) */}
      <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-[#189aa1]" />
              Assign Role
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-sm text-gray-800">
                  {selectedUser.displayName ?? selectedUser.name ?? "Unknown User"}
                </div>
                <div className="text-xs text-gray-500">{selectedUser.email}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedUser.roles.map(r => <RoleBadge key={r} role={r} />)}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Select Role to Assign</label>
                <Select value={roleToAdd} onValueChange={(v) => setRoleToAdd(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_META) as [AppRole, typeof ROLE_META[AppRole]][])
                      .filter(([role]) => !selectedUser.roles.includes(role))
                      .filter(([role]) => role !== "accreditation_manager" || isPlatformAdminOrOwner)
                      .map(([role, meta]) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <meta.icon className="w-4 h-4" />
                            {meta.label}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {roleToAdd && ROLE_META[roleToAdd] && (
                  <p className="text-xs text-gray-500 mt-1.5">{ROLE_META[roleToAdd].description}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoleDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddRole}
              disabled={assignRoleMutation.isPending}
              style={{ background: "#189aa1" }}
              className="text-white"
            >
              {assignRoleMutation.isPending ? "Assigning…" : "Assign Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
