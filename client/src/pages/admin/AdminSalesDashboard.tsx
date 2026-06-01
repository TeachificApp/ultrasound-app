/**
 * AdminSalesDashboard.tsx — Unified Sales Dashboard
 * Merges analytics (KPIs, charts, product breakdown) with full transaction management
 * (detail sheet, refund, resend access email, order bumps).
 */
import { useState, useMemo, useCallback } from "react";
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
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import {
  DollarSign, ShoppingCart, TrendingUp, RefreshCw, Download,
  Mail, RotateCcw, ChevronUp, ChevronDown, ChevronsUpDown,
  Calendar, Search, Filter, ExternalLink, User, Package, XCircle,
  ChevronLeft, ChevronRight, LayoutDashboard,
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCurrency(dollars: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(Number(dollars));
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const TYPE_COLORS: Record<string, string> = {
  course: "#189aa1", download: "#4ad9e0", membership: "#0e4a50",
  physical: "#f59e0b", bundle: "#8b5cf6", other: "#6b7280",
};
const TYPE_LABELS: Record<string, string> = {
  course: "Course", download: "Download", membership: "Membership",
  physical: "Physical", bundle: "Bundle", other: "Other",
};
const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700",
  refunded: "bg-gray-100 text-gray-600", failed: "bg-red-100 text-red-700",
};

// ─── Date Range Presets ───────────────────────────────────────────────────────
type DatePreset = "7d" | "30d" | "90d" | "365d" | "all" | "custom";
function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const from = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };
  if (preset === "7d") return { from: from(7), to };
  if (preset === "30d") return { from: from(30), to };
  if (preset === "90d") return { from: from(90), to };
  if (preset === "365d") return { from: from(365), to };
  return { from: "", to: "" };
}

// ─── Sort Helper ─────────────────────────────────────────────────────────────
type SortKey = "productName" | "revenue" | "sales" | "avgPrice";
type SortDir = "asc" | "desc";
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300 ml-1 inline" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3.5 h-3.5 text-[#189aa1] ml-1 inline" />
    : <ChevronDown className="w-3.5 h-3.5 text-[#189aa1] ml-1 inline" />;
}

