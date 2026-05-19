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
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Youtube from "@tiptap/extension-youtube";
import { useState, useRef, useCallback, useEffect } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { toast } from "sonner";

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
}

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
          ? "bg-[#0891b2] text-white"
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
  "#EAB308", "#22C55E", "#0891B2", "#3B82F6", "#8B5CF6",
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

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write here…",
  minHeight = 160,
  maxHeight = 600,
  className,
  disabled = false,
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
  const [customColor, setCustomColor] = useState("#179ca3");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: true }),
      VideoNode,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "text-[#0891b2] underline cursor-pointer" },
      }),
      Youtube.configure({ controls: true, nocookie: true }),
      Placeholder.configure({ placeholder }),
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

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rich-text-editor border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0891b2]/30 focus-within:border-[#0891b2] transition-all",
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
                      placeholder="#179ca3"
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

          {/* Video Upload (direct file) */}
          <ToolbarBtn title="Upload video file (saved to Media Repository)" onClick={() => videoFileInputRef.current?.click()}>
            <Video className="w-3.5 h-3.5" />
          </ToolbarBtn>

          {/* YouTube / URL embed */}
          <ToolbarBtn title="Embed YouTube / video URL" onClick={() => setVideoDialogOpen(true)}>
            <YoutubeIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>

          {/* Raw HTML */}
          <ToolbarBtn title="Insert raw HTML code" onClick={() => setHtmlDialogOpen(true)}>
            <FileCode className="w-3.5 h-3.5" />
          </ToolbarBtn>

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
        .rte-content .tiptap blockquote { border-left: 3px solid #0891b2; padding-left: 0.8em; color: #475569; font-style: italic; margin: 0.5em 0; }
        .rte-content .tiptap hr { border: none; border-top: 1px solid #e5e7eb; margin: 0.75em 0; }
        .rte-content .tiptap strong { font-weight: 700; }
        .rte-content .tiptap em { font-style: italic; }
        .rte-content .tiptap u { text-decoration: underline; }
        .rte-content .tiptap s { text-decoration: line-through; }
        .rte-content .tiptap p { margin: 0.3em 0; }
        .rte-content .tiptap a { color: #0891b2; text-decoration: underline; cursor: pointer; }
        .rte-content .tiptap code { background: #f3f4f6; border-radius: 3px; padding: 0.1em 0.3em; font-family: monospace; font-size: 0.85em; }
        .rte-content .tiptap img { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
        .rte-content .tiptap iframe { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
        .rte-content .tiptap .youtube-embed { max-width: 100%; }
        .rte-content .tiptap video { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
      `}</style>

      {/* ── Dialogs ── */}

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#0891b2]" /> Insert Image
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
            <Button onClick={insertImage} disabled={!imageUrl.trim()} style={{ background: "#0891b2" }} className="text-white">
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
              <Video className="w-5 h-5 text-[#0891b2]" /> Upload Video
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
              style={{ background: "#0891b2" }}
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
            <Button onClick={insertVideo} disabled={!videoUrl.trim()} style={{ background: "#0891b2" }} className="text-white">
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
              <FileCode className="w-5 h-5 text-[#0891b2]" /> Insert HTML Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-gray-500">
              Paste raw HTML to insert directly into the editor. Use this for custom embeds, iframes, tables, or complex layouts.
            </p>
            <textarea
              className="w-full min-h-[200px] font-mono text-xs border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-[#0891b2]/30 bg-gray-50"
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
            <Button onClick={insertHtml} disabled={!rawHtml.trim()} style={{ background: "#0891b2" }} className="text-white">
              Insert HTML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-[#0891b2]" /> Insert Link
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
            <Button onClick={insertLink} style={{ background: "#0891b2" }} className="text-white">
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
        "[&_blockquote]:border-l-[3px] [&_blockquote]:border-[#0891b2] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-500 [&_blockquote]:my-2",
        "[&_hr]:border-t [&_hr]:border-gray-200 [&_hr]:my-2",
        "[&_strong]:font-bold",
        "[&_em]:italic",
        "[&_u]:underline",
        "[&_s]:line-through",
        "[&_a]:text-[#0891b2] [&_a]:underline",
        "[&_p]:my-1",
        "[&_code]:bg-gray-100 [&_code]:rounded [&_code]:px-1 [&_code]:text-xs [&_code]:font-mono",
        "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2",
        "[&_iframe]:max-w-full [&_iframe]:rounded-lg [&_iframe]:my-2",
        "[&_video]:max-w-full [&_video]:rounded-lg [&_video]:my-2",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
