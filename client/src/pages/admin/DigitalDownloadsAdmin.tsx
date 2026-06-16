import { useState, useRef, useEffect } from "react";
import { UserSearchCombobox, type SelectedUser } from "@/components/UserSearchCombobox";
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
import { toast } from "sonner";
import { PublishDomainSelect } from "@/components/PublishDomainSelect";
import { Plus, Pencil, Trash2, Copy, Upload, FileIcon, GripVertical, ArrowLeft, ExternalLink, Eye, EyeOff, Image as ImageIcon, Link as LinkIcon, Users, UserPlus, Loader2, Sparkles, LayoutTemplate, BarChart3, ShoppingCart, Settings2, FolderOpen, Workflow, Search } from "lucide-react";
import { AfterPurchaseWorkflowEditor } from "@/components/AfterPurchaseWorkflowEditor";
import { HidePricingOptionsToggle } from "@/components/HidePricingOptionsToggle";
import CheckoutPageEditor from "@/components/CheckoutPageEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RichTextEditor from "@/components/RichTextEditor";
import { DownloadSalesTab } from "@/components/ProductSalesTab";
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Sortable Product Row ────────────────────────────────────────────────────
function SortableProductRow({ product, onEdit, onDuplicate, onDelete }: { product: any; onEdit: (id: number) => void; onDuplicate: (id: number) => void; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3 hover:border-teal-300 transition-colors">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none" title="Drag to reorder">
        <GripVertical className="w-4 h-4" />
      </button>
      {product.thumbnailUrl ? (
        <img src={product.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <FileIcon className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{product.title}</p>
        <p className="text-xs text-gray-400">{product.isFree ? "Free" : `$${Number(product.price).toFixed(2)}`} · /{product.slug} · <span className="font-mono">ID: {product.id}</span></p>
      </div>
      <Badge variant={product.status === "published" ? "default" : product.status === "archived" ? "secondary" : "outline"} className="text-xs">
        {product.status}
      </Badge>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600 hover:bg-teal-50" onClick={() => onEdit(product.id)}>
        <Pencil className="w-3 h-3 mr-1" /> Edit
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-500 hover:bg-blue-50" title="Duplicate" onClick={() => onDuplicate(product.id)}>
        <Copy className="w-3 h-3" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50" onClick={() => onDelete(product.id)}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ─── Product List View ──────────────────────────────────────────────────────
function ProductList({ onEdit }: { onEdit: (id: number) => void }) {
  const { data: products, isLoading } = trpc.downloadsAdmin.list.useQuery();
  const utils = trpc.useUtils();
  const [localProducts, setLocalProducts] = useState<any[]>([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const prevDataRef = useRef<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (products && products !== prevDataRef.current) {
      prevDataRef.current = products;
      const sorted = [...products].sort((a: any, b: any) => {
        if (a.libraryOrder !== b.libraryOrder) return (a.libraryOrder ?? 0) - (b.libraryOrder ?? 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setLocalProducts(sorted);
    }
  }, [products]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reorderMut = trpc.downloadsAdmin.reorder.useMutation({
    onSuccess: () => toast.success("Library order saved"),
    onError: e => toast.error(`Failed to save order: ${e.message}`),
  });
  const deleteMut = trpc.downloadsAdmin.delete.useMutation({
    onSuccess: () => { utils.downloadsAdmin.list.invalidate(); toast.success("Product deleted"); },
  });
  const duplicateMut = trpc.downloadsAdmin.duplicate.useMutation({
    onSuccess: (data) => { utils.downloadsAdmin.list.invalidate(); toast.success(`Duplicated as "${data.title}"`); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localProducts.findIndex((p: any) => p.id === active.id);
    const newIndex = localProducts.findIndex((p: any) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(localProducts, oldIndex, newIndex);
    setLocalProducts(reordered);
    reorderMut.mutate({ products: reordered.map((p: any, i: number) => ({ id: p.id, libraryOrder: i + 1 })) });
  };

  const activeProduct = activeDragId ? localProducts.find((p: any) => p.id === activeDragId) : null;
  const filteredProducts = searchQuery.trim()
    ? localProducts.filter((p: any) => p.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : localProducts;

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      {!reorderMode && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search digital products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Digital Products {searchQuery && <span className="text-sm font-normal text-gray-500">({filteredProducts.length} results)</span>}</h3>
        <div className="flex items-center gap-2">
          {localProducts.length > 1 && (
            <Button size="sm" variant={reorderMode ? "default" : "outline"} onClick={() => setReorderMode(m => !m)}>
              <GripVertical className="w-4 h-4 mr-1" />
              {reorderMode ? "Done" : "Reorder"}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Product
          </Button>
        </div>
      </div>

      {filteredProducts.length === 0 && localProducts.length > 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No products match "{searchQuery}"</div>
      ) : localProducts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No digital products yet.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Your First Product
            </Button>
          </CardContent>
        </Card>
      ) : reorderMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={e => setActiveDragId(e.active.id as number)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={localProducts.map((p: any) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {localProducts.map((p: any) => (
                <SortableProductRow key={p.id} product={p} onEdit={onEdit}
                  onDuplicate={id => duplicateMut.mutate({ id })}
                  onDelete={id => { if (confirm("Delete this product and all its files?")) deleteMut.mutate({ id }); }}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeProduct && (
              <div className="flex items-center gap-3 bg-white rounded-lg border-2 border-teal-400 shadow-lg px-4 py-3">
                <GripVertical className="w-4 h-4 text-teal-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{activeProduct.title}</p>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="grid gap-3">
          {filteredProducts.map((p: any) => (
            <Card key={p.id} className="hover:border-teal-500/50 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                {p.thumbnailUrl ? (
                  <img src={p.thumbnailUrl} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <FileIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.title}</span>
                    <Badge variant={p.status === "published" ? "default" : p.status === "archived" ? "secondary" : "outline"} className="text-xs">
                      {p.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {p.isFree ? "Free" : `$${Number(p.price).toFixed(2)}`} · /{p.slug}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(p.id)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="Duplicate" onClick={() => duplicateMut.mutate({ id: p.id })} disabled={duplicateMut.isPending}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                    if (confirm("Delete this product and all its files?")) deleteMut.mutate({ id: p.id });
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateProductDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); onEdit(id); }} />
    </div>
  );
}

// ─── Create Product Dialog ──────────────────────────────────────────────────
function CreateProductDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const utils = trpc.useUtils();
  const createMut = trpc.downloadsAdmin.create.useMutation({
    onSuccess: (data) => { utils.downloadsAdmin.list.invalidate(); onCreated(data.id); toast.success("Product created"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Digital Product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Echo Measurement Cheat Sheet" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!title.trim() || createMut.isPending} onClick={() => createMut.mutate({ title: title.trim() })}>
            {createMut.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Editor ─────────────────────────────────────────────────────────
function ProductEditor({ productId, onBack }: { productId: number; onBack: () => void }) {
  const { data: product, isLoading } = trpc.downloadsAdmin.get.useQuery({ id: productId });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const updateMut = trpc.downloadsAdmin.update.useMutation({
    onSuccess: () => { utils.downloadsAdmin.get.invalidate({ id: productId }); utils.downloadsAdmin.list.invalidate(); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const initialized = useRef(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [slug, setSlug] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [publishDomain, setPublishDomain] = useState("");
  const updateSettingsMut = trpc.downloadsAdmin.updateDownloadSettings.useMutation({
    onSuccess: () => toast.success("URL & SEO settings saved"),
    onError: (e) => toast.error(e.message),
  });
  const aiGenerateLandingPage = trpc.downloadsAdmin.aiGenerateLandingPage.useMutation({
    onSuccess: () => {
      toast.success("Landing page generated! Opening builder...");
      setTimeout(() => navigate(`/admin/downloads/${productId}/landing-builder`), 600);
    },
    onError: (e) => toast.error(`AI error: ${e.message}`),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  if (!product) return <div className="text-center py-8 text-muted-foreground">Product not found</div>;

  // Initialize form from product data
  if (!initialized.current && product) {
    initialized.current = true;
    setForm({
      title: product.title,
      subtitle: product.subtitle ?? "",
      description: product.description ?? "",
      price: Number(product.price).toFixed(2),
      isFree: product.isFree,
      bundleOnly: (product as any).bundleOnly ?? false,
      status: product.status,
      thumbnailUrl: product.thumbnailUrl ?? "",
      showInLibrary: (product as any).showInLibrary ?? true,
      brand: (product as any).brand ?? "aaus",
    } as any);
    setSlug(product.slug ?? "");
    setMetaTitle((product as any).metaTitle ?? "");
    setMetaDescription((product as any).metaDescription ?? "");
    setPublishDomain((product as any).publishDomain ?? "");
  }

  const handleSave = () => {
    updateMut.mutate({
      id: productId,
      title: form.title,
      subtitle: form.subtitle || null,
      description: form.description || null,
      price: parseFloat(form.price || "0"),
      isFree: form.isFree,
      bundleOnly: form.bundleOnly ?? false,
      status: form.status,
      thumbnailUrl: form.thumbnailUrl || null,
      showInLibrary: (form as any).showInLibrary ?? true,
      brand: (form as any).brand ?? "aaus",
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
      <div className="flex items-center gap-3 pb-2 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h3 className="text-lg font-semibold flex-1">{product.title}</h3>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-xs font-mono font-semibold text-gray-600 select-all cursor-text" title="Product ID — use for manual grants & support">ID: {product.id}</span>
        <Badge variant={product.status === "published" ? "default" : "outline"}>{product.status}</Badge>
        {product.slug && (
          <a href={`/downloads/${product.slug}?preview=admin`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="text-xs text-gray-500 hover:text-teal-600">
              <Eye className="w-3 h-3 mr-1" /> Preview
            </Button>
          </a>
        )}
        {product.slug && (
          <Button size="sm" variant="outline" className="text-xs gap-1 text-teal-600 border-teal-300 hover:bg-teal-50"
            onClick={() => {
              const url = `${window.location.origin}/checkout/${product.slug}?type=download`;
              navigator.clipboard.writeText(url);
              toast.success("Checkout link copied");
            }}
          >
            <Copy className="w-3 h-3" /> Copy Checkout Link
          </Button>
        )}
      </div>

      {/* Top Tabs — like Course admin */}
      <Tabs defaultValue="settings">
        <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 h-auto gap-0">
          <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Settings
          </TabsTrigger>
          <TabsTrigger value="landing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" /> Landing Page
          </TabsTrigger>
          <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Files
          </TabsTrigger>
          <TabsTrigger value="students" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Students
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="sales" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Sales
          </TabsTrigger>
          <TabsTrigger value="after-purchase" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <Workflow className="w-3.5 h-3.5 mr-1.5" /> After Purchase
          </TabsTrigger>
          <TabsTrigger value="checkout-page" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Checkout Page
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4 space-y-6">
          {/* General Settings */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Product Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Subtitle</Label>
                <Input value={form.subtitle ?? ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Short tagline" />
              </div>
              <div>
                <Label>Description (Rich Text)</Label>
                <RichTextEditor
                  value={form.description ?? ""}
                  onChange={(html) => setForm({ ...form, description: html })}
                  placeholder="Detailed product description..."
                  minHeight={120}
                />
              </div>
              <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-700">Pricing</h4>
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <Label>Price ($)</Label>
                    <Input type="number" min={0} step="0.01" value={form.price ?? "0.00"} onChange={(e) => setForm({ ...form, price: e.target.value })} disabled={form.isFree} placeholder="29.99" />
                    <p className="text-xs text-muted-foreground mt-1">{form.isFree ? "Free" : `$${parseFloat(form.price || "0").toFixed(2)}`}</p>
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <Switch checked={form.isFree ?? false} onCheckedChange={(v) => setForm({ ...form, isFree: v, price: v ? "0.00" : form.price })} />
                    <Label className="cursor-pointer">Free product</Label>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={(form as any).bundleOnly ?? false} onCheckedChange={(v) => setForm({ ...form, bundleOnly: v } as any)} />
                  <label className="text-sm font-medium">Bundle Only</label>
                  <span className="text-xs text-muted-foreground">Cannot be purchased standalone</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={(form as any).showInLibrary ?? true} onCheckedChange={(v) => setForm({ ...form, showInLibrary: v } as any)} />
                  <div>
                    <label className="text-sm font-medium">Show in Education Library</label>
                    <p className="text-xs text-muted-foreground">Appears in the public Education Library.</p>
                  </div>
                </div>
              </div>
              <div>
                <Label>Thumbnail</Label>
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
                    <Input className="text-xs h-7" value={form.thumbnailUrl ?? ""} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="Or paste URL..." />
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
                  <option value="private">Private (invite only)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <Label>Brand</Label>
                <select className="border rounded px-2 py-1 text-sm bg-background" value={(form as any).brand ?? "aaus"} onChange={(e) => setForm({ ...form, brand: e.target.value } as any)}>
                  <option value="aaus">All About Ultrasound™</option>
                  <option value="iheartecho">iHeartEcho™</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* URL & SEO Settings */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><LinkIcon className="w-4 h-4 text-teal-600" /> URL &amp; SEO Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">URL Slug</Label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/downloads/</span>
                  <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))} placeholder="product-url-slug" className="flex-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, and hyphens only.</p>
              </div>
              <div>
                <Label className="text-sm">Meta Title (SEO)</Label>
                <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder="Leave blank to use product title" className="mt-1" maxLength={255} />
              </div>
              <div>
                <Label className="text-sm">Meta Description (SEO)</Label>
                <Textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} placeholder="Brief description for search engines (150-160 characters)" className="mt-1 resize-none h-20" maxLength={500} />
              </div>
              <div>
                <Label className="text-sm">Publish Domain Override</Label>
                <PublishDomainSelect value={publishDomain} onChange={setPublishDomain} />
                <p className="text-xs text-muted-foreground mt-1">Override the default publish domain for this download only.</p>
              </div>
              <Button size="sm" variant="outline" className="border-teal-300 text-teal-600 hover:bg-teal-50"
                disabled={updateSettingsMut.isPending}
                onClick={() => updateSettingsMut.mutate({ productId, slug: slug.trim() || product.slug, metaTitle: metaTitle.trim() || undefined, metaDescription: metaDescription.trim() || undefined, publishDomain: publishDomain || null })}
              >
                {updateSettingsMut.isPending ? "Saving..." : "Save URL & SEO"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMut.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
              {updateMut.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </TabsContent>

        {/* Landing Page Tab */}
        <TabsContent value="landing" className="mt-4">
          <div className="space-y-3">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
              <LayoutTemplate className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-teal-800">Landing Page Builder</p>
                <p className="text-xs text-teal-600 mt-0.5">Design your product landing page with blocks, images, pricing sections, and more.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => navigate(`/admin/downloads/${productId}/landing-builder`)}
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
                <a href={`/downloads/${product.slug}?preview=admin`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Eye className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Preview Landing Page</p>
                    <p className="text-xs text-gray-500">See how it looks to visitors</p>
                  </div>
                </a>
              )}
            </div>
            <div className="bg-white border border-teal-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">AI Generate Landing Page</p>
                  <p className="text-xs text-gray-500 mt-0.5">The AI will read your product title, description, and pricing to generate a complete block-based landing page.</p>
                </div>
              </div>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white gap-2 w-full"
                disabled={aiGenerateLandingPage.isPending}
                onClick={() => aiGenerateLandingPage.mutate({ productId })}
              >
                {aiGenerateLandingPage.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating landing page...</>
                  : <><Sparkles className="w-4 h-4" /> Generate Landing Page with AI</>}
              </Button>
              {aiGenerateLandingPage.isPending && (
                <p className="text-xs text-teal-500 text-center mt-2">This may take 15–30 seconds while the AI builds your page...</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="mt-4">
          <FileManager productId={productId} files={product.files} />
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-4">
          <DownloadStudentsTab productId={productId} onGrantAccess={() => setShowGrantDialog(true)} />
          <GrantDownloadAccessDialog open={showGrantDialog} productId={productId} onClose={() => setShowGrantDialog(false)} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4">
          <DownloadProductAnalytics productId={productId} productTitle={product.title} />
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" className="text-teal-600 border-teal-300 hover:bg-teal-50" onClick={() => setShowGrantDialog(true)}>
              <UserPlus className="w-4 h-4 mr-1" /> Grant Access to Student
            </Button>
          </div>
          <DownloadSalesTab productId={productId} />
          <GrantDownloadAccessDialog open={showGrantDialog} productId={productId} onClose={() => setShowGrantDialog(false)} />
        </TabsContent>

        {/* After Purchase Tab */}
        <TabsContent value="after-purchase" className="mt-4">
          <AfterPurchaseWorkflowTab productId={productId} />
        </TabsContent>

        <TabsContent value="checkout-page" className="mt-4">
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Checkout Page Editor</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Customise the sections shown on the hosted checkout page{product.slug && (
                      <>{" "}at{" "}
                        <a href={`/checkout/${product.slug}?type=download`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
                          /checkout/{product.slug}
                        </a>
                      </>
                    )}.
                    Use the full-screen editor to add trust seals, testimonials, FAQs, guarantees, and more.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {product.slug && (
                    <a href={`/checkout/${product.slug}?type=download`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Preview
                    </a>
                  )}
                  <a href={`/admin/checkout-editor/download/${productId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Open Page Editor
                  </a>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {["Trust Seals & Badges","Download Includes","Money-Back Guarantee","Testimonials","FAQ","Custom HTML"].map(s => (
                  <div key={s} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-teal-400" />
                    <span className="text-xs text-gray-600">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Grant Download Access Dialog ──────────────────────────────────────────
function GrantDownloadAccessDialog({ open, productId, onClose }: { open: boolean; productId: number; onClose: () => void }) {
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [name, setName] = useState("");
  const grantAccess = trpc.downloadsAdmin.createAndGrantDownloadAccess.useMutation({
    onSuccess: (data) => {
      if (data.alreadyGranted) {
        toast.info("This user already has access to this product.");
      } else {
        toast.success(data.isNewUser ? "New account created and access granted! Invitation email sent." : "Access granted and notification email sent.");
      }
      setSelectedUser(null); setName(""); onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const handleGrant = () => {
    if (!selectedUser) { toast.error("Select a user first"); return; }
    if (selectedUser.isNew && !name.trim()) { toast.error("Name is required for new accounts"); return; }
    const resolvedName = (selectedUser.name ?? name.trim()) || selectedUser.email.split("@")[0];
    grantAccess.mutate({ productId, email: selectedUser.email, name: resolvedName });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelectedUser(null); setName(""); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-teal-600" /> Grant Download Access</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Search Student</Label>
            <UserSearchCombobox onSelect={setSelectedUser} placeholder="Search by name or email…" />
          </div>
          {selectedUser?.isNew && (
            <div className="space-y-1">
              <Label>Full Name (for new account)</Label>
              <Input placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setSelectedUser(null); setName(""); onClose(); }}>Cancel</Button>
          <Button onClick={handleGrant} disabled={grantAccess.isPending || !selectedUser}>
            {grantAccess.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
            {selectedUser?.isNew ? "Create & Grant Access" : "Grant Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── File Manager ───────────────────────────────────────────────────────────
function FileManager({ productId, files }: { productId: number; files: any[] }) {
  const utils = trpc.useUtils();
  const [uploading, setUploading] = useState(false);
  const registerFileMut = trpc.downloadsAdmin.registerUploadedFile.useMutation({
    onSuccess: () => { utils.downloadsAdmin.get.invalidate({ id: productId }); toast.success("File uploaded"); },
    onError: (e) => toast.error(e.message),
  });
  const removeMut = trpc.downloadsAdmin.removeFile.useMutation({
    onSuccess: () => { utils.downloadsAdmin.get.invalidate({ id: productId }); toast.success("File removed"); },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { toast.error("File must be under 200 MB"); return; }
    e.target.value = "";
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-digital-file", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      const { url, fileKey, filename, size, mimeType } = await res.json();
      registerFileMut.mutate({ productId, fileName: filename, fileUrl: url, fileKey, mimeType, fileSize: size });
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Files ({files.length})</CardTitle>
        <div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || registerFileMut.isPending}>
            <Upload className="w-4 h-4 mr-1" /> {(uploading || registerFileMut.isPending) ? "Uploading..." : "Upload File"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No files uploaded yet. Upload files that buyers will receive.</p>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                <FileIcon className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(f.fileSize)} · {f.mimeType ?? "unknown"}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                  if (confirm("Remove this file?")) removeMut.mutate({ fileId: f.id });
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Download Students Tab ──────────────────────────────────────────────────
function DownloadStudentsTab({ productId, onGrantAccess }: { productId: number; onGrantAccess: () => void }) {
  const { data, isLoading } = trpc.productAnalytics.getProductPurchasers.useQuery({ productId, productType: "download" });
  const [, navigate] = useLocation();
  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading students...</div>;
  const purchasers = data?.purchasers ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{purchasers.length} student{purchasers.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-muted-foreground">All users with access to this download</p>
        </div>
        <Button size="sm" variant="outline" className="text-teal-600 border-teal-300 hover:bg-teal-50" onClick={onGrantAccess}>
          <UserPlus className="w-4 h-4 mr-1" /> Grant Access
        </Button>
      </div>
      {purchasers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No students yet</p>
          <p className="text-xs mt-1">Grant access manually or wait for purchases</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Student</th>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchasers.map((p: any) => (
                <tr key={p.transactionId ?? p.userEmail} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="font-medium">{p.userName || p.userEmail || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{p.userEmail}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2.5">{p.amountPaid != null ? `$${(Number(p.amountPaid) / 100).toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-2.5">
                    {p.userId && (
                      <Button size="sm" variant="ghost" className="text-xs text-teal-600 hover:bg-teal-50 h-7" onClick={() => navigate(`/admin/users/${p.userId}`)}>
                        View Profile
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Download Product Analytics ──────────────────────────────────────────────
function DownloadProductAnalytics({ productId, productTitle }: { productId: number; productTitle: string }) {
  const { data, isLoading } = trpc.productAnalytics.getProductPurchasers.useQuery({ productId, productType: "download" });
  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>;
  const purchasers = data?.purchasers ?? [];
  const totalRevenue = purchasers.reduce((sum: number, p: any) => sum + (Number(p.amountPaid) || 0), 0);
  const avgOrder = purchasers.length > 0 ? totalRevenue / purchasers.length : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{purchasers.length}</p><p className="text-xs text-muted-foreground mt-1">Total Buyers</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${Number(totalRevenue).toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">Total Revenue</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{purchasers.length > 0 ? `$${(avgOrder / 100).toFixed(2)}` : '—'}</p><p className="text-xs text-muted-foreground mt-1">Avg. Order</p></CardContent></Card>
      </div>
      {purchasers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Buyers</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Amount</th>
              </tr></thead>
              <tbody>
                {purchasers.slice(0, 10).map((p: any) => (
                  <tr key={p.transactionId ?? p.userEmail} className="border-t">
                    <td className="px-4 py-2.5"><p className="font-medium">{p.userName || p.userEmail || 'Unknown'}</p><p className="text-xs text-muted-foreground">{p.userEmail}</p></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2.5">{p.amountPaid != null ? `$${(Number(p.amountPaid) / 100).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── After Purchase Workflow Tab ────────────────────────────────────────────
function AfterPurchaseWorkflowTab({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.downloadsAdmin.getAfterPurchaseWorkflow.useQuery({ productId });
  const saveMut = trpc.downloadsAdmin.updateAfterPurchaseWorkflow.useMutation({
    onSuccess: () => { utils.downloadsAdmin.getAfterPurchaseWorkflow.invalidate({ productId }); toast.success("After purchase workflow saved"); },
    onError: (e) => toast.error(e.message),
  });
  const { data: hideData } = trpc.downloadsAdmin.getHidePricingOptions.useQuery({ productId });
  const hideToggleMut = trpc.downloadsAdmin.updateHidePricingOptions.useMutation({
    onSuccess: () => { utils.downloadsAdmin.getHidePricingOptions.invalidate({ productId }); toast.success("Setting saved"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
        <Workflow className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-teal-800">After Purchase Workflow</p>
          <p className="text-xs text-teal-600 mt-0.5">Configure what happens immediately after a customer completes their purchase. Actions run in order.</p>
        </div>
      </div>
      <HidePricingOptionsToggle
        value={hideData?.hidePricingOptions ?? false}
        onChange={(v) => hideToggleMut.mutate({ productId, hidePricingOptions: v })}
        isSaving={hideToggleMut.isPending}
      />
      <AfterPurchaseWorkflowEditor
        value={data?.afterPurchaseWorkflow ?? null}
        onChange={(workflow) => saveMut.mutate({ productId, workflow })}
        isSaving={saveMut.isPending}
      />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────────
import DownloadAnalytics from "./DownloadAnalytics";
import BundlesAdmin from "./BundlesAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DigitalDownloadsAdmin({ initialEditId }: { initialEditId?: number } = {}) {
  const [editingId, setEditingId] = useState<number | null>(initialEditId ?? null);
  const [activeTab, setActiveTab] = useState("products");

  if (editingId) {
    return <ProductEditor productId={editingId} onBack={() => setEditingId(null)} />;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="bundles">Bundles</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>
      <TabsContent value="products" className="mt-4">
        <ProductList onEdit={setEditingId} />
      </TabsContent>
      <TabsContent value="bundles" className="mt-4">
        <BundlesAdmin />
      </TabsContent>
      <TabsContent value="analytics" className="mt-4">
        <DownloadAnalytics />
      </TabsContent>
    </Tabs>
  );
}