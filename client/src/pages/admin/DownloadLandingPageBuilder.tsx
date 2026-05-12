/**
 * DownloadLandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG landing page editor for digital download products.
 * Route: /admin/downloads/:productId/landing-builder
 * Reuses the same block system as the LMS LandingPageBuilder.
 */
import { useState, useEffect, useCallback, useRef } from "react";
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
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";
import { FUNNEL_TEMPLATES, getFunnelTemplateBlocks } from "@/lib/funnelTemplates";
import {
  ArrowLeft, Save, Eye, Plus, Trash2, GripVertical, Type, Image, Video,
  List, Quote, CreditCard, Minus, Columns, X, Palette, AlignLeft,
  AlignCenter, AlignRight, HelpCircle, Users, Star, Globe, Timer,
  AlertTriangle, CheckSquare, LayoutGrid, Layers, BookOpen, Tag,
  ChevronDown, ChevronUp, Copy, FolderOpen, BookMarked, Code, Upload, ShoppingCart, Package,
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
      headline: "Your Product Headline", headline2: "", subheadline: "A compelling subtitle that explains the value",
      bgType: "color", bgColor: "#179ca3", gradientFrom: "#179ca3", gradientTo: "#0e4a50",
      gradientDir: "to bottom right", imageUrl: "", videoUrl: "", textColor: "#ffffff",
      headlineColor: "", headline2Color: "",
      align: "left", inlineMediaUrl: "", inlineMediaType: "image", inlineMediaPlacement: "right",
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
  // ── Funnel
  { type: "funnel_workflow", label: "Funnel Workflow", icon: <Layers size={14} />, category: "Funnel",
    defaultData: { eyebrow: "Sales funnel", headline: "Connected sales workflow", subtext: "Link landing, checkout, bump, and thank-you pages together.", accentColor: "#179ca3", bgColor: "#f8fffe", steps: [{ name: "Landing Page", role: "Warm traffic with the offer.", url: "#top", cta: "Open" }, { name: "Checkout", role: "Sell the core product.", url: "#checkout", cta: "Buy" }, { name: "Order Bump", role: "Add a digital or physical product.", url: "#order-bump", cta: "View" }, { name: "Thank You", role: "Confirm delivery.", url: "/thank-you", cta: "Next" }] } },
  { type: "product_offer_stack", label: "Product Offer Stack", icon: <Package size={14} />, category: "Funnel",
    defaultData: { headline: "Build a higher-value cart", subtext: "Promote digital and physical add-ons.", accentColor: "#179ca3", bgColor: "#ffffff", products: [{ type: "digital", title: "Digital Pack", description: "Instant-access files and templates.", price: "$49", ctaText: "Add digital item", ctaLink: "#checkout", fulfillment: "Delivered instantly." }, { type: "physical", title: "Printed Workbook", description: "A shipped companion product.", price: "$29", ctaText: "Add physical item", ctaLink: "#order-bump", fulfillment: "Ships after checkout." }] } },
  { type: "order_bump_checkout", label: "Order Bump Checkout", icon: <ShoppingCart size={14} />, category: "Funnel",
    defaultData: { anchorId: "order-bump", discountLabel: "One-time offer", headline: "Add the printed workbook", subheadline: "A checkout-ready bump for buyers.", description: "Promote a digital bonus or physical add-on before payment.", productType: "physical", price: "$29", compareAtPrice: "$59", checkboxLabel: "Yes, add this to my order", ctaText: "Add bump and continue", skipText: "Continue without bump", shippingNote: "Shipping collected at checkout", features: ["Digital or physical products", "One-click add-to-order messaging", "Pairs with Order Bumps admin"], accentColor: "#f59e0b", bgColor: "#fff7ed" } },
  // ── Social Proof
  { type: "reviews", label: "Reviews", icon: <Star size={14} />, category: "Social Proof",
    defaultData: { headline: "What Others Say", items: [{ name: "Jane D.", rating: 5, text: "Exactly what I needed!" }], bgColor: "#ffffff" } },
  { type: "icon_grid", label: "Feature Grid", icon: <LayoutGrid size={14} />, category: "Social Proof",
    defaultData: { headline: "Why Choose This", columns: 3, items: [{ icon: "check", title: "Feature 1", desc: "Description" }], bgColor: "#f8fffe" } },
  { type: "gallery", label: "Image Gallery", icon: <Layers size={14} />, category: "Social Proof",
    defaultData: { images: [], columns: 3, gap: 8, bgColor: "#ffffff" } },
];

