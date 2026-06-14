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
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Plus, Copy, Trash2, Edit2, Eye, RefreshCw, Code2, ArrowLeft,
  LayoutGrid, List, Rows3, Sparkles, CheckCircle2, X
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WidgetItem { type: "course" | "quiz"; id: number }

interface WidgetFormData {
  name: string;
  title: string;
  subtitle: string;
  layout: "grid" | "carousel" | "list";
  theme: "light" | "dark" | "brand";
  cardStyle: "standard" | "compact" | "minimal";
  showPrice: boolean;
  showEnrollButton: boolean;
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
  buttonText: "Enroll Now",
  buttonUrl: "",
  maxCards: 6,
  items: [],
  isActive: true,
};

// ─── Embed code generator ─────────────────────────────────────────────────────

function buildEmbedCode(token: string, origin: string): string {
  const widgetUrl = `${origin}/widget/${token}`;
  return `<!-- All About Ultrasound Course Widget -->
<iframe
  id="aau-widget-${token.slice(0, 8)}"
  src="${widgetUrl}"
  width="100%"
  height="400"
  frameborder="0"
  scrolling="no"
  style="border:none; width:100%; min-height:200px;"
  title="Course Widget"
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

// ─── Course Picker Dialog ─────────────────────────────────────────────────────

function CoursePicker({
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
  const [typeFilter, setTypeFilter] = useState<"all" | "course" | "quiz">("all");

  const { data: coursesData } = trpc.lmsAdmin.listCourses.useQuery(
    { status: "public", type: "all", page: 1, pageSize: 200 },
    { enabled: open }
  );

  useEffect(() => { if (open) setDraft(selected); }, [open]);

  const courses = (coursesData?.courses ?? []).filter(c => {
    const matchesType = typeFilter === "all" || c.type === typeFilter;
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  function toggle(id: number, type: "course" | "quiz") {
    setDraft(prev => {
      const exists = prev.some(i => i.id === id);
      return exists ? prev.filter(i => i.id !== id) : [...prev, { id, type }];
    });
  }

  function isSelected(id: number) { return draft.some(i => i.id === id); }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Courses & Quizzes</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="course">Courses</SelectItem>
              <SelectItem value="quiz">Quizzes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-y-auto flex-1 space-y-1 pr-1">
          {courses.map(c => {
            const sel = isSelected(c.id);
            const itemType = (c.type === "quiz" ? "quiz" : "course") as "course" | "quiz";
            return (
              <div
                key={c.id}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${sel ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20" : "border-transparent hover:bg-muted"}`}
                onClick={() => toggle(c.id, itemType)}
              >
                {c.coverImageUrl ? (
                  <img src={c.coverImageUrl} alt="" className="w-12 h-8 object-cover rounded" />
                ) : (
                  <div className="w-12 h-8 bg-muted rounded flex items-center justify-center text-lg">
                    {c.type === "quiz" ? "📝" : "🎓"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  <Badge variant="outline" className="text-xs capitalize">{c.type}</Badge>
                </div>
                {sel && <CheckCircle2 className="w-5 h-5 text-teal-500 shrink-0" />}
              </div>
            );
          })}
          {courses.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">No courses found</div>
          )}
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

  const { data: coursesData } = trpc.lmsAdmin.listCourses.useQuery(
    { status: "all", type: "all", page: 1, pageSize: 500 },
    { staleTime: 60_000 }
  );
  const courseMap = new Map((coursesData?.courses ?? []).map(c => [c.id, c]));

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
          <Input value={form.buttonUrl} onChange={e => set("buttonUrl", e.target.value)} placeholder="Leave blank to use course URL" className="mt-1" />
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
          <Label htmlFor="sw-btn">Show Enroll Button</Label>
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

      {/* Course/Quiz selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Selected Courses & Quizzes</Label>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add / Edit
          </Button>
        </div>
        {form.items.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
            No courses selected — click "Add / Edit" to pick courses and quizzes
          </div>
        ) : (
          <div className="space-y-1">
            {form.items.map((item, idx) => {
              const course = courseMap.get(item.id);
              return (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                  <span className="text-muted-foreground text-xs w-5 text-right">{idx + 1}.</span>
                  {course?.coverImageUrl ? (
                    <img src={course.coverImageUrl} alt="" className="w-10 h-6 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-6 bg-muted rounded flex items-center justify-center text-sm">
                      {item.type === "quiz" ? "📝" : "🎓"}
                    </div>
                  )}
                  <span className="flex-1 text-sm font-medium truncate">{course?.title ?? `ID: ${item.id}`}</span>
                  <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                  <button
                    onClick={() => set("items", form.items.filter(i => i.id !== item.id))}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CoursePicker
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
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [embedDialogToken, setEmbedDialogToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  const { data: widgets, isLoading } = trpc.widgetAdmin.list.useQuery();
  const { data: editingWidget } = trpc.widgetAdmin.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  const createMutation = trpc.widgetAdmin.create.useMutation({
    onSuccess: () => { utils.widgetAdmin.list.invalidate(); setMode("list"); toast({ title: "Widget created!" }); },
    onError: e => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = trpc.widgetAdmin.update.useMutation({
    onSuccess: () => { utils.widgetAdmin.list.invalidate(); setMode("list"); setEditingId(null); toast({ title: "Widget updated!" }); },
    onError: e => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = trpc.widgetAdmin.delete.useMutation({
    onSuccess: () => { utils.widgetAdmin.list.invalidate(); toast({ title: "Widget deleted" }); },
    onError: e => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const regenMutation = trpc.widgetAdmin.regenerateToken.useMutation({
    onSuccess: () => { utils.widgetAdmin.list.invalidate(); toast({ title: "Token regenerated — update your embed code!" }); },
    onError: e => toast({ title: "Error", description: e.message, variant: "destructive" }),
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

  // ── List mode ──
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Code2 className="w-6 h-6 text-teal-500" /> Embed Widgets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create embeddable course/quiz card grids for any external website
          </p>
        </div>
        <Button onClick={() => setMode("create")} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Widget
        </Button>
      </div>

      {/* How it works */}
      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-teal-800 dark:text-teal-200 mb-1">How it works</p>
            <p className="text-teal-700 dark:text-teal-300">
              Create a widget, select which courses and quizzes to display, then copy the embed code and paste it into any website, blog, or landing page. The widget auto-resizes to fit its content.
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
            let itemCount = 0;
            try { itemCount = JSON.parse(w.items || "[]").length; } catch {}
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
                  <p className="text-xs text-muted-foreground mt-1">{itemCount} item{itemCount !== 1 ? "s" : ""} · Token: <code className="bg-muted px-1 rounded text-xs">{w.token.slice(0, 12)}…</code></p>
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
    </div>
  );
}
