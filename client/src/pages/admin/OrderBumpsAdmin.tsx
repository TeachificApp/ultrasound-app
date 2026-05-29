/**
 * OrderBumpsAdmin.tsx
 * Admin panel for managing order bumps — create, edit, delete bump offers.
 * Supports two presentation modes:
 *   - Widget: inline bump at checkout (simple form)
 *   - Landing Page: full block-builder page at /order-bump/{slug}
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { BlockPreview } from "@/components/BlockPreview";
import type { Block, BlockType } from "@/components/BlockPreview";
import {
  Plus, Trash2, Edit, Copy, ToggleLeft, ToggleRight, TrendingUp,
  ArrowRight, Package, BookOpen, Download, Layers, X, LayoutTemplate,
  Rows, ChevronDown, ChevronUp, GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type OrderBump = {
  id: number;
  triggerType: "course" | "quiz" | "download" | "bundle" | "physical" | "cohort";
  triggerProductId: number;
  triggerPricingOptionId: number | null;
  bumpType: "course" | "quiz" | "download" | "bundle" | "physical" | "cohort";
  bumpProductId: number;
  timing: "before_checkout" | "after_checkout";
  bumpPrice: number;
  discountLabel: string | null;
  headline: string | null;
  subheadline: string | null;
  bodyHtml: string | null;
  imageUrl: string | null;
  ctaText: string;
  ctaColor: string;
  skipText: string;
  isActive: boolean;
  presentationMode: "widget" | "landing_page";
  pageBlocks: string | null;
  slug: string | null;
  impressions: number;
  conversions: number;
  createdAt: string;
  updatedAt: string;
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen size={14} className="text-teal-600" />,
  quiz: <BookOpen size={14} className="text-teal-600" />,
  cohort: <BookOpen size={14} className="text-orange-500" />,
  download: <Download size={14} className="text-blue-600" />,
  bundle: <Layers size={14} className="text-teal-600" />,
  physical: <Package size={14} className="text-amber-600" />,
};

const BUMP_BLOCK_TYPES: Array<{ type: BlockType; label: string; category: string }> = [
  { type: "hero", label: "Hero Banner", category: "Layout" },
  { type: "text", label: "Rich Text", category: "Content" },
  { type: "image", label: "Image", category: "Content" },
  { type: "video", label: "Video", category: "Content" },
  { type: "bullets", label: "Bullet List", category: "Content" },
  { type: "checklist", label: "Checklist", category: "Content" },
  { type: "testimonial", label: "Testimonial", category: "Social Proof" },
  { type: "faq", label: "FAQ", category: "Content" },
  { type: "pricing_cta", label: "CTA Block", category: "Conversion" },
  { type: "countdown", label: "Countdown Timer", category: "Conversion" },
  { type: "alert", label: "Alert Banner", category: "Content" },
  { type: "divider", label: "Divider", category: "Layout" },
  { type: "spacer", label: "Spacer", category: "Layout" },
];

function generateId() {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getDefaultData(type: BlockType): Record<string, any> {
  switch (type) {
    case "hero": return { headline: "Special One-Time Offer", subheadline: "Add this to your order at a special price", bgColor: "#179ca3", textColor: "#fff", ctaText: "Add to Order", buttons: [] };
    case "text": return { html: "<p>Describe your offer here...</p>" };
    case "image": return { url: "", alt: "" };
    case "video": return { url: "" };
    case "bullets": return { headline: "", items: ["Benefit 1", "Benefit 2", "Benefit 3"] };
    case "checklist": return { headline: "", items: ["Feature 1", "Feature 2", "Feature 3"] };
    case "testimonial": return { quote: "This was amazing!", author: "Happy Customer", role: "" };
    case "faq": return { headline: "Frequently Asked Questions", items: [{ q: "Question?", a: "Answer." }] };
    case "pricing_cta": return { ctaText: "Add to Order", ctaColor: "#179ca3", bgColor: "#fff" };
    case "countdown": return { headline: "Offer expires in:", bgColor: "#179ca3", textColor: "#fff", durationMinutes: 30 };
    case "alert": return { message: "Limited time offer!", type: "warning" };
    case "divider": return { style: "solid", color: "#e5e7eb", thickness: 1, spacing: 24 };
    case "spacer": return { height: 32 };
    default: return {};
  }
}

function BlockDataEditor({ block, onUpdate }: { block: Block; onUpdate: (data: Record<string, any>) => void }) {
  const d = block.data;
  const set = (key: string, val: any) => onUpdate({ ...d, [key]: val });

  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-2">
          <div><label className="text-xs text-gray-500">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
          <div><label className="text-xs text-gray-500">Subheadline</label><Input value={d.subheadline ?? ""} onChange={e => set("subheadline", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="text-xs text-gray-500">Background</label><input type="color" value={d.bgColor ?? "#179ca3"} onChange={e => set("bgColor", e.target.value)} className="w-full h-7 mt-0.5 rounded cursor-pointer" /></div>
            <div className="flex-1"><label className="text-xs text-gray-500">Text Color</label><input type="color" value={d.textColor ?? "#ffffff"} onChange={e => set("textColor", e.target.value)} className="w-full h-7 mt-0.5 rounded cursor-pointer" /></div>
          </div>
          <div><label className="text-xs text-gray-500">CTA Button Text</label><Input value={d.ctaText ?? ""} onChange={e => set("ctaText", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
        </div>
      );
    case "text":
      return <div><label className="text-xs text-gray-500 block mb-1">Content</label><RichTextEditor value={d.html ?? ""} onChange={html => set("html", html)} minHeight={80} maxHeight={200} /></div>;
    case "image":
      return (
        <div className="space-y-2">
          <div><label className="text-xs text-gray-500">Image URL</label><Input value={d.url ?? ""} onChange={e => set("url", e.target.value)} placeholder="https://..." className="h-7 text-sm mt-0.5" /></div>
          <div><label className="text-xs text-gray-500">Alt Text</label><Input value={d.alt ?? ""} onChange={e => set("alt", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
        </div>
      );
    case "video":
      return <div><label className="text-xs text-gray-500">Video URL (YouTube/Vimeo/MP4)</label><Input value={d.url ?? ""} onChange={e => set("url", e.target.value)} placeholder="https://..." className="h-7 text-sm mt-0.5" /></div>;
    case "bullets":
    case "checklist":
      return (
        <div className="space-y-2">
          <div><label className="text-xs text-gray-500">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Items (one per line)</label>
            <textarea value={(d.items ?? []).join("\n")} onChange={e => set("items", e.target.value.split("\n"))} rows={4} className="w-full text-sm border border-gray-200 rounded px-2 py-1 resize-none" />
          </div>
        </div>
      );
    case "testimonial":
      return (
        <div className="space-y-2">
          <div><label className="text-xs text-gray-500">Quote</label><textarea value={d.quote ?? ""} onChange={e => set("quote", e.target.value)} rows={2} className="w-full text-sm border border-gray-200 rounded px-2 py-1 resize-none mt-0.5" /></div>
          <div><label className="text-xs text-gray-500">Author</label><Input value={d.author ?? ""} onChange={e => set("author", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
          <div><label className="text-xs text-gray-500">Role / Title</label><Input value={d.role ?? ""} onChange={e => set("role", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
        </div>
      );
    case "faq":
      return (
        <div className="space-y-2">
          <div><label className="text-xs text-gray-500">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Q&amp;A Items</label>
            {(d.items ?? []).map((item: any, i: number) => (
              <div key={i} className="border border-gray-100 rounded p-2 mb-2 space-y-1">
                <Input value={item.q ?? ""} onChange={e => { const next = [...d.items]; next[i] = { ...next[i], q: e.target.value }; set("items", next); }} placeholder="Question" className="h-7 text-sm" />
                <Input value={item.a ?? ""} onChange={e => { const next = [...d.items]; next[i] = { ...next[i], a: e.target.value }; set("items", next); }} placeholder="Answer" className="h-7 text-sm" />
                <button onClick={() => set("items", d.items.filter((_: any, j: number) => j !== i))} className="text-xs text-red-400">Remove</button>
              </div>
            ))}
            <button onClick={() => set("items", [...(d.items ?? []), { q: "", a: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={10} /> Add Q&amp;A</button>
          </div>
        </div>
      );
    case "pricing_cta":
      return (
        <div className="space-y-2">
          <div><label className="text-xs text-gray-500">CTA Text</label><Input value={d.ctaText ?? ""} onChange={e => set("ctaText", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="text-xs text-gray-500">Button Color</label><input type="color" value={d.ctaColor ?? "#179ca3"} onChange={e => set("ctaColor", e.target.value)} className="w-full h-7 mt-0.5 rounded cursor-pointer" /></div>
            <div className="flex-1"><label className="text-xs text-gray-500">Background</label><input type="color" value={d.bgColor ?? "#f0fafa"} onChange={e => set("bgColor", e.target.value)} className="w-full h-7 mt-0.5 rounded cursor-pointer" /></div>
          </div>
        </div>
      );
    case "countdown":
      return (
        <div className="space-y-2">
          <div><label className="text-xs text-gray-500">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
          <div><label className="text-xs text-gray-500">Duration (minutes)</label><Input type="number" value={d.durationMinutes ?? 30} onChange={e => set("durationMinutes", Number(e.target.value))} className="h-7 text-sm mt-0.5" /></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="text-xs text-gray-500">Background</label><input type="color" value={d.bgColor ?? "#179ca3"} onChange={e => set("bgColor", e.target.value)} className="w-full h-7 mt-0.5 rounded cursor-pointer" /></div>
            <div className="flex-1"><label className="text-xs text-gray-500">Text Color</label><input type="color" value={d.textColor ?? "#ffffff"} onChange={e => set("textColor", e.target.value)} className="w-full h-7 mt-0.5 rounded cursor-pointer" /></div>
          </div>
        </div>
      );
    case "alert":
      return (
        <div className="space-y-2">
          <div><label className="text-xs text-gray-500">Message</label><Input value={d.message ?? ""} onChange={e => set("message", e.target.value)} className="h-7 text-sm mt-0.5" /></div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <div className="flex gap-1">
              {(["info", "warning", "success", "error"] as const).map(t => (
                <button key={t} onClick={() => set("type", t)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.type ?? "info") === t ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      );
    case "divider":
      return (
        <div className="flex gap-2">
          <div className="flex-1"><label className="text-xs text-gray-500">Color</label><input type="color" value={d.color ?? "#e5e7eb"} onChange={e => set("color", e.target.value)} className="w-full h-7 mt-0.5 rounded cursor-pointer" /></div>
          <div className="flex-1"><label className="text-xs text-gray-500">Spacing (px)</label><Input type="number" value={d.spacing ?? 24} onChange={e => set("spacing", Number(e.target.value))} className="h-7 text-sm mt-0.5" /></div>
        </div>
      );
    case "spacer":
      return <div><label className="text-xs text-gray-500">Height (px)</label><Input type="number" value={d.height ?? 32} onChange={e => set("height", Number(e.target.value))} className="h-7 text-sm mt-0.5" /></div>;
    default:
      return <p className="text-xs text-gray-400">No settings for this block type.</p>;
  }
}

function SortableBlockRow({ block, isExpanded, onToggle, onRemove, onUpdate }: {
  block: Block;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (data: Record<string, any>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const label = BUMP_BLOCK_TYPES.find(b => b.type === block.type)?.label ?? block.type;

  return (
    <div ref={setNodeRef} style={style} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 p-0.5">
          <GripVertical size={14} />
        </button>
        <span className="flex-1 text-xs font-medium text-gray-700">{label}</span>
        <button onClick={onToggle} className="p-1 text-gray-400 hover:text-gray-600">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-600">
          <Trash2 size={14} />
        </button>
      </div>
      {isExpanded && (
        <div className="p-3 space-y-2">
          <BlockDataEditor block={block} onUpdate={onUpdate} />
          <div className="mt-3 border border-gray-100 rounded overflow-hidden">
            <p className="text-[10px] text-gray-400 px-2 py-1 bg-gray-50 border-b border-gray-100">Preview</p>
            <div style={{ transform: "scale(0.75)", transformOrigin: "top left", width: "133%" }}>
              <BlockPreview block={block} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderBumpsAdmin() {
  const utils = trpc.useUtils();
  const { data: bumps, isLoading } = trpc.orderBumpsAdmin.list.useQuery();
  const [editingBump, setEditingBump] = useState<OrderBump | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const deleteMutation = trpc.orderBumpsAdmin.delete.useMutation({
    onSuccess: () => { toast.success("Order bump deleted"); utils.orderBumpsAdmin.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const duplicateMutation = trpc.orderBumpsAdmin.duplicate.useMutation({
    onSuccess: () => { toast.success("Order bump duplicated"); utils.orderBumpsAdmin.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.orderBumpsAdmin.update.useMutation({
    onSuccess: () => { toast.success("Order bump updated"); utils.orderBumpsAdmin.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const { data: coursesResult } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", page: 1, pageSize: 200 });
  const { data: downloads } = trpc.downloadsAdmin.list.useQuery();
  const { data: physicalProductsData } = trpc.productsAdmin.list.useQuery();
  const { data: bundlesListData } = trpc.downloadsAdmin.listBundles.useQuery();
  const courses = coursesResult?.courses ?? [];
  const physicalProducts = physicalProductsData ?? [];
  const bundlesList = bundlesListData ?? [];

  function getProductName(type: string, id: number): string {
    if (type === "course") { const c = (courses as any[])?.find((c: any) => c.id === id && c.type === "course"); return c?.title ?? `Course #${id}`; }
    if (type === "quiz") { const q = (courses as any[])?.find((c: any) => c.id === id && c.type === "quiz"); return q?.title ?? `Quiz #${id}`; }
    if (type === "cohort") { const co = (courses as any[])?.find((c: any) => c.id === id && c.type === "cohort"); return co?.title ?? `Cohort #${id}`; }
    if (type === "download") { const dl = (downloads as any[])?.find((d: any) => d.id === id); return dl?.title ?? `Download #${id}`; }
    if (type === "bundle") { const b = (bundlesList as any[])?.find((b: any) => b.id === id); return b?.title ?? `Bundle #${id}`; }
    if (type === "physical") { const p = (physicalProducts as any[])?.find((p: any) => p.id === id); return p?.title ?? `Physical Product #${id}`; }
    return `Product #${id}`;
  }

  function toggleActive(bump: OrderBump) {
    updateMutation.mutate({ id: bump.id, isActive: !bump.isActive });
  }

  if (isLoading) return <div className="text-center py-8 text-gray-400">Loading order bumps...</div>;

  if (isCreating || editingBump) {
    return (
      <OrderBumpEditor
        bump={editingBump}
        onClose={() => { setIsCreating(false); setEditingBump(null); }}
        onSaved={() => { setIsCreating(false); setEditingBump(null); utils.orderBumpsAdmin.list.invalidate(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Order Bumps</h3>
          <p className="text-xs text-gray-500">Show upsell offers before or after checkout to increase average order value.</p>
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Plus size={14} className="mr-1" /> New Order Bump
        </Button>
      </div>

      {(!bumps || (bumps as any[]).length === 0) ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Package size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No order bumps yet. Create one to start upselling!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(bumps as OrderBump[]).map((bump) => (
            <div key={bump.id} className={`border rounded-lg p-4 transition-all ${bump.isActive ? "border-teal-200 bg-white" : "border-gray-200 bg-gray-50 opacity-70"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${bump.timing === "before_checkout" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {bump.timing === "before_checkout" ? "Before Checkout" : "After Checkout"}
                    </span>
                    {bump.presentationMode === "landing_page" && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-teal-100 text-teal-700 flex items-center gap-1"><LayoutTemplate size={9} /> Landing Page</span>}
                    {!bump.isActive && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1">{TYPE_ICONS[bump.triggerType]} {getProductName(bump.triggerType, bump.triggerProductId)}</span>
                    <ArrowRight size={12} className="text-gray-400" />
                    <span className="flex items-center gap-1 font-medium text-teal-700">{TYPE_ICONS[bump.bumpType]} {getProductName(bump.bumpType, bump.bumpProductId)}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Price: <strong className="text-gray-700">${Number(bump.bumpPrice).toFixed(2)}</strong></span>
                    {bump.discountLabel && <span className="text-green-600">{bump.discountLabel}</span>}
                    <span className="flex items-center gap-1"><TrendingUp size={10} /> {bump.conversions}/{bump.impressions} ({bump.impressions > 0 ? ((bump.conversions / bump.impressions) * 100).toFixed(1) : "0"}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(bump)} className="p-1.5 rounded hover:bg-gray-100" title={bump.isActive ? "Deactivate" : "Activate"}>
                    {bump.isActive ? <ToggleRight size={18} className="text-teal-600" /> : <ToggleLeft size={18} className="text-gray-400" />}
                  </button>
                  <button onClick={() => setEditingBump(bump)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-teal-600" title="Edit"><Edit size={14} /></button>
                  <button onClick={() => duplicateMutation.mutate({ id: bump.id })} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500" title="Duplicate" disabled={duplicateMutation.isPending}><Copy size={14} /></button>
                  <button onClick={() => { if (confirm("Delete this order bump?")) deleteMutation.mutate({ id: bump.id }); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderBumpEditor({ bump, onClose, onSaved }: {
  bump: OrderBump | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !bump;

  const { data: coursesResult, isLoading: coursesLoading } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", page: 1, pageSize: 200 });
  const { data: downloads, isLoading: downloadsLoading } = trpc.downloadsAdmin.list.useQuery();
  const { data: physicalProductsData, isLoading: physLoading } = trpc.productsAdmin.list.useQuery();
  const { data: bundlesData, isLoading: bundlesLoading } = trpc.downloadsAdmin.listBundles.useQuery();
  const allCourses = coursesResult?.courses ?? [];
  const courses = (allCourses as any[]).filter((c: any) => c.type === "course");
  const quizzes = (allCourses as any[]).filter((c: any) => c.type === "quiz");
  const cohorts = (allCourses as any[]).filter((c: any) => c.type === "cohort");
  const physicalProducts = physicalProductsData ?? [];
  const bundles = bundlesData ?? [];
  const isLoadingProducts = coursesLoading || downloadsLoading || physLoading || bundlesLoading;

  const [form, setForm] = useState({
    triggerType: bump?.triggerType ?? "course" as "course" | "quiz" | "download" | "bundle" | "physical",
    triggerProductId: bump?.triggerProductId ?? 0,
    bumpType: bump?.bumpType ?? "download" as "course" | "quiz" | "download" | "bundle" | "physical",
    bumpProductId: bump?.bumpProductId ?? 0,
    timing: bump?.timing ?? "after_checkout" as "before_checkout" | "after_checkout",
    bumpPrice: bump?.bumpPrice ?? 0,
    discountLabel: bump?.discountLabel ?? "",
    headline: bump?.headline ?? "Special One-Time Offer!",
    subheadline: bump?.subheadline ?? "Add this to your order at a special price",
    bodyHtml: bump?.bodyHtml ?? "",
    imageUrl: bump?.imageUrl ?? "",
    ctaText: bump?.ctaText ?? "Add to Order",
    ctaColor: bump?.ctaColor ?? "#179ca3",
    skipText: bump?.skipText ?? "No thanks, continue",
    isActive: bump?.isActive ?? true,
    presentationMode: (bump?.presentationMode ?? "widget") as "widget" | "landing_page",
    slug: bump?.slug ?? "",
  });

  const [blocks, setBlocks] = useState<Block[]>(() => {
    if (bump?.pageBlocks) {
      try { return JSON.parse(bump.pageBlocks); } catch { return []; }
    }
    return [];
  });
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks(prev => {
        const oldIdx = prev.findIndex(b => b.id === active.id);
        const newIdx = prev.findIndex(b => b.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1) return arrayMove(prev, oldIdx, newIdx);
        return prev;
      });
    }
  }, []);

  const addBlock = (type: BlockType) => {
    const newBlock: Block = { id: generateId(), type, data: getDefaultData(type) };
    setBlocks(prev => [...prev, newBlock]);
    setExpandedBlockId(newBlock.id);
    setShowAddBlock(false);
  };

  const createMutation = trpc.orderBumpsAdmin.create.useMutation({
    onSuccess: () => { toast.success("Order bump created"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.orderBumpsAdmin.update.useMutation({
    onSuccess: () => { toast.success("Order bump updated"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  function getProductsForType(type: string): any[] {
    if (type === "course") return courses;
    if (type === "quiz") return quizzes;
    if (type === "cohort") return cohorts;
    if (type === "download") return (downloads as any[]) ?? [];
    if (type === "bundle") return (bundles as any[]);
    if (type === "physical") return (physicalProducts as any[]);
    return [];
  }

  function handleSave() {
    if (!form.triggerProductId || !form.bumpProductId) {
      toast.error("Please select both trigger and bump products");
      return;
    }
    const payload = {
      ...form,
      discountLabel: form.discountLabel || undefined,
      bodyHtml: form.bodyHtml || undefined,
      imageUrl: form.imageUrl || undefined,
      slug: form.slug || undefined,
      pageBlocks: form.presentationMode === "landing_page" ? JSON.stringify(blocks) : undefined,
    };
    if (isNew) {
      createMutation.mutate(payload as any);
    } else {
      updateMutation.mutate({ id: bump!.id, ...payload } as any);
    }
  }

  const triggerProducts = getProductsForType(form.triggerType);
  const bumpProducts = getProductsForType(form.bumpType);

  const blocksByCategory = BUMP_BLOCK_TYPES.reduce<Record<string, typeof BUMP_BLOCK_TYPES>>((acc, b) => {
    (acc[b.category] = acc[b.category] ?? []).push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">{isNew ? "Create Order Bump" : "Edit Order Bump"}</h3>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500"><X size={18} /></button>
      </div>

      {isLoadingProducts && <div className="text-center py-4 text-sm text-gray-400">Loading products…</div>}

      {/* Presentation Mode Toggle */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Presentation Mode</h4>
        <div className="flex gap-2">
          <button
            onClick={() => setForm(f => ({ ...f, presentationMode: "widget" }))}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-all ${form.presentationMode === "widget" ? "border-teal-600 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >
            <Rows size={16} /> Widget (inline at checkout)
          </button>
          <button
            onClick={() => setForm(f => ({ ...f, presentationMode: "landing_page" }))}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-all ${form.presentationMode === "landing_page" ? "border-teal-600 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >
            <LayoutTemplate size={16} /> Landing Page (full page)
          </button>
        </div>
        {form.presentationMode === "landing_page" && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Page Slug (URL: /order-bump/&#123;slug&#125;)</label>
            <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} placeholder="my-special-offer" />
          </div>
        )}
      </div>

      {/* Trigger & Bump Product Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">When someone buys...</label>
          <select value={form.triggerType} onChange={e => setForm({ ...form, triggerType: e.target.value as any, triggerProductId: 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2">
            <option value="course">Course</option>
            <option value="quiz">Quiz</option>
            <option value="cohort">Cohort</option>
            <option value="download">Download</option>
            <option value="bundle">Bundle</option>
            <option value="physical">Physical Product</option>
          </select>
          <select value={form.triggerProductId} onChange={e => setForm({ ...form, triggerProductId: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value={0}>— Select product —</option>
            {triggerProducts.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">Offer them...</label>
          <select value={form.bumpType} onChange={e => setForm({ ...form, bumpType: e.target.value as any, bumpProductId: 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2">
            <option value="course">Course</option>
            <option value="quiz">Quiz</option>
            <option value="cohort">Cohort</option>
            <option value="download">Download</option>
            <option value="bundle">Bundle</option>
            <option value="physical">Physical Product</option>
          </select>
          <select value={form.bumpProductId} onChange={e => setForm({ ...form, bumpProductId: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value={0}>— Select product —</option>
            {bumpProducts.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      {/* Timing & Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Timing</label>
          <select value={form.timing} onChange={e => setForm({ ...form, timing: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value="before_checkout">Before Checkout</option>
            <option value="after_checkout">After Checkout</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Bump Price ($)</label>
          <Input type="number" step="0.01" min="0" value={form.bumpPrice} onChange={e => setForm({ ...form, bumpPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Discount Label</label>
          <Input value={form.discountLabel} onChange={e => setForm({ ...form, discountLabel: e.target.value })} placeholder="e.g. 50% OFF" />
        </div>
      </div>

      {/* Content */}
      {form.presentationMode === "widget" ? (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Bump Offer Content</h4>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Headline</label>
            <Input value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} placeholder="Special One-Time Offer!" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Subheadline</label>
            <Input value={form.subheadline} onChange={e => setForm({ ...form, subheadline: e.target.value })} placeholder="Add this to your order..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Body Content</label>
            <RichTextEditor value={form.bodyHtml} onChange={(html) => setForm({ ...form, bodyHtml: html })} minHeight={120} maxHeight={300} placeholder="Describe the offer..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Image URL</label>
            <Input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Landing Page Blocks</h4>
            <button onClick={() => setShowAddBlock(v => !v)} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
              <Plus size={13} /> Add Block
            </button>
          </div>

          {showAddBlock && (
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Choose a block type</p>
              {Object.entries(blocksByCategory).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{cat}</p>
                  <div className="flex flex-wrap gap-1">
                    {items.map(b => (
                      <button key={b.type} onClick={() => addBlock(b.type)} className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:border-teal-400 hover:text-teal-700 transition-colors">
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {blocks.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
              <LayoutTemplate size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No blocks yet. Click "Add Block" to start building your landing page.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {blocks.map(block => (
                    <SortableBlockRow
                      key={block.id}
                      block={block}
                      isExpanded={expandedBlockId === block.id}
                      onToggle={() => setExpandedBlockId(prev => prev === block.id ? null : block.id)}
                      onRemove={() => setBlocks(prev => prev.filter(b => b.id !== block.id))}
                      onUpdate={(data) => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, data } : b))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* CTA Customization */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">CTA Button Text</label>
          <Input value={form.ctaText} onChange={e => setForm({ ...form, ctaText: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">CTA Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.ctaColor} onChange={e => setForm({ ...form, ctaColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
            <Input value={form.ctaColor} onChange={e => setForm({ ...form, ctaColor: e.target.value })} className="flex-1" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Skip Text</label>
          <Input value={form.skipText} onChange={e => setForm({ ...form, skipText: e.target.value })} />
        </div>
      </div>

      {/* Widget Preview */}
      {form.presentationMode === "widget" && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-gray-50 to-white">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</p>
          <div className="max-w-md mx-auto border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            {form.discountLabel && <span className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white bg-red-500 mb-2">{form.discountLabel}</span>}
            {form.headline && <h3 className="text-lg font-bold text-gray-900 mb-1">{form.headline}</h3>}
            {form.subheadline && <p className="text-sm text-gray-600 mb-3">{form.subheadline}</p>}
            {form.imageUrl && <img src={form.imageUrl} className="w-full h-32 object-cover rounded-lg mb-3" alt="" />}
            {form.bodyHtml && <div className="prose text-sm mb-4" dangerouslySetInnerHTML={{ __html: form.bodyHtml }} />}
            <div className="flex flex-col gap-2">
              <button className="w-full py-3 rounded-lg text-white font-semibold text-sm" style={{ backgroundColor: form.ctaColor }}>
                {form.ctaText} — ${Number(form.bumpPrice).toFixed(2)}
              </button>
              <button className="text-xs text-gray-400 hover:text-gray-600 underline">{form.skipText}</button>
            </div>
          </div>
        </div>
      )}

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
          <span className="text-sm text-gray-700">Active (show to customers)</span>
        </label>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
          {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : isNew ? "Create Order Bump" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
