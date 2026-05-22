/**
 * LandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG landing page editor.
 * Route: /admin/lms/:courseId/landing-builder
 * Supports 25+ block types + Template Library (save/reuse pages and blocks).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  DndContext,
  closestCenter,
  closestCorners,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  useDroppable,
  UniqueIdentifier,
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
  ArrowLeft, ArrowRight, Save, Eye, Plus, Trash2, GripVertical, Type, Image, Video,
  List, Quote, CreditCard, Minus, Columns, X, Palette, AlignLeft,
  AlignCenter, AlignRight, HelpCircle, Users, Star, Globe, Timer,
  AlertTriangle, CheckSquare, LayoutGrid, Layers, BookOpen, Tag,
  ChevronDown, ChevronUp, Copy, FolderOpen, BookMarked, Upload, Code,
  ShoppingCart, Package, Link, Mail, Phone, MapPin, Bookmark, Music, UserPlus, Search,
} from "lucide-react";
import AudioBlockEditor from "@/components/AudioBlockEditor";
import LessonQuizBlockEditor from "@/components/LessonQuizBlockEditor";
import LessonFlashcardBlockEditor from "@/components/LessonFlashcardBlockEditor";
import { BlockTemplateLibraryProvider, OpenTemplateLibraryButton, SaveAsTemplateButton } from "@/components/BlockTemplateLibrary";


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
      hideButtons: true,
      buttons: [{ text: "Enroll Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled", behavior: "url" }],
    },
  },
  { type: "two_column", label: "Two Columns", icon: <Columns size={14} />, category: "Layout",
    defaultData: { leftType: "rich_text", rightType: "rich_text", leftHtml: "<p>Left column content</p>", rightHtml: "<p>Right column content</p>", leftRatio: 50, bgColor: "#ffffff" } },
  { type: "column_layout", label: "Column Layout (Blocks)", icon: <Columns size={14} />, category: "Layout",
    defaultData: { leftBlocks: [], rightBlocks: [], leftRatio: 50, gap: 32, bgColor: "transparent", paddingX: 32, paddingY: 16 } },
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
    defaultData: { embedUrl: "", caption: "", autoplay: false, muted: true, loop: false, controls: true, trimStart: 0, trimEnd: 0 } },
  { type: "audio", label: "Audio Player", icon: <Music size={14} />, category: "Content",
    defaultData: { audioUrl: "", title: "", caption: "", autoplay: false, muted: false, loop: false, controls: true, trimStart: 0, trimEnd: 0, bgColor: "#f8fffe" } },
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
    defaultData: { headline: "Get a Free Preview", subtext: "Enter your email to get instant access.", ctaText: "Send Me Access", bgColor: "#179ca3", textColor: "#ffffff",
      showNameField: true, namePlaceholder: "Your name (optional)", emailPlaceholder: "Your email address",
      inputBg: "rgba(255,255,255,0.15)", inputBorderColor: "rgba(255,255,255,0.4)", inputTextColor: "#ffffff", inputPlaceholderColor: "rgba(255,255,255,0.7)", inputBorderRadius: 8,
      btnStyle: "filled", btnBg: "#ffffff", btnTextColor: "#179ca3", btnBorderColor: "#ffffff",
      btnBehavior: "none", btnUrl: "", btnCampaignId: null, btnNextStep: false } },
  { type: "cta_optin", label: "CTA with Opt-In", icon: <UserPlus size={14} />, category: "Conversion",
    defaultData: { headline: "Start Learning Today", subtext: "Enter your details to get instant access.", ctaText: "Get Access", ctaLink: "", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#f0fafa", align: "center", namePlaceholder: "Your name", emailPlaceholder: "Your email address", tags: "",
      optOutEnabled: false, optOutText: "No thanks", optOutLinkType: "custom", optOutCourseId: null, optOutDownloadId: null, optOutCustomUrl: "" } },
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
  { type: "inline_checkout", label: "Inline Checkout (Stripe)", icon: <CreditCard size={14} />, category: "Funnel",
    defaultData: {
      headerText: "🔒 Lock in your seat now!",
      headerPrice: "$997",
      accentColor: "#179ca3",
      bgColor: "#f9fafb",
      textColor: "#0e1e2e",
      showContactInfo: true,
      showBillingInfo: false,
      collectShipping: false,
      showProductSelect: true,
      products: [
        { name: "Product Name", description: "Full online access", price: 99700, imageUrl: "", type: "course" }
      ],
      orderBumps: [],
      submitText: "Submit",
      submitIcon: "none",
      successRedirect: "",
      termsText: "I attest that I meet the pre-requisites for this course and I agree to the",
      termsLinkText: "TERMS OF SERVICE",
      termsLinkUrl: "https://www.allaboutultrasound.com/terms-of-service.html",
      sourceType: "landing_page",
    } },
  { type: "embedded_checkout", label: "Embedded Checkout (Legacy)", icon: <CreditCard size={14} />, category: "Funnel",
    defaultData: {
      headerText: "Complete Your Order",
      headerSubtext: "Secure checkout powered by Stripe",
      accentColor: "#179ca3",
      bgColor: "#f9fafb",
      textColor: "#111827",
      showContactInfo: true,
      collectShipping: false,
      collectBilling: false,
      products: [
        { name: "Product Name", description: "Product description", price: 9700, imageUrl: "", type: "other" }
      ],
      orderBumps: [],
      submitText: "Complete Purchase",
      submitIcon: "none",
      successRedirect: "",
      successMessage: "Thank you for your purchase! You'll receive a confirmation email shortly.",
      termsText: "",
      termsLinkText: "Terms of Service",
      termsLinkUrl: "https://www.allaboutultrasound.com/terms-of-service.html",
    } },
  { type: "checkout_form", label: "Checkout Form (Legacy)", icon: <CreditCard size={14} />, category: "Funnel",
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
      termsLinkUrl: "https://www.allaboutultrasound.com/terms-of-service.html",
      submitText: "Submit",
      submitIcon: "none",
      successRedirect: "",
    } },
  // ── Layout extras
  { type: "logo_strip", label: "Logo / Brand", icon: <Image size={14} />, category: "Layout",
    defaultData: { logoUrl: "", maxWidth: "200px", align: "center", link: "/", bgColor: "#ffffff", padding: "16px 0" } },
  { type: "footer", label: "Footer", icon: <Columns size={14} />, category: "Layout",
    defaultData: {
      bgColor: "#0e1e2e", textColor: "#ffffff", align: "center",
      copyrightText: "© 2026 All About Ultrasound. All rights reserved.",
      links: [{ text: "Privacy Policy", url: "/privacy" }, { text: "Terms of Service", url: "https://www.allaboutultrasound.com/terms-of-service.html" }, { text: "Contact", url: "/contact" }],
      showSocial: true, socialLinks: { facebook: "", instagram: "", youtube: "", linkedin: "" },
      logoUrl: "", logoMaxWidth: "120px",
    } },
  // ── Smart Sections
  { type: "curriculum_auto", label: "Curriculum (Auto)", icon: <BookOpen size={14} />, category: "Smart",
    defaultData: { headline: "Course Curriculum", headlineColor: "#111827", bgColor: "#ffffff", showLocked: true,
      sectionBgColor: "#f9fafb", sectionTextColor: "#1f2937", sectionBorderColor: "#e5e7eb",
      lessonTextColor: "#374151", lessonLockedIconColor: "#d1d5db", lessonPreviewIconColor: "#14b8a6",
      lessonCountColor: "#9ca3af", iconStyle: "lock", cornerRadius: 12 } },
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
  // ── File Downloads
  { type: "file_download", label: "File Download", icon: <Upload size={14} />, category: "Content",
    defaultData: {
      // source: "upload" uses fileUrl/fileName directly; source: "media_repo" uses mediaAssetId
      source: "upload",
      fileUrl: "",
      fileName: "",
      mediaAssetId: null,
      mediaAssetTitle: "",
      mediaAssetUrl: "",
      label: "Download File",
      description: "",
      // displayMode: "card" = styled download button/card; "inline" = native browser renderer (PDF, image, video)
      displayMode: "card",
      buttonText: "Download",
      buttonColor: "#179ca3",
      buttonTextColor: "#ffffff",
      bgColor: "#f8fffe",
      showIcon: true,
      showFileSize: true,
      fileSize: "",
      // inline mode options
      inlineHeight: 600,
    } },
];

export const CATALOG_CATEGORIES = ["Layout", "Content", "Marketing", "Conversion", "Funnel", "Smart"];

// Lesson interactive blocks (quiz + flashcard) — added to Content category
BLOCK_CATALOG.push(
  { type: "lesson_quiz", label: "Lesson Quiz", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>, category: "Content", defaultData: { title: "Knowledge Check", questions: [], showExplanations: true, passingScore: 70, shuffleQuestions: false } },
  { type: "lesson_flashcard", label: "Flashcard Deck", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, category: "Content", defaultData: { title: "Review Flashcards", cards: [], shuffleCards: true, showHints: true } },
  { type: "scorm_embed", label: "SCORM / HTML Package", icon: <Package size={14} />, category: "Content",
    defaultData: { mediaAssetId: null, mediaAssetSlug: "", mediaAssetTitle: "", title: "", caption: "", height: 600, bgColor: "#ffffff" } },
  { type: "url_embed", label: "URL / iFrame Embed", icon: <Globe size={14} />, category: "Content",
    defaultData: { url: "", title: "", caption: "", height: 600, bgColor: "#ffffff" } },
);

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

function BSSelectField({ data, onSet, label, field, options }: {
  data: Record<string, any>; onSet: (key: string, val: any) => void;
  label: string; field: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <Select value={data[field] ?? "none"} onValueChange={v => onSet(field, v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const SUBMIT_ICON_OPTIONS = [
  { value: "none", label: "None" },
  { value: "lock", label: "🔒 Lock" },
  { value: "shield", label: "🛡 Shield" },
  { value: "shopping-cart", label: "🛒 Shopping Cart" },
  { value: "shopping-bag", label: "🛍 Shopping Bag" },
  { value: "credit-card", label: "💳 Credit Card" },
  { value: "zap", label: "⚡ Zap" },
  { value: "star", label: "⭐ Star" },
  { value: "heart", label: "❤ Heart" },
  { value: "gift", label: "🎁 Gift" },
  { value: "award", label: "🏆 Award" },
  { value: "arrow-right", label: "→ Arrow Right" },
  { value: "sparkles", label: "✨ Sparkles" },
  { value: "rocket", label: "🚀 Rocket" },
  { value: "badge-check", label: "✅ Badge Check" },
];

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

function PricingCtaSettings({ d, set }: { d: Record<string, any>; set: (key: string, val: any) => void }) {
  const { data: coursesData } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", type: "all", pageSize: 100 });
  const allItems = (coursesData?.courses ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    type: c.type as string,
    slug: c.slug,
    price: c.isFree ? 0 : (c.price ?? 0),
    isFree: c.isFree,
  }));
  const priceSource = d.priceSource ?? "manual";
  const selectedItemId = d.linkedItemId ? Number(d.linkedItemId) : null;
  const selectedItem = allItems.find((i: any) => i.id === selectedItemId);

  const handleItemSelect = (idStr: string) => {
    if (!idStr || idStr === "none") {
      set("linkedItemId", null);
      set("linkedItemType", null);
      set("linkedItemSlug", null);
      return;
    }
    const item = allItems.find((i: any) => i.id === Number(idStr));
    if (!item) return;
    set("linkedItemId", item.id);
    set("linkedItemType", item.type);
    set("linkedItemSlug", item.slug);
    const urlMap: Record<string, string> = { course: `/learn/${item.slug}`, quiz: `/learn/${item.slug}`, download: `/downloads/${item.slug}`, bundle: `/bundles/${item.slug}`, product: `/products/${item.slug}` };
    set("ctaUrl", urlMap[item.type] ?? `/learn/${item.slug}`);
    if (item.isFree) {
      set("currentPrice", "Free");
    } else if (item.price > 0) {
      set("currentPrice", `$${(item.price / 100).toFixed(0)}`);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">CTA Button URL</label>
        <DebouncedInput value={d.ctaUrl ?? ""} onChange={v => set("ctaUrl", v)} className="h-8 text-xs" placeholder="https://... or /learn/course-slug" />
        <p className="text-[10px] text-gray-400 mt-0.5">Any URL — external site, internal page, checkout, booking link, etc.</p>
      </div>
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-600">Pricing Display</p>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="showPriceToggle" checked={d.showPrice ?? false} onChange={e => set("showPrice", e.target.checked)} className="rounded" />
            <label htmlFor="showPriceToggle" className="text-xs text-gray-600">Show price</label>
          </div>
        </div>
        {(d.showPrice ?? false) && (
          <>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Price Source</label>
              <Select value={priceSource} onValueChange={v => set("priceSource", v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual entry</SelectItem>
                  <SelectItem value="item">Link to item (course / download / quiz)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {priceSource === "item" && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Select Item</label>
                <Select value={selectedItemId ? String(selectedItemId) : "none"} onValueChange={handleItemSelect}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Choose item…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {allItems.map((item: any) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        [{item.type}] {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedItem && (
                  <p className="text-xs text-teal-600 mt-1">
                    {(selectedItem as any).isFree ? "Free" : `$${((selectedItem as any).price / 100).toFixed(0)}`} · URL auto-set
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Current Price (displayed)</label>
              <DebouncedInput value={d.currentPrice ?? ""} onChange={v => set("currentPrice", v)} className="h-8 text-xs" placeholder="e.g. $97 or Free" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="showStrikethrough" checked={d.showStrikethroughPrice ?? false} onChange={e => set("showStrikethroughPrice", e.target.checked)} className="rounded" />
              <label htmlFor="showStrikethrough" className="text-xs text-gray-600">Show strikethrough price</label>
            </div>
            {(d.showStrikethroughPrice ?? false) && (
              <DebouncedInput value={d.strikethroughPrice ?? ""} onChange={v => set("strikethroughPrice", v)} className="h-8 text-xs" placeholder="e.g. $197" />
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Price Position</label>
              <Select value={d.pricePosition ?? "above"} onValueChange={v => set("pricePosition", v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Above button</SelectItem>
                  <SelectItem value="below">Below button</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Hero Button: Send Email Settings (lead capture + campaign selector) ────────
function HeroSendEmailSettings({
  btn, idx, setBtn, setBtnMulti,
}: {
  btn: Record<string, any>;
  idx: number;
  setBtn: (idx: number, key: string, val: any) => void;
  setBtnMulti: (idx: number, patch: Record<string, any>) => void;
}) {
  const { data: campaignsData } = trpc.funnelPublic.listCampaignsPublic.useQuery();
  const campaigns = (campaignsData ?? []) as Array<{ id: number; subject: string }>;
  return (
    <div className="space-y-2 border border-teal-200 bg-teal-50/40 rounded-lg p-2">
      <p className="text-[10px] font-semibold text-teal-700 flex items-center gap-1">📧 Send Email Campaign to Lead</p>
      <p className="text-[10px] text-gray-500">When clicked, a name/email form will appear first to capture the lead, then the selected campaign will be sent to that address.</p>
      {/* Auto-enable lead capture */}
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={true} readOnly className="rounded accent-teal-600" />
        <label className="text-xs text-teal-700 font-medium">Collect lead before sending (required)</label>
      </div>
      {/* Lead modal title */}
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">Lead Form Title</label>
        <DebouncedInput
          value={btn.leadModalTitle ?? ""}
          onChange={v => setBtn(idx, "leadModalTitle", v)}
          className="h-7 text-xs"
          placeholder="e.g. Get Instant Access"
        />
      </div>
      {/* Lead modal subtext */}
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">Lead Form Subtext</label>
        <DebouncedInput
          value={btn.leadModalSubtext ?? ""}
          onChange={v => setBtn(idx, "leadModalSubtext", v)}
          className="h-7 text-xs"
          placeholder="Optional — e.g. We'll send it right away!"
        />
      </div>
      {/* Lead tags */}
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">Tags (comma-separated)</label>
        <DebouncedInput
          value={btn.leadTags ?? ""}
          onChange={v => setBtn(idx, "leadTags", v)}
          className="h-7 text-xs"
          placeholder="e.g. webinar, free-guide"
        />
      </div>
      {/* Campaign selector */}
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">Email Campaign to Send</label>
        <Select
          value={btn.campaignId ? String(btn.campaignId) : "none"}
          onValueChange={v => setBtn(idx, "campaignId", v === "none" ? null : Number(v))}
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select campaign…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— No campaign (capture only) —</SelectItem>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Link to campaign editor */}
      <a
        href="/admin/email"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-teal-600 underline flex items-center gap-1 hover:text-teal-800"
      >
        ✉ Open Email Campaign Editor
      </a>
    </div>
  );
}

