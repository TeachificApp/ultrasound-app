/**
 * RevenueShareAdmin.tsx
 * Standalone admin page for managing Stripe Connect revenue sharing.
 * Covers all product types: courses, bundles, downloads, workshops, memberships.
 * Separate from the Instructors area.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Plus, ExternalLink, RefreshCw, DollarSign, Link2,
  CheckCircle, Clock, AlertCircle, Percent, BookOpen, Package,
  Download, Layers, CreditCard, Wrench, ChevronLeft,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
}
function calculateShareAmount(grossAmountCents: number, sharePercentage: number) {
  return Math.floor((grossAmountCents * sharePercentage) / 100);
}
function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}
const PROCESS_METHOD_LABELS: Record<string, string> = {
  payment_time: "Auto (checkout split)",
  stripe_transfer: "Auto (Stripe transfer)",
  manual: "Manual (admin)",
};
function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending Setup", variant: "secondary" },
    onboarding: { label: "Onboarding", variant: "outline" },
    active: { label: "Active", variant: "default" },
    restricted: { label: "Restricted", variant: "destructive" },
  };
  const s = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
const PRODUCT_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  lms_course: { label: "Course", icon: <BookOpen className="h-3.5 w-3.5" /> },
  course: { label: "Course", icon: <BookOpen className="h-3.5 w-3.5" /> },
  bundle: { label: "Bundle", icon: <Layers className="h-3.5 w-3.5" /> },
  download: { label: "Digital Download", icon: <Download className="h-3.5 w-3.5" /> },
  download_bundle: { label: "Download Bundle", icon: <Package className="h-3.5 w-3.5" /> },
  membership: { label: "Membership", icon: <CreditCard className="h-3.5 w-3.5" /> },
  workshop: { label: "Workshop", icon: <Wrench className="h-3.5 w-3.5" /> },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RevenueShareAdmin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("partners");

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/lms")} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" /> Admin
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#189aa1]" />
              Revenue Share
            </h1>
            <p className="text-xs text-muted-foreground">Stripe Connect — automatic partner payouts across all product types</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="partners" className="gap-1.5"><Users className="h-4 w-4" />Partners</TabsTrigger>
            <TabsTrigger value="assignments" className="gap-1.5"><Percent className="h-4 w-4" />Assignments</TabsTrigger>
            <TabsTrigger value="ledger" className="gap-1.5"><DollarSign className="h-4 w-4" />Payout Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="partners"><PartnersTab /></TabsContent>
          <TabsContent value="assignments"><AssignmentsTab /></TabsContent>
          <TabsContent value="ledger"><LedgerTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Partners Tab ─────────────────────────────────────────────────────────────
function PartnersTab() {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteTab, setInviteTab] = useState<"existing" | "new">("existing");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "instructor" | "affiliate" | "user" | "premium_user">("all");
  const [selectedUser, setSelectedUser] = useState<{ id: number; name: string | null; email: string | null; roles: string[] } | null>(null);
  const [newForm, setNewForm] = useState({ name: "", email: "", payoutSchedule: "weekly" });
  const [payoutSchedule, setPayoutSchedule] = useState("weekly");
  const [pendingPartnerData, setPendingPartnerData] = useState<{ name: string; email: string } | null>(null);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const utils = trpc.useUtils();

  const { data: partners = [], isLoading } = trpc.revenueShare.listPartners.useQuery();
  const { data: searchResults = [], isFetching: searching } = trpc.revenueShare.searchExistingUsers.useQuery(
    { query: searchQuery, roleFilter },
    { enabled: searchQuery.length >= 2 },
  );

  const inviteMutation = trpc.revenueShare.createPartner.useMutation({
    onSuccess: (data) => {
      toast.success("Partner added successfully.");
      utils.revenueShare.listPartners.invalidate();
      setShowInvite(false);
      setSelectedUser(null);
      setSearchQuery("");
      setNewForm({ name: "", email: "", payoutSchedule: "weekly" });
      // Show email confirmation dialog instead of auto-sending
      if (data?.id && pendingPartnerData) {
        setShowEmailConfirm(true);
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const sendEmailMutation = trpc.revenueShare.sendOnboardingEmail.useMutation({
    onSuccess: () => toast.success("Stripe onboarding email sent to partner"),
    onError: (e) => toast.error("Partner added but email failed: " + e.message),
  });
  const onboardingMutation = trpc.revenueShare.getOnboardingLink.useMutation({
    onSuccess: (data) => {
      // Open the public token-based URL (no site login required for partner)
      const linkToOpen = (data as any)?.publicUrl || data?.url;
      if (linkToOpen) {
        window.open(linkToOpen, "_blank");
        // Also copy to clipboard for easy sharing
        navigator.clipboard?.writeText(linkToOpen).then(() => {
          toast.success("Onboarding link opened and copied to clipboard");
        }).catch(() => {
          toast.success("Onboarding link opened in new tab");
        });
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const refreshStatusesMutation = trpc.revenueShare.refreshAllPartnerStatuses.useMutation({
    onSuccess: (data) => {
      toast.success(`Refreshed ${data.refreshed} Stripe status${data.refreshed === 1 ? "" : "es"}; ${data.active} active`);
      utils.revenueShare.listPartners.invalidate();
    },
    onError: (e) => toast.error(`Could not refresh Stripe statuses: ${e.message}`),
  });
  const dashboardMutation = trpc.revenueShare.getPartnerExpressDashboardLink.useMutation({
    onSuccess: (data) => {
      if (data?.url) window.open(data.url, "_blank");
    },
    onError: (e) => toast.error(e.message),
  });
  function roleBadgeColor(role: string) {
    const map: Record<string, string> = {
      instructor: "bg-blue-100 text-blue-700",
      affiliate: "bg-purple-100 text-purple-700",
      premium_user: "bg-amber-100 text-amber-700",
      admin: "bg-red-100 text-red-700",
      user: "bg-gray-100 text-gray-600",
    };
    return map[role] ?? "bg-gray-100 text-gray-600";
  }

  function handleAddPartner() {
    if (inviteTab === "existing" && selectedUser) {
      setPendingPartnerData({ name: selectedUser.name ?? "", email: selectedUser.email ?? "" });
      inviteMutation.mutate({
        name: selectedUser.name ?? "",
        email: selectedUser.email ?? "",
        payoutSchedule,
      });
    } else if (inviteTab === "new") {
      setPendingPartnerData({ name: newForm.name, email: newForm.email });
      inviteMutation.mutate(newForm);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Revenue Share Partners</h2>
          <p className="text-sm text-muted-foreground">Invite instructors, affiliates, or any revenue share partner. They complete Stripe KYC onboarding and receive automatic payouts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refreshStatusesMutation.mutate()}
            disabled={refreshStatusesMutation.isPending}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${refreshStatusesMutation.isPending ? "animate-spin" : ""}`} />
            Refresh Stripe Statuses
          </Button>
          <Button onClick={() => setShowInvite(true)} className="gap-1.5 bg-[#189aa1] hover:bg-[#147a80]">
            <Plus className="h-4 w-4" /> Invite Partner
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading partners…</div>
      ) : partners.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No partners yet</p>
            <p className="text-sm text-muted-foreground mt-1">Invite a partner to get started with revenue sharing.</p>
            <Button onClick={() => setShowInvite(true)} className="mt-4 bg-[#189aa1] hover:bg-[#147a80]">
              <Plus className="h-4 w-4 mr-1.5" /> Invite First Partner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Revenue-share courses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payout Schedule</TableHead>
                <TableHead>Stripe Account</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </TableCell>
                  <TableCell className="max-w-sm">
                    {p.assignedCourses?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {p.assignedCourses.map((assignment: any) => (
                          <Badge
                            key={assignment.id}
                            variant={assignment.active ? "outline" : "secondary"}
                            className="max-w-full whitespace-normal text-left leading-snug"
                            title={`${assignment.courseTitle ?? assignment.label ?? "All eligible courses"} — ${assignment.percentage}% ${assignment.active ? "active" : "inactive"}`}
                          >
                            <BookOpen className="mr-1 h-3 w-3 shrink-0" />
                            {assignment.courseTitle ?? assignment.label ?? "All eligible courses"}
                            <span className="ml-1 text-muted-foreground">({assignment.percentage}%)</span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No course assignments</span>
                    )}
                  </TableCell>
                  <TableCell>{statusBadge(p.onboardingStatus)}</TableCell>
                  <TableCell className="capitalize">{p.payoutSchedule}</TableCell>
                  <TableCell>
                    {p.stripeAccountId ? (
                      <span className="text-xs font-mono text-muted-foreground">{p.stripeAccountId}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not connected</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(p.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {p.onboardingStatus !== "active" && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => onboardingMutation.mutate({ partnerId: p.id, origin: window.location.origin })}
                          disabled={onboardingMutation.isPending}
                          className="gap-1 text-xs"
                        >
                          <Link2 className="h-3.5 w-3.5" /> Onboarding Link
                        </Button>
                      )}
                      {p.onboardingStatus === "active" && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => dashboardMutation.mutate({ partnerId: p.id })}
                          disabled={dashboardMutation.isPending}
                          className="gap-1 text-xs"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Stripe Dashboard
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Partner Dialog */}
      <Dialog open={showInvite} onOpenChange={(open) => { setShowInvite(open); if (!open) { setSelectedUser(null); setSearchQuery(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Revenue Share Partner</DialogTitle>
          </DialogHeader>

          {/* Tab switcher */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                inviteTab === "existing" ? "bg-[#189aa1] text-white" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setInviteTab("existing")}
            >
              Select Existing User
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                inviteTab === "new" ? "bg-[#189aa1] text-white" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setInviteTab("new")}
            >
              Add New External Partner
            </button>
          </div>

          {inviteTab === "existing" ? (
            <div className="space-y-3">
              {/* Search + role filter */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name or email…"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSelectedUser(null); }}
                  className="flex-1"
                />
                <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="instructor">Instructors</SelectItem>
                    <SelectItem value="affiliate">Affiliates</SelectItem>
                    <SelectItem value="premium_user">Premium Members</SelectItem>
                    <SelectItem value="user">Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search results */}
              {searchQuery.length >= 2 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">Searching…</div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">No users found</div>
                  ) : (
                    searchResults.map((u: any) => (
                      <button
                        key={u.id}
                        className={`w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b last:border-b-0 ${
                          selectedUser?.id === u.id ? "bg-[#189aa1]/10 border-l-2 border-l-[#189aa1]" : ""
                        }`}
                        onClick={() => setSelectedUser(u)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{u.name || "(no name)"}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(u.roles as string[]).map((r: string) => (
                              <span key={r} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleBadgeColor(r)}`}>
                                {r.replace("_", " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected user summary */}
              {selectedUser && (
                <div className="bg-[#189aa1]/10 border border-[#189aa1]/30 rounded-lg px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{selectedUser.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedUser.email}</div>
                  </div>
                  <Badge className="bg-[#189aa1] text-white">Selected</Badge>
                </div>
              )}

              {/* Payout schedule */}
              <div className="space-y-1.5">
                <Label>Payout Schedule</Label>
                <Select value={payoutSchedule} onValueChange={setPayoutSchedule}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate (on every payment)</SelectItem>
                    <SelectItem value="daily">Daily batch</SelectItem>
                    <SelectItem value="weekly">Weekly batch</SelectItem>
                    <SelectItem value="monthly">Monthly batch</SelectItem>
                    <SelectItem value="manual">Manual (admin triggers)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input
                  value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={newForm.email}
                  onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payout Schedule</Label>
                <Select value={newForm.payoutSchedule} onValueChange={v => setNewForm(f => ({ ...f, payoutSchedule: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate (on every payment)</SelectItem>
                    <SelectItem value="daily">Daily batch</SelectItem>
                    <SelectItem value="weekly">Weekly batch</SelectItem>
                    <SelectItem value="monthly">Monthly batch</SelectItem>
                    <SelectItem value="manual">Manual (admin triggers)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground bg-muted rounded p-2">
            Once added, the partner will receive an email with their Stripe onboarding link to complete KYC and connect their payout account.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button
              onClick={handleAddPartner}
              disabled={
                inviteMutation.isPending ||
                (inviteTab === "existing" ? !selectedUser : !newForm.name || !newForm.email)
              }
              className="bg-[#189aa1] hover:bg-[#147a80]"
            >
              {inviteMutation.isPending ? "Adding…" : "Add Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Onboarding Email Confirmation Dialog */}
      <Dialog open={showEmailConfirm} onOpenChange={(open) => { if (!open) { setShowEmailConfirm(false); setPendingPartnerData(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send Onboarding Email?</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Partner <strong>{pendingPartnerData?.name}</strong> has been added. Would you like to send them a Stripe onboarding email now?
            </p>
            <p className="text-xs text-gray-500">The email will contain a link for them to set up their Stripe account for payouts. You can also send this later from the partner's row.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowEmailConfirm(false); setPendingPartnerData(null); }}>Not Now</Button>
            <Button
              size="sm"
              className="bg-[#189aa1] hover:bg-[#147a80] text-white"
              disabled={sendEmailMutation.isPending}
              onClick={() => {
                const partnerList = utils.revenueShare.listPartners.getData() as any[] | undefined;
                const partner = partnerList?.find((p: any) => p.email === pendingPartnerData?.email);
                if (partner?.id) sendEmailMutation.mutate({ partnerId: partner.id });
                setShowEmailConfirm(false);
                setPendingPartnerData(null);
              }}
            >
              {sendEmailMutation.isPending ? "Sending…" : "Send Onboarding Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Assignments Tab ──────────────────────────────────────────────────────────
function AssignmentsTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ partnerId: "", productId: "", productType: "course", percentage: "" });
  const utils = trpc.useUtils();

  const { data: partners = [] } = trpc.revenueShare.listPartners.useQuery();
  const { data: products = [], isLoading: productsLoading } = trpc.revenueShare.listProductsForAssignment.useQuery();
  const { data: assignments = [], isLoading } = trpc.revenueShare.listAssignments.useQuery({});

  const createMutation = trpc.revenueShare.createAssignment.useMutation({
    onSuccess: () => {
      toast.success("Revenue share assignment created");
      utils.revenueShare.listAssignments.invalidate();
      utils.revenueShare.listPartners.invalidate();
      setShowAdd(false);
      setForm({ partnerId: "", productId: "", productType: "course", percentage: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredProducts = products.filter((p: any) => p.productType === form.productType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Revenue Share Assignments</h2>
          <p className="text-sm text-muted-foreground">Assign partners and percentages to specific products. Multiple partners can share a single product.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5 bg-[#189aa1] hover:bg-[#147a80]">
          <Plus className="h-4 w-4" /> Add Assignment
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading assignments…</div>
      ) : assignments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Percent className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No assignments yet</p>
            <p className="text-sm text-muted-foreground mt-1">Assign a partner to a product to start sharing revenue.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Share %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a: any) => {
                const typeInfo = PRODUCT_TYPE_LABELS[a.productType] ?? { label: a.productType, icon: null };
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.partnerName}</div>
                      <div className="text-xs text-muted-foreground">{a.partnerEmail}</div>
                    </TableCell>
                    <TableCell className="font-medium">{a.productTitle ?? a.courseTitle ?? a.label ?? (a.courseId ? `Course #${a.courseId}` : "All eligible courses")}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        {typeInfo.icon} {typeInfo.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{a.percentage}%</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.active ? "default" : "secondary"}>{a.active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(a.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Assignment Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Revenue Share Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Partner</Label>
              <Select value={form.partnerId} onValueChange={v => setForm(f => ({ ...f, partnerId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select partner…" /></SelectTrigger>
                <SelectContent>
                  {(partners as any[]).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Product Type</Label>
              <Select value={form.productType} onValueChange={v => setForm(f => ({ ...f, productType: v, productId: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={form.productId} onValueChange={v => setForm(f => ({ ...f, productId: v }))}>
                <SelectTrigger><SelectValue placeholder={productsLoading ? "Loading…" : "Select product…"} /></SelectTrigger>
                <SelectContent>
                  {filteredProducts.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Revenue Share Percentage</Label>
              <div className="relative">
                <Input
                  type="number" min="1" max="99" step="0.5"
                  value={form.percentage}
                  onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))}
                  placeholder="e.g. 30"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              <p className="text-xs text-muted-foreground">This percentage of each payment will be transferred to the partner's Stripe account.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                partnerId: Number(form.partnerId),
                courseId: Number(form.productId),
                productType: form.productType,
                percentage: Number(form.percentage),
              })}
              disabled={createMutation.isPending || !form.partnerId || !form.productId || !form.percentage}
              className="bg-[#189aa1] hover:bg-[#147a80]"
            >
              {createMutation.isPending ? "Saving…" : "Add Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────────
function LedgerTab() {
  const [filterPartnerId, setFilterPartnerId] = useState<string>("all");
  const [manualEntry, setManualEntry] = useState<any | null>(null);
  const [manualPct, setManualPct] = useState("");
  const [paymentConfirm, setPaymentConfirm] = useState<{ entry: any; sharePercentage: number } | null>(null);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: partners = [] } = trpc.revenueShare.listPartners.useQuery();
  const { data: ledgerData, isLoading } = trpc.revenueShare.getLedger.useQuery({
    partnerId: filterPartnerId !== "all" ? Number(filterPartnerId) : undefined,
  });
  const ledger: any[] = Array.isArray(ledgerData) ? ledgerData : (ledgerData as any)?.entries ?? [];

  const pctNum = parseFloat(manualPct);
  const { data: preview } = trpc.revenueShare.previewManualPayout.useQuery(
    { ledgerId: manualEntry?.id ?? 0, sharePercentage: pctNum },
    { enabled: !!manualEntry && Number.isFinite(pctNum) && pctNum > 0 && pctNum < 100 },
  );

  const processOneMutation = trpc.revenueShare.processManualLedgerPayout.useMutation({
    onSuccess: (data) => {
      toast.success(`Paid ${fmtMoney(data.shareAmount ?? 0)} to partner`);
      utils.revenueShare.getLedger.invalidate();
      setManualEntry(null);
      setPaymentConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const manualPayoutMutation = trpc.revenueShare.processManualPayout.useMutation({
    onSuccess: (data: any) => {
      const msg = [`Processed ${data?.processed ?? 0} transfer(s)`];
      if (data?.skipped) msg.push(`${data.skipped} skipped (auto-processed)`);
      if (data?.errors?.length) msg.push(`${data.errors.length} failed`);
      toast.success(msg.join(", "));
      utils.revenueShare.getLedger.invalidate();
      setBatchConfirmOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const reconcileSalesMutation = trpc.revenueShare.reconcilePaidCourseSales.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.created > 0
          ? `Added ${data.created} missing paid sale${data.created === 1 ? "" : "s"} as pending payout records`
          : "No missing paid course-sale payout records found",
      );
      utils.revenueShare.getLedger.invalidate();
      utils.revenueShare.getSummaryStats.invalidate();
    },
    onError: (e) => toast.error(`Could not reconcile paid sales: ${e.message}`),
  });

  function openManualDialog(entry: any) {
    setManualEntry(entry);
    setManualPct(String(parseFloat(String(entry.sharePercentage)) || ""));
  }

  function canProcessEntry(entry: any) {
    if (entry.processMethod === "payment_time") return false;
    if (entry.status === "paid") return false;
    if (entry.status === "processing" || entry.status === "cancelled") return false;
    return entry.status === "pending" || entry.status === "failed";
  }

  const totalPaid = ledger.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + (r.shareAmount ?? 0), 0);
  const totalPending = ledger.filter((r: any) => r.status === "pending" || r.status === "failed").reduce((s: number, r: any) => s + (r.shareAmount ?? 0), 0);
  const eligibleBatchEntries = ledger.filter((r: any) => r.status === "pending" && canProcessEntry(r));
  const eligibleBatchAmount = eligibleBatchEntries.reduce((sum: number, r: any) => sum + (r.shareAmount ?? 0), 0);
  const selectedPartner = filterPartnerId === "all"
    ? null
    : (partners as any[]).find((partner: any) => partner.id === Number(filterPartnerId));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Payout Ledger</h2>
          <p className="text-sm text-muted-foreground">
            Track auto-processed payouts and manually process pending shares. Auto-processed entries cannot be reprocessed.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Select value={filterPartnerId} onValueChange={setFilterPartnerId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All partners" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Partners</SelectItem>
              {(partners as any[]).map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => reconcileSalesMutation.mutate()}
            disabled={reconcileSalesMutation.isPending}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${reconcileSalesMutation.isPending ? "animate-spin" : ""}`} />
            Reconcile Paid Course Sales
          </Button>
          <Button
            variant="outline"
            onClick={() => setBatchConfirmOpen(true)}
            disabled={manualPayoutMutation.isPending || eligibleBatchEntries.length === 0}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${manualPayoutMutation.isPending ? "animate-spin" : ""}`} />
            Process All Pending
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Total Paid Out</div>
            <div className="text-2xl font-bold text-green-600">{fmtMoney(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Clock className="h-3.5 w-3.5 text-amber-500" /> Pending Payouts</div>
            <div className="text-2xl font-bold text-amber-600">{fmtMoney(totalPending)}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading ledger…</div>
      ) : ledger.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No transactions yet</p>
            <p className="text-sm text-muted-foreground mt-1">Payout records appear automatically for new checkout sales. Use “Reconcile Paid Course Sales” to add eligible historical paid sales as pending records only.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>Processing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((r: any) => {
                const isAuto = r.processMethod === "payment_time" || r.processMethod === "stripe_transfer";
                const autoAt = r.autoProcessedAt ?? (isAuto ? r.paidAt : null);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.partnerName}</div>
                      <div className="text-xs text-muted-foreground">{r.partnerEmail}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.courseTitle ?? (r.courseId ? `Course #${r.courseId}` : "—")}</TableCell>
                    <TableCell className="font-mono text-sm">{fmtMoney(r.grossAmount)}</TableCell>
                    <TableCell>
                      <div className="font-mono text-sm font-semibold text-[#189aa1]">{fmtMoney(r.shareAmount)}</div>
                      <div className="text-xs text-muted-foreground">{r.sharePercentage}%</div>
                    </TableCell>
                    <TableCell>
                      {r.processMethod ? (
                        <div className="space-y-0.5">
                          <Badge variant={isAuto ? "default" : "outline"} className="text-xs">
                            {PROCESS_METHOD_LABELS[r.processMethod] ?? r.processMethod}
                          </Badge>
                          {isAuto && autoAt && (
                            <div className="text-xs text-muted-foreground">Auto: {fmtDateTime(autoAt)}</div>
                          )}
                          {r.processMethod === "manual" && r.paidAt && (
                            <div className="text-xs text-muted-foreground">Manual: {fmtDateTime(r.paidAt)}</div>
                          )}
                        </div>
                      ) : r.status === "paid" ? (
                        <span className="text-xs text-muted-foreground">Legacy auto</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        r.status === "paid" ? "default" :
                        r.status === "failed" ? "destructive" : "secondary"
                      }>
                        {r.status === "paid" ? <CheckCircle className="h-3 w-3 mr-1" /> :
                         r.status === "failed" ? <AlertCircle className="h-3 w-3 mr-1" /> :
                         <Clock className="h-3 w-3 mr-1" />}
                        {r.status}
                      </Badge>
                      {r.errorMessage && (
                        <div className="text-xs text-destructive mt-1 max-w-[180px] truncate" title={r.errorMessage}>
                          {r.errorMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(r.paidAt ?? r.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {canProcessEntry(r) ? (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => openManualDialog(r)}
                          className="text-xs gap-1"
                        >
                          <DollarSign className="h-3.5 w-3.5" /> Process
                        </Button>
                      ) : isAuto && r.status === "paid" ? (
                        <span className="text-xs text-muted-foreground">Auto-processed</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!manualEntry} onOpenChange={(open) => { if (!open) setManualEntry(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Partner Payout</DialogTitle>
          </DialogHeader>
          {manualEntry && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">Partner:</span> {manualEntry.partnerName}</div>
                <div><span className="text-muted-foreground">Product:</span> {manualEntry.courseTitle ?? "—"}</div>
                <div><span className="text-muted-foreground">Gross sale:</span> {fmtMoney(manualEntry.grossAmount)}</div>
              </div>
              <div className="space-y-1.5">
                <Label>Revenue share percentage</Label>
                <div className="relative">
                  <Input
                    type="number" min="0.01" max="99.99" step="0.5"
                    value={manualPct}
                    onChange={e => setManualPct(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Adjust the percentage before sending the Stripe transfer.</p>
              </div>
              {preview && (
                <div className="rounded-lg border p-3 text-sm">
                  {!preview.allowed ? (
                    <p className="text-destructive">{preview.reason}</p>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Partner payout</span>
                        <span className="font-semibold text-[#189aa1]">{fmtMoney(preview.shareAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Platform keeps</span>
                        <span>{fmtMoney(preview.grossAmount - preview.shareAmount)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualEntry(null)}>Cancel</Button>
            <Button
              className="bg-[#189aa1] hover:bg-[#147a80]"
              disabled={
                processOneMutation.isPending ||
                !manualEntry ||
                !preview?.allowed ||
                !Number.isFinite(pctNum)
              }
              onClick={() => setPaymentConfirm({
                entry: manualEntry!,
                sharePercentage: pctNum,
              })}
            >
              Review Stripe Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!paymentConfirm} onOpenChange={(open) => { if (!open) setPaymentConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm revenue-share payment</AlertDialogTitle>
            <AlertDialogDescription>
              This sends a Stripe Connect transfer. Confirm the payment details below before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {paymentConfirm && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800 space-y-2">
              <div className="flex justify-between gap-4"><span className="text-slate-600">Partner</span><span className="font-medium text-right">{paymentConfirm.entry.partnerName}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-600">Course</span><span className="font-medium text-right">{paymentConfirm.entry.courseTitle ?? "—"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-600">Gross sale</span><span className="font-medium">{fmtMoney(paymentConfirm.entry.grossAmount)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-600">Share</span><span className="font-medium">{paymentConfirm.sharePercentage.toFixed(2)}%</span></div>
              <div className="flex justify-between gap-4 border-t border-amber-200 pt-2 text-base"><span className="font-semibold">Stripe transfer</span><span className="font-bold text-[#147a80]">{fmtMoney(calculateShareAmount(paymentConfirm.entry.grossAmount, paymentConfirm.sharePercentage))}</span></div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">This payment is recorded as a manual payout and cannot be reprocessed from the ledger after Stripe accepts it.</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processOneMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#147a80] hover:bg-[#0f656a]"
              disabled={processOneMutation.isPending || !paymentConfirm}
              onClick={() => paymentConfirm && processOneMutation.mutate({
                ledgerId: paymentConfirm.entry.id,
                sharePercentage: paymentConfirm.sharePercentage,
              })}
            >
              {processOneMutation.isPending ? "Sending…" : "Confirm & Send Stripe Transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm pending revenue-share payments</AlertDialogTitle>
            <AlertDialogDescription>
              This sends a separate Stripe Connect transfer for each eligible pending ledger entry in the current selection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800 space-y-2">
            <div className="flex justify-between gap-4"><span className="text-slate-600">Selection</span><span className="font-medium text-right">{selectedPartner ? selectedPartner.name : "All partners"}</span></div>
            <div className="flex justify-between gap-4"><span className="text-slate-600">Eligible payouts</span><span className="font-medium">{eligibleBatchEntries.length}</span></div>
            <div className="flex justify-between gap-4 border-t border-amber-200 pt-2 text-base"><span className="font-semibold">Total Stripe transfers</span><span className="font-bold text-[#147a80]">{fmtMoney(eligibleBatchAmount)}</span></div>
          </div>
          <p className="text-xs text-muted-foreground">Entries that Stripe cannot process will remain in the ledger with an error; successful payments cannot be reprocessed.</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={manualPayoutMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#147a80] hover:bg-[#0f656a]"
              disabled={manualPayoutMutation.isPending || eligibleBatchEntries.length === 0}
              onClick={() => manualPayoutMutation.mutate({
                partnerId: filterPartnerId !== "all" ? Number(filterPartnerId) : undefined,
              })}
            >
              {manualPayoutMutation.isPending ? "Sending…" : `Confirm & Send ${eligibleBatchEntries.length} Payment${eligibleBatchEntries.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
 
