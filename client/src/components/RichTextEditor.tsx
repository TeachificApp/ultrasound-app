/**
 * RichTextEditor — TipTap-based WYSIWYG editor for All About Ultrasound™
 *
 * Features:
 *  - Full text formatting: bold, italic, underline, strikethrough, code
 *  - Headings H1–H3, paragraph
 *  - Text alignment: left, center, right, justify
 *  - Text color picker (12 preset colors + reset)
 *  - Bullet and numbered lists, blockquote, horizontal rule
 *  - Image insertion: URL or local file upload (base64 preview)
 *  - Video upload: direct file upload → auto-saved to Media Repository → inline <video>
 *  - YouTube / video URL embedding
 *  - Raw HTML code insert dialog
 *  - Hyperlink insert/remove dialog
 *  - Sticky toolbar (stays visible while scrolling long content)
 *  - Bubble menu for quick formatting on selection
 *  - Configurable minHeight / maxHeight
 *
 * Exports:
 *   default  RichTextEditor   — controlled editor (value / onChange)
 *   named    RichTextDisplay  — read-only HTML renderer
 */

import { useEditor, EditorContent, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ImageResize } from "tiptap-extension-resize-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Youtube from "@tiptap/extension-youtube";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

// Extended TableCell with backgroundColor attribute
const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => el.style.backgroundColor || null,
        renderHTML: (attrs) => {
          if (!attrs.backgroundColor) return {};
          return { style: `background-color: ${attrs.backgroundColor}` };
        },
      },
    };
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => el.style.backgroundColor || null,
        renderHTML: (attrs) => {
          if (!attrs.backgroundColor) return {};
          return { style: `background-color: ${attrs.backgroundColor}` };
        },
      },
    };
  },
});
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Link as LinkIcon,
  Youtube as YoutubeIcon,
  Code2,
  Undo,
  Redo,
  Minus,
  Quote,
  Palette,
  FileCode,
  X,
  Upload,
  Smile,
  Video,
  MousePointerClick,
  WrapText,
  MoveLeft,
  MoveRight,
  MoveHorizontal,
  Table as TableIcon,
  Rows3,
  Columns3,
  Merge,
  Split,
  Trash2 as TrashIcon,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Custom Video TipTap Node ─────────────────────────────────────────────────

const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      width: { default: "100%" },
    };
  },

  parseHTML() {
    return [{ tag: "video" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes({ controls: true, style: "max-width:100%;border-radius:8px;margin:0.5em 0;" }, HTMLAttributes)];
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  disabled?: boolean;
  /** Optional: pass courseId to enable pricing option checkout in CTA dialog */
  courseId?: number;
}

// CTA action types available in rich text
type RteCTAAction = "url" | "scroll_to_section" | "direct_checkout" | "pricing_option" | "open_popup" | "download_file" | "send_email" | "phone";
const RTE_CTA_ACTION_LABELS: Record<RteCTAAction, string> = {
  url: "Link to URL",
  scroll_to_section: "Scroll to Section",
  direct_checkout: "Direct Checkout (Stripe)",
  pricing_option: "Pricing Option Checkout",
  open_popup: "Open Video / Popup",
  download_file: "Download File",
  send_email: "Send Email",
  phone: "Phone Number",
};

// ─── Toolbar Button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      className={`w-7 h-7 flex items-center justify-center rounded transition-all text-sm flex-shrink-0 ${
        active
          ? "bg-[#149096] text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      } ${disabled ? "opacity-30 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5 flex-shrink-0 self-center" />;
}

const TEXT_COLORS = [
  "#000000", "#374151", "#6B7280", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#149096", "#3B82F6", "#8B5CF6",
  "#EC4899", "#FFFFFF",
];

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks

// ─── Video Upload Helper ──────────────────────────────────────────────────────

async function uploadVideoToMediaRepo(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  // 1. Init upload session
  const initRes = await fetch("/api/upload-media-repo/init", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!initRes.ok) {
    const e = await initRes.json().catch(() => ({}));
    throw new Error(e.error ?? "Failed to initialize upload");
  }
  const { uploadId } = await initRes.json();

  // 2. Send chunks
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  let lastResult: any = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const fd = new FormData();
    fd.append("chunk", chunk, file.name);
    fd.append("uploadId", uploadId);
    fd.append("chunkIndex", String(i));
    fd.append("totalChunks", String(totalChunks));
    fd.append("fileName", file.name);
    fd.append("mimeType", file.type || "video/mp4");
    fd.append("fileSize", String(file.size));
    fd.append("title", file.name.replace(/\.[^.]+$/, ""));
    fd.append("access", "public");
    fd.append("mediaType", "video");
    fd.append("notes", "Uploaded via rich text editor");

    lastResult = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const overall = Math.round(((i + e.loaded / e.total) / totalChunks) * 100);
          onProgress(overall);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { resolve({}); }
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText)?.error ?? "Chunk upload failed")); }
          catch { reject(new Error("Chunk upload failed")); }
        }
      };
      xhr.onerror = () => reject(new Error("Network error on chunk " + i));
      xhr.open("POST", "/api/upload-media-repo/chunk");
      xhr.withCredentials = true;
      xhr.send(fd);
    });
  }

  if (!lastResult?.s3Url) throw new Error("Upload completed but no URL returned");
  return lastResult.s3Url as string;
}

// ─── Media Style Panel ───────────────────────────────────────────────────────