const CATEGORIES = ["Layout", "Content", "Conversion", "Funnel", "Social Proof"];

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

// ─── Hero Editor Component ───────────────────────────────────────────────────────
function HeroEditor({ d, set, onUpdate }: { d: Record<string, any>; set: (key: string, val: any) => void; onUpdate: (data: Record<string, any>) => void }) {
  const bgImageRef = useRef<HTMLInputElement>(null);
  const bgVideoRef = useRef<HTMLInputElement>(null);
  const inlineMediaRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const uploadMedia = trpc.auth.uploadPageMedia.useMutation();

  const handleFileUpload = async (file: File, targetField: string, context: string) => {
    if (file.size > 40 * 1024 * 1024) { toast.error("File must be under 40 MB"); return; }
    setUploading(targetField);
    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
      const result = await uploadMedia.mutateAsync({ dataUri, mimeType: file.type, fileName: file.name, context });
      set(targetField, result.url);
      toast.success("File uploaded successfully");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    setUploading(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Headlines ── */}
      <div className="border-b pb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Headlines</h4>
        <div className="space-y-2">
          <div><label className="text-xs font-medium text-gray-600">Headline (Line 1)</label><Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} /></div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Line 1 Color</label>
            <input type="color" value={d.headlineColor || d.textColor || "#ffffff"} onChange={e => set("headlineColor", e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
            {d.headlineColor && <button onClick={() => set("headlineColor", "")} className="text-[10px] text-gray-400 hover:text-red-500">Reset</button>}
          </div>
          <div><label className="text-xs font-medium text-gray-600">Headline (Line 2)</label><Input value={d.headline2 ?? ""} onChange={e => set("headline2", e.target.value)} placeholder="Optional second line" /></div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Line 2 Color</label>
            <input type="color" value={d.headline2Color || d.textColor || "#ffffff"} onChange={e => set("headline2Color", e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
            {d.headline2Color && <button onClick={() => set("headline2Color", "")} className="text-[10px] text-gray-400 hover:text-red-500">Reset</button>}
          </div>
          <div><label className="text-xs font-medium text-gray-600">Subheadline</label><Textarea value={d.subheadline ?? ""} onChange={e => set("subheadline", e.target.value)} rows={2} /></div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Default Text Color</label>
            <input type="color" value={d.textColor ?? "#ffffff"} onChange={e => set("textColor", e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
          </div>
        </div>
      </div>

      {/* ── Background ── */}
      <div className="border-b pb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Background</h4>
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Background Type</label>
            <select value={d.bgType ?? "color"} onChange={e => set("bgType", e.target.value)} className="w-full mt-1 text-sm border rounded px-2 py-1.5">
              <option value="color">Solid Color</option>
              <option value="gradient">Gradient</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          {(d.bgType === "color" || !d.bgType) && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Color</label>
              <input type="color" value={d.bgColor ?? "#179ca3"} onChange={e => set("bgColor", e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
            </div>
          )}
          {d.bgType === "gradient" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2"><label className="text-xs text-gray-600">From</label><input type="color" value={d.gradientFrom ?? "#179ca3"} onChange={e => set("gradientFrom", e.target.value)} className="w-6 h-6 rounded cursor-pointer" /></div>
              <div className="flex items-center gap-2"><label className="text-xs text-gray-600">To</label><input type="color" value={d.gradientTo ?? "#0e4a50"} onChange={e => set("gradientTo", e.target.value)} className="w-6 h-6 rounded cursor-pointer" /></div>
            </div>
          )}
          {d.bgType === "image" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input value={d.imageUrl ?? ""} onChange={e => set("imageUrl", e.target.value)} placeholder="Image URL or upload" className="flex-1" />
                <button onClick={() => bgImageRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "imageUrl"}>
                  {uploading === "imageUrl" ? "..." : <><Upload size={12} /> Upload</>}
                </button>
                <input ref={bgImageRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "imageUrl", "hero-bg"); e.target.value = ""; }} />
              </div>
              {d.imageUrl && <img src={d.imageUrl} className="w-full h-20 object-cover rounded border" />}
            </div>
          )}
          {d.bgType === "video" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input value={d.videoUrl ?? ""} onChange={e => set("videoUrl", e.target.value)} placeholder="Video URL or upload" className="flex-1" />
                <button onClick={() => bgVideoRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "videoUrl"}>
                  {uploading === "videoUrl" ? "..." : <><Upload size={12} /> Upload</>}
                </button>
                <input ref={bgVideoRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "videoUrl", "hero-bg-video"); e.target.value = ""; }} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Fallback Color</label>
                <input type="color" value={d.bgColor ?? "#179ca3"} onChange={e => set("bgColor", e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
              </div>
              {d.videoUrl && <p className="text-[10px] text-gray-400">Video will autoplay muted as background</p>}
            </div>
          )}
        </div>
      </div>

      {/* ── Inline Media (image/video within the banner) ── */}
      <div className="border-b pb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Inline Media (within banner)</h4>
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Media Type</label>
            <select value={d.inlineMediaType ?? "image"} onChange={e => set("inlineMediaType", e.target.value)} className="w-full mt-1 text-sm border rounded px-2 py-1.5">
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Input value={d.inlineMediaUrl ?? ""} onChange={e => set("inlineMediaUrl", e.target.value)} placeholder={d.inlineMediaType === "video" ? "Video URL" : "Image URL"} className="flex-1" />
            <button onClick={() => inlineMediaRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "inlineMediaUrl"}>
              {uploading === "inlineMediaUrl" ? "..." : <><Upload size={12} /> Upload</>}
            </button>
            <input ref={inlineMediaRef} type="file" accept={d.inlineMediaType === "video" ? "video/*" : "image/*"} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "inlineMediaUrl", "hero-inline"); e.target.value = ""; }} />
          </div>
          {d.inlineMediaUrl && (
            <div>
              <label className="text-xs font-medium text-gray-600">Placement</label>
              <div className="flex gap-1 mt-1">
                {["left", "center", "right"].map(pos => (
                  <button key={pos} onClick={() => set("inlineMediaPlacement", pos)}
                    className={`px-3 py-1 text-xs rounded border ${d.inlineMediaPlacement === pos ? "bg-teal-500 text-white border-teal-500" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                    {pos.charAt(0).toUpperCase() + pos.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {d.inlineMediaUrl && d.inlineMediaType === "image" && <img src={d.inlineMediaUrl} className="w-full h-20 object-contain rounded border" />}
        </div>
      </div>

      {/* ── CTA Button ── */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">CTA Button</h4>
        <div className="space-y-2">
          <div><label className="text-xs font-medium text-gray-600">Button Text</label><Input value={d.buttons?.[0]?.text ?? "Buy Now"} onChange={e => set("buttons", [{ ...d.buttons?.[0], text: e.target.value }])} /></div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Button Color</label>
            <input type="color" value={d.buttons?.[0]?.color ?? "#ffffff"} onChange={e => set("buttons", [{ ...d.buttons?.[0], color: e.target.value }])} className="w-6 h-6 rounded cursor-pointer" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Button Text Color</label>
            <input type="color" value={d.buttons?.[0]?.textColor ?? "#179ca3"} onChange={e => set("buttons", [{ ...d.buttons?.[0], textColor: e.target.value }])} className="w-6 h-6 rounded cursor-pointer" />
          </div>
        </div>
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
      return <HeroEditor d={d} set={set} onUpdate={onUpdate} />;
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
    case "funnel_workflow":
      return (
        <div className="space-y-3">
          <Input value={d.eyebrow ?? ""} onChange={e => set("eyebrow", e.target.value)} placeholder="Eyebrow" />
          <Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} placeholder="Headline" />
          <Textarea value={d.subtext ?? ""} onChange={e => set("subtext", e.target.value)} rows={3} placeholder="Subtext" />
          <Textarea value={(d.steps ?? []).map((s: any) => `${s.name}|${s.role}|${s.url}|${s.cta}`).join("\n")} onChange={e => set("steps", e.target.value.split("\n").filter(Boolean).map(line => { const [name, role, url, cta] = line.split("|"); return { name, role, url, cta }; }))} rows={6} placeholder="Name|Role|URL|CTA, one step per line" />
          <div><label className="text-xs font-medium text-gray-600">Accent</label><input type="color" value={d.accentColor ?? "#179ca3"} onChange={e => set("accentColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    case "product_offer_stack":
      return (
        <div className="space-y-3">
          <Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} placeholder="Headline" />
          <Textarea value={d.subtext ?? ""} onChange={e => set("subtext", e.target.value)} rows={3} placeholder="Subtext" />
          <Textarea value={(d.products ?? []).map((p: any) => `${p.type}|${p.title}|${p.description}|${p.price}|${p.ctaText}|${p.ctaLink ?? ""}|${p.fulfillment ?? ""}`).join("\n")} onChange={e => set("products", e.target.value.split("\n").filter(Boolean).map(line => { const [type, title, description, price, ctaText, ctaLink, fulfillment] = line.split("|"); return { type, title, description, price, ctaText, ctaLink, fulfillment }; }))} rows={7} placeholder="type|title|description|price|cta|link|fulfillment" />
          <div><label className="text-xs font-medium text-gray-600">Accent</label><input type="color" value={d.accentColor ?? "#179ca3"} onChange={e => set("accentColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
        </div>
      );
    case "order_bump_checkout":
      return (
        <div className="space-y-3">
          <Input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} placeholder="Headline" />
          <Input value={d.subheadline ?? ""} onChange={e => set("subheadline", e.target.value)} placeholder="Subheadline" />
          <Textarea value={d.description ?? ""} onChange={e => set("description", e.target.value)} rows={3} placeholder="Description" />
          <select className="w-full border rounded px-2 py-1 text-sm" value={d.productType ?? "digital"} onChange={e => set("productType", e.target.value)}>
            <option value="digital">Digital item</option>
            <option value="physical">Physical item</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input value={d.price ?? ""} onChange={e => set("price", e.target.value)} placeholder="$29" />
            <Input value={d.compareAtPrice ?? ""} onChange={e => set("compareAtPrice", e.target.value)} placeholder="$59" />
          </div>
          <Input value={d.checkboxLabel ?? ""} onChange={e => set("checkboxLabel", e.target.value)} placeholder="Checkbox label" />
          <Input value={d.shippingNote ?? ""} onChange={e => set("shippingNote", e.target.value)} placeholder="Shipping note" />
          <Textarea value={(d.features ?? []).join("\n")} onChange={e => set("features", e.target.value.split("\n").filter(Boolean))} rows={4} placeholder="Feature bullets" />
          <div><label className="text-xs font-medium text-gray-600">Accent</label><input type="color" value={d.accentColor ?? "#f59e0b"} onChange={e => set("accentColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" /></div>
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

// ─── Block Preview (Live Canvas Rendering) ──────────────────────────────────
function BlockPreview({ block, previewMode = "editor" }: { block: Block; previewMode?: "editor" | "visitor" | "customer" }) {
  const d = block.data;
  switch (block.type) {
    case "hero": {
      const buttons = d.buttons ?? [{ text: "Buy Now", color: "#ffffff", textColor: "#179ca3", style: "filled" }];
      const bgType = d.bgType ?? "color";
      let bgStyle: React.CSSProperties = {};
      if (bgType === "color") bgStyle = { backgroundColor: d.bgColor ?? "#179ca3" };
      else if (bgType === "gradient") bgStyle = { background: `linear-gradient(${d.gradientDir ?? "to bottom right"}, ${d.gradientFrom ?? "#179ca3"}, ${d.gradientTo ?? "#0e4a50"})` };
      else if (bgType === "image") bgStyle = { backgroundImage: `url(${d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
      else if (bgType === "video") bgStyle = { backgroundColor: "#000" };
      const hasInlineMedia = !!d.inlineMediaUrl;
      const placement = d.inlineMediaPlacement ?? "right";
      const isHorizontal = placement === "left" || placement === "right";
      return (
        <div className="relative px-8 py-16 overflow-hidden" style={{ ...bgStyle, color: d.textColor ?? "#fff", textAlign: hasInlineMedia && isHorizontal ? "left" as const : (d.align ?? "left") }}>
          {bgType === "video" && d.bgVideoUrl && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.bgVideoUrl} /></video>
          )}
          <div className={`relative max-w-5xl mx-auto ${hasInlineMedia && isHorizontal ? "flex items-center gap-8" : ""} ${hasInlineMedia && placement === "left" ? "flex-row-reverse" : ""}`}>
            <div className={hasInlineMedia && isHorizontal ? "flex-1" : "max-w-3xl"}>
              <h1 className="text-4xl font-bold mb-4 leading-tight">
                <span style={d.headlineColor ? { color: d.headlineColor } : undefined} dangerouslySetInnerHTML={{ __html: d.headline ?? '' }} />
                {d.headline2 && <><br /><span style={d.headline2Color ? { color: d.headline2Color } : undefined} dangerouslySetInnerHTML={{ __html: d.headline2 }} /></>}
              </h1>
              {d.subheadline && <p className="text-xl opacity-90 mb-8" dangerouslySetInnerHTML={{ __html: d.subheadline }} />}
              <div className="flex flex-wrap gap-3" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
                {buttons.map((btn: any, i: number) => (
                  <button key={i} className="px-8 py-3 rounded-lg font-semibold text-lg shadow-lg"
                    style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                    {previewMode === "customer" ? "Access Files" : btn.text}
                  </button>
                ))}
              </div>
            </div>
            {hasInlineMedia && (
              <div className={isHorizontal ? "flex-1 max-w-xs" : "mt-8 max-w-md mx-auto"}>
                {d.inlineMediaType === "video" ? (
                  <video autoPlay muted loop playsInline className="w-full rounded-lg shadow-2xl"><source src={d.inlineMediaUrl} /></video>
                ) : (
                  <img src={d.inlineMediaUrl} alt="" className="w-full rounded-lg shadow-2xl" />
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    case "text":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff", color: d.textColor ?? "#1a1a1a", textAlign: d.align ?? "left" }}>
          <div className="max-w-3xl mx-auto prose" dangerouslySetInnerHTML={{ __html: d.html ?? "" }} />
        </div>
      );
    case "image":
      return (
        <div className="px-8 py-6 text-center">
          {d.url ? <img src={d.url} alt={d.alt ?? ""} className="mx-auto rounded-lg shadow" style={{ maxWidth: d.maxWidth ?? "100%" }} /> : <div className="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><Image size={32} /></div>}
          {d.caption && <p className="text-sm text-gray-500 mt-2">{d.caption}</p>}
        </div>
      );
    case "video":
      return (
        <div className="px-8 py-6">
          {d.url ? (
            <div className="relative w-full rounded-lg overflow-hidden shadow" style={{ paddingBottom: "56.25%" }}>
              <iframe src={d.url.replace("watch?v=", "embed/")} className="absolute inset-0 w-full h-full" allowFullScreen title="Video" />
            </div>
          ) : <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><Video size={32} /></div>}
        </div>
      );
    case "embed":
      return (
        <div className="px-8 py-6">
          <div className="max-w-4xl mx-auto">
            {d.embedCode ? (
              <div dangerouslySetInnerHTML={{ __html: d.embedCode }} style={{ height: d.height ?? 400 }} />
            ) : <div className="w-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-400" style={{ height: d.height ?? 400 }}><Globe size={32} /></div>}
            {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
          </div>
        </div>
      );
    case "bullets":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          <div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-4 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <ul className="space-y-2">
              {(d.items ?? []).map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 flex-shrink-0" style={{ color: d.iconColor ?? "#179ca3" }}>✓</span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "numbered_list":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-4 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <ol className="space-y-3">
              {(d.items ?? []).map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{i + 1}</span>
                  <span className="text-gray-700 pt-0.5">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      );
    case "testimonial":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f0fdfa" }}>
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-4xl text-teal-300 mb-4">"</div>
            <blockquote className="text-lg text-gray-700 italic mb-4">{d.quote}</blockquote>
            <p className="font-semibold text-gray-900">{d.author}</p>
            {d.role && <p className="text-sm text-gray-500">{d.role}</p>}
          </div>
        </div>
      );
    case "pricing_cta":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-lg mx-auto text-center">
            <h2 className="text-2xl font-bold mb-2 text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />
            {d.subtext && <p className="text-gray-600 mb-6" dangerouslySetInnerHTML={{ __html: d.subtext }} />}
            {previewMode === "customer" ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-100 text-green-700 rounded-lg font-semibold">✓ Purchased — Access Files</div>
            ) : (
              <button className="px-8 py-3 rounded-lg font-semibold text-lg shadow-lg" style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>{d.ctaText ?? "Buy Now"}</button>
            )}
          </div>
        </div>
      );
    case "cta_standalone":
      return (
        <div className="px-8 py-6" style={{ textAlign: d.align ?? "center" }}>
          {previewMode === "customer" ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-100 text-green-700 rounded-lg font-semibold">✓ Purchased — Access Files</div>
          ) : (
            <button className={`px-8 py-3 rounded-lg font-semibold shadow-lg ${d.size === "sm" ? "text-sm" : d.size === "lg" ? "text-lg" : "text-base"}`}
              style={{ backgroundColor: d.color ?? "#179ca3", color: d.textColor ?? "#fff" }}>{d.text ?? "Click Here"}</button>
          )}
        </div>
      );
    case "faq":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-3xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <div className="space-y-3">
              {(d.items ?? []).map((item: any, i: number) => (
                <details key={i} className="border border-gray-200 rounded-lg">
                  <summary className="px-5 py-3 font-medium text-gray-800 cursor-pointer hover:bg-gray-50">{item.q}</summary>
                  <p className="px-5 pb-4 text-gray-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      );
    case "alert": {
      const alertStyles: Record<string, string> = { info: "bg-blue-50 border-blue-300 text-blue-800", success: "bg-green-50 border-green-300 text-green-800", warning: "bg-yellow-50 border-yellow-300 text-yellow-800", error: "bg-red-50 border-red-300 text-red-800" };
      return (
        <div className={`mx-8 my-4 px-5 py-4 rounded-lg border-l-4 flex items-start gap-3 ${alertStyles[d.type ?? "info"] ?? alertStyles.info}`}>
          <p className="font-medium">{d.title && <strong>{d.title}: </strong>}{d.message}</p>
        </div>
      );
    }
    case "funnel_workflow":
      return <FunnelWorkflowBlock data={d} />;
    case "product_offer_stack":
      return <ProductOfferStackBlock data={d} />;
    case "order_bump_checkout":
      return <InlineOrderBumpBlock data={d} />;
    case "reviews":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-4xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-6 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <div className="grid md:grid-cols-2 gap-4">
              {(d.items ?? []).map((item: any, i: number) => (
                <div key={i} className="p-5 rounded-lg border bg-white shadow-sm">
                  <div className="flex items-center gap-1 mb-2">
                    {Array.from({ length: item.rating ?? 5 }).map((_, j) => <span key={j} className="text-yellow-400">★</span>)}
                  </div>
                  <p className="text-gray-700 text-sm mb-2">{item.text}</p>
                  <p className="text-xs font-semibold text-gray-500">— {item.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "icon_grid":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-4xl mx-auto">
            {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900" dangerouslySetInnerHTML={{ __html: d.headline }} />}
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
              {(d.items ?? []).map((item: any, i: number) => (
                <div key={i} className="text-center p-4">
                  <div className="text-4xl mb-3">{item.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "gallery":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="grid gap-4 max-w-4xl mx-auto" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
            {(d.images ?? []).map((img: string, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden shadow">
                {img ? <img src={img} alt="" className="w-full h-40 object-cover" /> : <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400"><Image size={24} /></div>}
              </div>
            ))}
          </div>
        </div>
      );
    case "two_column":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-4xl mx-auto grid gap-8" style={{ gridTemplateColumns: `${d.leftRatio ?? 50}% 1fr` }}>
            <div className="prose" dangerouslySetInnerHTML={{ __html: d.leftHtml ?? "" }} />
            <div className="prose" dangerouslySetInnerHTML={{ __html: d.rightHtml ?? "" }} />
          </div>
        </div>
      );
    case "divided_columns": {
      const cols = d.columns ?? [{ html: "" }, { html: "" }];
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-5xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: `${d.gap ?? 32}px` }}>
            {cols.map((col: any, i: number) => (
              <div key={i} className="prose" dangerouslySetInnerHTML={{ __html: col.html ?? "" }} />
            ))}
          </div>
        </div>
      );
    }
    case "spacer":
      return <div style={{ height: d.height ?? 48 }} className="bg-gray-50/50" />;
    case "divider":
      return (
        <div style={{ padding: `${(d.spacing ?? 32) / 2}px 2rem` }}>
          <hr style={{ borderColor: d.color ?? "#e5e7eb", borderWidth: `${d.thickness ?? 1}px 0 0 0` }} />
        </div>
      );
    default:
      return <div className="px-8 py-4 text-gray-400 text-sm text-center">Block preview not available</div>;
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
  const [previewMode, setPreviewMode] = useState<"editor" | "visitor" | "customer">("editor");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  // Auto-scroll preview canvas to the selected block
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

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
          <button onClick={() => navigate(`/admin/lms?tab=downloads&editDownload=${productId}`)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 font-medium transition-colors">
            <ArrowLeft size={16} /> Back to Product
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{productInfo?.title ?? "Loading..."}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden text-xs">
            <button onClick={() => setPreviewMode("editor")} className={`px-3 py-1.5 ${previewMode === "editor" ? "bg-teal-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Editor</button>
            <button onClick={() => setPreviewMode("visitor")} className={`px-3 py-1.5 border-l border-gray-200 ${previewMode === "visitor" ? "bg-teal-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>As Visitor</button>
            <button onClick={() => setPreviewMode("customer")} className={`px-3 py-1.5 border-l border-gray-200 ${previewMode === "customer" ? "bg-teal-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>As Customer</button>
          </div>
          {productInfo?.slug && (
            <a href={`/downloads/${productInfo.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-teal-600 flex items-center gap-1">
              <Eye size={14} /> Open Page
            </a>
          )}
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Save size={14} className="mr-1" /> {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Block List (hidden in preview modes) */}
        <div className={`w-56 bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0 ${previewMode !== "editor" ? "hidden" : ""}`}>
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
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="text-[10px] font-semibold text-amber-700 mb-1">Sales funnel templates</p>
              {FUNNEL_TEMPLATES.map((template, index) => (
                <button
                  key={template.name}
                  onClick={() => setBlocks(prev => [...prev, ...getFunnelTemplateBlocks(index)])}
                  className="w-full text-left text-[11px] text-amber-800 hover:text-amber-950 hover:underline"
                >
                  + {template.name}
                </button>
              ))}
            </div>
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

        {/* Center — Live Preview Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center"><Plus size={24} /></div>
              <p className="text-sm">Click a block type on the left to get started</p>
            </div>
          ) : (
            <div className="bg-white min-h-full shadow-sm mx-auto" style={{ maxWidth: "900px" }}>
              {previewMode !== "editor" && (
                <div className="sticky top-0 z-20 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <Eye size={12} /> Previewing as <strong>{previewMode === "customer" ? "Customer (purchased)" : "New Visitor"}</strong>
                  <button onClick={() => setPreviewMode("editor")} className="ml-auto text-amber-600 hover:text-amber-800 underline">Back to Editor</button>
                </div>
              )}
              {blocks.map(block => (
                <div data-block-id={block.id}
                  key={block.id}
                  onClick={previewMode === "editor" ? () => setSelectedId(block.id) : undefined}
                  className={previewMode === "editor" ? `relative group cursor-pointer border-2 transition-all ${
                    selectedId === block.id ? "border-teal-500 shadow-lg shadow-teal-100" : "border-transparent hover:border-teal-200"
                  }` : ""}
                  style={{ marginTop: block.data?.marginTop ? `${block.data.marginTop}px` : undefined, marginBottom: block.data?.marginBottom ? `${block.data.marginBottom}px` : undefined, paddingTop: block.data?.paddingTop ? `${block.data.paddingTop}px` : undefined, paddingBottom: block.data?.paddingBottom ? `${block.data.paddingBottom}px` : undefined, paddingLeft: block.data?.paddingLeft ? `${block.data.paddingLeft}px` : undefined, paddingRight: block.data?.paddingRight ? `${block.data.paddingRight}px` : undefined }}
                >
                  {previewMode === "editor" && (
                    <div className={`absolute top-2 right-2 z-10 flex gap-1 ${
                      selectedId === block.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    } transition-opacity`}>
                      <button onClick={e => { e.stopPropagation(); duplicateBlock(block.id); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-teal-600 flex items-center justify-center" title="Duplicate"><Copy size={12} /></button>
                      <button onClick={e => { e.stopPropagation(); deleteBlock(block.id); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-red-500 flex items-center justify-center" title="Delete"><Trash2 size={12} /></button>
                    </div>
                  )}
                  <BlockPreview block={block} previewMode={previewMode} />
                </div>
              ))}
              {previewMode === "editor" && (
                <div className="flex justify-center py-6 border-t border-dashed border-gray-200">
                  <button onClick={() => addBlock("text")} className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600 transition-colors">
                    <Plus size={16} /> Add a block
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
      {/* Editor Drawer — overlays the preview from the right */}
      {selectedBlock && previewMode === "editor" && (
        <div className="fixed top-12 right-0 bottom-0 w-[420px] bg-white border-l border-gray-200 shadow-2xl z-40 flex flex-col overflow-hidden" style={{ animation: 'slideInRight 0.2s ease-out' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Edit: {BLOCK_CATALOG.find(c => c.type === selectedBlock.type)?.label ?? "Block"}
            </p>
            <button onClick={() => setSelectedId(null)} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <BlockEditorPanel block={selectedBlock} onUpdate={(data) => updateBlock(selectedBlock.id, data)} />
          </div>
        </div>
      )}
    </div>
  );
}
