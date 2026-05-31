/**
 * EmailCampaignEditor — Full-page email campaign builder
 *
 * Features:
 *  - Block-based email builder (text, heading, image, button, divider, spacer, quote)
 *  - Live HTML preview (desktop/mobile toggle)
 *  - Advanced audience filter builder (course, quiz, product, download, cohort, team, form, interests)
 *  - Sender profile selector
 *  - Save draft / send now / schedule
 *  - Save as template / load from template
 *  - Automatic unsubscribe footer injected on send
 */
import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Eye, EyeOff, Send, Save, Clock, Plus, Trash2,
  Type, Image, Square, Minus, AlignLeft, Quote, Users, Mail,
  Monitor, Smartphone, ChevronDown, ChevronUp, Check, RefreshCw,
  Copy, Heading1, Heading2, LayoutTemplate, X, UserCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Block types ──────────────────────────────────────────────────────────────
type BlockType = "heading1" | "heading2" | "text" | "image" | "button" | "divider" | "spacer" | "quote" | "html" | "lead_capture";

interface Block {
  id: string;
  type: BlockType;
  content: string;
  // button-specific
  buttonUrl?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  // image-specific
  imageAlt?: string;
  imageWidth?: string;
  // spacer-specific
  spacerHeight?: number;
  // alignment
  align?: "left" | "center" | "right";
  // per-block styling
  textColor?: string;
  bgColor?: string;
  fontSize?: number;        // px
  fontWeight?: "normal" | "bold";
  paddingTop?: number;      // px
  paddingBottom?: number;   // px
  paddingLeft?: number;     // px
  paddingRight?: number;    // px
  borderRadius?: number;    // px
  lineHeight?: number;      // e.g. 1.5
  // lead_capture-specific
  leadCaptureTitle?: string;
  leadCapturePlaceholder?: string;
  leadCaptureButtonText?: string;
  leadCaptureButtonColor?: string;
  leadCaptureButtonTextColor?: string;
  leadCaptureListId?: number | null;
  leadCaptureShowName?: boolean;
}

