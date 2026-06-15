/**
 * CheckoutPageEditorPage.tsx
 *
 * Full-screen checkout page editor — mirrors the LandingPageBuilder UX:
 *   - Top bar: back button, entity name, Preview, Save
 *   - Canvas (center): live preview of the checkout left-panel with click-to-select
 *     highlighting on each configurable section
 *   - Right sidebar: section list + template picker when nothing selected;
 *     per-section config panel when a section is selected
 *
 * Route: /admin/checkout-editor/:entityType/:entityId
 *   entityType = course | download | physical | webinar | membership
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck, Lock, Award, Star, Heart, Zap, CheckCircle2, MessageSquare,
  HelpCircle, Code2, BookOpen, GripVertical, ChevronDown, Plus, Trash2,
  ExternalLink, Save, LayoutTemplate, X, RefreshCw, Shield, BadgeCheck,
  ArrowLeft, Eye, Settings2, PanelRight, ChevronRight, ChevronUp,
} from "lucide-react";
import {
  CheckoutPageConfig, CheckoutSection, CheckoutSectionType, TrustSeal,
  Testimonial, FaqItem, TrustSealsSection, GuaranteeSection, TestimonialsSection,
  FaqSection, CustomHtmlSection, CourseIncludesSection, ContentBlockSection, PresetSealId,
  defaultCheckoutPageConfig, parseCheckoutPageConfig,
} from "@/../../shared/checkoutPageConfig";
import {
  BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, BlockPreview,
} from "@/pages/admin/LandingPageBuilder";
import type { Block } from "@/pages/admin/LandingPageBuilder";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export type CheckoutEntityType = "course" | "download" | "physical" | "webinar" | "membership";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

// ─── Preset seals ─────────────────────────────────────────────────────────────
const PRESET_SEALS: Array<{ id: PresetSealId; label: string; description: string }> = [
  { id: "stripe_secure", label: "Secure Payment", description: "Powered by Stripe" },
  { id: "ssl_encrypted", label: "SSL Encrypted", description: "256-bit encryption" },
  { id: "money_back_30", label: "30-Day Money-Back", description: "Full refund guarantee" },
  { id: "money_back_14", label: "14-Day Money-Back", description: "Full refund guarantee" },
  { id: "satisfaction_guaranteed", label: "Satisfaction Guaranteed", description: "100% satisfaction" },
  { id: "hipaa_compliant", label: "HIPAA Compliant", description: "Healthcare privacy" },
  { id: "accredited_cme", label: "Accredited CME", description: "Continuing education" },
  { id: "secure_payment", label: "Secure Checkout", description: "Your data is safe" },
  { id: "privacy_protected", label: "Privacy Protected", description: "We never share your data" },
];

// ─── Section metadata ─────────────────────────────────────────────────────────
const SECTION_META: Record<Exclude<CheckoutSectionType, 'content_block'>, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  trust_seals: { label: "Trust Seals & Badges", icon: <ShieldCheck className="h-4 w-4" />, description: "Security badges and guarantee icons", color: "text-teal-600" },
  guarantee: { label: "Money-Back Guarantee", icon: <Award className="h-4 w-4" />, description: "Refund policy with icon and text", color: "text-amber-600" },
  testimonials: { label: "Testimonials", icon: <MessageSquare className="h-4 w-4" />, description: "Student reviews and ratings", color: "text-blue-600" },
  faq: { label: "FAQ", icon: <HelpCircle className="h-4 w-4" />, description: "Frequently asked questions", color: "text-purple-600" },
  custom_html: { label: "Custom HTML", icon: <Code2 className="h-4 w-4" />, description: "Raw HTML block", color: "text-gray-600" },
  course_includes: { label: "What's Included", icon: <BookOpen className="h-4 w-4" />, description: "Course content highlights", color: "text-green-600" },
};

const NATIVE_SECTION_TYPES: Exclude<CheckoutSectionType, 'content_block'>[] = ["trust_seals", "course_includes", "guarantee", "testimonials", "faq", "custom_html"];
const ALL_SECTION_TYPES: CheckoutSectionType[] = [...NATIVE_SECTION_TYPES, "content_block"];

/** Get display label for any section including content_block */
function getSectionLabel(section: CheckoutSection): string {
  if (section.type === "content_block") {
    if (section.label) return section.label;
    const entry = BLOCK_CATALOG.find(b => b.type === section.blockType);
    return entry ? entry.label : section.blockType;
  }
  return SECTION_META[section.type as Exclude<CheckoutSectionType, 'content_block'>].label;
}

function getSectionIcon(section: CheckoutSection): React.ReactNode {
  if (section.type === "content_block") {
    const entry = BLOCK_CATALOG.find(b => b.type === section.blockType);
    return entry ? entry.icon : <Code2 className="h-4 w-4" />;
  }
  return SECTION_META[section.type as Exclude<CheckoutSectionType, 'content_block'>].icon;
}

function getSectionColor(section: CheckoutSection): string {
  if (section.type === "content_block") return "text-indigo-600";
  return SECTION_META[section.type as Exclude<CheckoutSectionType, 'content_block'>].color;
}

