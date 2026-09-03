/*
  Platform Admin — All About Ultrasound™
  Accessible only to users with role === "admin" (owner) or "platform_admin" role.
  Features:
  - Add user by email (search → preview → assign role)
  - User list with search/filter
  - Inline role assignment and removal
  - Stats overview
*/

import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
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
  Code2,
  UserCircle2,
  PlusCircle,
  Pencil,
  FileQuestion,
  AlertTriangle,
  Bell,
  Radio,
  BookOpen,
  FileText,
  SendHorizonal,
  XCircle,
  DollarSign,
  SplitSquareHorizontal,
  Link2,
  Download,
  Filter,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import BulkCsvUploadPanel, { type BulkResult } from "@/components/BulkCsvUploadPanel";
import { isIHeartEchoDomain, LEARN_APP_URL, APP_URL, getAdminUrl } from "@/hooks/useSubdomain";
import RichTextEditor, { RichTextDisplay } from "@/components/RichTextEditor";
import { perBrandAdminUrl } from "@/lib/perBrandUrls";
import { ContentWaitlistDashboard } from "@/components/admin/ContentWaitlistDashboard";

// Lazy-loaded CME Management Hub components
const CmeFormsListTab = lazy(() => import("@/components/admin/CmeFormsListTab").then(m => ({ default: m.CmeFormsListTab })));
const CertificateTemplatesAdmin = lazy(() => import("./admin/CertificateTemplatesAdmin"));