const BLOCK_CATALOG: { type: BlockType; icon: React.ReactNode; label: string }[] = [
  { type: "lead_capture", icon: <Mail className="w-4 h-4" />, label: "Lead Capture" },
  { type: "heading1", icon: <Heading1 className="w-4 h-4" />, label: "Heading 1" },
  { type: "heading2", icon: <Heading2 className="w-4 h-4" />, label: "Heading 2" },
  { type: "text", icon: <AlignLeft className="w-4 h-4" />, label: "Text" },
  { type: "quote", icon: <Quote className="w-4 h-4" />, label: "Quote" },
  { type: "button", icon: <Square className="w-4 h-4" />, label: "Button" },
  { type: "image", icon: <Image className="w-4 h-4" />, label: "Image" },
  { type: "divider", icon: <Minus className="w-4 h-4" />, label: "Divider" },
  { type: "spacer", icon: <Type className="w-4 h-4" />, label: "Spacer" },
  { type: "html", icon: <AlignLeft className="w-4 h-4" />, label: "Raw HTML" },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultBlock(type: BlockType): Block {
  const base = { id: uid(), type, content: "", align: "left" as const };
  switch (type) {
    case "heading1": return { ...base, content: "Your Heading Here", align: "left" };
    case "heading2": return { ...base, content: "Sub-heading", align: "left" };
    case "text": return { ...base, content: "Write your email content here. Keep it concise and engaging." };
    case "quote": return { ...base, content: "A powerful quote or highlight from your message." };
    case "button": return { ...base, content: "Click Here", buttonUrl: "https://", buttonColor: "#189aa1", buttonTextColor: "#ffffff", align: "center" };
    case "image": return { ...base, content: "", imageAlt: "", imageWidth: "100%" };
    case "divider": return { ...base, content: "" };
    case "spacer": return { ...base, content: "", spacerHeight: 24 };
    case "html": return { ...base, content: "<p>Custom HTML here</p>" };
    case "lead_capture": return { ...base, content: "", leadCaptureTitle: "Stay in the loop", leadCapturePlaceholder: "Enter your email", leadCaptureButtonText: "Subscribe", leadCaptureButtonColor: "#189aa1", leadCaptureButtonTextColor: "#ffffff", leadCaptureShowName: false, leadCaptureListId: null, align: "center" };
    default: return base;
  }
}

// ─── Block → HTML renderer ────────────────────────────────────────────────────
function blockToHtml(block: Block): string {
  const align = block.align ?? "left";
  const pt = block.paddingTop ?? 0;
  const pb = block.paddingBottom ?? 0;
  const pl = block.paddingLeft ?? 0;
  const pr = block.paddingRight ?? 0;
  const hasPadding = pt || pb || pl || pr;
  const paddingStyle = hasPadding ? `padding:${pt}px ${pr}px ${pb}px ${pl}px;` : "";
  const bgStyle = block.bgColor ? `background:${block.bgColor};` : "";
  const brStyle = block.borderRadius ? `border-radius:${block.borderRadius}px;` : "";
  const wrapStyle = (bgStyle || paddingStyle || brStyle) ? `style="${bgStyle}${paddingStyle}${brStyle}"` : "";
  const wrap = (inner: string) => wrapStyle ? `<div ${wrapStyle}>${inner}</div>` : inner;

  switch (block.type) {
    case "heading1": {
      const color = block.textColor || "#0e1e2e";
      const size = block.fontSize || 28;
      const weight = block.fontWeight === "normal" ? 400 : 900;
      const lh = block.lineHeight || 1.2;
      return wrap(`<h1 style="font-family:Merriweather,Georgia,serif;color:${color};font-size:${size}px;font-weight:${weight};line-height:${lh};margin:0 0 16px;text-align:${align};">${block.content}</h1>`);
    }
    case "heading2": {
      const color = block.textColor || "#0e1e2e";
      const size = block.fontSize || 20;
      const weight = block.fontWeight === "normal" ? 400 : 700;
      const lh = block.lineHeight || 1.3;
      return wrap(`<h2 style="font-family:Merriweather,Georgia,serif;color:${color};font-size:${size}px;font-weight:${weight};line-height:${lh};margin:0 0 12px;text-align:${align};">${block.content}</h2>`);
    }
    case "text": {
      const color = block.textColor || "#1a2e3b";
      const size = block.fontSize || 15;
      const weight = block.fontWeight === "bold" ? 700 : 400;
      const lh = block.lineHeight || 1.7;
      return wrap(`<p style="color:${color};font-size:${size}px;font-weight:${weight};line-height:${lh};margin:0 0 16px;text-align:${align};">${block.content.replace(/\n/g, "<br/>")}</p>`);
    }
    case "quote": {
      const color = block.textColor || "#0e4a50";
      const size = block.fontSize || 15;
      const bg = block.bgColor || "#f0fbfc";
      return `<blockquote style="border-left:4px solid #189aa1;margin:16px 0;padding:12px 20px;background:${bg};border-radius:0 8px 8px 0;"><p style="color:${color};font-size:${size}px;font-style:italic;margin:0;">${block.content}</p></blockquote>`;
    }
    case "button": {
      const btnBg = block.buttonColor || "#189aa1";
      const btnText = block.buttonTextColor || "#ffffff";
      const btnSize = block.fontSize || 15;
      const btnBr = block.borderRadius ?? 8;
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td align="${align}"><a href="${block.buttonUrl || "#"}" style="display:inline-block;background:${btnBg};color:${btnText};text-decoration:none;padding:14px 28px;border-radius:${btnBr}px;font-weight:700;font-size:${btnSize}px;">${block.content}</a></td></tr></table>`;
    }
    case "image":
      return block.content ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td align="${align}"><img src="${block.content}" alt="${block.imageAlt || ""}" width="${block.imageWidth || "100%"}" style="max-width:100%;border-radius:${block.borderRadius ?? 8}px;display:block;" /></td></tr></table>` : "";
    case "divider":
      return `<hr style="border:none;border-top:1px solid #e5eaec;margin:20px 0;" />`;
    case "spacer":
      return `<div style="height:${block.spacerHeight || 24}px;"></div>`;
    case "html":
      return block.content;
    case "lead_capture": {
      const title = block.leadCaptureTitle || "Stay in the loop";
      const placeholder = block.leadCapturePlaceholder || "Enter your email";
      const btnText = block.leadCaptureButtonText || "Subscribe";
      const btnBg = block.leadCaptureButtonColor || "#189aa1";
      const btnColor = block.leadCaptureButtonTextColor || "#ffffff";
      const showName = block.leadCaptureShowName;
      const bg = block.bgColor || "#f0fbfc";
      const br = block.borderRadius ?? 8;
      const nameField = showName ? `<tr><td style="padding-bottom:8px;"><input type="text" name="name" placeholder="Your name" style="width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;" /></td></tr>` : "";
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td align="${align}"><table cellpadding="0" cellspacing="0" style="background:${bg};border-radius:${br}px;padding:24px;max-width:480px;width:100%;margin:0 auto;"><tr><td style="padding-bottom:12px;text-align:center;"><strong style="font-size:18px;color:#0e1e2e;">${title}</strong></td></tr>${nameField}<tr><td style="padding-bottom:8px;"><input type="email" name="email" placeholder="${placeholder}" style="width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;" /></td></tr><tr><td style="text-align:center;"><a href="#" style="display:inline-block;background:${btnBg};color:${btnColor};text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;font-size:14px;">${btnText}</a></td></tr></table></td></tr></table>`;
    }
    default:
      return "";
  }
}

