/**
 * FormSuccessPageBlockEditor.tsx
 * Full-page success builder for form success modules.
 */
import React, { useState, useCallback } from "react";
import {
  Plus, Trash2, GripVertical, Type, Image, Video, List, Minus,
  AlertTriangle, Globe, Heading, MousePointerClick, GitBranch,
} from "lucide-react";
import { BlockPreview, Block, BlockType } from "@/components/BlockPreview";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/RichTextEditor";

const SUCCESS_PAGE_BLOCKS: {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  defaultData: Record<string, unknown>;
}[] = [
  { type: "hero", label: "Hero / Heading", icon: <Heading size={14} />, defaultData: { headline: "Thank you!", subheadline: "Your submission was received.", bgColor: "#ffffff", textColor: "#111827" } },
  { type: "text", label: "Rich Text", icon: <Type size={14} />, defaultData: { html: "<p>Enter your message here. Use merge fields like {{name}} or {{score_percent}}.</p>", bgColor: "#ffffff" } },
  { type: "image", label: "Image", icon: <Image size={14} />, defaultData: { src: "", alt: "", caption: "", bgColor: "#ffffff" } },
  { type: "video", label: "Video", icon: <Video size={14} />, defaultData: { url: "", caption: "", bgColor: "#ffffff" } },
  { type: "bullets", label: "Bullet List", icon: <List size={14} />, defaultData: { headline: "Next steps", items: ["Step 1", "Step 2"], bgColor: "#ffffff" } },
  { type: "cta_standalone", label: "Button / CTA", icon: <MousePointerClick size={14} />, defaultData: { headline: "", ctaText: "Continue", ctaUrl: "/", ctaColor: "#0e7490", bgColor: "#ffffff" } },
  { type: "alert", label: "Alert / Callout", icon: <AlertTriangle size={14} />, defaultData: { type: "info", title: "", message: "Important note.", bgColor: "#ffffff" } },
  { type: "embed", label: "Embed / iFrame", icon: <Globe size={14} />, defaultData: { url: "", height: 400, bgColor: "#ffffff" } },
  { type: "divider", label: "Divider", icon: <Minus size={14} />, defaultData: { color: "#e5e7eb", thickness: 1 } },
  { type: "conditional_text" as BlockType, label: "Conditional Text", icon: <GitBranch size={14} />, defaultData: { fieldId: "__pass_status__", operator: "equals", value: "pass", htmlIfTrue: "<p>You passed!</p>", htmlIfFalse: "<p>Please review the instructions below.</p>", bgColor: "#ffffff" } },
];

