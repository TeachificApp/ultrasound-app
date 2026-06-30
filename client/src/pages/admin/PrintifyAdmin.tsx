import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { RefreshCw, Package, ShoppingCart, Store, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

function fmtCents(cents: number | null | undefined) {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

function ProductsTab({ shopId }: { shopId: number }) {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publish, setPublish] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);

  const productsQuery = trpc.printifyAdmin.listProducts.useQuery({ shopId, page, limit: 50 });
  const importedQuery = trpc.printifyAdmin.listImportedProductIds.useQuery({ shopId });
  const importMut = trpc.printifyAdmin.importProducts.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.created} new, updated ${data.updated}, skipped ${data.skipped}`);
      utils.printifyAdmin.listImportedProductIds.invalidate({ shopId });
      utils.productsAdmin.list.invalidate();
      setSelected(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  const importedIds = new Set((importedQuery.data ?? []).map((r) => r.printifyProductId));
  const products = productsQuery.data?.products ?? [];
  const lastPage = productsQuery.data?.lastPage ?? 1;

  const toggle = (id: string) => {
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
          {productsQuery.data?.total ?? 0} products in Printify
          {importedIds.size > 0 && <> · {importedIds.size} already imported</>}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={publish} onCheckedChange={(v) => setPublish(Boolean(v))} />
            Publish on import
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(Boolean(v))} />
            Update existing
          </label>
          <Button
            size="sm"
            disabled={selected.size === 0 || importMut.isPending}
            onClick={() => importMut.mutate({
              shopId,
              printifyProductIds: Array.from(selected),
              publish,
              updateExisting,
            })}
          >
            {importMut.isPending ? "Importing…" : `Import selected (${selected.size})`}
          </Button>
          <Button size="sm" variant="outline" onClick={() => productsQuery.refetch()} disabled={productsQuery.isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${productsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {productsQuery.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const isImported = importedIds.has(p.id);
            const isSelected = selected.has(p.id);
            return (
              <Card
                key={p.id}
                className={`overflow-hidden cursor-pointer transition-colors ${isSelected ? "ring-2 ring-teal-500" : ""}`}
                onClick={() => toggle(p.id)}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggle(p.id)} onClick={(e) => e.stopPropagation()} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2">{p.title}</p>
                      <div className="flex items-center justify-between mt-1 gap-1">
                        {p.priceCents != null && (
                          <span className="text-sm text-teal-600 font-semibold">{fmtCents(p.priceCents)}</span>
                        )}
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

      {lastPage > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ shopId }: { shopId: number }) {
  const [page, setPage] = useState(1);
  const ordersQuery = trpc.printifyAdmin.listOrders.useQuery({ shopId, page, limit: 20 });
  const orders = ordersQuery.data?.data ?? [];
  const lastPage = ordersQuery.data?.last_page ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {ordersQuery.data?.total ?? orders.length} orders in Printify
        </p>
        <Button size="sm" variant="outline" onClick={() => ordersQuery.refetch()} disabled={ordersQuery.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${ordersQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {ordersQuery.isLoading ? (
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders yet</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Order</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">External ID</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={String(order.id)} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{String(order.id)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{String(order.status ?? "unknown")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {order.external_id ? String(order.external_id) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PrintifyAdmin() {
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const statusQuery = trpc.printifyAdmin.getConnectionStatus.useQuery();
  const testMut = trpc.printifyAdmin.testConnection.useMutation({
    onSuccess: (data) => {
      statusQuery.refetch();
      toast.success(`Connected — ${data.shops.length} shop(s) found`);
    },
    onError: (err) => toast.error(err.message),
  });

  const shops = statusQuery.data?.shops ?? [];
  const defaultShopId = statusQuery.data?.defaultShopId ?? null;

  if (shops.length > 0 && selectedShopId === null) {
    const preferred = defaultShopId && shops.some((s) => s.id === defaultShopId)
      ? defaultShopId
      : shops[0]!.id;
    setSelectedShopId(preferred);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-teal-600" />
            Printify Integration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Import Printify products and manage print-on-demand fulfillment.
          </p>
        </div>
        <a
          href="https://printify.com/app/store/products"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-teal-600 hover:underline flex items-center gap-1"
        >
          Open Printify Dashboard <ExternalLink className="h-3 w-3" />
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
                  ? `Connected — ${shops.length} shop(s)`
                  : statusQuery.data?.configured
                    ? "Connection failed"
                    : "Not configured"}
              </p>
              <p className="text-xs text-muted-foreground">
                {statusQuery.data?.error ?? "Set PRINTIFY_API_TOKEN in environment secrets"}
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

      {statusQuery.isLoading ? (
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
      ) : shops.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No Printify shops found. Check PRINTIFY_API_TOKEN in Settings → Secrets.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Shop:</label>
            <Select
              value={selectedShopId?.toString() ?? ""}
              onValueChange={(v) => setSelectedShopId(Number(v))}
            >
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Select a shop" />
              </SelectTrigger>
              <SelectContent>
                {shops.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.title}
                    <Badge variant="outline" className="ml-2 text-xs">{s.sales_channel}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedShopId && (
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
                <ProductsTab shopId={selectedShopId} />
              </TabsContent>
              <TabsContent value="orders" className="mt-4">
                <OrdersTab shopId={selectedShopId} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
