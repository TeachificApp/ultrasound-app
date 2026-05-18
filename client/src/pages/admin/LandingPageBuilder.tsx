/**
 * LandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG landing page editor.
 * Route: /admin/lms/:courseId/landing-builder
 * Supports 25+ block types + Template Library (save/reuse pages and blocks).
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
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DebouncedInput, DebouncedTextarea } from "@/components/DebouncedInput";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { FunnelWorkflowBlock, InlineOrderBumpBlock, ProductOfferStackBlock } from "@/components/FunnelBlocks";
import { FUNNEL_TEMPLATES, getFunnelTemplateBlocks } from "@/lib/funnelTemplates";
import { BlockPreview } from "@/components/BlockPreview";
import {
  ArrowLeft, Save, Eye, Plus, Trash2, GripVertical, Type, Image, Video,
  List, Quote, CreditCard, Minus, Columns, X, Palette, AlignLeft,
  AlignCenter, AlignRight, HelpCircle, Users, Star, Globe, Timer,
  AlertTriangle, CheckSquare, LayoutGrid, Layers, BookOpen, Tag,
  ChevronDown, ChevronUp, Copy, FolderOpen, BookMarked, Upload, Code,
  ShoppingCart, Package, Link, Mail, Phone, MapPin,
} from "lucide-react";


// ─── Block Types & BlockPreview (re-exported from shared component) ─────────
import type { BlockType, Block } from "@/components/BlockPreview";
export type { BlockType, Block } from "@/components/BlockPreview";
export { BlockPreview };

export function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── Block Catalog ────────────────────────────────────────────────────────────

export const BLOCK_CATALOG: { type: BlockType; label: string; icon: React.ReactNode; category: string; defaultData: Record<string, any> }[] = [
  // ── Layout & Structure
  {
    type: "hero", label: "Hero / Banner", icon: <Image size={14} />, category: "Layout",
    defaultData: {
      headline: "Your Course Headline", headline2: "", subheadline: "A compelling subtitle that explains the value",
      bgType: "color", bgColor: "#179ca3", gradientFrom: "#179ca3", gradientTo: "#0e4a50",
      gradientDir: "to bottom right", imageUrl: "", videoUrl: "", textColor: "#ffffff",
      headlineColor: "", headline2Color: "",
      align: "left", inlineMediaUrl: "", inlineMediaType: "image", inlineMediaPlacement: "right",
      buttons: [{ text: "Enroll Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }],
    },
  },
  { type: "two_column", label: "Two Columns", icon: <Columns size={14} />, category: "Layout",
    defaultData: { leftType: "rich_text", rightType: "rich_text", leftHtml: "<p>Left column content</p>", rightHtml: "<p>Right column content</p>", leftRatio: 50, bgColor: "#ffffff" } },
  { type: "divided_columns", label: "Divided Columns", icon: <Columns size={14} />, category: "Layout",
    defaultData: { columns: [{ html: "<p>Column 1</p>" }, { html: "<p>Column 2</p>" }], gap: 32, bgColor: "#ffffff" } },
  { type: "three_column", label: "Three Columns", icon: <Columns size={14} />, category: "Layout",
    defaultData: { col1Html: "<p>Column 1</p>", col2Html: "<p>Column 2</p>", col3Html: "<p>Column 3</p>", bgColor: "#ffffff", showDividers: false, dividerColor: "#e5e7eb", dividerStyle: "solid", dividerWidth: 1, dividerRadius: 0 } },
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
    defaultData: { embedUrl: "", caption: "" } },
  { type: "embed", label: "Embed / iFrame", icon: <Globe size={14} />, category: "Content",
    defaultData: { embedCode: "", height: 400, caption: "" } },
  { type: "gallery", label: "Image Gallery", icon: <LayoutGrid size={14} />, category: "Content",
    defaultData: { images: [{ url: "", caption: "" }, { url: "", caption: "" }, { url: "", caption: "" }], columns: 3, bgColor: "#ffffff" } },
  // ── Marketing
  { type: "bullets", label: "Feature List", icon: <List size={14} />, category: "Marketing",
    defaultData: { headline: "What You'll Learn", items: ["Key concept one", "Key concept two", "Key concept three"], iconColor: "#179ca3", bgColor: "#f8fffe" } },
  { type: "numbered_list", label: "Numbered List", icon: <List size={14} />, category: "Marketing",
    defaultData: { headline: "Steps to Success", items: ["First step", "Second step", "Third step"], accentColor: "#179ca3", bgColor: "#ffffff" } },
  { type: "icon_grid", label: "Icon Grid", icon: <LayoutGrid size={14} />, category: "Marketing",
    defaultData: { headline: "Why Choose This Course", items: [{ icon: "🎯", title: "Focused Content", text: "Targeted curriculum" }, { icon: "⚡", title: "Fast Results", text: "See improvement quickly" }, { icon: "🏆", title: "Expert Instructors", text: "Learn from the best" }], columns: 3, bgColor: "#ffffff" } },
  { type: "testimonial", label: "Testimonial", icon: <Quote size={14} />, category: "Marketing",
    defaultData: { quote: "This course changed my practice completely.", author: "Jane Smith, RDMS", avatarUrl: "", bgColor: "#f0fafa", accentColor: "#179ca3", rating: 5 } },
  { type: "reviews", label: "Reviews / Stars", icon: <Star size={14} />, category: "Marketing",
    defaultData: { headline: "What Students Say", reviews: [{ name: "Jane D.", rating: 5, text: "Excellent course!" }, { name: "Mark S.", rating: 5, text: "Very practical content." }], bgColor: "#ffffff" } },
  { type: "logos", label: "Logos / Social Proof", icon: <Tag size={14} />, category: "Marketing",
    defaultData: { headline: "Trusted By", logos: [{ url: "", alt: "Organization 1" }, { url: "", alt: "Organization 2" }], bgColor: "#f9fafb" } },
  { type: "instructor", label: "Instructor Profile", icon: <Users size={14} />, category: "Marketing",
    defaultData: { instructorId: null, mode: "profile", layout: "horizontal", name: "Instructor Name", title: "Credentials & Title", bio: "Brief instructor biography...", avatarUrl: "", website: "", bgColor: "#ffffff", showBio: true, showWebsite: true, headlineColor: "#111827", titleColor: "#179ca3" } },
  { type: "faq", label: "FAQ / Accordion", icon: <HelpCircle size={14} />, category: "Marketing",
    defaultData: { headline: "Frequently Asked Questions", items: [{ q: "Who is this course for?", a: "This course is designed for..." }, { q: "How long do I have access?", a: "You get lifetime access." }], bgColor: "#ffffff", accentColor: "#179ca3" } },
  { type: "countdown", label: "Countdown Timer", icon: <Timer size={14} />, category: "Marketing",
    defaultData: { headline: "LIMITED TIME OFFER!", mode: "on_load", durationMinutes: 90, targetDate: "", bgColor: "#ffffff", textColor: "#0e1e2e", accentColor: "#179ca3", showBorder: true } },
  { type: "alert", label: "Alert / Callout", icon: <AlertTriangle size={14} />, category: "Marketing",
    defaultData: { text: "Limited time offer — enroll today!", alertType: "info", icon: "💡" } },
  { type: "flip_cards", label: "Flip Cards", icon: <Layers size={14} />, category: "Marketing",
    defaultData: { headline: "Course Modules", cards: [{ front: "Module 1", back: "Description of module 1 content" }, { front: "Module 2", back: "Description of module 2 content" }], accentColor: "#179ca3", bgColor: "#f8fffe" } },
  // ── Conversion
  { type: "pricing_cta", label: "Pricing / Enroll CTA", icon: <CreditCard size={14} />, category: "Conversion",
    defaultData: { headline: "Ready to Get Started?", subtext: "Join thousands of sonographers improving their skills.", ctaText: "Enroll Now", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true, originalPrice: "", showOriginalPrice: false,
      optOutEnabled: false, optOutText: "No thanks, I don't want this offer", optOutLinkType: "custom", optOutCourseId: null, optOutDownloadId: null, optOutCustomUrl: "" } },
  { type: "cta_standalone", label: "Call to Action", icon: <CheckSquare size={14} />, category: "Conversion",
    defaultData: { headline: "Start Learning Today", subtext: "", ctaText: "Get Started", ctaLink: "", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#f0fafa", align: "center",
      optOutEnabled: false, optOutText: "No thanks, take me to my course", optOutLinkType: "custom", optOutCourseId: null, optOutDownloadId: null, optOutCustomUrl: "" } },
  { type: "lead_capture", label: "Lead Capture Form", icon: <BookMarked size={14} />, category: "Conversion",
    defaultData: { headline: "Get a Free Preview", subtext: "Enter your email to get instant access.", ctaText: "Send Me Access", bgColor: "#179ca3", textColor: "#ffffff" } },
  { type: "funnel_workflow", label: "Funnel Workflow", icon: <Layers size={14} />, category: "Funnel",
    defaultData: {
      eyebrow: "Sales funnel", headline: "A complete funnel from first click to fulfilled order", subtext: "Link landing, checkout, bump, and thank-you pages together for a ClickFunnels-style workflow.",
      accentColor: "#179ca3", bgColor: "#f8fffe",
      steps: [
        { name: "Landing Page", role: "Warm up traffic with the offer, story, proof, and guarantee.", url: "#top", cta: "Open page" },
        { name: "Checkout", role: "Send buyers into the primary product checkout.", url: "#checkout", cta: "Go to checkout" },
        { name: "Order Bump", role: "Add a one-click digital or physical product before payment.", url: "#order-bump", cta: "View bump" },
        { name: "Thank You", role: "Confirm purchase and point customers to delivery or next offer.", url: "/thank-you", cta: "Next step" },
      ],
    } },
  { type: "product_offer_stack", label: "Product Offer Stack", icon: <Package size={14} />, category: "Funnel",
    defaultData: {
      headline: "Build a higher-value cart", subtext: "Promote digital downloads, courses, bundles, and physical kits from one sales page.",
      accentColor: "#179ca3", bgColor: "#ffffff",
      products: [
        { type: "digital", title: "Digital Protocol Pack", description: "Instant access files, templates, and quick-reference guides.", price: "$49", ctaText: "Add digital item", ctaLink: "#checkout", fulfillment: "Delivered immediately after checkout." },
        { type: "physical", title: "Printed Pocket Cards", description: "A shipped companion product that reinforces the digital training.", price: "$29", ctaText: "Add physical item", ctaLink: "#order-bump", fulfillment: "Ships after the order is processed." },
      ],
    } },
  { type: "order_bump_checkout", label: "Order Bump Checkout", icon: <ShoppingCart size={14} />, category: "Funnel",
    defaultData: {
      anchorId: "order-bump", discountLabel: "One-time offer", headline: "Add the printed scan checklist to your order", subheadline: "A high-converting bump offer for buyers already in checkout mode.",
      description: "Use this block to promote a digital bonus, shipped product, or bundle as part of the sales workflow.", productType: "physical",
      price: "$19", compareAtPrice: "$39", checkboxLabel: "Yes, add this order bump", ctaText: "Add bump and continue", skipText: "Continue without bump",
      shippingNote: "Shipping collected at checkout", features: ["Works for physical or digital bump offers", "Designed for one-click add-to-order messaging", "Pairs with the Order Bumps admin tab"], accentColor: "#f59e0b", bgColor: "#fff7ed",
    } },
  { type: "price_stack", label: "Price Stack CTA", icon: <CreditCard size={14} />, category: "Funnel",
    defaultData: {
      imageUrl: "", headline: "WHEN YOU UPGRADE RIGHT NOW,\nYOU'LL GET:",
      items: [{ text: "Hands-On Access", price: "(Normally $3497)" }, { text: "LIVE in-person mentorship", price: "(cannot put a price tag)" }],
      totalValueText: "TOTAL VALUE: Over $5000", originalPrice: "NORMALLY $3497", finalPrice: "$2497", finalPriceLabel: "Today Only:",
      ctaText: "ENROLL NOW", ctaLink: "", ctaColor: "#179ca3", ctaTextColor: "#ffffff",
      bgColor: "#ffffff", textColor: "#0e1e2e", borderColor: "#1a5f7a", showBorder: true,
      optOutEnabled: false, optOutText: "No thanks, I'll pass on this offer", optOutLinkType: "custom", optOutCourseId: null, optOutDownloadId: null, optOutCustomUrl: "",
    } },
  { type: "urgency_offer", label: "Urgency Offer", icon: <Timer size={14} />, category: "Funnel",
    defaultData: {
      headline: "Take What You Learn...\nand Actually Scan",
      description: "Upgrade your experience with an exclusive hands-on workshop",
      bodyHtml: "<p>You can understand ultrasound...</p><p>But confidence comes from putting your hands on the probe. <strong>This is where everything clicks.</strong></p>",
      ctaText: "Add on now for $2497", ctaEmoji: "\uD83D\uDC4D", ctaLink: "",
      optOutEnabled: false, optOutText: "No thanks, I don't want this upgrade", optOutLinkType: "custom", optOutCourseId: null, optOutDownloadId: null, optOutCustomUrl: "",
      countdownMode: "on_load", countdownMinutes: 90, countdownTargetDate: "",
      countdownHeadline: "LIMITED TIME OFFER!",
      bgColor: "#ffffff", textColor: "#0e1e2e", accentColor: "#179ca3", showBorder: true,
    } },
  { type: "checkout_form", label: "Checkout Form", icon: <CreditCard size={14} />, category: "Funnel",
    defaultData: {
      displayMode: "inline", // "inline" or "standalone"
      headerText: "Lock in your seat now!",
      headerPrice: "$1997",
      accentColor: "#179ca3",
      bgColor: "#ffffff",
      textColor: "#0e1e2e",
      showContactInfo: true,
      showBillingInfo: true,
      showProductSelect: true,
      products: [
        { name: "Main Course", description: "Full access to the course", price: 199700, imageUrl: "", type: "course" }
      ],
      orderBumps: [
        { title: "Workbook", headline: "Workbooks will arrive approximately 1 week prior to the start of the course.", description: "Your step-by-step companion to actually understand, retain, and apply everything you learn.", price: 29997, imageUrl: "", ctaText: "+ Add", ctaEmoji: "\uD83D\uDC4D", externalUrl: "" }
      ],
      termsText: "I attest that I meet the pre-requisites for this course and I agree to the",
      termsLinkText: "TERMS OF SERVICE",
      termsLinkUrl: "/terms",
      submitText: "Submit",
      successRedirect: "",
    } },
  // ── Layout extras
  { type: "logo_strip", label: "Logo / Brand", icon: <Image size={14} />, category: "Layout",
    defaultData: { logoUrl: "", maxWidth: "200px", align: "center", link: "/", bgColor: "#ffffff", padding: "16px 0" } },
  { type: "footer", label: "Footer", icon: <Columns size={14} />, category: "Layout",
    defaultData: {
      bgColor: "#0e1e2e", textColor: "#ffffff", align: "center",
      copyrightText: "© 2026 All About Ultrasound. All rights reserved.",
      links: [{ text: "Privacy Policy", url: "/privacy" }, { text: "Terms of Service", url: "/terms" }, { text: "Contact", url: "/contact" }],
      showSocial: true, socialLinks: { facebook: "", instagram: "", youtube: "", linkedin: "" },
      logoUrl: "", logoMaxWidth: "120px",
    } },
  // ── Smart Sections
  { type: "curriculum_auto", label: "Curriculum (Auto)", icon: <BookOpen size={14} />, category: "Smart",
    defaultData: { headline: "Course Curriculum", bgColor: "#ffffff", showLocked: true } },
  { type: "pricing_options_auto", label: "Pricing Options (Auto)", icon: <CreditCard size={14} />, category: "Smart",
    defaultData: { headline: "Choose Your Plan", bgColor: "#f9fafb" } },
  { type: "related_products", label: "Related Products", icon: <Package size={14} />, category: "Smart",
    defaultData: {
      headline: "You Might Also Like",
      subtext: "Explore more resources to advance your skills.",
      productType: "both",  // "course" | "download" | "both"
      maxItems: 3,
      layout: "grid",       // "grid" | "list"
      showPrice: true,
      showDescription: true,
      ctaText: "Learn More",
      bgColor: "#f9fafb",
      cardBgColor: "#ffffff",
      accentColor: "#179ca3",
      textColor: "#111827",
      excludeCurrentSlug: true,
    } },
];

export const CATALOG_CATEGORIES = ["Layout", "Content", "Marketing", "Conversion", "Funnel", "Smart"];

// ─── Block Preview ─────────────────────────────────────────────────────────────

// ─── Instructor Block Settings (select from saved profiles or manual entry) ──
function InstructorBlockSettings({ d, set, inlineMediaRef, uploading, handleFileUpload, onChange }: {
  d: Record<string, any>;
  set: (key: string, value: any) => void;
  inlineMediaRef: React.RefObject<HTMLInputElement | null>;
  uploading: string | null;
  handleFileUpload: (file: File, targetField: string, context: string) => void;
  onChange: (data: Record<string, any>) => void;
}) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { data: instructors, refetch: refetchInstructors } = trpc.lmsAdmin.listInstructors.useQuery();
  const createInstructor = trpc.lmsAdmin.createInstructor.useMutation({
    onSuccess: (result) => {
      refetchInstructors();
      toast.success("Instructor profile created!");
      // Auto-select the newly created instructor
      onChange({ ...d, instructorId: result.id, mode: "profile" });
      setShowCreateDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const mode = d.mode ?? "profile";
  const selectedInstructor = d.instructorId ? instructors?.find((i: any) => i.id === Number(d.instructorId)) : null;

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Source</label>
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => set("mode", "profile")} className={`py-1.5 text-xs rounded border ${mode === "profile" ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Saved Profile</button>
          <button onClick={() => set("mode", "manual")} className={`py-1.5 text-xs rounded border ${mode === "manual" ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Manual Entry</button>
        </div>
      </div>

      {mode === "profile" ? (
        <>
          {/* Profile selector */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Select Instructor</label>
            <Select value={d.instructorId ? String(d.instructorId) : "_none"} onValueChange={v => set("instructorId", v === "_none" ? null : Number(v))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choose an instructor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Select —</SelectItem>
                {(instructors ?? []).map((inst: any) => (
                  <SelectItem key={inst.id} value={String(inst.id)}>
                    {inst.name}{inst.title ? ` — ${inst.title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Selected instructor preview */}
          {selectedInstructor && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
              <div className="flex items-center gap-3">
                {selectedInstructor.avatarUrl
                  ? <img src={selectedInstructor.avatarUrl} className="w-10 h-10 rounded-full object-cover" />
                  : <div className="w-10 h-10 rounded-full bg-teal-200 flex items-center justify-center"><Users size={16} className="text-teal-700" /></div>}
                <div>
                  <p className="text-sm font-semibold text-teal-900">{selectedInstructor.name}</p>
                  {selectedInstructor.title && <p className="text-xs text-teal-700">{selectedInstructor.title}</p>}
                </div>
              </div>
            </div>
          )}
          {/* Create new button */}
          <button onClick={() => setShowCreateDialog(true)} className="w-full py-2 text-xs text-teal-700 bg-teal-50 border border-dashed border-teal-300 rounded-lg hover:bg-teal-100 flex items-center justify-center gap-1">
            <Plus size={12} /> Create New Instructor Profile
          </button>
        </>
      ) : (
        <>
          {/* Manual fields */}
          <BSTextField data={d} onSet={set} label="Name" field="name" />
          <BSTextField data={d} onSet={set} label="Title / Credentials" field="title" />
          <BSTextField data={d} onSet={set} label="Bio" field="bio" multiline />
          <BSTextField data={d} onSet={set} label="Website" field="website" placeholder="https://..." />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Avatar</label>
            <div className="flex items-center gap-2">
              <DebouncedInput value={d.avatarUrl ?? ""} onChange={v => set("avatarUrl", v)} className="h-8 text-sm flex-1" placeholder="Avatar URL or upload" />
              <button onClick={() => inlineMediaRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "avatarUrl"}>{uploading === "avatarUrl" ? "..." : <><Upload size={12} /> Upload</>}</button>
              <input ref={inlineMediaRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "avatarUrl", "instructor-avatar"); e.target.value = ""; }} />
            </div>
            {d.avatarUrl && <img src={d.avatarUrl} className="w-12 h-12 rounded-full object-cover border mt-1" />}
          </div>
        </>
      )}

      {/* Layout */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Layout</label>
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => set("layout", "horizontal")} className={`py-1.5 text-xs rounded border ${(d.layout ?? "horizontal") === "horizontal" ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Horizontal</button>
          <button onClick={() => set("layout", "centered")} className={`py-1.5 text-xs rounded border ${d.layout === "centered" ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Centered</button>
        </div>
      </div>

      {/* Display toggles */}
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={d.showBio !== false} onChange={e => set("showBio", e.target.checked)} className="rounded" />
        <label className="text-xs text-gray-600">Show bio</label>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={d.showWebsite !== false} onChange={e => set("showWebsite", e.target.checked)} className="rounded" />
        <label className="text-xs text-gray-600">Show website</label>
      </div>

      {/* Colors */}
      <BSColorField data={d} onSet={set} label="Name Color" field="headlineColor" />
      <BSColorField data={d} onSet={set} label="Title Color" field="titleColor" />
      <BSColorField data={d} onSet={set} label="Background" field="bgColor" />

      {/* Create Instructor Dialog */}
      {showCreateDialog && (
        <InlineInstructorFormDialog
          onClose={() => setShowCreateDialog(false)}
          onSave={(data) => createInstructor.mutate(data)}
          saving={createInstructor.isPending}
        />
      )}
    </div>
  );
}

// ─── Inline Instructor Form Dialog (for creating new profiles from the builder) ──
function InlineInstructorFormDialog({ onClose, onSave, saving }: {
  onClose: () => void;
  onSave: (data: { name: string; title?: string; bio?: string; avatarUrl?: string; website?: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [instrTitle, setInstrTitle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [website, setWebsite] = useState("");

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Instructor Profile</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" placeholder="Full name" />
            </div>
            <div>
              <Label className="text-sm">Title / Credentials</Label>
              <Input value={instrTitle} onChange={e => setInstrTitle(e.target.value)} placeholder="RDCS, FASE" className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-sm">Avatar URL</Label>
            <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Website</Label>
            <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Bio</Label>
            <div className="mt-1"><RichTextEditor value={bio} onChange={setBio} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!name.trim() || saving}
            onClick={() => onSave({ name: name.trim(), title: instrTitle.trim() || undefined, bio: bio || undefined, avatarUrl: avatarUrl.trim() || undefined, website: website.trim() || undefined })}>
            {saving ? "Saving..." : "Create Profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Block Settings Field Helpers ───────────────────────────────────────────
function BSTextField({ data, onSet, label, field, placeholder, multiline }: {
  data: Record<string, any>; onSet: (key: string, val: any) => void;
  label: string; field: string; placeholder?: string; multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      {multiline ? (
        <DebouncedTextarea
          value={data[field] ?? ""}
          onChange={v => onSet(field, v)}
          className="text-xs min-h-[60px]"
          placeholder={placeholder}
        />
      ) : (
        <DebouncedInput
          value={data[field] ?? ""}
          onChange={v => onSet(field, v)}
          className="h-8 text-xs"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function BSColorField({ data, onSet, label, field }: {
  data: Record<string, any>; onSet: (key: string, val: any) => void;
  label: string; field: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={data[field] ?? "#ffffff"}
          onChange={e => onSet(field, e.target.value)}
          className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
        />
        <DebouncedInput
          value={data[field] ?? ""}
          onChange={v => onSet(field, v)}
          className="h-8 text-xs flex-1"
          placeholder="#ffffff or rgba(...)"
        />
      </div>
    </div>
  );
}

function BSAlignField({ data, onSet, label, field }: {
  data: Record<string, any>; onSet: (key: string, val: any) => void;
  label: string; field: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <select
        value={data[field] ?? "left"}
        onChange={e => onSet(field, e.target.value)}
        className="w-full h-8 text-xs rounded border border-gray-200 px-2"
      >
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
      </select>
    </div>
  );
}

// BSLinkField accepts either (data/onSet/label/field) or (label/value/onChange) style
function BSLinkField({ data, onSet, label, field, value, onChange }: {
  label: string;
  data?: Record<string, any>; onSet?: (key: string, val: any) => void; field?: string;
  value?: string; onChange?: (v: string) => void;
}) {
  const val = data !== undefined ? (data[field!] ?? "") : (value ?? "");
  const handleChange = data !== undefined
    ? (v: string) => onSet!(field!, v)
    : (v: string) => onChange!(v);
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <DebouncedInput
        value={val}
        onChange={handleChange}
        className="h-8 text-xs"
        placeholder="https://..."
      />
    </div>
  );
}

function OptOutSettings({ d, set }: { d: Record<string, any>; set: (key: string, val: any) => void }) {
  return (
    <div className="space-y-2 border-t border-gray-100 pt-2 mt-2">
      <label className="text-xs text-gray-500 font-medium block">Opt-Out / Skip Link</label>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={d.showOptOut ?? false} onChange={e => set("showOptOut", e.target.checked)} className="rounded" />
        <label className="text-xs text-gray-600">Show opt-out link</label>
      </div>
      {d.showOptOut && (
        <>
          <DebouncedInput value={d.optOutText ?? "No thanks"} onChange={v => set("optOutText", v)} className="h-8 text-xs" placeholder="No thanks, I don't want this" />
          <DebouncedInput value={d.optOutUrl ?? ""} onChange={v => set("optOutUrl", v)} className="h-8 text-xs" placeholder="https://... (skip destination)" />
        </>
      )}
    </div>
  );
}

export function BlockSettings({ block, onChange }: { block: Block; onChange: (data: Record<string, any>) => void }) {
  const d = block.data;
  // Use refs to avoid stale closures with debounced inputs
  const dataRef = useRef(block.data);
  const onChangeRef = useRef(onChange);
  dataRef.current = block.data;
  onChangeRef.current = onChange;
  const set = useCallback((key: string, value: any) => {
    onChangeRef.current({ ...dataRef.current, [key]: value });
  }, []);
  // Upload hooks — must be at top level (React rules of hooks)
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
  // Render block-specific settings via switch, then append global spacing
  const blockSpecific = (() => { switch (block.type) {
    case "hero": {
      const bgType = d.bgType ?? "color";
      const buttons: Array<{ text: string; color: string; textColor: string; link: string; style: string; animation?: string }> =
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Enroll Now", color: d.ctaColor ?? "#fff", textColor: d.ctaTextColor ?? "#179ca3", link: "", style: "filled" }];
      const setBtn = (idx: number, key: string, val: string) => { const next = buttons.map((b, i) => i === idx ? { ...b, [key]: val } : b); onChangeRef.current({ ...dataRef.current, buttons: next }); };
      const addBtn = () => onChange({ ...d, buttons: [...buttons, { text: "Learn More", color: "transparent", textColor: "#fff", link: "", style: "outline" }] });
      const removeBtn = (idx: number) => onChange({ ...d, buttons: buttons.filter((_, i) => i !== idx) });

      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Headline (Line 1)" field="headline" />
          <BSColorField data={d} onSet={set} label="Line 1 Color" field="headlineColor" />
          <BSTextField data={d} onSet={set} label="Headline (Line 2)" field="headline2" />
          <BSColorField data={d} onSet={set} label="Line 2 Color" field="headline2Color" />
          <BSTextField data={d} onSet={set} label="Subheadline" field="subheadline" multiline />
          <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Background Type</label>
            <div className="grid grid-cols-2 gap-1">
              {(["color", "gradient", "image", "video"] as const).map(t => (
                <button key={t} onClick={() => set("bgType", t)} className={`py-1 text-xs rounded border ${bgType === t ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {t === "color" ? "Solid Color" : t === "gradient" ? "Gradient" : t === "image" ? "Image" : "Video"}
                </button>
              ))}
            </div>
          </div>
          {bgType === "color" && <BSColorField data={d} onSet={set} label="Background" field="bgColor" />}
          {bgType === "gradient" && (<><BSColorField data={d} onSet={set} label="From" field="gradientFrom" /><BSColorField data={d} onSet={set} label="To" field="gradientTo" /><div><label className="text-xs text-gray-500 block mb-1">Direction</label><select value={d.gradientDir ?? "to bottom right"} onChange={e => set("gradientDir", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="to right">Left → Right</option><option value="to bottom">Top → Bottom</option><option value="to bottom right">Diagonal ↘</option><option value="to bottom left">Diagonal ↙</option><option value="135deg">135°</option></select></div></>)}
          {bgType === "image" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DebouncedInput value={d.imageUrl ?? ""} onChange={v => set("imageUrl", v)} placeholder="Image URL or upload" className="h-8 text-sm flex-1" />
                <button onClick={() => bgImageRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "imageUrl"}>
                  {uploading === "imageUrl" ? "..." : <><Upload size={12} /> Upload</>}
                </button>
                <input ref={bgImageRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "imageUrl", "hero-bg"); e.target.value = ""; }} />
              </div>
              {d.imageUrl && <img src={d.imageUrl} className="w-full h-16 object-cover rounded border" />}
            </div>
          )}
          {bgType === "video" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DebouncedInput value={d.videoUrl ?? ""} onChange={v => set("videoUrl", v)} placeholder="Video URL or upload" className="h-8 text-sm flex-1" />
                <button onClick={() => bgVideoRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "videoUrl"}>
                  {uploading === "videoUrl" ? "..." : <><Upload size={12} /> Upload</>}
                </button>
                <input ref={bgVideoRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "videoUrl", "hero-bg-video"); e.target.value = ""; }} />
              </div>
              <p className="text-[10px] text-gray-400">Video will autoplay muted as background</p>
            </div>
          )}
          {/* Inline Media */}
          <div className="border-t pt-3 mt-3">
            <label className="text-xs text-gray-500 font-medium block mb-2">Inline Media (within banner)</label>
            <div className="space-y-2">
              <select value={d.inlineMediaType ?? "image"} onChange={e => set("inlineMediaType", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
              <div className="flex items-center gap-2">
                <DebouncedInput value={d.inlineMediaUrl ?? ""} onChange={v => set("inlineMediaUrl", v)} placeholder={d.inlineMediaType === "video" ? "Video URL" : "Image URL"} className="h-8 text-sm flex-1" />
                <button onClick={() => inlineMediaRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "inlineMediaUrl"}>
                  {uploading === "inlineMediaUrl" ? "..." : <><Upload size={12} /> Upload</>}
                </button>
                <input ref={inlineMediaRef} type="file" accept={d.inlineMediaType === "video" ? "video/*" : "image/*"} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "inlineMediaUrl", "hero-inline"); e.target.value = ""; }} />
              </div>
              {d.inlineMediaUrl && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Placement</label>
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as const).map(pos => (
                      <button key={pos} onClick={() => set("inlineMediaPlacement", pos)} className={`flex-1 py-1 text-xs rounded border capitalize ${d.inlineMediaPlacement === pos ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{pos}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <BSAlignField data={d} onSet={set} label="Text Alignment" field="align" />
          <div className="flex items-center gap-2 mb-1"><input type="checkbox" checked={d.hideButtons ?? false} onChange={e => set("hideButtons", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Hide buttons on page</label></div>
          {!d.hideButtons && <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">CTA Buttons</label>
              <button onClick={addBtn} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-3">
              {buttons.map((btn, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-2 space-y-2">
                  <div className="flex items-center justify-between"><span className="text-xs font-medium text-gray-600">Button {idx + 1}</span>{buttons.length > 1 && <button onClick={() => removeBtn(idx)} className="text-red-400 hover:text-red-600"><X size={12} /></button>}</div>
                  <div><label className="text-xs text-gray-400 block mb-0.5">Label</label><DebouncedInput value={btn.text} onChange={v => setBtn(idx, "text", v)} className="h-7 text-xs" /></div>
                  <BSLinkField label="Link" value={btn.link ?? ""} onChange={v => setBtn(idx, "link", v)} />
                  <div><label className="text-xs text-gray-400 block mb-0.5">Style</label><div className="flex gap-1">{(["filled", "outline"] as const).map(s => <button key={s} onClick={() => setBtn(idx, "style", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${btn.style === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div>
                  <div className="flex items-center gap-2"><label className="text-xs text-gray-400 w-16 flex-shrink-0">Color</label><input type="color" value={btn.color} onChange={e => setBtn(idx, "color", e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-200" /><DebouncedInput value={btn.color} onChange={v => setBtn(idx, "color", v)} className="h-7 text-xs flex-1" /></div>
                  {btn.style !== "outline" && <div className="flex items-center gap-2"><label className="text-xs text-gray-400 w-16 flex-shrink-0">Text</label><input type="color" value={btn.textColor} onChange={e => setBtn(idx, "textColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-200" /><DebouncedInput value={btn.textColor} onChange={v => setBtn(idx, "textColor", v)} className="h-7 text-xs flex-1" /></div>}
                  <div><label className="text-xs text-gray-400 block mb-0.5">Animation</label><Select value={btn.animation ?? "none"} onValueChange={v => setBtn(idx, "animation", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="pulse">Pulse</SelectItem><SelectItem value="bounce">Bounce</SelectItem><SelectItem value="shake">Shake</SelectItem><SelectItem value="glow">Glow</SelectItem></SelectContent></Select></div>
                </div>
              ))}
            </div>
          </div>}
        </div>
      );
    }
    case "text":
      return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Content</label><RichTextEditor value={d.html ?? ""} onChange={(html) => set("html", html)} minHeight={150} maxHeight={400} placeholder="Start typing your content..." /></div><BSAlignField data={d} onSet={set} label="Text Alignment" field="align" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><BSColorField data={d} onSet={set} label="Text Color" field="textColor" /></div>);
     case "image":
       return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Image URL</label><div className="flex items-center gap-2"><DebouncedInput value={d.url ?? ""} onChange={v => set("url", v)} className="h-8 text-sm flex-1" placeholder="Image URL or upload" /><button onClick={() => bgImageRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "url"}>{uploading === "url" ? "..." : <><Upload size={12} /> Upload</>}</button><input ref={bgImageRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "url", "image-block"); e.target.value = ""; }} /></div>{d.url && <img src={d.url} className="w-full h-16 object-cover rounded border mt-1" style={{ borderRadius: d.borderRadius ? `${d.borderRadius}px` : undefined }} />}</div><BSTextField data={d} onSet={set} label="Alt Text" field="alt" /><BSTextField data={d} onSet={set} label="Caption" field="caption" /><div><label className="text-xs text-gray-500 block mb-1">Max Width</label><DebouncedInput value={d.maxWidth ?? "100%"} onChange={v => set("maxWidth", v)} className="h-8 text-sm" placeholder="100%, 600px, etc." /></div><div><label className="text-xs text-gray-500 block mb-1">Height</label><DebouncedInput value={d.height ?? ""} onChange={v => set("height", v)} className="h-8 text-sm" placeholder="auto, 300px, etc." /></div><div><label className="text-xs text-gray-500 block mb-1">Border Radius (px)</label><Input type="number" value={d.borderRadius ?? 0} onChange={e => set("borderRadius", Number(e.target.value))} className="h-8 text-sm" min={0} max={999} /></div><div><label className="text-xs text-gray-500 block mb-1">Border Width (px)</label><Input type="number" value={d.borderWidth ?? 0} onChange={e => set("borderWidth", Number(e.target.value))} className="h-8 text-sm" min={0} max={20} /></div><div><label className="text-xs text-gray-500 block mb-1">Border Style</label><div className="flex gap-1">{(["solid", "dashed", "dotted"] as const).map(s => <button key={s} onClick={() => set("borderStyle", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.borderStyle ?? "solid") === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div><BSColorField data={d} onSet={set} label="Border Color" field="borderColor" /></div>);
    case "video":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Embed URL (YouTube, Vimeo, Wistia)" field="embedUrl" /><BSTextField data={d} onSet={set} label="Caption" field="caption" /><div><label className="text-xs text-gray-500 block mb-1">Max Width</label><DebouncedInput value={d.maxWidth ?? "100%"} onChange={v => set("maxWidth", v)} className="h-8 text-sm" placeholder="100%, 800px, etc." /></div><div><label className="text-xs text-gray-500 block mb-1">Height</label><DebouncedInput value={d.height ?? ""} onChange={v => set("height", v)} className="h-8 text-sm" placeholder="auto, 450px, etc." /></div><div><label className="text-xs text-gray-500 block mb-1">Border Radius (px)</label><Input type="number" value={d.borderRadius ?? 0} onChange={e => set("borderRadius", Number(e.target.value))} className="h-8 text-sm" min={0} max={999} /></div><div><label className="text-xs text-gray-500 block mb-1">Border Width (px)</label><Input type="number" value={d.borderWidth ?? 0} onChange={e => set("borderWidth", Number(e.target.value))} className="h-8 text-sm" min={0} max={20} /></div><div><label className="text-xs text-gray-500 block mb-1">Border Style</label><div className="flex gap-1">{(["solid", "dashed", "dotted"] as const).map(s => <button key={s} onClick={() => set("borderStyle", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.borderStyle ?? "solid") === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div><BSColorField data={d} onSet={set} label="Border Color" field="borderColor" /></div>);
    case "embed":
      return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Embed Code (iframe or HTML)</label><DebouncedTextarea value={d.embedCode ?? ""} onChange={v => set("embedCode", v)} className="text-sm min-h-[100px] font-mono text-xs" placeholder='<iframe src="..." />' /></div><div><label className="text-xs text-gray-500 block mb-1">Height (px)</label><Input type="number" value={d.height ?? 400} onChange={e => set("height", Number(e.target.value))} className="h-8 text-sm" /></div><BSTextField data={d} onSet={set} label="Caption" field="caption" /></div>);
    case "gallery": {
      const images: Array<{ url: string; caption: string }> = d.images ?? [];
      return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Columns</label><Input type="number" value={d.columns ?? 3} onChange={e => set("columns", Number(e.target.value))} className="h-8 text-sm" min={1} max={6} /></div><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Images</label><button onClick={() => set("images", [...images, { url: "", caption: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{images.map((img, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Image {i + 1}</span><button onClick={() => set("images", images.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><DebouncedInput value={img.url} onChange={v => { const next = images.map((im, j) => j === i ? { ...im, url: v } : im); set("images", next); }} className="h-7 text-xs" placeholder="Image URL" /><DebouncedInput value={img.caption} onChange={v => { const next = images.map((im, j) => j === i ? { ...im, caption: v } : im); set("images", next); }} className="h-7 text-xs" placeholder="Caption (optional)" /></div>))}</div></div></div>);
    }
    case "bullets": {
      const items: string[] = d.items ?? [];
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Section Headline" field="headline" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Items</label><button onClick={() => set("items", [...items, "New item"])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-1">{items.map((item, i) => (<div key={i} className="flex gap-1"><DebouncedInput value={item} onChange={v => { const next = items.map((it, j) => j === i ? v : it); set("items", next); }} className="h-7 text-xs flex-1" /><button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button></div>))}</div></div><BSColorField data={d} onSet={set} label="Icon Color" field="iconColor" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /></div>);
    }
    case "numbered_list": {
      const items: string[] = d.items ?? [];
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Section Headline" field="headline" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Items</label><button onClick={() => set("items", [...items, "New step"])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-1">{items.map((item, i) => (<div key={i} className="flex gap-1 items-center"><span className="text-xs text-gray-400 w-5 flex-shrink-0">{i + 1}.</span><DebouncedInput value={item} onChange={v => { const next = items.map((it, j) => j === i ? v : it); set("items", next); }} className="h-7 text-xs flex-1" /><button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button></div>))}</div></div><BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /></div>);
    }
    case "icon_grid": {
      const items: Array<{ icon: string; title: string; text: string }> = d.items ?? [];
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Section Headline" field="headline" /><div><label className="text-xs text-gray-500 block mb-1">Columns</label><Input type="number" value={d.columns ?? 3} onChange={e => set("columns", Number(e.target.value))} className="h-8 text-sm" min={1} max={6} /></div><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Items</label><button onClick={() => set("items", [...items, { icon: "⭐", title: "Feature", text: "Description" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{items.map((item, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Item {i + 1}</span><button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><DebouncedInput value={item.icon} onChange={v => { const next = items.map((it, j) => j === i ? { ...it, icon: v } : it); set("items", next); }} className="h-7 text-xs" placeholder="Emoji or icon" /><DebouncedInput value={item.title} onChange={v => { const next = items.map((it, j) => j === i ? { ...it, title: v } : it); set("items", next); }} className="h-7 text-xs" placeholder="Title" /><DebouncedInput value={item.text} onChange={v => { const next = items.map((it, j) => j === i ? { ...it, text: v } : it); set("items", next); }} className="h-7 text-xs" placeholder="Description" /></div>))}</div></div></div>);
    }
    case "testimonial":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Quote" field="quote" multiline /><BSTextField data={d} onSet={set} label="Author" field="author" /><BSTextField data={d} onSet={set} label="Avatar URL" field="avatarUrl" /><div><label className="text-xs text-gray-500 block mb-1">Star Rating</label><div className="flex items-center gap-1">{[0,1,2,3,4,5].map(n => (<button key={n} type="button" onClick={() => set("rating", n)} className={`w-8 h-8 rounded text-sm font-medium border ${(d.rating ?? 5) === n ? "bg-yellow-100 border-yellow-400 text-yellow-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>{n === 0 ? "\u2715" : "\u2605".repeat(n)}</button>))}</div><p className="text-[10px] text-gray-400 mt-1">{(d.rating ?? 5) === 0 ? "Stars hidden" : `${d.rating ?? 5} star${(d.rating ?? 5) > 1 ? "s" : ""} shown`}</p></div><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" /></div>);
    case "reviews": {
      const reviews: Array<{ name: string; rating: number; text: string }> = d.reviews ?? [];
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Section Headline" field="headline" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Reviews</label><button onClick={() => set("reviews", [...reviews, { name: "Student Name", rating: 5, text: "Great course!" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{reviews.map((r, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Review {i + 1}</span><button onClick={() => set("reviews", reviews.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><DebouncedInput value={r.name} onChange={v => { const next = reviews.map((rv, j) => j === i ? { ...rv, name: v } : rv); set("reviews", next); }} className="h-7 text-xs" placeholder="Name" /><Input type="number" value={r.rating} onChange={e => { const next = reviews.map((rv, j) => j === i ? { ...rv, rating: Number(e.target.value) } : rv); set("reviews", next); }} className="h-7 text-xs" min={1} max={5} placeholder="Rating (1-5)" /><DebouncedTextarea value={r.text} onChange={v => { const next = reviews.map((rv, j) => j === i ? { ...rv, text: v } : rv); set("reviews", next); }} className="text-xs min-h-[60px]" placeholder="Review text" /></div>))}</div></div></div>);
    }
    case "logos": {
      const logos: Array<{ url: string; alt: string }> = d.logos ?? [];
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Headline" field="headline" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Logos</label><button onClick={() => set("logos", [...logos, { url: "", alt: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{logos.map((logo, i) => (<div key={i} className="flex gap-1 items-center"><DebouncedInput value={logo.url} onChange={v => { const next = logos.map((l, j) => j === i ? { ...l, url: v } : l); set("logos", next); }} className="h-7 text-xs flex-1" placeholder="Logo URL" /><DebouncedInput value={logo.alt} onChange={v => { const next = logos.map((l, j) => j === i ? { ...l, alt: v } : l); set("logos", next); }} className="h-7 text-xs w-24" placeholder="Alt" /><button onClick={() => set("logos", logos.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button></div>))}</div></div></div>);
    }
    case "instructor":
      return <InstructorBlockSettings d={d} set={set} inlineMediaRef={inlineMediaRef} uploading={uploading} handleFileUpload={handleFileUpload} onChange={onChange} />;
    case "faq": {
      const items: Array<{ q: string; a: string }> = d.items ?? [];
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Section Headline" field="headline" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">FAQ Items</label><button onClick={() => set("items", [...items, { q: "Question?", a: "Answer." }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{items.map((item, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Q{i + 1}</span><button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><DebouncedInput value={item.q} onChange={v => { const next = items.map((it, j) => j === i ? { ...it, q: v } : it); set("items", next); }} className="h-7 text-xs" placeholder="Question" /><DebouncedTextarea value={item.a} onChange={v => { const next = items.map((it, j) => j === i ? { ...it, a: v } : it); set("items", next); }} className="text-xs min-h-[60px]" placeholder="Answer" /></div>))}</div></div></div>);
    }
    case "countdown":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Headline" field="headline" /><div><label className="text-xs text-gray-500 block mb-1">Timer Mode</label><select value={d.mode ?? "on_load"} onChange={e => set("mode", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="on_load">Countdown on page load (minutes)</option><option value="event">Countdown to specific date/time</option></select></div>{(d.mode ?? "on_load") === "on_load" ? (<div><label className="text-xs text-gray-500 block mb-1">Duration (minutes)</label><Input type="number" value={d.durationMinutes ?? 90} onChange={e => set("durationMinutes", Number(e.target.value))} className="h-8 text-sm" min={1} max={10080} /></div>) : (<div><label className="text-xs text-gray-500 block mb-1">Target Date & Time</label><Input type="datetime-local" value={d.targetDate ?? ""} onChange={e => set("targetDate", e.target.value)} className="h-8 text-sm" /></div>)}<BSColorField data={d} onSet={set} label="Background" field="bgColor" /><BSColorField data={d} onSet={set} label="Text Color" field="textColor" /><BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" /><div className="flex items-center gap-2"><input type="checkbox" checked={d.showBorder ?? true} onChange={e => set("showBorder", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show border</label></div></div>);
    case "alert":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Alert Text" field="text" /><div><label className="text-xs text-gray-500 block mb-1">Alert Type</label><select value={d.alertType ?? "info"} onChange={e => set("alertType", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="info">Info (Blue)</option><option value="success">Success (Green)</option><option value="warning">Warning (Yellow)</option><option value="error">Error (Red)</option></select></div><BSTextField data={d} onSet={set} label="Icon (emoji)" field="icon" placeholder="💡" /></div>);
    case "flip_cards": {
      const cards: Array<{ front: string; back: string }> = d.cards ?? [];
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Section Headline" field="headline" /><BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Cards</label><button onClick={() => set("cards", [...cards, { front: "Card Title", back: "Card description" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{cards.map((card, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Card {i + 1}</span><button onClick={() => set("cards", cards.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><DebouncedInput value={card.front} onChange={v => { const next = cards.map((c, j) => j === i ? { ...c, front: v } : c); set("cards", next); }} className="h-7 text-xs" placeholder="Front (title)" /><DebouncedTextarea value={card.back} onChange={v => { const next = cards.map((c, j) => j === i ? { ...c, back: v } : c); set("cards", next); }} className="text-xs min-h-[60px]" placeholder="Back (description)" /></div>))}</div></div></div>);
    }
    case "pricing_cta":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Headline" field="headline" /><BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline /><BSTextField data={d} onSet={set} label="CTA Button Text" field="ctaText" /><BSColorField data={d} onSet={set} label="CTA Color" field="ctaColor" /><BSColorField data={d} onSet={set} label="CTA Text Color" field="ctaTextColor" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div><label className="text-xs text-gray-500 block mb-1">Button Animation</label><Select value={d.ctaAnimation ?? "none"} onValueChange={v => set("ctaAnimation", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="pulse">Pulse</SelectItem><SelectItem value="bounce">Bounce</SelectItem><SelectItem value="shake">Shake</SelectItem><SelectItem value="glow">Glow</SelectItem></SelectContent></Select></div><div className="flex items-center gap-2"><input type="checkbox" checked={d.showPrice ?? true} onChange={e => set("showPrice", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show course price</label></div><div className="flex items-center gap-2"><input type="checkbox" checked={d.showOriginalPrice ?? false} onChange={e => set("showOriginalPrice", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show strikethrough original price</label></div>{d.showOriginalPrice && <BSTextField data={d} onSet={set} label="Original Price (e.g. 299.00)" field="originalPrice" placeholder="299.00" />}<div className="border-t pt-3 mt-1 space-y-2"><p className="text-xs font-medium text-gray-500">Button Subtext (below button)</p><BSTextField data={d} onSet={set} label="Subtext text" field="buttonSubtext" placeholder="e.g. No credit card required" /><BSLinkField label="Subtext URL (optional)" value={d.buttonSubtextUrl ?? ""} onChange={v => set("buttonSubtextUrl", v)} /><BSColorField data={d} onSet={set} label="Subtext Color" field="buttonSubtextColor" /><div><label className="text-xs text-gray-500 block mb-1">Subtext Size</label><select value={d.buttonSubtextSize ?? "xs"} onChange={e => set("buttonSubtextSize", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="xs">Extra Small (xs)</option><option value="sm">Small (sm)</option><option value="base">Base</option><option value="lg">Large (lg)</option></select></div><div><label className="text-xs text-gray-500 block mb-1">Subtext Style</label><div className="flex gap-2"><button type="button" onClick={() => set("buttonSubtextItalic", !(d.buttonSubtextItalic ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextItalic ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><em>Italic</em></button><button type="button" onClick={() => set("buttonSubtextBold", !(d.buttonSubtextBold ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextBold ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><strong>Bold</strong></button></div></div></div><OptOutSettings d={d} set={set} /></div>);
    case "cta_standalone":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Headline" field="headline" /><BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline /><BSTextField data={d} onSet={set} label="Button Text" field="ctaText" /><BSLinkField label="Button Link" value={d.ctaLink ?? ""} onChange={v => set("ctaLink", v)} /><BSColorField data={d} onSet={set} label="Button Color" field="ctaColor" /><BSColorField data={d} onSet={set} label="Button Text Color" field="ctaTextColor" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div><label className="text-xs text-gray-500 block mb-1">Button Animation</label><Select value={d.ctaAnimation ?? "none"} onValueChange={v => set("ctaAnimation", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="pulse">Pulse</SelectItem><SelectItem value="bounce">Bounce</SelectItem><SelectItem value="shake">Shake</SelectItem><SelectItem value="glow">Glow</SelectItem></SelectContent></Select></div><BSAlignField data={d} onSet={set} label="Text Alignment" field="align" /><div className="border-t pt-3 mt-1 space-y-2"><p className="text-xs font-medium text-gray-500">Button Subtext (below button)</p><BSTextField data={d} onSet={set} label="Subtext text" field="buttonSubtext" placeholder="e.g. No credit card required" /><BSLinkField label="Subtext URL (optional)" value={d.buttonSubtextUrl ?? ""} onChange={v => set("buttonSubtextUrl", v)} /><BSColorField data={d} onSet={set} label="Subtext Color" field="buttonSubtextColor" /><div><label className="text-xs text-gray-500 block mb-1">Subtext Size</label><select value={d.buttonSubtextSize ?? "xs"} onChange={e => set("buttonSubtextSize", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="xs">Extra Small (xs)</option><option value="sm">Small (sm)</option><option value="base">Base</option><option value="lg">Large (lg)</option></select></div><div><label className="text-xs text-gray-500 block mb-1">Subtext Style</label><div className="flex gap-2"><button type="button" onClick={() => set("buttonSubtextItalic", !(d.buttonSubtextItalic ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextItalic ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><em>Italic</em></button><button type="button" onClick={() => set("buttonSubtextBold", !(d.buttonSubtextBold ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextBold ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><strong>Bold</strong></button></div></div></div><OptOutSettings d={d} set={set} /></div>);
    case "lead_capture":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Headline" field="headline" /><BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline /><BSTextField data={d} onSet={set} label="Button Text" field="ctaText" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><BSColorField data={d} onSet={set} label="Text Color" field="textColor" /></div>);
    case "funnel_workflow": {
      const steps: Array<{ name: string; role: string; url: string; cta: string }> = d.steps ?? [];
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Eyebrow" field="eyebrow" />
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline />
          <BSColorField data={d} onSet={set} label="Accent" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Funnel Steps</label>
              <button onClick={() => set("steps", [...steps, { name: "New Step", role: "Describe this step", url: "#", cta: "Open" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="border border-gray-200 rounded p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Step {i + 1}</span>
                    <button onClick={() => set("steps", steps.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button>
                  </div>
                  <DebouncedInput value={step.name} onChange={v => set("steps", steps.map((s, j) => j === i ? { ...s, name: v } : s))} className="h-7 text-xs" placeholder="Step name" />
                  <DebouncedTextarea value={step.role} onChange={v => set("steps", steps.map((s, j) => j === i ? { ...s, role: v } : s))} className="text-xs min-h-[52px]" placeholder="Role in the sales workflow" />
                  <BSLinkField label="Step URL" value={step.url ?? ""} onChange={v => set("steps", steps.map((s, j) => j === i ? { ...s, url: v } : s))} />
                  <DebouncedInput value={step.cta} onChange={v => set("steps", steps.map((s, j) => j === i ? { ...s, cta: v } : s))} className="h-7 text-xs" placeholder="CTA label" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case "product_offer_stack": {
      const products: Array<{ type: "digital" | "physical"; title: string; description: string; price: string; imageUrl?: string; ctaText: string; ctaLink?: string; fulfillment?: string }> = d.products ?? [];
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline />
          <BSColorField data={d} onSet={set} label="Accent" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Promoted Products</label>
              <button onClick={() => set("products", [...products, { type: "digital", title: "New Product", description: "Describe the offer", price: "$0", ctaText: "Add to order", ctaLink: "#checkout", fulfillment: "Delivered after checkout." }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-2">
              {products.map((product, i) => (
                <div key={i} className="border border-gray-200 rounded p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Product {i + 1}</span>
                    <button onClick={() => set("products", products.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button>
                  </div>
                  <select value={product.type} onChange={e => set("products", products.map((p, j) => j === i ? { ...p, type: e.target.value as "digital" | "physical" } : p))} className="w-full h-7 text-xs rounded border border-gray-200 px-2">
                    <option value="digital">Digital item</option>
                    <option value="physical">Physical item</option>
                  </select>
                  <DebouncedInput value={product.title} onChange={v => set("products", products.map((p, j) => j === i ? { ...p, title: v } : p))} className="h-7 text-xs" placeholder="Product title" />
                  <DebouncedTextarea value={product.description} onChange={v => set("products", products.map((p, j) => j === i ? { ...p, description: v } : p))} className="text-xs min-h-[52px]" placeholder="Description" />
                  <div className="grid grid-cols-2 gap-1">
                    <DebouncedInput value={product.price} onChange={v => set("products", products.map((p, j) => j === i ? { ...p, price: v } : p))} className="h-7 text-xs" placeholder="$49" />
                    <DebouncedInput value={product.ctaText} onChange={v => set("products", products.map((p, j) => j === i ? { ...p, ctaText: v } : p))} className="h-7 text-xs" placeholder="CTA" />
                  </div>
                  <BSLinkField label="CTA Link" value={product.ctaLink ?? ""} onChange={v => set("products", products.map((p, j) => j === i ? { ...p, ctaLink: v } : p))} />
                  <DebouncedInput value={product.fulfillment ?? ""} onChange={v => set("products", products.map((p, j) => j === i ? { ...p, fulfillment: v } : p))} className="h-7 text-xs" placeholder="Fulfillment note" />
                  <DebouncedInput value={product.imageUrl ?? ""} onChange={v => set("products", products.map((p, j) => j === i ? { ...p, imageUrl: v } : p))} className="h-7 text-xs" placeholder="Image URL" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case "order_bump_checkout": {
      const features: string[] = d.features ?? [];
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Anchor ID" field="anchorId" placeholder="order-bump" />
          <BSTextField data={d} onSet={set} label="Discount Label" field="discountLabel" />
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subheadline" field="subheadline" />
          <BSTextField data={d} onSet={set} label="Description" field="description" multiline />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bump Product Type</label>
            <select value={d.productType ?? "digital"} onChange={e => set("productType", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="digital">Digital item</option>
              <option value="physical">Physical item</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <BSTextField data={d} onSet={set} label="Price" field="price" />
            <BSTextField data={d} onSet={set} label="Compare At" field="compareAtPrice" />
          </div>
          <BSTextField data={d} onSet={set} label="Checkbox Label" field="checkboxLabel" />
          <BSTextField data={d} onSet={set} label="CTA Text" field="ctaText" />
          <BSTextField data={d} onSet={set} label="Skip Text" field="skipText" />
          <BSTextField data={d} onSet={set} label="Shipping Note" field="shippingNote" />
          <BSTextField data={d} onSet={set} label="Image URL" field="imageUrl" />
          <BSColorField data={d} onSet={set} label="Accent" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Feature Bullets</label>
              <button onClick={() => set("features", [...features, "New benefit"])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-1">
              {features.map((feature, i) => (
                <div key={i} className="flex gap-1">
                  <DebouncedInput value={feature} onChange={v => set("features", features.map((f, j) => j === i ? v : f))} className="h-7 text-xs flex-1" />
                  <button onClick={() => set("features", features.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case "price_stack": {
      const items: Array<{ text: string; price: string }> = d.items ?? [];
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Image URL" field="imageUrl" placeholder="https://..." />
          <BSTextField data={d} onSet={set} label="Headline" field="headline" multiline />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Value Items</label>
              <button onClick={() => set("items", [...items, { text: "New item", price: "($XX)" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <DebouncedInput value={item.text} onChange={v => set("items", items.map((it, j) => j === i ? { ...it, text: v } : it))} className="h-7 text-xs flex-1" placeholder="Item name" />
                  <DebouncedInput value={item.price} onChange={v => set("items", items.map((it, j) => j === i ? { ...it, price: v } : it))} className="h-7 text-xs w-32" placeholder="(Normally $X)" />
                  <button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button>
                </div>
              ))}
            </div>
          </div>
          <BSTextField data={d} onSet={set} label="Total Value Text" field="totalValueText" placeholder="TOTAL VALUE: Over $5000" />
          <BSTextField data={d} onSet={set} label="Original Price (strikethrough)" field="originalPrice" placeholder="NORMALLY $3497" />
          <div className="grid grid-cols-2 gap-2">
            <BSTextField data={d} onSet={set} label="Final Price Label" field="finalPriceLabel" placeholder="Today Only:" />
            <BSTextField data={d} onSet={set} label="Final Price" field="finalPrice" placeholder="$2497" />
          </div>
          <BSTextField data={d} onSet={set} label="CTA Button Text" field="ctaText" />
          <BSLinkField label="CTA Link" value={d.ctaLink ?? ""} onChange={v => set("ctaLink", v)} />
          <BSColorField data={d} onSet={set} label="CTA Color" field="ctaColor" />
          <BSColorField data={d} onSet={set} label="CTA Text Color" field="ctaTextColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
          <BSColorField data={d} onSet={set} label="Border Color" field="borderColor" />
          <div className="flex items-center gap-2"><input type="checkbox" checked={d.showBorder ?? true} onChange={e => set("showBorder", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show border</label></div>
          <OptOutSettings d={d} set={set} />
        </div>
      );
    }
    case "urgency_offer":
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Countdown Headline" field="countdownHeadline" placeholder="LIMITED TIME OFFER!" />
          <div><label className="text-xs text-gray-500 block mb-1">Countdown Mode</label><select value={d.countdownMode ?? "on_load"} onChange={e => set("countdownMode", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="on_load">Countdown on page load (minutes)</option><option value="event">Countdown to specific date/time</option></select></div>
          {(d.countdownMode ?? "on_load") === "on_load" ? (<div><label className="text-xs text-gray-500 block mb-1">Duration (minutes)</label><Input type="number" value={d.countdownMinutes ?? 90} onChange={e => set("countdownMinutes", Number(e.target.value))} className="h-8 text-sm" min={1} max={10080} /></div>) : (<div><label className="text-xs text-gray-500 block mb-1">Target Date & Time</label><Input type="datetime-local" value={d.countdownTargetDate ?? ""} onChange={e => set("countdownTargetDate", e.target.value)} className="h-8 text-sm" /></div>)}
          <BSTextField data={d} onSet={set} label="Headline" field="headline" multiline />
          <BSTextField data={d} onSet={set} label="Description (italic)" field="description" multiline />
          <div><label className="text-xs text-gray-500 block mb-1">Body Content (HTML)</label><RichTextEditor value={d.bodyHtml ?? ""} onChange={(html) => set("bodyHtml", html)} minHeight={100} maxHeight={300} placeholder="Rich text body content..." /></div>
          <div className="grid grid-cols-3 gap-2">
            <BSTextField data={d} onSet={set} label="CTA Emoji" field="ctaEmoji" placeholder="\uD83D\uDC4D" />
            <div className="col-span-2"><BSTextField data={d} onSet={set} label="CTA Text" field="ctaText" placeholder="Add on now for $X" /></div>
          </div>
          <BSLinkField label="CTA Link" value={d.ctaLink ?? ""} onChange={v => set("ctaLink", v)} />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <div className="flex items-center gap-2"><input type="checkbox" checked={d.showBorder ?? true} onChange={e => set("showBorder", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show border</label></div>
          <OptOutSettings d={d} set={set} />
        </div>
      );
    case "checkout_form": {
      const cfProds: Array<{ name: string; description: string; price: number; imageUrl: string; type: string }> = d.products ?? [];
      const cfBumps: Array<{ title: string; headline: string; description: string; price: number; imageUrl: string; ctaText: string; ctaEmoji: string; externalUrl: string }> = d.orderBumps ?? [];
      return (
        <div className="space-y-4">
          {/* Display Mode */}
          <div><label className="text-xs text-gray-500 block mb-1">Display Mode</label><select value={d.displayMode ?? "inline"} onChange={e => set("displayMode", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="inline">Inline (embedded on page)</option><option value="standalone">Standalone Page (/f/slug/checkout)</option></select></div>
          {/* Header */}
          <BSTextField data={d} onSet={set} label="Header Text" field="headerText" placeholder="Lock in your seat now!" />
          <BSTextField data={d} onSet={set} label="Header Price" field="headerPrice" placeholder="$1997" />
          {/* Sections Toggle */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showContactInfo ?? true} onChange={e => set("showContactInfo", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show Contact Info</label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showBillingInfo ?? true} onChange={e => set("showBillingInfo", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show Billing Info</label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showProductSelect ?? true} onChange={e => set("showProductSelect", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show Product Selection</label></div>
          </div>
          {/* Products */}
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700">Products ({cfProds.length})</span><button onClick={() => set("products", [...cfProds, { name: "New Product", description: "", price: 0, imageUrl: "", type: "course" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div>
            {cfProds.map((p, i) => (
              <div key={i} className="border border-gray-100 rounded p-2 space-y-1">
                <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Product {i + 1}</span><button onClick={() => set("products", cfProds.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div>
                <DebouncedInput value={p.name} onChange={v => { const next = [...cfProds]; next[i] = { ...next[i], name: v }; set("products", next); }} className="h-7 text-xs" placeholder="Product name" />
                <DebouncedInput value={p.description} onChange={v => { const next = [...cfProds]; next[i] = { ...next[i], description: v }; set("products", next); }} className="h-7 text-xs" placeholder="Description" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={p.price} onChange={e => { const next = [...cfProds]; next[i] = { ...next[i], price: Number(e.target.value) }; set("products", next); }} className="h-7 text-xs" placeholder="Price (cents)" />
                  <select value={p.type} onChange={e => { const next = [...cfProds]; next[i] = { ...next[i], type: e.target.value }; set("products", next); }} className="h-7 text-xs rounded border border-gray-200 px-2"><option value="course">Course</option><option value="quiz">Quiz</option><option value="product">Product</option><option value="external">External (URL)</option></select>
                </div>
                <DebouncedInput value={p.imageUrl} onChange={v => { const next = [...cfProds]; next[i] = { ...next[i], imageUrl: v }; set("products", next); }} className="h-7 text-xs" placeholder="Image URL (optional)" />
              </div>
            ))}
          </div>
          {/* Order Bumps — with product picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-medium">Order Bumps</label>
              <button onClick={() => set("orderBumps", [...cfBumps, { label: "Add-on offer", price: "", description: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            {cfBumps.map((bump: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded p-2 space-y-1">
                <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Bump {i + 1}</span><button onClick={() => set("orderBumps", cfBumps.filter((_: any, j: number) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div>
                <DebouncedInput value={bump.label ?? ""} onChange={v => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, label: v } : b))} className="h-7 text-xs" placeholder="Offer label" />
                <DebouncedInput value={bump.price ?? ""} onChange={v => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, price: v } : b))} className="h-7 text-xs" placeholder="Price (e.g. $27)" />
                <DebouncedTextarea value={bump.description ?? ""} onChange={v => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, description: v } : b))} className="text-xs min-h-[50px]" placeholder="Short description" />
              </div>
            ))}
          </div>
          {/* Terms & Submit */}
          <BSTextField data={d} onSet={set} label="Terms Text" field="termsText" multiline />
          <div className="grid grid-cols-2 gap-2">
            <BSTextField data={d} onSet={set} label="Terms Link Text" field="termsLinkText" placeholder="TERMS OF SERVICE" />
            <BSTextField data={d} onSet={set} label="Terms Link URL" field="termsLinkUrl" placeholder="/terms" />
          </div>
          <BSTextField data={d} onSet={set} label="Submit Button Text" field="submitText" placeholder="Submit" />
          <BSTextField data={d} onSet={set} label="Success Redirect URL" field="successRedirect" placeholder="/thank-you or https://..." />
          {/* Colors */}
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
        </div>
      );
    }
    case "curriculum_auto":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Section Headline" field="headline" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div className="flex items-center gap-2"><input type="checkbox" checked={d.showLocked ?? true} onChange={e => set("showLocked", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show locked lessons</label></div></div>);
    case "pricing_options_auto":
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Section Headline" field="headline" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <BSColorField data={d} onSet={set} label="CTA Button Color" field="ctaColor" />
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Primary Option Labels</p>
            <div className="space-y-2">
              <BSTextField data={d} onSet={set} label="Primary Card Label" field="primaryLabel" placeholder="Full Access" />
              <BSTextField data={d} onSet={set} label="Primary Card Sublabel" field="primarySublabel" placeholder="One-time payment, lifetime access" />
              <BSTextField data={d} onSet={set} label="Primary CTA Button Text" field="primaryCtaLabel" placeholder="Enroll Now" />
            </div>
          </div>
          <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">Secondary pricing option labels are managed in Course Settings → Pricing Options. Each option's label, sublabel, and CTA text can be set there.</p>
        </div>
      );
    case "related_products":
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Product Type</label>
            <Select value={d.productType ?? "both"} onValueChange={v => set("productType", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Courses &amp; Downloads</SelectItem>
                <SelectItem value="course">Courses Only</SelectItem>
                <SelectItem value="download">Downloads Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Layout</label>
            <div className="flex gap-1">
              {(["grid", "list"] as const).map(l => (
                <button key={l} onClick={() => set("layout", l)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.layout ?? "grid") === l ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Max Items (1–6)</label>
            <Input type="number" value={d.maxItems ?? 3} onChange={e => set("maxItems", Math.min(6, Math.max(1, Number(e.target.value))))} className="h-8 text-sm" min={1} max={6} />
          </div>
          <BSTextField data={d} onSet={set} label="CTA Button Text" field="ctaText" placeholder="Learn More" />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showPrice ?? true} onChange={e => set("showPrice", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show price</label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showDescription ?? true} onChange={e => set("showDescription", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show description</label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.excludeCurrentSlug ?? true} onChange={e => set("excludeCurrentSlug", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Exclude current product</label></div>
          </div>
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Card Background" field="cardBgColor" />
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
        </div>
      );
    case "divider":
      return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Style</label><div className="flex gap-1">{(["solid", "dashed", "dotted"] as const).map(s => <button key={s} onClick={() => set("style", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.style ?? "solid") === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div><BSColorField data={d} onSet={set} label="Color" field="color" /><div><label className="text-xs text-gray-500 block mb-1">Thickness (px)</label><Input type="number" value={d.thickness ?? 1} onChange={e => set("thickness", Number(e.target.value))} className="h-8 text-sm" min={1} max={10} /></div><div><label className="text-xs text-gray-500 block mb-1">Rounding (px)</label><Input type="number" value={d.borderRadius ?? 0} onChange={e => set("borderRadius", Number(e.target.value))} className="h-8 text-sm" min={0} max={20} /></div><div><label className="text-xs text-gray-500 block mb-1">Vertical Spacing (px)</label><Input type="number" value={d.spacing ?? 32} onChange={e => set("spacing", Number(e.target.value))} className="h-8 text-sm" min={0} max={200} /></div></div>);
    case "two_column": {
      const COLUMN_TYPES = [
        { value: "rich_text", label: "Rich Text" },
        { value: "cta", label: "CTA Button" },
        { value: "countdown", label: "Countdown Timer" },
        { value: "contact_form", label: "Contact Form" },
        { value: "image", label: "Image" },
        { value: "video", label: "Video Embed" },
      ];
      const renderColumnSettings = (side: "left" | "right") => {
        const typeKey = `${side}Type`;
        const colType = d[typeKey] ?? "rich_text";
        return (
          <div className="border border-gray-200 rounded p-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-medium capitalize">{side} Column</label>
              <Select value={colType} onValueChange={v => set(typeKey, v)}>
                <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>{COLUMN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {colType === "rich_text" && <RichTextEditor value={d[`${side}Html`] ?? ""} onChange={html => set(`${side}Html`, html)} minHeight={80} maxHeight={250} placeholder={`${side} column content...`} />}
            {colType === "cta" && (<div className="space-y-1">
              <DebouncedInput value={d[`${side}CtaText`] ?? "Click Here"} onChange={v => set(`${side}CtaText`, v)} className="h-7 text-xs" placeholder="Button text" />
              <DebouncedInput value={d[`${side}CtaLink`] ?? ""} onChange={v => set(`${side}CtaLink`, v)} className="h-7 text-xs" placeholder="Button link (URL)" />
              <BSColorField data={d} onSet={set} label="Button Color" field={`${side}CtaColor`} />
              <BSColorField data={d} onSet={set} label="Text Color" field={`${side}CtaTextColor`} />
              <div><label className="text-[10px] text-gray-400">Animation</label><Select value={d[`${side}CtaAnimation`] ?? "none"} onValueChange={v => set(`${side}CtaAnimation`, v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="pulse">Pulse</SelectItem><SelectItem value="bounce">Bounce</SelectItem><SelectItem value="shake">Shake</SelectItem><SelectItem value="glow">Glow</SelectItem></SelectContent></Select></div>
            </div>)}
            {colType === "countdown" && (<div className="space-y-1">
              <DebouncedInput value={d[`${side}CountdownMinutes`] ?? "60"} onChange={v => set(`${side}CountdownMinutes`, v)} className="h-7 text-xs" placeholder="Minutes" />
              <DebouncedInput value={d[`${side}CountdownHeadline`] ?? ""} onChange={v => set(`${side}CountdownHeadline`, v)} className="h-7 text-xs" placeholder="Headline above timer" />
              <BSColorField data={d} onSet={set} label="Accent Color" field={`${side}CountdownColor`} />
            </div>)}
            {colType === "contact_form" && (<div className="space-y-1">
              <DebouncedInput value={d[`${side}FormHeadline`] ?? "Get in Touch"} onChange={v => set(`${side}FormHeadline`, v)} className="h-7 text-xs" placeholder="Form headline" />
              <DebouncedInput value={d[`${side}FormFields`] ?? "name,email,message"} onChange={v => set(`${side}FormFields`, v)} className="h-7 text-xs" placeholder="Fields (comma-separated)" />
              <BSColorField data={d} onSet={set} label="Submit Color" field={`${side}FormBtnColor`} />
            </div>)}
            {colType === "image" && (<div className="space-y-1">
              <DebouncedInput value={d[`${side}ImageUrl`] ?? ""} onChange={v => set(`${side}ImageUrl`, v)} className="h-7 text-xs" placeholder="Image URL" />
              <DebouncedInput value={d[`${side}ImageAlt`] ?? ""} onChange={v => set(`${side}ImageAlt`, v)} className="h-7 text-xs" placeholder="Alt text" />
            </div>)}
            {colType === "video" && (<div className="space-y-1">
              <DebouncedInput value={d[`${side}VideoUrl`] ?? ""} onChange={v => set(`${side}VideoUrl`, v)} className="h-7 text-xs" placeholder="YouTube or embed URL" />
            </div>)}
          </div>
        );
      };
      return (<div className="space-y-3">
        {renderColumnSettings("left")}
        {renderColumnSettings("right")}
        <div><label className="text-xs text-gray-500 block mb-1">Left Column Width (%)</label><Input type="number" value={d.leftRatio ?? 50} onChange={e => set("leftRatio", Number(e.target.value))} className="h-8 text-sm" min={20} max={80} /></div>
        <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
      </div>);
    }
    case "divided_columns": {
      const cols: Array<{ html: string }> = d.columns ?? [{ html: "" }, { html: "" }];
      return (<div className="space-y-3"><div className="flex items-center justify-between"><label className="text-xs text-gray-500 font-medium">Columns ({cols.length})</label>{cols.length < 4 && <button onClick={() => set("columns", [...cols, { html: "<p>New column</p>" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add Column</button>}</div>{cols.map((col, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Column {i + 1}</span>{cols.length > 2 && <button onClick={() => set("columns", cols.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button>}</div><RichTextEditor value={col.html ?? ""} onChange={(html) => { const next = cols.map((c, j) => j === i ? { ...c, html } : c); set("columns", next); }} minHeight={80} maxHeight={250} placeholder={`Column ${i + 1} content...`} /></div>))}<div><label className="text-xs text-gray-500 block mb-1">Gap (px)</label><Input type="number" value={d.gap ?? 32} onChange={e => set("gap", Number(e.target.value))} className="h-8 text-sm" min={0} max={80} /></div><BSColorField data={d} onSet={set} label="Background" field="bgColor" /></div>);
    }
    case "three_column":
      return (<div className="space-y-3">
        <div><label className="text-xs text-gray-500 font-medium block mb-1">Column 1</label><RichTextEditor value={d.col1Html ?? ""} onChange={html => set("col1Html", html)} minHeight={80} maxHeight={200} placeholder="Column 1 content..." /></div>
        <div><label className="text-xs text-gray-500 font-medium block mb-1">Column 2</label><RichTextEditor value={d.col2Html ?? ""} onChange={html => set("col2Html", html)} minHeight={80} maxHeight={200} placeholder="Column 2 content..." /></div>
        <div><label className="text-xs text-gray-500 font-medium block mb-1">Column 3</label><RichTextEditor value={d.col3Html ?? ""} onChange={html => set("col3Html", html)} minHeight={80} maxHeight={200} placeholder="Column 3 content..." /></div>
        <div className="border-t pt-3 mt-3">
          <label className="text-xs text-gray-500 font-medium flex items-center gap-2"><input type="checkbox" checked={!!d.showDividers} onChange={e => set("showDividers", e.target.checked)} className="rounded" /> Show Vertical Dividers</label>
        </div>
        {d.showDividers && (<div className="space-y-2 pl-4 border-l-2 border-teal-100">
          <div className="flex items-center gap-2"><label className="text-xs text-gray-400 w-14">Color</label><input type="color" value={d.dividerColor ?? "#e5e7eb"} onChange={e => set("dividerColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border" /><DebouncedInput value={d.dividerColor ?? "#e5e7eb"} onChange={v => set("dividerColor", v)} className="h-7 text-xs flex-1" /></div>
          <div className="flex items-center gap-2"><label className="text-xs text-gray-400 w-14">Style</label><div className="flex gap-1">{(["solid", "dashed", "dotted"] as const).map(s => <button key={s} onClick={() => set("dividerStyle", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${d.dividerStyle === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div>
          <div><label className="text-xs text-gray-400 block mb-0.5">Width (px)</label><Input type="number" value={d.dividerWidth ?? 1} onChange={e => set("dividerWidth", Number(e.target.value))} className="h-7 text-xs" min={1} max={10} /></div>
          <div><label className="text-xs text-gray-400 block mb-0.5">Rounding (px)</label><Input type="number" value={d.dividerRadius ?? 0} onChange={e => set("dividerRadius", Number(e.target.value))} className="h-7 text-xs" min={0} max={20} /></div>
        </div>)}
        <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
      </div>);
    case "spacer":
      return (<div><label className="text-xs text-gray-500 block mb-1">Height (px)</label><Input type="number" value={d.height ?? 48} onChange={e => set("height", Number(e.target.value))} className="h-8 text-sm" min={8} max={400} /></div>);
    case "logo_strip":
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Logo URL</label>
            <div className="flex items-center gap-2">
              <DebouncedInput value={d.logoUrl ?? ""} onChange={v => set("logoUrl", v)} className="h-8 text-sm flex-1" placeholder="Logo image URL or upload" />
              <button onClick={() => bgImageRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "logoUrl"}>{uploading === "logoUrl" ? "..." : <><Upload size={12} /> Upload</>}</button>
              <input ref={bgImageRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "logoUrl", "logo-strip"); e.target.value = ""; }} />
            </div>
            {d.logoUrl && <img src={d.logoUrl} className="w-full h-12 object-contain rounded border mt-1" />}
          </div>
          <BSTextField data={d} onSet={set} label="Link URL" field="link" placeholder="/ or https://..." />
          <BSTextField data={d} onSet={set} label="Max Width" field="maxWidth" placeholder="200px" />
          <BSTextField data={d} onSet={set} label="Padding" field="padding" placeholder="16px 0" />
          <BSAlignField data={d} onSet={set} label="Text Alignment" field="align" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
        </div>
      );
    case "footer": {
      const footerLinks: Array<{ text: string; url: string }> = d.links ?? [];
      const socialLinks = d.socialLinks ?? {};
      return (
        <div className="space-y-3">
          {/* Logo */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Footer Logo URL</label>
            <div className="flex items-center gap-2">
              <DebouncedInput value={d.logoUrl ?? ""} onChange={v => set("logoUrl", v)} className="h-8 text-sm flex-1" placeholder="Logo URL or upload" />
              <button onClick={() => inlineMediaRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "logoUrl"}>{uploading === "logoUrl" ? "..." : <><Upload size={12} /> Upload</>}</button>
              <input ref={inlineMediaRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "logoUrl", "footer-logo"); e.target.value = ""; }} />
            </div>
            {d.logoUrl && <img src={d.logoUrl} className="w-full h-10 object-contain rounded border mt-1" />}
          </div>
          <BSTextField data={d} onSet={set} label="Logo Max Width" field="logoMaxWidth" placeholder="120px" />
          {/* Copyright */}
          <BSTextField data={d} onSet={set} label="Copyright Text" field="copyrightText" placeholder="\u00a9 2026 Company. All rights reserved." />
          {/* Links */}
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700">Links ({footerLinks.length})</span><button onClick={() => set("links", [...footerLinks, { text: "New Link", url: "/" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div>
            {footerLinks.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <DebouncedInput value={l.text} onChange={v => { const next = [...footerLinks]; next[i] = { ...next[i], text: v }; set("links", next); }} className="h-7 text-xs flex-1" placeholder="Label" />
                <DebouncedInput value={l.url} onChange={v => { const next = [...footerLinks]; next[i] = { ...next[i], url: v }; set("links", next); }} className="h-7 text-xs flex-1" placeholder="URL" />
                <button onClick={() => set("links", footerLinks.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button>
              </div>
            ))}
          </div>
          {/* Social Links */}
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1"><input type="checkbox" checked={d.showSocial ?? true} onChange={e => set("showSocial", e.target.checked)} className="rounded" /><label className="text-xs font-semibold text-gray-700">Social Links</label></div>
            {d.showSocial && (
              <div className="space-y-1">
                <DebouncedInput value={socialLinks.facebook ?? ""} onChange={v => set("socialLinks", { ...socialLinks, facebook: v })} className="h-7 text-xs" placeholder="Facebook URL" />
                <DebouncedInput value={socialLinks.instagram ?? ""} onChange={v => set("socialLinks", { ...socialLinks, instagram: v })} className="h-7 text-xs" placeholder="Instagram URL" />
                <DebouncedInput value={socialLinks.youtube ?? ""} onChange={v => set("socialLinks", { ...socialLinks, youtube: v })} className="h-7 text-xs" placeholder="YouTube URL" />
                <DebouncedInput value={socialLinks.linkedin ?? ""} onChange={v => set("socialLinks", { ...socialLinks, linkedin: v })} className="h-7 text-xs" placeholder="LinkedIn URL" />
              </div>
            )}
          </div>
          {/* Colors */}
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
        </div>
      );
    }
     default:
      return <p className="text-xs text-gray-400">No settings for this block type.</p>;
  } })();
  return (
    <div className="space-y-4">
      {blockSpecific}
      {/* ─── Global Spacing Controls ─── */}
      <div className="border-t border-gray-200 pt-3 mt-3">
        <p className="text-xs font-medium text-gray-500 mb-2">Spacing</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[10px] text-gray-400 block">Margin Top</label><DebouncedInput value={d.marginTop ?? ""} onChange={v => set("marginTop", v)} className="h-7 text-xs" placeholder="0px" /></div>
          <div><label className="text-[10px] text-gray-400 block">Margin Bottom</label><DebouncedInput value={d.marginBottom ?? ""} onChange={v => set("marginBottom", v)} className="h-7 text-xs" placeholder="0px" /></div>
          <div><label className="text-[10px] text-gray-400 block">Padding Top</label><DebouncedInput value={d.paddingTop ?? ""} onChange={v => set("paddingTop", v)} className="h-7 text-xs" placeholder="" /></div>
          <div><label className="text-[10px] text-gray-400 block">Padding Bottom</label><DebouncedInput value={d.paddingBottom ?? ""} onChange={v => set("paddingBottom", v)} className="h-7 text-xs" placeholder="" /></div>
          <div><label className="text-[10px] text-gray-400 block">Padding Left</label><DebouncedInput value={d.paddingLeft ?? ""} onChange={v => set("paddingLeft", v)} className="h-7 text-xs" placeholder="" /></div>
          <div><label className="text-[10px] text-gray-400 block">Padding Right</label><DebouncedInput value={d.paddingRight ?? ""} onChange={v => set("paddingRight", v)} className="h-7 text-xs" placeholder="" /></div>
        </div>
      </div>
    </div>
  );
}
// ─── Sortable Block Card ──────────────────────────────────────────────────────

export function SortableBlock({ block, isSelected, onSelect, onDelete, onDuplicate, onMoveUp, onMoveDown, coursePrice, courseTitle }: {
  block: Block; isSelected: boolean; onSelect: () => void; onDelete: () => void; onDuplicate: () => void; onMoveUp?: () => void; onMoveDown?: () => void; coursePrice?: number; courseTitle?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} onClick={onSelect} data-block-id={block.id}
      className={`relative group cursor-pointer border-2 transition-all ${isSelected ? "border-teal-500 shadow-lg shadow-teal-100" : "border-transparent hover:border-teal-200"}`}>
      <div className={`absolute top-2 right-2 z-10 flex gap-1 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-teal-600 flex items-center justify-center" title="Duplicate"><Copy size={12} /></button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-red-500 flex items-center justify-center" title="Delete"><Trash2 size={12} /></button>
      </div>
      {/* Up/Down arrow buttons */}
      <div className={`absolute top-2 left-10 z-10 flex flex-col gap-0.5 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
        <button disabled={!onMoveUp} onClick={e => { e.stopPropagation(); onMoveUp?.(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-teal-600 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" title="Move up"><ChevronUp size={12} /></button>
        <button disabled={!onMoveDown} onClick={e => { e.stopPropagation(); onMoveDown?.(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-teal-600 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" title="Move down"><ChevronDown size={12} /></button>
      </div>
      <div {...attributes} {...listeners} onClick={e => e.stopPropagation()}
        className={`absolute top-2 left-2 z-10 w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-gray-600 flex items-center justify-center cursor-grab active:cursor-grabbing ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
        title="Drag to reorder"><GripVertical size={14} /></div>
      <div style={{ marginTop: block.data.marginTop ? `${block.data.marginTop}px` : undefined, marginBottom: block.data.marginBottom ? `${block.data.marginBottom}px` : undefined, paddingTop: block.data.paddingTop ? `${block.data.paddingTop}px` : undefined, paddingBottom: block.data.paddingBottom ? `${block.data.paddingBottom}px` : undefined, paddingLeft: block.data.paddingLeft ? `${block.data.paddingLeft}px` : undefined, paddingRight: block.data.paddingRight ? `${block.data.paddingRight}px` : undefined }}>
        <BlockPreview block={block} coursePrice={coursePrice} courseTitle={courseTitle} />
      </div>
    </div>
  );
}

// ─── Template Library Panel ───────────────────────────────────────────────────

function TemplateLibrary({ blocks, onInsert, onClose }: {
  blocks: Block[];
  onInsert: (tplBlocks: Block[]) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"page" | "block">("page");
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: templates, refetch } = trpc.lmsAdmin.listPageTemplates.useQuery({ templateType: tab });
  const saveMutation = trpc.lmsAdmin.savePageTemplate.useMutation({
    onSuccess: () => { toast.success("Template saved!"); setSaveName(""); setSaveDesc(""); refetch(); },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });
  const deleteMutation = trpc.lmsAdmin.deletePageTemplate.useMutation({
    onSuccess: () => { toast.success("Template deleted"); refetch(); },
    onError: (e: any) => toast.error(`Delete failed: ${e.message}`),
  });

  const handleSave = async () => {
    if (!saveName.trim()) { toast.error("Please enter a template name"); return; }
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync({ name: saveName, description: saveDesc, templateType: tab, blocks });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-[680px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><FolderOpen size={18} className="text-teal-600" /> Template Library</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex border-b border-gray-100">
          {(["page", "block"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? "border-b-2 border-teal-600 text-teal-700" : "text-gray-500 hover:text-gray-700"}`}>{t === "page" ? "Full Page Templates" : "Block Templates"}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Built-in sales funnel templates */}
          {tab === "page" && (
            <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/70">
              <p className="text-xs font-semibold text-amber-700 mb-3">Built-in Sales Funnel Templates</p>
              <div className="space-y-2">
                {FUNNEL_TEMPLATES.map((template, index) => (
                  <div key={template.name} className="bg-white border border-amber-100 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 text-sm">{template.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                    <Button onClick={() => { onInsert(getFunnelTemplateBlocks(index)); onClose(); }} className="mt-3 h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                      Insert funnel page
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Save current page as template */}
          <div className="border border-dashed border-teal-300 rounded-xl p-4 bg-teal-50/50">
            <p className="text-xs font-semibold text-teal-700 mb-3">Save Current {tab === "page" ? "Page" : "Selection"} as Template</p>
            <div className="space-y-2">
              <DebouncedInput value={saveName} onChange={v => setSaveName(v)} className="h-8 text-sm" placeholder="Template name..." />
              <DebouncedInput value={saveDesc} onChange={v => setSaveDesc(v)} className="h-8 text-sm" placeholder="Description (optional)" />
              <Button onClick={handleSave} disabled={isSaving} className="w-full h-8 text-sm bg-teal-600 hover:bg-teal-700 text-white">
                {isSaving ? "Saving…" : "Save as Template"}
              </Button>
            </div>
          </div>
          {/* Template list */}
          {!templates || templates.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No {tab} templates saved yet</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {templates.map((tpl: any) => (
                <div key={tpl.id} className="border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{tpl.name}</h3>
                  {tpl.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{tpl.description}</p>}
                  <p className="text-xs text-gray-400 mb-3">{Array.isArray(tpl.blocks) ? tpl.blocks.length : 0} block{Array.isArray(tpl.blocks) && tpl.blocks.length !== 1 ? "s" : ""}</p>
                  <div className="flex gap-2">
                    <Button onClick={() => { const tplBlocks = (Array.isArray(tpl.blocks) ? tpl.blocks : []).map((b: Block) => ({ ...b, id: uid() })); onInsert(tplBlocks); onClose(); }} className="flex-1 h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white">Insert</Button>
                    <button onClick={() => deleteMutation.mutate({ id: tpl.id })} className="w-7 h-7 border border-gray-200 rounded text-gray-400 hover:text-red-500 flex items-center justify-center flex-shrink-0"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export default function LandingPageBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const [, navigate] = useLocation();
  const numericCourseId = Number(courseId);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [courseInfo, setCourseInfo] = useState<{ title: string; slug: string; price?: number } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
   const [activeCat, setActiveCat] = useState<string>("Layout");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Auto-scroll preview canvas to the selected block
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  const { isLoading, data: lpData } = trpc.lmsAdmin.getLandingPageBlocks.useQuery(
    { courseId: numericCourseId },
    { enabled: !isNaN(numericCourseId) }
  );

  if (lpData && !hasLoaded) {
    setHasLoaded(true);
    setCourseInfo({ title: lpData.courseTitle, slug: lpData.courseSlug, price: lpData.coursePrice });
    if (lpData.blocks && lpData.blocks.length > 0) {
      setBlocks(lpData.blocks as Block[]);
    } else {
      setBlocks([
        { id: uid(), type: "hero", data: { headline: lpData.heroTitle || lpData.courseTitle || "Your Course Title", subheadline: lpData.heroSubtitle || "", bgType: "color", bgColor: "#179ca3", textColor: "#ffffff", align: "left", buttons: [{ text: lpData.ctaText || "Enroll Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }] } },
        { id: uid(), type: "bullets", data: { headline: "What You'll Learn", items: ["Key skill or concept one", "Key skill or concept two", "Key skill or concept three"], iconColor: "#179ca3", bgColor: "#f8fffe" } },
        { id: uid(), type: "pricing_cta", data: { headline: "Ready to Get Started?", subtext: "Join thousands of sonographers improving their skills.", ctaText: lpData.ctaText || "Enroll Now", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true } },
      ]);
    }
  }

  const saveBlocks = trpc.lmsAdmin.saveLandingPageBlocks.useMutation({
    onSuccess: () => toast.success("Landing page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try { await saveBlocks.mutateAsync({ courseId: numericCourseId, blocks }); }
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

  const insertTemplateBlocks = useCallback((tplBlocks: Block[]) => {
    setBlocks(prev => [...prev, ...tplBlocks]);
  }, []);

  const selectedBlock = blocks.find(b => b.id === selectedId);
  const catalogByCat = BLOCK_CATALOG.filter(c => c.category === activeCat);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/admin/lms?editCourse=${courseId}`)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 font-medium transition-colors">
            <ArrowLeft size={16} /> Back to Course
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">{courseInfo?.title ?? "Landing Page Builder"}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Page Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
            <FolderOpen size={14} /> Templates
          </button>
          {courseInfo?.slug && (
            <a href={`/learn/${courseInfo.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
              <Eye size={14} /> Preview
            </a>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-1.5 h-8">
            <Save size={14} /> {isSaving ? "Saving…" : "Save Page"}
          </Button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Block Catalog (categorized) */}
        <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">Add Blocks</p>
            <div className="flex flex-col gap-0.5">
              {CATALOG_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)} className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors ${activeCat === cat ? "bg-teal-50 text-teal-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}>{cat}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {catalogByCat.map(item => (
              <button key={item.type} onClick={() => addBlock(item.type)} className="w-full flex items-center gap-2 px-2 py-2 text-xs text-gray-700 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-colors text-left">
                <span className="text-gray-400 flex-shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center"><Plus size={24} /></div>
              <p className="text-sm">Click a block type on the left to get started</p>
              <button onClick={() => setShowTemplates(true)} className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1.5"><FolderOpen size={16} /> Or start from a template</button>
            </div>
          ) : (
            <div className="bg-white min-h-full shadow-sm mx-auto" style={{ maxWidth: "900px" }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <SortableBlock key={block.id} block={block} isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)} onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)} coursePrice={courseInfo?.price} courseTitle={courseInfo?.title}
                      onMoveUp={idx > 0 ? () => setBlocks(prev => arrayMove(prev, idx, idx - 1)) : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => setBlocks(prev => arrayMove(prev, idx, idx + 1)) : undefined} />
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex justify-center py-6 border-t border-dashed border-gray-200">
                <button onClick={() => addBlock("text")} className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600 transition-colors">
                  <Plus size={16} /> Add a block
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Block Settings */}
        <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
          {selectedBlock ? (
            <>
              <div className="flex items-center justify-between p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {BLOCK_CATALOG.find(c => c.type === selectedBlock.type)?.label ?? "Block"} Settings
                </p>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
              <div className="p-3">
                <BlockSettings block={selectedBlock} onChange={(data) => updateBlock(selectedBlock.id, data)} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
              <Palette size={24} className="mb-2 opacity-50" />
              <p className="text-sm">Click any block on the canvas to edit its settings</p>
            </div>
          )}
        </div>
      </div>

      {/* Template Library Modal */}
      {showTemplates && (
        <TemplateLibrary blocks={blocks} onInsert={insertTemplateBlocks} onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}
