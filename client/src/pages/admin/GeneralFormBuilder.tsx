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
  Download,
  Search,
  X,
  Layers,
  Sparkles,
} from "lucide-react";
import { PublishDomainSelect } from "@/components/PublishDomainSelect";
import RichTextEditor, { RichTextDisplay } from "@/components/RichTextEditor";

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
  { value: "short_text", label: "Short Text", icon: "T" },
  { value: "long_text", label: "Long Text / Paragraph", icon: "¶" },
  { value: "email", label: "Email", icon: "@" },
  { value: "phone", label: "Phone", icon: "☎" },
  { value: "number", label: "Number", icon: "#" },
  { value: "date", label: "Date", icon: "📅" },
  { value: "time", label: "Time", icon: "⏰" },
  { value: "dropdown", label: "Dropdown", icon: "▼" },
  { value: "radio", label: "Single Choice (Radio)", icon: "◉" },
  { value: "checkbox", label: "Multiple Choice (Checkboxes)", icon: "☑" },
  { value: "rating", label: "Rating (1–5 stars)", icon: "★" },
  { value: "scale", label: "Scale / Slider", icon: "↔" },
  { value: "yes_no", label: "Yes / No", icon: "Y/N" },
  { value: "file_upload", label: "File Upload", icon: "📎" },
  { value: "section_break", label: "Section Break / Heading", icon: "—" },
  { value: "rich_text", label: "Rich Text (display only)", icon: "✦" },
  { value: "signature", label: "Signature", icon: "✍" },
  { value: "payment", label: "Payment (Stripe)", icon: "💳" },
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
  const [showAddItem, setShowAddItem] = useState<number | null>(null); // sectionId
  const [newItemType, setNewItemType] = useState("short_text");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);

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
    onSuccess: () => { refetch(); setShowAddItem(null); setNewItemLabel(""); },
    onError: (e) => toast.error(e.message),
  });
  const updateItem = trpc.generalForm.updateItem.useMutation({
    onSuccess: () => { refetch(); setEditingItem(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteItem = trpc.generalForm.deleteItem.useMutation({
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

  return (
    <div className="space-y-4">
      {/* Sections */}
      {sections.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-gray-400 font-medium">No sections yet</p>
          <p className="text-sm text-gray-400 mt-1">Add a section to start building your form</p>
        </div>
      ) : (
        sections.map((section: any) => (
          <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <Layers className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-800 flex-1">{section.title}</span>
              <Button variant="ghost" size="sm" onClick={() => setEditingSection(section)}><Edit2 className="w-3.5 h-3.5" /></Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500"
                onClick={() => { if (confirm("Delete this section and all its items?")) deleteSection.mutate({ id: section.id, templateId: formId }); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-100">
              {getItemsForSection(section.id).map((item: any, idx: number, arr: any[]) => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 group">
                  <GripVertical className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {ITEM_TYPES.find(t => t.value === item.itemType)?.label ?? item.itemType}
                      </span>
                      {item.isRequired && <span className="text-xs text-red-500">Required</span>}
                      {item.scoreWeight > 0 && <span className="text-xs text-amber-600">Score: {item.scoreWeight}pts</span>}
                    </div>
                    <p className="font-medium text-gray-800 mt-0.5">{item.label}</p>
                    {item.helpText && <p className="text-xs text-gray-400 mt-0.5">{item.helpText}</p>}
                    {hasOptions(item.itemType) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getOptionsForItem(item.id).map((opt: any) => (
                          <span key={opt.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{opt.label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => {
                      const ids = arr.map((a: any) => a.id);
                      [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                      reorderItems.mutate({ templateId: formId, sectionId: section.id, orderedIds: ids });
                    }} disabled={idx === 0}>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const ids = arr.map((a: any) => a.id);
                      [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                      reorderItems.mutate({ templateId: formId, sectionId: section.id, orderedIds: ids });
                    }} disabled={idx === arr.length - 1}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingItem({ ...item, options: getOptionsForItem(item.id) })}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { if (confirm("Delete this item?")) deleteItem.mutate({ id: item.id, templateId: formId }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add item to section */}
            {showAddItem === section.id ? (
              <div className="px-4 py-3 bg-blue-50/50 border-t border-blue-100 space-y-2">
                <div className="flex gap-2">
                  <Select value={newItemType} onValueChange={setNewItemType}>
                    <SelectTrigger className="w-52 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={newItemLabel}
                    onChange={e => setNewItemLabel(e.target.value)}
                    placeholder="Question label…"
                    className="flex-1 bg-white"
                    onKeyDown={e => e.key === "Enter" && newItemLabel.trim() && createItem.mutate({ templateId: formId, sectionId: section.id, itemType: newItemType, label: newItemLabel.trim() })}
                  />
                  <Button
                    disabled={!newItemLabel.trim() || createItem.isPending}
                    onClick={() => createItem.mutate({ templateId: formId, sectionId: section.id, itemType: newItemType, label: newItemLabel.trim() })}
                    className="text-white"
                    style={{ background: BRAND }}
                  >
                    Add
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowAddItem(null); setNewItemLabel(""); }}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 border-t border-gray-100">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 gap-1" onClick={() => setShowAddItem(section.id)}>
                  <Plus className="w-3.5 h-3.5" /> Add Question
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      {/* Add section */}
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
                <Input
                  defaultValue={editingSection.title}
                  id="sec-title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  defaultValue={editingSection.description ?? ""}
                  id="sec-desc"
                  className="mt-1"
                  rows={2}
                />
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

// ─── Item Edit Dialog ─────────────────────────────────────────────────────────
function ItemEditDialog({ item, onSave, onClose, scoreEnabled }: {
  item: any;
  onSave: (updates: any, options?: any[]) => void;
  onClose: () => void;
  scoreEnabled: boolean;
}) {
  const [label, setLabel] = useState(item.label);
  const [helpText, setHelpText] = useState(item.helpText ?? "");
  const [placeholder, setPlaceholder] = useState(item.placeholder ?? "");
  const [isRequired, setIsRequired] = useState(item.isRequired);
  const [scoreWeight, setScoreWeight] = useState(item.scoreWeight ?? 0);
  const [optionsText, setOptionsText] = useState(
    item.options?.map((o: any) => `${o.label}${o.scoreValue ? ` [${o.scoreValue}]` : ""}`).join("\n") ?? ""
  );

  const hasOptions = ["dropdown", "radio", "checkbox"].includes(item.itemType);

  const handleSave = () => {
    const updates = { label, helpText: helpText || undefined, placeholder: placeholder || undefined, isRequired, scoreWeight };
    let parsedOptions: any[] | undefined = undefined;
    if (hasOptions) {
      parsedOptions = optionsText.split("\n").filter(l => l.trim()).map((line, idx) => {
        const match = line.match(/^(.+?)\s*\[(\d+)\]\s*$/);
        if (match) return { label: match[1].trim(), value: match[1].trim().toLowerCase().replace(/\s+/g, "_"), sortOrder: idx, scoreValue: parseInt(match[2]) };
        const trimmed = line.trim();
        return { label: trimmed, value: trimmed.toLowerCase().replace(/\s+/g, "_"), sortOrder: idx, scoreValue: 0 };
      });
    }
    onSave(updates, parsedOptions);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Question — {ITEM_TYPES.find(t => t.value === item.itemType)?.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label>Question Label *</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Help Text</Label>
            <Input value={helpText} onChange={e => setHelpText(e.target.value)} placeholder="Optional hint shown below the question" className="mt-1" />
          </div>
          {["short_text", "long_text", "email", "phone", "number"].includes(item.itemType) && (
            <div>
              <Label>Placeholder</Label>
              <Input value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder="Placeholder text…" className="mt-1" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch checked={isRequired} onCheckedChange={setIsRequired} id="req-switch" />
            <Label htmlFor="req-switch">Required</Label>
          </div>
          {scoreEnabled && (
            <div>
              <Label>Score Weight (points for correct answer)</Label>
              <Input type="number" min={0} value={scoreWeight} onChange={e => setScoreWeight(parseInt(e.target.value) || 0)} className="mt-1 w-24" />
            </div>
          )}
          {hasOptions && (
            <div>
              <Label>Options (one per line; add [score] to assign points, e.g. "Yes [5]")</Label>
              <Textarea
                value={optionsText}
                onChange={e => setOptionsText(e.target.value)}
                rows={6}
                className="mt-1 font-mono text-sm"
                placeholder={"Option A\nOption B [5]\nOption C [10]"}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!label.trim()} onClick={handleSave} className="text-white" style={{ background: BRAND }}>Save</Button>
        </DialogFooter>
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

        <Button onClick={save} disabled={saving} className="w-full text-white gap-2" style={{ background: BRAND }}>
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Save Theme
        </Button>
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
  const embedCode = publicUrl ? `<iframe src="${publicUrl}/embed" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;" title="${template.name}"></iframe>` : null;

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

      {/* Embed Code */}
      {embedCode && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Code2 className="w-4 h-4" /> Embed Code</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Copy and paste this code into any webpage to embed the form.</p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => copy(embedCode, "embed")}
              >
                {copied === "embed" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "embed" ? "Copied!" : "Copy Code"}
              </Button>
            </div>
            <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">{embedCode}</pre>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(`${publicUrl}/embed`, "_blank")}>
              <Eye className="w-3.5 h-3.5" /> Preview Embed
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
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
  const [successMessage, setSuccessMessage] = useState(template.successMessage ?? "");
  const [successRedirectUrl, setSuccessRedirectUrl] = useState(template.successRedirectUrl ?? "");
  const [notifyEmail, setNotifyEmail] = useState(template.notifyEmail ?? "");
  const [maxSubmissions, setMaxSubmissions] = useState(template.maxSubmissions?.toString() ?? "");
  const [hostDomain, setHostDomain] = useState(template.hostDomain ?? DEFAULT_HOST_DOMAIN);
  const [displayMode, setDisplayMode] = useState<"classic" | "typeform" | "paginated" | "inline">(template.displayMode ?? "classic");
  const [welcomeTitle, setWelcomeTitle] = useState(template.welcomeTitle ?? "");
  const [welcomeSubtitle, setWelcomeSubtitle] = useState(template.welcomeSubtitle ?? "");
  const [welcomeButtonText, setWelcomeButtonText] = useState(template.welcomeButtonText ?? "");
  const [welcomeImageUrl, setWelcomeImageUrl] = useState(template.welcomeImageUrl ?? "");
  const [submitButtonText, setSubmitButtonText] = useState(template.submitButtonText ?? "");

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
      successMessage: successMessage || undefined,
      successRedirectUrl: successRedirectUrl || undefined,
      notifyEmail: notifyEmail || undefined,
      maxSubmissions: maxSubmissions ? parseInt(maxSubmissions) : undefined,
      hostDomain,
      displayMode,
      welcomeTitle: welcomeTitle || undefined,
      welcomeSubtitle: welcomeSubtitle || undefined,
      welcomeButtonText: welcomeButtonText || undefined,
      welcomeImageUrl: welcomeImageUrl || undefined,
      submitButtonText: submitButtonText || undefined,
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
        <CardHeader className="pb-2"><CardTitle className="text-sm">Submission Behavior</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Post-Submission Action</Label>
            </div>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSuccessRedirectUrl("")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  !successRedirectUrl ? "bg-[#0e7490] text-white border-[#0e7490]" : "bg-white text-gray-600 border-gray-200 hover:border-[#0e7490]"
                }`}
              >
                Show Thank-You Message
              </button>
              <button
                type="button"
                onClick={() => { if (!successRedirectUrl) setSuccessRedirectUrl("https://"); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  successRedirectUrl ? "bg-[#0e7490] text-white border-[#0e7490]" : "bg-white text-gray-600 border-gray-200 hover:border-[#0e7490]"
                }`}
              >
                Redirect to URL
              </button>
            </div>
            {!successRedirectUrl ? (
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Thank-You Message (rich text, shown after submission)</Label>
                <RichTextEditor
                  value={successMessage}
                  onChange={setSuccessMessage}
                  placeholder="Thank you for your submission! We'll be in touch soon."
                  minHeight={120}
                  maxHeight={400}
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Redirect URL (user is sent here after submitting)</Label>
                <Input value={successRedirectUrl} onChange={e => setSuccessRedirectUrl(e.target.value)} placeholder="https://yoursite.com/thank-you" className="mt-1" />
              </div>
            )}
          </div>
          <div>
            <Label>Notify Email (send a copy of each submission)</Label>
            <Input type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} placeholder="admin@yoursite.com" className="mt-1" />
          </div>
          <div>
            <Label>Max Submissions (leave blank for unlimited)</Label>
            <Input type="number" min={1} value={maxSubmissions} onChange={e => setMaxSubmissions(e.target.value)} placeholder="Unlimited" className="mt-1 w-36" />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={!name.trim() || updateForm.isPending} className="w-full text-white gap-2" style={{ background: BRAND }}>
        {updateForm.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Save Settings
      </Button>
    </div>
  );
}

// ─── Results Tab ─────────────────────────────────────────────────────────────
function ResultsTab({ formId, template }: { formId: number; template: any }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "draft" | "reviewed">("all");
  const [page, setPage] = useState(1);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [exportStatus, setExportStatus] = useState<"all" | "submitted" | "draft" | "reviewed">("all");
  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.generalForm.getFormResults.useQuery({
    templateId: formId,
    page,
    pageSize: 50,
    status: statusFilter,
  });

  const { data: exportData, refetch: fetchExport } = trpc.generalForm.exportFormResults.useQuery(
    { templateId: formId, status: exportStatus },
    { enabled: false }
  );

  const updateStatus = trpc.generalForm.updateSubmissionStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteSubmission = trpc.generalForm.deleteSubmission.useMutation({
    onSuccess: () => { toast.success("Deleted"); refetch(); setSelectedSub(null); },
    onError: (e) => toast.error(e.message),
  });

  const handleExport = async () => {
    const result = await fetchExport();
    const d = result.data;
    if (!d) return;
    const { submissions, items, userMap } = d;
    const headers = ["ID", "Submitted At", "Status", "User Name", "User Email", "Score", "Max Score",
      ...items.map((it: any) => it.label || it.itemType)];
    const rows = submissions.map((s: any) => {
      const responses = (() => { try { return JSON.parse(s.responses); } catch { return {}; } })();
      const user = s.submittedByUserId ? (userMap as any)[s.submittedByUserId] : null;
      return [
        s.id,
        new Date(s.submittedAt).toISOString(),
        s.status,
        user?.name ?? "",
        user?.email ?? "",
        s.score,
        s.maxScore,
        ...items.map((it: any) => {
          const v = responses[it.id.toString()];
          return Array.isArray(v) ? v.join("; ") : (v ?? "");
        }),
      ];
    });
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "-")}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const STATUS_TABS = [
    { id: "all", label: "All" },
    { id: "submitted", label: "Submitted" },
    { id: "draft", label: "Incomplete" },
    { id: "reviewed", label: "Reviewed" },
  ] as const;

  const statusBadgeColor = (s: string) => {
    if (s === "submitted") return "bg-green-50 text-green-700 border-green-200";
    if (s === "reviewed") return "bg-blue-50 text-blue-700 border-blue-200";
    if (s === "draft") return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-gray-50 text-gray-600 border-gray-200";
  };

  const parseResponses = (s: any) => { try { return JSON.parse(s.responses); } catch { return {}; } };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50">
          {STATUS_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setStatusFilter(t.id); setPage(1); }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === t.id ? "bg-white shadow-sm text-[#0e7490]" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={exportStatus} onValueChange={v => setExportStatus(v as any)}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="draft">Incomplete</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-1 h-8" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin mr-2" />Loading…</div>
          ) : !data?.submissions?.length ? (
            <div className="text-center py-12 text-gray-400">No results found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">#</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Submitter</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Score</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.submissions.map((sub: any) => (
                    <tr
                      key={sub.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => setSelectedSub(sub)}
                    >
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-400">#{sub.id}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-gray-800 text-xs">{sub.userName || <span className="text-gray-400 italic">Anonymous</span>}</div>
                        {sub.userEmail && <div className="text-xs text-gray-400">{sub.userEmail}</div>}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{new Date(sub.submittedAt).toLocaleString()}</td>
                      <td className="py-2.5 px-4" onClick={e => e.stopPropagation()}>
                        <Select value={sub.status} onValueChange={v => updateStatus.mutate({ id: sub.id, status: v as any })}>
                          <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="draft">Incomplete</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {sub.maxScore > 0 ? (
                          <span className="font-medium" style={{ color: BRAND }}>{sub.score}/{sub.maxScore}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-6 w-6 p-0"
                          onClick={() => { if (confirm("Delete this submission?")) deleteSubmission.mutate({ id: sub.id }); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total > 50 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{((page - 1) * 50) + 1}–{Math.min(page * 50, data.total)} of {data.total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={page * 50 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedSub && (
        <Dialog open={!!selectedSub} onOpenChange={() => setSelectedSub(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Submission #{selectedSub.id}
                <Badge className={`text-xs border ${statusBadgeColor(selectedSub.status)}`}>{selectedSub.status}</Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Submitter:</span> <span className="font-medium">{selectedSub.userName || "Anonymous"}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedSub.userEmail || "—"}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{new Date(selectedSub.submittedAt).toLocaleString()}</span></div>
                <div><span className="text-gray-500">Score:</span> <span className="font-medium">{selectedSub.maxScore > 0 ? `${selectedSub.score}/${selectedSub.maxScore}` : "N/A"}</span></div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Responses</p>
                <div className="space-y-2">
                  {Object.entries(parseResponses(selectedSub)).map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-500">Field #{k}</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">
                        {Array.isArray(v) ? v.join(", ") : String(v)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedSub(null)}>Close</Button>
              <Button
                variant="destructive" size="sm"
                onClick={() => { if (confirm("Delete this submission?")) deleteSubmission.mutate({ id: selectedSub.id }); }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ formId, template }: { formId: number; template: any }) {
  const { data: analytics, isLoading } = trpc.generalForm.getFormAnalytics.useQuery({ id: formId });
  const { data: submissions, isLoading: subsLoading } = trpc.generalForm.listSubmissions.useQuery({ templateId: formId, pageSize: 50 });

  const updateStatus = trpc.generalForm.updateSubmissionStatus.useMutation({
    onSuccess: () => toast.success("Status updated"),
    onError: (e) => toast.error(e.message),
  });
  const deleteSubmission = trpc.generalForm.deleteSubmission.useMutation({
    onSuccess: () => toast.success("Deleted"),
    onError: (e) => toast.error(e.message),
  });

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

      {/* Submissions table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> Submissions ({analytics?.totalSubmissions ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subsLoading ? (
            <div className="text-center py-8 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></div>
          ) : !submissions?.submissions?.length ? (
            <div className="text-center py-8 text-gray-400">No submissions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">ID</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Submitted</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Score</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.submissions.map((sub: any) => (
                    <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2 px-3 font-mono text-xs text-gray-400">#{sub.id}</td>
                      <td className="py-2 px-3 text-gray-600">{new Date(sub.submittedAt).toLocaleString()}</td>
                      <td className="py-2 px-3">
                        {sub.maxScore > 0 ? (
                          <span className="font-medium" style={{ color: BRAND }}>{sub.score}/{sub.maxScore}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2 px-3">
                        <Select value={sub.status} onValueChange={v => updateStatus.mutate({ id: sub.id, status: v as any })}>
                          <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-600"
                          onClick={() => { if (confirm("Delete this submission?")) deleteSubmission.mutate({ id: sub.id }); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Form Editor Shell (tabs) ─────────────────────────────────────────────────
function FormEditorShell({ formId, onBack }: { formId: number; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"editor" | "style" | "share" | "settings" | "results" | "analytics">("editor");
  const { data: formData, isLoading, refetch } = trpc.generalForm.getForm.useQuery({ id: formId });

  const TABS = [
    { id: "editor", label: "Editor", icon: FileText },
    { id: "style", label: "Style / Branding", icon: Palette },
    { id: "share", label: "Share", icon: Share2 },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "results", label: "Results", icon: Download },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
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
      {activeTab === "style" && <StyleTab formId={formId} template={template} />}
      {activeTab === "share" && <ShareTab formId={formId} template={template} onRefetch={refetch} />}
      {activeTab === "settings" && <SettingsTab formId={formId} template={template} onRefetch={refetch} />}
      {activeTab === "results" && <ResultsTab formId={formId} template={template} />}
      {activeTab === "analytics" && <AnalyticsTab formId={formId} template={template} />}
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
