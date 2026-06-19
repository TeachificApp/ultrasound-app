/**
 * WorkshopsAdmin.tsx
 * Full workshop management admin UI.
 * Follows the same structural pattern as WebinarsAdmin.tsx.
 *
 * Tabs: Settings | Instances | Resources | Curriculum | Landing Page | Enrollments
 */
import { useState, useEffect } from "react";
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
  Hammer, Plus, Edit2, Trash2, Eye, Users, Settings,
  Calendar, Globe, Link2, RefreshCw, CheckCircle, Clock,
  DollarSign, ChevronLeft, Copy, ExternalLink, MapPin,
  BookOpen, FileText, Package, ChevronRight, Workflow,
  Download, Mail, UserCheck, Loader2, Code2,
} from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { PublishDomainSelect } from "@/components/PublishDomainSelect";
import { ContentEmbedTab } from "@/components/admin/ContentEmbedTab";
import { AfterPurchaseWorkflowEditor } from "@/components/AfterPurchaseWorkflowEditor";
import { HidePricingOptionsToggle } from "@/components/HidePricingOptionsToggle";

// ── helpers ────────────────────────────────────────────────────────────────────
function fmtDate(ts: number | Date | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}
function fmtDateShort(ts: number | Date | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtPrice(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
function statusColor(status: string) {
  if (status === "public" || status === "published") return "bg-green-100 text-green-700";
  if (status === "archived" || status === "cancelled" || status === "completed") return "bg-gray-100 text-gray-600";
  return "bg-yellow-100 text-yellow-700";
}
function instanceStatusColor(status: string) {
  if (status === "published") return "bg-green-100 text-green-700";
  if (status === "cancelled") return "bg-red-100 text-red-700";
  if (status === "completed") return "bg-gray-100 text-gray-600";
  return "bg-yellow-100 text-yellow-700";
}

// ── WorkshopsList ──────────────────────────────────────────────────────────────
function WorkshopsList({ onEdit }: { onEdit: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.workshopAdmin.list.useQuery({
    page,
    pageSize: 20,
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const createMutation = trpc.workshopAdmin.create.useMutation({
    onSuccess: (res) => {
      utils.workshopAdmin.list.invalidate();
      toast.success("Workshop created");
      onEdit(res.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.workshopAdmin.delete.useMutation({
    onSuccess: () => { utils.workshopAdmin.list.invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const duplicateMutation = trpc.workshopAdmin.duplicate.useMutation({
    onSuccess: (res) => {
      utils.workshopAdmin.list.invalidate();
      toast.success("Workshop duplicated");
      onEdit(res.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const workshops = data?.workshops ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search workshops…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-56 text-sm"
          />
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-32 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => createMutation.mutate({ title: "New Workshop", slug: `workshop-${Date.now()}` })}
          disabled={createMutation.isPending}
          className="gap-1"
        >
          <Plus className="w-4 h-4" /> New Workshop
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : workshops.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Hammer className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No workshops yet</p>
          <p className="text-sm mt-1">Create your first workshop to get started.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Instances</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workshops.map((w: any) => (
                <TableRow key={w.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onEdit(w.id)}>
                  <TableCell>
                    <div className="font-medium text-sm">{w.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">/{w.slug}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(w.status)}`}>
                      {w.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-500 uppercase">{w.brand}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-600">{w.instanceCount ?? 0} instances</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-600">{fmtPrice(w.price)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(w.id)} title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700"
                        title="Duplicate"
                        disabled={duplicateMutation.isPending}
                        onClick={() => duplicateMutation.mutate({ id: w.id })}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm(`Delete "${w.title}"? This cannot be undone.`)) {
                            deleteMutation.mutate({ id: w.id });
                          }
                        }}
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
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 py-1">Page {page}</span>
            <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WorkshopEditor ─────────────────────────────────────────────────────────────
function WorkshopEditor({ workshopId, onBack, onTypeChangedFromWorkshop }: { workshopId: number; onBack: () => void; onTypeChangedFromWorkshop?: (newCourseId: number, newType: string) => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.workshopAdmin.getById.useQuery({ id: workshopId });
  const { data: enrollmentsData } = trpc.workshopAdmin.listEnrollments.useQuery({ workshopId });
  const [activeTab, setActiveTab] = useState("settings");

  // Settings state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "public" | "hidden" | "private" | "archived">("draft");
  const [brand, setBrand] = useState<"aaus" | "iheartecho">("aaus");
  const [price, setPrice] = useState(0);
  const [compareAtPrice, setCompareAtPrice] = useState<number | "">("");
  const [isFree, setIsFree] = useState(false);
  const [curriculumEnabled, setCurriculumEnabled] = useState(true);
  const [showInLibrary, setShowInLibrary] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [publishDomain, setPublishDomain] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#179ca3");
  const [accentColor, setAccentColor] = useState("#0d9488");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // Instance dialog state
  const [instanceDialogOpen, setInstanceDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<any>(null);
  const [instTitle, setInstTitle] = useState("");
  const [instDescription, setInstDescription] = useState("");
  const [instStartDate, setInstStartDate] = useState("");
  const [instEndDate, setInstEndDate] = useState("");
  const [instTimezone, setInstTimezone] = useState("America/New_York");
  const [instLocationType, setInstLocationType] = useState<"in_person" | "virtual" | "hybrid">("in_person");
  const [instVenueName, setInstVenueName] = useState("");
  const [instVenueCity, setInstVenueCity] = useState("");
  const [instVenueState, setInstVenueState] = useState("");
  const [instCapacity, setInstCapacity] = useState<number | "">("");
  const [instPrice, setInstPrice] = useState<number | "">("");
  const [instAvailableForPurchase, setInstAvailableForPurchase] = useState(false);
  const [instSalesCloseDate, setInstSalesCloseDate] = useState("");
  const [instSalesOpenDate, setInstSalesOpenDate] = useState("");
  const [instEnrollmentCloseDate, setInstEnrollmentCloseDate] = useState("");
  const [instStatus, setInstStatus] = useState<"draft" | "published" | "cancelled" | "completed">("draft");
  const [instContent, setInstContent] = useState("");

  // Resource dialog state
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<any>(null);
  const [resTitle, setResTitle] = useState("");
  const [resDescription, setResDescription] = useState("");
  const [resActionType, setResActionType] = useState<"link" | "download">("link");
  const [resLinkUrl, setResLinkUrl] = useState("");
  const [resFileUrl, setResFileUrl] = useState("");
  const [resStatus, setResStatus] = useState<"draft" | "published">("published");

  // Grant enrollment dialog
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantInstanceId, setGrantInstanceId] = useState<number | "">("");

  useEffect(() => {
    if (!data) return;
    const w = data.workshop;
    setTitle(w.title ?? "");
    setSlug(w.slug ?? "");
    setSubtitle(w.subtitle ?? "");
    setDescription(w.description ?? "");
    setStatus((w.status as any) ?? "draft");
    setBrand((w.brand as any) ?? "aaus");
    setPrice((w.price ?? 0) / 100);
    setCompareAtPrice(w.compareAtPrice != null ? w.compareAtPrice / 100 : "");
    setIsFree(w.isFree ?? false);
    setCurriculumEnabled(w.curriculumEnabled ?? true);
    setShowInLibrary(w.showInLibrary ?? true);
    setIsFeatured(w.isFeatured ?? false);
    setPublishDomain((w as any).publishDomain ?? "");
    setPrimaryColor(w.primaryColor ?? "#179ca3");
    setAccentColor(w.accentColor ?? "#0d9488");
    setCoverImageUrl(w.coverImageUrl ?? "");
    setThumbnailUrl(w.thumbnailUrl ?? "");
    setMetaTitle((w as any).metaTitle ?? "");
    setMetaDescription((w as any).metaDescription ?? "");
  }, [data]);

  const updateMutation = trpc.workshopAdmin.update.useMutation({
    onSuccess: () => { utils.workshopAdmin.getById.invalidate({ id: workshopId }); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const [changeToType, setChangeToType] = useState<"course" | "quiz" | "cohort">("course");
  const changeTypeMutation = trpc.lmsAdmin.changeCourseType.useMutation({
    onSuccess: (result) => {
      if (result.redirectTo === "courses" && onTypeChangedFromWorkshop) {
        toast.success(`Converted to ${result.newType} — opening editor…`);
        onTypeChangedFromWorkshop(result.newId, result.newType);
      }
    },
    onError: (e) => toast.error(`Type change failed: ${e.message}`),
  });

  const createInstanceMutation = trpc.workshopAdmin.createInstance.useMutation({
    onSuccess: () => { utils.workshopAdmin.getById.invalidate({ id: workshopId }); setInstanceDialogOpen(false); toast.success("Instance created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateInstanceMutation = trpc.workshopAdmin.updateInstance.useMutation({
    onSuccess: () => { utils.workshopAdmin.getById.invalidate({ id: workshopId }); setInstanceDialogOpen(false); toast.success("Instance updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteInstanceMutation = trpc.workshopAdmin.deleteInstance.useMutation({
    onSuccess: () => { utils.workshopAdmin.getById.invalidate({ id: workshopId }); toast.success("Instance deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const createResourceMutation = trpc.workshopAdmin.createResource.useMutation({
    onSuccess: () => { utils.workshopAdmin.getById.invalidate({ id: workshopId }); setResourceDialogOpen(false); toast.success("Resource added"); },
    onError: (e) => toast.error(e.message),
  });

  const updateResourceMutation = trpc.workshopAdmin.updateResource.useMutation({
    onSuccess: () => { utils.workshopAdmin.getById.invalidate({ id: workshopId }); setResourceDialogOpen(false); toast.success("Resource updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteResourceMutation = trpc.workshopAdmin.deleteResource.useMutation({
    onSuccess: () => { utils.workshopAdmin.getById.invalidate({ id: workshopId }); toast.success("Resource deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const revokeEnrollmentMutation = trpc.workshopAdmin.revokeEnrollment.useMutation({
    onSuccess: () => { utils.workshopAdmin.listEnrollments.invalidate({ workshopId }); toast.success("Enrollment revoked"); },
    onError: (e) => toast.error(e.message),
  });

  function saveSettings() {
    updateMutation.mutate({
      id: workshopId,
      title, slug, subtitle: subtitle || null, description: description || null,
      status, brand, price: Math.round(price * 100),
      compareAtPrice: compareAtPrice !== "" ? Math.round(Number(compareAtPrice) * 100) : null,
      isFree, curriculumEnabled, showInLibrary, isFeatured,
      publishDomain: publishDomain || null,
      primaryColor, accentColor,
      coverImageUrl: coverImageUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
    });
  }

  function openNewInstance() {
    setEditingInstance(null);
    setInstTitle(""); setInstDescription(""); setInstStartDate(""); setInstEndDate("");
    setInstContent("");
    setInstTimezone("America/New_York"); setInstLocationType("in_person");
    setInstVenueName(""); setInstVenueCity(""); setInstVenueState("");
    setInstCapacity(""); setInstPrice(""); setInstAvailableForPurchase(false);
    setInstSalesCloseDate(""); setInstSalesOpenDate(""); setInstEnrollmentCloseDate(""); setInstStatus("draft");
    setInstanceDialogOpen(true);
  }

  function openEditInstance(inst: any) {
    setEditingInstance(inst);
    setInstTitle(inst.title ?? "");
    setInstDescription(inst.description ?? "");
    setInstStartDate(inst.startDate ? new Date(inst.startDate).toISOString().slice(0, 16) : "");
    setInstEndDate(inst.endDate ? new Date(inst.endDate).toISOString().slice(0, 16) : "");
    setInstTimezone(inst.timezone ?? "America/New_York");
    setInstLocationType(inst.locationType ?? "in_person");
    setInstVenueName(inst.venueName ?? "");
    setInstVenueCity(inst.venueCity ?? "");
    setInstVenueState(inst.venueState ?? "");
    setInstCapacity(inst.capacity ?? "");
    setInstPrice(inst.price != null ? inst.price / 100 : "");
    setInstAvailableForPurchase(inst.availableForPurchase ?? false);
    setInstSalesCloseDate(inst.salesCloseDate ? new Date(inst.salesCloseDate).toISOString().slice(0, 16) : "");
    setInstSalesOpenDate(inst.salesOpenDate ? new Date(inst.salesOpenDate).toISOString().slice(0, 16) : "");
    setInstEnrollmentCloseDate(inst.enrollmentCloseDate ? new Date(inst.enrollmentCloseDate).toISOString().slice(0, 10) : "");
    setInstStatus(inst.status ?? "draft");
    setInstContent(inst.instanceContent ?? "");
    setInstanceDialogOpen(true);
  }

  function saveInstance() {
    const payload = {
      workshopId,
      title: instTitle,
      description: instDescription || undefined,
      startDate: instStartDate,
      endDate: instEndDate || undefined,
      timezone: instTimezone,
      locationType: instLocationType,
      venueName: instVenueName || undefined,
      venueCity: instVenueCity || undefined,
      venueState: instVenueState || undefined,
      capacity: instCapacity !== "" ? Number(instCapacity) : null,
      price: instPrice !== "" ? Math.round(Number(instPrice) * 100) : null,
      availableForPurchase: instAvailableForPurchase,
      salesCloseDate: instSalesCloseDate || null,
      salesOpenDate: instSalesOpenDate || null,
      enrollmentCloseDate: instEnrollmentCloseDate || null,
      status: instStatus,
      instanceContent: instContent || null,
    };
    if (editingInstance) {
      updateInstanceMutation.mutate({ id: editingInstance.id, ...payload });
    } else {
      createInstanceMutation.mutate(payload);
    }
  }

  function openNewResource() {
    setEditingResource(null);
    setResTitle(""); setResDescription(""); setResActionType("link");
    setResLinkUrl(""); setResFileUrl(""); setResStatus("published");
    setResourceDialogOpen(true);
  }

  function openEditResource(res: any) {
    setEditingResource(res);
    setResTitle(res.title ?? "");
    setResDescription(res.description ?? "");
    setResActionType(res.actionType ?? "link");
    setResLinkUrl(res.linkUrl ?? "");
    setResFileUrl(res.fileUrl ?? "");
    setResStatus(res.status ?? "published");
    setResourceDialogOpen(true);
  }

  function saveResource() {
    const payload = {
      workshopId,
      title: resTitle,
      description: resDescription || undefined,
      actionType: resActionType,
      linkUrl: resLinkUrl || undefined,
      fileUrl: resFileUrl || undefined,
      status: resStatus,
    };
    if (editingResource) {
      updateResourceMutation.mutate({ id: editingResource.id, ...payload });
    } else {
      createResourceMutation.mutate(payload);
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
    </div>
  );
  if (!data) return <div className="text-red-500 p-4">Workshop not found.</div>;

  const workshop = data.workshop;
  const instances = data.instances ?? [];
  const resources = data.resources ?? [];
  const enrollments = enrollmentsData ?? [];

  const publicUrl = `${publishDomain ? `https://${publishDomain}` : window.location.origin}/workshops/${workshop.slug}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onBack} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{workshop.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(workshop.status)}`}>{workshop.status}</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-xs font-mono font-semibold text-gray-600 select-all cursor-text" title="Workshop ID">ID: {workshop.id}</span>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="ghost" className="text-xs text-gray-500 hover:text-teal-600 gap-1">
            <Eye className="w-3.5 h-3.5" /> View Sales Page
          </Button>
        </a>
        <Button size="sm" variant="outline" className="gap-1 text-xs"
          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/checkout/workshop/${workshop.slug}`); toast.success("Checkout link copied!"); }}>
          <Copy className="w-3.5 h-3.5" /> Copy Checkout Link
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="settings" className="text-xs"><Settings className="w-3.5 h-3.5 mr-1" />Settings</TabsTrigger>
          <TabsTrigger value="instances" className="text-xs"><Calendar className="w-3.5 h-3.5 mr-1" />Instances ({instances.length})</TabsTrigger>
          <TabsTrigger value="resources" className="text-xs"><FileText className="w-3.5 h-3.5 mr-1" />Resources ({resources.length})</TabsTrigger>
          <TabsTrigger value="curriculum" className="text-xs"><BookOpen className="w-3.5 h-3.5 mr-1" />Curriculum</TabsTrigger>
          <TabsTrigger value="landing" className="text-xs"><Globe className="w-3.5 h-3.5 mr-1" />Landing Page</TabsTrigger>
          <TabsTrigger value="enrollments" className="text-xs"><Users className="w-3.5 h-3.5 mr-1" />Enrollments ({enrollments.length})</TabsTrigger>
          <TabsTrigger value="after-purchase" className="text-xs"><Workflow className="w-3.5 h-3.5 mr-1" />After Purchase</TabsTrigger>
          <TabsTrigger value="checkout-page" className="text-xs"><DollarSign className="w-3.5 h-3.5 mr-1" />Checkout Page</TabsTrigger>
          <TabsTrigger value="waitlist" className="text-xs"><Users className="w-3.5 h-3.5 mr-1" />Waitlist</TabsTrigger>
          <TabsTrigger value="embed" className="text-xs"><Code2 className="w-3.5 h-3.5 mr-1" />Embed</TabsTrigger>
        </TabsList>

        {/* ── Settings Tab ── */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Basic Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Slug (URL)</Label>
                  <Input value={slug} onChange={e => setSlug(e.target.value)} className="mt-1 text-sm font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Subtitle</Label>
                <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} className="mt-1 text-sm" placeholder="Short tagline" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1 text-sm" rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cover Image URL</Label>
                  <Input value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)} className="mt-1 text-sm" placeholder="https://…" />
                </div>
                <div>
                  <Label className="text-xs">Thumbnail URL</Label>
                  <Input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} className="mt-1 text-sm" placeholder="https://…" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Status & Brand</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={v => setStatus(v as any)}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Brand</Label>
                  <Select value={brand} onValueChange={v => setBrand(v as any)}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aaus">All About Ultrasound</SelectItem>
                      <SelectItem value="iheartecho">iHeartEcho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Publish Domain (optional override)</Label>
                <PublishDomainSelect value={publishDomain} onChange={setPublishDomain} className="mt-1 text-sm" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">URL &amp; SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Meta Title <span className="text-gray-400 font-normal">(SEO)</span></Label>
                <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="mt-1 text-sm" placeholder={title} />
              </div>
              <div>
                <Label className="text-xs">Meta Description <span className="text-gray-400 font-normal">(SEO)</span></Label>
                <Textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={2} className="mt-1 text-sm" placeholder="Brief description for search engines (150-160 chars)" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={isFree} onCheckedChange={setIsFree} id="isFree" />
                <Label htmlFor="isFree" className="text-sm">Free workshop</Label>
              </div>
              {!isFree && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Default Price ($)</Label>
                    <Input
                      type="number"
                      value={price}
                      onChange={e => setPrice(Number(e.target.value))}
                      className="mt-1 text-sm"
                      min={0}
                      step={0.01}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Instances can override this price</p>
                  </div>
                  <div>
                    <Label className="text-xs">Compare-at Price ($)</Label>
                    <Input
                      type="number"
                      value={compareAtPrice}
                      onChange={e => setCompareAtPrice(e.target.value ? Number(e.target.value) : "")}
                      className="mt-1 text-sm"
                      min={0}
                      step={0.01}
                      placeholder="Crossed-out price"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Display Options</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={curriculumEnabled} onCheckedChange={setCurriculumEnabled} id="curriculumEnabled" />
                <Label htmlFor="curriculumEnabled" className="text-sm">Enable curriculum tab for enrolled learners</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={showInLibrary} onCheckedChange={setShowInLibrary} id="showInLibrary" />
                <Label htmlFor="showInLibrary" className="text-sm">Show in Education Library</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isFeatured} onCheckedChange={setIsFeatured} id="isFeatured" />
                <Label htmlFor="isFeatured" className="text-sm">Featured</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Primary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-8 w-10 rounded border cursor-pointer" />
                    <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Accent Color</Label>
                  <div className="flex gap-2 mt-1">
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="h-8 w-10 rounded border cursor-pointer" />
                    <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="text-sm font-mono" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={updateMutation.isPending} className="gap-1">
              {updateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save Settings
            </Button>
          </div>
        </TabsContent>

        {/* ── Instances Tab ── */}
        <TabsContent value="instances" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Workshop Instances</h3>
              <p className="text-xs text-gray-500 mt-0.5">Each instance is a scheduled run with its own date, location, and price.</p>
            </div>
            <Button size="sm" onClick={openNewInstance} className="gap-1">
              <Plus className="w-4 h-4" /> Add Instance
            </Button>
          </div>

          {instances.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border rounded-lg">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No instances yet. Add a scheduled run to start selling.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((inst: any) => (
                <Card key={inst.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{inst.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${instanceStatusColor(inst.status)}`}>
                            {inst.status}
                          </span>
                          {inst.availableForPurchase && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">
                              On Sale
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmtDateShort(inst.startDate)}
                            {inst.endDate && ` – ${fmtDateShort(inst.endDate)}`}
                          </span>
                          {inst.locationType === "in_person" && (inst.venueCity || inst.venueState) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {[inst.venueCity, inst.venueState].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {inst.locationType === "virtual" && (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Virtual
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {inst.price != null ? fmtPrice(inst.price) : `Default (${fmtPrice(workshop.price)})`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {inst.enrolledCount ?? 0} enrolled
                            {inst.capacity ? ` / ${inst.capacity} capacity` : ""}
                          </span>
                        </div>
                        {inst.salesCloseDate && (
                          <p className="text-xs text-amber-600 mt-1">
                            Sales close: {fmtDateShort(inst.salesCloseDate)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-teal-300 text-teal-700 hover:bg-teal-50"
                          onClick={() => window.open(`/admin/workshops/${workshopId}/instances/${inst.id}/page-builder`, "_blank")}>
                          Edit Page
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditInstance(inst)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm("Delete this instance?")) {
                              deleteInstanceMutation.mutate({ id: inst.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Resources Tab ── */}
        <TabsContent value="resources" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Workshop Resources</h3>
              <p className="text-xs text-gray-500 mt-0.5">Downloadable files and links available to enrolled participants.</p>
            </div>
            <Button size="sm" onClick={openNewResource} className="gap-1">
              <Plus className="w-4 h-4" /> Add Resource
            </Button>
          </div>

          {resources.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border rounded-lg">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No resources yet. Add files or links for participants.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map((res: any) => (
                    <TableRow key={res.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{res.title}</div>
                        {res.description && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{res.description}</div>}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-600 capitalize">{res.actionType}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${res.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {res.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditResource(res)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (confirm("Delete this resource?")) {
                                deleteResourceMutation.mutate({ id: res.id });
                              }
                            }}
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
        </TabsContent>

        {/* ── Curriculum Tab ── */}
        <TabsContent value="curriculum" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-teal-50">
                  <BookOpen className="w-6 h-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Curriculum</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    When enabled, enrolled participants see a Curriculum tab with course content.
                    The curriculum is managed through the standard Course Builder.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Switch
                      checked={curriculumEnabled}
                      onCheckedChange={v => {
                        setCurriculumEnabled(v);
                        updateMutation.mutate({ id: workshopId, curriculumEnabled: v });
                      }}
                      id="curriculumToggle"
                    />
                    <Label htmlFor="curriculumToggle" className="text-sm">
                      {curriculumEnabled ? "Curriculum enabled" : "Curriculum disabled"}
                    </Label>
                  </div>
                  {curriculumEnabled && (
                    <p className="text-xs text-teal-600 mt-2">
                      Curriculum content is managed in the Course Builder. Link a course to this workshop to populate the curriculum tab.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          {/* ── Change Type Section ── */}
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-orange-800">Convert to a Different Type</h3>
                <p className="text-xs text-orange-600 mt-1">
                  This will migrate the workshop to the Courses section as a course, cohort, or quiz.
                  All workshop-specific data (instances, resources) will be archived.
                  The content, pricing, and settings will be preserved.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={changeToType} onValueChange={v => setChangeToType(v as any)}>
                  <SelectTrigger className="w-48 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="cohort">Cohort</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-100 bg-white"
                  disabled={changeTypeMutation.isPending}
                  onClick={() => {
                    if (!confirm(`Convert this workshop to a ${changeToType}? Workshop-specific data (instances, resources) will be archived. This cannot be undone.`)) return;
                    changeTypeMutation.mutate({ sourceId: workshopId, sourceTable: "workshops", newType: changeToType });
                  }}
                >
                  {changeTypeMutation.isPending ? "Converting…" : `Convert to ${changeToType.charAt(0).toUpperCase() + changeToType.slice(1)}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Landing Page Tab ── */}
        <TabsContent value="landing" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-sm">Landing Page Builder</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Design the public sales page for this workshop using the drag-and-drop page builder.
                </p>
              </div>
              <div className="flex gap-3">
                <a href={`/admin/workshops/${workshopId}/landing-builder`} target="_blank" rel="noopener noreferrer">
                  <Button className="gap-1">
                    <ExternalLink className="w-4 h-4" /> Open Page Builder
                  </Button>
                </a>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-1">
                    <Eye className="w-4 h-4" /> Preview Public Page
                  </Button>
                </a>
              </div>
              <div className="text-xs text-gray-400 bg-gray-50 rounded p-3">
                <strong>Public URL:</strong>{" "}
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline break-all">
                  {publicUrl}
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Enrollments Tab ── */}
        <TabsContent value="enrollments" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Enrollments</h3>
              <p className="text-xs text-gray-500 mt-0.5">{enrollments.length} total enrollments across all instances.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setGrantDialogOpen(true)} className="gap-1">
              <Plus className="w-4 h-4" /> Grant Access
            </Button>
          </div>

          {enrollments.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border rounded-lg">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No enrollments yet.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Participant</TableHead>
                    <TableHead>Instance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Enrolled At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((row: any) => (
                    <TableRow key={row.enrollment.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{row.user?.name ?? "—"}</div>
                        <div className="text-xs text-gray-400">{row.user?.email ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-600">{row.instance?.title ?? "—"}</div>
                        <div className="text-xs text-gray-400">{fmtDateShort(row.instance?.startDate)}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          row.enrollment.status === "active" ? "bg-green-100 text-green-700" :
                          row.enrollment.status === "cancelled" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {row.enrollment.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-600">{fmtPrice(row.enrollment.amountPaid)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-500">{fmtDate(row.enrollment.createdAt)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.enrollment.status === "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (confirm("Revoke this enrollment?")) {
                                revokeEnrollmentMutation.mutate({ enrollmentId: row.enrollment.id });
                              }
                            }}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── After Purchase Tab ── */}
        <TabsContent value="after-purchase" className="space-y-4 mt-4">
          <WorkshopAfterPurchaseSection workshopId={workshopId} />
        </TabsContent>

        {/* ── Checkout Page Tab ── */}
        <TabsContent value="checkout-page" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Checkout Page Editor</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Customise the sections shown on the hosted checkout page at{" "}
                  <a href={`${window.location.origin}/checkout/workshop/${workshop.slug}`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
                    /checkout/workshop/{workshop.slug}
                  </a>.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={`${window.location.origin}/checkout/workshop/${workshop.slug}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  <ExternalLink className="w-3.5 h-3.5" /> Preview
                </a>
                <a href={`/admin/checkout-editor/workshop/${workshopId}`}
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
        {/* ── Waitlist Tab ── */}
        <TabsContent value="waitlist" className="space-y-4 mt-4">
          <WaitlistSettingsTab workshopId={workshopId} />
        </TabsContent>

        <TabsContent value="embed" className="space-y-4 mt-4">
          <ContentEmbedTab
            entityType="workshop"
            slug={workshop.slug}
            title={workshop.title}
            subtitle={workshop.subtitle}
            coverImageUrl={workshop.coverImageUrl}
            thumbnailUrl={workshop.thumbnailUrl}
            defaultCheckoutUrl={`${window.location.origin}/checkout/workshop/${workshop.slug}`}
            instanceEmbedKind="workshop"
            instanceItems={instances.map((inst: any) => ({
              id: inst.id,
              label: `${inst.title} — ${fmtDateShort(inst.startDate)}`,
              startDate: inst.startDate ?? null,
              location: inst.venueCity
                ? [inst.venueCity, inst.venueState].filter(Boolean).join(", ")
                : inst.locationType === "virtual" ? "Virtual" : null,
            }))}
          />
        </TabsContent>
      </Tabs>

      {/* ── Instance Dialog ── */}
      <Dialog open={instanceDialogOpen} onOpenChange={setInstanceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInstance ? "Edit Instance" : "Add Instance"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Instance Title *</Label>
              <Input value={instTitle} onChange={e => setInstTitle(e.target.value)} className="mt-1 text-sm" placeholder="e.g. Columbus, OH — August 2025" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={instDescription} onChange={e => setInstDescription(e.target.value)} className="mt-1 text-sm" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date & Time *</Label>
                <Input type="datetime-local" value={instStartDate} onChange={e => setInstStartDate(e.target.value)} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">End Date & Time</Label>
                <Input type="datetime-local" value={instEndDate} onChange={e => setInstEndDate(e.target.value)} className="mt-1 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Timezone</Label>
                <Select value={instTimezone} onValueChange={setInstTimezone}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska (AKT)</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii (HT)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Location Type</Label>
                <Select value={instLocationType} onValueChange={v => setInstLocationType(v as any)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="virtual">Virtual</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(instLocationType === "in_person" || instLocationType === "hybrid") && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Venue Name</Label>
                  <Input value={instVenueName} onChange={e => setInstVenueName(e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">City</Label>
                  <Input value={instVenueCity} onChange={e => setInstVenueCity(e.target.value)} className="mt-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">State</Label>
                  <Input value={instVenueState} onChange={e => setInstVenueState(e.target.value)} className="mt-1 text-sm" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Price ($) — leave blank to use workshop default</Label>
                <Input
                  type="number"
                  value={instPrice}
                  onChange={e => setInstPrice(e.target.value ? Number(e.target.value) : "")}
                  className="mt-1 text-sm"
                  min={0}
                  step={0.01}
                  placeholder="e.g. 2297"
                />
              </div>
              <div>
                <Label className="text-xs">Capacity (leave blank for unlimited)</Label>
                <Input
                  type="number"
                  value={instCapacity}
                  onChange={e => setInstCapacity(e.target.value ? Number(e.target.value) : "")}
                  className="mt-1 text-sm"
                  min={1}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sales Open Date (optional)</Label>
                <Input type="datetime-local" value={instSalesOpenDate} onChange={e => setInstSalesOpenDate(e.target.value)} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Sales Close Date (optional)</Label>
                <Input type="datetime-local" value={instSalesCloseDate} onChange={e => setInstSalesCloseDate(e.target.value)} className="mt-1 text-sm" />
                <p className="text-xs text-gray-400 mt-0.5">If blank, auto-closes when start date passes</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Enrollment Close Date (optional)</Label>
                <Input type="date" value={instEnrollmentCloseDate} onChange={e => setInstEnrollmentCloseDate(e.target.value)} className="mt-1 text-sm" />
                <p className="text-xs text-gray-400 mt-0.5">Block new enrollments after this date</p>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Instance Content (Rich Text)</Label>
              <p className="text-xs text-gray-400 mb-1">Optional rich text shown on the workshop page for this specific instance (agenda, location details, instructor bio, etc.)</p>
              <RichTextEditor value={instContent} onChange={setInstContent} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Instance Status</Label>
                <Select value={instStatus} onValueChange={v => setInstStatus(v as any)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch checked={instAvailableForPurchase} onCheckedChange={setInstAvailableForPurchase} id="instAvail" />
                  <Label htmlFor="instAvail" className="text-sm">Available for purchase on sales page</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstanceDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={saveInstance}
              disabled={!instTitle || !instStartDate || createInstanceMutation.isPending || updateInstanceMutation.isPending}
            >
              {editingInstance ? "Update Instance" : "Create Instance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Resource Dialog ── */}
      <Dialog open={resourceDialogOpen} onOpenChange={setResourceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Edit Resource" : "Add Resource"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={resTitle} onChange={e => setResTitle(e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={resDescription} onChange={e => setResDescription(e.target.value)} className="mt-1 text-sm" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={resActionType} onValueChange={v => setResActionType(v as any)}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link (URL)</SelectItem>
                  <SelectItem value="download">Download (File)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {resActionType === "link" ? (
              <div>
                <Label className="text-xs">URL</Label>
                <Input value={resLinkUrl} onChange={e => setResLinkUrl(e.target.value)} className="mt-1 text-sm" placeholder="https://…" />
              </div>
            ) : (
              <div>
                <Label className="text-xs">File URL</Label>
                <Input value={resFileUrl} onChange={e => setResFileUrl(e.target.value)} className="mt-1 text-sm" placeholder="https://…" />
              </div>
            )}
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={resStatus} onValueChange={v => setResStatus(v as any)}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResourceDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={saveResource}
              disabled={!resTitle || createResourceMutation.isPending || updateResourceMutation.isPending}
            >
              {editingResource ? "Update" : "Add Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Grant Enrollment Dialog ── */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grant Workshop Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Grant a user access to a specific workshop instance. Enter the user's email and select an instance.
            </p>
            <div>
              <Label className="text-xs">User Email</Label>
              <Input value={grantEmail} onChange={e => setGrantEmail(e.target.value)} className="mt-1 text-sm" placeholder="user@example.com" />
            </div>
            <div>
              <Label className="text-xs">Instance</Label>
              <Select value={String(grantInstanceId)} onValueChange={v => setGrantInstanceId(Number(v))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Select instance…" /></SelectTrigger>
                <SelectContent>
                  {instances.map((inst: any) => (
                    <SelectItem key={inst.id} value={String(inst.id)}>
                      {inst.title} — {fmtDateShort(inst.startDate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!grantEmail || !grantInstanceId}
              onClick={() => {
                // Note: grantEnrollment takes userId, not email. Show info toast.
                toast.info("To grant access by email, look up the user ID in the Users admin and use the grantEnrollment procedure directly.");
                setGrantDialogOpen(false);
              }}
            >
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── After Purchase Section ────────────────────────────────────────────────────
function WorkshopAfterPurchaseSection({ workshopId }: { workshopId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.workshopAdmin.getAfterPurchaseWorkflow.useQuery({ workshopId });
  const saveMut = trpc.workshopAdmin.updateAfterPurchaseWorkflow.useMutation({
    onSuccess: () => { utils.workshopAdmin.getAfterPurchaseWorkflow.invalidate({ workshopId }); toast.success("After purchase workflow saved"); },
    onError: (e) => toast.error(e.message),
  });
  const { data: hideData } = trpc.workshopAdmin.getHidePricingOptions.useQuery({ workshopId });
  const hideToggleMut = trpc.workshopAdmin.updateHidePricingOptions.useMutation({
    onSuccess: () => { utils.workshopAdmin.getHidePricingOptions.invalidate({ workshopId }); toast.success("Setting saved"); },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>;
  return (
    <div className="space-y-4">
      <HidePricingOptionsToggle
        value={hideData?.hidePricingOptions ?? false}
        onChange={(v) => hideToggleMut.mutate({ workshopId, hidePricingOptions: v })}
      />
      <AfterPurchaseWorkflowEditor
        value={data?.afterPurchaseWorkflow ?? null}
        onChange={(workflow) => saveMut.mutate({ workshopId, workflow })}
      />
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────
export function WorkshopsAdmin({ initialEditId, onTypeChangedFromWorkshop }: { initialEditId?: number; onTypeChangedFromWorkshop?: (newCourseId: number, newType: string) => void }) {
  const [editingId, setEditingId] = useState<number | null>(initialEditId ?? null);

  if (editingId !== null) {
    return <WorkshopEditor workshopId={editingId} onBack={() => setEditingId(null)} onTypeChangedFromWorkshop={onTypeChangedFromWorkshop} />;
  }
  return <WorkshopsList onEdit={setEditingId} />;
}

// ── WaitlistSettingsTab ────────────────────────────────────────────────────────
function WaitlistSettingsTab({ workshopId }: { workshopId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.workshopAdmin.getWaitlistSettings.useQuery({ workshopId });
  const { data: entries = [] } = trpc.workshopAdmin.getWaitlistEntries.useQuery({ workshopId });

  const [enabled, setEnabled] = useState(false);
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  // Grant access dialog
  const [grantEntry, setGrantEntry] = useState<any>(null);
  const [grantType, setGrantType] = useState<"free" | "paid">("paid");
  const [priceOverride, setPriceOverride] = useState("");

  useEffect(() => {
    if (data) {
      setEnabled(data.waitlistEnabled ?? false);
      setHeading(data.waitlistHeading ?? "");
      setBody(data.waitlistBody ?? "");
      setCtaLabel(data.waitlistCtaLabel ?? "");
      setCtaUrl(data.waitlistCtaUrl ?? "");
      setRedirectUrl(data.waitlistRedirectUrl ?? "");
      setSuccessMessage(data.waitlistSuccessMessage ?? "");
      setDirty(false);
    }
  }, [data]);

  const saveMutation = trpc.workshopAdmin.saveWaitlistSettings.useMutation({
    onSuccess: () => {
      toast.success("Waitlist settings saved");
      utils.workshopAdmin.getWaitlistSettings.invalidate({ workshopId });
      setDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSave() {
    saveMutation.mutate({
      workshopId,
      waitlistEnabled: enabled,
      waitlistHeading: heading || null,
      waitlistBody: body || null,
      waitlistCtaLabel: ctaLabel || null,
      waitlistCtaUrl: ctaUrl || null,
      waitlistRedirectUrl: redirectUrl || null,
      waitlistSuccessMessage: successMessage || null,
    });
  }

  if (isLoading) return <div className="py-8 text-center text-sm text-gray-400">Loading waitlist settings…</div>;

  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-gray-900">Enable Waiting List Mode</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When enabled AND no active enrolling instance exists, all CTAs on the workshop landing page will collect waitlist sign-ups instead of directing to checkout.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={v => { setEnabled(v); setDirty(true); }} />
          </div>
        </CardContent>
      </Card>

      {/* Waitlist form settings */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Waitlist Form & Messaging</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Heading</Label>
            <Input
              value={heading}
              onChange={e => { setHeading(e.target.value); setDirty(true); }}
              className="mt-1 text-sm"
              placeholder="Join the Waitlist"
            />
          </div>
          <div>
            <Label className="text-xs">Body / Intro Text (Rich Text)</Label>
            <div className="mt-1">
              <RichTextEditor value={body} onChange={v => { setBody(v); setDirty(true); }} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Success Message (shown after sign-up, Rich Text)</Label>
            <div className="mt-1">
              <RichTextEditor value={successMessage} onChange={v => { setSuccessMessage(v); setDirty(true); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA / Redirect */}
      <Card>
        <CardHeader><CardTitle className="text-sm">CTA Actions & Redirects</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">CTA Button Label (optional override)</Label>
              <Input
                value={ctaLabel}
                onChange={e => { setCtaLabel(e.target.value); setDirty(true); }}
                className="mt-1 text-sm"
                placeholder="Join Waitlist"
              />
            </div>
            <div>
              <Label className="text-xs">CTA Button URL (optional — overrides form)</Label>
              <Input
                value={ctaUrl}
                onChange={e => { setCtaUrl(e.target.value); setDirty(true); }}
                className="mt-1 text-sm"
                placeholder="https://…"
              />
              <p className="text-xs text-gray-400 mt-0.5">If set, CTA navigates to this URL instead of opening the sign-up form.</p>
            </div>
          </div>
          <div>
            <Label className="text-xs">Post-Sign-Up Redirect URL (optional)</Label>
            <Input
              value={redirectUrl}
              onChange={e => { setRedirectUrl(e.target.value); setDirty(true); }}
              className="mt-1 text-sm"
              placeholder="https://… (leave blank to show success message inline)"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || !dirty}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm"
        >
          {saveMutation.isPending ? "Saving…" : "Save Waitlist Settings"}
        </Button>
      </div>

      {/* Waitlist entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Waitlist Sign-Ups ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No sign-ups yet.</p>
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => {
                  const csv = ["Name,Email,Phone,Message,Date", ...entries.map((e: any) => [
                    `"${(e.name||'').replace(/"/g,'""')}"`,
                    `"${(e.email||'').replace(/"/g,'""')}"`,
                    `"${(e.phone||'').replace(/"/g,'""')}"`,
                    `"${(e.message||'').replace(/"/g,'""')}"`,
                    `"${new Date(e.createdAt).toISOString()}"`,
                  ].join(','))].join('\n');
                  const a = document.createElement('a');
                  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                  a.download = `waitlist-workshop-${workshopId}.csv`;
                  a.click();
                }}><Download className="w-3 h-3" />Export CSV</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Message</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{e.name}</TableCell>
                      <TableCell className="text-xs">{e.email}</TableCell>
                      <TableCell className="text-xs">{e.phone ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{e.message ?? "—"}</TableCell>
                      <TableCell className="text-xs">{new Date(e.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => { setGrantEntry(e); setGrantType("paid"); setPriceOverride(""); }}>
                          <UserCheck className="w-3 h-3" />Grant Access
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
