/**
 * AdminSalesPage — /admin/sales
 * Full sales management: list, filter, drill-down, refund, cancel subscription, resend access email.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Mail,
  RotateCcw,
  XCircle,
  ExternalLink,
  Calendar,
  DollarSign,
  User,
  Package,
  LayoutDashboard,
} from "lucide-react";
import { Link } from "wouter";

type Sale = {
  id: number;
  email: string;
  name: string | null;
  userId: number | null;
  productName: string;
  productType: string;
  amountPaid: number;
  currency: string;
  status: string;
  stripePaymentIntentId: string | null;
  sourceType: string | null;
  orderBumps: string | null;
  purchasedAt: Date;
};

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  refunded: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-700",
};

function formatCurrency(dollars: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(Number(dollars));
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Sale Detail Sheet ─────────────────────────────────────────────────────────
function SaleDetailSheet({
  sale,
  onClose,
  onRefunded,
  onResent,
}: {
  sale: Sale | null;
  onClose: () => void;
  onRefunded: (id: number) => void;
  onResent: (id: number) => void;
}) {
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState<"duplicate" | "fraudulent" | "requested_by_customer">("requested_by_customer");

  const refundMutation = trpc.adminUser.refundPayment.useMutation({
    onSuccess: () => {
      toast.success("Refund issued successfully.");
      setRefundDialogOpen(false);
      if (sale) onRefunded(sale.id);
      onClose();
    },
    onError: (err) => toast.error(`Refund failed: ${err.message}`),
  });

  const resendMutation = trpc.adminUser.resendAccessEmail.useMutation({
    onSuccess: () => {
      toast.success("Access email resent.");
      if (sale) onResent(sale.id);
    },
    onError: (err) => toast.error(`Resend failed: ${err.message}`),
  });

  if (!sale) return null;

  const orderBumps = sale.orderBumps ? (() => {
    try { return JSON.parse(sale.orderBumps as string) as Array<{ title: string; price: number }>; }
    catch { return []; }
  })() : [];

  const canRefund = sale.status === "paid" && !!sale.stripePaymentIntentId;
  const canResend = !!sale.email;

  return (
    <>
      <Sheet open={!!sale} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-gray-900">
              <ShoppingCart className="w-5 h-5 text-green-600" />
              Sale #{sale.id}
            </SheetTitle>
          </SheetHeader>

          <div className="py-4 space-y-5">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <Badge className={`${STATUS_COLORS[sale.status] ?? "bg-gray-100 text-gray-600"} border-0`}>
                {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
              </Badge>
            </div>

            {/* Customer */}
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <User className="w-4 h-4 text-gray-400" />
                Customer
              </div>
              <div className="text-sm text-gray-900">{sale.name || "—"}</div>
              <div className="text-sm text-gray-500">{sale.email}</div>
              {sale.userId && (
                <Link href={`/admin/users/${sale.userId}`}>
                  <a className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                    View user profile <ExternalLink className="w-3 h-3" />
                  </a>
                </Link>
              )}
            </div>

            {/* Product */}
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Package className="w-4 h-4 text-gray-400" />
                Product
              </div>
              <div className="text-sm text-gray-900 font-medium">{sale.productName}</div>
              <div className="text-xs text-gray-500 capitalize">{sale.productType?.replace(/_/g, " ")}</div>
              {orderBumps.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-500 mb-1">Order Bumps</div>
                  {orderBumps.map((bump, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-600">
                      <span>{bump.title}</span>
                      <span>{formatCurrency(bump.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <DollarSign className="w-4 h-4 text-gray-400" />
                Payment
              </div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(sale.amountPaid, sale.currency)}
              </div>
              {sale.stripePaymentIntentId && (
                <div className="text-xs text-gray-400 font-mono break-all">{sale.stripePaymentIntentId}</div>
              )}
            </div>

            {/* Date */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-gray-500">
                <Calendar className="w-4 h-4" />
                Purchased
              </span>
              <span className="text-gray-700">{formatDate(sale.purchasedAt)}</span>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t space-y-2">
              <Button
                variant="outline"
                className="w-full gap-2 justify-start"
                disabled={!canResend || resendMutation.isPending}
                onClick={() => resendMutation.mutate({ purchaseId: sale.id })}
              >
                {resendMutation.isPending
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Mail className="w-4 h-4 text-blue-500" />}
                Resend Access Email
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2 justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={!canRefund}
                onClick={() => setRefundDialogOpen(true)}
              >
                <RotateCcw className="w-4 h-4" />
                Issue Refund
                {!canRefund && sale.status === "refunded" && (
                  <span className="ml-auto text-xs text-gray-400">Already refunded</span>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-500" />
              Confirm Refund
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              This will issue a full refund of{" "}
              <strong>{formatCurrency(sale.amountPaid, sale.currency)}</strong> to{" "}
              <strong>{sale.email}</strong>. This action cannot be undone.
            </p>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Refund Reason</label>
              <Select value={refundReason} onValueChange={(v) => setRefundReason(v as typeof refundReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                if (!sale.stripePaymentIntentId) return;
                refundMutation.mutate({
                  stripePaymentIntentId: sale.stripePaymentIntentId,
                  purchaseId: sale.id,
                  reason: refundReason,
                });
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminSalesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "refunded" | "failed">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { data, isLoading, refetch } = trpc.adminUser.listAllSales.useQuery({
    page,
    pageSize: 50,
    status,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const handleSearch = useCallback(() => {
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleStatusChange = (val: string) => {
    setStatus(val as typeof status);
    setPage(1);
  };

  const handleRefunded = (id: number) => {
    refetch();
  };

  const handleResent = (id: number) => {
    // No-op — just close
  };

  const sales: Sale[] = (data?.sales ?? []) as Sale[];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb + Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2.5 pb-0">
          <nav className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link href="/platform-admin" className="flex items-center gap-1 hover:text-[#189aa1] transition-colors">
              <LayoutDashboard className="w-3 h-3" /> Platform Admin
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-700 font-medium">Sales</span>
          </nav>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-green-600" />
              Sales
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {total.toLocaleString()} total sale{total !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by email, name, or product…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} style={{ background: "#189aa1" }} className="text-white gap-2 flex-shrink-0">
                <Search className="w-4 h-4" />
                Search
              </Button>
            </div>
            {/* Status filter */}
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
              <Calendar className="w-4 h-4" />
              Date range:
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-40 text-sm"
            />
            <span className="text-gray-400 text-sm">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-40 text-sm"
            />
            {(dateFrom || dateTo || search || status !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 gap-1"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSearch("");
                  setSearchInput("");
                  setStatus("all");
                  setPage(1);
                }}
              >
                <XCircle className="w-4 h-4" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading sales…
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <ShoppingCart className="w-10 h-10 opacity-30" />
              <p className="text-sm">No sales found</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Customer</span>
                <span>Product</span>
                <span>Amount</span>
                <span>Date</span>
                <span>Status</span>
              </div>

              {/* Rows */}
              <div className="divide-y">
                {sales.map((sale) => (
                  <button
                    key={sale.id}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedSale(sale)}
                  >
                    {/* Mobile layout */}
                    <div className="sm:hidden space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900 truncate max-w-[60%]">
                          {sale.name || sale.email}
                        </span>
                        <Badge className={`${STATUS_COLORS[sale.status] ?? "bg-gray-100 text-gray-600"} border-0 text-xs`}>
                          {sale.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{sale.productName}</div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatCurrency(sale.amountPaid, sale.currency)}</span>
                        <span>{formatDate(sale.purchasedAt)}</span>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden sm:grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 items-center">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{sale.name || "—"}</div>
                        <div className="text-xs text-gray-500 truncate">{sale.email}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-800 truncate">{sale.productName}</div>
                        <div className="text-xs text-gray-400 capitalize">{sale.productType?.replace(/_/g, " ")}</div>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(sale.amountPaid, sale.currency)}
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(sale.purchasedAt)}</div>
                      <Badge className={`${STATUS_COLORS[sale.status] ?? "bg-gray-100 text-gray-600"} border-0 text-xs`}>
                        {sale.status}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {page} of {totalPages} ({total.toLocaleString()} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Sale Detail Sheet */}
      <SaleDetailSheet
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onRefunded={handleRefunded}
        onResent={handleResent}
      />
    </div>
  );
}