function BlockSettings({ block, onUpdate }: { block: Block; onUpdate: (data: Record<string, unknown>) => void }) {
  const d = block.data;
  const set = (key: string, val: unknown) => onUpdate({ ...d, [key]: val });

  if (block.type === "hero") {
    return (
      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">Headline</label>
        <input value={String(d.headline ?? "")} onChange={e => set("headline", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
        <label className="text-xs text-gray-500 block">Subheadline</label>
        <textarea value={String(d.subheadline ?? "")} onChange={e => set("subheadline", e.target.value)} rows={2} className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs resize-y" />
      </div>
    );
  }

  if (block.type === "text") {
    return (
      <RichTextEditor
        value={String(d.html ?? "")}
        onChange={html => set("html", html)}
        placeholder="Write your success page content…"
        minHeight={120}
        maxHeight={400}
      />
    );
  }

  if (block.type === "cta_standalone") {
    return (
      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">Button label</label>
        <input value={String(d.ctaText ?? "")} onChange={e => set("ctaText", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
        <label className="text-xs text-gray-500 block">Button URL</label>
        <input value={String(d.ctaUrl ?? "")} onChange={e => set("ctaUrl", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" placeholder="https:// or /path" />
      </div>
    );
  }

  if (block.type === "conditional_text") {
    return (
      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">Field ID (or __pass_status__, __score_percent__)</label>
        <input value={String(d.fieldId ?? "")} onChange={e => set("fieldId", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs font-mono" />
        <label className="text-xs text-gray-500 block">Operator</label>
        <select value={String(d.operator ?? "equals")} onChange={e => set("operator", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs">
          <option value="equals">equals</option>
          <option value="not_equals">does not equal</option>
          <option value="contains">contains</option>
          <option value="greater_or_equal">≥</option>
          <option value="less_than">&lt;</option>
        </select>
        <label className="text-xs text-gray-500 block">Compare value</label>
        <input value={String(d.value ?? "")} onChange={e => set("value", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
        <label className="text-xs text-gray-500 block">Content if true</label>
        <textarea value={String(d.htmlIfTrue ?? "")} onChange={e => set("htmlIfTrue", e.target.value)} rows={3} className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs font-mono resize-y" />
        <label className="text-xs text-gray-500 block">Content if false</label>
        <textarea value={String(d.htmlIfFalse ?? "")} onChange={e => set("htmlIfFalse", e.target.value)} rows={3} className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs font-mono resize-y" />
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">Image URL</label>
        <input value={String(d.src ?? "")} onChange={e => set("src", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
        <label className="text-xs text-gray-500 block">Caption</label>
        <input value={String(d.caption ?? "")} onChange={e => set("caption", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
      </div>
    );
  }

  if (block.type === "video") {
    return (
      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">Video URL</label>
        <input value={String(d.url ?? "")} onChange={e => set("url", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
      </div>
    );
  }

  if (block.type === "bullets") {
    return (
      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">Headline</label>
        <input value={String(d.headline ?? "")} onChange={e => set("headline", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
        <label className="text-xs text-gray-500 block">Items (one per line)</label>
        <textarea
          value={((d.items as string[]) ?? []).join("\n")}
          onChange={e => set("items", e.target.value.split("\n"))}
          rows={4}
          className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs resize-y"
        />
      </div>
    );
  }

  if (block.type === "alert") {
    return (
      <div className="space-y-2">
        <select value={String(d.type ?? "info")} onChange={e => set("type", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs">
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <input value={String(d.title ?? "")} onChange={e => set("title", e.target.value)} placeholder="Title" className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
        <textarea value={String(d.message ?? "")} onChange={e => set("message", e.target.value)} rows={3} className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs resize-y" />
      </div>
    );
  }

  if (block.type === "embed") {
    return (
      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">Embed URL</label>
        <input value={String(d.url ?? "")} onChange={e => set("url", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
        <label className="text-xs text-gray-500 block">Height (px)</label>
        <input type="number" value={Number(d.height ?? 400)} onChange={e => set("height", parseInt(e.target.value) || 400)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" />
      </div>
    );
  }

  return <p className="text-xs text-gray-400">No settings for this block.</p>;
}

export interface FormSuccessPageBlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export default function FormSuccessPageBlockEditor({ blocks, onChange }: FormSuccessPageBlockEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(blocks[0]?.id ?? null);
  const [showPicker, setShowPicker] = useState(false);

  const addBlock = useCallback((type: BlockType, defaultData: Record<string, unknown>) => {
    const block: Block = { id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, data: { ...defaultData } };
    onChange([...blocks, block]);
    setExpandedId(block.id);
    setShowPicker(false);
  }, [blocks, onChange]);

  const updateBlock = (id: string, data: Record<string, unknown>) => {
    onChange(blocks.map(b => (b.id === id ? { ...b, data } : b)));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter(b => b.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const next = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Build a full success page with headings, images, buttons, embeds, and conditional text.</p>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setShowPicker(v => !v)}>
          <Plus className="w-3.5 h-3.5" /> Add Block
        </Button>
      </div>

      {showPicker && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border border-dashed border-gray-200 rounded-lg bg-gray-50">
          {SUCCESS_PAGE_BLOCKS.map(b => (
            <button
              key={b.type}
              type="button"
              onClick={() => addBlock(b.type, b.defaultData)}
              className="flex items-center gap-2 text-left px-2 py-2 rounded border border-gray-200 bg-white hover:border-teal-400 text-xs"
            >
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-lg text-sm text-gray-400">
          No blocks yet. Add a Hero or Rich Text block to start.
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.map((block, idx) => (
            <div key={block.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                <GripVertical className="w-4 h-4 text-gray-300" />
                <span className="text-xs font-medium text-gray-700 flex-1 capitalize">{block.type.replace(/_/g, " ")}</span>
                <button type="button" onClick={() => moveBlock(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">↑</button>
                <button type="button" onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">↓</button>
                <button type="button" onClick={() => setExpandedId(expandedId === block.id ? null : block.id)} className="text-xs text-teal-700 px-2">{expandedId === block.id ? "Collapse" : "Edit"}</button>
                <button type="button" onClick={() => removeBlock(block.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {expandedId === block.id && (
                <div className="p-3 grid md:grid-cols-2 gap-4">
                  <BlockSettings block={block} onUpdate={data => updateBlock(block.id, data)} />
                  <div className="border border-gray-100 rounded-lg p-2 bg-gray-50/50 max-h-80 overflow-y-auto">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">Preview</p>
                    {block.type === "conditional_text" ? (
                      <p className="text-xs text-gray-500 italic">Conditional blocks render based on submission data at runtime.</p>
                    ) : (
                      <BlockPreview block={block} />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function parseSuccessPageBlocks(json: string | null | undefined): Block[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
