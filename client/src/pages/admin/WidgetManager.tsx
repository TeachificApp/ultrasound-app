import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getAdminUrl } from "@/hooks/useSubdomain";
import {
  Plus, Copy, Trash2, Edit2, Eye, RefreshCw, Code2, ArrowLeft,
  LayoutGrid, List, Rows3, Sparkles, CheckCircle2, X, ChevronLeft,
  Package, Star, ChevronUp, ChevronDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemType = "course" | "quiz" | "cohort" | "download" | "bundle" | "webinar" | "membership" | "physical" | "workshop" | "community";

interface WidgetItem { type: ItemType; id: number }

interface WidgetFormData {
  name: string;
  title: string;
  subtitle: string;
  layout: "grid" | "carousel" | "list";
  theme: "light" | "dark" | "brand";
  cardStyle: "standard" | "compact" | "minimal";
  showPrice: boolean;
  showEnrollButton: boolean;
  showCourseDetails: boolean;
  buttonText: string;
  buttonUrl: string;
  maxCards: number;
  items: WidgetItem[];
  isActive: boolean;
}

const DEFAULT_FORM: WidgetFormData = {
  name: "",
  title: "",
  subtitle: "",
  layout: "grid",
  theme: "light",
  cardStyle: "standard",
  showPrice: true,
  showEnrollButton: true,
  showCourseDetails: false,
  buttonText: "Enroll Now",
  buttonUrl: "",
  maxCards: 6,
  items: [],
  isActive: true,
};

// ─── Type metadata ────────────────────────────────────────────────────────────

const TYPE_META: Record<ItemType, { label: string; emoji: string; color: string }> = {
  course:     { label: "Course",      emoji: "🎓", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  quiz:       { label: "Quiz",        emoji: "📝", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  cohort:     { label: "Cohort",      emoji: "🗓️", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  download:   { label: "Download",    emoji: "📥", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  bundle:     { label: "Bundle",      emoji: "📦", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  webinar:    { label: "Webinar",     emoji: "🎙️", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  membership: { label: "Membership",  emoji: "⭐", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  physical:   { label: "Physical",    emoji: "📦", color: "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-300" },
  workshop:   { label: "Workshop",    emoji: "🛠️", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
  community:  { label: "Community",   emoji: "👥", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
};

const TYPE_GROUPS: { label: string; types: ItemType[] }[] = [
  { label: "Courses, Quizzes & Cohorts", types: ["course", "quiz", "cohort"] },
  { label: "Downloads & Bundles", types: ["download", "bundle"] },
  { label: "Webinars & Workshops", types: ["webinar", "workshop"] },
  { label: "Memberships", types: ["membership"] },
  { label: "Physical Products", types: ["physical"] },
  { label: "Communities", types: ["community"] },
];

// ─── Embed code generator ─────────────────────────────────────────────────────

function buildEmbedCode(token: string, origin: string): string {
  const widgetUrl = `${origin}/widget/${token}`;
  return `<!-- All About Ultrasound Content Widget -->
<iframe
  id="aau-widget-${token.slice(0, 8)}"
  src="${widgetUrl}"
  width="100%"
  height="400"
  frameborder="0"
  scrolling="no"
  style="border:none; width:100%; min-height:200px;"
  title="Content Widget"
></iframe>
<script>
  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "ultrasound-widget-resize") {
      var iframe = document.getElementById("aau-widget-${token.slice(0, 8)}");
      if (iframe) iframe.style.height = (e.data.height + 16) + "px";
    }
  });
</script>`;
}

// ─── Content Picker Dialog ────────────────────────────────────────────────────

function ContentPicker({
  open,
  onClose,
  selected,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  selected: WidgetItem[];
  onSave: (items: WidgetItem[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<WidgetItem[]>(selected);
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");

  const { data: allContent = [], isLoading } = trpc.widgetAdmin.listAllContent.useQuery(undefined, { enabled: open });

  useEffect(() => { if (open) setDraft(selected); }, [open]);

  const filtered = allContent.filter(c => {
    const matchesType = typeFilter === "all" || c.type === typeFilter;
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  function toggle(id: number, type: ItemType) {
    setDraft(prev => {
      const key = `${type}:${id}`;
      const exists = prev.some(i => `${i.type}:${i.id}` === key);
      return exists ? prev.filter(i => `${i.type}:${i.id}` !== key) : [...prev, { id, type }];
    });
  }

  function isSelected(id: number, type: string) { return draft.some(i => i.id === id && i.type === type); }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Content</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_META).map(([t, m]) => (
                <SelectItem key={t} value={t}>{m.emoji} {m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-y-auto flex-1 space-y-1 pr-1">
          {isLoading && <div className="text-center text-muted-foreground py-8 text-sm">Loading…</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">No content found</div>
          )}
          {filtered.map(c => {
            const meta = TYPE_META[c.type as ItemType] ?? { label: c.type, emoji: "📄", color: "" };
            const sel = isSelected(c.id, c.type);
            return (
              <div
                key={`${c.type}:${c.id}`}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${sel ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20" : "border-transparent hover:bg-muted"}`}
                onClick={() => toggle(c.id, c.type as ItemType)}
              >
                {c.coverImageUrl ? (
                  <img src={c.coverImageUrl} alt="" className="w-12 h-8 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-12 h-8 bg-muted rounded flex items-center justify-center text-lg shrink-0">
                    {meta.emoji}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{meta.label}</span>
                </div>
                {sel && <CheckCircle2 className="w-5 h-5 text-teal-500 shrink-0" />}
              </div>
            );
          })}
        </div>
        <DialogFooter className="mt-3">
          <div className="text-sm text-muted-foreground mr-auto">{draft.length} selected</div>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(draft); onClose(); }} className="bg-teal-600 hover:bg-teal-700 text-white">
            Save Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Widget Form ──────────────────────────────────────────────────────────────

function WidgetForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initial: WidgetFormData;
  onSubmit: (data: WidgetFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<WidgetFormData>(initial);
  const [pickerOpen, setPickerOpen] = useState(false);

  function set<K extends keyof WidgetFormData>(key: K, value: WidgetFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // Fetch all content for the selected-items display names
  const { data: allContent = [] } = trpc.widgetAdmin.listAllContent.useQuery(undefined, { staleTime: 60_000 });
  const contentMap = new Map(allContent.map(c => [`${c.type}:${c.id}`, c]));

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label>Widget Name <span className="text-red-500">*</span></Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Homepage Course Showcase" className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Internal name — not shown to visitors</p>
        </div>
        <div>
          <Label>Display Title</Label>
          <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Featured Courses" className="mt-1" />
        </div>
        <div>
          <Label>Subtitle</Label>
          <Textarea value={form.subtitle} onChange={e => set("subtitle", e.target.value)} placeholder="Optional tagline shown below the title" className="mt-1" rows={2} />
        </div>
      </div>

      {/* Layout & Style */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Layout</Label>
          <Select value={form.layout} onValueChange={v => set("layout", v as any)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="grid"><span className="flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> Grid</span></SelectItem>
              <SelectItem value="list"><span className="flex items-center gap-2"><List className="w-4 h-4" /> List</span></SelectItem>
              <SelectItem value="carousel"><span className="flex items-center gap-2"><Rows3 className="w-4 h-4" /> Carousel</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Theme</Label>
          <Select value={form.theme} onValueChange={v => set("theme", v as any)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">☀️ Light</SelectItem>
              <SelectItem value="dark">🌙 Dark</SelectItem>
              <SelectItem value="brand">🩵 Brand (Teal)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Card Style</Label>
          <Select value={form.cardStyle} onValueChange={v => set("cardStyle", v as any)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* CTA settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Button Text</Label>
          <Input value={form.buttonText} onChange={e => set("buttonText", e.target.value)} placeholder="Enroll Now" className="mt-1" />
        </div>
        <div>
          <Label>Button URL Override</Label>
          <Input value={form.buttonUrl} onChange={e => set("buttonUrl", e.target.value)} placeholder="Leave blank to use content URL" className="mt-1" />
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={form.showPrice} onCheckedChange={v => set("showPrice", v)} id="sw-price" />
          <Label htmlFor="sw-price">Show Price</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.showEnrollButton} onCheckedChange={v => set("showEnrollButton", v)} id="sw-btn" />
          <Label htmlFor="sw-btn">Show Button</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.showCourseDetails} onCheckedChange={v => set("showCourseDetails", v)} id="sw-details" />
          <Label htmlFor="sw-details">Show Course Details &amp; Dates</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} id="sw-active" />
          <Label htmlFor="sw-active">Active</Label>
        </div>
      </div>

      {/* Max cards */}
      <div className="w-40">
        <Label>Max Cards Shown</Label>
        <Input type="number" min={1} max={50} value={form.maxCards} onChange={e => set("maxCards", parseInt(e.target.value) || 6)} className="mt-1" />
      </div>

      {/* Content selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Selected Content</Label>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add / Edit
          </Button>
        </div>
        {form.items.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
            No content selected — click "Add / Edit" to pick from all product types
          </div>
        ) : (
          <div className="space-y-1">
            {form.items.map((item, idx) => {
              const content = contentMap.get(`${item.type}:${item.id}`);
              const meta = TYPE_META[item.type] ?? { label: item.type, emoji: "📄", color: "" };
              function moveItem(from: number, to: number) {
                const next = [...form.items];
                const [moved] = next.splice(from, 1);
                next.splice(to, 0, moved);
                set("items", next);
              }
              return (
                <div key={`${item.type}:${item.id}`} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                  {/* Reorder buttons */}
                  <div className="flex flex-col shrink-0">
                    <button
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, idx - 1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                      title="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === form.items.length - 1}
                      onClick={() => moveItem(idx, idx + 1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                      title="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-muted-foreground text-xs w-5 text-right shrink-0">{idx + 1}.</span>
                  {content?.coverImageUrl ? (
                    <img src={content.coverImageUrl} alt="" className="w-10 h-6 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-10 h-6 bg-muted rounded flex items-center justify-center text-sm shrink-0">{meta.emoji}</div>
                  )}
                  <span className="flex-1 text-sm font-medium truncate">{content?.title ?? `ID: ${item.id}`}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${meta.color}`}>{meta.label}</span>
                  <button
                    onClick={() => set("items", form.items.filter(i => !(i.id === item.id && i.type === item.type)))}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ContentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={form.items}
        onSave={items => set("items", items)}
      />

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSubmit(form)}
          disabled={isLoading || !form.name.trim()}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          {isLoading ? "Saving…" : "Save Widget"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WidgetManager() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [embedDialogToken, setEmbedDialogToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  const [mainTab, setMainTab] = useState<"content" | "included-items">("content");
  const [iiCopied, setIiCopied] = useState<string | null>(null);
  const [iiExpandedId, setIiExpandedId] = useState<string | null>(null);

  const { data: memberships, isLoading: membershipsLoading } = trpc.membership.listAll.useQuery();
  const { data: bundlesData, isLoading: bundlesLoading } = trpc.bundlesAdmin.list.useQuery({ pageSize: 500 });

  const { data: widgets, isLoading } = trpc.widgetAdmin.list.useQuery();
  const { data: editingWidget } = trpc.widgetAdmin.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  const createMutation = trpc.widgetAdmin.create.useMutation({
    onSuccess: () => { utils.widgetAdmin.list.invalidate(); setMode("list"); toast.success("Widget created!"); },
    onError: e => toast.error(e.message),
  });

  const updateMutation = trpc.widgetAdmin.update.useMutation({
    onSuccess: () => { utils.widgetAdmin.list.invalidate(); setMode("list"); setEditingId(null); toast.success("Widget updated!"); },
    onError: e => toast.error(e.message),
  });

  const deleteMutation = trpc.widgetAdmin.delete.useMutation({
    onSuccess: () => { utils.widgetAdmin.list.invalidate(); toast.success("Widget deleted"); },
    onError: e => toast.error(e.message),
  });

  const regenMutation = trpc.widgetAdmin.regenerateToken.useMutation({
    onSuccess: () => { utils.widgetAdmin.list.invalidate(); toast.success("Token regenerated — update your embed code!"); },
    onError: e => toast.error(e.message),
  });

  function handleSubmit(data: WidgetFormData) {
    const payload = { ...data, items: data.items };
    if (mode === "create") {
      createMutation.mutate(payload);
    } else if (mode === "edit" && editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    }
  }

  function copyEmbedCode(token: string) {
    const code = buildEmbedCode(token, window.location.origin);
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function widgetToForm(w: any): WidgetFormData {
    let items: WidgetItem[] = [];
    try { items = JSON.parse(w.items || "[]"); } catch {}
    return {
      name: w.name ?? "",
      title: w.title ?? "",
      subtitle: w.subtitle ?? "",
      layout: w.layout ?? "grid",
      theme: w.theme ?? "light",
      cardStyle: w.cardStyle ?? "standard",
      showPrice: w.showPrice ?? true,
      showEnrollButton: w.showEnrollButton ?? true,
      showCourseDetails: (w as any).showCourseDetails ?? false,
      buttonText: w.buttonText ?? "Enroll Now",
      buttonUrl: w.buttonUrl ?? "",
      maxCards: w.maxCards ?? 6,
      items,
      isActive: w.isActive ?? true,
    };
  }

  if (!user || user.role !== "admin") {
    return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  }

  // ── Edit mode ──
  if (mode === "edit" && editingId) {
    if (!editingWidget) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => { setMode("list"); setEditingId(null); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold">Edit Widget</h1>
        </div>
        <WidgetForm
          initial={widgetToForm(editingWidget)}
          onSubmit={handleSubmit}
          onCancel={() => { setMode("list"); setEditingId(null); }}
          isLoading={updateMutation.isPending}
        />
      </div>
    );
  }

  // ── Create mode ──
  if (mode === "create") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setMode("list")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold">New Embed Widget</h1>
        </div>
        <WidgetForm
          initial={DEFAULT_FORM}
          onSubmit={handleSubmit}
          onCancel={() => setMode("list")}
          isLoading={createMutation.isPending}
        />
      </div>
    );
  }

  function copyIiCode(key: string, code: string) {
    navigator.clipboard.writeText(code);
    setIiCopied(key);
    setTimeout(() => setIiCopied(null), 2000);
  }

  function buildIiScriptSnippet(source: "membership" | "bundle", id: number, title: string) {
    const base = window.location.origin;
    return `<!-- Included Items Widget: ${title} -->
<div data-included-items-embed="${source}:${id}"
     data-accent="#14b8a6"
     data-theme="light"
     data-layout="grid"
     data-columns="3"
     data-base-url="${base}"></div>
<script src="${base}/embed/included-items.js" async></script>`;
  }

  function buildIiIframeSnippet(source: "membership" | "bundle", id: number) {
    const base = window.location.origin;
    const src = `${base}/embed/included-items?source=${source}&id=${id}&accent=%2314b8a6&theme=light&layout=grid&columns=3`;
    return `<iframe\n  src="${src}"\n  style="width:100%;border:none;display:block;min-height:200px;"\n  scrolling="no" frameborder="0" allowtransparency="true"\n></iframe>`;
  }

  // ── List mode ──
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-4">
        <a href={getAdminUrl("/platform-admin")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-3 h-3" /> Platform Admin
        </a>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Code2 className="w-6 h-6 text-teal-500" /> Embed Widgets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create embeddable card grids for any external website — courses, downloads, webinars, memberships, and more
          </p>
        </div>
        {mainTab === "content" && (
          <Button onClick={() => setMode("create")} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> New Widget
          </Button>
        )}
      </div>

      {/* Main tabs */}
      <Tabs value={mainTab} onValueChange={v => setMainTab(v as any)} className="mb-6">
        <TabsList>
          <TabsTrigger value="content"><Code2 className="w-4 h-4 mr-1.5" />Content Widgets</TabsTrigger>
          <TabsTrigger value="included-items"><Package className="w-4 h-4 mr-1.5" />Included Items Widgets</TabsTrigger>
        </TabsList>

        {/* ── Included Items tab ── */}
        <TabsContent value="included-items" className="mt-4">
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-teal-800 dark:text-teal-200 mb-1">Included Items Widgets</p>
                <p className="text-teal-700 dark:text-teal-300">
                  Embed the list of included items for any membership plan or bundle on any external website.
                  Copy the script tag or iframe snippet and paste it into your HTML. The widget auto-resizes to fit its content.
                  For advanced options (theme, accent, headline, CTA), use the Widget Code tab inside each membership or bundle editor.
                </p>
              </div>
            </div>
          </div>

          {/* Memberships */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Star className="w-4 h-4" /> Membership Plans
            </h3>
            {membershipsLoading ? (
              <p className="text-sm text-muted-foreground">Loading memberships…</p>
            ) : !memberships || memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No membership plans found.</p>
            ) : (
              <div className="space-y-2">
                {memberships.map((m: any) => {
                  const key = `membership:${m.id}`;
                  const expanded = iiExpandedId === key;
                  return (
                    <div key={key} className="border rounded-xl bg-card overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        <Star className="w-4 h-4 text-yellow-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.title}</p>
                          <p className="text-xs text-muted-foreground">membership · id:{m.id}</p>
                        </div>
                        <a href={getAdminUrl(`/admin/memberships/${m.id}?tab=widget`)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-600 transition-colors px-2 py-1 rounded border border-transparent hover:border-teal-200">
                          <Edit2 className="w-3 h-3" /> Advanced
                        </a>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setIiExpandedId(expanded ? null : key)}>
                          <Code2 className="w-3.5 h-3.5" /> {expanded ? "Hide" : "Get Code"}
                        </Button>
                      </div>
                      {expanded && (
                        <div className="border-t bg-muted/30 p-3 space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Script Tag (recommended)</span>
                              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={() => copyIiCode(key + ":script", buildIiScriptSnippet("membership", m.id, m.title))}>
                                {iiCopied === key + ":script" ? <><CheckCircle2 className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">{buildIiScriptSnippet("membership", m.id, m.title)}</pre>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Raw iframe</span>
                              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={() => copyIiCode(key + ":iframe", buildIiIframeSnippet("membership", m.id))}>
                                {iiCopied === key + ":iframe" ? <><CheckCircle2 className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">{buildIiIframeSnippet("membership", m.id)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bundles */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" /> Bundles
            </h3>
            {bundlesLoading ? (
              <p className="text-sm text-muted-foreground">Loading bundles…</p>
            ) : !bundlesData || bundlesData.bundles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bundles found.</p>
            ) : (
              <div className="space-y-2">
                {bundlesData.bundles.map((b: any) => {
                  const key = `bundle:${b.id}`;
                  const expanded = iiExpandedId === key;
                  return (
                    <div key={key} className="border rounded-xl bg-card overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        <Package className="w-4 h-4 text-orange-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{b.title}</p>
                          <p className="text-xs text-muted-foreground">bundle · id:{b.id}</p>
                        </div>
                        <a href={getAdminUrl(`/admin/bundles/${b.id}?tab=widget`)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-600 transition-colors px-2 py-1 rounded border border-transparent hover:border-teal-200">
                          <Edit2 className="w-3 h-3" /> Advanced
                        </a>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setIiExpandedId(expanded ? null : key)}>
                          <Code2 className="w-3.5 h-3.5" /> {expanded ? "Hide" : "Get Code"}
                        </Button>
                      </div>
                      {expanded && (
                        <div className="border-t bg-muted/30 p-3 space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Script Tag (recommended)</span>
                              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={() => copyIiCode(key + ":script", buildIiScriptSnippet("bundle", b.id, b.title))}>
                                {iiCopied === key + ":script" ? <><CheckCircle2 className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">{buildIiScriptSnippet("bundle", b.id, b.title)}</pre>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Raw iframe</span>
                              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={() => copyIiCode(key + ":iframe", buildIiIframeSnippet("bundle", b.id))}>
                                {iiCopied === key + ":iframe" ? <><CheckCircle2 className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">{buildIiIframeSnippet("bundle", b.id)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Content Widgets tab ── */}
        <TabsContent value="content" className="mt-4">

      {/* How it works */}
      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-teal-800 dark:text-teal-200 mb-1">How it works</p>
            <p className="text-teal-700 dark:text-teal-300">
              Create a widget, select which content to display (courses, quizzes, downloads, bundles, webinars, workshops, memberships, physical products, or communities), then copy the embed code and paste it into any website or landing page.
            </p>
          </div>
        </div>
      </div>

      {/* Widget list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading widgets…</div>
      ) : !widgets || widgets.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <Code2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No widgets yet</p>
          <p className="text-sm text-muted-foreground/70 mb-4">Create your first embeddable widget to get started</p>
          <Button onClick={() => setMode("create")} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> Create Widget
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {widgets.map(w => {
            let items: WidgetItem[] = [];
            try { items = JSON.parse(w.items || "[]"); } catch {}
            // Count by type
            const typeCounts = items.reduce<Record<string, number>>((acc, i) => {
              acc[i.type] = (acc[i.type] ?? 0) + 1;
              return acc;
            }, {});
            return (
              <div key={w.id} className="border rounded-xl p-4 bg-card flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{w.name}</span>
                    <Badge variant={w.isActive ? "default" : "secondary"} className={w.isActive ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" : ""}>
                      {w.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="capitalize">{w.layout}</Badge>
                    <Badge variant="outline" className="capitalize">{w.theme}</Badge>
                  </div>
                  {w.title && <p className="text-sm text-muted-foreground mt-0.5">{w.title}</p>}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {Object.entries(typeCounts).map(([t, count]) => {
                      const meta = TYPE_META[t as ItemType] ?? { emoji: "📄", label: t, color: "" };
                      return (
                        <span key={t} className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>
                          {meta.emoji} {count} {meta.label}{count !== 1 ? "s" : ""}
                        </span>
                      );
                    })}
                    {items.length === 0 && <span className="text-xs text-muted-foreground">No items</span>}
                    <span className="text-xs text-muted-foreground ml-1">· Token: <code className="bg-muted px-1 rounded text-xs">{w.token.slice(0, 12)}…</code></span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setPreviewToken(w.token)} title="Preview">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEmbedDialogToken(w.token); }} title="Get embed code">
                    <Code2 className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingId(w.id); setMode("edit"); }} title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { if (confirm("Regenerate token? Existing embed codes will stop working.")) regenMutation.mutate({ id: w.id }); }}
                    title="Regenerate token"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { if (confirm("Delete this widget?")) deleteMutation.mutate({ id: w.id }); }}
                    title="Delete"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Embed code dialog */}
      <Dialog open={!!embedDialogToken} onOpenChange={v => !v && setEmbedDialogToken(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Embed Code</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Copy and paste this code into any website, blog post, or landing page. The widget auto-resizes to fit its content.
          </p>
          <Tabs defaultValue="iframe">
            <TabsList>
              <TabsTrigger value="iframe">iFrame Embed</TabsTrigger>
              <TabsTrigger value="url">Direct URL</TabsTrigger>
            </TabsList>
            <TabsContent value="iframe">
              <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {embedDialogToken ? buildEmbedCode(embedDialogToken, window.location.origin) : ""}
              </pre>
            </TabsContent>
            <TabsContent value="url">
              <div className="bg-muted rounded-lg p-4 text-xs break-all">
                {embedDialogToken ? `${window.location.origin}/widget/${embedDialogToken}` : ""}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Use this URL directly in your own iframe or as a link.</p>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button
              onClick={() => embedDialogToken && copyEmbedCode(embedDialogToken)}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {copied ? <><CheckCircle2 className="w-4 h-4 mr-1" /> Copied!</> : <><Copy className="w-4 h-4 mr-1" /> Copy Embed Code</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewToken} onOpenChange={v => !v && setPreviewToken(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="w-4 h-4" /> Widget Preview</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">This is how the widget will appear when embedded on an external website.</p>
          {previewToken && (
            <iframe
              src={`/widget/${previewToken}`}
              className="w-full rounded-lg border"
              style={{ minHeight: 300, height: 400 }}
              title="Widget Preview"
            />
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