function blocksToHtml(blocks: Block[]): string {
  return blocks.map(blockToHtml).join("\n");
}

// ─── Branded email wrapper ────────────────────────────────────────────────────
function wrapInBrandedEmail(bodyHtml: string, previewText?: string): string {
  const preview = previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>All About Ultrasound™</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f8;font-family:'Open Sans',Arial,sans-serif;">
${preview}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#0e1e2e 0%,#0e4a50 60%,#189aa1 100%);padding:28px 32px;">
          <span style="font-family:Merriweather,Georgia,serif;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">All About Ultrasound™</span>
          <div style="font-size:11px;color:#4ad9e0;font-weight:600;margin-top:2px;letter-spacing:0.5px;">ECHOCARDIOGRAPHY CLINICAL COMPANION</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;color:#1a2e3b;font-size:15px;line-height:1.7;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="background:#f4f7f8;padding:20px 32px;border-top:1px solid #e5eaec;">
          <p style="margin:0;font-size:11px;color:#8a9bb0;text-align:center;line-height:1.6;">
            © ${new Date().getFullYear()} All About Ultrasound™<br/>
            You are receiving this email because you have an account on All About Ultrasound™.<br/>
            <a href="{{UNSUBSCRIBE_URL}}" style="color:#189aa1;text-decoration:none;">Unsubscribe</a> · <a href="https://app.allaboutultrasound.com/profile" style="color:#189aa1;text-decoration:none;">Manage preferences</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Audience filter types ────────────────────────────────────────────────────
type InterestKey = "acs" | "adultEcho" | "pediatricEcho" | "fetalEcho" | "pocus";

const INTEREST_OPTIONS: { key: InterestKey; label: string }[] = [
  { key: "acs", label: "ACS" },
  { key: "adultEcho", label: "Adult Echo" },
  { key: "pediatricEcho", label: "Pediatric Echo" },
  { key: "fetalEcho", label: "Fetal Echo" },
  { key: "pocus", label: "POCUS" },
];

// ─── Lead Capture List Selector ─────────────────────────────────────────────
function LeadCaptureListSelector({ listId, onChange }: { listId: number | null; onChange: (id: number | null) => void }) {
  const { data: lists } = trpc.emailCampaign.listEmailLists.useQuery();
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">Subscribe to Email List</label>
      <Select
        value={listId != null ? String(listId) : "none"}
        onValueChange={(v) => onChange(v === "none" ? null : Number(v))}
      >
        <SelectTrigger className="text-sm">
          <SelectValue placeholder="Select a list (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None — don't subscribe</SelectItem>
          {(lists ?? []).map((l) => (
            <SelectItem key={l.id} value={String(l.id)}>{l.name} ({l.subscriberCount ?? 0})</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-gray-400 mt-1">Subscribers who click this form will be added to the selected list.</p>
    </div>
  );
}

// ─── Block editor component ───────────────────────────────────────────────────
function BlockEditor({ blocks, onChange }: { blocks: Block[]; onChange: (b: Block[]) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  function addBlock(type: BlockType) {
    const nb = defaultBlock(type);
    onChange([...blocks, nb]);
    setSelectedId(nb.id);
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    onChange(blocks.map((b) => b.id === id ? { ...b, ...patch } : b));
  }

  function removeBlock(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const arr = [...blocks];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onChange(arr);
  }

  function duplicateBlock(id: string) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const copy = { ...blocks[idx], id: uid() };
    const arr = [...blocks];
    arr.splice(idx + 1, 0, copy);
    onChange(arr);
    setSelectedId(copy.id);
  }

  return (
    <div className="flex gap-4">
      {/* Block list */}
      <div className="flex-1 space-y-2">
        {blocks.length === 0 && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
            Add blocks from the panel on the right to start building your email
          </div>
        )}
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            onClick={() => setSelectedId(block.id)}
            className={`group relative border rounded-lg p-3 cursor-pointer transition-all ${selectedId === block.id ? "border-[#189aa1] bg-[#f0fbfc]" : "border-gray-200 hover:border-gray-300 bg-white"}`}
          >
            {/* Block preview */}
            <div className="text-sm text-gray-700 truncate">
              {block.type === "divider" && <hr className="border-gray-300" />}
              {block.type === "spacer" && <div className="text-gray-400 text-xs">Spacer ({block.spacerHeight || 24}px)</div>}
              {block.type === "image" && (block.content ? <div className="text-xs text-gray-500">🖼 {block.content.slice(0, 50)}</div> : <div className="text-xs text-gray-400">Image (no URL set)</div>)}
              {block.type === "button" && <div className="inline-block px-3 py-1 rounded text-xs font-bold text-white" style={{ background: block.buttonColor || "#189aa1" }}>{block.content || "Button"}</div>}
              {block.type === "lead_capture" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: block.leadCaptureButtonColor || "#189aa1", color: block.leadCaptureButtonTextColor || "#fff" }}>
                    <Mail className="w-3 h-3" /> {block.leadCaptureTitle || "Lead Capture"}
                  </span>
                  <span className="text-gray-400">{block.leadCaptureListId ? `→ List #${block.leadCaptureListId}` : "(no list selected)"}</span>
                </div>
              )}
              {!["divider", "spacer", "image", "button", "lead_capture"].includes(block.type) && (
                <span className={`${block.type === "heading1" ? "font-bold text-base" : block.type === "heading2" ? "font-semibold" : ""}`}>
                  {block.content.slice(0, 80) || `(empty ${block.type})`}
                </span>
              )}
            </div>
            {/* Actions */}
            <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, -1); }} disabled={idx === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 1); }} disabled={idx === blocks.length - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }} className="p-1 rounded hover:bg-gray-100"><Copy className="w-3 h-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Right panel: block catalog + selected block editor */}
      <div className="w-64 shrink-0 space-y-3">
        {/* Add block */}
        <div className="border rounded-lg p-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 mb-2">ADD BLOCK</p>
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_CATALOG.map(({ type, icon, label }) => (
              <button
                key={type}
                onClick={() => addBlock(type)}
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded border border-gray-200 bg-white hover:border-[#189aa1] hover:text-[#189aa1] transition-colors whitespace-nowrap"
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected block settings */}
        {selected && (
          <div className="border rounded-lg p-3 bg-white space-y-3 max-h-[72vh] overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{selected.type.replace(/([12])$/, ' $1')} Block</p>

            {/* Lead Capture settings */}
            {selected.type === "lead_capture" && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Headline</label>
                  <Input value={selected.leadCaptureTitle || ""} onChange={(e) => updateBlock(selected.id, { leadCaptureTitle: e.target.value })} placeholder="Stay in the loop" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email Placeholder</label>
                  <Input value={selected.leadCapturePlaceholder || ""} onChange={(e) => updateBlock(selected.id, { leadCapturePlaceholder: e.target.value })} placeholder="Enter your email" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Button Text</label>
                  <Input value={selected.leadCaptureButtonText || ""} onChange={(e) => updateBlock(selected.id, { leadCaptureButtonText: e.target.value })} placeholder="Subscribe" className="text-sm" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Button BG</label>
                    <input type="color" value={selected.leadCaptureButtonColor || "#189aa1"} onChange={(e) => updateBlock(selected.id, { leadCaptureButtonColor: e.target.value })} className="w-full h-8 rounded border cursor-pointer" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Button Text</label>
                    <input type="color" value={selected.leadCaptureButtonTextColor || "#ffffff"} onChange={(e) => updateBlock(selected.id, { leadCaptureButtonTextColor: e.target.value })} className="w-full h-8 rounded border cursor-pointer" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="lc-name" checked={!!selected.leadCaptureShowName} onCheckedChange={(v) => updateBlock(selected.id, { leadCaptureShowName: v })} />
                  <Label htmlFor="lc-name" className="text-xs text-gray-600">Show name field</Label>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={selected.bgColor || "#f0fbfc"} onChange={(e) => updateBlock(selected.id, { bgColor: e.target.value })} className="h-8 w-12 rounded border cursor-pointer" />
                    {selected.bgColor && <button onClick={() => updateBlock(selected.id, { bgColor: undefined })} className="text-xs text-gray-400 hover:text-red-500">Clear</button>}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Border Radius (px)</label>
                  <Input type="number" min={0} max={50} value={selected.borderRadius ?? 8} onChange={(e) => updateBlock(selected.id, { borderRadius: parseInt(e.target.value) || 0 })} className="text-sm" />
                </div>
                <LeadCaptureListSelector listId={selected.leadCaptureListId ?? null} onChange={(id) => updateBlock(selected.id, { leadCaptureListId: id })} />
              </div>
            )}

            {/* Content */}
            {!["divider", "spacer", "image", "lead_capture"].includes(selected.type) && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Content</label>
                <Textarea
                  value={selected.content}
                  onChange={(e) => updateBlock(selected.id, { content: e.target.value })}
                  rows={selected.type === "text" || selected.type === "html" ? 5 : 2}
                  className="text-sm"
                />
              </div>
            )}

            {/* Image URL */}
            {selected.type === "image" && (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Image URL</label>
                  <Input value={selected.content} onChange={(e) => updateBlock(selected.id, { content: e.target.value })} placeholder="https://..." className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Alt text</label>
                  <Input value={selected.imageAlt || ""} onChange={(e) => updateBlock(selected.id, { imageAlt: e.target.value })} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Width</label>
                  <Input value={selected.imageWidth || "100%"} onChange={(e) => updateBlock(selected.id, { imageWidth: e.target.value })} placeholder="100% or 300px" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Border Radius (px)</label>
                  <Input type="number" min={0} max={50} value={selected.borderRadius ?? 8} onChange={(e) => updateBlock(selected.id, { borderRadius: parseInt(e.target.value) || 0 })} className="text-sm" />
                </div>
              </>
            )}

            {/* Button-specific */}
            {selected.type === "button" && (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Button URL</label>
                  <Input value={selected.buttonUrl || ""} onChange={(e) => updateBlock(selected.id, { buttonUrl: e.target.value })} placeholder="https://..." className="text-sm" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Button BG</label>
                    <input type="color" value={selected.buttonColor || "#189aa1"} onChange={(e) => updateBlock(selected.id, { buttonColor: e.target.value })} className="w-full h-8 rounded border cursor-pointer" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Button Text</label>
                    <input type="color" value={selected.buttonTextColor || "#ffffff"} onChange={(e) => updateBlock(selected.id, { buttonTextColor: e.target.value })} className="w-full h-8 rounded border cursor-pointer" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Font Size (px)</label>
                  <Input type="number" min={10} max={36} value={selected.fontSize || 15} onChange={(e) => updateBlock(selected.id, { fontSize: parseInt(e.target.value) || 15 })} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Border Radius (px)</label>
                  <Input type="number" min={0} max={50} value={selected.borderRadius ?? 8} onChange={(e) => updateBlock(selected.id, { borderRadius: parseInt(e.target.value) || 0 })} className="text-sm" />
                </div>
              </>
            )}

            {/* Spacer height */}
            {selected.type === "spacer" && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Height (px)</label>
                <Input type="number" value={selected.spacerHeight || 24} onChange={(e) => updateBlock(selected.id, { spacerHeight: parseInt(e.target.value) || 24 })} className="text-sm" />
              </div>
            )}

            {/* Alignment */}
            {!["divider", "spacer", "html"].includes(selected.type) && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Alignment</label>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button key={a} onClick={() => updateBlock(selected.id, { align: a })} className={`flex-1 text-xs py-1 rounded border ${selected.align === a ? "border-[#189aa1] bg-[#f0fbfc] text-[#189aa1]" : "border-gray-200"}`}>{a}</button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Typography ── */}
            {!["divider", "spacer", "image", "html", "button"].includes(selected.type) && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Typography</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Text Color</label>
                    <input
                      type="color"
                      value={selected.textColor || (selected.type === "quote" ? "#0e4a50" : selected.type.startsWith("heading") ? "#0e1e2e" : "#1a2e3b")}
                      onChange={(e) => updateBlock(selected.id, { textColor: e.target.value })}
                      className="w-full h-8 rounded border cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Font Size (px)</label>
                    <Input
                      type="number" min={10} max={72}
                      value={selected.fontSize || (selected.type === "heading1" ? 28 : selected.type === "heading2" ? 20 : 15)}
                      onChange={(e) => updateBlock(selected.id, { fontSize: parseInt(e.target.value) || 15 })}
                      className="text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Font Weight</label>
                  <div className="flex gap-1">
                    {(["normal", "bold"] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() => updateBlock(selected.id, { fontWeight: w })}
                        className={`flex-1 text-xs py-1 rounded border capitalize ${
                          (selected.fontWeight === w) || (!selected.fontWeight && ((selected.type.startsWith("heading") && w === "bold") || (selected.type === "text" && w === "normal")))
                            ? "border-[#189aa1] bg-[#f0fbfc] text-[#189aa1]"
                            : "border-gray-200"
                        }`}
                      >{w}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Line Height</label>
                  <Input
                    type="number" min={1} max={3} step={0.1}
                    value={selected.lineHeight || (selected.type.startsWith("heading") ? 1.2 : 1.7)}
                    onChange={(e) => updateBlock(selected.id, { lineHeight: parseFloat(e.target.value) || 1.5 })}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* ── Background & Spacing ── */}
            {!["divider", "spacer", "html"].includes(selected.type) && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Background & Spacing</p>
                {selected.type !== "quote" && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selected.bgColor || "#ffffff"}
                        onChange={(e) => updateBlock(selected.id, { bgColor: e.target.value })}
                        className="h-8 w-12 rounded border cursor-pointer"
                      />
                      {selected.bgColor && (
                        <button onClick={() => updateBlock(selected.id, { bgColor: undefined })} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Padding (px) — T / R / B / L</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const).map((key, i) => (
                      <Input
                        key={key}
                        type="number" min={0} max={80}
                        value={(selected[key] as number) ?? 0}
                        onChange={(e) => updateBlock(selected.id, { [key]: parseInt(e.target.value) || 0 })}
                        className="text-xs text-center px-1"
                        placeholder={["T","R","B","L"][i]}
                      />
                    ))}
                  </div>
                </div>
                {selected.type !== "quote" && selected.type !== "button" && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Border Radius (px)</label>
                    <Input type="number" min={0} max={50} value={selected.borderRadius ?? 0} onChange={(e) => updateBlock(selected.id, { borderRadius: parseInt(e.target.value) || 0 })} className="text-sm" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Audience filter builder ──────────────────────────────────────────────────
interface AudienceFilter {
  interests: InterestKey[];
  roles: string[];
  subscriptionType: "all" | "premium" | "free";
  userStatus: "all" | "active" | "pending";
  specificEmails: string[];
  enrolledInCourseIds: number[];
  purchasedProductIds: number[];
  downloadedProductIds: number[];
  inGroupIds: number[];
  inCohortGroupIds: number[];
  submittedFormIds: number[];
  completedCourseIds: number[];
  logic: "and" | "or";
}

const DEFAULT_FILTER: AudienceFilter = {
  interests: [], roles: [], subscriptionType: "all", userStatus: "active",
  specificEmails: [], enrolledInCourseIds: [], purchasedProductIds: [],
  downloadedProductIds: [], inGroupIds: [], inCohortGroupIds: [],
  submittedFormIds: [], completedCourseIds: [], logic: "and",
};

function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: { id: number; label: string }[];
  selected: number[];
  onChange: (v: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = options.filter((o) => selected.includes(o.id)).map((o) => o.label);
  return (
    <div className="relative">
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <button onClick={() => setOpen(!open)} className="w-full text-left text-sm border rounded-lg px-3 py-2 bg-white flex items-center justify-between">
        <span className="truncate text-gray-700">{selectedLabels.length > 0 ? selectedLabels.join(", ") : <span className="text-gray-400">None selected</span>}</span>
        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">No options available</div>}
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => {
                onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id));
              }} className="rounded" />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function AudienceFilterBuilder({ filter, onChange, preview }: {
  filter: AudienceFilter;
  onChange: (f: AudienceFilter) => void;
  preview: { count: number; sampleEmails: string[] } | undefined;
}) {
  const { data: options } = trpc.emailCampaign.getAudienceOptions.useQuery();
  const [expanded, setExpanded] = useState(true);
  const [specificEmailsText, setSpecificEmailsText] = useState(filter.specificEmails.join("\n"));

  function update(patch: Partial<AudienceFilter>) {
    onChange({ ...filter, ...patch });
  }

  function toggleInterest(key: InterestKey) {
    const arr = filter.interests.includes(key) ? filter.interests.filter((k) => k !== key) : [...filter.interests, key];
    update({ interests: arr });
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#189aa1]" />
            Audience
            {preview && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {preview.count.toLocaleString()} recipient{preview.count !== 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="px-5 pb-5 space-y-4">
          {/* Logic toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Match</span>
            <div className="flex rounded-lg border overflow-hidden">
              {(["and", "or"] as const).map((l) => (
                <button key={l} onClick={() => update({ logic: l })} className={`px-3 py-1 text-xs font-semibold ${filter.logic === l ? "bg-[#189aa1] text-white" : "bg-white text-gray-600"}`}>
                  {l === "and" ? "ALL" : "ANY"}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500">filters</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Subscription */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Subscription</label>
              <Select value={filter.subscriptionType} onValueChange={(v: any) => update({ subscriptionType: v })}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="premium">Premium only</SelectItem>
                  <SelectItem value="free">Free only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User status */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">User Status</label>
              <Select value={filter.userStatus} onValueChange={(v: any) => update({ userStatus: v })}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Interests</label>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map(({ key, label }) => (
                <button key={key} onClick={() => toggleInterest(key)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filter.interests.includes(key) ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Course enrollment */}
          {options && (
            <MultiSelect label="Enrolled in Course" options={options.courses} selected={filter.enrolledInCourseIds} onChange={(v) => update({ enrolledInCourseIds: v })} />
          )}
          {options && (
            <MultiSelect label="Completed Course" options={options.courses} selected={filter.completedCourseIds} onChange={(v) => update({ completedCourseIds: v })} />
          )}
          {options && (
            <MultiSelect label="Purchased Product" options={options.products} selected={filter.purchasedProductIds} onChange={(v) => update({ purchasedProductIds: v })} />
          )}
          {options && (
            <MultiSelect label="Downloaded Product" options={options.products} selected={filter.downloadedProductIds} onChange={(v) => update({ downloadedProductIds: v })} />
          )}
          {options && (
            <MultiSelect label="In Team/Group" options={options.groups} selected={filter.inGroupIds} onChange={(v) => update({ inGroupIds: v })} />
          )}
          {options && (
            <MultiSelect label="In Cohort Group" options={options.cohortGroups} selected={filter.inCohortGroupIds} onChange={(v) => update({ inCohortGroupIds: v })} />
          )}
          {options && (
            <MultiSelect label="Submitted Form" options={options.forms} selected={filter.submittedFormIds} onChange={(v) => update({ submittedFormIds: v })} />
          )}

          {/* Specific emails */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Specific Emails (overrides all filters)</label>
            <Textarea
              value={specificEmailsText}
              onChange={(e) => {
                setSpecificEmailsText(e.target.value);
                const emails = e.target.value.split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.includes("@"));
                update({ specificEmails: emails });
              }}
              rows={3}
              placeholder="one@email.com, two@email.com"
              className="text-sm"
            />
          </div>

          {/* Preview */}
          {preview && preview.sampleEmails.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
              <span className="font-medium">Sample recipients:</span> {preview.sampleEmails.join(", ")}
              {preview.count > 5 && ` +${preview.count - 5} more`}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────
interface EditorProps {
  campaignId?: number;
  onClose?: () => void;
}

export default function EmailCampaignEditor({ campaignId, onClose }: EditorProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // ── State ───────────────────────────────────────────────────────────────────
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([defaultBlock("heading1"), defaultBlock("text"), defaultBlock("button")]);
  const [filter, setFilter] = useState<AudienceFilter>(DEFAULT_FILTER);
  const [senderProfileId, setSenderProfileId] = useState<number | undefined>();
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [showPreview, setShowPreview] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [loadTemplateDialogOpen, setLoadTemplateDialogOpen] = useState(false);
  const [draftId, setDraftId] = useState<number | undefined>(campaignId);
  const [isSaving, setIsSaving] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: senderProfiles } = trpc.emailCampaign.listSenderProfiles.useQuery(undefined, { enabled: !!user });
  const { data: templates } = trpc.emailCampaign.listTemplates.useQuery(undefined, { enabled: !!user });
  const { data: audiencePreview } = trpc.emailCampaign.previewAudience.useQuery(filter, { enabled: !!user });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const saveDraftMutation = trpc.emailCampaign.saveDraft.useMutation({
    onSuccess: (r) => { setDraftId(r.id); toast.success("Draft saved"); setIsSaving(false); },
    onError: (e) => { toast.error(e.message); setIsSaving(false); },
  });

  const sendMutation = trpc.emailCampaign.sendCampaign.useMutation({
    onSuccess: (r) => {
      toast.success(`Sending to ${r.recipientCount} recipient${r.recipientCount !== 1 ? "s" : ""}…`);
      setSendDialogOpen(false);
      if (onClose) onClose(); else navigate("/admin/email");
    },
    onError: (e) => toast.error(e.message),
  });

  const scheduleMutation = trpc.emailCampaign.scheduleCampaign.useMutation({
    onSuccess: (r) => {
      toast.success(`Scheduled for ${new Date(r.scheduledAt).toLocaleString()}`);
      setScheduleDialogOpen(false);
      if (onClose) onClose(); else navigate("/admin/email");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveTemplateMutation = trpc.emailCampaign.saveTemplate.useMutation({
    onSuccess: () => { toast.success("Template saved"); setSaveTemplateDialogOpen(false); setTemplateName(""); },
    onError: (e) => toast.error(e.message),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const htmlBody = useMemo(() => blocksToHtml(blocks), [blocks]);
  const wrappedHtml = useMemo(() => wrapInBrandedEmail(htmlBody, previewText), [htmlBody, previewText]);

  function handleSaveDraft() {
    setIsSaving(true);
    saveDraftMutation.mutate({
      id: draftId,
      subject, htmlBody: wrappedHtml, previewText,
      audienceFilter: filter,
      senderProfileId,
    });
  }

  function handleSend() {
    if (!subject.trim()) { toast.error("Subject is required"); return; }
    if (blocks.length === 0) { toast.error("Add at least one content block"); return; }
    setSendDialogOpen(true);
  }

  function confirmSend() {
    sendMutation.mutate({
      subject, htmlBody: wrappedHtml, previewText,
      audienceFilter: filter,
    });
  }

  function confirmSchedule() {
    if (!scheduledAt) { toast.error("Pick a date/time"); return; }
    scheduleMutation.mutate({
      subject, htmlBody: wrappedHtml, previewText,
      audienceFilter: filter,
      scheduledAt: new Date(scheduledAt),
    });
  }

  function loadTemplate(t: any) {
    setSubject(t.subject || "");
    setPreviewText(t.previewText || "");
    // Convert template HTML back to a single HTML block
    setBlocks([{ id: uid(), type: "html", content: t.htmlBody || "" }]);
    setLoadTemplateDialogOpen(false);
    toast.success(`Loaded: ${t.name}`);
  }

  const goBack = onClose ?? (() => navigate("/admin/email"));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b sticky top-0 z-40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#189aa1" }}>
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">{draftId ? "Edit Campaign" : "New Campaign"}</h1>
            {draftId && <p className="text-xs text-gray-400">Draft #{draftId}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLoadTemplateDialogOpen(true)}>
            <LayoutTemplate className="w-4 h-4 mr-1.5" /> Templates
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSaving}>
            <Save className="w-4 h-4 mr-1.5" /> {isSaving ? "Saving…" : "Save Draft"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setScheduleDialogOpen(true)}>
            <Clock className="w-4 h-4 mr-1.5" /> Schedule
          </Button>
          <Button size="sm" onClick={handleSend} style={{ background: "#189aa1" }} className="text-white hover:opacity-90">
            <Send className="w-4 h-4 mr-1.5" /> Send Now
          </Button>
        </div>
      </div>

      <div className={`p-6 ${showPreview ? "grid grid-cols-2 gap-6" : ""}`}>
        {/* Editor column */}
        <div className="space-y-4">
          {/* Subject + preview text */}
          <Card className="border shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject Line <span className="text-red-400">*</span></label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter email subject…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Preview Text <span className="text-gray-400 font-normal">(shown in inbox)</span></label>
                <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Short preview shown in email clients…" maxLength={300} />
              </div>
              {/* Sender profile */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">From (Sender Profile)</label>
                <Select value={senderProfileId?.toString() ?? "__default__"} onValueChange={(v) => setSenderProfileId(v && v !== "__default__" ? parseInt(v) : undefined)}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Default sender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default sender</SelectItem>
                    {(senderProfiles ?? []).map((sp) => (
                      <SelectItem key={sp.id} value={sp.id.toString()}>
                        {sp.name} &lt;{sp.email}&gt;{sp.isDefault ? " ★" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Block editor */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Email Body</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSaveTemplateDialogOpen(true)} className="text-xs text-gray-500">
                  <Save className="w-3 h-3 mr-1" /> Save as Template
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <BlockEditor blocks={blocks} onChange={setBlocks} />
            </CardContent>
          </Card>

          {/* Audience filter */}
          <AudienceFilterBuilder filter={filter} onChange={setFilter} preview={audiencePreview} />
        </div>

        {/* Preview column */}
        {showPreview && (
          <div className="sticky top-20 self-start">
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
                <button onClick={() => setPreviewMode("desktop")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${previewMode === "desktop" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
                  <Monitor className="w-3.5 h-3.5" /> Desktop
                </button>
                <button onClick={() => setPreviewMode("mobile")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${previewMode === "mobile" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
                  <Smartphone className="w-3.5 h-3.5" /> Mobile
                </button>
                <span className="ml-auto text-xs text-gray-400">{subject || "(no subject)"}</span>
              </div>
              <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
                <div className={`mx-auto ${previewMode === "mobile" ? "max-w-sm" : "max-w-2xl"} p-4`}>
                  <iframe
                    srcDoc={wrappedHtml}
                    className="w-full border-0 rounded"
                    style={{ height: "600px" }}
                    title="Email preview"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Send confirmation dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">You are about to send <strong>"{subject}"</strong> to:</p>
            <div className="bg-[#f0fbfc] border border-[#189aa1]/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[#189aa1]">{audiencePreview?.count ?? 0}</div>
              <div className="text-xs text-gray-500">recipients</div>
            </div>
            <p className="text-xs text-gray-400">An unsubscribe link will be automatically added to every email.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmSend} disabled={sendMutation.isPending} style={{ background: "#189aa1" }} className="text-white">
              {sendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium text-gray-700">Send at</label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
            <p className="text-xs text-gray-400">Campaign will be sent to {audiencePreview?.count ?? 0} recipients at the scheduled time.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmSchedule} disabled={scheduleMutation.isPending} style={{ background: "#189aa1" }} className="text-white">
              <Clock className="w-4 h-4 mr-1.5" /> Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as template dialog */}
      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save as Template</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium text-gray-700">Template name</label>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Monthly Newsletter" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveTemplateMutation.mutate({ name: templateName, subject, htmlBody: wrappedHtml, previewText })} disabled={!templateName.trim() || saveTemplateMutation.isPending} style={{ background: "#189aa1" }} className="text-white">
              <Save className="w-4 h-4 mr-1.5" /> Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load template dialog */}
      <Dialog open={loadTemplateDialogOpen} onOpenChange={setLoadTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Load Template</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto py-2">
            {(!templates || templates.length === 0) && <p className="text-sm text-gray-400 text-center py-4">No saved templates yet.</p>}
            {(templates ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-[#189aa1] cursor-pointer" onClick={() => loadTemplate(t)}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.subject}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-[#189aa1]">Use</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
