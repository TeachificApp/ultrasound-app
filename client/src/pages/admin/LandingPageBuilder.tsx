/**
 * LandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG landing page editor.
 * Route: /admin/lms/:courseId/landing-builder
 * Supports 25+ block types + Template Library (save/reuse pages and blocks).
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
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
  ShoppingCart, Package, Link, Mail, Phone, MapPin, Bookmark, BookmarkPlus, Music, UserPlus, Search,
  SlidersHorizontal, Radio, Clock, Loader2, ArrowLeftRight,
  Table2, LayoutList, FileText,
} from "lucide-react";
import AudioBlockEditor from "@/components/AudioBlockEditor";
import CarouselBlock from "@/components/CarouselBlock";
import LessonQuizBlockEditor from "@/components/LessonQuizBlockEditor";
import LessonFlashcardBlockEditor from "@/components/LessonFlashcardBlockEditor";
import { BlockTemplateLibraryProvider, OpenTemplateLibraryButton, SaveAsTemplateButton } from "@/components/BlockTemplateLibrary";


// ─── Block Types & BlockPreview (re-exported from shared component) ─────────
import type { BlockType, Block } from "@/components/BlockPreview";
export type { BlockType, Block } from "@/components/BlockPreview";
export { BlockPreview };
import UserParamTagsHelper from "@/components/UserParamTagsHelper";

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
    defaultData: { url: "", alt: "", caption: "", align: "center", maxWidth: "auto", linkUrl: "", openInNewTab: true, showShadow: true, noBorder: false } },
  { type: "video", label: "Video Embed", icon: <Video size={14} />, category: "Content",
    defaultData: { embedUrl: "", caption: "", autoplay: false, muted: true, loop: false, controls: true, trimStart: 0, trimEnd: 0, accentColor: "#189aa1" } },
  { type: "audio", label: "Audio Player", icon: <Music size={14} />, category: "Content",
    defaultData: { audioUrl: "", title: "", caption: "", autoplay: false, muted: false, loop: false, controls: true, trimStart: 0, trimEnd: 0, bgColor: "#f8fffe" } },
  { type: "embed", label: "Embed / iFrame", icon: <Globe size={14} />, category: "Content",
    defaultData: { embedCode: "", height: 400, caption: "" } },
  { type: "gallery", label: "Image Gallery", icon: <LayoutGrid size={14} />, category: "Content",
    defaultData: { images: [{ url: "", caption: "" }, { url: "", caption: "" }, { url: "", caption: "" }], columns: 3, bgColor: "#ffffff" } },
  { type: "carousel", label: "Carousel", icon: <SlidersHorizontal size={14} />, category: "Content",
    defaultData: { items: [], transition: "slide", autoPlayMs: 4000, showArrows: true, showDots: true, showCaptions: true, bgColor: "#0e1e2e", borderColor: "#189aa1", borderWidth: 2, borderRadius: 12, maxHeight: 480 } },
  // ── Marketing
  { type: "bullets", label: "Feature List", icon: <List size={14} />, category: "Marketing",
    defaultData: { headline: "What You'll Learn", items: ["Key concept one", "Key concept two", "Key concept three"], iconColor: "#179ca3", bgColor: "#f8fffe" } },
  { type: "numbered_list", label: "Numbered List", icon: <List size={14} />, category: "Marketing",
    defaultData: { headline: "Steps to Success", items: ["First step", "Second step", "Third step"], accentColor: "#179ca3", bgColor: "#ffffff" } },
  { type: "checklist", label: "Checklist", icon: <CheckSquare size={14} />, category: "Marketing",
    defaultData: { headline: "What You'll Get", items: ["First benefit", "Second benefit", "Third benefit"], accentColor: "#179ca3", bgColor: "#ffffff" } },
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
  { type: "countdown_v2", label: "Countdown Timer (Advanced)", icon: <Clock size={14} />, category: "Marketing",
    defaultData: {
      headline: "LIMITED TIME OFFER!", subtext: "",
      mode: "duration", // "duration" | "target_date"
      durationHours: 1, durationMinutes: 30,
      targetDate: "", targetTimezone: "local",
      showDays: true, showHours: true, showMinutes: true, showSeconds: true,
      expiredText: "This offer has expired.",
      bgColor: "#0e1e2e", textColor: "#ffffff", accentColor: "#179ca3",
      digitBg: "#1a2e3e", digitTextColor: "#ffffff", labelColor: "rgba(255,255,255,0.6)",
      separatorColor: "#179ca3", showBorder: false, borderColor: "#179ca3",
      digitSize: 56, labelSize: 11, cornerRadius: 8, gap: 12,
      showHeadline: true, headlineSize: 22, headlineWeight: "700",
    } },
  { type: "ticker", label: "Running Ticker / Marquee", icon: <Radio size={14} />, category: "Content",
    defaultData: {
      items: ["Welcome to All About Ultrasound!", "New courses available now!", "Expand your clinical skills today!"],
      separator: "•",
      direction: "left", speed: 40,
      pauseOnHover: true,
      bgColor: "#179ca3", textColor: "#ffffff",
      fontSize: 15, fontWeight: "500",
      paddingY: 10, letterSpacing: 0, textTransform: "none",
      borderTop: "", borderBottom: "",
    } },
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
      copyrightText: `© ${new Date().getFullYear()} All About Ultrasound. All rights reserved.`,
      links: [{ text: "Privacy Policy", url: "https://www.allaboutultrasound.com/privacy-policy.html" }, { text: "Terms of Service", url: "https://www.allaboutultrasound.com/terms-of-service.html" }, { text: "Contact", url: "https://www.allaboutultrasound.com/contact.html" }],
      showSocial: true, socialLinks: { facebook: "", instagram: "", youtube: "", linkedin: "" },
      logoUrl: "", logoMaxWidth: "120px",
    } },
  // ── Smart Sections
  { type: "curriculum_auto", label: "Curriculum (Auto)", icon: <BookOpen size={14} />, category: "Smart",
    defaultData: { headline: "Course Curriculum", headlineColor: "#111827", headlineAlign: "left", bgColor: "#ffffff", showLocked: true,
      sectionBgColor: "#f9fafb", sectionTextColor: "#1f2937", sectionBorderColor: "#e5e7eb",
      lessonTextColor: "#374151", lessonLockedIconColor: "#d1d5db", lessonPreviewIconColor: "#14b8a6",
      lessonCountColor: "#9ca3af", iconStyle: "lock", cornerRadius: 12 } },
  { type: "pricing_options_auto", label: "Pricing Options", icon: <CreditCard size={14} />, category: "Conversion",
    defaultData: { headline: "Choose Your Plan", bgColor: "#f9fafb" } },
  { type: "cohort_sessions_auto", label: "Live Sessions (Auto)", icon: <Timer size={14} />, category: "Content",
    defaultData: { headline: "Upcoming Live Sessions", headlineColor: "#111827", bgColor: "#ffffff", accentColor: "#179ca3", showDescription: true, showDuration: true } },
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
  // ── Form Embed
  { type: "form_embed", label: "Form Embed", icon: <FileText size={14} />, category: "Conversion",
    defaultData: {
      formId: null,
      formSlug: "",
      formName: "",
      displayMode: "inline",       // "inline" | "popup_enter" | "popup_exit" | "popup_click"
      headline: "",
      subtext: "",
      submitText: "Submit",
      triggerButtonText: "Open Form",
      enterDelayMs: 2000,
      accentColor: "#179ca3",
      bgColor: "#ffffff",
      textColor: "#111827",
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
  { type: "data_table", label: "Data Table", icon: <Table2 size={14} />, category: "Content",
    defaultData: {
      rows: [["Header 1", "Header 2", "Header 3"], ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"], ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"]],
      hasHeader: true, bordered: true, striped: true,
      caption: "",
      bgColor: "#ffffff", headerBg: "#f0fafa", headerTextColor: "#0e4a50", borderColor: "#d1fae5",
      fontSize: 14, textAlign: "left",
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
  { type: "live_session", label: "Live Session", icon: <Radio size={14} />, category: "Content",
    defaultData: {
      title: "Live Session",
      description: "",
      platform: "zoom",
      meetingUrl: "",
      scheduledAt: null,
      durationMinutes: 60,
      isRecurring: false,
      recurringLabel: "",
      earlyMinutes: 15,
      openInline: false,
      accentColor: "#189aa1",
      bgColor: "#f8fafc",
    } },
  { type: "file_upload", label: "File Upload", icon: <Upload size={14} />, category: "Content",
    defaultData: {
      label: "Upload Your File",
      instructions: "Please upload your completed work below.",
      acceptedTypes: "PDF, Word, Images",
      maxSizeMb: 10,
      folderName: "",
      accentColor: "#0d9488",
      bgColor: "#f8fafc",
      borderColor: "#e2e8f0",
    } },
);

// ─── Extra catalog entries ────────────────────────────────────────────────────
BLOCK_CATALOG.push(
  {
    type: "comparison_table",
    label: "Comparison Table",
    icon: <Table2 size={14} />,
    category: "Marketing",
    defaultData: {
      headline: "How We Compare",
      subtext: "See why our approach stands out.",
      columns: [
        { label: "Competitor", highlight: false },
        { label: "Us", highlight: true },
      ],
      rows: [
        { feature: "Feature One", values: [false, true] },
        { feature: "Feature Two", values: ["Limited", "Unlimited"] },
        { feature: "Feature Three", values: [false, true] },
      ],
      accentColor: "#179ca3",
      bgColor: "#ffffff",
    },
  },
  {
    type: "cohort_class",
    label: "Cohort Class",
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    category: "Content",
    defaultData: {
      title: "Cohort Class",
      description: "Join this live cohort class with your instructor and fellow students.",
      platform: "zoom",
      startDate: null,
      endDate: null,
      maxStudents: null,
      instructorName: "",
      sessions: [],
      ctaText: "Join Class",
      accentColor: "#189aa1",
      bgColor: "#f8fafc",
    },
  },
  {
    type: "lesson_assignment",
    label: "Lesson Assignment",
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    category: "Content",
    defaultData: {
      title: "Assignment",
      description: "",
      instructions: "",
      dueDate: null,
      submissionTypes: ["text"],
      rubricItems: [],
      submitButtonText: "Submit Assignment",
      allowLateSubmissions: false,
      latePenaltyPct: 0,
      accentColor: "#189aa1",
      bgColor: "#ffffff",
    },
  },
  {
    type: "upgrade_prompt",
    label: "Upgrade Prompt",
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    category: "Conversion",
    defaultData: {
      displayMode: "inline",
      productType: "course",
      productSlug: "",
      headline: "Ready to take the next step?",
      subheadline: "Unlock the full course and advance your skills.",
      ctaText: "Upgrade Now",
      dismissText: "No thanks",
      showDismiss: true,
      accentColor: "#179ca3",
      bgColor: "#f0fdfa",
      badgeText: "Special Offer",
      urgencyLabel: "",
      imageUrl: "",
      discountType: "none",
      discountValue: 0,
      promoCode: "",
      originalPriceCents: 0,
      triggerDelaySeconds: 5,
      triggerScrollPercent: 50,
    },
  },
  {
    type: "pricing_cards",
    label: "Pricing Cards",
    icon: <LayoutList size={14} />,
    category: "Conversion",
    defaultData: {
      headline: "Simple, Transparent Pricing",
      subtext: "Choose the plan that fits your needs.",
      tiers: [
        {
          name: "Starter",
          price: "$0",
          interval: "/ month",
          description: "Perfect for getting started",
          badge: "",
          features: ["Feature A", "Feature B"],
          ctaText: "Start Free",
          ctaLink: "#",
          highlighted: false,
        },
        {
          name: "Pro",
          price: "$49",
          interval: "/ month",
          description: "For growing teams",
          badge: "Most Popular",
          features: ["Everything in Starter", "Feature C", "Feature D"],
          ctaText: "Get Started",
          ctaLink: "#",
          highlighted: true,
        },
      ],
      accentColor: "#179ca3",
      bgColor: "#f8fffe",
    },
  },
  {
    type: "affiliate_signup",
    label: "Affiliate Signup",
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    category: "Marketing",
    defaultData: {
      headline: "Earn money by sharing what you love",
      subtext: "Join our affiliate program and earn a commission for every sale you refer. It's free to join and easy to get started.",
      ctaText: "Become an Affiliate",
      ctaLink: "/affiliate-dashboard",
      benefits: ["Earn up to 30% commission", "Real-time earnings dashboard", "Unique tracking links per course", "Monthly payouts via Stripe, PayPal, or ACH"],
      accentColor: "#179ca3",
      bgColor: "#f0fdf9",
      headlineColor: "#111827",
    },
  },
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

// ─── CTAActionPicker ─────────────────────────────────────────────────────────
type CTAAction =
  | "url" | "send_email" | "next_funnel_step" | "direct_checkout"
  | "free_preview" | "group_purchase" | "order_bump_lp"
  | "scroll_to_section" | "open_popup" | "download_file" | "pricing_option";

const CTA_ACTION_LABELS: Record<CTAAction, string> = {
  url: "Link to URL",
  send_email: "Send Email",
  next_funnel_step: "Next Funnel Step",
  direct_checkout: "Direct Checkout (Stripe)",
  free_preview: "Direct to Checkout (Free Preview)",
  group_purchase: "Direct to Checkout (Group Purchase)",
  order_bump_lp: "Order Bump Landing Page",
  pricing_option: "Pricing Option Checkout",
  scroll_to_section: "Scroll to Section",
  open_popup: "Open Video / Form / Popup",
  download_file: "Download File",
};

function CTAActionPicker({
  label = "Button Action",
  behaviorValue,
  onBehaviorChange,
  linkValue,
  onLinkChange,
  emailValue,
  onEmailChange,
  productCatalog,
  orderBumpsList,
  funnelList: _funnelList,
  orderBumpIdValue,
  onOrderBumpIdChange,
  anchorValue,
  onAnchorChange,
  popupValue,
  onPopupChange,
  downloadValue,
  onDownloadChange,
  checkoutProductTypeValue,
  checkoutProductIdValue,
  onCheckoutProductChange,
  groupDiscountTiersValue,
  onGroupDiscountTiersChange,
  pricingOptionIdValue,
  onPricingOptionChange,
  pricingOptionCourseIdValue,
}: {
  label?: string;
  behaviorValue: string;
  onBehaviorChange: (v: string) => void;
  linkValue?: string;
  onLinkChange?: (v: string) => void;
  emailValue?: string;
  onEmailChange?: (v: string) => void;
  productCatalog?: Array<{ id: number; type: string; name: string; price: number }>;
  orderBumpsList?: Array<{ id: number; headline?: string | null; slug?: string | null; bumpType: string; bumpProductId: number }>;
  funnelList?: Array<{ id: number; name: string; slug: string; pages?: Array<{ id: number; name: string; slug: string }> }>;
  orderBumpIdValue?: number | null;
  onOrderBumpIdChange?: (v: number | null) => void;
  anchorValue?: string;
  onAnchorChange?: (v: string) => void;
  popupValue?: string;
  onPopupChange?: (v: string) => void;
  downloadValue?: string;
  onDownloadChange?: (v: string) => void;
  checkoutProductTypeValue?: string;
  checkoutProductIdValue?: number | null;
  onCheckoutProductChange?: (type: string, id: number | null) => void;
  groupDiscountTiersValue?: Array<{ minSeats: number; discountPercent: number }>;
  onGroupDiscountTiersChange?: (tiers: Array<{ minSeats: number; discountPercent: number }>) => void;
  pricingOptionIdValue?: number | null;
  onPricingOptionChange?: (courseId: number | null, pricingOptionId: number | null) => void;
  pricingOptionCourseIdValue?: number | null;
}) {
  const behavior = (behaviorValue ?? "url") as CTAAction;
  const isCheckoutBehavior = behavior === "direct_checkout" || behavior === "free_preview" || behavior === "group_purchase";
  // Pricing option picker state
  const [poCourseId, setPoCoursId] = React.useState<number | null>(pricingOptionCourseIdValue ?? null);
  const { data: poCoursesData } = trpc.lmsAdmin.listCourses.useQuery(
    { status: "all", type: "all", pageSize: 200 },
    { enabled: behavior === "pricing_option" }
  );
  const poCourses = (poCoursesData?.courses ?? []) as Array<{ id: number; title: string; type: string }>;
  const { data: poOptionsData } = trpc.lmsGroup.listPricingOptions.useQuery(
    { courseId: poCourseId! },
    { enabled: behavior === "pricing_option" && !!poCourseId }
  );
  const poOptions = (poOptionsData ?? []) as Array<{ id: number; label: string; pricingType: string; price: number }>;
  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs text-gray-500 block mb-1">{label}</label>
        <Select value={behavior} onValueChange={onBehaviorChange}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(CTA_ACTION_LABELS) as [CTAAction, string][]).map(([val, lbl]) => (
              <SelectItem key={val} value={val}>{lbl}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {behavior === "url" && (
        <BSLinkField label="Link URL" value={linkValue ?? ""} onChange={onLinkChange ?? (() => {})} />
      )}
      {behavior === "send_email" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Email Address</label>
          <DebouncedInput value={emailValue ?? ""} onChange={onEmailChange ?? (() => {})} className="h-7 text-xs" placeholder="e.g. hello@example.com" />
        </div>
      )}
      {behavior === "next_funnel_step" && (
        <p className="text-[10px] text-teal-600 bg-teal-50 rounded px-2 py-1">Button will navigate to the next page in the funnel sequence.</p>
      )}
      {isCheckoutBehavior && (
        <div className={`space-y-2 rounded p-2 border ${
          behavior === "direct_checkout" ? "bg-teal-50 border-teal-200" :
          behavior === "free_preview" ? "bg-blue-50 border-blue-200" :
          "bg-teal-50 border-teal-200"
        }`}>
          <p className={`text-[10px] font-medium ${
            behavior === "direct_checkout" ? "text-teal-700" :
            behavior === "free_preview" ? "text-blue-700" :
            "text-teal-700"
          }`}>
            {behavior === "direct_checkout" && "Opens Stripe Checkout. After payment, user is sent to /my-dashboard."}
            {behavior === "free_preview" && "Opens Stripe Checkout with a 100% discount (free preview). Product must support free enrollment."}
            {behavior === "group_purchase" && "Opens Stripe Checkout for group/team purchase. Buyer can specify number of seats."}
          </p>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Product</label>
            <select
              value={checkoutProductIdValue ? `${checkoutProductTypeValue}:${checkoutProductIdValue}` : ""}
              onChange={e => { const [type, id] = e.target.value.split(":"); onCheckoutProductChange?.(type || "", id ? Number(id) : null); }}
              className="w-full h-7 text-xs rounded border border-gray-200 px-2"
            >
              <option value="">-- Select product --</option>
              {(productCatalog ?? []).map(p => (
                <option key={`${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>{p.name} ({p.type}) — ${Number(p.price).toFixed(2)}</option>
              ))}
            </select>
          </div>
          {behavior === "group_purchase" && (
            <div className="border-t border-teal-200 pt-2 mt-1 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-teal-700">Volume Discount Tiers</p>
                <button
                  type="button"
                  onClick={() => onGroupDiscountTiersChange?.([...(groupDiscountTiersValue ?? []), { minSeats: 5, discountPercent: 10 }])}
                  className="text-[10px] text-teal-600 hover:text-teal-800 flex items-center gap-0.5"
                ><Plus size={10} /> Add Tier</button>
              </div>
              {(groupDiscountTiersValue ?? []).length === 0 && (
                <p className="text-[10px] text-teal-400 italic">No discount tiers. Buyer pays full price regardless of seat count.</p>
              )}
              {(groupDiscountTiersValue ?? []).map((tier, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-teal-600 whitespace-nowrap">If seats ≥</span>
                  <input
                    type="number" min={1} max={999} value={tier.minSeats}
                    onChange={e => { const next = [...(groupDiscountTiersValue ?? [])]; next[i] = { ...next[i], minSeats: Number(e.target.value) }; onGroupDiscountTiersChange?.(next); }}
                    className="w-14 h-6 text-xs rounded border border-teal-200 px-1 text-center"
                  />
                  <span className="text-[10px] text-teal-600 whitespace-nowrap">then discount</span>
                  <input
                    type="number" min={1} max={100} value={tier.discountPercent}
                    onChange={e => { const next = [...(groupDiscountTiersValue ?? [])]; next[i] = { ...next[i], discountPercent: Number(e.target.value) }; onGroupDiscountTiersChange?.(next); }}
                    className="w-14 h-6 text-xs rounded border border-teal-200 px-1 text-center"
                  />
                  <span className="text-[10px] text-teal-600">% per seat</span>
                  <button
                    type="button"
                    onClick={() => onGroupDiscountTiersChange?.((groupDiscountTiersValue ?? []).filter((_, j) => j !== i))}
                    className="ml-auto text-red-400 hover:text-red-600"
                  ><X size={10} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {behavior === "order_bump_lp" && (
        <div className="space-y-2 bg-orange-50 border border-orange-200 rounded p-2">
          <p className="text-[10px] text-orange-700 font-medium">Navigates to an Order Bump landing page (/order-bump/slug).</p>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Order Bump</label>
            <select
              value={orderBumpIdValue ?? ""}
              onChange={e => onOrderBumpIdChange?.(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-7 text-xs rounded border border-gray-200 px-2"
            >
              <option value="">-- Select order bump --</option>
              {(orderBumpsList ?? []).filter(b => b.slug).map(b => (
                <option key={b.id} value={b.id}>{b.headline ?? `Order Bump #${b.id}`} ({b.slug})</option>
              ))}
            </select>
          </div>
        </div>
      )}
      {behavior === "scroll_to_section" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Section Anchor ID</label>
          <DebouncedInput value={anchorValue ?? ""} onChange={onAnchorChange ?? (() => {})} className="h-7 text-xs" placeholder="e.g. pricing or #pricing" />
          <p className="text-[10px] text-gray-400 mt-0.5">Add <code className="bg-gray-100 px-0.5 rounded">id="pricing"</code> to a section block, then enter <code className="bg-gray-100 px-0.5 rounded">pricing</code> here.</p>
        </div>
      )}
      {behavior === "open_popup" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Video / Form / Popup URL or Embed Code</label>
          <DebouncedInput value={popupValue ?? ""} onChange={onPopupChange ?? (() => {})} className="h-7 text-xs" placeholder="https://youtube.com/... or &lt;iframe ...&gt;" />
          <p className="text-[10px] text-gray-400 mt-0.5">YouTube, Vimeo, Wistia URLs and iframe embed codes are supported.</p>
        </div>
      )}
      {behavior === "download_file" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">File URL</label>
          <DebouncedInput value={downloadValue ?? ""} onChange={onDownloadChange ?? (() => {})} className="h-7 text-xs" placeholder="https://... (direct file URL)" />
          <p className="text-[10px] text-gray-400 mt-0.5">Triggers a file download when clicked. Use a direct link to a PDF, ZIP, etc.</p>
        </div>
      )}
      {behavior === "pricing_option" && (
        <div className="space-y-2 bg-teal-50 border border-teal-200 rounded p-2">
          <p className="text-[10px] text-teal-700 font-medium">Links directly to a specific pricing option checkout for a course.</p>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Course</label>
            <select
              value={poCourseId ?? ""}
              onChange={e => {
                const id = e.target.value ? Number(e.target.value) : null;
                setPoCoursId(id);
                onPricingOptionChange?.(id, null);
              }}
              className="w-full h-7 text-xs rounded border border-gray-200 px-2"
            >
              <option value="">-- Select course --</option>
              {poCourses.map(c => (
                <option key={c.id} value={c.id}>{c.title} ({c.type})</option>
              ))}
            </select>
          </div>
          {poCourseId && (
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">Pricing Option</label>
              <select
                value={pricingOptionIdValue ?? ""}
                onChange={e => onPricingOptionChange?.(poCourseId, e.target.value ? Number(e.target.value) : null)}
                className="w-full h-7 text-xs rounded border border-gray-200 px-2"
              >
                <option value="">-- Select pricing option --</option>
                {poOptions.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.label} ({o.pricingType}) — ${Number(o.price).toFixed(2)}
                  </option>
                ))}
              </select>
              {poOptions.length === 0 && <p className="text-[10px] text-gray-400 mt-0.5">No pricing options found for this course.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Course selector for curriculum_auto block when used on funnel pages */
