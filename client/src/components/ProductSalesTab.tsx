/**
 * ProductSalesTab — Sales & Access management for digital products, bundles, and memberships.
 *
 * Supports:
 *  - "download"    → downloadsAdmin.getSalesData / revokeAccess / refundPurchase
 *  - "bundle"      → bundleAdmin.getSalesData / revokeAccess / refundPurchase
 *  - "membership"  → brandMembership.adminList / adminRevoke / adminGrant
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, Users, TrendingUp, RefreshCw, XCircle, ChevronLeft, ChevronRight, ShieldOff, Crown, Mail, Loader2 } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(dollars: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(dollars);
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-green-100 text-green-800 border-green-200",
    active: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    refunded: "bg-red-100 text-red-800 border-red-200",
    revoked: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-gray-100 text-gray-600 border-gray-200",
    failed: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ─── Resend Confirmation Button ──────────────────────────────────────────────
function ResendConfirmationButton({ userId, brand }: { userId: number; brand: "aaus" | "iheartecho" }) {
  const resend = trpc.adminUser.resendMembershipConfirmation.useMutation({
    onSuccess: (res) => toast.success(`Confirmation sent to ${res.sentTo}`),
    onError: (e) => toast.error(e.message),
  });
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs text-teal-700 border-teal-200 hover:bg-teal-50"
      disabled={resend.isPending}
      onClick={() => resend.mutate({ userId, brand })}>
      {resend.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
      Resend
    </Button>
  );
}

// ─── Download Sales Tab ────────────────────────────────────────────────────────
function DownloadSalesTab({ productId }: { productId: number }) {
  const [page, setPage] = useState(1);
  const [refundTarget, setRefundTarget] = useState<{ id: number; email: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: number; email: string } | null>(null);
  const pageSize = 25;

  const { data, isLoading, refetch } = trpc.downloadsAdmin.getSalesData.useQuery({ productId, page, pageSize });
  const utils = trpc.useUtils();

  const refundMutation = trpc.downloadsAdmin.refundPurchase.useMutation({
    onSuccess: () => { toast.success("Refund issued successfully"); setRefundTarget(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMutation = trpc.downloadsAdmin.revokeAccess.useMutation({
    onSuccess: () => { toast.success("Access revoked"); setRevokeTarget(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading sales data…</div>;

  const purchases = data?.purchases ?? [];
  const total = data?.total ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1"><Users className="h-3 w-3" /> Total Buyers</div>
          <div className="text-2xl font-bold text-teal-700">{total}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1"><DollarSign className="h-3 w-3" /> Total Revenue</div>
          <div className="text-2xl font-bold text-teal-700">{fmtMoney(totalRevenue)}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1"><TrendingUp className="h-3 w-3" /> Avg. Order</div>
          <div className="text-2xl font-bold text-teal-700">{total > 0 ? fmtMoney(totalRevenue / total) : "—"}</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {purchases.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No purchases yet</td></tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.userName || "—"}</div>
                  <div className="text-xs text-muted-foreground">{p.userEmail || "—"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.createdAt)}</td>
                <td className="px-4 py-3 font-medium">{fmtMoney(p.amount ?? 0, p.currency ?? "usd")}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status ?? "paid"} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {p.status === "paid" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setRefundTarget({ id: p.id, email: p.userEmail ?? "" })}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Refund
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                          onClick={() => setRevokeTarget({ id: p.id, email: p.userEmail ?? "" })}>
                          <ShieldOff className="h-3 w-3 mr-1" /> Revoke
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Refund Dialog */}
      <Dialog open={!!refundTarget} onOpenChange={() => setRefundTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue Refund</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Issue a full refund for <strong>{refundTarget?.email}</strong>? This will process via Stripe and revoke their access.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={refundMutation.isPending}
              onClick={() => refundTarget && refundMutation.mutate({ purchaseId: refundTarget.id })}>
              {refundMutation.isPending ? "Processing…" : "Issue Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revoke Access</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Revoke download access for <strong>{revokeTarget?.email}</strong>? They will no longer be able to download this product.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={revokeMutation.isPending}
              onClick={() => revokeTarget && revokeMutation.mutate({ purchaseId: revokeTarget.id })}>
              {revokeMutation.isPending ? "Revoking…" : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Bundle Sales Tab ──────────────────────────────────────────────────────────
function BundleSalesTab({ bundleId }: { bundleId: number }) {
  const [page, setPage] = useState(1);
  const [refundTarget, setRefundTarget] = useState<{ id: number; email: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: number; email: string } | null>(null);
  const pageSize = 25;

  const { data, isLoading, refetch } = trpc.bundleAdmin.getSalesData.useQuery({ bundleId, page, pageSize });

  const refundMutation = trpc.bundleAdmin.refundPurchase.useMutation({
    onSuccess: () => { toast.success("Refund issued successfully"); setRefundTarget(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMutation = trpc.bundleAdmin.revokeAccess.useMutation({
    onSuccess: () => { toast.success("Access revoked"); setRevokeTarget(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading sales data…</div>;

  const purchases = data?.purchases ?? [];
  const total = data?.total ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1"><Users className="h-3 w-3" /> Total Buyers</div>
          <div className="text-2xl font-bold text-teal-700">{total}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1"><DollarSign className="h-3 w-3" /> Total Revenue</div>
          <div className="text-2xl font-bold text-teal-700">{fmtMoney(totalRevenue)}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1"><TrendingUp className="h-3 w-3" /> Avg. Order</div>
          <div className="text-2xl font-bold text-teal-700">{total > 0 ? fmtMoney(totalRevenue / total) : "—"}</div>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {purchases.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No purchases yet</td></tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.userName || "—"}</div>
                  <div className="text-xs text-muted-foreground">{p.userEmail || "—"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.createdAt)}</td>
                <td className="px-4 py-3 font-medium">{fmtMoney(p.amount ?? 0, p.currency ?? "usd")}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status ?? "paid"} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {p.status === "paid" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setRefundTarget({ id: p.id, email: p.userEmail ?? "" })}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Refund
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                          onClick={() => setRevokeTarget({ id: p.id, email: p.userEmail ?? "" })}>
                          <ShieldOff className="h-3 w-3 mr-1" /> Revoke
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <Dialog open={!!refundTarget} onOpenChange={() => setRefundTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue Refund</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Issue a full refund for <strong>{refundTarget?.email}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={refundMutation.isPending}
              onClick={() => refundTarget && refundMutation.mutate({ purchaseId: refundTarget.id })}>
              {refundMutation.isPending ? "Processing…" : "Issue Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revoke Access</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Revoke bundle access for <strong>{revokeTarget?.email}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={revokeMutation.isPending}
              onClick={() => revokeTarget && revokeMutation.mutate({ enrollmentId: revokeTarget.id })}>
              {revokeMutation.isPending ? "Revoking…" : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Membership Sales Tab ──────────────────────────────────────────────────────
function MembershipSalesTab({ brand }: { brand: "aaus" | "iheartecho" }) {
  const [revokeTarget, setRevokeTarget] = useState<{ userId: number; email: string } | null>(null);
  const { data, isLoading, refetch } = trpc.brandMembership.adminList.useQuery({ brand });

  const revokeMutation = trpc.brandMembership.adminRevoke.useMutation({
    onSuccess: () => { toast.success("Membership revoked"); setRevokeTarget(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading members…</div>;

  const members = data ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1"><Users className="h-3 w-3" /> Active Members</div>
          <div className="text-2xl font-bold text-teal-700">{members.filter(m => m.status === "active").length}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1"><Users className="h-3 w-3" /> Total Members</div>
          <div className="text-2xl font-bold text-teal-700">{members.length}</div>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tier</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Granted</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No members yet</td></tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{m.userName || "—"}</div>
                  <div className="text-xs text-muted-foreground">{m.userEmail || "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="capitalize">{m.tier}</span>
                    {m.tier === "lifetime" && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                        <Crown className="h-2.5 w-2.5" /> Lifetime
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{m.source || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(m.grantedAt)}</td>
                <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {m.status === "active" && (
                      <ResendConfirmationButton userId={m.userId} brand={brand} />
                    )}
                    {m.status === "active" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                        onClick={() => setRevokeTarget({ userId: m.userId, email: m.userEmail ?? "" })}>
                        <XCircle className="h-3 w-3 mr-1" /> Revoke
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revoke Membership</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Revoke {brand === "aaus" ? "AAUS" : "iHeartEcho"} membership for <strong>{revokeTarget?.email}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={revokeMutation.isPending}
              onClick={() => revokeTarget && revokeMutation.mutate({ userId: revokeTarget.userId, brand })}>
              {revokeMutation.isPending ? "Revoking…" : "Revoke Membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export { DownloadSalesTab, BundleSalesTab, MembershipSalesTab };

