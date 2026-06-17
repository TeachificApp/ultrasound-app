/**
 * CommunityAdmin.tsx
 * Admin panel for community management: communities, channels, members,
 * moderation, badges, admin profiles, linked access, sort order.
 *
 * Community editing uses an inline tab-based editor (not a dialog):
 *   Settings | Appearance | Access Gating | Page Editor | Landing Page
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Users, Plus, Edit2, Trash2, Flag, CheckCircle, XCircle,
  Hash, Award, Shield, Upload, UserPlus,
  UserMinus, MessageSquare, CheckSquare, X, ExternalLink,
  GripVertical, Link2, Image, UserCircle, ChevronUp, ChevronDown,
  AlertCircle, Lock, PenSquare, LayoutTemplate, Zap, ToggleLeft, ToggleRight,
  Palette, BookOpen, ChevronLeft, Settings, Eye, Globe, Mail
} from "lucide-react";
import CommunityPageEditor from "@/components/CommunityPageEditor";
import { Link } from "wouter";

function timeAgo(dateStr: string | Date) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Image Upload Helper ──────────────────────────────────────────────────────
function ImageUploadField({
  label, value, communityId, imageType, onChange, aspectHint,
}: {
  label: string; value: string; communityId?: number;
  imageType: "cover" | "logo" | "icon" | "banner"; onChange: (url: string) => void;
  aspectHint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadMut = trpc.community.admin.uploadCommunityImage.useMutation({
    onSuccess: (data) => { onChange(data.url); setUploading(false); toast.success("Image uploaded"); },
    onError: (e) => { setUploading(false); toast.error(e.message); },
  });
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !communityId) { toast.error("Save the community first to upload images"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      uploadMut.mutate({ communityId, imageType, dataUri, mimeType: file.type as any });
    };
    reader.readAsDataURL(file);
  }
  const isWide = imageType === "banner" || imageType === "cover";
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}{aspectHint && <span className="text-gray-400 font-normal ml-1">({aspectHint})</span>}</label>
      <div className={`flex items-start gap-3 ${isWide ? "flex-col" : ""}`}>
        {value ? (
          <img src={value} alt={label} className={isWide ? "w-full h-28 rounded-lg object-cover border" : "w-16 h-16 rounded-lg object-cover border"} />
        ) : (
          <div className={`${isWide ? "w-full h-28" : "w-16 h-16"} rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300`}>
            <Image className="w-6 h-6" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || !communityId}>
            <Upload className="w-3.5 h-3.5 mr-1" />{uploading ? "Uploading..." : "Upload"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="text-red-500 text-xs h-7" onClick={() => onChange("")}>
              <X className="w-3 h-3 mr-1" />Remove
            </Button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Admin Profile Avatar Upload ──────────────────────────────────────────────
function AdminProfileAvatarUpload({ profileId, value, onChange }: { profileId?: number; value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = trpc.community.admin.uploadAdminProfileAvatar.useMutation({
    onSuccess: (data) => { onChange(data.url); setUploading(false); toast.success("Avatar uploaded"); },
    onError: (e) => { setUploading(false); toast.error(e.message); },
  });
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profileId) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      upload.mutate({ profileId, base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }
  return (
    <div className="flex items-center gap-3">
      <Avatar className="w-12 h-12">
        <AvatarImage src={value} />
        <AvatarFallback><UserCircle className="w-6 h-6 text-gray-300" /></AvatarFallback>
      </Avatar>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || !profileId}>
          <Upload className="w-3.5 h-3.5 mr-1" />{uploading ? "Uploading..." : "Upload Avatar"}
        </Button>
        {!profileId && <p className="text-xs text-gray-400 mt-1">Save profile first to upload avatar</p>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Access Gating Tab ────────────────────────────────────────────────────────
function AccessGatingTab({ community }: { community: any }) {
  const utils = trpc.useUtils();
  const communityId = community.id;

  // Course linkages (junction table)
  const { data: courseLinkages, isLoading: clLoading } = trpc.community.admin.listCourseLinkages.useQuery({ communityId });
  const { data: allCourses } = trpc.community.admin.listCoursesForLinkedAccess.useQuery();
  const addCourseLinkage = trpc.community.admin.addCourseLinkage.useMutation({
    onSuccess: () => { toast.success("Course linked!"); utils.community.admin.listCourseLinkages.invalidate({ communityId }); },
    onError: (e) => toast.error(e.message),
  });
  const removeCourseLinkage = trpc.community.admin.removeCourseLinkage.useMutation({
    onSuccess: () => { toast.success("Course removed"); utils.community.admin.listCourseLinkages.invalidate({ communityId }); },
    onError: (e) => toast.error(e.message),
  });

  // Product linkages (linkedAccessItems JSON on community)
  const [linkedItems, setLinkedItems] = useState<Array<{ type: string; id: number; title: string }>>(
    (() => { try { return community?.linkedAccessItems ? JSON.parse(community.linkedAccessItems) : []; } catch { return []; } })()
  );
  const [selectedProductType, setSelectedProductType] = useState<string>("quiz");
  const { data: allProducts } = trpc.community.admin.listAllProductsForLinkedAccess.useQuery();
  const updateCommunity = trpc.community.admin.updateCommunity.useMutation({
    onSuccess: () => { toast.success("Product links saved!"); utils.community.admin.listCommunities.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const linkedCourseIds = new Set((courseLinkages ?? []).map((l: any) => l.lmsCourseId));
  const availableCourses = (allCourses ?? []).filter((c: any) => !linkedCourseIds.has(c.id));
  const PRODUCT_TYPE_LABELS: Record<string, string> = {
    quiz: "Quiz", webinar: "Webinar", download: "Download", membership: "Membership",
  };
  const filteredProducts = (allProducts ?? []).filter((p: any) => p.type === selectedProductType && !linkedItems.some(i => i.type === p.type && i.id === p.id));

  function addProduct(productId: number) {
    const product = (allProducts ?? []).find((p: any) => p.type === selectedProductType && p.id === productId);
    if (!product) return;
    const newItems = [...linkedItems, { type: selectedProductType, id: productId, title: product.title }];
    setLinkedItems(newItems);
    updateCommunity.mutate({ id: communityId, linkedAccessItems: JSON.stringify(newItems) });
  }
  function removeProduct(idx: number) {
    const newItems = linkedItems.filter((_, i) => i !== idx);
    setLinkedItems(newItems);
    updateCommunity.mutate({ id: communityId, linkedAccessItems: JSON.stringify(newItems) });
  }

  return (
    <div className="space-y-8">
      {/* Access Type info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-medium text-amber-800">Access Type: <span className="font-bold capitalize">{community.accessType}</span></p>
        <p className="text-xs text-amber-700 mt-1">
          {community.accessType === "course_gated"
            ? "Users must be enrolled in at least one linked course to join this community."
            : community.accessType === "linked"
            ? "Users who purchase any linked product are automatically added as members."
            : "Change the Access Type in Settings to enable course or product gating."}
        </p>
      </div>

      {/* Course Linkages */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-gray-900 flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-600" />Linked Courses</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {community.accessType === "course_gated"
                ? "Users enrolled in any of these courses can join this community."
                : "Link courses to this community. Set Access Type to 'Course Gated' to enforce enrollment."}
            </p>
          </div>
          <Select onValueChange={v => addCourseLinkage.mutate({ communityId, lmsCourseId: parseInt(v) })} disabled={availableCourses.length === 0}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={availableCourses.length === 0 ? "All courses linked" : "Link a course..."} />
            </SelectTrigger>
            <SelectContent>
              {availableCourses.map((c: any) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {clLoading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : !courseLinkages?.length ? (
          <div className="text-center py-8 border-2 border-dashed rounded-xl text-gray-400">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No courses linked yet. Use the dropdown above to link courses.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {courseLinkages.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
                <BookOpen className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-teal-900">{l.courseTitle ?? `Course #${l.lmsCourseId}`}</span>
                {l.courseSlug && <span className="text-xs text-teal-500">/{l.courseSlug}</span>}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                  onClick={() => removeCourseLinkage.mutate({ linkageId: l.id })}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Linkages */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-gray-900 flex items-center gap-2"><Link2 className="w-4 h-4 text-teal-600" />Linked Products</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {community.accessType === "linked"
                ? "Users who purchase any of these products are automatically added as members."
                : "Link products to this community. Set Access Type to 'Linked' to auto-enroll buyers."}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <Select value={selectedProductType} onValueChange={setSelectedProductType}>
            <SelectTrigger className="w-36 flex-shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRODUCT_TYPE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={v => addProduct(parseInt(v))}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={`Add a ${PRODUCT_TYPE_LABELS[selectedProductType]?.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {filteredProducts.map((p: any) => (
                <SelectItem key={`${p.type}-${p.id}`} value={p.id.toString()}>{p.title}</SelectItem>
              ))}
              {filteredProducts.length === 0 && <SelectItem value="__none" disabled>No {PRODUCT_TYPE_LABELS[selectedProductType]?.toLowerCase()}s available</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        {linkedItems.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-xl text-gray-400">
            <Link2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No products linked yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                <Link2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-blue-900">{item.title}</span>
                <Badge variant="secondary" className="text-xs capitalize">{item.type}</Badge>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                  onClick={() => removeProduct(idx)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Appearance Tab ───────────────────────────────────────────────────────────
function AppearanceTab({ community, onSaved }: { community: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    bannerImage: community?.bannerImage ?? "",
    welcomeMessage: community?.welcomeMessage ?? "",
    headerStyle: community?.headerStyle ?? "banner",
    layoutStyle: community?.layoutStyle ?? "sidebar",
    primaryColor: community?.primaryColor ?? "#189aa1",
    secondaryColor: community?.secondaryColor ?? "#4ad9e0",
    backgroundColor: community?.backgroundColor ?? "",
    seoTitle: community?.seoTitle ?? "",
    seoDescription: community?.seoDescription ?? "",
  });
  const utils = trpc.useUtils();
  const update = trpc.community.admin.updateCommunity.useMutation({
    onSuccess: () => { toast.success("Appearance saved!"); onSaved(); utils.community.admin.listCommunities.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Banner Image */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Image className="w-4 h-4 text-teal-600" />Banner Image</h4>
        <ImageUploadField
          label="Wide Header Banner"
          value={form.bannerImage}
          communityId={community?.id}
          imageType="banner"
          aspectHint="recommended 1200×300px"
          onChange={url => setForm(f => ({ ...f, bannerImage: url }))}
        />
      </div>

      {/* Welcome Message */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-teal-600" />Welcome Message</h4>
        <Textarea
          value={form.welcomeMessage}
          onChange={e => setForm(f => ({ ...f, welcomeMessage: e.target.value }))}
          placeholder="Write a welcome message shown to new members when they join..."
          className="min-h-[100px] resize-none"
        />
      </div>

      {/* Layout Options */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><LayoutTemplate className="w-4 h-4 text-teal-600" />Layout & Style</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Header Style</label>
            <Select value={form.headerStyle} onValueChange={v => setForm(f => ({ ...f, headerStyle: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="banner">Banner — full-width image header</SelectItem>
                <SelectItem value="minimal">Minimal — compact header with logo</SelectItem>
                <SelectItem value="none">None — no header image</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Layout Style</label>
            <Select value={form.layoutStyle} onValueChange={v => setForm(f => ({ ...f, layoutStyle: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sidebar">Sidebar — channels + members panel</SelectItem>
                <SelectItem value="full-width">Full Width — no sidebar</SelectItem>
                <SelectItem value="centered">Centered — narrow centered feed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Palette className="w-4 h-4 text-teal-600" />Brand Colors</h4>
        <div className="grid grid-cols-3 gap-4">
          {([
            { key: "primaryColor", label: "Primary Color" },
            { key: "secondaryColor", label: "Secondary Color" },
            { key: "backgroundColor", label: "Background Color" },
          ] as const).map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form[key] || "#ffffff"}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-9 h-9 rounded cursor-pointer border"
                />
                <Input
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="#hex"
                  className="flex-1"
                />
                {form[key] && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400" onClick={() => setForm(f => ({ ...f, [key]: "" }))}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SEO */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-teal-600" />SEO / Meta</h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">SEO Title <span className="text-gray-400 font-normal">(overrides community title in search results)</span></label>
            <Input value={form.seoTitle} onChange={e => setForm(f => ({ ...f, seoTitle: e.target.value }))} placeholder="e.g. Join the Ultrasound Community" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">SEO Description</label>
            <Textarea value={form.seoDescription} onChange={e => setForm(f => ({ ...f, seoDescription: e.target.value }))} placeholder="Brief description for search engines..." className="min-h-[80px] resize-none" />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => update.mutate({ id: community.id, ...form })} disabled={update.isPending}>
          {update.isPending ? "Saving..." : "Save Appearance"}
        </Button>
      </div>
    </div>
  );
}

// ─── Community Settings Tab ───────────────────────────────────────────────────
function CommunitySettingsTab({ community, onSaved }: { community: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: community?.title ?? "",
    slug: community?.slug ?? "",
    description: community?.description ?? "",
    brand: community?.brand ?? "all_about_ultrasound",
    privacy: community?.privacy ?? "public",
    accessType: community?.accessType ?? "free",
    accentColor: community?.accentColor ?? "#189aa1",
    coverImage: community?.coverImage ?? "",
    logoImage: community?.logoImage ?? "",
    iconImage: community?.iconImage ?? "",
    sortOrder: community?.sortOrder ?? 0,
    status: community?.status ?? "draft",
  });
  const utils = trpc.useUtils();
  const update = trpc.community.admin.updateCommunity.useMutation({
    onSuccess: () => { toast.success("Settings saved!"); onSaved(); utils.community.admin.listCommunities.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Title *</label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Community title" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Slug *</label>
          <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="url-slug" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this community about?" className="min-h-[80px] resize-none" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Privacy</label>
          <Select value={form.privacy} onValueChange={v => setForm(f => ({ ...f, privacy: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="invite_only">Invite Only</SelectItem>
              <SelectItem value="course_gated">Course Gated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Access Type</label>
          <Select value={form.accessType} onValueChange={v => setForm(f => ({ ...f, accessType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free — anyone can join</SelectItem>
              <SelectItem value="paid">Paid — requires payment</SelectItem>
              <SelectItem value="restricted">Restricted — admin approval</SelectItem>
              <SelectItem value="invite_only">Invite Only</SelectItem>
              <SelectItem value="linked">Linked — auto-join via product</SelectItem>
              <SelectItem value="course_gated">Course Gated — must be enrolled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Brand</label>
          <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all_about_ultrasound">All About Ultrasound™</SelectItem>
              <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Sort Order</label>
          <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} className="w-full" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Accent Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border" />
          <Input value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="w-36" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <ImageUploadField label="Cover Image" value={form.coverImage} communityId={community?.id} imageType="cover" aspectHint="16:9" onChange={url => setForm(f => ({ ...f, coverImage: url }))} />
        <ImageUploadField label="Logo / Avatar" value={form.logoImage} communityId={community?.id} imageType="logo" aspectHint="square" onChange={url => setForm(f => ({ ...f, logoImage: url }))} />
        <ImageUploadField label="Icon (small)" value={form.iconImage} communityId={community?.id} imageType="icon" aspectHint="square" onChange={url => setForm(f => ({ ...f, iconImage: url }))} />
      </div>
      <div className="pt-2">
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => {
          if (!form.title.trim() || !form.slug.trim()) { toast.error("Title and slug are required"); return; }
          update.mutate({ id: community.id, ...form });
        }} disabled={update.isPending}>
          {update.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Inline Community Editor ──────────────────────────────────────────────────
function CommunityEditor({ community, onBack }: { community: any; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState("settings");
  const utils = trpc.useUtils();

  return (
    <div>
      {/* Editor Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500 hover:text-gray-700 -ml-1">
          <ChevronLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden border">
            {community.iconImage ? (
              <img src={community.iconImage} alt={community.title} className="w-full h-full object-cover" />
            ) : community.logoImage ? (
              <img src={community.logoImage} alt={community.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: community.accentColor || "#189aa1" }}>
                {community.title.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 truncate">{community.title}</h2>
            <div className="flex items-center gap-2">
              <Badge variant={community.status === "published" ? "default" : "secondary"}
                className={`text-xs ${community.status === "published" ? "bg-green-100 text-green-700 border-green-200" : ""}`}>
                {community.status}
              </Badge>
              <span className="text-xs text-gray-400">/{community.slug}</span>
            </div>
          </div>
        </div>
        <Link href={`/community/${community.slug}`}>
          <Button variant="outline" size="sm" className="text-teal-600 border-teal-200 flex-shrink-0">
            <Eye className="w-3.5 h-3.5 mr-1" />View
          </Button>
        </Link>
      </div>

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1.5" />Settings</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="w-3.5 h-3.5 mr-1.5" />Appearance</TabsTrigger>
          <TabsTrigger value="gating"><Lock className="w-3.5 h-3.5 mr-1.5" />Access Gating</TabsTrigger>
          <TabsTrigger value="page-editor"><LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />Page Editor</TabsTrigger>
          <TabsTrigger value="landing-editor"><Globe className="w-3.5 h-3.5 mr-1.5" />Landing Page</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <CommunitySettingsTab community={community} onSaved={() => utils.community.admin.listCommunities.invalidate()} />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceTab community={community} onSaved={() => utils.community.admin.listCommunities.invalidate()} />
        </TabsContent>

        <TabsContent value="gating">
          <AccessGatingTab community={community} />
        </TabsContent>

        <TabsContent value="page-editor">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Community Experience Page Editor</h3>
                <p className="text-sm text-gray-500 mt-0.5">Edit the content blocks shown on the community's main page for members.</p>
              </div>
              <a href={`/admin/communities/${community.id}/experience-builder`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5" />Open Full Editor
              </a>
            </div>
            <CommunityPageEditor communityId={community.id} pageType="page" />
          </div>
        </TabsContent>

        <TabsContent value="landing-editor">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Community Sales Landing Page Editor</h3>
                <p className="text-sm text-gray-500 mt-0.5">Edit the public-facing landing page blocks shown before users join the community.</p>
              </div>
              <a href={`/admin/communities/${community.id}/sales-builder`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5" />Open Full Editor
              </a>
            </div>
            <CommunityPageEditor communityId={community.id} pageType="landing" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Create Community Form (dialog) ──────────────────────────────────────────
function CreateCommunityForm({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const [form, setForm] = useState({
    title: "", slug: "", description: "",
    brand: "all_about_ultrasound", privacy: "public", accessType: "free",
    accentColor: "#189aa1",
  });
  const utils = trpc.useUtils();
  const create = trpc.community.admin.createCommunity.useMutation({
    onSuccess: (data: any) => {
      toast.success("Community created!");
      utils.community.admin.listCommunities.invalidate();
      onSaved(data?.id ?? 0);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Title *</label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Community title" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Slug *</label>
          <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="url-slug" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this community about?" className="min-h-[80px] resize-none" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Privacy</label>
          <Select value={form.privacy} onValueChange={v => setForm(f => ({ ...f, privacy: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="invite_only">Invite Only</SelectItem>
              <SelectItem value="course_gated">Course Gated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Access Type</label>
          <Select value={form.accessType} onValueChange={v => setForm(f => ({ ...f, accessType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="restricted">Restricted</SelectItem>
              <SelectItem value="linked">Linked</SelectItem>
              <SelectItem value="course_gated">Course Gated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Brand</label>
          <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all_about_ultrasound">All About Ultrasound™</SelectItem>
              <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => {
          if (!form.title.trim() || !form.slug.trim()) { toast.error("Title and slug are required"); return; }
          create.mutate(form as any);
        }} disabled={create.isPending}>
          {create.isPending ? "Creating..." : "Create Community"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Channel Form ─────────────────────────────────────────────────────────────
function ChannelForm({ communityId, channel, onClose, onSaved }: { communityId: number; channel?: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: channel?.name ?? "",
    description: channel?.description ?? "",
    type: channel?.type ?? "discussion",
    isDefault: channel?.isDefault ?? false,
  });
  const utils = trpc.useUtils();
  const create = trpc.community.admin.createChannel.useMutation({
    onSuccess: () => { toast.success("Channel created!"); onSaved(); onClose(); utils.community.admin.listChannels.invalidate({ communityId }); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.community.admin.updateChannel.useMutation({
    onSuccess: () => { toast.success("Channel updated!"); onSaved(); onClose(); utils.community.admin.listChannels.invalidate({ communityId }); },
    onError: (e) => toast.error(e.message),
  });
  function handleSubmit() {
    if (!form.name.trim()) { toast.error("Channel name is required"); return; }
    if (channel) update.mutate({ id: channel.id, ...form });
    else create.mutate({ communityId, ...form });
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Channel Name *</label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. general-discussion" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this channel for?" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="discussion">Discussion</SelectItem>
            <SelectItem value="announcements">Announcements</SelectItem>
            <SelectItem value="resources">Resources</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={create.isPending || update.isPending}>
          {channel ? "Save Changes" : "Create Channel"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Admin Profiles Tab ───────────────────────────────────────────────────────
function AdminProfilesTab({ communityId, communitySlug }: { communityId: number; communitySlug: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editProfile, setEditProfile] = useState<any>(null);
  const [form, setForm] = useState({ name: "", bio: "", avatarUrl: "" });
  const utils = trpc.useUtils();
  const { data: profiles, isLoading } = trpc.community.admin.listAdminProfiles.useQuery({ communityId });
  const create = trpc.community.admin.createAdminProfile.useMutation({
    onSuccess: () => { toast.success("Profile created!"); utils.community.admin.listAdminProfiles.invalidate({ communityId }); setShowForm(false); setForm({ name: "", bio: "", avatarUrl: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.community.admin.updateAdminProfile.useMutation({
    onSuccess: () => { toast.success("Profile updated!"); utils.community.admin.listAdminProfiles.invalidate({ communityId }); setShowForm(false); setEditProfile(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.community.admin.deleteAdminProfile.useMutation({
    onSuccess: () => { toast.success("Profile deleted"); utils.community.admin.listAdminProfiles.invalidate({ communityId }); },
    onError: (e) => toast.error(e.message),
  });
  function openEdit(p: any) { setEditProfile(p); setForm({ name: p.name, bio: p.bio ?? "", avatarUrl: p.avatarUrl ?? "" }); setShowForm(true); }
  function handleSubmit() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (editProfile) update.mutate({ id: editProfile.id, ...form });
    else create.mutate({ communityId, ...form });
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Admin Posting Profiles</h3>
          <p className="text-sm text-gray-500 mt-0.5">Create profiles to post as (e.g., "Support", "Admin", "Course Team"). When posting, select a profile to use that identity.</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { setEditProfile(null); setForm({ name: "", bio: "", avatarUrl: "" }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />New Profile
        </Button>
      </div>
      {showForm && (
        <Card className="border-teal-200 bg-teal-50/30">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-medium text-gray-900">{editProfile ? "Edit Profile" : "New Admin Profile"}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Profile Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Support Team" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Bio (optional)</label>
                <Input value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Short description" />
              </div>
            </div>
            {editProfile && (
              <AdminProfileAvatarUpload profileId={editProfile.id} value={form.avatarUrl} onChange={url => setForm(f => ({ ...f, avatarUrl: url }))} />
            )}
            <div className="flex gap-2">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={create.isPending || update.isPending}>
                {editProfile ? "Save Changes" : "Create Profile"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditProfile(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !profiles?.length ? (
        <Card><CardContent className="py-10 text-center text-gray-400">
          <UserCircle className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p>No admin profiles yet.</p>
          <p className="text-sm mt-1">Create profiles to post as different identities (Support, Admin, etc.)</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {profiles.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={p.avatarUrl} />
                  <AvatarFallback className="bg-teal-100 text-teal-700 font-semibold">{p.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  {p.bio && <p className="text-sm text-gray-500 truncate">{p.bio}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/community/${communitySlug}?postAs=${p.id}`}>
                    <Button variant="outline" size="sm" className="text-teal-600 border-teal-200">
                      <PenSquare className="w-3.5 h-3.5 mr-1" />Post As
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600"
                    onClick={() => { if (confirm(`Delete profile "${p.name}"?`)) del.mutate({ id: p.id }); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pending Members Tab ──────────────────────────────────────────────────────
function PendingMembersTab({ communityId }: { communityId: number }) {
  const utils = trpc.useUtils();
  const { data: pending, isLoading } = trpc.community.admin.listPendingMembers.useQuery({ communityId });
  const approve = trpc.community.admin.approveMember.useMutation({
    onSuccess: () => { toast.success("Member approved!"); utils.community.admin.listPendingMembers.invalidate({ communityId }); utils.community.admin.listCommunities.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;
  if (!pending?.length) return (
    <Card><CardContent className="py-10 text-center text-gray-400">
      <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-200" />
      <p>No pending membership requests.</p>
    </CardContent></Card>
  );
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 mb-3">{pending.length} member{pending.length !== 1 ? "s" : ""} awaiting approval</p>
      {pending.map((m: any) => (
        <Card key={m.id}>
          <CardContent className="p-4 flex items-center gap-4">
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarImage src={m.userAvatar} />
              <AvatarFallback className="bg-gray-100 text-gray-600 text-sm font-semibold">{m.userName?.charAt(0) ?? "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{m.userName}</p>
              <p className="text-sm text-gray-500">{m.userEmail}</p>
              <p className="text-xs text-gray-400">Requested {timeAgo(m.joinedAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => approve.mutate({ communityId, userId: m.userId, action: "approve" })}
                disabled={approve.isPending}>
                <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
              </Button>
              <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50"
                onClick={() => approve.mutate({ communityId, userId: m.userId, action: "reject" })}
                disabled={approve.isPending}>
                <XCircle className="w-3.5 h-3.5 mr-1" />Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────
function MembersTab({ communityId }: { communityId: number }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [bulkEmails, setBulkEmails] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.community.admin.listMembers.useQuery({ communityId, search, page, limit: 20 });
  const addMember = trpc.community.admin.addMember.useMutation({
    onSuccess: () => { toast.success("Member added!"); setNewEmail(""); utils.community.admin.listMembers.invalidate({ communityId }); },
    onError: (e) => toast.error(e.message),
  });
  const bulkAdd = trpc.community.admin.bulkAddMembers.useMutation({
    onSuccess: (r: any) => { toast.success(`Added ${r.added} members`); setBulkEmails(""); utils.community.admin.listMembers.invalidate({ communityId }); },
    onError: (e) => toast.error(e.message),
  });
  const removeMember = trpc.community.admin.removeMember.useMutation({
    onSuccess: () => { toast.success("Member removed"); utils.community.admin.listMembers.invalidate({ communityId }); },
    onError: (e) => toast.error(e.message),
  });
  const updateRole = trpc.community.admin.updateMemberRole.useMutation({
    onSuccess: () => { toast.success("Role updated"); utils.community.admin.listMembers.invalidate({ communityId }); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Search members..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
        <Input placeholder="Add by email..." value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-56" />
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => addMember.mutate({ communityId, email: newEmail })} disabled={!newEmail.trim() || addMember.isPending}>
          <UserPlus className="w-4 h-4 mr-1" />Add
        </Button>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Bulk Add (one email per line)</label>
        <div className="flex gap-2">
          <Textarea value={bulkEmails} onChange={e => setBulkEmails(e.target.value)} placeholder={"email1@example.com\nemail2@example.com"} className="min-h-[80px] resize-none flex-1" />
          <Button className="bg-teal-600 hover:bg-teal-700 text-white self-end" onClick={() => bulkAdd.mutate({ communityId, emails: bulkEmails.split("\n").map(e => e.trim()).filter(Boolean) })} disabled={!bulkEmails.trim() || bulkAdd.isPending}>
            <Users className="w-4 h-4 mr-1" />Bulk Add
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : !data?.members?.length ? (
        <Card><CardContent className="py-10 text-center text-gray-400">No members found.</CardContent></Card>
      ) : (
        <>
          <div className="space-y-2">
            {data.members.map((m: any) => (
              <Card key={m.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={m.avatarUrl} />
                    <AvatarFallback className="bg-gray-100 text-gray-600 text-xs font-semibold">{m.name?.charAt(0) ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </div>
                  <Select value={m.role} onValueChange={v => updateRole.mutate({ communityId, userId: m.userId, role: v as any })}>
                    <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant={m.memberStatus === "approved" ? "secondary" : "outline"} className="text-xs">
                    {m.memberStatus}
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-7 w-7 p-0"
                    onClick={() => removeMember.mutate({ communityId, userId: m.userId })}>
                    <UserMinus className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {(data.total ?? 0) > 20 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">{data.total} total members</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= (data.total ?? 0)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sort Order Tab ───────────────────────────────────────────────────────────
function SortOrderTab({ communities, onRefresh }: { communities: any[]; onRefresh: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const utils = trpc.useUtils();
  useEffect(() => { setItems([...communities].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))); }, [communities]);
  const reorder = trpc.community.admin.reorderCommunities.useMutation({
    onSuccess: () => { toast.success("Sort order saved!"); utils.community.admin.listCommunities.invalidate(); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  function moveItem(idx: number, dir: -1 | 1) {
    const newItems = [...items];
    const target = idx + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    setItems(newItems);
  }
  function saveOrder() {
    reorder.mutate({ communities: items.map((c, i) => ({ id: c.id, sortOrder: i })) });
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Community Display Order</h3>
          <p className="text-sm text-gray-500 mt-0.5">Use arrows to reorder communities on the public listing page.</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={saveOrder} disabled={reorder.isPending}>
          <CheckSquare className="w-4 h-4 mr-2" />Save Order
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((c, idx) => (
          <Card key={c.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <GripVertical className="w-5 h-5 text-gray-300 flex-shrink-0" />
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
              <div className="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden border">
                {c.iconImage ? (
                  <img src={c.iconImage} alt={c.title} className="w-full h-full object-cover" />
                ) : c.logoImage ? (
                  <img src={c.logoImage} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: c.accentColor || "#189aa1" }}>
                    {c.title.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{c.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-xs">{c.accessType}</Badge>
                  <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveItem(idx, -1)} disabled={idx === 0}>
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}>
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Workflow Rules Tab ───────────────────────────────────────────────────────
const TRIGGER_LABELS: Record<string, string> = {
  any_signup: "Any new account signup",
  any_purchase: "Any purchase (Stripe checkout)",
  course_enrollment: "Course enrollment",
  webinar_registration: "Webinar registration",
  download_purchase: "Download purchase",
  bundle_purchase: "Bundle purchase",
  brand_membership: "Brand membership activation",
};

function WorkflowRulesTab({ communityId }: { communityId: number }) {
  const utils = trpc.useUtils();
  const { data: rules, isLoading } = trpc.community.admin.listWorkflowRules.useQuery({ communityId });
  const createMutation = trpc.community.admin.createWorkflowRule.useMutation({
    onSuccess: () => { utils.community.admin.listWorkflowRules.invalidate(); toast.success("Rule created"); setShowForm(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.community.admin.updateWorkflowRule.useMutation({
    onSuccess: () => { utils.community.admin.listWorkflowRules.invalidate(); toast.success("Rule updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.community.admin.deleteWorkflowRule.useMutation({
    onSuccess: () => { utils.community.admin.listWorkflowRules.invalidate(); toast.success("Rule deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("any_signup");
  const [entityId, setEntityId] = useState("");

  function resetForm() { setName(""); setTriggerType("any_signup"); setEntityId(""); }

  const needsEntity = ["course_enrollment", "webinar_registration", "download_purchase", "bundle_purchase"].includes(triggerType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Workflow Rules</h3>
          <p className="text-sm text-gray-500 mt-0.5">Automatically add users to this community when a trigger event occurs.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />Add Rule
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : !rules?.length ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No workflow rules yet. Add one to auto-enroll users.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule: any) => (
            <div key={rule.id} className="flex items-center gap-3 p-3 bg-white border rounded-xl shadow-sm">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${rule.isActive ? "bg-teal-50 text-teal-600" : "bg-gray-100 text-gray-400"}`}>
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{rule.name}</div>
                <div className="text-xs text-gray-500">{TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}{rule.entityId ? ` (ID: ${rule.entityId})` : ""}</div>
              </div>
              <button
                onClick={() => updateMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                className="text-gray-400 hover:text-teal-600 transition-colors"
                title={rule.isActive ? "Disable rule" : "Enable rule"}
              >
                {rule.isActive ? <ToggleRight className="w-5 h-5 text-teal-500" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button
                onClick={() => { if (confirm("Delete this rule?")) deleteMutation.mutate({ id: rule.id }); }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
          <h4 className="font-medium text-sm text-gray-900">New Workflow Rule</h4>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Rule Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Auto-join on course purchase" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Trigger Event</label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsEntity && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Entity ID (optional — leave blank to match any)</label>
              <Input value={entityId} onChange={e => setEntityId(e.target.value)} placeholder="e.g. 42" type="number" />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => createMutation.mutate({ communityId, name, triggerType: triggerType as any, entityId: entityId ? parseInt(entityId) : undefined })} disabled={!name || createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Rule"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────
export default function CommunityAdmin() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const [editingCommunity, setEditingCommunity] = useState<any>(null); // null = list view, object = editor view
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeCommunityId, setActiveCommunityId] = useState<number | null>(null);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [editChannel, setEditChannel] = useState<any>(null);
  const [awardBadgeUserId, setAwardBadgeUserId] = useState<number | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: communities, isLoading: commLoading, refetch: refetchCommunities } = trpc.community.admin.listCommunities.useQuery(undefined, { enabled: isAdmin });
  const { data: channels } = trpc.community.admin.listChannels.useQuery(
    { communityId: activeCommunityId! },
    { enabled: !!activeCommunityId && isAdmin }
  );
  const { data: reports } = trpc.community.admin.listReports.useQuery(
    { communityId: activeCommunityId ?? undefined, status: "pending" },
    { enabled: isAdmin && !!activeCommunityId }
  );
  const { data: pendingComments } = trpc.community.admin.listPendingComments.useQuery(
    { communityId: activeCommunityId! },
    { enabled: !!activeCommunityId && isAdmin }
  );
  const { data: badges } = trpc.community.admin.listBadges.useQuery(undefined, { enabled: isAdmin });

  const activeCommunity = communities?.find((c: any) => c.id === activeCommunityId);

  const deleteCommunity = trpc.community.admin.deleteCommunity.useMutation({
    onSuccess: () => { toast.success("Community deleted"); utils.community.admin.listCommunities.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteChannel = trpc.community.admin.deleteChannel.useMutation({
    onSuccess: () => { toast.success("Channel deleted"); utils.community.admin.listChannels.invalidate({ communityId: activeCommunityId! }); },
    onError: (e) => toast.error(e.message),
  });
  const resolveReport = trpc.community.admin.resolveReport.useMutation({
    onSuccess: () => {
      toast.success("Report resolved");
      utils.community.admin.listReports.invalidate({ communityId: activeCommunityId ?? undefined, status: "pending" });
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: dmConversations, refetch: refetchDms } = trpc.community.admin.listDMConversations.useQuery(
    { limit: 30 },
    { enabled: isAdmin }
  );
  const [oversightConvId, setOversightConvId] = useState<number | null>(null);
  const { data: oversightMessages } = trpc.community.admin.getDMMessagesAdmin.useQuery(
    { conversationId: oversightConvId! },
    { enabled: isAdmin && !!oversightConvId }
  );
  const moderateComment = trpc.community.admin.moderateComment.useMutation({
    onSuccess: () => { toast.success("Comment moderated"); utils.community.admin.listPendingComments.invalidate({ communityId: activeCommunityId! }); },
    onError: (e) => toast.error(e.message),
  });
  const awardBadge = trpc.community.admin.awardBadge.useMutation({
    onSuccess: () => { toast.success("Badge awarded!"); setAwardBadgeUserId(null); setSelectedBadgeId(null); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (communities?.length && !activeCommunityId) setActiveCommunityId(communities[0].id);
  }, [communities]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Shield className="w-8 h-8 mr-2" />Admin access required
      </div>
    );
  }

  const pendingReportCount = reports?.filter((r: any) => r.status === "pending").length ?? 0;
  const pendingCommentCount = pendingComments?.length ?? 0;
  const totalModerationCount = pendingReportCount + pendingCommentCount;
  const totalPendingMembers = communities?.reduce((sum: number, c: any) => sum + (c.pendingCount ?? 0), 0) ?? 0;

  const CommunitySelector = () => (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <Select value={activeCommunityId?.toString() ?? ""} onValueChange={v => setActiveCommunityId(parseInt(v))}>
        <SelectTrigger className="w-64"><SelectValue placeholder="Select community" /></SelectTrigger>
        <SelectContent>
          {communities?.map((c: any) => (
            <SelectItem key={c.id} value={c.id.toString()}>
              {c.title}{c.pendingCount > 0 ? ` (${c.pendingCount} pending)` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {activeCommunity && (
        <>
          <Link href={`/community/${activeCommunity.slug}`}>
            <Button variant="outline" size="sm" className="text-teal-600 border-teal-200">
              <ExternalLink className="w-3.5 h-3.5 mr-1" />View Community
            </Button>
          </Link>
          <Link href={`/community/${activeCommunity.slug}?compose=true`}>
            <Button variant="outline" size="sm" className="text-teal-600 border-teal-200">
              <PenSquare className="w-3.5 h-3.5 mr-1" />Post in Community
            </Button>
          </Link>
        </>
      )}
    </div>
  );

  // ── Inline Editor View ──────────────────────────────────────────────────────
  if (editingCommunity) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <CommunityEditor
          community={editingCommunity}
          onBack={() => setEditingCommunity(null)}
        />
      </div>
    );
  }

  // ── List View ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Manage communities, channels, members, moderation, admin profiles, and page content</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />New Community
        </Button>
      </div>

      <Tabs defaultValue="communities">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="communities"><Users className="w-4 h-4 mr-2" />Communities</TabsTrigger>
          <TabsTrigger value="sort"><GripVertical className="w-4 h-4 mr-2" />Sort Order</TabsTrigger>
          <TabsTrigger value="channels"><Hash className="w-4 h-4 mr-2" />Channels</TabsTrigger>
          <TabsTrigger value="members"><UserPlus className="w-4 h-4 mr-2" />Members</TabsTrigger>
          <TabsTrigger value="pending">
            <AlertCircle className="w-4 h-4 mr-2" />Pending
            {totalPendingMembers > 0 && <Badge className="ml-1.5 bg-amber-500 text-white text-xs">{totalPendingMembers}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="profiles"><UserCircle className="w-4 h-4 mr-2" />Admin Profiles</TabsTrigger>
          <TabsTrigger value="moderation">
            <Flag className="w-4 h-4 mr-2" />Moderation
            {totalModerationCount > 0 && <Badge className="ml-1.5 bg-red-500 text-white text-xs">{totalModerationCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="badges"><Award className="w-4 h-4 mr-2" />Badges</TabsTrigger>
          <TabsTrigger value="workflow-rules"><Zap className="w-4 h-4 mr-2" />Workflow Rules</TabsTrigger>
        </TabsList>

        {/* Communities tab */}
        <TabsContent value="communities">
          {commLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : !communities?.length ? (
            <Card><CardContent className="py-12 text-center text-gray-400">No communities yet. Create one to get started.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {communities.map((c: any) => (
                <Card key={c.id} className={activeCommunityId === c.id ? "ring-2 ring-teal-400" : ""}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border">
                      {c.iconImage ? (
                        <img src={c.iconImage} alt={c.title} className="w-full h-full object-cover" />
                      ) : c.logoImage ? (
                        <img src={c.logoImage} alt={c.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: c.accentColor || "#189aa1" }}>
                          {c.title.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{c.title}</h3>
                        <Badge variant="outline" className="text-xs">{c.privacy}</Badge>
                        <Badge variant={c.accessType === "free" ? "secondary" : "outline"}
                          className={`text-xs ${c.accessType === "restricted" ? "border-amber-300 text-amber-700 bg-amber-50" : c.accessType === "paid" ? "bg-teal-100 text-teal-700 border-teal-200" : c.accessType === "course_gated" ? "bg-purple-100 text-purple-700 border-purple-200" : ""}`}>
                          {c.accessType === "restricted" && <Lock className="w-2.5 h-2.5 mr-1" />}
                          {c.accessType === "course_gated" && <BookOpen className="w-2.5 h-2.5 mr-1" />}
                          {c.accessType}
                        </Badge>
                        <Badge variant={c.status === "published" ? "default" : "secondary"}
                          className={`text-xs ${c.status === "published" ? "bg-green-100 text-green-700 border-green-200" : ""}`}>
                          {c.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{c.memberCount ?? 0} members</span>
                        {c.pendingCount > 0 && <span className="text-amber-600 font-medium">{c.pendingCount} pending</span>}
                        <span className="text-gray-300">•</span>
                        <span>/{c.slug}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href={`/community/${c.slug}`}>
                        <Button variant="outline" size="sm" className="text-teal-600 border-teal-200">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />View
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm" onClick={() => setActiveCommunityId(c.id)}>
                        <Hash className="w-3.5 h-3.5 mr-1" />Select
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingCommunity(c)}
                        className="text-teal-700 border-teal-200 hover:bg-teal-50">
                        <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700"
                        onClick={() => { if (confirm(`Delete "${c.title}"? This cannot be undone.`)) deleteCommunity.mutate({ id: c.id }); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Sort Order tab */}
        <TabsContent value="sort">
          {commLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : (
            <SortOrderTab communities={communities ?? []} onRefresh={() => refetchCommunities()} />
          )}
        </TabsContent>

        {/* Channels tab */}
        <TabsContent value="channels">
          <CommunitySelector />
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Channels</h3>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { setEditChannel(null); setShowChannelForm(true); }} disabled={!activeCommunityId}>
              <Plus className="w-4 h-4 mr-2" />New Channel
            </Button>
          </div>
          {!activeCommunityId ? (
            <Card><CardContent className="py-12 text-center text-gray-400">Select a community to manage its channels.</CardContent></Card>
          ) : !channels?.length ? (
            <Card><CardContent className="py-12 text-center text-gray-400">No channels yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {channels.map((ch: any) => (
                <Card key={ch.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Hash className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{ch.name}</p>
                        {ch.isDefault && <Badge className="text-xs bg-teal-100 text-teal-700 border-teal-200">Default</Badge>}
                        <Badge variant="secondary" className="text-xs capitalize">{ch.type?.replace("_", " ")}</Badge>
                      </div>
                      {ch.description && <p className="text-sm text-gray-500">{ch.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditChannel(ch); setShowChannelForm(true); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700"
                        onClick={() => { if (confirm(`Delete #${ch.name}?`)) deleteChannel.mutate({ id: ch.id }); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members">
          <CommunitySelector />
          {!activeCommunityId ? (
            <Card><CardContent className="py-12 text-center text-gray-400">Select a community to manage its members.</CardContent></Card>
          ) : (
            <MembersTab communityId={activeCommunityId} />
          )}
        </TabsContent>

        {/* Pending Members tab */}
        <TabsContent value="pending">
          <CommunitySelector />
          {!activeCommunityId ? (
            <Card><CardContent className="py-12 text-center text-gray-400">Select a community to view pending requests.</CardContent></Card>
          ) : (
            <PendingMembersTab communityId={activeCommunityId} />
          )}
        </TabsContent>

        {/* Admin Profiles tab */}
        <TabsContent value="profiles">
          <CommunitySelector />
          {!activeCommunityId ? (
            <Card><CardContent className="py-12 text-center text-gray-400">Select a community to manage admin profiles.</CardContent></Card>
          ) : activeCommunity ? (
            <AdminProfilesTab communityId={activeCommunityId} communitySlug={activeCommunity.slug} />
          ) : null}
        </TabsContent>

        {/* Moderation tab */}
        <TabsContent value="moderation">
          <CommunitySelector />
          {!activeCommunityId ? (
            <Card><CardContent className="py-12 text-center text-gray-400">Select a community to moderate.</CardContent></Card>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-red-500" />Content Reports
                  {pendingReportCount > 0 && <Badge className="bg-red-500 text-white text-xs">{pendingReportCount}</Badge>}
                </h3>
                {!reports?.filter((r: any) => r.status === "pending").length ? (
                  <Card><CardContent className="py-8 text-center text-gray-400">No pending reports.</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {reports?.filter((r: any) => r.status === "pending").map((r: any) => (
                      <Card key={r.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{r.reason}</p>
                              <p className="text-xs text-gray-500 mt-1 capitalize">
                                {r.targetType?.replace("_", " ")} · {r.targetSummary}
                              </p>
                              {r.details && <p className="text-sm text-gray-500 mt-1">{r.details}</p>}
                              <p className="text-xs text-gray-400 mt-1">Reported {timeAgo(r.createdAt)} · by {r.reporterName}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => resolveReport.mutate({ reportId: r.id, action: "dismiss" })}>
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />Dismiss
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-500 border-red-200"
                                onClick={() => resolveReport.mutate({ reportId: r.id, action: "remove" })}>
                                <Trash2 className="w-3.5 h-3.5 mr-1" />Remove
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-teal-600" />Direct Message Oversight
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Review member DM threads when reported or for safety oversight. Selecting a conversation loads the message history.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-0 max-h-72 overflow-y-auto divide-y">
                      {(dmConversations ?? []).length === 0 ? (
                        <p className="p-4 text-sm text-gray-400 text-center">No DM conversations yet</p>
                      ) : (
                        (dmConversations ?? []).map((conv: any) => (
                          <button
                            key={conv.id}
                            type="button"
                            className={`w-full text-left p-3 hover:bg-gray-50 ${oversightConvId === conv.id ? "bg-teal-50" : ""}`}
                            onClick={() => setOversightConvId(conv.id)}
                          >
                            <p className="text-sm font-medium text-gray-900">
                              {(conv.userA?.displayName || conv.userA?.name || "?")}
                              {" ↔ "}
                              {(conv.userB?.displayName || conv.userB?.name || "?")}
                            </p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {conv.lastMessage?.body ?? "No messages"}
                            </p>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 max-h-72 overflow-y-auto">
                      {!oversightConvId ? (
                        <p className="text-sm text-gray-400 text-center py-8">Select a conversation</p>
                      ) : !oversightMessages?.items?.length ? (
                        <p className="text-sm text-gray-400 text-center py-8">No messages in this thread</p>
                      ) : (
                        <div className="space-y-2">
                          {oversightMessages.items.map((msg: any) => (
                            <div key={msg.id} className="text-sm border rounded-lg p-2 bg-gray-50">
                              <p className="text-xs text-gray-500 mb-1">
                                {msg.sender?.displayName || msg.sender?.name || msg.sender?.email} · {timeAgo(msg.createdAt)}
                              </p>
                              <p className="text-gray-800 whitespace-pre-wrap">{msg.body}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchDms()}>
                  Refresh conversations
                </Button>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-500" />Pending Comments
                  {pendingCommentCount > 0 && <Badge className="bg-amber-500 text-white text-xs">{pendingCommentCount}</Badge>}
                </h3>
                {!pendingComments?.length ? (
                  <Card><CardContent className="py-8 text-center text-gray-400">No pending comments.</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {pendingComments.map((c: any) => (
                      <Card key={c.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800">{c.body}</p>
                              <p className="text-xs text-gray-400 mt-1">by {c.authorName} · {timeAgo(c.createdAt)}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => moderateComment.mutate({ commentId: c.id, action: "approve" })}>
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-500 border-red-200"
                                onClick={() => moderateComment.mutate({ commentId: c.id, action: "reject" })}>
                                <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Badges tab */}
        <TabsContent value="badges">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 mb-1">Award a Badge</h3>
            <p className="text-sm text-gray-500 mb-3">Enter a user ID and select a badge to award it manually.</p>
            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">User ID</label>
                <Input type="number" placeholder="User ID" className="w-32" value={awardBadgeUserId ?? ""}
                  onChange={e => setAwardBadgeUserId(parseInt(e.target.value) || null)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Badge</label>
                <Select value={selectedBadgeId?.toString() ?? ""} onValueChange={v => setSelectedBadgeId(parseInt(v))}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Select badge" /></SelectTrigger>
                  <SelectContent>
                    {badges?.map((b: any) => (
                      <SelectItem key={b.id} value={b.id.toString()}>{b.iconEmoji} {b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={!awardBadgeUserId || !selectedBadgeId || awardBadge.isPending}
                onClick={() => awardBadge.mutate({ userId: awardBadgeUserId!, badgeId: selectedBadgeId! })}>
                <Award className="w-4 h-4 mr-2" />Award
              </Button>
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-3">All Badges</h3>
          {!badges?.length ? (
            <Card><CardContent className="py-8 text-center text-gray-400">No badges defined yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {badges.map((b: any) => (
                <Card key={b.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <span className="text-3xl">{b.iconEmoji}</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
                      <p className="text-xs text-gray-500">{b.description}</p>
                      <p className="text-xs text-teal-600 mt-0.5">+{b.xpReward} XP</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Workflow Rules tab */}
        <TabsContent value="workflow-rules">
          <CommunitySelector />
          {activeCommunityId ? (
            <WorkflowRulesTab communityId={activeCommunityId} />
          ) : (
            <div className="text-center py-12 text-gray-400">Select a community above to manage its workflow rules.</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Community dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Community</DialogTitle>
          </DialogHeader>
          <CreateCommunityForm
            onClose={() => setShowCreateDialog(false)}
            onSaved={(id) => { setShowCreateDialog(false); }}
          />
        </DialogContent>
      </Dialog>

      {/* Channel form dialog */}
      <Dialog open={showChannelForm} onOpenChange={setShowChannelForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editChannel ? "Edit Channel" : "Create Channel"}</DialogTitle>
          </DialogHeader>
          {activeCommunityId && (
            <ChannelForm
              communityId={activeCommunityId}
              channel={editChannel}
              onClose={() => { setShowChannelForm(false); setEditChannel(null); }}
              onSaved={() => {}}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