function CurriculumCourseSelector({ d, set }: { d: Record<string, any>; set: (key: string, val: any) => void }) {
  const { data: coursesData } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", type: "course", pageSize: 200 });
  const courses = (coursesData?.courses ?? []) as Array<{ id: number; title: string; type: string }>;
  const selectedId = d.courseId ? String(d.courseId) : "_auto";
  return (
    <div className="border-b pb-3 mb-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Course to Display</label>
      <Select value={selectedId} onValueChange={v => set("courseId", v === "_auto" ? null : Number(v))}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Auto (from page context)" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_auto">Auto (from page context)</SelectItem>
          {courses.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-gray-400 mt-1">On funnel pages, select the course whose curriculum to display. On course landing pages, leave as “Auto”.</p>
    </div>
  );
}

function PricingCtaSettings({ d, set, setMany }: { d: Record<string, any>; set: (key: string, val: any) => void; setMany: (patch: Record<string, any>) => void }) {
  const { data: coursesData } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", type: "all", pageSize: 100 });
  const allItems = (coursesData?.courses ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    type: c.type as string,
    slug: c.slug,
    price: c.isFree ? 0 : (c.price ?? 0),
    isFree: !!c.isFree,
    pricingType: (c.pricingType ?? "one_time") as string,
    subscriptionInterval: (c.subscriptionInterval ?? null) as string | null,
  }));

  // Three modes: "none" | "manual" | "linked"
  const priceSource = d.priceSource ?? "manual";

  // Auto-detect linked item from ctaLink URL when priceSource === "linked"
  const ctaLink: string = d.ctaLink ?? d.ctaUrl ?? "";
  const linkedFromUrl = priceSource === "linked"
    ? allItems.find((item: any) => {
        const urlMap: Record<string, string> = { course: `/courses/${item.slug}`, quiz: `/courses/${item.slug}`, cohort: `/courses/${item.slug}`, download: `/downloads/${item.slug}`, bundle: `/bundles/${item.slug}`, product: `/product/${item.slug}` };
        const expected = urlMap[item.type] ?? `/courses/${item.slug}`;
        return ctaLink && ctaLink.includes(expected);
      })
    : null;

  // When priceSource === "item" (manual item picker), use stored linkedItemId
  const selectedItemId = d.linkedItemId ? Number(d.linkedItemId) : null;
  const selectedItem = priceSource === "item"
    ? allItems.find((i: any) => i.id === selectedItemId)
    : null;

  // The item that drives the displayed price
  const activeItem = priceSource === "linked" ? linkedFromUrl : selectedItem;

    // Format price for display (price is stored in cents)
  const formatItemPrice = (item: typeof allItems[0]) => {
    if (item.isFree) return "Free";
    const priceStr = `$${(Number(item.price) / 100).toFixed(2)}`;
    if (item.pricingType === "subscription" && item.subscriptionInterval) {
      const intervalLabel: Record<string, string> = { monthly: "/ mo", quarterly: "/ qtr", annual: "/ yr" };
      return `${priceStr} ${intervalLabel[item.subscriptionInterval] ?? "/ period"}`;
    }
    return priceStr;
  };

  const handleItemSelect = (idStr: string) => {
    if (!idStr || idStr === "none") {
      setMany({ linkedItemId: null, linkedItemType: null, linkedItemSlug: null });
      return;
    }
    const item = allItems.find((i: any) => i.id === Number(idStr));
    if (!item) return;
    const urlMap: Record<string, string> = { course: `/courses/${item.slug}`, quiz: `/courses/${item.slug}`, cohort: `/courses/${item.slug}`, download: `/downloads/${item.slug}`, bundle: `/bundles/${item.slug}`, product: `/product/${item.slug}` };
    const autoUrl = urlMap[item.type] ?? `/courses/${item.slug}`;
    const priceDisplay = formatItemPrice(item);
    const intervalLabel = item.pricingType === "subscription" && item.subscriptionInterval
      ? ({ monthly: "/ mo", quarterly: "/ qtr", annual: "/ yr" }[item.subscriptionInterval] ?? "")
      : "";
    setMany({
      linkedItemId: item.id,
      linkedItemType: item.type,
      linkedItemSlug: item.slug,
      ctaUrl: autoUrl,
      ctaLink: autoUrl,
      currentPrice: priceDisplay,
      priceInterval: intervalLabel,
    });
  };

  // When priceSource changes to "linked", auto-populate from ctaLink if possible
  const handleSourceChange = (v: string) => {
    set("priceSource", v);
    if (v === "none") {
      setMany({ currentPrice: "", priceInterval: "" });
    } else if (v === "linked" && linkedFromUrl) {
      const priceDisplay = formatItemPrice(linkedFromUrl);
      const intervalLabel = linkedFromUrl.pricingType === "subscription" && linkedFromUrl.subscriptionInterval
        ? ({ monthly: "/ mo", quarterly: "/ qtr", annual: "/ yr" }[linkedFromUrl.subscriptionInterval] ?? "")
        : "";
      setMany({ currentPrice: priceDisplay, priceInterval: intervalLabel });
    }
  };

  return (
    <div className="space-y-3">
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
              <Select value={priceSource} onValueChange={handleSourceChange}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (hide price)</SelectItem>
                  <SelectItem value="manual">Manual entry</SelectItem>
                  <SelectItem value="linked">Linked — auto from button URL</SelectItem>
                  <SelectItem value="item">Linked — pick item manually</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Linked from button URL — auto-detected */}
            {priceSource === "linked" && (
              <div className="rounded bg-teal-50 border border-teal-200 px-2 py-1.5 text-xs text-teal-700">
                {linkedFromUrl
                  ? <><span className="font-medium">{linkedFromUrl.title}</span> — {formatItemPrice(linkedFromUrl)} · auto-detected from button URL</>
                  : <span className="text-amber-600">No matching item found for the current button URL. Set the button action to "Link to URL" pointing to a course or download first.</span>}
              </div>
            )}

            {/* Manual item picker */}
            {priceSource === "item" && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Select Item</label>
                <Select value={selectedItemId ? String(selectedItemId) : "none"} onValueChange={handleItemSelect}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Choose item…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {allItems.map((item: any) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        [{item.type}] {item.title} — {formatItemPrice(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeItem && (
                  <p className="text-xs text-teal-600 mt-1">
                    {formatItemPrice(activeItem)} · URL auto-set
                  </p>
                )}
              </div>
            )}

            {/* Manual price entry (shown for manual mode, or as override for linked/item) */}
            {priceSource !== "none" && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  {priceSource === "manual" ? "Price (displayed)" : "Price override (leave blank to use auto)"}
                </label>
                <DebouncedInput value={d.currentPrice ?? ""} onChange={v => set("currentPrice", v)} className="h-8 text-xs" placeholder={activeItem ? formatItemPrice(activeItem) : "e.g. $97 or Free"} />
              </div>
            )}

            {/* Interval label (auto-filled for subscriptions, but editable) */}
            {priceSource !== "none" && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Billing interval label <span className="text-gray-400">(e.g. / mo, / yr — leave blank for one-time)</span></label>
                <DebouncedInput value={d.priceInterval ?? ""} onChange={v => set("priceInterval", v)} className="h-8 text-xs" placeholder="/ mo" />
              </div>
            )}

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
    const label = brand === "aaus" ? "All About Ultrasound™ Membership" : brand === "iheartecho" ? "iHeartEcho™ Membership" : "All Memberships";
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
            {b === "aaus" ? "All About Ultrasound™" : b === "iheartecho" ? "iHeartEcho™" : "Both"}
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
                  <span className="text-gray-400 flex-shrink-0">${(Number(item.price) / 100).toFixed(2)}</span>
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
                  <DebouncedInput type="number" value={(Number(p.price) / 100).toFixed(2)} onChange={v => { const next = [...cfProds]; next[i] = { ...next[i], price: Math.round(parseFloat(v || "0") * 100) }; set("products", next); }} className="h-7 text-xs pl-5" placeholder="0.00" />
                </div>
                {(p as any).catalogPrice && (p as any).catalogPrice !== p.price && (
                  <span className="text-xs text-gray-400 flex-shrink-0">orig ${(Number((p as any).catalogPrice) / 100).toFixed(2)}</span>
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
                  <span className="text-gray-400 flex-shrink-0">${(Number(item.price) / 100).toFixed(2)}</span>
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

// ─── Sortable FAQ Item (used inside BlockSettings faq case) ────────────────────
function SortableFaqItem({
  item, index, onUpdateQ, onUpdateA, onRemove,
}: {
  item: { id: string; q: string; a: string };
  index: number;
  onUpdateQ: (v: string) => void;
  onUpdateA: (html: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [expanded, setExpanded] = useState(false);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className="border border-gray-200 rounded bg-white overflow-hidden">
      {/* Header row — always visible */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"><GripVertical size={12} /></button>
        <span className="text-xs text-gray-400 flex-shrink-0">Q{index + 1}</span>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-1 text-left min-w-0"
        >
          <span className="text-xs text-gray-700 truncate flex-1">{item.q || <span className="italic text-gray-400">Question…</span>}</span>
          {expanded ? <ChevronUp size={12} className="flex-shrink-0 text-gray-400" /> : <ChevronDown size={12} className="flex-shrink-0 text-gray-400" />}
        </button>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 flex-shrink-0 ml-1"><X size={10} /></button>
      </div>
      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-100 px-2 pb-2 pt-1.5 space-y-1.5">
          <DebouncedInput value={item.q} onChange={onUpdateQ} className="h-7 text-xs" placeholder="Question" />
          <div>
            <label className="text-xs text-gray-400 block mb-1">Answer (rich text)</label>
            <RichTextEditor value={item.a} onChange={onUpdateA} minHeight={80} maxHeight={300} placeholder="Answer..." />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sortable Pricing Card (used inside BlockSettings pricing case) ───────────
function SortablePricingCard({
  card, index, uploading, onSet, onRemove, onImageUpload, productCatalog, orderBumpsList, funnelList,
}: {
  card: { id: string; label?: string; sublabel?: string; ctaLabel?: string; ctaUrl?: string; badge?: string; imageUrl?: string; [key: string]: any };
  index: number;
  uploading: string | null;
  onSet: (key: string, val: any) => void;
  onRemove: () => void;
  onImageUpload: (file: File) => void;
  productCatalog?: Array<{ id: number; type: string; name: string; price: number }>;
  orderBumpsList?: Array<{ id: number; headline?: string | null; slug?: string | null; bumpType: string; bumpProductId: number }>;
  funnelList?: Array<{ id: number; name: string; slug: string; pages?: Array<{ id: number; name: string; slug: string }> }>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className="border border-gray-200 rounded p-2 space-y-2 bg-white">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"><GripVertical size={12} /></button>
          <span className="text-xs font-medium text-gray-600">Card {index + 1}</span>
        </div>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600"><X size={10} /></button>
      </div>
      <DebouncedInput value={card.label ?? ""} onChange={v => onSet("label", v)} className="h-7 text-xs" placeholder="Card label (e.g. Full Access)" />
      <DebouncedInput value={card.sublabel ?? ""} onChange={v => onSet("sublabel", v)} className="h-7 text-xs" placeholder="Sublabel (e.g. One-time payment)" />
      <DebouncedInput value={card.ctaLabel ?? ""} onChange={v => onSet("ctaLabel", v)} className="h-7 text-xs" placeholder="CTA button text" />
      <CTAActionPicker
        label="CTA Action"
        behaviorValue={card.ctaBehavior ?? "url"}
        onBehaviorChange={v => onSet("ctaBehavior", v)}
        linkValue={card.ctaUrl ?? ""}
        onLinkChange={v => onSet("ctaUrl", v)}
        emailValue={card.ctaEmailAddress ?? ""}
        onEmailChange={v => onSet("ctaEmailAddress", v)}
        productCatalog={productCatalog}
        orderBumpsList={orderBumpsList}
        funnelList={funnelList}
        orderBumpIdValue={card.ctaOrderBumpId ?? null}
        onOrderBumpIdChange={v => onSet("ctaOrderBumpId", v)}
        anchorValue={card.ctaScrollAnchor ?? ""}
        onAnchorChange={v => onSet("ctaScrollAnchor", v)}
        popupValue={card.ctaPopupUrl ?? ""}
        onPopupChange={v => onSet("ctaPopupUrl", v)}
        downloadValue={card.ctaDownloadUrl ?? ""}
        onDownloadChange={v => onSet("ctaDownloadUrl", v)}
        checkoutProductTypeValue={card.checkoutProductType}
        checkoutProductIdValue={card.checkoutProductId ?? null}
        onCheckoutProductChange={(type, id) => { onSet("checkoutProductType", type); onSet("checkoutProductId", id); }}
        groupDiscountTiersValue={card.groupDiscountTiers ?? []}
        onGroupDiscountTiersChange={v => onSet("groupDiscountTiers", v)}
        pricingOptionIdValue={card.ctaPricingOptionId ?? null}
        pricingOptionCourseIdValue={card.ctaPricingOptionCourseId ?? null}
        onPricingOptionChange={(cid, oid) => { onSet("ctaPricingOptionCourseId", cid); onSet("ctaPricingOptionId", oid); }}
      />
      <DebouncedInput value={card.badge ?? ""} onChange={v => onSet("badge", v)} className="h-7 text-xs" placeholder="Badge label (e.g. Most Popular)" />
      <div>
        <label className="text-xs text-gray-400 block mb-1">Card Image</label>
        {card.imageUrl ? (
          <div className="relative">
            <img src={card.imageUrl} alt="" className="w-full h-20 object-cover rounded border" />
            <button onClick={() => onSet("imageUrl", "")} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10} /></button>
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded p-2 hover:border-teal-400">
            {uploading === `pricing-img-${card.id}` ? <Loader2 size={12} className="animate-spin text-teal-600" /> : <Upload size={12} className="text-gray-400" />}
            <span className="text-xs text-gray-400">{uploading === `pricing-img-${card.id}` ? "Uploading..." : "Upload image"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onImageUpload(f); }} />
          </label>
        )}
      </div>
    </div>
  );
}

// ─── Sortable Carousel Item (used inside BlockSettings carousel case) ────────────
function SortableCarouselItem({
  id, item, index, uploading, onUpdate, onRemove, onUpload,
}: {
  id: string;
  item: { id: string; mediaType: "image" | "video"; url: string; altText?: string; captionTitle?: string; captionBody?: string };
  index: number;
  uploading: string | null;
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadKey = `carousel-item-${id}`;
  return (
    <div ref={setNodeRef} style={style} className="border border-gray-200 rounded p-2 space-y-1.5 bg-white">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 rounded" title="Drag to reorder"><GripVertical size={12} /></button>
          <span className="text-xs text-gray-500">Slide {index + 1}</span>
        </div>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600"><X size={10} /></button>
      </div>
      {/* Media type toggle */}
      <div className="grid grid-cols-2 gap-1">
        <button onClick={() => onUpdate("mediaType", "image")} className={`py-1 text-xs rounded border ${item.mediaType === "image" ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Image</button>
        <button onClick={() => onUpdate("mediaType", "video")} className={`py-1 text-xs rounded border ${item.mediaType === "video" ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Video</button>
      </div>
      {/* URL input + upload button */}
      <div className="flex gap-1">
        <DebouncedInput value={item.url} onChange={v => onUpdate("url", v)} className="h-7 text-xs flex-1" placeholder={item.mediaType === "video" ? "Video URL" : "Image URL"} />
        <>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading === uploadKey} className="flex-shrink-0 h-7 px-2 text-xs border border-gray-200 rounded hover:bg-gray-50 flex items-center gap-1 text-gray-600" title="Upload file">
            {uploading === uploadKey ? <span className="text-[10px]">...</span> : <Upload size={10} />}
          </button>
        </>
      </div>
      {/* Alt text */}
      <DebouncedInput value={item.altText ?? ""} onChange={v => onUpdate("altText", v)} className="h-7 text-xs" placeholder="Alt text (SEO)" />
      {/* Caption */}
      <DebouncedInput value={item.captionTitle ?? ""} onChange={v => onUpdate("captionTitle", v)} className="h-7 text-xs" placeholder="Caption title (optional)" />
      <DebouncedInput value={item.captionBody ?? ""} onChange={v => onUpdate("captionBody", v)} className="h-7 text-xs" placeholder="Caption description (optional)" />
    </div>
  );
}

// ─── Sortable List Item (used inside BlockSettings numbered_list / checklist cases) ────
function SortableListItem({
  id, value, index, prefix, onChange, onRemove,
}: {
  id: string;
  value: string;
  index: number;
  prefix: React.ReactNode;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex gap-1 items-center">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 rounded flex-shrink-0" title="Drag to reorder"><GripVertical size={12} /></button>
      <span className="text-xs text-gray-400 w-5 flex-shrink-0">{prefix}</span>
      <DebouncedInput value={value} onChange={onChange} className="h-7 text-xs flex-1" />
      <button onClick={onRemove} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button>
    </div>
  );
}

// ─── Sortable Checklist Item (supports crossed-out toggle) ─────────────────────
function SortableChecklistItem({
  id, item, index, onChange, onRemove,
}: {
  id: string;
  item: { text: string; crossed: boolean };
  index: number;
  onChange: (v: { text: string; crossed: boolean }) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex gap-1 items-center">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 rounded flex-shrink-0" title="Drag to reorder"><GripVertical size={12} /></button>
      <button
        type="button"
        onClick={() => onChange({ ...item, crossed: !item.crossed })}
        className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold transition-colors ${
          item.crossed ? "bg-red-400 hover:bg-red-500" : "bg-teal-500 hover:bg-teal-600"
        }`}
        title={item.crossed ? "Crossed out — click to make normal" : "Normal — click to cross out"}
      >{item.crossed ? "✗" : "✓"}</button>
      <DebouncedInput value={item.text} onChange={v => onChange({ ...item, text: v })} className={`h-7 text-xs flex-1 ${item.crossed ? "line-through text-gray-400" : ""}`} />
      <button onClick={onRemove} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button>
    </div>
  );
}
// ─── Sortable Review Item (used inside BlockSettings reviews case) ────────────
function SortableReviewItem({
  id, review, index, onUpdate, onRemove,
}: {
  id: string;
  review: { name: string; rating: number; text: string };
  index: number;
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="border border-gray-200 rounded p-2 space-y-1 bg-white">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 rounded" title="Drag to reorder"><GripVertical size={12} /></button>
          <span className="text-xs text-gray-500">Review {index + 1}</span>
        </div>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600"><X size={10} /></button>
      </div>
      <DebouncedInput value={review.name} onChange={v => onUpdate("name", v)} className="h-7 text-xs" placeholder="Name" />
      <Input type="number" value={review.rating} onChange={e => onUpdate("rating", Number(e.target.value))} className="h-7 text-xs" min={1} max={5} placeholder="Rating (1-5)" />
      <DebouncedTextarea value={review.text} onChange={v => onUpdate("text", v)} className="text-xs min-h-[60px]" placeholder="Review text" />
    </div>
  );
}

// ─── ColumnBlockList — top-level to prevent remount-on-render crash ──────────
function ColumnBlockList({ side, blocks, onUpdate, lessonId, courseId }: {
  side: "left" | "right";
  blocks: Block[];
  onUpdate: (newBlocks: Block[]) => void;
  lessonId?: number;
  courseId?: number;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addCat, setAddCat] = useState(CATALOG_CATEGORIES[0]);
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
                onUpdate([...blocks, newBlock]);
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
                  <button disabled={i === 0} onClick={() => { const nb = [...blocks]; [nb[i-1], nb[i]] = [nb[i], nb[i-1]]; onUpdate(nb); }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-teal-600 disabled:opacity-30"><ChevronUp size={10} /></button>
                  <button disabled={i === blocks.length - 1} onClick={() => { const nb = [...blocks]; [nb[i], nb[i+1]] = [nb[i+1], nb[i]]; onUpdate(nb); }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-teal-600 disabled:opacity-30"><ChevronDown size={10} /></button>
                  <button onClick={() => onUpdate(blocks.filter((_, j) => j !== i))} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500"><X size={10} /></button>
                </div>
              </div>
              <BlockSettings block={b} onChange={newData => {
                const nb = blocks.map((bl, j) => j === i ? { ...bl, data: newData } : bl);
                onUpdate(nb);
              }} lessonId={lessonId} courseId={courseId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Form Embed Form Picker ──────────────────────────────────────────────────
function FormEmbedFormPicker({ d, set }: { d: Record<string, any>; set: (field: string, value: any) => void }) {
  const { data: formsData } = trpc.generalForm.listForms.useQuery({ pageSize: 100, status: "all" });
  const forms = formsData?.forms ?? [];
  const selectedId = d.formId ? Number(d.formId) : null;

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500 block">Select Form</label>
      <select
        value={selectedId ?? ""}
        onChange={e => {
          const id = Number(e.target.value) || null;
          const form = forms.find((f: any) => f.id === id);
          set("formId", id);
          set("formSlug", form?.publicSlug ?? "");
          set("formName", form?.name ?? "");
        }}
        className="w-full h-8 text-xs rounded border border-gray-200 px-2"
      >
        <option value="">— Choose a form —</option>
        {forms.map((f: any) => (
          <option key={f.id} value={f.id}>
            {f.name}{f.isPublic ? " ✓" : " (not public)"}
          </option>
        ))}
      </select>
      {selectedId && !d.formSlug && (
        <p className="text-[10px] text-amber-600">⚠ This form has no public slug. Set one in Form Builder → Settings → Public URL.</p>
      )}
      {selectedId && d.formSlug && (
        <p className="text-[10px] text-teal-600">✓ Public slug: <code>{d.formSlug}</code></p>
      )}
    </div>
  );
}

export function BlockSettings({ block, onChange, lessonId, courseId }: { block: Block; onChange: (data: Record<string, any>) => void; lessonId?: number; courseId?: number }) {
  const d = block.data ?? {};
  // Use refs to avoid stale closures with debounced inputs
  const dataRef = useRef(block.data ?? {});
  const onChangeRef = useRef(onChange);
  dataRef.current = block.data ?? {};
  onChangeRef.current = onChange;
  const set = useCallback((key: string, value: any) => {
    onChangeRef.current({ ...dataRef.current, [key]: value });
  }, []);
  const setMany = useCallback((patch: Record<string, any>) => {
    onChangeRef.current({ ...dataRef.current, ...patch });
  }, []);
  // Upload hooks — must be at top level (React rules of hooks)
  const bgImageRef = useRef<HTMLInputElement>(null);
  const bgVideoRef = useRef<HTMLInputElement>(null);
  const inlineMediaRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const uploadMedia = trpc.auth.uploadPageMedia.useMutation();
  const { data: productCatalog } = trpc.funnel.listAllProducts.useQuery(undefined, { staleTime: 60_000 });
  const { data: orderBumpsList } = trpc.orderBumpsAdmin.list.useQuery(undefined, { staleTime: 60_000 });
  const { data: funnelList } = trpc.funnel.list.useQuery(undefined, { staleTime: 60_000 });
  // Sensors for drag-and-drop (must be at top level, not inside switch)
  const reviewSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const listSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const carouselSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const faqSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const pricingSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  // Related Products manual picker search — must be at top level (React rules of hooks)
  const [rpSearch, setRpSearch] = useState("");
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
      const buttons: Array<{ text: string; color: string; textColor: string; link: string; style: string; animation?: string; behavior?: string; leadCapture?: boolean; leadModalTitle?: string; leadModalSubtext?: string; leadTags?: string; campaignId?: number | null; showStrikethrough?: boolean; strikethroughPrice?: string; showOptOut?: boolean; optOutText?: string; optOutUrl?: string; checkoutProductType?: string; checkoutProductId?: number; checkoutPromoCode?: string }> =
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
          {/* Hero Min Height */}
          <div className="border-t pt-3 mt-3">
            <label className="text-xs text-gray-500 block mb-1">Min Height (px)</label>
            <input type="number" min={100} max={1200} step={10} value={d.heroMinHeight ?? 400} onChange={e => set("heroMinHeight", Number(e.target.value))} className="w-full h-7 text-xs rounded border border-gray-200 px-2" />
          </div>
          {/* Hero Max Height */}
          <div className="mt-2">
            <label className="text-xs text-gray-500 block mb-1">Max Height (px) <span className="text-gray-400 font-normal">— leave blank for no limit</span></label>
            <input
              type="number" min={50} max={1200} step={10}
              value={d.maxHeight ?? ""}
              placeholder="e.g. 150"
              onChange={e => {
                const v = e.target.value;
                set("maxHeight", v === "" ? undefined : Number(v));
              }}
              className="w-full h-7 text-xs rounded border border-gray-200 px-2"
            />
          </div>
          {/* Clickable Hero Section */}
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="hero-clickable" checked={d.heroClickable ?? false} onChange={e => set("heroClickable", e.target.checked)} className="rounded" />
              <label htmlFor="hero-clickable" className="text-xs text-gray-700 font-medium">Make entire hero section clickable</label>
            </div>
            {d.heroClickable && (
              <div className="pl-1 space-y-1">
                <p className="text-[10px] text-gray-400 mb-2">The whole hero area becomes a clickable region. Individual buttons still work independently.</p>
                <CTAActionPicker
                  label="Hero Click Action"
                  behaviorValue={d.heroBehavior ?? "url"}
                  onBehaviorChange={v => set("heroBehavior", v)}
                  linkValue={d.heroLink ?? ""}
                  onLinkChange={v => set("heroLink", v)}
                  emailValue={d.heroEmail ?? ""}
                  onEmailChange={v => set("heroEmail", v)}
                  productCatalog={productCatalog}
                  orderBumpsList={orderBumpsList}
                  funnelList={funnelList}
                  orderBumpIdValue={d.heroOrderBumpId ?? null}
                  onOrderBumpIdChange={v => set("heroOrderBumpId", v)}
                  anchorValue={d.heroScrollAnchor ?? ""}
                  onAnchorChange={v => set("heroScrollAnchor", v)}
                  popupValue={d.heroPopupUrl ?? ""}
                  onPopupChange={v => set("heroPopupUrl", v)}
                  downloadValue={d.heroDownloadUrl ?? ""}
                  onDownloadChange={v => set("heroDownloadUrl", v)}
                  checkoutProductTypeValue={d.heroCheckoutProductType}
                  checkoutProductIdValue={d.heroCheckoutProductId ?? null}
                  onCheckoutProductChange={(type, id) => setMany({ heroCheckoutProductType: type || undefined, heroCheckoutProductId: id ?? undefined })}
                  groupDiscountTiersValue={d.heroGroupDiscountTiers ?? []}
                  onGroupDiscountTiersChange={v => set("heroGroupDiscountTiers", v)}
                  pricingOptionIdValue={d.heroPricingOptionId ?? null}
                  pricingOptionCourseIdValue={d.heroPricingOptionCourseId ?? null}
                  onPricingOptionChange={(cid, oid) => setMany({ heroPricingOptionCourseId: cid, heroPricingOptionId: oid })}
                />
              </div>
            )}
          </div>
          {/* Hero Bottom Border */}
          <div className="border-t pt-3 mt-1">
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="hero-bottom-border" checked={d.heroBottomBorder ?? false} onChange={e => set("heroBottomBorder", e.target.checked)} className="rounded" />
              <label htmlFor="hero-bottom-border" className="text-xs text-gray-700 font-medium">Hero bottom border</label>
            </div>
            {d.heroBottomBorder && (
              <div className="pl-1 space-y-2">
                <BSColorField data={d} onSet={set} label="Border Color" field="heroBottomBorderColor" />
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Border Thickness (px)</label>
                  <input type="number" min={1} max={20} value={d.heroBottomBorderWidth ?? 4} onChange={e => set("heroBottomBorderWidth", Number(e.target.value))} className="w-full h-7 text-xs rounded border border-gray-200 px-2" />
                </div>
              </div>
            )}
          </div>
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
                  <CTAActionPicker
                    label="Button Action"
                    behaviorValue={btn.behavior ?? "url"}
                    onBehaviorChange={v => setBtn(idx, "behavior", v)}
                    linkValue={btn.link ?? ""}
                    onLinkChange={v => setBtn(idx, "link", v)}
                    emailValue={btn.emailAddress ?? ""}
                    onEmailChange={v => setBtn(idx, "emailAddress", v)}
                    productCatalog={productCatalog}
                    orderBumpsList={orderBumpsList}
                    funnelList={funnelList}
                    orderBumpIdValue={btn.orderBumpId ?? null}
                    onOrderBumpIdChange={v => setBtn(idx, "orderBumpId", v)}
                    anchorValue={btn.scrollAnchor ?? ""}
                    onAnchorChange={v => setBtn(idx, "scrollAnchor", v)}
                    popupValue={btn.popupUrl ?? ""}
                    onPopupChange={v => setBtn(idx, "popupUrl", v)}
                    downloadValue={btn.downloadUrl ?? ""}
                    onDownloadChange={v => setBtn(idx, "downloadUrl", v)}
                    checkoutProductTypeValue={btn.checkoutProductType}
                    checkoutProductIdValue={btn.checkoutProductId ?? null}
                    onCheckoutProductChange={(type, id) => setBtnMulti(idx, { checkoutProductType: type || undefined, checkoutProductId: id ?? undefined })}
                    groupDiscountTiersValue={(btn as any).groupDiscountTiers ?? []}
                    onGroupDiscountTiersChange={v => setBtnMulti(idx, { groupDiscountTiers: v })}
                    pricingOptionIdValue={(btn as any).pricingOptionId ?? null}
                    pricingOptionCourseIdValue={(btn as any).pricingOptionCourseId ?? null}
                    onPricingOptionChange={(cid, oid) => setBtnMulti(idx, { pricingOptionCourseId: cid, pricingOptionId: oid })}
                  />
                  {(btn.behavior ?? "url") === "send_email" && (
                    <HeroSendEmailSettings btn={btn} idx={idx} setBtn={setBtn} setBtnMulti={setBtnMulti} />
                  )}
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
        return (
          <div className="space-y-3">
            {/* Image source */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Image URL</label>
              <div className="flex items-center gap-2">
                <DebouncedInput value={d.url ?? ""} onChange={v => set("url", v)} className="h-8 text-sm flex-1" placeholder="Image URL or upload" />
                <button onClick={() => bgImageRef.current?.click()} className="px-2 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1" disabled={uploading === "url"}>{uploading === "url" ? "..." : <><Upload size={12} /> Upload</>}</button>
                <input ref={bgImageRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "url", "image-block"); e.target.value = ""; }} />
              </div>
              {d.url && <img src={d.url} className="w-full h-16 object-cover rounded border mt-1" style={{ borderRadius: d.borderRadius ? `${d.borderRadius}px` : undefined }} />}
            </div>
            <BSTextField data={d} onSet={set} label="Alt Text" field="alt" />
            <BSTextField data={d} onSet={set} label="Caption" field="caption" />
            {/* Link */}
            <div className="border border-gray-100 rounded p-2 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Link Action (optional)</p>
              <CTAActionPicker
                label="Click Action"
                behaviorValue={d.linkBehavior ?? "url"}
                onBehaviorChange={v => set("linkBehavior", v)}
                linkValue={d.linkUrl ?? ""}
                onLinkChange={v => set("linkUrl", v)}
                emailValue={d.linkEmailAddress ?? ""}
                onEmailChange={v => set("linkEmailAddress", v)}
                productCatalog={productCatalog}
                orderBumpsList={orderBumpsList}
                funnelList={funnelList}
                orderBumpIdValue={d.linkOrderBumpId ?? null}
                onOrderBumpIdChange={v => set("linkOrderBumpId", v)}
                anchorValue={d.linkScrollAnchor ?? ""}
                onAnchorChange={v => set("linkScrollAnchor", v)}
                popupValue={d.linkPopupUrl ?? ""}
                onPopupChange={v => set("linkPopupUrl", v)}
                downloadValue={d.linkDownloadUrl ?? ""}
                onDownloadChange={v => set("linkDownloadUrl", v)}
                checkoutProductTypeValue={d.linkCheckoutProductType}
                checkoutProductIdValue={d.linkCheckoutProductId ?? null}
                onCheckoutProductChange={(type, id) => setMany({ linkCheckoutProductType: type, linkCheckoutProductId: id })}
                groupDiscountTiersValue={d.linkGroupDiscountTiers ?? []}
                onGroupDiscountTiersChange={v => set("linkGroupDiscountTiers", v)}
                pricingOptionIdValue={d.linkPricingOptionId ?? null}
                pricingOptionCourseIdValue={d.linkPricingOptionCourseId ?? null}
                onPricingOptionChange={(cid, oid) => setMany({ linkPricingOptionCourseId: cid, linkPricingOptionId: oid })}
              />
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={d.openInNewTab ?? true} onChange={e => set("openInNewTab", e.target.checked)} className="rounded" />
                <label className="text-xs text-gray-600">Open in new tab</label>
              </div>
            </div>
            {/* Alignment */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Alignment</label>
              <div className="flex gap-1">{(["left","center","right"] as const).map(a => <button key={a} onClick={() => set("align", a)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.align ?? "center") === a ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{a}</button>)}</div>
            </div>
            {/* Width */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Image Width</label>
              <div className="flex flex-wrap gap-1 mb-1">{(["auto","25%","33%","50%","75%","100%"] as const).map(w => <button key={w} onClick={() => set("maxWidth", w)} className={`px-2 py-0.5 text-xs rounded border ${(d.maxWidth ?? "auto") === w ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{w}</button>)}</div>
              <DebouncedInput value={d.maxWidth ?? "auto"} onChange={v => set("maxWidth", v)} className="h-8 text-sm" placeholder="auto, 100%, 600px, etc." />
            </div>
            <div><label className="text-xs text-gray-500 block mb-1">Height</label><DebouncedInput value={d.height ?? ""} onChange={v => set("height", v)} className="h-8 text-sm" placeholder="auto, 300px, etc." /></div>
            {/* Appearance */}
            <div className="border border-gray-100 rounded p-2 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Appearance</p>
              <BSColorField data={d} onSet={set} label="Background Color" field="bgColor" />
              <div className="flex items-center gap-2"><input type="checkbox" checked={d.showShadow ?? true} onChange={e => set("showShadow", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Drop shadow</label></div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={d.noBorder ?? false} onChange={e => set("noBorder", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">No border</label></div>
              <div><label className="text-xs text-gray-500 block mb-1">Border Radius (px)</label><Input type="number" value={d.borderRadius ?? 0} onChange={e => set("borderRadius", Number(e.target.value))} className="h-8 text-sm" min={0} max={999} /></div>
              {!d.noBorder && <>
                <div><label className="text-xs text-gray-500 block mb-1">Border Width (px)</label><Input type="number" value={d.borderWidth ?? 0} onChange={e => set("borderWidth", Number(e.target.value))} className="h-8 text-sm" min={0} max={20} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Border Style</label><div className="flex gap-1">{(["solid","dashed","dotted"] as const).map(s => <button key={s} onClick={() => set("borderStyle", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.borderStyle ?? "solid") === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div>
                <BSColorField data={d} onSet={set} label="Border Color" field="borderColor" />
              </>}
            </div>
          </div>
        );
    case "video":
      return <VideoBlockSettings d={d} set={set} uploading={uploading} setUploading={setUploading} uploadMedia={uploadMedia} />;
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
      return (
        <div className="space-y-3">
          <UserParamTagsHelper context="html" />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Embed Code (HTML, iframe, or JavaScript)</label>
            <DebouncedTextarea value={d.embedCode ?? ""} onChange={v => set("embedCode", v)} className="text-sm min-h-[100px] font-mono text-xs" placeholder='<iframe src="..." />&#10;<!-- or any HTML/JS snippet -->' />
            <p className="text-xs text-gray-400 mt-1">JavaScript in &lt;script&gt; tags is fully supported.</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Height (px)</label>
            <Input type="number" value={d.height ?? 400} onChange={e => set("height", Number(e.target.value))} className="h-8 text-sm" />
          </div>
          {/* Alignment */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Alignment</label>
            <div className="flex gap-1">{(["left","center","right"] as const).map(a => <button key={a} onClick={() => set("align", a)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.align ?? "center") === a ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{a}</button>)}</div>
          </div>
          {/* Width */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Width</label>
            <div className="flex flex-wrap gap-1 mb-1">{(["100%","75%","50%","33%","25%"] as const).map(w => <button key={w} onClick={() => set("maxWidth", w)} className={`px-2 py-0.5 text-xs rounded border ${(d.maxWidth ?? "100%") === w ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{w}</button>)}</div>
            <DebouncedInput value={d.maxWidth ?? "100%"} onChange={v => set("maxWidth", v)} className="h-8 text-sm" placeholder="100%, 600px, etc." />
          </div>
          <BSTextField data={d} onSet={set} label="Caption" field="caption" />
        </div>
      );
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
      const listItemIds = items.map((_, i) => `nl-item-${i}`);
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Section Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Sub-heading" field="subHeading" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Items</label>
              <button onClick={() => set("items", [...items, "New step"])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <DndContext
              sensors={listSensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const oldIdx = listItemIds.indexOf(active.id as string);
                const newIdx = listItemIds.indexOf(over.id as string);
                if (oldIdx !== -1 && newIdx !== -1) set("items", arrayMove(items, oldIdx, newIdx));
              }}
            >
              <SortableContext items={listItemIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <SortableListItem
                      key={listItemIds[i]}
                      id={listItemIds[i]}
                      value={item}
                      index={i}
                      prefix={`${i + 1}.`}
                      onChange={v => { const next = items.map((it, j) => j === i ? v : it); set("items", next); }}
                      onRemove={() => set("items", items.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
        </div>
      );
    }
    case "checklist": {
      // Normalize items: support plain strings (legacy) and { text, crossed } objects
      const rawClItems: Array<string | { text: string; crossed?: boolean }> = d.items ?? [];
      const items: Array<{ text: string; crossed: boolean }> = rawClItems.map(it =>
        typeof it === "string" ? { text: it, crossed: false } : { text: it.text ?? "", crossed: it.crossed ?? false }
      );
      const clItemIds = items.map((_, i) => `cl-item-${i}`);
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Section Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Sub-heading" field="subHeading" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Items</label>
              <p className="text-[10px] text-gray-400 flex-1 mx-2">Click ✓/✗ to toggle crossed-out</p>
              <button onClick={() => set("items", [...items, { text: "New item", crossed: false }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <DndContext
              sensors={listSensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const oldIdx = clItemIds.indexOf(active.id as string);
                const newIdx = clItemIds.indexOf(over.id as string);
                if (oldIdx !== -1 && newIdx !== -1) set("items", arrayMove(items, oldIdx, newIdx));
              }}
            >
              <SortableContext items={clItemIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <SortableChecklistItem
                      key={clItemIds[i]}
                      id={clItemIds[i]}
                      item={item}
                      index={i}
                      onChange={v => { const next = items.map((it, j) => j === i ? v : it); set("items", next); }}
                      onRemove={() => set("items", items.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
        </div>
      );
    }
    case "icon_grid": {
      const items: Array<{ icon: string; title: string; text: string }> = d.items ?? [];
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Section Headline" field="headline" /><div><label className="text-xs text-gray-500 block mb-1">Columns</label><Input type="number" value={d.columns ?? 3} onChange={e => set("columns", Number(e.target.value))} className="h-8 text-sm" min={1} max={6} /></div><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Items</label><button onClick={() => set("items", [...items, { icon: "⭐", title: "Feature", text: "Description" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{items.map((item, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Item {i + 1}</span><button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><DebouncedInput value={item.icon} onChange={v => { const next = items.map((it, j) => j === i ? { ...it, icon: v } : it); set("items", next); }} className="h-7 text-xs" placeholder="Emoji or icon" /><DebouncedInput value={item.title} onChange={v => { const next = items.map((it, j) => j === i ? { ...it, title: v } : it); set("items", next); }} className="h-7 text-xs" placeholder="Title" /><DebouncedInput value={item.text} onChange={v => { const next = items.map((it, j) => j === i ? { ...it, text: v } : it); set("items", next); }} className="h-7 text-xs" placeholder="Description" /></div>))}</div></div></div>);
    }
    case "testimonial":
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Quote" field="quote" multiline /><BSTextField data={d} onSet={set} label="Author" field="author" /><BSTextField data={d} onSet={set} label="Avatar URL" field="avatarUrl" /><div><label className="text-xs text-gray-500 block mb-1">Star Rating</label><div className="flex items-center gap-1">{[0,1,2,3,4,5].map(n => (<button key={n} type="button" onClick={() => set("rating", n)} className={`w-8 h-8 rounded text-sm font-medium border ${(d.rating ?? 5) === n ? "bg-yellow-100 border-yellow-400 text-yellow-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>{n === 0 ? "\u2715" : "\u2605".repeat(n)}</button>))}</div><p className="text-[10px] text-gray-400 mt-1">{(d.rating ?? 5) === 0 ? "Stars hidden" : `${d.rating ?? 5} star${(d.rating ?? 5) > 1 ? "s" : ""} shown`}</p></div><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" /></div>);
    case "reviews": {
      const reviews: Array<{ name: string; rating: number; text: string }> = d.reviews ?? [];
      const reviewIds = reviews.map((_, i) => `review-${i}`);
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Section Headline" field="headline" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Card Background" field="cardBgColor" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Reviews</label>
              <button onClick={() => set("reviews", [...reviews, { name: "Student Name", rating: 5, text: "Great course!" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <DndContext
              sensors={reviewSensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const oldIdx = reviewIds.indexOf(active.id as string);
                const newIdx = reviewIds.indexOf(over.id as string);
                if (oldIdx !== -1 && newIdx !== -1) set("reviews", arrayMove(reviews, oldIdx, newIdx));
              }}
            >
              <SortableContext items={reviewIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {reviews.map((r, i) => (
                    <SortableReviewItem
                      key={reviewIds[i]}
                      id={reviewIds[i]}
                      review={r}
                      index={i}
                      onUpdate={(field, value) => { const next = reviews.map((rv, j) => j === i ? { ...rv, [field]: value } : rv); set("reviews", next); }}
                      onRemove={() => set("reviews", reviews.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      );
    }
    case "logos": {
      const logos: Array<{ url: string; alt: string }> = d.logos ?? [];
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Headline" field="headline" /><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Logos</label><button onClick={() => set("logos", [...logos, { url: "", alt: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{logos.map((logo, i) => (<div key={i} className="flex gap-1 items-center"><DebouncedInput value={logo.url} onChange={v => { const next = logos.map((l, j) => j === i ? { ...l, url: v } : l); set("logos", next); }} className="h-7 text-xs flex-1" placeholder="Logo URL" /><DebouncedInput value={logo.alt} onChange={v => { const next = logos.map((l, j) => j === i ? { ...l, alt: v } : l); set("logos", next); }} className="h-7 text-xs w-24" placeholder="Alt" /><button onClick={() => set("logos", logos.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button></div>))}</div></div></div>);
    }
    case "instructor":
      return <InstructorBlockSettings d={d} set={set} inlineMediaRef={inlineMediaRef} uploading={uploading} handleFileUpload={handleFileUpload} onChange={onChange} />;
    case "faq": {
      const items: Array<{ id: string; q: string; a: string }> = (d.items ?? []).map((it: any, i: number) => ({ id: it.id ?? `faq-${i}`, q: it.q ?? "", a: it.a ?? "" }));
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Section Headline" field="headline" />
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Color Scheme</p>
            <div className="space-y-2">
              <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
              <BSColorField data={d} onSet={set} label="Headline Color" field="headlineColor" />
              <BSColorField data={d} onSet={set} label="Accent / Border Color" field="accentColor" />
              <BSColorField data={d} onSet={set} label="Question Text Color" field="questionColor" />
              <BSColorField data={d} onSet={set} label="Answer Text Color" field="answerColor" />
              <BSColorField data={d} onSet={set} label="Item Background" field="itemBgColor" />
              <BSColorField data={d} onSet={set} label="Item Hover Background" field="itemHoverColor" />
              <BSColorField data={d} onSet={set} label="Divider Color" field="dividerColor" />
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">FAQ Items <span className="text-gray-400">(drag to reorder)</span></label>
              <button onClick={() => set("items", [{ id: `faq-${Date.now()}`, q: "Question?", a: "Answer." }, ...items])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <DndContext sensors={faqSensors} collisionDetection={closestCenter} onDragEnd={e => { const { active, over } = e; if (over && active.id !== over.id) { const oldIdx = items.findIndex(it => it.id === active.id); const newIdx = items.findIndex(it => it.id === over.id); if (oldIdx !== -1 && newIdx !== -1) set("items", arrayMove(items, oldIdx, newIdx)); } }}>
              <SortableContext items={items.map(it => it.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <SortableFaqItem
                      key={item.id}
                      item={item}
                      index={i}
                      onUpdateQ={v => { const next = items.map((it, j) => j === i ? { ...it, q: v } : it); set("items", next); }}
                      onUpdateA={html => { const next = items.map((it, j) => j === i ? { ...it, a: html } : it); set("items", next); }}
                      onRemove={() => set("items", items.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      );
    }
    case "ticker": {
      const tickerItems: string[] = d.items ?? ["Free Shipping on Orders Over $50", "New Courses Added Weekly", "Join 10,000+ Students"];
      return (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 font-medium">Ticker Items</label>
              <button onClick={() => set("items", [...tickerItems, "New item"])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-1">
              {tickerItems.map((item, i) => (
                <div key={i} className="flex items-center gap-1">
                  <DebouncedInput value={item} onChange={v => { const next = [...tickerItems]; next[i] = v; set("items", next); }} className="h-7 text-xs flex-1" placeholder="Ticker text..." />
                  <button onClick={() => set("items", tickerItems.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Separator</label>
            <Input value={d.separator ?? " ✦ "} onChange={e => set("separator", e.target.value)} className="h-7 text-xs" placeholder=" ✦ " />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Direction</label>
            <select value={d.direction ?? "left"} onChange={e => set("direction", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="left">Left (default)</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Speed (seconds per cycle)</label>
            <Input type="number" value={d.speed ?? 30} onChange={e => set("speed", Number(e.target.value))} className="h-7 text-xs" min={5} max={120} step={5} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={d.pauseOnHover !== false} onChange={e => set("pauseOnHover", e.target.checked)} className="rounded" />
            <label className="text-xs text-gray-600">Pause on hover</label>
          </div>
          <BSColorField data={d} onSet={set} label="Background Color" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Font Size</label>
            <select value={d.fontSize ?? "sm"} onChange={e => set("fontSize", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="xs">Extra Small</option>
              <option value="sm">Small</option>
              <option value="base">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra Large</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Font Weight</label>
            <select value={d.fontWeight ?? "normal"} onChange={e => set("fontWeight", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="semibold">Semibold</option>
              <option value="bold">Bold</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Text Transform</label>
            <select value={d.textTransform ?? "none"} onChange={e => set("textTransform", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="none">None</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Letter Spacing</label>
            <select value={d.letterSpacing ?? "normal"} onChange={e => set("letterSpacing", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="tighter">Tighter</option>
              <option value="normal">Normal</option>
              <option value="wide">Wide</option>
              <option value="wider">Wider</option>
              <option value="widest">Widest</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Padding (top/bottom)</label>
            <select value={d.padding ?? "py-2"} onChange={e => set("padding", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="py-1">Compact</option>
              <option value="py-2">Normal</option>
              <option value="py-3">Relaxed</option>
              <option value="py-4">Spacious</option>
            </select>
          </div>
        </div>
      );
    }
    case "countdown_v2": {
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext (below headline)" field="subtext" multiline />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Mode</label>
            <select value={d.mode ?? "duration"} onChange={e => set("mode", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="duration">Duration from page load</option>
              <option value="target_date">Count down to specific date</option>
            </select>
          </div>
          {(d.mode ?? "duration") === "duration" ? (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500 block mb-1">Hours</label><Input type="number" value={d.durationHours ?? 0} onChange={e => set("durationHours", Number(e.target.value))} className="h-7 text-xs" min={0} max={999} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Minutes</label><Input type="number" value={d.durationMinutes ?? 30} onChange={e => set("durationMinutes", Number(e.target.value))} className="h-7 text-xs" min={0} max={59} /></div>
            </div>
          ) : (
            <div><label className="text-xs text-gray-500 block mb-1">Target Date &amp; Time</label><Input type="datetime-local" value={d.targetDate ?? ""} onChange={e => set("targetDate", e.target.value)} className="h-7 text-xs" /></div>
          )}
          <BSTextField data={d} onSet={set} label="Expired Message" field="expiredText" placeholder="This offer has expired." />
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showDays !== false} onChange={e => set("showDays", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Days</label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showHours !== false} onChange={e => set("showHours", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Hours</label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showMinutes !== false} onChange={e => set("showMinutes", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Minutes</label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={d.showSeconds !== false} onChange={e => set("showSeconds", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Seconds</label></div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Colors</p>
            <div className="space-y-2">
              <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
              <BSColorField data={d} onSet={set} label="Text Color" field="textColor" />
              <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
              <BSColorField data={d} onSet={set} label="Digit Background" field="digitBg" />
              <BSColorField data={d} onSet={set} label="Digit Text Color" field="digitTextColor" />
              <BSColorField data={d} onSet={set} label="Label Color" field="labelColor" />
              <BSColorField data={d} onSet={set} label="Separator Color" field="separatorColor" />
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Border &amp; Shape</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cdv2-border" checked={d.showBorder ?? false} onChange={e => set("showBorder", e.target.checked)} className="rounded" />
                <label htmlFor="cdv2-border" className="text-xs text-gray-600">Show border</label>
              </div>
              {d.showBorder && <BSColorField data={d} onSet={set} label="Border Color" field="borderColor" />}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Corner Radius (px)</label>
                <Input type="number" value={d.cornerRadius ?? 8} onChange={e => set("cornerRadius", Number(e.target.value))} className="h-7 text-xs" min={0} max={64} />
              </div>
            </div>
          </div>
        </div>
      );
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
          <CTAActionPicker
            label="Button Action"
            behaviorValue={d.ctaBehavior ?? "url"}
            onBehaviorChange={v => set("ctaBehavior", v)}
            linkValue={d.ctaLink ?? ""}
            onLinkChange={v => set("ctaLink", v)}
            emailValue={d.ctaEmailAddress ?? ""}
            onEmailChange={v => set("ctaEmailAddress", v)}
            productCatalog={productCatalog}
            orderBumpsList={orderBumpsList}
            funnelList={funnelList}
            orderBumpIdValue={d.ctaOrderBumpId ?? null}
            onOrderBumpIdChange={v => set("ctaOrderBumpId", v)}
            anchorValue={d.ctaScrollAnchor ?? ""}
            onAnchorChange={v => set("ctaScrollAnchor", v)}
            popupValue={d.ctaPopupUrl ?? ""}
            onPopupChange={v => set("ctaPopupUrl", v)}
            downloadValue={d.ctaDownloadUrl ?? ""}
            onDownloadChange={v => set("ctaDownloadUrl", v)}
            checkoutProductTypeValue={d.checkoutProductType}
            checkoutProductIdValue={d.checkoutProductId ?? null}
            onCheckoutProductChange={(type, id) => setMany({ checkoutProductType: type, checkoutProductId: id })}
            groupDiscountTiersValue={d.groupDiscountTiers ?? []}
            onGroupDiscountTiersChange={v => set("groupDiscountTiers", v)}
            pricingOptionIdValue={d.ctaPricingOptionId ?? null}
            pricingOptionCourseIdValue={d.ctaPricingOptionCourseId ?? null}
            onPricingOptionChange={(cid, oid) => setMany({ ctaPricingOptionCourseId: cid, ctaPricingOptionId: oid })}
          />
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
          <PricingCtaSettings d={d} set={set} setMany={setMany} />
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
      return (<div className="space-y-3"><BSTextField data={d} onSet={set} label="Headline" field="headline" /><div className="border border-gray-200 rounded-lg p-3 space-y-2"><p className="text-xs font-semibold text-gray-600">Price Display</p><div className="flex items-center gap-2"><input type="checkbox" checked={d.showStrikethrough ?? false} onChange={e => set("showStrikethrough", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show strikethrough price</label></div>{(d.showStrikethrough ?? false) && <DebouncedInput value={d.strikethroughPrice ?? ""} onChange={v => set("strikethroughPrice", v)} className="h-7 text-xs" placeholder="e.g. $497" />}<BSTextField data={d} onSet={set} label="Current Price (display only)" field="displayPrice" placeholder="e.g. $197" /></div><BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline /><BSTextField data={d} onSet={set} label="Button Text" field="ctaText" /><CTAActionPicker
            label="Button Action"
            behaviorValue={d.ctaBehavior ?? "url"}
            onBehaviorChange={v => set("ctaBehavior", v)}
            linkValue={d.ctaLink ?? ""}
            onLinkChange={v => set("ctaLink", v)}
            emailValue={d.ctaEmailAddress ?? ""}
            onEmailChange={v => set("ctaEmailAddress", v)}
            productCatalog={productCatalog}
            orderBumpsList={orderBumpsList}
            funnelList={funnelList}
            orderBumpIdValue={d.ctaOrderBumpId ?? null}
            onOrderBumpIdChange={v => set("ctaOrderBumpId", v)}
            anchorValue={d.ctaScrollAnchor ?? ""}
            onAnchorChange={v => set("ctaScrollAnchor", v)}
            popupValue={d.ctaPopupUrl ?? ""}
            onPopupChange={v => set("ctaPopupUrl", v)}
            downloadValue={d.ctaDownloadUrl ?? ""}
            onDownloadChange={v => set("ctaDownloadUrl", v)}
            checkoutProductTypeValue={d.checkoutProductType}
            checkoutProductIdValue={d.checkoutProductId ?? null}
            onCheckoutProductChange={(type, id) => setMany({ checkoutProductType: type, checkoutProductId: id })}
            groupDiscountTiersValue={d.groupDiscountTiers ?? []}
            onGroupDiscountTiersChange={v => set("groupDiscountTiers", v)}
          /><BSColorField data={d} onSet={set} label="Button Color" field="ctaColor" /><BSColorField data={d} onSet={set} label="Button Text Color" field="ctaTextColor" /><BSColorField data={d} onSet={set} label="Button Border / Outline Color" field="btnBorderColor" /><div><label className="text-xs text-gray-500 block mb-1">Button Style</label><div className="flex gap-1">{(["filled","outline"] as const).map(s=><button key={s} onClick={()=>set("btnStyle",s)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.btnStyle??"filled")===s?"bg-teal-600 text-white border-teal-600":"border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div><BSColorField data={d} onSet={set} label="Background" field="bgColor" /><div className="border border-teal-100 bg-teal-50/50 rounded-lg p-3 space-y-2"><div className="flex items-center gap-2"><input type="checkbox" id="cta-lc" checked={d.leadCapture??false} onChange={e=>set("leadCapture",e.target.checked)} className="rounded" /><label htmlFor="cta-lc" className="text-xs text-teal-700 font-medium">Collect lead before action</label></div>{(d.leadCapture??false)&&(<div className="space-y-1 pl-1"><p className="text-[10px] text-gray-400">A name/email modal will appear before the button action executes.</p><BSTextField data={d} onSet={set} label="Modal Title" field="leadModalTitle" placeholder="e.g. Get Instant Access" /><BSTextField data={d} onSet={set} label="Modal Subtext" field="leadModalSubtext" placeholder="Optional" /><BSTextField data={d} onSet={set} label="Tags (comma-separated)" field="leadTags" placeholder="e.g. webinar, free-guide" /></div>)}</div><div><label className="text-xs text-gray-500 block mb-1">Button Animation</label><Select value={d.ctaAnimation ?? "none"} onValueChange={v => set("ctaAnimation", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="pulse">Pulse</SelectItem><SelectItem value="bounce">Bounce</SelectItem><SelectItem value="shake">Shake</SelectItem><SelectItem value="glow">Glow</SelectItem></SelectContent></Select></div><BSAlignField data={d} onSet={set} label="Text Alignment" field="align" /><div className="border-t pt-3 mt-1 space-y-2"><p className="text-xs font-medium text-gray-500">Button Subtext (below button)</p><BSTextField data={d} onSet={set} label="Subtext text" field="buttonSubtext" placeholder="e.g. No credit card required" /><BSLinkField label="Subtext URL (optional)" value={d.buttonSubtextUrl ?? ""} onChange={v => set("buttonSubtextUrl", v)} /><BSColorField data={d} onSet={set} label="Subtext Color" field="buttonSubtextColor" /><div><label className="text-xs text-gray-500 block mb-1">Subtext Size</label><select value={d.buttonSubtextSize ?? "xs"} onChange={e => set("buttonSubtextSize", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="xs">Extra Small (xs)</option><option value="sm">Small (sm)</option><option value="base">Base</option><option value="lg">Large (lg)</option></select></div><div><label className="text-xs text-gray-500 block mb-1">Subtext Style</label><div className="flex gap-2"><button type="button" onClick={() => set("buttonSubtextItalic", !(d.buttonSubtextItalic ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextItalic ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><em>Italic</em></button><button type="button" onClick={() => set("buttonSubtextBold", !(d.buttonSubtextBold ?? false))} className={`px-2 py-1 text-xs rounded border ${(d.buttonSubtextBold ?? false) ? "bg-teal-50 border-teal-400 text-teal-700" : "border-gray-200 text-gray-500"}`}><strong>Bold</strong></button></div></div></div><OptOutSettings d={d} set={set} /></div>);
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
                  <CTAActionPicker
                    label="CTA Action"
                    behaviorValue={product.ctaBehavior ?? "url"}
                    onBehaviorChange={v => set("products", products.map((p, j) => j === i ? { ...p, ctaBehavior: v } : p))}
                    linkValue={product.ctaLink ?? ""}
                    onLinkChange={v => set("products", products.map((p, j) => j === i ? { ...p, ctaLink: v } : p))}
                    emailValue={product.ctaEmailAddress ?? ""}
                    onEmailChange={v => set("products", products.map((p, j) => j === i ? { ...p, ctaEmailAddress: v } : p))}
                    productCatalog={productCatalog}
                    orderBumpsList={orderBumpsList}
                    funnelList={funnelList}
                    orderBumpIdValue={product.ctaOrderBumpId ?? null}
                    onOrderBumpIdChange={v => set("products", products.map((p, j) => j === i ? { ...p, ctaOrderBumpId: v } : p))}
                    anchorValue={product.ctaScrollAnchor ?? ""}
                    onAnchorChange={v => set("products", products.map((p, j) => j === i ? { ...p, ctaScrollAnchor: v } : p))}
                    popupValue={product.ctaPopupUrl ?? ""}
                    onPopupChange={v => set("products", products.map((p, j) => j === i ? { ...p, ctaPopupUrl: v } : p))}
                    downloadValue={product.ctaDownloadUrl ?? ""}
                    onDownloadChange={v => set("products", products.map((p, j) => j === i ? { ...p, ctaDownloadUrl: v } : p))}
                    checkoutProductTypeValue={product.checkoutProductType}
                    checkoutProductIdValue={product.checkoutProductId ?? null}
                    onCheckoutProductChange={(type, id) => set("products", products.map((p, j) => j === i ? { ...p, checkoutProductType: type, checkoutProductId: id } : p))}
                    groupDiscountTiersValue={(product as any).groupDiscountTiers ?? []}
                    onGroupDiscountTiersChange={v => set("products", products.map((p, j) => j === i ? { ...p, groupDiscountTiers: v } : p))}
                    pricingOptionIdValue={(product as any).ctaPricingOptionId ?? null}
                    pricingOptionCourseIdValue={(product as any).ctaPricingOptionCourseId ?? null}
                    onPricingOptionChange={(cid, oid) => set("products", products.map((p, j) => j === i ? { ...p, ctaPricingOptionCourseId: cid, ctaPricingOptionId: oid } : p))}
                  />
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
          <CTAActionPicker
            label="CTA Action"
            behaviorValue={d.ctaBehavior ?? "url"}
            onBehaviorChange={v => set("ctaBehavior", v)}
            linkValue={d.ctaLink ?? ""}
            onLinkChange={v => set("ctaLink", v)}
            emailValue={d.ctaEmailAddress ?? ""}
            onEmailChange={v => set("ctaEmailAddress", v)}
            productCatalog={productCatalog}
            orderBumpsList={orderBumpsList}
            funnelList={funnelList}
            orderBumpIdValue={d.ctaOrderBumpId ?? null}
            onOrderBumpIdChange={v => set("ctaOrderBumpId", v)}
            anchorValue={d.ctaScrollAnchor ?? ""}
            onAnchorChange={v => set("ctaScrollAnchor", v)}
            popupValue={d.ctaPopupUrl ?? ""}
            onPopupChange={v => set("ctaPopupUrl", v)}
            downloadValue={d.ctaDownloadUrl ?? ""}
            onDownloadChange={v => set("ctaDownloadUrl", v)}
            checkoutProductTypeValue={d.checkoutProductType}
            checkoutProductIdValue={d.checkoutProductId ?? null}
            onCheckoutProductChange={(type, id) => setMany({ checkoutProductType: type, checkoutProductId: id })}
            groupDiscountTiersValue={d.groupDiscountTiers ?? []}
            onGroupDiscountTiersChange={v => set("groupDiscountTiers", v)}
            pricingOptionIdValue={d.ctaPricingOptionId ?? null}
            pricingOptionCourseIdValue={d.ctaPricingOptionCourseId ?? null}
            onPricingOptionChange={(cid, oid) => setMany({ ctaPricingOptionCourseId: cid, ctaPricingOptionId: oid })}
          />
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
          <CTAActionPicker
            label="CTA Action"
            behaviorValue={d.ctaBehavior ?? "url"}
            onBehaviorChange={v => set("ctaBehavior", v)}
            linkValue={d.ctaLink ?? ""}
            onLinkChange={v => set("ctaLink", v)}
            emailValue={d.ctaEmailAddress ?? ""}
            onEmailChange={v => set("ctaEmailAddress", v)}
            productCatalog={productCatalog}
            orderBumpsList={orderBumpsList}
            funnelList={funnelList}
            orderBumpIdValue={d.ctaOrderBumpId ?? null}
            onOrderBumpIdChange={v => set("ctaOrderBumpId", v)}
            anchorValue={d.ctaScrollAnchor ?? ""}
            onAnchorChange={v => set("ctaScrollAnchor", v)}
            popupValue={d.ctaPopupUrl ?? ""}
            onPopupChange={v => set("ctaPopupUrl", v)}
            downloadValue={d.ctaDownloadUrl ?? ""}
            onDownloadChange={v => set("ctaDownloadUrl", v)}
            checkoutProductTypeValue={d.checkoutProductType}
            checkoutProductIdValue={d.checkoutProductId ?? null}
            onCheckoutProductChange={(type, id) => setMany({ checkoutProductType: type, checkoutProductId: id })}
            groupDiscountTiersValue={d.groupDiscountTiers ?? []}
            onGroupDiscountTiersChange={v => set("groupDiscountTiers", v)}
            pricingOptionIdValue={d.ctaPricingOptionId ?? null}
            pricingOptionCourseIdValue={d.ctaPricingOptionCourseId ?? null}
            onPricingOptionChange={(cid, oid) => setMany({ ctaPricingOptionCourseId: cid, ctaPricingOptionId: oid })}
          />
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
      const icCatalog = productCatalog;
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
                      <span className="text-gray-400 flex-shrink-0">${(Number(item.price) / 100).toFixed(2)}</span>
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
                      <DebouncedInput type="number" value={(Number(p.price) / 100).toFixed(2)} onChange={v => { const next = [...icProds]; next[i] = { ...next[i], price: Math.round(parseFloat(v || "0") * 100) }; set("products", next); }} className="h-7 text-xs pl-5" placeholder="0.00" />
                    </div>
                    {(p as any).catalogPrice && (p as any).catalogPrice !== p.price && (
                      <span className="text-xs text-gray-400 flex-shrink-0">orig ${(Number((p as any).catalogPrice) / 100).toFixed(2)}</span>
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
      const ecCatalog = productCatalog;
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
                      <span className="text-gray-400 flex-shrink-0">${(Number(item.price) / 100).toFixed(2)}</span>
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
                      <DebouncedInput type="number" value={(Number(p.price) / 100).toFixed(2)} onChange={v => { const next = [...ecProds]; next[i] = { ...next[i], price: Math.round(parseFloat(v || "0") * 100) }; set("products", next); }} className="h-7 text-xs pl-5" placeholder="0.00" />
                    </div>
                    {(p as any).catalogPrice && (p as any).catalogPrice !== p.price && (
                      <span className="text-xs text-gray-400 flex-shrink-0">orig ${(Number((p as any).catalogPrice) / 100).toFixed(2)}</span>
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
          <CurriculumCourseSelector d={d} set={set} />
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
          <div className="border-t pt-3">
            <label className="text-xs text-gray-500 block mb-1">Headline Alignment</label>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map(a => (
                <button key={a} onClick={() => set("headlineAlign", a)}
                  className={`flex-1 py-1 rounded text-xs font-medium border capitalize ${(d.headlineAlign ?? "left") === a ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200"}`}>
                  {a === "left" ? "⬅ Left" : a === "center" ? "⬛ Center" : "➡ Right"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t pt-3">
            <input type="checkbox" checked={d.showLocked ?? true} onChange={e => set("showLocked", e.target.checked)} className="rounded" />
            <label className="text-xs text-gray-600">Show locked lessons</label>
          </div>
        </div>
      );
    case "pricing_options_auto": {
      const pricingCards: Array<{ id: string; label?: string; sublabel?: string; ctaLabel?: string; ctaUrl?: string; imageUrl?: string; badge?: string }> = (d.cards ?? []).map((c: any, i: number) => ({ id: c.id ?? `pc-${i}`, ...c }));
      const setPricingCard = (i: number, key: string, val: any) => { const next = pricingCards.map((c, j) => j === i ? { ...c, [key]: val } : c); set("cards", next); };
      const handlePricingImageUpload = async (i: number, file: File) => {
        if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
        setUploading(`pricing-img-${i}`);
        try {
          const reader = new FileReader();
          const dataUri = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
          const result = await uploadMedia.mutateAsync({ dataUri, mimeType: file.type, fileName: file.name, context: "pricing-card" });
          setPricingCard(i, "imageUrl", result.url);
          toast.success("Image uploaded");
        } catch (err: any) { toast.error(err.message || "Upload failed"); }
        setUploading(null);
      };
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Section Headline" field="headline" />
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Design</p>
            <div className="space-y-2">
              <BSColorField data={d} onSet={set} label="Section Background" field="bgColor" />
              <BSColorField data={d} onSet={set} label="Headline Color" field="headlineColor" />
              <BSColorField data={d} onSet={set} label="Card Background" field="cardBgColor" />
              <BSColorField data={d} onSet={set} label="Card Border Color" field="cardBorderColor" />
              <BSColorField data={d} onSet={set} label="Featured Card Color" field="featuredCardColor" />
              <BSColorField data={d} onSet={set} label="Card Title Color" field="cardTitleColor" />
              <BSColorField data={d} onSet={set} label="Price Color" field="priceColor" />
              <BSColorField data={d} onSet={set} label="CTA Button Color" field="ctaColor" />
              <BSColorField data={d} onSet={set} label="CTA Text Color" field="ctaTextColor" />
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Primary Option Labels</p>
            <div className="space-y-2">
              <BSTextField data={d} onSet={set} label="Primary Card Label" field="primaryLabel" placeholder="Full Access" />
              <BSTextField data={d} onSet={set} label="Primary Card Sublabel" field="primarySublabel" placeholder="One-time payment, lifetime access" />
              <BSTextField data={d} onSet={set} label="Primary CTA Button Text" field="primaryCtaLabel" placeholder="Enroll Now" />
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Per-Card Overrides</p>
              <button onClick={() => set("cards", [...pricingCards, { id: `pc-${Date.now()}`, label: "", sublabel: "", ctaLabel: "", ctaUrl: "", imageUrl: "", badge: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add Card</button>
            </div>
            <p className="text-xs text-gray-400 mb-2">Override auto-populated data per card. Leave blank to use course pricing data.</p>
            <DndContext sensors={pricingSensors} collisionDetection={closestCenter} onDragEnd={e => { const { active, over } = e; if (over && active.id !== over.id) { const oldIdx = pricingCards.findIndex(c => c.id === active.id); const newIdx = pricingCards.findIndex(c => c.id === over.id); if (oldIdx !== -1 && newIdx !== -1) set("cards", arrayMove(pricingCards, oldIdx, newIdx)); } }}>
              <SortableContext items={pricingCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {pricingCards.map((card, i) => (
                    <SortablePricingCard
                      key={card.id}
                      card={card}
                      index={i}
                      uploading={uploading}
                      onSet={(key, val) => setPricingCard(i, key, val)}
                      onRemove={() => set("cards", pricingCards.filter((_, j) => j !== i))}
                      onImageUpload={file => handlePricingImageUpload(i, file)}
                      productCatalog={productCatalog}
                      orderBumpsList={orderBumpsList}
                      funnelList={funnelList}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">Auto-populated pricing data comes from Course Settings → Pricing Options. Per-card overrides above take precedence.</p>
        </div>
      );
    }
    case "related_products": {
      const selMode = d.selectionMode ?? "auto";
      const manualItems: Array<{ type: string; id: number }> = d.manualItems ?? [];
      const filteredCatalog = (productCatalog ?? []).filter(p =>
        !rpSearch || p.name.toLowerCase().includes(rpSearch.toLowerCase())
      );
      const typeLabels: Record<string, string> = { course: "Course", download: "Download", bundle: "Bundle", physical: "Physical" };
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline />
          {/* Selection Mode */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Selection Mode</label>
            <div className="flex gap-1">
              {(["auto", "manual"] as const).map(m => (
                <button key={m} onClick={() => set("selectionMode", m)} className={`flex-1 py-1 text-xs rounded border capitalize ${selMode === m ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{m === "auto" ? "Automated" : "Manual Pick"}</button>
              ))}
            </div>
          </div>
          {selMode === "auto" && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Product Type</label>
              <Select value={d.productType ?? "both"} onValueChange={v => set("productType", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Courses &amp; Downloads</SelectItem>
                  <SelectItem value="course">Courses Only</SelectItem>
                  <SelectItem value="download">Downloads Only</SelectItem>
                  <SelectItem value="bundle">Bundles Only</SelectItem>
                  <SelectItem value="physical">Physical Products Only</SelectItem>
                  <SelectItem value="all">All Products</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {selMode === "manual" && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500 block">Select Items to Display</label>
              <Input
                placeholder="Search products..."
                value={rpSearch}
                onChange={e => setRpSearch(e.target.value)}
                className="h-7 text-xs"
              />
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded divide-y divide-gray-100">
                {filteredCatalog.length === 0 && (
                  <div className="text-xs text-gray-400 p-2 text-center">No products found</div>
                )}
                {filteredCatalog.map(p => {
                  const key = `${p.type}-${p.id}`;
                  const isSelected = manualItems.some(m => m.type === p.type && m.id === p.id);
                  return (
                    <div key={key} className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 ${isSelected ? "bg-teal-50" : ""}`}
                      onClick={() => {
                        const next = isSelected
                          ? manualItems.filter(m => !(m.type === p.type && m.id === p.id))
                          : [...manualItems, { type: p.type, id: p.id }];
                        set("manualItems", next);
                      }}>
                      <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-teal-600 border-teal-600" : "border-gray-300"}`}>
                        {isSelected && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                      </div>
                      {p.imageUrl && <img src={p.imageUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-gray-400">{typeLabels[p.type] ?? p.type} · ${Number(p.price).toFixed(2)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {manualItems.length > 0 && (
                <div className="text-[10px] text-teal-600">{manualItems.length} item{manualItems.length !== 1 ? "s" : ""} selected</div>
              )}
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Layout</label>
            <div className="flex gap-1">
              {(["grid", "list"] as const).map(l => (
                <button key={l} onClick={() => set("layout", l)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.layout ?? "grid") === l ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Max Items (1–12)</label>
            <Input type="number" value={d.maxItems ?? 3} onChange={e => set("maxItems", Math.min(12, Math.max(1, Number(e.target.value))))} className="h-8 text-sm" min={1} max={12} />
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
    }
    case "cohort_sessions_auto":
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Section Headline" field="headline" />
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Design</p>
            <div className="space-y-2">
              <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
              <BSColorField data={d} onSet={set} label="Headline Color" field="headlineColor" />
              <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Display Options</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><input type="checkbox" checked={d.showDescription ?? true} onChange={e => set("showDescription", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show session description</label></div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={d.showDuration ?? true} onChange={e => set("showDuration", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show duration</label></div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={d.showPastSessions ?? false} onChange={e => set("showPastSessions", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show past sessions</label></div>
            </div>
          </div>
          <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">Sessions are auto-populated from the cohort live sessions you create in the Course → Cohort tab.</p>
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
          <BSTextField data={d} onSet={set} label="Copyright Text" field="copyrightText" placeholder={`\u00a9 ${new Date().getFullYear()} Company. All rights reserved.`} />
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
          courseId={courseId}
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
          {/* Alignment */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Alignment</label>
            <div className="flex gap-1">{(["left","center","right"] as const).map(a => <button key={a} onClick={() => set("align", a)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.align ?? "center") === a ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{a}</button>)}</div>
          </div>
          {/* Width */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Width</label>
            <div className="flex flex-wrap gap-1 mb-1">{(["100%","75%","50%","33%","25%"] as const).map(w => <button key={w} onClick={() => set("maxWidth", w)} className={`px-2 py-0.5 text-xs rounded border ${(d.maxWidth ?? "100%") === w ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{w}</button>)}</div>
            <DebouncedInput value={d.maxWidth ?? "100%"} onChange={v => set("maxWidth", v)} className="h-8 text-xs" placeholder="100%, 600px, etc." />
          </div>
          {/* Pass-through credentials */}
          <div className="border-t border-gray-100 pt-3">
            <label className="text-xs font-semibold text-gray-700 block mb-2">Pass User Credentials</label>
            <p className="text-[10px] text-gray-400 mb-2">Append user data to the iframe URL as query parameters. Copy the parameter string and paste it into your form's field-mapping URL.</p>
            <div className="space-y-2">
              {([
                { key: "passFirstName", label: "First Name", param: "first_name", value: "{user.firstName}" },
                { key: "passLastName",  label: "Last Name",  param: "last_name",  value: "{user.lastName}" },
                { key: "passEmail",     label: "Email",      param: "email",      value: "{user.email}" },
                { key: "passName",      label: "Full Name",  param: "name",       value: "{user.name}" },
              ] as const).map(({ key, label, param, value }) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <input type="checkbox" checked={d[key] ?? false} onChange={e => set(key, e.target.checked)} className="rounded flex-shrink-0" />
                    <span className="text-xs text-gray-600 truncate">Pass <code className="bg-gray-100 px-1 rounded">{label}</code></span>
                  </label>
                  <button
                    type="button"
                    title={`Copy ?${param}=${value}`}
                    onClick={() => { navigator.clipboard.writeText(`${param}=${encodeURIComponent(value)}`); }}
                    className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-gray-100 hover:bg-teal-50 hover:text-teal-700 text-gray-500 border border-gray-200 transition-colors font-mono"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    {param}=…
                  </button>
                </div>
              ))}
            </div>
            {(d.passFirstName || d.passLastName || d.passEmail || d.passName) && d.url && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-gray-500 font-medium">Preview URL (with params):</p>
                  <button
                    type="button"
                    onClick={() => {
                      const params = [
                        d.passFirstName && `first_name=${encodeURIComponent("{user.firstName}")}`,
                        d.passLastName  && `last_name=${encodeURIComponent("{user.lastName}")}`,
                        d.passEmail     && `email=${encodeURIComponent("{user.email}")}`,
                        d.passName      && `name=${encodeURIComponent("{user.name}")}`,
                      ].filter(Boolean).join("&");
                      const full = `${d.url}${d.url.includes("?") ? "&" : "?"}${params}`;
                      navigator.clipboard.writeText(full);
                    }}
                    className="text-[10px] text-teal-600 hover:text-teal-800 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy full URL
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 break-all font-mono">
                  {d.url}{d.url.includes('?') ? '&' : '?'}
                  {[
                    d.passFirstName && `first_name=%7Buser.firstName%7D`,
                    d.passLastName  && `last_name=%7Buser.lastName%7D`,
                    d.passEmail     && `email=%7Buser.email%7D`,
                    d.passName      && `name=%7Buser.name%7D`,
                  ].filter(Boolean).join('&')}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }
    case "live_session": {
      return <LiveSessionBlockSettings d={d} set={set} />;
    }
    case "cohort_class": {
      return <CohortClassBlockSettings d={d} set={set} />;
    }
    case "lesson_assignment": {
      return <LessonAssignmentBlockSettings d={d} set={set} />;
    }
    case "upgrade_prompt": {
      return <UpgradePromptBlockSettings d={d} set={set} />;
    }
    case "column_layout": {
      const leftBlocks: Block[] = d.leftBlocks ?? [];
      const rightBlocks: Block[] = d.rightBlocks ?? [];
      // Use the top-level ColumnBlockList (defined at line ~1965) — NEVER redefine inline here
      // (inline component definitions with useState inside a switch case cause React error #185)
      return (
        <div className="space-y-3">
          <ColumnBlockList side="left" blocks={leftBlocks} onUpdate={(nb) => set("leftBlocks", nb)} lessonId={lessonId} courseId={courseId} />
          <div className="border-t border-gray-100 pt-3">
            <ColumnBlockList side="right" blocks={rightBlocks} onUpdate={(nb) => set("rightBlocks", nb)} lessonId={lessonId} courseId={courseId} />
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div><label className="text-xs text-gray-500 block mb-1">Left Column Width (%)</label><Input type="number" value={d.leftRatio ?? 50} onChange={e => set("leftRatio", Number(e.target.value))} className="h-8 text-sm" min={20} max={80} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Gap (px)</label><Input type="number" value={d.gap ?? 32} onChange={e => set("gap", Number(e.target.value))} className="h-8 text-sm" min={0} max={80} /></div>
            <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          </div>
        </div>
      );
    }
    case "carousel": {
      const items: Array<{ id: string; mediaType: "image" | "video"; url: string; altText?: string; captionTitle?: string; captionBody?: string }> = d.items ?? [];
      const carouselItemIds = items.map(item => item.id);
      return (
        <div className="space-y-3">
          {/* Live preview */}
          <div className="rounded overflow-hidden border border-gray-200">
            <CarouselBlock data={d} />
          </div>
          {/* Items list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Slides</label>
              <button onClick={() => set("items", [...items, { id: uid(), mediaType: "image", url: "", altText: "", captionTitle: "", captionBody: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add Slide</button>
            </div>
            <DndContext
              sensors={carouselSensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const oldIdx = carouselItemIds.indexOf(active.id as string);
                const newIdx = carouselItemIds.indexOf(over.id as string);
                if (oldIdx !== -1 && newIdx !== -1) set("items", arrayMove(items, oldIdx, newIdx));
              }}
            >
              <SortableContext items={carouselItemIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <SortableCarouselItem
                      key={item.id}
                      id={item.id}
                      item={item}
                      index={i}
                      uploading={uploading}
                      onUpdate={(field, value) => { const next = items.map((it, j) => j === i ? { ...it, [field]: value } : it); set("items", next); }}
                      onRemove={() => set("items", items.filter((_, j) => j !== i))}
                      onUpload={async (file) => {
                        if (file.size > 40 * 1024 * 1024) { toast.error("File must be under 40 MB"); return; }
                        const uploadKey = `carousel-item-${item.id}`;
                        setUploading(uploadKey);
                        try {
                          const reader = new FileReader();
                          const dataUri = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
                          const result = await uploadMedia.mutateAsync({ dataUri, mimeType: file.type, fileName: file.name, context: "carousel" });
                          const next = items.map((it, j) => j === i ? { ...it, url: result.url, mediaType: file.type.startsWith("video") ? "video" : "image" } : it);
                          set("items", next);
                        } catch (err: any) { toast.error(err.message || "Upload failed"); }
                        finally { setUploading(null); }
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          {/* Global settings */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-medium text-gray-500">Display Settings</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Transition</label>
              <Select value={d.transition ?? "slide"} onValueChange={v => set("transition", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slide">Slide</SelectItem>
                  <SelectItem value="fade">Fade</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Auto-play interval (ms, 0 = off)</label>
              <Input type="number" value={d.autoPlayMs ?? 4000} onChange={e => set("autoPlayMs", Number(e.target.value))} className="h-8 text-sm" min={0} step={500} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer"><input type="checkbox" checked={d.showArrows !== false} onChange={e => set("showArrows", e.target.checked)} className="rounded" /> Arrows</label>
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer"><input type="checkbox" checked={d.showDots !== false} onChange={e => set("showDots", e.target.checked)} className="rounded" /> Dots</label>
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer"><input type="checkbox" checked={d.showCaptions !== false} onChange={e => set("showCaptions", e.target.checked)} className="rounded" /> Captions</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500 block mb-1">Max Height (px)</label><Input type="number" value={d.maxHeight ?? 480} onChange={e => set("maxHeight", Number(e.target.value))} className="h-8 text-sm" min={100} max={1200} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Border Width (px)</label><Input type="number" value={d.borderWidth ?? 2} onChange={e => set("borderWidth", Number(e.target.value))} className="h-8 text-sm" min={0} max={16} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Border Radius (px)</label><Input type="number" value={d.borderRadius ?? 12} onChange={e => set("borderRadius", Number(e.target.value))} className="h-8 text-sm" min={0} max={64} /></div>
            </div>
            <BSColorField data={d} onSet={set} label="Background Color" field="bgColor" />
            <BSColorField data={d} onSet={set} label="Border / Accent Color" field="borderColor" />
          </div>
        </div>
      );
    }
    case "comparison_table": {
      const ctCols: Array<{ label: string; highlight?: boolean }> = d.columns ?? [];
      const ctRows: Array<{ feature: string; values: Array<string | boolean | null> }> = d.rows ?? [];
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline />
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          {/* Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Columns</label>
              <button onClick={() => set("columns", [...ctCols, { label: "New Column", highlight: false }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-1">
              {ctCols.map((col, ci) => (
                <div key={ci} className="flex items-center gap-1">
                  <DebouncedInput value={col.label} onChange={v => set("columns", ctCols.map((c, j) => j === ci ? { ...c, label: v } : c))} className="h-7 text-xs flex-1" placeholder="Column label" />
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer flex-shrink-0">
                    <input type="checkbox" checked={col.highlight ?? false} onChange={e => set("columns", ctCols.map((c, j) => j === ci ? { ...c, highlight: e.target.checked } : c))} className="rounded" />
                    Highlight
                  </label>
                  <button onClick={() => set("columns", ctCols.filter((_, j) => j !== ci))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={10} /></button>
                </div>
              ))}
            </div>
          </div>
          {/* Rows */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Rows</label>
              <button onClick={() => set("rows", [...ctRows, { feature: "New Feature", values: ctCols.map(() => false) }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-2">
              {ctRows.map((row, ri) => (
                <div key={ri} className="border border-gray-200 rounded p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Row {ri + 1}</span>
                    <button onClick={() => set("rows", ctRows.filter((_, j) => j !== ri))} className="text-red-400 hover:text-red-600"><X size={10} /></button>
                  </div>
                  <DebouncedInput value={row.feature} onChange={v => set("rows", ctRows.map((r, j) => j === ri ? { ...r, feature: v } : r))} className="h-7 text-xs" placeholder="Feature name" />
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${ctCols.length || 1}, 1fr)` }}>
                    {ctCols.map((col, ci) => {
                      const val = row.values?.[ci];
                      const isBoolean = val === true || val === false;
                      return (
                        <div key={ci} className="space-y-0.5">
                          <p className="text-[10px] text-gray-400 truncate">{col.label || `Col ${ci + 1}`}</p>
                          <select
                            value={isBoolean ? (val ? "true" : "false") : "text"}
                            onChange={e => {
                              const next = [...(row.values ?? [])];
                              if (e.target.value === "true") next[ci] = true;
                              else if (e.target.value === "false") next[ci] = false;
                              else next[ci] = "";
                              set("rows", ctRows.map((r, j) => j === ri ? { ...r, values: next } : r));
                            }}
                            className="w-full h-6 text-[10px] rounded border border-gray-200 px-1"
                          >
                            <option value="true">✓ Yes</option>
                            <option value="false">— No</option>
                            <option value="text">Text</option>
                          </select>
                          {!isBoolean && (
                            <DebouncedInput
                              value={typeof val === "string" ? val : ""}
                              onChange={v => {
                                const next = [...(row.values ?? [])];
                                next[ci] = v;
                                set("rows", ctRows.map((r, j) => j === ri ? { ...r, values: next } : r));
                              }}
                              className="h-6 text-[10px]"
                              placeholder="Text value"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case "pricing_cards": {
      const pcTiers: Array<{ name: string; price: string; interval?: string; description?: string; badge?: string; features: string[]; ctaText: string; ctaLink?: string; ctaBehavior?: string; ctaEmailAddress?: string; ctaScrollAnchor?: string; ctaPopupUrl?: string; ctaDownloadUrl?: string; checkoutProductType?: string; checkoutProductId?: number | null; highlighted?: boolean }> = d.tiers ?? [];
      const setTier = (ti: number, patch: Record<string, any>) => set("tiers", pcTiers.map((t, j) => j === ti ? { ...t, ...patch } : t));
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext" field="subtext" multiline />
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Pricing Tiers</label>
              <button
                onClick={() => set("tiers", [...pcTiers, { name: "New Tier", price: "$0", interval: "/ month", description: "", badge: "", features: ["Feature A"], ctaText: "Get Started", ctaBehavior: "direct_checkout", ctaLink: "", highlighted: false }])}
                className="text-xs text-teal-600 flex items-center gap-1"
              ><Plus size={12} /> Add Tier</button>
            </div>
            <div className="space-y-3">
              {pcTiers.map((tier, ti) => (
                <div key={ti} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Tier {ti + 1}</span>
                    <button onClick={() => set("tiers", pcTiers.filter((_, j) => j !== ti))} className="text-red-400 hover:text-red-600"><X size={10} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={tier.highlighted ?? false} onChange={e => setTier(ti, { highlighted: e.target.checked })} className="rounded" />
                    <label className="text-xs text-gray-600">Highlight this tier</label>
                  </div>
                  <DebouncedInput value={tier.name} onChange={v => setTier(ti, { name: v })} className="h-7 text-xs" placeholder="Tier name" />
                  <DebouncedInput value={tier.badge ?? ""} onChange={v => setTier(ti, { badge: v })} className="h-7 text-xs" placeholder="Badge label (e.g. Most Popular)" />
                  <DebouncedInput value={tier.description ?? ""} onChange={v => setTier(ti, { description: v })} className="h-7 text-xs" placeholder="Short description" />
                  <div className="grid grid-cols-2 gap-1">
                    <DebouncedInput value={tier.price} onChange={v => setTier(ti, { price: v })} className="h-7 text-xs" placeholder="$49" />
                    <DebouncedInput value={tier.interval ?? ""} onChange={v => setTier(ti, { interval: v })} className="h-7 text-xs" placeholder="/ month" />
                  </div>
                  {/* Features */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-gray-400">Features</label>
                      <button onClick={() => setTier(ti, { features: [...(tier.features ?? []), "New feature"] })} className="text-[10px] text-teal-600 flex items-center gap-0.5"><Plus size={10} /> Add</button>
                    </div>
                    <div className="space-y-1">
                      {(tier.features ?? []).map((feat, fi) => (
                        <div key={fi} className="flex items-center gap-1">
                          <DebouncedInput value={feat} onChange={v => setTier(ti, { features: (tier.features ?? []).map((f, k) => k === fi ? v : f) })} className="h-6 text-[10px] flex-1" placeholder="Feature" />
                          <button onClick={() => setTier(ti, { features: (tier.features ?? []).filter((_, k) => k !== fi) })} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={10} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* CTA — full action picker */}
                  <div className="border-t border-gray-100 pt-2 space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Button</label>
                    <DebouncedInput value={tier.ctaText} onChange={v => setTier(ti, { ctaText: v })} className="h-7 text-xs" placeholder="Button text" />
                    <CTAActionPicker
                      label="Button Action"
                      behaviorValue={tier.ctaBehavior ?? "url"}
                      onBehaviorChange={v => setTier(ti, { ctaBehavior: v })}
                      linkValue={tier.ctaLink ?? ""}
                      onLinkChange={v => setTier(ti, { ctaLink: v })}
                      emailValue={tier.ctaEmailAddress ?? ""}
                      onEmailChange={v => setTier(ti, { ctaEmailAddress: v })}
                      productCatalog={productCatalog}
                      orderBumpsList={orderBumpsList}
                      anchorValue={tier.ctaScrollAnchor ?? ""}
                      onAnchorChange={v => setTier(ti, { ctaScrollAnchor: v })}
                      popupValue={tier.ctaPopupUrl ?? ""}
                      onPopupChange={v => setTier(ti, { ctaPopupUrl: v })}
                      downloadValue={tier.ctaDownloadUrl ?? ""}
                      onDownloadChange={v => setTier(ti, { ctaDownloadUrl: v })}
                      checkoutProductTypeValue={tier.checkoutProductType}
                      checkoutProductIdValue={tier.checkoutProductId ?? null}
                      onCheckoutProductChange={(type, id) => setTier(ti, { checkoutProductType: type, checkoutProductId: id })}
                      pricingOptionIdValue={tier.ctaPricingOptionId ?? null}
                      pricingOptionCourseIdValue={tier.ctaPricingOptionCourseId ?? null}
                      onPricingOptionChange={(cid, oid) => setTier(ti, { ctaPricingOptionCourseId: cid, ctaPricingOptionId: oid })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case "form_embed": {
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500 leading-relaxed">Embed a form from the Form Builder. Select a form by slug (the public URL identifier). The form must be set to <strong>Public</strong> in the Form Builder settings.</p>
          {/* Form picker */}
          <FormEmbedFormPicker d={d} set={set} />
          {/* Display mode */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Display Mode</label>
            <select value={d.displayMode ?? "inline"} onChange={e => set("displayMode", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="inline">Inline (embedded on page)</option>
              <option value="popup_enter">Popup — on page enter (after delay)</option>
              <option value="popup_exit">Popup — on exit intent (mouse leaves)</option>
              <option value="popup_click">Popup — on button click</option>
            </select>
          </div>
          {d.displayMode === "popup_enter" && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Delay before popup (ms)</label>
              <DebouncedInput value={String(d.enterDelayMs ?? 2000)} onChange={v => set("enterDelayMs", Number(v) || 2000)} className="h-7 text-xs" placeholder="2000" />
            </div>
          )}
          {d.displayMode === "popup_click" && (
            <BSTextField data={d} onSet={set} label="Trigger Button Text" field="triggerButtonText" />
          )}
          <BSTextField data={d} onSet={set} label="Headline (optional)" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext (optional)" field="subtext" multiline />
          <BSTextField data={d} onSet={set} label="Submit Button Text" field="submitText" />
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background Color" field="bgColor" />
        </div>
      );
    }
    case "data_table": {
      const rows: string[][] = d.rows ?? [["Header 1", "Header 2"], ["Cell 1", "Cell 2"]];
      const updateCell = (ri: number, ci: number, val: string) => {
        const next = rows.map((r: string[], i: number) => i === ri ? r.map((c: string, j: number) => j === ci ? val : c) : [...r]);
        set("rows", next);
      };
      const addRow = () => set("rows", [...rows, Array(rows[0]?.length ?? 2).fill("")]);
      const removeRow = (ri: number) => { if (rows.length > 1) set("rows", rows.filter((_: any, i: number) => i !== ri)); };
      const addCol = () => set("rows", rows.map((r: string[]) => [...r, ""]));
      const removeCol = () => { if ((rows[0]?.length ?? 0) > 1) set("rows", rows.map((r: string[]) => r.slice(0, -1))); };
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500">Click any cell to edit. Use the buttons below to add/remove rows and columns.</p>
          {/* Cell editor */}
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <tbody>
                {rows.map((row: string[], ri: number) => (
                  <tr key={ri} className={ri === 0 && d.hasHeader !== false ? "bg-teal-50" : ri % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    {row.map((cell: string, ci: number) => (
                      <td key={ci} className="border border-gray-200 p-0">
                        <input
                          value={cell}
                          onChange={e => updateCell(ri, ci, e.target.value)}
                          className="w-full px-1.5 py-1 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-teal-400 min-w-[60px]"
                          placeholder={ri === 0 && d.hasHeader !== false ? `Header ${ci + 1}` : `R${ri}C${ci + 1}`}
                        />
                      </td>
                    ))}
                    <td className="border border-gray-200 px-1">
                      <button onClick={() => removeRow(ri)} className="text-red-400 hover:text-red-600 text-[10px] px-0.5">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Row/col controls */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={addRow} className="px-2 py-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded hover:bg-teal-100">+ Row</button>
            <button onClick={addCol} className="px-2 py-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded hover:bg-teal-100">+ Column</button>
            <button onClick={removeCol} className="px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100">− Last Column</button>
            <button
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  const splitLines = text.trim().split("\n").map((l: string) => l.replace(/\r$/, ""));
                  const parsed = splitLines.map((line: string) => line.split("\t"));
                  if (parsed.length > 0 && parsed[0].length > 0) {
                    set("rows", parsed);
                  }
                } catch {
                  alert("Could not read clipboard. Copy cells from Excel or Google Sheets first, then try again.");
                }
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
            >
              Paste from Spreadsheet
            </button>
          </div>
          {/* Style controls */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="dt-header" checked={d.hasHeader !== false} onChange={e => set("hasHeader", e.target.checked)} className="w-3.5 h-3.5" />
            <label htmlFor="dt-header" className="text-xs text-gray-600">First row is header</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="dt-bordered" checked={d.bordered !== false} onChange={e => set("bordered", e.target.checked)} className="w-3.5 h-3.5" />
            <label htmlFor="dt-bordered" className="text-xs text-gray-600">Show cell borders</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="dt-striped" checked={d.striped !== false} onChange={e => set("striped", e.target.checked)} className="w-3.5 h-3.5" />
            <label htmlFor="dt-striped" className="text-xs text-gray-600">Alternate row shading</label>
          </div>
          <BSTextField data={d} onSet={set} label="Caption (optional)" field="caption" />
          <BSColorField data={d} onSet={set} label="Background Color" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Header Row Background" field="headerBg" />
          <BSColorField data={d} onSet={set} label="Header Text Color" field="headerTextColor" />
          <BSColorField data={d} onSet={set} label="Border Color" field="borderColor" />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Text Alignment</label>
            <select value={d.textAlign ?? "left"} onChange={e => set("textAlign", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Font Size (px)</label>
            <input type="number" value={d.fontSize ?? 14} onChange={e => set("fontSize", Number(e.target.value))} className="w-full h-8 text-xs rounded border border-gray-200 px-2" min={10} max={24} />
          </div>
        </div>
      );
    }
    case "file_upload": {
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Label / Heading" field="label" />
          <BSTextField data={d} onSet={set} label="Instructions" field="instructions" />
          <BSTextField data={d} onSet={set} label="Accepted File Types (display text)" field="acceptedTypes" />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Max File Size (MB)</label>
            <input type="number" value={d.maxSizeMb ?? 10} onChange={e => set("maxSizeMb", Number(e.target.value))} className="w-full h-8 text-xs rounded border border-gray-200 px-2" min={1} max={100} />
          </div>
          <BSTextField data={d} onSet={set} label="Media Library Folder Name (leave blank to use page name)" field="folderName" />
          <p className="text-[10px] text-gray-400">When used in an assignment, uploaded files are stored to the student's submission. On other pages, files go to the named folder in the Media Library.</p>
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background Color" field="bgColor" />
        </div>
      );
    }
    case "affiliate_signup":
      return (
        <div className="space-y-3">
          <BSTextField data={d} onSet={set} label="Headline" field="headline" />
          <BSTextField data={d} onSet={set} label="Subtext" field="subtext" />
          <BSTextField data={d} onSet={set} label="CTA Button Text" field="ctaText" />
          <BSTextField data={d} onSet={set} label="CTA Link (URL)" field="ctaLink" />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Benefits (one per line)</label>
            <textarea
              value={(d.benefits ?? []).join("\n")}
              onChange={e => set("benefits", e.target.value.split("\n").filter(Boolean))}
              rows={4}
              className="w-full text-xs rounded border border-gray-200 px-2 py-1.5 resize-none"
              placeholder="Earn up to 30% commission\nReal-time dashboard..."
            />
          </div>
          <BSColorField data={d} onSet={set} label="Accent Color" field="accentColor" />
          <BSColorField data={d} onSet={set} label="Background Color" field="bgColor" />
          <BSColorField data={d} onSet={set} label="Headline Color" field="headlineColor" />
        </div>
      );
     default:
      return <p className="text-xs text-gray-400">No settings for this block type.</p>;
  } })();
  return (
    <div className="space-y-4">
      {blockSpecific}
      {/* ─── Global Content Width Control ─── */}
      {!["hero","spacer","divider","footer","logo_strip"].includes(block.type) && (
        <div className="border-t border-gray-200 pt-3 mt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Content Width</p>
          <div className="flex flex-wrap gap-1 mb-1">
            {(["full","xl","lg","md","sm"] as const).map(w => {
              const labels: Record<string, string> = { full: "Full", xl: "XL (1280)", lg: "LG (1024)", md: "MD (768)", sm: "SM (640)" };
              return (
                <button key={w} onClick={() => set("contentWidth", w)} className={`px-2 py-0.5 text-xs rounded border ${(d.contentWidth ?? "full") === w ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{labels[w]}</button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400">Constrains inner content width while background spans full page.</p>
        </div>
      )}
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
function ColumnDropZone({ id, blocks, activeDragId, isTargeted, onMoveOut, onMoveToOther, onDeleteChild, onAddBlock, onReorderChild }: {
  id: string; blocks: Block[]; activeDragId: UniqueIdentifier | null;
  isTargeted?: boolean;
  onMoveOut: (childBlockId: string) => void;
  onMoveToOther?: (childBlockId: string) => void;
  onDeleteChild?: (childBlockId: string) => void;
  onAddBlock: (block: Block) => void;
  onReorderChild?: (childBlockId: string, direction: "up" | "down") => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [pickerOpen, setPickerOpen] = useState(false);
  // isTargeted comes from parent (tracked via pointermove); isOver is from dnd-kit
  const isActive = isTargeted || (isOver && activeDragId != null);
  return (
    <div ref={setNodeRef} data-col-zone={id} style={{ pointerEvents: "all" }} className={`flex-1 min-h-[120px] rounded-lg transition-all duration-150 ${isActive ? "ring-4 ring-teal-500 ring-offset-2 bg-teal-50 shadow-lg shadow-teal-200" : "bg-gray-50/50"}`}>
      {blocks.length === 0 ? (
        <div data-col-zone={id} className={`h-full min-h-[120px] flex flex-col items-center justify-center gap-2 text-xs rounded-lg border-2 border-dashed transition-all duration-150 ${isActive ? "border-teal-500 text-teal-700 bg-teal-100 scale-[1.02]" : "border-gray-200 text-gray-400"}`}>
          {isActive ? <><span className="text-2xl font-bold text-teal-600">↓</span><span className="font-semibold text-teal-700">Drop here</span></> : (
            <>
              <span>Drag blocks here</span>
              <button onClick={e => { e.stopPropagation(); setPickerOpen(true); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500 text-white text-[10px] font-medium hover:bg-teal-600 transition-colors">
                <Plus size={10} /> Add Block
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div data-col-zone={id} className={`space-y-1 p-1 rounded transition-all duration-150 ${isActive ? "bg-teal-50" : ""}`}>
              {blocks.map((b, bIdx) => (
                <ColumnChildBlock
                  key={b.id}
                  block={b}
                  onMoveOut={() => onMoveOut(b.id)}
                  onMoveToOther={onMoveToOther ? () => onMoveToOther(b.id) : undefined}
                  onDelete={onDeleteChild ? () => onDeleteChild(b.id) : undefined}
                  onMoveUp={onReorderChild && bIdx > 0 ? () => onReorderChild(b.id, "up") : undefined}
                  onMoveDown={onReorderChild && bIdx < blocks.length - 1 ? () => onReorderChild(b.id, "down") : undefined}
                  colZoneId={id}
                />
              ))}
              {isActive && (
                <div data-col-zone={id} className="flex items-center justify-center gap-1 py-3 rounded-lg border-2 border-dashed border-teal-400 bg-teal-100 text-teal-700 text-xs font-semibold">
                  <span className="text-base">↓</span> Drop here
                </div>
              )}
            </div>
          </SortableContext>
          {/* Add block button below existing blocks */}
          {!isActive && (
            <div className="px-1 pb-1">
              <button onClick={e => { e.stopPropagation(); setPickerOpen(true); }}
                className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-gray-200 text-gray-400 text-[10px] hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                <Plus size={10} /> Add Block
              </button>
            </div>
          )}
        </>
      )}
      <ColumnBlockPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onAddBlock={onAddBlock} />
    </div>
  );
}

// ─── Column Block Picker Dialog ─────────────────────────────────────────────
function ColumnBlockPickerDialog({ open, onOpenChange, onAddBlock }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAddBlock: (block: Block) => void;
}) {
  const [tab, setTab] = useState<"catalog" | "templates">("catalog");
  const [cat, setCat] = useState("Content");
  const [search, setSearch] = useState("");
  const { data: templates, isLoading: tplLoading } = trpc.blockTemplates.list.useQuery(
    { search: search || undefined },
    { enabled: open && tab === "templates" }
  );
  const categories = Array.from(new Set(BLOCK_CATALOG.filter(b => b.type !== "column_layout").map(b => b.category)));
  const catalogItems = BLOCK_CATALOG.filter(b => b.type !== "column_layout" && b.category === cat);
  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) setSearch(""); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="text-sm font-semibold">Add Block to Column</DialogTitle>
        </DialogHeader>
        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 shrink-0">
          <button onClick={() => setTab("catalog")} className={cn("px-3 py-2 text-xs font-semibold transition-colors", tab === "catalog" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>Block Catalog</button>
          <button onClick={() => setTab("templates")} className={cn("px-3 py-2 text-xs font-semibold transition-colors", tab === "templates" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>Saved Templates</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "catalog" && (
            <>
              {/* Category pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {categories.map(c => (
                  <button key={c} onClick={() => setCat(c)} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors", cat === c ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>{c}</button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {catalogItems.map(b => (
                  <button key={b.type} onClick={() => { onAddBlock({ id: uid(), type: b.type, data: { ...b.defaultData } }); onOpenChange(false); }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 text-gray-600 hover:text-teal-700 transition-all text-center">
                    <span className="text-teal-500" style={{ fontSize: 20 }}>{b.icon}</span>
                    <span className="text-[10px] font-medium text-gray-600 truncate w-full text-center">{b.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === "templates" && (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search saved templates…" className="pl-8 h-8 text-xs" />
              </div>
              {tplLoading ? (
                <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
              ) : !templates?.length ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                  <Layers className="w-8 h-8 opacity-30" />
                  <p className="text-xs">No saved block templates yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
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
                          </div>
                        </div>
                        <button onClick={() => { onAddBlock(block); onOpenChange(false); }}
                          className="shrink-0 px-2.5 py-1 text-xs bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">Add</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Column Child Block (sortable within a column) ────────────────────────────
function ColumnChildBlock({ block, onMoveOut, onMoveToOther, onDelete, onMoveUp, onMoveDown, colZoneId }: {
  block: Block;
  onMoveOut: () => void;
  onMoveToOther?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  colZoneId?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, pointerEvents: isDragging ? "none" as const : undefined };
  return (
    <div ref={setNodeRef} style={style} data-col-zone={colZoneId} className="relative group border border-gray-200 rounded bg-white overflow-hidden">
      {/* Top-left action toolbar */}
      <div className="absolute top-1 left-1 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <div {...attributes} {...listeners} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-gray-600 flex items-center justify-center cursor-grab active:cursor-grabbing" title="Drag to reorder"><GripVertical size={11} /></div>
        {onMoveToOther && (
          <button onClick={e => { e.stopPropagation(); onMoveToOther(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-teal-600 flex items-center justify-center" title="Move to other column"><ArrowLeftRight size={11} /></button>
        )}
        <button onClick={e => { e.stopPropagation(); onMoveOut(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-orange-500 flex items-center justify-center" title="Move out of column"><ArrowRight size={11} /></button>
        {onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-red-500 flex items-center justify-center" title="Remove from column"><Trash2 size={11} /></button>
        )}
      </div>
      {/* Up/down reorder buttons on the right */}
      {(onMoveUp || onMoveDown) && (
        <div className="absolute top-1 right-1 z-10 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onMoveUp && (
            <button onClick={e => { e.stopPropagation(); onMoveUp(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-teal-600 flex items-center justify-center" title="Move up"><ChevronUp size={11} /></button>
          )}
          {onMoveDown && (
            <button onClick={e => { e.stopPropagation(); onMoveDown(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-teal-600 flex items-center justify-center" title="Move down"><ChevronDown size={11} /></button>
          )}
        </div>
      )}
      {/* Block preview — pointer-events none so clicks don't fire block interactions */}
      <div className="pointer-events-none" data-col-zone={colZoneId}>
        <BlockPreview block={block} />
      </div>
    </div>
  );
}

export function SortableBlock({ block, isSelected, onSelect, onDelete, onDuplicate, onMoveUp, onMoveDown, onSaveAsTemplate, coursePrice, courseTitle, activeDragId, activeColumnTarget, onMoveBlockOutOfColumn, onAddBlockToColumn, onMoveChildToOtherColumn, onDeleteChildFromColumn, onReorderChildInColumn }: {
  block: Block; isSelected: boolean; onSelect: () => void; onDelete: () => void; onDuplicate: () => void; onMoveUp?: () => void; onMoveDown?: () => void; onSaveAsTemplate?: (block: Block) => void; coursePrice?: number; courseTitle?: string;
  activeDragId?: UniqueIdentifier | null;
  activeColumnTarget?: { blockId: string; side: "left" | "right" } | null;
  onMoveBlockOutOfColumn?: (colBlockId: string, side: "left" | "right", childBlockId: string) => void;
  onAddBlockToColumn?: (colBlockId: string, side: "left" | "right", newBlock: Block) => void;
  /** Move a child block from one column side to the other (left↔right) */
  onMoveChildToOtherColumn?: (colBlockId: string, fromSide: "left" | "right", childBlockId: string) => void;
  /** Delete a child block from inside a column */
  onDeleteChildFromColumn?: (colBlockId: string, side: "left" | "right", childBlockId: string) => void;
  /** Reorder a child block within its column side */
  onReorderChildInColumn?: (colBlockId: string, side: "left" | "right", childBlockId: string, direction: "up" | "down") => void;
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
    // When dragging a non-column block, disable pointer events so elementsFromPoint
    // can detect column drop zones underneath the dragged ghost element
    pointerEvents: (isDragging && !isColumnLayout) ? "none" as const : undefined,
  };
  const leftRatio = block.data?.leftRatio ?? 50;
  const gap = block.data?.gap ?? 32;

  return (
    <div ref={setNodeRef} style={style} onClick={(e) => { if ((e.target as HTMLElement).closest('[data-drag-handle]')) return; onSelect(); }} data-block-id={block.id}
      className={`relative group cursor-pointer border-2 transition-all ${isSelected ? "border-teal-500 shadow-lg shadow-teal-100" : "border-transparent hover:border-teal-200"}`}>
      <div className={`absolute top-2 right-2 z-10 flex gap-1 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-teal-600 flex items-center justify-center" title="Duplicate"><Copy size={12} /></button>
        {onSaveAsTemplate && <button onClick={e => { e.stopPropagation(); onSaveAsTemplate(block); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-teal-600 flex items-center justify-center" title="Save as template"><BookmarkPlus size={12} /></button>}
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-red-500 flex items-center justify-center" title="Delete"><Trash2 size={12} /></button>
      </div>
      {/* Up/Down arrow buttons */}
      <div className={`absolute top-2 left-10 z-10 flex flex-col gap-0.5 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
        <button disabled={!onMoveUp} onClick={e => { e.stopPropagation(); onMoveUp?.(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-teal-600 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" title="Move up"><ChevronUp size={12} /></button>
        <button disabled={!onMoveDown} onClick={e => { e.stopPropagation(); onMoveDown?.(); }} className="w-6 h-6 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-teal-600 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" title="Move down"><ChevronDown size={12} /></button>
      </div>
      <div
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className={`absolute top-2 left-2 z-10 w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-gray-600 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-100 transition-opacity`}
        title="Drag to reorder"
        data-drag-handle="true"
      ><GripVertical size={14} /></div>
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
                  onMoveToOther={onMoveChildToOtherColumn ? childId => onMoveChildToOtherColumn(block.id, "left", childId) : undefined}
                  onDeleteChild={onDeleteChildFromColumn ? childId => onDeleteChildFromColumn(block.id, "left", childId) : undefined}
                  onAddBlock={newBlock => onAddBlockToColumn?.(block.id, "left", newBlock)}
                  onReorderChild={onReorderChildInColumn ? (childId, dir) => onReorderChildInColumn(block.id, "left", childId, dir) : undefined}
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
                  onMoveToOther={onMoveChildToOtherColumn ? childId => onMoveChildToOtherColumn(block.id, "right", childId) : undefined}
                  onDeleteChild={onDeleteChildFromColumn ? childId => onDeleteChildFromColumn(block.id, "right", childId) : undefined}
                  onAddBlock={newBlock => onAddBlockToColumn?.(block.id, "right", newBlock)}
                  onReorderChild={onReorderChildInColumn ? (childId, dir) => onReorderChildInColumn(block.id, "right", childId, dir) : undefined}
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
  // ?t=timestamp is appended after AI generate to force a fresh load
  const searchStr = typeof window !== "undefined" ? window.location.search : "";
  const refreshKey = new URLSearchParams(searchStr).get("t") ?? "";

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Right panel resizable width
  const [rightPanelWidth, setRightPanelWidth] = useState(288);
  const rightPanelDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    rightPanelDragRef.current = { startX: e.clientX, startWidth: rightPanelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!rightPanelDragRef.current) return;
      const delta = rightPanelDragRef.current.startX - ev.clientX;
      const newWidth = Math.min(700, Math.max(240, rightPanelDragRef.current.startWidth + delta));
      setRightPanelWidth(newWidth);
    };
    const onUp = () => {
      rightPanelDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const [hasLoaded, setHasLoaded] = useState(false);

  // SEO / Link Preview state
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoImage, setSeoImage] = useState("");
  const [seoSaved, setSeoSaved] = useState(false);
  const seoInitialized = useRef(false);

  const lpUtils = trpc.useUtils();
  // Reset hasLoaded when courseId or refreshKey changes (e.g. after AI generate)
  useEffect(() => {
    setHasLoaded(false);
    setBlocks([]);
    setSelectedId(null);
    seoInitialized.current = false;
    // Invalidate the query so fresh data is fetched (not stale cache)
    lpUtils.lmsAdmin.getLandingPageBlocks.invalidate({ courseId: numericCourseId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericCourseId, refreshKey]);
  const [courseInfo, setCourseInfo] = useState<{ title: string; slug: string; price?: number } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templatesInitialTab, setTemplatesInitialTab] = useState<"page" | "block">("page");
  const [activeCat, setActiveCat] = useState<string>("Layout");
  // Block picker modal state
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"catalog" | "from_pages" | "templates" | "import_url">("catalog");
  const [importUrl, setImportUrl] = useState("");
  const [importPreview, setImportPreview] = useState<{ blocks: any[]; pageTitle: string; blockCount: number } | null>(null);
  const [importSelectedBlocks, setImportSelectedBlocks] = useState<Set<number>>(new Set());
  const scrapeUrlMutation = trpc.pageScraper.scrapeUrl.useMutation({
    onSuccess: (data) => {
      setImportPreview(data);
      setImportSelectedBlocks(new Set(data.blocks.map((_: any, i: number) => i)));
    },
    onError: (err: any) => toast.error(err.message || "Failed to scrape URL"),
  });
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [selectedSourceFunnelId, setSelectedSourceFunnelId] = useState<number | null>(null);
  const [selectedSourceFunnelPageId, setSelectedSourceFunnelPageId] = useState<number | null>(null);
  const [blockSearch, setBlockSearch] = useState("");
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
  const [activeColumnTarget, setActiveColumnTarget] = useState<{ blockId: string; side: "left" | "right" } | null>(null);
  // Use a ref so handleDragEnd always reads the latest column target (avoids stale closure)
  const activeColumnTargetRef = useRef<{ blockId: string; side: "left" | "right" } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  // Save-as-template dialog state
  const [saveTemplateDialogBlock, setSaveTemplateDialogBlock] = useState<Block | null>(null);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  // Ref to the scrollable canvas container for scoped scrollIntoView
  const canvasRef = useRef<HTMLDivElement>(null);
  // Track whether the last selectedId change came from a move action (not a click)
  const movedBlockRef = useRef<string | null>(null);

  // Auto-scroll preview canvas to the selected block when it moves
  useEffect(() => {
    if (!selectedId) return;
    // Small delay so the DOM has re-ordered the blocks before we scroll
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${selectedId}"]`);
      if (!el) return;
      const canvas = canvasRef.current;
      if (canvas) {
        // Scroll the canvas container so the block stays centered in view
        const elRect = el.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const elCenterRelative = elRect.top - canvasRect.top + canvas.scrollTop + elRect.height / 2;
        const targetScrollTop = elCenterRelative - canvas.clientHeight / 2;
        canvas.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      movedBlockRef.current = null;
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedId]);

  const { isLoading, data: lpData } = trpc.lmsAdmin.getLandingPageBlocks.useQuery(
    { courseId: numericCourseId },
    { enabled: !isNaN(numericCourseId), staleTime: 0 }
  );

  // Initialize blocks from server data — must be in useEffect to avoid setState-during-render (React error #185)
  useEffect(() => {
    if (!lpData || hasLoaded) return;
    setHasLoaded(true);
    setCourseInfo({ title: lpData.courseTitle, slug: lpData.courseSlug, price: lpData.coursePrice });
    // Initialize SEO fields once per page load
    if (!seoInitialized.current) {
      seoInitialized.current = true;
      setSeoTitle(lpData.seoTitle ?? "");
      setSeoDescription(lpData.seoDescription ?? "");
      setSeoImage(lpData.seoImage ?? "");
    }
    if (lpData.blocks && lpData.blocks.length > 0) {
      setBlocks(lpData.blocks as Block[]);
    } else {
      setBlocks([
        { id: uid(), type: "hero", data: { headline: lpData.heroTitle || lpData.courseTitle || "Your Course Title", subheadline: lpData.heroSubtitle || "", bgType: "color", bgColor: "#179ca3", textColor: "#ffffff", align: "left", buttons: [{ text: lpData.ctaText || "Enroll Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }] } },
        { id: uid(), type: "bullets", data: { headline: "What You'll Learn", items: ["Key skill or concept one", "Key skill or concept two", "Key skill or concept three"], iconColor: "#179ca3", bgColor: "#f8fffe" } },
        { id: uid(), type: "pricing_cta", data: { headline: "Ready to Get Started?", subtext: "Join thousands of sonographers improving their skills.", ctaText: lpData.ctaText || "Enroll Now", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true } },
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpData]);

  const saveBlocks = trpc.lmsAdmin.saveLandingPageBlocks.useMutation({
    onSuccess: () => toast.success("Landing page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  // SEO mutation
  const saveSeoMutation = trpc.lmsAdmin.saveLandingPageSeo.useMutation({
    onSuccess: () => {
      setSeoSaved(true);
      setTimeout(() => setSeoSaved(false), 2000);
      lpUtils.lmsAdmin.getLandingPageBlocks.invalidate({ courseId: numericCourseId });
    },
    onError: (e: any) => toast.error(`SEO save failed: ${e.message}`),
  });

  const handleSaveSeo = () => {
    saveSeoMutation.mutate({
      courseId: numericCourseId,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      seoImage: seoImage.trim() || null,
    });
  };

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

  // Native pointermove handler — uses elementsFromPoint for reliable column zone detection
  const pointerMoveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id);
    setActiveColumnTarget(null);
    activeColumnTargetRef.current = null;

    // Attach a native pointermove listener to detect col zones via data-col-zone attribute
    const handler = (e: PointerEvent) => {
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      let found: { blockId: string; side: "left" | "right" } | null = null;
      for (const el of els) {
        const zoneId = (el as HTMLElement).dataset?.colZone;
        if (zoneId && zoneId.startsWith("col:")) {
          const parsed = parseColId(zoneId);
          if (parsed) { found = parsed; break; }
        }
      }
      if (JSON.stringify(found) !== JSON.stringify(activeColumnTargetRef.current)) {
        activeColumnTargetRef.current = found;
        setActiveColumnTarget(found);
      }
    };
    pointerMoveHandlerRef.current = handler;
    document.addEventListener("pointermove", handler);
  };

  // onDragOver kept for compatibility but column detection is now done via pointermove
  const handleDragOver = (_event: any) => {
    // No-op: column zone detection is handled by the native pointermove listener above
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // Clean up the native pointermove listener
    if (pointerMoveHandlerRef.current) {
      document.removeEventListener("pointermove", pointerMoveHandlerRef.current);
      pointerMoveHandlerRef.current = null;
    }
    // Read from ref (not state) to avoid stale closure
    const currentTarget = activeColumnTargetRef.current;
    setActiveDragId(null);
    setActiveColumnTarget(null);
    activeColumnTargetRef.current = null;

    const { active } = event;
    const activeIdStr = String(active.id);
    const currentBlocks = blocksRef.current;

    // Case 1: Dropping onto a column zone — use the tracked target from pointermove
    if (currentTarget) {
      // First look for the dragged block on the main canvas
      let draggedBlock = currentBlocks.find(b => b.id === activeIdStr);
      let sourceColBlockId: string | null = null;
      let sourceSide: "left" | "right" | null = null;

      // If not on main canvas, look inside all column blocks
      if (!draggedBlock) {
        for (const colBlock of currentBlocks) {
          if (colBlock.type !== "column_layout") continue;
          for (const side of ["leftBlocks", "rightBlocks"] as const) {
            const col: Block[] = colBlock.data[side] ?? [];
            const found = col.find(cb => cb.id === activeIdStr);
            if (found) {
              draggedBlock = found;
              sourceColBlockId = colBlock.id;
              sourceSide = side === "leftBlocks" ? "left" : "right";
              break;
            }
          }
          if (draggedBlock) break;
        }
      }

      if (!draggedBlock) return;
      if (draggedBlock.type === "column_layout") return; // prevent nesting

      // Prevent dropping into the same column it came from
      if (sourceColBlockId === currentTarget.blockId && sourceSide === currentTarget.side) return;

      setBlocks(prev => {
        let next = prev;

        // Remove from source: main canvas or source column
        if (sourceColBlockId) {
          // Remove from source column
          next = next.map(b => {
            if (b.id !== sourceColBlockId) return b;
            const srcKey = sourceSide === "left" ? "leftBlocks" : "rightBlocks";
            return { ...b, data: { ...b.data, [srcKey]: (b.data[srcKey] ?? []).filter((cb: Block) => cb.id !== activeIdStr) } };
          });
        } else {
          // Remove from main canvas
          next = next.filter(b => b.id !== activeIdStr);
        }

        // Add to target column
        return next.map(b => {
          if (b.id !== currentTarget.blockId) return b;
          const colKey = currentTarget.side === "left" ? "leftBlocks" : "rightBlocks";
          const existing: Block[] = b.data[colKey] ?? [];
          return { ...b, data: { ...b.data, [colKey]: [...existing, draggedBlock!] } };
        });
      });
      return;
    }

    const { over } = event;
    if (!over) return;
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    // Case 4: Dragging a column child block out to the main canvas
    // active is a child block inside a column, over is a main canvas block
    {
      let sourceColBlockId: string | null = null;
      let sourceSide: "left" | "right" | null = null;
      let draggedChildBlock: Block | null = null;

      for (const colBlock of currentBlocks) {
        if (colBlock.type !== "column_layout") continue;
        for (const side of ["leftBlocks", "rightBlocks"] as const) {
          const col: Block[] = colBlock.data[side] ?? [];
          const found = col.find(cb => cb.id === activeIdStr);
          if (found) {
            draggedChildBlock = found;
            sourceColBlockId = colBlock.id;
            sourceSide = side === "leftBlocks" ? "left" : "right";
            break;
          }
        }
        if (draggedChildBlock) break;
      }

      if (draggedChildBlock && sourceColBlockId && sourceSide) {
        // Check if over is a main canvas block (not a column zone)
        const overIsMainBlock = currentBlocks.some(b => b.id === overIdStr);
        if (overIsMainBlock) {
          setBlocks(prev => {
            // Remove from source column
            let movedBlock: Block | null = null;
            let next = prev.map(b => {
              if (b.id !== sourceColBlockId) return b;
              const colKey = sourceSide === "left" ? "leftBlocks" : "rightBlocks";
              const col: Block[] = b.data[colKey] ?? [];
              const child = col.find(cb => cb.id === activeIdStr);
              if (child) movedBlock = child;
              return { ...b, data: { ...b.data, [colKey]: col.filter(cb => cb.id !== activeIdStr) } };
            });
            if (!movedBlock) return prev;
            // Insert at the position of the over block on the main canvas
            const overIdx = next.findIndex(b => b.id === overIdStr);
            if (overIdx === -1) return [...next, movedBlock];
            return [...next.slice(0, overIdx), movedBlock, ...next.slice(overIdx)];
          });
          return;
        }
      }
    }

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
    setBlocks(prev => prev.map(b => {
      if (b.id === id) return { ...b, data };
      // Also update child blocks inside column_layout
      if (b.type === "column_layout") {
        const leftBlocks: Block[] = b.data?.leftBlocks ?? [];
        const rightBlocks: Block[] = b.data?.rightBlocks ?? [];
        const newLeft = leftBlocks.map((cb: Block) => cb.id === id ? { ...cb, data } : cb);
        const newRight = rightBlocks.map((cb: Block) => cb.id === id ? { ...cb, data } : cb);
        if (newLeft !== leftBlocks || newRight !== rightBlocks) {
          return { ...b, data: { ...b.data, leftBlocks: newLeft, rightBlocks: newRight } };
        }
      }
      return b;
    }));
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

  const utils = trpc.useUtils();
  const saveBlockTemplateMutation = trpc.blockTemplates.save.useMutation({
    onSuccess: () => { toast.success("Block saved as template!"); utils.blockTemplates.list.invalidate(); },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSaveBlockAsTemplate = useCallback((block: Block) => {
    const label = BLOCK_CATALOG.find(c => c.type === block.type)?.label ?? block.type;
    setSaveTemplateName(`${label} — ${new Date().toLocaleDateString()}`);
    setSaveTemplateDesc("Saved from page builder");
    setSaveTemplateDialogBlock(block);
  }, []);

  // Also search column_layout children so clicking a child block opens its settings
  const selectedBlock = blocks.find(b => b.id === selectedId) ??
    blocks.flatMap(b => b.type === "column_layout" ? [...(b.data?.leftBlocks ?? []), ...(b.data?.rightBlocks ?? [])] : []).find(b => b.id === selectedId);
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
  // Block picker: fetch funnels with pages (for funnel page source in "Copy from Other Pages" tab)
  const { data: funnelsWithPages } = trpc.funnelAdmin.getFunnelsWithPages.useQuery(
    undefined,
    { enabled: addMenuOpen && pickerTab === "from_pages" }
  );
  const sourceFunnelPageBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceFunnelId || !selectedSourceFunnelPageId || !funnelsWithPages) return [];
    const funnel = funnelsWithPages.find((f: any) => f.id === selectedSourceFunnelId);
    const page = funnel?.pages.find((p: any) => p.id === selectedSourceFunnelPageId);
    if (!page?.blocks) return [];
    try {
      const parsed = typeof page.blocks === "string" ? JSON.parse(page.blocks) : page.blocks;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [selectedSourceFunnelId, selectedSourceFunnelPageId, funnelsWithPages]);
  const activeSourceBlocks = selectedSourceFunnelPageId ? sourceFunnelPageBlocks : sourceCourseBlocks;
  const filteredSourceBlocks = useMemo(() => {
    if (!blockSearch.trim()) return activeSourceBlocks;
    const q = blockSearch.toLowerCase();
    return activeSourceBlocks.filter((b: Block) =>
      b.type.toLowerCase().includes(q) ||
      JSON.stringify(b.data).toLowerCase().includes(q)
    );
  }, [activeSourceBlocks, blockSearch]);
  const copyBlockFromSource = (block: Block) => {
    const copy: Block = { ...block, id: uid() };
    setBlocks(prev => [...prev, copy]);
    setSelectedId(copy.id);
    toast.success("Block copied!");
    setAddMenuOpen(false);
  };
  const copyAllBlocksFromSource = () => {
    if (!activeSourceBlocks.length) return;
    const copies = activeSourceBlocks.map((b: Block) => ({ ...b, id: uid() }));
    setBlocks(prev => [...prev, ...copies]);
    toast.success(`${copies.length} block${copies.length > 1 ? "s" : ""} copied!`);
    setAddMenuOpen(false);
  };

  return (
    <>
    <BlockTemplateLibraryProvider onInsert={(block) => { setBlocks(prev => [...prev, block]); setSelectedId(block.id); }}>
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
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
            <a href={`https://learn.allaboutultrasound.com/courses/${courseInfo.slug}?preview=admin`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
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
        <div ref={canvasRef} className="flex-1 overflow-y-auto bg-gray-100">
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
                modifiers={[restrictToFirstScrollableAncestor]}
                collisionDetection={(args) => {
                  // pointerWithin detects col: droppable zones; closestCorners handles tall-block reordering
                  const pointer = pointerWithin(args);
                  if (pointer.length > 0) return pointer;
                  return closestCorners(args);
                }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}>
                <SortableContext items={[
                    ...blocks.map(b => b.id),
                    ...blocks.flatMap(b => b.type === "column_layout" ? [...(b.data?.leftBlocks ?? []), ...(b.data?.rightBlocks ?? [])].map((cb: any) => cb.id) : []),
                  ]} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <SortableBlock key={block.id} block={block} isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)} onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)} coursePrice={courseInfo?.price} courseTitle={courseInfo?.title}
                      onSaveAsTemplate={handleSaveBlockAsTemplate}
                      activeDragId={activeDragId}
                      activeColumnTarget={activeColumnTarget}
                      onMoveUp={idx > 0 ? () => {
                        const blockId = block.id;
                        setBlocks(prev => arrayMove(prev, idx, idx - 1));
                        setSelectedId(blockId);
                        movedBlockRef.current = blockId;
                      } : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => {
                        const blockId = block.id;
                        setBlocks(prev => arrayMove(prev, idx, idx + 1));
                        setSelectedId(blockId);
                        movedBlockRef.current = blockId;
                      } : undefined}
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
                      onAddBlockToColumn={(colBlockId, side, newBlock) => {
                        setBlocks(prev => prev.map(b => {
                          if (b.id !== colBlockId) return b;
                          const colKey = side === "left" ? "leftBlocks" : "rightBlocks";
                          const existing: Block[] = b.data[colKey] ?? [];
                          return { ...b, data: { ...b.data, [colKey]: [...existing, newBlock] } };
                        }));
                        setSelectedId(newBlock.id);
                      }}
                      onMoveChildToOtherColumn={(colBlockId, fromSide, childBlockId) => {
                        setBlocks(prev => prev.map(b => {
                          if (b.id !== colBlockId) return b;
                          const srcKey = fromSide === "left" ? "leftBlocks" : "rightBlocks";
                          const dstKey = fromSide === "left" ? "rightBlocks" : "leftBlocks";
                          const src: Block[] = b.data[srcKey] ?? [];
                          const dst: Block[] = b.data[dstKey] ?? [];
                          const child = src.find(cb => cb.id === childBlockId);
                          if (!child) return b;
                          return { ...b, data: { ...b.data, [srcKey]: src.filter(cb => cb.id !== childBlockId), [dstKey]: [...dst, child] } };
                        }));
                      }}
                      onDeleteChildFromColumn={(colBlockId, side, childBlockId) => {
                        setBlocks(prev => prev.map(b => {
                          if (b.id !== colBlockId) return b;
                          const colKey = side === "left" ? "leftBlocks" : "rightBlocks";
                          return { ...b, data: { ...b.data, [colKey]: (b.data[colKey] ?? []).filter((cb: Block) => cb.id !== childBlockId) } };
                        }));
                        setSelectedId(null);
                      }}
                      onReorderChildInColumn={(colBlockId, side, childBlockId, direction) => {
                        setBlocks(prev => prev.map(b => {
                          if (b.id !== colBlockId) return b;
                          const colKey = side === "left" ? "leftBlocks" : "rightBlocks";
                          const arr: Block[] = [...(b.data[colKey] ?? [])];
                          const idx = arr.findIndex(cb => cb.id === childBlockId);
                          if (idx === -1) return b;
                          const newIdx = direction === "up" ? idx - 1 : idx + 1;
                          if (newIdx < 0 || newIdx >= arr.length) return b;
                          [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
                          return { ...b, data: { ...b.data, [colKey]: arr } };
                        }));
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

        {/* Right Panel: Block Settings / Page SEO */}
        <div className="flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto relative" style={{ width: rightPanelWidth }}>
          {/* Drag handle */}
          <div
            onMouseDown={handleRightPanelMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400 active:bg-teal-500 z-10 transition-colors"
            title="Drag to resize panel"
          />
          {selectedBlock ? (
            <>
              <div className="flex items-center justify-between pl-4 pr-3 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {BLOCK_CATALOG.find(c => c.type === selectedBlock.type)?.label ?? "Block"} Settings
                </p>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
              <div className="pl-4 pr-3 py-3">
                <BlockSettings block={selectedBlock} onChange={(data) => updateBlock(selectedBlock.id, data)} courseId={numericCourseId} />
              </div>
            </>
          ) : (
            <div className="flex flex-col h-full">
              <div className="pl-4 pr-3 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Bookmark size={12} /> Link Preview / SEO
                </p>
              </div>
              <div className="pl-4 pr-3 py-3 space-y-3 flex-1">
                <p className="text-[10px] text-gray-400">Override what iMessage, WhatsApp, and social media show when this page link is shared.</p>
                <div>
                  <label className="text-[10px] font-medium text-gray-600 block mb-1">Display Name (og:title)</label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder={courseInfo?.title ?? "Page title"}
                    value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-600 block mb-1">Description (og:description)</label>
                  <textarea
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    rows={3}
                    placeholder="Short description shown in link previews…"
                    value={seoDescription}
                    onChange={e => setSeoDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-600 block mb-1">Preview Image URL (og:image)</label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="https://…"
                    value={seoImage}
                    onChange={e => setSeoImage(e.target.value)}
                  />
                  {seoImage && (
                    <img src={seoImage} alt="Preview" className="mt-1.5 w-full rounded-lg border border-gray-200 object-cover" style={{ maxHeight: 80 }} />
                  )}
                </div>
                {/* Mini link preview card */}
                {(seoTitle || seoDescription) && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {seoImage && <img src={seoImage} alt="" className="w-full object-cover" style={{ maxHeight: 60 }} />}
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] font-semibold text-gray-800 truncate">{seoTitle || courseInfo?.title}</p>
                      {seoDescription && <p className="text-[9px] text-gray-500 line-clamp-2">{seoDescription}</p>}
                      <p className="text-[9px] text-teal-600 mt-0.5 truncate">{typeof window !== 'undefined' ? window.location.hostname : 'learn.allaboutultrasound.com'}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSaveSeo}
                  disabled={saveSeoMutation.isPending}
                  className="w-full text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg py-1.5 transition-colors disabled:opacity-50"
                >
                  {seoSaved ? "✓ Saved!" : saveSeoMutation.isPending ? "Saving…" : "Save Preview Settings"}
                </button>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 text-center">Click any block on the canvas to edit its settings</p>
                </div>
              </div>
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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-teal-700 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add Content Block
          </DialogTitle>
        </DialogHeader>
        {/* Top-level tabs */}
        <div className="flex border-b border-gray-200 shrink-0 overflow-x-auto scrollbar-none -mx-4 sm:-mx-6 px-4 sm:px-6">
          {([
            { id: "catalog", icon: <Plus className="w-3.5 h-3.5" />, label: "New Block" },
            { id: "from_pages", icon: <BookOpen className="w-3.5 h-3.5" />, label: "Copy" },
            { id: "templates", icon: <Layers className="w-3.5 h-3.5" />, label: "Templates" },
            { id: "import_url", icon: <Globe className="w-3.5 h-3.5" />, label: "Import URL" },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => { setPickerTab(tab.id); if (tab.id === "import_url") setImportPreview(null); }}
              className={cn(
                "px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 shrink-0",
                pickerTab === tab.id
                  ? "text-teal-700 border-b-2 border-teal-500"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>
        {/* ── Catalog tab ── */}
        {pickerTab === "catalog" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none bg-gray-50 shrink-0 -mx-4 sm:-mx-6 px-4 sm:px-6">
              {CATALOG_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)} className={cn("px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0", activeCat === cat ? "text-teal-700 border-b-2 border-teal-500 bg-white" : "text-gray-500 hover:text-gray-700")}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1 overflow-y-auto flex-1">
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
                  onChange={e => { setSelectedSourceCourseId(e.target.value ? Number(e.target.value) : null); setSelectedSourceFunnelId(null); setSelectedSourceFunnelPageId(null); setBlockSearch(""); }}
                >
                  <option value="">— select course —</option>
                  {coursesWithBlocks?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Funnel Page</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                  value={selectedSourceFunnelId ?? ""}
                  onChange={e => { setSelectedSourceFunnelId(e.target.value ? Number(e.target.value) : null); setSelectedSourceFunnelPageId(null); setSelectedSourceCourseId(null); setBlockSearch(""); }}
                >
                  <option value="">— select funnel —</option>
                  {funnelsWithPages?.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {selectedSourceFunnelId && (() => {
                  const pages = funnelsWithPages?.find((f: any) => f.id === selectedSourceFunnelId)?.pages ?? [];
                  return pages.length === 0 ? (
                    <p className="text-xs text-gray-400 mt-1">No pages with blocks.</p>
                  ) : (
                    <div className="space-y-1 mt-1">
                      {pages.map((p: any) => (
                        <button key={p.id} onClick={() => { setSelectedSourceFunnelPageId(p.id); setBlockSearch(""); }}
                          className={cn("w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors", selectedSourceFunnelPageId === p.id ? "bg-teal-50 text-teal-700 font-semibold border border-teal-200" : "text-gray-600 hover:bg-gray-50")}>
                          {p.title}<span className="text-[10px] text-gray-400 ml-1 capitalize">({p.pageType})</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {!selectedSourceCourseId && !selectedSourceFunnelPageId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p>Select a course or funnel page to browse its blocks</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2 shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input value={blockSearch} onChange={e => setBlockSearch(e.target.value)} placeholder="Search blocks…" className="pl-7 h-7 text-xs" />
                    </div>
                    {activeSourceBlocks.length > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0" onClick={copyAllBlocksFromSource}>
                        <Copy className="w-3 h-3 mr-1" /> Copy All ({activeSourceBlocks.length})
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
        {/* ── Import from URL tab ── */}
        {pickerTab === "import_url" && (
          <div className="flex flex-col flex-1 overflow-hidden gap-3 p-1">
            <div className="flex gap-2">
              <input
                type="url"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && importUrl.trim()) scrapeUrlMutation.mutate({ url: importUrl.trim() }); }}
                placeholder="https://example.com/page-to-import"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button
                onClick={() => { if (importUrl.trim()) scrapeUrlMutation.mutate({ url: importUrl.trim() }); }}
                disabled={!importUrl.trim() || scrapeUrlMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {scrapeUrlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {scrapeUrlMutation.isPending ? "Scraping..." : "Scrape"}
              </button>
            </div>
            {importPreview && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Found <strong>{importPreview.blockCount}</strong> blocks from <em>{importPreview.pageTitle || importUrl}</em>. Select which to import:
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setImportSelectedBlocks(new Set(importPreview.blocks.map((_: any, i: number) => i)))} className="text-xs text-teal-600 hover:underline">All</button>
                    <button onClick={() => setImportSelectedBlocks(new Set())} className="text-xs text-gray-500 hover:underline">None</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-2">
                  {importPreview.blocks.map((block: any, i: number) => (
                    <label key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importSelectedBlocks.has(i)}
                        onChange={e => {
                          const next = new Set(importSelectedBlocks);
                          if (e.target.checked) next.add(i); else next.delete(i);
                          setImportSelectedBlocks(next);
                        }}
                        className="mt-0.5 accent-teal-600"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">{block.type}</span>
                        <p className="text-xs text-gray-500 truncate">
                          {block.type === "hero" ? block.data?.headline :
                           block.type === "text" ? (block.data?.html || "").replace(/<[^>]+>/g, "").slice(0, 80) :
                           block.type === "bullets" || block.type === "numbered_list" ? (block.data?.items?.[0] || "") :
                           block.type === "image" ? (block.data?.alt || block.data?.url || "Image") :
                           JSON.stringify(block.data).slice(0, 80)}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  disabled={importSelectedBlocks.size === 0}
                  onClick={() => {
                    const toAdd = importPreview.blocks
                      .filter((_: any, i: number) => importSelectedBlocks.has(i))
                      .map((b: any) => ({ ...b, id: uid() }));
                    setBlocks(prev => [...prev, ...toAdd]);
                    setAddMenuOpen(false);
                    toast.success(`Imported ${toAdd.length} block${toAdd.length !== 1 ? "s" : ""} from URL!`);
                  }}
                  className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Import {importSelectedBlocks.size} Selected Block{importSelectedBlocks.size !== 1 ? "s" : ""}
                </button>
              </>
            )}
            {!importPreview && !scrapeUrlMutation.isPending && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-gray-400">
                <Globe className="w-10 h-10 opacity-30" />
                <p className="text-sm">Enter a URL above and click Scrape to import page content as blocks.</p>
                <p className="text-xs">Headings, paragraphs, images, and lists will be converted to content blocks automatically.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* ── Save Block as Template Dialog ── */}
    <Dialog open={!!saveTemplateDialogBlock} onOpenChange={(open) => { if (!open) setSaveTemplateDialogBlock(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-teal-700 flex items-center gap-2">
            <Bookmark className="w-4 h-4" /> Save Block as Template
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1 block">Template Name <span className="text-red-500">*</span></Label>
            <Input
              value={saveTemplateName}
              onChange={e => setSaveTemplateName(e.target.value)}
              placeholder="e.g. Hero Banner — Teal"
              className="text-sm"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1 block">Description <span className="text-gray-400">(optional)</span></Label>
            <Input
              value={saveTemplateDesc}
              onChange={e => setSaveTemplateDesc(e.target.value)}
              placeholder="Brief description of this block template"
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveTemplateDialogBlock(null)} className="text-sm">Cancel</Button>
          <Button
            disabled={!saveTemplateName.trim() || saveBlockTemplateMutation.isPending}
            onClick={() => {
              if (!saveTemplateDialogBlock || !saveTemplateName.trim()) return;
              saveBlockTemplateMutation.mutate(
                {
                  name: saveTemplateName.trim(),
                  description: saveTemplateDesc.trim() || undefined,
                  blockType: saveTemplateDialogBlock.type,
                  blockData: JSON.parse(JSON.stringify(saveTemplateDialogBlock.data ?? {})),
                },
                { onSuccess: () => { setSaveTemplateDialogBlock(null); } }
              );
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm"
          >
            {saveBlockTemplateMutation.isPending ? "Saving…" : "Save Template"}
          </Button>
        </DialogFooter>
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
    // Use slug-based serve URL so it never expires and access control is enforced
    const slug = asset.slug ?? "";
    const url = slug ? `/api/media/${slug}/download` : (asset.currentVersion?.s3Url ?? "");
    const title = asset.title ?? asset.currentVersion?.fileName ?? "File";
    const size = asset.currentVersion?.fileSize
      ? asset.currentVersion.fileSize > 1024 * 1024
        ? `${(asset.currentVersion.fileSize / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(asset.currentVersion.fileSize / 1024)} KB`
      : "";
    set("source", "media_repo");
    set("mediaAssetId", asset.id);
    set("mediaAssetSlug", slug);
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

      {/* Alignment */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Alignment</label>
        <div className="flex gap-1">{(["left","center","right"] as const).map(a => <button key={a} onClick={() => set("align", a)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.align ?? "center") === a ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{a}</button>)}</div>
      </div>
      {/* Width */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Width</label>
        <div className="flex flex-wrap gap-1 mb-1">{(["100%","75%","50%","33%","25%"] as const).map(w => <button key={w} onClick={() => set("maxWidth", w)} className={`px-2 py-0.5 text-xs rounded border ${(d.maxWidth ?? "100%") === w ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{w}</button>)}</div>
        <DebouncedInput value={d.maxWidth ?? "100%"} onChange={v => set("maxWidth", v)} className="h-7 text-xs" placeholder="100%, 600px, etc." />
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
                  <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50"
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

// ─── Video Block Settings ──────────────────────────────────────────────────────
export function VideoBlockSettings({ d, set, uploading, setUploading, uploadMedia }: {
  d: Record<string, any>;
  set: (key: string, val: any) => void;
  uploading: string | null;
  setUploading: (v: string | null) => void;
  uploadMedia: any;
}) {
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaPage, setMediaPage] = useState(1);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { data: mediaData } = trpc.mediaRepo.listAssets.useQuery(
    { search: mediaSearch || undefined, page: mediaPage, pageSize: 12, mediaType: "video" },
    { enabled: showMediaPicker }
  );

  const handleVideoUpload = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) { toast.error("Video must be under 50 MB. For larger videos, upload to the Media Repository first, then use the Media Library tab."); return; }
    setUploading("video_block_upload");
    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const result = await uploadMedia.mutateAsync({ dataUri, mimeType: file.type, fileName: file.name, context: "video-block" });
      set("embedUrl", result.url);
      set("source", "upload");
      set("uploadedFileName", file.name);
      toast.success("Video uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploading(null);
  };

  const selectMediaAsset = (asset: any) => {
    const url = asset.currentVersion?.s3Url ?? "";
    set("embedUrl", url);
    set("source", "media_repo");
    set("mediaAssetId", asset.id);
    set("mediaAssetTitle", asset.title ?? asset.currentVersion?.fileName ?? "Video");
    setShowMediaPicker(false);
    toast.success("Video selected from media repository");
  };

  const sourceMode = d.source ?? "url";

  return (
    <div className="space-y-3">
      {/* Source selector */}
      <div>
        <label className="text-xs text-gray-500 block mb-1 font-medium">Video Source</label>
        <div className="flex gap-1">
          {(["url", "upload", "media_repo"] as const).map(s => (
            <button
              key={s}
              onClick={() => set("source", s)}
              className={`flex-1 py-1.5 text-xs rounded border capitalize transition-colors ${sourceMode === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:border-teal-300"}`}
            >
              {s === "url" ? "URL / Embed" : s === "upload" ? "Upload" : "Media Library"}
            </button>
          ))}
        </div>
      </div>

      {/* URL / Embed mode */}
      {sourceMode === "url" && (
        <>
          <BSTextField data={d} onSet={set} label="Embed URL (YouTube, Vimeo, Wistia, or direct .mp4)" field="embedUrl" />
          <UserParamTagsHelper context="url" />
        </>
      )}

      {/* Upload mode */}
      {sourceMode === "upload" && (
        <div className="space-y-2">
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ""; }}
          />
          {d.embedUrl && d.source === "upload" ? (
            <div className="border border-teal-200 rounded p-2 bg-teal-50 space-y-1">
              <p className="text-xs text-teal-700 font-medium truncate">{d.uploadedFileName ?? "Uploaded video"}</p>
              <p className="text-xs text-gray-400 truncate">{d.embedUrl}</p>
              <button onClick={() => videoInputRef.current?.click()} className="text-xs text-teal-600 hover:underline">Replace video</button>
            </div>
          ) : (
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={uploading === "video_block_upload"}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-xs text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors disabled:opacity-50"
            >
              {uploading === "video_block_upload" ? (
                <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</span>
              ) : (
                <>
                  <div className="text-2xl mb-1">🎬</div>
                  <p className="font-medium">Click to upload video</p>
                  <p className="text-gray-400 mt-0.5">MP4, WebM, MOV — max 50 MB</p>
                  <p className="text-gray-400 mt-0.5 text-[10px]">For larger files, upload to Media Repository first</p>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Media Repository picker */}
      {sourceMode === "media_repo" && (
        <div className="space-y-2">
          {d.embedUrl && d.source === "media_repo" ? (
            <div className="border border-teal-200 rounded p-2 bg-teal-50 space-y-1">
              <p className="text-xs text-teal-700 font-medium truncate">{d.mediaAssetTitle ?? "Media repository video"}</p>
              <p className="text-xs text-gray-400 truncate">{d.embedUrl}</p>
              <button onClick={() => setShowMediaPicker(true)} className="text-xs text-teal-600 hover:underline">Change video</button>
            </div>
          ) : (
            <button
              onClick={() => setShowMediaPicker(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-xs text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors"
            >
              <div className="text-2xl mb-1">🗂️</div>
              <p className="font-medium">Pick from Media Library</p>
              <p className="text-gray-400 mt-0.5">Browse uploaded videos</p>
            </button>
          )}

          {showMediaPicker && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="font-semibold text-sm">Media Library — Videos</h3>
                  <button onClick={() => setShowMediaPicker(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <div className="px-4 py-2 border-b">
                  <input
                    type="text"
                    placeholder="Search videos..."
                    value={mediaSearch}
                    onChange={e => { setMediaSearch(e.target.value); setMediaPage(1); }}
                    className="w-full h-8 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {!mediaData ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
                  ) : mediaData.assets.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No videos found in media library</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {mediaData.assets.map((asset: any) => (
                        <button
                          key={asset.id}
                          onClick={() => selectMediaAsset(asset)}
                          className="border border-gray-200 rounded-lg p-2 text-left hover:border-teal-400 hover:bg-teal-50 transition-colors"
                        >
                          <div className="w-full aspect-video bg-gray-100 rounded mb-1.5 flex items-center justify-center text-2xl overflow-hidden">
                            {asset.currentVersion?.thumbnailUrl
                              ? <img src={asset.currentVersion.thumbnailUrl} alt="" className="w-full h-full object-cover rounded" />
                              : "🎬"}
                          </div>
                          <p className="text-xs font-medium text-gray-700 truncate">{asset.title ?? asset.currentVersion?.fileName}</p>
                          {asset.currentVersion?.fileSize && (
                            <p className="text-xs text-gray-400">
                              {asset.currentVersion.fileSize > 1024 * 1024
                                ? `${(asset.currentVersion.fileSize / (1024 * 1024)).toFixed(1)} MB`
                                : `${Math.round(asset.currentVersion.fileSize / 1024)} KB`}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {mediaData && mediaData.total > 12 && (
                  <div className="flex justify-between items-center px-4 py-2 border-t text-xs text-gray-500">
                    <button onClick={() => setMediaPage(p => Math.max(1, p - 1))} disabled={mediaPage === 1} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
                    <span>Page {mediaPage} of {Math.ceil(mediaData.total / 12)}</span>
                    <button onClick={() => setMediaPage(p => p + 1)} disabled={mediaPage * 12 >= mediaData.total} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <BSTextField data={d} onSet={set} label="Caption" field="caption" />

      <div className="border border-gray-100 rounded p-2 space-y-2">
        <p className="text-xs font-semibold text-gray-600 mb-1">Playback Options</p>
        <div className="flex items-center gap-2"><input type="checkbox" checked={d.autoplay ?? false} onChange={e => set("autoplay", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Autoplay <span className="text-gray-400">(direct video files only)</span></label></div>
        <div className="flex items-center gap-2"><input type="checkbox" checked={d.muted ?? true} onChange={e => set("muted", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Muted <span className="text-gray-400">(required for autoplay)</span></label></div>
        <div className="flex items-center gap-2"><input type="checkbox" checked={d.loop ?? false} onChange={e => set("loop", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Loop</label></div>
        <div className="flex items-center gap-2"><input type="checkbox" checked={d.controls ?? true} onChange={e => set("controls", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show controls</label></div>
      </div>

      <div><label className="text-xs text-gray-500 block mb-1">Max Width</label><DebouncedInput value={d.maxWidth ?? "100%"} onChange={v => set("maxWidth", v)} className="h-8 text-sm" placeholder="100%, 800px, etc." /></div>
      <div><label className="text-xs text-gray-500 block mb-1">Height</label><DebouncedInput value={d.height ?? ""} onChange={v => set("height", v)} className="h-8 text-sm" placeholder="auto, 450px, etc." /></div>
      <div><label className="text-xs text-gray-500 block mb-1">Border Radius (px)</label><Input type="number" value={d.borderRadius ?? 0} onChange={e => set("borderRadius", Number(e.target.value))} className="h-8 text-sm" min={0} max={999} /></div>
      <div><label className="text-xs text-gray-500 block mb-1">Border Width (px)</label><Input type="number" value={d.borderWidth ?? 0} onChange={e => set("borderWidth", Number(e.target.value))} className="h-8 text-sm" min={0} max={20} /></div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Border Style</label>
        <div className="flex gap-1">{(["solid", "dashed", "dotted"] as const).map(s => <button key={s} onClick={() => set("borderStyle", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${(d.borderStyle ?? "solid") === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div>
      </div>
      <BSColorField data={d} onSet={set} label="Border Color" field="borderColor" />
      <div className="border border-gray-100 rounded p-2 space-y-2">
        <p className="text-xs font-semibold text-gray-600 mb-1">Player Theme</p>
        <BSColorField data={d} onSet={set} label="Accent Color (play button &amp; progress bar)" field="accentColor" />
        <p className="text-[10px] text-gray-400">Applies to the play button overlay and progress bar on direct video files. Defaults to AAUS teal (#189aa1).</p>
      </div>
    </div>
  );
}

// ─── Live Session Block Settings ──────────────────────────────────────────────
function LiveSessionBlockSettings({ d, set }: { d: Record<string, any>; set: (key: string, value: any) => void }) {
  const platform = d.platform ?? "zoom";
  const platformOptions = [
    { value: "zoom", label: "Zoom" },
    { value: "teams", label: "Microsoft Teams" },
    { value: "meet", label: "Google Meet" },
    { value: "webex", label: "Webex" },
    { value: "other", label: "Other / Custom" },
  ];

  // Convert stored ISO string or null to datetime-local input value
  const toDatetimeLocal = (val: string | null) => {
    if (!val) return "";
    try {
      const d = new Date(val);
      // format: YYYY-MM-DDTHH:mm
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ""; }
  };

  const fromDatetimeLocal = (val: string) => {
    if (!val) return null;
    return new Date(val).toISOString();
  };

  return (
    <div className="space-y-4">
      {/* Session Title */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Session Title</label>
        <DebouncedInput value={d.title ?? ""} onChange={v => set("title", v)} className="h-8 text-xs" placeholder="e.g. Live Q&A Session" />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Description (optional)</label>
        <DebouncedTextarea value={d.description ?? ""} onChange={v => set("description", v)} className="text-xs min-h-[60px]" placeholder="What will be covered in this session?" />
      </div>

      {/* Platform */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Platform</label>
        <Select value={platform} onValueChange={v => set("platform", v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platformOptions.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Meeting URL */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Meeting URL</label>
        <DebouncedInput
          value={d.meetingUrl ?? ""}
          onChange={v => set("meetingUrl", v)}
          className="h-8 text-xs"
          placeholder="https://zoom.us/j/... or teams.microsoft.com/..."
        />
        <p className="text-[10px] text-gray-400 mt-1">Paste the full join link from Zoom, Teams, Meet, or any meeting platform.</p>
      </div>

      {/* Scheduled Date/Time */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Scheduled Date &amp; Time</label>
        <input
          type="datetime-local"
          value={toDatetimeLocal(d.scheduledAt)}
          onChange={e => set("scheduledAt", fromDatetimeLocal(e.target.value))}
          className="h-8 text-xs w-full border border-gray-200 rounded-md px-2 bg-white"
        />
        <p className="text-[10px] text-gray-400 mt-1">Uses your local timezone. Students see their local time.</p>
      </div>

      {/* Duration */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Duration (minutes)</label>
        <DebouncedInput
          value={String(d.durationMinutes ?? 60)}
          onChange={v => set("durationMinutes", Number(v) || 60)}
          className="h-8 text-xs"
          placeholder="60"
        />
      </div>

      {/* Early access window */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Activate Join Button (minutes before start)</label>
        <DebouncedInput
          value={String(d.earlyMinutes ?? 15)}
          onChange={v => set("earlyMinutes", Number(v) || 15)}
          className="h-8 text-xs"
          placeholder="15"
        />
        <p className="text-[10px] text-gray-400 mt-1">Join button becomes active this many minutes before the scheduled start time.</p>
      </div>

      {/* Recurring */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ls-recurring"
            checked={!!d.isRecurring}
            onChange={e => set("isRecurring", e.target.checked)}
            className="rounded"
          />
          <label htmlFor="ls-recurring" className="text-xs font-medium text-gray-600">Recurring session</label>
        </div>
        {d.isRecurring && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Recurrence Label</label>
            <DebouncedInput
              value={d.recurringLabel ?? ""}
              onChange={v => set("recurringLabel", v)}
              className="h-8 text-xs"
              placeholder="e.g. Every Tuesday at 7pm ET"
            />
          </div>
        )}
      </div>

      {/* Open inline */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ls-inline"
          checked={!!d.openInline}
          onChange={e => set("openInline", e.target.checked)}
          className="rounded"
        />
        <label htmlFor="ls-inline" className="text-xs font-medium text-gray-600">Open meeting inline in course player</label>
      </div>
      <p className="text-[10px] text-gray-400 -mt-2">Note: Zoom and Teams may block inline embedding. "Open in browser" is always available as a fallback.</p>

      {/* Accent color */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Accent Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={d.accentColor ?? "#189aa1"}
            onChange={e => set("accentColor", e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-200"
          />
          <DebouncedInput value={d.accentColor ?? "#189aa1"} onChange={v => set("accentColor", v)} className="h-8 text-xs flex-1" placeholder="#189aa1" />
        </div>
      </div>

      {/* Background color */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={d.bgColor ?? "#f8fafc"}
            onChange={e => set("bgColor", e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-200"
          />
          <DebouncedInput value={d.bgColor ?? "#f8fafc"} onChange={v => set("bgColor", v)} className="h-8 text-xs flex-1" placeholder="#f8fafc" />
        </div>
      </div>
    </div>
  );
}

// ─── Cohort Class Block Settings ─────────────────────────────────────────────
function CohortClassBlockSettings({ d, set }: { d: Record<string, any>; set: (key: string, value: any) => void }) {
  const sessions: Array<{ date: string; time: string; topic: string; meetingUrl?: string }> = d.sessions ?? [];

  const addSession = () => {
    set("sessions", [...sessions, { date: "", time: "", topic: "", meetingUrl: "" }]);
  };
  const updateSession = (i: number, field: string, val: string) => {
    const next = sessions.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    set("sessions", next);
  };
  const removeSession = (i: number) => {
    set("sessions", sessions.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-3">
      {/* Title */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Class Title</label>
        <DebouncedInput value={d.title ?? ""} onChange={v => set("title", v)} className="h-8 text-xs" placeholder="Cohort Class" />
      </div>
      {/* Description */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
        <textarea
          value={d.description ?? ""}
          onChange={e => set("description", e.target.value)}
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          rows={2}
          placeholder="Brief description of the cohort class"
        />
      </div>
      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Start Date</label>
          <input
            type="date"
            value={d.startDate ?? ""}
            onChange={e => set("startDate", e.target.value)}
            className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">End Date</label>
          <input
            type="date"
            value={d.endDate ?? ""}
            onChange={e => set("endDate", e.target.value)}
            className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
      </div>
      {/* Max students & instructor */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Max Students</label>
          <input
            type="number"
            min={1}
            value={d.maxStudents ?? ""}
            onChange={e => set("maxStudents", e.target.value ? Number(e.target.value) : null)}
            className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="Unlimited"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Instructor Name</label>
          <DebouncedInput value={d.instructorName ?? ""} onChange={v => set("instructorName", v)} className="h-8 text-xs" placeholder="e.g. Dr. Smith" />
        </div>
      </div>
      {/* Platform */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Meeting Platform</label>
        <select
          value={d.platform ?? "zoom"}
          onChange={e => set("platform", e.target.value)}
          className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <option value="zoom">Zoom</option>
          <option value="teams">Microsoft Teams</option>
          <option value="meet">Google Meet</option>
          <option value="webex">Webex</option>
          <option value="other">Other</option>
        </select>
      </div>
      {d.platform === "other" && (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Platform Name</label>
          <DebouncedInput value={d.platformCustomName ?? ""} onChange={v => set("platformCustomName", v)} className="h-8 text-xs" placeholder="e.g. Hopin" />
        </div>
      )}
      {/* Sessions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-700">Class Sessions</label>
          <button
            onClick={addSession}
            className="text-xs px-2 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 font-medium border border-teal-200"
          >
            + Add Session
          </button>
        </div>
        {sessions.length === 0 && (
          <p className="text-xs text-gray-400 italic">No sessions yet. Add a session to show the schedule.</p>
        )}
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">Session {i + 1}</span>
                <button onClick={() => removeSession(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
              <DebouncedInput value={s.topic} onChange={v => updateSession(i, "topic", v)} className="h-7 text-xs" placeholder="Topic / title" />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={s.date}
                  onChange={e => updateSession(i, "date", e.target.value)}
                  className="h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <input
                  type="time"
                  value={s.time}
                  onChange={e => updateSession(i, "time", e.target.value)}
                  className="h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <DebouncedInput value={s.meetingUrl ?? ""} onChange={v => updateSession(i, "meetingUrl", v)} className="h-7 text-xs" placeholder="Meeting URL (optional)" />
            </div>
          ))}
        </div>
      </div>
      {/* CTA */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Button Text</label>
        <DebouncedInput value={d.ctaText ?? ""} onChange={v => set("ctaText", v)} className="h-8 text-xs" placeholder="Join Class" />
      </div>
      {/* Accent color */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Accent Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={d.accentColor ?? "#189aa1"} onChange={e => set("accentColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
          <DebouncedInput value={d.accentColor ?? "#189aa1"} onChange={v => set("accentColor", v)} className="h-8 text-xs flex-1" placeholder="#189aa1" />
        </div>
      </div>
      {/* Background color */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Background Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={d.bgColor ?? "#f8fafc"} onChange={e => set("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
          <DebouncedInput value={d.bgColor ?? "#f8fafc"} onChange={v => set("bgColor", v)} className="h-8 text-xs flex-1" placeholder="#f8fafc" />
        </div>
      </div>
    </div>
  );
}

// ─── Lesson Assignment Block Settings ─────────────────────────────────────────
function LessonAssignmentBlockSettings({ d, set }: { d: Record<string, any>; set: (key: string, value: any) => void }) {
  const rubricItems: Array<{ criterion: string; points: number; description?: string }> = d.rubricItems ?? [];
  const submissionTypes: string[] = d.submissionTypes ?? ["text"];

  const addRubricItem = () => {
    set("rubricItems", [...rubricItems, { criterion: "", points: 10, description: "" }]);
  };
  const updateRubric = (i: number, field: string, val: any) => {
    set("rubricItems", rubricItems.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };
  const removeRubric = (i: number) => {
    set("rubricItems", rubricItems.filter((_, idx) => idx !== i));
  };
  const toggleSubmissionType = (type: string) => {
    if (submissionTypes.includes(type)) {
      set("submissionTypes", submissionTypes.filter(t => t !== type));
    } else {
      set("submissionTypes", [...submissionTypes, type]);
    }
  };

  const totalPoints = rubricItems.reduce((sum, r) => sum + (Number(r.points) || 0), 0);

  return (
    <div className="space-y-3">
      {/* Title */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Assignment Title</label>
        <DebouncedInput value={d.title ?? ""} onChange={v => set("title", v)} className="h-8 text-xs" placeholder="Assignment" />
      </div>
      {/* Description */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Short Description</label>
        <DebouncedInput value={d.description ?? ""} onChange={v => set("description", v)} className="h-8 text-xs" placeholder="Brief summary shown in header" />
      </div>
      {/* Instructions */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Instructions (HTML)</label>
        <textarea
          value={d.instructions ?? ""}
          onChange={e => set("instructions", e.target.value)}
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none font-mono"
          rows={4}
          placeholder="<p>Complete the following...</p>"
        />
      </div>
      {/* Due date */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Due Date</label>
        <input
          type="date"
          value={d.dueDate ?? ""}
          onChange={e => set("dueDate", e.target.value)}
          className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      {/* Submission types */}
      <div>
        <label className="text-xs font-bold text-gray-700 block mb-2">Submission Types</label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "text", label: "Written" },
            { value: "file", label: "File Upload" },
            { value: "url", label: "URL / Link" },
            { value: "video", label: "Video" },
            { value: "image", label: "Image" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => toggleSubmissionType(opt.value)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                submissionTypes.includes(opt.value)
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {/* Rubric */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-700">
            Grading Rubric {totalPoints > 0 && <span className="text-teal-600 font-semibold">({totalPoints} pts total)</span>}
          </label>
          <button
            onClick={addRubricItem}
            className="text-xs px-2 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 font-medium border border-teal-200"
          >
            + Add Criterion
          </button>
        </div>
        {rubricItems.length === 0 && (
          <p className="text-xs text-gray-400 italic">No rubric items. Add criteria to show a grading rubric.</p>
        )}
        <div className="space-y-2">
          {rubricItems.map((r, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
              <div className="flex items-center gap-2">
                <DebouncedInput value={r.criterion} onChange={v => updateRubric(i, "criterion", v)} className="h-7 text-xs flex-1" placeholder="Criterion name" />
                <input
                  type="number"
                  min={0}
                  value={r.points}
                  onChange={e => updateRubric(i, "points", Number(e.target.value))}
                  className="w-16 h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="pts"
                />
                <button onClick={() => removeRubric(i)} className="text-xs text-red-400 hover:text-red-600 shrink-0">✕</button>
              </div>
              <DebouncedInput value={r.description ?? ""} onChange={v => updateRubric(i, "description", v)} className="h-7 text-xs" placeholder="Description (optional)" />
            </div>
          ))}
        </div>
      </div>
      {/* Submit button text */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Submit Button Text</label>
        <DebouncedInput value={d.submitButtonText ?? ""} onChange={v => set("submitButtonText", v)} className="h-8 text-xs" placeholder="Submit Assignment" />
      </div>
      {/* Late submissions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="la-late"
            checked={!!d.allowLateSubmissions}
            onChange={e => set("allowLateSubmissions", e.target.checked)}
            className="rounded"
          />
          <label htmlFor="la-late" className="text-xs font-medium text-gray-600">Allow late submissions</label>
        </div>
        {d.allowLateSubmissions && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Late Penalty (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={d.latePenaltyPct ?? 0}
              onChange={e => set("latePenaltyPct", Number(e.target.value))}
              className="w-24 h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
        )}
      </div>
      {/* Accent color */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Accent Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={d.accentColor ?? "#189aa1"} onChange={e => set("accentColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
          <DebouncedInput value={d.accentColor ?? "#189aa1"} onChange={v => set("accentColor", v)} className="h-8 text-xs flex-1" placeholder="#189aa1" />
        </div>
      </div>
      {/* Background color */}
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

// ─── Upgrade Prompt Block Settings ────────────────────────────────────────────
function UpgradePromptBlockSettings({ d, set }: { d: Record<string, any>; set: (key: string, value: any) => void }) {
  const { data: coursesData } = trpc.lms.listCourses.useQuery({ pageSize: 100 });
  const { data: downloadsData } = trpc.downloads.list.useQuery({});
  const { data: productsData } = trpc.products.list.useQuery({});

  const productType: string = d.productType ?? "course";
  const discountType: string = d.discountType ?? "none";

  const courseOptions = (coursesData?.courses ?? []).map((c: any) => ({ value: c.slug, label: c.title }));
  const downloadOptions = (downloadsData?.products ?? []).map((p: any) => ({ value: p.slug, label: p.title }));
  const productOptions = (productsData?.products ?? []).map((p: any) => ({ value: p.slug, label: p.title }));

  return (
    <div className="space-y-3">
      {/* Display Mode */}
      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-1">Display Mode</label>
        <select value={d.displayMode ?? "inline"} onChange={e => set("displayMode", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2">
          <option value="inline">Inline (always visible)</option>
          <option value="modal_time">Modal — time delay</option>
          <option value="modal_scroll">Modal — scroll %</option>
          <option value="modal_exit">Modal — exit intent</option>
          <option value="banner_slide">Slide-in banner</option>
        </select>
      </div>

      {/* Trigger settings */}
      {d.displayMode === "modal_time" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Delay (seconds)</label>
          <input type="number" min={1} max={120} value={d.triggerDelaySeconds ?? 5} onChange={e => set("triggerDelaySeconds", Number(e.target.value))} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
        </div>
      )}
      {d.displayMode === "modal_scroll" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Trigger at scroll % (0–100)</label>
          <input type="number" min={10} max={100} value={d.triggerScrollPercent ?? 50} onChange={e => set("triggerScrollPercent", Number(e.target.value))} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
        </div>
      )}

      {/* Product targeting */}
      <div className="border-t border-gray-100 pt-3">
        <label className="text-xs font-semibold text-gray-700 block mb-1">Target Product</label>
        <select value={productType} onChange={e => { set("productType", e.target.value); set("productSlug", ""); }} className="w-full h-8 text-xs border border-gray-200 rounded px-2 mb-2">
          <option value="course">Course</option>
          <option value="download">Download / Digital Product</option>
          <option value="product">Physical Product</option>
        </select>
        {productType === "course" && (
          <select value={d.productSlug ?? ""} onChange={e => set("productSlug", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2">
            <option value="">— Select course —</option>
            {courseOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {productType === "download" && (
          <select value={d.productSlug ?? ""} onChange={e => set("productSlug", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2">
            <option value="">— Select download —</option>
            {downloadOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {productType === "product" && (
          <select value={d.productSlug ?? ""} onChange={e => set("productSlug", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2">
            <option value="">— Select product —</option>
            {productOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>

      {/* Discount */}
      <div className="border-t border-gray-100 pt-3">
        <label className="text-xs font-semibold text-gray-700 block mb-1">Discount</label>
        <select value={discountType} onChange={e => set("discountType", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2 mb-2">
          <option value="none">No discount</option>
          <option value="percent">Percentage off</option>
          <option value="fixed">Fixed amount off</option>
          <option value="promo_code">Promo code</option>
        </select>
        {(discountType === "percent" || discountType === "fixed") && (
          <div className="flex gap-2 items-center">
            <input type="number" min={0} max={discountType === "percent" ? 100 : 9999} value={d.discountValue ?? 0} onChange={e => set("discountValue", Number(e.target.value))} className="flex-1 h-8 text-xs border border-gray-200 rounded px-2" />
            <span className="text-xs text-gray-500">{discountType === "percent" ? "%" : "$ off"}</span>
          </div>
        )}
        {discountType === "promo_code" && (
          <input type="text" placeholder="PROMO20" value={d.promoCode ?? ""} onChange={e => set("promoCode", e.target.value.toUpperCase())} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
        )}
        {discountType !== "none" && (
          <div className="mt-2">
            <label className="text-xs text-gray-500 block mb-1">Original price (cents, e.g. 29900 = $299)</label>
            <input type="number" min={0} value={d.originalPriceCents ?? 0} onChange={e => set("originalPriceCents", Number(e.target.value))} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <label className="text-xs font-semibold text-gray-700 block">Content</label>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Badge text (optional)</label>
          <input type="text" placeholder="Special Offer" value={d.badgeText ?? ""} onChange={e => set("badgeText", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Urgency label (optional)</label>
          <input type="text" placeholder="Limited time offer — ends soon" value={d.urgencyLabel ?? ""} onChange={e => set("urgencyLabel", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Headline</label>
          <input type="text" value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Subheadline</label>
          <textarea rows={2} value={d.subheadline ?? ""} onChange={e => set("subheadline", e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Image URL (optional)</label>
          <input type="text" placeholder="https://…" value={d.imageUrl ?? ""} onChange={e => set("imageUrl", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">CTA button text</label>
          <input type="text" value={d.ctaText ?? "Upgrade Now"} onChange={e => set("ctaText", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={d.showDismiss !== false} onChange={e => set("showDismiss", e.target.checked)} className="rounded" id="upShowDismiss" />
          <label htmlFor="upShowDismiss" className="text-xs text-gray-600 cursor-pointer">Show dismiss link</label>
        </div>
        {d.showDismiss !== false && (
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dismiss text</label>
            <input type="text" value={d.dismissText ?? "No thanks"} onChange={e => set("dismissText", e.target.value)} className="w-full h-8 text-xs border border-gray-200 rounded px-2" />
          </div>
        )}
      </div>

      {/* Colors */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <label className="text-xs font-semibold text-gray-700 block">Colors</label>
        <BSColorField data={d} onSet={set} label="Accent color" field="accentColor" />
        <BSColorField data={d} onSet={set} label="Background" field="bgColor" />
      </div>
    </div>
  );
}

