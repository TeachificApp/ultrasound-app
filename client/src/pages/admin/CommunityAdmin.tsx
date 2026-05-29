/**
 * CommunityAdmin.tsx
 * Admin panel for community management: communities, channels, members,
 * moderation, badges, admin profiles, linked access, sort order.
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
  AlertCircle, Lock, PenSquare
} from "lucide-react";
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
  label, value, communityId, imageType, onChange,
}: {
  label: string; value: string; communityId?: number;
  imageType: "cover" | "logo" | "icon"; onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadCommunityImage = trpc.community.admin.uploadCommunityImage.useMutation({
    onSuccess: (data) => { onChange(data.url); setUploading(false); toast.success("Image uploaded"); },
    onError: (e) => { setUploading(false); toast.error(e.message); },
  });
  const uploadIcon = trpc.community.admin.uploadCommunityIcon.useMutation({
    onSuccess: (data) => { onChange(data.url); setUploading(false); toast.success("Icon uploaded"); },
    onError: (e) => { setUploading(false); toast.error(e.message); },
  });
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (imageType === "icon" && communityId) {
        uploadIcon.mutate({ communityId, base64, mimeType: file.type });
      } else {
        uploadCommunityImage.mutate({ base64, mimeType: file.type, imageType });
      }
    };
    reader.readAsDataURL(file);
  }
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt={label} className="w-16 h-16 rounded-lg object-cover border" />
        ) : (
          <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300">
            <Image className="w-6 h-6" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
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

// ─── Community Form ───────────────────────────────────────────────────────────
function CommunityForm({ community, onClose, onSaved }: { community?: any; onClose: () => void; onSaved: () => void }) {
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
  });
  const [linkedItems, setLinkedItems] = useState<Array<{ type: string; id: number; title: string }>>(
    (() => { try { return community?.linkedAccessItems ? JSON.parse(community.linkedAccessItems) : []; } catch { return []; } })()
  );
  const utils = trpc.useUtils();
  const { data: courses } = trpc.community.admin.listCoursesForLinkedAccess.useQuery();
  const create = trpc.community.admin.createCommunity.useMutation({
    onSuccess: () => { toast.success("Community created!"); onSaved(); onClose(); utils.community.admin.listCommunities.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.community.admin.updateCommunity.useMutation({
    onSuccess: () => { toast.success("Community updated!"); onSaved(); onClose(); utils.community.admin.listCommunities.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  function handleSubmit() {
    if (!form.title.trim() || !form.slug.trim()) { toast.error("Title and slug are required"); return; }
    const payload = { ...form, linkedAccessItems: JSON.stringify(linkedItems) };
    if (community) update.mutate({ id: community.id, ...payload });
    else create.mutate(payload as any);
  }
  function addLinkedCourse(courseId: number) {
    const course = courses?.find((c: any) => c.id === courseId);
    if (!course) return;
    if (linkedItems.some(i => i.type === "course" && i.id === courseId)) return;
    setLinkedItems(prev => [...prev, { type: "course", id: courseId, title: course.title }]);
  }
  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
              <SelectItem value="restricted">Restricted — admin approval required</SelectItem>
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Sort Order</label>
          <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} className="w-28" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Accent Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border" />
            <Input value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="w-32" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <ImageUploadField label="Cover Image" value={form.coverImage} communityId={community?.id} imageType="cover" onChange={url => setForm(f => ({ ...f, coverImage: url }))} />
        <ImageUploadField label="Logo / Avatar" value={form.logoImage} communityId={community?.id} imageType="logo" onChange={url => setForm(f => ({ ...f, logoImage: url }))} />
        <ImageUploadField label="Icon (small)" value={form.iconImage} communityId={community?.id} imageType="icon" onChange={url => setForm(f => ({ ...f, iconImage: url }))} />
      </div>
      {/* Linked Access Items */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-2 block">
          <span className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" />Linked Course Access</span>
          <span className="text-gray-400 font-normal block mt-0.5">Users enrolled in these courses automatically get community access</span>
        </label>
        <div className="flex gap-2 mb-2">
          <Select onValueChange={v => addLinkedCourse(parseInt(v))}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Add a course..." /></SelectTrigger>
            <SelectContent>
              {courses?.filter((c: any) => !linkedItems.some(i => i.type === "course" && i.id === c.id)).map((c: any) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {linkedItems.length > 0 ? (
          <div className="space-y-1">
            {linkedItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
                <Link2 className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                <span className="text-sm text-teal-800 flex-1">{item.title}</span>
                <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                  onClick={() => setLinkedItems(prev => prev.filter((_, i) => i !== idx))}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No linked courses. Add courses above to grant automatic access.</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={create.isPending || update.isPending}>
          {community ? "Save Changes" : "Create Community"}
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CommunityAdmin() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const [activeCommunityId, setActiveCommunityId] = useState<number | null>(null);
  const [showCommunityForm, setShowCommunityForm] = useState(false);
  const [editCommunity, setEditCommunity] = useState<any>(null);
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
    { communityId: activeCommunityId ?? undefined },
    { enabled: isAdmin }
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
    onSuccess: () => { toast.success("Report resolved"); utils.community.admin.listReports.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Manage communities, channels, members, moderation, admin profiles, and page content</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { setEditCommunity(null); setShowCommunityForm(true); }}>
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
                          className={`text-xs ${c.accessType === "restricted" ? "border-amber-300 text-amber-700 bg-amber-50" : c.accessType === "paid" ? "bg-teal-100 text-teal-700 border-teal-200" : ""}`}>
                          {c.accessType === "restricted" && <Lock className="w-2.5 h-2.5 mr-1" />}
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
                      <Button variant="outline" size="sm" onClick={() => { setEditCommunity(c); setShowCommunityForm(true); }}>
                        <Edit2 className="w-3.5 h-3.5" />
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
            <Card><CardContent className="py-12 text-center text-gray-400">Select a community to view pending membership requests.</CardContent></Card>
          ) : (
            <PendingMembersTab communityId={activeCommunityId} />
          )}
        </TabsContent>

        {/* Admin Profiles tab */}
        <TabsContent value="profiles">
          <CommunitySelector />
          {!activeCommunityId ? (
            <Card><CardContent className="py-12 text-center text-gray-400">Select a community to manage its admin profiles.</CardContent></Card>
          ) : (
            <AdminProfilesTab communityId={activeCommunityId} communitySlug={activeCommunity?.slug ?? ""} />
          )}
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
      </Tabs>

      {/* Community form dialog */}
      <Dialog open={showCommunityForm} onOpenChange={setShowCommunityForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editCommunity ? "Edit Community" : "Create Community"}</DialogTitle>
          </DialogHeader>
          <CommunityForm
            community={editCommunity}
            onClose={() => { setShowCommunityForm(false); setEditCommunity(null); }}
            onSaved={() => {}}
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
