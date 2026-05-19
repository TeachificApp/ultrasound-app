/**
 * LMSSalesTab — Sales dashboard for a single LMS course/product.
 *
 * Sections:
 *  1. Checkout Links — direct links + embed codes for every pricing option
 *  2. Sales Table — paginated list of all orders with running total
 *  3. Student Profile Drawer — drill into a buyer's profile, enrollment, and order history
 *  4. Refund / Cancel actions with confirmation dialogs
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Copy, ExternalLink, Code2, Link2, DollarSign, Users, TrendingUp,
  RefreshCw, XCircle, ChevronLeft, ChevronRight, User, BookOpen, ShoppingBag,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function copyToClipboard(text: string, label = "Copied!") {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    refunded: "bg-red-100 text-red-800 border-red-200",
    failed: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ─── Checkout Links Section ────────────────────────────────────────────────────
function CheckoutLinksSection({ courseId }: { courseId: number }) {
  const origin = window.location.origin;
  const { data, isLoading } = trpc.lmsAdmin.getCheckoutLinks.useQuery({ courseId, origin });
  const [expandedEmbed, setExpandedEmbed] = useState<number | null>(null);

  if (isLoading) return <div className="text-sm text-muted-foreground py-4">Loading checkout links…</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-teal-600" />
        <span className="font-semibold text-sm">Checkout Links &amp; Embed Codes</span>
        <Badge variant="outline" className="text-xs">{data.links.length} option{data.links.length !== 1 ? "s" : ""}</Badge>
      </div>
      <div className="space-y-3">
        {data.links.map((link) => (
          <div key={link.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{link.label}</p>
                {(link as any).sublabel && <p className="text-xs text-muted-foreground">{(link as any).sublabel}</p>}
              </div>
              <Badge variant="outline" className="text-xs shrink-0">{link.pricingType}</Badge>
              {link.price > 0 && <span className="text-sm font-semibold text-teal-700 shrink-0">{fmtMoney(link.price)}</span>}
              {link.price === 0 && <span className="text-sm font-semibold text-green-600 shrink-0">Free</span>}
            </div>
            <div className="px-4 py-3 space-y-2">
              {/* Checkout URL */}
              <div className="flex items-center gap-2">
                <Input value={link.checkoutUrl} readOnly className="h-8 text-xs font-mono bg-gray-50 flex-1" />
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => copyToClipboard(link.checkoutUrl, "Link copied!")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 shrink-0" asChild>
                  <a href={link.checkoutUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                </Button>
              </div>
              {/* Embed code toggle */}
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground gap-1.5 px-2"
                  onClick={() => setExpandedEmbed(expandedEmbed === link.id ? null : link.id)}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  {expandedEmbed === link.id ? "Hide" : "Show"} embed code
                </Button>
                {expandedEmbed === link.id && (
                  <div className="mt-2 space-y-1.5">
                    <Textarea
                      value={link.embedCode}
                      readOnly
                      rows={3}
                      className="text-xs font-mono resize-none bg-gray-50"
                    />
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyToClipboard(link.embedCode, "Embed code copied!")}>
                      <Copy className="h-3 w-3 mr-1" /> Copy embed code
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Student Profile Drawer ────────────────────────────────────────────────────
function StudentProfileDrawer({
  userId,
  open,
  onClose,
}: { userId: number | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = trpc.lmsAdmin.getStudentProfile.useQuery(
    { userId: userId! },
    { enabled: !!userId && open }
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-teal-600" /> Student Profile
          </SheetTitle>
        </SheetHeader>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {data && (
          <div className="space-y-6">
            {/* User info */}
            <div className="rounded-lg border p-4 space-y-1.5">
              <p className="font-semibold">{data.user.displayName ?? "Unknown"}</p>
              <p className="text-sm text-muted-foreground">{data.user.email}</p>
              <p className="text-xs text-muted-foreground">Joined {fmtDate(data.user.createdAt)}</p>
              <Badge variant="outline" className="text-xs">{data.user.role}</Badge>
            </div>

            {/* Enrollments */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-teal-600" />
                <span className="font-semibold text-sm">Enrollments ({data.enrollments.length})</span>
              </div>
              {data.enrollments.length === 0 && <p className="text-xs text-muted-foreground">No enrollments.</p>}
              <div className="space-y-2">
                {data.enrollments.map((e) => (
                  <div key={e.id} className="rounded border p-3 text-sm space-y-1">
                    <p className="font-medium">{e.course?.title ?? `Course #${e.courseId}`}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Enrolled {fmtDate(e.enrolledAt)}</span>
                      <span>{e.progressPct ?? 0}% complete</span>
                      {e.completedAt && <Badge className="text-xs bg-green-100 text-green-800 border-green-200">Completed</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order history */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="h-4 w-4 text-teal-600" />
                <span className="font-semibold text-sm">Order History ({data.orders.length})</span>
              </div>
              {data.orders.length === 0 && <p className="text-xs text-muted-foreground">No orders.</p>}
              <div className="space-y-2">
                {data.orders.map((o) => (
                  <div key={o.id} className="rounded border p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{o.course?.title ?? `Course #${o.courseId}`}</p>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{fmtDate(o.createdAt)}</span>
                      <span className="font-semibold text-foreground">{fmtMoney(o.amount, o.currency)}</span>
                      {o.stripeSubscriptionId && <span className="text-teal-600">Subscription</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Refund Dialog ────────────────────────────────────────────────────────────
function RefundDialog({
  order,
  open,
  onClose,
  onSuccess,
}: { order: any; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState("requested_by_customer");
  const refund = trpc.lmsAdmin.refundOrder.useMutation({
    onSuccess: () => { toast.success("Refund issued successfully"); onSuccess(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund Order #{order?.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            This will issue a full refund of <strong>{order ? fmtMoney(order.amount, order.currency) : ""}</strong> to the customer via Stripe.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="requested_by_customer" className="text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => refund.mutate({ orderId: order.id, reason })}
            disabled={refund.isPending}
          >
            {refund.isPending ? "Refunding…" : "Issue Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cancel Subscription Dialog ───────────────────────────────────────────────
function CancelSubDialog({
  order,
  open,
  onClose,
  onSuccess,
}: { order: any; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const cancel = trpc.lmsAdmin.cancelSubscription.useMutation({
    onSuccess: () => { toast.success("Subscription cancelled"); onSuccess(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Subscription — Order #{order?.id}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            This will immediately cancel the Stripe subscription for this order. The student will lose access at the end of their current billing period.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => cancel.mutate({ orderId: order.id })}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel Subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sales Table ──────────────────────────────────────────────────────────────
function SalesTable({ courseId }: { courseId: number }) {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.lmsAdmin.getSalesData.useQuery({ courseId, page, pageSize });

  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [refundOrder, setRefundOrder] = useState<any>(null);
  const [cancelOrder, setCancelOrder] = useState<any>(null);

  const refresh = () => utils.lmsAdmin.getSalesData.invalidate({ courseId });

  if (isLoading) return <div className="text-sm text-muted-foreground py-4">Loading sales data…</div>;
  if (!data) return null;

  const totalPages = Math.ceil(data.total / pageSize);
  const runningTotal = data.orders.reduce((acc, o) => acc + (o.status === "paid" ? o.amount : 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 text-teal-600" /> Total Revenue
          </div>
          <p className="text-lg font-bold text-teal-700">{fmtMoney(data.totalRevenue)}</p>
        </div>
        <div className="rounded-lg border bg-white p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-teal-600" /> Total Orders
          </div>
          <p className="text-lg font-bold">{data.total}</p>
        </div>
        <div className="rounded-lg border bg-white p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-teal-600" /> This Page
          </div>
          <p className="text-lg font-bold">{fmtMoney(runningTotal)}</p>
        </div>
      </div>

      {/* Table */}
      {data.orders.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">No orders yet for this course.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Order</th>
                <th className="text-left px-3 py-2 font-medium">Student</th>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-center px-3 py-2 font-medium">Progress</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">#{o.id}</td>
                  <td className="px-3 py-2.5">
                    <button
                      className="text-left hover:text-teal-700 transition-colors"
                      onClick={() => setProfileUserId(o.userId)}
                    >
                      <p className="font-medium text-sm leading-tight">{o.user?.displayName ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{o.user?.email ?? ""}</p>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-sm">{fmtMoney(o.amount, o.currency)}</td>
                  <td className="px-3 py-2.5 text-center"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-2.5 text-center">
                    {o.enrollment ? (
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${o.enrollment.progressPct ?? 0}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{o.enrollment.progressPct ?? 0}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="View student profile"
                        onClick={() => setProfileUserId(o.userId)}
                      >
                        <User className="h-3.5 w-3.5" />
                      </Button>
                      {o.status === "paid" && !o.stripeSubscriptionId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          title="Refund order"
                          onClick={() => setRefundOrder(o)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {o.status === "paid" && o.stripeSubscriptionId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Cancel subscription"
                          onClick={() => setCancelOrder(o)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} of {totalPages} ({data.total} orders)</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <StudentProfileDrawer
        userId={profileUserId}
        open={!!profileUserId}
        onClose={() => setProfileUserId(null)}
      />
      <RefundDialog
        order={refundOrder}
        open={!!refundOrder}
        onClose={() => setRefundOrder(null)}
        onSuccess={refresh}
      />
      <CancelSubDialog
        order={cancelOrder}
        open={!!cancelOrder}
        onClose={() => setCancelOrder(null)}
        onSuccess={refresh}
      />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function LMSSalesTab({ courseId }: { courseId: number }) {
  return (
    <div className="space-y-8 pb-8">
      <CheckoutLinksSection courseId={courseId} />
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-teal-600" />
          <span className="font-semibold text-sm">Sales &amp; Orders</span>
        </div>
        <SalesTable courseId={courseId} />
      </div>
    </div>
  );
}
