/**
 * GeneralFormBuilder.tsx
 * Full-featured General Form Builder admin page.
 * Tabs: Editor | Style/Branding | Share | Settings | Analytics
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  ChevronLeft,
  Trash2,
  Edit2,
  Copy,
  MoreVertical,
  Globe,
  Lock,
  BarChart2,
  Share2,
  Settings,
  Palette,
  FileText,
  ChevronUp,
  ChevronDown,
  Link2,
  Code2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  GripVertical,
  Eye,
  EyeOff,
  Download,
  Search,
  X,
  Layers,
  Sparkles,
  GitBranch,
  AlertTriangle,
  Info,
  Plug,
  Webhook,
  Code,
  Zap,
  Check,
  Save,
  Shield,
  Trophy,
  Radio,
  Type,
  MinusCircle,
  PlusCircle,
  Hash,
  Calendar,
  Clock,
  Mail,
  Phone,
  Upload,
  Star,
  SlidersHorizontal,
  ToggleLeft,
  CreditCard,
  AlignLeft,
  Minus,
  Pen,
  ChevronRight,
  MousePointer,
} from "lucide-react";
import { PublishDomainSelect } from "@/components/PublishDomainSelect";
import RichTextEditor, { RichTextDisplay } from "@/components/RichTextEditor";
import FormEmbedSharePanel from "@/components/admin/FormEmbedSharePanel";
import FormSuccessModulesTab from "@/components/admin/FormSuccessModulesTab";
import FormResultsTable from "@/components/admin/FormResultsTable";
import FormAnalyticsDeep from "@/components/admin/FormAnalyticsDeep";
import { mergeExtraConfig, isAdminOnlyItem, type SavedResultsFilter, type FormActionConfig } from "@shared/formItemUtils";
import FormStripeSettingsPanel, { type FormStripeSettings } from "@/components/admin/FormStripeSettingsPanel";

// ─── Constants ────────────────────────────────────────────────────────────────
const BRAND = "#0e7490";

const FORM_TYPES = [
  { value: "general", label: "General Form" },
  { value: "survey", label: "Survey" },
  { value: "quiz", label: "Quiz / Assessment" },
  { value: "registration", label: "Registration" },
  { value: "contact", label: "Contact Form" },
  { value: "feedback", label: "Feedback Form" },
  { value: "application", label: "Application" },
  { value: "order", label: "Order Form" },
  { value: "custom", label: "Custom" },
];

const ITEM_TYPES = [
  { value: "short_text", label: "Short Answer", icon: "T" },
  { value: "long_text", label: "Long Answer", icon: "¶" },
  { value: "email", label: "Email Address", icon: "@" },
  { value: "phone", label: "Phone Number", icon: "☎" },
  { value: "number", label: "Number", icon: "#" },
  { value: "date", label: "Date", icon: "📅" },
  { value: "time", label: "Time", icon: "⏰" },
  { value: "dropdown", label: "Dropdown", icon: "▼" },
  { value: "radio", label: "Radio Button", icon: "◉" },
  { value: "checkbox", label: "Checkbox", icon: "☑" },
  { value: "rating", label: "Rating (1–5 stars)", icon: "★" },
  { value: "scale", label: "Scale / Slider", icon: "↔" },
  { value: "yes_no", label: "Yes / No", icon: "Y/N" },
  { value: "file_upload", label: "File Upload", icon: "📎" },
  { value: "section_break", label: "Section Break", icon: "—" },
  { value: "rich_text", label: "Rich Text", icon: "✦" },
  { value: "signature", label: "Signature", icon: "✍" },
  { value: "payment", label: "Payment (Stripe)", icon: "💳" },
];

// Formsite-style field palette groups
const FIELD_PALETTE_GROUPS = [
  {
    title: "Common Items",
    items: [
      { value: "radio", label: "Radio Button", Icon: Radio },
      { value: "dropdown", label: "Dropdown", Icon: ChevronDown },
      { value: "checkbox", label: "Checkbox", Icon: Check },
      { value: "email", label: "Email Address", Icon: Mail },
      { value: "short_text", label: "Short Answer", Icon: Type },
      { value: "long_text", label: "Long Answer", Icon: AlignLeft },
      { value: "file_upload", label: "File Upload", Icon: Upload },
      { value: "number", label: "Number", Icon: Hash },
      { value: "date", label: "Date", Icon: Calendar },
      { value: "time", label: "Time", Icon: Clock },
      { value: "phone", label: "Phone Number", Icon: Phone },
      { value: "signature", label: "Signature", Icon: Pen },
    ],
  },
  {
    title: "Formatting Items",
    items: [
      { value: "section_break", label: "Section Break", Icon: Minus },
      { value: "rich_text", label: "Rich Text", Icon: FileText },
    ],
  },
  {
    title: "Special Items",
    items: [
      { value: "rating", label: "Rating", Icon: Star },
      { value: "scale", label: "Scale / Slider", Icon: SlidersHorizontal },
      { value: "yes_no", label: "Yes / No", Icon: ToggleLeft },
      { value: "payment", label: "Payment (Stripe)", Icon: CreditCard },
    ],
  },
];

const DEFAULT_THEME = {
  backgroundColor: "#ffffff",
  formBackground: "#f9fafb",
  primaryColor: "#0e7490",
  textColor: "#111827",
  labelColor: "#374151",
  borderColor: "#d1d5db",
  borderRadius: "8",
  fontFamily: "Inter, sans-serif",
  fontSize: "15",
  buttonColor: "#0e7490",
  buttonTextColor: "#ffffff",
  headerBackground: "#0e7490",
  headerTextColor: "#ffffff",
  showLogo: false,
  logoUrl: "",
  headerTitle: "",
  headerSubtitle: "",
  // Layout
  layoutMode: "condensed" as "condensed" | "fullpage",
  stickyHeader: false,
  // Background
  bgType: "color" as "color" | "gradient" | "image" | "transparent",
  bgGradientFrom: "#e0f7fa",
  bgGradientTo: "#ffffff",
  bgGradientAngle: 135,
  bgImageUrl: "",
  bgOpacity: 100,
  // Card
  cardShadow: "md" as "none" | "sm" | "md" | "lg",
  cardBgOpacity: 100,
  // Dropdown accent
  dropdownAccentColor: "#1d6fa4",
  // Welcome / Start page
  welcomeBgColor: "#0e7490",
  welcomeTextColor: "#ffffff",
  welcomeButtonColor: "#ffffff",
  welcomeButtonTextColor: "#0e7490",
  // Page transition animation
  pageAnimation: "slideUp" as "fade" | "slideUp" | "slideDown" | "slideLeft" | "slideRight" | "bounce" | "zoom" | "none",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  if (status === "open") return <Badge className="bg-green-100 text-green-700 border-green-200">Open</Badge>;
  if (status === "closed") return <Badge className="bg-red-100 text-red-700 border-red-200">Closed</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Draft</Badge>;
}

// All custom domains hosted on this platform
const CUSTOM_DOMAINS = [
  "app.allaboutultrasound.com",
  "members.allaboutultrasound.com",
  "learn.allaboutultrasound.com",
  "accreditation.iheartecho.com",
  "ultrasound-urcfdrve.manus.space",
  "ultrasoundassist.manus.space",
];
const DEFAULT_HOST_DOMAIN = "app.allaboutultrasound.com";

function getPublicUrl(slug: string, hostDomain?: string | null) {
  const domain = hostDomain || DEFAULT_HOST_DOMAIN;
  return `https://${domain}/forms/${slug}`;
}

// ─── Form List ────────────────────────────────────────────────────────────────
function FormList({ onSelect }: { onSelect: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "draft">("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("general");
  const [newDesc, setNewDesc] = useState("");
  const [importUrl, setImportUrl] = useState("");

  const { data, isLoading, refetch } = trpc.generalForm.listForms.useQuery({
    page,
    pageSize: 20,
    search: search || undefined,
    status: statusFilter,
  });

  const createMutation = trpc.generalForm.createForm.useMutation({
    onSuccess: (form) => {
      toast.success("Form created");
      setShowCreate(false);
      setNewName(""); setNewType("general"); setNewDesc("");
      refetch();
      onSelect(form.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const importMutation = trpc.generalForm.importFormByUrl.useMutation({
    onSuccess: (form) => {
      toast.success("Form imported from URL");
      setShowImport(false);
      setImportUrl("");
      refetch();
      onSelect(form.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.generalForm.deleteForm.useMutation({
    onSuccess: () => { toast.success("Form deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const duplicateMutation = trpc.generalForm.duplicateForm.useMutation({
    onSuccess: (form) => { toast.success("Form duplicated"); refetch(); onSelect(form.id); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Platform Admin breadcrumb */}
      <div className="mb-1">
        <Link href="/platform-admin" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#189aa1] transition-colors">
          <ChevronLeft className="w-3 h-3" /> Platform Admin
        </Link>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">Build public forms, surveys, and quizzes with branding, analytics, and share links</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/general-forms/analytics-dashboard">
            <Button variant="outline" className="gap-2">
              <BarChart2 className="w-4 h-4" /> Analytics Dashboards
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
            <Link2 className="w-4 h-4" /> Import by URL
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2 text-white" style={{ background: BRAND }}>
            <Plus className="w-4 h-4" /> New Form
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search forms…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v as any); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Form list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : !data?.forms?.length ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No forms yet</p>
          <p className="text-sm mt-1">Create your first form or import one from a URL</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.forms.map((form: any) => (
            <div
              key={form.id}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-[#0e7490]/30 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => onSelect(form.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900 truncate">{form.name}</span>
                  {statusBadge(form.status)}
                  {form.isPublic && <Badge className="bg-blue-50 text-blue-600 border-blue-200"><Globe className="w-3 h-3 mr-1" />Public</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{FORM_TYPES.find(t => t.value === form.formType)?.label ?? form.formType}</span>
                  <span>·</span>
                  <span>{form.submissionCount ?? 0} submissions</span>
                  {form.publicSlug && <><span>·</span><span className="font-mono">/forms/{form.publicSlug}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={() => onSelect(form.id)} className="gap-1 text-xs">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => duplicateMutation.mutate({ id: form.id })}>
                      <Copy className="w-4 h-4 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    {form.publicSlug && (
                      <DropdownMenuItem onClick={() => window.open(getPublicUrl(form.publicSlug, form.hostDomain), "_blank")}>
                        <ExternalLink className="w-4 h-4 mr-2" /> View Public Form
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => { if (confirm("Delete this form and all its submissions?")) deleteMutation.mutate({ id: form.id }); }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Form</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Form Name *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Patient Feedback Survey" className="mt-1" />
            </div>
            <div>
              <Label>Form Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description of this form" className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newName.trim(), formType: newType, description: newDesc || undefined })}
              className="text-white gap-2"
              style={{ background: BRAND }}
            >
              {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import by URL dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" /> Import Form by URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">
              Paste the URL of an existing form (Formsite, Google Forms, Typeform, etc.) and AI will scaffold a matching form structure for you.
            </p>
            <div>
              <Label>Form URL</Label>
              <Input
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://example.com/your-form"
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button
              disabled={!importUrl.trim() || importMutation.isPending}
              onClick={() => importMutation.mutate({ url: importUrl.trim() })}
              className="text-white gap-2"
              style={{ background: "#d97706" }}
            >
              {importMutation.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Importing…</> : <><Sparkles className="w-4 h-4" /> Import & Build</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Form Editor ──────────────────────────────────────────────────────────────
function FormEditor({ formId }: { formId: number }) {
  const utils = trpc.useUtils();
  const { data: formData, isLoading, refetch } = trpc.generalForm.getForm.useQuery({ id: formId });

  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [addingToSection, setAddingToSection] = useState<number | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");

  const createSection = trpc.generalForm.createSection.useMutation({
    onSuccess: () => { refetch(); setShowAddSection(false); setNewSectionTitle(""); },
    onError: (e) => toast.error(e.message),
  });
  const updateSection = trpc.generalForm.updateSection.useMutation({
    onSuccess: () => { refetch(); setEditingSection(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSection = trpc.generalForm.deleteSection.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const createItem = trpc.generalForm.createItem.useMutation({
    onSuccess: (data: any) => {
      refetch();
      setAddingToSection(null);
      setNewItemLabel("");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateItem = trpc.generalForm.updateItem.useMutation({
    onSuccess: () => { refetch(); setEditingItem(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteItem = trpc.generalForm.deleteItem.useMutation({
    onSuccess: () => { refetch(); setSelectedItemId(null); },
    onError: (e) => toast.error(e.message),
  });
  const duplicateItem = trpc.generalForm.createItem.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const replaceOptions = trpc.generalForm.replaceOptions.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const reorderItems = trpc.generalForm.reorderItems.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) return <div className="flex items-center justify-center py-16 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading…</div>;
  if (!formData) return <div className="text-center py-16 text-gray-400">Form not found</div>;

  const { template, sections, items, options } = formData;

  const getItemsForSection = (sectionId: number) =>
    items.filter((i: any) => i.sectionId === sectionId).sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const getOptionsForItem = (itemId: number) =>
    options.filter((o: any) => o.itemId === itemId).sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const hasOptions = (type: string) => ["dropdown", "radio", "checkbox"].includes(type);

  // Render a live preview of a form item (Formsite-style canvas)
  const renderItemPreview = (item: any, itemOpts: any[]) => {
    const labelEl = (
      <div className="font-medium text-gray-800 mb-1.5">
        {item.label}
        {item.isRequired && <span className="text-red-500 ml-1">*</span>}
      </div>
    );
    const helpEl = item.helpText ? <p className="text-xs text-gray-400 mb-1.5">{item.helpText}</p> : null;
    switch (item.itemType) {
      case "radio":
        return <div>{labelEl}{helpEl}{itemOpts.map((o: any) => <div key={o.id} className="flex items-center gap-2 py-0.5"><div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" /><span className="text-sm text-gray-700">{o.label}</span></div>)}</div>;
      case "checkbox":
        return <div>{labelEl}{helpEl}{itemOpts.map((o: any) => <div key={o.id} className="flex items-center gap-2 py-0.5"><div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" /><span className="text-sm text-gray-700">{o.label}</span></div>)}</div>;
      case "dropdown":
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-400 bg-white flex items-center justify-between"><span>{itemOpts[0]?.label ?? "Select…"}</span><ChevronDown className="w-3.5 h-3.5" /></div></div>;
      case "short_text":
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-300 bg-white">{item.placeholder || "Short answer"}</div></div>;
      case "long_text":
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-300 bg-white h-16">{item.placeholder || "Long answer"}</div></div>;
      case "email":
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-300 bg-white">{item.placeholder || "email@example.com"}</div></div>;
      case "phone":
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-300 bg-white">{item.placeholder || "(555) 000-0000"}</div></div>;
      case "number":
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-300 bg-white w-32">{item.placeholder || "0"}</div></div>;
      case "date":
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-300 bg-white w-40">MM/DD/YYYY</div></div>;
      case "time":
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-300 bg-white w-32">HH:MM</div></div>;
      case "file_upload":
        return <div>{labelEl}{helpEl}<div className="border-2 border-dashed border-gray-300 rounded px-4 py-3 text-sm text-gray-400 text-center">Click to upload or drag & drop</div></div>;
      case "signature":
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-6 text-sm text-gray-300 text-center bg-white">Sign here</div></div>;
      case "rating":
        return <div>{labelEl}{helpEl}<div className="flex gap-1">{[1,2,3,4,5].map(n => <Star key={n} className="w-6 h-6 text-gray-300" />)}</div></div>;
      case "yes_no":
        return <div>{labelEl}{helpEl}<div className="flex gap-3"><div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-gray-300" /><span className="text-sm">Yes</span></div><div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-gray-300" /><span className="text-sm">No</span></div></div></div>;
      case "section_break":
        return <div className="border-t-2 border-gray-200 pt-2"><span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{item.label}</span></div>;
      case "rich_text":
        return <div className="text-sm text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: item.label }} />;
      case "payment":
        return <div>{labelEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-300 bg-white flex items-center gap-2"><CreditCard className="w-4 h-4" />Card number</div></div>;
      default:
        return <div>{labelEl}{helpEl}<div className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-300 bg-white">{item.itemType}</div></div>;
    }
  };

  return (
    <div className="flex gap-0 min-h-[600px]">
      {/* ── Left sidebar: field palette ── */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        <div className="p-3 space-y-4">
          {FIELD_PALETTE_GROUPS.map(group => (
            <div key={group.title}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">{group.title}</p>
              <div className="grid grid-cols-2 gap-1">
                {group.items.map(fieldType => {
                  const Icon = fieldType.Icon;
                  return (
                    <button
                      key={fieldType.value}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border border-gray-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 text-gray-600 hover:text-cyan-700 transition-colors text-center cursor-pointer"
                      onClick={() => {
                        // Add to the first section, or prompt to create one
                        const targetSection = sections[sections.length - 1];
                        if (!targetSection) {
                          toast.error("Add a section first");
                          return;
                        }
                        const label = fieldType.label;
                        createItem.mutate({ templateId: formId, sectionId: targetSection.id, itemType: fieldType.value, label });
                      }}
                      title={`Add ${fieldType.label}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] leading-tight">{fieldType.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Center canvas ── */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-2xl mx-auto py-6 px-4 space-y-0">
          {sections.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <Layers className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-400 font-medium">No sections yet</p>
              <p className="text-sm text-gray-400 mt-1">Add a section to start building your form</p>
              <Button className="mt-4 text-white" style={{ background: BRAND }} onClick={() => setShowAddSection(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Section
              </Button>
            </div>
          ) : (
            sections.map((section: any) => (
              <div key={section.id} className="mb-6">
                {/* Section header bar */}
                <div className="flex items-center gap-2 mb-1 group">
                  <div className="flex-1 bg-gray-800 text-white px-4 py-2.5 rounded-t-lg font-semibold text-sm">
                    {section.title}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingSection(section)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => { if (confirm("Delete this section and all its items?")) deleteSection.mutate({ id: section.id, templateId: formId }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>

                {/* Items canvas */}
                <div className="border border-gray-200 rounded-b-lg divide-y divide-gray-100">
                  {getItemsForSection(section.id).map((item: any, idx: number, arr: any[]) => {
                    const isSelected = selectedItemId === item.id;
                    const itemOpts = getOptionsForItem(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`relative px-5 py-4 cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                      >
                        {/* Live preview */}
                        <div className="pointer-events-none select-none">
                          {renderItemPreview(item, itemOpts)}
                        </div>

                        {/* Inline toolbar (shown when selected) */}
                        {isSelected && (
                          <div className="absolute bottom-2 left-5 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1">
                            <button
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                              onClick={(e) => { e.stopPropagation(); setEditingItem({ ...item, options: itemOpts }); }}
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            <div className="w-px h-4 bg-gray-200" />
                            <button
                              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateItem.mutate({ templateId: formId, sectionId: item.sectionId, itemType: item.itemType, label: item.label + " (copy)" });
                              }}
                            >
                              <Copy className="w-3 h-3" /> Copy
                            </button>
                            <div className="w-px h-4 bg-gray-200" />
                            <button
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                              onClick={(e) => { e.stopPropagation(); if (confirm("Delete this item?")) deleteItem.mutate({ id: item.id, templateId: formId }); }}
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                            <div className="w-px h-4 bg-gray-200" />
                            <button
                              className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1 rounded hover:bg-gray-50 disabled:opacity-30"
                              disabled={idx === 0}
                              onClick={(e) => { e.stopPropagation(); const ids = arr.map((a: any) => a.id); [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]; reorderItems.mutate({ templateId: formId, sectionId: section.id, orderedIds: ids }); }}
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1 rounded hover:bg-gray-50 disabled:opacity-30"
                              disabled={idx === arr.length - 1}
                              onClick={(e) => { e.stopPropagation(); const ids = arr.map((a: any) => a.id); [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]; reorderItems.mutate({ templateId: formId, sectionId: section.id, orderedIds: ids }); }}
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {/* Badges */}
                        <div className="absolute top-2 right-3 flex gap-1">
                          {isAdminOnlyItem(item) && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Admin</span>}
                          {item.isRequired && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Required</span>}
                          {item.scoreWeight > 0 && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">{item.scoreWeight}pts</span>}
                        </div>
                      </div>
                    );
                  })}

                  {/* Add item row */}
                  {addingToSection === section.id ? (
                    <div className="px-4 py-3 bg-blue-50/50">
                      <Input
                        value={newItemLabel}
                        onChange={e => setNewItemLabel(e.target.value)}
                        placeholder="Question label… (press Enter to add as Short Answer)"
                        className="bg-white"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter" && newItemLabel.trim()) {
                            createItem.mutate({ templateId: formId, sectionId: section.id, itemType: "short_text", label: newItemLabel.trim() });
                          }
                          if (e.key === "Escape") { setAddingToSection(null); setNewItemLabel(""); }
                        }}
                      />
                      <p className="text-xs text-gray-400 mt-1">Or click a field type in the sidebar to add it here</p>
                    </div>
                  ) : (
                    <div className="px-4 py-2">
                      <button
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-cyan-600 transition-colors"
                        onClick={() => setAddingToSection(section.id)}
                      >
                        <Plus className="w-4 h-4" /> Add Question
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Add section button */}
          {showAddSection ? (
            <div className="flex gap-2 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <Input
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                placeholder="Section title…"
                className="flex-1"
                autoFocus
                onKeyDown={e => e.key === "Enter" && newSectionTitle.trim() && createSection.mutate({ templateId: formId, title: newSectionTitle.trim() })}
              />
              <Button
                disabled={!newSectionTitle.trim() || createSection.isPending}
                onClick={() => createSection.mutate({ templateId: formId, title: newSectionTitle.trim() })}
                className="text-white"
                style={{ background: BRAND }}
              >
                Add Section
              </Button>
              <Button variant="ghost" onClick={() => { setShowAddSection(false); setNewSectionTitle(""); }}><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-2 border-dashed" onClick={() => setShowAddSection(true)}>
              <Plus className="w-4 h-4" /> Add Section
            </Button>
          )}
        </div>
      </div>

      {/* Edit Item Dialog */}
      {editingItem && (
        <ItemEditDialog
          item={editingItem}
          onSave={(updates, newOptions) => {
            updateItem.mutate({ ...updates, id: editingItem.id, templateId: formId });
            if (newOptions !== undefined) {
              replaceOptions.mutate({ itemId: editingItem.id, options: newOptions });
            }
          }}
          onClose={() => setEditingItem(null)}
          scoreEnabled={template.scoreEnabled}
        />
      )}

      {/* Edit Section Dialog */}
      {editingSection && (
        <Dialog open={true} onOpenChange={() => setEditingSection(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Section</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Section Title</Label>
                <Input defaultValue={editingSection.title} id="sec-title" className="mt-1" />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea defaultValue={editingSection.description ?? ""} id="sec-desc" className="mt-1" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSection(null)}>Cancel</Button>
              <Button
                className="text-white"
                style={{ background: BRAND }}
                onClick={() => {
                  const title = (document.getElementById("sec-title") as HTMLInputElement)?.value ?? editingSection.title;
                  const description = (document.getElementById("sec-desc") as HTMLTextAreaElement)?.value ?? "";
                  updateSection.mutate({ id: editingSection.id, templateId: formId, title, description: description || undefined });
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Item Edit Dialog (Formsite-style tabbed) ────────────────────────────────
type ChoiceRow = { id: string; label: string; scoreValue: number };
function genId() { return Math.random().toString(36).slice(2); }

function ItemEditDialog({ item, onSave, onClose, scoreEnabled }: {
  item: any;
  onSave: (updates: any, options?: any[]) => void;
  onClose: () => void;
  scoreEnabled: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"settings" | "default" | "calculations" | "rules">("settings");
  const [label, setLabel] = useState(item.label);
  const [helpText, setHelpText] = useState(item.helpText ?? "");
  const [placeholder, setPlaceholder] = useState(item.placeholder ?? "");
  const [isRequired, setIsRequired] = useState(item.isRequired);
  const [adminOnly, setAdminOnly] = useState(isAdminOnlyItem(item));
  const [scoreWeight, setScoreWeight] = useState(item.scoreWeight ?? 0);
  const [scoringEnabled, setScoringEnabled] = useState(
    scoreEnabled && (item.scoreWeight > 0 || (item.options ?? []).some((o: any) => o.scoreValue > 0))
  );
  const [scoreExplanation, setScoreExplanation] = useState("");
  const [editingChoiceId, setEditingChoiceId] = useState<string | null>(null);
  const [editingChoiceText, setEditingChoiceText] = useState("");

  const [choices, setChoices] = useState<ChoiceRow[]>(() =>
    (item.options ?? []).map((o: any) => ({ id: genId(), label: o.label, scoreValue: o.scoreValue ?? 0 }))
  );

  const hasOptions = ["dropdown", "radio", "checkbox"].includes(item.itemType);
  const fieldTypeInfo = ITEM_TYPES.find(t => t.value === item.itemType);
  const paletteItem = FIELD_PALETTE_GROUPS.flatMap(g => g.items).find(i => i.value === item.itemType);

  const addChoice = () => {
    const newId = genId();
    setChoices(prev => [...prev, { id: newId, label: "", scoreValue: 0 }]);
    setEditingChoiceId(newId);
    setEditingChoiceText("");
  };

  const commitChoiceEdit = () => {
    if (editingChoiceId) {
      if (editingChoiceText.trim()) {
        setChoices(prev => prev.map(c => c.id === editingChoiceId ? { ...c, label: editingChoiceText.trim() } : c));
      } else {
        setChoices(prev => prev.filter(c => c.id !== editingChoiceId || c.label.trim()));
      }
    }
    setEditingChoiceId(null);
    setEditingChoiceText("");
  };

  const moveChoice = (id: string, dir: -1 | 1) => {
    setChoices(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const removeChoice = (id: string) => setChoices(prev => prev.filter(c => c.id !== id));
  const updateChoiceScore = (id: string, val: number) =>
    setChoices(prev => prev.map(c => c.id === id ? { ...c, scoreValue: val } : c));

  const handleSave = () => {
    const updates = {
      label,
      helpText: helpText || undefined,
      placeholder: placeholder || undefined,
      isRequired,
      scoreWeight: scoringEnabled ? scoreWeight : 0,
      extraConfig: mergeExtraConfig(item.extraConfig, { adminOnly }),
    };
    let parsedOptions: any[] | undefined = undefined;
    if (hasOptions) {
      parsedOptions = choices.filter(c => c.label.trim()).map((c, idx) => ({
        label: c.label.trim(),
        value: c.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
        sortOrder: idx,
        scoreValue: c.scoreValue,
      }));
    }
    onSave(updates, parsedOptions);
    onClose();
  };

  const TABS = [
    { id: "settings" as const, label: "Settings" },
    { id: "default" as const, label: "Default Value" },
    ...(hasOptions ? [{ id: "calculations" as const, label: "Calculations" }] : []),
    { id: "rules" as const, label: "Rules" },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            {paletteItem ? <paletteItem.Icon className="w-4 h-4 text-blue-600" /> : <Type className="w-4 h-4 text-blue-600" />}
          </div>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {fieldTypeInfo?.label ?? item.itemType}
          </DialogTitle>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-white">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto bg-white" style={{ maxHeight: "calc(90vh - 185px)" }}>

          {/* ── Settings tab ── */}
          {activeTab === "settings" && (
            <div className="px-6 py-5 space-y-5">
              <div>
                <Label className="font-semibold text-gray-700">Question</Label>
                <Input value={label} onChange={e => setLabel(e.target.value)} className="mt-1.5" autoFocus />
              </div>

              {["short_text", "long_text", "email", "phone", "number"].includes(item.itemType) && (
                <div>
                  <Label className="font-semibold text-gray-700">Placeholder</Label>
                  <Input value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder="Placeholder text…" className="mt-1.5" />
                </div>
              )}

              {/* Choices list */}
              {hasOptions && (
                <div>
                  <Label className="font-semibold text-gray-700">Choices</Label>
                  <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                    {choices.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-400 italic">No choices yet — click + to add</div>
                    )}
                    {choices.map((choice) => (
                      <div
                        key={choice.id}
                        className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                          editingChoiceId === choice.id ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          if (editingChoiceId !== choice.id) {
                            commitChoiceEdit();
                            setEditingChoiceId(choice.id);
                            setEditingChoiceText(choice.label);
                          }
                        }}
                      >
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        {editingChoiceId === choice.id ? (
                          <input
                            autoFocus
                            className="flex-1 text-sm bg-transparent outline-none text-gray-800"
                            value={editingChoiceText}
                            onChange={e => setEditingChoiceText(e.target.value)}
                            onBlur={commitChoiceEdit}
                            onKeyDown={e => {
                              if (e.key === "Enter") { commitChoiceEdit(); setTimeout(addChoice, 0); }
                              if (e.key === "Escape") commitChoiceEdit();
                            }}
                          />
                        ) : (
                          <span className="flex-1 text-sm text-gray-700">
                            {choice.label || <span className="text-gray-300 italic">Empty choice</span>}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Choice action buttons */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors"
                      title="Add choice"
                      onClick={addChoice}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {editingChoiceId && (
                      <>
                        <button
                          className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
                          title="Edit selected"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
                          title="Move up"
                          onClick={() => moveChoice(editingChoiceId!, -1)}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
                          title="Move down"
                          onClick={() => moveChoice(editingChoiceId!, 1)}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                          title="Remove choice"
                          onClick={() => { removeChoice(editingChoiceId!); setEditingChoiceId(null); }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Required */}
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="req-check"
                  checked={isRequired}
                  onCheckedChange={v => setIsRequired(!!v)}
                />
                <Label htmlFor="req-check" className="font-medium cursor-pointer">Required</Label>
              </div>

              {/* Admin Only */}
              {!["section_break", "rich_text", "payment"].includes(item.itemType) && (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                  <Switch checked={adminOnly} onCheckedChange={setAdminOnly} id="admin-only-switch" />
                  <div>
                    <Label htmlFor="admin-only-switch" className="flex items-center gap-1 cursor-pointer">
                      <Shield className="w-3.5 h-3.5 text-amber-600" /> Admin Only
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Hidden from the public form. Visible and editable only in the admin results table.
                    </p>
                  </div>
                </div>
              )}

              {/* Help text */}
              <div>
                <Label className="font-semibold text-gray-700">Help Text</Label>
                <Input
                  value={helpText}
                  onChange={e => setHelpText(e.target.value)}
                  placeholder="Optional hint shown below the question"
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          {/* ── Default Value tab ── */}
          {activeTab === "default" && (
            <div className="px-6 py-5">
              <p className="text-sm text-gray-500 mb-4">Set a pre-filled default value for this field.</p>
              {hasOptions ? (
                <div className="space-y-2">
                  {choices.map(c => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                      <input type={item.itemType === "checkbox" ? "checkbox" : "radio"} name="default-val" className="accent-blue-600" />
                      <span className="text-sm">{c.label || "(empty)"}</span>
                    </label>
                  ))}
                  {choices.length === 0 && <p className="text-sm text-gray-400 italic">Add choices in the Settings tab first.</p>}
                </div>
              ) : (
                <Input placeholder="Default value…" className="max-w-xs" />
              )}
            </div>
          )}

          {/* ── Calculations tab ── */}
          {activeTab === "calculations" && hasOptions && (
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-8">
                {/* Left: per-choice score values */}
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Calculation Values</p>
                  <p className="text-xs text-gray-500 mb-4">Assign a numeric value for each choice.</p>
                  <div className="space-y-2">
                    {choices.map(c => (
                      <div key={c.id} className="flex items-center gap-3">
                        <input
                          type="number"
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={c.scoreValue}
                          onChange={e => updateChoiceScore(c.id, parseInt(e.target.value) || 0)}
                        />
                        <span className="text-sm text-gray-700 flex-1 truncate">{c.label || "(empty)"}</span>
                      </div>
                    ))}
                    {choices.length === 0 && <p className="text-sm text-gray-400 italic">Add choices in the Settings tab first.</p>}
                  </div>
                </div>

                {/* Right: scoring */}
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Scoring</p>
                  <p className="text-xs text-gray-500 mb-4">Useful to make quizzes and tests.</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      id="scoring-check"
                      checked={scoringEnabled}
                      onCheckedChange={v => setScoringEnabled(!!v)}
                    />
                    <Label htmlFor="scoring-check" className="font-medium cursor-pointer">Enable Scoring</Label>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">Include value in Scoring total.</p>
                  {scoringEnabled && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium">Optional explanation</Label>
                      <Textarea
                        value={scoreExplanation}
                        onChange={e => setScoreExplanation(e.target.value)}
                        rows={4}
                        placeholder="Show an explanation for the answer in the Scoring Summary."
                        className="mt-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Rules tab ── */}
          {activeTab === "rules" && (
            <div className="px-6 py-5">
              <p className="text-sm text-gray-500">
                Field-level show/hide rules are configured in the <strong>Logic</strong> tab of the form editor.
              </p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white">
          <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <Info className="w-4 h-4" /> Help
          </button>
          <div className="flex gap-3">
            <Button className="text-white" style={{ background: BRAND }} disabled={!label.trim()} onClick={handleSave}>
              Save
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ColorField helper (module-level to prevent focus loss on re-render) ────────
function ColorField({ label, field, theme, set }: { label: string; field: string; theme: any; set: (k: string, v: any) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={theme[field] as string}
        onChange={e => set(field, e.target.value)}
        className="w-9 h-9 rounded border border-gray-200 cursor-pointer p-0.5"
      />
      <div className="flex-1">
        <Label className="text-xs">{label}</Label>
        <Input
          value={theme[field] as string}
          onChange={e => set(field, e.target.value)}
          className="mt-0.5 h-7 text-xs font-mono"
        />
      </div>
    </div>
  );
}
// ─── Style / Branding Tab ─────────────────────────────────────────────────────
function StyleTab({ formId, template }: { formId: number; template: any }) {
  const [theme, setTheme] = useState<typeof DEFAULT_THEME>(() => {
    try { return { ...DEFAULT_THEME, ...JSON.parse(template.themeSettings ?? "{}") }; }
    catch { return DEFAULT_THEME; }
  });
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const updateTheme = trpc.generalForm.updateTheme.useMutation({
    onSuccess: () => { setSaving(false); toast.success("Theme saved"); },
    onError: (e) => { setSaving(false); toast.error(e.message); },
  });
  const uploadPageMedia = trpc.auth.uploadPageMedia.useMutation();

  const { data: globalThemeData } = trpc.generalForm.getGlobalTheme.useQuery();
  const saveGlobalTheme = trpc.generalForm.saveGlobalTheme.useMutation({
    onSuccess: () => toast.success("Default theme saved — new forms will use this theme"),
    onError: (e) => toast.error(e.message),
  });

  const set = (key: keyof typeof DEFAULT_THEME, val: any) => setTheme(t => ({ ...t, [key]: val }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Logo must be under 10 MB"); return; }
    setLogoUploading(true);
    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
      const result = await uploadPageMedia.mutateAsync({ dataUri, mimeType: file.type, fileName: file.name, context: "form_logo" });
      set("logoUrl", result.url);
      toast.success("Logo uploaded");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    setLogoUploading(false);
    if (logoFileRef.current) logoFileRef.current.value = "";
  };

  const save = () => {
    setSaving(true);
    updateTheme.mutate({ id: formId, themeSettings: JSON.stringify(theme) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Controls */}
      <div className="space-y-5">
        {/* ── Layout ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Layout Mode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Form Layout</Label>
              <div className="flex gap-2">
                {(["condensed", "fullpage"] as const).map(mode => (
                  <button key={mode} type="button"
                    onClick={() => set("layoutMode", mode)}
                    className={`flex-1 py-2 px-3 text-xs rounded border font-medium transition-all ${
                      theme.layoutMode === mode
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}>
                    {mode === "condensed" ? "📦 Condensed (Default)" : "🖥 Full Page"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {theme.layoutMode === "condensed"
                  ? "Centered card with max-width — ideal for embeds and landing pages."
                  : "Form fills the full viewport width — ideal for standalone form pages."}
              </p>
            </div>
            {theme.layoutMode === "fullpage" && (
              <div className="flex items-center gap-2">
                <Switch checked={theme.stickyHeader} onCheckedChange={v => set("stickyHeader", v)} id="sticky-header" />
                <Label htmlFor="sticky-header" className="text-xs">Sticky Header (scrolls with form)</Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Background ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Page Background</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Background Type</Label>
              <div className="flex gap-2">
                {(["color", "gradient", "image", "transparent"] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => set("bgType", t)}
                    className={`flex-1 py-1.5 px-2 text-xs rounded border font-medium transition-all capitalize ${
                      theme.bgType === t
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}>
                    {t === "color" ? "🎨 Color" : t === "gradient" ? "🌈 Gradient" : t === "image" ? "🖼 Image" : "✨ None"}
                  </button>
                ))}
              </div>
            </div>
            {theme.bgType === "color" && (
              <ColorField label="Background Color" field="backgroundColor" theme={theme} set={set} />
            )}
            {theme.bgType === "transparent" && (
              <p className="text-xs text-gray-400">The page background will be transparent — useful for embeds on colored pages.</p>
            )}
            {theme.bgType === "gradient" && (
              <>
                <ColorField label="Gradient From" field="bgGradientFrom" theme={theme} set={set} />
                <ColorField label="Gradient To" field="bgGradientTo" theme={theme} set={set} />
                <div>
                  <Label className="text-xs">Gradient Angle (°)</Label>
                  <Input type="number" min={0} max={360} value={theme.bgGradientAngle}
                    onChange={e => set("bgGradientAngle", parseInt(e.target.value) || 0)}
                    className="mt-1 h-8 text-sm w-24" />
                </div>
              </>
            )}
            {theme.bgType === "image" && (
              <>
                <div>
                  <Label className="text-xs">Background Image URL</Label>
                  <Input value={theme.bgImageUrl} onChange={e => set("bgImageUrl", e.target.value)}
                    placeholder="https://…/background.jpg" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Image Opacity ({theme.bgOpacity}%)</Label>
                  <input type="range" min={10} max={100} value={theme.bgOpacity}
                    onChange={e => set("bgOpacity", parseInt(e.target.value))}
                    className="w-full mt-1 accent-teal-600" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Card Shadow ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Form Card</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Card Shadow</Label>
              <div className="flex gap-2">
                {(["none", "sm", "md", "lg"] as const).map(s => (
                  <button key={s} type="button"
                    onClick={() => set("cardShadow", s)}
                    className={`flex-1 py-1.5 px-2 text-xs rounded border font-medium transition-all ${
                      theme.cardShadow === s
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}>
                    {s === "none" ? "None" : s === "sm" ? "Soft" : s === "md" ? "Medium" : "Strong"}
                  </button>
                ))}
              </div>
            </div>
            <ColorField label="Form Card Background" field="formBackground" theme={theme} set={set} />
            <div>
              <Label className="text-xs">Card Background Opacity ({theme.cardBgOpacity}%)</Label>
              <input type="range" min={10} max={100} value={theme.cardBgOpacity}
                onChange={e => set("cardBgOpacity", parseInt(e.target.value))}
                className="w-full mt-1 accent-teal-600" />
            </div>
          </CardContent>
        </Card>

        {/* ── Dropdown Accent ─────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Interactive Elements</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ColorField label="Dropdown Highlight Color" field="dropdownAccentColor" theme={theme} set={set} />
            <p className="text-xs text-gray-400">Controls the highlight color of selected dropdown options (the blue row).</p>
            <ColorField label="Primary / Accent Color" field="primaryColor" theme={theme} set={set} />
            <p className="text-xs text-gray-400">Used for radio/checkbox focus rings, submit button, and field borders on focus.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Colors</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ColorField label="Page Background" field="backgroundColor" theme={theme} set={set} />
            <ColorField label="Form Card Background" field="formBackground" theme={theme} set={set} />
            <ColorField label="Primary / Accent Color" field="primaryColor" theme={theme} set={set} />
            <ColorField label="Body Text Color" field="textColor" theme={theme} set={set} />
            <ColorField label="Label Color" field="labelColor" theme={theme} set={set} />
            <ColorField label="Border Color" field="borderColor" theme={theme} set={set} />
            <ColorField label="Button Color" field="buttonColor" theme={theme} set={set} />
            <ColorField label="Button Text Color" field="buttonTextColor" theme={theme} set={set} />
            <ColorField label="Header Background" field="headerBackground" theme={theme} set={set} />
            <ColorField label="Header Text Color" field="headerTextColor" theme={theme} set={set} />
          </CardContent>
        </Card>

        {/* ── Welcome / Start Page Colors ──────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Welcome / Start Page Colors</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-400">These colors apply only to the welcome/start screen shown before the form fields.</p>
            <ColorField label="Start Page Background" field="welcomeBgColor" theme={theme} set={set} />
            <ColorField label="Start Page Text Color" field="welcomeTextColor" theme={theme} set={set} />
            <ColorField label="Start Button Color" field="welcomeButtonColor" theme={theme} set={set} />
            <ColorField label="Start Button Text Color" field="welcomeButtonTextColor" theme={theme} set={set} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Typography & Layout</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Font Family</Label>
              <Select value={theme.fontFamily} onValueChange={v => set("fontFamily", v)}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter, sans-serif">Inter (Default)</SelectItem>
                  <SelectItem value="'Merriweather', serif">Merriweather (Serif)</SelectItem>
                  <SelectItem value="'Roboto', sans-serif">Roboto</SelectItem>
                  <SelectItem value="'Open Sans', sans-serif">Open Sans</SelectItem>
                  <SelectItem value="'Lato', sans-serif">Lato</SelectItem>
                  <SelectItem value="'Poppins', sans-serif">Poppins</SelectItem>
                  <SelectItem value="'Source Sans Pro', sans-serif">Source Sans Pro</SelectItem>
                  <SelectItem value="monospace">Monospace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Base Font Size (px)</Label>
              <Input type="number" min={12} max={24} value={theme.fontSize} onChange={e => set("fontSize", e.target.value)} className="mt-1 h-8 text-sm w-24" />
            </div>
            <div>
              <Label className="text-xs">Border Radius (px)</Label>
              <Input type="number" min={0} max={24} value={theme.borderRadius} onChange={e => set("borderRadius", e.target.value)} className="mt-1 h-8 text-sm w-24" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Header / Branding</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Header Title</Label>
              <Input value={theme.headerTitle} onChange={e => set("headerTitle", e.target.value)} placeholder="Your form title in the header" className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Header Subtitle</Label>
              <Input value={theme.headerSubtitle} onChange={e => set("headerSubtitle", e.target.value)} placeholder="Optional subtitle or tagline" className="mt-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={theme.showLogo} onCheckedChange={v => set("showLogo", v)} id="show-logo" />
              <Label htmlFor="show-logo" className="text-xs">Show Logo</Label>
            </div>
            {theme.showLogo && (
              <div className="space-y-2">
                <Label className="text-xs">Logo Image</Label>
                {theme.logoUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={theme.logoUrl} alt="Logo" className="h-10 max-w-[120px] object-contain rounded border border-gray-200 bg-gray-50 p-1" />
                    <div className="flex flex-col gap-1">
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => logoFileRef.current?.click()} disabled={logoUploading}>
                        {logoUploading ? "Uploading…" : "Change"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => set("logoUrl", "")}>Remove</Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs w-full" onClick={() => logoFileRef.current?.click()} disabled={logoUploading}>
                    {logoUploading ? "Uploading…" : "Upload Logo"}
                  </Button>
                )}
                <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <p className="text-[10px] text-gray-400">PNG, JPG, SVG, WebP — max 10 MB</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Page Transition Animation (Typeform / Page-by-Page only) ── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">🎬 Page Transition Animation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-400">Applies to Typeform Style and Page-by-Page display modes.</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "slideUp",    label: "Slide Up",    icon: "↑" },
                { value: "slideDown",  label: "Slide Down",  icon: "↓" },
                { value: "slideLeft",  label: "Slide Left",  icon: "←" },
                { value: "slideRight", label: "Slide Right", icon: "→" },
                { value: "fade",       label: "Fade",        icon: "☀️" },
                { value: "zoom",       label: "Zoom",        icon: "🔍" },
                { value: "bounce",     label: "Bounce",      icon: "⚾" },
                { value: "none",       label: "None",        icon: "⏹" },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("pageAnimation", opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                    (theme.pageAnimation ?? "slideUp") === opt.value
                      ? "border-[#0e7490] bg-[#e0f7fa] text-[#0e7490] font-semibold"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button onClick={save} disabled={saving} className="w-full text-white gap-2" style={{ background: BRAND }}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Theme
          </Button>
          <div className="flex gap-2">
            <Button
              type="button" variant="outline" size="sm" className="flex-1 gap-1 text-xs"
              onClick={() => saveGlobalTheme.mutate({ themeSettings: JSON.stringify(theme) })}
              disabled={saveGlobalTheme.isPending}
            >
              {saveGlobalTheme.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <span>💾</span>}
              Save as Default Theme
            </Button>
            <Button
              type="button" variant="outline" size="sm" className="flex-1 gap-1 text-xs"
              disabled={!globalThemeData}
              onClick={() => {
                if (!globalThemeData) return;
                try {
                  const loaded = { ...DEFAULT_THEME, ...JSON.parse(globalThemeData.themeSettings ?? "{}") };
                  setTheme(loaded);
                  updateTheme.mutate({ id: formId, themeSettings: JSON.stringify(loaded) });
                  toast.success("Default theme loaded");
                } catch { toast.error("Failed to load default theme"); }
              }}
            >
              <span>📥</span> Load Default Theme
            </Button>
          </div>
          {globalThemeData && (
            <p className="text-[10px] text-gray-400 text-center">Default theme last saved: {new Date(globalThemeData.updatedAt ?? Date.now()).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      {/* Live Preview */}
      <div className="sticky top-4">
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Live Preview</p>
        <div
          className="rounded-xl overflow-hidden shadow-lg border border-gray-200"
          style={{ backgroundColor: theme.backgroundColor, fontFamily: theme.fontFamily, fontSize: `${theme.fontSize}px`, color: theme.textColor }}
        >
          {/* Header */}
          <div className="px-6 py-4" style={{ background: theme.headerBackground, color: theme.headerTextColor }}>
            {theme.showLogo && theme.logoUrl && <img src={theme.logoUrl} alt="Logo" className="h-8 mb-2 object-contain" />}
            <div className="font-bold text-lg">{theme.headerTitle || template.name}</div>
            {theme.headerSubtitle && <div className="text-sm opacity-80 mt-0.5">{theme.headerSubtitle}</div>}
          </div>
          {/* Form body */}
          <div className="p-5" style={{ background: theme.formBackground }}>
            <div className="space-y-4">
              {[
                { label: "Sample Short Text Question", type: "text", placeholder: "Your answer…" },
                { label: "Sample Multiple Choice", type: "radio", options: ["Option A", "Option B", "Option C"] },
              ].map((q, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium mb-1" style={{ color: theme.labelColor }}>{q.label}</label>
                  {q.type === "text" ? (
                    <input
                      readOnly
                      placeholder={q.placeholder}
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{
                        border: `1px solid ${theme.borderColor}`,
                        borderRadius: `${theme.borderRadius}px`,
                        background: "#fff",
                        color: theme.textColor,
                      }}
                    />
                  ) : (
                    <div className="space-y-1">
                      {q.options?.map((opt, j) => (
                        <label key={j} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: theme.textColor }}>
                          <input type="radio" readOnly className="accent-current" style={{ accentColor: theme.primaryColor }} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button
                className="w-full py-2.5 text-sm font-semibold mt-2"
                style={{
                  background: theme.buttonColor,
                  color: theme.buttonTextColor,
                  borderRadius: `${theme.borderRadius}px`,
                  border: "none",
                }}
              >
                Submit Form
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Share Tab ────────────────────────────────────────────────────────────────
function ShareTab({ formId, template, onRefetch }: { formId: number; template: any; onRefetch: () => void }) {
  const [slug, setSlug] = useState(template.publicSlug ?? "");
  const [slugEditing, setSlugEditing] = useState(false);
  const [slugInput, setSlugInput] = useState(template.publicSlug ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  const updateSlug = trpc.generalForm.updateSlug.useMutation({
    onSuccess: () => { toast.success("Slug updated"); setSlugEditing(false); onRefetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateForm = trpc.generalForm.updateForm.useMutation({
    onSuccess: () => { toast.success("Saved"); onRefetch(); },
    onError: (e) => toast.error(e.message),
  });

  const publicUrl = template.publicSlug ? getPublicUrl(template.publicSlug, template.hostDomain) : null;
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Visibility */}
      <Card className={template.isPublic ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {template.isPublic
                ? <Globe className="w-6 h-6 text-green-600 mt-0.5 shrink-0" />
                : <Lock className="w-6 h-6 text-amber-500 mt-0.5 shrink-0" />}
              <div>
                <p className="font-semibold text-gray-900 text-base">
                  {template.isPublic ? "Form is Published & Public" : "Form is Private (Draft)"}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {template.isPublic
                    ? "Anyone with the link can view and submit this form."
                    : "Only admins can see this form. Click \"Publish Form\" to make it accessible to the public."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className={`shrink-0 gap-2 ${template.isPublic ? "bg-gray-600 hover:bg-gray-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}
              onClick={() => updateForm.mutate({ id: formId, isPublic: !template.isPublic })}
              disabled={updateForm.isPending}
            >
              {template.isPublic ? <><Lock className="w-3.5 h-3.5" /> Make Private</> : <><Globe className="w-3.5 h-3.5" /> Publish Form</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Public URL */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Link2 className="w-4 h-4" /> Public URL</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {/* Slug editor */}
          <div>
            <Label className="text-xs text-gray-500">URL Slug (editable)</Label>
            {slugEditing ? (
              <div className="flex gap-2 mt-1">
                <div className="flex items-center flex-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <span className="px-3 text-xs text-gray-400 border-r border-gray-200 py-2 bg-gray-100 whitespace-nowrap">{window.location.origin}/forms/</span>
                  <Input
                    value={slugInput}
                    onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="border-0 bg-transparent h-9 font-mono text-sm"
                    autoFocus
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!slugInput.trim() || updateSlug.isPending}
                  onClick={() => updateSlug.mutate({ id: formId, slug: slugInput.trim() })}
                  className="text-white"
                  style={{ background: BRAND }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSlugEditing(false); setSlugInput(template.publicSlug ?? ""); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700">
                  {template.publicSlug ? getPublicUrl(template.publicSlug, template.hostDomain) : <span className="text-gray-400 italic">No slug set</span>}
                </div>
                <Button size="sm" variant="outline" onClick={() => setSlugEditing(true)}>
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              </div>
            )}
          </div>

          {publicUrl && (
            <>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => copy(publicUrl, "url")}
                >
                  {copied === "url" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === "url" ? "Copied!" : "Copy Link"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(publicUrl!, "_blank")}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Form
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(`${publicUrl}/preview`, "_blank")}
                >
                  <Eye className="w-3.5 h-3.5" /> Admin Preview
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <FormEmbedSharePanel formId={formId} publicUrl={publicUrl} hostDomain={template.hostDomain || DEFAULT_HOST_DOMAIN} />
    </div>
  );
}

// ─── Results Settings (saved filters + form actions) ─────────────────────────
function ResultsSettingsPanel({ formId }: { formId: number }) {
  const { data: formData } = trpc.generalForm.getForm.useQuery({ id: formId });
  const { data: resultsSettings, refetch } = trpc.generalForm.getResultsSettings.useQuery({ formId });
  const saveSettings = trpc.generalForm.saveResultsSettings.useMutation({
    onSuccess: () => { toast.success("Results settings saved"); refetch(); },
    onError: e => toast.error(e.message),
  });

  const [savedFilters, setSavedFilters] = useState<SavedResultsFilter[]>([]);
  const [actions, setActions] = useState<FormActionConfig[]>([]);

  useEffect(() => {
    if (resultsSettings) {
      setSavedFilters(resultsSettings.savedFilters ?? []);
      setActions(resultsSettings.actions ?? []);
    }
  }, [resultsSettings]);

  const inputItems = useMemo(
    () => (formData?.items ?? []).filter((it: any) => !["section_break", "rich_text", "payment"].includes(it.itemType)),
    [formData?.items],
  );

  const addFilter = () => {
    const firstField = inputItems[0];
    setSavedFilters(prev => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        name: `Filter ${prev.length + 1}`,
        logic: "AND",
        conditions: firstField
          ? [{ fieldId: String(firstField.id), operator: "contains", value: "" }]
          : [],
      },
    ]);
  };

  const addAction = () => {
    setActions(prev => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        name: `Action ${prev.length + 1}`,
        event: "on_submit",
        type: "email",
        enabled: true,
        emailTo: "",
        emailSubject: "",
      },
    ]);
  };

  const save = () => {
    saveSettings.mutate({ formId, settings: { savedFilters, actions } });
  };

  const OPERATORS = [
    { value: "equals", label: "equals" },
    { value: "contains", label: "contains" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ] as const;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Search className="w-4 h-4" /> Results Table Filters &amp; Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Saved Filters</Label>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addFilter}>
              <Plus className="w-3 h-3 mr-1" /> Add Filter
            </Button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Create named filters for the Results tab dropdown. Each filter defines conditions submissions must match.
          </p>
          {savedFilters.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No saved filters yet.</p>
          ) : (
            <div className="space-y-3">
              {savedFilters.map((filter, fi) => (
                <div key={filter.id} className="border rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <div className="flex gap-2 items-center">
                    <Input
                      value={filter.name}
                      onChange={e => {
                        const v = e.target.value;
                        setSavedFilters(prev => prev.map((f, i) => (i === fi ? { ...f, name: v } : f)));
                      }}
                      className="h-8 text-sm flex-1"
                      placeholder="Filter name"
                    />
                    <Select
                      value={filter.logic}
                      onValueChange={v =>
                        setSavedFilters(prev =>
                          prev.map((f, i) => (i === fi ? { ...f, logic: v as "AND" | "OR" } : f)),
                        )
                      }
                    >
                      <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AND">AND</SelectItem>
                        <SelectItem value="OR">OR</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 h-8 w-8 p-0"
                      onClick={() => setSavedFilters(prev => prev.filter((_, i) => i !== fi))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {filter.conditions.map((cond, ci) => (
                    <div key={ci} className="flex gap-2 items-center flex-wrap">
                      <Select
                        value={cond.fieldId}
                        onValueChange={v =>
                          setSavedFilters(prev =>
                            prev.map((f, i) =>
                              i === fi
                                ? {
                                    ...f,
                                    conditions: f.conditions.map((c, j) =>
                                      j === ci ? { ...c, fieldId: v } : c,
                                    ),
                                  }
                                : f,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {inputItems.map((it: any) => (
                            <SelectItem key={it.id} value={String(it.id)}>
                              {it.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={cond.operator}
                        onValueChange={v =>
                          setSavedFilters(prev =>
                            prev.map((f, i) =>
                              i === fi
                                ? {
                                    ...f,
                                    conditions: f.conditions.map((c, j) =>
                                      j === ci ? { ...c, operator: v as typeof cond.operator } : c,
                                    ),
                                  }
                                : f,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map(op => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-7 text-xs flex-1 min-w-[100px]"
                        value={cond.value}
                        placeholder="Value"
                        onChange={e =>
                          setSavedFilters(prev =>
                            prev.map((f, i) =>
                              i === fi
                                ? {
                                    ...f,
                                    conditions: f.conditions.map((c, j) =>
                                      j === ci ? { ...c, value: e.target.value } : c,
                                    ),
                                  }
                                : f,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      const ff = inputItems[0];
                      setSavedFilters(prev =>
                        prev.map((f, i) =>
                          i === fi
                            ? {
                                ...f,
                                conditions: [
                                  ...f.conditions,
                                  {
                                    fieldId: ff ? String(ff.id) : "",
                                    operator: "contains" as const,
                                    value: "",
                                  },
                                ],
                              }
                            : f,
                        ),
                      );
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add condition
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Form Actions &amp; Workflows</Label>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addAction}>
              <Plus className="w-3 h-3 mr-1" /> Add Action
            </Button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Trigger notifications or webhooks on initial form submit or when results are updated in the admin table.
          </p>
          {actions.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No actions configured.</p>
          ) : (
            <div className="space-y-3">
              {actions.map((action, ai) => (
                <div key={action.id} className="border rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <div className="flex gap-2 items-center">
                    <Switch
                      checked={action.enabled}
                      onCheckedChange={v =>
                        setActions(prev => prev.map((a, i) => (i === ai ? { ...a, enabled: v } : a)))
                      }
                    />
                    <Input
                      value={action.name}
                      onChange={e =>
                        setActions(prev => prev.map((a, i) => (i === ai ? { ...a, name: e.target.value } : a)))
                      }
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 h-8 w-8 p-0"
                      onClick={() => setActions(prev => prev.filter((_, i) => i !== ai))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">When</Label>
                      <Select
                        value={action.event}
                        onValueChange={v =>
                          setActions(prev =>
                            prev.map((a, i) =>
                              i === ai ? { ...a, event: v as FormActionConfig["event"] } : a,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on_submit">On form submit</SelectItem>
                          <SelectItem value="on_update">On results table update</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Action type</Label>
                      <Select
                        value={action.type}
                        onValueChange={v =>
                          setActions(prev =>
                            prev.map((a, i) =>
                              i === ai ? { ...a, type: v as FormActionConfig["type"] } : a,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Send email</SelectItem>
                          <SelectItem value="webhook">Fire webhook</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {action.type === "email" && (
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="Recipient email"
                        value={action.emailTo ?? ""}
                        className="h-8 text-sm"
                        onChange={e =>
                          setActions(prev =>
                            prev.map((a, i) => (i === ai ? { ...a, emailTo: e.target.value } : a)),
                          )
                        }
                      />
                      <Input
                        placeholder="Email subject (optional)"
                        value={action.emailSubject ?? ""}
                        className="h-8 text-sm"
                        onChange={e =>
                          setActions(prev =>
                            prev.map((a, i) => (i === ai ? { ...a, emailSubject: e.target.value } : a)),
                          )
                        }
                      />
                    </div>
                  )}
                  {action.type === "webhook" && (
                    <p className="text-xs text-gray-500">
                      Uses the webhook URL configured in the Integrations tab.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          onClick={save}
          disabled={saveSettings.isPending}
          className="w-full text-white gap-2"
          style={{ background: BRAND }}
        >
          {saveSettings.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Filters &amp; Actions
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab({ formId, template, onRefetch }: { formId: number; template: any; onRefetch: () => void }) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [formType, setFormType] = useState(template.formType ?? "general");
  const [status, setStatus] = useState(template.status ?? "draft");
  const [scoreEnabled, setScoreEnabled] = useState(template.scoreEnabled ?? false);
  const [scoreLabel, setScoreLabel] = useState(template.scoreLabel ?? "Score");
  const [notifyEmail, setNotifyEmail] = useState(template.notifyEmail ?? "");
  const [maxSubmissions, setMaxSubmissions] = useState(template.maxSubmissions?.toString() ?? "");
  const [hostDomain, setHostDomain] = useState(template.hostDomain ?? DEFAULT_HOST_DOMAIN);
  const [displayMode, setDisplayMode] = useState<"classic" | "typeform" | "paginated" | "inline">(template.displayMode ?? "classic");
  const [welcomeTitle, setWelcomeTitle] = useState(template.welcomeTitle ?? "");
  const [welcomeSubtitle, setWelcomeSubtitle] = useState(template.welcomeSubtitle ?? "");
  const [welcomeButtonText, setWelcomeButtonText] = useState(template.welcomeButtonText ?? "");
  const [welcomeImageUrl, setWelcomeImageUrl] = useState(template.welcomeImageUrl ?? "");
  const [submitButtonText, setSubmitButtonText] = useState(template.submitButtonText ?? "");
  const [emailListId, setEmailListId] = useState<number | null>(template.emailListId ?? null);
  const [stripeSettings, setStripeSettings] = useState<FormStripeSettings>({
    stripeEnabled: template.stripeEnabled ?? false,
    stripeCheckoutMode: template.stripeCheckoutMode ?? "payment",
    stripePriceId: template.stripePriceId ?? "",
    stripeAmount: template.stripeAmount ? String(template.stripeAmount / 100) : "",
    stripeSuccessUrl: template.stripeSuccessUrl ?? "",
    stripeCancelUrl: template.stripeCancelUrl ?? "",
  });

  const { data: emailListsData } = trpc.emailCampaign.listEmailLists.useQuery();

  const updateForm = trpc.generalForm.updateForm.useMutation({
    onSuccess: () => { toast.success("Settings saved"); onRefetch(); },
    onError: (e) => toast.error(e.message),
  });

  const save = () => {
    updateForm.mutate({
      id: formId,
      name: name.trim(),
      description: description || undefined,
      formType,
      status: status as any,
      scoreEnabled,
      scoreLabel: scoreLabel || undefined,
      notifyEmail: notifyEmail || undefined,
      maxSubmissions: maxSubmissions ? parseInt(maxSubmissions) : undefined,
      hostDomain,
      displayMode,
      welcomeTitle: welcomeTitle || undefined,
      welcomeSubtitle: welcomeSubtitle || undefined,
      welcomeButtonText: welcomeButtonText || undefined,
      welcomeImageUrl: welcomeImageUrl || undefined,
      submitButtonText: submitButtonText || undefined,
      emailListId: emailListId ?? undefined,
      stripeEnabled: stripeSettings.stripeEnabled,
      stripeCheckoutMode: stripeSettings.stripeCheckoutMode,
      stripePriceId: stripeSettings.stripePriceId || null,
      stripeAmount: stripeSettings.stripeAmount ? Math.round(parseFloat(stripeSettings.stripeAmount) * 100) : null,
      stripeSuccessUrl: stripeSettings.stripeSuccessUrl || null,
      stripeCancelUrl: stripeSettings.stripeCancelUrl || null,
    });
  };

  return (
    <div className="max-w-2xl space-y-5">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">General</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Form Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Form Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open (accepting responses)</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Host Domain</Label>
            <p className="text-xs text-gray-400 mb-1">The domain where this form's public URL will be hosted. "Use global default" follows the platform-wide form domain setting.</p>
            <PublishDomainSelect
              value={hostDomain === DEFAULT_HOST_DOMAIN ? "" : (hostDomain ?? "")}
              onChange={(v) => setHostDomain(v || DEFAULT_HOST_DOMAIN)}
              className="mt-1 w-full text-sm"
            />
            {template.publicSlug && (
              <div className="mt-2 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-600 font-mono truncate">
                  https://{hostDomain || DEFAULT_HOST_DOMAIN}/forms/{template.publicSlug}
                </span>
                <a
                  href={`https://${hostDomain || DEFAULT_HOST_DOMAIN}/forms/${template.publicSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto shrink-0 text-[#0e7490] hover:text-[#0c6478]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Display Mode ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">🖼️ Display Mode</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1 block">How should this form be displayed?</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {([
                { value: "classic", label: "Classic", desc: "Single page with header" },
                { value: "typeform", label: "Typeform Style", desc: "Welcome screen + one question at a time" },
                { value: "paginated", label: "Page by Page", desc: "One question at a time, no welcome screen" },
                { value: "inline", label: "Inline / Embed", desc: "Single page, no header (embed-friendly)" },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDisplayMode(opt.value)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${
                    displayMode === opt.value
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`text-sm font-semibold ${displayMode === opt.value ? "text-teal-700" : "text-gray-700"}`}>{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit button text (all modes) */}
          <div>
            <Label>Submit Button Text</Label>
            <Input value={submitButtonText} onChange={e => setSubmitButtonText(e.target.value)} placeholder="Submit" className="mt-1 w-48" />
          </div>

          {/* Welcome screen fields (typeform mode only) */}
          {displayMode === "typeform" && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Welcome Screen</p>
              <div>
                <Label>Welcome Title</Label>
                <Input value={welcomeTitle} onChange={e => setWelcomeTitle(e.target.value)} placeholder={template.name} className="mt-1" />
              </div>
              <div>
                <Label>Welcome Subtitle</Label>
                <Textarea value={welcomeSubtitle} onChange={e => setWelcomeSubtitle(e.target.value)} placeholder={template.description ?? ""} className="mt-1" rows={2} />
              </div>
              <div>
                <Label>Start Button Text</Label>
                <Input value={welcomeButtonText} onChange={e => setWelcomeButtonText(e.target.value)} placeholder="Start" className="mt-1 w-48" />
              </div>
              <div>
                <Label>Welcome Image URL (optional)</Label>
                <Input value={welcomeImageUrl} onChange={e => setWelcomeImageUrl(e.target.value)} placeholder="https://..." className="mt-1" />
                {welcomeImageUrl && <img src={welcomeImageUrl} alt="Welcome" className="mt-2 rounded-lg max-h-32 object-cover" />}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Scoring</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={scoreEnabled} onCheckedChange={setScoreEnabled} id="score-enabled" />
            <Label htmlFor="score-enabled">Enable Score Calculation</Label>
          </div>
          {scoreEnabled && (
            <div>
              <Label>Score Label (shown on results)</Label>
              <Input value={scoreLabel} onChange={e => setScoreLabel(e.target.value)} placeholder="Score" className="mt-1 w-48" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Post-Submission Success Routing</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Configure multiple success pathways in the <strong>Success Modules</strong> tab — inline thank-you messages, full success pages, and redirects.
            Use routing rules to branch by score, pass/fail, payment, or field answers.
          </p>
          {template.defaultSuccessModuleId ? (
            <p className="text-xs text-gray-500">Default module ID: {template.defaultSuccessModuleId}</p>
          ) : (
            <p className="text-xs text-amber-600">No default success module set yet. Open Success Modules to configure.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Submission Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Notify Email (send a copy of each submission)</Label>
            <Input type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} placeholder="admin@yoursite.com" className="mt-1" />
          </div>
          <div>
            <Label>Max Submissions (leave blank for unlimited)</Label>
            <Input type="number" min={1} value={maxSubmissions} onChange={e => setMaxSubmissions(e.target.value)} placeholder="Unlimited" className="mt-1 w-36" />
          </div>
          <div>
            <Label>Subscribe Submitters to Email List</Label>
            <p className="text-xs text-gray-500 mb-1">When a form is submitted, the submitter's email will be added to this list automatically.</p>
            <Select
              value={emailListId ? String(emailListId) : "none"}
              onValueChange={v => setEmailListId(v === "none" ? null : Number(v))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="None (don't subscribe)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (don't subscribe)</SelectItem>
                {(emailListsData ?? []).map((list: any) => (
                  <SelectItem key={list.id} value={String(list.id)}>{list.name} ({list.subscriberCount} subscribers)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <ResultsSettingsPanel formId={formId} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Stripe Checkout</CardTitle></CardHeader>
        <CardContent>
          <FormStripeSettingsPanel value={stripeSettings} onChange={setStripeSettings} />
        </CardContent>
      </Card>

      <Button onClick={save} disabled={!name.trim() || updateForm.isPending} className="w-full text-white gap-2" style={{ background: BRAND }}>
        {updateForm.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Save Settings
      </Button>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ formId, template }: { formId: number; template: any }) {
  const { data: analytics, isLoading } = trpc.generalForm.getFormAnalytics.useQuery({ id: formId });

  if (isLoading) return <div className="flex items-center justify-center py-16 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading analytics…</div>;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Submissions", value: analytics?.totalSubmissions ?? 0, color: BRAND },
          { label: "Avg Score", value: analytics?.avgScore != null ? `${analytics.avgScore}%` : "N/A", color: "#059669" },
          { label: "Status", value: template.status, color: template.status === "open" ? "#059669" : "#6b7280" },
          { label: "Form Type", value: FORM_TYPES.find(t => t.value === template.formType)?.label ?? template.formType, color: "#7c3aed" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Embed widget analytics */}
      {analytics?.embed && (analytics.embed.loaded > 0 || analytics.embed.opened > 0) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Code2 className="w-4 h-4" /> Embed Widget Analytics</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Loaded", value: analytics.embed.loaded },
                { label: "Viewed", value: analytics.embed.viewed },
                { label: "Opened", value: analytics.embed.opened },
                { label: "Submitted", value: analytics.embed.submitted },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">Conversion rate (submit / open): <strong>{analytics.embed.conversionRate}%</strong></p>
          </CardContent>
        </Card>
      )}

      {/* Daily chart (simple bar) */}
      {analytics?.dailyCounts && analytics.dailyCounts.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4" /> Submissions — Last 30 Days</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24">
              {analytics.dailyCounts.map((d: any, i: number) => {
                const max = Math.max(...analytics.dailyCounts.map((x: any) => Number(x.count)));
                const h = max > 0 ? Math.round((Number(d.count) / max) * 80) : 4;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                      className="w-full rounded-t transition-all"
                      style={{ height: `${h}px`, background: BRAND, opacity: 0.8 }}
                      title={`${d.date}: ${d.count}`}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <FormAnalyticsDeep formId={formId} template={template} />
    </div>
  );
}

// ─── Branching / Logic Tab ─────────────────────────────────────────────────────
type BranchCondition = { id: string; fieldId: string; operator: string; value: string };
type BranchRule = {
  id?: number;
  ruleLabel: string;
  targetType: "item" | "section";
  targetId: number;
  action: "show" | "hide" | "require" | "unrequire";
  logicOperator: "all" | "any";
  conditions: BranchCondition[];
  isEnabled: boolean;
};

const BRANCH_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
];

function BranchingTab({ formId }: { formId: number }) {
  const { data: formData } = trpc.generalForm.getForm.useQuery({ id: formId });
  const { data: existingRules, refetch: refetchRules } = trpc.generalForm.getBranchRules.useQuery({ templateId: formId });
  const upsertRule = trpc.generalForm.upsertBranchRule.useMutation({ onSuccess: () => { toast.success("Rule saved"); refetchRules(); } });
  const deleteRule = trpc.generalForm.deleteBranchRule.useMutation({ onSuccess: () => { toast.success("Rule deleted"); refetchRules(); } });

  const [editingRule, setEditingRule] = useState<BranchRule | null>(null);
  const [editingId, setEditingId] = useState<number | undefined>(undefined);

  const items = useMemo(() => (formData?.items ?? []).filter((it: any) => !["heading", "paragraph", "section_break", "rich_text"].includes(it.itemType)), [formData]);
  const sections = useMemo(() => formData?.sections ?? [], [formData]);

  const newBlankRule = (): BranchRule => ({
    ruleLabel: "",
    targetType: "item",
    targetId: items[0]?.id ?? 0,
    action: "show",
    logicOperator: "all",
    conditions: [{ id: Math.random().toString(36).slice(2), fieldId: items[0] ? String(items[0].id) : "", operator: "equals", value: "" }],
    isEnabled: true,
  });

  const startEdit = (rule?: any) => {
    if (rule) {
      setEditingId(rule.id);
      setEditingRule({
        ruleLabel: rule.ruleLabel ?? "",
        targetType: rule.targetType as any,
        targetId: rule.targetId,
        action: rule.action as any,
        logicOperator: rule.logicOperator as any,
        conditions: (() => { try { return JSON.parse(rule.conditions).map((c: any) => ({ ...c, id: c.id || Math.random().toString(36).slice(2) })); } catch { return []; } })(),
        isEnabled: rule.isEnabled ?? true,
      });
    } else {
      setEditingId(undefined);
      setEditingRule(newBlankRule());
    }
  };

  const saveRule = () => {
    if (!editingRule) return;
    if (!editingRule.targetId) { toast.error("Please select a target field or section"); return; }
    if (editingRule.conditions.length === 0) { toast.error("Add at least one condition"); return; }
    upsertRule.mutate({
      id: editingId,
      templateId: formId,
      ruleLabel: editingRule.ruleLabel,
      targetType: editingRule.targetType,
      targetId: editingRule.targetId,
      action: editingRule.action,
      logicOperator: editingRule.logicOperator,
      conditions: JSON.stringify(editingRule.conditions),
      isEnabled: editingRule.isEnabled,
    });
    setEditingRule(null);
    setEditingId(undefined);
  };

  const addCondition = () => {
    if (!editingRule) return;
    setEditingRule(r => r ? { ...r, conditions: [...r.conditions, { id: Math.random().toString(36).slice(2), fieldId: items[0] ? String(items[0].id) : "", operator: "equals", value: "" }] } : r);
  };

  const updateCondition = (condId: string, updates: Partial<BranchCondition>) => {
    if (!editingRule) return;
    setEditingRule(r => r ? { ...r, conditions: r.conditions.map(c => c.id === condId ? { ...c, ...updates } : c) } : r);
  };

  const removeCondition = (condId: string) => {
    if (!editingRule) return;
    setEditingRule(r => r ? { ...r, conditions: r.conditions.filter(c => c.id !== condId) } : r);
  };

  const getItemLabel = (id: number | string) => {
    const it = (formData?.items ?? []).find((i: any) => String(i.id) === String(id));
    return it ? (it.label || it.itemType) : `Field #${id}`;
  };

  const getTargetLabel = (targetId: number, targetType: string) => {
    if (targetType === "section") {
      const s = sections.find((s: any) => s.id === targetId);
      return s ? (s.title || `Section ${s.id}`) : `Section #${targetId}`;
    }
    return getItemLabel(targetId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Conditional Logic Rules</h3>
          <p className="text-xs text-gray-500 mt-0.5">Show, hide, or require fields based on previous answers.</p>
        </div>
        <Button size="sm" className="gap-1 text-white" style={{ background: BRAND }} onClick={() => startEdit()}>
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </Button>
      </div>

      {!existingRules?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <GitBranch className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No logic rules yet</p>
            <p className="text-xs text-gray-400 mt-1">Add rules to show or hide fields based on answers.</p>
            <Button size="sm" variant="outline" className="mt-4 gap-1" onClick={() => startEdit()}>
              <Plus className="w-3.5 h-3.5" /> Add First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {existingRules.map((rule: any) => {
            let conditions: any[] = [];
            try { conditions = JSON.parse(rule.conditions); } catch {}
            return (
              <Card key={rule.id} className={`border ${rule.isEnabled ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${
                          rule.action === "show" ? "border-green-300 text-green-700 bg-green-50" :
                          rule.action === "hide" ? "border-red-300 text-red-700 bg-red-50" :
                          rule.action === "require" ? "border-blue-300 text-blue-700 bg-blue-50" :
                          "border-gray-300 text-gray-600"
                        }`}>{rule.action.toUpperCase()}</Badge>
                        <span className="text-sm font-medium text-gray-800 truncate">{getTargetLabel(rule.targetId, rule.targetType)}</span>
                        {rule.ruleLabel && <span className="text-xs text-gray-400 italic">— {rule.ruleLabel}</span>}
                        {!rule.isEnabled && <Badge variant="outline" className="text-xs text-gray-400">Disabled</Badge>}
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {conditions.map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-1 text-xs text-gray-500">
                            {i > 0 && <span className="font-semibold text-teal-600">{rule.logicOperator === "all" ? "AND" : "OR"}</span>}
                            <span className="bg-gray-100 rounded px-1.5 py-0.5">{getItemLabel(c.fieldId)}</span>
                            <span>{BRANCH_OPERATORS.find(o => o.value === c.operator)?.label ?? c.operator}</span>
                            {!["is_empty", "is_not_empty"].includes(c.operator) && <span className="font-medium text-gray-700">"{c.value}"</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(rule)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                        onClick={() => { if (confirm("Delete this rule?")) deleteRule.mutate({ id: rule.id }); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingRule} onOpenChange={open => { if (!open) { setEditingRule(null); setEditingId(undefined); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" style={{ color: BRAND }} />
              {editingId ? "Edit Logic Rule" : "New Logic Rule"}
            </DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-5">
              <div>
                <Label className="text-xs font-medium text-gray-600">Rule Label (optional)</Label>
                <Input value={editingRule.ruleLabel} onChange={e => setEditingRule(r => r ? { ...r, ruleLabel: e.target.value } : r)}
                  placeholder="e.g. Show phone field if contact method is phone" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">IF…</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Match</span>
                    <div className="flex rounded border border-gray-200 overflow-hidden text-xs">
                      {(["all", "any"] as const).map(l => (
                        <button key={l} type="button" onClick={() => setEditingRule(r => r ? { ...r, logicOperator: l } : r)}
                          className={`px-2.5 py-1 font-medium transition-colors ${
                            editingRule.logicOperator === l ? "bg-teal-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                          }`}>{l === "all" ? "ALL" : "ANY"}</button>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">conditions</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {editingRule.conditions.map((cond, idx) => (
                    <div key={cond.id} className="flex items-center gap-2 flex-wrap bg-gray-50 rounded-lg p-2">
                      {idx > 0 && <span className="text-xs font-bold text-teal-700 w-8 text-center">{editingRule.logicOperator === "all" ? "AND" : "OR"}</span>}
                      {idx === 0 && <span className="text-xs text-gray-400 w-8">If</span>}
                      <Select value={cond.fieldId} onValueChange={v => updateCondition(cond.id, { fieldId: v })}>
                        <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Select field" /></SelectTrigger>
                        <SelectContent>
                          {items.map((it: any) => <SelectItem key={it.id} value={String(it.id)}>{it.label || it.itemType}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={cond.operator} onValueChange={v => updateCondition(cond.id, { operator: v })}>
                        <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BRANCH_OPERATORS.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!["is_empty", "is_not_empty"].includes(cond.operator) && (() => {
                        const fieldOpts = getItemOptions(cond.fieldId);
                        if (fieldOpts.length > 0) {
                          return (
                            <Select value={cond.value} onValueChange={v => updateCondition(cond.id, { value: v })}>
                              <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="select value" /></SelectTrigger>
                              <SelectContent>
                                {fieldOpts.map((o: any) => <SelectItem key={o.id} value={o.value || o.label}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          );
                        }
                        return (
                          <input type="text" value={cond.value} onChange={e => updateCondition(cond.id, { value: e.target.value })}
                            placeholder="value" className="h-7 px-2 text-xs border border-gray-200 rounded w-32 bg-white focus:outline-none focus:border-teal-400" />
                        );
                      })()}
                      <button type="button" onClick={() => removeCondition(cond.id)} className="text-gray-400 hover:text-red-500 ml-auto">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1" onClick={addCondition}>
                  <Plus className="w-3 h-3" /> Add Condition
                </Button>
              </div>
              <Card className="bg-gray-50 border-gray-200">
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">THEN…</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={editingRule.action} onValueChange={v => setEditingRule(r => r ? { ...r, action: v as any } : r)}>
                      <SelectTrigger className="h-8 text-sm w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="show">Show</SelectItem>
                        <SelectItem value="hide">Hide</SelectItem>
                        <SelectItem value="require">Require</SelectItem>
                        <SelectItem value="unrequire">Un-require</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-500">the</span>
                    <Select
                      value={`${editingRule.targetType}:${editingRule.targetId}`}
                      onValueChange={v => { const [type, id] = v.split(":"); setEditingRule(r => r ? { ...r, targetType: type as any, targetId: parseInt(id) } : r); }}
                    >
                      <SelectTrigger className="h-8 text-sm w-56"><SelectValue placeholder="Select field or section" /></SelectTrigger>
                      <SelectContent>
                        {items.map((it: any) => <SelectItem key={it.id} value={`item:${it.id}`}>{it.label || it.itemType}</SelectItem>)}
                        {sections.length > 0 && sections.map((s: any) => <SelectItem key={s.id} value={`section:${s.id}`}>{s.title || `Section ${s.id}`}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
              <div className="flex items-center gap-2">
                <Switch checked={editingRule.isEnabled} onCheckedChange={v => setEditingRule(r => r ? { ...r, isEnabled: v } : r)} />
                <Label className="text-xs text-gray-600">Rule enabled</Label>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Rules are evaluated in real-time as users fill out the form. Fields hidden by rules are excluded from submission.
                  <strong> Show</strong> = hidden by default, shown when conditions match.
                  <strong> Hide</strong> = visible by default, hidden when conditions match.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setEditingRule(null); setEditingId(undefined); }}>Cancel</Button>
            <Button size="sm" className="text-white" style={{ background: BRAND }} onClick={saveRule} disabled={upsertRule.isPending}>
              {upsertRule.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ─── Integrations Tab ────────────────────────────────────────────────────────
function IntegrationsTab({ formId }: { formId: number }) {
  const utils = trpc.useUtils();
  const { data: integration, isLoading } = trpc.generalForm.getGoogleIntegration.useQuery({ formId });
  const saveMutation = trpc.generalForm.saveGoogleIntegrationConfig.useMutation({
    onSuccess: () => utils.generalForm.getGoogleIntegration.invalidate({ formId }),
  });
  const disconnectMutation = trpc.generalForm.disconnectGoogleIntegration.useMutation({
    onSuccess: () => utils.generalForm.getGoogleIntegration.invalidate({ formId }),
  });

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [spreadsheetName, setSpreadsheetName] = useState("");
  const [sheetTabName, setSheetTabName] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [enabled, setEnabled] = useState(false);

  // Sync state from loaded data
  useEffect(() => {
    if (integration) {
      setClientId(integration.googleClientId ?? "");
      setSpreadsheetName(integration.spreadsheetName ?? "");
      setSheetTabName(integration.sheetTabName ?? "Form Responses");
      setEnabled(integration.isEnabled ?? false);
    }
  }, [integration]);

  // Handle ?google=connected redirect from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      utils.generalForm.getGoogleIntegration.invalidate({ formId });
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("google");
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleSaveConfig = async () => {
    const updates: any = { formId, spreadsheetName, sheetTabName, isEnabled: enabled };
    if (clientId) updates.googleClientId = clientId;
    if (clientSecret) updates.googleClientSecret = clientSecret;
    await saveMutation.mutateAsync(updates);
  };

  const handleConnect = async () => {
    // Save credentials first, then redirect to OAuth
    if (clientId || clientSecret) {
      const updates: any = { formId };
      if (clientId) updates.googleClientId = clientId;
      if (clientSecret) updates.googleClientSecret = clientSecret;
      await saveMutation.mutateAsync(updates);
    }
    const origin = window.location.origin;
    window.location.href = `/api/google/auth?formId=${formId}&origin=${encodeURIComponent(origin)}`;
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google account? Submissions will no longer sync to Sheets.")) return;
    await disconnectMutation.mutateAsync({ formId });
  };

  const handleToggle = async (val: boolean) => {
    setEnabled(val);
    await saveMutation.mutateAsync({ formId, isEnabled: val });
  };

  if (isLoading) return <div className="flex items-center justify-center py-16 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading…</div>;

  const isConnected = integration?.isConnected;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Integrations</h3>
        <p className="text-sm text-gray-500">Connect external services to automatically sync form submissions.</p>
      </div>

      {/* Google Sheets Card */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <rect width="24" height="24" rx="4" fill="#34A853" />
                <path d="M7 8h10M7 12h10M7 16h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">Google Sheets</div>
              <div className="text-xs text-gray-400">Auto-sync submissions to a spreadsheet</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && (
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">{enabled ? "Enabled" : "Disabled"}</span>
                <button
                  onClick={() => handleToggle(!enabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    enabled ? "bg-[#0e7490]" : "bg-gray-200"
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-4.5" : "translate-x-0.5"
                  }`} />
                </button>
              </label>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="px-5 py-5 bg-gray-50 space-y-5">
          {/* Connected status */}
          {isConnected ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-800 font-medium">Connected as {integration?.connectedEmail}</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-xs text-red-500 hover:text-red-700 underline"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Not connected.</strong> Enter your Google OAuth credentials below, then click Connect.
            </div>
          )}

          {/* Google OAuth Credentials */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Google OAuth Credentials</div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
              <Input
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="Your Google OAuth Client ID"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  placeholder={integration?.hasClientSecret ? "••••••••••••••••" : "Your Google OAuth Client Secret"}
                  className="text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Create credentials at{" "}
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-[#0e7490] hover:underline">
                  Google Cloud Console <ExternalLink className="w-3 h-3 inline" />
                </a>. Add <code className="bg-gray-100 px-1 rounded">{window.location.origin}/api/google/callback</code> as an authorized redirect URI.
              </p>
            </div>
          </div>

          {/* Sheet Configuration */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Spreadsheet Settings</div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Spreadsheet Name</label>
              <Input
                value={spreadsheetName}
                onChange={e => setSpreadsheetName(e.target.value)}
                placeholder={`Form Responses - Form ${formId}`}
                className="text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Name for the new Google Sheet that will be created in your Drive.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sheet Tab Name</label>
              <Input
                value={sheetTabName}
                onChange={e => setSheetTabName(e.target.value)}
                placeholder="Form Responses"
                className="text-sm"
              />
            </div>
            {integration?.spreadsheetId && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">Spreadsheet created</span>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${integration.spreadsheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0e7490] hover:underline flex items-center gap-1"
                >
                  Open in Google Sheets <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveConfig}
              disabled={saveMutation.isPending}
              className="gap-1"
            >
              {saveMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Save Settings
            </Button>
            {!isConnected ? (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={saveMutation.isPending}
                className="gap-1 bg-[#0e7490] hover:bg-[#0c6478] text-white"
              >
                <Plug className="w-3.5 h-3.5" />
                Connect Google Account
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                variant="outline"
                className="gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Webhook Card ── */}
      <WebhookCard formId={formId} />

      {/* ── API Card ── */}
      <ApiCard formId={formId} />
    </div>
  );
}

// ─── Webhook Integration Card ─────────────────────────────────────────────────
function WebhookCard({ formId }: { formId: number }) {
  const utils = trpc.useUtils();
  const { data: webhook } = trpc.generalForm.getWebhookConfig.useQuery({ formId });
  const saveMutation = trpc.generalForm.saveWebhookConfig.useMutation({
    onSuccess: () => utils.generalForm.getWebhookConfig.invalidate({ formId }),
  });
  const testMutation = trpc.generalForm.testWebhook.useMutation();

  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<string[]>(["submission"]);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; statusCode: number; error?: string } | null>(null);

  useEffect(() => {
    if (webhook) {
      setUrl(webhook.webhookUrl ?? "");
      setEnabled(webhook.isEnabled ?? false);
      const ev = (webhook.events ?? "submission").split(",").map((e: string) => e.trim());
      setEvents(ev.length ? ev : ["submission"]);
    }
  }, [webhook]);

  const handleSave = async () => {
    await saveMutation.mutateAsync({
      formId,
      webhookUrl: url,
      secret: secret || undefined,
      isEnabled: enabled,
      events: events.join(","),
    });
    toast.success("Webhook settings saved");
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const res = await testMutation.mutateAsync({ formId });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ ok: false, statusCode: 0, error: e.message });
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
            <Webhook className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Webhook</h3>
            <p className="text-xs text-gray-500">POST submission data to any URL in real-time</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={v => { setEnabled(v); saveMutation.mutate({ formId, isEnabled: v, events: events.join(",") }); }} />
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Trigger on</Label>
          <div className="flex flex-wrap gap-3">
            {[
              { value: "submission", label: "Form submit" },
              { value: "update", label: "Results table update" },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <Checkbox
                  checked={events.includes(opt.value)}
                  onCheckedChange={checked => {
                    setEvents(prev => {
                      const next = checked
                        ? [...new Set([...prev, opt.value])]
                        : prev.filter(e => e !== opt.value);
                      return next.length ? next : ["submission"];
                    });
                  }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Endpoint URL</Label>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-server.com/webhook" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Signing Secret (optional)</Label>
          <div className="relative">
            <Input
              type={showSecret ? "text" : "password"}
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Leave blank to keep existing secret"
              className="h-8 text-sm pr-8"
            />
            <button type="button" onClick={() => setShowSecret(s => !s)} className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600">
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Sent as <code className="bg-gray-100 px-1 rounded">X-Signature-256: sha256=...</code> header</p>
        </div>
        {webhook?.lastTriggeredAt && (
          <p className="text-xs text-gray-400">
            Last delivery: {new Date(webhook.lastTriggeredAt).toLocaleString()} —{" "}
            <span className={webhook.lastStatus === "success" ? "text-green-600" : "text-red-500"}>
              {webhook.lastStatus} {webhook.lastStatusCode ? `(${webhook.lastStatusCode})` : ""}
            </span>
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1 bg-[#0e7490] hover:bg-[#0c6478] text-white">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testMutation.isPending || !url} className="gap-1">
            <Zap className="w-3.5 h-3.5" /> Test
          </Button>
        </div>
        {testResult && (
          <div className={`text-xs rounded-lg px-3 py-2 ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {testResult.ok ? `✓ Success (HTTP ${testResult.statusCode})` : `✗ Failed${testResult.statusCode ? ` (HTTP ${testResult.statusCode})` : ""}: ${testResult.error ?? "Unknown error"}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── API Integration Card ─────────────────────────────────────────────────────
function ApiCard({ formId }: { formId: number }) {
  const utils = trpc.useUtils();
  const { data: tokenData } = trpc.generalForm.getApiToken.useQuery({ formId });
  const regenMutation = trpc.generalForm.regenerateApiToken.useMutation({
    onSuccess: () => utils.generalForm.getApiToken.invalidate({ formId }),
  });
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const apiToken = tokenData?.apiToken;
  const apiEndpoint = `${window.location.origin}/api/forms/${formId}/submissions`;

  const copyToken = () => {
    if (apiToken) {
      navigator.clipboard.writeText(apiToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <Code className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">API Access</h3>
          <p className="text-xs text-gray-500">Pull submissions programmatically via REST API</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Endpoint</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 font-mono truncate">{apiEndpoint}</code>
            <Button size="sm" variant="outline" className="shrink-0 h-7 px-2" onClick={() => { navigator.clipboard.writeText(apiEndpoint); toast.success("Copied!"); }}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Bearer Token</Label>
          {apiToken ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 font-mono truncate">
                {showToken ? apiToken : "••••••••••••••••••••••••••••••••"}
              </code>
              <Button size="sm" variant="outline" className="shrink-0 h-7 px-2" onClick={() => setShowToken(s => !s)}>
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button size="sm" variant="outline" className="shrink-0 h-7 px-2" onClick={copyToken}>
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No token yet — generate one below</p>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => regenMutation.mutate({ formId })}
          disabled={regenMutation.isPending}
          className="gap-1 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {apiToken ? "Regenerate Token" : "Generate Token"}
        </Button>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-600 mb-1.5">Example request</p>
          <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-all">{`curl -H "Authorization: Bearer ${apiToken ?? "<your-token>"}" \\
  "${apiEndpoint}"`}</pre>
        </div>
      </div>
    </div>
  );
}


// ─── Form Editor Shell (tabs) ─────────────────────────────────────────────────
function FormEditorShell({ formId, onBack }: { formId: number; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"editor" | "style" | "share" | "settings" | "results" | "analytics" | "branching" | "integrations" | "success">("settings");
  const { data: formData, isLoading, refetch } = trpc.generalForm.getForm.useQuery({ id: formId });

  const TABS = [
    { id: "settings", label: "Settings", icon: Settings },
    { id: "success", label: "Success Modules", icon: Trophy },
    { id: "editor", label: "Editor", icon: FileText },
    { id: "branching", label: "Logic", icon: GitBranch },
    { id: "style", label: "Style / Branding", icon: Palette },
    { id: "share", label: "Share", icon: Share2 },
    { id: "results", label: "Results", icon: Download },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
    { id: "integrations", label: "Integrations", icon: Plug },
  ] as const;

  if (isLoading) return <div className="flex items-center justify-center py-16 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading…</div>;
  if (!formData) return <div className="text-center py-16 text-gray-400">Form not found</div>;

  const { template } = formData;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
        <Link href="/platform-admin" className="hover:text-[#189aa1] transition-colors flex items-center gap-0.5">
          <ChevronLeft className="w-3 h-3" /> Platform Admin
        </Link>
        <span>/</span>
        <button onClick={onBack} className="hover:text-[#189aa1] transition-colors">Form Builder</button>
      </div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-500">
          <ArrowLeft className="w-4 h-4" /> All Forms
        </Button>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 truncate">{template.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {statusBadge(template.status)}
            {template.isPublic && <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-xs"><Globe className="w-3 h-3 mr-1" />Public</Badge>}
            {template.publicSlug && (
              <a
                href={getPublicUrl(template.publicSlug, template.hostDomain)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-[#0e7490] flex items-center gap-1"
              >
                {template.hostDomain || DEFAULT_HOST_DOMAIN}/forms/{template.publicSlug} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => template.publicSlug && window.open(`${getPublicUrl(template.publicSlug, template.hostDomain)}/preview`, "_blank")}
          disabled={!template.publicSlug}
          title="Admin preview (always accessible regardless of public status)"
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-[#0e7490] text-[#0e7490]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "editor" && <FormEditor formId={formId} />}
      {activeTab === "branching" && <BranchingTab formId={formId} />}
      {activeTab === "style" && <StyleTab formId={formId} template={template} />}
      {activeTab === "share" && <ShareTab formId={formId} template={template} onRefetch={refetch} />}
      {activeTab === "settings" && <SettingsTab formId={formId} template={template} onRefetch={refetch} />}
      {activeTab === "success" && <FormSuccessModulesTab formId={formId} template={template} onRefetch={refetch} />}
      {activeTab === "results" && <FormResultsTable formId={formId} template={template} />}
      {activeTab === "analytics" && <AnalyticsTab formId={formId} template={template} />}
      {activeTab === "integrations" && <IntegrationsTab formId={formId} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GeneralFormBuilder() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const [selectedFormId, setSelectedFormId] = useState<number | null>(params.id ? parseInt(params.id) : null);

  // Sync URL with selected form
  useEffect(() => {
    if (selectedFormId) {
      navigate(`/admin/general-forms/${selectedFormId}`, { replace: true });
    } else {
      navigate("/admin/general-forms", { replace: true });
    }
  }, [selectedFormId]);

  if (!user || (user.role !== "admin" && !user.roles?.includes("platform_admin"))) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Lock className="w-5 h-5 mr-2" /> Admin access required
        </div>
      </Layout>
    );
  }

  // When editing a form, render full-screen (no sidebar) like other editors
  if (selectedFormId) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-auto">
        <FormEditorShell formId={selectedFormId} onBack={() => setSelectedFormId(null)} />
      </div>
    );
  }

  return (
    <Layout>
      <FormList onSelect={setSelectedFormId} />
    </Layout>
  );
}
