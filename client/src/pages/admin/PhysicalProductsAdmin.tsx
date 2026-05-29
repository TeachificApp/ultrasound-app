import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PublishDomainSelect } from "@/components/PublishDomainSelect";
import {
  Plus, Pencil, Trash2, Copy, Upload, ShoppingBag, ArrowLeft,
  ExternalLink, Eye, Image as ImageIcon, Link as LinkIcon,
  Users, UserPlus, Loader2, Package, BarChart2, Settings,
  DollarSign, Globe, Tag, Truck, Sparkles, LayoutTemplate,
} from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    published: "bg-green-100 text-green-700 border-green-200",
    draft: "bg-gray-100 text-gray-600 border-gray-200",
    hidden: "bg-yellow-100 text-yellow-700 border-yellow-200",
    private: "bg-blue-100 text-blue-700 border-blue-200",
    archived: "bg-red-100 text-red-600 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variants[status] ?? variants.draft}`}>
      {status}
    </span>
  );
}

// ─── Product List ─────────────────────────────────────────────────────────────
function ProductList({ onEdit }: { onEdit: (id: number) => void }) {
  const { data: products, isLoading } = trpc.productsAdmin.list.useQuery();
  const utils = trpc.useUtils();
  const deleteMut = trpc.productsAdmin.delete.useMutation({
    onSuccess: () => { utils.productsAdmin.list.invalidate(); toast.success("Product deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const duplicateMut = trpc.productsAdmin.duplicate.useMutation({
    onSuccess: () => { utils.productsAdmin.list.invalidate(); toast.success("Product duplicated"); },
    onError: (e) => toast.error(e.message),
  });
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Physical Products</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Product
        </Button>
      </div>

      {(!products || products.length === 0) ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No physical products yet.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Your First Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {products.map((p) => (
            <Card key={p.id} className="hover:border-teal-500/50 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                {p.thumbnailUrl ? (
                  <img src={p.thumbnailUrl} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{p.title}</span>
                    <StatusBadge status={p.status} />
                    {p.checkoutMode !== "native" && (
                      <Badge variant="outline" className="text-xs text-teal-600 border-teal-300">
                        {p.checkoutMode === "shopify" ? "Shopify" : "External"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {p.isFree ? "Free" : `$${Number(p.price).toFixed(2)}`}
                    {p.compareAtPrice ? <span className="line-through ml-1 text-xs">${Number(p.compareAtPrice).toFixed(2)}</span> : null}
                    {" · "}/products/{p.slug}
                    {" · "}{p.orderCount} orders
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(p.id)} title="Edit">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="Duplicate"
                    onClick={() => duplicateMut.mutate({ id: p.id })} disabled={duplicateMut.isPending}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" title="Delete"
                    onClick={() => { if (confirm("Delete this product?")) deleteMut.mutate({ id: p.id }); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateProductDialog open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={(id) => { setShowCreate(false); onEdit(id); }} />
    </div>
  );
}

// ─── Create Product Dialog ────────────────────────────────────────────────────
function CreateProductDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const utils = trpc.useUtils();
  const createMut = trpc.productsAdmin.create.useMutation({
    onSuccess: (data) => { utils.productsAdmin.list.invalidate(); onCreated(data.id); toast.success("Product created"); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Physical Product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Product Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ultrasound Reference Card Set" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!title.trim() || createMut.isPending} onClick={() => createMut.mutate({ title: title.trim() })}>
            {createMut.isPending ? "Creating..." : "Create Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pricing Options Manager ──────────────────────────────────────────────────
function PricingOptionsManager({ productId }: { productId: number }) {
  const { data, isLoading } = trpc.productsAdmin.get.useQuery({ id: productId });
  const utils = trpc.useUtils();
  const addMut = trpc.productsAdmin.addPricingOption.useMutation({
    onSuccess: () => { utils.productsAdmin.get.invalidate({ id: productId }); toast.success("Pricing option added"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.productsAdmin.updatePricingOption.useMutation({
    onSuccess: () => { utils.productsAdmin.get.invalidate({ id: productId }); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.productsAdmin.deletePricingOption.useMutation({
    onSuccess: () => { utils.productsAdmin.get.invalidate({ id: productId }); toast.success("Removed"); },
  });

  const [newLabel, setNewLabel] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCompare, setNewCompare] = useState("");
  const [newCta, setNewCta] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const opts = data?.pricingOptions ?? [];

  const handleAdd = () => {
    if (!newLabel.trim()) { toast.error("Label is required"); return; }
    addMut.mutate({
      productId,
      label: newLabel.trim(),
      price: parseFloat(newPrice || "0"),
      compareAtPrice: newCompare ? parseFloat(newCompare) : undefined,
      ctaLabel: newCta.trim() || undefined,
    });
    setNewLabel(""); setNewPrice(""); setNewCompare(""); setNewCta(""); setShowAdd(false);
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-teal-600" /> Pricing Options</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4 mr-1" /> Add Option
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Label *</Label>
                <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Standard Pack" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Price ($)</Label>
                <Input type="number" min={0} step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="29.99" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Compare-at Price ($)</Label>
                <Input type="number" min={0} step="0.01" value={newCompare} onChange={e => setNewCompare(e.target.value)} placeholder="49.99 (crossed out)" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">CTA Button Text</Label>
                <Input value={newCta} onChange={e => setNewCta(e.target.value)} placeholder="Buy Now" className="mt-1 h-8 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={addMut.isPending}>{addMut.isPending ? "Adding..." : "Add"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {opts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            No pricing options yet. The product's default price will be used at checkout.
          </p>
        ) : (
          <div className="space-y-2">
            {opts.map((opt) => (
              <div key={opt.id} className="flex items-center gap-3 p-2 rounded border bg-background">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{opt.label}</span>
                    <Switch checked={opt.isActive} onCheckedChange={(v) => updateMut.mutate({ id: opt.id, isActive: v })} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ${Number(opt.price).toFixed(2)}
                    {opt.compareAtPrice ? <span className="line-through ml-1">${Number(opt.compareAtPrice).toFixed(2)}</span> : null}
                    {opt.ctaLabel ? ` · CTA: ${opt.ctaLabel}` : ""}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                  if (confirm("Remove this pricing option?")) deleteMut.mutate({ id: opt.id });
                }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────
function OrdersTab({ productId }: { productId: number }) {
  const { data, isLoading } = trpc.productsAdmin.listOrders.useQuery({ productId });
  const utils = trpc.useUtils();
  const updateMut = trpc.productsAdmin.updateOrder.useMutation({
    onSuccess: () => { utils.productsAdmin.listOrders.invalidate({ productId }); toast.success("Order updated"); },
    onError: (e) => toast.error(e.message),
  });

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700",
    shipped: "bg-teal-100 text-teal-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-600",
    refunded: "bg-red-100 text-red-600",
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading orders...</div>;
  const orders = data?.orders ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{data?.total ?? 0} orders</span>
      </div>
      {orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No orders yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map(({ order, product: prod, user }) => (
            <Card key={order.id}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{user?.name ?? user?.email ?? `User #${order.userId}`}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.fulfillmentStatus] ?? ""}`}>
                        {order.fulfillmentStatus}
                      </span>
                      <span className="text-xs text-muted-foreground">${Number(order.amountPaid).toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(order.orderedAt).toLocaleDateString()} · {user?.email}
                    </div>
                    {(order.shippingName || order.shippingLine1) && (
                      <div className="text-xs text-muted-foreground mt-1 bg-muted/30 rounded p-1.5">
                        <Truck className="w-3 h-3 inline mr-1" />
                        {[order.shippingName, order.shippingLine1, order.shippingLine2, order.shippingCity, order.shippingState, order.shippingPostalCode, order.shippingCountry].filter(Boolean).join(", ")}
                      </div>
                    )}
                    {order.trackingNumber && (
                      <div className="text-xs text-teal-600 mt-1">
                        Tracking: {order.trackingCarrier} {order.trackingNumber}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <select
                      className="border rounded px-1.5 py-0.5 text-xs bg-background"
                      value={order.fulfillmentStatus}
                      onChange={(e) => updateMut.mutate({ id: order.id, fulfillmentStatus: e.target.value as any })}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>
                {/* Tracking input */}
                <div className="mt-2 flex gap-2">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="Tracking number..."
                    defaultValue={order.trackingNumber ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (order.trackingNumber ?? "")) {
                        updateMut.mutate({ id: order.id, trackingNumber: e.target.value || null });
                      }
                    }}
                  />
                  <Input
                    className="h-7 text-xs w-28"
                    placeholder="Carrier (UPS, USPS...)"
                    defaultValue={order.trackingCarrier ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (order.trackingCarrier ?? "")) {
                        updateMut.mutate({ id: order.id, trackingCarrier: e.target.value || null });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ productId }: { productId: number }) {
  const { data } = trpc.productsAdmin.getAnalytics.useQuery({ productId });
  if (!data) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-teal-600">{data.totalOrders}</div>
            <div className="text-sm text-muted-foreground">Total Orders</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-teal-600">${(data.totalRevenue / 100).toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total Revenue</div>
          </CardContent>
        </Card>
      </div>
      {data.byStatus.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Orders by Status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.byStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{s.status}</span>
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Grant Access Dialog ──────────────────────────────────────────────────────
function GrantAccessDialog({ open, productId, onClose }: { open: boolean; productId: number; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [searchResult, setSearchResult] = useState<{ id: number; name: string | null; email: string | null } | null | undefined>(undefined);
  const utils = trpc.useUtils();
  const findUser = trpc.platformAdmin.findUserByEmail.useMutation({
    onSuccess: (data) => setSearchResult(data as any ?? null),
    onError: () => setSearchResult(null),
  });
  const grantMut = trpc.productsAdmin.grantAccess.useMutation({
    onSuccess: () => {
      toast.success("Access granted");
      utils.productsAdmin.listOrders.invalidate({ productId });
      setEmail(""); setName(""); setSearchResult(undefined); onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-teal-600" /> Grant Product Access</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>User Email</Label>
            <div className="flex gap-2">
              <Input type="email" placeholder="user@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setSearchResult(undefined); }} />
              <Button size="sm" variant="outline" onClick={() => findUser.mutate({ email: email.trim() })} disabled={findUser.isPending}>
                {findUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </div>
          {searchResult === null && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">User not found.</p>
          )}
          {searchResult && (
            <div className="bg-teal-50 border border-teal-200 rounded p-2">
              <p className="text-sm text-teal-800 font-medium">Found: {searchResult.name ?? searchResult.email}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!searchResult || grantMut.isPending}
            onClick={() => searchResult && grantMut.mutate({ productId, userId: searchResult.id })}>
            {grantMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
            Grant Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Editor ───────────────────────────────────────────────────────────
function ProductEditor({ productId, onBack }: { productId: number; onBack: () => void }) {
  const { data, isLoading } = trpc.productsAdmin.get.useQuery({ id: productId });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const updateMut = trpc.productsAdmin.update.useMutation({
    onSuccess: () => { utils.productsAdmin.get.invalidate({ id: productId }); utils.productsAdmin.list.invalidate(); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });
  const aiGenerateLandingPage = trpc.productsAdmin.aiGenerateLandingPage.useMutation({
    onSuccess: () => {
      toast.success("Landing page generated! Opening builder...");
      setTimeout(() => navigate(`/admin/products/${productId}/landing-builder`), 600);
    },
    onError: (e) => toast.error(`AI error: ${e.message}`),
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const initialized = useRef(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  if (!data) return <div className="text-center py-8 text-muted-foreground">Product not found</div>;
  const { product } = data;

  if (!initialized.current && product) {
    initialized.current = true;
    setForm({
      title: product.title,
      subtitle: product.subtitle ?? "",
      description: product.description ?? "",
      details: product.details ?? "",
      price: Number(product.price).toFixed(2),
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice).toFixed(2) : "",
      isFree: product.isFree,
      currency: product.currency,
      checkoutMode: product.checkoutMode,
      shopifyProductUrl: product.shopifyProductUrl ?? "",
      shopifyEmbedCode: product.shopifyEmbedCode ?? "",
      shopifyProductId: product.shopifyProductId ?? "",
      externalCheckoutUrl: product.externalCheckoutUrl ?? "",
      requiresShipping: product.requiresShipping,
      status: product.status,
      thumbnailUrl: product.thumbnailUrl ?? "",
      slug: product.slug,
      metaTitle: product.metaTitle ?? "",
      metaDescription: product.metaDescription ?? "",
      publishDomain: (product as any).publishDomain ?? "",
    });
  }

  const handleSave = () => {
    updateMut.mutate({
      id: productId,
      title: form.title,
      subtitle: form.subtitle || null,
      description: form.description || null,
      details: form.details || null,
      price: parseFloat(form.price || "0"),
      compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : null,
      isFree: form.isFree,
      currency: form.currency || "usd",
      checkoutMode: form.checkoutMode,
      shopifyProductUrl: form.shopifyProductUrl || null,
      shopifyEmbedCode: form.shopifyEmbedCode || null,
      shopifyProductId: form.shopifyProductId || null,
      externalCheckoutUrl: form.externalCheckoutUrl || null,
      requiresShipping: form.requiresShipping,
      status: form.status,
      thumbnailUrl: form.thumbnailUrl || null,
      slug: form.slug || product.slug,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
      publishDomain: form.publishDomain || null,
    });
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) { toast.error("Image must be under 10 MB"); return; }
    e.target.value = "";
    setUploadingThumbnail(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-course-image", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Upload failed"); }
      const { url } = await res.json();
      setForm((prev: any) => ({ ...prev, thumbnailUrl: url }));
      toast.success("Thumbnail uploaded");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingThumbnail(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h3 className="text-lg font-semibold flex-1 truncate">{product.title}</h3>
        <StatusBadge status={product.status} />
      </div>

      {/* Top Save Button */}
      <div className="flex justify-end pb-2 border-b border-gray-100">
        <Button onClick={handleSave} disabled={updateMut.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
          {updateMut.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="text-xs"
          onClick={() => navigate(`/admin/products/${productId}/landing-builder`)}>
          <LinkIcon className="w-3 h-3 mr-1" /> Edit Sales Page
        </Button>
        {product.slug && (
          <a href={`/product/${product.slug}?preview=admin`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="text-xs text-gray-500 hover:text-teal-600">
              <Eye className="w-3 h-3 mr-1" /> Preview Sales Page
            </Button>
          </a>
        )}
        <Button size="sm" variant="outline" className="text-xs text-teal-600 border-teal-300 hover:bg-teal-50"
          onClick={() => setShowGrantDialog(true)}>
          <UserPlus className="w-3 h-3 mr-1" /> Grant Access
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="details" className="text-xs"><Settings className="w-3 h-3 mr-1" />Details</TabsTrigger>
          <TabsTrigger value="pricing" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />Pricing</TabsTrigger>
          <TabsTrigger value="checkout" className="text-xs"><ShoppingBag className="w-3 h-3 mr-1" />Checkout</TabsTrigger>
          <TabsTrigger value="landing" className="text-xs"><Globe className="w-3 h-3 mr-1" />Sales Page</TabsTrigger>
          <TabsTrigger value="orders" className="text-xs"><Truck className="w-3 h-3 mr-1" />Orders</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs"><BarChart2 className="w-3 h-3 mr-1" />Analytics</TabsTrigger>
        </TabsList>

        {/* ── Details Tab ── */}
        <TabsContent value="details" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Product Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Subtitle / Tagline</Label>
                <Input value={form.subtitle ?? ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Short tagline" className="mt-1" />
              </div>
              <div>
                <Label>Description (Rich Text)</Label>
                <div className="mt-1">
                  <RichTextEditor
                    value={form.description ?? ""}
                    onChange={(html) => setForm({ ...form, description: html })}
                    placeholder="Detailed product description..."
                    minHeight={140}
                  />
                </div>
              </div>
              <div>
                <Label>Product Details / Specifications (Rich Text)</Label>
                <div className="mt-1">
                  <RichTextEditor
                    value={form.details ?? ""}
                    onChange={(html) => setForm({ ...form, details: html })}
                    placeholder="Dimensions, materials, contents, care instructions..."
                    minHeight={100}
                  />
                </div>
              </div>
              <div>
                <Label>Thumbnail / Product Image</Label>
                <div className="flex items-start gap-3 mt-1">
                  {form.thumbnailUrl ? (
                    <img src={form.thumbnailUrl} alt="" className="w-24 h-24 rounded object-cover border" />
                  ) : (
                    <div className="w-24 h-24 rounded border-2 border-dashed flex items-center justify-center bg-muted/30">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input ref={thumbnailInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleThumbnailUpload} />
                    <Button size="sm" variant="outline" onClick={() => thumbnailInputRef.current?.click()} disabled={uploadingThumbnail}>
                      <Upload className="w-3 h-3 mr-1" /> {uploadingThumbnail ? "Uploading..." : "Upload Image"}
                    </Button>
                    <Input className="text-xs h-7" value={form.thumbnailUrl ?? ""} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="Or paste image URL..." />
                    {form.thumbnailUrl && (
                      <button className="text-xs text-destructive hover:underline self-start" onClick={() => setForm({ ...form, thumbnailUrl: "" })}>Remove</button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label>Status</Label>
                <select className="border rounded px-2 py-1 text-sm bg-background" value={form.status ?? "draft"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="hidden">Hidden (URL only)</option>
                  <option value="private">Private</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* URL & SEO */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4 text-teal-600" /> URL &amp; SEO</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">URL Slug</Label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/products/</span>
                  <Input value={form.slug ?? ""} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") })} placeholder="product-url-slug" className="flex-1" />
                </div>
              </div>
              <div>
                <Label className="text-sm">Meta Title (SEO)</Label>
                <Input value={form.metaTitle ?? ""} onChange={e => setForm({ ...form, metaTitle: e.target.value })} placeholder="Leave blank to use product title" className="mt-1" maxLength={255} />
              </div>
              <div>
                <Label className="text-sm">Meta Description (SEO)</Label>
                <Textarea value={form.metaDescription ?? ""} onChange={e => setForm({ ...form, metaDescription: e.target.value })} placeholder="Brief description for search engines" className="mt-1 resize-none h-20" maxLength={500} />
              </div>
              <div>
                <Label className="text-sm">Publish Domain Override</Label>
                <PublishDomainSelect
                  value={form.publishDomain ?? ""}
                  onChange={v => setForm({ ...form, publishDomain: v })}
                />
                <p className="text-xs text-muted-foreground mt-1">Override the default publish domain for this product only.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pricing Tab ── */}
        <TabsContent value="pricing" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Default Price</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <Label>Price ($)</Label>
                  <Input type="number" min={0} step="0.01" value={form.price ?? "0.00"} onChange={(e) => setForm({ ...form, price: e.target.value })} disabled={form.isFree} placeholder="29.99" className="mt-1" />
                </div>
                <div>
                  <Label>Compare-at Price ($)</Label>
                  <Input type="number" min={0} step="0.01" value={form.compareAtPrice ?? ""} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} placeholder="49.99 (shown crossed out)" className="mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isFree ?? false} onCheckedChange={(v) => setForm({ ...form, isFree: v, price: v ? "0.00" : form.price })} />
                <Label className="cursor-pointer">Free product</Label>
              </div>
              <div>
                <Label>Currency</Label>
                <select className="border rounded px-2 py-1 text-sm bg-background mt-1" value={form.currency ?? "usd"} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="usd">USD ($)</option>
                  <option value="cad">CAD (CA$)</option>
                  <option value="aud">AUD (A$)</option>
                  <option value="gbp">GBP (£)</option>
                  <option value="eur">EUR (€)</option>
                </select>
              </div>
            </CardContent>
          </Card>
          <PricingOptionsManager productId={productId} />
        </TabsContent>

        {/* ── Checkout Tab ── */}
        <TabsContent value="checkout" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Checkout Mode</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {[
                  { value: "native", label: "Native Checkout", desc: "Stripe checkout hosted on this platform. Shipping address is always collected." },
                  { value: "shopify", label: "Shopify", desc: "Redirect to a Shopify product URL or embed a Shopify Buy Button." },
                  { value: "external", label: "External URL", desc: "Redirect to any external checkout URL (e.g. Gumroad, Etsy, WooCommerce)." },
                ].map((opt) => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.checkoutMode === opt.value ? "border-teal-500 bg-teal-50/50" : "border-border hover:border-teal-300"}`}>
                    <input type="radio" name="checkoutMode" value={opt.value} checked={form.checkoutMode === opt.value} onChange={() => setForm({ ...form, checkoutMode: opt.value })} className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {form.checkoutMode === "native" && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.requiresShipping ?? true} onCheckedChange={(v) => setForm({ ...form, requiresShipping: v })} />
                    <Label>Requires shipping address</Label>
                    <span className="text-xs text-muted-foreground">(always on for physical products)</span>
                  </div>
                  <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-2">
                    <strong>Shipping address is required</strong> for all native physical product checkouts. Customers will be prompted to enter their shipping address during Stripe checkout.
                  </p>
                </div>
              )}

              {form.checkoutMode === "shopify" && (
                <div className="space-y-4 pt-2 border-t">
                  <div>
                    <Label>Shopify Product URL</Label>
                    <Input value={form.shopifyProductUrl ?? ""} onChange={(e) => setForm({ ...form, shopifyProductUrl: e.target.value })} placeholder="https://yourstore.myshopify.com/products/..." className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">Paste the full Shopify product URL. Customers will be redirected here to complete purchase.</p>
                  </div>
                  <div>
                    <Label>Shopify Product ID</Label>
                    <Input value={form.shopifyProductId ?? ""} onChange={(e) => setForm({ ...form, shopifyProductId: e.target.value })} placeholder="e.g. 7891234567890" className="mt-1" />
                  </div>
                  <div>
                    <Label>Shopify Buy Button Embed Code</Label>
                    <Textarea
                      value={form.shopifyEmbedCode ?? ""}
                      onChange={(e) => setForm({ ...form, shopifyEmbedCode: e.target.value })}
                      placeholder="Paste your Shopify Buy Button embed code here..."
                      className="mt-1 font-mono text-xs resize-y"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      In Shopify Admin → Sales channels → Buy Button, generate a Buy Button and paste the embed code here. It will be rendered on the product sales page.
                    </p>
                  </div>
                </div>
              )}

              {form.checkoutMode === "external" && (
                <div className="pt-2 border-t">
                  <Label>External Checkout URL</Label>
                  <Input value={form.externalCheckoutUrl ?? ""} onChange={(e) => setForm({ ...form, externalCheckoutUrl: e.target.value })} placeholder="https://..." className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Customers will be redirected to this URL to complete their purchase.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sales Page Tab ── */}
        <TabsContent value="landing" className="mt-4 space-y-3">
          {/* Info banner */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
            <LayoutTemplate className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-teal-800">Sales Page Builder</p>
              <p className="text-xs text-teal-600 mt-0.5">Design your product sales page with blocks, images, pricing sections, and more.</p>
            </div>
          </div>
          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => navigate(`/admin/products/${productId}/landing-builder`)}
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:bg-teal-50 transition-colors text-left"
            >
              <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <LayoutTemplate className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Open Full Builder</p>
                <p className="text-xs text-gray-500">Edit blocks, layout, pricing, CTAs</p>
              </div>
            </button>
            {product.slug && (
              <a href={`/product/${product.slug}?preview=admin`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Preview Sales Page</p>
                  <p className="text-xs text-gray-500">See how it looks to visitors</p>
                </div>
              </a>
            )}
          </div>
          {/* AI Generate */}
          <div className="bg-white border border-teal-200 rounded-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">AI Generate Sales Page</p>
                <p className="text-xs text-gray-500 mt-0.5">The AI will read your product title, description, and pricing to generate a complete block-based sales page — hero, features, testimonials, FAQ, and CTA.</p>
              </div>
            </div>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2 w-full"
              disabled={aiGenerateLandingPage.isPending}
              onClick={() => aiGenerateLandingPage.mutate({ productId })}
            >
              {aiGenerateLandingPage.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating sales page...</>
                : <><Sparkles className="w-4 h-4" /> Generate Sales Page with AI</>}
            </Button>
            {aiGenerateLandingPage.isPending && (
              <p className="text-xs text-teal-500 text-center mt-2">This may take 15–30 seconds while the AI builds your page...</p>
            )}
          </div>
        </TabsContent>

        {/* ── Orders Tab ── */}
        <TabsContent value="orders" className="mt-4">
          <OrdersTab productId={productId} />
        </TabsContent>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab productId={productId} />
        </TabsContent>
      </Tabs>

      {/* Bottom Save */}
      <div className="flex justify-between gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onBack}>Back to Products</Button>
        <Button onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <GrantAccessDialog open={showGrantDialog} productId={productId} onClose={() => setShowGrantDialog(false)} />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function PhysicalProductsAdmin({ initialEditId }: { initialEditId?: number } = {}) {
  const [editingId, setEditingId] = useState<number | null>(initialEditId ?? null);

  if (editingId) {
    return <ProductEditor productId={editingId} onBack={() => setEditingId(null)} />;
  }

  return <ProductList onEdit={setEditingId} />;
}