// ─── Built-in templates ───────────────────────────────────────────────────────
const BUILT_IN_TEMPLATES: Array<{ id: string; name: string; description: string; emoji: string; config: CheckoutPageConfig }> = [
  {
    id: "simple", name: "Simple & Clean", emoji: "✨",
    description: "Minimal trust seals and course includes. Best for straightforward one-time purchases.",
    config: { sections: [
      { type: "trust_seals", enabled: true, order: 0, layout: "row", seals: [
        { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
        { id: "ssl_encrypted", preset: "ssl_encrypted", label: "SSL Encrypted", enabled: true },
      ]},
      { type: "course_includes", enabled: true, order: 1, headline: "What's included" },
    ]},
  },
  {
    id: "high_trust_medical", name: "High-Trust Medical", emoji: "🏥",
    description: "Full trust stack with HIPAA, CME, money-back guarantee, and FAQ. Ideal for clinical courses.",
    config: { sections: [
      { type: "trust_seals", enabled: true, order: 0, layout: "grid", seals: [
        { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
        { id: "ssl_encrypted", preset: "ssl_encrypted", label: "SSL Encrypted", enabled: true },
        { id: "hipaa_compliant", preset: "hipaa_compliant", label: "HIPAA Compliant", enabled: true },
        { id: "accredited_cme", preset: "accredited_cme", label: "Accredited CME", enabled: true },
        { id: "money_back_30", preset: "money_back_30", label: "30-Day Money-Back", enabled: true },
        { id: "satisfaction_guaranteed", preset: "satisfaction_guaranteed", label: "Satisfaction Guaranteed", enabled: true },
      ]},
      { type: "course_includes", enabled: true, order: 1, headline: "What's included" },
      { type: "guarantee", enabled: true, order: 2, icon: "ShieldCheck", headline: "30-Day Money-Back Guarantee", body: "If you're not completely satisfied within 30 days of purchase, we'll refund your payment in full — no questions asked.", badgeLabel: "30-Day Guarantee" },
      { type: "faq", enabled: true, order: 3, headline: "Frequently asked questions", items: [
        { id: "faq_1", question: "Is this course accredited for CME?", answer: "Yes — this course is accredited for continuing medical education. Your certificate will be issued upon completion.", enabled: true },
        { id: "faq_2", question: "How long do I have access?", answer: "You have lifetime access to all course materials once enrolled.", enabled: true },
        { id: "faq_3", question: "Can I get a refund?", answer: "Yes — we offer a 30-day money-back guarantee. Contact us within 30 days of purchase for a full refund.", enabled: true },
      ]},
    ]},
  },
  {
    id: "subscription_focus", name: "Subscription Focus", emoji: "🔄",
    description: "Highlights recurring value with testimonials and FAQ.",
    config: { sections: [
      { type: "trust_seals", enabled: true, order: 0, layout: "row", seals: [
        { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
        { id: "ssl_encrypted", preset: "ssl_encrypted", label: "SSL Encrypted", enabled: true },
        { id: "satisfaction_guaranteed", preset: "satisfaction_guaranteed", label: "Cancel Anytime", enabled: true },
      ]},
      { type: "course_includes", enabled: true, order: 1, headline: "Everything you get" },
      { type: "testimonials", enabled: true, order: 2, headline: "What our members say", testimonials: [] },
      { type: "faq", enabled: true, order: 3, headline: "Frequently asked questions", items: [
        { id: "faq_1", question: "Can I cancel anytime?", answer: "Yes — you can cancel your subscription at any time from your account settings.", enabled: true },
      ]},
    ]},
  },
  {
    id: "minimal", name: "Minimal", emoji: "⬜",
    description: "Just the Stripe payment form — no extra sections.",
    config: { sections: [
      { type: "trust_seals", enabled: true, order: 0, layout: "row", seals: [
        { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
      ]},
    ]},
  },
];

// ─── Canvas section preview renderers ────────────────────────────────────────

function CanvasTrustSeals({ section, primary }: { section: TrustSealsSection; primary: string }) {
  const enabled = section.seals.filter(s => s.enabled);
  const primaryLight = lighten(primary, 0.88);
  return (
    <div className={section.layout === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
      {enabled.map(seal => (
        <div key={seal.id} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg"
          style={{ backgroundColor: primaryLight, color: primary, border: `1px solid ${primary}33` }}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {seal.label}
        </div>
      ))}
      {enabled.length === 0 && <p className="text-xs text-gray-400 italic">No seals enabled</p>}
    </div>
  );
}

function CanvasGuarantee({ section, primary }: { section: GuaranteeSection; primary: string }) {
  const primaryLight = lighten(primary, 0.88);
  return (
    <div className="rounded-xl p-4 flex gap-3" style={{ backgroundColor: primaryLight, border: `1px solid ${primary}44` }}>
      <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${primary}22`, color: primary }}>
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        {section.badgeLabel && (
          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1"
            style={{ backgroundColor: `${primary}22`, color: primary }}>
            {section.badgeLabel}
          </span>
        )}
        <p className="text-sm font-bold text-gray-900">{section.headline || "Guarantee headline"}</p>
        {section.body && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{section.body}</p>}
      </div>
    </div>
  );
}

function CanvasTestimonials({ section }: { section: TestimonialsSection }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-800 mb-2">{section.headline || "Testimonials"}</p>
      {section.testimonials.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No testimonials added yet</p>
      ) : (
        <div className="space-y-2">
          {section.testimonials.slice(0, 2).map(t => (
            <div key={t.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex items-center gap-1 mb-1">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs text-gray-700 line-clamp-2">"{t.body}"</p>
              <p className="text-xs text-gray-500 mt-1">— {t.name}</p>
            </div>
          ))}
          {section.testimonials.length > 2 && (
            <p className="text-xs text-gray-400">+{section.testimonials.length - 2} more</p>
          )}
        </div>
      )}
    </div>
  );
}

function CanvasFaq({ section }: { section: FaqSection }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-800 mb-2">{section.headline || "FAQ"}</p>
      {(section.items ?? []).filter(i => i.enabled).length === 0 ? (
        <p className="text-xs text-gray-400 italic">No FAQ items added yet</p>
      ) : (
        <div className="space-y-1.5">
          {(section.items ?? []).filter(i => i.enabled).slice(0, 3).map(item => (
            <div key={item.id} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <p className="text-xs font-medium text-gray-800">{item.question}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CanvasCourseIncludes({ section }: { section: CourseIncludesSection }) {
  const items = section.items ?? [];
  return (
    <div>
      <p className="text-sm font-semibold text-gray-800 mb-2">{section.headline || "What's included"}</p>
      {section.items === undefined ? (
        <p className="text-xs text-gray-500 italic">Auto-populated from course data</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No items added yet</p>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
              {item.text}
            </div>
          ))}
          {items.length > 4 && <p className="text-xs text-gray-400">+{items.length - 4} more</p>}
        </div>
      )}
    </div>
  );
}

function CanvasCustomHtml({ section }: { section: CustomHtmlSection }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-300">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        <Code2 className="h-3.5 w-3.5" />
        Custom HTML Block
      </div>
      {section.html ? (
        <p className="text-xs text-gray-400 font-mono line-clamp-2">{section.html.slice(0, 120)}…</p>
      ) : (
        <p className="text-xs text-gray-400 italic">No HTML content yet</p>
      )}
    </div>
  );
}

function CanvasContentBlock({ section }: { section: ContentBlockSection }) {
  const block: Block = { id: `cb-${section.order}`, type: section.blockType as any, data: section.blockData };
  return (
    <div className="pointer-events-none overflow-hidden rounded-lg">
      <BlockPreview block={block} />
    </div>
  );
}

// ─── Add Section Dialog ─────────────────────────────────────────────────────

function AddSectionDialog({
  open, onOpenChange, existingSections, onAddNative, onAddBlock
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingSections: CheckoutSection[];
  onAddNative: (type: Exclude<CheckoutSectionType, 'content_block'>) => void;
  onAddBlock: (blockType: string, defaultData: Record<string, any>, label: string) => void;
}) {
  const [tab, setTab] = useState<"checkout" | "blocks" | "saved">("checkout");
  const [blockSearch, setBlockSearch] = useState("");
  const [savedSearch, setSavedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(CATALOG_CATEGORIES[0]);
  const { data: savedBlocks = [] } = trpc.blockTemplates.list.useQuery(
    { search: savedSearch || undefined },
    { enabled: true }
  );

  const filteredBlocks = BLOCK_CATALOG.filter(b => {
    const matchCat = b.category === selectedCategory;
    const matchSearch = !blockSearch || b.label.toLowerCase().includes(blockSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-teal-600" /> Add Section
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex-shrink-0 w-full grid grid-cols-3">
            <TabsTrigger value="checkout">Checkout Sections</TabsTrigger>
            <TabsTrigger value="blocks">Content Blocks</TabsTrigger>
            <TabsTrigger value="saved">Saved Blocks</TabsTrigger>
          </TabsList>

          {/* ── Checkout-native sections ── */}
          <TabsContent value="checkout" className="flex-1 overflow-y-auto mt-0 pt-3">
            <div className="space-y-1.5">
              {NATIVE_SECTION_TYPES.map(type => {
                const meta = SECTION_META[type];
                const exists = existingSections.some(s => s.type === type);
                return (
                  <button key={type} onClick={() => onAddNative(type)} disabled={exists}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      exists ? "opacity-40 cursor-not-allowed bg-gray-50 border-gray-100" : "bg-white border-gray-200 hover:border-teal-400 hover:bg-teal-50"
                    }`}>
                    <span className={meta.color}>{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{meta.label}</p>
                      <p className="text-xs text-gray-500">{meta.description}</p>
                    </div>
                    {exists && <Badge variant="secondary" className="text-[10px]">Added</Badge>}
                  </button>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Content blocks ── */}
          <TabsContent value="blocks" className="flex-1 flex flex-col min-h-0 mt-0 pt-3">
            <div className="flex gap-2 mb-3 flex-shrink-0">
              <Input
                placeholder="Search blocks…"
                value={blockSearch}
                onChange={e => setBlockSearch(e.target.value)}
                className="h-8 text-xs flex-1"
              />
            </div>
            {!blockSearch && (
              <div className="flex gap-1.5 flex-wrap mb-3 flex-shrink-0">
                {CATALOG_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCategory === cat ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-teal-50"
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-2 pr-2">
                {(blockSearch ? BLOCK_CATALOG.filter(b => b.label.toLowerCase().includes(blockSearch.toLowerCase())) : filteredBlocks).map(entry => (
                  <button key={entry.type}
                    onClick={() => onAddBlock(entry.type, entry.defaultData, entry.label)}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-left transition-colors bg-white">
                    <span className="text-teal-600 flex-shrink-0">{entry.icon}</span>
                    <p className="text-xs font-medium text-gray-800 truncate">{entry.label}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Saved blocks ── */}
          <TabsContent value="saved" className="flex-1 flex flex-col min-h-0 mt-0 pt-3">
            <div className="mb-3 flex-shrink-0">
              <Input
                placeholder="Search saved blocks…"
                value={savedSearch}
                onChange={e => setSavedSearch(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            {savedBlocks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No saved blocks yet</p>
                <p className="text-xs mt-1">Save blocks from the landing page builder to reuse them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {savedBlocks.map((tpl: any) => {
                  let blockData: Record<string, any> = {};
                  try { blockData = JSON.parse(tpl.blockData); } catch {}
                  return (
                    <button key={tpl.id}
                      onClick={() => onAddBlock(tpl.blockType, blockData, tpl.name)}
                      className="flex flex-col gap-1 p-3 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-left transition-colors bg-white">
                      <p className="text-xs font-semibold text-gray-800 truncate">{tpl.name}</p>
                      {tpl.description && <p className="text-xs text-gray-500 line-clamp-2">{tpl.description}</p>}
                      <Badge variant="secondary" className="text-[10px] mt-1 self-start">{tpl.blockType}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section config panels (right sidebar) ────────────────────────────────────

function TrustSealsPanel({ section, onChange }: { section: TrustSealsSection; onChange: (s: TrustSealsSection) => void }) {
  const [customLabel, setCustomLabel] = useState("");
  return (
    <div className="space-y-5">
      {/* Layout */}
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-2">Layout</Label>
        <div className="flex gap-2">
          {(["row", "grid"] as const).map(l => (
            <button key={l} onClick={() => onChange({ ...section, layout: l })}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                section.layout === l ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-400"
              }`}>
              {l === "row" ? "Horizontal Row" : "2-Column Grid"}
            </button>
          ))}
        </div>
      </div>

      {/* Active seals */}
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-2">Active seals</Label>
        {section.seals.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No seals added yet</p>
        ) : (
          <div className="space-y-1.5">
            {section.seals.map(seal => (
              <div key={seal.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
                <Switch checked={seal.enabled} onCheckedChange={v => onChange({ ...section, seals: section.seals.map(s => s.id === seal.id ? { ...s, enabled: v } : s) })} className="scale-75" />
                <Input value={seal.label} onChange={e => onChange({ ...section, seals: section.seals.map(s => s.id === seal.id ? { ...s, label: e.target.value } : s) })}
                  className="flex-1 h-7 text-xs" />
                <button onClick={() => onChange({ ...section, seals: section.seals.filter(s => s.id !== seal.id) })}
                  className="text-gray-300 hover:text-red-500 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add preset */}
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-2">Add preset seal</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESET_SEALS.map(p => {
            const already = !!section.seals.find(s => s.id === p.id);
            return (
              <button key={p.id} onClick={() => {
                if (already) return;
                onChange({ ...section, seals: [...section.seals, { id: p.id, preset: p.id, label: p.label, enabled: true }] });
              }} disabled={already}
                className={`text-left p-2 rounded-lg border text-xs transition-colors ${
                  already ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed" : "bg-white text-gray-700 border-gray-200 hover:border-teal-400 hover:bg-teal-50"
                }`}>
                <p className="font-medium truncate">{p.label}</p>
                <p className="text-gray-400 truncate">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom seal */}
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-2">Add custom seal</Label>
        <div className="flex gap-2">
          <Input value={customLabel} onChange={e => setCustomLabel(e.target.value)}
            placeholder="e.g. ARRT Approved" className="flex-1 h-8 text-xs"
            onKeyDown={e => { if (e.key === "Enter" && customLabel.trim()) { onChange({ ...section, seals: [...section.seals, { id: `custom_${uid()}`, label: customLabel.trim(), enabled: true }] }); setCustomLabel(""); } }} />
          <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => {
            if (!customLabel.trim()) return;
            onChange({ ...section, seals: [...section.seals, { id: `custom_${uid()}`, label: customLabel.trim(), enabled: true }] });
            setCustomLabel("");
          }}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function GuaranteePanel({ section, onChange }: { section: GuaranteeSection; onChange: (s: GuaranteeSection) => void }) {
  const ICONS = ["ShieldCheck", "Award", "Star", "Heart", "Zap", "CheckCircle2", "BadgeCheck", "RefreshCw"];
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-2">Icon</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {ICONS.map(icon => (
            <button key={icon} onClick={() => onChange({ ...section, icon })}
              className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                section.icon === icon ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-400"
              }`}>
              {icon.replace(/([A-Z])/g, ' $1').trim().split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-1.5">Badge label</Label>
        <Input value={section.badgeLabel ?? ""} onChange={e => onChange({ ...section, badgeLabel: e.target.value })} placeholder="e.g. 30-Day Guarantee" className="h-8 text-xs" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-1.5">Headline</Label>
        <Input value={section.headline} onChange={e => onChange({ ...section, headline: e.target.value })} placeholder="30-Day Money-Back Guarantee" className="h-8 text-xs" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-1.5">Body text</Label>
        <Textarea value={section.body} onChange={e => onChange({ ...section, body: e.target.value })} placeholder="Describe your refund policy…" className="text-xs min-h-[80px] resize-y" />
      </div>
    </div>
  );
}

function TestimonialsPanel({ section, onChange }: { section: TestimonialsSection; onChange: (s: TestimonialsSection) => void }) {
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newRating, setNewRating] = useState(5);

  const addTestimonial = () => {
    if (!newName.trim() || !newBody.trim()) return;
    const t: Testimonial = { id: uid(), name: newName.trim(), role: newRole.trim() || undefined, body: newBody.trim(), rating: newRating, enabled: true };
    onChange({ ...section, testimonials: [...section.testimonials, t] });
    setNewName(""); setNewRole(""); setNewBody(""); setNewRating(5);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-1.5">Section headline</Label>
        <Input value={section.headline} onChange={e => onChange({ ...section, headline: e.target.value })} placeholder="What our students say" className="h-8 text-xs" />
      </div>
      <Separator />
      <div className="space-y-2">
        {section.testimonials.map(t => (
          <div key={t.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-800">{t.name}{t.role ? ` · ${t.role}` : ""}</p>
              <div className="flex items-center gap-1">
                <Switch checked={t.enabled} onCheckedChange={v => onChange({ ...section, testimonials: section.testimonials.map(x => x.id === t.id ? { ...x, enabled: v } : x) })} className="scale-75" />
                <button onClick={() => onChange({ ...section, testimonials: section.testimonials.filter(x => x.id !== t.id) })} className="text-gray-300 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2">"{t.body}"</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-dashed border-gray-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">Add testimonial</p>
        <div className="grid grid-cols-2 gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className="h-7 text-xs" />
          <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Role (optional)" className="h-7 text-xs" />
        </div>
        <Textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Their testimonial…" className="text-xs min-h-[60px] resize-none" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setNewRating(n)}>
                <Star className={`h-4 w-4 ${n <= newRating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
              </button>
            ))}
          </div>
          <Button size="sm" onClick={addTestimonial} className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function FaqPanel({ section, onChange }: { section: FaqSection; onChange: (s: FaqSection) => void }) {
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");

  const addItem = () => {
    if (!newQ.trim() || !newA.trim()) return;
    const item: FaqItem = { id: uid(), question: newQ.trim(), answer: newA.trim(), enabled: true };
    onChange({ ...section, items: [...(section.items ?? []), item] });
    setNewQ(""); setNewA("");
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-1.5">Section headline</Label>
        <Input value={section.headline} onChange={e => onChange({ ...section, headline: e.target.value })} placeholder="Frequently asked questions" className="h-8 text-xs" />
      </div>
      <Separator />
      <div className="space-y-2">
        {(section.items ?? []).map(item => (
          <div key={item.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-gray-800 flex-1">{item.question}</p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Switch checked={item.enabled} onCheckedChange={v => onChange({ ...section, items: (section.items ?? []).map(x => x.id === item.id ? { ...x, enabled: v } : x) })} className="scale-75" />
                <button onClick={() => onChange({ ...section, items: (section.items ?? []).filter(x => x.id !== item.id) })} className="text-gray-300 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{item.answer}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-dashed border-gray-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">Add FAQ item</p>
        <Input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Question" className="h-7 text-xs" />
        <Textarea value={newA} onChange={e => setNewA(e.target.value)} placeholder="Answer" className="text-xs min-h-[60px] resize-none" />
        <Button size="sm" onClick={addItem} className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white w-full">
          <Plus className="h-3 w-3 mr-1" /> Add Item
        </Button>
      </div>
    </div>
  );
}

function CourseIncludesPanel({ section, onChange }: { section: CourseIncludesSection; onChange: (s: CourseIncludesSection) => void }) {
  const [newText, setNewText] = useState("");
  const useAuto = section.items === undefined;

  const addItem = () => {
    if (!newText.trim()) return;
    onChange({ ...section, items: [...(section.items ?? []), { text: newText.trim() }] });
    setNewText("");
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-gray-600 block mb-1.5">Section headline</Label>
        <Input value={section.headline ?? ""} onChange={e => onChange({ ...section, headline: e.target.value })} placeholder="What's included" className="h-8 text-xs" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={useAuto} onCheckedChange={v => onChange({ ...section, items: v ? undefined : [] })} />
        <Label className="text-xs text-gray-600">Auto-populate from course data</Label>
      </div>
      {!useAuto && (
        <>
          <div className="space-y-1.5">
            {(section.items ?? []).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
                <span className="flex-1 text-xs text-gray-700">{item.text}</span>
                <button onClick={() => onChange({ ...section, items: (section.items ?? []).filter((_, i) => i !== idx) })} className="text-gray-300 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="e.g. 12 video lessons" className="flex-1 h-8 text-xs"
              onKeyDown={e => e.key === "Enter" && addItem()} />
            <Button size="sm" variant="outline" onClick={addItem} className="h-8 px-3">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CustomHtmlPanel({ section, onChange }: { section: CustomHtmlSection; onChange: (s: CustomHtmlSection) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-gray-600 block">HTML content</Label>
      <Textarea value={section.html} onChange={e => onChange({ ...section, html: e.target.value })}
        placeholder="<div>Your custom HTML here...</div>"
        className="font-mono text-xs min-h-[200px] resize-y" />
      <p className="text-xs text-gray-400">Raw HTML rendered inside the checkout page left panel.</p>
    </div>
  );
}

// ─── Sortable section row (sidebar drag-to-reorder) ─────────────────────────

function SortableSectionRow({
  dragId, section, originalIdx, isSelected, onSelect, onToggle,
  getSectionColor, getSectionIcon, getSectionLabel,
}: {
  dragId: string;
  section: CheckoutSection;
  originalIdx: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  getSectionColor: (s: CheckoutSection) => string;
  getSectionIcon: (s: CheckoutSection) => React.ReactNode;
  getSectionLabel: (s: CheckoutSection) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dragId });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
        !section.enabled ? "opacity-50" : ""
      } ${
        isSelected
          ? "border-teal-400 bg-teal-50"
          : "border-gray-100 bg-gray-50 hover:bg-teal-50 hover:border-teal-200"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0 p-0.5 rounded hover:bg-gray-200 transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5 text-gray-400" />
      </button>
      <Switch
        checked={section.enabled}
        onCheckedChange={() => onToggle()}
        className="scale-75 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      />
      <span className={`flex-shrink-0 ${getSectionColor(section)}`}>{getSectionIcon(section)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{getSectionLabel(section)}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CheckoutPageEditorPage() {
  const { entityType: rawEntityType, entityId: rawEntityId } = useParams<{ entityType: string; entityId: string }>();
  const [, navigate] = useLocation();

  const entityType = (rawEntityType ?? "course") as CheckoutEntityType;
  const entityId = Number(rawEntityId ?? 0);

  const utils = trpc.useUtils();

  // ── Load entity info for the top bar ────────────────────────────────────────
  const courseQuery = trpc.lmsAdmin.getCourse.useQuery({ courseId: entityId }, { enabled: entityType === "course" });
  const physProductQuery = trpc.productsAdmin.get.useQuery({ id: entityId }, { enabled: entityType === "physical" });
  const entityName = entityType === "course" ? (courseQuery.data?.title ?? "Course") : entityType === "physical" ? (physProductQuery.data?.product?.title ?? `Product #${entityId}`) : `${entityType} #${entityId}`;
  const entitySlug = entityType === "course" ? (courseQuery.data?.slug ?? "") : "";

  // ── Load config ──────────────────────────────────────────────────────────────
  const lmsQuery = trpc.lmsAdmin.getCheckoutPageConfig.useQuery({ courseId: entityId }, { enabled: entityType === "course" });
  const dlQuery = trpc.downloadsAdmin.getCheckoutPageConfig.useQuery({ productId: entityId }, { enabled: entityType === "download" });
  const physQuery = trpc.productsAdmin.getCheckoutPageConfig.useQuery({ productId: entityId }, { enabled: entityType === "physical" });
  const webQuery = trpc.webinarAdmin.getCheckoutPageConfig.useQuery({ webinarId: entityId }, { enabled: entityType === "webinar" });
  const memQuery = trpc.membership.getCheckoutPageConfig.useQuery({ planId: entityId }, { enabled: entityType === "membership" });

  const configData = entityType === "course" ? lmsQuery.data : entityType === "download" ? dlQuery.data : entityType === "physical" ? physQuery.data : entityType === "webinar" ? webQuery.data : memQuery.data;
  const isLoading = entityType === "course" ? lmsQuery.isLoading : entityType === "download" ? dlQuery.isLoading : entityType === "physical" ? physQuery.isLoading : entityType === "webinar" ? webQuery.isLoading : memQuery.isLoading;

  // ── Save mutations ───────────────────────────────────────────────────────────
  const saveLms = trpc.lmsAdmin.saveCheckoutPageConfig.useMutation({ onSuccess: () => { toast.success("Saved"); utils.lmsAdmin.getCheckoutPageConfig.invalidate({ courseId: entityId }); }, onError: e => toast.error(e.message) });
  const saveDl = trpc.downloadsAdmin.saveCheckoutPageConfig.useMutation({ onSuccess: () => { toast.success("Saved"); utils.downloadsAdmin.getCheckoutPageConfig.invalidate({ productId: entityId }); }, onError: e => toast.error(e.message) });
  const savePhys = trpc.productsAdmin.saveCheckoutPageConfig.useMutation({ onSuccess: () => { toast.success("Saved"); utils.productsAdmin.getCheckoutPageConfig.invalidate({ productId: entityId }); }, onError: e => toast.error(e.message) });
  const saveWeb = trpc.webinarAdmin.saveCheckoutPageConfig.useMutation({ onSuccess: () => { toast.success("Saved"); utils.webinarAdmin.getCheckoutPageConfig.invalidate({ webinarId: entityId }); }, onError: e => toast.error(e.message) });
  const saveMem = trpc.membership.saveCheckoutPageConfig.useMutation({ onSuccess: () => { toast.success("Saved"); utils.membership.getCheckoutPageConfig.invalidate({ planId: entityId }); }, onError: e => toast.error(e.message) });

  const isSaving = saveLms.isPending || saveDl.isPending || savePhys.isPending || saveWeb.isPending || saveMem.isPending;

  const doSave = (cfg: CheckoutPageConfig) => {
    const s = JSON.stringify(cfg);
    if (entityType === "course") saveLms.mutate({ courseId: entityId, config: s });
    else if (entityType === "download") saveDl.mutate({ productId: entityId, config: s });
    else if (entityType === "physical") savePhys.mutate({ productId: entityId, config: s });
    else if (entityType === "webinar") saveWeb.mutate({ webinarId: entityId, config: s });
    else saveMem.mutate({ planId: entityId, config: s });
  };

  // ── Templates ────────────────────────────────────────────────────────────────
  const { data: savedTemplates = [], refetch: refetchTemplates } = trpc.lmsAdmin.listCheckoutTemplates.useQuery();
  const saveTemplate = trpc.lmsAdmin.saveCheckoutTemplate.useMutation({ onSuccess: () => { toast.success("Template saved"); refetchTemplates(); setTemplateSaveOpen(false); setTemplateName(""); setTemplateDesc(""); }, onError: e => toast.error(e.message) });
  const deleteTemplate = trpc.lmsAdmin.deleteCheckoutTemplate.useMutation({ onSuccess: () => { toast.success("Deleted"); refetchTemplates(); }, onError: e => toast.error(e.message) });

  // ── Local state ──────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<CheckoutPageConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateToApply, setTemplateToApply] = useState<CheckoutPageConfig | null>(null);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // dnd-kit sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Initialise config from loaded data (useEffect to avoid setState-during-render)
  useEffect(() => {
    if (!isLoading && config === null && configData !== undefined) {
      setConfig(parseCheckoutPageConfig(configData.config));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, configData]);

  const updateConfig = useCallback((next: CheckoutPageConfig) => {
    setConfig(next);
    setDirty(true);
  }, []);

  const handleSave = () => {
    if (!config) return;
    doSave(config);
    setDirty(false);
  };

  const toggleSection = (idx: number) => {
    if (!config) return;
    updateConfig({ ...config, sections: config.sections.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s) });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    if (!config) return;
    const sections = [...config.sections];
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    updateConfig({ ...config, sections: sections.map((s, i) => ({ ...s, order: i })) });
  };

  const updateSection = (idx: number, section: CheckoutSection) => {
    if (!config) return;
    updateConfig({ ...config, sections: config.sections.map((s, i) => i === idx ? section : s) });
  };

  const removeSection = (idx: number) => {
    if (!config) return;
    updateConfig({ ...config, sections: config.sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })) });
    if (selectedIdx === idx) setSelectedIdx(null);
  };

  const addSection = (type: CheckoutSectionType) => {
    if (!config) return;
    const existing = config.sections.find(s => s.type === type);
    if (existing) { toast.info(`${SECTION_META[type].label} section already exists`); setAddSectionOpen(false); return; }
    let newSection: CheckoutSection;
    if (type === "trust_seals") newSection = { type, enabled: true, order: config.sections.length, layout: "row", seals: [] };
    else if (type === "guarantee") newSection = { type, enabled: true, order: config.sections.length, icon: "ShieldCheck", headline: "Money-Back Guarantee", body: "", badgeLabel: "" };
    else if (type === "testimonials") newSection = { type, enabled: true, order: config.sections.length, headline: "What our students say", testimonials: [] };
    else if (type === "faq") newSection = { type, enabled: true, order: config.sections.length, headline: "Frequently asked questions", items: [] };
    else if (type === "custom_html") newSection = { type, enabled: true, order: config.sections.length, html: "" };
    else newSection = { type: "course_includes", enabled: true, order: config.sections.length, headline: "What's included" };
    updateConfig({ ...config, sections: [...config.sections, newSection] });
    setSelectedIdx(config.sections.length);
    setAddSectionOpen(false);
  };

  const applyTemplate = (cfg: CheckoutPageConfig) => {
    setTemplateToApply(cfg);
    setConfirmApplyOpen(true);
    setTemplatePickerOpen(false);
  };

  const previewUrl = entitySlug
    ? `/checkout/${entitySlug}${entityType !== "course" ? `?type=${entityType}` : ""}`
    : "#";

  const backUrl = entityType === "course" ? `/admin/lms?editCourse=${entityId}`
    : entityType === "download" ? `/admin/lms?tab=downloads&editDownload=${entityId}`
    : entityType === "product" ? `/admin/lms?tab=products&editProduct=${entityId}`
    : entityType === "webinar" ? `/admin/lms?tab=webinars&editWebinar=${entityId}`
    : entityType === "bundle" ? `/admin/lms?tab=bundles&editBundle=${entityId}`
    : entityType === "membership" ? `/admin/lms?tab=memberships&editMembership=${entityId}`
    : `/admin/lms`;

  const selectedSection = config && selectedIdx !== null ? config.sections[selectedIdx] : null;
  const primary = "#179ca3";

  if (isLoading || config === null) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-50">
        <div className="space-y-3 w-64">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backUrl)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 font-medium transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">{entityName}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Checkout Page Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTemplatePickerOpen(true)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
            <LayoutTemplate size={14} /> Templates
          </button>
          <button onClick={() => setTemplateSaveOpen(true)}
            className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-lg px-3 py-1.5 transition-colors">
            <Save size={14} /> Save as Template
          </button>
          {entitySlug && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
              <Eye size={14} /> Preview
            </a>
          )}
          <Button onClick={handleSave} disabled={!dirty || isSaving}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-1.5 h-8">
            <Save size={14} /> {isSaving ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Canvas (center) ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          {/* Two-column layout mirroring the real checkout page */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">

            {/* ── Left column: Course card + configurable sections ── */}
            <div className="space-y-4">

              {/* Fixed course card (non-editable) */}
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden opacity-60">
                <div className="h-20 w-full" style={{ background: `linear-gradient(135deg, ${primary}, #0d9488)` }} />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-5/6" />
                  <div className="mt-3 h-8 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="px-4 pb-3">
                  <p className="text-xs text-gray-400 italic text-center">Course card (populated at checkout)</p>
                </div>
              </div>

              {/* Configurable sections */}
              {config.sections
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((section, sortedIdx) => {
                  const originalIdx = config.sections.indexOf(section);
                  const meta = section.type === "content_block"
                    ? { label: section.label || (section as ContentBlockSection).blockType || "Content Block", icon: <Code2 className="h-4 w-4" />, description: "Saved block", color: "text-indigo-600" }
                    : SECTION_META[section.type as Exclude<CheckoutSectionType, 'content_block'>];
                  const isSelected = selectedIdx === originalIdx;
                  return (
                    <div
                      key={`${section.type}-${originalIdx}`}
                      onClick={() => setSelectedIdx(isSelected ? null : originalIdx)}
                      className={`rounded-2xl border-2 transition-all cursor-pointer ${
                        !section.enabled ? "opacity-40" : ""
                      } ${
                        isSelected
                          ? "border-teal-500 shadow-lg shadow-teal-100"
                          : "border-transparent hover:border-teal-300 hover:shadow-md"
                      } bg-white`}
                    >
                      {/* Section header bar */}
                      <div className={`flex items-center justify-between px-3 py-2 rounded-t-2xl border-b ${
                        isSelected ? "bg-teal-50 border-teal-200" : "bg-gray-50 border-gray-100"
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={meta.color}>{meta.icon}</span>
                          <span className="text-xs font-semibold text-gray-700">{meta.label}</span>
                          {!section.enabled && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Hidden</Badge>}
                        </div>
                        {isSelected && (
                          <span className="text-xs text-teal-600 font-medium flex items-center gap-1">
                            <Settings2 className="h-3 w-3" /> Editing
                          </span>
                        )}
                      </div>

                      {/* Section preview */}
                      <div className="p-4">
                        {section.type === "trust_seals" && <CanvasTrustSeals section={section} primary={primary} />}
                        {section.type === "guarantee" && <CanvasGuarantee section={section} primary={primary} />}
                        {section.type === "testimonials" && <CanvasTestimonials section={section} />}
                        {section.type === "faq" && <CanvasFaq section={section} />}
                        {section.type === "custom_html" && <CanvasCustomHtml section={section} />}
                        {section.type === "course_includes" && <CanvasCourseIncludes section={section} />}
                        {section.type === "content_block" && <CanvasContentBlock section={section} />}
                      </div>
                    </div>
                  );
                })}

              {/* Add section button */}
              <button
                onClick={() => setAddSectionOpen(true)}
                className="w-full border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-2xl py-4 text-teal-600 hover:text-teal-700 text-sm flex items-center justify-center gap-2 transition-colors bg-white"
              >
                <Plus size={16} /> Add Section
              </button>
            </div>

            {/* ── Right column: Terms card + Stripe embed placeholder ── */}
            <div className="space-y-4">

              {/* Terms agreement card (non-editable, always shown above Stripe) */}
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 opacity-60">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-4 w-4" style={{ color: primary }} />
                  <p className="text-sm font-semibold text-gray-800">Before you proceed</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded border-2 border-gray-200 flex-shrink-0" />
                    <p className="text-xs text-gray-500">I have reviewed and agree to the Terms of Service and Privacy Policy</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 italic text-center mt-2">Terms agreement (always shown)</p>
              </div>

              {/* Stripe embed placeholder */}
              <div className="rounded-2xl bg-white border-2 border-dashed border-gray-200 min-h-[320px] flex flex-col items-center justify-center gap-3 opacity-50">
                <Lock className="h-8 w-8 text-gray-300" />
                <p className="text-sm font-medium text-gray-400">Stripe Payment Form</p>
                <p className="text-xs text-gray-300 text-center px-4">Embedded Stripe Checkout appears here after terms are accepted</p>
              </div>
            </div>

          </div>
        </div>

        {/* ── Right sidebar ───────────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          {selectedSection !== null && selectedIdx !== null ? (
            <>
              {/* Section config header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className={getSectionColor(selectedSection)}>{getSectionIcon(selectedSection)}</span>
                  <p className="text-xs font-semibold text-gray-700">{getSectionLabel(selectedSection)}</p>
                </div>
                <button onClick={() => setSelectedIdx(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>

              {/* Toggle + reorder controls */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-gray-50">
                <div className="flex items-center gap-2">
                  <Switch checked={selectedSection.enabled} onCheckedChange={() => toggleSection(selectedIdx)} className="scale-75" />
                  <span className="text-xs text-gray-600">{selectedSection.enabled ? "Visible" : "Hidden"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveSection(selectedIdx, -1)} disabled={selectedIdx === 0}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors" title="Move up">
                    <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                  <button onClick={() => moveSection(selectedIdx, 1)} disabled={selectedIdx === config.sections.length - 1}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors" title="Move down">
                    <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                  <button onClick={() => removeSection(selectedIdx)}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors ml-1" title="Remove section">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Config panel */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {selectedSection.type === "trust_seals" && (
                  <TrustSealsPanel section={selectedSection} onChange={s => updateSection(selectedIdx, s)} />
                )}
                {selectedSection.type === "guarantee" && (
                  <GuaranteePanel section={selectedSection} onChange={s => updateSection(selectedIdx, s)} />
                )}
                {selectedSection.type === "testimonials" && (
                  <TestimonialsPanel section={selectedSection} onChange={s => updateSection(selectedIdx, s)} />
                )}
                {selectedSection.type === "faq" && (
                  <FaqPanel section={selectedSection} onChange={s => updateSection(selectedIdx, s)} />
                )}
                {selectedSection.type === "custom_html" && (
                  <CustomHtmlPanel section={selectedSection} onChange={s => updateSection(selectedIdx, s)} />
                )}
                {selectedSection.type === "course_includes" && (
                  <CourseIncludesPanel section={selectedSection} onChange={s => updateSection(selectedIdx, s)} />
                )}
                {selectedSection.type === "content_block" && (() => {
                  const cb = selectedSection as ContentBlockSection;
                  const block: Block = { id: `cb-${selectedIdx}`, type: cb.blockType as any, data: cb.blockData };
                  return (
                    <BlockSettings
                      block={block}
                      onChange={data => updateSection(selectedIdx, { ...cb, blockData: data })}
                    />
                  );
                })()}
              </div>
            </>
          ) : (
            <>
              {/* Section list header */}
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <PanelRight size={12} /> Sections
                </p>
              </div>

              {/* Section list — drag-to-reorder */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {config.sections.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No sections yet</p>
                    <button onClick={() => setAddSectionOpen(true)}
                      className="mt-2 text-xs text-teal-600 hover:text-teal-700 font-medium">
                      Add your first section
                    </button>
                  </div>
                ) : (() => {
                  // Build a stable sorted list with unique drag IDs
                  const sortedSections = config.sections
                    .map((s, originalIdx) => ({ section: s, originalIdx, dragId: `sec-${originalIdx}-${s.type}` }))
                    .sort((a, b) => a.section.order - b.section.order);
                  const dragIds = sortedSections.map(s => s.dragId);
                  return (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={({ active }) => setActiveDragId(active.id as string)}
                      onDragEnd={({ active, over }) => {
                        setActiveDragId(null);
                        if (!over || active.id === over.id) return;
                        const oldPos = sortedSections.findIndex(s => s.dragId === active.id);
                        const newPos = sortedSections.findIndex(s => s.dragId === over.id);
                        if (oldPos === -1 || newPos === -1) return;
                        const reordered = arrayMove(sortedSections, oldPos, newPos);
                        const newSections = reordered.map((item, i) => ({ ...item.section, order: i }));
                        updateConfig({ ...config, sections: newSections });
                        // Update selectedIdx to follow the moved item
                        if (selectedIdx !== null) {
                          const movedOriginalIdx = sortedSections[oldPos].originalIdx;
                          if (selectedIdx === movedOriginalIdx) {
                            setSelectedIdx(reordered.findIndex(s => s.originalIdx === movedOriginalIdx));
                          }
                        }
                      }}
                      onDragCancel={() => setActiveDragId(null)}
                    >
                      <SortableContext items={dragIds} strategy={verticalListSortingStrategy}>
                        <div className="space-y-1.5">
                          {sortedSections.map(({ section, originalIdx, dragId }) => (
                            <SortableSectionRow
                              key={dragId}
                              dragId={dragId}
                              section={section}
                              originalIdx={originalIdx}
                              isSelected={selectedIdx === originalIdx}
                              onSelect={() => setSelectedIdx(originalIdx)}
                              onToggle={() => toggleSection(originalIdx)}
                              getSectionColor={getSectionColor}
                              getSectionIcon={getSectionIcon}
                              getSectionLabel={getSectionLabel}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      <DragOverlay>
                        {activeDragId ? (() => {
                          const item = sortedSections.find(s => s.dragId === activeDragId);
                          if (!item) return null;
                          return (
                            <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-teal-400 bg-white shadow-xl opacity-95">
                              <GripVertical className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" />
                              <span className={`flex-shrink-0 ${getSectionColor(item.section)}`}>{getSectionIcon(item.section)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700 truncate">{getSectionLabel(item.section)}</p>
                              </div>
                            </div>
                          );
                        })() : null}
                      </DragOverlay>
                    </DndContext>
                  );
                })()}

                <button
                  onClick={() => setAddSectionOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors mt-2"
                >
                  <Plus size={13} /> Add Section
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Add section dialog ───────────────────────────────────────────────── */}
      <AddSectionDialog
        open={addSectionOpen}
        onOpenChange={setAddSectionOpen}
        existingSections={config.sections}
        onAddNative={type => addSection(type as Exclude<CheckoutSectionType, 'content_block'>)}
        onAddBlock={(blockType, defaultData, label) => {
          if (!config) return;
          const newSection: ContentBlockSection = {
            type: "content_block",
            enabled: true,
            order: config.sections.length,
            blockType,
            blockData: defaultData,
            label,
          };
          updateConfig({ ...config, sections: [...config.sections, newSection] });
          setSelectedIdx(config.sections.length);
          setAddSectionOpen(false);
        }}
      />

      {/* ── Template picker dialog ───────────────────────────────────────────── */}
      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-teal-600" /> Choose a Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Built-in */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Built-in Templates</p>
              <div className="grid grid-cols-2 gap-3">
                {BUILT_IN_TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t.config)}
                    className="text-left p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors bg-white">
                    <div className="text-2xl mb-2">{t.emoji}</div>
                    <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Saved */}
            {savedTemplates.length > 0 && (
              <div>
                <Separator />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Your Saved Templates</p>
                <div className="grid grid-cols-2 gap-3">
                  {savedTemplates.map(t => (
                    <div key={t.id} className="relative group">
                      <button onClick={() => applyTemplate(parseCheckoutPageConfig(t.config))}
                        className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors bg-white">
                        <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                        {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(t.id)}
                        className="absolute top-2 right-2 p-1 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm apply template ───────────────────────────────────────────── */}
      <AlertDialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply template?</AlertDialogTitle>
            <AlertDialogDescription>This will replace your current checkout page configuration. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (templateToApply) { updateConfig(templateToApply); setConfirmApplyOpen(false); setTemplateToApply(null); } }}>
              Apply Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Save as template dialog ──────────────────────────────────────────── */}
      <Dialog open={templateSaveOpen} onOpenChange={setTemplateSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Save className="h-4 w-4 text-teal-600" /> Save as Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold text-gray-600 block mb-1.5">Template name *</Label>
              <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. My High-Trust Layout" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-600 block mb-1.5">Description (optional)</Label>
              <Textarea value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} placeholder="Brief description…" className="text-sm min-h-[60px] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateSaveOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (config && templateName.trim()) saveTemplate.mutate({ name: templateName.trim(), description: templateDesc.trim() || undefined, config: JSON.stringify(config) }); }}
              disabled={!templateName.trim() || saveTemplate.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white">
              {saveTemplate.isPending ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete template confirm ──────────────────────────────────────────── */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>This template will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleteConfirmId !== null) { deleteTemplate.mutate({ id: deleteConfirmId }); setDeleteConfirmId(null); } }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
