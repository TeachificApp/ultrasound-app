import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, Package, ShoppingCart, Store, ExternalLink, X, CheckCircle2, AlertCircle } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  inprocess: "bg-blue-100 text-blue-700",
  onhold: "bg-orange-100 text-orange-700",
  partial: "bg-purple-100 text-purple-700",
  fulfilled: "bg-green-100 text-green-700",
  canceled: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-500",
};

// ── Products Tab ──────────────────────────────────────────────────────────────

function ProductsTab({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [publish, setPublish] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);

  const cachedQuery = trpc.printfulAdmin.getCachedProducts.useQuery({ storeId });
  const importedQuery = trpc.printfulAdmin.listImportedProductIds.useQuery({ storeId });
  const syncMutation = trpc.printfulAdmin.syncProducts.useMutation({
    onSuccess: (data) => {
      toast.success(`Sync complete — ${data.synced} of ${data.total} products synced.`);
      utils.printfulAdmin.getCachedProducts.invalidate({ storeId });
    },
    onError: (err) => toast.error(`Sync failed: ${err.message}`),
  });
  const importMut = trpc.printfulAdmin.importProducts.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.created} new, updated ${data.updated}, skipped ${data.skipped}`);
      utils.printfulAdmin.listImportedProductIds.invalidate({ storeId });
      utils.productsAdmin.list.invalidate();
      setSelected(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  const products = cachedQuery.data ?? [];
  const importedIds = new Set((importedQuery.data ?? []).map((r) => r.printfulSyncProductId));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length !== 1 ? "s" : ""} cached locally
          {importedIds.size > 0 && <> · {importedIds.size} imported to physical products</>}
          {products[0]?.lastSyncedAt && (
            <> · Last synced {new Date(products[0].lastSyncedAt).toLocaleString()}</>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Publish on import
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
            Update existing
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || importMut.isPending}
            onClick={() => importMut.mutate({
              storeId,
              syncProductIds: Array.from(selected),
              publish,
              updateExisting,
            })}
          >
            {importMut.isPending ? "Importing…" : `Import selected (${selected.size})`}
          </Button>
        <Button
          size="sm"
          onClick={() => syncMutation.mutate({ storeId })}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing…" : "Sync from Printful"}
        </Button>
        </div>
      </div>

      {cachedQuery.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products synced yet</p>
          <p className="text-sm mt-1">Click "Sync from Printful" to import your product catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const variants = p.variantsJson
              ? (JSON.parse(p.variantsJson) as Array<{ retailPrice?: string; currency?: string }>)
              : [];
            const price = p.retailPrice ?? variants[0]?.retailPrice;
            const isImported = importedIds.has(p.printfulProductId);
            const isSelected = selected.has(p.printfulProductId);
            return (
              <Card
                key={p.id}
                className={`overflow-hidden cursor-pointer transition-colors ${isSelected ? "ring-2 ring-teal-500" : ""}`}
                onClick={() => toggle(p.printfulProductId)}
              >
                {p.thumbnailUrl ? (
                  <img src={p.thumbnailUrl} alt={p.name} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(p.printfulProductId)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-2">{p.name}</p>
                  <div className="flex items-center justify-between mt-1 gap-1">
                    {price && (
                      <span className="text-sm text-teal-600 font-semibold">${price}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {p.syncedVariantCount}/{p.variantCount} variants
                    </span>
                    {isImported && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        Imported
                      </Badge>
                    )}
                  </div>
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

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const ordersQuery = trpc.printfulAdmin.listOrders.useQuery({
    storeId,
    status: statusFilter === "all" ? undefined : statusFilter,
    offset,
    limit,
  });

  const cancelMutation = trpc.printfulAdmin.cancelOrder.useMutation({
    onSuccess: () => {
      toast.success("Order cancelled");
      utils.printfulAdmin.listOrders.invalidate();
    },
    onError: (err) => toast.error(`Cancel failed: ${err.message}`),
  });

  const orders = ordersQuery.data?.orders ?? [];
  const total = ordersQuery.data?.paging.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="inprocess">In Process</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{total} order{total !== 1 ? "s" : ""}</span>
      </div>

      {ordersQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Order</th>
                <th className="text-left px-4 py-2 font-medium">Recipient</th>
                <th className="text-left px-4 py-2 font-medium">Items</th>
                <th className="text-left px-4 py-2 font-medium">Total</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">
                    <a
                      href={order.dashboard_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:underline flex items-center gap-1"
                    >
                      #{order.id}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{order.recipient.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.recipient.city}, {order.recipient.country_code}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {order.costs?.currency} {order.costs?.total}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {fmtDate(order.created)}
                  </td>
                  <td className="px-4 py-3">
                    {["draft", "pending"].includes(order.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 h-7 px-2"
                        onClick={() => {
                          if (confirm(`Cancel order #${order.id}?`)) {
                            cancelMutation.mutate({ storeId, orderId: order.id });
                          }
                        }}
                        disabled={cancelMutation.isPending}
                      >
                        <X className="h-3 w-3 mr-1" /> Cancel
                      </Button>
                    )}
                    {order.shipments?.[0]?.tracking_url && (
                      <a
                        href={order.shipments[0].tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 hover:underline"
                      >
                        Track
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PrintfulAdmin() {
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const statusQuery = trpc.printfulAdmin.getConnectionStatus.useQuery();
  const testMut = trpc.printfulAdmin.testConnection.useMutation({
    onSuccess: (data) => {
      statusQuery.refetch();
      toast.success(`Connected — ${data.stores.length} store(s) found`);
    },
    onError: (err) => toast.error(err.message),
  });
  const storesFromStatus = statusQuery.data?.stores ?? [];
  const storesFromList = trpc.printfulAdmin.listStores.useQuery(undefined, {
    enabled: statusQuery.data?.connected === true,
  });
  const storeList = storesFromList.data ?? storesFromStatus;

  // Auto-select the first store once loaded
  if (storeList.length > 0 && selectedStoreId === null) {
    const preferred = statusQuery.data?.defaultStoreId;
    setSelectedStoreId(
      preferred && storeList.some((s) => s.id === preferred) ? preferred : storeList[0]!.id,
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-teal-600" />
            Printful Integration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage print-on-demand products and orders across your Printful stores.
          </p>
        </div>
        <a
          href="https://www.printful.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-teal-600 hover:underline flex items-center gap-1"
        >
          Open Printful Dashboard <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <Card>
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {statusQuery.data?.connected ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            )}
            <div>
              <p className="text-sm font-medium">
                {statusQuery.data?.connected
                  ? `Connected — ${storeList.length} store(s)`
                  : statusQuery.data?.configured
                    ? "Connection failed"
                    : "Not configured"}
              </p>
              <p className="text-xs text-muted-foreground">
                {statusQuery.data?.error ?? "Set PRINTFUL_API_KEY in environment secrets"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !statusQuery.data?.configured}
          >
            {testMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Test connection"}
          </Button>
        </CardContent>
      </Card>

      {/* Store selector */}
      {statusQuery.isLoading ? (
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
      ) : storeList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No Printful stores found. Check your API key in Settings → Secrets.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Store:</label>
            <Select
              value={selectedStoreId?.toString() ?? ""}
              onValueChange={(v) => setSelectedStoreId(Number(v))}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select a store" />
              </SelectTrigger>
              <SelectContent>
                {storeList.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name}
                    <Badge variant="outline" className="ml-2 text-xs">{s.type}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStoreId && (
            <Tabs defaultValue="products">
              <TabsList>
                <TabsTrigger value="products">
                  <Package className="h-4 w-4 mr-2" /> Products
                </TabsTrigger>
                <TabsTrigger value="orders">
                  <ShoppingCart className="h-4 w-4 mr-2" /> Orders
                </TabsTrigger>
              </TabsList>
              <TabsContent value="products" className="mt-4">
                <ProductsTab storeId={selectedStoreId} />
              </TabsContent>
              <TabsContent value="orders" className="mt-4">
                <OrdersTab storeId={selectedStoreId} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
