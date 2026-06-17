/**
 * DownloadAnalytics.tsx — FetchApp-style download access dashboard
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  Download,
  ShoppingCart,
  Search,
  RefreshCw,
  Mail,
  Ban,
  RotateCcw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-green-100 text-green-800 border-green-200",
    downloaded: "bg-teal-100 text-teal-800 border-teal-200",
    expired: "bg-gray-100 text-gray-600 border-gray-200",
    revoked: "bg-red-100 text-red-800 border-red-200",
    refunded: "bg-amber-100 text-amber-800 border-amber-200",
  };
  return (
    <Badge variant="outline" className={`text-xs uppercase ${styles[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

function OrderDetailDialog({
  purchaseId,
  open,
  onClose,
}: {
  purchaseId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.downloadsAdmin.getOrderDetail.useQuery(
    { purchaseId: purchaseId! },
    { enabled: !!purchaseId && open },
  );

  const expireMut = trpc.downloadsAdmin.expireOrder.useMutation({
    onSuccess: () => { toast.success("Order expired"); refetch(); utils.downloadsAdmin.listOrders.invalidate(); },
  });
  const reopenMut = trpc.downloadsAdmin.reopenOrder.useMutation({
    onSuccess: () => { toast.success("Order reopened"); refetch(); utils.downloadsAdmin.listOrders.invalidate(); },
  });
  const resendMut = trpc.downloadsAdmin.resendOrderEmail.useMutation({
    onSuccess: () => { toast.success("Email resent"); refetch(); },
  });
  const updateMut = trpc.downloadsAdmin.updateOrderAccess.useMutation({
    onSuccess: () => { toast.success("Access updated"); refetch(); },
  });

  const [maxDl, setMaxDl] = useState<string>("");

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Order {data?.orderRef ?? `#${purchaseId}`}
            {data && <StatusBadge status={data.status} />}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Loading order…</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Customer</p>
                <p className="font-medium">{data.userName ?? "—"}</p>
                <p className="text-muted-foreground">{data.userEmail}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Created</p>
                <p>{new Date(data.purchasedAt).toLocaleString()}</p>
                {data.accessExpiresAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires: {new Date(data.accessExpiresAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs">Product</p>
                <p className="font-medium">{data.productTitle}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="font-medium">
                  ${((data.amount ?? 0) / 100).toFixed(2)} {data.currency?.toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Downloads per file</p>
                <p>{data.maxDownloadsPerFile ?? "Unlimited"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => resendMut.mutate({ purchaseId: data.id })} disabled={resendMut.isPending}>
                <Mail className="w-3.5 h-3.5 mr-1" /> Resend Email
              </Button>
              {data.status === "open" ? (
                <Button size="sm" variant="outline" onClick={() => expireMut.mutate({ purchaseId: data.id })} disabled={expireMut.isPending}>
                  <Ban className="w-3.5 h-3.5 mr-1" /> Expire Order
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => reopenMut.mutate({ purchaseId: data.id })} disabled={reopenMut.isPending}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen Order
                </Button>
              )}
            </div>

            <div className="flex items-end gap-2 border rounded-lg p-3 bg-muted/30">
              <div className="flex-1">
                <Label className="text-xs">Max downloads per file</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="3"
                  value={maxDl}
                  onChange={(e) => setMaxDl(e.target.value)}
                  className="h-8 mt-1"
                />
              </div>
              <Button
                size="sm"
                onClick={() => updateMut.mutate({
                  purchaseId: data.id,
                  maxDownloadsPerFile: maxDl === "" ? null : parseInt(maxDl, 10),
                })}
                disabled={updateMut.isPending}
              >
                Save
              </Button>
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Files ({data.files.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {data.files.map((f) => (
                  <div key={f.fileId} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                    <span className="truncate flex-1 font-medium">{f.fileName}</span>
                    <div className="flex gap-2 shrink-0">
                      <Badge className="bg-blue-600">Downloaded: {f.downloaded}</Badge>
                      <Badge variant="secondary">
                        Remaining: {f.remaining === null ? "∞" : f.remaining}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Order Activity</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {data.activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity logged yet.</p>
                ) : (
                  data.activity.map((a) => (
                    <p key={a.id} className="text-sm text-muted-foreground border-b last:border-0 pb-2">
                      {a.message}
                      <span className="block text-xs mt-0.5">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </p>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrdersTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "open" | "expired" | "revoked" | "refunded" | "downloaded">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.downloadsAdmin.listOrders.useQuery({
    page,
    pageSize: 25,
    status,
    search: search || undefined,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="h-9 rounded-md border px-2 text-sm bg-background"
          value={status}
          onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}
        >
          <option value="all">All Orders</option>
          <option value="open">Open</option>
          <option value="downloaded">Downloaded</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
          <option value="refunded">Refunded</option>
        </select>
        <div className="flex flex-1 min-w-[200px] gap-2">
          <Input
            placeholder="Search customer or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <Button size="sm" className="h-9" onClick={() => { setPage(1); refetch(); }}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
        <Button size="sm" variant="outline" className="h-9" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-3 font-medium">Order #</th>
                <th className="p-3 font-medium">Price</th>
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Files</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : !data?.orders.length ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No orders found.</td></tr>
              ) : (
                data.orders.map((o: any) => (
                  <tr
                    key={o.id}
                    className="border-b hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedId(o.id)}
                  >
                    <td className="p-3 text-blue-600 font-mono text-xs">{o.orderRef}</td>
                    <td className="p-3">${((o.amount ?? 0) / 100).toFixed(2)}</td>
                    <td className="p-3">
                      <p className="font-medium truncate max-w-[160px]">{o.userName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{o.userEmail}</p>
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(o.purchasedAt).toLocaleString()}
                    </td>
                    <td className="p-3">{o.fileCount}</td>
                    <td className="p-3">
                      <StatusBadge status={o.displayStatus ?? o.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data && data.total > 25 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button size="sm" variant="outline" disabled={page * 25 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <OrderDetailDialog
        purchaseId={selectedId}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function DashboardCharts() {
  const { data: dash, isLoading: dashLoading } = trpc.downloadsAdmin.getAccessDashboard.useQuery({ days: 30 });
  const { data, isLoading } = trpc.downloadsAdmin.getAnalytics.useQuery();

  if (dashLoading || isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading dashboard…</div>;
  }

  const totalDownloads = data?.products.reduce((sum, p) => sum + p.downloadCount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{dash?.summary.ordersToday ?? 0}</p>
            <p className="text-xs text-muted-foreground">Digital Orders Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{dash?.summary.orders7d ?? 0}</p>
            <p className="text-xs text-muted-foreground">Orders (7 days)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{dash?.summary.orders30d ?? 0}</p>
            <p className="text-xs text-muted-foreground">Orders (30 days)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{dash?.summary.downloads30d ?? 0}</p>
            <p className="text-xs text-muted-foreground">Downloads (30 days)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Orders &amp; Downloads (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dash?.series ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="orders" stroke="#22c55e" strokeWidth={2} dot={false} name="Orders" />
              <Line type="monotone" dataKey="downloads" stroke="#3b82f6" strokeWidth={2} dot={false} name="Downloads" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Downloads by Product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.products ?? []).slice(0, 8).map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="truncate flex-1">{p.title}</span>
                <Badge variant="secondary">{p.downloadCount}</Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">Total: {totalDownloads} downloads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Downloads (IP tracked)</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto space-y-2">
            {(data?.recentDownloads ?? []).slice(0, 15).map((d) => (
              <div key={d.id} className="text-xs border-b pb-2">
                <p className="font-medium truncate">{d.fileName ?? `File #${d.fileId}`}</p>
                <p className="text-muted-foreground">
                  {d.userEmail ?? "Unknown User"}
                  {d.ipAddress ? ` · ${d.ipAddress}` : ""}
                </p>
                <p className="text-muted-foreground">{new Date(d.downloadedAt).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DownloadAnalytics() {
  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList>
        <TabsTrigger value="dashboard" className="gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Dashboard
        </TabsTrigger>
        <TabsTrigger value="orders" className="gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5" /> Orders
        </TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard">
        <DashboardCharts />
      </TabsContent>
      <TabsContent value="orders">
        <OrdersTable />
      </TabsContent>
    </Tabs>
  );
}
