/**
 * CommunityAdmin.tsx
 * Admin panel for community management: communities, channels, moderation queue, badge awards.
 */
import { useState, useEffect } from "react";
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
  Hash, Award, Settings, Shield, Eye, EyeOff, Pin, Lock
} from "lucide-react";

function timeAgo(dateStr: string | Date) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function CommunityForm({ community, onClose, onSaved }: { community?: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: community?.title ?? "",
    slug: community?.slug ?? "",
    description: community?.description ?? "",
    privacy: community?.privacy ?? "public",
    accessType: community?.accessType ?? "free",
    brand: community?.brand ?? "aaus",
    accentColor: community?.accentColor ?? "#189aa1",
    coverImage: community?.coverImage ?? "",
    logoImage: community?.logoImage ?? "",
  });

  const utils = trpc.useUtils();
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
    if (community) update.mutate({ id: community.id, ...form });
    else create.mutate(form as any);
  }

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
              <SelectItem value="secret">Secret</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Access</label>
          <Select value={form.accessType} onValueChange={v => setForm(f => ({ ...f, accessType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="invite_only">Invite Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Brand</label>
          <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aaus">All About Ultrasound™</SelectItem>
              <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Cover Image URL</label>
          <Input value={form.coverImage} onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))} placeholder="https://…" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Logo Image URL</label>
          <Input value={form.logoImage} onChange={e => setForm(f => ({ ...f, logoImage: e.target.value }))} placeholder="https://…" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Accent Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border" />
          <Input value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="w-32" />
        </div>
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

function ChannelForm({ communityId, channel, onClose, onSaved }: { communityId: number; channel?: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: channel?.name ?? "",
    description: channel?.description ?? "",
    channelType: channel?.channelType ?? "general",
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
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="general" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this channel for?" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
        <Select value={form.channelType} onValueChange={v => setForm(f => ({ ...f, channelType: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="announcements">Announcements</SelectItem>
            <SelectItem value="case_studies">Case Studies</SelectItem>
            <SelectItem value="q_and_a">Q&A</SelectItem>
            <SelectItem value="resources">Resources</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
        <span className="text-sm text-gray-700">Default channel (shown first)</span>
      </label>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={create.isPending || update.isPending}>
          {channel ? "Save Changes" : "Create Channel"}
        </Button>
      </DialogFooter>
    </div>
  );
}

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

  const { data: communities, isLoading: commLoading } = trpc.community.admin.listCommunities.useQuery(undefined, { enabled: isAdmin });
  const { data: channels } = trpc.community.admin.listChannels.useQuery(
    { communityId: activeCommunityId! },
    { enabled: !!activeCommunityId && isAdmin }
  );
  const { data: reports } = trpc.community.admin.listReports.useQuery(
    { communityId: activeCommunityId ?? undefined },
    { enabled: isAdmin }
  );
  const { data: badges } = trpc.community.admin.listBadges.useQuery(undefined, { enabled: isAdmin });

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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Manage communities, channels, moderation, and gamification</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { setEditCommunity(null); setShowCommunityForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />New Community
        </Button>
      </div>

      <Tabs defaultValue="communities">
        <TabsList className="mb-6">
          <TabsTrigger value="communities"><Users className="w-4 h-4 mr-2" />Communities</TabsTrigger>
          <TabsTrigger value="channels"><Hash className="w-4 h-4 mr-2" />Channels</TabsTrigger>
          <TabsTrigger value="moderation">
            <Flag className="w-4 h-4 mr-2" />Moderation
            {reports?.filter((r: any) => r.status === "pending").length > 0 && (
              <Badge className="ml-2 bg-red-500 text-white text-xs">{reports.filter((r: any) => r.status === "pending").length}</Badge>
            )}
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
                    <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: c.accentColor || "#189aa1" }}>
                      {c.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{c.title}</h3>
                        <Badge variant="outline" className="text-xs">{c.privacy}</Badge>
                        <Badge variant="secondary" className="text-xs">{c.accessType}</Badge>
                        {c.brand === "iheartecho" && <Badge variant="outline" className="text-xs text-pink-600 border-pink-200">iHeartEcho™</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{c.description || "No description"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">/{c.slug} · {(c.memberCount ?? 0).toLocaleString()} members</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveCommunityId(c.id)}>
                        <Hash className="w-3.5 h-3.5 mr-1" />Channels
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setEditCommunity(c); setShowCommunityForm(true); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700"
                        onClick={() => { if (confirm(`Delete "${c.title}"?`)) deleteCommunity.mutate({ id: c.id }); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Channels tab */}
        <TabsContent value="channels">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Select value={activeCommunityId?.toString() ?? ""} onValueChange={v => setActiveCommunityId(parseInt(v))}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select community" />
                </SelectTrigger>
                <SelectContent>
                  {communities?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { setEditChannel(null); setShowChannelForm(true); }} disabled={!activeCommunityId}>
              <Plus className="w-4 h-4 mr-2" />New Channel
            </Button>
          </div>
          {!activeCommunityId ? (
            <Card><CardContent className="py-12 text-center text-gray-400">Select a community to manage its channels.</CardContent></Card>
          ) : !channels?.length ? (
            <Card><CardContent className="py-12 text-center text-gray-400">No channels yet. Create one to get started.</CardContent></Card>
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
                        <Badge variant="secondary" className="text-xs capitalize">{ch.channelType.replace("_", " ")}</Badge>
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

        {/* Moderation tab */}
        <TabsContent value="moderation">
          {!reports?.length ? (
            <Card><CardContent className="py-12 text-center text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              No pending reports. Community is clean!
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {reports.map((r: any) => (
                <Card key={r.id} className={r.status === "resolved" ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={r.status === "pending" ? "destructive" : "secondary"} className="text-xs capitalize">{r.status}</Badge>
                          <span className="text-xs text-gray-500 capitalize">{r.targetType} report</span>
                          <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700"><strong>Reason:</strong> {r.reason}</p>
                        {r.details && <p className="text-sm text-gray-500 mt-1">{r.details}</p>}
                        <p className="text-xs text-gray-400 mt-1">Reported by user #{r.reporterId} · Target ID: {r.targetId}</p>
                      </div>
                      {r.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => resolveReport.mutate({ id: r.id, action: "dismiss" })}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />Dismiss
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => resolveReport.mutate({ id: r.id, action: "remove" })}>
                            <XCircle className="w-3.5 h-3.5 mr-1" />Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                <Input
                  type="number"
                  placeholder="User ID"
                  className="w-32"
                  value={awardBadgeUserId ?? ""}
                  onChange={e => setAwardBadgeUserId(parseInt(e.target.value) || null)}
                />
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
