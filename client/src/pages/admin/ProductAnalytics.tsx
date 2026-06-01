/**
 * ProductAnalytics.tsx — Per-product/course/funnel analytics
 * Shows all products with purchase counts, revenue, and purchaser lists with deep links.
 * Supports granting access and refunding from within.
 */
import { useState, useMemo } from "react";
import { UserSearchCombobox, type SelectedUser } from "@/components/UserSearchCombobox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  BarChart3, Search, Users, DollarSign, Package, ExternalLink,
  ChevronLeft, ChevronRight, UserPlus, RefreshCw, RotateCcw,
  BookOpen, Download, ShoppingBag, Layers, Megaphone, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCurrency(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const TYPE_ICONS: Record<string, any> = {
  course: BookOpen, download: Download, physical: ShoppingBag, bundle: Layers, funnel: Megaphone,
};
const TYPE_COLORS: Record<string, string> = {
  course: "bg-teal-100 text-teal-700", download: "bg-cyan-100 text-cyan-700",
  physical: "bg-amber-100 text-amber-700", bundle: "bg-teal-100 text-teal-700",
  funnel: "bg-blue-100 text-blue-700",
};
const TYPE_LABELS: Record<string, string> = {
  course: "Course", download: "Download", physical: "Physical Product", bundle: "Bundle", funnel: "Funnel",
};
const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700",
  refunded: "bg-gray-100 text-gray-600", failed: "bg-red-100 text-red-700",
  shipped: "bg-blue-100 text-blue-700", delivered: "bg-green-100 text-green-700",
};

