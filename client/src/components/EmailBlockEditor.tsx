/**
 * EmailBlockEditor — Drag-and-drop email block editor
 *
 * Reuses BLOCK_CATALOG, BlockSettings, SortableBlock, and Block types from
 * LandingPageBuilder, filtered to email-safe blocks only.
 *
 * Converts blocks to email-safe inline-CSS HTML via emailBlockToHtml().
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  arrayMove,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  BLOCK_CATALOG,
  BlockSettings,
  SortableBlock,
  uid,
  type Block,
  type BlockType,
} from "@/pages/admin/LandingPageBuilder";
import { Plus, Eye, EyeOff, ChevronDown, ChevronRight, Search, RefreshCw, Sparkles, Wand2, ImageOff, RotateCcw, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  BlockTemplateLibraryProvider,
  OpenTemplateLibraryButton,
  useBlockTemplateLibrary,
} from "@/components/BlockTemplateLibrary";

// ─── Email-specific auto-content block types ─────────────────────────────────
// These are email-only blocks not in the main BLOCK_CATALOG
const EMAIL_AUTO_BLOCKS: { type: BlockType; label: string; icon: React.ReactNode; category: string; defaultData: Record<string, any> }[] = [
  {
    type: "included_items_auto",
    label: "Membership Included Items",
    icon: "✅",
    category: "Auto Content",
    defaultData: {
      headline: "What's Included in Your Membership",
      subtext: "Everything you need to advance your skills.",
      items: [
        { icon: "🎓", title: "All Courses", text: "Full access to every course in the library" },
        { icon: "📹", title: "Live Cohort Replays", text: "Watch recordings of all live sessions" },
        { icon: "📄", title: "Clinical Resources", text: "Downloadable references and guides" },
        { icon: "🏆", title: "CME Credits", text: "Earn continuing education credits" },
      ],
      bgColor: "#f0fafa",
      accentColor: "#179ca3",
    },
  },
  {
    type: "cohort_sessions_auto",
    label: "Upcoming Cohort Sessions",
    icon: "📅",
    category: "Auto Content",
    defaultData: {
      headline: "Upcoming Live Sessions",
      sessions: [
        { title: "Live Q&A Session", date: "TBD", time: "TBD", description: "" },
      ],
      ctaText: "View All Sessions",
      ctaLink: "https://",
      bgColor: "#f9fafb",
      accentColor: "#179ca3",
    },
  },
  {
    type: "related_products",
    label: "Related Products",
    icon: "🛍️",
    category: "Auto Content",
    defaultData: {
      headline: "You Might Also Like",
      subtext: "Explore more resources to advance your skills.",
      products: [
        { title: "Course Title", description: "Short description", price: "", imageUrl: "", link: "https://" },
      ],
      ctaText: "Learn More",
      bgColor: "#f9fafb",
      accentColor: "#179ca3",
    },
  },
];

// ─── Email-safe block types ───────────────────────────────────────────────────
// These block types render correctly in email clients (no JS, no interactive)
const EMAIL_SAFE_TYPES: BlockType[] = [
  "hero",
  "spacer",
  "divider",
  "text",
  "image",
  "ai_image",
  "video",       // renders as thumbnail + Watch Video link (email-safe)
  "audio",       // renders as Listen link (email-safe)
  "gallery",
  "carousel",    // renders as static image grid (email-safe)
  "embed",       // renders as View Content link (email-safe)
  "countdown",   // renders as static deadline text (email-safe)
  "bullets",
  "numbered_list",
  "checklist",
  "icon_grid",
  "testimonial",
  "reviews",
  "logos",
  "instructor",
  "faq",
  "alert",
  "flip_cards",
  "cta_standalone",
  "lead_capture",
  "logo_strip",
  "footer",
  "data_table",
  "two_column",
  "three_column",
  "divided_columns",
  "ai_content",  // AI Generate Content block — renders as rich text in email
];

// Filter catalog to email-safe blocks only, then append email-auto blocks
const EMAIL_BLOCK_CATALOG = [
  ...BLOCK_CATALOG.filter((b) => EMAIL_SAFE_TYPES.includes(b.type)),
  ...EMAIL_AUTO_BLOCKS,
];

// Categories that have at least one email-safe block
const EMAIL_CATALOG_CATEGORIES = [
  "Layout",
  "Content",
  "Marketing",
  "Conversion",
  "Auto Content",
];

// ─── Block → Email HTML renderer ─────────────────────────────────────────────
// Converts the shared {id, type, data} block format to inline-CSS email HTML.
export function emailBlockToHtml(block: Block): string {
  const d = block.data ?? {};
  const align = (d.align as string) ?? "left";

  switch (block.type) {
    case "text": {
      const html = (d.html as string) ?? "";
      const bg = (d.bgColor as string) ?? "";
      const color = (d.textColor as string) ?? "#1a2e3b";
      const bgStyle = bg && bg !== "#ffffff" ? `background:${bg};` : "";
      const aiImg = (d.aiImageUrl as string) ?? "";
      const imgHtml = aiImg ? `<div style="margin-bottom:12px;"><img src="${aiImg}" alt="" style="max-width:100%;width:100%;display:block;border-radius:8px;" /></div>` : "";
      return `<div style="${bgStyle}padding:8px 0;color:${color};font-size:15px;line-height:1.7;text-align:${align};">${imgHtml}${html}</div>`;
    }
    case "ai_image":
    case "image": {
      const url = (d.url as string) ?? "";
      if (!url) return "";
      const alt = (d.alt as string) ?? "";
      // Default to 100% width so images fill their designated column within the 750px container.
      // Users can narrow via the Image Width selector in block settings.
      const rawWidth = (d.maxWidth as string) ?? "100%";
      const imgWidth = rawWidth === "auto" ? "100%" : rawWidth;
      const link = (d.linkUrl as string) ?? "";
      const shadow = d.showShadow ? "box-shadow:0 2px 8px rgba(0,0,0,0.12);" : "";
      const img = `<img src="${url}" alt="${alt}" style="max-width:100%;width:${imgWidth};display:block;border-radius:8px;${shadow}" />`;
      const wrapped = link ? `<a href="${link}" style="text-decoration:none;">${img}</a>` : img;
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;"><tr><td align="${align}">${wrapped}</td></tr></table>`;
    }
    case "hero": {
      const headline = (d.headline as string) ?? "";
      const subheadline = (d.subheadline as string) ?? "";
      const bgColor = (d.bgColor as string) ?? "#179ca3";
      const textColor = (d.textColor as string) ?? "#ffffff";
      // Only render buttons when hideButtons is false AND the button has non-default text
      const hideButtons = d.hideButtons as boolean;
      const buttons = (d.buttons as any[]) ?? [];
      const btnHtml = hideButtons ? "" : buttons.map((btn: any) => {
        const btnText = (btn.text as string) ?? "";
        // Skip empty or default placeholder text that should not appear in email
        if (!btnText || btnText === "Enroll Now" || btnText === "Get Started") return "";
        return `<a href="${btn.link || "#"}" style="display:inline-block;background:${btn.color || "#ffffff"};color:${btn.textColor || "#179ca3"};text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px;margin:4px;">${btnText}</a>`;
      }).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bgColor};border-radius:8px;margin:0 0 16px;"><tr><td style="padding:32px;text-align:${align};"><h1 style="color:${textColor};font-size:28px;font-weight:900;margin:0 0 12px;line-height:1.2;">${headline}</h1>${subheadline ? `<p style="color:${textColor};font-size:16px;margin:0 0 20px;opacity:0.9;">${subheadline}</p>` : ""}${btnHtml ? `<div style="margin-top:16px;">${btnHtml}</div>` : ""}</td></tr></table>`;
    }
    case "spacer": {
      const height = (d.height as number) ?? 48;
      return `<div style="height:${height}px;"></div>`;
    }
    case "divider": {
      const color = (d.color as string) ?? "#e5eaec";
      const thickness = (d.thickness as number) ?? 1;
      const spacing = (d.spacing as number) ?? 32;
      return `<hr style="border:none;border-top:${thickness}px solid ${color};margin:${spacing / 2}px 0;" />`;
    }
    case "bullets": {
      const headline = (d.headline as string) ?? "";
      const items = (d.items as string[]) ?? [];
      const iconColor = (d.iconColor as string) ?? "#179ca3";
      const bg = (d.bgColor as string) ?? "#f8fffe";
      const itemsHtml = items.map((item) =>
        `<tr><td style="padding:4px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:20px;vertical-align:top;color:${iconColor};font-size:16px;font-weight:bold;">✓</td><td style="padding-left:8px;color:#1a2e3b;font-size:15px;line-height:1.6;">${item}</td></tr></table></td></tr>`
      ).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:18px;font-weight:700;margin:0 0 16px;">${headline}</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr></table>`;
    }
    case "numbered_list": {
      const headline = (d.headline as string) ?? "";
      const items = (d.items as string[]) ?? [];
      const accentColor = (d.accentColor as string) ?? "#179ca3";
      const bg = (d.bgColor as string) ?? "#ffffff";
      const itemsHtml = items.map((item, i) =>
        `<tr><td style="padding:6px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:28px;vertical-align:top;"><span style="display:inline-block;width:24px;height:24px;background:${accentColor};color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;">${i + 1}</span></td><td style="padding-left:10px;color:#1a2e3b;font-size:15px;line-height:1.6;vertical-align:middle;">${item}</td></tr></table></td></tr>`
      ).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:18px;font-weight:700;margin:0 0 16px;">${headline}</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr></table>`;
    }
    case "checklist": {
      const headline = (d.headline as string) ?? "";
      const items = (d.items as string[]) ?? [];
      const accentColor = (d.accentColor as string) ?? "#179ca3";
      const bg = (d.bgColor as string) ?? "#ffffff";
      const itemsHtml = items.map((item) =>
        `<tr><td style="padding:4px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:20px;vertical-align:top;color:${accentColor};font-size:16px;">☑</td><td style="padding-left:8px;color:#1a2e3b;font-size:15px;line-height:1.6;">${item}</td></tr></table></td></tr>`
      ).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:18px;font-weight:700;margin:0 0 16px;">${headline}</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr></table>`;
    }
    case "testimonial": {
      const quote = (d.quote as string) ?? "";
      const author = (d.author as string) ?? "";
      const bg = (d.bgColor as string) ?? "#f0fafa";
      const accent = (d.accentColor as string) ?? "#179ca3";
      const rating = (d.rating as number) ?? 0;
      const stars = rating > 0 ? `<div style="color:#f59e0b;font-size:18px;margin-bottom:8px;">${"★".repeat(rating)}</div>` : "";
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-left:4px solid ${accent};border-radius:0 8px 8px 0;margin:16px 0;"><tr><td style="padding:20px 24px;">${stars}<p style="color:#0e4a50;font-size:16px;font-style:italic;margin:0 0 12px;line-height:1.7;">"${quote}"</p>${author ? `<p style="color:#189aa1;font-size:13px;font-weight:600;margin:0;">— ${author}</p>` : ""}</td></tr></table>`;
    }
    case "cta_standalone": {
      const headline = (d.headline as string) ?? "";
      const subtext = (d.subtext as string) ?? "";
      const ctaText = (d.ctaText as string) ?? "Get Started";
      const ctaLink = (d.ctaLink as string) ?? "#";
      const ctaColor = (d.ctaColor as string) ?? "#179ca3";
      const ctaTextColor = (d.ctaTextColor as string) ?? "#ffffff";
      const bg = (d.bgColor as string) ?? "#f0fafa";
      const textAlign = (d.align as string) ?? "center";
      const displayPrice = (d.displayPrice as string) ?? "";
      const strikethroughPrice = (d.strikethroughPrice as string) ?? "";
      const showStrikethrough = !!(d.showStrikethrough) && !!strikethroughPrice;
      const priceHtml = displayPrice ? `${showStrikethrough ? `<p style="margin:0 0 4px;font-size:16px;color:#9ca3af;text-decoration:line-through;">${strikethroughPrice}</p>` : ""}<p style="margin:0 0 16px;font-size:28px;font-weight:800;color:${ctaColor};">${displayPrice}</p>` : "";
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;margin:16px 0;"><tr><td style="padding:32px;text-align:${textAlign};">${headline ? `<h2 style="color:#0e1e2e;font-size:22px;font-weight:700;margin:0 0 8px;">${headline}</h2>` : ""}${subtext ? `<p style="color:#4a6070;font-size:15px;margin:0 0 20px;">${subtext}</p>` : ""}${priceHtml}<a href="${ctaLink}" style="display:inline-block;background:${ctaColor};color:${ctaTextColor};text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">${ctaText}</a></td></tr></table>`;
    }
    case "lead_capture": {
      const headline = (d.headline as string) ?? "Stay in the loop";
      const subtext = (d.subtext as string) ?? "";
      const ctaText = (d.ctaText as string) ?? "Subscribe";
      const bg = (d.bgColor as string) ?? "#179ca3";
      const textColor = (d.textColor as string) ?? "#ffffff";
      const btnBg = (d.btnBg as string) ?? "#ffffff";
      const btnTextColor = (d.btnTextColor as string) ?? "#179ca3";
      const showName = d.showNameField as boolean;
      const nameField = showName ? `<tr><td style="padding-bottom:8px;"><input type="text" name="name" placeholder="${(d.namePlaceholder as string) ?? "Your name"}" style="width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid rgba(255,255,255,0.4);border-radius:8px;font-size:14px;background:rgba(255,255,255,0.15);color:${textColor};" /></td></tr>` : "";
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td align="center"><table cellpadding="0" cellspacing="0" style="background:${bg};border-radius:12px;padding:32px;max-width:480px;width:100%;margin:0 auto;"><tr><td style="padding-bottom:8px;text-align:center;"><strong style="font-size:20px;color:${textColor};">${headline}</strong></td></tr>${subtext ? `<tr><td style="padding-bottom:16px;text-align:center;"><p style="color:${textColor};font-size:14px;margin:0;opacity:0.85;">${subtext}</p></td></tr>` : ""}${nameField}<tr><td style="padding-bottom:12px;"><input type="email" name="email" placeholder="${(d.emailPlaceholder as string) ?? "Your email address"}" style="width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid rgba(255,255,255,0.4);border-radius:8px;font-size:14px;background:rgba(255,255,255,0.15);color:${textColor};" /></td></tr><tr><td style="text-align:center;"><a href="#" style="display:inline-block;background:${btnBg};color:${btnTextColor};text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:700;font-size:15px;">${ctaText}</a></td></tr></table></td></tr></table>`;
    }
    case "alert": {
      const text = (d.text as string) ?? "";
      const alertType = (d.alertType as string) ?? "info";
      const icon = (d.icon as string) ?? "💡";
      const colors: Record<string, { bg: string; border: string; text: string }> = {
        info: { bg: "#f0fbfc", border: "#189aa1", text: "#0e4a50" },
        warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
        success: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
        error: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
      };
      const c = colors[alertType] ?? colors.info;
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg};border-left:4px solid ${c.border};border-radius:0 8px 8px 0;margin:12px 0;"><tr><td style="padding:14px 18px;color:${c.text};font-size:15px;">${icon} ${text}</td></tr></table>`;
    }
    case "logo_strip": {
      const logoUrl = (d.logoUrl as string) ?? "";
      const maxWidth = (d.maxWidth as string) ?? "200px";
      const link = (d.link as string) ?? "/";
      const bg = (d.bgColor as string) ?? "#ffffff";
      if (!logoUrl) return "";
      const img = `<img src="${logoUrl}" alt="Logo" style="max-width:${maxWidth};display:block;" />`;
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};margin:8px 0;"><tr><td align="${align}" style="padding:${d.padding ?? "16px 0"};">${link ? `<a href="${link}">${img}</a>` : img}</td></tr></table>`;
    }
    case "footer": {
      const bg = (d.bgColor as string) ?? "#0e1e2e";
      const textColor = (d.textColor as string) ?? "#ffffff";
      const copyright = (d.copyrightText as string) ?? `\u00a9 ${new Date().getFullYear()} All About Ultrasound\u2122 | iHeartEcho\u2122. All rights reserved.`;
      // Support both d.links (array) and d.footerLinks (legacy key)
      const links = ((d.links ?? d.footerLinks) as { text: string; url: string }[] | undefined) ?? [];
      const linksHtml = links
        .filter((l) => l && l.text && l.url)
        .map((l) => `<a href="${l.url}" style="color:#189aa1;text-decoration:none;margin:0 8px;">${l.text}</a>`)
        .join(" &middot; ");
      const accountNotice = `<p style="color:${textColor};font-size:11px;margin:8px 0 0;opacity:0.7;">You are receiving this email because you have an account on All About Ultrasound\u2122 | iHeartEcho\u2122</p>`;
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:0 0 8px 8px;"><tr><td style="padding:20px 32px;text-align:center;"><p style="color:${textColor};font-size:12px;margin:0 0 8px;">${copyright}</p>${linksHtml ? `<p style="margin:4px 0;font-size:12px;">${linksHtml}</p>` : ""}${accountNotice}</td></tr></table>`;
    }
    case "data_table": {
      const rows = (d.rows as string[][]) ?? [];
      const hasHeader = d.hasHeader as boolean;
      const bordered = d.bordered as boolean;
      const striped = d.striped as boolean;
      const headerBg = (d.headerBg as string) ?? "#f0fafa";
      const headerTextColor = (d.headerTextColor as string) ?? "#0e4a50";
      const borderColor = (d.borderColor as string) ?? "#d1fae5";
      const fontSize = (d.fontSize as number) ?? 14;
      const borderStyle = bordered ? `border:1px solid ${borderColor};` : "";
      const rowsHtml = rows.map((row, ri) => {
        const isHeader = hasHeader && ri === 0;
        const rowBg = isHeader ? headerBg : (striped && ri % 2 === 0 ? "#f9fafb" : "#ffffff");
        const cellColor = isHeader ? headerTextColor : "#1a2e3b";
        const tag = isHeader ? "th" : "td";
        const cells = row.map((cell) => `<${tag} style="${borderStyle}padding:8px 12px;color:${cellColor};font-size:${fontSize}px;font-weight:${isHeader ? "600" : "400"};">${cell}</${tag}>`).join("");
        return `<tr style="background:${rowBg};">${cells}</tr>`;
      }).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;font-size:${fontSize}px;">${rowsHtml}</table>`;
    }
    case "two_column": {
      const leftHtml = (d.leftHtml as string) ?? "";
      const rightHtml = (d.rightHtml as string) ?? "";
      const bg = (d.bgColor as string) ?? "#ffffff";
      const leftRatio = (d.leftRatio as number) ?? 50;
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};margin:12px 0;"><tr><td width="${leftRatio}%" style="padding:12px;vertical-align:top;font-size:15px;color:#1a2e3b;line-height:1.7;">${leftHtml}</td><td width="${100 - leftRatio}%" style="padding:12px;vertical-align:top;font-size:15px;color:#1a2e3b;line-height:1.7;">${rightHtml}</td></tr></table>`;
    }
    case "three_column": {
      const col1 = (d.col1Html as string) ?? "";
      const col2 = (d.col2Html as string) ?? "";
      const col3 = (d.col3Html as string) ?? "";
      const bg = (d.bgColor as string) ?? "#ffffff";
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};margin:12px 0;"><tr><td width="33%" style="padding:12px;vertical-align:top;font-size:15px;color:#1a2e3b;line-height:1.7;">${col1}</td><td width="33%" style="padding:12px;vertical-align:top;font-size:15px;color:#1a2e3b;line-height:1.7;">${col2}</td><td width="34%" style="padding:12px;vertical-align:top;font-size:15px;color:#1a2e3b;line-height:1.7;">${col3}</td></tr></table>`;
    }
    case "divided_columns": {
      const columns = (d.columns as { html: string }[]) ?? [];
      const bg = (d.bgColor as string) ?? "#ffffff";
      const cells = columns.map((col) => `<td style="padding:12px;vertical-align:top;font-size:15px;color:#1a2e3b;line-height:1.7;width:${Math.floor(100 / columns.length)}%;">${col.html}</td>`).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};margin:12px 0;"><tr>${cells}</tr></table>`;
    }
    case "instructor": {
      const name = (d.name as string) ?? "";
      const title = (d.title as string) ?? "";
      const bio = (d.bio as string) ?? "";
      const avatarUrl = (d.avatarUrl as string) ?? "";
      const bg = (d.bgColor as string) ?? "#ffffff";
      const avatar = avatarUrl ? `<img src="${avatarUrl}" alt="${name}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:block;" />` : "";
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${avatar ? `<table cellpadding="0" cellspacing="0"><tr><td style="padding-right:16px;vertical-align:top;">${avatar}</td><td style="vertical-align:top;"><strong style="color:#0e1e2e;font-size:18px;">${name}</strong><br/><span style="color:#179ca3;font-size:13px;">${title}</span>${bio ? `<p style="color:#4a6070;font-size:14px;margin:8px 0 0;line-height:1.6;">${bio}</p>` : ""}</td></tr></table>` : `<strong style="color:#0e1e2e;font-size:18px;">${name}</strong><br/><span style="color:#179ca3;font-size:13px;">${title}</span>${bio ? `<p style="color:#4a6070;font-size:14px;margin:8px 0 0;line-height:1.6;">${bio}</p>` : ""}`}</td></tr></table>`;
    }
    case "faq": {
      const headline = (d.headline as string) ?? "";
      const items = (d.items as { q: string; a: string }[]) ?? [];
      const bg = (d.bgColor as string) ?? "#ffffff";
      const accent = (d.accentColor as string) ?? "#179ca3";
      const itemsHtml = items.map((item) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #e5eaec;"><strong style="color:#0e1e2e;font-size:15px;">${item.q}</strong><p style="color:#4a6070;font-size:14px;margin:6px 0 0;line-height:1.6;">${item.a}</p></td></tr>`
      ).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:20px;font-weight:700;margin:0 0 16px;border-bottom:2px solid ${accent};padding-bottom:8px;">${headline}</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr></table>`;
    }
    case "reviews": {
      const headline = (d.headline as string) ?? "";
      const reviews = (d.reviews as { name: string; rating: number; text: string }[]) ?? [];
      const bg = (d.bgColor as string) ?? "#ffffff";
      const reviewsHtml = reviews.map((r) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #e5eaec;"><div style="color:#f59e0b;font-size:14px;margin-bottom:4px;">${"★".repeat(r.rating || 5)}</div><p style="color:#1a2e3b;font-size:14px;margin:0 0 4px;line-height:1.6;">${r.text}</p><span style="color:#189aa1;font-size:12px;font-weight:600;">— ${r.name}</span></td></tr>`
      ).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:20px;font-weight:700;margin:0 0 16px;">${headline}</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${reviewsHtml}</table></td></tr></table>`;
    }
    case "logos": {
      const headline = (d.headline as string) ?? "";
      const logos = (d.logos as { url: string; alt: string }[]) ?? [];
      const bg = (d.bgColor as string) ?? "#f9fafb";
      const logosHtml = logos.filter((l) => l.url).map((l) =>
        `<td style="padding:8px 16px;text-align:center;"><img src="${l.url}" alt="${l.alt}" style="max-height:48px;max-width:120px;display:inline-block;" /></td>`
      ).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td style="text-align:center;">${headline ? `<p style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 16px;">${headline}</p>` : ""}<table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${logosHtml}</tr></table></td></tr></table>`;
    }
    case "icon_grid": {
      const headline = (d.headline as string) ?? "";
      const items = (d.items as { icon: string; title: string; text: string }[]) ?? [];
      const bg = (d.bgColor as string) ?? "#ffffff";
      const itemsHtml = items.map((item) =>
        `<td style="padding:12px;text-align:center;vertical-align:top;width:${Math.floor(100 / Math.max(items.length, 1))}%;"><div style="font-size:28px;margin-bottom:8px;">${item.icon}</div><strong style="color:#0e1e2e;font-size:14px;display:block;margin-bottom:4px;">${item.title}</strong><p style="color:#4a6070;font-size:13px;margin:0;line-height:1.5;">${item.text}</p></td>`
      ).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:20px;font-weight:700;margin:0 0 20px;text-align:center;">${headline}</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0"><tr>${itemsHtml}</tr></table></td></tr></table>`;
    }
    case "included_items_auto": {
      const headline = (d.headline as string) ?? "What's Included";
      const subtext = (d.subtext as string) ?? "";
      const bg = (d.bgColor as string) ?? "#f0fafa";
      const accent = (d.accentColor as string) ?? "#179ca3";
      const sourceMode = (d.sourceMode as string) ?? "manual";
      const viewMode = (d.viewMode as string) ?? "list";
      // Database mode: use resolvedItems (populated server-side at send time)
      const resolvedPlans = (d.resolvedItems as { title: string; price: number; billingInterval: string; features: string[] }[]) ?? [];
      const manualItems = (d.items as { icon: string; title: string; text: string }[]) ?? [];
      let itemsHtml = "";
      if (sourceMode === "database" && resolvedPlans.length > 0) {
        if (viewMode === "card") {
          const cardsHtml = resolvedPlans.map((plan) => {
            const feats = (plan.features ?? []).map((f: string) =>
              `<tr><td style="padding:3px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:16px;color:${accent};font-size:13px;font-weight:bold;">✓</td><td style="padding-left:6px;color:#4a6070;font-size:12px;">${f}</td></tr></table></td></tr>`
            ).join("");
            return `<td style="width:50%;vertical-align:top;padding:8px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5eaec;border-radius:8px;padding:16px;"><tr><td><strong style="color:#0e1e2e;font-size:15px;">${plan.title}</strong><br/><span style="color:${accent};font-size:13px;font-weight:600;">$${((plan.price ?? 0) / 100).toFixed(0)}/${plan.billingInterval}</span><table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">${feats}</table></td></tr></table></td>`;
          }).join("");
          itemsHtml = `<tr>${cardsHtml}</tr>`;
        } else {
          itemsHtml = resolvedPlans.map((plan) => {
            const feats = (plan.features ?? []).slice(0, 4).map((f: string) =>
              `<span style="color:#4a6070;font-size:12px;">✓ ${f}</span>`
            ).join(" &nbsp;·&nbsp; ");
            return `<tr><td style="padding:10px 0;border-bottom:1px solid #e5eaec;"><strong style="color:#0e1e2e;font-size:14px;display:block;">${plan.title}</strong><span style="color:${accent};font-size:12px;font-weight:600;">$${((plan.price ?? 0) / 100).toFixed(0)}/${plan.billingInterval}</span>${feats ? `<br/><span style="color:#4a6070;font-size:12px;">${feats}</span>` : ""}</td></tr>`;
          }).join("");
        }
      } else {
        itemsHtml = manualItems.map((item) =>
          `<tr><td style="padding:10px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:32px;vertical-align:top;font-size:20px;">${item.icon}</td><td style="padding-left:10px;vertical-align:top;"><strong style="color:#0e1e2e;font-size:14px;display:block;">${item.title}</strong><span style="color:#4a6070;font-size:13px;line-height:1.5;">${item.text}</span></td></tr></table></td></tr>`
        ).join("");
      }
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:20px;font-weight:700;margin:0 0 ${subtext ? '4px' : '16px'};">` + headline + `</h3>` : ""}${subtext ? `<p style="color:#4a6070;font-size:14px;margin:0 0 16px;">` + subtext + `</p>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr></table>`;
    }
    case "cohort_sessions_auto": {
      const headline = (d.headline as string) ?? "Upcoming Live Sessions";
      const ctaText = (d.ctaText as string) ?? "View All Sessions";
      const ctaLink = (d.ctaLink as string) ?? "#";
      const bg = (d.bgColor as string) ?? "#f9fafb";
      const accent = (d.accentColor as string) ?? "#179ca3";
      const sourceMode = (d.sourceMode as string) ?? "manual";
      const viewMode = (d.viewMode as string) ?? "list";
      const resolvedSessions = (d.resolvedItems as { title: string; date: string; time?: string; description?: string; location?: string; type?: string; link?: string }[]) ?? [];
      const manualSessions = (d.sessions as { title: string; date: string; time: string; description: string }[]) ?? [];
      const sessionsToRender = sourceMode === "database" && resolvedSessions.length > 0 ? resolvedSessions : manualSessions;
      let sessionsHtml = "";
      if (viewMode === "card" && sourceMode === "database" && resolvedSessions.length > 0) {
        const cardsHtml = resolvedSessions.map((s) =>
          `<td style="width:50%;vertical-align:top;padding:8px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5eaec;border-radius:8px;padding:16px;"><tr><td><strong style="color:#0e1e2e;font-size:14px;">${s.title}</strong><br/><span style="color:${accent};font-size:12px;font-weight:600;">${s.date}${s.time ? ' · ' + s.time : ''}${s.location ? ' · ' + s.location : ''}</span>${s.description ? `<p style="color:#4a6070;font-size:12px;margin:6px 0 0;">${s.description}</p>` : ""}${s.link ? `<br/><a href="${s.link}" style="color:${accent};font-size:12px;font-weight:600;">Register →</a>` : ""}</td></tr></table></td>`
        ).join("");
        sessionsHtml = `<tr>${cardsHtml}</tr>`;
      } else {
        sessionsHtml = sessionsToRender.map((s) =>
          `<tr><td style="padding:10px 0;border-bottom:1px solid #e5eaec;"><strong style="color:#0e1e2e;font-size:14px;">${s.title}</strong><br/><span style="color:${accent};font-size:13px;font-weight:600;">${s.date}${s.time ? ' · ' + s.time : ''}${'location' in s && s.location ? ' · ' + s.location : ''}</span>${s.description ? `<p style="color:#4a6070;font-size:13px;margin:4px 0 0;">${s.description}</p>` : ""}${'link' in s && s.link ? `<br/><a href="${s.link}" style="color:${accent};font-size:12px;font-weight:600;">Register →</a>` : ""}</td></tr>`
        ).join("");
      }
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:20px;font-weight:700;margin:0 0 16px;">` + headline + `</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${sessionsHtml}</table>${ctaText ? `<div style="margin-top:16px;text-align:center;"><a href="${ctaLink}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:14px;">${ctaText}</a></div>` : ""}</td></tr></table>`;
    }
    case "related_products": {
      const headline = (d.headline as string) ?? "You Might Also Like";
      const subtext = (d.subtext as string) ?? "";
      const ctaText = (d.ctaText as string) ?? "Learn More";
      const bg = (d.bgColor as string) ?? "#f9fafb";
      const accent = (d.accentColor as string) ?? "#179ca3";
      const sourceMode = (d.sourceMode as string) ?? "manual";
      const viewMode = (d.viewMode as string) ?? "list";
      const resolvedBundles = (d.resolvedItems as { title: string; description?: string; price: number; imageUrl?: string; link?: string }[]) ?? [];
      const manualProducts = (d.products as { title: string; description: string; price: string; imageUrl: string; link: string }[]) ?? [];
      let productsHtml = "";
      if (sourceMode === "database" && resolvedBundles.length > 0) {
        if (viewMode === "card") {
          const cardsHtml = resolvedBundles.map((b) =>
            `<td style="width:50%;vertical-align:top;padding:8px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5eaec;border-radius:8px;overflow:hidden;"><tr><td>${b.imageUrl ? `<img src="${b.imageUrl}" alt="${b.title}" style="width:100%;height:120px;object-fit:cover;display:block;" />` : ""}</td></tr><tr><td style="padding:14px;"><strong style="color:#0e1e2e;font-size:14px;display:block;">${b.title}</strong>${b.description ? `<p style="color:#4a6070;font-size:12px;margin:4px 0;">${b.description}</p>` : ""}<span style="color:${accent};font-size:13px;font-weight:600;">$${((b.price ?? 0) / 100).toFixed(0)}</span><br/><a href="${b.link || '#'}" style="display:inline-block;margin-top:8px;background:${accent};color:#fff;text-decoration:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;">${ctaText}</a></td></tr></table></td>`
          ).join("");
          productsHtml = `<tr>${cardsHtml}</tr>`;
        } else {
          productsHtml = resolvedBundles.map((b) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid #e5eaec;"><table cellpadding="0" cellspacing="0" width="100%"><tr>${b.imageUrl ? `<td style="width:64px;vertical-align:top;padding-right:12px;"><img src="${b.imageUrl}" alt="${b.title}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;display:block;" /></td>` : ""}<td style="vertical-align:top;"><strong style="color:#0e1e2e;font-size:14px;display:block;">${b.title}</strong>${b.description ? `<p style="color:#4a6070;font-size:13px;margin:2px 0;">${b.description}</p>` : ""}<span style="color:${accent};font-size:13px;font-weight:600;">$${((b.price ?? 0) / 100).toFixed(0)}</span></td><td style="vertical-align:middle;text-align:right;white-space:nowrap;"><a href="${b.link || '#'}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;">${ctaText}</a></td></tr></table></td></tr>`
          ).join("");
        }
      } else {
        productsHtml = manualProducts.map((p) =>
          `<tr><td style="padding:10px 0;border-bottom:1px solid #e5eaec;"><table cellpadding="0" cellspacing="0" width="100%"><tr>${p.imageUrl ? `<td style="width:64px;vertical-align:top;padding-right:12px;"><img src="${p.imageUrl}" alt="${p.title}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;display:block;" /></td>` : ""}<td style="vertical-align:top;"><strong style="color:#0e1e2e;font-size:14px;display:block;">${p.title}</strong>${p.description ? `<p style="color:#4a6070;font-size:13px;margin:2px 0;">${p.description}</p>` : ""}${p.price ? `<span style="color:${accent};font-size:13px;font-weight:600;">${p.price}</span>` : ""}</td><td style="vertical-align:middle;text-align:right;white-space:nowrap;"><a href="${p.link || '#'}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;">${ctaText}</a></td></tr></table></td></tr>`
        ).join("");
      }
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:20px;font-weight:700;margin:0 0 ${subtext ? '4px' : '16px'};">` + headline + `</h3>` : ""}${subtext ? `<p style="color:#4a6070;font-size:14px;margin:0 0 16px;">` + subtext + `</p>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${productsHtml}</table></td></tr></table>`;
    }
    case "flip_cards": {
      const headline = (d.headline as string) ?? "";
      const cards = (d.cards as { front: string; back: string }[]) ?? [];
      const bg = (d.bgColor as string) ?? "#f8fffe";
      const accent = (d.accentColor as string) ?? "#179ca3";
      const cardsHtml = cards.map((card) =>
        `<tr><td style="padding:8px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${accent};border-radius:8px;overflow:hidden;"><tr><td style="background:${accent};padding:12px 16px;color:#ffffff;font-weight:600;font-size:14px;">${card.front}</td></tr><tr><td style="padding:12px 16px;color:#1a2e3b;font-size:14px;line-height:1.6;">${card.back}</td></tr></table></td></tr>`
      ).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:24px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:20px;font-weight:700;margin:0 0 16px;">${headline}</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${cardsHtml}</table></td></tr></table>`;
    }
    case "gallery": {
      // Email-safe: static image grid
      const images = (d.images as { url?: string; src?: string; alt?: string; caption?: string }[]) ?? [];
      const headline = (d.headline as string) ?? "";
      const bg = (d.bgColor as string) ?? "#ffffff";
      const visibleImages = images.slice(0, 6);
      if (!visibleImages.length) return "";
      const cols = Math.min(visibleImages.length, 3);
      const cellWidth = Math.floor(100 / cols);
      const cellsHtml = visibleImages.map((img) => {
        const src = img.url ?? img.src ?? "";
        const alt = img.alt ?? img.caption ?? "";
        return `<td width="${cellWidth}%" style="padding:4px;vertical-align:top;">${src ? `<img src="${src}" alt="${alt}" style="width:100%;border-radius:6px;display:block;" />` : ""}${alt ? `<p style="color:#4a6070;font-size:12px;margin:4px 0 0;text-align:center;">${alt}</p>` : ""}</td>`;
      }).join("");
      // Build rows of `cols` cells
      const rows: string[] = [];
      for (let i = 0; i < visibleImages.length; i += cols) {
        const rowCells = visibleImages.slice(i, i + cols).map((img) => {
          const src = img.url ?? img.src ?? "";
          const alt = img.alt ?? img.caption ?? "";
          return `<td width="${cellWidth}%" style="padding:4px;vertical-align:top;">${src ? `<img src="${src}" alt="${alt}" style="width:100%;border-radius:6px;display:block;" />` : ""}${alt ? `<p style="color:#4a6070;font-size:12px;margin:4px 0 0;text-align:center;">${alt}</p>` : ""}</td>`;
        }).join("");
        rows.push(`<tr>${rowCells}</tr>`);
      }
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:16px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:18px;font-weight:700;margin:0 0 12px;">${headline}</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>${images.length > 6 ? `<p style="color:#9ca3af;font-size:12px;margin:8px 0 0;text-align:center;">+${images.length - 6} more</p>` : ""}</td></tr></table>`;
    }
    case "video": {
      // Email-safe: static thumbnail + Watch Video button
      const url = (d.url as string) ?? (d.embedUrl as string) ?? "";
      const caption = (d.caption as string) ?? "";
      const thumbnail = (d.thumbnailUrl as string) ?? "";
      const bg = (d.bgColor as string) ?? "#f8fafc";
      const accent = "#189aa1";
      if (!url) return "";
      const thumbHtml = thumbnail
        ? `<a href="${url}" style="display:block;text-decoration:none;"><img src="${thumbnail}" alt="${caption || "Watch video"}" style="max-width:100%;width:100%;border-radius:8px;display:block;margin-bottom:12px;" /></a>`
        : `<table width="100%" cellpadding="0" cellspacing="0" style="background:#0e1e2e;border-radius:8px;margin-bottom:12px;"><tr><td style="padding:40px;text-align:center;"><span style="font-size:40px;">▶</span></td></tr></table>`;
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:20px;margin:12px 0;"><tr><td>${thumbHtml}${caption ? `<p style="color:#4a6070;font-size:13px;margin:0 0 12px;">${caption}</p>` : ""}<a href="${url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;">▶ Watch Video</a></td></tr></table>`;
    }
    case "audio": {
      // Email-safe: static "Listen" link
      const url = (d.url as string) ?? "";
      const title = (d.title as string) ?? "Audio";
      const caption = (d.caption as string) ?? "";
      const bg = (d.bgColor as string) ?? "#f8fafc";
      const accent = "#189aa1";
      if (!url) return "";
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:20px;margin:12px 0;"><tr><td><p style="color:#0e1e2e;font-size:16px;font-weight:600;margin:0 0 6px;">🎧 ${title}</p>${caption ? `<p style="color:#4a6070;font-size:13px;margin:0 0 12px;">${caption}</p>` : ""}<a href="${url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;">🎧 Listen Now</a></td></tr></table>`;
    }
    case "carousel": {
      // Email-safe: static image grid (first 4 images)
      const items = (d.items as { url?: string; imageUrl?: string; caption?: string; headline?: string }[]) ?? [];
      const headline = (d.headline as string) ?? "";
      const bg = (d.bgColor as string) ?? "#ffffff";
      const visibleItems = items.slice(0, 4);
      if (!visibleItems.length) return "";
      const cols = visibleItems.length >= 3 ? 3 : visibleItems.length;
      const cellWidth = Math.floor(100 / cols);
      const cellsHtml = visibleItems.map((item) => {
        const imgUrl = item.url ?? item.imageUrl ?? "";
        const cap = item.caption ?? item.headline ?? "";
        return `<td width="${cellWidth}%" style="padding:4px;vertical-align:top;">${imgUrl ? `<img src="${imgUrl}" alt="${cap}" style="width:100%;border-radius:6px;display:block;" />` : ""}${cap ? `<p style="color:#4a6070;font-size:12px;margin:4px 0 0;text-align:center;">${cap}</p>` : ""}</td>`;
      }).join("");
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:16px;margin:12px 0;"><tr><td>${headline ? `<h3 style="color:#0e1e2e;font-size:18px;font-weight:700;margin:0 0 12px;">${headline}</h3>` : ""}<table width="100%" cellpadding="0" cellspacing="0"><tr>${cellsHtml}</tr></table>${items.length > 4 ? `<p style="color:#9ca3af;font-size:12px;margin:8px 0 0;text-align:center;">+${items.length - 4} more</p>` : ""}</td></tr></table>`;
    }
    case "embed": {
      // Email-safe: static "View Content" link (iframes don't work in email)
      const url = (d.url as string) ?? (d.embedUrl as string) ?? "";
      const caption = (d.caption as string) ?? "";
      const bg = (d.bgColor as string) ?? "#f8fafc";
      const accent = "#189aa1";
      if (!url) return "";
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;padding:20px;margin:12px 0;"><tr><td>${caption ? `<p style="color:#0e1e2e;font-size:15px;font-weight:600;margin:0 0 10px;">${caption}</p>` : ""}<a href="${url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;">🔗 View Content</a><p style="color:#9ca3af;font-size:11px;margin:8px 0 0;">Interactive content — click to view in browser</p></td></tr></table>`;
    }
    case "countdown": {
      // Email-safe: static deadline text
      const headline = (d.headline as string) ?? "Limited Time Offer";
      const subtext = (d.subtext as string) ?? "";
      const deadlineLabel = (d.deadlineLabel as string) ?? "";
      const targetDate = (d.targetDate as string) ?? "";
      const bg = (d.bgColor as string) ?? "#fff7ed";
      const accent = (d.accentColor as string) ?? "#f59e0b";
      const textColor = (d.textColor as string) ?? "#92400e";
      let deadlineText = deadlineLabel || "";
      if (!deadlineText && targetDate) {
        try {
          const dt = new Date(targetDate);
          deadlineText = `Offer ends ${dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
        } catch { deadlineText = ""; }
      }
      return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border:2px solid ${accent};border-radius:8px;margin:16px 0;"><tr><td style="padding:24px;text-align:center;"><p style="color:${accent};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">⏰ Time-Sensitive</p><h3 style="color:${textColor};font-size:20px;font-weight:700;margin:0 0 8px;">${headline}</h3>${subtext ? `<p style="color:${textColor};font-size:14px;margin:0 0 8px;opacity:0.85;">${subtext}</p>` : ""}${deadlineText ? `<p style="color:${accent};font-size:14px;font-weight:600;margin:0;">${deadlineText}</p>` : ""}</td></tr></table>`;
    }
    case "ai_content": {
      const html = (d.html as string) ?? "";
      if (!html) return "";
      const bg = (d.bgColor as string) ?? "";
      const color = (d.textColor as string) ?? "#1a2e3b";
      const bgStyle = bg && bg !== "#ffffff" ? `background:${bg};` : "";
      return `<div style="${bgStyle}padding:8px 0;color:${color};font-size:15px;line-height:1.7;text-align:${align};">${html}</div>`;
    }
    default:
      return "";
  }
}

/**
 * Convert blocks to email HTML.
 * @param blocks - The blocks to convert
 * @param trackingPixelUrl - Optional tracking pixel URL to inject
 * @param standalone - When true (default), wraps output in a 900px outer table suitable for
 *   standalone preview. When false, returns raw inner HTML for use inside wrapInBrandedEmail.
 */
