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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Upload, FileIcon, GripVertical, ArrowLeft, ExternalLink, Eye, EyeOff, Image as ImageIcon, Link as LinkIcon, Users, UserPlus, Loader2 } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";

// ─── Product List View ──────────────────────────────────────────────────────
function ProductList({ onEdit }: { onEdit: (id: number) => void }) {
  const { data: products, isLoading } = trpc.downloadsAdmin.list.useQuery();
  const utils = trpc.useUtils();
  const deleteMut = trpc.downloadsAdmin.delete.useMutation({
    onSuccess: () => { utils.downloadsAdmin.list.invalidate(); toast.success("Product deleted"); },
  });
  const duplicateMut = trpc.downloadsAdmin.duplicate.useMutation({
    onSuccess: (data) => { utils.downloadsAdmin.list.invalidate(); toast.success(`Duplicated as "${data.title}"`); },
    onError: e => toast.error(`Error: ${e.message}`),
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
  const updateSettingsMut = trpc.downloadsAdmin.updateDownloadSettings.useMutation({
    onSuccess: () => toast.success("URL & SEO settings saved"),
    onError: (e) => toast.error(e.message),
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
      price: (product.price / 100).toFixed(2),
      isFree: product.isFree,
      bundleOnly: (product as any).bundleOnly ?? false,
      status: product.status,
      thumbnailUrl: product.thumbnailUrl ?? "",
      landingHeadline: product.landingHeadline ?? "",
      landingBody: product.landingBody ?? "",
      landingFeatures: product.landingFeatures ?? "",
    });
    setSlug(product.slug ?? "");
    setMetaTitle((product as any).metaTitle ?? "");
    setMetaDescription((product as any).metaDescription ?? "");
  }

  const handleSave = () => {
    updateMut.mutate({
      id: productId,
      title: form.title,
      subtitle: form.subtitle || null,
      description: form.description || null,
      price: Math.round(parseFloat(form.price || "0") * 100),
      isFree: form.isFree,
      bundleOnly: form.bundleOnly ?? false,
      status: form.status,
      thumbnailUrl: form.thumbnailUrl || null,
      landingHeadline: form.landingHeadline || null,
      landingBody: form.landingBody || null,
      landingFeatures: form.landingFeatures || null,
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h3 className="text-lg font-semibold flex-1">{product.title}</h3>
        <Badge variant={product.status === "published" ? "default" : "outline"}>{product.status}</Badge>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm" variant="outline"
          className="text-xs"
          onClick={() => navigate(`/admin/downloads/${productId}/landing-builder`)}
        >
          <LinkIcon className="w-3 h-3 mr-1" /> Edit Landing Page
        </Button>
        {product.slug && (
          <a href={`/downloads/${product.slug}?preview=admin`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="text-xs text-gray-500 hover:text-teal-600">
              <Eye className="w-3 h-3 mr-1" /> Preview Landing Page
            </Button>
          </a>
        )}
        {product.slug && (
          <a href={`/downloads/${product.slug}/files?preview=student`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="text-xs text-purple-600 border-purple-300 hover:bg-purple-50">
              <Users className="w-3 h-3 mr-1" /> Preview as Student
            </Button>
          </a>
        )}
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
            <Label>Description (Rich Text)</Label>
            <RichTextEditor
              value={form.description ?? ""}
              onChange={(html) => setForm({ ...form, description: html })}
              placeholder="Detailed product description..."
              minHeight={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Price ($)</Label>
              <Input type="number" min={0} step="0.01" value={form.price ?? "0.00"} onChange={(e) => setForm({ ...form, price: e.target.value })} disabled={form.isFree} placeholder="29.99" />
              <p className="text-xs text-muted-foreground mt-1">{form.isFree ? "Free" : `$${parseFloat(form.price || "0").toFixed(2)}`}</p>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.isFree ?? false} onCheckedChange={(v) => setForm({ ...form, isFree: v, price: v ? "0.00" : form.price })} />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Bundle Only</label>
              <Switch checked={(form as any).bundleOnly ?? false} onCheckedChange={(v) => setForm({ ...form, bundleOnly: v } as any)} />
              <span className="text-xs text-muted-foreground">If enabled, this product cannot be purchased standalone</span>
              <Label>Free product</Label>
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
                <div className="flex items-center gap-1">
                  <Input
                    className="text-xs h-7"
                    value={form.thumbnailUrl ?? ""}
                    onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
                    placeholder="Or paste URL..."
                  />
                </div>
                {form.thumbnailUrl && (
                  <button className="text-xs text-destructive hover:underline self-start" onClick={() => setForm({ ...form, thumbnailUrl: "" })}>
                    Remove
                  </button>
                )}
              </div>
            </div>
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
              <option value="hidden">Hidden (URL only)</option>
              <option value="private">Private (invite only)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Landing Page Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Landing Page Content</CardTitle>
            <Button
              size="sm" variant="outline"
              className="text-xs h-7"
              onClick={() => navigate(`/admin/downloads/${productId}/landing-builder`)}
            >
              <LinkIcon className="w-3 h-3 mr-1" /> Open Page Builder
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Headline</Label>
            <Input value={form.landingHeadline ?? ""} onChange={(e) => setForm({ ...form, landingHeadline: e.target.value })} placeholder="Compelling headline for the sales page" />
          </div>
          <div>
            <Label>Body (Rich Text)</Label>
            <RichTextEditor
              value={form.landingBody ?? ""}
              onChange={(html) => setForm({ ...form, landingBody: html })}
              placeholder="Detailed description of what buyers will get..."
              minHeight={150}
            />
          </div>
          <div>
            <Label>Features (one per line)</Label>
            <Textarea value={form.landingFeatures ?? ""} onChange={(e) => setForm({ ...form, landingFeatures: e.target.value })} rows={4} placeholder="Feature 1&#10;Feature 2&#10;Feature 3" />
          </div>
          <p className="text-xs text-muted-foreground">
            For a full drag-and-drop landing page, use the <strong>Page Builder</strong> above. The fields here serve as fallback content when no builder blocks are configured.
          </p>
        </CardContent>
      </Card>

      {/* Files */}
      <FileManager productId={productId} files={product.files} />

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
            <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, and hyphens only. Changing this will break existing links.</p>
          </div>
          <div>
            <Label className="text-sm">Meta Title (SEO)</Label>
            <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder="Leave blank to use product title" className="mt-1" maxLength={255} />
          </div>
          <div>
            <Label className="text-sm">Meta Description (SEO)</Label>
            <Textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} placeholder="Brief description for search engines (150-160 characters)" className="mt-1 resize-none h-20" maxLength={500} />
          </div>
          <Button size="sm" variant="outline" className="border-teal-300 text-teal-600 hover:bg-teal-50"
            disabled={updateSettingsMut.isPending}
            onClick={() => updateSettingsMut.mutate({ productId, slug: slug.trim() || product.slug, metaTitle: metaTitle.trim() || undefined, metaDescription: metaDescription.trim() || undefined })}
          >
            {updateSettingsMut.isPending ? "Saving..." : "Save URL & SEO"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" size="sm" className="text-teal-600 border-teal-300 hover:bg-teal-50" onClick={() => setShowGrantDialog(true)}>
          <UserPlus className="w-4 h-4 mr-1" /> Grant Access to Student
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMut.isPending}>
            {updateMut.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
      <GrantDownloadAccessDialog open={showGrantDialog} productId={productId} onClose={() => setShowGrantDialog(false)} />
    </div>
  );
}

// ─── Grant Download Access Dialog ──────────────────────────────────────────
function GrantDownloadAccessDialog({ open, productId, onClose }: { open: boolean; productId: number; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [searchResult, setSearchResult] = useState<{ id: number; name: string | null; email: string | null } | null | undefined>(undefined);
  const findUser = trpc.platformAdmin.findUserByEmail.useMutation({
    onSuccess: (data) => setSearchResult(data as any ?? null),
    onError: () => setSearchResult(null),
  });
  const grantAccess = trpc.downloadsAdmin.createAndGrantDownloadAccess.useMutation({
    onSuccess: (data) => {
      if (data.alreadyGranted) {
        toast.info("This user already has access to this product.");
      } else {
        toast.success(data.isNewUser ? "New account created and access granted! Invitation email sent." : "Access granted and notification email sent.");
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
    grantAccess.mutate({ productId, email: email.trim(), name: resolvedName });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-teal-600" /> Grant Download Access</DialogTitle></DialogHeader>
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