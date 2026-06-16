/**
 * WebinarsAdmin — Full webinar management admin UI
 * Matches the visual/structural pattern of LMSAdmin (CoursesTab / CourseEditor)
 * Supports: live & prerecorded, free & paid, landing page editor, attendee tracking, analytics
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Radio, Plus, Edit2, Trash2, Eye, Users, BarChart2, Settings,
  Video, Calendar, Globe, Link2, RefreshCw, CheckCircle, Clock,
  PlayCircle, DollarSign, ChevronLeft, Copy, ExternalLink, Workflow
} from "lucide-react";
import { toast } from "sonner";
import { PublishDomainSelect } from "@/components/PublishDomainSelect";
import { AfterPurchaseWorkflowEditor } from "@/components/AfterPurchaseWorkflowEditor";
import { HidePricingOptionsToggle } from "@/components/HidePricingOptionsToggle";
import { SdmsCmeConfigPanel, resolveWebinarActivityType } from "@/components/admin/SdmsCmeConfigPanel";

// ── helpers ────────────────────────────────────────────────────────────────────
function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}
function fmtDuration(mins: number | null | undefined) {
  if (!mins) return "—";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ""}`.trim();
}
function statusColor(status: string) {
  if (status === "published") return "bg-green-100 text-green-700";
  if (status === "ended") return "bg-gray-100 text-gray-600";
  return "bg-yellow-100 text-yellow-700";
}

// ── WebinarsList ───────────────────────────────────────────────────────────────
function WebinarsList({ onEdit }: { onEdit: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.webinarAdmin.list.useQuery({
    page,
    pageSize: 20,
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    brand: undefined,
  });

  const createMutation = trpc.webinarAdmin.create.useMutation({
    onSuccess: (res) => {
      utils.webinarAdmin.list.invalidate();
      toast.success("Webinar created");
      onEdit(res.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.webinarAdmin.delete.useMutation({
    onSuccess: () => { utils.webinarAdmin.list.invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const webinars = data?.webinars ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search webinars…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-56 text-sm"
          />
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-32 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="prerecorded">Pre-recorded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => createMutation.mutate({ title: "New Webinar", type: "live" })}
          disabled={createMutation.isPending}
        >
          <Plus className="w-4 h-4 mr-1" /> New Webinar
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : webinars.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Radio className="w-12 h-12 opacity-30" />
          <p className="text-sm">No webinars yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webinars.filter(w => typeFilter === "all" || w.type === typeFilter).map(w => (
                <TableRow key={w.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onEdit(w.id)}>
                  <TableCell className="font-medium max-w-[200px] truncate">{w.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {w.type === "live" ? <><Radio className="w-3 h-3 mr-1 text-red-500" />Live</> : <><PlayCircle className="w-3 h-3 mr-1 text-blue-500" />Recorded</>}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{fmtDate(w.scheduledAt)}</TableCell>
                  <TableCell className="text-sm text-gray-600">{fmtDuration(w.durationMinutes)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {w.accessType === "free" ? <><Globe className="w-3 h-3 mr-1" />Free</> : <><DollarSign className="w-3 h-3 mr-1" />Paid</>}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(w.status)}`}>
                      {w.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(w.id)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => { if (confirm("Delete this webinar?")) deleteMutation.mutate({ id: w.id }); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} total</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="px-2 py-1">Page {page}</span>
            <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WebinarEditor ──────────────────────────────────────────────────────────────
function WebinarEditor({ webinarId, onBack }: { webinarId: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: webinar, isLoading } = trpc.webinarAdmin.getById.useQuery({ id: webinarId });
  const { data: statsData } = trpc.webinarAdmin.getStats.useQuery({ webinarId });
  const { data: regsData } = trpc.webinarAdmin.getRegistrations.useQuery({ webinarId, page: 1, pageSize: 100 });

  const [activeTab, setActiveTab] = useState("settings");

  // Settings state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"live" | "prerecorded">("live");
  const [status, setStatus] = useState<"draft" | "published" | "ended">("draft");
  const [accessType, setAccessType] = useState<"free" | "paid" | "restricted">("free");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [timezone, setTimezone] = useState("America/New_York");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [videoSource, setVideoSource] = useState<"upload" | "youtube" | "vimeo" | "zoom" | "teams" | "embed">("youtube");
  const [videoUrl, setVideoUrl] = useState("");
  const [replayUrl, setReplayUrl] = useState("");
  const [replayEnabled, setReplayEnabled] = useState(true);
  const [replayDelayMinutes, setReplayDelayMinutes] = useState(0);
  const [hostName, setHostName] = useState("");
  const [hostTitle, setHostTitle] = useState("");
  const [maxAttendees, setMaxAttendees] = useState<number | "">("");
  const [requireRegistration, setRequireRegistration] = useState(true);
  const [publishDomain, setPublishDomain] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  // AI viewers
  const [aiViewersEnabled, setAiViewersEnabled] = useState(false);
  const [aiViewersMin, setAiViewersMin] = useState(50);
  const [aiViewersMax, setAiViewersMax] = useState(300);
  const [aiViewersPeakAt, setAiViewersPeakAt] = useState(30);

  useEffect(() => {
    if (!webinar) return;
    setTitle(webinar.title ?? "");
    setDescription(webinar.description ?? "");
    setType(webinar.type ?? "live");
    setStatus(webinar.status ?? "draft");
    setAccessType((webinar.accessType as any) ?? "free");
    setScheduledAt(webinar.scheduledAt ? new Date(webinar.scheduledAt).toISOString().slice(0, 16) : "");
    setDurationMinutes(webinar.durationMinutes ?? 60);
    setTimezone(webinar.timezone ?? "America/New_York");
    setMeetingUrl(webinar.meetingUrl ?? "");
    setMeetingId(webinar.meetingId ?? "");
    setVideoSource((webinar.videoSource as any) ?? "youtube");
    setVideoUrl(webinar.videoUrl ?? "");
    setReplayUrl(webinar.replayUrl ?? "");
    setReplayEnabled(webinar.replayEnabled ?? true);
    setReplayDelayMinutes(webinar.replayDelayMinutes ?? 0);
    setHostName(webinar.hostName ?? "");
    setHostTitle(webinar.hostTitle ?? "");
    setMaxAttendees(webinar.maxAttendees ?? "");
    setRequireRegistration(webinar.requireRegistration ?? true);
    setPublishDomain((webinar as any).publishDomain ?? "");
    setSubtitle((webinar as any).subtitle ?? "");
    setSlug(webinar.slug ?? "");
    setMetaTitle((webinar as any).metaTitle ?? "");
    setMetaDescription((webinar as any).metaDescription ?? "");
    setCoverImage((webinar as any).coverImage ?? (webinar as any).thumbnailUrl ?? "");
    setAiViewersEnabled(webinar.aiViewersEnabled ?? false);
    setAiViewersMin(webinar.aiViewersMin ?? 50);
    setAiViewersMax(webinar.aiViewersMax ?? 300);
    setAiViewersPeakAt(webinar.aiViewersPeakAt ?? 30);
  }, [webinar]);

  const updateMutation = trpc.webinarAdmin.update.useMutation({
    onSuccess: () => { utils.webinarAdmin.getById.invalidate({ id: webinarId }); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

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

  function saveSettings() {
    updateMutation.mutate({
      id: webinarId,
      title, description, type, status, accessType,
      scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : undefined,
      durationMinutes, timezone, meetingUrl, meetingId,
      videoSource, videoUrl, replayUrl, replayEnabled, replayDelayMinutes,
      hostName, hostTitle,
      maxAttendees: maxAttendees !== "" ? Number(maxAttendees) : undefined,
      requireRegistration, publishDomain: publishDomain || undefined,
      aiViewersEnabled, aiViewersMin, aiViewersMax, aiViewersPeakAt,
      subtitle: subtitle || undefined,
      slug: slug || undefined,
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
      coverImage: coverImage || undefined,
    });
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
    </div>
  );
  if (!webinar) return <div className="text-red-500 p-4">Webinar not found.</div>;

  const publicUrl = `${publishDomain ? `https://${publishDomain}` : window.location.origin}/webinars/${webinar.slug}`;
  const stats = statsData ?? { totalRegistrations: 0, attended: 0, converted: 0, conversionRate: 0, avgWatchMinutes: 0 };
  const registrations = regsData?.registrations ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onBack} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{webinar.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(webinar.status)}`}>{webinar.status}</span>
            <Badge variant="outline" className="text-xs capitalize">{webinar.type}</Badge>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-xs font-mono font-semibold text-gray-600 select-all cursor-text" title="Webinar ID">ID: {webinar.id}</span>
        <a href={`/webinars/${webinar.slug}`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="ghost" className="text-xs text-gray-500 hover:text-teal-600 gap-1">
            <Eye className="w-3.5 h-3.5" /> View Sales Page
          </Button>
        </a>
        <Button
          size="sm"
          variant="outline"
          className="text-xs gap-1"
          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/checkout/${webinar.slug}?type=webinar`); toast.success("Checkout link copied"); }}
        >
          <Copy className="w-3.5 h-3.5" /> Copy Checkout Link
        </Button>
        <Button
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={saveSettings}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
          Save
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Registrations", value: stats.totalRegistrations, icon: Users },
          { label: "Attended", value: stats.attended, icon: CheckCircle },
          { label: "Converted", value: `${stats.conversionRate}%`, icon: BarChart2 },
          { label: "Avg Watch", value: `${stats.avgWatchMinutes}m`, icon: Clock },
        ].map(s => (
          <Card key={s.label} className="p-3">
            <div className="flex items-center gap-2">
              <s.icon className="w-4 h-4 text-teal-500 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-bold text-gray-800">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="settings" className="text-xs"><Settings className="w-3.5 h-3.5 mr-1" />Settings</TabsTrigger>
          <TabsTrigger value="video" className="text-xs"><Video className="w-3.5 h-3.5 mr-1" />Video</TabsTrigger>
          <TabsTrigger value="registration" className="text-xs"><Users className="w-3.5 h-3.5 mr-1" />Registration</TabsTrigger>
          <TabsTrigger value="attendees" className="text-xs"><Users className="w-3.5 h-3.5 mr-1" />Attendees</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs"><BarChart2 className="w-3.5 h-3.5 mr-1" />Analytics</TabsTrigger>
          <TabsTrigger value="domain" className="text-xs"><Globe className="w-3.5 h-3.5 mr-1" />Domain</TabsTrigger>
          <TabsTrigger value="after-purchase" className="text-xs"><Workflow className="w-3.5 h-3.5 mr-1" />After Purchase</TabsTrigger>
          <TabsTrigger value="checkout-page" className="text-xs"><DollarSign className="w-3.5 h-3.5 mr-1" />Checkout Page</TabsTrigger>
          <a href={`/admin/webinars/${webinarId}/landing-builder`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-teal-600 text-teal-700 rounded-md hover:bg-teal-50 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Landing Builder
          </a>
          <a href={`/admin/webinars/${webinarId}/player-builder`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-purple-600 text-purple-700 rounded-md hover:bg-purple-50 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Player Builder
          </a>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-600">Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Subtitle <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Short tagline shown below the title" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="mt-1 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Type</Label>
                  <Select value={type} onValueChange={(v: any) => setType(v)}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="live"><Radio className="w-3.5 h-3.5 mr-1 inline text-red-500" />Live</SelectItem>
                      <SelectItem value="prerecorded"><PlayCircle className="w-3.5 h-3.5 mr-1 inline text-blue-500" />Pre-recorded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Status</Label>
                  <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Access</Label>
                  <Select value={accessType} onValueChange={(v: any) => setAccessType(v)}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="restricted">Restricted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Max Attendees</Label>
                  <Input
                    type="number" min={0}
                    value={maxAttendees}
                    onChange={e => setMaxAttendees(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Unlimited"
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-600">Scheduled Date & Time</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="mt-1 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Duration (minutes)</Label>
                  <Input type="number" min={1} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Toronto","Europe/London","Europe/Paris","Australia/Sydney","Asia/Tokyo"].map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Host Name</Label>
                <Input value={hostName} onChange={e => setHostName(e.target.value)} placeholder="e.g. Dr. Jane Smith" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Host Title / Credentials</Label>
                <Input value={hostTitle} onChange={e => setHostTitle(e.target.value)} placeholder="e.g. RDCS, FASE" className="mt-1 text-sm" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Switch checked={requireRegistration} onCheckedChange={setRequireRegistration} id="require-reg" />
                <Label htmlFor="require-reg" className="text-sm cursor-pointer">Require registration to attend</Label>
              </div>
            </div>
          </div>
          <SdmsCmeConfigPanel
            activityType={resolveWebinarActivityType(type, replayEnabled)}
            activityId={webinarId}
            defaultTitle={title}
          />
          {/* Cover Image */}
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
                  <Input value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="Or paste image URL" className="text-xs" />
                </div>
              </div>
            </CardContent>
          </Card>
          {/* URL & SEO */}
          <Card>
            <CardHeader><CardTitle className="text-sm">URL &amp; SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-600">URL Slug</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-400">/webinars/</span>
                  <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className="flex-1 font-mono text-sm" placeholder="my-webinar" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Meta Title <span className="text-gray-400 font-normal">(SEO)</span></Label>
                <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="mt-1 text-sm" placeholder={title} />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Meta Description <span className="text-gray-400 font-normal">(SEO)</span></Label>
                <Textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={2} className="mt-1 text-sm resize-none" placeholder="Brief description for search engines" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video Tab */}
        <TabsContent value="video" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-600">Video Source</Label>
                <Select value={videoSource} onValueChange={(v: any) => setVideoSource(v)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="vimeo">Vimeo</SelectItem>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                    <SelectItem value="upload">Direct Upload (S3)</SelectItem>
                    <SelectItem value="embed">Custom Embed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(videoSource === "youtube" || videoSource === "vimeo" || videoSource === "embed") && (
                <div>
                  <Label className="text-xs font-medium text-gray-600">Video URL</Label>
                  <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://…" className="mt-1 text-sm" />
                </div>
              )}
              {(videoSource === "zoom" || videoSource === "teams") && (
                <>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Meeting URL</Label>
                    <Input value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/j/…" className="mt-1 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Meeting ID</Label>
                    <Input value={meetingId} onChange={e => setMeetingId(e.target.value)} placeholder="123 456 7890" className="mt-1 text-sm" />
                  </div>
                </>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-600">Replay URL</Label>
                <Input value={replayUrl} onChange={e => setReplayUrl(e.target.value)} placeholder="https://…" className="mt-1 text-sm" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={replayEnabled} onCheckedChange={setReplayEnabled} id="replay-enabled" />
                <Label htmlFor="replay-enabled" className="text-sm cursor-pointer">Enable replay access</Label>
              </div>
              {replayEnabled && (
                <div>
                  <Label className="text-xs font-medium text-gray-600">Replay delay after live (minutes)</Label>
                  <Input type="number" min={0} value={replayDelayMinutes} onChange={e => setReplayDelayMinutes(Number(e.target.value))} className="mt-1 text-sm" />
                </div>
              )}
              <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
                <div className="flex items-center gap-3">
                  <Switch checked={aiViewersEnabled} onCheckedChange={setAiViewersEnabled} id="ai-viewers" />
                  <Label htmlFor="ai-viewers" className="text-sm cursor-pointer font-medium">AI Viewer Count</Label>
                </div>
                {aiViewersEnabled && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500">Min</Label>
                      <Input type="number" min={1} value={aiViewersMin} onChange={e => setAiViewersMin(Number(e.target.value))} className="mt-1 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Max</Label>
                      <Input type="number" min={1} value={aiViewersMax} onChange={e => setAiViewersMax(Number(e.target.value))} className="mt-1 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Peak at (min)</Label>
                      <Input type="number" min={1} value={aiViewersPeakAt} onChange={e => setAiViewersPeakAt(Number(e.target.value))} className="mt-1 text-xs" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Registration Tab */}
        <TabsContent value="registration" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Registration Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={requireRegistration} onCheckedChange={setRequireRegistration} id="req-reg2" />
                <Label htmlFor="req-reg2" className="text-sm cursor-pointer">Require registration to attend</Label>
              </div>
              <p className="text-xs text-gray-500">
                When enabled, visitors must register (and optionally pay) before accessing the webinar room.
                Registration data is collected and shown in the Attendees tab.
              </p>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-700">
                <strong>Registration URL:</strong>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white border rounded px-2 py-1 flex-1 truncate">{publicUrl}</code>
                  <button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copied"); }} className="shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendees Tab */}
        <TabsContent value="attendees" className="pt-2">
          {registrations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-sm">No registrations yet.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Attended</TableHead>
                    <TableHead>Watch Time</TableHead>
                    <TableHead>Converted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{(r.userName ?? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim()) || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-600">{r.userEmail ?? r.email ?? "—"}</TableCell>
                      <TableCell className="text-xs text-gray-500">{r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        {r.attended ? <CheckCircle className="w-4 h-4 text-green-500" /> : <span className="text-xs text-gray-400">No</span>}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {r.watchedSeconds ? `${Math.round(r.watchedSeconds / 60)}m` : "—"}
                      </TableCell>
                      <TableCell>
                        {r.convertedAt ? <CheckCircle className="w-4 h-4 text-teal-500" /> : <span className="text-xs text-gray-400">No</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Total Registrations", value: stats.totalRegistrations, icon: Users, color: "text-blue-500" },
              { label: "Attended Live", value: stats.attended, icon: Radio, color: "text-red-500" },
              { label: "Conversion Rate", value: `${stats.conversionRate}%`, icon: BarChart2, color: "text-teal-500" },
              { label: "Conversions", value: stats.converted, icon: CheckCircle, color: "text-green-500" },
              { label: "Avg Watch Time", value: `${stats.avgWatchMinutes} min`, icon: Clock, color: "text-purple-500" },
              { label: "Attendance Rate", value: stats.totalRegistrations > 0 ? `${Math.round((stats.attended / stats.totalRegistrations) * 100)}%` : "—", icon: Eye, color: "text-orange-500" },
            ].map(s => (
              <Card key={s.label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gray-50 ${s.color}`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Domain Tab */}
        <TabsContent value="domain" className="pt-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-teal-500" /> Publish Domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-gray-500">
                Select which domain this webinar's landing page and registration page will be hosted on.
                Leave as "Use global default" to use the platform's default domain.
              </p>
              <div>
                <Label className="text-xs font-medium text-gray-600">Domain</Label>
                <PublishDomainSelect value={publishDomain} onChange={setPublishDomain} className="mt-1 text-sm" />
              </div>
              <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-600">
                <strong>Public URL:</strong>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white border rounded px-2 py-1 flex-1 truncate">{publicUrl}</code>
                  <button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copied"); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                  </a>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={saveSettings}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
                Save Domain Setting
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* After Purchase Tab */}
        <TabsContent value="after-purchase" className="pt-2">
          <WebinarAfterPurchaseTab webinarId={webinarId} />
        </TabsContent>

        {/* Checkout Page Tab */}
        <TabsContent value="checkout-page" className="pt-2">
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Checkout Page Editor</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Customise the sections shown on the hosted checkout page at{" "}
                    <a href={`/checkout/${webinar.slug}?type=webinar`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
                      /checkout/{webinar.slug}
                    </a>.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={`/checkout/${webinar.slug}?type=webinar`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                    <ExternalLink className="w-3.5 h-3.5" /> Preview
                  </a>
                  <a href={`/admin/checkout-editor/webinar/${webinarId}`}
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── After Purchase Tab ─────────────────────────────────────────────────────────────────────────────────
function WebinarAfterPurchaseTab({ webinarId }: { webinarId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.webinarAdmin.getAfterPurchaseWorkflow.useQuery({ webinarId });
  const saveMut = trpc.webinarAdmin.updateAfterPurchaseWorkflow.useMutation({
    onSuccess: () => { utils.webinarAdmin.getAfterPurchaseWorkflow.invalidate({ webinarId }); toast.success("After purchase workflow saved"); },
    onError: (e) => toast.error(e.message),
  });
  const { data: hideData } = trpc.webinarAdmin.getHidePricingOptions.useQuery({ webinarId });
  const hideToggleMut = trpc.webinarAdmin.updateHidePricingOptions.useMutation({
    onSuccess: () => { utils.webinarAdmin.getHidePricingOptions.invalidate({ webinarId }); toast.success("Setting saved"); },
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
        onChange={(v) => hideToggleMut.mutate({ webinarId, hidePricingOptions: v })}
        isSaving={hideToggleMut.isPending}
      />
      <AfterPurchaseWorkflowEditor
        value={data?.afterPurchaseWorkflow ?? null}
        onChange={(workflow) => saveMut.mutate({ webinarId, workflow })}
        isSaving={saveMut.isPending}
      />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function WebinarsAdmin({ initialEditId }: { initialEditId?: number } = {}) {
  const [editingId, setEditingId] = useState<number | null>(initialEditId ?? null);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {editingId === null ? (
        <>
          <div className="flex items-center gap-3 mb-6">
            <Radio className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Webinars</h1>
              <p className="text-sm text-gray-500">Host live and pre-recorded webinars with registration, tracking, and analytics.</p>
            </div>
          </div>
          <WebinarsList onEdit={setEditingId} />
        </>
      ) : (
        <WebinarEditor webinarId={editingId} onBack={() => setEditingId(null)} />
      )}
    </div>
  );
}