export function emailBlocksToHtml(blocks: Block[], trackingPixelUrl?: string, standalone = true): string {
  const innerHtml = blocks.map(emailBlockToHtml).filter(Boolean).join("\n");
  const pixel = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />`
    : "";
  if (!standalone) {
    // Raw inner HTML — caller (wrapInBrandedEmail) handles the outer container
    return innerHtml + pixel;
  }
  // Wrap in a 750px-wide centered outer table for standalone preview / plain send
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;margin:0;padding:0;">`,
    `  <tr><td align="center" valign="top" style="padding:20px 16px;">`,
    `    <!--[if mso]><table role="presentation" align="center" width="750" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->`,
    `    <table role="presentation" align="center" width="750" cellpadding="0" cellspacing="0" border="0" style="max-width:750px;width:100%;background:#ffffff;border-radius:8px;">`,
    `      <tr><td style="padding:0;">`,
    innerHtml,
    pixel,
    `      </td></tr>`,
    `    </table>`,
    `    <!--[if mso]></td></tr></table><![endif]-->`,
    `  </td></tr>`,
    `</table>`,
  ].join("\n");
}

// ─── Email Auto Block Settings ──────────────────────────────────────────────
// Dynamic settings editor for email-specific auto-content blocks.
// Supports two source modes: Manual (hand-entered) and Database (live data).
function EmailAutoBlockSettings({ block, onChange }: { block: Block; onChange: (data: Record<string, any>) => void }) {
  const d = block.data ?? {};
  const set = (key: string, value: any) => onChange({ ...d, [key]: value });
  const setMany = (patch: Record<string, any>) => onChange({ ...d, ...patch });

  // Fetch live data for all three block types at once (cached, shared)
  const { data: blockOptions, isLoading: optionsLoading, refetch } = trpc.emailCampaign.getEmailBlockOptions.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Source mode: 'manual' | 'database'
  const sourceMode = (d.sourceMode as string) ?? "manual";
  // View mode: 'list' | 'card'
  const viewMode = (d.viewMode as string) ?? "list";
  // Selected IDs (for database mode)
  const selectedIds = (d.selectedIds as number[]) ?? [];
  // Build a flat list of all available products from blockOptions for rendering resolution
  const allAvailableProducts = useMemo(() => [
    ...(blockOptions?.courses ?? []).map((p: any) => ({ id: p.id, title: p.title, price: p.price, imageUrl: p.coverImageUrl ?? "", link: `/courses/${p.slug}`, description: "" })),
    ...(blockOptions?.webinars ?? []).map((p: any) => ({ id: p.id, title: p.title, price: p.price, imageUrl: p.coverImageUrl ?? "", link: `/webinars/${p.slug}`, description: "" })),
    ...(blockOptions?.workshopInstances ?? []).map((p: any) => ({ id: p.id + 100000, title: p.workshopTitle ?? p.title, price: p.price ?? 0, imageUrl: p.workshopCoverImageUrl ?? "", link: `/workshops/${p.workshopSlug}`, description: "" })),
    ...(blockOptions?.bundles ?? []).map((p: any) => ({ id: p.id, title: p.title, price: p.price ?? 0, imageUrl: p.coverImage ?? "", link: `/bundles/${p.slug}`, description: "" })),
    ...(blockOptions?.downloads ?? []).map((p: any) => ({ id: p.id, title: p.title, price: p.price ?? 0, imageUrl: p.coverImageUrl ?? "", link: `/downloads/${p.slug}`, description: "" })),
    ...(blockOptions?.quizzes ?? []).map((p: any) => ({ id: p.id, title: p.title, price: 0, imageUrl: "", link: `/quizzes/${p.id}`, description: "" })),
  ], [blockOptions]);

  // Auto-resolve: when blockOptions loads and selectedIds exist but resolvedItems is empty, populate resolvedItems
  useEffect(() => {
    if (!blockOptions || allAvailableProducts.length === 0) return;
    const currentResolved = (d.resolvedItems as any[]) ?? [];
    if (selectedIds.length > 0 && currentResolved.length === 0) {
      const resolved = allAvailableProducts.filter((p: any) => selectedIds.includes(p.id));
      if (resolved.length > 0) {
        setMany({ resolvedItems: resolved, sourceMode: "database" });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockOptions, allAvailableProducts]);

  const toggleId = (id: number) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    // Resolve and save full product details so the renderer can display cards without an extra fetch
    const resolved = allAvailableProducts.filter((p: any) => next.includes(p.id));
    set("selectedIds", next);
    set("resolvedItems", resolved);
    set("sourceMode", "database");
  };

  // Shared color pickers
  const ColorPickers = () => (
    <div className="flex gap-2 pt-1">
      <div className="flex-1">
        <label className="text-xs font-medium text-gray-600 block mb-1">Background</label>
        <input type="color" className="w-full h-8 border rounded" value={(d.bgColor as string) ?? "#f0fafa"} onChange={e => set("bgColor", e.target.value)} />
      </div>
      <div className="flex-1">
        <label className="text-xs font-medium text-gray-600 block mb-1">Accent</label>
        <input type="color" className="w-full h-8 border rounded" value={(d.accentColor as string) ?? "#179ca3"} onChange={e => set("accentColor", e.target.value)} />
      </div>
    </div>
  );

  // Source toggle
  const SourceToggle = () => (
    <div className="flex rounded border border-gray-200 overflow-hidden mb-3">
      {(["manual", "database"] as const).map((mode) => (
        <button
          key={mode}
          className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
            sourceMode === mode ? "bg-teal-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
          }`}
          onClick={() => set("sourceMode", mode)}
        >
          {mode === "manual" ? "Manual" : "From Database"}
        </button>
      ))}
    </div>
  );

  // View mode toggle (for database mode)
  const ViewModeToggle = () => (
    <div className="mb-3">
      <label className="text-xs font-medium text-gray-600 block mb-1">View Mode</label>
      <div className="flex rounded border border-gray-200 overflow-hidden">
        {(["list", "card"] as const).map((mode) => (
          <button
            key={mode}
            className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
              viewMode === mode ? "bg-teal-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
            onClick={() => set("viewMode", mode)}
          >
            {mode === "list" ? "List" : "Card Grid"}
          </button>
        ))}
      </div>
    </div>
  );

  if (block.type === "included_items_auto") {
    const items = (d.items as { icon: string; title: string; text: string }[]) ?? [];
    return (
      <div className="space-y-3">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Membership Plans</p>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Headline</label>
          <input className="w-full h-8 text-xs border rounded px-2" value={(d.headline as string) ?? ""} onChange={e => set("headline", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Subtext</label>
          <input className="w-full h-8 text-xs border rounded px-2" value={(d.subtext as string) ?? ""} onChange={e => set("subtext", e.target.value)} />
        </div>
        <SourceToggle />
        {sourceMode === "database" ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Select Plans</label>
              <button onClick={() => refetch()} className="text-gray-400 hover:text-teal-600" title="Refresh"><RefreshCw size={11} /></button>
            </div>
            {optionsLoading ? (
              <p className="text-xs text-gray-400">Loading plans…</p>
            ) : !blockOptions?.membershipPlans?.length ? (
              <p className="text-xs text-gray-400">No published membership plans found.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2 bg-gray-50">
                {blockOptions.membershipPlans.map((plan) => (
                  <label key={plan.id} className="flex items-start gap-2 cursor-pointer hover:bg-white rounded p-1">
                    <input type="checkbox" className="mt-0.5" checked={selectedIds.includes(plan.id)} onChange={() => toggleId(plan.id)} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-tight">{plan.title}</p>
                      <p className="text-[10px] text-gray-400">${((plan.price ?? 0) / 100).toFixed(0)}/{plan.billingInterval} · {(plan.featureBullets as string[])?.length ?? 0} features</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <ViewModeToggle />
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Feature Items</label>
            {items.map((item, i) => (
              <div key={i} className="border rounded p-2 mb-2 space-y-1 bg-gray-50">
                <div className="flex gap-1">
                  <input className="w-10 h-7 text-xs border rounded px-1" value={item.icon} placeholder="emoji" onChange={e => { const next = [...items]; next[i] = { ...next[i], icon: e.target.value }; set("items", next); }} />
                  <input className="flex-1 h-7 text-xs border rounded px-2" value={item.title} placeholder="Title" onChange={e => { const next = [...items]; next[i] = { ...next[i], title: e.target.value }; set("items", next); }} />
                  <button className="text-red-400 hover:text-red-600 text-xs px-1" onClick={() => set("items", items.filter((_, j) => j !== i))}>✕</button>
                </div>
                <input className="w-full h-7 text-xs border rounded px-2" value={item.text} placeholder="Description" onChange={e => { const next = [...items]; next[i] = { ...next[i], text: e.target.value }; set("items", next); }} />
              </div>
            ))}
            <button className="text-xs text-teal-600 hover:text-teal-800 font-medium" onClick={() => set("items", [...items, { icon: "✅", title: "", text: "" }])}>+ Add Item</button>
          </div>
        )}
        <ColorPickers />
      </div>
    );
  }

  if (block.type === "cohort_sessions_auto") {
    const sessions = (d.sessions as { title: string; date: string; time: string; description: string }[]) ?? [];
    return (
      <div className="space-y-3">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Upcoming Cohort / Workshop Sessions</p>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Headline</label>
          <input className="w-full h-8 text-xs border rounded px-2" value={(d.headline as string) ?? ""} onChange={e => set("headline", e.target.value)} />
        </div>
        <SourceToggle />
        {sourceMode === "database" ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600">Cohort Groups</label>
                <button onClick={() => refetch()} className="text-gray-400 hover:text-teal-600" title="Refresh"><RefreshCw size={11} /></button>
              </div>
              {optionsLoading ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : !blockOptions?.cohortGroups?.length ? (
                <p className="text-xs text-gray-400">No upcoming open cohort groups found.</p>
              ) : (
                <div className="space-y-1 max-h-36 overflow-y-auto border rounded p-2 bg-gray-50">
                  {blockOptions.cohortGroups.map((cg) => (
                    <label key={`cg-${cg.id}`} className="flex items-start gap-2 cursor-pointer hover:bg-white rounded p-1">
                      <input type="checkbox" className="mt-0.5" checked={selectedIds.includes(cg.id)} onChange={() => toggleId(cg.id)} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 leading-tight">{cg.name}</p>
                        <p className="text-[10px] text-gray-400">{cg.courseTitle}{cg.startDate ? ` · ${new Date(cg.startDate).toLocaleDateString()}` : ""}{cg.location ? ` · ${cg.location}` : ""}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600">Workshop Instances</label>
              </div>
              {optionsLoading ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : !blockOptions?.workshopInstances?.length ? (
                <p className="text-xs text-gray-400">No upcoming workshop instances found.</p>
              ) : (
                <div className="space-y-1 max-h-36 overflow-y-auto border rounded p-2 bg-gray-50">
                  {blockOptions.workshopInstances.map((wi) => (
                    <label key={`wi-${wi.id}`} className="flex items-start gap-2 cursor-pointer hover:bg-white rounded p-1">
                      <input type="checkbox" className="mt-0.5" checked={selectedIds.includes(wi.id + 100000)} onChange={() => toggleId(wi.id + 100000)} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 leading-tight">{wi.workshopTitle} — {wi.title}</p>
                        <p className="text-[10px] text-gray-400">{new Date(wi.startDate).toLocaleDateString()}{wi.venueCity ? ` · ${wi.venueCity}` : ""}{wi.locationType === "virtual" ? " · Virtual" : ""}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <ViewModeToggle />
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Sessions</label>
            {sessions.map((s, i) => (
              <div key={i} className="border rounded p-2 mb-2 space-y-1 bg-gray-50">
                <div className="flex gap-1">
                  <input className="flex-1 h-7 text-xs border rounded px-2" value={s.title} placeholder="Session title" onChange={e => { const next = [...sessions]; next[i] = { ...next[i], title: e.target.value }; set("sessions", next); }} />
                  <button className="text-red-400 hover:text-red-600 text-xs px-1" onClick={() => set("sessions", sessions.filter((_, j) => j !== i))}>✕</button>
                </div>
                <div className="flex gap-1">
                  <input className="flex-1 h-7 text-xs border rounded px-2" value={s.date} placeholder="Date" onChange={e => { const next = [...sessions]; next[i] = { ...next[i], date: e.target.value }; set("sessions", next); }} />
                  <input className="flex-1 h-7 text-xs border rounded px-2" value={s.time} placeholder="Time" onChange={e => { const next = [...sessions]; next[i] = { ...next[i], time: e.target.value }; set("sessions", next); }} />
                </div>
                <input className="w-full h-7 text-xs border rounded px-2" value={s.description} placeholder="Description (optional)" onChange={e => { const next = [...sessions]; next[i] = { ...next[i], description: e.target.value }; set("sessions", next); }} />
              </div>
            ))}
            <button className="text-xs text-teal-600 hover:text-teal-800 font-medium" onClick={() => set("sessions", [...sessions, { title: "", date: "", time: "", description: "" }])}>+ Add Session</button>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">CTA Button Text</label>
          <input className="w-full h-8 text-xs border rounded px-2" value={(d.ctaText as string) ?? ""} onChange={e => set("ctaText", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">CTA Link</label>
          <input className="w-full h-8 text-xs border rounded px-2" value={(d.ctaLink as string) ?? ""} onChange={e => set("ctaLink", e.target.value)} />
        </div>
        <ColorPickers />
      </div>
    );
  }

  if (block.type === "related_products") {
    const products = (d.products as { title: string; description: string; price: string; imageUrl: string; link: string }[]) ?? [];
    return (
      <div className="space-y-3">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Related Products / Bundles</p>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Headline</label>
          <input className="w-full h-8 text-xs border rounded px-2" value={(d.headline as string) ?? ""} onChange={e => set("headline", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Subtext</label>
          <input className="w-full h-8 text-xs border rounded px-2" value={(d.subtext as string) ?? ""} onChange={e => set("subtext", e.target.value)} />
        </div>
        <SourceToggle />
        {sourceMode === "database" ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Select Products</label>
              <button onClick={() => refetch()} className="text-gray-400 hover:text-teal-600" title="Refresh"><RefreshCw size={11} /></button>
            </div>
            {optionsLoading ? (
              <p className="text-xs text-gray-400">Loading products…</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto border rounded p-2 bg-gray-50">
                {[
                  ...(blockOptions?.courses ?? []).map((p: any) => ({ ...p, _type: "Course" })),
                  ...(blockOptions?.webinars ?? []).map((p: any) => ({ ...p, _type: "Webinar" })),
                  ...(blockOptions?.workshopInstances ?? []).map((p: any) => ({ ...p, title: p.workshopTitle ?? p.title, _type: "Workshop" })),
                  ...(blockOptions?.bundles ?? []).map((p: any) => ({ ...p, _type: "Bundle" })),
                  ...(blockOptions?.downloads ?? []).map((p: any) => ({ ...p, _type: "Download" })),
                  ...(blockOptions?.quizzes ?? []).map((p: any) => ({ ...p, _type: "Quiz" })),
                ].map((p: any) => (
                  <label key={`${p._type}-${p.id}`} className="flex items-start gap-2 cursor-pointer hover:bg-white rounded p-1">
                    <input type="checkbox" className="mt-0.5" checked={selectedIds.includes(p.id)} onChange={() => toggleId(p.id)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-teal-100 text-teal-700 uppercase">{p._type}</span>
                        <p className="text-xs font-medium text-gray-800 leading-tight truncate">{p.title}</p>
                      </div>
                      {p.price != null && p.price > 0 && <p className="text-[10px] text-gray-400">${Number(p.price).toFixed(2)}</p>}
                    </div>
                  </label>
                ))}
                {!blockOptions?.courses?.length && !blockOptions?.webinars?.length && !blockOptions?.bundles?.length && (
                  <p className="text-xs text-gray-400">No published products found.</p>
                )}
              </div>
            )}
            <ViewModeToggle />
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">CTA Button Text</label>
            <input className="w-full h-8 text-xs border rounded px-2" value={(d.ctaText as string) ?? ""} onChange={e => set("ctaText", e.target.value)} />
            <label className="text-xs font-medium text-gray-600 block mb-1 mt-2">Products</label>
            {products.map((p, i) => (
              <div key={i} className="border rounded p-2 mb-2 space-y-1 bg-gray-50">
                <div className="flex gap-1">
                  <input className="flex-1 h-7 text-xs border rounded px-2" value={p.title} placeholder="Product title" onChange={e => { const next = [...products]; next[i] = { ...next[i], title: e.target.value }; set("products", next); }} />
                  <button className="text-red-400 hover:text-red-600 text-xs px-1" onClick={() => set("products", products.filter((_, j) => j !== i))}>✕</button>
                </div>
                <input className="w-full h-7 text-xs border rounded px-2" value={p.description} placeholder="Description" onChange={e => { const next = [...products]; next[i] = { ...next[i], description: e.target.value }; set("products", next); }} />
                <div className="flex gap-1">
                  <input className="flex-1 h-7 text-xs border rounded px-2" value={p.price} placeholder="Price (e.g. $99)" onChange={e => { const next = [...products]; next[i] = { ...next[i], price: e.target.value }; set("products", next); }} />
                  <input className="flex-1 h-7 text-xs border rounded px-2" value={p.link} placeholder="URL" onChange={e => { const next = [...products]; next[i] = { ...next[i], link: e.target.value }; set("products", next); }} />
                </div>
                <input className="w-full h-7 text-xs border rounded px-2" value={p.imageUrl} placeholder="Image URL (optional)" onChange={e => { const next = [...products]; next[i] = { ...next[i], imageUrl: e.target.value }; set("products", next); }} />
              </div>
            ))}
            <button className="text-xs text-teal-600 hover:text-teal-800 font-medium" onClick={() => set("products", [...products, { title: "", description: "", price: "", imageUrl: "", link: "https://" }])}>+ Add Product</button>
          </div>
        )}
        <ColorPickers />
      </div>
    );
  }

  return null;
}

// ─── Default block factory ────────────────────────────────────────────────────
function defaultBlock(type: BlockType): Block {
  const catalog = EMAIL_BLOCK_CATALOG.find((b) => b.type === type);
  return {
    id: uid(),
    type,
    data: catalog?.defaultData ?? {},
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
interface EmailBlockEditorProps {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  /** Internal: called once on mount so the outer wrapper can forward template inserts */
  _registerInsert?: (fn: (block: Block) => void) => void;
}

function EmailBlockEditorInner({ initialBlocks, onChange, _registerInsert }: EmailBlockEditorProps) {
  const { saveAsTemplate } = useBlockTemplateLibrary();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  // AI block regeneration state
  const [aiBlockId, setAiBlockId] = useState<string | null>(null);
  const [aiBlockInstruction, setAiBlockInstruction] = useState("");
  const [aiBlockTone, setAiBlockTone] = useState<"professional" | "enthusiastic" | "educational" | "urgent" | "friendly">("professional");
  const [aiBlockGenerateImage, setAiBlockGenerateImage] = useState(false);
  const [aiBlockIncludeEmoji, setAiBlockIncludeEmoji] = useState(false);
  // Replace image state
  const [replaceImageBlockId, setReplaceImageBlockId] = useState<string | null>(null);
  const [replaceImagePrompt, setReplaceImagePrompt] = useState("");
  const [replaceImageTone, setReplaceImageTone] = useState<"professional" | "enthusiastic" | "educational" | "urgent" | "friendly">("professional");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(EMAIL_CATALOG_CATEGORIES));
  const [rightPanelWidth, setRightPanelWidth] = useState(typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.65) : 650);
  const rightPanelDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Scroll settings panel to top whenever a new block is selected
  useEffect(() => {
    if (selectedId && rightPanelRef.current) {
      rightPanelRef.current.scrollTop = 0;
    }
  }, [selectedId]);

  // Sync initialBlocks when parent re-fetches (e.g. loading a draft)
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && initialBlocks.length > 0) {
      setBlocks(initialBlocks);
      initialized.current = true;
    }
  }, [initialBlocks]);

  // Notify parent whenever blocks change
  useEffect(() => {
    onChange(blocks);
  }, [blocks, onChange]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const oldIdx = prev.findIndex((b) => b.id === active.id);
        const newIdx = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const addBlock = (type: BlockType) => {
    const block = defaultBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
    setCatalogOpen(false);
  };

  // Register the template-insert handler with the outer wrapper once on mount
  useEffect(() => {
    _registerInsert?.((block) => {
      setBlocks((prev) => [...prev, block]);
      setSelectedId(block.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBlock = useCallback((id: string, data: Record<string, unknown>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b))
    );
  }, []);

  const aiBlockMutation = trpc.emailCampaign.generateEmailBlock.useMutation({
    onSuccess: (res, vars) => {
      const blockId = (res as any).blockId ?? vars.blockId;
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;
      const updates: Record<string, any> = {};
      if (block.type === "button") {
        updates.text = res.html;
      } else {
        updates.html = res.html;
      }
      if ((res as any).imageUrl) {
        updates.aiImageUrl = (res as any).imageUrl;
      }
      updateBlock(blockId, updates);
      setAiBlockId(null);
      setAiBlockInstruction("");
      setAiBlockGenerateImage(false);
      setAiBlockIncludeEmoji(false);
      toast.success("Block regenerated!" + ((res as any).imageUrl ? " Image added." : ""));
    },
    onError: (e) => toast.error("AI failed: " + e.message),
  });
  const replaceImageMutation = trpc.emailCampaign.generateEmailBlock.useMutation({
    onSuccess: (res) => {
      const blockId = (res as any).blockId ?? replaceImageBlockId;
      if (blockId && (res as any).imageUrl) {
        updateBlock(blockId, { aiImageUrl: (res as any).imageUrl });
        toast.success("Image replaced!");
      } else if (blockId) {
        toast.error("No image was generated. Try a more descriptive prompt.");
      }
      setReplaceImageBlockId(null);
      setReplaceImagePrompt("");
    },
    onError: (e) => toast.error("Image generation failed: " + e.message),
  });
  const deleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const newBlock = { ...block, id: uid() };
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setSelectedId(newBlock.id);
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (dir === "up" && idx === 0) return prev;
      if (dir === "down" && idx === prev.length - 1) return prev;
      return arrayMove(prev, idx, dir === "up" ? idx - 1 : idx + 1);
    });
  };

  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    rightPanelDragRef.current = { startX: e.clientX, startWidth: rightPanelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!rightPanelDragRef.current) return;
      const delta = rightPanelDragRef.current.startX - ev.clientX;
      const newWidth = Math.min(Math.round(window.innerWidth * 0.92), Math.max(300, rightPanelDragRef.current.startWidth + delta));
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

  const filteredCatalog = EMAIL_BLOCK_CATALOG.filter(
    (b) =>
      !catalogSearch ||
      b.label.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      b.category.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const grouped = EMAIL_CATALOG_CATEGORIES.map((cat) => ({
    cat,
    items: filteredCatalog.filter((b) => b.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex" style={{ minHeight: 500, height: '100%' }}>
      {/* Block catalog popup dialog */}
      <Dialog open={catalogOpen} onOpenChange={(open) => { setCatalogOpen(open); if (!open) setCatalogSearch(""); }}>
        <DialogContent className="max-w-2xl w-full p-0 overflow-hidden" style={{ maxHeight: "80vh" }}>
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-gray-200">
            <DialogTitle className="text-sm font-semibold">Add Block</DialogTitle>
          </DialogHeader>
          <div className="px-4 py-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search blocks…"
                className="pl-7 h-8 text-xs"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto p-3" style={{ maxHeight: "calc(80vh - 130px)" }}>
            {grouped.map(({ cat, items }) => (
              <div key={cat} className="mb-3">
                <button
                  className="flex items-center gap-1 w-full text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 py-1 hover:text-gray-700"
                  onClick={() =>
                    setOpenCategories((prev) => {
                      const next = new Set(prev);
                      next.has(cat) ? next.delete(cat) : next.add(cat);
                      return next;
                    })
                  }
                >
                  {openCategories.has(cat) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {cat}
                </button>
                {openCategories.has(cat) && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1 ml-1">
                    {items.map((b) => (
                      <button
                        key={b.type}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 text-gray-600 hover:text-teal-700 transition-all text-center"
                        onClick={() => { addBlock(b.type); setCatalogOpen(false); setCatalogSearch(""); }}
                      >
                        <span className="text-teal-600 text-xl">{b.icon}</span>
                        <span className="text-xs leading-tight font-medium">{b.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {/* Canvas */}
      <div
        className="flex-1 overflow-y-auto bg-gray-100 p-4"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
        onClick={(e) => {
          // Only deselect if clicking directly on the canvas background, not on a child block
          const target = e.target as HTMLElement;
          if (target === e.currentTarget || target.classList.contains('email-canvas-bg')) setSelectedId(null);
        }}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setCatalogOpen((v) => !v)}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Block
          </Button>
          <OpenTemplateLibraryButton />
          <span className="text-xs text-gray-400 ml-auto">
            {blocks.length} block{blocks.length !== 1 ? "s" : ""}
          </span>
        </div>

        {blocks.length === 0 ? (
          <div
            className="email-canvas-bg flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 cursor-pointer hover:border-teal-400 hover:text-teal-500 transition-colors"
            onClick={() => setCatalogOpen(true)}
          >
            <Plus className="w-8 h-8 mb-2" />
            <p className="text-sm font-medium">Click to add your first block</p>
            <p className="text-xs mt-1 opacity-70">Drag and drop to reorder</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map((block, idx) => (
                <div key={block.id} className="relative group/aiblock">
                  <SortableBlock
                    block={block}
                    isSelected={selectedId === block.id}
                    onSelect={() => setSelectedId(block.id)}
                    onDelete={() => deleteBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onMoveUp={idx > 0 ? () => moveBlock(block.id, "up") : undefined}
                    onMoveDown={idx < blocks.length - 1 ? () => moveBlock(block.id, "down") : undefined}
                    onSaveAsTemplate={(b) => saveAsTemplate(b)}
                    activeDragId={null}
                    activeColumnTarget={null}
                    onMoveBlockOutOfColumn={() => {}}
                    onAddBlockToColumn={() => {}}
                    onMoveChildToOtherColumn={() => {}}
                    onDeleteChildFromColumn={() => {}}
                    onReorderChildInColumn={() => {}}
                  />
                  {["heading", "text", "button", "quote"].includes(block.type) && (
                    <button
                      onClick={e => { e.stopPropagation(); setAiBlockId(block.id); setAiBlockInstruction(""); }}
                      className="absolute bottom-2 right-2 z-20 w-7 h-7 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover/aiblock:opacity-100 transition-opacity"
                      title="AI Regenerate this block"
                    >
                      <Wand2 size={12} />
                    </button>
                  )}
                  {/* AI-generated image preview with independent remove button */}
                  {block.data?.aiImageUrl && (
                    <div className="relative mt-1 mx-2 mb-2 rounded-lg overflow-hidden border border-teal-200 group/aiimg">
                      <img src={block.data.aiImageUrl as string} alt="AI generated" className="w-full max-h-48 object-cover block" />
                      <div className="absolute inset-0 bg-black/0 group-hover/aiimg:bg-black/20 transition-colors" />
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/aiimg:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); setReplaceImageBlockId(block.id); setReplaceImagePrompt(""); }}
                          className="w-6 h-6 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-md"
                          title="Replace AI image with a new one (text preserved)"
                        >
                          <RotateCcw size={10} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); updateBlock(block.id, { aiImageUrl: null }); }}
                          className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
                          title="Remove AI image (text content is preserved)"
                        >
                          <ImageOff size={10} />
                        </button>
                      </div>
                      <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded opacity-0 group-hover/aiimg:opacity-100 transition-opacity">AI Image</span>
                    </div>
                  )}
                </div>
              ))}
            </SortableContext>
          </DndContext>
        )}

        {/* Bottom Add Block button */}
        {blocks.length > 0 && (
          <div className="flex justify-center mt-4 pb-2">
            <Button
              size="sm"
              variant="outline"
              className="border-dashed border-teal-400 text-teal-600 hover:bg-teal-50 hover:border-teal-500"
              onClick={() => setCatalogOpen((v) => !v)}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Block
            </Button>
          </div>
        )}
      </div>

      {/* Right panel — block settings (sticky, scrolls independently) */}
      {selectedBlock && (
        <>
          <div
            className="w-1 cursor-col-resize bg-gray-200 hover:bg-teal-400 transition-colors shrink-0"
            onMouseDown={handleRightPanelMouseDown}
          />
          <div
            ref={rightPanelRef}
            className="border-l border-gray-200 bg-white shrink-0"
            style={{ width: rightPanelWidth, position: 'sticky', top: 0, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', alignSelf: 'flex-start' }}
          >
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Block Settings
              </span>
              <button
                className="text-gray-400 hover:text-gray-700 text-xs"
                onClick={() => setSelectedId(null)}
              >
                ✕
              </button>
            </div>
            <div className="p-3">
              {/* For email-specific auto-content blocks, use a simple inline editor
                  instead of BlockSettings (which requires tRPC course/lesson context) */}
              {["included_items_auto", "cohort_sessions_auto", "related_products"].includes(selectedBlock.type) ? (
                <EmailAutoBlockSettings
                  block={selectedBlock}
                  onChange={(data) => updateBlock(selectedBlock.id, data)}
                />
              ) : (
                <BlockSettings
                  block={selectedBlock}
                  onChange={(data) => updateBlock(selectedBlock.id, data)}
                  emailMode={selectedBlock.type === "ai_content"}
              />
            )}
          </div>
        </div>
      </>
    )}

      {/* Replace Image Panel */}
      {replaceImageBlockId && (() => {
        const block = blocks.find(b => b.id === replaceImageBlockId);
        if (!block) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReplaceImageBlockId(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-teal-600" />
                  Replace Block Image
                </h3>
                <button onClick={() => setReplaceImageBlockId(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              </div>
              {block.data?.aiImageUrl && (
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <img src={block.data.aiImageUrl as string} alt="Current" className="w-full max-h-24 object-cover block" />
                  <p className="text-[10px] text-gray-400 text-center py-1">Current image</p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Image Description <span className="text-red-400">*</span></label>
                <textarea
                  autoFocus
                  value={replaceImagePrompt}
                  onChange={e => setReplaceImagePrompt(e.target.value)}
                  placeholder="Describe the image you want, e.g. a cardiac sonographer performing an echocardiogram in a modern hospital, teal color palette"
                  rows={3}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Style Tone</label>
                <select value={replaceImageTone} onChange={e => setReplaceImageTone(e.target.value as any)} className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm bg-white">
                  <option value="professional">Professional / Clinical</option>
                  <option value="educational">Educational / Informative</option>
                  <option value="enthusiastic">Modern / Dynamic</option>
                  <option value="friendly">Warm / Approachable</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setReplaceImageBlockId(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button
                  disabled={!replaceImagePrompt.trim() || replaceImageMutation.isPending}
                  onClick={() => replaceImageMutation.mutate({ blockId: replaceImageBlockId, blockType: block.type as any, instruction: replaceImagePrompt, tone: replaceImageTone, generateBlockImage: true })}
                  className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {replaceImageMutation.isPending ? <><RefreshCw className="w-3 h-3 animate-spin" />Generating...</> : <><RotateCcw className="w-3 h-3" />Replace Image</>}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 text-right">Text content is never affected.</p>
            </div>
          </div>
        );
      })()}

      {/* AI Block Regeneration Panel */}
      {aiBlockId && (() => {
        const block = blocks.find(b => b.id === aiBlockId);
        if (!block) return null;
        const blockTypeLabel: Record<string, string> = { heading: "Heading", text: "Text", button: "Button", quote: "Quote" };
        const currentContent = block.type === "button" ? (block.data?.text ?? "") : (block.data?.html ?? "");
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAiBlockId(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-teal-600" />
                  AI Regenerate — {blockTypeLabel[block.type] ?? block.type} Block
                </h3>
                <button onClick={() => setAiBlockId(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              </div>
              {currentContent && (
                <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-500 max-h-20 overflow-y-auto">
                  <span className="font-medium text-gray-600">Current: </span>
                  <span dangerouslySetInnerHTML={{ __html: currentContent }} />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Instruction <span className="text-red-400">*</span></label>
                <textarea
                  autoFocus
                  value={aiBlockInstruction}
                  onChange={e => setAiBlockInstruction(e.target.value)}
                  placeholder={block.type === "heading" ? "e.g. Make it more compelling, focus on CME credits" : block.type === "button" ? "e.g. More urgent CTA for course enrollment" : "e.g. Rewrite to emphasize the clinical benefits, add bullet points"}
                  rows={3}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Tone</label>
                <select value={aiBlockTone} onChange={e => setAiBlockTone(e.target.value as any)} className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm bg-white">
                  <option value="professional">Professional</option>
                  <option value="educational">Educational</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="friendly">Friendly</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              {["text", "heading"].includes(block.type) && (
                <div className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg">
                  <input type="checkbox" id="ai-block-gen-image" checked={aiBlockGenerateImage} onChange={e => setAiBlockGenerateImage(e.target.checked)} className="rounded" />
                  <label htmlFor="ai-block-gen-image" className="flex-1 text-xs text-gray-700 cursor-pointer">
                    <span className="font-medium flex items-center gap-1.5"><ImageIcon className="w-3 h-3 text-teal-600" /> Also generate a block image</span>
                    <span className="text-[10px] text-gray-400 block">AI creates a relevant image saved separately — remove anytime without affecting text</span>
                  </label>
                </div>
              )}
              {["text", "heading"].includes(block.type) && (
                <div className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg">
                  <input type="checkbox" id="ai-block-emoji" checked={aiBlockIncludeEmoji} onChange={e => setAiBlockIncludeEmoji(e.target.checked)} className="rounded" />
                  <label htmlFor="ai-block-emoji" className="flex-1 text-xs text-gray-700 cursor-pointer">
                    <span className="font-medium flex items-center gap-1">😊 Include emojis</span>
                    <span className="text-[10px] text-gray-400 block">AI adds 1-2 emojis inline within the text</span>
                  </label>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAiBlockId(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button
                  disabled={!aiBlockInstruction.trim() || aiBlockMutation.isPending}
                  onClick={() => aiBlockMutation.mutate({ blockId: aiBlockId, blockType: block.type as any, currentHtml: currentContent || undefined, instruction: aiBlockInstruction, tone: aiBlockTone, generateBlockImage: aiBlockGenerateImage, includeEmoji: aiBlockIncludeEmoji })}
                  className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {aiBlockMutation.isPending ? <><RefreshCw className="w-3 h-3 animate-spin" />Generating...</> : <><Sparkles className="w-3 h-3" />Regenerate</>}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 text-right">Tip: Cmd+Enter to generate</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * EmailBlockEditor — public export.
 * Wraps the inner editor with BlockTemplateLibraryProvider so the
 * "Templates" toolbar button and per-block "Save as template" bookmark
 * button both work without any extra setup in the parent.
 */
export default function EmailBlockEditor(props: EmailBlockEditorProps) {
  // insertRef lets the provider's onInsert reach the inner component's
  // addBlock function without prop-drilling through the provider.
  const insertRef = useRef<((block: Block) => void) | null>(null);
  return (
    <BlockTemplateLibraryProvider onInsert={(block) => insertRef.current?.(block)}>
      <EmailBlockEditorInner
        {...props}
        // Pass the ref setter so the inner component can register itself
        _registerInsert={(fn) => { insertRef.current = fn; }}
      />
    </BlockTemplateLibraryProvider>
  );
}