type AppRole = "user" | "premium_user" | "diy_admin" | "diy_user" | "platform_admin" | "platform_manager" | "accreditation_manager";

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
  platform_manager: {
    label: "Platform Manager",
    color: "bg-cyan-100 text-cyan-800",
    icon: UserCog,
    description: "Manage members, subscriptions, content, and email campaigns without revenue, currency, or delete permissions",
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

// ─── CME Auto-Enroll Settings Panel ─────────────────────────────────────────
function CmeAutoEnrollSettingsPanel() {
  const { data, isLoading, refetch } = trpc.siteSettings.getCmeAutoEnrollEmails.useQuery();
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setEmails(data.emails);
  }, [data]);

  const updateMutation = trpc.siteSettings.updateCmeAutoEnrollEmails.useMutation({
    onSuccess: () => { toast.success("CME auto-enroll list saved."); refetch(); setSaving(false); },
    onError: (e: any) => { toast.error("Save failed: " + e.message); setSaving(false); },
  });

  const addEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;
    if (emails.includes(trimmed)) { toast.error("Email already in list"); return; }
    setEmails(prev => [...prev, trimmed]);
    setNewEmail("");
  };

  const removeEmail = (email: string) => setEmails(prev => prev.filter(e => e !== email));

  const handleSave = () => { setSaving(true); updateMutation.mutate({ emails }); };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-teal-600" />
          CME Auto-Enroll on CardioServ Send
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          When a CME Activity Planning form is sent to CardioServ, these users are automatically enrolled in the course so they can review it.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <>
            <div className="space-y-1.5">
              {emails.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No emails configured.</p>
              ) : (
                emails.map(email => (
                  <div key={email} className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
                    <span className="text-sm font-mono">{email}</span>
                    <button onClick={() => removeEmail(email)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add email address…"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addEmail()}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={addEmail} className="h-8">Add</Button>
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Send Test Email Panel ───────────────────────────────────────────────────
function SendTestEmailPanel() {
  const { data: me } = trpc.auth.me.useQuery();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [brandMode, setBrandMode] = useState<"aaus" | "iheartecho">("aaus");
  const [lastResult, setLastResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Pre-fill with the logged-in admin's email
  useEffect(() => {
    if (me?.email && !recipientEmail) setRecipientEmail(me.email);
  }, [me?.email]);

  const sendTest = trpc.lmsGroup.sendTestEmail.useMutation({
    onSuccess: (data) => {
      setLastResult({ ok: true, msg: `Test email sent to ${data.sentTo}. Check your inbox (and spam folder).` });
      toast.success(`Test email sent to ${data.sentTo}`);
    },
    onError: (e: { message: string }) => {
      setLastResult({ ok: false, msg: e.message });
      toast.error(e.message);
    },
  });

  const handleSend = () => {
    if (!recipientEmail.trim()) { toast.error("Enter a recipient email address."); return; }
    setLastResult(null);
    sendTest.mutate({ recipientEmail: recipientEmail.trim(), brandMode });
  };

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <SendHorizonal className="w-4 h-4 text-teal-600" />
          Send Test Email
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          Send a test email to verify that your SendGrid API key and sender configuration are working correctly.
          The test email is logged in the email send log just like a real email.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Recipient Email</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="you@example.com"
              className="text-sm"
            />
            <p className="text-xs text-gray-400">Pre-filled with your admin email. Change to test any address.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Brand</Label>
            <Select value={brandMode} onValueChange={(v) => setBrandMode(v as "aaus" | "iheartecho")}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aaus">All About Ultrasound</SelectItem>
                <SelectItem value="iheartecho">iHeartEcho</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">Tests the selected brand's sender address and email template.</p>
          </div>
        </div>

        {lastResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
            lastResult.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"
          }`}>
            {lastResult.ok
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
              : <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />}
            <span>{lastResult.msg}</span>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={handleSend}
            disabled={sendTest.isPending || !recipientEmail.trim()}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            size="sm"
          >
            {sendTest.isPending ? (
              <><span className="animate-spin mr-1.5">⟳</span> Sending…</>
            ) : (
              <><SendHorizonal className="w-3.5 h-3.5 mr-1.5" /> Send Test Email</>
            )}
          </Button>
        </div>
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

// ─── Default Brand Settings Panel ──────────────────────────────────────────
function DefaultBrandPanel() {
  const { data: settings, isLoading, refetch } = trpc.lmsGroup.getPlatformSettings.useQuery();
  const [defaultBrand, setDefaultBrand] = useState<"aaus" | "iheartecho">("aaus");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setDefaultBrand((settings.defaultBrand as "aaus" | "iheartecho") ?? "aaus");
      setDirty(false);
    }
  }, [settings]);

  const updateSettings = trpc.lmsGroup.updatePlatformSettings.useMutation({
    onSuccess: () => { toast.success("Default brand saved."); setDirty(false); refetch(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Globe className="w-4 h-4 text-teal-600" />
          Default Brand
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          When a request comes from a domain that doesn't match any known brand (e.g. the Manus dev URL or a generic custom domain),
          this brand is used as the fallback for data scoping and email templates.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {isLoading ? (
          <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Fallback Brand</Label>
              <Select value={defaultBrand} onValueChange={(v) => { setDefaultBrand(v as "aaus" | "iheartecho"); setDirty(true); }}>
                <SelectTrigger className="text-sm max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aaus">All About Ultrasound (AAUS)</SelectItem>
                  <SelectItem value="iheartecho">iHeartEcho</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">This only affects requests from ambiguous domains. Explicit brand domains (allaboutultrasound.com, iheartecho.com) always take priority.</p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => updateSettings.mutate({ defaultBrand })}
                disabled={!dirty || updateSettings.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                size="sm"
              >
                {updateSettings.isPending ? "Saving…" : "Save"}
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


// ─── Tracking Pixels Panel ───────────────────────────────────────────────────
function TrackingPixelsPanel() {
  const { data: pixels, refetch } = trpc.siteSettings.getPixelIds.useQuery();
  const updatePixel = trpc.siteSettings.updatePixelId.useMutation({
    onSuccess: () => {
      toast.success("Pixel ID saved.");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const BRANDS: { key: "aaus" | "ihe" | "learn"; label: string; domain: string }[] = [
    { key: "aaus", label: "All About Ultrasound", domain: "app.allaboutultrasound.com" },
    { key: "ihe", label: "iHeartEcho", domain: "app.iheartecho.com" },
    { key: "learn", label: "Learn (AAUS)", domain: "learn.allaboutultrasound.com" },
  ];

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Initialise drafts once pixels load
  useEffect(() => {
    if (pixels) {
      setDrafts({
        aaus: pixels.aaus ?? "",
        ihe: pixels.ihe ?? "",
        learn: pixels.learn ?? "",
      });
    }
  }, [pixels]);

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#189aa1]" />
          Meta Pixel IDs
        </CardTitle>
        <p className="text-xs text-gray-500 mt-0.5">
          Enter a Meta Pixel ID for each brand. Leave blank to disable tracking for that domain. Changes take effect immediately on the live site.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {BRANDS.map(({ key, label, domain }) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="sm:w-56 flex-shrink-0">
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-400">{domain}</p>
            </div>
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="e.g. 1234567890123456"
                value={drafts[key] ?? ""}
                onChange={e => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                className="flex-1 font-mono text-sm"
              />
              <Button
                size="sm"
                disabled={updatePixel.isPending || drafts[key] === (pixels?.[key] ?? "")}
                onClick={() => updatePixel.mutate({ brand: key, pixelId: drafts[key] || null })}
                style={{ background: "#189aa1" }}
                className="text-white flex-shrink-0"
              >
                Save
              </Button>
              {pixels?.[key] && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updatePixel.isPending}
                  onClick={() => {
                    setDrafts(prev => ({ ...prev, [key]: "" }));
                    updatePixel.mutate({ brand: key, pixelId: null });
                  }}
                  className="text-red-500 border-red-200 hover:bg-red-50 flex-shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
            {pixels?.[key] && (
              <span className="text-xs text-green-600 font-medium flex-shrink-0">Active</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CheckoutTermsPanel() {
  const { data: terms, refetch } = trpc.siteSettings.getCheckoutTerms.useQuery();
  const updateTerms = trpc.siteSettings.updateCheckoutTerms.useMutation({
    onSuccess: () => {
      toast.success("Checkout terms saved.");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [draft, setDraft] = useState({
    termsText: "",
    termsLink1Text: "",
    termsLink1Url: "",
    termsLink2Text: "",
    termsLink2Url: "",
  });
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (terms && !initialised) {
      setDraft({
        termsText: terms.termsText ?? "",
        termsLink1Text: terms.termsLink1Text ?? "",
        termsLink1Url: terms.termsLink1Url ?? "",
        termsLink2Text: terms.termsLink2Text ?? "",
        termsLink2Url: terms.termsLink2Url ?? "",
      });
      setInitialised(true);
    }
  }, [terms, initialised]);

  const isDirty =
    initialised &&
    terms &&
    (
      draft.termsText !== (terms.termsText ?? "") ||
      draft.termsLink1Text !== (terms.termsLink1Text ?? "") ||
      draft.termsLink1Url !== (terms.termsLink1Url ?? "") ||
      draft.termsLink2Text !== (terms.termsLink2Text ?? "") ||
      draft.termsLink2Url !== (terms.termsLink2Url ?? "")
    );

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#189aa1]" />
          Checkout Terms Agreement Text
        </CardTitle>
        <p className="text-xs text-gray-500 mt-0.5">
          Customise the checkbox text shown to customers during Stripe checkout. The sentence is followed by two linked labels (e.g. "Terms of Service" and "Privacy Policy"). Leave a field blank to use the built-in default.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Terms sentence */}
        <div>
          <Label className="text-xs font-medium text-gray-700 mb-1 block">Agreement sentence</Label>
          <RichTextEditor
            value={draft.termsText}
            onChange={val => setDraft(prev => ({ ...prev, termsText: val }))}
            placeholder="e.g. I have reviewed and agree to the"
          />
          <p className="text-xs text-gray-400 mt-1">This text appears before the two links. HTML formatting is supported.</p>
        </div>
        {/* Link 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-gray-700 mb-1 block">Link 1 label</Label>
            <Input
              placeholder="e.g. Terms of Service"
              value={draft.termsLink1Text}
              onChange={e => setDraft(prev => ({ ...prev, termsLink1Text: e.target.value }))}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-700 mb-1 block">Link 1 URL</Label>
            <Input
              placeholder="https://example.com/terms"
              value={draft.termsLink1Url}
              onChange={e => setDraft(prev => ({ ...prev, termsLink1Url: e.target.value }))}
              className="text-sm font-mono"
            />
          </div>
        </div>
        {/* Link 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-gray-700 mb-1 block">Link 2 label</Label>
            <Input
              placeholder="e.g. Privacy Policy"
              value={draft.termsLink2Text}
              onChange={e => setDraft(prev => ({ ...prev, termsLink2Text: e.target.value }))}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-700 mb-1 block">Link 2 URL</Label>
            <Input
              placeholder="https://example.com/privacy"
              value={draft.termsLink2Url}
              onChange={e => setDraft(prev => ({ ...prev, termsLink2Url: e.target.value }))}
              className="text-sm font-mono"
            />
          </div>
        </div>
        {/* Preview */}
        <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-xs text-gray-500 mb-1 font-medium">Preview</p>
          <p className="text-sm text-gray-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-gray-400 inline-block flex-shrink-0" />
              {draft.termsText || "I have reviewed and agree to the"}{" "}
              <a className="text-[#189aa1] underline" href={draft.termsLink1Url || "#"} target="_blank" rel="noreferrer">
                {draft.termsLink1Text || "Terms of Service"}
              </a>{" "}
              and{" "}
              <a className="text-[#189aa1] underline" href={draft.termsLink2Url || "#"} target="_blank" rel="noreferrer">
                {draft.termsLink2Text || "Privacy Policy"}
              </a>
            </span>
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!isDirty || updateTerms.isPending}
            onClick={() => updateTerms.mutate({
              termsText: draft.termsText || null,
              termsLink1Text: draft.termsLink1Text || null,
              termsLink1Url: draft.termsLink1Url || null,
              termsLink2Text: draft.termsLink2Text || null,
              termsLink2Url: draft.termsLink2Url || null,
            })}
            style={{ background: "#189aa1" }}
            className="text-white"
          >
            {updateTerms.isPending ? "Saving…" : "Save Terms"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
    { id: "quiz-creator", href: getAdminUrl("/admin/quiz-creator"), icon: FileQuestion, label: "Quiz Creator", description: "Build standalone quizzes and mock exams from the question bank with analytics", color: "#0e7490" },
    { id: "question-bank", href: getAdminUrl("/question-bank"), icon: BookOpen, label: "Question Bank", description: "Browse, import (SCORM/CSV/XLSX), and manage the shared question bank used across all quizzes", color: "#0f766e" },
    { id: "funnels", href: getAdminUrl("/admin/funnels"), icon: LayoutTemplate, label: "Funnel Management", description: "Build funnels, manage contacts/leads, and track Lead \u2192 User \u2192 Purchaser conversions", color: "#be185d" },
    { id: "widgets", href: getAdminUrl("/admin/widgets"), icon: Code2, label: "Embed Widgets", description: "Create embeddable course/quiz card widgets for any external website", color: "#7c3aed" },
    { id: "members", href: getAdminUrl("/admin/members"), icon: Users, label: "Members", description: "Registered users, enrollments, sales, memberships, and activity logs", color: "#0d9488" },
    { id: "duplicate-payments", href: getAdminUrl("/admin/duplicate-payments"), icon: AlertTriangle, label: "Duplicate Payments", description: "Review flagged duplicate charges and duplicate brand memberships before Stripe renewals", color: "#d97706" },
    { id: "career-network", href: getAdminUrl("/admin/career-network"), icon: Briefcase, label: "Career Network", description: "Manage job postings, RSS feed sources, candidate profiles, and employer subscriptions", color: "#0369a1" },
    { id: "notifications", href: getAdminUrl("/admin/notifications"), icon: Bell, label: "Admin Notifications", description: "In-app log of all admin events: orders, enrollments, memberships, and system alerts", color: "#0d9488" },
    { id: "revenue-share", href: getAdminUrl("/admin/revenue-share"), icon: SplitSquareHorizontal, label: "Revenue Share", description: "Manage revenue share partners, assign percentages per product, and process automatic Stripe payouts", color: "#059669" },
  ];

  // Per-Brand tool cards — hrefs include `-aaus` / `-ihe` from brand selector above
  const PER_BRAND_TOOLS_META = [
    { id: "cases", basePath: "/admin/cases", icon: ClipboardList, label: "Case Management", description: "Manage clinical case submissions and reviews", color: "#189aa1" },
    { id: "quickfire", basePath: "/admin/quickfire", icon: Zap, label: "Daily Challenge", description: "Manage daily quiz challenges and questions", color: "#f59e0b" },
    { id: "scancoach", basePath: "/admin/scancoach", icon: Scan, label: "ScanCoach Editor", description: "Edit ScanCoach protocols and content", color: "#0891b2" },
    { id: "navigator", basePath: "/admin/navigator", icon: Globe, label: "Navigator Editor", description: "Edit Navigator pathways and content", color: "#7c3aed" },
    { id: "challenge-cards", basePath: "/admin/challenge-cards", icon: GraduationCap, label: "Challenge Card Generator", description: "Generate visual challenge cards for social media", color: "#059669" },
    { id: "social-content", basePath: "/admin/social-content", icon: Image, label: "Social Content Generator", description: "Create branded social media content", color: "#f97316" },
    { id: "soundbytes", basePath: "/admin/soundbytes", icon: Volume2, label: "SoundBytes Admin", description: "Manage SoundBytes audio content and playlists", color: "#7c3aed" },
  ] as const;

  const perBrandTools = useMemo<ToolCard[]>(
    () =>
      PER_BRAND_TOOLS_META.map((t) => ({
        id: t.id,
        href: perBrandAdminUrl(t.basePath, dualBrand),
        icon: t.icon,
        label: t.label,
        description: t.description,
        color: t.color,
      })),
    [dualBrand],
  );

  // IHE-only tool cards
  const IHE_ONLY_TOOLS_DEFAULT: ToolCard[] = [
    { id: "engagement", href: getAdminUrl("/admin/engagement"), icon: BarChart2, label: "Engagement Dashboard", description: "iHeartEcho engagement metrics and analytics", color: "#be185d" },
    { id: "image-quality", href: "/image-quality-review", icon: Image, label: "Image Quality Review", description: "Review and rate echo image quality submissions", color: "#0891b2" },
    { id: "diy-accreditation-admin", href: getAdminUrl("/admin/diy-accreditation"), icon: Award, label: "DIY Accreditation Admin", description: "Hub for all DIY Accreditation tools: navigator, forms, org management, lab admin", color: "#0891b2" },
    { id: "form-builder", href: getAdminUrl("/admin/form-builder"), icon: ClipboardList, label: "DIY Accreditation Forms", description: "Build accreditation review forms for DIY organizations", color: "#0891b2" },
  ];

  const [dualToolOrder, setDualToolOrder] = useState<string[]>(() => DUAL_TOOLS_DEFAULT.map(t => t.id));
  const [perBrandToolOrder, setPerBrandToolOrder] = useState<string[]>(() => PER_BRAND_TOOLS_META.map(t => t.id));
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

  const [lastRegistrySyncResult, setLastRegistrySyncResult] = useState<{ count: number; syncedAt: Date } | null>(null);
  // ── Posting Aliases ─────────────────────────────────────────────────────
  const { data: aliasList = [], refetch: refetchAliases } = trpc.admin.listPostingAliases.useQuery();
  const [aliasDialog, setAliasDialog] = useState<{ open: boolean; id?: number; name: string; email: string; avatarUrl: string; bio: string }>({ open: false, name: "", email: "", avatarUrl: "", bio: "" });
  const createAlias = trpc.admin.createPostingAlias.useMutation({
    onSuccess: () => { refetchAliases(); setAliasDialog({ open: false, name: "", email: "", avatarUrl: "", bio: "" }); toast.success("Alias created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateAlias = trpc.admin.updatePostingAlias.useMutation({
    onSuccess: () => { refetchAliases(); setAliasDialog({ open: false, name: "", email: "", avatarUrl: "", bio: "" }); toast.success("Alias updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteAlias = trpc.admin.deletePostingAlias.useMutation({
    onSuccess: () => { refetchAliases(); toast.success("Alias deleted"); },
    onError: (e) => toast.error(e.message),
  });
  // ── CME Course Linker ─────────────────────────────────────────────────────
  const [showCmeLinker, setShowCmeLinker] = useState(false);
  const [cmeSearch, setCmeSearch] = useState("");
  const { data: cmeLinkData, refetch: refetchCmeLinks } = trpc.platformAdmin.listCmeCourseLinks.useQuery(
    undefined,
    { enabled: showCmeLinker }
  );
  const autoLinkMutation = trpc.platformAdmin.autoLinkCmeCoursesBySlug.useMutation({
    onSuccess: (data) => {
      refetchCmeLinks();
      toast.success(`Auto-linked ${data.linked} of ${data.total} unlinked CME courses by slug match.`);
    },
    onError: (err) => toast.error(`Auto-link failed: ${err.message}`),
  });
  const linkCourseMutation = trpc.platformAdmin.linkCmeCourseToNative.useMutation({
    onSuccess: () => refetchCmeLinks(),
    onError: (err) => toast.error(`Link failed: ${err.message}`),
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
            <p className="text-xs text-gray-400 mt-0.5">Available on both platforms — links use the brand selected above (<code className="text-[10px]">-aaus</code> / <code className="text-[10px]">-ihe</code> URL suffix). Drag cards to reorder.</p>
          </div>
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handlePerBrandDragEnd}>
            <SortableContext items={perBrandToolOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {perBrandToolOrder.map(id => {
                  const card = perBrandTools.find(t => t.id === id);
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

        {/* Tracking Pixels */}
        <TrackingPixelsPanel />

        {/* Checkout Terms */}
        <CheckoutTermsPanel />


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


        {/* CME Course Linker */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              CME Course Linker
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-gray-600 mb-3">
              Link each CME course to its native LMS course so the CME Hub routes enrolled users to this platform.
              {cmeLinkData && (
                <span className="ml-1 text-xs text-gray-400">
                  ({cmeLinkData.cmeRows.filter(r => r.nativeLmsCourseId).length}/{cmeLinkData.cmeRows.length} linked)
                </span>
              )}
            </p>
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCmeLinker(v => !v)}
                className="gap-2"
              >
                <GraduationCap className="w-4 h-4" />
                {showCmeLinker ? "Hide" : "Show"} Course Links
              </Button>
              {showCmeLinker && (
                <Button
                  size="sm"
                  onClick={() => autoLinkMutation.mutate()}
                  disabled={autoLinkMutation.isPending}
                  style={{ background: "#189aa1" }}
                  className="gap-2 text-white"
                >
                  <RefreshCw className={`w-4 h-4 ${autoLinkMutation.isPending ? "animate-spin" : ""}`} />
                  {autoLinkMutation.isPending ? "Auto-linking…" : "Auto-link by Slug"}
                </Button>
              )}
            </div>
            {showCmeLinker && (
              <div className="space-y-2">
                <Input
                  placeholder="Search CME courses…"
                  value={cmeSearch}
                  onChange={e => setCmeSearch(e.target.value)}
                  className="mb-3 h-8 text-sm"
                />
                {!cmeLinkData ? (
                  <p className="text-xs text-gray-400">Loading…</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {cmeLinkData.cmeRows
                      .filter(r => !cmeSearch || r.name.toLowerCase().includes(cmeSearch.toLowerCase()))
                      .map(cme => {
                        const linked = cmeLinkData.lmsRows.find(l => l.id === cme.nativeLmsCourseId);
                        return (
                          <div key={cme.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{cme.name}</p>
                              <p className="text-xs text-gray-400 truncate">{cme.slug}</p>
                            </div>
                            {linked ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-[#189aa1] font-medium truncate max-w-[140px]">{linked.title}</span>
                                <button
                                  onClick={() => linkCourseMutation.mutate({ cmeCourseId: cme.id, nativeLmsCourseId: null })}
                                  className="text-gray-300 hover:text-red-400 flex-shrink-0"
                                  title="Unlink"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <Select
                                value=""
                                onValueChange={v => linkCourseMutation.mutate({ cmeCourseId: cme.id, nativeLmsCourseId: parseInt(v) })}
                              >
                                <SelectTrigger className="h-7 text-xs w-48 flex-shrink-0">
                                  <SelectValue placeholder="Link to native course…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cmeLinkData.lmsRows.map(l => (
                                    <SelectItem key={l.id} value={String(l.id)}>
                                      <span className="text-xs">{l.title}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Posting Aliases */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <UserCircle2 className="w-4 h-4 text-[#189aa1]" />
              Posting Aliases
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Create named aliases (e.g., "All About Ultrasound Support") that you can post as in community feeds and cohort discussions.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <Button
              size="sm"
              onClick={() => setAliasDialog({ open: true, name: "", email: "", avatarUrl: "", bio: "" })}
              style={{ background: "#189aa1" }}
              className="text-white gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              New Alias
            </Button>
            {aliasList.length === 0 ? (
              <p className="text-xs text-gray-400">No aliases yet. Create one to post as a support account.</p>
            ) : (
              <div className="space-y-2">
                {aliasList.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    {a.avatarUrl ? (
                      <img src={a.avatarUrl} alt={a.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-teal-700">{a.name[0]?.toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.email}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="ghost" size="icon"
                        className="w-7 h-7 text-gray-400 hover:text-teal-600"
                        onClick={() => setAliasDialog({ open: true, id: a.id, name: a.name, email: a.email, avatarUrl: a.avatarUrl ?? "", bio: a.bio ?? "" })}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="w-7 h-7 text-gray-400 hover:text-red-500"
                        onClick={() => { if (confirm(`Delete alias "${a.name}"?`)) deleteAlias.mutate({ id: a.id }); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── CME Management Hub ─────────────────────────────────────────── */}
        <CmeManagementHub />

        {/* Alias create/edit dialog */}
        <Dialog open={aliasDialog.open} onOpenChange={open => !open && setAliasDialog(d => ({ ...d, open: false }))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{aliasDialog.id ? "Edit Alias" : "New Posting Alias"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs">Display Name *</Label>
                <Input value={aliasDialog.name} onChange={e => setAliasDialog(d => ({ ...d, name: e.target.value }))} placeholder="All About Ultrasound Support" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input value={aliasDialog.email} onChange={e => setAliasDialog(d => ({ ...d, email: e.target.value }))} placeholder="support@allaboutultrasound.com" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Avatar URL (optional)</Label>
                <Input value={aliasDialog.avatarUrl} onChange={e => setAliasDialog(d => ({ ...d, avatarUrl: e.target.value }))} placeholder="https://..." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Bio (optional)</Label>
                <Textarea value={aliasDialog.bio} onChange={e => setAliasDialog(d => ({ ...d, bio: e.target.value }))} placeholder="Official support account for All About Ultrasound" className="mt-1 text-sm" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAliasDialog(d => ({ ...d, open: false }))}>Cancel</Button>
              <Button
                style={{ background: "#189aa1" }}
                className="text-white"
                disabled={!aliasDialog.name.trim() || !aliasDialog.email.trim() || createAlias.isPending || updateAlias.isPending}
                onClick={() => {
                  if (aliasDialog.id) {
                    updateAlias.mutate({ id: aliasDialog.id, name: aliasDialog.name.trim(), email: aliasDialog.email.trim(), avatarUrl: aliasDialog.avatarUrl.trim() || undefined, bio: aliasDialog.bio.trim() || undefined });
                  } else {
                    createAlias.mutate({ name: aliasDialog.name.trim(), email: aliasDialog.email.trim(), avatarUrl: aliasDialog.avatarUrl.trim() || undefined, bio: aliasDialog.bio.trim() || undefined });
                  }
                }}
              >
                {(createAlias.isPending || updateAlias.isPending) ? "Saving…" : aliasDialog.id ? "Save Changes" : "Create Alias"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

        {/* Enrollment Email Settings */}
        <EnrollmentEmailSettingsPanel />

        {/* CME Auto-Enroll Settings */}
        <CmeAutoEnrollSettingsPanel />

        {/* Send Test Email */}
        <SendTestEmailPanel />

        {/* Publish Domain Settings */}
        <PublishDomainPanel />

        {/* Default Brand Fallback */}
        <DefaultBrandPanel />

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

// ─── CSV Export Helper ────────────────────────────────────────────────────────
function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v == null ? "" : String(v).replace(/"/g, '""');
    return /[,"\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── CME Management Hub ────────────────────────────────────────────────────────
function CmeManagementHub() {
  const [activeTab, setActiveTab] = useState<"certificates" | "activity_forms" | "disclosures" | "sdms_cme" | "notify_signups" | "waitlists" | "google_drive">("activity_forms");
  const [notifySearch, setNotifySearch] = useState("");
  const [notifyTypeFilter, setNotifyTypeFilter] = useState("");
  const [disclosureSubTab, setDisclosureSubTab] = useState<"course_linked" | "generic">("course_linked");
  const [genericSearch, setGenericSearch] = useState("");
  const [genericRelFilter, setGenericRelFilter] = useState<"all" | "none" | "disclosed">("all");
  const [genericDateFrom, setGenericDateFrom] = useState("");
  const [genericDateTo, setGenericDateTo] = useState("");
  const [courseDiscSearch, setCourseDiscSearch] = useState("");
  const [courseDiscStatus, setCourseDiscStatus] = useState<"all" | "sent" | "submitted" | "received">("all");
  const [courseDiscDateFrom, setCourseDiscDateFrom] = useState("");
  const [courseDiscDateTo, setCourseDiscDateTo] = useState("");
  const [selectedDiscIds, setSelectedDiscIds] = useState<Set<number>>(new Set());
  const [viewDisclosure, setViewDisclosure] = useState<any>(null);

  const { data: genericData, isLoading: genericLoading, refetch: refetchGeneric } = trpc.lmsAdmin.listGenericDisclosures.useQuery(
    {
      search: genericSearch || undefined,
      relationships: genericRelFilter === "all" ? undefined : genericRelFilter,
      dateFrom: genericDateFrom ? new Date(genericDateFrom).getTime() : undefined,
      dateTo: genericDateTo ? new Date(genericDateTo + "T23:59:59").getTime() : undefined,
    },
    { enabled: activeTab === "disclosures" }
  );
  const genericRows: any[] = (genericData as any)?.rows ?? [];

  const { data: courseDiscData, isLoading: courseDiscLoading, refetch: refetchCourseDisc } = trpc.lmsAdmin.listAllCourseDisclosures.useQuery(
    {
      search: courseDiscSearch || undefined,
      status: courseDiscStatus,
      dateFrom: courseDiscDateFrom ? new Date(courseDiscDateFrom).getTime() : undefined,
      dateTo: courseDiscDateTo ? new Date(courseDiscDateTo + "T23:59:59").getTime() : undefined,
    },
    { enabled: activeTab === "disclosures" }
  );
  const courseDiscRows: any[] = (courseDiscData as any)?.rows ?? [];

  const bulkMarkReceived = trpc.lmsAdmin.bulkMarkDisclosuresReceived.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated} disclosure(s) marked as received.`);
      setSelectedDiscIds(new Set());
      refetchCourseDisc();
    },
    onError: (e) => toast.error("Failed to mark received: " + e.message),
  });

  const pageFallback = (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin h-6 w-6 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3 border-b border-gray-100">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Award className="w-4 h-4 text-[#189aa1]" />
          CME Management Hub
        </CardTitle>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage CME certificates, activity planning forms, financial disclosures, and SDMS CME data across all eligible courses.
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Tab navigation */}
        <div className="flex gap-1 flex-wrap mb-4 border-b border-gray-100 pb-3">
          {([
            { id: "activity_forms", label: "Activity Planning Forms", icon: FileText },
            { id: "disclosures", label: "Financial Disclosures", icon: Shield },
            { id: "certificates", label: "Certificate Templates", icon: Award },
            { id: "sdms_cme", label: "SDMS CME Data", icon: GraduationCap },
            { id: "notify_signups", label: "Notify Me Signups", icon: Bell },
            { id: "waitlists", label: "Waitlists", icon: Users },
            { id: "google_drive", label: "Google Drive", icon: HardDrive },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[#189aa1] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Activity Planning Forms */}
        {activeTab === "activity_forms" && (
          <Suspense fallback={pageFallback}>
            <CmeFormsListTab />
          </Suspense>
        )}

        {activeTab === "waitlists" && <ContentWaitlistDashboard />}

        {/* Financial Disclosures */}
        {activeTab === "disclosures" && (
          <div className="space-y-4">
            {/* Sub-tab */}
            <div className="flex gap-2">
              <button
                onClick={() => setDisclosureSubTab("course_linked")}
                className={`px-3 py-1 rounded text-xs font-medium ${disclosureSubTab === "course_linked" ? "bg-teal-100 text-teal-700" : "text-gray-500 hover:bg-gray-100"}`}
              >
                Course-Linked Disclosures
              </button>
              <button
                onClick={() => setDisclosureSubTab("generic")}
                className={`px-3 py-1 rounded text-xs font-medium ${disclosureSubTab === "generic" ? "bg-teal-100 text-teal-700" : "text-gray-500 hover:bg-gray-100"}`}
              >
                Generic Submissions
              </button>
              <a
                href="/cme-disclosure/generic"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                onClick={e => { e.preventDefault(); navigator.clipboard.writeText(`${window.location.origin}/cme-disclosure/generic`); }}
              >
                <Link2 className="w-3 h-3" /> Copy Generic Form Link
              </a>
            </div>

            {disclosureSubTab === "course_linked" && (
              <div className="space-y-3">
                {/* Filter row 1: search + status + date range */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Search by faculty, email, or course…"
                    value={courseDiscSearch}
                    onChange={e => setCourseDiscSearch(e.target.value)}
                    className="text-sm max-w-xs"
                  />
                  <Select value={courseDiscStatus} onValueChange={v => setCourseDiscStatus(v as any)}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>From</span>
                    <input type="date" value={courseDiscDateFrom} onChange={e => setCourseDiscDateFrom(e.target.value)}
                      className="h-8 px-2 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" />
                    <span>To</span>
                    <input type="date" value={courseDiscDateTo} onChange={e => setCourseDiscDateTo(e.target.value)}
                      className="h-8 px-2 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" />
                    {(courseDiscDateFrom || courseDiscDateTo) && (
                      <button onClick={() => { setCourseDiscDateFrom(""); setCourseDiscDateTo(""); }} className="text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => refetchCourseDisc()}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {/* Action row: bulk mark received + export buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedDiscIds.size > 0 && (
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                      disabled={bulkMarkReceived.isPending}
                      onClick={() => bulkMarkReceived.mutate({ ids: Array.from(selectedDiscIds) })}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark {selectedDiscIds.size} Received
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs text-teal-700 border-teal-200 hover:bg-teal-50"
                    disabled={courseDiscRows.length === 0}
                    onClick={() => {
                      exportToCsv(`cme-course-disclosures-${new Date().toISOString().slice(0,10)}.csv`,
                        courseDiscRows.map((r: any) => ({
                          Type: "Course-Linked",
                          ID: r.id,
                          "Course ID": r.courseId,
                          Course: r.courseTitle ?? "",
                          Faculty: r.facultyName,
                          Email: r.facultyEmail,
                          Status: r.status,
                          "Sent At": r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "",
                          "Submitted At": r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "",
                          "Received At": r.receivedAt ? new Date(r.receivedAt).toLocaleDateString() : "",
                          "Attestation Name": r.attestationName ?? "",
                          "No Relationships": r.noRelationships ? "Yes" : "No",
                        }))
                      );
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs text-[#189aa1] border-[#189aa1]/30 hover:bg-teal-50"
                    disabled={courseDiscRows.length === 0 && genericRows.length === 0}
                    onClick={() => {
                      const courseRows = courseDiscRows.map((r: any) => ({
                        Type: "Course-Linked",
                        ID: r.id,
                        Course: r.courseTitle ?? "",
                        Faculty: r.facultyName,
                        Email: r.facultyEmail,
                        Status: r.status,
                        "Submitted At": r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "",
                        "Received At": r.receivedAt ? new Date(r.receivedAt).toLocaleDateString() : "",
                        "Attestation Name": r.attestationName ?? "",
                        "No Relationships": r.noRelationships ? "Yes" : "No",
                      }));
                      const genRows = genericRows.map((r: any) => ({
                        Type: "Generic",
                        ID: r.id,
                        Course: r.activityTitle ?? "",
                        Faculty: r.facultyName,
                        Email: r.facultyEmail,
                        Status: "submitted",
                        "Submitted At": r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "",
                        "Received At": "",
                        "Attestation Name": r.attestationName ?? "",
                        "No Relationships": r.noRelationships ? "Yes" : "No",
                      }));
                      exportToCsv(`cme-all-disclosures-${new Date().toISOString().slice(0,10)}.csv`, [...courseRows, ...genRows]);
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> Export All Disclosures
                  </Button>
                </div>
                {courseDiscLoading ? pageFallback : courseDiscRows.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                    No course-linked disclosures found.
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 w-8">
                            <input type="checkbox" className="rounded"
                              checked={courseDiscRows.length > 0 && courseDiscRows.every((r: any) => selectedDiscIds.has(r.id))}
                              onChange={e => {
                                if (e.target.checked) setSelectedDiscIds(new Set(courseDiscRows.map((r: any) => r.id)));
                                else setSelectedDiscIds(new Set());
                              }}
                            />
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Faculty</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Course</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Submitted</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Received</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Relationships</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {courseDiscRows.map((row: any) => (
                          <tr key={row.id} className={`hover:bg-gray-50 ${selectedDiscIds.has(row.id) ? "bg-teal-50/40" : ""}`}>
                            <td className="px-3 py-2">
                              <input type="checkbox" className="rounded"
                                checked={selectedDiscIds.has(row.id)}
                                onChange={e => {
                                  const next = new Set(selectedDiscIds);
                                  if (e.target.checked) next.add(row.id); else next.delete(row.id);
                                  setSelectedDiscIds(next);
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-800">{row.facultyName}</td>
                            <td className="px-3 py-2 text-gray-600">{row.facultyEmail}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate" title={row.courseTitle ?? ""}>{row.courseTitle ?? "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                row.status === "submitted" ? "bg-green-50 text-green-700" :
                                row.status === "received" ? "bg-teal-50 text-teal-700" :
                                row.status === "sent" ? "bg-blue-50 text-blue-700" :
                                "bg-gray-100 text-gray-500"
                              }`}>{row.status}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "—"}</td>
                            <td className="px-3 py-2 text-gray-500">{row.receivedAt ? new Date(row.receivedAt).toLocaleDateString() : "—"}</td>
                            <td className="px-3 py-2">
                              {row.noRelationships ? (
                                <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium text-[10px]">None</span>
                              ) : row.status === "submitted" || row.status === "received" ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium text-[10px]">Disclosed</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {disclosureSubTab === "generic" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Search by name, email, or activity…"
                    value={genericSearch}
                    onChange={e => setGenericSearch(e.target.value)}
                    className="text-sm max-w-xs"
                  />
                  <Select value={genericRelFilter} onValueChange={v => setGenericRelFilter(v as any)}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="none">No Relationships</SelectItem>
                      <SelectItem value="disclosed">Disclosed</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>From</span>
                    <input type="date" value={genericDateFrom} onChange={e => setGenericDateFrom(e.target.value)}
                      className="h-8 px-2 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" />
                    <span>To</span>
                    <input type="date" value={genericDateTo} onChange={e => setGenericDateTo(e.target.value)}
                      className="h-8 px-2 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" />
                    {(genericDateFrom || genericDateTo) && (
                      <button onClick={() => { setGenericDateFrom(""); setGenericDateTo(""); }} className="text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => refetchGeneric()}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto gap-1.5 text-xs text-teal-700 border-teal-200 hover:bg-teal-50"
                    disabled={genericRows.length === 0}
                    onClick={() => {
                      exportToCsv(`cme-generic-disclosures-${new Date().toISOString().slice(0,10)}.csv`,
                        genericRows.map((r: any) => ({
                          ID: r.id,
                          Faculty: r.facultyName,
                          Email: r.facultyEmail,
                          Activity: r.activityTitle ?? "",
                          Roles: r.roles ?? "",
                          "No Relationships": r.hasNoRelationships ? "Yes" : "No",
                          "Attestation Name": r.attestationName ?? "",
                          "Submitted At": r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "",
                          "Linked Course ID": r.linkedCourseId ?? "",
                        }))
                      );
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </Button>
                </div>
                {genericLoading ? pageFallback : genericRows.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                    No generic disclosure submissions yet.
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Faculty</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Activity</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Submitted</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Relationships</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {genericRows.map((row: any) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-800">{row.facultyName}</td>
                            <td className="px-3 py-2 text-gray-600">{row.facultyEmail}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate">{row.activityTitle}</td>
                            <td className="px-3 py-2 text-gray-500">{row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "—"}</td>
                            <td className="px-3 py-2">
                              {row.hasNoRelationships ? (
                                <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">None</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Disclosed</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Button size="sm" variant="ghost" className="h-6 text-xs text-teal-600" onClick={() => setViewDisclosure(row)}>
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Certificate Templates */}
        {activeTab === "certificates" && (
          <Suspense fallback={pageFallback}>
            <CertificateTemplatesAdmin />
          </Suspense>
        )}

        {/* SDMS CME Data */}
        {activeTab === "notify_signups" && (
          <NotifyMeSignupsTab search={notifySearch} setSearch={setNotifySearch} typeFilter={notifyTypeFilter} setTypeFilter={setNotifyTypeFilter} />
        )}

        {activeTab === "sdms_cme" && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Configure SDMS CME credits for individual courses and webinars. SDMS CME settings are managed per-product in LMS Admin.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 space-y-2">
              <p className="font-medium text-gray-700">Quick Links</p>
              <a href="/admin/lms" className="flex items-center gap-1.5 text-teal-600 hover:underline">
                <GraduationCap className="w-3.5 h-3.5" /> LMS Admin → Course → CME Settings
              </a>
              <a href="/admin/lms?tab=cme_forms" className="flex items-center gap-1.5 text-teal-600 hover:underline">
                <FileText className="w-3.5 h-3.5" /> CME Activity Planning Forms
              </a>
            </div>
          </div>
        )}
        {activeTab === "google_drive" && (
          <CmeDriveSettingsPanel />
        )}
      </CardContent>

      {/* Generic Disclosure View Dialog */}
      {viewDisclosure && (
        <Dialog open={!!viewDisclosure} onOpenChange={() => setViewDisclosure(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">Generic Disclosure — {viewDisclosure.facultyName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 text-xs">
                <div><span className="font-medium text-gray-600">Faculty:</span> {viewDisclosure.facultyName}</div>
                <div><span className="font-medium text-gray-600">Email:</span> {viewDisclosure.facultyEmail}</div>
                <div><span className="font-medium text-gray-600">Activity:</span> {viewDisclosure.activityTitle}</div>
                <div><span className="font-medium text-gray-600">Submitted:</span> {viewDisclosure.submittedAt ? new Date(viewDisclosure.submittedAt).toLocaleString() : "—"}</div>
                <div><span className="font-medium text-gray-600">Attestation:</span> {viewDisclosure.attestationName}</div>
              </div>
              {viewDisclosure.roles && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Roles</p>
                  <p className="text-xs text-gray-700">{viewDisclosure.roles}</p>
                </div>
              )}
              {viewDisclosure.hasNoRelationships ? (
                <div className="bg-green-50 rounded-lg p-3 text-xs text-green-700">
                  No financial relationships disclosed in the past 24 months.
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Financial Relationships</p>
                  {(() => {
                    try {
                      const rels = JSON.parse(viewDisclosure.relationships ?? "[]");
                      return rels.filter((r: any) => r.company?.trim()).map((r: any, i: number) => (
                        <div key={i} className="bg-gray-50 rounded p-2 text-xs mb-1">
                          <span className="font-medium">{r.company}</span> — {r.nature}
                          {r.ended && <span className="ml-2 text-amber-600">(Ended)</span>}
                        </div>
                      ));
                    } catch { return <p className="text-xs text-gray-500">Unable to parse relationships.</p>; }
                  })()}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setViewDisclosure(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

// ─── Notify Me Signups Tab ────────────────────────────────────────────────────
// ─── CME Google Drive Settings Panel ─────────────────────────────────────────
function CmeDriveSettingsPanel() {
  const { data: settings, refetch } = trpc.lmsGroup.getCmeDriveSettings.useQuery();
  const updateSettings = trpc.lmsGroup.updatePlatformSettings.useMutation({
    onSuccess: () => { toast.success("Google Drive settings saved"); refetch(); },
    onError: (e) => toast.error("Save failed: " + e.message),
  });
  const { data: driveFiles, isLoading: filesLoading, refetch: refetchFiles } = trpc.lmsGroup.listCmeDriveFiles.useQuery(
    undefined,
    { enabled: !!(settings as any)?.cmeDriveEnabled }
  );
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [folderId, setFolderId] = useState("");
  const [folderName, setFolderName] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (settings) {
      setClientId((settings as any).cmeDriveClientId ?? "");
      setFolderId((settings as any).cmeDriveFolderId ?? "");
      setFolderName((settings as any).cmeDriveFolderName ?? "");
      setEnabled(!!(settings as any).cmeDriveEnabled);
    }
  }, [settings]);

  const isConnected = !!(settings as any)?.cmeDriveConnectedEmail;
  const connectedEmail = (settings as any)?.cmeDriveConnectedEmail;

  const handleConnect = () => {
    window.location.href = `/api/cme-drive/auth?origin=${encodeURIComponent(window.location.origin)}`;
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800 space-y-1">
        <p className="font-semibold flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Google Drive CME Integration</p>
        <p>When enabled, every CME Activity Planning PDF downloaded from this hub is also automatically saved to a shared Google Drive folder. This makes it easy to share PDFs with CardioServ without manual uploads.</p>
        <p className="text-blue-600">Requires a Google Cloud project with Drive API enabled and OAuth 2.0 credentials (Client ID + Secret).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Google OAuth Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="123456789-abc.apps.googleusercontent.com"
            className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Google OAuth Client Secret</label>
          <input
            type="password"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            placeholder="GOCSPX-..."
            className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">Leave blank to keep the existing secret.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Drive Folder ID (optional)</label>
          <input
            type="text"
            value={folderId}
            onChange={e => setFolderId(e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">The ID from the folder URL. Leave blank to save to My Drive root.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Folder Display Name (optional)</label>
          <input
            type="text"
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            placeholder="CME Activity Forms"
            className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => updateSettings.mutate({
            cmeDriveClientId: clientId || null,
            ...(clientSecret ? { cmeDriveClientSecret: clientSecret } : {}),
            cmeDriveFolderId: folderId || null,
            cmeDriveFolderName: folderName || null,
            cmeDriveEnabled: enabled,
          })}
          disabled={updateSettings.isPending}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
        >
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </button>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="cme-drive-enabled" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
          <label htmlFor="cme-drive-enabled" className="text-xs text-gray-600">Enable automatic Drive upload on PDF download</label>
        </div>
      </div>

      {/* OAuth Connect */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-teal-600" /> Google Account Connection
        </p>
        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected as {connectedEmail}
            </span>
            <button onClick={handleConnect} className="text-xs text-teal-600 hover:underline">Reconnect</button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Save your Client ID and Secret first, then connect your Google account to authorize Drive access.</p>
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Connect Google Account
            </button>
          </div>
        )}
      </div>

      {/* Saved PDFs list */}
      {isConnected && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">PDFs Saved to Drive</p>
            <button onClick={() => refetchFiles()} className="text-xs text-teal-600 hover:underline">Refresh</button>
          </div>
          {filesLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400"><div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />Loading…</div>
          ) : !driveFiles || (driveFiles as any[]).length === 0 ? (
            <p className="text-xs text-gray-400">No PDFs saved yet. Download a CME Activity Planning PDF to trigger the first upload.</p>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {(driveFiles as any[]).map((f: any) => (
                <div key={f.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                  <span className="text-[10px] text-gray-400 mx-3 shrink-0">{f.createdTime ? new Date(f.createdTime).toLocaleDateString() : ""}</span>
                  <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline shrink-0">View</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotifyMeSignupsTab({ search, setSearch, typeFilter, setTypeFilter }: {
  search: string; setSearch: (v: string) => void;
  typeFilter: string; setTypeFilter: (v: string) => void;
}) {
  const { data, isLoading, refetch } = trpc.lmsAdmin.listDraftNotifyEntries.useQuery(
    { search: search || undefined, productType: typeFilter || undefined },
    { staleTime: 30_000 }
  );
  const rows: any[] = (data as any)?.rows ?? [];

  // Selection state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggleRow = (id: number) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => setSelected(prev => prev.size === rows.length ? new Set() : new Set(rows.map((r: any) => r.id)));

  // Send Enrollment Open dialog
  const [sendOpen, setSendOpen] = useState(false);
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendUrl, setSendUrl] = useState("");
  const sendMutation = trpc.lmsAdmin.sendEnrollmentOpenEmails.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent to ${res.sent} recipient${res.sent !== 1 ? "s" : ""}${res.failed > 0 ? ` (${res.failed} failed)` : ""}`);
      setSendOpen(false);
      setSelected(new Set());
    },
    onError: (e) => toast.error(e.message),
  });

  const openSendDialog = () => {
    if (!selected.size) { toast.error("Select at least one recipient first"); return; }
    const firstRow = rows.find((r: any) => selected.has(r.id));
    const productTitle = firstRow?.productTitle ?? "the course";
    setSendSubject(`Enrollment is now open — ${productTitle}`);
    setSendBody(`Hi there,\n\nGreat news! Enrollment for ${productTitle} is now open. We wanted to let you know since you signed up to be notified.\n\nClick the button below to enroll and secure your spot.\n\nThank you,\nAll About Ultrasound Team`);
    setSendUrl(firstRow?.productType === "course" && firstRow?.productId ? `https://learn.allaboutultrasound.com/courses/${firstRow.productId}` : "");
    setSendOpen(true);
  };

  const handleExportCsv = () => {
    if (!rows.length) return;
    const headers = ["ID", "Product Type", "Product Title", "Name", "Email", "Signed Up At"];
    const csvRows = rows.map((r: any) => [
      r.id, r.productType, r.productTitle ?? "", r.name, r.email,
      r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
    ]);
    const csv = [headers, ...csvRows].map(row => row.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "notify_me_signups.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text" placeholder="Search name, email, or product..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <select
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="course">Course</option>
          <option value="download">Download</option>
          <option value="workshop">Workshop</option>
          <option value="webinar">Webinar</option>
        </select>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button onClick={handleExportCsv} disabled={!rows.length} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 text-xs font-medium hover:bg-teal-50 disabled:opacity-50">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
        {selected.size > 0 && (
          <button onClick={openSendDialog} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700">
            <SendHorizonal className="w-3.5 h-3.5" /> Send Enrollment Open ({selected.size})
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">{rows.length} signup{rows.length !== 1 ? "s" : ""} found</p>
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-5 w-5 border-4 border-teal-500 border-t-transparent rounded-full" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-xs">No signups found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left w-8">
                  <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} className="w-3.5 h-3.5 accent-teal-600" />
                </th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Signed Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} className="w-3.5 h-3.5 accent-teal-600" />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                  <td className="px-3 py-2 text-gray-600">{r.email}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate">{r.productTitle ?? `ID: ${r.productId}`}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 capitalize">{r.productType}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Send Enrollment Open Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-teal-700">
              <SendHorizonal className="w-4 h-4" /> Send Enrollment Open Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-xs text-gray-500">Sending to <strong>{selected.size}</strong> recipient{selected.size !== 1 ? "s" : ""}. Review and edit before sending.</p>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Subject</label>
              <input value={sendSubject} onChange={e => setSendSubject(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Product URL (optional — adds Enroll Now button)</label>
              <input value={sendUrl} onChange={e => setSendUrl(e.target.value)} placeholder="https://learn.allaboutultrasound.com/courses/..." className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Message body</label>
              <Textarea value={sendBody} onChange={e => setSendBody(e.target.value)} rows={7} className="text-xs resize-none" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setSendOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => sendMutation.mutate({ entryIds: Array.from(selected), subject: sendSubject, body: sendBody, productUrl: sendUrl || undefined })}
              disabled={sendMutation.isPending || !sendSubject.trim() || !sendBody.trim()}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {sendMutation.isPending ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</> : <><SendHorizonal className="w-3.5 h-3.5" /> Send {selected.size} Email{selected.size !== 1 ? "s" : ""}</>}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