// ─── Refund Dialog ────────────────────────────────────────────────────────────
function RefundDialog({ sale, open, onClose, onDone }: { sale: any; open: boolean; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<"duplicate" | "fraudulent" | "requested_by_customer">("requested_by_customer");
  const refundMutation = trpc.adminUser.refundPayment.useMutation({
    onSuccess: () => { toast.success("Refund issued"); onDone(); onClose(); },
    onError: e => toast.error(`Refund failed: ${e.message}`),
  });
  if (!sale) return null;
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-red-500" /> Confirm Refund
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600">
            This will issue a full refund of <strong>{fmtCurrency(sale.amountPaid, sale.currency)}</strong> to{" "}
            <strong>{sale.email}</strong>. This action cannot be undone.
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Refund Reason</label>
            <Select value={reason} onValueChange={v => setReason(v as typeof reason)}>
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white gap-2"
            disabled={refundMutation.isPending}
            onClick={() => {
              if (!sale.stripePaymentIntentId) return;
              refundMutation.mutate({ stripePaymentIntentId: sale.stripePaymentIntentId, purchaseId: sale.id, reason });
            }}
          >
            {refundMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Issue Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sale Detail Sheet ────────────────────────────────────────────────────────
function SaleDetailSheet({ sale, onClose, onRefunded }: { sale: Sale | null; onClose: () => void; onRefunded: () => void }) {
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState<"duplicate" | "fraudulent" | "requested_by_customer">("requested_by_customer");

  const refundMutation = trpc.adminUser.refundPayment.useMutation({
    onSuccess: () => { toast.success("Refund issued successfully."); setRefundDialogOpen(false); onRefunded(); onClose(); },
    onError: err => toast.error(`Refund failed: ${err.message}`),
  });
  const resendMutation = trpc.adminUser.resendAccessEmail.useMutation({
    onSuccess: () => toast.success("Access email resent."),
    onError: err => toast.error(`Resend failed: ${err.message}`),
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
      <Sheet open={!!sale} onOpenChange={open => { if (!open) onClose(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-gray-900">
              <ShoppingCart className="w-5 h-5 text-green-600" /> Sale #{sale.id}
            </SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <Badge className={`${STATUS_COLORS[sale.status] ?? "bg-gray-100 text-gray-600"} border-0`}>
                {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
              </Badge>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <User className="w-4 h-4 text-gray-400" /> Customer
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
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Package className="w-4 h-4 text-gray-400" /> Product
              </div>
              <div className="text-sm text-gray-900 font-medium">{sale.productName}</div>
              <div className="text-xs text-gray-500 capitalize">{sale.productType?.replace(/_/g, " ")}</div>
              {orderBumps.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-500 mb-1">Order Bumps</div>
                  {orderBumps.map((bump, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-600">
                      <span>{bump.title}</span>
                      <span>{fmtCurrency(bump.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <DollarSign className="w-4 h-4 text-gray-400" /> Payment
              </div>
              <div className="text-xl font-bold text-gray-900">{fmtCurrency(sale.amountPaid, sale.currency)}</div>
              {sale.stripePaymentIntentId && (
                <div className="text-xs text-gray-400 font-mono break-all">{sale.stripePaymentIntentId}</div>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-gray-500">
                <Calendar className="w-4 h-4" /> Purchased
              </span>
              <span className="text-gray-700">{fmtDate(sale.purchasedAt)}</span>
            </div>
            <div className="pt-2 border-t space-y-2">
              <Button
                variant="outline" className="w-full gap-2 justify-start"
                disabled={!canResend || resendMutation.isPending}
                onClick={() => resendMutation.mutate({ purchaseId: sale.id })}
              >
                {resendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 text-blue-500" />}
                Resend Access Email
              </Button>
              <Button
                variant="outline" className="w-full gap-2 justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
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
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-500" /> Confirm Refund
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              This will issue a full refund of <strong>{fmtCurrency(sale.amountPaid, sale.currency)}</strong> to{" "}
              <strong>{sale.email}</strong>. This action cannot be undone.
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
                if (!sale.stripePaymentIntentId) return;
                refundMutation.mutate({ stripePaymentIntentId: sale.stripePaymentIntentId, purchaseId: sale.id, reason: refundReason });
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminSalesDashboard() {
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "refunded" | "failed">("all");
  const [page, setPage] = useState(1);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { from: presetFrom, to: presetTo } = getPresetDates(preset);
  const dateFrom = preset === "custom" ? customFrom : (preset === "all" ? "" : presetFrom);
  const dateTo = preset === "custom" ? customTo : (preset === "all" ? "" : presetTo);

  const analyticsQuery = trpc.adminUser.getSalesAnalytics.useQuery({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
  const salesQuery = trpc.adminUser.listAllSales.useQuery({
    page, pageSize: 25, status: statusFilter, search: search || undefined,
    dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });

  const analytics = analyticsQuery.data;
  const sales = salesQuery.data;

  const sortedProducts = useMemo(() => {
    const rows = [...(analytics?.byProduct ?? [])];
    rows.sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return rows;
  }, [analytics?.byProduct, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleSearch = useCallback(() => { setSearch(searchInput.trim()); setPage(1); }, [searchInput]);

  const exportCsv = () => {
    if (!sales?.sales) return;
    const header = ["Date", "Customer", "Email", "Product", "Type", "Amount", "Status"];
    const rows = sales.sales.map(s => [
      fmtDateTime(s.purchasedAt), s.name ?? "", s.email, s.productName,
      s.productType, fmtCurrency(s.amountPaid, s.currency), s.status,
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sales-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/platform-admin" className="flex items-center gap-1 hover:text-[#189aa1] transition-colors">
          <LayoutDashboard className="w-3.5 h-3.5" /> Platform Admin
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <span className="text-gray-700 font-medium">Sales Dashboard</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#189aa1]" /> Sales Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">Revenue analytics, product performance, and transaction management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 text-sm" onClick={() => { salesQuery.refetch(); analyticsQuery.refetch(); }} disabled={salesQuery.isLoading}>
            <RefreshCw className={`w-4 h-4 ${salesQuery.isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" className="gap-2 text-sm" onClick={exportCsv}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="flex gap-2 flex-wrap">
              {(["7d", "30d", "90d", "365d", "all", "custom"] as DatePreset[]).map(p => (
                <button
                  key={p}
                  onClick={() => { setPreset(p); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    preset === p ? "bg-[#189aa1] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : p === "365d" ? "1 Year" : p === "all" ? "All Time" : "Custom"}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPage(1); }} className="w-36 h-8 text-sm" />
                <span className="text-gray-400 text-sm">to</span>
                <Input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setPage(1); }} className="w-36 h-8 text-sm" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {analyticsQuery.isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i} className="border border-gray-200 animate-pulse"><CardContent className="p-5 h-24" /></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Revenue", value: fmtCurrency(analytics?.summary.totalRevenue ?? 0), icon: DollarSign, color: "text-[#189aa1]", bg: "bg-[#189aa1]/10" },
            { label: "Total Orders", value: (analytics?.summary.totalSales ?? 0).toLocaleString(), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Avg. Order Value", value: fmtCurrency(analytics?.summary.avgOrderValue ?? 0), icon: TrendingUp, color: "text-teal-600", bg: "bg-teal-50" },
          ].map(kpi => (
            <Card key={kpi.label} className="border border-gray-200">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.bg} flex-shrink-0`}>
                  <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Revenue Chart */}
      {analytics && analytics.dailySeries.length > 0 && (
        <Card className="border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-800">Daily Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics.dailySeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#189aa1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#189aa1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => {
                  const dt = new Date(d + "T00:00:00");
                  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${Number(v).toFixed(0)}`} width={55} />
                <Tooltip
                  formatter={(v: number) => [fmtCurrency(v), "Revenue"]}
                  labelFormatter={d => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                />
                <Area type="monotone" dataKey="revenue" stroke="#189aa1" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Revenue by Type + Product Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {analytics && analytics.byType.length > 0 && (
          <Card className="border border-gray-200 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-800">By Product Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.byType} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
                  <YAxis type="category" dataKey="productType" tick={{ fontSize: 11 }} width={70}
                    tickFormatter={t => TYPE_LABELS[t] ?? t} />
                  <Tooltip formatter={(v: number) => [fmtCurrency(v), "Revenue"]} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {analytics.byType.map((entry, i) => (
                      <Cell key={i} fill={TYPE_COLORS[entry.productType] ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        <Card className={`border border-gray-200 ${analytics?.byType.length ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-800">Revenue by Product</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("productName")}>
                      Product <SortIcon col="productName" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("sales")}>
                      Orders <SortIcon col="sales" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("avgPrice")}>
                      Avg Price <SortIcon col="avgPrice" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort("revenue")}>
                      Revenue <SortIcon col="revenue" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analyticsQuery.isLoading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
                  ) : sortedProducts.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">No sales in this period</td></tr>
                  ) : sortedProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900 truncate max-w-[200px]">{p.productName}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: TYPE_COLORS[p.productType] ?? "#6b7280" }} />
                          <span className="text-xs text-gray-400">{TYPE_LABELS[p.productType] ?? p.productType}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-gray-700">{p.sales}</td>
                      <td className="px-3 py-2.5 text-right text-sm text-gray-700">{fmtCurrency(p.avgPrice)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmtCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction List */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-semibold text-gray-800">
              Transactions
              {sales?.total !== undefined && (
                <span className="ml-2 text-sm font-normal text-gray-400">({sales.total.toLocaleString()} total)</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    placeholder="Search customer, product…" className="pl-8 h-8 w-52 text-sm"
                  />
                </div>
                <Button size="sm" onClick={handleSearch} style={{ background: "#189aa1" }} className="text-white h-8">
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v as any); setPage(1); }}>
                <SelectTrigger className="h-8 w-32 text-sm"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              {(search || statusFilter !== "all") && (
                <Button variant="ghost" size="sm" className="h-8 text-gray-500 gap-1"
                  onClick={() => { setSearch(""); setSearchInput(""); setStatusFilter("all"); setPage(1); }}>
                  <XCircle className="w-3.5 h-3.5" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Date</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Customer</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600">Product</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Amount</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salesQuery.isLoading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
                ) : (sales?.sales ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">No transactions found</td></tr>
                ) : (sales?.sales ?? []).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSale(s as Sale)}>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(s.purchasedAt)}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900 text-sm">{s.name || "—"}</div>
                      <div className="text-xs text-gray-400">{s.email}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900 text-sm truncate max-w-[180px]">{s.productName}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: TYPE_COLORS[(s.productType as string)] ?? "#6b7280" }} />
                        <span className="text-xs text-gray-400">{TYPE_LABELS[(s.productType as string)] ?? s.productType}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900 text-sm whitespace-nowrap">
                      {fmtCurrency(s.amountPaid, s.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Badge className={`${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-600"} border-0 text-xs`}>
                        {s.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sales && sales.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, sales.total)} of {sales.total}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 px-3 text-xs gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <span className="text-xs text-gray-500">Page {page} of {sales.totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= sales.totalPages} onClick={() => setPage(p => p + 1)} className="h-7 px-3 text-xs gap-1">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Detail Sheet */}
      <SaleDetailSheet
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onRefunded={() => { salesQuery.refetch(); analyticsQuery.refetch(); }}
      />
    </div>
  );
}