// ─── Lead Capture Button Behavior Settings ───────────────────────────────────
function LeadCaptureSettings({ d, set }: { d: Record<string, any>; set: (key: string, val: any) => void }) {
  const { data: campaignsData } = trpc.funnelPublic.listCampaignsPublic.useQuery();
  const campaigns = (campaignsData ?? []) as Array<{ id: number; subject: string }>;
  const btnBehavior = d.btnBehavior ?? "none";
  return (
    <div className="space-y-3">
      {/* Content */}
      <BSTextField data={d} onSet={set} label="Headline" field="headline" />
      <BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline />
      <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
      <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
      {/* Fields */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">Form Fields</p>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="lcShowName" checked={d.showNameField ?? true} onChange={e => set("showNameField", e.target.checked)} className="rounded" />
          <label htmlFor="lcShowName" className="text-xs text-gray-600">Show name field</label>
        </div>
        {(d.showNameField ?? true) && (
          <BSTextField data={d} onSet={set} label="Name placeholder" field="namePlaceholder" placeholder="Your name (optional)" />
        )}
        <BSTextField data={d} onSet={set} label="Email placeholder" field="emailPlaceholder" placeholder="Your email address" />
      </div>
      {/* Input Field Appearance */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">Input Field Appearance</p>
        <BSColorField data={d} onSet={set} label="Input Background" field="inputBg" />
        <BSColorField data={d} onSet={set} label="Input Border Color" field="inputBorderColor" />
        <BSColorField data={d} onSet={set} label="Input Text Color" field="inputTextColor" />
        <BSColorField data={d} onSet={set} label="Placeholder Color" field="inputPlaceholderColor" />
        <div>
          <label className="text-xs text-gray-500 block mb-1">Border Radius (px)</label>
          <input type="number" min={0} max={50} value={d.inputBorderRadius ?? 8} onChange={e => set("inputBorderRadius", Number(e.target.value))} className="w-full h-8 text-xs rounded border border-gray-200 px-2" />
        </div>
      </div>
      {/* Button Appearance */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">Button Appearance</p>
        <BSTextField data={d} onSet={set} label="Button Text" field="ctaText" />
        <div>
          <label className="text-xs text-gray-500 block mb-1">Button Style</label>
          <div className="flex gap-1">
            {(["filled", "outline"] as const).map(s => (
              <button key={s} type="button" onClick={() => set("btnStyle", s)}
                className={`flex-1 py-1.5 text-xs rounded border capitalize ${
                  (d.btnStyle ?? "filled") === s ? "bg-teal-50 border-teal-400 text-teal-700 font-semibold" : "border-gray-200 text-gray-500"
                }`}>{s}</button>
            ))}
          </div>
        </div>
        <BSColorField data={d} onSet={set} label="Button Background" field="btnBg" />
        <BSColorField data={d} onSet={set} label="Button Text Color" field="btnTextColor" />
        <BSColorField data={d} onSet={set} label="Button Border / Outline Color" field="btnBorderColor" />
      </div>
      {/* Button Behavior */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><ArrowRight size={12} /> Button Behavior After Submit</p>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Action</label>
          <Select value={btnBehavior} onValueChange={v => set("btnBehavior", v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (show success message)</SelectItem>
              <SelectItem value="send_email">Send Email (link to campaign)</SelectItem>
              <SelectItem value="external_url">Go to External URL</SelectItem>
              <SelectItem value="next_funnel_step">Go to Next Funnel Step</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {btnBehavior === "send_email" && (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Link to Email Campaign (optional)</label>
              <Select value={d.btnCampaignId ? String(d.btnCampaignId) : "none"} onValueChange={v => set("btnCampaignId", v === "none" ? null : Number(v))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select campaign…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No campaign —</SelectItem>
                  {campaigns.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-gray-400">Contact is always stored. Campaign link is optional for triggering an email sequence.</p>
          </div>
        )}
        {btnBehavior === "external_url" && (
          <BSLinkField label="Redirect URL" value={d.btnUrl ?? ""} onChange={v => set("btnUrl", v)} />
        )}
        {btnBehavior === "next_funnel_step" && (
          <p className="text-[10px] text-gray-400">Will redirect to the next page in the funnel sequence after submit.</p>
        )}
      </div>
      {/* Tags */}
      <div className="border-t pt-2 mt-1 space-y-1">
        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Tag size={12} /> Lead Tags</p>
        <BSTextField data={d} onSet={set} label="Tags (comma-separated)" field="tags" placeholder="e.g. webinar, free-guide" />
      </div>
    </div>
  );
}

// ─── CTA with Opt-In Settings ───────────────────────────────────
function CtaOptinSettings({ d, set }: { d: Record<string, any>; set: (key: string, val: any) => void }) {
  const { data: campaignsData } = trpc.funnelPublic.listCampaignsPublic.useQuery();
  const campaigns = (campaignsData ?? []) as Array<{ id: number; subject: string }>;
  const btnBehavior = d.btnBehavior ?? "none";
  return (
    <div className="space-y-3">
      <BSTextField data={d} onSet={set} label="Headline" field="headline" />
      <BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline />
      <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
      <BSAlignField data={d} onSet={set} label="Text Alignment" field="align" />
      {/* Form Fields */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">Form Fields</p>
        <BSTextField data={d} onSet={set} label="Name placeholder" field="namePlaceholder" placeholder="Your name" />
        <BSTextField data={d} onSet={set} label="Email placeholder" field="emailPlaceholder" placeholder="Your email address" />
      </div>
      {/* Input Field Appearance */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">Input Field Appearance</p>
        <BSColorField data={d} onSet={set} label="Input Background" field="inputBg" />
        <BSColorField data={d} onSet={set} label="Input Border Color" field="inputBorderColor" />
        <BSColorField data={d} onSet={set} label="Input Text Color" field="inputTextColor" />
        <BSColorField data={d} onSet={set} label="Placeholder Color" field="inputPlaceholderColor" />
        <div>
          <label className="text-xs text-gray-500 block mb-1">Border Radius (px)</label>
          <input type="number" min={0} max={50} value={d.inputBorderRadius ?? 8} onChange={e => set("inputBorderRadius", Number(e.target.value))} className="w-full h-8 text-xs rounded border border-gray-200 px-2" />
        </div>
      </div>
      {/* Button Appearance */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">Button Appearance</p>
        <BSTextField data={d} onSet={set} label="Button Text" field="ctaText" />
        <div>
          <label className="text-xs text-gray-500 block mb-1">Button Style</label>
          <div className="flex gap-1">
            {(["filled", "outline"] as const).map(s => (
              <button key={s} type="button" onClick={() => set("btnStyle", s)}
                className={`flex-1 py-1.5 text-xs rounded border capitalize ${
                  (d.btnStyle ?? "filled") === s ? "bg-teal-50 border-teal-400 text-teal-700 font-semibold" : "border-gray-200 text-gray-500"
                }`}>{s}</button>
            ))}
          </div>
        </div>
        <BSColorField data={d} onSet={set} label="Button Background" field="ctaColor" />
        <BSColorField data={d} onSet={set} label="Button Text Color" field="ctaTextColor" />
        <BSColorField data={d} onSet={set} label="Button Border / Outline Color" field="btnBorderColor" />
      </div>
      {/* Button Behavior */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><ArrowRight size={12} /> Button Behavior After Submit</p>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Action</label>
          <Select value={btnBehavior} onValueChange={v => set("btnBehavior", v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (show success message)</SelectItem>
              <SelectItem value="send_email">Send Email (link to campaign)</SelectItem>
              <SelectItem value="external_url">Go to External URL</SelectItem>
              <SelectItem value="next_funnel_step">Go to Next Funnel Step</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {btnBehavior === "send_email" && (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Link to Email Campaign (optional)</label>
              <Select value={d.btnCampaignId ? String(d.btnCampaignId) : "none"} onValueChange={v => set("btnCampaignId", v === "none" ? null : Number(v))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select campaign…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No campaign —</SelectItem>
                  {campaigns.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-gray-400">Contact is always stored. Campaign link is optional for triggering an email sequence.</p>
          </div>
        )}
        {btnBehavior === "external_url" && (
          <BSLinkField label="Redirect URL" value={d.btnUrl ?? ""} onChange={v => set("btnUrl", v)} />
        )}
        {btnBehavior === "next_funnel_step" && (
          <p className="text-[10px] text-gray-400">Will redirect to the next page in the funnel sequence after submit.</p>
        )}
      </div>
      {/* Tags */}
      <div className="border-t pt-2 mt-1 space-y-1">
        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Tag size={12} /> Lead Tags</p>
        <BSTextField data={d} onSet={set} label="Tags (comma-separated)" field="tags" placeholder="e.g. webinar, free-guide" />
      </div>
      {/* Price Display */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">Price Display (optional)</p>
        <BSTextField data={d} onSet={set} label="Display Price" field="displayPrice" placeholder="e.g. $197" />
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={d.showStrikethrough ?? false} onChange={e => set("showStrikethrough", e.target.checked)} className="rounded" />
          <label className="text-xs text-gray-600">Show strikethrough price</label>
        </div>
        {(d.showStrikethrough ?? false) && <DebouncedInput value={d.strikethroughPrice ?? ""} onChange={v => set("strikethroughPrice", v)} className="h-7 text-xs" placeholder="e.g. $497" />}
      </div>
      <OptOutSettings d={d} set={set} />
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

// ─── Success Redirect Picker ────────────────────────────────────────────────
type RedirectMode = "url" | "dashboard" | "funnel_step";

function SuccessRedirectPicker({
  value, onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: funnelList } = trpc.funnel.list.useQuery(undefined, { staleTime: 60_000 });

  // Detect current mode from stored value
  const detectMode = (v: string): RedirectMode => {
    if (v === "__dashboard__") return "dashboard";
    if (v.startsWith("__funnel__:")) return "funnel_step";
    return "url";
  };

  const [mode, setMode] = useState<RedirectMode>(() => detectMode(value));

  const handleModeChange = (m: RedirectMode) => {
    setMode(m);
    if (m === "dashboard") onChange("__dashboard__");
    else if (m === "funnel_step") onChange("__funnel__:");
    else onChange("");
  };

  // Parse funnel step value: "__funnel__:funnelSlug/pageSlug"
  const funnelStepVal = value.startsWith("__funnel__:") ? value.slice(11) : "";
  const [selFunnelId, setSelFunnelId] = useState<number | null>(null);

  // Build flat list of all funnel pages
  const allFunnelPages = funnelList?.flatMap(f =>
    (f.pages ?? []).map((p: any) => ({
      funnelId: f.id,
      funnelName: f.name,
      funnelSlug: f.slug,
      pageId: p.id,
      pageName: p.name,
      pageSlug: p.slug,
      label: `${f.name} → ${p.name}`,
      value: `${f.slug}/${p.slug}`,
    }))
  ) ?? [];

  const filteredPages = selFunnelId
    ? allFunnelPages.filter(p => p.funnelId === selFunnelId)
    : allFunnelPages;

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500 font-medium">After Purchase</label>
      <div className="grid grid-cols-3 gap-1">
        {(["url", "dashboard", "funnel_step"] as RedirectMode[]).map(m => (
          <button key={m} onClick={() => handleModeChange(m)}
            className={`text-xs rounded px-2 py-1.5 border transition-colors ${
              mode === m
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
            }`}>
            {m === "url" ? "Custom URL" : m === "dashboard" ? "Student Dashboard" : "Funnel Step"}
          </button>
        ))}
      </div>
      {mode === "url" && (
        <div>
          <p className="text-xs text-gray-400 mb-1">Redirect to any URL after purchase</p>
          <Input value={value === "__dashboard__" || value.startsWith("__funnel__:") ? "" : value}
            onChange={e => onChange(e.target.value)}
            className="h-7 text-xs" placeholder="/thank-you or https://..." />
        </div>
      )}
      {mode === "dashboard" && (
        <div className="bg-teal-50 rounded p-2">
          <p className="text-xs text-teal-700 font-medium">Student Dashboard</p>
          <p className="text-xs text-teal-600 mt-0.5">Buyer is redirected to their dashboard after purchase. If not logged in, they will be prompted to log in or create an account.</p>
        </div>
      )}
      {mode === "funnel_step" && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">Choose a funnel step to redirect to</p>
          {funnelList && funnelList.length > 1 && (
            <select value={selFunnelId ?? ""} onChange={e => setSelFunnelId(e.target.value ? Number(e.target.value) : null)}
              className="h-7 w-full text-xs rounded border border-gray-200 px-2">
              <option value="">All funnels</option>
              {funnelList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          <select value={funnelStepVal} onChange={e => onChange(`__funnel__:${e.target.value}`)}
            className="h-7 w-full text-xs rounded border border-gray-200 px-2">
            <option value="">-- Select a funnel step --</option>
            {filteredPages.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {funnelStepVal && (
            <p className="text-xs text-gray-400">URL: /f/{funnelStepVal}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Additional Access Editor ───────────────────────────────────────────────
// Grants bonus access to extra products/courses/downloads after payment.
// No extra charge — purely fulfillment. Supports multiple items.
function AdditionalAccessEditor({
  data, onSet, catalog
}: {
  data: Record<string, any>;
  onSet: (key: string, value: any) => void;
  catalog?: Array<{ id: number; type: string; name: string; price: number; imageUrl: string }>;
}) {
  const items: Array<{ type: string; productId?: number; brand?: string; label: string }> = data.additionalAccess ?? [];
  const [search, setSearch] = useState("");

  const filtered = (catalog ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.type.toLowerCase().includes(search.toLowerCase())
  );

  const addItem = (item: { id: number; type: string; name: string }) => {
    onSet("additionalAccess", [...items, { type: item.type, productId: item.id, label: item.name }]);
    setSearch("");
  };

  const addMembership = (brand: string) => {
    const label = brand === "aaus" ? "All About Ultrasound - UltrasoundAssist Membership" : brand === "iheartecho" ? "iHeartEcho - EchoAssist Membership" : "All Memberships";
    onSet("additionalAccess", [...items, { type: "membership", brand, label }]);
  };

  const removeItem = (i: number) => onSet("additionalAccess", items.filter((_, j) => j !== i));

  return (
    <div className="border border-teal-200 rounded-lg p-3 space-y-2 bg-teal-50/30">
      <div className="flex items-center gap-2">
        <UserPlus size={13} className="text-teal-600 flex-shrink-0" />
        <p className="text-xs font-semibold text-teal-700">Additional Access (Bonus — no charge)</p>
      </div>
      <p className="text-xs text-gray-500">Automatically grants access to these extra items after purchase. The primary product from the checkout is always granted automatically.</p>
      {/* Current items */}
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-white border border-teal-100 rounded px-2 py-1">
              <span className="text-xs text-gray-500 capitalize flex-shrink-0">{item.type}</span>
              <span className="text-xs flex-1 truncate text-gray-700">{item.label}</span>
              <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
      {/* Search catalog */}
      {catalog && catalog.length > 0 && (
        <div className="space-y-1">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-7 text-xs pl-6 pr-2 rounded border border-gray-200 focus:outline-none focus:border-teal-400"
              placeholder="Search courses, downloads, products..."
            />
          </div>
          {search && (
            <div className="max-h-32 overflow-y-auto space-y-0.5 bg-white border border-gray-100 rounded">
              {filtered.length === 0 && <p className="text-xs text-gray-400 px-2 py-1">No results</p>}
              {filtered.map(item => (
                <button key={`aa-${item.type}-${item.id}`} onClick={() => addItem(item)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1 hover:bg-teal-50 hover:text-teal-700 text-xs transition-colors">
                  {item.imageUrl && <img src={item.imageUrl} className="w-5 h-5 rounded object-cover flex-shrink-0" />}
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-gray-300 flex-shrink-0 capitalize">{item.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Membership quick-add */}
      <div className="flex flex-wrap gap-1">
        <span className="text-xs text-gray-400">+ Membership:</span>
        {(["aaus", "iheartecho", "both"] as const).map(b => (
          <button key={b} onClick={() => addMembership(b)}
            className="text-xs px-2 py-0.5 rounded-full border border-teal-200 text-teal-600 hover:bg-teal-50 transition-colors">
            {b === "aaus" ? "AAUS - UltrasoundAssist" : b === "iheartecho" ? "iHeartEcho - EchoAssist" : "Both"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Checkout Form Block Settings ───────────────────────────────────────────
function CheckoutFormBlockSettings({
  d, set, cfProds, cfBumps
}: {
  d: Record<string, any>;
  set: (key: string, value: any) => void;
  cfProds: Array<{ name: string; description: string; price: number; imageUrl: string; type: string; productId?: number; strikethroughPrice?: string }>;
  cfBumps: Array<{ title?: string; headline?: string; label?: string; description: string; price: number | string; imageUrl?: string; ctaText?: string; ctaEmoji?: string; externalUrl?: string; strikethroughPrice?: string }>;
}) {
  const { data: catalog } = trpc.funnel.listAllProducts.useQuery(undefined, { staleTime: 60_000 });
  const [prodMode, setProdMode] = useState<"catalog" | "manual">("catalog");
  const [bumpMode, setBumpMode] = useState<"catalog" | "manual">("catalog");

  const addFromCatalog = (item: { id: number; type: string; name: string; price: number; imageUrl: string }) => {
    const next = [...cfProds, { name: item.name, description: "", price: item.price, catalogPrice: item.price, imageUrl: item.imageUrl, type: item.type, productId: item.id }];
    set("products", next);
  };

  const addBumpFromCatalog = (item: { id: number; type: string; name: string; price: number; imageUrl: string }) => {
    const next = [...cfBumps, { title: item.name, headline: "❖ Special Add-On!", description: "", price: item.price, imageUrl: item.imageUrl, ctaText: "+ Add", ctaEmoji: "", externalUrl: "" }];
    set("orderBumps", next);
  };

  return (
    <div className="space-y-4">
      {/* Display Mode */}
      <div><label className="text-xs text-gray-500 block mb-1">Display Mode</label><select value={d.displayMode ?? "inline"} onChange={e => set("displayMode", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="inline">Inline (embedded on page)</option><option value="standalone">Standalone Page (/f/slug/checkout)</option></select></div>
      {/* Header */}
      <BSTextField data={d} onSet={set} label="Header Text" field="headerText" placeholder="Lock in your seat now!" />
      <BSTextField data={d} onSet={set} label="Header Price" field="headerPrice" placeholder="$1997" />
      <div className="flex items-center gap-2"><input type="checkbox" checked={d.showHeaderStrikethrough ?? false} onChange={e => set("showHeaderStrikethrough", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show header strikethrough price</label></div>
      {(d.showHeaderStrikethrough ?? false) && <DebouncedInput value={d.headerStrikethroughPrice ?? ""} onChange={v => set("headerStrikethroughPrice", v)} className="h-7 text-xs" placeholder="e.g. $2997" />}
      {/* Sections Toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2"><input type="checkbox" checked={d.showContactInfo ?? true} onChange={e => set("showContactInfo", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show Contact Info</label></div>
        {(d.showContactInfo ?? true) && (
          <div className="ml-5 flex flex-col gap-1.5 border-l border-gray-100 pl-3">
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showPhone !== false} onChange={e => set("showPhone", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show Phone Field</label></div>
            {(d.showPhone !== false) && (
              <div className="flex items-center gap-2"><input type="checkbox" checked={d.requirePhone === true} onChange={e => set("requirePhone", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Require Phone</label></div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2"><input type="checkbox" checked={d.showBillingInfo ?? true} onChange={e => set("showBillingInfo", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show Billing Info</label></div>
        <div className="flex items-center gap-2"><input type="checkbox" checked={d.showProductSelect ?? true} onChange={e => set("showProductSelect", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show Product Selection</label></div>
      </div>
      {/* Products */}
      <div className="border border-gray-200 rounded p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">Products ({cfProds.length})</span>
          <div className="flex gap-1">
            <button onClick={() => setProdMode(m => m === "catalog" ? "manual" : "catalog")} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5">{prodMode === "catalog" ? "Manual" : "Catalog"}</button>
            <button onClick={() => set("products", [...cfProds, { name: "New Product", description: "", price: 0, imageUrl: "", type: "course" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
        </div>
        {prodMode === "catalog" && catalog && catalog.length > 0 && (
          <div className="bg-gray-50 rounded p-2 space-y-1">
            <p className="text-xs text-gray-400 mb-1">Click to add from catalog:</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {catalog.map(item => (
                <button key={`${item.type}-${item.id}`} onClick={() => addFromCatalog(item)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-teal-50 hover:text-teal-700 text-xs border border-transparent hover:border-teal-200 transition-colors">
                  {item.imageUrl && <img src={item.imageUrl} className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-gray-400 flex-shrink-0">${(item.price / 100).toFixed(2)}</span>
                  <span className="text-gray-300 flex-shrink-0 capitalize">{item.type}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {cfProds.map((p, i) => (
          <div key={i} className="border border-gray-100 rounded p-2 space-y-1">
            <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Product {i + 1}</span><button onClick={() => set("products", cfProds.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div>
            <DebouncedInput value={p.name} onChange={v => { const next = [...cfProds]; next[i] = { ...next[i], name: v }; set("products", next); }} className="h-7 text-xs" placeholder="Product name" />
            <DebouncedInput value={p.description} onChange={v => { const next = [...cfProds]; next[i] = { ...next[i], description: v }; set("products", next); }} className="h-7 text-xs" placeholder="Description" />
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-400 w-24 flex-shrink-0">Override Price</label>
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                  <DebouncedInput type="number" value={(p.price / 100).toFixed(2)} onChange={v => { const next = [...cfProds]; next[i] = { ...next[i], price: Math.round(parseFloat(v || "0") * 100) }; set("products", next); }} className="h-7 text-xs pl-5" placeholder="0.00" />
                </div>
                {(p as any).catalogPrice && (p as any).catalogPrice !== p.price && (
                  <span className="text-xs text-gray-400 flex-shrink-0">orig ${((p as any).catalogPrice / 100).toFixed(2)}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-400 w-24 flex-shrink-0">Strikethrough</label>
                <DebouncedInput value={(p as any).strikethroughPrice ?? ""} onChange={v => { const next = [...cfProds]; next[i] = { ...next[i], strikethroughPrice: v }; set("products", next); }} className="h-7 text-xs flex-1" placeholder="e.g. $497 (display only)" />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-400 w-24 flex-shrink-0">Type</label>
                <select value={p.type} onChange={e => { const next = [...cfProds]; next[i] = { ...next[i], type: e.target.value }; set("products", next); }} className="h-7 flex-1 text-xs rounded border border-gray-200 px-2"><option value="course">Course</option><option value="download">Download</option><option value="bundle">Bundle</option><option value="quiz">Quiz</option><option value="product">Product</option><option value="external">External (URL)</option></select>
              </div>
            </div>
            <DebouncedInput value={p.imageUrl} onChange={v => { const next = [...cfProds]; next[i] = { ...next[i], imageUrl: v }; set("products", next); }} className="h-7 text-xs" placeholder="Image URL (optional)" />
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-400 w-24 flex-shrink-0">Product ID</label>
              <Input type="number" value={(p as any).productId ?? ""} onChange={e => { const next = [...cfProds]; next[i] = { ...next[i], productId: e.target.value ? Number(e.target.value) : undefined }; set("products", next); }} className="h-7 text-xs" placeholder="DB product ID (for access grant)" />
            </div>
          </div>
        ))}
      </div>
      {/* Order Bumps */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500 font-medium">Order Bumps</label>
          <div className="flex gap-1">
            <button onClick={() => setBumpMode(m => m === "catalog" ? "manual" : "catalog")} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5">{bumpMode === "catalog" ? "Manual" : "Catalog"}</button>
            <button onClick={() => set("orderBumps", [...cfBumps, { title: "Add-on Offer", headline: "❖ Special Add-On!", description: "", price: 2700, imageUrl: "", ctaText: "+ Add", ctaEmoji: "", externalUrl: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
        </div>
        {bumpMode === "catalog" && catalog && catalog.length > 0 && (
          <div className="bg-gray-50 rounded p-2 space-y-1">
            <p className="text-xs text-gray-400 mb-1">Click to add bump from catalog:</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {catalog.map(item => (
                <button key={`bump-${item.type}-${item.id}`} onClick={() => addBumpFromCatalog(item)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-teal-50 hover:text-teal-700 text-xs border border-transparent hover:border-teal-200 transition-colors">
                  {item.imageUrl && <img src={item.imageUrl} className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-gray-400 flex-shrink-0">${(item.price / 100).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {cfBumps.map((bump: any, i: number) => (
          <div key={i} className="border border-gray-200 rounded p-2 space-y-1">
            <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Bump {i + 1}</span><button onClick={() => set("orderBumps", cfBumps.filter((_: any, j: number) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div>
            <DebouncedInput value={bump.headline ?? ""} onChange={v => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, headline: v } : b))} className="h-7 text-xs" placeholder="Eyebrow (e.g. ❖ Special Add-On!)" />
            <DebouncedInput value={bump.title ?? ""} onChange={v => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, title: v } : b))} className="h-7 text-xs" placeholder="Bump title" />
            <DebouncedTextarea value={bump.description ?? ""} onChange={v => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, description: v } : b))} className="text-xs min-h-[50px]" placeholder="Short description" />
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-400">Price (cents)</label><Input type="number" value={bump.price ?? 0} onChange={e => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, price: Number(e.target.value) } : b))} className="h-7 text-xs" placeholder="2700 = $27" /></div>
              <div><label className="text-xs text-gray-400">CTA Text</label><DebouncedInput value={bump.ctaText ?? ""} onChange={v => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, ctaText: v } : b))} className="h-7 text-xs" placeholder="+ Add" /></div>
            </div>
            <div className="flex items-center gap-1"><label className="text-xs text-gray-400 w-24 flex-shrink-0">Strikethrough</label><DebouncedInput value={bump.strikethroughPrice ?? ""} onChange={v => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, strikethroughPrice: v } : b))} className="h-7 text-xs flex-1" placeholder="e.g. $47 (display only)" /></div>
            <DebouncedInput value={bump.imageUrl ?? ""} onChange={v => set("orderBumps", cfBumps.map((b: any, j: number) => j === i ? { ...b, imageUrl: v } : b))} className="h-7 text-xs" placeholder="Image URL (optional)" />
          </div>
        ))}
      </div>
      {/* Additional Access (Bonus — no extra charge) */}
      <AdditionalAccessEditor data={d} onSet={set} catalog={catalog} />
      {/* Terms & Submit */}
      <BSTextField data={d} onSet={set} label="Terms Text" field="termsText" multiline />
      <div className="grid grid-cols-2 gap-2">
        <BSTextField data={d} onSet={set} label="Terms Link Text" field="termsLinkText" placeholder="TERMS OF SERVICE" />
        <BSTextField data={d} onSet={set} label="Terms Link URL" field="termsLinkUrl" placeholder="https://www.allaboutultrasound.com/terms-of-service.html" />
      </div>
      <BSTextField data={d} onSet={set} label="Submit Button Text" field="submitText" placeholder="Submit" />
      <BSSelectField data={d} onSet={set} label="Submit Button Icon" field="submitIcon" options={SUBMIT_ICON_OPTIONS} />
      <SuccessRedirectPicker value={d.successRedirect ?? ""} onChange={v => set("successRedirect", v)} />
      {/* Colors */}
      <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
      <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
      <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
    </div>
  );
}

export function BlockSettings({ block, onChange, lessonId }: { block: Block; onChange: (data: Record<string, any>) => void; lessonId?: number }) {
  const d = block.data ?? {};
  // Use refs to avoid stale closures with debounced inputs
  const dataRef = useRef(block.data ?? {});
  const onChangeRef = useRef(onChange);
  dataRef.current = block.data ?? {};
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
      const buttons: Array<{ text: string; color: string; textColor: string; link: string; style: string; animation?: string; behavior?: string; leadCapture?: boolean; leadModalTitle?: string; leadModalSubtext?: string; leadTags?: string; campaignId?: number | null; showStrikethrough?: boolean; strikethroughPrice?: string; showOptOut?: boolean; optOutText?: string; optOutUrl?: string }> =
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Enroll Now", color: d.ctaColor ?? "#fff", textColor: d.ctaTextColor ?? "#179ca3", link: "", style: "filled" }];
      const setBtn = (idx: number, key: string, val: any) => { const next = buttons.map((b, i) => i === idx ? { ...b, [key]: val } : b); onChangeRef.current({ ...dataRef.current, buttons: next }); };
      const setBtnMulti = (idx: number, patch: Record<string, any>) => { const next = buttons.map((b, i) => i === idx ? { ...b, ...patch } : b); onChangeRef.current({ ...dataRef.current, buttons: next }); };
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
                  <div><label className="text-xs text-gray-400 block mb-0.5">Button Action</label><Select value={btn.behavior ?? "url"} onValueChange={v => setBtn(idx, "behavior", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="url">Link to URL</SelectItem><SelectItem value="send_email">Send Email</SelectItem><SelectItem value="next_funnel_step">Next Funnel Step</SelectItem></SelectContent></Select></div>
                  {(btn.behavior ?? "url") === "url" && <BSLinkField label="Link" value={btn.link ?? ""} onChange={v => setBtn(idx, "link", v)} />}
                  {(btn.behavior ?? "url") === "send_email" && (
                    <HeroSendEmailSettings btn={btn} idx={idx} setBtn={setBtn} setBtnMulti={setBtnMulti} />
                  )}
                  {(btn.behavior ?? "url") === "next_funnel_step" && <p className="text-[10px] text-teal-600 bg-teal-50 rounded px-2 py-1">Button will navigate to the next page in the funnel sequence.</p>}
                  <div><label className="text-xs text-gray-400 block mb-0.5">Style</label><div className="flex gap-1">{(["filled", "outline"] as const).map(s => <button key={s} onClick={() => setBtn(idx, "style", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${btn.style === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div>
                  <div className="flex items-center gap-2"><label className="text-xs text-gray-400 w-16 flex-shrink-0">Color</label><input type="color" value={btn.color} onChange={e => setBtn(idx, "color", e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-200" /><DebouncedInput value={btn.color} onChange={v => setBtn(idx, "color", v)} className="h-7 text-xs flex-1" /></div>
                  {btn.style !== "outline" && <div className="flex items-center gap-2"><label className="text-xs text-gray-400 w-16 flex-shrink-0">Text</label><input type="color" value={btn.textColor} onChange={e => setBtn(idx, "textColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-200" /><DebouncedInput value={btn.textColor} onChange={v => setBtn(idx, "textColor", v)} className="h-7 text-xs flex-1" /></div>}
                  <div><label className="text-xs text-gray-400 block mb-0.5">Animation</label><Select value={btn.animation ?? "none"} onValueChange={v => setBtn(idx, "animation", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="pulse">Pulse</SelectItem><SelectItem value="bounce">Bounce</SelectItem><SelectItem value="shake">Shake</SelectItem><SelectItem value="glow">Glow</SelectItem></SelectContent></Select></div>
                  <div className="border-t border-gray-100 pt-2 mt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <input type="checkbox" id={`lc-${idx}`} checked={btn.leadCapture ?? false} onChange={e => setBtn(idx, "leadCapture", e.target.checked as any)} className="rounded" />
                      <label htmlFor={`lc-${idx}`} className="text-xs text-teal-700 font-medium">Collect lead before action</label>
                    </div>
                    {btn.leadCapture && (
                      <div className="space-y-1 pl-1">
                        <p className="text-[10px] text-gray-400">A name/email form will appear before the button action executes.</p>
                        <DebouncedInput value={btn.leadModalTitle ?? ""} onChange={v => setBtn(idx, "leadModalTitle", v)} className="h-7 text-xs" placeholder="Modal title (e.g. Get Instant Access)" />
                        <DebouncedInput value={btn.leadModalSubtext ?? ""} onChange={v => setBtn(idx, "leadModalSubtext", v)} className="h-7 text-xs" placeholder="Modal subtext (optional)" />
                        <DebouncedInput value={btn.leadTags ?? ""} onChange={v => setBtn(idx, "leadTags", v)} className="h-7 text-xs" placeholder="Tags (comma-separated)" />
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
                    <label className="text-xs text-gray-500 font-medium block">Price Display (below button)</label>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id={`sp-${idx}`} checked={btn.showStrikethrough ?? false} onChange={e => setBtn(idx, "showStrikethrough", e.target.checked as any)} className="rounded" />
                      <label htmlFor={`sp-${idx}`} className="text-xs text-gray-600">Show strikethrough price</label>
                    </div>
                    {btn.showStrikethrough && (
                      <DebouncedInput value={btn.strikethroughPrice ?? ""} onChange={v => setBtn(idx, "strikethroughPrice", v)} className="h-7 text-xs" placeholder="e.g. $497" />
                    )}
                  </div>
                  <div className="space-y-2 border-t border-gray-100 pt-2 mt-1">
                    <label className="text-xs text-gray-500 font-medium block">Opt-Out / Skip Link</label>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id={`oo-${idx}`} checked={btn.showOptOut ?? false} onChange={e => setBtn(idx, "showOptOut", e.target.checked as any)} className="rounded" />
                      <label htmlFor={`oo-${idx}`} className="text-xs text-gray-600">Show opt-out link</label>
                    </div>
                    {btn.showOptOut && (
                      <>
                        <DebouncedInput value={btn.optOutText ?? "No thanks"} onChange={v => setBtn(idx, "optOutText", v)} className="h-8 text-xs" placeholder="No thanks, I don't want this" />
                        <DebouncedInput value={btn.optOutUrl ?? ""} onChange={v => setBtn(idx, "optOutUrl", v)} className="h-8 text-xs" placeholder="https://... (skip destination)" />
                      </>
                    )}
                  </div>
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
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Embed URL (YouTube, Vimeo, Wistia, or direct .mp4)" field="embedUrl" /><BSTextField data={d} onSet={set} label="Caption" field="caption" /><div className="border border-gray-100 rounded p-2 space-y-2"><p className="text-xs font-semibold text-gray-600 mb-1">Playback Options</p><div className="flex items-center gap-2"><input type="checkbox" checked={d.autoplay ?? false} onChange={e => set("autoplay", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Autoplay <span className="text-gray-400">(direct video files only — iframes use URL params)</span></label></div><div className="flex items-center gap-2"><input type="checkbox" checked={d.muted ?? true} onChange={e => set("muted", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Muted <span className="text-gray-400">(required for autoplay in most browsers)</span></label></div><div className="flex items-center gap-2"><input type="checkbox" checked={d.loop ?? false} onChange={e => set("loop", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Loop</label></div><div className="flex items-center gap-2"><input type="checkbox" checked={d.controls ?? true} onChange={e => set("controls", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show controls</label></div></div><div><label className="text-xs text-gray-500 block mb-1">Max Width</label><DebouncedInput value={d.maxWidth ?? "100%"} onChange={v => set("maxWidth", v)} className="h-8 text-sm" placeholder="100%, 800px, etc." /></div><div><label className="text-xs text-gray-500 block mb-1">Height</label><DebouncedInput value={d.height ?? ""} onChange={v => set("height", v)} className="h-8 text-sm" placeholder="auto, 450px, etc." /></div><div><label className="text-xs text-gray-500 block mb-1">Border Radius (px)</label><Input type="number" value={d.borderRadius ?? 0} onChange={e => set("borderRadius", Number(e.target.value))} className="h-8 text-sm" min={0} max={999} /></div><div><label className="text-xs text-gray-500 block mb-1">Border Width (px)</label><Input type="number" value={d.borderWidth ?? 0} onChange={e => set("borderWidth", Number(e.target.value))} className="h-8 text-sm" min={0} max={20} /></div><div><label className="text-xs text-gray-500 block mb-1">Border Style</label><div className="flex gap-1">{(["solid", "dashed", "dotted"] as const).map(s => <button key={s} onClick={() => set("borderStyle", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.borderStyle ?? "solid") === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div><BSColorField data={d} onSet={set} label="Border Color" field="borderColor" /></div>);
    case "audio":
      return (
        <AudioBlockEditor
          d={d}
          set={set}
          handleFileUpload={handleFileUpload}
          uploading={uploading}
        />
      );
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
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline />
          <BSTextField data={d} onSet={set} label="CTA Button Text" field="ctaText" />
          <div><label className="text-xs text-gray-500 block mb-1">Button Action</label><Select value={d.ctaBehavior ?? "url"} onValueChange={v => set("ctaBehavior", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="url">Link to URL</SelectItem><SelectItem value="send_email">Send Email</SelectItem><SelectItem value="next_funnel_step">Next Funnel Step</SelectItem></SelectContent></Select></div>
          {(d.ctaBehavior ?? "url") === "url" && <BSLinkField label="Button Link" value={d.ctaLink ?? ""} onChange={v => set("ctaLink", v)} />}
          {(d.ctaBehavior ?? "url") === "send_email" && <div><label className="text-xs text-gray-500 block mb-1">Email Address</label><DebouncedInput value={d.ctaEmailAddress ?? ""} onChange={v => set("ctaEmailAddress", v)} className="h-7 text-xs" placeholder="e.g. hello@example.com" /></div>}
          {(d.ctaBehavior ?? "url") === "next_funnel_step" && <p className="text-[10px] text-teal-600 bg-teal-50 rounded px-2 py-1">Button will navigate to the next page in the funnel sequence.</p>}
          <BSColorField data={d} onSet={set} label="CTA Color" field="ctaColor" />
          <BSColorField data={d} onSet={set} label="CTA Text Color" field="ctaTextColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Button Animation</label>
            <Select value={d.ctaAnimation ?? "none"} onValueChange={v => set("ctaAnimation", v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="pulse">Pulse</SelectItem>
                <SelectItem value="bounce">Bounce</SelectItem>
                <SelectItem value="shake">Shake</SelectItem>
                <SelectItem value="glow">Glow</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PricingCtaSettings d={d} set={set} />
          <div className="border border-teal-100 bg-teal-50/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pcta-lc" checked={d.leadCapture??false} onChange={e=>set("leadCapture",e.target.checked)} className="rounded" />
              <label htmlFor="pcta-lc" className="text-xs text-teal-700 font-medium">Collect lead before action</label>
            </div>
            {(d.leadCapture??false)&&(
              <div className="space-y-1 pl-1">
                <p className="text-[10px] text-gray-400">A name/email modal will appear before the button action executes.</p>
                <BSTextField data={d} onSet={set} label="Modal Title" field="leadModalTitle" placeholder="e.g. Get Instant Access" />
                <BSTextField data={d} onSet={set} label="Modal Subtext" field="leadModalSubtext" placeholder="Optional" />
                <BSTextField data={d} onSet={set} label="Tags (comma-separated)" field="leadTags" placeholder="e.g. webinar, free-guide" />
              </div>
            )}
          </div>
          <div className="border-t pt-3 mt-1 space-y-2">
            <p className="text-xs font-medium text-gray-500">Button Subtext (below button)</p>
            <BSTextField data={d} onSet={set} label="Subtext text" field="buttonSubtext" placeholder="e.g. No credit card required" />
            <BSLinkField label="Subtext URL (optional)" value={d.buttonSubtextUrl ?? ""} onChange={v => set("buttonSubtextUrl", v)} />
            <BSColorField data={d} onSet={set} label="Subtext Color" field="buttonSubtextColor" />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Subtext Size</label>
              <select value={d.buttonSubtextSize ?? "xs"} onChange={e => set("buttonSubtextSize", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
                <option value="xs">Extra Small (xs)</option>
                <option value="sm">Small (sm)</option>
                <option value="base">Base</option>
                <option value="lg">Large (lg)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Subtext Style</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => set("buttonSubtextItalic", !(d.buttonSubtextItalic ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextItalic ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><em>Italic</em></button>
                <button type="button" onClick={() => set("buttonSubtextBold", !(d.buttonSubtextBold ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextBold ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><strong>Bold</strong></button>
              </div>
            </div>
          </div>
          <OptOutSettings d={d} set={set} />
        </div>
      );
    case "cta_standalone":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Headline" field="headline" /><div className="border border-gray-200 rounded-lg p-3 space-y-2"><p className="text-xs font-semibold text-gray-600">Price Display</p><div className="flex items-center gap-2"><input type="checkbox" checked={d.showStrikethrough ?? false} onChange={e => set("showStrikethrough", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show strikethrough price</label></div>{(d.showStrikethrough ?? false) && <DebouncedInput value={d.strikethroughPrice ?? ""} onChange={v => set("strikethroughPrice", v)} className="h-7 text-xs" placeholder="e.g. $497" />}<BSTextField data={d} onSet={set} label="Current Price (display only)" field="displayPrice" placeholder="e.g. $197" /></div><BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline /><BSTextField data={d} onSet={set} label="Button Text" field="ctaText" /><div><label className="text-xs text-gray-500 block mb-1">Button Action</label><Select value={d.ctaBehavior ?? "url"} onValueChange={v => set("ctaBehavior", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="url">Link to URL</SelectItem><SelectItem value="send_email">Send Email</SelectItem><SelectItem value="next_funnel_step">Next Funnel Step</SelectItem></SelectContent></Select></div>{(d.ctaBehavior ?? "url") === "url" && <BSLinkField label="Button Link" value={d.ctaLink ?? ""} onChange={v => set("ctaLink", v)} />}{(d.ctaBehavior ?? "url") === "send_email" && <div><label className="text-xs text-gray-500 block mb-1">Email Address</label><DebouncedInput value={d.ctaEmailAddress ?? ""} onChange={v => set("ctaEmailAddress", v)} className="h-7 text-xs" placeholder="e.g. hello@example.com" /></div>}{(d.ctaBehavior ?? "url") === "next_funnel_step" && <p className="text-[10px] text-teal-600 bg-teal-50 rounded px-2 py-1">Button will navigate to the next page in the funnel sequence.</p>}<BSColorField data={d} onSet={set} label="Button Color" field="ctaColor" /><BSColorField data={d} onSet={set} label="Button Text Color" field="ctaTextColor" /><BSColorField data={d} onSet={set} label="Button Border / Outline Color" field="btnBorderColor" /><div><label className="text-xs text-gray-500 block mb-1">Button Style</label><div className="flex gap-1">{(["filled","outline"] as const).map(s=><button key={s} onClick={()=>set("btnStyle",s)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.btnStyle??"filled")===s?"bg-teal-600 text-white border-teal-600":"border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div className="border border-teal-100 bg-teal-50/50 rounded-lg p-3 space-y-2"><div className="flex items-center gap-2"><input type="checkbox" id="cta-lc" checked={d.leadCapture??false} onChange={e=>set("leadCapture",e.target.checked)} className="rounded" /><label htmlFor="cta-lc" className="text-xs text-teal-700 font-medium">Collect lead before action</label></div>{(d.leadCapture??false)&&(<div className="space-y-1 pl-1"><p className="text-[10px] text-gray-400">A name/email modal will appear before the button action executes.</p><BSTextField data={d} onSet={set} label="Modal Title" field="leadModalTitle" placeholder="e.g. Get Instant Access" /><BSTextField data={d} onSet={set} label="Modal Subtext" field="leadModalSubtext" placeholder="Optional" /><BSTextField data={d} onSet={set} label="Tags (comma-separated)" field="leadTags" placeholder="e.g. webinar, free-guide" /></div>)}</div><div><label className="text-xs text-gray-500 block mb-1">Button Animation</label><Select value={d.ctaAnimation ?? "none"} onValueChange={v => set("ctaAnimation", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="pulse">Pulse</SelectItem><SelectItem value="bounce">Bounce</SelectItem><SelectItem value="shake">Shake</SelectItem><SelectItem value="glow">Glow</SelectItem></SelectContent></Select></div><BSAlignField data={d} onSet={set} label="Text Alignment" field="align" /><div className="border-t pt-3 mt-1 space-y-2"><p className="text-xs font-medium text-gray-500">Button Subtext (below button)</p><BSTextField data={d} onSet={set} label="Subtext text" field="buttonSubtext" placeholder="e.g. No credit card required" /><BSLinkField label="Subtext URL (optional)" value={d.buttonSubtextUrl ?? ""} onChange={v => set("buttonSubtextUrl", v)} /><BSColorField data={d} onSet={set} label="Subtext Color" field="buttonSubtextColor" /><div><label className="text-xs text-gray-500 block mb-1">Subtext Size</label><select value={d.buttonSubtextSize ?? "xs"} onChange={e => set("buttonSubtextSize", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="xs">Extra Small (xs)</option><option value="sm">Small (sm)</option><option value="base">Base</option><option value="lg">Large (lg)</option></select></div><div><label className="text-xs text-gray-500 block mb-1">Subtext Style</label><div className="flex gap-2"><button type="button" onClick={() => set("buttonSubtextItalic", !(d.buttonSubtextItalic ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextItalic ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><em>Italic</em></button><button type="button" onClick={() => set("buttonSubtextBold", !(d.buttonSubtextBold ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextBold ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><strong>Bold</strong></button></div></div></div><OptOutSettings d={d} set={set} /></div>);
    case "lead_capture":
      return <LeadCaptureSettings d={d} set={set} />;
    case "cta_optin":
      return <CtaOptinSettings d={d} set={set} />;
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
                  <DebouncedInput value={(product as any).strikethroughPrice ?? ""} onChange={v => set("products", products.map((p, j) => j === i ? { ...p, strikethroughPrice: v } : p))} className="h-7 text-xs" placeholder="Strikethrough price (e.g. $99, display only)" />
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
          <div className="grid grid-cols-3 gap-2">
            <BSTextField data={d} onSet={set} label="Price" field="price" />
            <BSTextField data={d} onSet={set} label="Compare At" field="compareAtPrice" />
            <BSTextField data={d} onSet={set} label="Strikethrough" field="strikethroughPrice" />
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
          <div className="border border-gray-200 rounded-lg p-3 space-y-2"><p className="text-xs font-semibold text-gray-600">Price Display</p><BSTextField data={d} onSet={set} label="Current Price (display only)" field="displayPrice" placeholder="e.g. $197" /><div className="flex items-center gap-2"><input type="checkbox" checked={d.showStrikethrough ?? false} onChange={e => set("showStrikethrough", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show strikethrough price</label></div>{(d.showStrikethrough ?? false) && <DebouncedInput value={d.strikethroughPrice ?? ""} onChange={v => set("strikethroughPrice", v)} className="h-7 text-xs" placeholder="e.g. $497" />}</div>
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
    case "inline_checkout": {
      const icProds: Array<{ name: string; description: string; price: number; imageUrl: string; type: string; strikethroughPrice?: string; productId?: number }> = d.products ?? [];
      const icBumps: Array<{ title: string; headline: string; description: string; price: number; imageUrl: string; ctaText: string; ctaEmoji: string; animation: string }> = d.orderBumps ?? [];
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { data: icCatalog } = trpc.funnel.listAllProducts.useQuery(undefined, { staleTime: 60_000 });
      return (
        <div className="space-y-4">
          <div className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded p-2">
            <strong>Inline Checkout (Stripe)</strong> — Classic card fields embedded directly on the page. Matches the checkout form layout with contact info, product selector, address toggle, order bumps, and submit. Purchases appear in My Dashboard.
          </div>
          {/* Header */}
          <BSTextField data={d} onSet={set} label="Header Text" field="headerText" placeholder="🔒 Lock in your seat now!" />
          <BSTextField data={d} onSet={set} label="Header Price" field="headerPrice" placeholder="$997" />
          <div className="flex items-center gap-2"><input type="checkbox" checked={d.showHeaderStrikethrough ?? false} onChange={e => set("showHeaderStrikethrough", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show header strikethrough price</label></div>
          {(d.showHeaderStrikethrough ?? false) && <DebouncedInput value={d.headerStrikethroughPrice ?? ""} onChange={v => set("headerStrikethroughPrice", v)} className="h-7 text-xs" placeholder="e.g. $2997" />}
          {/* Options */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showContactInfo ?? true} onChange={e => set("showContactInfo", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Collect contact info (name, email)</label></div>
            {(d.showContactInfo ?? true) && (
              <div className="ml-5 flex flex-col gap-1.5 border-l border-gray-100 pl-3">
                <div className="flex items-center gap-2"><input type="checkbox" checked={d.showPhone !== false} onChange={e => set("showPhone", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show Phone Field</label></div>
                {(d.showPhone !== false) && (
                  <div className="flex items-center gap-2"><input type="checkbox" checked={d.requirePhone === true} onChange={e => set("requirePhone", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Require Phone</label></div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showBillingInfo ?? false} onChange={e => set("showBillingInfo", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Collect billing address <span className="text-teal-600">(auto-on for physical products)</span></label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showProductSelect ?? true} onChange={e => set("showProductSelect", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show product selector</label></div>
          </div>
          {/* Products */}
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700">Products ({icProds.length})</span><button onClick={() => set("products", [...icProds, { name: "New Product", description: "", price: 9700, imageUrl: "", type: "other" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div>
            {icCatalog && icCatalog.length > 0 && (
              <div className="bg-gray-50 rounded p-2 space-y-1">
                <p className="text-xs text-gray-400 mb-1">Click to add from catalog:</p>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {icCatalog.map(item => (
                    <button key={`ic-${item.type}-${item.id}`} onClick={() => set("products", [...icProds, { name: item.name, description: "", price: item.price, imageUrl: item.imageUrl ?? "", type: item.type }])}
                      className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-teal-50 hover:text-teal-700 text-xs border border-transparent hover:border-teal-200 transition-colors">
                      {item.imageUrl && <img src={item.imageUrl} className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="text-gray-400 flex-shrink-0">${(item.price / 100).toFixed(2)}</span>
                      <span className="text-gray-300 flex-shrink-0 capitalize">{item.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {icProds.map((p, i) => (
              <div key={i} className="border border-gray-100 rounded p-2 space-y-1">
                <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Product {i + 1}</span><button onClick={() => set("products", icProds.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div>
                <DebouncedInput value={p.name} onChange={v => { const next = [...icProds]; next[i] = { ...next[i], name: v }; set("products", next); }} className="h-7 text-xs" placeholder="Product name" />
                <DebouncedInput value={p.description} onChange={v => { const next = [...icProds]; next[i] = { ...next[i], description: v }; set("products", next); }} className="h-7 text-xs" placeholder="Description" />
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-400 w-24 flex-shrink-0">Override Price</label>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                      <DebouncedInput type="number" value={(p.price / 100).toFixed(2)} onChange={v => { const next = [...icProds]; next[i] = { ...next[i], price: Math.round(parseFloat(v || "0") * 100) }; set("products", next); }} className="h-7 text-xs pl-5" placeholder="0.00" />
                    </div>
                    {(p as any).catalogPrice && (p as any).catalogPrice !== p.price && (
                      <span className="text-xs text-gray-400 flex-shrink-0">orig ${((p as any).catalogPrice / 100).toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-400 w-24 flex-shrink-0">Strikethrough</label>
                    <DebouncedInput value={(p as any).strikethroughPrice ?? ""} onChange={v => { const next = [...icProds]; next[i] = { ...next[i], strikethroughPrice: v }; set("products", next); }} className="h-7 text-xs flex-1" placeholder="e.g. $197 (display only)" />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-400 w-24 flex-shrink-0">Type</label>
                    <select value={p.type} onChange={e => { const next = [...icProds]; next[i] = { ...next[i], type: e.target.value }; set("products", next); }} className="h-7 flex-1 text-xs rounded border border-gray-200 px-2"><option value="other">Other / Service</option><option value="course">Course</option><option value="download">Download</option><option value="physical">Physical Product</option><option value="membership">Membership</option></select>
                  </div>
                </div>
                <DebouncedInput value={p.imageUrl} onChange={v => { const next = [...icProds]; next[i] = { ...next[i], imageUrl: v }; set("products", next); }} className="h-7 text-xs" placeholder="Image URL (optional)" />
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-400 w-24 flex-shrink-0">Product ID</label>
                  <Input type="number" value={(p as any).productId ?? ""} onChange={e => { const next = [...icProds]; next[i] = { ...next[i], productId: e.target.value ? Number(e.target.value) : undefined }; set("products", next); }} className="h-7 text-xs" placeholder="DB product ID (for access grant)" />
                </div>
              </div>
            ))}
          </div>
          {/* Order Bumps */}
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700">Order Bumps ({icBumps.length})</span><button onClick={() => set("orderBumps", [...icBumps, { title: "Add-on Offer", headline: "✦ Special one-time offer!", description: "Enhance your purchase with this exclusive add-on.", price: 2700, imageUrl: "", ctaText: "+ Add", ctaEmoji: "", animation: "pulse" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add Bump</button></div>
            {icBumps.map((bump: any, i: number) => (
              <div key={i} className="border border-gray-100 rounded p-2 space-y-1">
                <div className="flex justify-between items-center"><span className="text-xs font-semibold text-gray-600">Bump {i + 1}</span><button onClick={() => set("orderBumps", icBumps.filter((_: any, j: number) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div>
                <DebouncedInput value={bump.headline ?? ""} onChange={v => set("orderBumps", icBumps.map((b: any, j: number) => j === i ? { ...b, headline: v } : b))} className="h-7 text-xs" placeholder="Eyebrow (e.g. ✦ Special Add-On!)" />
                <DebouncedInput value={bump.title ?? ""} onChange={v => set("orderBumps", icBumps.map((b: any, j: number) => j === i ? { ...b, title: v } : b))} className="h-7 text-xs" placeholder="Bump title" />
                <DebouncedTextarea value={bump.description ?? ""} onChange={v => set("orderBumps", icBumps.map((b: any, j: number) => j === i ? { ...b, description: v } : b))} className="text-xs min-h-[50px]" placeholder="Short description" />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-400">Price (cents)</label><Input type="number" value={bump.price ?? 0} onChange={e => set("orderBumps", icBumps.map((b: any, j: number) => j === i ? { ...b, price: Number(e.target.value) } : b))} className="h-7 text-xs" /></div>
                  <div><label className="text-xs text-gray-400">Animation</label><select value={bump.animation ?? "pulse"} onChange={e => set("orderBumps", icBumps.map((b: any, j: number) => j === i ? { ...b, animation: e.target.value } : b))} className="h-7 w-full text-xs rounded border border-gray-200 px-2"><option value="pulse">Pulse Border</option><option value="glow">Glow Border</option><option value="shake">Shake</option><option value="bounce">Bounce</option><option value="none">None</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-400">CTA Text</label><DebouncedInput value={bump.ctaText ?? ""} onChange={v => set("orderBumps", icBumps.map((b: any, j: number) => j === i ? { ...b, ctaText: v } : b))} className="h-7 text-xs" placeholder="+ Add" /></div>
                  <div><label className="text-xs text-gray-400">CTA Emoji</label><DebouncedInput value={bump.ctaEmoji ?? ""} onChange={v => set("orderBumps", icBumps.map((b: any, j: number) => j === i ? { ...b, ctaEmoji: v } : b))} className="h-7 text-xs" placeholder="👍" /></div>
                </div>
                <DebouncedInput value={bump.imageUrl ?? ""} onChange={v => set("orderBumps", icBumps.map((b: any, j: number) => j === i ? { ...b, imageUrl: v } : b))} className="h-7 text-xs" placeholder="Image URL (optional)" />
              </div>
            ))}
          </div>
          {/* Additional Access (Bonus — no extra charge) */}
          <AdditionalAccessEditor data={d} onSet={set} catalog={icCatalog} />
          {/* Submit & Redirect */}
          <BSTextField data={d} onSet={set} label="Submit Button Text" field="submitText" placeholder="Submit" />
          <BSSelectField data={d} onSet={set} label="Submit Button Icon" field="submitIcon" options={SUBMIT_ICON_OPTIONS} />
          <SuccessRedirectPicker value={d.successRedirect ?? ""} onChange={v => set("successRedirect", v)} />
          {/* Terms */}
          <div className="grid grid-cols-2 gap-2">
            <BSTextField data={d} onSet={set} label="Terms Text" field="termsText" placeholder="I agree to the" />
            <BSTextField data={d} onSet={set} label="Terms Link Text" field="termsLinkText" placeholder="Terms of Service" />
          </div>
          <BSTextField data={d} onSet={set} label="Terms Link URL" field="termsLinkUrl" placeholder="https://www.allaboutultrasound.com/terms-of-service.html" />
          {/* Colors */}
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
        </div>
      );
    }
    case "embedded_checkout": {
      const ecProds: Array<{ name: string; description: string; price: number; imageUrl: string; type: string; strikethroughPrice?: string; productId?: number }> = d.products ?? [];
      const ecBumps: Array<{ title: string; headline: string; description: string; price: number; imageUrl: string; ctaText: string; highlightColor: string; animation: string }> = d.orderBumps ?? [];
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { data: ecCatalog } = trpc.funnel.listAllProducts.useQuery(undefined, { staleTime: 60_000 });
      return (
        <div className="space-y-4">
          <div className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded p-2">
            <strong>Embedded Checkout</strong> — Live Stripe PaymentElement embedded directly on the page. Purchases appear in the student's My Dashboard.
          </div>
          {/* Header */}
          <BSTextField data={d} onSet={set} label="Header Text" field="headerText" placeholder="Complete Your Order" />
          <BSTextField data={d} onSet={set} label="Header Subtext" field="headerSubtext" placeholder="Secure checkout powered by Stripe" />
          {/* Options */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showContactInfo ?? true} onChange={e => set("showContactInfo", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Collect contact info (name, email)</label></div>
            {(d.showContactInfo ?? true) && (
              <div className="ml-5 flex flex-col gap-1.5 border-l border-gray-100 pl-3">
                <div className="flex items-center gap-2"><input type="checkbox" checked={d.showPhone !== false} onChange={e => set("showPhone", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show Phone Field</label></div>
                {(d.showPhone !== false) && (
                  <div className="flex items-center gap-2"><input type="checkbox" checked={d.requirePhone === true} onChange={e => set("requirePhone", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Require Phone</label></div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.collectShipping ?? false} onChange={e => set("collectShipping", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Collect shipping address <span className="text-teal-600">(auto-on for physical products)</span></label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.collectBilling ?? false} onChange={e => set("collectBilling", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Collect billing address</label></div>
          </div>
          {/* Products */}
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700">Products ({ecProds.length})</span><button onClick={() => set("products", [...ecProds, { name: "New Product", description: "", price: 9700, imageUrl: "", type: "other" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div>
            {ecCatalog && ecCatalog.length > 0 && (
              <div className="bg-gray-50 rounded p-2 space-y-1">
                <p className="text-xs text-gray-400 mb-1">Click to add from catalog:</p>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {ecCatalog.map(item => (
                    <button key={`ec-${item.type}-${item.id}`} onClick={() => set("products", [...ecProds, { name: item.name, description: "", price: item.price, catalogPrice: item.price, imageUrl: item.imageUrl ?? "", type: item.type, productId: item.id }])}
                      className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-teal-50 hover:text-teal-700 text-xs border border-transparent hover:border-teal-200 transition-colors">
                      {item.imageUrl && <img src={item.imageUrl} className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="text-gray-400 flex-shrink-0">${(item.price / 100).toFixed(2)}</span>
                      <span className="text-gray-300 flex-shrink-0 capitalize">{item.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {ecProds.map((p, i) => (
              <div key={i} className="border border-gray-100 rounded p-2 space-y-1">
                <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Product {i + 1}</span><button onClick={() => set("products", ecProds.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div>
                <DebouncedInput value={p.name} onChange={v => { const next = [...ecProds]; next[i] = { ...next[i], name: v }; set("products", next); }} className="h-7 text-xs" placeholder="Product name" />
                <DebouncedInput value={p.description} onChange={v => { const next = [...ecProds]; next[i] = { ...next[i], description: v }; set("products", next); }} className="h-7 text-xs" placeholder="Description" />
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-400 w-24 flex-shrink-0">Override Price</label>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                      <DebouncedInput type="number" value={(p.price / 100).toFixed(2)} onChange={v => { const next = [...ecProds]; next[i] = { ...next[i], price: Math.round(parseFloat(v || "0") * 100) }; set("products", next); }} className="h-7 text-xs pl-5" placeholder="0.00" />
                    </div>
                    {(p as any).catalogPrice && (p as any).catalogPrice !== p.price && (
                      <span className="text-xs text-gray-400 flex-shrink-0">orig ${((p as any).catalogPrice / 100).toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-400 w-24 flex-shrink-0">Strikethrough</label>
                    <DebouncedInput value={(p as any).strikethroughPrice ?? ""} onChange={v => { const next = [...ecProds]; next[i] = { ...next[i], strikethroughPrice: v }; set("products", next); }} className="h-7 text-xs flex-1" placeholder="e.g. $197 (display only)" />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-400 w-24 flex-shrink-0">Type</label>
                    <select value={p.type} onChange={e => { const next = [...ecProds]; next[i] = { ...next[i], type: e.target.value }; set("products", next); }} className="h-7 flex-1 text-xs rounded border border-gray-200 px-2"><option value="other">Other / Service</option><option value="course">Course</option><option value="download">Download</option><option value="physical">Physical Product</option><option value="subscription">Subscription</option></select>
                  </div>
                </div>
                <DebouncedInput value={p.imageUrl} onChange={v => { const next = [...ecProds]; next[i] = { ...next[i], imageUrl: v }; set("products", next); }} className="h-7 text-xs" placeholder="Image URL (optional)" />
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-400 w-24 flex-shrink-0">Product ID</label>
                  <Input type="number" value={(p as any).productId ?? ""} onChange={e => { const next = [...ecProds]; next[i] = { ...next[i], productId: e.target.value ? Number(e.target.value) : undefined }; set("products", next); }} className="h-7 text-xs" placeholder="DB product ID (for access grant)" />
                </div>
              </div>
            ))}
          </div>
          {/* Additional Access (Bonus — no extra charge) */}
          <AdditionalAccessEditor data={d} onSet={set} catalog={ecCatalog} />
          {/* Order Bumps */}
          <div className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700">Order Bumps ({ecBumps.length})</span><button onClick={() => set("orderBumps", [...ecBumps, { title: "Add-on Offer", headline: "Special one-time offer!", description: "Enhance your purchase with this exclusive add-on.", price: 2700, imageUrl: "", ctaText: "+ Add to my order", highlightColor: "#f59e0b", animation: "pulse" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add Bump</button></div>
            {ecBumps.map((bump: any, i: number) => (
              <div key={i} className="border border-gray-100 rounded p-2 space-y-1">
                <div className="flex justify-between items-center"><span className="text-xs font-semibold text-gray-600">Bump {i + 1}</span><button onClick={() => set("orderBumps", ecBumps.filter((_: any, j: number) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div>
                <DebouncedInput value={bump.headline ?? ""} onChange={v => set("orderBumps", ecBumps.map((b: any, j: number) => j === i ? { ...b, headline: v } : b))} className="h-7 text-xs" placeholder="Eyebrow headline (e.g. ✦ Special Add-On!)" />
                <DebouncedInput value={bump.title ?? ""} onChange={v => set("orderBumps", ecBumps.map((b: any, j: number) => j === i ? { ...b, title: v } : b))} className="h-7 text-xs" placeholder="Bump title" />
                <DebouncedTextarea value={bump.description ?? ""} onChange={v => set("orderBumps", ecBumps.map((b: any, j: number) => j === i ? { ...b, description: v } : b))} className="text-xs min-h-[50px]" placeholder="Short description" />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-400">Price (cents)</label><Input type="number" value={bump.price ?? 0} onChange={e => set("orderBumps", ecBumps.map((b: any, j: number) => j === i ? { ...b, price: Number(e.target.value) } : b))} className="h-7 text-xs" /></div>
                  <div><label className="text-xs text-gray-400">Animation</label><select value={bump.animation ?? "pulse"} onChange={e => set("orderBumps", ecBumps.map((b: any, j: number) => j === i ? { ...b, animation: e.target.value } : b))} className="h-7 w-full text-xs rounded border border-gray-200 px-2"><option value="pulse">Pulse Border</option><option value="glow">Glow Border</option><option value="shake">Shake</option><option value="bounce">Bounce</option><option value="none">None</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-400">Highlight Color</label><input type="color" value={bump.highlightColor ?? "#f59e0b"} onChange={e => set("orderBumps", ecBumps.map((b: any, j: number) => j === i ? { ...b, highlightColor: e.target.value } : b))} className="h-7 w-full rounded border border-gray-200" /></div>
                  <div><label className="text-xs text-gray-400">CTA Text</label><DebouncedInput value={bump.ctaText ?? ""} onChange={v => set("orderBumps", ecBumps.map((b: any, j: number) => j === i ? { ...b, ctaText: v } : b))} className="h-7 text-xs" placeholder="+ Add to my order" /></div>
                </div>
                <DebouncedInput value={bump.imageUrl ?? ""} onChange={v => set("orderBumps", ecBumps.map((b: any, j: number) => j === i ? { ...b, imageUrl: v } : b))} className="h-7 text-xs" placeholder="Image URL (optional)" />
              </div>
            ))}
          </div>
          {/* Submit & Redirect */}
          <BSTextField data={d} onSet={set} label="Submit Button Text" field="submitText" placeholder="Complete Purchase" />
          <BSSelectField data={d} onSet={set} label="Submit Button Icon" field="submitIcon" options={SUBMIT_ICON_OPTIONS} />
          <SuccessRedirectPicker value={d.successRedirect ?? ""} onChange={v => set("successRedirect", v)} />
          <BSTextField data={d} onSet={set} label="Success Message (if no redirect)" field="successMessage" multiline />
          {/* Terms */}
          <div className="grid grid-cols-2 gap-2">
            <BSTextField data={d} onSet={set} label="Terms Text" field="termsText" placeholder="I agree to the" />
            <BSTextField data={d} onSet={set} label="Terms Link Text" field="termsLinkText" placeholder="Terms of Service" />
          </div>
          <BSTextField data={d} onSet={set} label="Terms Link URL" field="termsLinkUrl" placeholder="https://www.allaboutultrasound.com/terms-of-service.html" />
          {/* Colors */}
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
        </div>
      );
    }
    case "checkout_form": {
      const cfProds: Array<{ name: string; description: string; price: number; imageUrl: string; type: string; strikethroughPrice?: string }> = d.products ?? [];
      const cfBumps: Array<{ title: string; headline: string; description: string; price: number; imageUrl: string; ctaText: string; ctaEmoji: string; externalUrl: string }> = d.orderBumps ?? [];
      return <CheckoutFormBlockSettings d={d} set={set} cfProds={cfProds} cfBumps={cfBumps} />;
    }
    case "curriculum_auto":
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Section Headline" field="headline" />
          <BSColorField data={d} onSet={set} label="Headline Color" field="headlineColor" />
          <BSColorField data={d} onSet={set} label="Block Background" field="bgColor" />
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Section Headers</p>
            <div className="space-y-2">
              <BSColorField data={d} onSet={set} label="Header Background" field="sectionBgColor" />
              <BSColorField data={d} onSet={set} label="Header Text" field="sectionTextColor" />
              <BSColorField data={d} onSet={set} label="Border / Divider" field="sectionBorderColor" />
              <BSColorField data={d} onSet={set} label="Lesson Count Text" field="lessonCountColor" />
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lessons</p>
            <div className="space-y-2">
              <BSColorField data={d} onSet={set} label="Lesson Text" field="lessonTextColor" />
              <BSColorField data={d} onSet={set} label="Locked Icon" field="lessonLockedIconColor" />
              <BSColorField data={d} onSet={set} label="Preview Icon" field="lessonPreviewIconColor" />
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Icon Style</p>
            <div className="flex gap-2">
              {["lock","circle","none"].map(s => (
                <button key={s} onClick={() => set("iconStyle", s)}
                  className={`flex-1 py-1 rounded text-xs font-medium border ${(d.iconStyle ?? "lock") === s ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200"}`}>
                  {s === "lock" ? "🔒 Lock" : s === "circle" ? "⭕ Circle" : "— None"}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t pt-3">
            <label className="text-xs text-gray-500 block mb-1">Corner Radius (px)</label>
            <input type="range" min={0} max={24} step={2} value={d.cornerRadius ?? 12} onChange={e => set("cornerRadius", Number(e.target.value))} className="w-full" />
            <span className="text-xs text-gray-400">{d.cornerRadius ?? 12}px</span>
          </div>
          <div className="flex items-center gap-2 border-t pt-3">
            <input type="checkbox" checked={d.showLocked ?? true} onChange={e => set("showLocked", e.target.checked)} className="rounded" />
            <label className="text-xs text-gray-600">Show locked lessons</label>
          </div>
        </div>
      );
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
    case "lesson_quiz":
      return (
        <LessonQuizBlockEditor
          data={d as any}
          onChange={(newData) => onChange(newData as any)}
          lessonId={lessonId}
          handleFileUpload={async (file, targetField, context) => {
            if (file.size > 40 * 1024 * 1024) { toast.error("File must be under 40 MB"); return null; }
            setUploading(targetField);
            try {
              const reader = new FileReader();
              const dataUri = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
              const result = await uploadMedia.mutateAsync({ dataUri, mimeType: file.type, fileName: file.name, context });
              setUploading(null);
              return result.url;
            } catch (err: any) { toast.error(err.message || "Upload failed"); setUploading(null); return null; }
          }}
        />
      );
    case "lesson_flashcard":
      return (
        <LessonFlashcardBlockEditor
          data={d as any}
          onChange={(newData) => onChange(newData as any)}
          lessonId={lessonId}
          handleFileUpload={async (file, targetField, context) => {
            if (file.size > 40 * 1024 * 1024) { toast.error("File must be under 40 MB"); return null; }
            setUploading(targetField);
            try {
              const reader = new FileReader();
              const dataUri = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
              const result = await uploadMedia.mutateAsync({ dataUri, mimeType: file.type, fileName: file.name, context });
              setUploading(null);
              return result.url;
            } catch (err: any) { toast.error(err.message || "Upload failed"); setUploading(null); return null; }
          }}
        />
      );
    case "file_download": {
      return <FileDownloadBlockSettings d={d} set={set} uploading={uploading} setUploading={setUploading} uploadMedia={uploadMedia} />;
    }
    case "scorm_embed": {
      return <ScormEmbedBlockSettings d={d} set={set} dataRef={dataRef} onChangeRef={onChangeRef} />;
    }
    case "url_embed": {
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">URL to Embed</label>
            <DebouncedInput value={d.url ?? ""} onChange={v => set("url", v)} className="h-8 text-xs" placeholder="https://example.com" />
            <p className="text-[10px] text-gray-400 mt-1">Enter any URL to display it in an iframe. Note: some sites block embedding.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Title (optional)</label>
            <DebouncedInput value={d.title ?? ""} onChange={v => set("title", v)} className="h-8 text-xs" placeholder="e.g. Interactive Reference" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Caption (optional)</label>
            <DebouncedInput value={d.caption ?? ""} onChange={v => set("caption", v)} className="h-8 text-xs" placeholder="Shown below the embed" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Height (px)</label>
            <DebouncedInput value={String(d.height ?? 600)} onChange={v => set("height", Number(v) || 600)} className="h-8 text-xs" placeholder="600" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Background Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={d.bgColor ?? "#ffffff"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
              <DebouncedInput value={d.bgColor ?? "#ffffff"} onChange={v => set("bgColor", v)} className="h-8 text-xs flex-1" placeholder="#ffffff" />
            </div>
          </div>
        </div>
      );
    }
    case "column_layout": {
      const leftBlocks: Block[] = d.leftBlocks ?? [];
      const rightBlocks: Block[] = d.rightBlocks ?? [];
      const ColumnBlockList = ({ side, blocks }: { side: "left" | "right"; blocks: Block[] }) => {
        const [addOpen, setAddOpen] = useState(false);
        const [addCat, setAddCat] = useState(CATALOG_CATEGORIES[0]);
        const updateBlocks = (newBlocks: Block[]) => set(side === "left" ? "leftBlocks" : "rightBlocks", newBlocks);
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600 capitalize">{side} Column</span>
              <button onClick={() => setAddOpen(v => !v)} className="text-xs text-teal-600 flex items-center gap-1 hover:text-teal-700"><Plus size={11} /> Add Block</button>
            </div>
            {addOpen && (
              <div className="bg-gray-50 border border-gray-200 rounded p-2 space-y-1 mb-2">
                <div className="flex gap-1 flex-wrap">
                  {CATALOG_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setAddCat(cat)} className={`text-[10px] px-2 py-0.5 rounded-full border ${addCat === cat ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-500"}`}>{cat}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                  {BLOCK_CATALOG.filter(c => c.category === addCat && c.type !== "column_layout").map(c => (
                    <button key={c.type} onClick={() => {
                      const newBlock: Block = { id: uid(), type: c.type, data: { ...c.defaultData } };
                      updateBlocks([...blocks, newBlock]);
                      setAddOpen(false);
                    }} className="text-[10px] text-left px-2 py-1 rounded border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-600 truncate">{c.label}</button>
                  ))}
                </div>
              </div>
            )}
            {blocks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded p-3 text-center text-gray-400 text-xs">No blocks yet — click Add Block</div>
            ) : (
              <div className="space-y-1">
                {blocks.map((b, i) => (
                  <div key={b.id} className="border border-gray-200 rounded p-2 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-gray-600 truncate flex-1">{BLOCK_CATALOG.find(c => c.type === b.type)?.label ?? b.type}</span>
                      <div className="flex gap-0.5">
                        <button disabled={i === 0} onClick={() => { const nb = [...blocks]; [nb[i-1], nb[i]] = [nb[i], nb[i-1]]; updateBlocks(nb); }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-teal-600 disabled:opacity-30"><ChevronUp size={10} /></button>
                        <button disabled={i === blocks.length - 1} onClick={() => { const nb = [...blocks]; [nb[i], nb[i+1]] = [nb[i+1], nb[i]]; updateBlocks(nb); }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-teal-600 disabled:opacity-30"><ChevronDown size={10} /></button>
                        <button onClick={() => updateBlocks(blocks.filter((_, j) => j !== i))} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500"><X size={10} /></button>
                      </div>
                    </div>
                    <BlockSettings block={b} onChange={newData => {
                      const nb = blocks.map((bl, j) => j === i ? { ...bl, data: newData } : bl);
                      updateBlocks(nb);
                    }} lessonId={lessonId} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      };
      return (
        <div className="space-y-3">
          <ColumnBlockList side="left" blocks={leftBlocks} />
          <div className="border-t border-gray-100 pt-3">
            <ColumnBlockList side="right" blocks={rightBlocks} />
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div><label className="text-xs text-gray-500 block mb-1">Left Column Width (%)</label><Input type="number" value={d.leftRatio ?? 50} onChange={e => set("leftRatio", Number(e.target.value))} className="h-8 text-sm" min={20} max={80} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Gap (px)</label><Input type="number" value={d.gap ?? 32} onChange={e => set("gap", Number(e.target.value))} className="h-8 text-sm" min={0} max={80} /></div>
            <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          </div>
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

// ─── Column Drop Zone ─────────────────────────────────────────────────────────
function ColumnDropZone({ id, blocks, activeDragId, isTargeted, onMoveOut }: {
  id: string; blocks: Block[]; activeDragId: UniqueIdentifier | null;
  isTargeted?: boolean;
  onMoveOut: (childBlockId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  // isTargeted comes from parent (tracked via onDragOver state); isOver is from dnd-kit
  const isActive = isTargeted || (isOver && activeDragId != null);
  return (
    <div ref={setNodeRef} style={{ pointerEvents: "all" }} className={`flex-1 min-h-[120px] rounded-lg transition-all ${isActive ? "ring-2 ring-teal-400 bg-teal-50" : "bg-gray-50/50"}`}>
      {blocks.length === 0 ? (
        <div className={`h-full min-h-[120px] flex flex-col items-center justify-center gap-1 text-xs rounded-lg border-2 border-dashed transition-all ${isActive ? "border-teal-400 text-teal-600 bg-teal-50" : "border-gray-200 text-gray-400"}`}>
          {isActive ? <><span className="text-lg">+</span><span>Drop here</span></> : <span>Drag blocks here</span>}
        </div>
      ) : (
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1 p-1">
            {blocks.map(b => (
              <ColumnChildBlock key={b.id} block={b} onMoveOut={() => onMoveOut(b.id)} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

// ─── Column Child Block (sortable within a column) ────────────────────────────
function ColumnChildBlock({ block, onMoveOut }: { block: Block; onMoveOut: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="relative group border border-gray-200 rounded bg-white overflow-hidden">
      <div className="absolute top-1 left-1 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <div {...attributes} {...listeners} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-gray-600 flex items-center justify-center cursor-grab active:cursor-grabbing" title="Drag to reorder"><GripVertical size={11} /></div>
        <button onClick={e => { e.stopPropagation(); onMoveOut(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-orange-500 flex items-center justify-center" title="Move out of column"><ArrowRight size={11} /></button>
      </div>
      <div className="pointer-events-none">
        <BlockPreview block={block} />
      </div>
    </div>
  );
}

export function SortableBlock({ block, isSelected, onSelect, onDelete, onDuplicate, onMoveUp, onMoveDown, onSaveAsTemplate, coursePrice, courseTitle, activeDragId, activeColumnTarget, onMoveBlockOutOfColumn }: {
  block: Block; isSelected: boolean; onSelect: () => void; onDelete: () => void; onDuplicate: () => void; onMoveUp?: () => void; onMoveDown?: () => void; onSaveAsTemplate?: (block: Block) => void; coursePrice?: number; courseTitle?: string;
  activeDragId?: UniqueIdentifier | null;
  activeColumnTarget?: { blockId: string; side: "left" | "right" } | null;
  onMoveBlockOutOfColumn?: (colBlockId: string, side: "left" | "right", childBlockId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const isColumnLayout = block.type === "column_layout";
  const leftBlocks: Block[] = block.data?.leftBlocks ?? [];
  const rightBlocks: Block[] = block.data?.rightBlocks ?? [];

  // For column_layout blocks: keep them fully visible during drag so drop zones stay measurable.
  // For other blocks: fade to 50% opacity so the DragOverlay ghost is visible on top.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? (isColumnLayout ? 1 : 0.5) : 1,
  };
  const leftRatio = block.data?.leftRatio ?? 50;
  const gap = block.data?.gap ?? 32;

  return (
    <div ref={setNodeRef} style={style} onClick={onSelect} data-block-id={block.id}
      className={`relative group cursor-pointer border-2 transition-all ${isSelected ? "border-teal-500 shadow-lg shadow-teal-100" : "border-transparent hover:border-teal-200"}`}>
      <div className={`absolute top-2 right-2 z-10 flex gap-1 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-teal-600 flex items-center justify-center" title="Duplicate"><Copy size={12} /></button>
        {onSaveAsTemplate && <SaveAsTemplateButton block={block} blockLabel={BLOCK_CATALOG.find(c => c.type === block.type)?.label ?? block.type} className="w-7 h-7 bg-white border border-gray-200 rounded shadow flex items-center justify-center" />}
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
      <div style={{ marginTop: block.data?.marginTop ? `${block.data.marginTop}px` : undefined, marginBottom: block.data?.marginBottom ? `${block.data.marginBottom}px` : undefined, paddingTop: block.data?.paddingTop ? `${block.data.paddingTop}px` : undefined, paddingBottom: block.data?.paddingBottom ? `${block.data.paddingBottom}px` : undefined, paddingLeft: block.data?.paddingLeft ? `${block.data.paddingLeft}px` : undefined, paddingRight: block.data?.paddingRight ? `${block.data.paddingRight}px` : undefined }}>
        {isColumnLayout ? (
          <div style={{ backgroundColor: block.data?.bgColor ?? "transparent", padding: `${block.data?.paddingY ?? 16}px ${block.data?.paddingX ?? 32}px` }}>
            <div className="flex items-stretch" style={{ gap: `${gap}px` }}>
              <div style={{ flex: leftRatio, minWidth: 0 }}>
                <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Left Column</p>
                <ColumnDropZone
                  id={`col:${block.id}:left`}
                  blocks={leftBlocks}
                  activeDragId={activeDragId ?? null}
                  isTargeted={!!(activeDragId && activeColumnTarget?.blockId === block.id && activeColumnTarget?.side === "left")}
                  onMoveOut={childId => onMoveBlockOutOfColumn?.(block.id, "left", childId)}
                />
              </div>
              <div style={{ flex: 100 - leftRatio, minWidth: 0 }}>
                <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Right Column</p>
                <ColumnDropZone
                  id={`col:${block.id}:right`}
                  blocks={rightBlocks}
                  activeDragId={activeDragId ?? null}
                  isTargeted={!!(activeDragId && activeColumnTarget?.blockId === block.id && activeColumnTarget?.side === "right")}
                  onMoveOut={childId => onMoveBlockOutOfColumn?.(block.id, "right", childId)}
                />
              </div>
            </div>
          </div>
        ) : (
          <BlockPreview block={block} coursePrice={coursePrice} courseTitle={courseTitle} />
        )}
      </div>
    </div>
  );
}

// ─── Template Library Panel ───────────────────────────────────────────────────

function TemplateLibrary({ blocks, onInsert, onClose, initialTab }: {
  blocks: Block[];
  onInsert: (tplBlocks: Block[]) => void;
  onClose: () => void;
  initialTab?: "page" | "block";
}) {
  const [tab, setTab] = useState<"page" | "block">(initialTab ?? "page");
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
  const [templatesInitialTab, setTemplatesInitialTab] = useState<"page" | "block">("page");
  const [activeCat, setActiveCat] = useState<string>("Layout");
  // Block picker modal state
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"catalog" | "from_pages" | "templates">("catalog");
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [blockSearch, setBlockSearch] = useState("");
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
  const [activeColumnTarget, setActiveColumnTarget] = useState<{ blockId: string; side: "left" | "right" } | null>(null);
  // Use a ref so handleDragEnd always reads the latest column target (avoids stale closure)
  const activeColumnTargetRef = useRef<{ blockId: string; side: "left" | "right" } | null>(null);
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

  // ─── Cross-list DnD helpers ───────────────────────────────────────────────
  // Column drop zone IDs use the format: "col:BLOCK_ID:left" or "col:BLOCK_ID:right"
  const parseColId = (id: UniqueIdentifier): { blockId: string; side: "left" | "right" } | null => {
    const s = String(id);
    if (!s.startsWith("col:")) return null;
    const parts = s.split(":");
    if (parts.length < 3) return null;
    return { blockId: parts[1], side: parts[2] as "left" | "right" };
  };

  // Keep a stable ref to blocks so handleDragEnd always sees the latest state
  const blocksRef = useRef<Block[]>([]);
  blocksRef.current = blocks;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id);
    setActiveColumnTarget(null);
    activeColumnTargetRef.current = null;
  };

  // onDragOver fires continuously — use it to track which column zone the pointer is over
  const handleDragOver = (event: any) => {
    const overId = event.over?.id ? String(event.over.id) : null;
    if (overId && overId.startsWith("col:")) {
      const parsed = parseColId(overId);
      setActiveColumnTarget(parsed);
      activeColumnTargetRef.current = parsed;
    } else {
      setActiveColumnTarget(null);
      activeColumnTargetRef.current = null;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // Read from ref (not state) to avoid stale closure
    const currentTarget = activeColumnTargetRef.current;
    setActiveDragId(null);
    setActiveColumnTarget(null);
    activeColumnTargetRef.current = null;

    const { active } = event;
    const activeIdStr = String(active.id);
    const currentBlocks = blocksRef.current;

    // Case 1: Dropping onto a column zone — use the tracked target from onDragOver
    if (currentTarget) {
      const draggedBlock = currentBlocks.find(b => b.id === activeIdStr);
      if (!draggedBlock) return;
      if (draggedBlock.type === "column_layout") return; // prevent nesting
      setBlocks(prev => {
        const next = prev.filter(b => b.id !== activeIdStr);
        return next.map(b => {
          if (b.id !== currentTarget.blockId) return b;
          const colKey = currentTarget.side === "left" ? "leftBlocks" : "rightBlocks";
          const existing: Block[] = b.data[colKey] ?? [];
          return { ...b, data: { ...b.data, [colKey]: [...existing, draggedBlock] } };
        });
      });
      return;
    }

    const { over } = event;
    if (!over) return;
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    // Case 2: Reordering within a column (both active and over are inside the same column)
    for (const colBlock of currentBlocks) {
      if (colBlock.type !== "column_layout") continue;
      for (const side of ["leftBlocks", "rightBlocks"] as const) {
        const col: Block[] = colBlock.data[side] ?? [];
        const activeIdx = col.findIndex(cb => cb.id === activeIdStr);
        const overIdx = col.findIndex(cb => cb.id === overIdStr);
        if (activeIdx !== -1 && overIdx !== -1) {
          setBlocks(prev => prev.map(b => {
            if (b.id !== colBlock.id) return b;
            const c: Block[] = b.data[side] ?? [];
            return { ...b, data: { ...b.data, [side]: arrayMove(c, activeIdx, overIdx) } };
          }));
          return;
        }
      }
    }

    // Case 3: Reorder main canvas blocks
    setBlocks(prev => {
      const oldIndex = prev.findIndex(b => b.id === activeIdStr);
      const newIndex = prev.findIndex(b => b.id === overIdStr);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
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

  const saveBlockTemplateMutation = trpc.lmsAdmin.savePageTemplate.useMutation({
    onSuccess: () => toast.success("Block saved as global template!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSaveBlockAsTemplate = useCallback((block: Block) => {
    const label = BLOCK_CATALOG.find(c => c.type === block.type)?.label ?? block.type;
    const name = `${label} — ${new Date().toLocaleDateString()}`;
    saveBlockTemplateMutation.mutate({ name, description: `Saved from page builder`, templateType: "block", blocks: [block] });
  }, [saveBlockTemplateMutation]);

  const selectedBlock = blocks.find(b => b.id === selectedId);
  const catalogByCat = BLOCK_CATALOG.filter(c => c.category === activeCat);

  // Block picker: fetch courses with landing blocks (for "Copy from Other Pages" tab)
  const { data: coursesWithBlocks } = trpc.lmsAdmin.getCoursesWithLandingBlocks.useQuery(
    undefined,
    { enabled: addMenuOpen && pickerTab === "from_pages" }
  );
  const sourceCourseBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceCourseId || !coursesWithBlocks) return [];
    const course = coursesWithBlocks.find((c: any) => c.id === selectedSourceCourseId);
    if (!course?.blocks) return [];
    try {
      const parsed = typeof course.blocks === "string" ? JSON.parse(course.blocks) : course.blocks;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [selectedSourceCourseId, coursesWithBlocks]);
  const filteredSourceBlocks = useMemo(() => {
    if (!blockSearch.trim()) return sourceCourseBlocks;
    const q = blockSearch.toLowerCase();
    return sourceCourseBlocks.filter((b: Block) =>
      b.type.toLowerCase().includes(q) ||
      JSON.stringify(b.data).toLowerCase().includes(q)
    );
  }, [sourceCourseBlocks, blockSearch]);
  const copyBlockFromSource = (block: Block) => {
    const copy: Block = { ...block, id: uid() };
    setBlocks(prev => [...prev, copy]);
    setSelectedId(copy.id);
    toast.success("Block copied!");
    setAddMenuOpen(false);
  };
  const copyAllBlocksFromSource = () => {
    if (!sourceCourseBlocks.length) return;
    const copies = sourceCourseBlocks.map((b: Block) => ({ ...b, id: uid() }));
    setBlocks(prev => [...prev, ...copies]);
    toast.success(`${copies.length} block${copies.length > 1 ? "s" : ""} copied!`);
    setAddMenuOpen(false);
  };

  return (
    <>
    <BlockTemplateLibraryProvider onInsert={(block) => { setBlocks(prev => [...prev, block]); setSelectedId(block.id); }}>
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
          <button onClick={() => { setTemplatesInitialTab("page"); setShowTemplates(true); }} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
            <FolderOpen size={14} /> Page Templates
          </button>
          <OpenTemplateLibraryButton />
          <button onClick={() => { setTemplatesInitialTab("page"); setShowTemplates(true); }} className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-lg px-3 py-1.5 transition-colors" title="Save current page as a reusable template">
            <Bookmark size={14} /> Save as Template
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
        {/* Left Panel: Add Block button */}
        <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3">
            <button
              onClick={() => { setPickerTab("catalog"); setAddMenuOpen(true); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
            >
              <Plus size={14} /> Add Block
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs text-gray-400 text-center mt-4 px-2">Click "Add Block" to open the block picker with all block types, copy blocks from other pages, or insert saved templates.</p>
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center"><Plus size={24} /></div>
              <button
                onClick={() => { setPickerTab("catalog"); setAddMenuOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
              >
                <Plus size={16} /> Add Your First Block
              </button>
              <p className="text-sm">Open the block picker to add content</p>
              <button onClick={() => setShowTemplates(true)} className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1.5"><FolderOpen size={16} /> Or start from a template</button>
            </div>
          ) : (
            <div className="bg-white min-h-full shadow-sm mx-auto" style={{ maxWidth: "900px" }}>
              <DndContext sensors={sensors}
                collisionDetection={(args) => {
                  // pointerWithin detects col: droppable zones; closestCorners handles tall-block reordering
                  const pointer = pointerWithin(args);
                  if (pointer.length > 0) return pointer;
                  return closestCorners(args);
                }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <SortableBlock key={block.id} block={block} isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)} onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)} coursePrice={courseInfo?.price} courseTitle={courseInfo?.title}
                      onSaveAsTemplate={handleSaveBlockAsTemplate}
                      activeDragId={activeDragId}
                      activeColumnTarget={activeColumnTarget}
                      onMoveUp={idx > 0 ? () => setBlocks(prev => arrayMove(prev, idx, idx - 1)) : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => setBlocks(prev => arrayMove(prev, idx, idx + 1)) : undefined}
                      onMoveBlockOutOfColumn={(colBlockId, side, childBlockId) => {
                        setBlocks(prev => {
                          let movedBlock: Block | null = null;
                          const next = prev.map(b => {
                            if (b.id !== colBlockId) return b;
                            const colKey = side === "left" ? "leftBlocks" : "rightBlocks";
                            const col: Block[] = b.data[colKey] ?? [];
                            const child = col.find(cb => cb.id === childBlockId);
                            if (child) movedBlock = child;
                            return { ...b, data: { ...b.data, [colKey]: col.filter(cb => cb.id !== childBlockId) } };
                          });
                          if (!movedBlock) return prev;
                          const colIdx = next.findIndex(b => b.id === colBlockId);
                          const insertAt = colIdx + 1;
                          return [...next.slice(0, insertAt), movedBlock, ...next.slice(insertAt)];
                        });
                      }}
                    />
                  ))}
                </SortableContext>
                <DragOverlay>
                  {activeDragId ? (() => {
                    const b = blocks.find(bl => bl.id === activeDragId) ??
                      blocks.flatMap(bl => bl.type === "column_layout" ? [...(bl.data.leftBlocks ?? []), ...(bl.data.rightBlocks ?? [])] : []).find(bl => bl.id === activeDragId);
                    return b ? <div className="opacity-80 border-2 border-teal-400 rounded shadow-xl bg-white"><BlockPreview block={b} /></div> : null;
                  })() : null}
                </DragOverlay>
              </DndContext>
              <div className="flex justify-center py-6 border-t border-dashed border-gray-200">
                <button
                  onClick={() => { setPickerTab("catalog"); setAddMenuOpen(true); }}
                  className="w-full max-w-xs border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-xl py-3 text-teal-600 hover:text-teal-700 text-sm flex items-center justify-center gap-2 transition-colors bg-white"
                >
                  <Plus size={16} /> Add Block
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
        <TemplateLibrary blocks={blocks} onInsert={insertTemplateBlocks} onClose={() => setShowTemplates(false)} initialTab={templatesInitialTab} />
      )}
    </div>
    </BlockTemplateLibraryProvider>
    {/* ── Block Picker Modal ── */}
    <Dialog open={addMenuOpen} onOpenChange={open => { setAddMenuOpen(open); if (!open) setBlockSearch(""); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-teal-700 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add Content Block
          </DialogTitle>
        </DialogHeader>
        {/* Top-level tabs */}
        <div className="flex gap-1 border-b border-gray-200 shrink-0 -mx-1 px-1">
          <button onClick={() => setPickerTab("catalog")} className={cn("px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5", pickerTab === "catalog" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
            <Plus className="w-3.5 h-3.5" /> New Block
          </button>
          <button onClick={() => setPickerTab("from_pages")} className={cn("px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5", pickerTab === "from_pages" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
            <BookOpen className="w-3.5 h-3.5" /> Copy from Other Pages
          </button>
          <button onClick={() => setPickerTab("templates")} className={cn("px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5", pickerTab === "templates" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
            <Layers className="w-3.5 h-3.5" /> Block Templates
          </button>
        </div>
        {/* ── Catalog tab ── */}
        {pickerTab === "catalog" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex border-b border-gray-200 overflow-x-auto bg-gray-50 shrink-0">
              {CATALOG_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)} className={cn("px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors", activeCat === cat ? "text-teal-700 border-b-2 border-teal-500 bg-white" : "text-gray-500 hover:text-gray-700")}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 p-1 overflow-y-auto flex-1">
              {catalogByCat.map(b => (
                <button key={b.type} onClick={() => { addBlock(b.type); setAddMenuOpen(false); }} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 text-gray-600 hover:text-teal-700 transition-all text-center">
                  <span className="text-teal-600 text-2xl">{b.icon}</span>
                  <span className="text-xs leading-tight font-medium">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* ── Copy from Other Pages tab ── */}
        {pickerTab === "from_pages" && (
          <div className="flex flex-1 overflow-hidden gap-3 min-h-0">
            <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto border-r border-gray-100 pr-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Course Landing Page</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                  value={selectedSourceCourseId ?? ""}
                  onChange={e => { setSelectedSourceCourseId(e.target.value ? Number(e.target.value) : null); setBlockSearch(""); }}
                >
                  <option value="">— select course —</option>
                  {coursesWithBlocks?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {!selectedSourceCourseId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p>Select a course to browse its landing page blocks</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2 shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input value={blockSearch} onChange={e => setBlockSearch(e.target.value)} placeholder="Search blocks…" className="pl-7 h-7 text-xs" />
                    </div>
                    {sourceCourseBlocks.length > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0" onClick={copyAllBlocksFromSource}>
                        <Copy className="w-3 h-3 mr-1" /> Copy All ({sourceCourseBlocks.length})
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {filteredSourceBlocks.length === 0 ? (
                      <p className="text-xs text-gray-400 py-4 text-center">No blocks found.</p>
                    ) : filteredSourceBlocks.map((b: Block) => {
                      const catalogEntry = BLOCK_CATALOG.find(c => c.type === b.type);
                      return (
                        <div key={b.id} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {catalogEntry && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">{catalogEntry?.label ?? b.type}</p>
                              <p className="text-xs text-gray-400 truncate">{b.type}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => copyBlockFromSource(b)}>
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* ── Block Templates tab ── */}
        {pickerTab === "templates" && (
          <LandingBlockTemplatesTab onInsert={(block) => { setBlocks(prev => [...prev, block]); setSelectedId(block.id); toast.success("Block template inserted!"); setAddMenuOpen(false); }} />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

// ─── File Download Block Settings ─────────────────────────────────────────────
function FileDownloadBlockSettings({ d, set, uploading, setUploading, uploadMedia }: {
  d: Record<string, any>;
  set: (key: string, val: any) => void;
  uploading: string | null;
  setUploading: (v: string | null) => void;
  uploadMedia: any;
}) {
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaPage, setMediaPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: mediaData } = trpc.mediaRepo.listAssets.useQuery(
    { search: mediaSearch || undefined, page: mediaPage, pageSize: 12 },
    { enabled: showMediaPicker }
  );

  const handleFileUpload = async (file: File) => {
    if (file.size > 200 * 1024 * 1024) { toast.error("File must be under 200 MB"); return; }
    setUploading("file_download_file");
    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
      const result = await uploadMedia.mutateAsync({ dataUri, mimeType: file.type, fileName: file.name, context: "file-download-block" });
      set("fileUrl", result.url);
      set("fileName", file.name);
      set("fileSize", file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`);
      set("source", "upload");
      toast.success("File uploaded");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    setUploading(null);
  };

  const selectMediaAsset = (asset: any) => {
    const url = asset.currentVersion?.s3Url ?? "";
    const title = asset.title ?? asset.currentVersion?.fileName ?? "File";
    const size = asset.currentVersion?.fileSize
      ? asset.currentVersion.fileSize > 1024 * 1024
        ? `${(asset.currentVersion.fileSize / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(asset.currentVersion.fileSize / 1024)} KB`
      : "";
    set("source", "media_repo");
    set("mediaAssetId", asset.id);
    set("mediaAssetTitle", title);
    set("mediaAssetUrl", url);
    set("fileName", asset.currentVersion?.fileName ?? title);
    set("fileSize", size);
    if (!d.label) set("label", title);
    setShowMediaPicker(false);
    toast.success("File selected from media repository");
  };

  const currentFileUrl = d.source === "media_repo" ? (d.mediaAssetUrl || "") : (d.fileUrl || "");
  const currentFileName = d.source === "media_repo" ? (d.mediaAssetTitle || d.fileName || "") : (d.fileName || "");

  return (
    <div className="space-y-3">
      {/* Display Mode */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Display Mode</label>
        <Select value={d.displayMode ?? "card"} onValueChange={v => set("displayMode", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="card">Download Card (button + icon)</SelectItem>
            <SelectItem value="inline">Inline Viewer (PDF/image/video + download)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* File Source */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">File Source</label>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading === "file_download_file"}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 disabled:opacity-50"
          >
            <Upload size={12} />
            {uploading === "file_download_file" ? "Uploading..." : "Upload File"}
          </button>
          <button
            onClick={() => setShowMediaPicker(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100"
          >
            <FolderOpen size={12} />
            Media Repo
          </button>
          <input ref={fileInputRef} type="file" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
        </div>
        {currentFileName && (
          <div className="mt-1.5 flex items-center gap-1.5 p-2 bg-gray-50 rounded text-xs text-gray-600 border border-gray-200">
            <Upload size={11} className="text-teal-600 flex-shrink-0" />
            <span className="truncate flex-1">{currentFileName}</span>
            {d.fileSize && <span className="text-gray-400 flex-shrink-0">{d.fileSize}</span>}
            <button onClick={() => { set("fileUrl", ""); set("fileName", ""); set("mediaAssetId", null); set("mediaAssetUrl", ""); set("mediaAssetTitle", ""); }} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={11} /></button>
          </div>
        )}
      </div>

      {/* Label & Description */}
      <BSTextField data={d} onSet={set} label="Label / Title" field="label" placeholder="Download File" />
      <BSTextField data={d} onSet={set} label="Description (optional)" field="description" placeholder="Brief description of the file" />

      {/* Button */}
      <BSTextField data={d} onSet={set} label="Button Text" field="buttonText" placeholder="Download" />
      <div className="grid grid-cols-2 gap-2">
        <BSColorField data={d} onSet={set} label="Button Color" field="buttonColor" />
        <BSColorField data={d} onSet={set} label="Button Text Color" field="buttonTextColor" />
      </div>
      <BSColorField data={d} onSet={set} label="Background Color" field="bgColor" />

      {/* Inline height (only for inline mode) */}
      {(d.displayMode ?? "card") === "inline" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Viewer Height (px)</label>
          <DebouncedInput value={d.inlineHeight ?? 600} onChange={v => set("inlineHeight", Number(v) || 600)} className="h-8 text-xs" placeholder="600" />
        </div>
      )}

      {/* Toggles */}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="fd-show-icon" checked={d.showIcon !== false} onChange={e => set("showIcon", e.target.checked)} className="rounded" />
        <label htmlFor="fd-show-icon" className="text-xs text-gray-600">Show icon</label>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="fd-show-size" checked={d.showFileSize !== false} onChange={e => set("showFileSize", e.target.checked)} className="rounded" />
        <label htmlFor="fd-show-size" className="text-xs text-gray-600">Show file size</label>
      </div>

      {/* Media Repo Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-800">Select from Media Repository</h3>
              <button onClick={() => setShowMediaPicker(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-3 border-b">
              <input
                type="text"
                placeholder="Search files..."
                value={mediaSearch}
                onChange={e => { setMediaSearch(e.target.value); setMediaPage(1); }}
                className="w-full h-8 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {!mediaData ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading...</div>
              ) : mediaData.assets.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No files found</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaData.assets.map((asset: any) => {
                    const url = asset.currentVersion?.s3Url ?? "";
                    const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].some(ext => url.toLowerCase().includes(`.${ext}`));
                    return (
                      <button
                        key={asset.id}
                        onClick={() => selectMediaAsset(asset)}
                        className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
                      >
                        {isImage ? (
                          <img src={url} alt={asset.title} className="w-full h-20 object-cover rounded" />
                        ) : (
                          <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center">
                            <Upload size={24} className="text-gray-400" />
                          </div>
                        )}
                        <p className="text-xs text-gray-700 font-medium truncate w-full text-center">{asset.title}</p>
                        {asset.currentVersion?.fileSize && (
                          <p className="text-[10px] text-gray-400">
                            {asset.currentVersion.fileSize > 1024 * 1024
                              ? `${(asset.currentVersion.fileSize / (1024 * 1024)).toFixed(1)} MB`
                              : `${Math.round(asset.currentVersion.fileSize / 1024)} KB`}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {mediaData && mediaData.total > mediaData.pageSize && (
              <div className="p-3 border-t flex items-center justify-between text-xs text-gray-500">
                <span>{mediaData.total} files total</span>
                <div className="flex gap-2">
                  <button disabled={mediaPage === 1} onClick={() => setMediaPage(p => p - 1)} className="px-2 py-1 rounded border disabled:opacity-40">Prev</button>
                  <span>Page {mediaPage}</span>
                  <button disabled={mediaPage * mediaData.pageSize >= mediaData.total} onClick={() => setMediaPage(p => p + 1)} className="px-2 py-1 rounded border disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SCORM / HTML Package Block Settings ─────────────────────────────────────
function ScormEmbedBlockSettings({ d, set, dataRef, onChangeRef }: {
  d: Record<string, any>;
  set: (key: string, value: any) => void;
  dataRef: React.MutableRefObject<Record<string, any>>;
  onChangeRef: React.MutableRefObject<(data: Record<string, any>) => void>;
}) {
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaSearch, setMediaSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const { data: mediaData } = trpc.mediaRepo.listAssets.useQuery(
    { page: mediaPage, pageSize: 12, search: mediaSearch || undefined },
    { enabled: showPicker }
  );

  // Filter to only HTML/SCORM/ZIP-compatible assets
  const scormTypes = ["html", "zip", "scorm", "lms"];
  const filteredAssets = (mediaData?.assets ?? []).filter((a: any) => {
    const mt = (a.mediaType ?? "").toLowerCase();
    const ext = (a.currentVersion?.fileName ?? a.title ?? "").split(".").pop()?.toLowerCase() ?? "";
    return scormTypes.some(t => mt.includes(t) || ext.includes(t));
  });

  return (
    <div className="space-y-3">
      {/* Selected asset display */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Selected File</label>
        {d.mediaAssetSlug ? (
          <div className="flex items-center gap-2 p-2 bg-teal-50 border border-teal-200 rounded-lg">
            <Package size={16} className="text-teal-600 flex-shrink-0" />
            <span className="text-sm text-teal-800 font-medium flex-1 truncate">{d.mediaAssetTitle || d.mediaAssetSlug}</span>
            <button
              onClick={() => { onChangeRef.current({ ...dataRef.current, mediaAssetId: null, mediaAssetSlug: "", mediaAssetTitle: "" }); }}
              className="text-teal-400 hover:text-red-500 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No file selected</p>
        )}
      </div>

      {/* Pick from media repo button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs gap-2"
        onClick={() => setShowPicker(v => !v)}
      >
        <FolderOpen size={13} />
        {showPicker ? "Close Media Library" : "Pick from Media Repository"}
      </Button>

      {/* Media picker panel */}
      {showPicker && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="p-2 border-b">
            <Input
              placeholder="Search files..."
              value={mediaSearch}
              onChange={e => { setMediaSearch(e.target.value); setMediaPage(1); }}
              className="h-7 text-xs"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!mediaData ? (
              <div className="p-4 text-center text-xs text-gray-400">Loading...</div>
            ) : (mediaData.assets?.length ?? 0) === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">No files found</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(filteredAssets.length > 0 ? filteredAssets : (mediaData?.assets ?? [])).map((asset: any) => (
                  <button
                    key={asset.id}
                    title={`${asset.title ?? asset.currentVersion?.fileName ?? asset.slug}\n${asset.mediaType ?? ""} · ${asset.slug}`}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-teal-50 text-left transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChangeRef.current({ ...dataRef.current, mediaAssetId: asset.id, mediaAssetSlug: asset.slug, mediaAssetTitle: asset.title ?? asset.currentVersion?.fileName ?? asset.slug ?? "" });
                      setShowPicker(false);
                    }}
                  >
                    <Package size={14} className="text-teal-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{asset.title ?? asset.currentVersion?.fileName ?? asset.slug}</p>
                      <p className="text-[10px] text-gray-400 truncate">{asset.mediaType ?? ""} · {asset.slug}</p>
                    </div>
                    {d.mediaAssetSlug === asset.slug && (
                      <span className="text-[10px] text-teal-600 font-semibold flex-shrink-0">Selected</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {mediaData && mediaData.total > mediaData.pageSize && (
            <div className="p-2 border-t flex items-center justify-between text-xs text-gray-500">
              <span>{mediaData.total} files</span>
              <div className="flex gap-1">
                <button disabled={mediaPage === 1} onClick={() => setMediaPage(p => p - 1)} className="px-2 py-1 rounded border disabled:opacity-40">Prev</button>
                <span className="px-1">Page {mediaPage}</span>
                <button disabled={mediaPage * mediaData.pageSize >= mediaData.total} onClick={() => setMediaPage(p => p + 1)} className="px-2 py-1 rounded border disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Title (optional label above iframe) */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Title (optional)</label>
        <DebouncedInput
          value={d.title ?? ""}
          onChange={v => set("title", v)}
          className="h-7 text-xs"
          placeholder="e.g. Interactive Module"
        />
      </div>

      {/* Caption */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Caption (optional)</label>
        <DebouncedInput
          value={d.caption ?? ""}
          onChange={v => set("caption", v)}
          className="h-7 text-xs"
          placeholder="Shown below the embed"
        />
      </div>

      {/* Height */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Height (px)</label>
        <DebouncedInput
          value={String(d.height ?? 600)}
          onChange={v => set("height", parseInt(v) || 600)}
          className="h-7 text-xs"
          placeholder="600"
        />
      </div>

      {/* Background color */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Background Color</label>
        <div className="flex gap-2 items-center">
          <input type="color" value={d.bgColor ?? "#ffffff"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-7 rounded cursor-pointer border border-gray-200" />
          <DebouncedInput value={d.bgColor ?? "#ffffff"} onChange={v => set("bgColor", v)} className="h-7 text-xs flex-1" placeholder="#ffffff" />
        </div>
      </div>

      {/* Embed URL preview */}
      {d.mediaAssetSlug && (
        <div className="text-[10px] text-gray-400 bg-gray-50 rounded p-2 font-mono break-all">
          /api/media/{d.mediaAssetSlug}/embed
        </div>
      )}
    </div>
  );
}

// ─── Block Templates Tab (shared across all page builders) ──────────────────
function LandingBlockTemplatesTab({ onInsert }: { onInsert: (block: Block) => void }) {
  const [search, setSearch] = useState("");
  const { data: templates, isLoading } = trpc.blockTemplates.list.useQuery({ search: search || undefined });
  const deleteMutation = trpc.blockTemplates.delete.useMutation({
    onSuccess: () => { toast.success("Template deleted"); },
  });
  const utils = trpc.useUtils();
  const handleDelete = (id: number) => {
    if (!confirm("Delete this template?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => utils.blockTemplates.list.invalidate(),
    });
  };
  return (
    <div className="flex flex-col flex-1 overflow-hidden gap-3">
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search saved templates…" className="pl-8 h-8 text-xs" />
      </div>
      {isLoading ? (
        <p className="text-xs text-gray-400 text-center py-6">Loading templates…</p>
      ) : !templates?.length ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
          <Layers className="w-8 h-8 opacity-30" />
          <p className="text-xs">No saved block templates yet.</p>
          <p className="text-xs text-gray-300">Hover a block and click the bookmark icon to save it as a template.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {templates.map((tpl: any) => {
            let blockData: Record<string, any> = {};
            try { blockData = typeof tpl.blockData === "string" ? JSON.parse(tpl.blockData) : (tpl.blockData ?? {}); } catch { /* ignore */ }
            const catalogEntry = BLOCK_CATALOG.find(c => c.type === tpl.blockType);
            const block: Block = { id: uid(), type: tpl.blockType as any, data: blockData };
            return (
              <div key={tpl.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  {catalogEntry && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{tpl.name}</p>
                    {tpl.description && <p className="text-xs text-gray-400 truncate">{tpl.description}</p>}
                    <p className="text-xs text-gray-300">{catalogEntry?.label ?? tpl.blockType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onInsert({ ...block, id: uid() })}>
                    <Plus className="w-3 h-3 mr-1" /> Insert
                  </Button>
                  <button className="w-6 h-6 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    onClick={() => handleDelete(tpl.id)} title="Delete template">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
