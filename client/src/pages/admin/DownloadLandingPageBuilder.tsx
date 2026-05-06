/**
 * DownloadLandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG landing page editor for digital download products.
 * Route: /admin/downloads/:productId/landing-builder
 * Reuses the same block system as the LMS LandingPageBuilder.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import {
  ArrowLeft, Save, Eye, Plus, Trash2, GripVertical, Type, Image, Video,
  List, Quote, CreditCard, Minus, Columns, X, Palette, AlignLeft,
  AlignCenter, AlignRight, HelpCircle, Users, Star, Globe, Timer,
  AlertTriangle, CheckSquare, LayoutGrid, Layers, BookOpen, Tag,
  ChevronDown, ChevronUp, Copy, FolderOpen, BookMarked, Code,
} from "lucide-react";
import type { Block, BlockType } from "./LandingPageBuilder";

// Import the block catalog and components from the existing builder
// We'll re-export the key pieces we need
function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── Block Catalog (same as LMS) ──────────────────────────────────────────────
const BLOCK_CATALOG: { type: BlockType; label: string; icon: React.ReactNode; category: string; defaultData: Record<string, any> }[] = [
  // ── Layout & Structure
  {
    type: "hero", label: "Hero / Banner", icon: <Image size={14} />, category: "Layout",
    defaultData: {
      headline: "Your Product Headline", subheadline: "A compelling subtitle that explains the value",
      bgType: "color", bgColor: "#179ca3", gradientFrom: "#179ca3", gradientTo: "#0e4a50",
      gradientDir: "to bottom right", imageUrl: "", videoUrl: "", textColor: "#ffffff", align: "left",
      buttons: [{ text: "Buy Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }],
    },
  },
  { type: "two_column", label: "Two Columns", icon: <Columns size={14} />, category: "Layout",
    defaultData: { leftHtml: "<p>Left column content</p>", rightHtml: "<p>Right column content</p>", leftRatio: 50, bgColor: "#ffffff" } },
  { type: "divided_columns" as BlockType, label: "Divided Columns", icon: <Columns size={14} />, category: "Layout",
    defaultData: { columns: [{ html: "<p>Column 1</p>" }, { html: "<p>Column 2</p>" }], gap: 32, bgColor: "#ffffff" } },
  { type: "spacer", label: "Spacer", icon: <Minus size={14} />, category: "Layout",
    defaultData: { height: 48 } },
  { type: "divider", label: "Divider", icon: <Minus size={14} />, category: "Layout",
    defaultData: { style: "solid", color: "#e5e7eb", thickness: 1, spacing: 32 } },
  // ── Content
  { type: "text", label: "Text / Rich Text", icon: <Type size={14} />, category: "Content",
    defaultData: { html: "<p>Add your content here. Click to edit.</p>", align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } },
  { type: "image", label: "Image", icon: <Image size={14} />, category: "Content",
    defaultData: { url: "", alt: "", caption: "", align: "center", maxWidth: "100%" } },
  { type: "video", label: "Video Embed", icon: <Video size={14} />, category: "Content",
    defaultData: { url: "", type: "youtube", aspectRatio: "16:9" } },
  { type: "embed" as BlockType, label: "Embed HTML", icon: <Code size={14} />, category: "Content",
    defaultData: { embedCode: "", height: 400, caption: "" } },
  { type: "bullets", label: "Bullet List", icon: <List size={14} />, category: "Content",
    defaultData: { headline: "What's Included", items: ["Item one", "Item two", "Item three"], iconColor: "#179ca3", bgColor: "#f8fffe" } },
  { type: "numbered_list", label: "Numbered List", icon: <List size={14} />, category: "Content",
    defaultData: { headline: "How It Works", items: ["Step one", "Step two", "Step three"], accentColor: "#179ca3", bgColor: "#ffffff" } },
  { type: "testimonial", label: "Testimonial", icon: <Quote size={14} />, category: "Content",
    defaultData: { quote: "This product is amazing!", author: "Happy Customer", role: "Sonographer", avatarUrl: "", bgColor: "#f0fdfa" } },
  // ── Conversion
  { type: "pricing_cta", label: "CTA / Pricing", icon: <CreditCard size={14} />, category: "Conversion",
    defaultData: { headline: "Ready to Get Started?", subtext: "Get instant access to all files.", ctaText: "Buy Now", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true } },
  { type: "cta_standalone", label: "CTA Button", icon: <Tag size={14} />, category: "Conversion",
    defaultData: { text: "Get It Now", color: "#179ca3", textColor: "#ffffff", size: "lg", align: "center", link: "" } },
  { type: "faq", label: "FAQ", icon: <HelpCircle size={14} />, category: "Conversion",
    defaultData: { headline: "Frequently Asked Questions", items: [{ q: "What format are the files?", a: "PDF format, ready to print." }], bgColor: "#ffffff" } },
  { type: "alert", label: "Alert / Notice", icon: <AlertTriangle size={14} />, category: "Conversion",
    defaultData: { type: "info", title: "Important", message: "This is a limited-time offer.", bgColor: "" } },
  // ── Social Proof
  { type: "reviews", label: "Reviews", icon: <Star size={14} />, category: "Social Proof",
    defaultData: { headline: "What Others Say", items: [{ name: "Jane D.", rating: 5, text: "Exactly what I needed!" }], bgColor: "#ffffff" } },
  { type: "icon_grid", label: "Feature Grid", icon: <LayoutGrid size={14} />, category: "Social Proof",
    defaultData: { headline: "Why Choose This", columns: 3, items: [{ icon: "check", title: "Feature 1", desc: "Description" }], bgColor: "#f8fffe" } },
  { type: "gallery", label: "Image Gallery", icon: <Layers size={14} />, category: "Social Proof",
    defaultData: { images: [], columns: 3, gap: 8, bgColor: "#ffffff" } },
];

const CATEGORIES = ["Layout", "Content", "Conversion", "Social Proof"];

// ─── Sortable Block Item ──────────────────────────────────────────────────────
function SortableBlockItem({ block, isSelected, onSelect, onDelete, onDuplicate }: {
  block: Block; isSelected: boolean; onSelect: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const catalog = BLOCK_CATALOG.find(c => c.type === block.type);
  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
        isSelected ? "border-teal-500 bg-teal-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      onClick={onSelect}
    >
      <div {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600"><GripVertical size={14} /></div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-gray-700 truncate block">{catalog?.label ?? block.type}</span>
        {block.data?.headline && <span className="text-[10px] text-gray-400 truncate block">{block.data.headline}</span>}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1 rounded hover:bg-gray-100" title="Duplicate"><Copy size={12} /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

// ─── Block Editor Panel ───────────────────────────────────────────────────────
function BlockEditorPanel({ block, onUpdate }: { block: Block; onUpdate: (data: Record<string, any>) => void }) {
  const d = block.data;
  const set = (key: string, val: any) => onUpdate({ ...d, [key]: val });

  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">Subheadline</label><Textarea value={d.subheadline ?? ""} onChange={e => set("subheadline", e.target.value)} rows={2} /></div>
          <div><label className="text-xs font-medium text-gray-600">Background Color</label><input type="color" value={d.bgColor ?? "#179ca3"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
          <div><label className="text-xs font-medium text-gray-600">Text Color</label><input type="color" value={d.textColor ?? "#ffffff"} onChange={e => set("textColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
          <div><label className="text-xs font-medium text-gray-600">Background Image URL</label><Input value={d.imageUrl ?? ""} onChange={e => set("imageUrl", e.target.value)} placeholder="https://..." /></div>
          <div><label className="text-xs font-medium text-gray-600">CTA Button Text</label><Input value={d.buttons?.[0]?.text ?? "Buy Now"} onChange={e => set("buttons", [{ ...d.buttons?.[0], text: e.target.value }])} /></div>
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Content</label><RichTextEditor value={d.html ?? ""} onChange={(html) => set("html", html)} minHeight={150} maxHeight={400} placeholder="Start typing your content..." /></div>
          <div><label className="text-xs font-medium text-gray-600">Background Color</label><input type="color" value={d.bgColor ?? "#ffffff"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
          <div><label className="text-xs font-medium text-gray-600">Text Color</label><input type="color" value={d.textColor ?? "#1a1a1a"} onChange={e => set("textColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Image URL</label><Input value={d.url ?? ""} onChange={e => set("url", e.target.value)} placeholder="https://..." /></div>
          <div><label className="text-xs font-medium text-gray-600">Alt Text</label><Input value={d.alt ?? ""} onChange={e => set("alt", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">Caption</label><Input value={d.caption ?? ""} onChange={e => set("caption", e.target.value)} /></div>
          {d.url && <img src={d.url} alt={d.alt} className="w-full rounded border max-h-40 object-contain" />}
        </div>
      );
    case "video":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Video URL (YouTube/Vimeo)</label><Input value={d.url ?? ""} onChange={e => set("url", e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
        </div>
      );
    case "bullets":
    case "numbered_list":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">Items (one per line)</label><Textarea value={(d.items ?? []).join("\n")} onChange={e => set("items", e.target.value.split("\n"))} rows={5} /></div>
          <div><label className="text-xs font-medium text-gray-600">Accent Color</label><input type="color" value={d.iconColor ?? d.accentColor ?? "#179ca3"} onChange={e => set(block.type === "bullets" ? "iconColor" : "accentColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
          <div><label className="text-xs font-medium text-gray-600">Background Color</label><input type="color" value={d.bgColor ?? "#f8fffe"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    case "testimonial":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Quote</label><Textarea value={d.quote ?? ""} onChange={e => set("quote", e.target.value)} rows={3} /></div>
          <div><label className="text-xs font-medium text-gray-600">Author</label><Input value={d.author ?? ""} onChange={e => set("author", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">Role</label><Input value={d.role ?? ""} onChange={e => set("role", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">Background Color</label><input type="color" value={d.bgColor ?? "#f0fdfa"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    case "pricing_cta":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">Subtext</label><Input value={d.subtext ?? ""} onChange={e => set("subtext", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">CTA Text</label><Input value={d.ctaText ?? ""} onChange={e => set("ctaText", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">CTA Color</label><input type="color" value={d.ctaColor ?? "#179ca3"} onChange={e => set("ctaColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    case "cta_standalone":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Button Text</label><Input value={d.text ?? ""} onChange={e => set("text", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">Color</label><input type="color" value={d.color ?? "#179ca3"} onChange={e => set("color", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
          <div><label className="text-xs font-medium text-gray-600">Text Color</label><input type="color" value={d.textColor ?? "#ffffff"} onChange={e => set("textColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    case "faq": {
      const faqItems: Array<{ q: string; a: string }> = d.items ?? [];
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">FAQ Items</label>
              <button onClick={() => set("items", [...faqItems, { q: "New question?", a: "Answer here." }])} className="text-xs text-teal-600 flex items-center gap-1 hover:text-teal-800"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-2">
              {faqItems.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-medium text-gray-400 uppercase">Question {i + 1}</span>
                    <button onClick={() => set("items", faqItems.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                  <Input value={item.q} onChange={e => { const next = faqItems.map((it, j) => j === i ? { ...it, q: e.target.value } : it); set("items", next); }} placeholder="Enter question..." className="text-sm" />
                  <Textarea value={item.a} onChange={e => { const next = faqItems.map((it, j) => j === i ? { ...it, a: e.target.value } : it); set("items", next); }} placeholder="Enter answer..." rows={2} className="text-sm" />
                </div>
              ))}
            </div>
          </div>
          <div><label className="text-xs font-medium text-gray-600">Background Color</label><input type="color" value={d.bgColor ?? "#ffffff"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    }
    case "alert":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Type</label>
            <select className="w-full border rounded px-2 py-1 text-sm" value={d.type ?? "info"} onChange={e => set("type", e.target.value)}>
              <option value="info">Info</option><option value="warning">Warning</option><option value="success">Success</option><option value="error">Error</option>
            </select>
          </div>
          <div><label className="text-xs font-medium text-gray-600">Title</label><Input value={d.title ?? ""} onChange={e => set("title", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">Message</label><Textarea value={d.message ?? ""} onChange={e => set("message", e.target.value)} rows={3} /></div>
        </div>
      );
    case "reviews": {
      const reviewItems: Array<{ name: string; rating: number; text: string }> = d.items ?? [];
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Reviews</label>
              <button onClick={() => set("items", [...reviewItems, { name: "Reviewer Name", rating: 5, text: "Great product!" }])} className="text-xs text-teal-600 flex items-center gap-1 hover:text-teal-800"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-2">
              {reviewItems.map((r, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-medium text-gray-400 uppercase">Review {i + 1}</span>
                    <button onClick={() => set("items", reviewItems.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                  <Input value={r.name} onChange={e => { const next = reviewItems.map((rv, j) => j === i ? { ...rv, name: e.target.value } : rv); set("items", next); }} placeholder="Reviewer name" className="text-sm" />
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-500">Rating:</label>
                    {[1,2,3,4,5].map(star => (
                      <button key={star} onClick={() => { const next = reviewItems.map((rv, j) => j === i ? { ...rv, rating: star } : rv); set("items", next); }} className={`text-lg ${star <= (r.rating ?? 5) ? "text-yellow-400" : "text-gray-300"}`}>★</button>
                    ))}
                  </div>
                  <Textarea value={r.text} onChange={e => { const next = reviewItems.map((rv, j) => j === i ? { ...rv, text: e.target.value } : rv); set("items", next); }} placeholder="Review text..." rows={2} className="text-sm" />
                </div>
              ))}
            </div>
          </div>
          <div><label className="text-xs font-medium text-gray-600">Background Color</label><input type="color" value={d.bgColor ?? "#ffffff"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    }
    case "icon_grid": {
      const gridItems: Array<{ icon: string; title: string; desc: string }> = d.items ?? [];
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Headline</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600">Columns</label><Input type="number" min={2} max={4} value={d.columns ?? 3} onChange={e => set("columns", parseInt(e.target.value))} /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Features</label>
              <button onClick={() => set("items", [...gridItems, { icon: "⭐", title: "Feature", desc: "Description" }])} className="text-xs text-teal-600 flex items-center gap-1 hover:text-teal-800"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-2">
              {gridItems.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-medium text-gray-400 uppercase">Feature {i + 1}</span>
                    <button onClick={() => set("items", gridItems.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                  <div className="flex gap-2">
                    <Input value={item.icon} onChange={e => { const next = gridItems.map((it, j) => j === i ? { ...it, icon: e.target.value } : it); set("items", next); }} placeholder="Emoji (e.g. ✓)" className="text-sm w-20" />
                    <Input value={item.title} onChange={e => { const next = gridItems.map((it, j) => j === i ? { ...it, title: e.target.value } : it); set("items", next); }} placeholder="Title" className="text-sm flex-1" />
                  </div>
                  <Input value={item.desc} onChange={e => { const next = gridItems.map((it, j) => j === i ? { ...it, desc: e.target.value } : it); set("items", next); }} placeholder="Description" className="text-sm" />
                </div>
              ))}
            </div>
          </div>
          <div><label className="text-xs font-medium text-gray-600">Background Color</label><input type="color" value={d.bgColor ?? "#f8fffe"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    }
    case "two_column":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Left Column</label><RichTextEditor value={d.leftHtml ?? ""} onChange={(html) => set("leftHtml", html)} minHeight={100} maxHeight={300} placeholder="Left column content..." /></div>
          <div><label className="text-xs font-medium text-gray-600">Right Column</label><RichTextEditor value={d.rightHtml ?? ""} onChange={(html) => set("rightHtml", html)} minHeight={100} maxHeight={300} placeholder="Right column content..." /></div>
          <div><label className="text-xs font-medium text-gray-600">Left Width %</label><Input type="number" min={20} max={80} value={d.leftRatio ?? 50} onChange={e => set("leftRatio", parseInt(e.target.value))} /></div>
        </div>
      );
    case "spacer":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Height (px)</label><Input type="number" min={8} max={200} value={d.height ?? 48} onChange={e => set("height", parseInt(e.target.value))} /></div>
        </div>
      );
    case "divider":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Color</label><input type="color" value={d.color ?? "#e5e7eb"} onChange={e => set("color", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
          <div><label className="text-xs font-medium text-gray-600">Thickness</label><Input type="number" min={1} max={10} value={d.thickness ?? 1} onChange={e => set("thickness", parseInt(e.target.value))} /></div>
        </div>
      );
    case "gallery": {
      const galleryImages: string[] = Array.isArray(d.images) ? d.images.map((img: any) => typeof img === 'string' ? img : img?.url ?? '') : [];
      return (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Images</label>
              <button onClick={() => set("images", [...galleryImages, ""])} className="text-xs text-teal-600 flex items-center gap-1 hover:text-teal-800"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-1">
              {galleryImages.map((url: string, i: number) => (
                <div key={i} className="flex gap-1 items-center">
                  <Input value={url} onChange={e => { const next = [...galleryImages]; next[i] = e.target.value; set("images", next); }} placeholder="Image URL" className="text-sm flex-1" />
                  <button onClick={() => set("images", galleryImages.filter((_: any, j: number) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
          <div><label className="text-xs font-medium text-gray-600">Columns</label><Input type="number" min={2} max={5} value={d.columns ?? 3} onChange={e => set("columns", parseInt(e.target.value))} /></div>
          <div><label className="text-xs font-medium text-gray-600">Background Color</label><input type="color" value={d.bgColor ?? "#ffffff"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    }
    case "embed":
      return (
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-600">Embed Code (paste iframe or HTML)</label><Textarea value={d.embedCode ?? ""} onChange={e => set("embedCode", e.target.value)} rows={5} className="font-mono text-xs" placeholder='<iframe src="https://..." width="100%" height="400"></iframe>' /></div>
          <div><label className="text-xs font-medium text-gray-600">Height (px)</label><Input type="number" min={100} max={1200} value={d.height ?? 400} onChange={e => set("height", parseInt(e.target.value))} /></div>
          <div><label className="text-xs font-medium text-gray-600">Caption (optional)</label><Input value={d.caption ?? ""} onChange={e => set("caption", e.target.value)} placeholder="Optional caption below embed" /></div>
        </div>
      );
    case "divided_columns": {
      const cols: Array<{ html: string }> = d.columns ?? [{ html: "<p>Column 1</p>" }, { html: "<p>Column 2</p>" }];
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">Columns ({cols.length})</label>
            {cols.length < 4 && (
              <button onClick={() => set("columns", [...cols, { html: "<p>New column</p>" }])} className="text-xs text-teal-600 flex items-center gap-1 hover:text-teal-800"><Plus size={12} /> Add Column</button>
            )}
          </div>
          {cols.map((col, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-medium text-gray-400 uppercase">Column {i + 1}</span>
                {cols.length > 2 && <button onClick={() => set("columns", cols.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>}
              </div>
              <RichTextEditor value={col.html ?? ""} onChange={(html) => { const next = cols.map((c, j) => j === i ? { ...c, html } : c); set("columns", next); }} minHeight={80} maxHeight={250} placeholder={`Column ${i + 1} content...`} />
            </div>
          ))}
          <div><label className="text-xs font-medium text-gray-600">Gap (px)</label><Input type="number" min={0} max={80} value={d.gap ?? 32} onChange={e => set("gap", parseInt(e.target.value))} /></div>
          <div><label className="text-xs font-medium text-gray-600">Background Color</label><input type="color" value={d.bgColor ?? "#ffffff"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    }
    default:
      return <p className="text-xs text-gray-500 italic">No editor available for this block type.</p>;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DownloadLandingPageBuilder() {
  const { productId } = useParams<{ productId: string }>();
  const [, navigate] = useLocation();
  const numericProductId = Number(productId);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [productInfo, setProductInfo] = useState<{ title: string; slug: string } | null>(null);
  const [activeCat, setActiveCat] = useState<string>("Layout");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { isLoading, data: lpData } = trpc.downloadsAdmin.getLandingBlocks.useQuery(
    { productId: numericProductId },
    { enabled: !isNaN(numericProductId) }
  );

  if (lpData && !hasLoaded) {
    setHasLoaded(true);
    setProductInfo({ title: lpData.productTitle, slug: lpData.productSlug });
    if (lpData.blocks && lpData.blocks.length > 0) {
      setBlocks(lpData.blocks as Block[]);
    } else {
      // Default blocks for a new landing page
      setBlocks([
        { id: uid(), type: "hero", data: { headline: lpData.heroTitle || "Your Product Title", subheadline: lpData.heroSubtitle || "", bgType: "color", bgColor: "#179ca3", textColor: "#ffffff", align: "left", buttons: [{ text: "Buy Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }] } },
        { id: uid(), type: "bullets", data: { headline: "What's Included", items: ["Feature one", "Feature two", "Feature three"], iconColor: "#179ca3", bgColor: "#f8fffe" } },
        { id: uid(), type: "pricing_cta", data: { headline: "Ready to Download?", subtext: "Get instant access to all files.", ctaText: "Buy Now", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true } },
      ]);
    }
  }

  const saveBlocks = trpc.downloadsAdmin.saveLandingBlocks.useMutation({
    onSuccess: () => toast.success("Landing page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try { await saveBlocks.mutateAsync({ productId: numericProductId, blocks }); }
    finally { setIsSaving(false); }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks(prev => { const oldIndex = prev.findIndex(b => b.id === active.id); const newIndex = prev.findIndex(b => b.id === over.id); return arrayMove(prev, oldIndex, newIndex); });
    }
  };

  const addBlock = useCallback((type: BlockType) => {
    const catalog = BLOCK_CATALOG.find(c => c.type === type);
    if (!catalog) return;
    const newBlock: Block = { id: uid(), type, data: { ...catalog.defaultData } };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedId(newBlock.id);
  }, []);

  const updateBlock = useCallback((id: string, data: Record<string, any>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, data } : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const block = prev.find(b => b.id === id);
      if (!block) return prev;
      const newBlock: Block = { ...block, id: uid(), data: { ...block.data } };
      const idx = prev.findIndex(b => b.id === id);
      return [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
    });
  }, []);

  const selectedBlock = blocks.find(b => b.id === selectedId);
  const catalogByCat = BLOCK_CATALOG.filter(c => c.category === activeCat);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/lms")} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 font-medium transition-colors">
            <ArrowLeft size={16} /> Back to Admin
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{productInfo?.title ?? "Loading..."}</span>
        </div>
        <div className="flex items-center gap-2">
          {productInfo?.slug && (
            <a href={`/downloads/${productInfo.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-teal-600 flex items-center gap-1">
              <Eye size={14} /> Preview
            </a>
          )}
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Save size={14} className="mr-1" /> {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Block List */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Blocks ({blocks.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map(block => (
                  <SortableBlockItem
                    key={block.id}
                    block={block}
                    isSelected={selectedId === block.id}
                    onSelect={() => setSelectedId(block.id)}
                    onDelete={() => deleteBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          {/* Add Block */}
          <div className="border-t border-gray-100 p-2">
            <div className="flex gap-1 mb-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${activeCat === cat ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                >{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
              {catalogByCat.map(item => (
                <button key={item.type} onClick={() => addBlock(item.type)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-[11px] text-gray-600 transition-colors text-left"
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel — Block Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedBlock ? (
            <div className="max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  Edit: {BLOCK_CATALOG.find(c => c.type === selectedBlock.type)?.label ?? selectedBlock.type}
                </h3>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <BlockEditorPanel block={selectedBlock} onUpdate={(data) => updateBlock(selectedBlock.id, data)} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Layers size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a block to edit, or add a new one from the left panel.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
