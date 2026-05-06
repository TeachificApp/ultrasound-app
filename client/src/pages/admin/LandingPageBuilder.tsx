/**
 * LandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG landing page editor.
 * Route: /admin/lms/:courseId/landing-builder
 * Supports 25+ block types + Template Library (save/reuse pages and blocks).
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
  ChevronDown, ChevronUp, Copy, FolderOpen, BookMarked,
} from "lucide-react";

// ─── Block Types ──────────────────────────────────────────────────────────────

export type BlockType =
  | "hero" | "text" | "image" | "video" | "bullets" | "testimonial"
  | "pricing_cta" | "divider" | "two_column" | "spacer"
  | "faq" | "image_text" | "gallery" | "icon_grid" | "countdown"
  | "instructor" | "logos" | "reviews" | "embed" | "cta_standalone"
  | "lead_capture" | "numbered_list" | "alert" | "flip_cards"
  | "curriculum_auto" | "pricing_options_auto";

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, any>;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── Block Catalog ────────────────────────────────────────────────────────────

const BLOCK_CATALOG: { type: BlockType; label: string; icon: React.ReactNode; category: string; defaultData: Record<string, any> }[] = [
  // ── Layout & Structure
  {
    type: "hero", label: "Hero / Banner", icon: <Image size={14} />, category: "Layout",
    defaultData: {
      headline: "Your Course Headline", subheadline: "A compelling subtitle that explains the value",
      bgType: "color", bgColor: "#179ca3", gradientFrom: "#179ca3", gradientTo: "#0e4a50",
      gradientDir: "to bottom right", imageUrl: "", videoUrl: "", textColor: "#ffffff", align: "left",
      buttons: [{ text: "Enroll Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }],
    },
  },
  { type: "two_column", label: "Two Columns", icon: <Columns size={14} />, category: "Layout",
    defaultData: { leftHtml: "<p>Left column content</p>", rightHtml: "<p>Right column content</p>", leftRatio: 50, bgColor: "#ffffff" } },
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
    defaultData: { quote: "This course changed my practice completely.", author: "Jane Smith, RDMS", avatarUrl: "", bgColor: "#f0fafa", accentColor: "#179ca3" } },
  { type: "reviews", label: "Reviews / Stars", icon: <Star size={14} />, category: "Marketing",
    defaultData: { headline: "What Students Say", reviews: [{ name: "Jane D.", rating: 5, text: "Excellent course!" }, { name: "Mark S.", rating: 5, text: "Very practical content." }], bgColor: "#ffffff" } },
  { type: "logos", label: "Logos / Social Proof", icon: <Tag size={14} />, category: "Marketing",
    defaultData: { headline: "Trusted By", logos: [{ url: "", alt: "Organization 1" }, { url: "", alt: "Organization 2" }], bgColor: "#f9fafb" } },
  { type: "instructor", label: "Instructor Profile", icon: <Users size={14} />, category: "Marketing",
    defaultData: { name: "Instructor Name", title: "Credentials & Title", bio: "Brief instructor biography...", avatarUrl: "", bgColor: "#ffffff" } },
  { type: "faq", label: "FAQ / Accordion", icon: <HelpCircle size={14} />, category: "Marketing",
    defaultData: { headline: "Frequently Asked Questions", items: [{ q: "Who is this course for?", a: "This course is designed for..." }, { q: "How long do I have access?", a: "You get lifetime access." }], bgColor: "#ffffff", accentColor: "#179ca3" } },
  { type: "countdown", label: "Countdown Timer", icon: <Timer size={14} />, category: "Marketing",
    defaultData: { headline: "Enrollment Closes In", targetDate: "", bgColor: "#179ca3", textColor: "#ffffff" } },
  { type: "alert", label: "Alert / Callout", icon: <AlertTriangle size={14} />, category: "Marketing",
    defaultData: { text: "Limited time offer — enroll today!", alertType: "info", icon: "💡" } },
  { type: "flip_cards", label: "Flip Cards", icon: <Layers size={14} />, category: "Marketing",
    defaultData: { headline: "Course Modules", cards: [{ front: "Module 1", back: "Description of module 1 content" }, { front: "Module 2", back: "Description of module 2 content" }], accentColor: "#179ca3", bgColor: "#f8fffe" } },
  // ── Conversion
  { type: "pricing_cta", label: "Pricing / Enroll CTA", icon: <CreditCard size={14} />, category: "Conversion",
    defaultData: { headline: "Ready to Get Started?", subtext: "Join thousands of sonographers improving their skills.", ctaText: "Enroll Now", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true } },
  { type: "cta_standalone", label: "Call to Action", icon: <CheckSquare size={14} />, category: "Conversion",
    defaultData: { headline: "Start Learning Today", subtext: "", ctaText: "Get Started", ctaLink: "", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#f0fafa", align: "center" } },
  { type: "lead_capture", label: "Lead Capture Form", icon: <BookMarked size={14} />, category: "Conversion",
    defaultData: { headline: "Get a Free Preview", subtext: "Enter your email to get instant access.", ctaText: "Send Me Access", bgColor: "#179ca3", textColor: "#ffffff" } },
  // ── Smart Sections
  { type: "curriculum_auto", label: "Curriculum (Auto)", icon: <BookOpen size={14} />, category: "Smart",
    defaultData: { headline: "Course Curriculum", bgColor: "#ffffff", showLocked: true } },
  { type: "pricing_options_auto", label: "Pricing Options (Auto)", icon: <CreditCard size={14} />, category: "Smart",
    defaultData: { headline: "Choose Your Plan", bgColor: "#f9fafb" } },
];

const CATALOG_CATEGORIES = ["Layout", "Content", "Marketing", "Conversion", "Smart"];

// ─── Block Preview ─────────────────────────────────────────────────────────────

function BlockPreview({ block, coursePrice, courseTitle }: { block: Block; coursePrice?: number; courseTitle?: string }) {
  const d = block.data;

  switch (block.type) {
    case "hero": {
      const bgType = d.bgType ?? "color";
      let heroBg: React.CSSProperties = {};
      if (bgType === "color") heroBg = { backgroundColor: d.bgColor ?? "#179ca3" };
      else if (bgType === "gradient") heroBg = { background: `linear-gradient(${d.gradientDir ?? "to bottom right"}, ${d.gradientFrom ?? "#179ca3"}, ${d.gradientTo ?? "#0e4a50"})` };
      else if (bgType === "image") heroBg = { backgroundImage: `url(${d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
      else if (bgType === "video") heroBg = { backgroundColor: "#000" };
      const heroButtons: Array<{ text: string; color: string; textColor: string; link: string; style: string }> =
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Enroll Now", color: d.ctaColor ?? "#fff", textColor: d.ctaTextColor ?? "#179ca3", link: "", style: "filled" }];
      return (
        <div className="relative px-8 py-16 overflow-hidden" style={{ ...heroBg, color: d.textColor ?? "#fff", textAlign: d.align ?? "left" }}>
          {bgType === "video" && d.videoUrl && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.videoUrl} /></video>
          )}
          <div className="relative max-w-3xl">
            <h1 className="text-4xl font-bold mb-4 leading-tight">{d.headline}</h1>
            {d.subheadline && <p className="text-xl opacity-90 mb-8">{d.subheadline}</p>}
            <div className="flex flex-wrap gap-3" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
              {heroButtons.map((btn, i) => (
                <button key={i} className="px-8 py-3 rounded-lg font-semibold text-lg shadow-lg"
                  style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                  {btn.text}
                </button>
              ))}
            </div>
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
          {d.embedUrl ? (
            <div className="relative w-full rounded-lg overflow-hidden shadow" style={{ paddingBottom: "56.25%" }}>
              <iframe src={d.embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen title="Video" />
            </div>
          ) : <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><Video size={32} /></div>}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
    case "embed":
      return (
        <div className="px-8 py-6">
          {d.embedCode ? (
            <div dangerouslySetInnerHTML={{ __html: d.embedCode }} style={{ height: d.height ?? 400 }} />
          ) : <div className="w-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-400" style={{ height: d.height ?? 400 }}><Globe size={32} /></div>}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
    case "gallery":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
            {(d.images ?? []).map((img: any, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden shadow">
                {img.url ? <img src={img.url} alt={img.caption ?? ""} className="w-full h-40 object-cover" /> : <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400"><Image size={24} /></div>}
                {img.caption && <p className="text-xs text-gray-500 p-2 text-center">{img.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    case "bullets":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900">{d.headline}</h2>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
            {(d.items ?? []).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 text-lg" style={{ color: d.iconColor ?? "#179ca3" }}>✓</span>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "numbered_list":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900">{d.headline}</h2>}
          <div className="space-y-4 max-w-2xl">
            {(d.items ?? []).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{i + 1}</span>
                <span className="text-gray-700 pt-1">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "icon_grid":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
            {(d.items ?? []).map((item: any, i: number) => (
              <div key={i} className="text-center p-4">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "testimonial":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f0fafa" }}>
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-4xl mb-4" style={{ color: d.accentColor ?? "#179ca3" }}>"</div>
            <p className="text-xl text-gray-700 italic mb-6">{d.quote}</p>
            <div className="flex items-center justify-center gap-3">
              {d.avatarUrl && <img src={d.avatarUrl} alt={d.author} className="w-10 h-10 rounded-full object-cover" />}
              <span className="font-semibold text-gray-900">{d.author}</span>
            </div>
          </div>
        </div>
      );
    case "reviews":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {(d.reviews ?? []).map((r: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: r.rating ?? 5 }).map((_, j) => <span key={j} className="text-yellow-400">★</span>)}
                </div>
                <p className="text-gray-700 mb-3 italic">"{r.text}"</p>
                <p className="text-sm font-semibold text-gray-900">— {r.name}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "logos":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">{d.headline}</p>}
          <div className="flex flex-wrap items-center justify-center gap-8">
            {(d.logos ?? []).map((logo: any, i: number) => (
              logo.url ? <img key={i} src={logo.url} alt={logo.alt ?? ""} className="h-10 object-contain opacity-70 hover:opacity-100 transition-opacity" />
                : <div key={i} className="h-10 w-24 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">{logo.alt || "Logo"}</div>
            ))}
          </div>
        </div>
      );
    case "instructor":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-3xl mx-auto flex gap-6 items-start">
            {d.avatarUrl ? <img src={d.avatarUrl} alt={d.name} className="w-24 h-24 rounded-full object-cover flex-shrink-0" />
              : <div className="w-24 h-24 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0"><Users size={32} className="text-teal-600" /></div>}
            <div>
              <h3 className="text-xl font-bold text-gray-900">{d.name}</h3>
              <p className="text-teal-600 font-medium mb-3">{d.title}</p>
              <p className="text-gray-600">{d.bio}</p>
            </div>
          </div>
        </div>
      );
    case "faq":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-gray-900">{d.headline}</h2>}
          <div className="max-w-3xl space-y-3">
            {(d.items ?? []).map((item: any, i: number) => (
              <details key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                <summary className="px-5 py-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                  {item.q}
                </summary>
                <div className="px-5 py-4 text-gray-600 border-t border-gray-100">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      );
    case "countdown":
      return (
        <div className="px-8 py-10 text-center" style={{ backgroundColor: d.bgColor ?? "#179ca3", color: d.textColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6">{d.headline}</h2>}
          <div className="flex justify-center gap-4">
            {["Days", "Hours", "Mins", "Secs"].map(unit => (
              <div key={unit} className="bg-white/20 rounded-xl px-6 py-4 min-w-[80px]">
                <div className="text-4xl font-bold">00</div>
                <div className="text-sm opacity-80 mt-1">{unit}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case "alert": {
      const alertStyles: Record<string, string> = { info: "bg-blue-50 border-blue-300 text-blue-800", success: "bg-green-50 border-green-300 text-green-800", warning: "bg-yellow-50 border-yellow-300 text-yellow-800", error: "bg-red-50 border-red-300 text-red-800" };
      return (
        <div className={`mx-8 my-4 px-5 py-4 rounded-lg border-l-4 flex items-start gap-3 ${alertStyles[d.alertType ?? "info"] ?? alertStyles.info}`}>
          <span className="text-xl flex-shrink-0">{d.icon ?? "💡"}</span>
          <p className="font-medium">{d.text}</p>
        </div>
      );
    }
    case "flip_cards":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {(d.cards ?? []).map((card: any, i: number) => (
              <div key={i} className="rounded-xl overflow-hidden shadow-sm border border-gray-200 group cursor-pointer">
                <div className="p-5 font-semibold text-white text-center" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{card.front}</div>
                <div className="p-5 text-sm text-gray-600 text-center bg-white">{card.back}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case "pricing_cta":
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-3xl font-bold text-gray-900 mb-3">{d.headline}</h2>}
          {d.subtext && <p className="text-gray-600 mb-6 max-w-xl mx-auto">{d.subtext}</p>}
          {d.showPrice && coursePrice !== undefined && <p className="text-4xl font-bold mb-6" style={{ color: d.ctaColor ?? "#179ca3" }}>{coursePrice === 0 ? "Free" : `$${(coursePrice / 100).toFixed(2)}`}</p>}
          <button className="px-10 py-4 rounded-xl font-bold text-lg shadow-lg" style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>{d.ctaText ?? "Enroll Now"}</button>
        </div>
      );
    case "cta_standalone":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa", textAlign: d.align ?? "center" }}>
          {d.headline && <h2 className="text-2xl font-bold text-gray-900 mb-3">{d.headline}</h2>}
          {d.subtext && <p className="text-gray-600 mb-6">{d.subtext}</p>}
          <a href={d.ctaLink ?? "#"} className="inline-block px-8 py-3 rounded-lg font-semibold shadow" style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>{d.ctaText ?? "Get Started"}</a>
        </div>
      );
    case "lead_capture":
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#179ca3", color: d.textColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-3">{d.headline}</h2>}
          {d.subtext && <p className="opacity-90 mb-6">{d.subtext}</p>}
          <div className="flex max-w-md mx-auto gap-2">
            <input type="email" placeholder="Your email address" className="flex-1 px-4 py-3 rounded-lg text-gray-900 border-0 focus:ring-2 focus:ring-white/50" />
            <button className="px-6 py-3 bg-white font-semibold rounded-lg" style={{ color: d.bgColor ?? "#179ca3" }}>{d.ctaText ?? "Send Me Access"}</button>
          </div>
        </div>
      );
    case "curriculum_auto":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900">{d.headline}</h2>}
          <div className="border border-gray-200 rounded-xl overflow-hidden max-w-3xl">
            {["Section 1", "Section 2", "Section 3"].map((s, i) => (
              <div key={i} className="border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between px-5 py-4 bg-gray-50 font-semibold text-gray-800">
                  <span>{s}</span><ChevronDown size={16} className="text-gray-400" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Auto-populated from course curriculum</p>
        </div>
      );
    case "pricing_options_auto":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
          <div className="flex justify-center gap-6 max-w-3xl mx-auto">
            {["Basic", "Pro", "Enterprise"].map((plan, i) => (
              <div key={i} className={`flex-1 rounded-xl border-2 p-6 text-center ${i === 1 ? "border-teal-500 shadow-lg" : "border-gray-200"}`}>
                <h3 className="font-bold text-gray-900 mb-2">{plan}</h3>
                <p className="text-2xl font-bold text-teal-600 mb-4">$0</p>
                <button className="w-full py-2 rounded-lg font-semibold text-sm" style={{ backgroundColor: i === 1 ? "#179ca3" : "#f3f4f6", color: i === 1 ? "#fff" : "#374151" }}>Select</button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Auto-populated from course pricing options</p>
        </div>
      );
    case "divider":
      return (
        <div style={{ padding: `${d.spacing ?? 32}px 32px` }}>
          <hr style={{ borderTop: `${d.thickness ?? 1}px ${d.style ?? "solid"} ${d.color ?? "#e5e7eb"}` }} />
        </div>
      );
    case "two_column":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="flex gap-8">
            <div className="prose" style={{ flex: d.leftRatio ?? 50 }} dangerouslySetInnerHTML={{ __html: d.leftHtml ?? "" }} />
            <div className="prose" style={{ flex: 100 - (d.leftRatio ?? 50) }} dangerouslySetInnerHTML={{ __html: d.rightHtml ?? "" }} />
          </div>
        </div>
      );
    case "spacer":
      return <div style={{ height: d.height ?? 48 }} className="bg-transparent" />;
    default:
      return <div className="px-8 py-4 text-gray-400 text-sm text-center">Block preview not available</div>;
  }
}

// ─── Block Settings ────────────────────────────────────────────────────────────

function BlockSettings({ block, onChange }: { block: Block; onChange: (data: Record<string, any>) => void }) {
  const d = block.data;
  const set = (key: string, value: any) => onChange({ ...d, [key]: value });

  const TextField = ({ label, field, multiline = false, placeholder = "" }: { label: string; field: string; multiline?: boolean; placeholder?: string }) => (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      {multiline
        ? <Textarea value={d[field] ?? ""} onChange={e => set(field, e.target.value)} className="text-sm min-h-[80px]" placeholder={placeholder} />
        : <Input value={d[field] ?? ""} onChange={e => set(field, e.target.value)} className="h-8 text-sm" placeholder={placeholder} />}
    </div>
  );

  const ColorField = ({ label, field }: { label: string; field: string }) => (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</label>
      <input type="color" value={d[field] ?? "#179ca3"} onChange={e => set(field, e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-200 flex-shrink-0" />
      <Input value={d[field] ?? ""} onChange={e => set(field, e.target.value)} className="h-7 text-xs flex-1" />
    </div>
  );

  const AlignField = () => (
    <div>
      <label className="text-xs text-gray-500 block mb-1">Alignment</label>
      <div className="flex gap-1">
        {(["left", "center", "right"] as const).map(a => (
          <button key={a} onClick={() => set("align", a)} className={`flex-1 py-1 text-xs rounded border ${d.align === a ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>
            {a === "left" ? <AlignLeft size={12} className="mx-auto" /> : a === "center" ? <AlignCenter size={12} className="mx-auto" /> : <AlignRight size={12} className="mx-auto" />}
          </button>
        ))}
      </div>
    </div>
  );

  switch (block.type) {
    case "hero": {
      const bgType = d.bgType ?? "color";
      const buttons: Array<{ text: string; color: string; textColor: string; link: string; style: string }> =
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Enroll Now", color: d.ctaColor ?? "#fff", textColor: d.ctaTextColor ?? "#179ca3", link: "", style: "filled" }];
      const setBtn = (idx: number, key: string, val: string) => { const next = buttons.map((b, i) => i === idx ? { ...b, [key]: val } : b); onChange({ ...d, buttons: next }); };
      const addBtn = () => onChange({ ...d, buttons: [...buttons, { text: "Learn More", color: "transparent", textColor: "#fff", link: "", style: "outline" }] });
      const removeBtn = (idx: number) => onChange({ ...d, buttons: buttons.filter((_, i) => i !== idx) });
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" />
          <TextField label="Subheadline" field="subheadline" multiline />
          <ColorField label="Text Color" field="textColor" />
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
          {bgType === "color" && <ColorField label="Background" field="bgColor" />}
          {bgType === "gradient" && (<><ColorField label="From" field="gradientFrom" /><ColorField label="To" field="gradientTo" /><div><label className="text-xs text-gray-500 block mb-1">Direction</label><select value={d.gradientDir ?? "to bottom right"} onChange={e => set("gradientDir", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="to right">Left → Right</option><option value="to bottom">Top → Bottom</option><option value="to bottom right">Diagonal ↘</option><option value="to bottom left">Diagonal ↙</option><option value="135deg">135°</option></select></div></>)}
          {bgType === "image" && <TextField label="Background Image URL" field="imageUrl" />}
          {bgType === "video" && <TextField label="Video URL (.mp4)" field="videoUrl" />}
          <AlignField />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">CTA Buttons</label>
              <button onClick={addBtn} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            <div className="space-y-3">
              {buttons.map((btn, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-2 space-y-2">
                  <div className="flex items-center justify-between"><span className="text-xs font-medium text-gray-600">Button {idx + 1}</span>{buttons.length > 1 && <button onClick={() => removeBtn(idx)} className="text-red-400 hover:text-red-600"><X size={12} /></button>}</div>
                  <div><label className="text-xs text-gray-400 block mb-0.5">Label</label><Input value={btn.text} onChange={e => setBtn(idx, "text", e.target.value)} className="h-7 text-xs" /></div>
                  <div><label className="text-xs text-gray-400 block mb-0.5">Link URL</label><Input value={btn.link} onChange={e => setBtn(idx, "link", e.target.value)} className="h-7 text-xs" placeholder="/learn/slug or https://..." /></div>
                  <div><label className="text-xs text-gray-400 block mb-0.5">Style</label><div className="flex gap-1">{(["filled", "outline"] as const).map(s => <button key={s} onClick={() => setBtn(idx, "style", s)} className={`flex-1 py-1 text-xs rounded border capitalize ${btn.style === s ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600"}`}>{s}</button>)}</div></div>
                  <div className="flex items-center gap-2"><label className="text-xs text-gray-400 w-16 flex-shrink-0">Color</label><input type="color" value={btn.color} onChange={e => setBtn(idx, "color", e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-200" /><Input value={btn.color} onChange={e => setBtn(idx, "color", e.target.value)} className="h-7 text-xs flex-1" /></div>
                  {btn.style !== "outline" && <div className="flex items-center gap-2"><label className="text-xs text-gray-400 w-16 flex-shrink-0">Text</label><input type="color" value={btn.textColor} onChange={e => setBtn(idx, "textColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-200" /><Input value={btn.textColor} onChange={e => setBtn(idx, "textColor", e.target.value)} className="h-7 text-xs flex-1" /></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case "text":
      return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Content</label><RichTextEditor value={d.html ?? ""} onChange={(html) => set("html", html)} minHeight={150} maxHeight={400} placeholder="Start typing your content..." /></div><AlignField /><ColorField label="Background" field="bgColor" /><ColorField label="Text Color" field="textColor" /></div>);
    case "image":
      return (<div className="space-y-3"><TextField label="Image URL" field="url" /><TextField label="Alt Text" field="alt" /><TextField label="Caption" field="caption" /><div><label className="text-xs text-gray-500 block mb-1">Max Width</label><Input value={d.maxWidth ?? "100%"} onChange={e => set("maxWidth", e.target.value)} className="h-8 text-sm" placeholder="100%, 600px, etc." /></div></div>);
    case "video":
      return (<div className="space-y-3"><TextField label="Embed URL (YouTube, Vimeo, Wistia)" field="embedUrl" /><TextField label="Caption" field="caption" /></div>);
    case "embed":
      return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Embed Code (iframe or HTML)</label><Textarea value={d.embedCode ?? ""} onChange={e => set("embedCode", e.target.value)} className="text-sm min-h-[100px] font-mono text-xs" placeholder='<iframe src="..." />' /></div><div><label className="text-xs text-gray-500 block mb-1">Height (px)</label><Input type="number" value={d.height ?? 400} onChange={e => set("height", Number(e.target.value))} className="h-8 text-sm" /></div><TextField label="Caption" field="caption" /></div>);
    case "gallery": {
      const images: Array<{ url: string; caption: string }> = d.images ?? [];
      return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Columns</label><Input type="number" value={d.columns ?? 3} onChange={e => set("columns", Number(e.target.value))} className="h-8 text-sm" min={1} max={6} /></div><ColorField label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Images</label><button onClick={() => set("images", [...images, { url: "", caption: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{images.map((img, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Image {i + 1}</span><button onClick={() => set("images", images.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><Input value={img.url} onChange={e => { const next = images.map((im, j) => j === i ? { ...im, url: e.target.value } : im); set("images", next); }} className="h-7 text-xs" placeholder="Image URL" /><Input value={img.caption} onChange={e => { const next = images.map((im, j) => j === i ? { ...im, caption: e.target.value } : im); set("images", next); }} className="h-7 text-xs" placeholder="Caption (optional)" /></div>))}</div></div></div>);
    }
    case "bullets": {
      const items: string[] = d.items ?? [];
      return (<div className="space-y-3"><TextField label="Section Headline" field="headline" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Items</label><button onClick={() => set("items", [...items, "New item"])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-1">{items.map((item, i) => (<div key={i} className="flex gap-1"><Input value={item} onChange={e => { const next = items.map((it, j) => j === i ? e.target.value : it); set("items", next); }} className="h-7 text-xs flex-1" /><button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button></div>))}</div></div><ColorField label="Icon Color" field="iconColor" /><ColorField label="Background" field="bgColor" /></div>);
    }
    case "numbered_list": {
      const items: string[] = d.items ?? [];
      return (<div className="space-y-3"><TextField label="Section Headline" field="headline" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Items</label><button onClick={() => set("items", [...items, "New step"])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-1">{items.map((item, i) => (<div key={i} className="flex gap-1 items-center"><span className="text-xs text-gray-400 w-5 flex-shrink-0">{i + 1}.</span><Input value={item} onChange={e => { const next = items.map((it, j) => j === i ? e.target.value : it); set("items", next); }} className="h-7 text-xs flex-1" /><button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button></div>))}</div></div><ColorField label="Accent Color" field="accentColor" /><ColorField label="Background" field="bgColor" /></div>);
    }
    case "icon_grid": {
      const items: Array<{ icon: string; title: string; text: string }> = d.items ?? [];
      return (<div className="space-y-3"><TextField label="Section Headline" field="headline" /><div><label className="text-xs text-gray-500 block mb-1">Columns</label><Input type="number" value={d.columns ?? 3} onChange={e => set("columns", Number(e.target.value))} className="h-8 text-sm" min={1} max={6} /></div><ColorField label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Items</label><button onClick={() => set("items", [...items, { icon: "⭐", title: "Feature", text: "Description" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{items.map((item, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Item {i + 1}</span><button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><Input value={item.icon} onChange={e => { const next = items.map((it, j) => j === i ? { ...it, icon: e.target.value } : it); set("items", next); }} className="h-7 text-xs" placeholder="Emoji or icon" /><Input value={item.title} onChange={e => { const next = items.map((it, j) => j === i ? { ...it, title: e.target.value } : it); set("items", next); }} className="h-7 text-xs" placeholder="Title" /><Input value={item.text} onChange={e => { const next = items.map((it, j) => j === i ? { ...it, text: e.target.value } : it); set("items", next); }} className="h-7 text-xs" placeholder="Description" /></div>))}</div></div></div>);
    }
    case "testimonial":
      return (<div className="space-y-3"><TextField label="Quote" field="quote" multiline /><TextField label="Author" field="author" /><TextField label="Avatar URL" field="avatarUrl" /><ColorField label="Background" field="bgColor" /><ColorField label="Accent Color" field="accentColor" /></div>);
    case "reviews": {
      const reviews: Array<{ name: string; rating: number; text: string }> = d.reviews ?? [];
      return (<div className="space-y-3"><TextField label="Section Headline" field="headline" /><ColorField label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Reviews</label><button onClick={() => set("reviews", [...reviews, { name: "Student Name", rating: 5, text: "Great course!" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{reviews.map((r, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Review {i + 1}</span><button onClick={() => set("reviews", reviews.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><Input value={r.name} onChange={e => { const next = reviews.map((rv, j) => j === i ? { ...rv, name: e.target.value } : rv); set("reviews", next); }} className="h-7 text-xs" placeholder="Name" /><Input type="number" value={r.rating} onChange={e => { const next = reviews.map((rv, j) => j === i ? { ...rv, rating: Number(e.target.value) } : rv); set("reviews", next); }} className="h-7 text-xs" min={1} max={5} placeholder="Rating (1-5)" /><Textarea value={r.text} onChange={e => { const next = reviews.map((rv, j) => j === i ? { ...rv, text: e.target.value } : rv); set("reviews", next); }} className="text-xs min-h-[60px]" placeholder="Review text" /></div>))}</div></div></div>);
    }
    case "logos": {
      const logos: Array<{ url: string; alt: string }> = d.logos ?? [];
      return (<div className="space-y-3"><TextField label="Headline" field="headline" /><ColorField label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Logos</label><button onClick={() => set("logos", [...logos, { url: "", alt: "" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{logos.map((logo, i) => (<div key={i} className="flex gap-1 items-center"><Input value={logo.url} onChange={e => { const next = logos.map((l, j) => j === i ? { ...l, url: e.target.value } : l); set("logos", next); }} className="h-7 text-xs flex-1" placeholder="Logo URL" /><Input value={logo.alt} onChange={e => { const next = logos.map((l, j) => j === i ? { ...l, alt: e.target.value } : l); set("logos", next); }} className="h-7 text-xs w-24" placeholder="Alt" /><button onClick={() => set("logos", logos.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={12} /></button></div>))}</div></div></div>);
    }
    case "instructor":
      return (<div className="space-y-3"><TextField label="Name" field="name" /><TextField label="Title / Credentials" field="title" /><TextField label="Bio" field="bio" multiline /><TextField label="Avatar URL" field="avatarUrl" /><ColorField label="Background" field="bgColor" /></div>);
    case "faq": {
      const items: Array<{ q: string; a: string }> = d.items ?? [];
      return (<div className="space-y-3"><TextField label="Section Headline" field="headline" /><ColorField label="Background" field="bgColor" /><ColorField label="Accent Color" field="accentColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">FAQ Items</label><button onClick={() => set("items", [...items, { q: "Question?", a: "Answer." }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{items.map((item, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Q{i + 1}</span><button onClick={() => set("items", items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><Input value={item.q} onChange={e => { const next = items.map((it, j) => j === i ? { ...it, q: e.target.value } : it); set("items", next); }} className="h-7 text-xs" placeholder="Question" /><Textarea value={item.a} onChange={e => { const next = items.map((it, j) => j === i ? { ...it, a: e.target.value } : it); set("items", next); }} className="text-xs min-h-[60px]" placeholder="Answer" /></div>))}</div></div></div>);
    }
    case "countdown":
      return (<div className="space-y-3"><TextField label="Headline" field="headline" /><div><label className="text-xs text-gray-500 block mb-1">Target Date & Time</label><Input type="datetime-local" value={d.targetDate ?? ""} onChange={e => set("targetDate", e.target.value)} className="h-8 text-sm" /></div><ColorField label="Background" field="bgColor" /><ColorField label="Text Color" field="textColor" /></div>);
    case "alert":
      return (<div className="space-y-3"><TextField label="Alert Text" field="text" /><div><label className="text-xs text-gray-500 block mb-1">Alert Type</label><select value={d.alertType ?? "info"} onChange={e => set("alertType", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="info">Info (Blue)</option><option value="success">Success (Green)</option><option value="warning">Warning (Yellow)</option><option value="error">Error (Red)</option></select></div><TextField label="Icon (emoji)" field="icon" placeholder="💡" /></div>);
    case "flip_cards": {
      const cards: Array<{ front: string; back: string }> = d.cards ?? [];
      return (<div className="space-y-3"><TextField label="Section Headline" field="headline" /><ColorField label="Accent Color" field="accentColor" /><ColorField label="Background" field="bgColor" /><div><div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-500 font-medium">Cards</label><button onClick={() => set("cards", [...cards, { front: "Card Title", back: "Card description" }])} className="text-xs text-teal-600 flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-2">{cards.map((card, i) => (<div key={i} className="border border-gray-200 rounded p-2 space-y-1"><div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-500">Card {i + 1}</span><button onClick={() => set("cards", cards.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={10} /></button></div><Input value={card.front} onChange={e => { const next = cards.map((c, j) => j === i ? { ...c, front: e.target.value } : c); set("cards", next); }} className="h-7 text-xs" placeholder="Front (title)" /><Textarea value={card.back} onChange={e => { const next = cards.map((c, j) => j === i ? { ...c, back: e.target.value } : c); set("cards", next); }} className="text-xs min-h-[60px]" placeholder="Back (description)" /></div>))}</div></div></div>);
    }
    case "pricing_cta":
      return (<div className="space-y-3"><TextField label="Headline" field="headline" /><TextField label="Subtext" field="subtext" multiline /><TextField label="CTA Button Text" field="ctaText" /><ColorField label="CTA Color" field="ctaColor" /><ColorField label="CTA Text Color" field="ctaTextColor" /><ColorField label="Background" field="bgColor" /><div className="flex items-center gap-2"><input type="checkbox" checked={d.showPrice ?? true} onChange={e => set("showPrice", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show course price</label></div></div>);
    case "cta_standalone":
      return (<div className="space-y-3"><TextField label="Headline" field="headline" /><TextField label="Subtext" field="subtext" multiline /><TextField label="Button Text" field="ctaText" /><TextField label="Button Link" field="ctaLink" placeholder="/learn/course-slug or https://..." /><ColorField label="Button Color" field="ctaColor" /><ColorField label="Button Text Color" field="ctaTextColor" /><ColorField label="Background" field="bgColor" /><AlignField /></div>);
    case "lead_capture":
      return (<div className="space-y-3"><TextField label="Headline" field="headline" /><TextField label="Subtext" field="subtext" multiline /><TextField label="Button Text" field="ctaText" /><ColorField label="Background" field="bgColor" /><ColorField label="Text Color" field="textColor" /></div>);
    case "curriculum_auto":
      return (<div className="space-y-3"><TextField label="Section Headline" field="headline" /><ColorField label="Background" field="bgColor" /><div className="flex items-center gap-2"><input type="checkbox" checked={d.showLocked ?? true} onChange={e => set("showLocked", e.target.checked)} className="rounded" /><label className="text-xs text-gray-600">Show locked lessons</label></div></div>);
    case "pricing_options_auto":
      return (<div className="space-y-3"><TextField label="Section Headline" field="headline" /><ColorField label="Background" field="bgColor" /></div>);
    case "divider":
      return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Style</label><select value={d.style ?? "solid"} onChange={e => set("style", e.target.value)} className="w-full h-8 text-xs rounded border border-gray-200 px-2"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></div><ColorField label="Color" field="color" /><div><label className="text-xs text-gray-500 block mb-1">Thickness (px)</label><Input type="number" value={d.thickness ?? 1} onChange={e => set("thickness", Number(e.target.value))} className="h-8 text-sm" min={1} max={10} /></div><div><label className="text-xs text-gray-500 block mb-1">Vertical Spacing (px)</label><Input type="number" value={d.spacing ?? 32} onChange={e => set("spacing", Number(e.target.value))} className="h-8 text-sm" min={0} max={200} /></div></div>);
    case "two_column":
      return (<div className="space-y-3"><div><label className="text-xs text-gray-500 block mb-1">Left Column</label><RichTextEditor value={d.leftHtml ?? ""} onChange={(html) => set("leftHtml", html)} minHeight={100} maxHeight={300} placeholder="Left column content..." /></div><div><label className="text-xs text-gray-500 block mb-1">Right Column</label><RichTextEditor value={d.rightHtml ?? ""} onChange={(html) => set("rightHtml", html)} minHeight={100} maxHeight={300} placeholder="Right column content..." /></div><div><label className="text-xs text-gray-500 block mb-1">Left Column Width (%)</label><Input type="number" value={d.leftRatio ?? 50} onChange={e => set("leftRatio", Number(e.target.value))} className="h-8 text-sm" min={20} max={80} /></div><ColorField label="Background" field="bgColor" /></div>);
    case "spacer":
      return (<div><label className="text-xs text-gray-500 block mb-1">Height (px)</label><Input type="number" value={d.height ?? 48} onChange={e => set("height", Number(e.target.value))} className="h-8 text-sm" min={8} max={400} /></div>);
    default:
      return <p className="text-xs text-gray-400">No settings for this block type.</p>;
  }
}

// ─── Sortable Block Card ──────────────────────────────────────────────────────

function SortableBlock({ block, isSelected, onSelect, onDelete, onDuplicate, coursePrice, courseTitle }: {
  block: Block; isSelected: boolean; onSelect: () => void; onDelete: () => void; onDuplicate: () => void; coursePrice?: number; courseTitle?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} onClick={onSelect}
      className={`relative group cursor-pointer border-2 transition-all ${isSelected ? "border-teal-500 shadow-lg shadow-teal-100" : "border-transparent hover:border-teal-200"}`}>
      <div className={`absolute top-2 right-2 z-10 flex gap-1 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-teal-600 flex items-center justify-center" title="Duplicate"><Copy size={12} /></button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-500 hover:text-red-500 flex items-center justify-center" title="Delete"><Trash2 size={12} /></button>
      </div>
      <div {...attributes} {...listeners} onClick={e => e.stopPropagation()}
        className={`absolute top-2 left-2 z-10 w-7 h-7 bg-white border border-gray-200 rounded shadow text-gray-400 hover:text-gray-600 flex items-center justify-center cursor-grab active:cursor-grabbing ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
        title="Drag to reorder"><GripVertical size={14} /></div>
      <BlockPreview block={block} coursePrice={coursePrice} courseTitle={courseTitle} />
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
          {/* Save current page as template */}
          <div className="border border-dashed border-teal-300 rounded-xl p-4 bg-teal-50/50">
            <p className="text-xs font-semibold text-teal-700 mb-3">Save Current {tab === "page" ? "Page" : "Selection"} as Template</p>
            <div className="space-y-2">
              <Input value={saveName} onChange={e => setSaveName(e.target.value)} className="h-8 text-sm" placeholder="Template name..." />
              <Input value={saveDesc} onChange={e => setSaveDesc(e.target.value)} className="h-8 text-sm" placeholder="Description (optional)" />
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

  const { isLoading, data: lpData } = trpc.lmsAdmin.getLandingPageBlocks.useQuery(
    { courseId: numericCourseId },
    { enabled: !isNaN(numericCourseId) }
  );

  if (lpData && !hasLoaded) {
    setHasLoaded(true);
    setCourseInfo({ title: lpData.courseTitle, slug: lpData.courseSlug });
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
          <button onClick={() => navigate("/admin/lms")} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 font-medium transition-colors">
            <ArrowLeft size={16} /> Back to Admin
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
                  {blocks.map(block => (
                    <SortableBlock key={block.id} block={block} isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)} onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)} coursePrice={courseInfo?.price} courseTitle={courseInfo?.title} />
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
