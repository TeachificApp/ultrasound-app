/**
 * BundlesAdmin.tsx — Admin CRUD for multi-type bundles (courses, downloads, products, webinars, quizzes)
 */
import { useState, useMemo } from "react";
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
import { Plus, Pencil, Trash2, Package, ArrowLeft, Check, GripVertical, BookOpen, Download, ShoppingBag, Radio, HelpCircle, X, Users, DollarSign, Eye, Workflow } from "lucide-react";
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

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const bundles = data?.bundles ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Bundles</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Bundle
        </Button>
      </div>

      {bundles.length === 0 ? (
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [accessType, setAccessType] = useState<"free" | "paid">("paid");
  const [pricingOptions, setPricingOptions] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form when data loads
  if (data && !initialized) {
    setTitle(data.bundle.title);
    setDescription(data.bundle.description ?? "");
    setStatus(data.bundle.status as "draft" | "published");
    setAccessType(data.bundle.accessType as "free" | "paid");
    setPricingOptions(data.bundle.pricingOptions ?? "");
    setCoverImage(data.bundle.coverImage ?? "");
    setInitialized(true);
  }

  if (isLoading || !data) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const { bundle, items } = data;

  const handleSave = () => {
    updateMut.mutate({
      id: bundleId,
      title,
      description: description || undefined,
      status,
      accessType,
      pricingOptions: pricingOptions || undefined,
      coverImage: coverImage || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h3 className="text-lg font-semibold flex-1 truncate">{bundle.title}</h3>
        <a href={`/admin/bundles/${bundleId}/landing-builder`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-teal-600 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Landing Page Builder
        </a>
        <Button onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="w-5 h-5 mx-auto mb-1 text-teal-600" />
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-xs text-muted-foreground">Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-blue-600" />
            <p className="text-2xl font-bold">{enrollmentData?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">Enrollments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="w-5 h-5 mx-auto mb-1 text-purple-600" />
            <Badge variant={status === "published" ? "default" : "secondary"} className="text-xs">{status}</Badge>
            <p className="text-xs text-muted-foreground mt-1">{accessType}</p>
          </CardContent>
        </Card>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bundle Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What's included in this bundle..." />
          </div>
          <div>
            <Label>Cover Image URL</Label>
            <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." />
            {coverImage && <img src={coverImage} className="mt-2 w-32 h-20 object-cover rounded-lg" alt="Cover" />}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Access Type</Label>
              <Select value={accessType} onValueChange={(v) => setAccessType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {accessType === "paid" && (
            <div>
              <Label>Pricing Options (JSON)</Label>
              <Textarea
                value={pricingOptions}
                onChange={(e) => setPricingOptions(e.target.value)}
                rows={4}
                placeholder='[{"id":"one-time","label":"One-Time Purchase","price":99.99,"type":"one_time"}]'
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">JSON array of pricing options. Each needs: id, label, price, type (one_time/subscription).</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bundle Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Bundle Items ({items.length})</CardTitle>
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
              {items.map((item) => {
                const Icon = ITEM_TYPE_ICONS[item.itemType] ?? Package;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${ITEM_TYPE_COLORS[item.itemType] ?? "bg-gray-100 text-gray-700"}`}>
                      <Icon className="w-3 h-3 inline mr-1" />
                      {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
                    </div>
                    <span className="flex-1 text-sm font-medium truncate">ID: {item.itemId}</span>
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

      {/* Enrollments */}
      {enrollmentData && enrollmentData.enrollments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Enrollments ({enrollmentData.total})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
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
          </CardContent>
        </Card>
      )}

      {/* After Purchase Workflow */}
      <BundleAfterPurchaseSection bundleId={bundleId} />

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
