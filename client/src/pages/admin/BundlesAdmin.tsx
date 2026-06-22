/**
 * BundlesAdmin.tsx — Admin CRUD for multi-type bundles (courses, downloads, products, webinars, quizzes)
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, ArrowLeft, Check, GripVertical, BookOpen, Download, ShoppingBag, Radio, HelpCircle, X, Users, DollarSign, Eye, EyeOff, Edit2, Link2, Workflow, Search, Copy, ExternalLink, BarChart2, Settings, RefreshCw, CheckCircle2, Code } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublishDomainSelect } from "@/components/PublishDomainSelect";
import CheckoutPageEditor from "@/components/CheckoutPageEditor";
import { AfterPurchaseWorkflowEditor } from "@/components/AfterPurchaseWorkflowEditor";
import { HidePricingOptionsToggle } from "@/components/HidePricingOptionsToggle";

const ITEM_TYPE_ICONS: Record<string, typeof BookOpen> = {
  course: BookOpen,
  download: Download,
  product: ShoppingBag,
  webinar: Radio,
  quiz: HelpCircle,
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  course: "Course",
  download: "Download",
  product: "Product",
  webinar: "Webinar",
  quiz: "Quiz",
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  course: "bg-blue-100 text-blue-700",
  download: "bg-purple-100 text-purple-700",
  product: "bg-orange-100 text-orange-700",
  webinar: "bg-pink-100 text-pink-700",
  quiz: "bg-green-100 text-green-700",
};

function BundleList({ onEdit }: { onEdit: (id: number) => void }) {
  const { data, isLoading } = trpc.bundlesAdmin.list.useQuery({});
  const utils = trpc.useUtils();
  const deleteMut = trpc.bundlesAdmin.delete.useMutation({
    onSuccess: () => { utils.bundlesAdmin.list.invalidate(); toast.success("Bundle deleted"); },
  });
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const allBundles = data?.bundles ?? [];
  const bundles = searchQuery.trim()
    ? allBundles.filter(b => b.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : allBundles;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search bundles..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
        />
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Bundles {searchQuery && <span className="text-sm font-normal text-gray-500">({bundles.length} results)</span>}</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Bundle
        </Button>
      </div>

      {bundles.length === 0 && allBundles.length > 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No bundles match "{searchQuery}"</div>
      ) : bundles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No bundles yet</p>
            <p className="text-sm text-muted-foreground mt-1">Package courses, downloads, products, webinars, and quizzes together and sell them at a special price.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Your First Bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {bundles.map((b) => (
            <Card key={b.id} className="hover:border-teal-500/50 transition-colors cursor-pointer" onClick={() => onEdit(b.id)}>
              <CardContent className="p-4 flex items-center gap-4">
                {b.coverImage ? (
                  <img src={b.coverImage} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-teal-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{b.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.brand === "iheartecho" ? "iHeartEcho" : "All About Ultrasound"}</p>
                </div>
                <Badge variant={b.status === "published" ? "default" : "secondary"} className="text-xs">
                  {b.status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {b.accessType}
                </Badge>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(b.id)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                    if (confirm("Delete this bundle and all its items?")) deleteMut.mutate({ id: b.id });
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <CreateBundleDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); onEdit(id); }} />}
    </div>
  );
}

function CreateBundleDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState<"all_about_ultrasound" | "iheartecho">("all_about_ultrasound");
  const [description, setDescription] = useState("");
  const utils = trpc.useUtils();
  const createMut = trpc.bundlesAdmin.create.useMutation({
    onSuccess: (data) => {
      utils.bundlesAdmin.list.invalidate();
      toast.success("Bundle created");
      onCreated(data.id);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Bundle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Complete Ultrasound Resource Pack" />
          </div>
          <div>
            <Label>Brand</Label>
            <Select value={brand} onValueChange={(v) => setBrand(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_about_ultrasound">All About Ultrasound</SelectItem>
                <SelectItem value="iheartecho">iHeartEcho</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of what's included" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMut.mutate({ title, brand, description: description || undefined })} disabled={!title || createMut.isPending}>
            {createMut.isPending ? "Creating..." : "Create Bundle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BundleEditor({ bundleId, onBack }: { bundleId: number; onBack: () => void }) {
  const { data, isLoading } = trpc.bundlesAdmin.getById.useQuery({ id: bundleId });
  const { data: availableItems } = trpc.bundlesAdmin.listAvailableItems.useQuery();
  const { data: enrollmentData } = trpc.bundlesAdmin.getEnrollments.useQuery({ bundleId });
  const utils = trpc.useUtils();

  const updateMut = trpc.bundlesAdmin.update.useMutation({
    onSuccess: () => { utils.bundlesAdmin.getById.invalidate({ id: bundleId }); utils.bundlesAdmin.list.invalidate(); toast.success("Bundle updated"); },
    onError: (e) => toast.error(e.message),
  });
  const addItemMut = trpc.bundlesAdmin.addItem.useMutation({
    onSuccess: () => { utils.bundlesAdmin.getById.invalidate({ id: bundleId }); toast.success("Item added"); },
    onError: (e) => toast.error(e.message),
  });
  const removeItemMut = trpc.bundlesAdmin.removeItem.useMutation({
    onSuccess: () => { utils.bundlesAdmin.getById.invalidate({ id: bundleId }); toast.success("Item removed"); },
    onError: (e) => toast.error(e.message),
  });

  const [activeTab, setActiveTab] = useState("settings");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [accessType, setAccessType] = useState<"free" | "paid">("paid");
  const [pricingOptions, setPricingOptions] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [slug, setSlug] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [publishDomain, setPublishDomain] = useState("");
  const [brand, setBrand] = useState("all_about_ultrasound");
  const [collectShippingAddress, setCollectShippingAddress] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form when data loads
  if (data && !initialized) {
    setTitle(data.bundle.title);
    setSubtitle((data.bundle as any).subtitle ?? "");
    setDescription(data.bundle.description ?? "");
    setStatus(data.bundle.status as "draft" | "published");
    setAccessType(data.bundle.accessType as "free" | "paid");
    setPricingOptions(data.bundle.pricingOptions ?? "");
    setCoverImage(data.bundle.coverImage ?? "");
    setSlug((data.bundle as any).slug ?? "");
    setMetaTitle((data.bundle as any).metaTitle ?? "");
    setMetaDescription((data.bundle as any).metaDescription ?? "");
    setPublishDomain((data.bundle as any).publishDomain ?? "");
    setBrand((data.bundle as any).brand ?? "all_about_ultrasound");
    setCollectShippingAddress((data.bundle as any).collectShippingAddress ?? false);
    setInitialized(true);
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) { toast.error("Image must be under 10 MB"); return; }
    e.target.value = "";
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-course-image", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Upload failed"); }
      const { url } = await res.json();
      setCoverImage(url);
      toast.success("Cover image uploaded");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingCover(false);
    }
  };

  if (isLoading || !data) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const { bundle, items } = data;

  const handleSave = () => {
    updateMut.mutate({
      id: bundleId,
      title,
      subtitle: subtitle || undefined,
      description: description || undefined,
      status,
      accessType,
      pricingOptions: pricingOptions || undefined,
      coverImage: coverImage || undefined,
      slug: slug || undefined,
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
      publishDomain: publishDomain || undefined,
      brand: brand || undefined,
      collectShippingAddress,
    });
  };

  const checkoutUrl = `${window.location.origin}/checkout/${bundle.slug}?type=bundle`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{bundle.title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={status === "published" ? "default" : "secondary"} className="text-xs">{status}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{accessType}</Badge>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-xs font-mono font-semibold text-gray-600 select-all cursor-text" title="Bundle ID">ID: {bundle.id}</span>
        {bundle.slug && (
          <a href={`/bundles/${bundle.slug}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="text-xs text-gray-500 hover:text-teal-600 gap-1">
              <Eye className="w-3.5 h-3.5" /> View Sales Page
            </Button>
          </a>
        )}
        <Button size="sm" variant="outline" className="text-xs gap-1"
          onClick={() => { navigator.clipboard.writeText(checkoutUrl); toast.success("Checkout link copied"); }}>
          <Copy className="w-3.5 h-3.5" /> Copy Checkout Link
        </Button>
        <a href={`/admin/bundles/${bundleId}/landing-builder`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-teal-600 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" /> Landing Builder
        </a>
        <Button size="sm" onClick={handleSave} disabled={updateMut.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
          {updateMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Saving...</> : "Save Changes"}
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-500 shrink-0" />
            <div><p className="text-xs text-gray-500">Items</p><p className="text-lg font-bold text-gray-800">{items.length}</p></div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500 shrink-0" />
            <div><p className="text-xs text-gray-500">Enrollments</p><p className="text-lg font-bold text-gray-800">{enrollmentData?.total ?? 0}</p></div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-500 shrink-0" />
            <div><p className="text-xs text-gray-500">Status</p><p className="text-sm font-semibold text-gray-800 capitalize">{status}</p></div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="settings" className="text-xs"><Settings className="w-3.5 h-3.5 mr-1" />Settings</TabsTrigger>
          <TabsTrigger value="items" className="text-xs"><Package className="w-3.5 h-3.5 mr-1" />Items</TabsTrigger>
          <TabsTrigger value="enrollments" className="text-xs"><Users className="w-3.5 h-3.5 mr-1" />Enrollments</TabsTrigger>
          <TabsTrigger value="after-purchase" className="text-xs"><Workflow className="w-3.5 h-3.5 mr-1" />After Purchase</TabsTrigger>
          <TabsTrigger value="checkout-page" className="text-xs"><DollarSign className="w-3.5 h-3.5 mr-1" />Checkout Page</TabsTrigger>
          <TabsTrigger value="widget" className="text-xs"><Code className="w-3.5 h-3.5 mr-1" />Widget Code</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4 pt-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Basic Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Subtitle <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="mt-1" placeholder="Short tagline shown below the title" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1" placeholder="What's included in this bundle..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Brand</Label>
                  <select className="mt-1 border rounded px-2 py-2 text-sm bg-background w-full" value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option value="all_about_ultrasound">All About Ultrasound</option>
                    <option value="iheartecho">iHeartEcho</option>
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Access Type</Label>
                <Select value={accessType} onValueChange={(v) => setAccessType(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {accessType === "paid" && (
                <BundlePricingOptionsEditor bundleId={bundleId} bundleSlug={bundle.slug} />
              )}
              {/* Shipping address collection */}
              <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 bg-gray-50">
                <Switch
                  id="collect-shipping"
                  checked={collectShippingAddress}
                  onCheckedChange={setCollectShippingAddress}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="collect-shipping" className="text-sm font-medium cursor-pointer">
                    Collect shipping address at checkout
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enable when this bundle includes a physical product (e.g. workbook, USB drive). Stripe will prompt the buyer for a shipping address.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Cover Image</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                {coverImage && <img src={coverImage} alt="Cover" className="w-24 h-16 object-cover rounded border border-gray-200" />}
                <div className="flex flex-col gap-2 flex-1">
                  <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCoverUpload} />
                  <Button type="button" size="sm" variant="outline" onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}>
                    {uploadingCover ? <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Uploading...</> : "Upload Image"}
                  </Button>
                  <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="Or paste image URL" className="text-xs" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">URL &amp; SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>URL Slug</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-400">/bundles/</span>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className="flex-1 font-mono text-sm" placeholder="my-bundle" />
                </div>
              </div>
              <div>
                <Label>Meta Title <span className="text-gray-400 font-normal">(SEO)</span></Label>
                <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="mt-1" placeholder={title} />
              </div>
              <div>
                <Label>Meta Description <span className="text-gray-400 font-normal">(SEO)</span></Label>
                <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className="mt-1" placeholder="Brief description for search engines" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Domain</CardTitle></CardHeader>
            <CardContent>
              <PublishDomainSelect value={publishDomain} onChange={(v) => setPublishDomain(v ?? "")} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="pt-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Bundle Items ({items.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No items yet. Add courses, downloads, products, webinars, or quizzes.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item: any) => {
                    const Icon = ITEM_TYPE_ICONS[item.itemType] ?? Package;
                    const displayName = item.itemTitle || `${ITEM_TYPE_LABELS[item.itemType] ?? item.itemType} #${item.itemId}`;
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                        {/* Cover thumbnail */}
                        {item.itemCoverImage ? (
                          <img src={item.itemCoverImage} alt={displayName} className="w-10 h-10 rounded object-cover flex-shrink-0 border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{displayName}</p>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${ITEM_TYPE_COLORS[item.itemType] ?? "bg-gray-100 text-gray-700"}`}>
                            <Icon className="w-3 h-3" />
                            {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => removeItemMut.mutate({ itemId: item.id })}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enrollments Tab */}
        <TabsContent value="enrollments" className="pt-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Enrollments ({enrollmentData?.total ?? 0})</CardTitle></CardHeader>
            <CardContent>
              {!enrollmentData || enrollmentData.enrollments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No enrollments yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {enrollmentData.enrollments.map((enr) => (
                    <div key={enr.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{enr.userName ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{enr.userEmail}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{new Date(enr.enrolledAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* After Purchase Tab */}
        <TabsContent value="after-purchase" className="pt-2">
          <BundleAfterPurchaseSection bundleId={bundleId} />
        </TabsContent>

        {/* Checkout Page Tab */}
        <TabsContent value="checkout-page" className="pt-2">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Checkout Page Editor</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Customise the sections shown on the hosted checkout page at{" "}
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
                    /checkout/{bundle.slug}
                  </a>.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  <ExternalLink className="w-3.5 h-3.5" /> Preview
                </a>
                <a href={`/admin/bundles/${bundleId}/landing-builder`}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                  Open Page Editor
                </a>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {["Trust Seals & Badges","What You'll Learn","Money-Back Guarantee","Testimonials","FAQ","Custom HTML"].map(s => (
                <div key={s} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="w-2 h-2 rounded-full bg-teal-400" />
                  <span className="text-xs text-gray-600">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Widget Code Tab */}
        <TabsContent value="widget" className="pt-2">
          <IncludedItemsWidgetCodePanel source="bundle" id={bundle.id} title={bundle.title} />
        </TabsContent>
      </Tabs>

      {/* Add Item Dialog */}
      {showAddItem && (
        <AddItemDialog
          open={showAddItem}
          onClose={() => setShowAddItem(false)}
          bundleId={bundleId}
          existingItems={items}
          availableItems={availableItems}
          onAdd={(itemType, itemId) => addItemMut.mutate({ bundleId, itemType: itemType as any, itemId })}
        />
      )}
    </div>
  );
}

// ─── After Purchase Section ───────────────────────────────────────────────────────────────────
function BundleAfterPurchaseSection({ bundleId }: { bundleId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.bundlesAdmin.getAfterPurchaseWorkflow.useQuery({ bundleId });
  const saveMut = trpc.bundlesAdmin.updateAfterPurchaseWorkflow.useMutation({
    onSuccess: () => { utils.bundlesAdmin.getAfterPurchaseWorkflow.invalidate({ bundleId }); toast.success("After purchase workflow saved"); },
    onError: (e) => toast.error(e.message),
  });
  const { data: hideData } = trpc.bundlesAdmin.getHidePricingOptions.useQuery({ bundleId });
  const hideToggleMut = trpc.bundlesAdmin.updateHidePricingOptions.useMutation({
    onSuccess: () => { utils.bundlesAdmin.getHidePricingOptions.invalidate({ bundleId }); toast.success("Setting saved"); },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Workflow className="w-4 h-4 text-teal-600" /> After Purchase Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Configure what happens immediately after a customer purchases this bundle.</p>
        <HidePricingOptionsToggle
          value={hideData?.hidePricingOptions ?? false}
          onChange={(v) => hideToggleMut.mutate({ bundleId, hidePricingOptions: v })}
          isSaving={hideToggleMut.isPending}
        />
        <AfterPurchaseWorkflowEditor
          value={data?.afterPurchaseWorkflow ?? null}
          onChange={(workflow) => saveMut.mutate({ bundleId, workflow })}
          isSaving={saveMut.isPending}
        />
      </CardContent>
    </Card>
  );
}

function AddItemDialog({
  open, onClose, bundleId, existingItems, availableItems, onAdd
}: {
  open: boolean;
  onClose: () => void;
  bundleId: number;
  existingItems: Array<{ itemType: string; itemId: number }>;
  availableItems: any;
  onAdd: (itemType: string, itemId: number) => void;
}) {
  const [selectedType, setSelectedType] = useState<string>("course");
  const [search, setSearch] = useState("");

  const itemsForType = useMemo(() => {
    if (!availableItems) return [];
    const map: Record<string, Array<{ id: number; title: string; status?: string }>> = {
      course: availableItems.courses ?? [],
      download: availableItems.downloads ?? [],
      product: availableItems.products ?? [],
      webinar: availableItems.webinars ?? [],
      quiz: availableItems.quizzes ?? [],
    };
    const items = map[selectedType] ?? [];
    // Filter out already-added items
    const existing = new Set(existingItems.filter(e => e.itemType === selectedType).map(e => e.itemId));
    const filtered = items.filter(i => !existing.has(i.id));
    if (search) {
      const q = search.toLowerCase();
      return filtered.filter(i => i.title.toLowerCase().includes(q));
    }
    return filtered;
  }, [availableItems, selectedType, existingItems, search]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Item to Bundle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="flex gap-2">
            {Object.entries(ITEM_TYPE_LABELS).map(([type, label]) => {
              const Icon = ITEM_TYPE_ICONS[type];
              return (
                <Button
                  key={type}
                  size="sm"
                  variant={selectedType === type ? "default" : "outline"}
                  onClick={() => setSelectedType(type)}
                  className="text-xs"
                >
                  <Icon className="w-3 h-3 mr-1" /> {label}
                </Button>
              );
            })}
          </div>
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[300px]">
            {itemsForType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No available {ITEM_TYPE_LABELS[selectedType]}s to add.</p>
            ) : (
              itemsForType.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:border-teal-500 cursor-pointer transition-colors"
                  onClick={() => { onAdd(selectedType, item.id); onClose(); }}
                >
                  <div className={`px-2 py-0.5 rounded text-xs font-medium ${ITEM_TYPE_COLORS[selectedType]}`}>
                    {ITEM_TYPE_LABELS[selectedType]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.status && <p className="text-xs text-muted-foreground">{item.status}</p>}
                  </div>
                  <Plus className="w-4 h-4 text-teal-600" />
                </div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BundlesAdmin({ initialEditId }: { initialEditId?: number } = {}) {
  const [editingId, setEditingId] = useState<number | null>(initialEditId ?? null);
  if (editingId) {
    return <BundleEditor bundleId={editingId} onBack={() => setEditingId(null)} />;
  }
  return <BundleList onEdit={setEditingId} />;
}

// ─── Included Items Widget Code Panel (shared with MembershipsAdmin) ──────────

function IncludedItemsWidgetCodePanel({ source, id, title }: { source: "membership" | "bundle"; id: number; title: string }) {
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [columns, setColumns] = useState("3");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState("#14b8a6");
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Explore");
  const [bgColor, setBgColor] = useState("");
  const [copied, setCopied] = useState<"script" | "iframe" | null>(null);

  const base = window.location.origin;
  const params = new URLSearchParams({
    source,
    id: String(id),
    accent,
    theme,
    layout,
    columns,
    ...(headline ? { headline } : {}),
    ...(subtext ? { subtext } : {}),
    ...(ctaUrl ? { ctaUrl } : {}),
    ...(ctaLabel !== "Explore" ? { ctaLabel } : {}),
    ...(bgColor ? { bg: bgColor } : {}),
  });
  const iframeSrc = `${base}/embed/included-items?${params.toString()}`;

  const scriptSnippet = `<!-- Included Items Widget: ${title} -->
<div data-included-items-embed="${source}:${id}"
     data-accent="${accent}"
     data-theme="${theme}"
     data-layout="${layout}"
     data-columns="${columns}"${headline ? `\n     data-headline="${headline}"` : ""}${subtext ? `\n     data-subtext="${subtext}"` : ""}${ctaUrl ? `\n     data-cta-url="${ctaUrl}"` : ""}${ctaLabel !== "Explore" ? `\n     data-cta-label="${ctaLabel}"` : ""}${bgColor ? `\n     data-bg="${bgColor}"` : ""}
     data-base-url="${base}"></div>
<script src="${base}/embed/included-items.js" async></script>`;

  const iframeSnippet = `<iframe
  src="${iframeSrc}"
  style="width:100%;border:none;display:block;min-height:200px;"
  scrolling="no"
  frameborder="0"
  allowtransparency="true"
></iframe>`;

  function copySnippet(type: "script" | "iframe") {
    navigator.clipboard.writeText(type === "script" ? scriptSnippet : iframeSnippet);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
        <Code className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-teal-800">Embeddable Widget</p>
          <p className="text-xs text-teal-600 mt-0.5">
            Embed the included items for <strong>{title}</strong> on any external website using the snippet below.
            Paste the script tag anywhere in your page's HTML — it auto-sizes to fit its content.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Layout</Label>
          <Select value={layout} onValueChange={(v) => setLayout(v as "grid" | "list")}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">Grid</SelectItem>
              <SelectItem value="list">List</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Columns (grid only)</Label>
          <Select value={columns} onValueChange={setColumns}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Theme</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Accent Color</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
            <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 text-xs font-mono flex-1" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Headline (optional)</Label>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="What's Included" className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Subtext (optional)</Label>
          <Input value={subtext} onChange={(e) => setSubtext(e.target.value)} placeholder="Everything in this bundle" className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">CTA Button URL (optional)</Label>
          <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">CTA Button Label</Label>
          <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Explore" className="h-8 text-xs" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs font-medium text-gray-700">Background Color (optional)</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={bgColor || "#ffffff"} onChange={(e) => setBgColor(e.target.value)}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
            <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} placeholder="transparent / #ffffff" className="h-8 text-xs font-mono flex-1" />
            {bgColor && <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={() => setBgColor("")}>Clear</Button>}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Live Preview</Label>
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            style={{ width: "100%", border: "none", display: "block", minHeight: "200px" }}
            scrolling="no"
            frameBorder="0"
            onLoad={(e) => {
              const iframe = e.currentTarget;
              const handler = (ev: MessageEvent) => {
                if (ev.data?.type === "included-items-resize" && ev.source === iframe.contentWindow) {
                  iframe.style.height = (ev.data.height + 8) + "px";
                  window.removeEventListener("message", handler);
                }
              };
              window.addEventListener("message", handler);
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-gray-700">Script Tag (recommended)</Label>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copySnippet("script")}>
            {copied === "script" ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </Button>
        </div>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{scriptSnippet}</pre>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-gray-700">Raw iframe (for CMS / page builders)</Label>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copySnippet("iframe")}>
            {copied === "iframe" ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </Button>
        </div>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{iframeSnippet}</pre>
      </div>
    </div>
  );
}

// ─── Bundle Pricing Options Editor ────────────────────────────────────────────

type BundlePricingOption = {
  id: number;
  bundleId: number;
  label: string;
  sublabel: string | null;
  pricingType: "one_time" | "subscription" | "payment_plan" | "free";
  price: number;
  stripePriceId: string | null;
  subscriptionInterval: "monthly" | "quarterly" | "annual" | null;
  downPayment: number | null;
  installmentCount: number | null;
  installmentAmount: number | null;
  installmentIntervalDays: number | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  isActive: boolean;
};

function BundlePricingOptionForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<BundlePricingOption>;
  onSave: (data: Omit<BundlePricingOption, "id" | "bundleId" | "sortOrder">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [sublabel, setSublabel] = useState(initial?.sublabel ?? "");
  const [pricingType, setPricingType] = useState<BundlePricingOption["pricingType"]>(initial?.pricingType ?? "one_time");
  const [price, setPrice] = useState(String(Number((initial?.price ?? 0) / 100).toFixed(2)));
  const [stripePriceId, setStripePriceId] = useState(initial?.stripePriceId ?? "");
  const [subscriptionInterval, setSubscriptionInterval] = useState<"monthly" | "quarterly" | "annual">(initial?.subscriptionInterval ?? "monthly");
  const [downPayment, setDownPayment] = useState(String(Number((initial?.downPayment ?? 0) / 100).toFixed(2)));
  const [installmentCount, setInstallmentCount] = useState(String(initial?.installmentCount ?? ""));
  const [installmentAmount, setInstallmentAmount] = useState(String(Number((initial?.installmentAmount ?? 0) / 100).toFixed(2)));
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState(String(initial?.installmentIntervalDays ?? 30));
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(initial?.ctaUrl ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  return (
    <div className="border border-teal-200 rounded-lg p-4 bg-teal-50/30 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium">Label *</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. 3-Month Payment Plan" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium">Sub-label</Label>
          <Input value={sublabel} onChange={e => setSublabel(e.target.value)} placeholder="e.g. 3 × $99/month" className="mt-1 h-8 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium">Pricing Type</Label>
          <Select value={pricingType} onValueChange={v => setPricingType(v as any)}>
            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="one_time">One-Time Purchase</SelectItem>
              <SelectItem value="subscription">Subscription</SelectItem>
              <SelectItem value="payment_plan">Payment Plan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {pricingType !== "free" && pricingType !== "payment_plan" && (
          <div>
            <Label className="text-xs font-medium">Price (USD)</Label>
            <Input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
        )}
        {pricingType === "subscription" && (
          <div>
            <Label className="text-xs font-medium">Billing Interval</Label>
            <Select value={subscriptionInterval} onValueChange={v => setSubscriptionInterval(v as any)}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly (every 3 months)</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {pricingType === "payment_plan" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-medium">Down Payment ($)</Label>
            <Input type="number" step="0.01" min="0" value={downPayment} onChange={e => setDownPayment(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium">Installments</Label>
            <Input type="number" min="0" value={installmentCount} onChange={e => setInstallmentCount(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium">Amount Each ($)</Label>
            <Input type="number" step="0.01" min="0" value={installmentAmount} onChange={e => setInstallmentAmount(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium">Interval (days)</Label>
            <Input type="number" min="1" value={installmentIntervalDays} onChange={e => setInstallmentIntervalDays(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium">CTA Button Label (optional)</Label>
          <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="e.g. Buy Bundle Now" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium">CTA Link URL (optional)</Label>
          <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://..." className="mt-1 h-8 text-sm" />
          <p className="text-xs text-gray-400 mt-0.5">If set, the CTA button links here instead of triggering Stripe checkout.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium">Stripe Price ID (optional)</Label>
          <Input value={stripePriceId} onChange={e => setStripePriceId(e.target.value)} placeholder="price_..." className="mt-1 h-8 text-sm font-mono" />
          <p className="text-xs text-gray-400 mt-0.5">If set, this Stripe Price is used directly at checkout.</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label className="text-xs">Active (visible on landing page)</Label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
            disabled={saving || !label.trim()}
            onClick={() => onSave({
              label: label.trim(),
              sublabel: sublabel.trim() || null,
              pricingType,
              price: pricingType === "free" ? 0 : parseFloat(price || "0"),
              stripePriceId: stripePriceId.trim() || null,
              subscriptionInterval: pricingType === "subscription" ? subscriptionInterval : null,
              downPayment: pricingType === "payment_plan" ? parseFloat(downPayment || "0") : null,
              installmentCount: pricingType === "payment_plan" ? parseInt(installmentCount || "0") : null,
              installmentAmount: pricingType === "payment_plan" ? parseFloat(installmentAmount || "0") : null,
              installmentIntervalDays: pricingType === "payment_plan" ? parseInt(installmentIntervalDays || "30") : null,
              ctaLabel: ctaLabel.trim() || null,
              ctaUrl: ctaUrl.trim() || null,
              isActive,
            })}
          >
            {saving ? "Saving..." : "Save Option"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BundlePricingOptionRow({ opt, editingId, setEditingId, setShowAdd, updateOption, deleteOption, bundleSlug }: {
  opt: BundlePricingOption;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  setShowAdd: (v: boolean) => void;
  updateOption: any;
  deleteOption: any;
  bundleSlug?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opt.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const formatPrice = (o: BundlePricingOption) => {
    if (o.pricingType === "free") return "Free";
    if (o.pricingType === "payment_plan") {
      const dp = Number((o.downPayment ?? 0) / 100).toFixed(2);
      const inst = Number((o.installmentAmount ?? 0) / 100).toFixed(2);
      const n = o.installmentCount ?? 0;
      return `$${dp} down + ${n}×$${inst}`;
    }
    if (o.pricingType === "subscription") {
      return `$${Number(o.price / 100).toFixed(2)}/${o.subscriptionInterval ?? "month"}`;
    }
    return `$${Number(o.price / 100).toFixed(2)}`;
  };

  const copyCheckoutLink = () => {
    if (!bundleSlug) { toast.error("Bundle slug not available"); return; }
    const url = `${window.location.origin}/checkout/${bundleSlug}?type=bundle&option=${opt.id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success("Checkout link copied!"))
      .catch(() => toast.success(`Checkout link: ${url}`));
  };

  if (editingId === opt.id) {
    return (
      <div ref={setNodeRef} style={style}>
        <BundlePricingOptionForm
          initial={opt}
          onSave={(data) => updateOption.mutate({ id: opt.id, ...data })}
          onCancel={() => setEditingId(null)}
          saving={updateOption.isPending}
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 bg-white rounded-lg border px-3 py-2 ${opt.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 flex-shrink-0" title="Drag to reorder">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{opt.label}</p>
        <p className="text-xs text-gray-400">{formatPrice(opt)}{opt.sublabel ? ` · ${opt.sublabel}` : ""}{opt.ctaLabel ? ` · CTA: "${opt.ctaLabel}"` : ""}</p>
      </div>
      <Badge className={`text-xs flex-shrink-0 ${opt.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {opt.isActive ? "Active" : "Hidden"}
      </Badge>
      <button onClick={() => updateOption.mutate({ id: opt.id, isActive: !opt.isActive })} className="text-xs text-gray-400 hover:text-gray-600 p-1 flex-shrink-0" title={opt.isActive ? "Hide" : "Show"}>
        {opt.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button onClick={() => { setEditingId(opt.id); setShowAdd(false); }} className="text-xs text-teal-500 hover:text-teal-700 p-1 flex-shrink-0">
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={copyCheckoutLink} className="text-xs text-teal-500 hover:text-teal-700 p-1 flex-shrink-0" title="Copy hosted checkout link">
        <Link2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => { if (confirm("Delete this pricing option?")) deleteOption.mutate({ id: opt.id }); }} className="text-xs text-red-400 hover:text-red-600 p-1 flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function BundlePricingOptionsEditor({ bundleId, bundleSlug }: { bundleId: number; bundleSlug?: string | null }) {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<number[]>([]);

  const { data: options = [], isLoading } = trpc.bundlesAdmin.listPricingOptions.useQuery({ bundleId });

  useEffect(() => {
    setLocalOrder((options as BundlePricingOption[]).map(o => o.id));
  }, [options]);

  const createOption = trpc.bundlesAdmin.createPricingOption.useMutation({
    onSuccess: () => { toast.success("Pricing option added"); setShowAdd(false); utils.bundlesAdmin.listPricingOptions.invalidate({ bundleId }); },
    onError: e => toast.error(e.message),
  });

  const updateOption = trpc.bundlesAdmin.updatePricingOption.useMutation({
    onSuccess: () => { toast.success("Pricing option updated"); setEditingId(null); utils.bundlesAdmin.listPricingOptions.invalidate({ bundleId }); },
    onError: e => toast.error(e.message),
  });

  const deleteOption = trpc.bundlesAdmin.deletePricingOption.useMutation({
    onSuccess: () => { toast.success("Pricing option removed"); utils.bundlesAdmin.listPricingOptions.invalidate({ bundleId }); },
    onError: e => toast.error(e.message),
  });

  const reorderOptions = trpc.bundlesAdmin.reorderPricingOptions.useMutation({
    onSuccess: () => utils.bundlesAdmin.listPricingOptions.invalidate({ bundleId }),
    onError: e => toast.error(e.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localOrder.indexOf(active.id as number);
    const newIdx = localOrder.indexOf(over.id as number);
    const newOrder = arrayMove(localOrder, oldIdx, newIdx);
    setLocalOrder(newOrder);
    reorderOptions.mutate({ orderedIds: newOrder });
  };

  const sortedOptions = localOrder
    .map(id => (options as BundlePricingOption[]).find(o => o.id === id))
    .filter(Boolean) as BundlePricingOption[];

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-teal-600" /> Pricing Options
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs border-teal-300 text-teal-600 hover:bg-teal-50" onClick={() => { setShowAdd(true); setEditingId(null); }}>
          <Plus className="w-3 h-3 mr-1" /> Add Option
        </Button>
      </div>
      <p className="text-xs text-gray-400">Add payment plans, group rates, or alternate pricing. Drag <GripVertical className="inline w-3 h-3" /> to reorder.</p>

      {isLoading ? (
        <div className="space-y-2">{[0,1].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}</div>
      ) : sortedOptions.length === 0 && !showAdd ? (
        <p className="text-xs text-gray-400 italic py-2">No pricing options yet. Click "Add Option" to create one.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedOptions.map((opt) => (
                <BundlePricingOptionRow
                  key={opt.id}
                  opt={opt}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  setShowAdd={setShowAdd}
                  updateOption={updateOption}
                  deleteOption={deleteOption}
                  bundleSlug={bundleSlug}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showAdd && (
        <BundlePricingOptionForm
          onSave={(data) => createOption.mutate({
            bundleId,
            label: data.label,
            sublabel: data.sublabel ?? undefined,
            pricingType: data.pricingType,
            price: data.price,
            stripePriceId: data.stripePriceId ?? undefined,
            subscriptionInterval: data.subscriptionInterval ?? undefined,
            downPayment: data.downPayment ?? undefined,
            installmentCount: data.installmentCount ?? undefined,
            installmentAmount: data.installmentAmount ?? undefined,
            installmentIntervalDays: data.installmentIntervalDays ?? undefined,
            ctaLabel: data.ctaLabel ?? undefined,
            ctaUrl: data.ctaUrl ?? undefined,
            isActive: data.isActive,
            sortOrder: (options as BundlePricingOption[]).length,
          })}
          onCancel={() => setShowAdd(false)}
          saving={createOption.isPending}
        />
      )}
    </div>
  );
}
