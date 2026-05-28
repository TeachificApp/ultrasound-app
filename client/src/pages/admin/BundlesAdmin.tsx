/**
 * BundlesAdmin.tsx — Admin CRUD for digital product bundles
 */
import { useState } from "react";
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
import { Plus, Pencil, Trash2, Package, ArrowLeft, Check, Link as LinkIcon, UserPlus, Loader2, Users } from "lucide-react";
import { BundleSalesTab } from "@/components/ProductSalesTab";

function BundleList({ onEdit }: { onEdit: (id: number) => void }) {
  const { data: bundles, isLoading } = trpc.downloadsAdmin.listBundles.useQuery();
  const utils = trpc.useUtils();
  const deleteMut = trpc.downloadsAdmin.deleteBundle.useMutation({
    onSuccess: () => { utils.downloadsAdmin.listBundles.invalidate(); toast.success("Bundle deleted"); },
  });
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Product Bundles</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Bundle
        </Button>
      </div>

      {(!bundles || bundles.length === 0) ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No bundles yet. Create one to offer discounted product collections.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Your First Bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {bundles.map((b) => (
            <Card key={b.id} className="hover:border-teal-500/50 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{b.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{b.items.length} product{b.items.length !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-medium text-green-600">
                      ${Number(b.discountPrice).toFixed(2)}
                    </span>
                    {b.originalPrice > b.discountPrice && (
                      <span className="text-xs text-muted-foreground line-through">
                        ${Number(b.originalPrice).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={b.status === "published" ? "default" : "secondary"} className="text-xs">
                  {b.status}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(b.id)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                    if (confirm("Delete this bundle?")) deleteMut.mutate({ id: b.id });
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <CreateBundleDialog open={showCreate} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateBundleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const utils = trpc.useUtils();
  const createMut = trpc.downloadsAdmin.createBundle.useMutation({
    onSuccess: () => {
      utils.downloadsAdmin.listBundles.invalidate();
      toast.success("Bundle created");
      onClose();
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
            <Label>Subtitle (optional)</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Save 40% on all resources" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMut.mutate({ title, subtitle: subtitle || undefined })} disabled={!title || createMut.isPending}>
            Create Bundle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BundleEditor({ bundleId, onBack }: { bundleId: number; onBack: () => void }) {
  const { data: bundles } = trpc.downloadsAdmin.listBundles.useQuery();
  const { data: allProducts } = trpc.downloadsAdmin.list.useQuery();
  const utils = trpc.useUtils();
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const updateMut = trpc.downloadsAdmin.updateBundle.useMutation({
    onSuccess: () => { utils.downloadsAdmin.listBundles.invalidate(); toast.success("Bundle updated"); },
    onError: (e) => toast.error(e.message),
  });

  const updateSlugMut = trpc.downloadsAdmin.updateBundleSlug.useMutation({
    onSuccess: () => { utils.downloadsAdmin.listBundles.invalidate(); toast.success("Slug updated"); },
    onError: (e) => toast.error(e.message),
  });

  const bundle = bundles?.find((b) => b.id === bundleId);
  const [title, setTitle] = useState(bundle?.title ?? "");
  const [subtitle, setSubtitle] = useState(bundle?.subtitle ?? "");
  const [description, setDescription] = useState(bundle?.description ?? "");
  const [originalPrice, setOriginalPrice] = useState(Number(bundle?.originalPrice ?? 0).toFixed(2));
  const [discountPrice, setDiscountPrice] = useState(Number(bundle?.discountPrice ?? 0).toFixed(2));
  const [status, setStatus] = useState(bundle?.status ?? "draft");
  const [slug, setSlug] = useState(bundle?.slug ?? "");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>(
    bundle?.items.map((i) => i.productId) ?? []
  );

  if (!bundle) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const handleSave = () => {
    updateMut.mutate({
      id: bundleId,
      title,
      subtitle: subtitle || null,
      description: description || null,
      originalPrice: parseFloat(originalPrice || "0"),
      discountPrice: parseFloat(discountPrice || "0"),
      status,
      productIds: selectedProductIds,
    });
  };

  const toggleProduct = (productId: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const savings = parseFloat(originalPrice || "0") - parseFloat(discountPrice || "0");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h3 className="text-lg font-semibold flex-1">Edit Bundle</h3>
        <Button variant="outline" size="sm" className="text-teal-600 border-teal-300 hover:bg-teal-50" onClick={() => setShowGrantDialog(true)}>
          <UserPlus className="w-4 h-4 mr-1" /> Grant Access
        </Button>
        <Button onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
      <GrantBundleAccessDialog open={showGrantDialog} bundleId={bundleId} onClose={() => setShowGrantDialog(false)} />

      {/* Sales & Access */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-teal-600" /> Sales &amp; Access</CardTitle></CardHeader>
        <CardContent>
          <BundleSalesTab bundleId={bundleId} />
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bundle Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Published</Label>
              <Switch
                checked={status === "published"}
                onCheckedChange={(v) => setStatus(v ? "published" : "draft")}
              />
            </div>
            <Badge variant={status === "published" ? "default" : "secondary"}>{status}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Original Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">Total value if bought separately</p>
            </div>
            <div>
              <Label>Bundle Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">Discounted bundle price</p>
            </div>
          </div>
          {savings > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700 font-medium">
                Customers save ${savings.toFixed(2)} ({((savings / parseFloat(originalPrice || "1")) * 100).toFixed(0)}% off)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* URL Slug */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><LinkIcon className="w-4 h-4 text-teal-600" /> URL Slug</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">/bundles/</span>
            <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))} placeholder="bundle-slug" className="flex-1" />
          </div>
          <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only. Changing this will break existing links.</p>
          <Button size="sm" variant="outline" className="border-teal-300 text-teal-600 hover:bg-teal-50"
            disabled={updateSlugMut.isPending || !slug.trim()}
            onClick={() => updateSlugMut.mutate({ bundleId, slug: slug.trim() })}
          >
            {updateSlugMut.isPending ? "Saving..." : "Save Slug"}
          </Button>
        </CardContent>
      </Card>

      {/* Products in Bundle */}
      <Card>
        <CardHeader><CardTitle className="text-base">Products in Bundle ({selectedProductIds.length})</CardTitle></CardHeader>
        <CardContent>
          {(!allProducts || allProducts.length === 0) ? (
            <p className="text-sm text-muted-foreground">No products available. Create some products first.</p>
          ) : (
            <div className="space-y-2">
              {allProducts.map((p) => {
                const isSelected = selectedProductIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => toggleProduct(p.id)}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      isSelected ? "bg-teal-500 border-teal-500" : "border-gray-300"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.isFree ? "Free" : `$${Number(p.price).toFixed(2)}`} · {p.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BundlesAdmin() {
  const [editingId, setEditingId] = useState<number | null>(null);
  if (editingId) {
    return <BundleEditor bundleId={editingId} onBack={() => setEditingId(null)} />;
  }
  return <BundleList onEdit={setEditingId} />;
}

// ─── Grant Bundle Access Dialog ──────────────────────────────────────────────
function GrantBundleAccessDialog({ open, bundleId, onClose }: { open: boolean; bundleId: number; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [searchResult, setSearchResult] = useState<{ id: number; name: string | null; email: string | null } | null | undefined>(undefined);
  const findUser = trpc.platformAdmin.findUserByEmail.useMutation({
    onSuccess: (data) => setSearchResult(data as any ?? null),
    onError: () => setSearchResult(null),
  });
  const grantAccess = trpc.downloadsAdmin.createAndGrantBundleAccess.useMutation({
    onSuccess: (data) => {
      if (data.alreadyGranted) {
        toast.info("This user already has access to this bundle.");
      } else {
        toast.success(data.isNewUser ? "New account created and bundle access granted! Invitation email sent." : "Bundle access granted and notification email sent.");
      }
      setEmail(""); setName(""); setSearchResult(undefined); onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const handleSearch = () => {
    if (!email.trim() || !email.includes("@")) { toast.error("Enter a valid email"); return; }
    findUser.mutate({ email: email.trim() });
  };
  const handleGrant = () => {
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (searchResult === null && !name.trim()) { toast.error("Name is required for new accounts"); return; }
    const resolvedName = (searchResult?.name ?? name.trim()) || email.split("@")[0];
    grantAccess.mutate({ bundleId, email: email.trim(), name: resolvedName });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-teal-600" /> Grant Bundle Access</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Student Email</Label>
            <div className="flex gap-2">
              <Input type="email" placeholder="student@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setSearchResult(undefined); }} />
              <Button size="sm" variant="outline" onClick={handleSearch} disabled={findUser.isPending}>
                {findUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </div>
          {searchResult === null && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
              <p className="text-sm text-amber-800 font-medium">No account found. A new account will be created.</p>
              <div className="space-y-1">
                <Label>Full Name (for new account)</Label>
                <Input placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
          )}
          {searchResult && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
              <p className="text-sm text-teal-800 font-medium">Found: {searchResult.name ?? searchResult.email}</p>
              <p className="text-xs text-teal-600">{searchResult.email}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGrant} disabled={grantAccess.isPending || searchResult === undefined}>
            {grantAccess.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
            {searchResult === null ? "Create & Grant Access" : "Grant Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