function MediaStylePanel({ editor, onClose }: { editor: any; onClose: () => void }) {
  // Read current style from selected image or video node
  const getNodeStyle = () => {
    const { state } = editor;
    const { from } = state.selection;
    let style = "";
    state.doc.nodesBetween(Math.max(0, from - 1), Math.min(state.doc.content.size, from + 1), (node: any) => {
      if (["image", "imageResize", "video"].includes(node.type.name)) {
        style = node.attrs.style ?? node.attrs.wrapperStyle ?? "";
        return false;
      }
    });
    return style;
  };

  const parseStyleProp = (style: string, prop: string) => {
    const m = style.match(new RegExp(`${prop}:\\s*([^;]+)`));
    return m ? m[1].trim() : "";
  };

  const currentStyle = getNodeStyle();
  const [borderWidth, setBorderWidth] = React.useState(parseStyleProp(currentStyle, "border-width") || "0px");
  const [borderColor, setBorderColor] = React.useState(parseStyleProp(currentStyle, "border-color") || "#d1d5db");
  const [borderStyle, setBorderStyle] = React.useState(parseStyleProp(currentStyle, "border-style") || "solid");
  const [borderRadius, setBorderRadius] = React.useState(parseStyleProp(currentStyle, "border-radius") || "0px");
  const [shadow, setShadow] = React.useState(parseStyleProp(currentStyle, "box-shadow") || "none");
  const [marginTop, setMarginTop] = React.useState(parseStyleProp(currentStyle, "margin-top") || "8px");
  const [marginBottom, setMarginBottom] = React.useState(parseStyleProp(currentStyle, "margin-bottom") || "8px");
  const [marginLeft, setMarginLeft] = React.useState(parseStyleProp(currentStyle, "margin-left") || "0px");
  const [marginRight, setMarginRight] = React.useState(parseStyleProp(currentStyle, "margin-right") || "0px");

  const applyStyle = () => {
    const styleStr = [
      `border-width: ${borderWidth}`,
      `border-color: ${borderColor}`,
      `border-style: ${borderStyle}`,
      `border-radius: ${borderRadius}`,
      `box-shadow: ${shadow}`,
      `margin-top: ${marginTop}`,
      `margin-bottom: ${marginBottom}`,
      `margin-left: ${marginLeft}`,
      `margin-right: ${marginRight}`,
    ].join("; ");
    const { state } = editor;
    const { from } = state.selection;
    state.doc.nodesBetween(Math.max(0, from - 1), Math.min(state.doc.content.size, from + 1), (node: any) => {
      if (["image", "imageResize"].includes(node.type.name)) {
        editor.chain().focus().updateAttributes(node.type.name, { style: styleStr }).run();
        return false;
      }
      if (node.type.name === "video") {
        editor.chain().focus().updateAttributes("video", { style: styleStr }).run();
        return false;
      }
    });
    onClose();
  };

  const SHADOW_PRESETS = [
    { label: "None", value: "none" },
    { label: "Soft", value: "0 2px 8px rgba(0,0,0,0.10)" },
    { label: "Medium", value: "0 4px 16px rgba(0,0,0,0.15)" },
    { label: "Strong", value: "0 8px 32px rgba(0,0,0,0.22)" },
    { label: "Teal", value: "0 4px 16px rgba(20,144,150,0.30)" },
  ];

  const RADIUS_PRESETS = [
    { label: "None", value: "0px" },
    { label: "Sm", value: "4px" },
    { label: "Md", value: "8px" },
    { label: "Lg", value: "16px" },
    { label: "Full", value: "9999px" },
  ];

  return (
    <div className="absolute top-9 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-72" onMouseLeave={onClose}>
      <p className="text-xs font-semibold text-gray-700 mb-2">Image / Video Style</p>
      <div className="space-y-2.5">
        {/* Border */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Border</label>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={20} value={parseInt(borderWidth)||0}
              onChange={e => setBorderWidth(`${e.target.value}px`)}
              className="w-14 h-7 text-xs border border-gray-200 rounded px-2" />
            <span className="text-xs text-gray-400">px</span>
            <select value={borderStyle} onChange={e => setBorderStyle(e.target.value)}
              className="flex-1 h-7 text-xs border border-gray-200 rounded px-1">
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
            </select>
            <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)}
              className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0" />
          </div>
        </div>
        {/* Corner Radius */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Corner Radius</label>
          <div className="flex gap-1 flex-wrap">
            {RADIUS_PRESETS.map(p => (
              <button key={p.value} type="button"
                className={`px-2 py-0.5 text-xs rounded border ${borderRadius === p.value ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                onMouseDown={(e) => { e.preventDefault(); setBorderRadius(p.value); }}>
                {p.label}
              </button>
            ))}
            <input type="text" value={borderRadius} onChange={e => setBorderRadius(e.target.value)}
              className="w-16 h-6 text-xs border border-gray-200 rounded px-1" placeholder="8px" />
          </div>
        </div>
        {/* Shadow */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Shadow</label>
          <div className="flex gap-1 flex-wrap">
            {SHADOW_PRESETS.map(p => (
              <button key={p.label} type="button"
                className={`px-2 py-0.5 text-xs rounded border ${shadow === p.value ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                onMouseDown={(e) => { e.preventDefault(); setShadow(p.value); }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {/* Margins */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Margin (px)</label>
          <div className="grid grid-cols-2 gap-1.5">
            {[{label:"Top",val:marginTop,set:setMarginTop},{label:"Bottom",val:marginBottom,set:setMarginBottom},{label:"Left",val:marginLeft,set:setMarginLeft},{label:"Right",val:marginRight,set:setMarginRight}].map(({label,val,set}) => (
              <div key={label} className="flex items-center gap-1">
                <span className="text-xs text-gray-400 w-10">{label}</span>
                <input type="number" min={0} max={200} value={parseInt(val)||0}
                  onChange={e => set(`${e.target.value}px`)}
                  className="flex-1 h-6 text-xs border border-gray-200 rounded px-1" />
              </div>
            ))}
          </div>
        </div>
        <button type="button" className="w-full py-1.5 text-sm font-medium text-white rounded-lg bg-teal-600 hover:bg-teal-700"
          onMouseDown={(e) => { e.preventDefault(); applyStyle(); }}>
          Apply Style
        </button>
        <button type="button" className="w-full py-1 text-xs text-gray-400 hover:text-gray-600"
          onMouseDown={(e) => {
            e.preventDefault();
            const { state } = editor;
            const { from } = state.selection;
            state.doc.nodesBetween(Math.max(0, from - 1), Math.min(state.doc.content.size, from + 1), (node: any) => {
              if (["image", "imageResize", "video"].includes(node.type.name)) {
                editor.chain().focus().updateAttributes(node.type.name, { style: "" }).run();
                return false;
              }
            });
            onClose();
          }}>
          Reset style
        </button>
      </div>
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write here…",
  minHeight = 160,
  maxHeight = 600,
  className,
  disabled = false,
  courseId,
}: RichTextEditorProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoUploadDialogOpen, setVideoUploadDialogOpen] = useState(false);
  const [videoUploadFile, setVideoUploadFile] = useState<File | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploading, setVideoUploading] = useState(false);
  const [htmlDialogOpen, setHtmlDialogOpen] = useState(false);
  const [rawHtml, setRawHtml] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#149096");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [ctaDialogOpen, setCtaDialogOpen] = useState(false);
  const [ctaText, setCtaText] = useState("Click Here");
  const [ctaAction, setCtaAction] = useState<RteCTAAction>("url");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaEmail, setCtaEmail] = useState("");
  const [ctaPhone, setCtaPhone] = useState("");
  const [ctaAnchor, setCtaAnchor] = useState("");
  const [ctaPopup, setCtaPopup] = useState("");
  const [ctaDownload, setCtaDownload] = useState("");
  const [ctaCheckoutProductType, setCtaCheckoutProductType] = useState("");
  const [ctaCheckoutProductId, setCtaCheckoutProductId] = useState<number | null>(null);
  const [ctaPricingOptionId, setCtaPricingOptionId] = useState<number | null>(null);
  const [ctaBgColor, setCtaBgColor] = useState("#149096");
  const [ctaTextColor, setCtaTextColor] = useState("#ffffff");
  const [ctaSize, setCtaSize] = useState<"sm" | "md" | "lg">("md");
  const [ctaFullWidth, setCtaFullWidth] = useState(false);
  // Fetch pricing options when courseId is available and dialog is open
  const { data: pricingOptions } = trpc.lmsAdmin.listPricingOptions.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId && ctaDialogOpen && ctaAction === "pricing_option", staleTime: 30_000 }
  );
  // Fetch product catalog for direct checkout
  const { data: productCatalog } = trpc.funnel.listAllProducts.useQuery(
    undefined,
    { enabled: ctaDialogOpen && ctaAction === "direct_checkout", staleTime: 60_000 }
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableInsertOpen, setTableInsertOpen] = useState(false);
  const [cellBgColor, setCellBgColor] = useState("#ffffff");
  const [mediaStyleOpen, setMediaStyleOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ImageResize.configure({ inline: false, allowBase64: true }),
      VideoNode,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "text-[#149096] underline cursor-pointer" },
      }),
      Youtube.configure({ controls: true, nocookie: true }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableHeader,
      CustomTableCell,
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const normalised = current === "<p></p>" ? "" : current;
    if (normalised !== value) {
      editor.commands.setContent(value || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Sync editable flag
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  const insertImage = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    editor.chain().focus().setImage({ src: imageUrl.trim(), alt: imageAlt.trim() || undefined }).run();
    setImageUrl(""); setImageAlt(""); setImageDialogOpen(false);
  }, [editor, imageUrl, imageAlt]);

  const insertImageFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [editor]);

  const insertVideo = useCallback(() => {
    if (!editor || !videoUrl.trim()) return;
    editor.chain().focus().setYoutubeVideo({ src: videoUrl.trim() }).run();
    setVideoUrl(""); setVideoDialogOpen(false);
  }, [editor, videoUrl]);

  const handleVideoFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploadFile(file);
    setVideoUploadDialogOpen(true);
    e.target.value = "";
  }, []);

  const handleVideoUpload = useCallback(async () => {
    if (!videoUploadFile || !editor) return;
    setVideoUploading(true);
    setVideoUploadProgress(0);
    try {
      const s3Url = await uploadVideoToMediaRepo(videoUploadFile, setVideoUploadProgress);
      // Insert native <video> node into editor
      editor.chain().focus().insertContent({
        type: "video",
        attrs: { src: s3Url, controls: true, width: "100%" },
      }).run();
      toast.success("Video uploaded and saved to Media Repository");
      setVideoUploadDialogOpen(false);
      setVideoUploadFile(null);
      setVideoUploadProgress(0);
    } catch (err: any) {
      toast.error(`Video upload failed: ${err.message}`);
    } finally {
      setVideoUploading(false);
    }
  }, [videoUploadFile, editor]);

  const insertHtml = useCallback(() => {
    if (!editor || !rawHtml.trim()) return;
    editor.chain().focus().insertContent(rawHtml.trim()).run();
    setRawHtml(""); setHtmlDialogOpen(false);
  }, [editor, rawHtml]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    }
    setLinkUrl(""); setLinkDialogOpen(false);
  }, [editor, linkUrl]);

  const insertCtaButton = useCallback(() => {
    if (!editor || !ctaText.trim()) return;
    const padding = ctaSize === "sm" ? "8px 18px" : ctaSize === "lg" ? "16px 36px" : "12px 28px";
    const fontSize = ctaSize === "sm" ? "13px" : ctaSize === "lg" ? "18px" : "15px";
    const display = ctaFullWidth ? "block" : "inline-block";
    const width = ctaFullWidth ? "100%" : "auto";
    const baseStyle = `display:${display};width:${width};text-align:center;padding:${padding};background-color:${ctaBgColor};color:${ctaTextColor};border-radius:8px;font-weight:700;font-size:${fontSize};text-decoration:none;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.12);`;
    // Build data attributes based on action type
    let dataAttrs = `data-cta-btn data-action="${ctaAction}"`;
    if (ctaAction === "url") dataAttrs += ` data-link="${ctaUrl.trim() || "#"}"`;
    else if (ctaAction === "send_email") dataAttrs += ` data-email="${ctaEmail.trim()}"`;
    else if (ctaAction === "phone") dataAttrs += ` data-phone="${ctaPhone.trim()}"`;
    else if (ctaAction === "scroll_to_section") dataAttrs += ` data-anchor="${ctaAnchor.trim()}"`;
    else if (ctaAction === "open_popup") dataAttrs += ` data-popup="${ctaPopup.trim()}"`;
    else if (ctaAction === "download_file") dataAttrs += ` data-download="${ctaDownload.trim()}"`;
    else if (ctaAction === "direct_checkout") dataAttrs += ` data-checkout-type="${ctaCheckoutProductType}" data-checkout-id="${ctaCheckoutProductId ?? ""}"`;
    else if (ctaAction === "pricing_option") dataAttrs += ` data-pricing-option="${ctaPricingOptionId ?? ""}"`;
    const html = `<span ${dataAttrs} style="${baseStyle}">${ctaText.trim()}</span>`;
    editor.chain().focus().insertContent(html).run();
    setCtaDialogOpen(false);
  }, [editor, ctaText, ctaAction, ctaUrl, ctaEmail, ctaPhone, ctaAnchor, ctaPopup, ctaDownload, ctaCheckoutProductType, ctaCheckoutProductId, ctaPricingOptionId, ctaBgColor, ctaTextColor, ctaSize, ctaFullWidth]);

  // Image alignment using wrapperStyle (supported by tiptap-extension-resize-image)
  const setImageAlign = (align: string) => {
    if (!editor) return;
    const { state } = editor;
    const { from } = state.selection;
    let found = false;
    state.doc.nodesBetween(Math.max(0, from - 1), Math.min(state.doc.content.size, from + 1), (node) => {
      if (found) return false;
      if (node.type.name === "image" || node.type.name === "imageResize") {
        found = true;
        const current = (node.attrs.wrapperStyle ?? "") as string;
        const isActive = current.includes(`data-align:${align}`);
        let wrapperStyle: string;
        if (isActive) {
          // Toggle off — reset to default block display
          wrapperStyle = "display: block; margin: 0;";
        } else if (align === "float-left") {
          wrapperStyle = "display: block; float: left; margin: 0 16px 8px 0; data-align:float-left";
        } else if (align === "float-right") {
          wrapperStyle = "display: block; float: right; margin: 0 0 8px 16px; data-align:float-right";
        } else if (align === "center") {
          wrapperStyle = "display: flex; justify-content: center; margin: 0 auto; data-align:center";
        } else if (align === "left") {
          wrapperStyle = "display: block; margin-right: auto; data-align:left";
        } else if (align === "right") {
          wrapperStyle = "display: block; margin-left: auto; data-align:right";
        } else {
          wrapperStyle = "display: block; margin: 0;";
        }
        editor.chain().focus().updateAttributes(node.type.name, { wrapperStyle }).run();
        return false;
      }
    });
  };

  const getImageAlign = (): string => {
    if (!editor) return "";
    const { state } = editor;
    const { from } = state.selection;
    let align = "";
    state.doc.nodesBetween(Math.max(0, from - 1), Math.min(state.doc.content.size, from + 1), (node) => {
      if (node.type.name === "image" || node.type.name === "imageResize") {
        const ws = (node.attrs.wrapperStyle ?? "") as string;
        const match = ws.match(/data-align:(\S+)/);
        if (match) align = match[1];
        return false;
      }
    });
    return align;
  };

  // Legacy class-based alignment (kept for backward compat with existing content)
  const setImageClass = (cls: string) => setImageAlign(cls);
  const getImageClass = (): string => getImageAlign();

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rich-text-editor border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#149096]/30 focus-within:border-[#149096] transition-all",
        disabled && "opacity-60 pointer-events-none bg-gray-50",
        className,
      )}
    >
      {/* Sticky Toolbar */}
      {!disabled && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-2 py-1.5 flex flex-wrap items-center gap-0.5 shadow-sm">
          {/* Undo / Redo */}
          <ToolbarBtn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Redo (Ctrl+Shift+Z)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo className="w-3.5 h-3.5" />
          </ToolbarBtn>

          <Sep />

          {/* Headings */}
          <ToolbarBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="w-3.5 h-3.5" />
          </ToolbarBtn>

          <Sep />

          {/* Text style */}
          <ToolbarBtn title="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Underline (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
            <Code2 className="w-3.5 h-3.5" />
          </ToolbarBtn>

          {/* Color picker */}
          <div className="relative">
            <ToolbarBtn title="Text color" onClick={() => setColorPickerOpen(p => !p)}>
              <Palette className="w-3.5 h-3.5" />
            </ToolbarBtn>
            {colorPickerOpen && (
              <div className="absolute top-8 left-0 z-50 p-3 bg-white border border-gray-200 rounded-xl shadow-lg w-48">
                <div className="flex flex-wrap gap-1 mb-2">
                  {TEXT_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                      style={{ background: color }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().setColor(color).run();
                        setColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-2 mt-1">
                  <label className="text-xs text-gray-500 block mb-1">Custom color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="flex-1 h-7 text-xs border border-gray-200 rounded px-2 font-mono"
                      placeholder="#149096"
                    />
                  </div>
                  <button
                    type="button"
                    className="w-full mt-2 h-7 text-xs font-medium rounded text-white"
                    style={{ backgroundColor: customColor }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor.chain().focus().setColor(customColor).run();
                      setColorPickerOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
                <button type="button" className="w-full text-xs text-gray-400 hover:text-gray-600 mt-2"
                  onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setColorPickerOpen(false); }}>
                  Reset color
                </button>
              </div>
            )}
          </div>

          <Sep />

          {/* Alignment */}
          <ToolbarBtn title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
            <AlignJustify className="w-3.5 h-3.5" />
          </ToolbarBtn>

          <Sep />

          {/* Lists */}
          <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="w-3.5 h-3.5" />
          </ToolbarBtn>

          <Sep />

          {/* Link */}
          <ToolbarBtn title="Insert / edit link" active={editor.isActive("link")}
            onClick={() => { setLinkUrl(editor.getAttributes("link").href ?? ""); setLinkDialogOpen(true); }}>
            <LinkIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>

          {/* Image */}
          <ToolbarBtn title="Insert image" onClick={() => setImageDialogOpen(true)}>
            <ImageIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>

          {/* Image alignment / float — active when image is selected */}
          <ToolbarBtn title="Image: align left (block)" active={getImageClass() === "align-left"} onClick={() => setImageClass("align-left")}>
            <AlignLeft className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Image: center" active={getImageClass() === "align-center"} onClick={() => setImageClass("align-center")}>
            <AlignCenter className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Image: align right (block)" active={getImageClass() === "align-right"} onClick={() => setImageClass("align-right")}>
            <AlignRight className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Image: float left (text wraps right)" active={getImageClass() === "float-left"} onClick={() => setImageClass("float-left")}>
            <MoveLeft className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Image: float right (text wraps left)" active={getImageClass() === "float-right"} onClick={() => setImageClass("float-right")}>
            <MoveRight className="w-3.5 h-3.5" />
          </ToolbarBtn>

          {/* Media Style (border, shadow, radius, margin) */}
          <div className="relative">
            <ToolbarBtn title="Image/video style (border, shadow, radius, margin)" onClick={() => setMediaStyleOpen(p => !p)}>
              <WrapText className="w-3.5 h-3.5" />
            </ToolbarBtn>
            {mediaStyleOpen && (
              <MediaStylePanel editor={editor} onClose={() => setMediaStyleOpen(false)} />
            )}
          </div>

          {/* Video Upload (direct file) */}
          <ToolbarBtn title="Upload video file (saved to Media Repository)" onClick={() => videoFileInputRef.current?.click()}>
            <Video className="w-3.5 h-3.5" />
          </ToolbarBtn>

          {/* YouTube / URL embed */}
          <ToolbarBtn title="Embed YouTube / video URL" onClick={() => setVideoDialogOpen(true)}>
            <YoutubeIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>

          {/* CTA Button */}
          <ToolbarBtn title="Insert CTA button" onClick={() => { setCtaText("Click Here"); setCtaUrl(""); setCtaBgColor("#149096"); setCtaTextColor("#ffffff"); setCtaSize("md"); setCtaFullWidth(false); setCtaDialogOpen(true); }}>
            <MousePointerClick className="w-3.5 h-3.5" />
          </ToolbarBtn>

          {/* Raw HTML */}
          <ToolbarBtn title="Insert raw HTML code" onClick={() => setHtmlDialogOpen(true)}>
            <FileCode className="w-3.5 h-3.5" />
          </ToolbarBtn>

          <Sep />

          {/* Table */}
          <div className="relative">
            <ToolbarBtn title="Table" active={editor.isActive("table")} onClick={() => setTableMenuOpen(p => !p)}>
              <TableIcon className="w-3.5 h-3.5" />
            </ToolbarBtn>
            {tableMenuOpen && (
              <div className="absolute top-9 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64" onMouseLeave={() => setTableMenuOpen(false)}>
                {!editor.isActive("table") ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 mb-2">Insert Table</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Rows</label>
                        <input type="number" min={1} max={20} value={tableRows} onChange={e => setTableRows(parseInt(e.target.value)||3)}
                          className="w-full h-7 text-sm border border-gray-200 rounded px-2 mt-0.5" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Columns</label>
                        <input type="number" min={1} max={20} value={tableCols} onChange={e => setTableCols(parseInt(e.target.value)||3)}
                          className="w-full h-7 text-sm border border-gray-200 rounded px-2 mt-0.5" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" id="table-header-row" defaultChecked className="rounded" />
                      Header row
                    </label>
                    <button type="button" className="w-full py-1.5 text-sm font-medium text-white rounded-lg bg-teal-600 hover:bg-teal-700"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const withHeader = (document.getElementById("table-header-row") as HTMLInputElement)?.checked ?? true;
                        editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: withHeader }).run();
                        setTableMenuOpen(false);
                      }}>Insert Table</button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-600 mb-2">Table Actions</p>
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowAfter().run(); setTableMenuOpen(false); }}>
                      <Rows3 className="w-3.5 h-3.5 text-gray-500" /> Add row below
                    </button>
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowBefore().run(); setTableMenuOpen(false); }}>
                      <Rows3 className="w-3.5 h-3.5 text-gray-500" /> Add row above
                    </button>
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteRow().run(); setTableMenuOpen(false); }}>
                      <TrashIcon className="w-3.5 h-3.5 text-red-400" /> Delete row
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnAfter().run(); setTableMenuOpen(false); }}>
                      <Columns3 className="w-3.5 h-3.5 text-gray-500" /> Add column right
                    </button>
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnBefore().run(); setTableMenuOpen(false); }}>
                      <Columns3 className="w-3.5 h-3.5 text-gray-500" /> Add column left
                    </button>
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteColumn().run(); setTableMenuOpen(false); }}>
                      <TrashIcon className="w-3.5 h-3.5 text-red-400" /> Delete column
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().mergeCells().run(); setTableMenuOpen(false); }}>
                      <Merge className="w-3.5 h-3.5 text-gray-500" /> Merge cells
                    </button>
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().splitCell().run(); setTableMenuOpen(false); }}>
                      <Split className="w-3.5 h-3.5 text-gray-500" /> Split cell
                    </button>
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeaderRow().run(); setTableMenuOpen(false); }}>
                      <Rows3 className="w-3.5 h-3.5 text-gray-500" /> Toggle header row
                    </button>
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeaderColumn().run(); setTableMenuOpen(false); }}>
                      <Columns3 className="w-3.5 h-3.5 text-gray-500" /> Toggle header column
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <div className="px-2 py-1">
                      <label className="text-xs text-gray-500 block mb-1">Cell background color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={cellBgColor} onChange={e => setCellBgColor(e.target.value)}
                          className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0" />
                        <button type="button" className="flex-1 h-7 text-xs font-medium text-white rounded bg-teal-600 hover:bg-teal-700"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            editor.chain().focus().setCellAttribute("backgroundColor", cellBgColor).run();
                            setTableMenuOpen(false);
                          }}>Apply</button>
                        <button type="button" className="h-7 px-2 text-xs text-gray-500 rounded border border-gray-200 hover:bg-gray-50"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            editor.chain().focus().setCellAttribute("backgroundColor", null).run();
                            setTableMenuOpen(false);
                          }}>Clear</button>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 my-1" />
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-red-50 text-red-500 flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteTable().run(); setTableMenuOpen(false); }}>
                      <TrashIcon className="w-3.5 h-3.5" /> Delete table
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <Sep />

          {/* Emoji Picker */}
          <div className="relative">
            <ToolbarBtn title="Insert emoji" onClick={() => setEmojiPickerOpen(p => !p)}>
              <Smile className="w-3.5 h-3.5" />
            </ToolbarBtn>
            {emojiPickerOpen && (
              <div className="absolute top-9 right-0 z-50 shadow-xl rounded-xl overflow-hidden" style={{ minWidth: 320 }}>
                <Picker
                  data={data}
                  onEmojiSelect={(emoji: any) => {
                    editor.chain().focus().insertContent(emoji.native).run();
                    setEmojiPickerOpen(false);
                  }}
                  theme="light"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="rte-content px-4 py-3 text-sm text-gray-800 focus:outline-none"
        style={{ minHeight, maxHeight, overflowY: "auto" }}
      />

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={insertImageFile} />
      <input ref={videoFileInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoFileSelect} />

      {/* Scoped styles */}
      <style>{`
        .rte-content .tiptap { outline: none; }
        .rte-content .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .rte-content .tiptap h1 { font-size: 1.25rem; font-weight: 800; margin: 0.75em 0 0.4em; color: #0e1e2e; }
        .rte-content .tiptap h2 { font-size: 1.05rem; font-weight: 700; margin: 0.6em 0 0.3em; color: #0e1e2e; }
        .rte-content .tiptap h3 { font-size: 0.95rem; font-weight: 600; margin: 0.5em 0 0.25em; color: #0e4a50; }
        .rte-content .tiptap ul { list-style: disc; padding-left: 1.4em; margin: 0.4em 0; }
        .rte-content .tiptap ol { list-style: decimal; padding-left: 1.4em; margin: 0.4em 0; }
        .rte-content .tiptap li { margin: 0.15em 0; }
        .rte-content .tiptap blockquote { border-left: 3px solid #149096; padding-left: 0.8em; color: #475569; font-style: italic; margin: 0.5em 0; }
        .rte-content .tiptap hr { border: none; border-top: 1px solid #e5e7eb; margin: 0.75em 0; }
        .rte-content .tiptap strong { font-weight: 700; }
        .rte-content .tiptap em { font-style: italic; }
        .rte-content .tiptap u { text-decoration: underline; }
        .rte-content .tiptap s { text-decoration: line-through; }
        .rte-content .tiptap p { margin: 0.3em 0; }
        .rte-content .tiptap a { color: #149096; text-decoration: underline; cursor: pointer; }
        /* CTA buttons inserted via Insert CTA Button dialog — rendered as styled spans, not links */
        .rte-content .tiptap [data-cta-btn] { display: inline-block; border-radius: 8px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.12); text-decoration: none !important; color: inherit; }
        .rte-content .tiptap [data-cta-btn]:hover { opacity: 0.88; transition: opacity 0.15s; }
        .rte-content .tiptap code { background: #f3f4f6; border-radius: 3px; padding: 0.1em 0.3em; font-family: monospace; font-size: 0.85em; }
        .rte-content .tiptap img { max-width: 100%; border-radius: 8px; margin: 0.5em 0; display: block; }
        .rte-content .tiptap img.float-left { float: left; margin: 0.5em 1em 0.5em 0; display: inline; }
        .rte-content .tiptap img.float-right { float: right; margin: 0.5em 0 0.5em 1em; display: inline; }
        .rte-content .tiptap img.align-center { margin-left: auto; margin-right: auto; display: block; }
        .rte-content .tiptap img.align-left { margin-right: auto; display: block; }
        .rte-content .tiptap img.align-right { margin-left: auto; display: block; }
        /* Resize handle styles from tiptap-extension-resize-image */
        .rte-content .tiptap .image-resizer { display: inline-block; position: relative; }
        .rte-content .tiptap .image-resizer .resize-trigger { position: absolute; right: -5px; bottom: -5px; width: 12px; height: 12px; background: #149096; border-radius: 2px; cursor: se-resize; }
        /* Clearfix after floated images */
        .rte-content .tiptap p:has(img.float-left), .rte-content .tiptap p:has(img.float-right) { overflow: hidden; }
        .rte-content .tiptap iframe { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
        .rte-content .tiptap .youtube-embed { max-width: 100%; }
        .rte-content .tiptap video { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
        /* Table styles */
        .rte-content .tiptap table { border-collapse: collapse; width: 100%; margin: 0.75em 0; overflow: hidden; border-radius: 6px; }
        .rte-content .tiptap table td, .rte-content .tiptap table th { border: 1px solid #d1d5db; padding: 6px 10px; min-width: 60px; vertical-align: top; position: relative; }
        .rte-content .tiptap table th { background-color: #f0fdfa; font-weight: 600; color: #0e4a50; text-align: left; }
        .rte-content .tiptap table tr:nth-child(even) td { background-color: #f9fafb; }
        .rte-content .tiptap table .selectedCell:after { z-index: 2; position: absolute; content: ""; left: 0; right: 0; top: 0; bottom: 0; background: rgba(20,144,150,0.12); pointer-events: none; }
        .rte-content .tiptap table .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: -2px; width: 4px; background-color: #149096; pointer-events: none; }
        .rte-content .tableWrapper { overflow-x: auto; }
        .rte-content .resize-cursor { cursor: col-resize; }
      `}</style>

      {/* ── Dialogs ── */}

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#149096]" /> Insert Image
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Image URL</label>
              <Input placeholder="https://example.com/image.jpg" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") insertImage(); }} autoFocus />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" /> Upload from device (base64 preview)
            </Button>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Alt text (optional)</label>
              <Input placeholder="Describe the image for accessibility" value={imageAlt} onChange={e => setImageAlt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>Cancel</Button>
            <Button onClick={insertImage} disabled={!imageUrl.trim()} style={{ background: "#149096" }} className="text-white">
              Insert Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Upload Dialog */}
      <Dialog open={videoUploadDialogOpen} onOpenChange={(v) => { if (!videoUploading) { setVideoUploadDialogOpen(v); if (!v) setVideoUploadFile(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-[#149096]" /> Upload Video
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {videoUploadFile && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-800 truncate">{videoUploadFile.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(videoUploadFile.size / (1024 * 1024)).toFixed(1)} MB · {videoUploadFile.type || "video"}
                </p>
              </div>
            )}
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-100 text-xs text-teal-700 flex items-start gap-2">
              <Video className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>This video will be automatically saved to the <strong>Media Repository</strong> and inserted inline as a playable video.</span>
            </div>
            {videoUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Uploading…</span>
                  <span>{videoUploadProgress}%</span>
                </div>
                <Progress value={videoUploadProgress} className="h-2" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVideoUploadDialogOpen(false); setVideoUploadFile(null); }} disabled={videoUploading}>
              Cancel
            </Button>
            <Button
              onClick={handleVideoUpload}
              disabled={!videoUploadFile || videoUploading}
              style={{ background: "#149096" }}
              className="text-white gap-2"
            >
              {videoUploading ? (
                <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" /> Uploading…</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload & Insert</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* YouTube / URL Video Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <YoutubeIcon className="w-5 h-5 text-red-500" /> Embed Video URL
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">YouTube or Video URL</label>
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") insertVideo(); }}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1.5">Supports YouTube and direct video URLs. The video will be embedded as a responsive player.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDialogOpen(false)}>Cancel</Button>
            <Button onClick={insertVideo} disabled={!videoUrl.trim()} style={{ background: "#149096" }} className="text-white">
              Embed Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HTML Insert Dialog */}
      <Dialog open={htmlDialogOpen} onOpenChange={setHtmlDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-[#149096]" /> Insert HTML Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-gray-500">
              Paste raw HTML to insert directly into the editor. Use this for custom embeds, iframes, tables, or complex layouts.
            </p>
            <textarea
              className="w-full min-h-[200px] font-mono text-xs border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-[#149096]/30 bg-gray-50"
              placeholder={`<iframe src="https://..." width="100%" height="400" frameborder="0"></iframe>\n\n<!-- or any valid HTML -->`}
              value={rawHtml}
              onChange={e => setRawHtml(e.target.value)}
              autoFocus
            />
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
              ⚠ Only insert trusted HTML. Script tags and event handlers may be sanitized by the browser's security model.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHtmlDialogOpen(false)}>Cancel</Button>
            <Button onClick={insertHtml} disabled={!rawHtml.trim()} style={{ background: "#149096" }} className="text-white">
              Insert HTML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CTA Button Dialog */}
      <Dialog open={ctaDialogOpen} onOpenChange={setCtaDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-[#149096]" /> Insert CTA Button
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Button Text */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Button Text</label>
              <Input placeholder="Click Here" value={ctaText} onChange={e => setCtaText(e.target.value)} autoFocus />
            </div>

            {/* Action Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Button Action</label>
              <Select value={ctaAction} onValueChange={v => setCtaAction(v as RteCTAAction)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(RTE_CTA_ACTION_LABELS) as [RteCTAAction, string][]).map(([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action-specific fields */}
            {ctaAction === "url" && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Link URL</label>
                <Input placeholder="https://example.com" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} />
              </div>
            )}
            {ctaAction === "send_email" && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email Address</label>
                <Input placeholder="hello@example.com" value={ctaEmail} onChange={e => setCtaEmail(e.target.value)} />
              </div>
            )}
            {ctaAction === "phone" && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Phone Number</label>
                <Input placeholder="+1 (555) 000-0000" value={ctaPhone} onChange={e => setCtaPhone(e.target.value)} />
              </div>
            )}
            {ctaAction === "scroll_to_section" && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Section Anchor ID</label>
                <Input placeholder="e.g. pricing" value={ctaAnchor} onChange={e => setCtaAnchor(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Add <code className="bg-gray-100 px-0.5 rounded">id="pricing"</code> to a section, then enter <code className="bg-gray-100 px-0.5 rounded">pricing</code> here.</p>
              </div>
            )}
            {ctaAction === "open_popup" && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Video / Popup URL or Embed Code</label>
                <Input placeholder="https://youtube.com/... or iframe code" value={ctaPopup} onChange={e => setCtaPopup(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">YouTube, Vimeo, Wistia URLs and iframe embed codes are supported.</p>
              </div>
            )}
            {ctaAction === "download_file" && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">File URL</label>
                <Input placeholder="https://... (direct file URL)" value={ctaDownload} onChange={e => setCtaDownload(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Triggers a file download when clicked. Use a direct link to a PDF, ZIP, etc.</p>
              </div>
            )}
            {ctaAction === "direct_checkout" && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-teal-700 font-medium">Opens Stripe Checkout. After payment, user is sent to /my-dashboard.</p>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Product</label>
                  <select
                    value={ctaCheckoutProductId ? `${ctaCheckoutProductType}:${ctaCheckoutProductId}` : ""}
                    onChange={e => { const [type, id] = e.target.value.split(":"); setCtaCheckoutProductType(type || ""); setCtaCheckoutProductId(id ? Number(id) : null); }}
                    className="w-full h-8 text-sm rounded border border-gray-200 px-2"
                  >
                    <option value="">-- Select product --</option>
                    {(productCatalog ?? []).map(p => (
                      <option key={`${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>{p.name} ({p.type}) — ${Number(p.price).toFixed(2)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {ctaAction === "pricing_option" && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-teal-700 font-medium">Links directly to a specific pricing option checkout for this course.</p>
                {!courseId ? (
                  <p className="text-xs text-amber-600">Pricing option checkout is only available when editing a course landing page.</p>
                ) : (
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Pricing Option</label>
                    <select
                      value={ctaPricingOptionId ?? ""}
                      onChange={e => setCtaPricingOptionId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full h-8 text-sm rounded border border-gray-200 px-2"
                    >
                      <option value="">-- Select pricing option --</option>
                      {(pricingOptions ?? []).map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label} — ${Number(opt.price).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Appearance */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Appearance</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={ctaBgColor} onChange={e => setCtaBgColor(e.target.value)} className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0" />
                    <Input value={ctaBgColor} onChange={e => setCtaBgColor(e.target.value)} className="h-8 text-xs font-mono" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={ctaTextColor} onChange={e => setCtaTextColor(e.target.value)} className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0" />
                    <Input value={ctaTextColor} onChange={e => setCtaTextColor(e.target.value)} className="h-8 text-xs font-mono" />
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Size</label>
                <div className="flex gap-2">
                  {(["sm", "md", "lg"] as const).map(s => (
                    <button key={s} type="button"
                      onClick={() => setCtaSize(s)}
                      className={`flex-1 h-8 rounded text-xs font-medium border transition-all ${
                        ctaSize === s ? "border-[#149096] bg-[#149096] text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}>
                      {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cta-full-width" checked={ctaFullWidth} onChange={e => setCtaFullWidth(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-[#149096]" />
                <label htmlFor="cta-full-width" className="text-sm text-gray-700 cursor-pointer">Full width button</label>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex justify-center">
              <span style={{ display: ctaFullWidth ? "block" : "inline-block", textAlign: "center", width: ctaFullWidth ? "100%" : "auto", padding: ctaSize === "sm" ? "8px 18px" : ctaSize === "lg" ? "16px 36px" : "12px 28px", backgroundColor: ctaBgColor, color: ctaTextColor, borderRadius: "8px", fontWeight: 700, fontSize: ctaSize === "sm" ? "13px" : ctaSize === "lg" ? "18px" : "15px", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", cursor: "default" }}>
                {ctaText || "Click Here"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCtaDialogOpen(false)}>Cancel</Button>
            <Button onClick={insertCtaButton} disabled={!ctaText.trim()} style={{ background: "#149096" }} className="text-white">
              Insert Button
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-[#149096]" /> Insert Link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">URL</label>
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") insertLink(); }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            {editor.isActive("link") && (
              <Button variant="outline" className="text-red-500 hover:text-red-600 mr-auto"
                onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkDialogOpen(false); }}>
                <X className="w-4 h-4 mr-1" /> Remove link
              </Button>
            )}
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={insertLink} style={{ background: "#149096" }} className="text-white">
              {linkUrl.trim() ? "Insert Link" : "Remove Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Read-only display ────────────────────────────────────────────────────────

/**
 * RichTextDisplay — renders saved HTML from RichTextEditor in read-only mode.
 * Use wherever rich text content is displayed (case detail, admin preview, etc.)
 */
export function RichTextDisplay({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  if (!html) return null;
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-gray-700",
        "[&_h1]:text-lg [&_h1]:font-extrabold [&_h1]:text-[#0e1e2e] [&_h1]:mt-4 [&_h1]:mb-2",
        "[&_h2]:text-base [&_h2]:font-bold [&_h2]:text-[#0e1e2e] [&_h2]:mt-3 [&_h2]:mb-1",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[#0e4a50] [&_h3]:mt-2 [&_h3]:mb-1",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1",
        "[&_li]:my-0.5",
        "[&_blockquote]:border-l-[3px] [&_blockquote]:border-[#149096] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-500 [&_blockquote]:my-2",
        "[&_hr]:border-t [&_hr]:border-gray-200 [&_hr]:my-2",
        "[&_strong]:font-bold",
        "[&_em]:italic",
        "[&_u]:underline",
        "[&_s]:line-through",
        "[&_a]:text-[#149096] [&_a]:underline",
        "[&_p]:my-1",
        "[&_code]:bg-gray-100 [&_code]:rounded [&_code]:px-1 [&_code]:text-xs [&_code]:font-mono",
        "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2",
        "[&_iframe]:max-w-full [&_iframe]:rounded-lg [&_iframe]:my-2",
        "[&_video]:max-w-full [&_video]:rounded-lg [&_video]:my-2",
        "[&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-sm",
        "[&_th]:border [&_th]:border-gray-300 [&_th]:bg-teal-50 [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-left [&_th]:text-teal-800",
        "[&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        "[&_tr:nth-child(even)_td]:bg-gray-50",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
