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
function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
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
        <Button onClick={() => setShowInvite(true)} className="gap-1.5 bg-[#189aa1] hover:bg-[#147a80]">
          <Plus className="h-4 w-4" /> Invite Partner
        </Button>
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
                    <TableCell className="font-medium">{a.productTitle ?? `ID: ${a.productId}`}</TableCell>
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
                productId: Number(form.productId),
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
  const { data: partners = [] } = trpc.revenueShare.listPartners.useQuery();
  const { data: ledgerData, isLoading } = trpc.revenueShare.getLedger.useQuery({
    partnerId: filterPartnerId !== "all" ? Number(filterPartnerId) : undefined,
  });
  // getLedger returns { entries: [...], total: N } — extract the array defensively
  const ledger: any[] = Array.isArray(ledgerData) ? ledgerData : (ledgerData as any)?.entries ?? [];
  const retryMutation = trpc.revenueShare.retryFailedTransfer.useMutation({
    onSuccess: () => toast.success("Transfer retried"),
    onError: (e) => toast.error(e.message),
  });
  const manualPayoutMutation = trpc.revenueShare.processManualPayout.useMutation({
    onSuccess: (data: any) => toast.success(`Processed ${data?.processed ?? 0} transfer(s)`),
    onError: (e) => toast.error(e.message),
  });

  const totalPaid = ledger.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + (r.shareAmount ?? 0), 0);
  const totalPending = ledger.filter((r: any) => r.status === "pending").reduce((s: number, r: any) => s + (r.shareAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Payout Ledger</h2>
          <p className="text-sm text-muted-foreground">All revenue share transfers — paid, pending, and failed.</p>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={() => manualPayoutMutation.mutate({ partnerId: filterPartnerId !== "all" ? Number(filterPartnerId) : undefined })}
            disabled={manualPayoutMutation.isPending}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${manualPayoutMutation.isPending ? "animate-spin" : ""}`} />
            Process Pending
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
            <p className="text-sm text-muted-foreground mt-1">Payout records will appear here once payments are processed.</p>
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
                <TableHead>Partner Share</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.partnerName}</div>
                    <div className="text-xs text-muted-foreground">{r.partnerEmail}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.productTitle ?? `ID: ${r.productId}`}</TableCell>
                  <TableCell className="font-mono text-sm">{fmtMoney(r.grossAmount)}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold text-[#189aa1]">{fmtMoney(r.shareAmount)}</TableCell>
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
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(r.paidAt ?? r.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "failed" && (
                      <Button
                        size="sm" variant="outline"
                        onClick={() => retryMutation.mutate({ ledgerId: r.id })}
                        disabled={retryMutation.isPending}
                        className="text-xs gap-1"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
 
