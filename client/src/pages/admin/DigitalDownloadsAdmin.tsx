import { useState, useRef } from "react";
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
import { Plus, Pencil, Trash2, Upload, FileIcon, GripVertical, ArrowLeft, ExternalLink, Eye, EyeOff } from "lucide-react";

// ─── Product List View ──────────────────────────────────────────────────────
function ProductList({ onEdit }: { onEdit: (id: number) => void }) {
  const { data: products, isLoading } = trpc.downloadsAdmin.list.useQuery();
  const utils = trpc.useUtils();
  const deleteMut = trpc.downloadsAdmin.delete.useMutation({
    onSuccess: () => { utils.downloadsAdmin.list.invalidate(); toast.success("Product deleted"); },
  });
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Digital Products</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Product
        </Button>
      </div>

      {(!products || products.length === 0) ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No digital products yet.</p>
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
                    {p.isFree ? "Free" : `$${(p.price / 100).toFixed(2)}`} · /{p.slug}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(p.id)}>
                    <Pencil className="w-4 h-4" />
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
  const utils = trpc.useUtils();
  const updateMut = trpc.downloadsAdmin.update.useMutation({
    onSuccess: () => { utils.downloadsAdmin.get.invalidate({ id: productId }); utils.downloadsAdmin.list.invalidate(); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const initialized = useRef(false);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  if (!product) return <div className="text-center py-8 text-muted-foreground">Product not found</div>;

  // Initialize form from product data
  if (!initialized.current && product) {
    initialized.current = true;
    setForm({
      title: product.title,
      subtitle: product.subtitle ?? "",
      description: product.description ?? "",
      price: product.price,
      isFree: product.isFree,
      status: product.status,
      thumbnailUrl: product.thumbnailUrl ?? "",
      landingHeadline: product.landingHeadline ?? "",
      landingBody: product.landingBody ?? "",
      landingFeatures: product.landingFeatures ?? "",
    });
  }

  const handleSave = () => {
    updateMut.mutate({
      id: productId,
      title: form.title,
      subtitle: form.subtitle || null,
      description: form.description || null,
      price: form.price,
      isFree: form.isFree,
      status: form.status,
      thumbnailUrl: form.thumbnailUrl || null,
      landingHeadline: form.landingHeadline || null,
      landingBody: form.landingBody || null,
      landingFeatures: form.landingFeatures || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h3 className="text-lg font-semibold flex-1">{product.title}</h3>
        <Badge variant={product.status === "published" ? "default" : "outline"}>{product.status}</Badge>
      </div>

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
            <Label>Description</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Detailed product description..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Price (cents)</Label>
              <Input type="number" min={0} value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })} disabled={form.isFree} />
              <p className="text-xs text-muted-foreground mt-1">{form.isFree ? "Free" : `$${((form.price ?? 0) / 100).toFixed(2)}`}</p>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.isFree ?? false} onCheckedChange={(v) => setForm({ ...form, isFree: v, price: v ? 0 : form.price })} />
              <Label>Free product</Label>
            </div>
          </div>
          <div>
            <Label>Thumbnail URL</Label>
            <Input value={form.thumbnailUrl ?? ""} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="https://..." />
            {form.thumbnailUrl && <img src={form.thumbnailUrl} alt="" className="w-20 h-20 rounded object-cover mt-2" />}
          </div>
          <div className="flex items-center gap-3">
            <Label>Status</Label>
            <select
              className="border rounded px-2 py-1 text-sm bg-background"
              value={form.status ?? "draft"}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Landing Page Content */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Landing Page Content</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Headline</Label>
            <Input value={form.landingHeadline ?? ""} onChange={(e) => setForm({ ...form, landingHeadline: e.target.value })} placeholder="Compelling headline for the sales page" />
          </div>
          <div>
            <Label>Body (Markdown supported)</Label>
            <Textarea value={form.landingBody ?? ""} onChange={(e) => setForm({ ...form, landingBody: e.target.value })} rows={6} placeholder="Detailed description of what buyers will get..." />
          </div>
          <div>
            <Label>Features (one per line)</Label>
            <Textarea value={form.landingFeatures ?? ""} onChange={(e) => setForm({ ...form, landingFeatures: e.target.value })} rows={4} placeholder="Feature 1&#10;Feature 2&#10;Feature 3" />
          </div>
        </CardContent>
      </Card>

      {/* Files */}
      <FileManager productId={productId} files={product.files} />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>Cancel</Button>
        <Button onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ─── File Manager ───────────────────────────────────────────────────────────
function FileManager({ productId, files }: { productId: number; files: any[] }) {
  const utils = trpc.useUtils();
  const uploadMut = trpc.downloadsAdmin.uploadFile.useMutation({
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
    if (file.size > 50 * 1024 * 1024) { toast.error("File must be under 50 MB"); return; }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMut.mutate({
        productId,
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type,
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadMut.isPending}>
            <Upload className="w-4 h-4 mr-1" /> {uploadMut.isPending ? "Uploading..." : "Upload File"}
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

// ─── Main Export ────────────────────────────────────────────────────────────
export default function DigitalDownloadsAdmin() {
  const [editingId, setEditingId] = useState<number | null>(null);

  if (editingId) {
    return <ProductEditor productId={editingId} onBack={() => setEditingId(null)} />;
  }

  return <ProductList onEdit={setEditingId} />;
}