// ─── Grant Access Dialog ─────────────────────────────────────────────────────
function GrantAccessDialog({ productId, productType, productTitle, open, onClose, onDone }: {
  productId: number; productType: string; productTitle: string;
  open: boolean; onClose: () => void; onDone: () => void;
}) {
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const grantMutation = trpc.productAnalytics.grantProductAccess.useMutation({
    onSuccess: (data) => { toast.success(data.message); setSelectedUser(null); onDone(); onClose(); },
    onError: e => toast.error(e.message),
  });

  if (!["course", "download", "bundle"].includes(productType)) return null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { setSelectedUser(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" /> Grant Access
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600">
            Grant access to <strong>{productTitle}</strong> for a user.
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Search User</label>
            <UserSearchCombobox onSelect={setSelectedUser} placeholder="Search by name or email…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setSelectedUser(null); onClose(); }}>Cancel</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            disabled={!selectedUser || grantMutation.isPending}
            onClick={() => selectedUser && grantMutation.mutate({ productId, productType: productType as any, userEmail: selectedUser.email })}
          >
            {grantMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {selectedUser?.isNew ? "Create & Grant Access" : "Grant Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Purchaser Detail Sheet ──────────────────────────────────────────────────
function PurchaserSheet({ purchaser, onClose, onRefunded }: {
  purchaser: any | null; onClose: () => void; onRefunded: () => void;
}) {
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState<"duplicate" | "fraudulent" | "requested_by_customer">("requested_by_customer");
  const refundMutation = trpc.adminUser.refundPayment.useMutation({
    onSuccess: () => { toast.success("Refund issued"); setRefundDialogOpen(false); onRefunded(); onClose(); },
    onError: e => toast.error(`Refund failed: ${e.message}`),
  });

  if (!purchaser) return null;
  const canRefund = purchaser.status === "paid" && !!purchaser.stripePaymentIntentId;

  return (
    <>
      <Sheet open={!!purchaser} onOpenChange={o => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-gray-900">Transaction Details</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <Badge className={`${STATUS_COLORS[purchaser.status] ?? "bg-gray-100 text-gray-600"} border-0`}>
                {purchaser.status}
              </Badge>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700">Customer</div>
              <div className="text-sm text-gray-900">{purchaser.userName || "—"}</div>
              <div className="text-sm text-gray-500">{purchaser.userEmail}</div>
              {purchaser.userId && (
                <Link href={`/admin/users/${purchaser.userId}`}>
                  <span className="text-xs text-teal-600 hover:underline flex items-center gap-1 cursor-pointer">
                    View user profile <ExternalLink className="w-3 h-3" />
                  </span>
                </Link>
              )}
            </div>
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700">Payment</div>
              <div className="text-xl font-bold text-gray-900">{fmtCurrency(purchaser.amountPaid, purchaser.currency)}</div>
              <div className="text-xs text-gray-400">{fmtDateTime(purchaser.purchasedAt)}</div>
              {purchaser.stripePaymentIntentId && (
                <div className="text-xs text-gray-400 font-mono break-all mt-1">{purchaser.stripePaymentIntentId}</div>
              )}
            </div>
            <div className="pt-2 border-t space-y-2">
              <Button
                variant="outline" className="w-full gap-2 justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={!canRefund}
                onClick={() => setRefundDialogOpen(true)}
              >
                <RotateCcw className="w-4 h-4" />
                Issue Refund
                {!canRefund && purchaser.status === "refunded" && (
                  <span className="ml-auto text-xs text-gray-400">Already refunded</span>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-500" /> Confirm Refund
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              This will issue a full refund of <strong>{fmtCurrency(purchaser.amountPaid, purchaser.currency)}</strong> to{" "}
              <strong>{purchaser.userEmail}</strong>. This action cannot be undone.
            </p>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Refund Reason</label>
              <Select value={refundReason} onValueChange={v => setRefundReason(v as typeof refundReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="requested_by_customer">Requested by Customer</SelectItem>
                  <SelectItem value="duplicate">Duplicate</SelectItem>
                  <SelectItem value="fraudulent">Fraudulent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              disabled={refundMutation.isPending}
              onClick={() => {
                if (!purchaser.stripePaymentIntentId) return;
                refundMutation.mutate({ stripePaymentIntentId: purchaser.stripePaymentIntentId, purchaseId: purchaser.transactionId, reason: refundReason });
              }}
            >
              {refundMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Issue Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Product Detail View (Purchaser List) ────────────────────────────────────
function ProductDetailView({ product, onBack }: {
  product: { id: number; type: string; title: string };
  onBack: () => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedPurchaser, setSelectedPurchaser] = useState<any>(null);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);

  const purchasersQuery = trpc.productAnalytics.getProductPurchasers.useQuery({
    productId: product.id,
    productType: product.type as any,
    page,
    pageSize: 25,
    search: search || undefined,
  });

  const data = purchasersQuery.data;
  const Icon = TYPE_ICONS[product.type] ?? Package;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${TYPE_COLORS[product.type] ?? "bg-gray-100 text-gray-600"}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{product.title}</h2>
            <span className="text-xs text-gray-500">{TYPE_LABELS[product.type] ?? product.type}</span>
          </div>
        </div>
        {["course", "download", "bundle"].includes(product.type) && (
          <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2" onClick={() => setGrantDialogOpen(true)}>
            <UserPlus className="w-4 h-4" /> Grant Access
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border border-gray-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{data?.total ?? 0}</div>
              <div className="text-xs text-gray-500">Purchasers</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{fmtCurrency(data?.totalRevenue ?? 0)}</div>
              <div className="text-xs text-gray-500">Total Revenue</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">
                {data?.total ? fmtCurrency(Math.round((data.totalRevenue ?? 0) / data.total)) : "$0.00"}
              </div>
              <div className="text-xs text-gray-500">Avg. Order</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setSearch(searchInput.trim()); setPage(1); } }}
            placeholder="Search by name or email…" className="pl-8 h-9 text-sm"
          />
        </div>
        <Button size="sm" onClick={() => { setSearch(searchInput.trim()); setPage(1); }} className="bg-teal-600 hover:bg-teal-700 text-white h-9">
          <Search className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Purchaser Table */}
      <Card className="border border-gray-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Customer</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Date</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Amount</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchasersQuery.isLoading ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
                ) : (data?.purchasers ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">No purchasers found</td></tr>
                ) : (data?.purchasers ?? []).map((p: any) => (
                  <tr key={p.transactionId} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPurchaser(p)}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900 text-sm">{p.userName || "—"}</div>
                      <div className="text-xs text-gray-400">{p.userEmail}</div>
                      {p.userId && (
                        <Link href={`/admin/users/${p.userId}`} onClick={e => e.stopPropagation()}>
                          <span className="text-xs text-teal-600 hover:underline flex items-center gap-0.5 mt-0.5 cursor-pointer">
                            Profile <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(p.purchasedAt)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900 text-sm whitespace-nowrap">
                      {fmtCurrency(p.amountPaid, p.currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge className={`${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"} border-0 text-xs`}>
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.total > 25 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, data.total)} of {data.total}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 px-3 text-xs gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <Button size="sm" variant="outline" disabled={page * 25 >= data.total} onClick={() => setPage(p => p + 1)} className="h-7 px-3 text-xs gap-1">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchaser Detail Sheet */}
      <PurchaserSheet
        purchaser={selectedPurchaser}
        onClose={() => setSelectedPurchaser(null)}
        onRefunded={() => purchasersQuery.refetch()}
      />

      {/* Grant Access Dialog */}
      <GrantAccessDialog
        productId={product.id}
        productType={product.type}
        productTitle={product.title}
        open={grantDialogOpen}
        onClose={() => setGrantDialogOpen(false)}
        onDone={() => purchasersQuery.refetch()}
      />
    </div>
  );
}

// ─── Main Product Analytics Page ─────────────────────────────────────────────
export default function ProductAnalytics() {
  const [typeFilter, setTypeFilter] = useState<"all" | "course" | "download" | "physical" | "bundle" | "funnel">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; type: string; title: string } | null>(null);

  const productsQuery = trpc.productAnalytics.listAllProductsWithStats.useQuery({
    type: typeFilter,
    search: search || undefined,
  });

  const products = productsQuery.data?.products ?? [];

  // If a product is selected, show its detail view
  if (selectedProduct) {
    return (
      <ProductDetailView
        product={selectedProduct}
        onBack={() => setSelectedProduct(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-600" /> Product Analytics
        </h2>
        <p className="text-sm text-gray-500 mt-1">View purchasers, revenue, and manage access for each product</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
          <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="course">Courses</SelectItem>
            <SelectItem value="download">Downloads</SelectItem>
            <SelectItem value="physical">Physical Products</SelectItem>
            <SelectItem value="bundle">Bundles</SelectItem>
            <SelectItem value="funnel">Funnels</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setSearch(searchInput.trim()); } }}
            placeholder="Search products…" className="pl-8 h-9 text-sm"
          />
        </div>
        <Button size="sm" onClick={() => setSearch(searchInput.trim())} className="bg-teal-600 hover:bg-teal-700 text-white h-9">
          <Search className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Product Grid */}
      {productsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i} className="border border-gray-200 animate-pulse">
              <CardContent className="p-5 h-32" />
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="p-8 text-center text-gray-400">
            No products found
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const Icon = TYPE_ICONS[p.type] ?? Package;
            return (
              <Card
                key={`${p.type}-${p.id}`}
                className="border border-gray-200 hover:border-teal-200 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedProduct({ id: p.id, type: p.type, title: p.title })}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[p.type] ?? "bg-gray-100 text-gray-600"}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{p.title}</h3>
                      <span className="text-xs text-gray-400">{TYPE_LABELS[p.type] ?? p.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{p.purchaseCount}</span>
                      <span className="text-xs text-gray-400">sales</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{fmtCurrency(p.revenue)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
