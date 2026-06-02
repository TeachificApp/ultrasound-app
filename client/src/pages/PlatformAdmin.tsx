/*
  Platform Admin — All About Ultrasound™
  Accessible only to users with role === "admin" (owner) or "platform_admin" role.
  Features:
  - Add user by email (search → preview → assign role)
  - User list with search/filter
  - Inline role assignment and removal
  - Stats overview
*/

import { useState, useRef, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Image,
  HardDrive,
  GraduationCap,
  LayoutTemplate,
  Globe,
  GripVertical,
  Volume2,
  Award,
  ShoppingCart,
  Tag,
  TrendingUp,
  Briefcase,
  ArrowLeft,
  Home,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import BulkCsvUploadPanel, { type BulkResult } from "@/components/BulkCsvUploadPanel";
import { isIHeartEchoDomain, LEARN_APP_URL, APP_URL, getAdminUrl } from "@/hooks/useSubdomain";

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
    color: "bg-teal-100 text-teal-700",
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

// ─── Menu Links Panel ─────────────────────────────────────────────────────────

function MenuLinksPanel() {
  const { data: links, isLoading } = trpc.menuLinks.getLearnLinks.useQuery();
  const utils = trpc.useUtils();
  const [fetalUrl, setFetalUrl] = useState("");
  const [echoUrl, setEchoUrl] = useState("");
  const [pocusUrl, setPocusUrl] = useState("");
  const [vascularUrl, setVascularUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (links) {
      setFetalUrl(links.learnFetalEchoUrl ?? "");
      setEchoUrl(links.learnEchoUrl ?? "");
      setPocusUrl(links.learnPocusUrl ?? "");
      setVascularUrl(links.learnVascularUrl ?? "");
    }
  }, [links]);

  const update = trpc.menuLinks.updateLearnLinks.useMutation({
    onSuccess: () => {
      utils.menuLinks.getLearnLinks.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-[#189aa1]" />
          Sidebar Learn Links
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          Configure the external URLs for the four "Learn" links shown in the sidebar navigation.
          Leave a field blank to hide that link from the sidebar.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Learn Fetal Echo URL</label>
              <Input
                value={fetalUrl}
                onChange={(e) => setFetalUrl(e.target.value)}
                placeholder="https://www.allaboutultrasound.net/..."
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Learn Echo URL</label>
              <Input
                value={echoUrl}
                onChange={(e) => setEchoUrl(e.target.value)}
                placeholder="https://..."
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Learn Vascular URL</label>
              <Input
                value={vascularUrl}
                onChange={(e) => setVascularUrl(e.target.value)}
                placeholder="https://..."
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Learn POCUS URL</label>
              <Input
                value={pocusUrl}
                onChange={(e) => setPocusUrl(e.target.value)}
                placeholder="https://..."
                className="text-sm"
              />
            </div>
            <Button
              size="sm"
              className="flex items-center gap-2 text-white"
              style={{ background: "#189aa1" }}
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  learnFetalEchoUrl: fetalUrl,
                  learnEchoUrl: echoUrl,
                  learnPocusUrl: pocusUrl,
                  learnVascularUrl: vascularUrl,
                })
              }
            >
              {update.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              {saved ? "Saved!" : "Save Links"}
            </Button>
          </>
        )}
      </CardContent>
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
            <FlaskConical className="w-4 h-4 text-teal-600" />
            Demo Mode
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Enter the DIY Accreditation experience as a demo user. A teal banner will appear — click <strong>Exit Demo</strong> to return to your admin account.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-teal-500" />
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
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:border-teal-200 hover:bg-teal-50/50 transition-all text-left group disabled:opacity-60"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                        {(u.displayName ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-gray-800 truncate">{u.displayName}</div>
                        {u.credentials && <div className="text-[10px] text-gray-400 truncate">{u.credentials}</div>}
                        <div className="text-[10px] text-teal-500 font-medium mt-0.5 capitalize">
                          {u.memberRole === 'admin' ? 'Lab Admin' : u.memberRole ?? 'Member'}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-teal-400 flex-shrink-0" />
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

// ─── Enrollment Email Settings Panel ─────────────────────────────────────────

function DomainManagementPanel() {
  const { data, isLoading, refetch } = trpc.lmsAdmin.getCustomDomains.useQuery();
  const [newDomain, setNewDomain] = useState("");
  const updateDomains = trpc.lmsAdmin.updateCustomDomains.useMutation({
    onSuccess: () => { refetch(); setNewDomain(""); toast.success("Domains updated"); },
    onError: (e: any) => toast.error(e.message),
  });
  const domains: string[] = data?.domains ?? [];

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!d) return;
    if (domains.includes(d)) { toast.error("Domain already added"); return; }
    updateDomains.mutate({ domains: [...domains, d] });
  };

  const removeDomain = (d: string) => {
    updateDomains.mutate({ domains: domains.filter(x => x !== d) });
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Globe className="w-4 h-4 text-teal-600" /> Domain Management
        </CardTitle>
        <p className="text-xs text-gray-500">Add custom domains and subdomains. These appear in the funnel domain selector automatically.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-gray-400">Loading...</p>
        ) : (
          <>
            {domains.length === 0 && (
              <p className="text-xs text-gray-400 italic">No custom domains added yet.</p>
            )}
            {domains.map(d => (
              <div key={d} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-teal-500" />
                  <span className="text-sm font-mono">{d}</span>
                </div>
                <button
                  onClick={() => removeDomain(d)}
                  disabled={updateDomains.isPending}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addDomain()}
                placeholder="e.g. app.allaboutultrasound.com"
                className="h-8 text-sm flex-1"
              />
              <Button size="sm" onClick={addDomain} disabled={updateDomains.isPending || !newDomain.trim()} className="bg-teal-600 hover:bg-teal-700 text-white">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            <p className="text-xs text-gray-400">Enter domain without protocol (e.g. app.allaboutultrasound.com). Press Enter or click Add.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EnrollmentEmailSettingsPanel() {
  const { data: settings, isLoading, refetch } = trpc.lmsGroup.getPlatformSettings.useQuery();
  const [emailEnabled, setEmailEnabled] = useState<boolean>(true);
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setEmailEnabled(settings.enrollmentEmailEnabled ?? true);
      setSubject(settings.enrollmentEmailSubject ?? "");
      setIntro(settings.enrollmentEmailIntro ?? "");
      setDirty(false);
    }
  }, [settings]);

  const updateSettings = trpc.lmsGroup.updatePlatformSettings.useMutation({
    onSuccess: () => {
      toast.success("Enrollment email settings saved.");
      setDirty(false);
      refetch();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const handleSave = () => {
    updateSettings.mutate({
      enrollmentEmailEnabled: emailEnabled,
      enrollmentEmailSubject: subject.trim() || null,
      enrollmentEmailIntro: intro.trim() || null,
    });
  };

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Mail className="w-4 h-4 text-teal-600" />
          Enrollment Email Settings
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          Configure the welcome email sent to students when they enroll in a course.
          This is the platform-level master switch — individual courses can also opt out.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        {isLoading ? (
          <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />
        ) : (
          <>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium text-gray-800">Enable Enrollment Emails</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Master switch — when off, no enrollment emails are sent regardless of per-course settings.
                </p>
              </div>
              <Switch
                checked={emailEnabled}
                onCheckedChange={(v) => { setEmailEnabled(v); setDirty(true); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Custom Subject Line</Label>
              <Input
                value={subject}
                onChange={e => { setSubject(e.target.value); setDirty(true); }}
                placeholder={`e.g. "Welcome to {course name}! Here's how to get started"`}
                className="text-sm"
                disabled={!emailEnabled}
              />
              <p className="text-xs text-gray-400">Leave blank to use the default subject.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Custom Intro Paragraph</Label>
              <Textarea
                value={intro}
                onChange={e => { setIntro(e.target.value); setDirty(true); }}
                placeholder="Optional custom intro paragraph prepended to the enrollment email body (HTML supported)."
                className="text-sm min-h-[80px]"
                disabled={!emailEnabled}
              />
              <p className="text-xs text-gray-400">Leave blank to use the default intro text. HTML is supported.</p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!dirty || updateSettings.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                size="sm"
              >
                {updateSettings.isPending ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Publish Domain Settings Panel ──────────────────────────────────────────
function PublishDomainPanel() {
  const { data: settings, isLoading, refetch } = trpc.lmsGroup.getPlatformSettings.useQuery();
  const { data: domainsData } = trpc.lmsAdmin.getCustomDomains.useQuery();
  const [funnelDomain, setFunnelDomain] = useState<string>("");
  const [downloadDomain, setDownloadDomain] = useState<string>("");
  const [productDomain, setProductDomain] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  const domains: string[] = domainsData?.domains ?? [];
  const domainOptions = ["", ...domains]; // empty = use app subdomain

  useEffect(() => {
    if (settings) {
      setFunnelDomain(settings.funnelPublishDomain ?? "");
      setDownloadDomain(settings.downloadPublishDomain ?? "");
      setProductDomain(settings.productPublishDomain ?? "");
      setDirty(false);
    }
  }, [settings]);

  const updateSettings = trpc.lmsGroup.updatePlatformSettings.useMutation({
    onSuccess: () => { toast.success("Publish domain settings saved."); setDirty(false); refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const handleSave = () => {
    updateSettings.mutate({
      funnelPublishDomain: funnelDomain || null,
      downloadPublishDomain: downloadDomain || null,
      productPublishDomain: productDomain || null,
    });
  };

  const DomainSelect = ({ value, onChange, label, description }: { value: string; onChange: (v: string) => void; label: string; description: string }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <Select value={value} onValueChange={(v) => { onChange(v === "__app__" ? "" : v); setDirty(true); }}>
        <SelectTrigger className="text-sm">
          <SelectValue placeholder="Use app subdomain (default)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__app__">Use app subdomain (default)</SelectItem>
          {domains.map(d => (
            <SelectItem key={d} value={d}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-gray-400">{description}</p>
    </div>
  );

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Globe className="w-4 h-4 text-teal-600" />
          Publish Domain Settings
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          Choose which custom domain each content type is published on. Domains are managed in the Domain Management panel above.
          Funnels publish at the root (e.g. yourdomain.com/funnel-slug), downloads at /download/*, products at /product/*.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        {isLoading ? (
          <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />
        ) : (
          <>
            <DomainSelect
              value={funnelDomain || "__app__"}
              onChange={setFunnelDomain}
              label="Funnels Publish Domain"
              description="Funnel pages will be served at this domain (e.g. allaboutultrasound.com/funnel-slug)."
            />
            <DomainSelect
              value={downloadDomain || "__app__"}
              onChange={setDownloadDomain}
              label="Downloads Publish Domain"
              description="Download landing pages will be served at this domain (e.g. yourdomain.com/download/slug)."
            />
            <DomainSelect
              value={productDomain || "__app__"}
              onChange={setProductDomain}
              label="Products Publish Domain"
              description="Product landing pages will be served at this domain (e.g. yourdomain.com/product/slug)."
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!dirty || updateSettings.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                size="sm"
              >
                {updateSettings.isPending ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tool Card Types ─────────────────────────────────────────────────────────

type ToolCard = {
  id: string;
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
};

function SortableToolCard({ card }: { card: ToolCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const Icon = card.icon;
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 p-1 rounded cursor-grab opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity z-10"
        title="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5 text-gray-400" />
      </div>
      {card.href.startsWith("http") ? (
        <a href={card.href} target="_blank" rel="noopener noreferrer">
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200 cursor-pointer transition-all h-full">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: card.color + "18" }}>
              <Icon className="w-4.5 h-4.5" style={{ color: card.color }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 mb-0.5">{card.label}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{card.description}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium group-hover:gap-2 transition-all" style={{ color: card.color }}>
              Open <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </a>
      ) : (
        <Link href={card.href}>
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200 cursor-pointer transition-all h-full">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: card.color + "18" }}>
              <Icon className="w-4.5 h-4.5" style={{ color: card.color }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 mb-0.5">{card.label}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{card.description}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium group-hover:gap-2 transition-all" style={{ color: card.color }}>
              Open <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlatformAdmin() {
  const { user, isAuthenticated, loading } = useAuth();
  const isIHE = isIHeartEchoDomain();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userType, setUserType] = useState<'all'|'pending'|'active'|'premium'|'diy_admin'|'diy_user'|'platform_admin'|'free'>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);
  const [roleToAdd, setRoleToAdd] = useState<AppRole>("premium_user");
  const [bulkRole, setBulkRole] = useState<AppRole>("premium_user");
  const [dualBrand, setDualBrand] = useState<"aaus" | "iheartecho">(isIHE ? "iheartecho" : "aaus");

  // Dual App tool cards
  const DUAL_TOOLS_DEFAULT: ToolCard[] = [
    { id: "email", href: getAdminUrl("/admin/email-campaigns"), icon: Mail, label: "Email Campaigns", description: "Create and send email campaigns, manage sender profiles, and track open/click analytics", color: "#189aa1" },
    { id: "general-form-builder", href: getAdminUrl("/admin/general-forms"), icon: ClipboardList, label: "Form Builder", description: "Build public forms, surveys, and quizzes with branding, analytics, and share links", color: "#0e7490" },
    { id: "media-repository", href: getAdminUrl("/admin/media-repository"), icon: HardDrive, label: "Media Repository", description: "Shared media library with AAUS/IHE brand tags", color: "#0f766e" },
    { id: "lms", href: getAdminUrl("/admin/lms"), icon: Library, label: "LMS Management", description: "Manage courses, videos, and learning content", color: "#1d4ed8" },
    { id: "funnels", href: getAdminUrl("/admin/funnels"), icon: LayoutTemplate, label: "Funnel Management", description: "Build funnels, manage contacts/leads, and track Lead \u2192 User \u2192 Purchaser conversions", color: "#be185d" },
    { id: "members", href: getAdminUrl("/admin/members"), icon: Users, label: "Members", description: "Registered users, enrollments, sales, memberships, and activity logs", color: "#0d9488" },
    { id: "career-network", href: getAdminUrl("/admin/career-network"), icon: Briefcase, label: "Career Network", description: "Manage job postings, RSS feed sources, candidate profiles, and employer subscriptions", color: "#0369a1" },
  ];

  // Per-Brand tool cards (auto-scoped to current brand)
  const PER_BRAND_TOOLS_DEFAULT: ToolCard[] = [
    { id: "cases", href: getAdminUrl("/admin/cases"), icon: ClipboardList, label: "Case Management", description: "Manage clinical case submissions and reviews", color: "#189aa1" },
    { id: "quickfire", href: getAdminUrl("/admin/quickfire"), icon: Zap, label: "Daily Challenge", description: "Manage daily quiz challenges and questions", color: "#f59e0b" },
    { id: "scancoach", href: getAdminUrl("/admin/scancoach"), icon: Scan, label: "ScanCoach Editor", description: "Edit ScanCoach protocols and content", color: "#0891b2" },
    { id: "navigator", href: getAdminUrl("/admin/navigator"), icon: Globe, label: "Navigator Editor", description: "Edit Navigator pathways and content", color: "#7c3aed" },
    { id: "thinkific-webhook", href: getAdminUrl("/admin/thinkific-webhook"), icon: Webhook, label: "Thinkific Webhook", description: "Configure Thinkific course sync webhooks", color: "#be185d" },
    { id: "challenge-cards", href: getAdminUrl("/admin/challenge-cards"), icon: GraduationCap, label: "Challenge Card Generator", description: "Generate visual challenge cards for social media", color: "#059669" },
    { id: "social-content", href: getAdminUrl("/admin/social-content"), icon: Image, label: "Social Content Generator", description: "Create branded social media content", color: "#f97316" },
    { id: "soundbytes", href: getAdminUrl("/admin/soundbytes"), icon: Volume2, label: "SoundBytes Admin", description: "Manage SoundBytes audio content and playlists", color: "#7c3aed" },
  ];

  // IHE-only tool cards
  const IHE_ONLY_TOOLS_DEFAULT: ToolCard[] = [
    { id: "engagement", href: getAdminUrl("/admin/engagement"), icon: BarChart2, label: "Engagement Dashboard", description: "iHeartEcho engagement metrics and analytics", color: "#be185d" },
    { id: "image-quality", href: "/image-quality-review", icon: Image, label: "Image Quality Review", description: "Review and rate echo image quality submissions", color: "#0891b2" },
    { id: "diy-accreditation-admin", href: getAdminUrl("/admin/diy-accreditation"), icon: Award, label: "DIY Accreditation Admin", description: "Hub for all DIY Accreditation tools: navigator, forms, org management, lab admin", color: "#0891b2" },
    { id: "form-builder", href: getAdminUrl("/admin/form-builder"), icon: ClipboardList, label: "DIY Accreditation Forms", description: "Build accreditation review forms for DIY organizations", color: "#0891b2" },
  ];

  const [dualToolOrder, setDualToolOrder] = useState<string[]>(() => DUAL_TOOLS_DEFAULT.map(t => t.id));
  const [perBrandToolOrder, setPerBrandToolOrder] = useState<string[]>(() => PER_BRAND_TOOLS_DEFAULT.map(t => t.id));
  const [iheOnlyToolOrder, setIheOnlyToolOrder] = useState<string[]>(() => IHE_ONLY_TOOLS_DEFAULT.map(t => t.id));

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDualDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDualToolOrder(prev => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, []);

  const handlePerBrandDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPerBrandToolOrder(prev => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, []);

  const handleIheOnlyDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setIheOnlyToolOrder(prev => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, []);

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

  const { data: brandStats } = trpc.platformAdmin.brandStats.useQuery(
    { brand: dualBrand },
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
      <div className="min-h-screen bg-gray-50">
        <div className="container py-12 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container py-12 text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Authentication Required</h2>
          <p className="text-gray-500 mb-4">Please sign in to access the admin panel.</p>
          <Link href="/"><Button variant="outline">Go Home</Button></Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container py-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-4">You do not have permission to access the Platform Admin panel.</p>
          <Link href="/"><Button variant="outline">Go Home</Button></Link>
        </div>
      </div>
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
    <div className="min-h-screen bg-gray-50">
      {/* Sticky navigation header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="container max-w-6xl flex items-center gap-3 h-14">
          <a
            href="/my-dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            My Dashboard
          </a>
          <span className="text-gray-300">|</span>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </a>
          <span className="flex-1" />
          <span className="text-xs font-semibold text-[#189aa1] bg-[#189aa1]/10 px-2.5 py-1 rounded-full">
            Platform Admin
          </span>
        </div>
      </div>
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
            { label: `Premium Users (${dualBrand === "aaus" ? "AAUS" : "iHE"})`, value: brandStats?.premiumCount ?? 0, icon: Crown, color: "#d97706" },
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

        {/* ── Dual App Tools ────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Dual App Tools</h2>
              <p className="text-xs text-gray-400 mt-0.5">Shared database — accessible from both platforms. Drag cards to reorder.</p>
            </div>
            {/* Brand toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setDualBrand("aaus")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  dualBrand === "aaus"
                    ? "bg-white shadow text-[#189aa1]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All About Ultrasound™
              </button>
              <button
                onClick={() => setDualBrand("iheartecho")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  dualBrand === "iheartecho"
                    ? "bg-white shadow text-[#be185d]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                iHeartEcho™
              </button>
            </div>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              dualBrand === "aaus" ? "bg-teal-50 text-teal-700" : "bg-pink-50 text-pink-700"
            }`}>
              <Globe className="w-3 h-3" />
              Viewing as: {dualBrand === "aaus" ? "All About Ultrasound™" : "iHeartEcho™"}
            </span>
          </div>
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDualDragEnd}>
            <SortableContext items={dualToolOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {dualToolOrder.map(id => {
                  const card = DUAL_TOOLS_DEFAULT.find(t => t.id === id);
                  if (!card) return null;
                  return <SortableToolCard key={card.id} card={card} />;
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* ── Per-Brand Tools ───────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Per-Brand Tools</h2>
            <p className="text-xs text-gray-400 mt-0.5">Available on both platforms — each operates for the current brand. Drag cards to reorder.</p>
          </div>
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handlePerBrandDragEnd}>
            <SortableContext items={perBrandToolOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {perBrandToolOrder.map(id => {
                  const card = PER_BRAND_TOOLS_DEFAULT.find(t => t.id === id);
                  if (!card) return null;
                  return <SortableToolCard key={card.id} card={card} />;
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* ── iHeartEcho Only Tools ─────────────────────────────────── */}
        {/* Show to platform admins on any domain — they manage both brands */}
        {(isIHE || isPlatformAdminOrOwner) && (
          <div className="mb-8">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">iHeartEcho Only</h2>
              <p className="text-xs text-gray-400 mt-0.5">Exclusive to the iHeartEcho platform. Drag cards to reorder.</p>
            </div>
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleIheOnlyDragEnd}>
              <SortableContext items={iheOnlyToolOrder} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {iheOnlyToolOrder.map(id => {
                    const card = IHE_ONLY_TOOLS_DEFAULT.find(t => t.id === id);
                    if (!card) return null;
                    return <SortableToolCard key={card.id} card={card} />;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Sidebar Learn Links */}
        <MenuLinksPanel />

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
                  Create All About Ultrasound™ accounts for all existing Thinkific members who don&apos;t have one yet.
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

        {/* User Search → Members Hub */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#189aa1]" />
              User Search
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-gray-500 mb-3">Search for a user to open their full profile in the Members hub.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (userSearchQuery.trim()) {
                  window.location.href = getAdminUrl(`/admin/members?tab=members&search=${encodeURIComponent(userSearchQuery.trim())}`);
                } else {
                  window.location.href = getAdminUrl("/admin/members");
                }
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email…"
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Button type="submit" style={{ background: "#189aa1" }} className="text-white h-9 px-4 text-sm gap-1.5">
                <Users className="w-4 h-4" />
                Open in Members
              </Button>
            </form>
            <div className="mt-3 flex gap-2 flex-wrap">
              <a href={getAdminUrl("/admin/members")}>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View All Members
                </Button>
              </a>
              <a href={getAdminUrl("/admin/members?tab=enrollments")}>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Enrollments
                </Button>
              </a>
              <a href={getAdminUrl("/admin/members?tab=sales")}>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Sales
                </Button>
              </a>
            </div>
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

        {/* Domain Management */}
        <DomainManagementPanel />

        {/* Enrollment Email Settings — Publish Domain Settings moved to LMS Admin → Settings → Publish Domains */}
        <EnrollmentEmailSettingsPanel />

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
    </div>
  );
}
